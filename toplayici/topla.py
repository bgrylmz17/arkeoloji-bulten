"""Arkix — bulut toplayıcı.

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
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

KOK = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KOK))

from harrix_bulten import ceviri, haber_kaynaklari, harrix_hesap, kaynakca, kaynaklar, sozler, tarayici, terimler  # noqa: E402
from harrix_bulten.metin import TekrarDenetci, _ascii, arkeoloji_kesin, donem_etiketleri  # noqa: E402
from harrix_bulten.veritabani import Depo  # noqa: E402

VERI = KOK / "docs" / "veri"
AYAR_DOSYASI = KOK / "toplayici" / "ayar.json"
OZEL = KOK / "docs" / "ozel"   # Arkix Özel yazıları (*.md) ve fotoğrafları; yazım kılavuzu: docs/ozel/_ornek.md


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


def guvenli_url(u) -> str:
    """Yalnız http(s) bağlantısı geçer; javascript:, data: vb. düşer (kaynaktan zararlı bağlantı gelmesin)."""
    u = str(u or "").strip()
    return u if re.match(r"(?i)^https?://", u) else ""


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
                          "url": d.get("url", ""), "tarih": d.get("tarih", bugun), "onemli": bool(d.get("onemli", True)),
                          # yalnizEskiAdres: yalnız eski github.io kopyasında görünür (yeni kod gizler)
                          **({"yalnizEskiAdres": True} if d.get("yalnizEskiAdres") else {})})
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
    satirlar = [f"Arkix. {gun.day} {aylar[gun.month - 1]}, dünün özeti.",
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


# ---------------------------------------------------------------- telif: lisansa göre özet
# Serbest lisanslı (CC BY, CC BY-SA, CC0, kamu malı) yayınların özeti tam gösterilir. Ötekilerin (lisansı
# bilinmeyen, CC BY-NC/ND, yayıncıya ait) özeti birkaç cümleye kısaltılır; tamamı yayıncının sayfasındadır.
SERBEST_LISANS = {"cc-by", "cc-by-sa", "cc0", "public-domain"}
KISA_OZET = 240
HABER_OZET = 300


def lisanslari_bul(kayitlar: list[dict], eposta: str = "") -> int:
    """DOI'si olup henüz sorulmamış kayıtlara OpenAlex'ten lisans ('lz'; bulunamazsa "") ve ilk üç konunun
    alt alan kimliklerini ('kz', ör. [1204, 3314]) yazar. Sorgu başarısız olursa ikisi de yazılmaz,
    sonraki çalışmada yeniden denenir."""
    def temiz(doi: str) -> str:
        doi = (doi or "").strip().lower()
        for on in ("https://doi.org/", "http://doi.org/", "doi:"):
            doi = doi.removeprefix(on)
        return doi
    sor = [k for k in kayitlar if ("lz" not in k or "kz" not in k) and temiz(k.get("d")) and not set(",|") & set(k["d"])]
    bulunan = 0
    for i in range(0, len(sor), 50):
        parca = {temiz(k["d"]): k for k in sor[i:i + 50]}
        params = kaynaklar._openalex_parametre({
            "filter": "doi:" + "|".join(parca), "select": "doi,best_oa_location,primary_location,topics", "per-page": "50",
        }, eposta)
        try:
            veri = json.loads(kaynaklar._indir("https://api.openalex.org/works?" + urllib.parse.urlencode(params)))
        except Exception as hata:  # noqa: BLE001
            print(f"Lisans sorgusu başarısız ({hata}); sonraki çalışmada denenecek.", flush=True)
            continue
        for k in parca.values():
            k["lz"], k["kz"] = "", []
        for w in veri.get("results", []):
            k = parca.get(temiz(w.get("doi")))
            if k:
                k["lz"] = ((w.get("best_oa_location") or {}).get("license")
                           or (w.get("primary_location") or {}).get("license") or "").lower()
                bulunan += bool(k["lz"])
                k["kz"] = [int(t["subfield"]["id"].rsplit("/", 1)[-1]) for t in (w.get("topics") or [])[:3]
                           if (t.get("subfield") or {}).get("id")]
    return bulunan


def ozet_kisalt(metin: str, sinir: int = KISA_OZET) -> str:
    """Özeti tam cümlelerle 'sinir' karakterin altına indirir."""
    metin = (metin or "").strip()
    if len(metin) <= sinir:
        return metin
    sonuc = ""
    for cumle in re.split(r"(?<=[.!?])\s+", metin):
        if len(sonuc) + len(cumle) + 1 > sinir:
            break
        sonuc = f"{sonuc} {cumle}".strip()
    if not sonuc:
        sonuc = metin[:sinir].rsplit(" ", 1)[0]
    return sonuc + " …"


def telif_uygula(k: dict) -> None:
    """Kayıt yayımlanmadan önce: haber özetleri en çok HABER_OZET, serbest lisanslı olmayan yayınların
    özetleri (ve çevirileri) en çok KISA_OZET karakter. Görsel adresi yayın yeri alanına sızmışsa silinir."""
    if (k.get("w") or "").startswith("http"):
        k["w"] = ""
    if k.get("k") == "Haber":
        for alan in ("o", "ot", "oe"):
            if len(k.get(alan) or "") > HABER_OZET:
                k[alan] = ozet_kisalt(k[alan], HABER_OZET)
        return
    if k.get("lz") in SERBEST_LISANS:
        return
    for alan in ("o", "ot", "oe"):
        if len(k.get(alan) or "") > KISA_OZET + 2:
            k[alan] = ozet_kisalt(k[alan])
            k["kisa"] = 1


# ---------------------------------------------------------------- konu süzgeci (OpenAlex / Crossref)
# Akademik aramalar kelime eşleşmesiyle arkeoloji dışı yayınlar da getirir (tıp, jeoloji, ekonomi...).
# Yayın, OpenAlex'in ilk üç konusundan biri arkeolojiyle ilgili bir alt alandaysa ya da başlık/özette
# kesin arkeoloji sözcükleri geçiyorsa kalır. Konu bilgisi yoksa (DOI yok) yalnız sözcük süzgeci.
ARKEO_ALT_ALAN = {1204, 3302, 3314, 1205, 1206, 1209}   # Archeology (x2), Anthropology, Classics, Conservation, Museology
TARIH_ALT_ALAN = {1202, 1911}                             # History, Paleontology: yalnız eski dönem sözcüğüyle
ESKI_DONEM = re.compile(r"\b(ancient|antik|antique|maya|aztec|inca|roman|byzant\w*|bizans|hellenist\w*|helenist\w*|"
                        r"medieval|ortaça\w*|bronze age|iron age|tunç ça\w*|demir ça\w*|neolit\w*|paleolit\w*|"
                        r"mesolit\w*|chalcolith\w*|kalkolit\w*|prehistor\w*|tarih öncesi|hominin\w*|neanderthal\w*|"
                        r"pleistocene|holocene|fossil\w*|fosil\w*)\b", re.I)
AKADEMIK_KAYNAK = {"OpenAlex", "Crossref"}
# Dışlanan bir alandaki yayın, başlığında bunlardan biri geçerse yine kalır (arkeojeofizik, eski DNA, dijital arkeoloji...)
BASLIK_ARKEO = re.compile(r"(archa?eolog|arkeolo|archéolog|archäolog|neolit|neolith|paleolit|palaeolith|paleolith|mesolit|mesolith|"
                          r"excavat|kazı|prehistor|tarih öncesi|hominin|neanderthal|ancient|antik|bronze age|iron age|tunç ça|demir ça|"
                          r"roman |byzant|bizans|tumul|höyük|tell |megalith)", re.I)


# Arkeometri, jeoarkeoloji, eski DNA, paleoiklim gibi doğa bilimi alanları: yalnız kesin arkeoloji sözcüğüyle birlikte
BILIM_ALT_ALAN = {1311, 1312, 2303, 1105, 1103, 1110, 1111, 1902, 2306, 2309,
                  3316, 1213, 1212, 1203, 1208, 3305, 3322}
# Arkeoloji konusu yoksa doğrudan atılan alanlar (felsefe, astronomi, ekonomi, yer bilimi, mühendislik...)
DISLANAN_ALT_ALAN = {1211, 3103, 2002, 2003, 1400, 1401, 1402, 1403, 1404, 1406, 1407, 1408, 1409,
                     1906, 1907, 1908, 1910, 2105, 2205, 2211, 2210, 2208, 2505, 1700, 1702, 1703, 1705, 1706, 1707, 1710, 1712}


def konu_uygun(k: dict) -> bool:
    """Akademik kayıt: OpenAlex konusu arkeolojiyse kalır; tarih/paleontolojiyse eski dönem sözcüğü, doğa bilimi ya da
    kültür alanıysa kesin arkeoloji sözcüğü gerekir. Ekonomi, tıp, felsefe gibi konulardaki kayıt sözcük geçse de atılır.
    Konu bilgisi yoksa (DOI yok) yalnız sözcük süzgeci."""
    if k.get("s") not in AKADEMIK_KAYNAK:
        return True
    kz = set(k.get("kz") or [])
    if kz & ARKEO_ALT_ALAN:
        return True
    metin = f'{k.get("b", "")} {k.get("o", "")}'
    if kz & TARIH_ALT_ALAN and ESKI_DONEM.search(metin):
        return True
    kesin = arkeoloji_kesin(k.get("b", ""), k.get("o", ""))
    if not kz:
        return kesin
    baslik_arkeo = bool(BASLIK_ARKEO.search(f'{k.get("b", "")} {k.get("bt", "")}'))
    if kz & DISLANAN_ALT_ALAN:
        return baslik_arkeo
    return baslik_arkeo or (kesin and bool(kz & (BILIM_ALT_ALAN | TARIH_ALT_ALAN)))


def engelli_mi(k: dict, engel: list[str]) -> bool:
    """ayar.json 'engelli_kaynaklar': kaynak adı ya da alan adı (alt alan adları dahil) eşleşen kayıt yayımlanmaz."""
    if not engel:
        return False
    ad = (k.get("s") or "").strip().lower()
    alan = (urllib.parse.urlparse(k.get("u") or "").hostname or "").lower()
    return any(e == ad or (alan and (alan == e or alan.endswith("." + e))) for e in engel)


# ---------------------------------------------------------------- Arkix Özel (kendi haberlerimiz)
# docs/ozel/AAAA-AA-GG-kisa-ad.md dosyaları her çalışmada yeniden okunur; dosya silinirse yazı da kalkar.
# Biçim ve kurallar docs/ozel/_ornek.md içinde. Alt çizgiyle başlayan dosyalar yayımlanmaz.
GORSEL_UZANTI = (".jpg", ".jpeg", ".png", ".webp")
_SATIR_ICI = [
    (re.compile(r"\*\*(.+?)\*\*"), r"<b>\1</b>"),
    (re.compile(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])"), r"<i>\1</i>"),
]
_BAG = re.compile(r"\[([^\]]+)\]\((https?://[^\s)]+)\)")
_RESIM = re.compile(r"^!\[([^\]]*)\]\(([^\s)]+)\)$")


def _satir_ici(metin: str) -> str:
    """Kaçışlanmış metinde **kalın**, *eğik* ve [bağlantı](https://…)."""
    for desen, yerine in _SATIR_ICI:
        metin = desen.sub(yerine, metin)
    return _BAG.sub(lambda m: f'<a href="{m.group(2)}" target="_blank" rel="noopener">{m.group(1)}</a>', metin)


def md_html(govde: str, uyari: list[str]) -> str:
    """Yazı gövdesinin güvenli HTML'i. Desteklenen: paragraf, ## ara başlık, > alıntı, - madde,
    ![açıklama](dosya.jpg) (yalnız docs/ozel içindeki kendi fotoğraflarımız), **kalın**, *eğik*, [bağlantı](https://…)."""
    parcalar = []
    for blok in re.split(r"\n\s*\n", govde.strip()):
        blok = blok.strip()
        if not blok:
            continue
        resim = _RESIM.match(blok)
        if resim:
            aciklama, dosya = resim.groups()
            if "/" in dosya or not (OZEL / dosya).is_file():
                uyari.append(f"fotoğraf bulunamadı ya da docs/ozel dışında: {dosya}")
                continue
            parcalar.append(f'<figure><img src="ozel/{html.escape(dosya)}" alt="{html.escape(aciklama)}" loading="lazy">'
                            f'{f"<figcaption>{html.escape(aciklama)}</figcaption>" if aciklama else ""}</figure>')
            continue
        guvenli = html.escape(blok, quote=False)
        if blok.startswith("## "):
            parcalar.append(f"<h3>{_satir_ici(guvenli[3:].strip())}</h3>")
        elif all(sat.startswith("> ") or sat == ">" for sat in blok.splitlines()):
            ic = html.escape(" ".join(sat[1:].strip() for sat in blok.splitlines()), quote=False)
            parcalar.append(f"<blockquote>{_satir_ici(ic)}</blockquote>")
        elif all(sat.startswith("- ") for sat in blok.splitlines()):
            parcalar.append("<ul>" + "".join(f"<li>{_satir_ici(sat[2:].strip())}</li>" for sat in guvenli.splitlines()) + "</ul>")
        else:
            parcalar.append("<p>" + "<br>".join(_satir_ici(sat.strip()) for sat in guvenli.splitlines()) + "</p>")
    return "\n".join(parcalar)


def _on_bilgi(metin: str) -> tuple[dict, str]:
    """'---' satırları arasındaki 'anahtar: değer' satırları ve kalan gövde."""
    if not metin.startswith("---"):
        return {}, metin
    _, ust, govde = (metin.split("---", 2) + ["", ""])[:3]
    bilgi = {}
    for satir in ust.splitlines():
        if ":" in satir:
            a, v = satir.split(":", 1)
            bilgi[a.strip().lower()] = v.strip()
    return bilgi, govde


def ozel_yazilar(eski_kayitlar: dict, calisma: str) -> list[dict]:
    yazilar = []
    for dosya in sorted(OZEL.glob("*.md")) if OZEL.is_dir() else []:
        if dosya.name.startswith("_"):
            continue
        uyari: list[str] = []
        bilgi, govde = _on_bilgi(dosya.read_text(encoding="utf-8"))
        tarih = bilgi.get("tarih") or dosya.stem[:10]
        if not bilgi.get("baslik") or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", tarih) or not govde.strip():
            print(f"  Arkix Özel atlandı ({dosya.name}): başlık, tarih ya da metin eksik", flush=True)
            continue
        if bilgi.get("yayin", "evet").lower() in ("hayır", "hayir", "taslak", "no"):
            continue
        kimlik = "ozel-" + re.sub(r"[^a-z0-9-]", "", dosya.stem.lower())
        kapak = bilgi.get("kapak") or next((dosya.stem + u for u in GORSEL_UZANTI if (OZEL / (dosya.stem + u)).is_file()), "")
        if kapak and ("/" in kapak or not (OZEL / kapak).is_file()):
            uyari.append(f"kapak bulunamadı: {kapak}")
            kapak = ""
        govde_html = md_html(govde, uyari)
        for gorsel in [kapak] + re.findall(r'src="ozel/([^"]+)"', govde_html):
            if gorsel and (OZEL / gorsel).stat().st_size > 900_000:
                uyari.append(f"fotoğraf büyük ({(OZEL / gorsel).stat().st_size // 1000} KB), 1600 px'e küçültün: {gorsel}")
        ilk_paragraf = re.sub(r"<[^>]*>", "", govde.strip().split("\n\n")[0])
        ilk_paragraf = re.sub(r"\s+", " ", re.sub(r"[*#>\[\]]|\(https?://[^)]*\)", "", ilk_paragraf)).strip()
        ozet = bilgi.get("ozet") or ozet_kisalt(ilk_paragraf, HABER_OZET)
        onceki = eski_kayitlar.get(kimlik, {})
        k = {
            "i": kimlik, "k": "Haber", "s": "Arkix Özel", "oz": 1, "b": bilgi["baslik"], "o": ozet,
            "y": bilgi.get("yazar", ""), "t": tarih, "l": "tr",
            "g": onceki.get("g") or calisma, "u": f"https://arkix.harrixapp.com/#k/{kimlik}",
            "e": [e for e in (x.strip() for x in bilgi.get("kavramlar", "").split(",")) if e],
            "h": govde_html, "d": "", "p": "", "w": "",
        }
        if kapak:
            k["gv"] = f"ozel/{kapak}"
            if bilgi.get("kapak_aciklama"):
                k["ga"] = bilgi["kapak_aciklama"]
        # İngilizce arayüz için başlık ve özet çevirisi; metin değişmedikçe yeniden çevrilmez
        if onceki.get("b") == k["b"] and onceki.get("o") == k["o"] and onceki.get("be"):
            k["be"], k["oe"] = onceki["be"], onceki.get("oe", "")
        else:
            try:
                k["be"], k["oe"], _ = ceviri.kayit_cevir(k["b"], k["o"], "tr", {}, hedef="en")
            except Exception:  # noqa: BLE001
                pass
        for u in uyari:
            print(f"  Arkix Özel uyarı ({dosya.name}): {u}", flush=True)
        yazilar.append(k)
    return yazilar


# ---------------------------------------------------------------- topluluk (Firestore, herkese açık okuma)
# Yorum sayıları ve son yorumlar bültene yazılır: listede sayı, Bugün'de "Tartışılanlar". Yöneticinin bültenden
# kaldırdığı kayıtlar (gizli_kayitlar/{kimlik}) atılır. Kurallar: mobil/firestore.rules.
FIRESTORE = "https://firestore.googleapis.com/v1/projects/harrix-bulten/databases/(default)/documents"


def _fs_deger(v: dict):
    if "stringValue" in v: return v["stringValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "timestampValue" in v: return v["timestampValue"]
    return None


def _fs_sorgu(koleksiyon: str, suzgec: dict | None = None) -> list[dict]:
    govde = {"structuredQuery": {"from": [{"collectionId": koleksiyon}], **({"where": suzgec} if suzgec else {}), "limit": 5000}}
    istek = urllib.request.Request(FIRESTORE + ":runQuery", data=json.dumps(govde).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(istek, timeout=30) as y:
        sonuc = json.load(y)
    belgeler = []
    for s in sonuc:
        b = s.get("document")
        if b:
            belgeler.append({"_id": b["name"].rsplit("/", 1)[-1], **{a: _fs_deger(v) for a, v in b.get("fields", {}).items()}})
    return belgeler


def topluluk_oku() -> tuple[dict, list[dict], set[str]]:
    """(yorum sayıları {kayit: n}, son yorumlar, bültenden kaldırılan kayıt kimlikleri). Hata olursa boş döner."""
    sayilar, son, gizli = {}, [], set()
    try:
        yorumlar = _fs_sorgu("yorumlar", {"fieldFilter": {"field": {"fieldPath": "gizli"}, "op": "EQUAL", "value": {"booleanValue": False}}})
        for y in yorumlar:
            sayilar[y.get("kayit", "")] = sayilar.get(y.get("kayit", ""), 0) + 1
        yorumlar.sort(key=lambda y: y.get("tarih") or "", reverse=True)
        son = [{"k": y.get("kayit", ""), "ad": (y.get("ad") or "")[:40], "av": y.get("avatar") or "", "u": bool(y.get("uzman")),
                "m": re.sub(r"\s+", " ", y.get("metin") or "")[:160], "t": (y.get("tarih") or "")[:19]} for y in yorumlar[:8]]
    except Exception as hata:  # noqa: BLE001
        print(f"Yorumlar okunamadı: {hata}", flush=True)
    try:
        gizli = {b.get("kayit") or urllib.parse.unquote(b["_id"]) for b in _fs_sorgu("gizli_kayitlar")}
    except Exception as hata:  # noqa: BLE001
        print(f"Kaldırılan kayıtlar okunamadı: {hata}", flush=True)
    return sayilar, son, gizli


def satira_cevir(r) -> dict:
    return {k: r[k] for k in r.keys()}


# ---------------------------------------------------------------- Duyurular: etkinlik (sempozyum, kongre, konferans, çalıştay,
# bildiri çağrısı) ve kazı çağrıları (gönüllü, öğrenci, alan okulu). Kaynaklar elle doğrulandı (RSS); "suz": yalnız örüntüye uyanlar.
# Yalnız başlık, 240 karakterlik açıklama ve bağlantı saklanır (telif). bulten.json › "etkinlikler"; web docs/uygulama.js › sayfaOzel.
DUYURU_KAYNAKLARI = [
    {"ad": "Arkeofili", "url": "https://arkeofili.com/category/etkinlik/feed/", "dil": "tr", "tur": "suz"},
    {"ad": "BIAA", "url": "https://biaa.ac.uk/events/feed/", "dil": "en", "tur": "etkinlik"},
    {"ad": "BIAA", "url": "https://biaa.ac.uk/feed/", "dil": "en", "tur": "suz"},
    {"ad": "AIA", "url": "https://www.archaeological.org/events/feed/", "dil": "en", "tur": "etkinlik"},
    {"ad": "AIA Fieldwork", "url": "https://www.archaeological.org/fieldwork/feed/", "dil": "en", "tur": "kazi"},
]
# Google Haberler aramaları (Türkçe): yerli sempozyum, kongre, çalıştay ve kazı çağrıları. Başlıkta etkinlik/kazı çağrısı ve
# arkeolojiyle ilgili bir sözcük olmalı (ARKEO_DESENI); haber sitesinin adı başlığın sonundan alınır.
GOOGLE_DUYURU_SORGULARI = [
    "arkeoloji sempozyumu", "kazı sempozyumu", "arkeoloji kongresi", "arkeoloji çalıştayı", "arkeoloji konferansı", "arkeoloji paneli",
    "mağara sempozyumu", "prehistorya sempozyumu", "arkeometri sempozyumu", "kültürel miras sempozyumu", "müzecilik kongresi",
    "arkeoloji bildiri çağrısı", "kazı gönüllü öğrenci", "kazı sempozyumu düzenlenecek",
]
# Üniversiteler: RSS'i olanlar (20 üniversite denendi, Kasım 2026). Yalnız arkeolojiyle ilgili etkinlikler alınır.
DUYURU_KAYNAKLARI += [
    {"ad": "ODTÜ", "url": "https://www.metu.edu.tr/tr/rss.xml", "dil": "tr", "tur": "suz", "arkeo_sart": True},
    {"ad": "Atatürk Üniversitesi", "url": "https://www.atauni.edu.tr/feed/", "dil": "tr", "tur": "suz", "arkeo_sart": True},
]
for _q in GOOGLE_DUYURU_SORGULARI:
    DUYURU_KAYNAKLARI.append({"ad": "Google Haberler", "url": "https://news.google.com/rss/search?q=" + urllib.parse.quote(_q + " when:90d")
                              + "&hl=tr&gl=TR&ceid=TR:tr", "dil": "tr", "tur": "suz", "google": True})
ARKEO_DESENI = re.compile(r"arkeolo|\bkazi|hoyuk|antik|magara|muze|kulturel miras|kultur miras|prehistor|paleolit|neolit|arkeometri|epigraf"
                          r"|tarih oncesi|oren yeri|tumulus|archaeolog|excavat|heritage|prehistor")
IL_ADLARI = ("adana adiyaman afyon agri aksaray amasya ankara antalya ardahan artvin aydin balikesir bartin batman bayburt bilecik bingol bitlis "
             "bolu burdur bursa canakkale cankiri corum denizli diyarbakir duzce edirne elazig erzincan erzurum eskisehir gaziantep antep giresun "
             "gumushane hakkari hatay igdir isparta istanbul izmir kahramanmaras karabuk karaman kars kastamonu kayseri kilis kirikkale kirklareli "
             "kirsehir kocaeli konya kutahya malatya manisa mardin mersin mugla mus nevsehir nigde ordu osmaniye rize sakarya samsun sanliurfa urfa "
             "siirt sinop sirnak sivas tekirdag tokat trabzon tunceli usak van yalova yozgat zonguldak").split()
TR_DESENI = re.compile(r"\b(turkiye|turkey|turkiye'|anadolu|anatolia|anatolian|" + "|".join(IL_ADLARI) + r")")
AYLAR_TR = ["ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"]
AYLAR_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
TARIH_TR = re.compile(r"\b(\d{1,2})\s*(?:[-–]\s*\d{1,2}\s*)?(" + "|".join(AYLAR_TR) + r")\w*(?:\s+(\d{4}))?")
TARIH_EN = re.compile(r"\b(\d{1,2})\s*(?:[-–]\s*\d{1,2}\s*)?(" + "|".join(AYLAR_EN) + r")(?:\s+(\d{4}))?|\b(" + "|".join(AYLAR_EN)
                      + r")\s+(\d{1,2})(?:\s*[-–]\s*\d{1,2})?(?:,?\s+(\d{4}))?")
INSTA_DESENI = re.compile(r"https?://(?:www\.)?instagram\.com/[A-Za-z0-9_.]+/?(?:p/[A-Za-z0-9_-]+/?)?")


# Her yıl yapılan Uluslararası Kazı, Araştırma ve Arkeometri Sempozyumu (UKAAS; Kazı/Araştırma/Arkeometri Sonuçları Toplantısı):
# duyuruları ve bildiri kitapları "önemli" (onemli: 1) işaretlenir; bildirim_gonder.py yeni önemli duyuruyu herkese gönderir.
ONEMLI_DESENI = re.compile(r"kazi,? arastirma ve arkeometri sempozyum|kazi sonuclari toplantisi|arastirma sonuclari toplantisi|arkeometri sonuclari toplantisi|\bukaas\b")
YAYIN_DESENI = re.compile(r"bildiri kitap|bildiri metin\w* yayi|kitaplari yayi|yayimlandi|yayinlandi|e-kitap")
UKAAS_DUYURU = "https://ukaas.ktb.gov.tr/TR-389978/haberlerduyurular.html"


def html_baglantilari(url: str) -> list[tuple[str, str]]:
    """Sayfadaki bağlantılar: (mutlak adres, görünen metin)."""
    import urllib.request
    istek = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Arkix toplayici; +https://arkix.harrixapp.com)"})
    with urllib.request.urlopen(istek, timeout=25) as y:
        t = y.read().decode("utf-8", "ignore")
    l = []
    for h, a in re.findall(r'<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>', t, re.S):
        a = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", a))).strip()
        if a:
            l.append((urllib.parse.urljoin(url, html.unescape(h)), a))
    return l


def sayfa_duyurulari(url: str, ad: str, calisma: str, arkeo_sart: bool = False) -> list[dict]:
    """Duyuru sayfasındaki etkinlik/kazı/yayın bağlantıları (RSS'i olmayan kurum ve üniversiteler için genel okuyucu).
    Metnin sonundaki gg.aa.yyyy yayın tarihi sayılır; yoksa ilk görüldüğü gün."""
    l, gorulen = [], set()
    for u, a in html_baglantilari(url):
        m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})\s*$", a)
        baslik = re.sub(r"\s*\d{2}\.\d{2}\.\d{4}\s*$", "", a).strip()
        b = _ascii(baslik)
        if (not m and len(baslik) < 35) or u in gorulen or (arkeo_sart and not ARKEO_DESENI.search(b)):   # menü bağlantıları kısa ve tarihsiz
            continue
        tur = "yayin" if YAYIN_DESENI.search(b) and (ONEMLI_DESENI.search(b) or ARKEO_DESENI.search(b)) else duyuru_turu(baslik)
        if not tur and ONEMLI_DESENI.search(b):
            tur = "etkinlik"
        if not tur:
            continue
        gorulen.add(u)
        yayin = f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else calisma[:10]
        l.append({"b": baslik, "u": u, "t": yayin, "o": "", "tur": tur, "s": ad})
    return l


def etkinlik_tarihi(metin: str, yayin: str) -> str:
    """Metindeki ilk gün-ay (yıl) ifadesi: "9-11 Aralık", "21–24 April 2027", "December 9". Yıl yoksa yayın tarihine göre en yakın ileri tarih."""
    m, a = _ascii(metin), None
    t = TARIH_TR.search(m)
    if t:
        gun, ay, yil = int(t.group(1)), AYLAR_TR.index(t.group(2)) + 1, t.group(3)
    else:
        e = TARIH_EN.search(m)
        if not e:
            return ""
        if e.group(1):
            gun, ay, yil = int(e.group(1)), AYLAR_EN.index(e.group(2)) + 1, e.group(3)
        else:
            gun, ay, yil = int(e.group(5)), AYLAR_EN.index(e.group(4)) + 1, e.group(6)
    try:
        y0 = dt.date.fromisoformat(yayin[:10])
        a = dt.date(int(yil), ay, gun) if yil else dt.date(y0.year, ay, gun)
        if not yil and a < y0 - dt.timedelta(days=60):
            a = dt.date(y0.year + 1, ay, gun)
        if abs((a - y0).days) > 500:
            return ""
    except (ValueError, TypeError):
        return ""
    return a.isoformat()
ETKINLIK_DESENI = re.compile(
    r"\b(sempozyum\w*|kongre\w*|konferans\w*|kolokyum\w*|calistay\w*|bildiri (?:cagrisi|gonderim\w*|ozet\w*)|yaz okulu\w*|panel(?:i|inde|de)?"
    r"|symposium|symposia|congress|conference|colloquium|workshop|call for (?:papers|abstracts|proposals)|summer school|annual meeting|lecture series)\b")
KAZI_CAGRI_DESENI = re.compile(
    r"(kazi\w*.{0,50}\b(?:gonullu\w*|ogrenci alim\w*|katilimci\w*|basvuru\w*)|\bgonullu\w*.{0,50}kazi\w*|field school|excavation volunteers?"
    r"|volunteers? (?:wanted|needed)|dig volunteers?|kazi ekib\w*.{0,30}(?:ariyor|alim\w*))")


TUR_DESENI = re.compile(r"\b(itinerary|travelers|travellers|safari|cruise|day trip|tour package)\b", re.I)   # AIA'nın ücretli gezi turları etkinlik değil


def duyuru_turu(baslik: str, metin: str = "") -> str:
    b = _ascii(baslik)   # küçük harf, Türkçe harfler ASCII'ye (çalıştay -> calistay)
    if KAZI_CAGRI_DESENI.search(b + " " + _ascii(metin)):
        return "kazi"
    return "etkinlik" if ETKINLIK_DESENI.search(b) else ""


def rss_ogeleri(url: str) -> list[dict]:
    import email.utils
    import urllib.request
    import xml.etree.ElementTree as ET
    istek = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Arkix toplayici; +https://arkix.harrixapp.com)"})
    with urllib.request.urlopen(istek, timeout=25) as y:
        kok = ET.fromstring(y.read())
    l = []
    for oge in kok.iter("item"):
        tarih = ""
        try:
            tarih = email.utils.parsedate_to_datetime(oge.findtext("pubDate") or "").date().isoformat()
        except (TypeError, ValueError):
            pass
        aciklama = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", oge.findtext("description") or ""))).strip()
        l.append({"b": html.unescape((oge.findtext("title") or "").strip()), "u": (oge.findtext("link") or "").strip(), "t": tarih, "o": aciklama})
    return l


def duyurulari_topla(eski: list[dict], kayitlar: list[dict], calisma: str, sayfalar: list[dict] | None = None) -> list[dict]:
    """Etkinlik ve kazı duyuruları: RSS kaynakları + bülten kayıtlarında örüntüye uyanlar. Bir yıldan eski olanlar düşer."""
    sinir = (dt.date.today() - dt.timedelta(days=365)).isoformat()
    sinir_yayin = (dt.date.today() - dt.timedelta(days=3 * 365)).isoformat()   # bildiri kitapları 3 yıl kalır
    toplam = {d["i"]: d for d in eski if (d.get("t") or "") >= (sinir_yayin if d.get("du") == "yayin" else sinir)}
    kelimeler = lambda b: {w.strip("'’\".,:;!?()") for w in _ascii(b).split() if len(w) > 3}
    gorulen_baslik = [kelimeler(d["b"]) for d in toplam.values()]
    benzer = lambda k: any(len(k & g) / max(1, len(k | g)) >= 0.45 for g in gorulen_baslik)   # aynı etkinlik başka gazetede
    # HTML duyuru sayfaları: UKAAS (önemli) + ayar.json › duyuru_sayfalari [{ad, url, arkeo_sart}]
    for sayfa in [{"ad": "UKAAS · Kültür ve Turizm Bakanlığı", "url": UKAAS_DUYURU}] + list(sayfalar or []):
        try:
            for o in sayfa_duyurulari(sayfa["url"], sayfa["ad"], calisma, bool(sayfa.get("arkeo_sart"))):
                u = guvenli_url(o["u"])
                if not u or o["t"] < (sinir_yayin if o["tur"] == "yayin" else sinir):
                    continue
                kimlik = "du:" + hashlib.sha1(u.encode()).hexdigest()[:16]
                metin = _ascii(o["b"])
                et = etkinlik_tarihi(o["b"], o["t"]) if o["tur"] == "etkinlik" else ""
                toplam[kimlik] = {"i": kimlik, "du": o["tur"], "s": o["s"], "b": o["b"][:200], "o": "", "u": u, "t": et or o["t"], "yt": o["t"],
                                  **({"et": 1} if et else {}), "tr": 1, **({"onemli": 1} if ONEMLI_DESENI.search(metin) else {}),
                                  "l": "tr", "g": toplam.get(kimlik, {}).get("g") or calisma}
                gorulen_baslik.append(kelimeler(o["b"]))
        except Exception as h:
            print(f"Duyuru sayfası alınamadı: {sayfa['url'][:90]} ({h})", flush=True)
    for kaynak in DUYURU_KAYNAKLARI:
        try:
            ogeler = rss_ogeleri(kaynak["url"])
        except Exception as h:   # bir kaynak çökerse ötekiler sürer
            print(f"Duyuru kaynağı alınamadı: {kaynak['url'][:90]} ({h})", flush=True)
            continue
        for o in ogeler:
            site = kaynak["ad"]
            if kaynak.get("google") and " - " in o["b"]:   # "Başlık - Haber sitesi"
                o["b"], site = o["b"].rsplit(" - ", 1)
                o["o"] = ""   # Google'ın açıklaması yalnız başlık tekrarı
            tur = kaynak["tur"] if kaynak["tur"] != "suz" else duyuru_turu(o["b"], o["o"])
            u = guvenli_url(o["u"])
            if not tur or not u or not o["b"] or (o["t"] and o["t"] < sinir) or TUR_DESENI.search(o["b"] + " " + o["o"][:300]):
                continue
            if (kaynak.get("google") or kaynak.get("arkeo_sart")) and not ARKEO_DESENI.search(_ascii(o["b"])):
                continue
            anahtar = kelimeler(o["b"])
            kimlik = "du:" + hashlib.sha1(u.encode()).hexdigest()[:16]
            if kimlik not in toplam and benzer(anahtar):
                continue
            gorulen_baslik.append(anahtar)
            yayin = o["t"] or calisma[:10]
            et = etkinlik_tarihi(o["b"] + " " + o["o"], yayin)
            metin = _ascii(o["b"] + " " + o["o"])
            ig = INSTA_DESENI.search(o["o"] + " " + o["u"])
            toplam[kimlik] = {"i": kimlik, "du": tur, "s": site[:60], "b": o["b"][:200], "o": o["o"][:240], "u": u,
                              "t": et or yayin, "yt": yayin, **({"et": 1} if et else {}),
                              **({"tr": 1} if kaynak["dil"] == "tr" or TR_DESENI.search(metin) else {}),
                              **({"ig": ig.group(0)} if ig else {}),
                              **({"onemli": 1} if ONEMLI_DESENI.search(metin) else {}),
                              "l": kaynak["dil"], "g": toplam.get(kimlik, {}).get("g") or calisma}
    for k in kayitlar:   # bülten kayıtlarından (haber, rapor) duyuru olanlar
        if k.get("k") in ("Haber", "Rapor") and not k.get("oz"):
            tur = duyuru_turu((k.get("b") or "") + " " + (k.get("bt") or ""), k.get("o") or "")
            if tur:
                yayin = (k.get("t") or calisma)[:10]
                et = etkinlik_tarihi((k.get("b") or "") + " " + (k.get("o") or ""), yayin)
                metin = _ascii((k.get("b") or "") + " " + (k.get("bt") or "") + " " + (k.get("o") or ""))
                toplam["k:" + k["i"]] = {"i": "k:" + k["i"], "du": tur, "s": k.get("s", ""), "b": (k.get("bt") or k.get("b") or "")[:200],
                                         "o": (k.get("ot") or k.get("o") or "")[:240], "u": f"https://arkix.harrixapp.com/#k/{k['i']}", "k": k["i"],
                                         "t": et or yayin, "yt": yayin, **({"et": 1} if et else {}),
                                         **({"tr": 1} if k.get("l") == "tr" or TR_DESENI.search(metin) else {}),
                                         "l": k.get("l", ""), "g": k.get("g") or calisma}
    l = sorted(toplam.values(), key=lambda d: (d.get("t") or "", d.get("g") or ""), reverse=True)[:300]
    print(f"Duyurular: {sum(d['du'] == 'etkinlik' for d in l)} etkinlik, {sum(d['du'] == 'kazi' for d in l)} kazı çağrısı, "
          f"{sum(d['du'] == 'yayin' for d in l)} yayın, {sum(1 for d in l if d.get('onemli'))} önemli", flush=True)
    return l


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

    # --- telif: lisansı serbest olmayan yayınların özeti çeviriden önce kısaltılır
    vekil = [{"d": s.get("doi") or "", "k": s["kategori"], "o": s.get("ozet") or "", "b": s["baslik"], "s": s["kaynak"]}
             for s in yeni]
    lisans_sayisi = lisanslari_bul(vekil + list(eski_kayitlar.values()), kullanici.get("eposta", ""))
    # konu süzgeci: arkeoloji dışı akademik yayınlar (yeni ve eski) atılır, çeviri hakkı boşa gitmez
    once = len(yeni) + len(eski_kayitlar)
    yeni, vekil = [s for s, v in zip(yeni, vekil) if konu_uygun(v)], [v for v in vekil if konu_uygun(v)]
    eski_kayitlar = {i: k for i, k in eski_kayitlar.items() if konu_uygun(k)}
    print(f"Konu süzgeciyle atılan: {once - len(yeni) - len(eski_kayitlar)}", flush=True)
    for s, v in zip(yeni, vekil):
        telif_uygula(v)
        s["ozet"] = v["o"]
        if "lz" in v:
            s["lisans"] = v["lz"]
        if "kz" in v:
            s["konular"] = v["kz"]
        if v.get("kisa"):
            s["kisa"] = 1
    for k in eski_kayitlar.values():
        telif_uygula(k)
    print(f"Lisansı bulunan yayın: {lisans_sayisi}", flush=True)

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

    # İngilizce arayüz için: İngilizce olmayanların (Türkçeler dahil) İngilizcesi
    ceviri_siniri_en = int(kullanici.get("ceviri_siniri_en", ceviri_siniri))
    cevrilecek_en = [s for s in yeni if s.get("dil") and s["dil"] != "en"][:ceviri_siniri_en]

    def cevirt_en(s):
        try:
            b, o, _servis = ceviri.kayit_cevir(s["baslik"], (s.get("ozet") or "")[:900], s["dil"], {}, hedef="en")
            s["baslik_en"], s["ozet_en"] = b, o
        except Exception:
            pass
    with ThreadPoolExecutor(max_workers=3) as h:
        list(h.map(cevirt_en, cevrilecek_en))

    # eski kayıtlardan çevirisi eksik olanlara da sıra gelsin
    kalan_en = ceviri_siniri_en - len(cevrilecek_en)
    for k in list(eski_kayitlar.values()):
        if kalan_en <= 0:
            break
        if k.get("l") and k["l"] != "en" and not k.get("be"):
            try:
                b, o, _ = ceviri.kayit_cevir(k["b"], (k.get("o") or "")[:900], k["l"], {}, hedef="en")
                k["be"], k["oe"] = b, o
            except Exception:
                pass
            kalan_en -= 1
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
            "u": guvenli_url(s.get("gercek_url") or s.get("url")), "d": s.get("doi") or "",
            "o": (s.get("ozet") or "")[:900], "e": [e for e in (s.get("etiketler") or "").split(",") if e],
            "p": guvenli_url(s.get("pdf_url")), "l": s.get("dil") or "", "g": calisma,
            "bt": s.get("baslik_tr", ""), "ot": s.get("ozet_tr", ""),
            "be": s.get("baslik_en", ""), "oe": s.get("ozet_en", ""),
            "a": apa_html(s),
            "ku": kunye_kisa(s),
        }
        if s.get("eslesen"):
            eski_kayitlar[s["id"]]["m"] = s["eslesen"]
        if "lisans" in s:
            eski_kayitlar[s["id"]]["lz"] = s["lisans"]
        if "konular" in s:
            eski_kayitlar[s["id"]]["kz"] = s["konular"]
        if s.get("kisa"):
            eski_kayitlar[s["id"]]["kisa"] = 1
        telif_uygula(eski_kayitlar[s["id"]])   # çeviriler de sınıra insin

    # --- Arkix Özel: dosyalardan her seferinde yeniden kurulur, eski kopyaları atılır
    ozeller = ozel_yazilar(eski_kayitlar, calisma)
    eski_kayitlar = {i: k for i, k in eski_kayitlar.items() if not i.startswith("ozel-")}
    print(f"Arkix Özel yazı: {len(ozeller)}", flush=True)

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
    engel = [e.strip().lower() for e in (kullanici.get("engelli_kaynaklar") or []) if e.strip()]
    if engel:
        once = len(tum)
        tum = [k for k in tum if not engelli_mi(k, engel)]
        print(f"Kaldırma talebiyle engellenen: {once - len(tum)} kayıt", flush=True)
    # topluluk: yöneticinin kaldırdığı kayıtlar atılır; yorum sayıları ve son yorumlar eklenir
    yorum_sayilari, son_yorumlar, gizli_kayitlar = topluluk_oku()
    if gizli_kayitlar:
        once = len(tum)
        tum = [k for k in tum if k["i"] not in gizli_kayitlar]
        print(f"Yöneticinin kaldırdığı: {once - len(tum)} kayıt", flush=True)
    # Arkix Özel yazılar saklama süresine ve kayıt sınırına takılmaz
    tum = sorted(ozeller + tum, key=lambda k: (k.get("g", ""), k.get("t", "")), reverse=True)
    for k in tum:   # sözlüğe sonradan eklenen kavramlar (ör. bilim dalları) eski kayıtlara da işlensin
        if not k.get("oz"):
            k["e"] = list(dict.fromkeys((k.get("e") or []) + donem_etiketleri(k.get("b") or "", (k.get("o") or "") + " " + (k.get("ot") or ""))))
    for k in tum:
        if yorum_sayilari.get(k["i"]):
            k["ys"] = yorum_sayilari[k["i"]]
        else:
            k.pop("ys", None)
    kimlikler = {k["i"] for k in tum}
    son_yorumlar = [y for y in son_yorumlar if y["k"] in kimlikler][:5]

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
        "etkinlikler": duyurulari_topla(eski.get("etkinlikler", []), tum, calisma, ayar.get("duyuru_sayfalari") or []),
        **({"sesli_ozet": ozet_ses} if ozet_ses else {}),
        **({"son_yorumlar": son_yorumlar} if son_yorumlar else {}),
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
