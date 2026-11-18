"""İnternet kaynakları: makale/tez veritabanları ve haber akışları.

Kullanılan kaynaklar (hepsi ücretsiz, anahtar gerektirmez):
  * OpenAlex API  — dünya çapında makale + tez dizini; açık erişim PDF bağlantılarını da verir
  * Crossref API  — DOI kayıtları; DergiPark dergilerinin çoğu DOI'lerini buraya kaydeder
  * RSS akışları  — Arkeofili, Google Haberler aramaları ve ayarlardan eklenen diğer siteler

Not: DergiPark ve YÖK Tez Merkezi'nin arama sayfaları otomatik taramaya kapalıdır
(robots.txt / form tabanlı). Bu yüzden DergiPark makaleleri Crossref/OpenAlex
üzerinden gelir; YÖK Tez için uygulamada "YÖK Tez'de ara" düğmesi vardır.
"""
from __future__ import annotations
import base64
import datetime as dt
import email.utils
import gzip
import hashlib
import http.cookiejar
import json
import os
import re
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zlib

from .metin import (arkeoloji_kesin, arkeoloji_mi, dil_normal, dil_tahmin, donem_etiketleri, html_temizle, puanla,
                   rapor_mu, tr_kucuk)

# Sitelerin çoğu "bot" görünen istekleri engellediği için gerçek bir tarayıcı gibi tanıtıyoruz
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/131.0.0.0 Safari/537.36")
API_UA = "HarrixArkeoloji/2.1 (masaustu arkeoloji bulteni; mailto:harrix-arkeoloji@users.noreply)"
ZAMAN_ASIMI = 25


_SSL = None


def ssl_baglami() -> ssl.SSLContext:
    """Güvenilir kök sertifikalar.

    python.org'un Mac sürümü sertifika getirmez ("Install Certificates" çalıştırılmamışsa HTTPS
    istekleri CERTIFICATE_VERIFY_FAILED verir). Sıra: certifi paketi → Mac'in sistem anahtarlığı
    → Python'un varsayılanı.
    """
    global _SSL
    if _SSL is not None:
        return _SSL
    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx.load_verify_locations(certifi.where())
    except Exception:
        if sys.platform == "darwin":
            pem = os.path.join(os.path.expanduser("~"), ".harrix_arkeoloji", "mac-kok-sertifikalar.pem")
            try:
                if not os.path.exists(pem) or os.path.getsize(pem) < 1000:
                    os.makedirs(os.path.dirname(pem), exist_ok=True)
                    cikti = subprocess.run(
                        ["/usr/bin/security", "find-certificate", "-a", "-p",
                         "/System/Library/Keychains/SystemRootCertificates.keychain"],
                        capture_output=True, timeout=20).stdout
                    with open(pem, "wb") as f:
                        f.write(cikti)
                ctx.load_verify_locations(pem)
            except Exception:
                pass
    _SSL = ctx
    return ctx


def _acici(*ek):
    return urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_baglami()), *ek)


