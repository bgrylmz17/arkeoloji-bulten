"""Harrix Arkeoloji Bülteni — bulut toplayıcı.

GitHub Actions bunu günde birkaç kez çalıştırır. Masaüstü uygulamanın toplama kodunu
(harrix_bulten paketi) kullanır, sonuçları telefon uygulamasının okuyacağı JSON dosyalarına yazar:

  docs/veri/bulten.json  kayıtlar (son 'saklama_gun' gün, en çok 'en_fazla' kayıt)
  docs/veri/durum.json   son çalışma, her kaynağın kaç kayıt verdiği / hatası
  docs/veri/sozler.json  motivasyon sözleri
  docs/veri/ozet.mp3     "Dünün özeti"nin doğal (nöral) sesle okunmuş hâli — yalnız metin değişince yeniden üretilir

Elle çalıştırmak için:  python toplayici/topla.py
"""
from __future__ import annotations

import asyncio
import datetime as dt
import hashlib
import html
import re
import json
import os
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

KOK = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KOK))

from harrix_bulten import ceviri, haber_kaynaklari, harrix_hesap, kaynakca, kaynaklar, sozler, tarayici, terimler  # noqa: E402
from harrix_bulten.metin import TekrarDenetci, arkeoloji_kesin  # noqa: E402
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

    def calistir(ad, is_):
        time.sleep(0.3)
        bas = time.time()
        return tarayici.dayanikli_calistir(ad, is_), time.time() - bas

    with ThreadPoolExecutor(max_workers=paralel) as havuz:
        gelecek = {havuz.submit(calistir, ad, is_): ad for ad, is_ in gorevler}
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


def tekrarlari_ayikla(eski_kayitlar: dict, yeni: list[dict]) -> tuple[list[dict], int, dict]:
    """Aynı haberin başka kaynaktan gelen kopyalarını atar: önce gelen kalır.
    Eski kayıtlardaki kopyalar (önceki sürümlerden kalma) eski_kayitlar'dan silinir; yeni listesi süzülüp döner.
    Üçüncü değer: {kalan kaydın kimliği: bu çalışmada bulunan kopya sayısı} (flash için)."""
    d, atilan, kopya = TekrarDenetci(), 0, {}
    for k in sorted(eski_kayitlar.values(), key=lambda k: (k.get("g", ""), k["i"])):
        tarih = k.get("t") or k.get("g", "")[:10]
        asil = d.tekrar_mi(k.get("k", ""), k.get("b", ""), tarih)
        if asil:
            del eski_kayitlar[k["i"]]
            kopya[asil] = kopya.get(asil, 0) + 1
            atilan += 1
        else:
            d.ekle(k["i"], k.get("k", ""), k.get("b", ""), tarih)
    kalan = []
    for s in yeni:
        tarih = s.get("tarih") or simdi()[:10]
        asil = d.tekrar_mi(s["kategori"], s["baslik"], tarih)
        if asil:
            kopya[asil] = kopya.get(asil, 0) + 1
            atilan += 1
            continue
        d.ekle(s["id"], s["kategori"], s["baslik"], tarih)
        kalan.append(s)
    return kalan, atilan, kopya


FLASH_KAYNAK = 3      # aynı haber en az bu kadar sitede çıktıysa "son dakika"
FLASH_SAAT = 48       # yalnız bu kadar saat içinde toplanan haberler


def flash_isaretle(tum: list[dict], simdiki: str) -> int:
    """Çok sitenin verdiği yeni haberleri 'flash' (son dakika) işaretler. Dönüş: işaretlenen sayısı."""
    sinir = (dt.datetime.fromisoformat(simdiki) - dt.timedelta(hours=FLASH_SAAT)).isoformat()
    n = 0
    for k in tum:
        f = k.get("k") in ("Haber", "Rapor") and k.get("ks", 1) >= FLASH_KAYNAK and k.get("g", "") >= sinir
        if f:
            k["flash"] = True
            n += 1
        else:
            k.pop("flash", None)
    return n


def duyurular_ve_banner(kullanici: dict, simdiki: str) -> dict:
    """ayar.json'daki elle yazılan duyurular (süresi geçmemiş olanlar) ve en üstteki Harrix banner'ı."""
    bugun = simdiki[:10]
    duyurular = []
    for i, d in enumerate(kullanici.get("duyurular") or []):
        if not isinstance(d, dict) or not d.get("baslik") or (d.get("bitis") and d["bitis"] < bugun):
            continue
        duyurular.append({"id": d.get("id") or f"duyuru-{i}", "baslik": d["baslik"], "ozet": d.get("ozet", ""),
                          "url": d.get("url", ""), "tarih": d.get("tarih", bugun), "onemli": bool(d.get("onemli", True))})
    banner = kullanici.get("banner")
    sonuc = {}
    if duyurular:
        sonuc["duyurular"] = duyurular
    if isinstance(banner, dict) and banner.get("aktif") and banner.get("baslik"):
        sonuc["banner"] = {k: banner[k] for k in ("aktif", "etiket", "baslik", "altBaslik", "url") if k in banner}
        sonuc["banner"].setdefault("etiket", "HARRIX")
    return sonuc


