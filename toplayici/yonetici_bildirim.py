"""Yöneticiye yeni geri bildirim ve şikâyet uyarısı (GitHub Actions: saatte bir, .github/workflows/yonetici.yml).

Son bakıştan (sistem/yonetici_bildirim.son) beri gelen geribildirim ve sikayetler varsa harrixapp@gmail.com'a kısa bir
e-posta ve (NTFY_KONU tanımlıysa) telefon bildirimi gönderir. Bildirimde kişisel veri yok; ayrıntı yönetim panelinde.
"""
from __future__ import annotations

import datetime as dt
import html
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import eposta_ortak as E  # noqa: E402

YONETICI = "harrixapp@gmail.com"
PANEL = f"{E.SITE}/#yonetim"
TUR_AD = {"hata": "hata bildirimi", "istek": "istek/öneri", "kayit": "kayıt bildirimi", "diger": "bildirim"}


def main() -> int:
    simdi = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    durum = E.oku("sistem/yonetici_bildirim") or {}
    son = durum.get("son") or (simdi - dt.timedelta(hours=1)).isoformat().replace("+00:00", "Z")
    gb = E.sorgu("geribildirim", E.buyuk("tarih", son))
    sk = E.sorgu("sikayetler", E.buyuk("tarih", son))
    yeni_yorum = E.sorgu("yorumlar", E.buyuk("tarih", son))
    E.yaz("sistem/yonetici_bildirim", {"son": simdi.isoformat().replace("+00:00", "Z")})
    if not (gb or sk):
        print(f"Yeni yok (geri bildirim 0, şikâyet 0, yorum {len(yeni_yorum)}).")
        return 0
    sayac = {}
    for g in gb:
        sayac[g.get("tur", "diger")] = sayac.get(g.get("tur", "diger"), 0) + 1
    parcalar = [f"{n} {TUR_AD.get(t, t)}" for t, n in sayac.items()] + ([f"{len(sk)} yorum şikâyeti"] if sk else [])
    ozet = ", ".join(parcalar)
    if yeni_yorum:
        ozet += f" · {len(yeni_yorum)} yeni yorum"
    E.ntfy("Arkix: yeni bildirim", ozet, PANEL)
    satirlar = "".join(f"<li><b>{html.escape(TUR_AD.get(g.get('tur'), ''))}</b>: {html.escape((g.get('metin') or '')[:160])}</li>" for g in gb[:10])
    govde = (f"<p>{html.escape(ozet)}</p><ul>{satirlar}</ul>"
             f"<p><a href='{PANEL}'>Yönetim panelini aç</a> (harrixapp@gmail.com ile giriş)</p>")
    smtp = E.smtp_baglan()
    smtp.send_message(E.ileti(YONETICI, f"Arkix: {ozet}", f"{ozet}\n\nYönetim paneli: {PANEL}", govde))
    smtp.quit()
    print(f"Yöneticiye bildirildi: {ozet}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
