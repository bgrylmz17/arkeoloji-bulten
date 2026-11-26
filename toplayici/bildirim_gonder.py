"""Telefona bildirim (GitHub Actions: saatte bir, .github/workflows/yonetici.yml içinde).

Abonelikler: Firestore bildirim_abonelik/{id} { token, platform: web|ios|android, kategoriler, uid, dil }.
  web     → Firebase Cloud Messaging HTTP v1 (hizmet hesabı, firebase.messaging kapsamı)
  ios/android → Expo push (https://exp.host/--/api/v2/push/send; jeton ExponentPushToken[...])
Kategoriler ve sıklık (az ve öz):
  ozel      yeni Arkix Özel yazısı (her biri)
  sondakika "flash" işaretli yeni haber; çalışma başına en çok 1, günde en çok 2
  kazi      yeni onaylanan kazı duyurusu (en çok 2 / çalışma)
  takip     takip ettiklerinden son 24 saatte yeni kayıt sayısı; günde bir, 06 UTC sonrası (uid gerekir)
Durum: sistem/push_durum { son, kazi, sd_gun, sd_sayi, takip_gun }. İlk çalışmada yalnız durum yazılır (eski içerik yağmuru olmasın).
Geçersiz jetonun aboneliği silinir. KURU=1: göndermez, yazar.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import eposta_ortak as E  # noqa: E402
from haftalik import eslesir  # noqa: E402

KOK = Path(__file__).resolve().parents[1]
BULTEN = KOK / "docs" / "veri" / "bulten.json"
PROJE = "harrix-bulten"


def baslik(r: dict, en: bool) -> str:
    if en: return r.get("be") or r["b"]
    return (r.get("bt") or r["b"]) if r.get("l") not in ("tr", "", None) else r["b"]


def fcm_gonder(token: str, veri: dict) -> str:
    """'' başarılı, 'sil' geçersiz jeton, diğer: hata metni."""
    govde = {"message": {"token": token, "data": {k: str(v) for k, v in veri.items()},
                         "webpush": {"headers": {"Urgency": "normal", "TTL": "86400"}}}}
    r = urllib.request.Request(f"https://fcm.googleapis.com/v1/projects/{PROJE}/messages:send", method="POST",
                               data=json.dumps(govde).encode(),
                               headers={"Authorization": f"Bearer {E.erisim_jetonu()}", "Content-Type": "application/json"})
    try:
        urllib.request.urlopen(r, timeout=20).read()
        return ""
    except urllib.error.HTTPError as h:
        metin = h.read().decode(errors="ignore")
        if h.code == 404 or "UNREGISTERED" in metin or ("INVALID_ARGUMENT" in metin and "token" in metin.lower()):
            return "sil"
        return f"{h.code} {metin[:160]}"


def expo_gonder(iletiler: list[dict]) -> list[str]:
    if not iletiler: return []
    r = urllib.request.Request("https://exp.host/--/api/v2/push/send", method="POST", data=json.dumps(iletiler).encode(),
                               headers={"Content-Type": "application/json", "Accept": "application/json"})
    try:
        sonuc = json.loads(urllib.request.urlopen(r, timeout=30).read()).get("data", [])
    except Exception as h:  # noqa: BLE001
        return [str(h)] * len(iletiler)
    return ["sil" if (s.get("details") or {}).get("error") == "DeviceNotRegistered" else ("" if s.get("status") == "ok" else s.get("message", "hata"))
            for s in sonuc]


def main() -> int:
    kuru = bool(os.environ.get("KURU"))
    simdi = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    simdi_iso = simdi.isoformat().replace("+00:00", "Z")
    bugun = simdi.date().isoformat()
    durum = E.oku("sistem/push_durum")
    veri = json.loads(BULTEN.read_text(encoding="utf-8"))
    onayli = [k for k in E.sorgu("kazi_duyurulari", E.esit("durum", "onayli"))]
    if not durum:
        if not kuru:
            E.yaz("sistem/push_durum", {"son": simdi_iso, "kazi": [k["_id"] for k in onayli][-300:], "sd_gun": bugun, "sd_sayi": 0, "takip_gun": bugun})
        print("İlk çalışma: durum yazıldı, gönderim yok.")
        return 0
    son = durum.get("son") or simdi_iso
    gonderilen_kazi = set(durum.get("kazi") or [])
    sd_sayi = durum.get("sd_sayi", 0) if durum.get("sd_gun") == bugun else 0

    # olaylar: (kategori, tr_baslik, tr_metin, en_baslik, en_metin, url, tag)
    olaylar = []
    for r in veri["kayitlar"]:
        if r.get("oz") and (r.get("g") or "") > son:
            olaylar.append(("ozel", "Arkix Özel", baslik(r, False), "Arkix Special", baslik(r, True), f"./#k/{r['i']}", f"ozel-{r['i']}"))
    flash = [r for r in veri["kayitlar"] if r.get("flash") and r.get("k") == "Haber" and (r.get("g") or "") > son]
    if flash and sd_sayi < 2:
        r = max(flash, key=lambda x: x.get("ks", 0))
        ks = r.get("ks") or 0
        olaylar.append(("sondakika", "Son dakika" + (f" · {ks} kaynakta" if ks else ""), baslik(r, False),
                        "Breaking" + (f" · {ks} sources" if ks else ""), baslik(r, True), f"./#k/{r['i']}", "sondakika"))
        sd_sayi += 1
    yeni_kazi = [k for k in onayli if k["_id"] not in gonderilen_kazi][:2]
    for k in yeni_kazi:
        yer = " · ".join(x for x in (k.get("kazi"), k.get("il")) if x)
        olaylar.append(("kazi", "Kazı duyurusu" + (f" · {yer}" if yer else ""), k.get("baslik", ""),
                        "Excavation notice" + (f" · {yer}" if yer else ""), k.get("baslik", ""), "./#ozel/kazi", f"kazi-{k['_id']}"))
    takip_zamani = durum.get("takip_gun") != bugun and simdi.hour >= 6

    abonelikler = E.sorgu("bildirim_abonelik")
    print(f"Abonelik: {len(abonelikler)} · olay: {len(olaylar)} · takip turu: {takip_zamani}")
    sinir24 = (simdi - dt.timedelta(hours=24)).isoformat()
    takip_onbellek: dict[str, list] = {}
    sayac = {"gonderildi": 0, "silindi": 0, "hata": 0}
    expo_kuyruk: list[tuple[dict, dict]] = []

    def gonder(a: dict, b: str, m: str, url: str, tag: str):
        if kuru:
            print(f"[kuru] {a.get('platform')} {b}: {m[:60]}")
            return
        if a.get("platform") == "web":
            s = fcm_gonder(a["token"], {"baslik": b, "metin": m, "url": url, "tag": tag})
            sonuc(a, s)
        else:
            expo_kuyruk.append((a, {"to": a["token"], "title": b, "body": m, "data": {"url": url.replace("./#", "/")}, "sound": "default"}))

    def sonuc(a: dict, s: str):
        if s == "":
            sayac["gonderildi"] += 1
        elif s == "sil":
            sayac["silindi"] += 1
            E.sil(f"bildirim_abonelik/{a['_id']}")
        else:
            sayac["hata"] += 1
            print(f"Gönderilemedi ({a.get('platform')}): {s}")

    for a in abonelikler:
        kat = set(a.get("kategoriler") or [])
        en = a.get("dil") == "en"
        for (k, tb, tm, eb, em, url, tag) in olaylar:
            if k in kat:
                gonder(a, eb if en else tb, em if en else tm, url, tag)
        if takip_zamani and "takip" in kat and a.get("uid"):
            uid = a["uid"]
            if uid not in takip_onbellek:
                kul = E.oku(f"kullanicilar/{uid}") or {}
                takip_onbellek[uid] = (kul.get("kitaplik") or {}).get("takip") or []
            takip = takip_onbellek[uid]
            yeni = [r for r in veri["kayitlar"] if (r.get("g") or "") >= sinir24 and any(eslesir(r, t) for t in takip)] if takip else []
            if yeni:
                gonder(a, f"{len(yeni)} new for you" if en else f"Takip ettiklerinden {len(yeni)} yeni kayıt", baslik(yeni[0], en), "./#takip", "takip")

    for i in range(0, len(expo_kuyruk), 100):
        parca = expo_kuyruk[i:i + 100]
        for (a, _), s in zip(parca, expo_gonder([m for _, m in parca])):
            sonuc(a, s)

    if not kuru:
        E.yaz("sistem/push_durum", {"son": simdi_iso, "kazi": sorted(gonderilen_kazi | {k["_id"] for k in yeni_kazi})[-300:],
                                    "sd_gun": bugun, "sd_sayi": sd_sayi, "takip_gun": bugun if takip_zamani else durum.get("takip_gun", "")})
    print(f"Bitti: {sayac}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
