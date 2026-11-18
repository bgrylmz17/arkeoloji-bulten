"""Tüm kaynakları dolaşıp yeni kayıtları veritabanına yazan kontrol motoru."""
from __future__ import annotations
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from . import dergipark
from . import harrix_hesap
from . import haber_kaynaklari
from . import kaynaklar
from . import terimler
from .veritabani import Depo

# Sözlükte olmayan, kendinize özel kelimeler (kazı adı, il, kişi...)
VARSAYILAN_SERBEST = ["Kızılin", "Ankara arkeoloji", "Keçiören", "Pursaklar"]

# Ad | URL | kategori | hepsini_al (1: sitenin tüm yazıları, 0: sadece eşleşenler)
VARSAYILAN_AKISLAR = [
    "Arkeofili | https://arkeofili.com/feed/ | Haber | 1",
]

# Google Haberler'de her kontrolde ayrıca taranacak genel sorgular
SABIT_HABER_SORGULARI = [
    ("arkeoloji kazı", "tr"),
    ("kazı sezonu tamamlandı", "tr"),
    ("arkeolojik keşif Anadolu", "tr"),
    ("archaeology excavation Turkey", "en"),
]

VARSAYILAN_AYARLAR = {
    "secili_terimler": terimler.VARSAYILAN_SECILI,
    "anahtarlar": VARSAYILAN_SERBEST,   # serbest kelimeler
    "akislar": VARSAYILAN_AKISLAR,
    "gun": 30,
    "eposta": "",
    "claude_anahtar": "",
    "acilista_kontrol": True,
    "acilis_sesi": True,
    "kapanis_sesi": True,
    "diller": ["tr", "en", "de", "fr", "diger"],   # toplanacak diller
    "liste_dili": "Tümü",                           # listelerin açılıştaki dil filtresi
    "ceviri_claude": True,      # Claude anahtarı varsa çeviride onu kullan
    "otomatik_ceviri": False,   # Türkçe olmayan kaydı seçince kendiliğinden çevir
    "dergipark": True,          # DergiPark OAI-PMH toplaması
    "yayin_kaynaklari": True,   # Bundle'daki yayıncıların akışları (haber_kaynaklari.py)
    "dergipark_son": "",        # son başarılı DergiPark toplamasının zamanı (UTC)
    "kaynakca_bicimi": "apa7",
    "tema": "kum",
    "acilis_canlandirma": True,
    "pencereyi_hazir_tut": True,   # uygulama penceresi sürecini önceden aç (Mac'te hızlı açılış)
    "harrix_oturum": None,      # {"adres", "cerez", "ad", "kadi", "rol"} — parola saklanmaz
    "harrix_kazi": None,        # {"kaziAdi", "kaziTuru", "yer", "sezon"}
    "periyot_saat": 6,
    "google_haber": True,
    "ingilizce_haber": True,
    "openalex": True,
    "crossref": True,
}


def ayarlari_yukle(depo: Depo) -> dict:
    a = dict(VARSAYILAN_AYARLAR)
    for k in a:
        a[k] = depo.ayar(k, a[k])
    # 1. sürümden gelen serbest kelimeleri sözlükle birleştir
    if not depo.ayar("v2_gecis", False):
        eski = depo.ayar("anahtarlar", None)
        if eski:
            secili = list(a["secili_terimler"])
            serbest = []
            for s in eski:
                kav = terimler.serbest_kavram(s)
                if kav.kimlik in terimler.KAVRAM:
                    if kav.kimlik not in secili:
                        secili.append(kav.kimlik)
                elif s not in serbest:
                    serbest.append(s)
            for s in VARSAYILAN_SERBEST:
                if s not in serbest:
                    serbest.append(s)
            a["secili_terimler"], a["anahtarlar"] = secili, serbest
            depo.ayar_yaz("secili_terimler", secili)
            depo.ayar_yaz("anahtarlar", serbest)
        depo.ayar_yaz("v2_gecis", True)
    if not depo.ayar("v3_haber_temizligi", False):
        silinen = depo.haber_temizle()
        depo.ayar_yaz("v3_haber_temizligi", True)
        depo.ayar_yaz("son_temizlik", silinen)
    return a


def kavramlari_al(ayar: dict):
    kav = terimler.aktif_kavramlar(ayar.get("secili_terimler", []), ayar.get("anahtarlar", []))
    kazim = harrix_hesap.kazim_kavrami(ayar.get("harrix_kazi"))
    if kazim:
        # kazı adı kendi kelimeler arasında da varsa iki kez aranmasın; Kazım kavramı onun yerini alır
        from .metin import katla
        kav = [k for k in kav if not (k.kimlik.startswith("serbest:") and katla(k.tr[0]) == katla(kazim.tr[0]))]
        kav.append(kazim)
    # Bölge kavramı puanlamada öncelik için her zaman bulunsun
    if terimler.BOLGE_ONCELIGI not in {k.kimlik for k in kav}:
        kav.append(terimler.KAVRAM[terimler.BOLGE_ONCELIGI])
    return kav