# ---------------------------------------------------------------- dünün özeti, doğal sesle
OZET_SESI = "tr-TR-EmelNeural"


def _okunur(metin: str) -> str:
    """Kısaltmaları sesin doğru okuyacağı biçime çevirir (uygulama.js sesIcinTemizle ile aynı kurallar)."""
    m = re.sub(r"https?://\S+", "", metin or "")
    for a, b in ((r"(^|\s)M\.?Ö\.?(?=[\s.,;0-9]|$)", r"\1milattan önce"), (r"(^|\s)M\.?S\.?(?=[\s.,;0-9]|$)", r"\1milattan sonra"),
                 (r"Prof\.\s*Dr\.", "Profesör Doktor"), (r"Doç\.\s*Dr\.", "Doçent Doktor"), (r"Dr\.(?=\s)", "Doktor"),
                 (r"(\d+)\.?\s*yy\.", r"\1. yüzyıl"), (r"\bvb\.", "ve benzeri"), (r"\bvd\.", "ve diğerleri"),
                 (r"(\d+)\s*m²", r"\1 metrekare"), (r"(\d+)\s*km\b", r"\1 kilometre"), (r"(\d+)\s*cm\b", r"\1 santimetre")):
        m = re.sub(a, b, m)
    return re.sub(r"\s+", " ", m).strip()


def ozet_metni(tum: list[dict], dun: str) -> str:
    """Uygulamadaki "Dünün özeti" kartının (sabahOzeti) okunacak metni. Dün kayıt yoksa boş."""
    havuz = [k for k in tum if (k.get("g") or k.get("t") or "")[:10] == dun]
    if not havuz:
        return ""
    say = lambda t: sum(1 for k in havuz if k.get("k") == t)  # noqa: E731
    parca = [f"{n} {ad}" for n, ad in ((say("Haber"), "haber"), (say("Makale"), "yeni makale"), (say("Tez"), "tez"),
                                        (say("Rapor"), "rapor")) if n]
    liste = parca[0] if len(parca) == 1 else ", ".join(parca[:-1]) + " ve " + parca[-1]
    turkce = lambda k: not k.get("l") or k["l"] == "tr" or k.get("bt")  # noqa: E731
    baslik = lambda k: (k.get("bt") if k.get("l") and k["l"] != "tr" and k.get("bt") else k.get("b", "")).rstrip(".")  # noqa: E731
    one = ([k for k in havuz if k.get("k") == "Haber" and turkce(k)][:3] + [k for k in havuz if k.get("k") == "Makale"][:2]
           + [k for k in havuz if k.get("k") == "Tez"][:1])[:5]
    gun = dt.date.fromisoformat(dun)
    aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    satirlar = [f"Harrix Arkeoloji Bülteni. {gun.day} {aylar[gun.month - 1]}, dünün özeti.",
                f"Dün arkeoloji gündeminde {liste} öne çıktı."]
    if one:
        satirlar.append("Öne çıkanlar.")
        satirlar += [f"{i}. {k.get('k')}: {baslik(k)}." for i, k in enumerate(one, 1)]
    return _okunur(" ".join(satirlar))


def sesli_ozet(tum: list[dict], eski: dict | None) -> dict | None:
    """Dünün özetini MP3'e çevirir (docs/veri/ozet.mp3). Metin değişmediyse eskisini kullanır.
    edge-tts yoksa ya da servise ulaşılamazsa None (uygulama telefonun kendi sesiyle okur)."""
    dun = (dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1)).isoformat()   # uygulama da UTC günü kullanır
    metin = ozet_metni(tum, dun)
    if not metin:
        return None
    imza = hashlib.sha1((OZET_SESI + metin).encode("utf-8")).hexdigest()[:12]
    if eski and eski.get("imza") == imza and eski.get("gun") == dun and (VERI / "ozet.mp3").exists():
        return eski
    try:
        import edge_tts
    except ImportError:
        print("edge-tts kurulu değil; sesli özet üretilmedi.", flush=True)
        return None

    async def al():
        veri = bytearray()
        async for p in edge_tts.Communicate(metin, OZET_SESI).stream():
            if p["type"] == "audio":
                veri += p["data"]
        return bytes(veri)
    try:
        veri = asyncio.run(asyncio.wait_for(al(), 120))
        if len(veri) < 1000:
            raise RuntimeError("boş ses")
    except Exception as e:
        print(f"Sesli özet üretilemedi: {type(e).__name__}: {e}", flush=True)
        return None
    gecici = VERI / "ozet.mp3.tmp"
    gecici.write_bytes(veri)
    os.replace(gecici, VERI / "ozet.mp3")
    print(f"Sesli özet üretildi ({len(veri) // 1024} KB).", flush=True)
    return {"gun": dun, "dosya": "veri/ozet.mp3", "imza": imza, "ses": OZET_SESI, "metin": metin}


