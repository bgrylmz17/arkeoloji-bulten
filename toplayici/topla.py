"""Harrix Arkeoloji Bülteni — bulut toplayıcı.

GitHub Actions bunu günde birkaç kez çalıştırır. Masaüstü uygulamanın toplama kodunu
(harrix_bulten paketi) kullanır, sonuçları telefon uygulamasının okuyacağı JSON dosyalarına yazar:

  docs/veri/bulten.json  kayıtlar (son 'saklama_gun' gün, en çok 'en_fazla' kayıt)
  docs/veri/durum.json   son çalışma, her kaynağın kaç kayıt verdiği / hatası
  docs/veri/sozler.json  motivasyon sözleri

Elle çalıştırmak için:  python toplayici/topla.py
"""
from __future__ import annotations

import datetime as dt
import html
import json
import os
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

KOK = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KOK))

from harrix_bulten import ceviri, harrix_hesap, kaynakca, kaynaklar, sozler, tarayici, terimler  # noqa: E402
from harrix_bulten.veritabani import Depo  # noqa: E402

VERI = KOK / "docs" / "veri"
AYAR_DOSYASI = KOK / "toplayici" / "ayar.json"


def oku(yol: Path, varsayilan):
    try:
        return json.loads(yol.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return varsayilan


def yaz(yol: Path, veri):
    yol.parent.mkdir(parents=True, exist_ok=True)
    gecici = yol.with_suffix(".tmp")
    gecici.write_text(json.dumps(veri, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(gecici, yol)


def simdi() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def apa_html(satir: dict) -> str:
    """APA 7 künyesi; italik kısımlar <i> ile."""
    try:
        k = kaynakca.kayittan_kunye(satir)
        return "".join(f"<i>{html.escape(t)}</i>" if it else html.escape(t) for t, it in kaynakca.apa7(k))
    except Exception:
        return ""


def kunye_kisa(satir: dict) -> dict:
    """Telefonda RIS/BibTeX üretmek için gereken künye alanları."""
    try:
        k = kaynakca.kayittan_kunye(satir)
    except Exception:
        return {}
    return {
        "tur": k.get("tur", "web"),
        "yazarlar": [[a.get("soyad", ""), a.get("ad", "")] for a in k.get("yazarlar", [])],
        "yil": k.get("yil", ""), "yayin": k.get("yayin", ""), "universite": k.get("universite", ""),
        "cilt": k.get("cilt", ""), "sayi": k.get("sayi", ""), "sayfa": k.get("sayfa", ""),
        "tez_turu": k.get("tez_turu", ""),
    }


def ayarlari_hazirla(kullanici: dict, durum: dict) -> dict:
    ayar = json.loads(json.dumps(tarayici.VARSAYILAN_AYARLAR))
    ayar["gun"] = int(kullanici.get("gun", 30))
    ayar["eposta"] = kullanici.get("eposta", "")
    ayar["dergipark_son"] = durum.get("dergipark_son", "")
    if kullanici.get("terimler"):
        ayar["secili_terimler"] = kullanici["terimler"]
    ek = [k for k in kullanici.get("ek_kelimeler", []) if k.strip()]
    ayar["anahtarlar"] = list(dict.fromkeys(list(ayar.get("anahtarlar", [])) + ek))
    ayar["akislar"] = list(ayar.get("akislar", [])) + list(kullanici.get("ek_akislar", []))
    kazi = kullanici.get("kazi") or None
    if kazi and kazi.get("kaziAdi"):
        ayar["harrix_kazi"] = {"kaziAdi": kazi["kaziAdi"], "kaziTuru": kazi.get("kaziTuru", ""),
                               "yer": kazi.get("yer", []), "sezon": kazi.get("sezon", "")}
    return ayar


def topla(depo: Depo, ayar: dict, paralel: int = 6) -> list[dict]:
    """Bütün görevleri çalıştırır; her görevin sonucunu kaynak sağlığı olarak döndürür."""
    tarayici._DEPO = depo                       # DergiPark son zamanı buraya yazılır
    gorevler = tarayici.gorevleri_olustur(ayar)
    izinli = set(ayar.get("diller") or ["tr", "en", "de", "fr", "diger"])
    saglik = []

    def calistir(is_):
        time.sleep(0.3)
        bas = time.time()
        return is_(), time.time() - bas

    with ThreadPoolExecutor(max_workers=paralel) as havuz:
        gelecek = {havuz.submit(calistir, is_): ad for ad, is_ in gorevler}
        for g in as_completed(gelecek):
            ad = gelecek[g]
            try:
                kayitlar, sure = g.result()
                kayitlar = [k for k in kayitlar if tarayici.dil_izinli(k.get("dil", ""), izinli)]
                depo.kaydet(kayitlar)
                saglik.append({"ad": ad, "adet": len(kayitlar), "sure": round(sure, 1)})
            except Exception as e:
                saglik.append({"ad": ad, "adet": 0, "hata": f"{type(e).__name__}: {str(e)[:160]}"})
            print(f"  {ad}: {saglik[-1].get('adet')} {saglik[-1].get('hata', '')}", flush=True)
    return sorted(saglik, key=lambda s: s["ad"])


def satira_cevir(r) -> dict:
    return {k: r[k] for k in r.keys()}


def main() -> int:
    kullanici = oku(AYAR_DOSYASI, {})
    durum = oku(VERI / "durum.json", {})
    eski = oku(VERI / "bulten.json", {})
    eski_kayitlar = {k["i"]: k for k in eski.get("kayitlar", [])}
    ayar = ayarlari_hazirla(kullanici, durum)
    calisma = simdi()
    print(f"Toplama başlıyor ({calisma}); eldeki kayıt: {len(eski_kayitlar)}", flush=True)

    with tempfile.TemporaryDirectory() as gecici:
        depo = Depo(os.path.join(gecici, "veri.db"))
        saglik = topla(depo, ayar)
        satirlar = [satira_cevir(r) for r in depo.listele(limit=100000)]
        dergipark_son = ayar.get("dergipark_son", "")

    # --- yeni kayıtlar
    yeni = [s for s in satirlar if s["id"] not in eski_kayitlar]
    print(f"Yeni kayıt: {len(yeni)}", flush=True)

    # Google Haberler bağlantılarını gerçek adrese çevir (telefonda hızlı açılsın)
    google = [s for s in yeni if s["kaynak"] == "Google Haberler"][: int(kullanici.get("google_cozme_siniri", 120))]

    def coz(s):
        try:
            u = kaynaklar.google_haber_coz(s["url"])
            if u and u != s["url"]:
                s["gercek_url"] = u
        except Exception:
            pass
    with ThreadPoolExecutor(max_workers=4) as h:
        list(h.map(coz, google))

    # Türkçe olmayanların başlık ve özetini çevir (sınırlı sayıda; kalanı sonraki çalışmada)
    ceviri_siniri = int(kullanici.get("ceviri_siniri", 60))
    cevrilecek = [s for s in yeni if s.get("dil") and s["dil"] != "tr"][:ceviri_siniri]

    def cevirt(s):
        try:
            b, o, _servis = ceviri.kayit_cevir(s["baslik"], (s.get("ozet") or "")[:900], s["dil"], {})
            s["baslik_tr"], s["ozet_tr"] = b, o
        except Exception:
            pass
    with ThreadPoolExecutor(max_workers=3) as h:
        list(h.map(cevirt, cevrilecek))

    # eski kayıtlardan çevirisi eksik olanlara da sıra gelsin
    kalan_hak = ceviri_siniri - len(cevrilecek)
    for k in list(eski_kayitlar.values()):
        if kalan_hak <= 0:
            break
        if k.get("l") and k["l"] != "tr" and not k.get("bt"):
            try:
                b, o, _ = ceviri.kayit_cevir(k["b"], (k.get("o") or "")[:900], k["l"], {})
                k["bt"], k["ot"] = b, o
            except Exception:
                pass
            kalan_hak -= 1

    for s in yeni:
        eski_kayitlar[s["id"]] = {
            "i": s["id"], "k": s["kategori"], "s": s["kaynak"], "b": s["baslik"],
            "y": s.get("yazarlar") or "", "w": s.get("yayin_yeri") or "", "t": s.get("tarih") or "",
            "u": s.get("gercek_url") or s.get("url") or "", "d": s.get("doi") or "",
            "o": (s.get("ozet") or "")[:900], "e": [e for e in (s.get("etiketler") or "").split(",") if e],
            "p": s.get("pdf_url") or "", "l": s.get("dil") or "", "g": calisma,
            "bt": s.get("baslik_tr", ""), "ot": s.get("ozet_tr", ""),
            "a": apa_html(s),
            "ku": kunye_kisa(s),
        }
        if s.get("eslesen"):
            eski_kayitlar[s["id"]]["m"] = s["eslesen"]

    # --- sakla: son N gün, en çok M kayıt (yeniler önde)
    sinir = (dt.date.today() - dt.timedelta(days=int(kullanici.get("saklama_gun", 180)))).isoformat()
    tum = [k for k in eski_kayitlar.values() if (k.get("t") or k.get("g", "")[:10]) >= sinir
           or k.get("g", "")[:10] >= sinir]
    tum.sort(key=lambda k: (k.get("g", ""), k.get("t", "")), reverse=True)
    tum = tum[: int(kullanici.get("en_fazla", 2500))]

    kavramlar = [{"id": k.kimlik, "ad": k.kisa, "en": k.en[0], "grup": k.grup} for k in terimler.TERIMLER]
    kazi = ayar.get("harrix_kazi")
    if kazi:
        kavramlar.append({"id": "kazim", "ad": kazi["kaziAdi"], "en": kazi["kaziAdi"], "grup": "Kazım"})

    yaz(VERI / "bulten.json", {
        "surum": 1, "guncelleme": calisma, "yeni_sayisi": len(yeni),
        "kazi": harrix_hesap.ozet_metni(kazi) if kazi else "",
        "kavramlar": kavramlar, "kayitlar": tum,
    })
    yaz(VERI / "sozler.json", sozler.SOZLER)
    hatali = [s for s in saglik if s.get("hata")]
    yaz(VERI / "durum.json", {
        "guncelleme": calisma, "dergipark_son": dergipark_son, "yeni": len(yeni), "toplam": len(tum),
        "kaynak_sayisi": len(saglik), "hatali_kaynak": len(hatali), "kaynaklar": saglik,
    })
    print(f"Bitti: {len(tum)} kayıt yazıldı, {len(yeni)} yeni, {len(hatali)}/{len(saglik)} kaynak hatalı.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