def _akis_coz(satir: str):
    parca = [p.strip() for p in satir.split("|")]
    if len(parca) < 2 or not parca[1].startswith("http"):
        return None
    ad, url = parca[0], parca[1]
    kat = parca[2] if len(parca) > 2 and parca[2] else "Haber"
    hepsi = (parca[3] != "0") if len(parca) > 3 else True
    return ad, url, kat, hepsi


def gorevleri_olustur(ayar: dict) -> list[tuple[str, callable]]:
    kavramlar = kavramlari_al(ayar)
    gun = int(ayar.get("gun", 30))
    eposta = ayar.get("eposta", "")
    gorevler = []
    for kav in kavramlar:
        if kav.grup == "Bölge":   # bölge tek başına aranmaz; puan önceliği verir
            continue
        if ayar.get("openalex", True):
            sorgu = terimler.openalex_sorgusu(kav)
            gorevler.append((f"OpenAlex: {kav.ad}",
                             lambda s=sorgu: kaynaklar.openalex_ara(s, gun, kavramlar, eposta)))
        if ayar.get("crossref", True):
            for terim in dict.fromkeys([kav.tr[0], kav.en[0]]):
                gorevler.append((f"Crossref: {terim}",
                                 lambda t=terim: kaynaklar.crossref_ara(t, gun, kavramlar, eposta)))
        if ayar.get("google_haber", True) and kav.grup != "Kazım":
            izinli_d = set(ayar.get("diller") or ["tr", "en"])
            diller = (["tr"] if "tr" in izinli_d else []) + \
                (["en"] if ayar.get("ingilizce_haber", True) and "en" in izinli_d and kav.en[0] != kav.tr[0] else [])
            # Dönem adları zaten arkeolojik; serbest/teknik kelimelere arkeoloji bağlamı eklenir
            # (ör. "Keçiören" tek başına aranınca belediye haberleri gelmesin diye)
            baglam = kav.grup not in ("Dönem", "Kültür-Endüstri")
            for dil in diller:
                sorgu = terimler.haber_sorgusu(kav, dil)
                gorevler.append((f"Google Haberler ({dil}): {kav.kisa}",
                                 lambda s=sorgu, d=dil, b=baglam: kaynaklar.rss_oku(
                                     kaynaklar.google_haber_url(s, d, baglam=b), "Google Haberler",
                                     kavramlar, hepsini_al=False, gun=gun, baglam_gerekli=True)))
    if ayar.get("google_haber", True):
        for sorgu, dil in harrix_hesap.kazim_haber_sorgulari(ayar.get("harrix_kazi")):
            gorevler.append((f"Kazım ({dil}): {sorgu[:40]}",
                             lambda s=sorgu, d=dil: kaynaklar.rss_oku(
                                 kaynaklar.google_haber_url(s, d), "Google Haberler", kavramlar,
                                 hepsini_al=False, gun=max(gun, 90), baglam_gerekli=True)))
    if ayar.get("dergipark", True):
        gorevler.append(("DergiPark (arkeoloji konulu makaleler)", lambda: _dergipark_gorevi(ayar, kavramlar, gun)))
    if ayar.get("google_haber", True):
        for sorgu, dil in SABIT_HABER_SORGULARI:
            gorevler.append((f"Google Haberler: {sorgu}",
                             lambda s=sorgu, d=dil: kaynaklar.rss_oku(
                                 kaynaklar.google_haber_url(s, d), "Google Haberler",
                                 kavramlar, hepsini_al=True, gun=gun, baglam_gerekli=True)))
    gorevler += yayinci_gorevleri(ayar, kavramlar, gun)
    for satir in ayar.get("akislar", []):
        coz = _akis_coz(satir)
        if coz:
            ad, url, kat, hepsi = coz
            gorevler.append((f"RSS: {ad}",
                             lambda ad=ad, url=url, kat=kat, hepsi=hepsi: kaynaklar.rss_oku(
                                 url, ad, kavramlar, kategori=kat, hepsini_al=hepsi, gun=gun)))
    return gorevler


