"""Arkix haftalık e-posta özeti (GitHub Actions: her pazartesi 08.00, .github/workflows/haftalik.yml).

E-posta iznini açan (kullanicilar/{uid}.profil.eposta_izni.izin == true) her kullanıcıya kişisel özet:
haftanın öne çıkanları, kullanıcının takip ettiklerinden yeni kayıtlar, Arkix Özel yazıları. Önce ayrılma
isteklerini (abonelik_iptal) işler. Elle deneme: DENEME_EPOSTA=adres ile yalnız o adrese, ilk izinli kullanıcının
içeriğiyle gönderir. Gizli ayarlar ve açıklama: eposta_ortak.py.

    python toplayici/haftalik.py            # gönderir
    KURU=1 python toplayici/haftalik.py     # göndermez, kime ne gideceğini yazar
"""
from __future__ import annotations

import datetime as dt
import html
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import eposta_ortak as E  # noqa: E402

KOK = Path(__file__).resolve().parents[1]
BULTEN = KOK / "docs" / "veri" / "bulten.json"


def kucuk(s: str | None) -> str:
    return (s or "").lower()


def eslesir(r: dict, t: dict) -> bool:
    """docs/takip.js › takipEslesir ile aynı kural."""
    d = kucuk(t.get("deger"))
    tur = t.get("tur")
    if tur == "kelime": return any(d in kucuk(r.get(a)) for a in ("b", "o", "bt", "ot", "be", "oe"))
    if tur == "kavram": return t.get("deger") in (r.get("e") or [])
    if tur == "yazar": return d in kucuk(r.get("y"))
    if tur == "dergi": return d in kucuk(r.get("w"))
    if tur == "kaynak": return kucuk(r.get("s")) == d
    return False


def baslik(r: dict, en: bool) -> str:
    if en: return r.get("be") or r["b"]
    return r.get("bt") or r["b"] if r.get("l") not in ("tr", "") else r["b"]


def satir_html(r: dict, en: bool) -> str:
    adres = f"{E.SITE}/#k/{r['i']}"
    kaynak = html.escape(r.get("w") or r.get("s") or "")
    return (f'<tr><td style="padding:10px 0;border-bottom:1px solid #e6e1d6">'
            f'<div style="font:600 11px/1.4 -apple-system,Segoe UI,sans-serif;color:#8a6a2f;text-transform:uppercase;letter-spacing:.06em">'
            f'{html.escape(r.get("k", ""))} · {kaynak}</div>'
            f'<a href="{adres}" style="font:600 16px/1.35 -apple-system,Segoe UI,sans-serif;color:#1f2420;text-decoration:none">'
            f'{html.escape(baslik(r, en))}</a></td></tr>')


def bolum(baslik_metni: str, kayitlar: list[dict], en: bool) -> str:
    if not kayitlar: return ""
    return (f'<h2 style="font:700 13px/1.4 -apple-system,Segoe UI,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#b8863b;margin:26px 0 4px">'
            f'{html.escape(baslik_metni)}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">'
            + "".join(satir_html(r, en) for r in kayitlar) + "</table>")