def oturum():
    """Çerez saklayan bir bağlantı açıcı (yönlendirmeli yayıncı sitelerinde gerekir)."""
    return _acici(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def indir(url: str, zaman_asimi: int = ZAMAN_ASIMI, veri: bytes | None = None,
          basliklar: dict | None = None, acici=None, api: bool = False) -> tuple[bytes, str, str]:
    """(içerik, content-type, son url) döndürür. HTTP hatalarında urllib.error.HTTPError fırlatır."""
    h = {
        "User-Agent": API_UA if api else UA,
        "Accept": "application/json" if api else
                  "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate",
    }
    if "google." in url:
        h["Cookie"] = "CONSENT=YES+cb; SOCS=CAI"
    h.update(basliklar or {})
    req = urllib.request.Request(url, data=veri, headers=h, method="POST" if veri else "GET")
    ac = (acici or _acici()).open
    with ac(req, timeout=zaman_asimi) as r:
        govde = r.read()
        kod = (r.headers.get("Content-Encoding") or "").lower()
        if kod == "gzip" or govde[:2] == b"\x1f\x8b":
            govde = gzip.decompress(govde)
        elif kod == "deflate":
            try:
                govde = zlib.decompress(govde)
            except zlib.error:
                govde = zlib.decompress(govde, -zlib.MAX_WBITS)
        return govde, r.headers.get("Content-Type", ""), r.geturl()


# ---------------------------------------------------------------- Google Haberler bağlantı çözücü
def google_haber_coz(url: str) -> str:
    """news.google.com/rss/articles/... bağlantısını haberin gerçek adresine çevirir.

    Google bu bağlantıları JavaScript ile yönlendirdiği için doğrudan açılamaz; okuyucu ve
    tarayıcı penceresi gerçek adrese gitsin diye burada çözülür. Çözülemezse aynı adres döner.
    """
    if "news.google." not in (url or ""):
        return url
    m = re.search(r"/articles/([A-Za-z0-9_\-]+)", url)
    if not m:
        return url
    gid = m.group(1)
    # 1) Eski biçim: adres kimliğin içinde base64 olarak duruyor
    try:
        ham = base64.urlsafe_b64decode(gid + "=" * (-len(gid) % 4))
        b = re.search(rb"https?://[\x21-\x7e]+", ham)
        if b and b"AU_yqL" not in ham[:12]:
            aday = b.group(0).decode("ascii", "ignore")
            if "." in aday:
                return aday
    except Exception:
        pass
    # 2) Yeni biçim: imza + zaman damgası alınıp Google'ın çözme servisine sorulur
    try:
        sayfa = ""
        for u in (f"https://news.google.com/rss/articles/{gid}", f"https://news.google.com/articles/{gid}"):
            sayfa = indir(u, zaman_asimi=15)[0].decode("utf-8", "replace")
            if "data-n-a-sg" in sayfa:
                break
        sg = re.search(r'data-n-a-sg="([^"]+)"', sayfa)
        ts = re.search(r'data-n-a-ts="([^"]+)"', sayfa)
        if not (sg and ts):
            return url
        istek = ["Fbv4je",
                 '["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,'
                 'null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],'
                 f'"{gid}",{ts.group(1)},"{sg.group(1)}"]']
        govde = ("f.req=" + urllib.parse.quote(json.dumps([[istek]]))).encode()
        yanit = indir("https://news.google.com/_/DotsSplashUi/data/batchexecute", zaman_asimi=15,
                      veri=govde, basliklar={"Content-Type":
                                             "application/x-www-form-urlencoded;charset=UTF-8"})[0]
        metin = yanit.decode("utf-8", "replace")
        parca = metin.split("\n\n", 1)[1] if "\n\n" in metin else metin[metin.find("["):]
        for satir in json.loads(parca):
            if isinstance(satir, list) and len(satir) > 2 and satir[0] == "wrb.fr" and satir[2]:
                gercek = json.loads(satir[2])[1]
                if isinstance(gercek, str) and gercek.startswith("http"):
                    return gercek
    except Exception:
        pass
    return url


def _indir(url: str) -> bytes:
    return indir(url, api=("api." in url))[0]


_HTML_VARLIK = {"nbsp": "&#160;", "rsquo": "&#8217;", "lsquo": "&#8216;", "rdquo": "&#8221;",
                "ldquo": "&#8220;", "ndash": "&#8211;", "mdash": "&#8212;", "hellip": "&#8230;",
                "laquo": "&#171;", "raquo": "&#187;", "copy": "&#169;", "reg": "&#174;", "deg": "&#176;"}


def xml_coz(veri: bytes):
    """XML'i çözer; bozuksa (HTML varlıkları, çıplak &, denetim karakterleri) onarıp yeniden dener."""
    try:
        return ET.fromstring(veri)
    except ET.ParseError:
        pass
    metin = veri.decode("utf-8", "replace").lstrip("\ufeff \r\n\t")
    if not metin.startswith("<"):
        bas = metin.find("<")
        metin = metin[bas:] if bas >= 0 else metin
    if re.match(r"(?is)<!doctype html|<html", metin):
        raise ValueError("akış yerine web sayfası döndü (bot koruması ya da adres değişmiş)")
    metin = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", metin)
    metin = re.sub(r"&([a-zA-Z]+);", lambda m: _HTML_VARLIK.get(m.group(1).lower(), m.group(0))
                   if m.group(1) not in ("amp", "lt", "gt", "quot", "apos") else m.group(0), metin)
    metin = re.sub(r"&(?!#?\w+;)", "&amp;", metin)
    metin = re.sub(r"&([a-zA-Z]+);", lambda m: m.group(0) if m.group(1) in ("amp", "lt", "gt", "quot", "apos")
                   else "", metin)
    metin = re.sub(r"^<\?xml[^>]*\?>", "", metin.strip())
    return ET.fromstring(metin.encode("utf-8"))


def _kimlik(doi: str = "", url: str = "", baslik: str = "") -> str:
    anahtar = (doi or "").lower().replace("https://doi.org/", "").strip()
    if not anahtar:
        anahtar = (url or "").split("?")[0].rstrip("/").lower() or tr_kucuk(baslik)
    return hashlib.sha1(anahtar.encode("utf-8")).hexdigest()[:20]


def _etiketler(baslik: str, ozet: str, eslesen_etiket: list[str]) -> str:
    tum = list(dict.fromkeys(eslesen_etiket + donem_etiketleri(baslik, ozet)))
    return "," + ",".join(tum) + "," if tum else ""


# ---------------------------------------------------------------- OpenAlex
def _openalex_ozet(inv: dict | None) -> str:
    if not inv:
        return ""
    konum = {}
    for kelime, sira in inv.items():
        for i in sira:
            konum[i] = kelime
    return " ".join(konum[i] for i in sorted(konum))


def _openalex_kayit(w: dict, kavramlar) -> dict | None:
    """OpenAlex 'work' nesnesini Bülten kaydına çevirir."""
    baslik = html_temizle(w.get("display_name") or w.get("title") or "")
    if not baslik:
        return None
    ozet = _openalex_ozet(w.get("abstract_inverted_index"))
    puan, eslesen, etiket = puanla(baslik, ozet, kavramlar)
    puan = max(puan, 1)  # arama zaten bu sorguyla eşleşti
    loc = w.get("primary_location") or {}
    kaynak_ad = ((loc.get("source") or {}).get("display_name")) or ""
    doi = (w.get("doi") or "").replace("https://doi.org/", "")
    url = w.get("doi") or loc.get("landing_page_url") or w.get("id")
    en_iyi = w.get("best_oa_location") or {}
    pdf = (en_iyi.get("pdf_url") or loc.get("pdf_url") or "")
    yazarlar = "; ".join(
        (a.get("author") or {}).get("display_name", "") for a in w.get("authorships", [])[:8]
    )
    tur = w.get("type") or ""
    if tur == "dissertation":
        kategori = "Tez"
        if not kaynak_ad and w.get("authorships"):
            inst = (w["authorships"][0].get("institutions") or [{}])
            kaynak_ad = inst[0].get("display_name", "") if inst else ""
    elif tur in ("book", "book-chapter", "monograph", "edited-book"):
        kategori = "Kitap"
    else:
        kategori = "Makale"
    return dict(
        id=_kimlik(doi, url, baslik), kategori=kategori, kaynak="OpenAlex",
        baslik=baslik, yazarlar=yazarlar, yayin_yeri=kaynak_ad,
        tarih=w.get("publication_date") or str(w.get("publication_year") or ""), url=url, doi=doi, ozet=ozet,
        eslesen=", ".join(eslesen), puan=puan, etiketler=_etiketler(baslik, ozet, etiket),
        pdf_url=pdf, icerik="", dil=dil_normal(w.get("language")) or dil_tahmin(baslik, ozet),
        atif=w.get("cited_by_count") or 0,
    )


def _openalex_parametre(params: dict, eposta: str = "", anahtar: str = "") -> dict:
    if anahtar:
        params["api_key"] = anahtar
    elif eposta:
        params["mailto"] = eposta
    return params


def openalex_ara(sorgu: str, gun: int, kavramlar, eposta: str = "", anahtar: str = "") -> list[dict]:
    baslangic = (dt.date.today() - dt.timedelta(days=gun)).isoformat()
    params = _openalex_parametre({
        "search": sorgu,
        "filter": f"from_publication_date:{baslangic}",
        "sort": "publication_date:desc",
        "per-page": "50",
    }, eposta, anahtar)
    veri = json.loads(_indir("https://api.openalex.org/works?" + urllib.parse.urlencode(params)))
    kayitlar = [k for k in (_openalex_kayit(w, kavramlar) for w in veri.get("results", [])) if k]
    for k in kayitlar:   # bültende kitaplar makale sekmesinde görünmeye devam etsin
        if k["kategori"] == "Kitap":
            k["kategori"] = "Makale"
    return kayitlar


LITERATUR_TURLERI = {"": "", "Makale": "type:article|review", "Tez": "type:dissertation",
                     "Kitap": "type:book|book-chapter"}
LITERATUR_SIRALARI = {"ilgi": "relevance_score:desc", "yeni": "publication_date:desc",
                      "atif": "cited_by_count:desc"}


def literatur_ara(sorgu: str, kavramlar, tur: str = "", yil1: int | None = None, yil2: int | None = None,
                  dil: str = "", acik: bool = False, sirala: str = "ilgi", sayfa: int = 1,
                  eposta: str = "", anahtar: str = "") -> tuple[list[dict], int]:
    """Tarih sınırı olmadan bütün literatürde (OpenAlex, ~300 milyon yayın) arar.
    Dönüş: (kayıtlar, toplam sonuç sayısı)."""
    süzgeç = []
    if LITERATUR_TURLERI.get(tur):
        süzgeç.append(LITERATUR_TURLERI[tur])
    if yil1:
        süzgeç.append(f"from_publication_date:{int(yil1)}-01-01")
    if yil2:
        süzgeç.append(f"to_publication_date:{int(yil2)}-12-31")
    if dil:
        süzgeç.append(f"language:{dil}")
    if acik:
        süzgeç.append("is_oa:true")
    params = {"search": sorgu, "per-page": "50", "page": str(sayfa)}
    if süzgeç:
        params["filter"] = ",".join(süzgeç)
    if sirala != "ilgi" or not sorgu.strip():
        params["sort"] = LITERATUR_SIRALARI.get(sirala, "cited_by_count:desc")
    _openalex_parametre(params, eposta, anahtar)
    veri = json.loads(_indir("https://api.openalex.org/works?" + urllib.parse.urlencode(params)))
    kayitlar = [k for k in (_openalex_kayit(w, kavramlar) for w in veri.get("results", [])) if k]
    return kayitlar, int((veri.get("meta") or {}).get("count") or 0)


def openalex_doi(doi: str, eposta: str = "", anahtar: str = "") -> dict | None:
    """Tek DOI için OpenAlex kaydı (açık erişim PDF'i bulmak için; tekil sorgu ücretsizdir)."""
    params = _openalex_parametre({}, eposta, anahtar)
    url = "https://api.openalex.org/works/doi:" + urllib.parse.quote(doi.strip()) + (
        "?" + urllib.parse.urlencode(params) if params else "")
    try:
        return _openalex_kayit(json.loads(_indir(url)), [])
    except Exception:
        return None


# ---------------------------------------------------------------- Crossref
def _crossref_tarih(item: dict) -> str:
    for alan in ("published-online", "published-print", "published", "issued", "created"):
        parcalar = (item.get(alan) or {}).get("date-parts") or []
        if parcalar and parcalar[0] and parcalar[0][0]:
            p = list(parcalar[0]) + [1, 1]
            try:
                return dt.date(int(p[0]), int(p[1]), int(p[2])).isoformat()
            except (ValueError, TypeError):
                continue
    return ""


def crossref_ara(sorgu: str, gun: int, kavramlar, eposta: str = "") -> list[dict]:
    baslangic = (dt.date.today() - dt.timedelta(days=gun)).isoformat()
    params = {
        "query.bibliographic": sorgu,
        "filter": f"from-pub-date:{baslangic}",
        "sort": "published",
        "order": "desc",
        "rows": "40",
        "select": "DOI,title,author,container-title,URL,abstract,published-online,"
                  "published-print,published,issued,created,type,publisher,link",
    }
    if eposta:
        params["mailto"] = eposta
    veri = json.loads(_indir("https://api.crossref.org/works?" + urllib.parse.urlencode(params)))
    sonuc = []
    for it in veri.get("message", {}).get("items", []):
        baslik = html_temizle((it.get("title") or [""])[0])
        if not baslik:
            continue
        ozet = html_temizle(it.get("abstract") or "")
        puan, eslesen, etiket = puanla(baslik, ozet, kavramlar)
        if puan == 0:
            continue  # Crossref bulanık arar; gerçekten eşleşmeyenleri atla
        yazarlar = "; ".join(
            " ".join(x for x in (a.get("given"), a.get("family")) if x) or a.get("name", "")
            for a in (it.get("author") or [])[:8]
        )
        yer = (it.get("container-title") or [""])[0] or it.get("publisher", "")
        kategori = "Tez" if it.get("type") == "dissertation" else "Makale"
        doi = it.get("DOI", "")
        url = it.get("URL") or (f"https://doi.org/{doi}" if doi else "")
        pdf = next((l.get("URL", "") for l in it.get("link") or []
                    if "pdf" in (l.get("content-type") or "")), "")
        sonuc.append(dict(
            id=_kimlik(doi, url, baslik), kategori=kategori, kaynak="Crossref",
            baslik=baslik, yazarlar=yazarlar, yayin_yeri=yer, tarih=_crossref_tarih(it),
            url=url, doi=doi, ozet=ozet, eslesen=", ".join(eslesen), puan=puan,
            etiketler=_etiketler(baslik, ozet, etiket), pdf_url=pdf, icerik="",
            dil=dil_tahmin(baslik, ozet),
        ))
    return sonuc


# ---------------------------------------------------------------- RSS / Atom
def _rss_tarih(s: str) -> str:
    if not s:
        return ""
    try:
        return email.utils.parsedate_to_datetime(s).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        pass
    try:
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return s[:10]


def _yerel(etiket: str) -> str:
    return etiket.rsplit("}", 1)[-1]


def rss_oku(url: str, kaynak_adi: str, kavramlar, kategori: str = "Haber",
            hepsini_al: bool = True, gun: int = 30, baglam_gerekli=False) -> list[dict]:
    """RSS 2.0 veya Atom akışını okur.

    hepsini_al=True  -> tamamen arkeoloji sitesi (ör. Arkeofili) veya arama akışı: her yazı alınır.
    hepsini_al=False -> genel site: yalnızca kavramlarla eşleşenler alınır.
    baglam_gerekli   -> yazıda arkeolojiyle ilgili bir kelime (kazı, höyük, arkeolojik,
                        excavation...) yoksa atılır. Google Haberler için açıktır.
    baglam_gerekli="siki" -> genel haber sitesi (Hürriyet, NTV…): daha sıkı arkeoloji denetimi.
    Akış yazının tamamını veriyorsa (content:encoded) uygulama içi okuyucu için saklanır.
    """
    kok = xml_coz(_indir(url))
    sinir = (dt.date.today() - dt.timedelta(days=gun)).isoformat()
    ogeler = [e for e in kok.iter() if _yerel(e.tag) in ("item", "entry")]
    # akışın dili: <language>tr-TR</language>, xml:lang ya da Google Haberler'in hl= parametresi
    akis_dili = ""
    for e in kok.iter():
        if _yerel(e.tag) == "language" and e.text:
            akis_dili = dil_normal(e.text)
            break
    akis_dili = akis_dili or dil_normal(kok.get("{http://www.w3.org/XML/1998/namespace}lang", ""))
    if not akis_dili and "news.google." in url:
        hl = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("hl", [""])[0]
        akis_dili = dil_normal(hl)
    sonuc = []
    for e in ogeler:
        alan = {}
        for c in e:
            ad = _yerel(c.tag)
            if ad == "link":
                alan.setdefault("link", c.get("href") or (c.text or "").strip())
            elif ad in ("title", "description", "summary", "content", "encoded",
                        "pubDate", "published", "updated", "date", "source", "creator"):
                alan.setdefault(ad, (c.text or "").strip())
        baslik = html_temizle(alan.get("title", ""))
        if not baslik:
            continue
        ham_icerik = alan.get("encoded") or alan.get("content") or ""
        ozet = html_temizle(alan.get("description") or alan.get("summary") or ham_icerik)[:1500]
        tarih = _rss_tarih(alan.get("pubDate") or alan.get("published") or
                           alan.get("updated") or alan.get("date") or "")
        if tarih and tarih < sinir:
            continue
        puan, eslesen, etiket = puanla(baslik, html_temizle(ham_icerik) or ozet, kavramlar)
        if not hepsini_al and puan == 0:
            continue
        if baglam_gerekli in ("siki", "bilim"):
            if not arkeoloji_kesin(baslik, ozet, bilim=baglam_gerekli == "bilim"):
                continue
        elif baglam_gerekli and not arkeoloji_mi(baslik, ozet):
            continue
        yayin = alan.get("source") or kaynak_adi
        # Google Haberler başlıkları "Başlık - Kaynak" biçimindedir
        if "news.google." in url and " - " in baslik:
            baslik, _, yayin = baslik.rpartition(" - ")
        kat = "Rapor" if rapor_mu(baslik, ozet) else kategori
        link = alan.get("link", "")
        sonuc.append(dict(
            id=_kimlik("", link, baslik), kategori=kat, kaynak=kaynak_adi, baslik=baslik,
            yazarlar=alan.get("creator", ""), yayin_yeri=yayin, tarih=tarih, url=link,
            doi="", ozet=ozet, eslesen=", ".join(eslesen), puan=puan,
            etiketler=_etiketler(baslik, ozet, etiket), pdf_url="",
            icerik=ham_icerik if len(ham_icerik) > 400 else "",
            dil=dil_tahmin(baslik, ozet) or akis_dili,
        ))
    return sonuc


BAGLAM_TR = "(arkeoloji OR arkeolojik OR kazı OR höyük OR antik)"
BAGLAM_EN = "(archaeology OR archaeological OR excavation OR prehistoric)"


def google_haber_url(sorgu: str, dil: str = "tr", baglam: bool = False) -> str:
    if baglam:
        sorgu = f"({sorgu}) {BAGLAM_TR if dil == 'tr' else BAGLAM_EN}"
    if dil == "tr":
        return ("https://news.google.com/rss/search?" +
                urllib.parse.urlencode({"q": sorgu, "hl": "tr", "gl": "TR", "ceid": "TR:tr"}))
    return ("https://news.google.com/rss/search?" +
            urllib.parse.urlencode({"q": sorgu, "hl": "en-US", "gl": "US", "ceid": "US:en"}))


YOK_TEZ_ADRESI = "https://tez.yok.gov.tr/UlusalTezMerkezi/tarama.jsp"
DERGIPARK_ARAMA = "https://dergipark.org.tr/tr/search?q={q}&section=articles"