def yayinci_gorevleri(ayar: dict, kavramlar, gun: int) -> list[tuple[str, callable]]:
    """Bundle'daki yayıncılar: doğrudan RSS + akışı olmayanlar için Google Haberler site sorgusu."""
    if not ayar.get("yayin_kaynaklari", True):
        return []
    kendi = {(_akis_coz(s) or ("", ""))[1] for s in ayar.get("akislar", [])}
    gorevler = []
    for ad, url, mod, _dil in haber_kaynaklari.AKISLAR:
        if url in kendi:
            continue
        baglam = {"arkeo": False, "bilim": "bilim"}.get(mod, "siki")
        gorevler.append((f"Yayıncı: {ad}",
                         lambda ad=ad, url=url, b=baglam: kaynaklar.rss_oku(
                             url, ad, kavramlar, kategori="Haber", hepsini_al=True, gun=gun,
                             baglam_gerekli=b)))
    if ayar.get("google_haber", True):
        for i, sorgu in enumerate(haber_kaynaklari.site_sorgulari(), 1):
            gorevler.append((f"Yayıncı grubu {i} (Google Haberler)",
                             lambda s=sorgu: kaynaklar.rss_oku(
                                 kaynaklar.google_haber_url(s, "tr"), "Google Haberler", kavramlar,
                                 hepsini_al=True, gun=gun, baglam_gerekli="siki")))
    return gorevler


_CROSSREF_KILIDI = threading.Semaphore(1)   # Crossref aynı anda çok istek görünce 429 veriyor


def dayanikli_calistir(ad: str, is_, deneme: int = 3):
    """Görevi çalıştırır; sunucu 'çok fazla istek' (429) ya da 'meşgul' (502/503/504) derse
    bekleyip yeniden dener. Crossref görevleri sırayla çalışır."""
    import urllib.error
    kilit = _CROSSREF_KILIDI if ad.startswith("Crossref") else None
    for i in range(deneme):
        try:
            if kilit:
                with kilit:
                    time.sleep(1.0)
                    return is_()
            return is_()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503, 504) or i == deneme - 1:
                raise
            bekle = 8 * (i + 1)
            try:
                bekle = max(bekle, min(60, int(e.headers.get("Retry-After", 0))))
            except (TypeError, ValueError):
                pass
            time.sleep(bekle)


def dil_izinli(dil: str, izinli: set) -> bool:
    """Dili bilinmeyen kayıtlar her zaman alınır; bilinenler ayardaki dillere göre süzülür."""
    if not dil:
        return True
    return dil in izinli if dil in ("tr", "en", "de", "fr") else "diger" in izinli


_DEPO = None   # tam_kontrol sırasında DergiPark'ın son zamanını yazmak için


def _dergipark_gorevi(ayar, kavramlar, gun):
    kayitlar, zaman = dergipark.topla(ayar.get("dergipark_son") or None, kavramlar, gun)
    if _DEPO is not None:
        _DEPO.ayar_yaz("dergipark_son", zaman)
    ayar["dergipark_son"] = zaman
    return kayitlar


def google_baglantilarini_coz(depo: Depo, limit: int = 60, paralel: int = 4) -> int:
    """Google Haberler bağlantılarını önceden gerçek adrese çevirir (tıklayınca beklemeden açılsın)."""
    satirlar = depo.cozulecek_google(limit)

    def coz(r):
        u = kaynaklar.google_haber_coz(r["url"])
        depo.gercek_url_yaz(r["id"], u if u != r["url"] else "-")
        return u != r["url"]
    with ThreadPoolExecutor(max_workers=paralel) as h:
        return sum(1 for ok in h.map(coz, satirlar) if ok)


def tam_kontrol(depo: Depo, ayar: dict, bildir=lambda mesaj: None, paralel: int = 4) -> dict:
    """Bütün kaynakları tarar. Dönüş: {'yeni': [...], 'hatalar': [...], 'toplam': n}"""
    global _DEPO
    _DEPO = depo
    gorevler = gorevleri_olustur(ayar)
    izinli = set(ayar.get("diller") or ["tr", "en", "de", "fr", "diger"])
    tum_yeniler, hatalar, toplam = [], [], 0

    def calistir(ad, is_):
        time.sleep(0.2)  # sunuculara nazik davran
        return dayanikli_calistir(ad, is_)

    with ThreadPoolExecutor(max_workers=paralel) as havuz:
        gelecek = {havuz.submit(calistir, ad, is_): ad for ad, is_ in gorevler}
        for i, g in enumerate(as_completed(gelecek), 1):
            ad = gelecek[g]
            bildir(f"[{i}/{len(gorevler)}] {ad}")
            try:
                kayitlar = [k for k in g.result() if dil_izinli(k.get("dil", ""), izinli)]
                toplam += len(kayitlar)
                tum_yeniler += depo.kaydet(kayitlar)
            except Exception as e:  # bir kaynak çökerse diğerleri devam etsin
                hatalar.append(f"{ad}: {type(e).__name__}: {e}")

    try:
        bildir("Haber bağlantıları hazırlanıyor…")
        google_baglantilarini_coz(depo)
    except Exception as e:
        hatalar.append(f"Bağlantı çözme: {e}")
    depo.kontrol_kaydet(len(tum_yeniler), hatalar)
    depo.eski_temizle(365)
    return {"yeni": tum_yeniler, "hatalar": hatalar, "toplam": toplam}