def satira_cevir(r) -> dict:
    return {k: r[k] for k in r.keys()}


def main() -> int:
    kullanici = oku(AYAR_DOSYASI, {})
    durum = oku(VERI / "durum.json", {})
    eski = oku(VERI / "bulten.json", {})
    eski_kayitlar = {k["i"]: k for k in eski.get("kayitlar", [])}
    # süzgeç sıkılaştıysa eski kayıtlara da uygula (ör. Phys.org'un arkeoloji dışı yazıları)
    mod = {ad: m for ad, _u, m, _d in haber_kaynaklari.AKISLAR}

    def gecerli(k):
        m = mod.get(k.get("s"))
        return m not in ("genel", "bilim") or arkeoloji_kesin(k.get("b", ""), k.get("o", ""), bilim=m == "bilim")
    eski_kayitlar = {i: k for i, k in eski_kayitlar.items() if gecerli(k)}
    ayar = ayarlari_hazirla(kullanici, durum)
    calisma = simdi()
    print(f"Toplama başlıyor ({calisma}); eldeki kayıt: {len(eski_kayitlar)}", flush=True)

    with tempfile.TemporaryDirectory() as gecici:
        depo = Depo(os.path.join(gecici, "veri.db"))
        saglik = topla(depo, ayar)
        satirlar = [satira_cevir(r) for r in depo.listele(limit=100000)]
        dergipark_son = ayar.get("dergipark_son", "")

    # --- yeni kayıtlar (aynı haberin başka kaynaktan gelen kopyaları atılır)
    yeni = [s for s in satirlar if s["id"] not in eski_kayitlar]
    yeni, atilan, kopya_sayisi = tekrarlari_ayikla(eski_kayitlar, yeni)
    print(f"Yeni kayıt: {len(yeni)} (kopya olduğu için atılan: {atilan})", flush=True)

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

    # kaç sitede çıktı (ks): kopyaları atılan kayıtların sayacı birikir
    for kid, n in kopya_sayisi.items():
        if kid in eski_kayitlar:
            eski_kayitlar[kid]["ks"] = eski_kayitlar[kid].get("ks", 1) + n

    # --- sakla: son N gün, en çok M kayıt (yeniler önde)
    sinir = (dt.date.today() - dt.timedelta(days=int(kullanici.get("saklama_gun", 180)))).isoformat()
    tum = [k for k in eski_kayitlar.values() if (k.get("t") or k.get("g", "")[:10]) >= sinir
           or k.get("g", "")[:10] >= sinir]
    tum.sort(key=lambda k: (k.get("g", ""), k.get("t", "")), reverse=True)
    tum = tum[: int(kullanici.get("en_fazla", 2500))]

    kavramlar = [{"id": k.kimlik, "ad": k.kisa, "en": k.en[0], "grup": k.grup,
                  "q": terimler.openalex_sorgusu(k)} for k in terimler.TERIMLER]
    kazi = ayar.get("harrix_kazi")
    if kazi:
        kavramlar.append({"id": "kazim", "ad": kazi["kaziAdi"], "en": kazi["kaziAdi"], "grup": "Kazım"})

    flash_sayisi = flash_isaretle(tum, calisma)
    print(f"Son dakika (en az {FLASH_KAYNAK} sitede çıkan haber): {flash_sayisi}", flush=True)
    ozet_ses = sesli_ozet(tum, eski.get("sesli_ozet"))
    yaz(VERI / "bulten.json", {
        "surum": 1, "guncelleme": calisma, "yeni_sayisi": len(yeni),
        "kazi": harrix_hesap.ozet_metni(kazi) if kazi else "",
        "kavramlar": kavramlar, "kayitlar": tum,
        **({"sesli_ozet": ozet_ses} if ozet_ses else {}),
        **duyurular_ve_banner(kullanici, calisma),
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