def ileti_hazirla(kullanici: dict, haftalik: list[dict], one: list[dict], ozel: list[dict], en: bool) -> tuple[str, str, str] | None:
    takip = (kullanici.get("kitaplik") or {}).get("takip") or []
    takipler = [r for r in haftalik if any(eslesir(r, t) for t in takip)][:10]
    if not (one or takipler or ozel):
        return None
    tarih = dt.date.today().strftime("%d.%m.%Y")
    konu = (f"Arkix weekly · {len(takipler)} new for you" if en and takipler else "Arkix weekly" if en
            else f"Arkix haftalık · takibinizden {len(takipler)} yeni kayıt" if takipler else "Arkix haftalık özet")
    ayril = E.ayrilma_adresi(kullanici["_id"])
    govde = (
        f'<div style="background:#eef0e9;padding:24px 12px"><div style="max-width:560px;margin:0 auto;background:#f7f8f3;border-radius:16px;padding:24px 22px">'
        f'<div style="font:800 24px/1.2 -apple-system,Segoe UI,sans-serif;color:#1f2420">Arkix</div>'
        f'<div style="font:13px/1.4 -apple-system,Segoe UI,sans-serif;color:#5f675f">{"Archaeology News · weekly" if en else "Arkeoloji Bülteni · haftalık özet"} · {tarih}</div>'
        + bolum("Following" if en else "Takip ettiklerinizden", takipler, en)
        + bolum("Arkix Special" if en else "Arkix Özel", ozel, en)
        + bolum("Highlights of the week" if en else "Haftanın öne çıkanları", one, en)
        + f'<p style="margin:28px 0 0"><a href="{E.SITE}" style="display:inline-block;background:#1f2420;color:#f7f8f3;text-decoration:none;'
          f'font:600 15px -apple-system,Segoe UI,sans-serif;padding:12px 20px;border-radius:12px">{"Open Arkix" if en else "Arkix’i aç"}</a></p>'
        + f'<p style="font:12px/1.5 -apple-system,Segoe UI,sans-serif;color:#8a908a;margin:26px 0 0">'
          + (f'You receive this because you turned on email updates in Arkix. <a href="{ayril}" style="color:#8a908a">Unsubscribe</a>.'
             if en else f'Bu e-postayı Arkix’te yenilik e-postalarını açtığınız için alıyorsunuz. <a href="{ayril}" style="color:#8a908a">Ayrıl</a>.')
          + ' · Harrix · harrixapp@gmail.com</p></div></div>')
    duz = "\n".join([konu, ""] + [f"- {baslik(r, en)}\n  {E.SITE}/#k/{r['i']}" for r in takipler + ozel + one]
                    + ["", ("Unsubscribe: " if en else "Ayrıl: ") + ayril])
    return konu, duz, govde


def main() -> int:
    kuru = bool(os.environ.get("KURU"))
    deneme = os.environ.get("DENEME_EPOSTA", "").strip()
    veri = json.loads(BULTEN.read_text(encoding="utf-8"))
    sinir = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)).isoformat()
    haftalik = [r for r in veri["kayitlar"] if (r.get("g") or "") >= sinir and not r.get("oz")]
    one = sorted(haftalik, key=lambda r: (r.get("ks", 1), r.get("ys", 0), r.get("g", "")), reverse=True)[:6]
    ozel = [r for r in veri["kayitlar"] if r.get("oz") and (r.get("g") or r.get("t") or "") >= sinir[:10]][:3]

    if not kuru:
        print(f"Ayrılma isteği işlendi: {E.ayrilmalari_isle()}")
    alicilar = E.sorgu("kullanicilar", E.esit("profil.eposta_izni.izin", True))
    print(f"İzinli kullanıcı: {len(alicilar)}")
    if deneme:
        alicilar = alicilar[:1] or [{"_id": "deneme", "kitaplik": {}, "profil": {"eposta_izni": {"eposta": deneme}}}]
    smtp = None if kuru else E.smtp_baglan()
    gonderilen = 0
    for k in alicilar:
        izin = (k.get("profil") or {}).get("eposta_izni") or {}
        adres = deneme or izin.get("eposta", "")
        if not adres or "@" not in adres:
            continue
        en = (k.get("profil") or {}).get("dil") == "en"
        hazir = ileti_hazirla(k, haftalik, one, ozel, en)
        if not hazir:
            continue
        konu, duz, govde = hazir
        if kuru:
            print(f"[kuru] {adres}: {konu}")
            continue
        try:
            smtp.send_message(E.ileti(adres, konu, duz, govde, E.ayrilma_adresi(k["_id"])))
            gonderilen += 1
        except Exception as hata:  # noqa: BLE001
            print(f"Gönderilemedi ({adres.split('@')[-1]}): {hata}")
        time.sleep(1.2)   # paylaşımlı posta sunucusunu yormamak için
    if smtp:
        smtp.quit()
    print(f"Gönderilen: {gonderilen}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
