"""DergiPark'tan doğrudan makale toplama (resmî OAI-PMH arayüzü).

https://dergipark.org.tr/api/public/oai/ — DergiPark'ın makine erişimi için açtığı standart arayüz.
Her kontrolde, son başarılı toplamadan beri eklenen/güncellenen kayıtlar okunur. Kayıtlar
DergiPark'ın kendi konu sınıflandırmasını iki dilde taşır ("Arkeolojide Seramik / Ceramics in
Archeology" gibi); konusu arkeoloji olanlar ya da terimlerinizle eşleşenler alınır.
"""
from __future__ import annotations

import datetime as dt
import re
import urllib.parse
import urllib.error
import time
import xml.etree.ElementTree as ET

from . import kaynaklar
from .metin import arkeoloji_mi, dil_normal, html_temizle, puanla, tr_kucuk

TABAN = "https://dergipark.org.tr/api/public/oai/"
NS = {"oai": "http://www.openarchives.org/OAI/2.0/", "dc": "http://purl.org/dc/elements/1.1/",
      "oai_dc": "http://www.openarchives.org/OAI/2.0/oai_dc/"}
XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"
EN_FAZLA_SAYFA = 25
_ARKEO_KONU = re.compile(r"arkeolo|archeolo|archaeolo|arkeometri|archaeometr|prehistor|tarih ?öncesi|"
                         r"eskiçağ|eski ?çağ|ancient history|epigraf|nümizmat|numismat|biyoarkeo|bioarchaeo",
                         re.IGNORECASE)


def _metinler(meta, ad):
    return [(e.text or "").strip() for e in meta.findall(f"dc:{ad}", NS) if (e.text or "").strip()]


def _dilli(meta, ad, tercih=("tr", "en")):
    """xml:lang'e göre tercih edilen dildeki değeri seçer."""
    ogeler = [(dil_normal(e.get(XML_LANG, "")), (e.text or "").strip()) for e in meta.findall(f"dc:{ad}", NS)
              if (e.text or "").strip()]
    for d in tercih:
        for dl, m in ogeler:
            if dl == d:
                return m, dl
    return (ogeler[0][1], ogeler[0][0]) if ogeler else ("", "")


def kayit_coz(rec, kavramlar) -> dict | None:
    meta = rec.find(".//oai_dc:dc", NS)
    if meta is None:
        return None
    dil = dil_normal((_metinler(meta, "language") or [""])[0])
    tercih = (dil, "tr", "en") if dil else ("tr", "en")
    baslik, _ = _dilli(meta, "title", tercih)
    if not baslik:
        return None
    ozet, _ = _dilli(meta, "description", tercih)
    ozet = html_temizle(ozet)[:3000]
    konular = _metinler(meta, "subject")
    konu_metni = " ; ".join(konular)
    puan, eslesen, etiket = puanla(baslik, ozet + " " + konu_metni, kavramlar)
    arkeo_konu = bool(_ARKEO_KONU.search(konu_metni))
    if not arkeo_konu and puan == 0:
        return None
    if not arkeo_konu and not arkeoloji_mi(baslik, ozet + " " + konu_metni):
        return None
    tanim = _metinler(meta, "identifier")
    url = next((u for u in tanim if "dergipark.org.tr" in u and "/article/" in u), tanim[0] if tanim else "")
    doi = next((u.split("doi.org/", 1)[1] for u in tanim if "doi.org/" in u), "")
    kaynak = (_metinler(meta, "source") or [""])[0]
    dergi = re.sub(r"\s*(No|Sayı|Issue|Cilt|Vol)\.?\s*\d.*$", "", kaynak).strip() or kaynak
    tarih = (_metinler(meta, "date") or [""])[0][:10]
    yazarlar = "; ".join(" ".join(reversed([p.strip() for p in a.split(",", 1)])) if "," in a else a
                         for a in _metinler(meta, "creator")[:10])
    from .kaynaklar import _etiketler, _kimlik
    return dict(
        id=_kimlik(doi, url, baslik), kategori="Makale", kaynak="DergiPark", baslik=html_temizle(baslik),
        yazarlar=yazarlar, yayin_yeri=dergi, tarih=tarih, url=url, doi=doi, ozet=ozet,
        eslesen=", ".join(eslesen or (["arkeoloji (DergiPark konusu)"] if arkeo_konu else [])),
        puan=max(puan, 2 if arkeo_konu else 1), etiketler=_etiketler(baslik, ozet + " " + konu_metni, etiket),
        pdf_url="", icerik="", dil=dil,
    )


def _nazik_indir(url: str, deneme: int = 4) -> bytes:
    """DergiPark çok sık istekte 429 döndürür: Retry-After'a (yoksa 15, 30, 60 sn) uyup yeniden dener;
    her istekten önce kısa bir ara verir."""
    for i in range(deneme):
        time.sleep(1.5)
        try:
            return kaynaklar.indir(url, zaman_asimi=60, api=True)[0]
        except urllib.error.HTTPError as hata:
            if hata.code not in (429, 503) or i == deneme - 1:
                raise
            bekle = hata.headers.get("Retry-After", "")
            time.sleep(min(120, int(bekle)) if bekle.isdigit() else 15 * 2 ** i)
    raise RuntimeError("DergiPark: yanıt alınamadı")


def topla(son_zaman: str | None, kavramlar, gun: int = 30, bildir=lambda m: None) -> tuple[list[dict], str]:
    """Dönüş: (kayıtlar, bu toplamanın başlangıç zamanı — bir sonraki 'from' değeri)."""
    simdi = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    if son_zaman:
        baslangic = son_zaman
    else:
        baslangic = (simdi - dt.timedelta(days=min(gun, 30))).strftime("%Y-%m-%dT%H:%M:%SZ")
    yil_siniri = str(simdi.year - 2)
    params = {"verb": "ListRecords", "metadataPrefix": "oai_dc", "from": baslangic}
    sonuc, sayfa = [], 0
    while sayfa < EN_FAZLA_SAYFA:
        sayfa += 1
        bildir(f"DergiPark: sayfa {sayfa}")
        veri = _nazik_indir(TABAN + "?" + urllib.parse.urlencode(params))
        kok = ET.fromstring(veri)
        hata = kok.find("oai:error", NS)
        if hata is not None:
            if hata.get("code") == "noRecordsMatch":
                break
            raise RuntimeError(f"DergiPark: {hata.get('code')}: {(hata.text or '').strip()}")
        for rec in kok.iterfind(".//oai:record", NS):
            if rec.find("oai:header", NS) is not None and rec.find("oai:header", NS).get("status") == "deleted":
                continue
            k = kayit_coz(rec, kavramlar)
            if k and (not k["tarih"] or k["tarih"][:4] >= yil_siniri):
                sonuc.append(k)
        jeton = kok.find(".//oai:resumptionToken", NS)
        if jeton is None or not (jeton.text or "").strip():
            break
        params = {"verb": "ListRecords", "resumptionToken": jeton.text.strip()}
    return sonuc, simdi.strftime("%Y-%m-%dT%H:%M:%SZ")


def arama_adresi(sorgu: str) -> str:
    """DergiPark'ın kendi arama sayfası (kullanıcı penceresinde açılır)."""
    return "https://dergipark.org.tr/tr/search?q=" + urllib.parse.quote(sorgu) + "&section=articles"
