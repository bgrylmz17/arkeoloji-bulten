"""Kaynakça: künye modeli, biçimler (APA 7, İSNAD 2, Chicago, MLA 9, Harvard) ve dışa aktarma.

Künye (kayitlar.kunye sütununda JSON):
  tur        : makale | tez | kitap | bolum | web
  yazarlar   : [{"soyad": "Yılmaz", "ad": "Ertuğrul Buğra"}, ...]   (kurum yazarsa yalnız "soyad")
  yil, ay, gun, baslik, yayin (dergi / kitap / site adı), cilt, sayi, sayfa,
  yayinevi, sehir, universite, tez_turu (Yüksek lisans | Doktora), editorler, doi, url, erisim

Biçimlendirici, italik bölümleri ayrı tutmak için [(metin, italik_mi), ...] parçaları döndürür;
düz metin, RTF (Word) ve uygulama içi gösterim bu parçalardan üretilir.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import urllib.parse

from . import kaynaklar
from .metin import html_temizle, tr_kucuk

BICIMLER = [("apa7", "APA 7"), ("isnad2", "İSNAD 2"), ("chicago", "Chicago (yazar-tarih)"),
            ("mla9", "MLA 9"), ("harvard", "Harvard")]
BICIM_ADI = dict(BICIMLER)
TURLER = [("makale", "Makale"), ("tez", "Tez"), ("kitap", "Kitap"), ("bolum", "Kitap bölümü"), ("web", "Web / haber")]
AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]


# ------------------------------------------------------------------ künye oluşturma
def tr_baslik_harfi(s: str) -> str:
    """'ERTUĞRUL BUĞRA YILMAZ' → 'Ertuğrul Buğra Yılmaz' (Türkçe i/ı kuralıyla)."""
    def kelime(k):
        if not k:
            return k
        ilk = k[0].replace("i", "İ").replace("ı", "I").upper()
        return ilk + tr_kucuk(k[1:])
    return " ".join("-".join(kelime(p) for p in w.split("-")) for w in s.split(" "))


def ad_ayir(tam: str) -> dict:
    """'Ertuğrul Buğra Yılmaz' → {'soyad': 'Yılmaz', 'ad': 'Ertuğrul Buğra'}; 'Yılmaz, E. B.' de anlaşılır.
    YÖK Tez'in büyük harfli adları ('ERTUĞRUL BUĞRA YILMAZ') düzeltilir."""
    tam = re.sub(r"\s+", " ", (tam or "").strip())
    if tam and tam.upper() == tam and any(c.isalpha() for c in tam) and len(tam) > 3:
        tam = tr_baslik_harfi(tam)
    if not tam:
        return {}
    if "," in tam:
        soyad, _, ad = tam.partition(",")
        return {"soyad": soyad.strip(), "ad": ad.strip()}
    parca = tam.split(" ")
    if len(parca) == 1:
        return {"soyad": parca[0], "ad": ""}
    return {"soyad": parca[-1], "ad": " ".join(parca[:-1])}


def kayittan_kunye(r) -> dict:
    """Bülten kaydından (sqlite Row ya da dict) temel künye."""
    try:
        eski = json.loads(r["kunye"]) if r["kunye"] else {}
    except (ValueError, TypeError, KeyError, IndexError):
        eski = {}
    if eski.get("baslik"):
        return eski
    kat = r["kategori"]
    tur = {"Makale": "makale", "Tez": "tez", "Kitap": "kitap"}.get(kat, "web")
    tarih = (r["tarih"] or "")
    k = {
        "tur": tur,
        "yazarlar": [a for a in (ad_ayir(x) for x in (r["yazarlar"] or "").split(";")) if a],
        "yil": tarih[:4], "ay": tarih[5:7].lstrip("0") if len(tarih) >= 7 else "",
        "gun": tarih[8:10].lstrip("0") if len(tarih) >= 10 else "",
        "baslik": r["baslik"] or "", "yayin": r["yayin_yeri"] or "",
        "doi": r["doi"] or "", "url": (r["gercek_url"] if _var(r, "gercek_url") else "") or r["url"] or "",
        "erisim": dt.date.today().isoformat(),
    }
    if tur == "tez":
        k["universite"] = r["yayin_yeri"] or ""
        k["tez_turu"] = "Doktora" if re.search(r"doktora|phd|doctoral", tr_kucuk(r["ozet"] or "")) else ""
        k["yayin"] = ""
    if tur == "makale":
        m = re.search(r"\b(?:No\.?|Sayı|Issue)\s*(\d+)", k["yayin"])
        if m:
            k["sayi"] = m.group(1)
            k["yayin"] = k["yayin"][:m.start()].strip(" ,.-")
    return k


def _var(r, alan):
    try:
        r[alan]
        return True
    except (KeyError, IndexError):
        return False


def crossref_ile_zenginlestir(k: dict) -> dict:
    """DOI varsa Crossref'ten tam künye (yazar adları, cilt, sayı, sayfa, yayınevi) alır."""
    doi = (k.get("doi") or "").replace("https://doi.org/", "").strip()
    if not doi:
        return k
    try:
        veri = json.loads(kaynaklar.indir("https://api.crossref.org/works/" + urllib.parse.quote(doi),
                                          api=True, zaman_asimi=20)[0])["message"]
    except Exception:
        return k
    return crossref_kunye(veri, k)


def crossref_kunye(it: dict, temel: dict | None = None) -> dict:
    k = dict(temel or {})
    tur = it.get("type", "")
    k["tur"] = {"journal-article": "makale", "book": "kitap", "monograph": "kitap", "edited-book": "kitap",
                "book-chapter": "bolum", "dissertation": "tez"}.get(tur, k.get("tur") or "makale")
    yazar = [{"soyad": a.get("family") or a.get("name", ""), "ad": a.get("given", "")}
             for a in it.get("author") or [] if a.get("family") or a.get("name")]
    if yazar:
        k["yazarlar"] = yazar
    ed = [{"soyad": a.get("family", ""), "ad": a.get("given", "")} for a in it.get("editor") or []]
    if ed:
        k["editorler"] = ed
    for alan in ("published-print", "published-online", "issued", "published"):
        p = (it.get(alan) or {}).get("date-parts") or []
        if p and p[0] and p[0][0]:
            k["yil"] = str(p[0][0])
            break
    if it.get("title"):
        k["baslik"] = html_temizle(it["title"][0])
    if it.get("container-title"):
        k["yayin"] = html_temizle(it["container-title"][0])
    for a, b in (("volume", "cilt"), ("issue", "sayi"), ("page", "sayfa"), ("publisher", "yayinevi"),
                 ("publisher-location", "sehir")):
        if it.get(a):
            k[b] = str(it[a]).replace("-", "–")
    if it.get("DOI"):
        k["doi"] = it["DOI"]
    return k


def doi_ile_kunye(doi: str) -> dict:
    doi = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", doi.strip(), flags=re.I)
    veri = json.loads(kaynaklar.indir("https://api.crossref.org/works/" + urllib.parse.quote(doi),
                                      api=True, zaman_asimi=20)[0])["message"]
    k = crossref_kunye(veri, {"doi": doi, "url": "https://doi.org/" + doi, "erisim": dt.date.today().isoformat()})
    return k


# ------------------------------------------------------------------ yardımcılar
def _bas_harf(ad: str, nokta_bosluk=" ") -> str:
    parcalar = [p for p in re.split(r"[\s]+", ad or "") if p]
    out = []
    for p in parcalar:
        if "-" in p:
            out.append("-".join(x[:1].upper() + "." for x in p.split("-") if x))
        else:
            out.append(p[:1].upper() + ".")
    return nokta_bosluk.join(out)


def _kurum_mu(a: dict) -> bool:
    return not a.get("ad")


def _yil(k):
    return k.get("yil") or "t.y."


def _sayfa(k):
    return (k.get("sayfa") or "").replace("-", "–")


def _doi_url(k):
    if k.get("doi"):
        return "https://doi.org/" + k["doi"].replace("https://doi.org/", "")
    return k.get("url") or ""


def _tez_turu(k, dil="tr"):
    t = (k.get("tez_turu") or "").lower()
    if "doktora" in t or "phd" in t or "doctoral" in t:
        return "Doktora tezi"
    return "Yüksek lisans tezi"


def _tarih_uzun(k):
    if k.get("ay"):
        ay = AYLAR[int(k["ay"]) - 1] if str(k["ay"]).isdigit() and 1 <= int(k["ay"]) <= 12 else k["ay"]
        return f"{k.get('gun') + ' ' if k.get('gun') else ''}{ay} {k.get('yil', '')}".strip()
    return k.get("yil", "")


def _erisim(k):
    e = k.get("erisim") or ""
    try:
        d = dt.date.fromisoformat(e)
        return f"{d.day} {AYLAR[d.month - 1]} {d.year}"
    except ValueError:
        return e


def _liste(adlar: list[str], son_bag: str, ayrac: str = ", ") -> str:
    """['A','B','C'] → 'A, B' + son_bag + 'C'. son_bag ', & ' / ' ve ' / ', and ' gibi."""
    if not adlar:
        return ""
    if len(adlar) == 1:
        return adlar[0]
    return ayrac.join(adlar[:-1]) + son_bag + adlar[-1]


def _bit(metin: str) -> str:
    metin = metin.rstrip()
    return metin if metin.endswith((".", "?", "!")) else metin + "."


# ------------------------------------------------------------------ biçimler
def apa7(k: dict) -> list:
    y = k.get("yazarlar") or []
    adlar = [a["soyad"] if _kurum_mu(a) else f"{a['soyad']}, {_bas_harf(a.get('ad'))}" for a in y]
    if len(adlar) > 20:
        adlar = adlar[:19] + ["…", adlar[-1]]
        yazar = ", ".join(adlar)
    else:
        yazar = _liste(adlar, ", & ")          # APA: iki yazarda da virgül + &
    tur = k.get("tur", "makale")
    p = []
    bas = _bit(k.get("baslik", ""))
    if tur == "web":
        tarih = f"({k.get('yil', 't.y.')}{', ' + _tarih_uzun(k).replace(' ' + k.get('yil', ''), '') if k.get('ay') else ''})"
        if yazar:
            p += [(f"{_bit(yazar)} {tarih}. ", False), (bas, True), (" ", False)]
        else:
            p += [(bas, True), (f" {tarih}. ", False)]
        if k.get("yayin"):
            p.append((_bit(k["yayin"]) + " ", False))
        p.append((k.get("url", ""), False))
        return _temizle(p)
    p.append((f"{_bit(yazar) if yazar else ''} ({_yil(k)}). ".lstrip(), False))
    if tur == "makale":
        p.append((bas + " ", False))
        if k.get("yayin"):
            p.append((k["yayin"], True))
            if k.get("cilt"):
                p.append((", ", False))
                p.append((k["cilt"], True))
            if k.get("sayi"):
                p.append((f"({k['sayi']})", False))
            if _sayfa(k):
                p.append((f", {_sayfa(k)}", False))
            p.append((". ", False))
    elif tur == "tez":
        p.append((k.get("baslik", "").rstrip("."), True))
        uni = k.get("universite", "")
        p.append((f" [{_tez_turu(k)}{', ' + uni if uni else ''}]. ", False))
        p.append(("YÖK Ulusal Tez Merkezi. " if "yok.gov.tr" in (k.get("url") or "") else "", False))
    elif tur == "kitap":
        p.append((bas + " ", True))
        if k.get("yayinevi"):
            p.append((_bit(k["yayinevi"]) + " ", False))
    elif tur == "bolum":
        p.append((bas + " ", False))
        ed = k.get("editorler") or []
        if ed:
            edler = _liste([f"{_bas_harf(a.get('ad'))} {a['soyad']}".strip() for a in ed], " & ")
            p.append((f"İçinde {edler} (Ed{'s' if len(ed) > 1 else ''}.), ", False))
        else:
            p.append(("İçinde ", False))
        p.append((k.get("yayin", ""), True))
        if _sayfa(k):
            p.append((f" (ss. {_sayfa(k)})", False))
        p.append((". ", False))
        if k.get("yayinevi"):
            p.append((_bit(k["yayinevi"]) + " ", False))
    if _doi_url(k):
        p.append((_doi_url(k), False))
    return _temizle(p)


def isnad2(k: dict) -> list:
    y = k.get("yazarlar") or []
    adlar = []
    for i, a in enumerate(y):
        if _kurum_mu(a):
            adlar.append(a["soyad"])
        else:
            adlar.append(f"{a['soyad']}, {a.get('ad', '')}" if i == 0 else f"{a.get('ad', '')} {a['soyad']}")
    if len(adlar) > 3:
        yazar = f"{adlar[0]} vd."
    else:
        yazar = _liste(adlar, " - ", " - ")
    tur = k.get("tur", "makale")
    p = [(_bit(yazar) + " " if yazar else "", False)]
    if tur == "makale":
        p.append((f"“{k.get('baslik', '').rstrip('.')}”. ", False))
        p.append((k.get("yayin", ""), True))
        cs = "/".join(x for x in (k.get("cilt"), k.get("sayi")) if x)
        p.append((f" {cs}" if cs else "", False))
        p.append((f" ({_yil(k)})", False))
        p.append((f", {_sayfa(k)}" if _sayfa(k) else "", False))
        p.append((". ", False))
    elif tur == "tez":
        p.append((_bit(k.get("baslik", "")) + " ", True))
        yer = ": ".join(x for x in (k.get("sehir"), k.get("universite")) if x)
        p.append((f"{yer + ', ' if yer else ''}{_tez_turu(k).replace(' tezi', ' Tezi').title()}, {_yil(k)}. ", False))
    elif tur in ("kitap", "bolum"):
        if tur == "bolum":
            p.append((f"“{k.get('baslik', '').rstrip('.')}”. ", False))
            p.append((k.get("yayin", ""), True))
            ed = k.get("editorler") or []
            if ed:
                p.append((f". ed. {_liste([(a.get('ad', '') + ' ' + a['soyad']).strip() for a in ed], ' - ', ' - ')}", False))
            p.append((". ", False))
        else:
            p.append((_bit(k.get("baslik", "")) + " ", True))
        yer = ": ".join(x for x in (k.get("sehir"), k.get("yayinevi")) if x)
        p.append((f"{yer + ', ' if yer else ''}{_yil(k)}", False))
        p.append((f", {_sayfa(k)}" if tur == "bolum" and _sayfa(k) else "", False))
        p.append((". ", False))
    else:  # web
        p.append((f"“{k.get('baslik', '').rstrip('.')}”. ", False))
        if k.get("yayin"):
            p.append((k["yayin"] + ". ", True))
        if k.get("ay") or k.get("yil"):
            p.append((_tarih_uzun(k) + ". ", False))
        p.append((f"Erişim {_erisim(k)}. " if k.get("erisim") else "", False))
        p.append((k.get("url", ""), False))
        return _temizle(p)
    if _doi_url(k):
        p.append((_doi_url(k), False))
    return _temizle(p)


def chicago(k: dict) -> list:
    y = k.get("yazarlar") or []
    adlar = []
    for i, a in enumerate(y):
        if _kurum_mu(a):
            adlar.append(a["soyad"])
        else:
            adlar.append(f"{a['soyad']}, {a.get('ad', '')}" if i == 0 else f"{a.get('ad', '')} {a['soyad']}")
    if len(adlar) > 10:
        adlar = adlar[:7] + ["et al."]
        yazar = ", ".join(adlar)
    else:
        yazar = _liste(adlar, ", and " if len(adlar) > 2 else " and ")
    tur = k.get("tur", "makale")
    p = [(f"{_bit(yazar) + ' ' if yazar else ''}{_yil(k)}. ", False)]
    if tur == "makale":
        p.append((f"“{_bit(k.get('baslik', ''))}” ", False))
        p.append((k.get("yayin", ""), True))
        p.append((f" {k['cilt']}" if k.get("cilt") else "", False))
        p.append((f" ({k['sayi']})" if k.get("sayi") else "", False))
        p.append((f": {_sayfa(k)}" if _sayfa(k) else "", False))
        p.append((". ", False))
    elif tur == "tez":
        p.append((f"“{_bit(k.get('baslik', ''))}” ", False))
        p.append((f"{_tez_turu(k)}, {k.get('universite', '')}. ".replace(", .", "."), False))
    elif tur == "kitap":
        p.append((_bit(k.get("baslik", "")) + " ", True))
        yer = ": ".join(x for x in (k.get("sehir"), k.get("yayinevi")) if x)
        p.append(((_bit(yer) + " ") if yer else "", False))
    elif tur == "bolum":
        p.append((f"“{_bit(k.get('baslik', ''))}” In ", False))
        p.append((k.get("yayin", ""), True))
        ed = k.get("editorler") or []
        if ed:
            p.append((", edited by " + _liste([(a.get('ad', '') + ' ' + a['soyad']).strip() for a in ed], " and "), False))
        p.append((f", {_sayfa(k)}" if _sayfa(k) else "", False))
        p.append((". ", False))
        yer = ": ".join(x for x in (k.get("sehir"), k.get("yayinevi")) if x)
        p.append(((_bit(yer) + " ") if yer else "", False))
    else:
        p.append((f"“{_bit(k.get('baslik', ''))}” ", False))
        if k.get("yayin"):
            p.append((_bit(k["yayin"]) + " ", False))
        if k.get("ay"):
            p.append((_bit(_tarih_uzun(k)) + " ", False))
        p.append((k.get("url", ""), False))
        return _temizle(p)
    if _doi_url(k):
        p.append((_doi_url(k) + ".", False))
    return _temizle(p)


def mla9(k: dict) -> list:
    y = k.get("yazarlar") or []
    if not y:
        yazar = ""
    elif len(y) == 1:
        yazar = y[0]["soyad"] if _kurum_mu(y[0]) else f"{y[0]['soyad']}, {y[0].get('ad', '')}"
    elif len(y) == 2:
        yazar = f"{y[0]['soyad']}, {y[0].get('ad', '')}, and {y[1].get('ad', '')} {y[1]['soyad']}"
    else:
        yazar = f"{y[0]['soyad']}, {y[0].get('ad', '')}, et al"
    tur = k.get("tur", "makale")
    p = [(_bit(yazar) + " " if yazar else "", False)]
    if tur in ("makale", "bolum", "web"):
        p.append((f"“{_bit(k.get('baslik', ''))}” ", False))
        if k.get("yayin"):
            p.append((k["yayin"], True))
            p.append((", ", False))
        if tur == "makale":
            p.append((f"vol. {k['cilt']}, " if k.get("cilt") else "", False))
            p.append((f"no. {k['sayi']}, " if k.get("sayi") else "", False))
        if tur == "bolum" and k.get("yayinevi"):
            p.append((k["yayinevi"] + ", ", False))
        p.append((_tarih_uzun(k) if tur == "web" else _yil(k), False))
        p.append((f", pp. {_sayfa(k)}" if _sayfa(k) else "", False))
        p.append((", " + (_doi_url(k) or "") if _doi_url(k) else "", False))
        p.append((".", False))
    elif tur == "tez":
        p.append((_bit(k.get("baslik", "")) + " ", True))
        p.append((f"{_yil(k)}. {k.get('universite', '')}, {_tez_turu(k)}.", False))
    else:
        p.append((_bit(k.get("baslik", "")) + " ", True))
        p.append((f"{k.get('yayinevi', '')}, {_yil(k)}.".lstrip(", "), False))
    return _temizle(p)


def harvard(k: dict) -> list:
    y = k.get("yazarlar") or []
    adlar = [a["soyad"] if _kurum_mu(a) else f"{a['soyad']}, {_bas_harf(a.get('ad'), '')}" for a in y]
    yazar = (adlar[0] + " et al.") if len(adlar) > 3 else _liste(adlar, " and ")
    tur = k.get("tur", "makale")
    p = [(f"{yazar + ' ' if yazar else ''}({_yil(k)}) ", False)]
    if tur == "makale":
        p.append((f"‘{k.get('baslik', '').rstrip('.')}’, ", False))
        p.append((k.get("yayin", ""), True))
        cs = (k.get("cilt") or "") + (f"({k['sayi']})" if k.get("sayi") else "")
        p.append((f", {cs}" if cs else "", False))
        p.append((f", pp. {_sayfa(k)}" if _sayfa(k) else "", False))
        p.append((". ", False))
        if k.get("doi"):
            p.append((f"doi:{k['doi']}.", False))
        elif k.get("url"):
            p.append((f"Available at: {k['url']} (Accessed: {_erisim(k)}).", False))
    elif tur == "tez":
        p.append((_bit(k.get("baslik", "")) + " ", True))
        p.append((f"{_tez_turu(k)}. {k.get('universite', '')}.", False))
    elif tur in ("kitap", "bolum"):
        if tur == "bolum":
            p.append((f"‘{k.get('baslik', '').rstrip('.')}’, in ", False))
            p.append((_bit(k.get("yayin", "")) + " ", True))
        else:
            p.append((_bit(k.get("baslik", "")) + " ", True))
        yer = ": ".join(x for x in (k.get("sehir"), k.get("yayinevi")) if x)
        p.append(((_bit(yer)) if yer else "", False))
    else:
        p.append((_bit(k.get("baslik", "")) + " ", True))
        p.append((f"Available at: {k.get('url', '')} (Accessed: {_erisim(k)}).", False))
    return _temizle(p)


BICIMLEYICI = {"apa7": apa7, "isnad2": isnad2, "chicago": chicago, "mla9": mla9, "harvard": harvard}


def _temizle(parcalar: list) -> list:
    out = [(m, i) for m, i in parcalar if m]
    if out:
        son = out[-1][0].rstrip()
        out[-1] = (son, out[-1][1])
    return out


def bicimle(k: dict, bicim: str = "apa7") -> list:
    return BICIMLEYICI.get(bicim, apa7)(k)


def duz_metin(k: dict, bicim: str = "apa7") -> str:
    return re.sub(r"\s+", " ", "".join(m for m, _ in bicimle(k, bicim))).replace(" .", ".").strip()


def metin_ici(k: dict, bicim: str = "apa7") -> str:
    """Metin içi atıf: (Yılmaz, 2026), (Yılmaz & Kaya, 2026), (Yılmaz vd., 2026)."""
    y = k.get("yazarlar") or []
    soy = [a["soyad"] for a in y]
    if bicim == "mla9":
        ad = soy[0] if len(soy) == 1 else (f"{soy[0]} and {soy[1]}" if len(soy) == 2 else f"{soy[0]} et al.")
        return f"({ad})" if soy else f"(“{k.get('baslik', '')[:30]}”)"
    if not soy:
        ad = f"“{k.get('baslik', '')[:40]}”"
    elif len(soy) == 1:
        ad = soy[0]
    elif len(soy) == 2:
        ad = f"{soy[0]} {'&' if bicim == 'apa7' else 've' if bicim == 'isnad2' else 'and'} {soy[1]}"
    else:
        ad = f"{soy[0]} {'vd.' if bicim in ('apa7', 'isnad2') else 'et al.'}"
    ayrac = ", " if bicim in ("apa7", "harvard") else " "
    return f"({ad}{ayrac}{_yil(k)})"


# ------------------------------------------------------------------ sıralama
_ALFABE = "aâbcçdefgğhıiîjklmnoöpqrsştuûüvwxyz"


def siralama_anahtari(k: dict) -> tuple:
    y = k.get("yazarlar") or []
    ilk = tr_kucuk((y[0]["soyad"] + " " + y[0].get("ad", "")) if y else k.get("baslik", ""))
    return (tuple(_ALFABE.find(c) if c in _ALFABE else 100 + ord(c) for c in ilk), k.get("yil", ""))


# ------------------------------------------------------------------ dışa aktarma
def rtf(kunyeler: list[dict], bicim: str, baslik: str = "Kaynakça") -> str:
    """Word'ün açtığı RTF: italikler ve asılı girinti korunur."""
    def kac(s: str) -> str:
        out = []
        for c in s:
            if c in "\\{}":
                out.append("\\" + c)
            elif ord(c) > 127:
                out.append(f"\\u{ord(c) if ord(c) < 32768 else ord(c) - 65536}?")
            else:
                out.append(c)
        return "".join(out)
    satirlar = [r"{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}\f0\fs24",
                r"\pard\qc\b " + kac(baslik) + r"\b0\par\par"]
    for k in kunyeler:
        parca = "".join((r"{\i " + kac(m) + "}") if i else kac(m) for m, i in bicimle(k, bicim))
        satirlar.append(r"\pard\fi-720\li720\sa120 " + parca + r"\par")
    satirlar.append("}")
    return "\n".join(satirlar)


def ris(kunyeler: list[dict]) -> str:
    tip = {"makale": "JOUR", "tez": "THES", "kitap": "BOOK", "bolum": "CHAP", "web": "ELEC"}
    out = []
    for k in kunyeler:
        out.append(f"TY  - {tip.get(k.get('tur'), 'GEN')}")
        for a in k.get("yazarlar") or []:
            out.append(f"AU  - {a['soyad']}{', ' + a['ad'] if a.get('ad') else ''}")
        for alan, etiket in (("baslik", "TI"), ("yayin", "T2"), ("yil", "PY"), ("cilt", "VL"), ("sayi", "IS"),
                             ("yayinevi", "PB"), ("sehir", "CY"), ("doi", "DO"), ("url", "UR"), ("universite", "PB")):
            if k.get(alan):
                out.append(f"{etiket}  - {k[alan]}")
        if k.get("sayfa"):
            bas, _, son = _sayfa(k).partition("–")
            out.append(f"SP  - {bas}")
            if son:
                out.append(f"EP  - {son}")
        out.append("ER  - ")
        out.append("")
    return "\n".join(out)


def bibtex(kunyeler: list[dict]) -> str:
    tip = {"makale": "article", "tez": "phdthesis", "kitap": "book", "bolum": "incollection", "web": "misc"}
    out, kullanilan = [], set()
    for k in kunyeler:
        y = k.get("yazarlar") or []
        anahtar = re.sub(r"[^a-z0-9]", "", tr_kucuk((y[0]["soyad"] if y else "anonim")).translate(
            str.maketrans("çğıöşüâîû", "cgiosuaiu"))) + (k.get("yil") or "")
        while anahtar in kullanilan:
            anahtar += "a"
        kullanilan.add(anahtar)
        t = tip.get(k.get("tur"), "misc")
        if t == "phdthesis" and "doktora" not in (k.get("tez_turu") or "").lower():
            t = "mastersthesis"
        alanlar = {"author": " and ".join(f"{a['soyad']}, {a.get('ad', '')}".rstrip(", ") for a in y),
                   "title": k.get("baslik"), "year": k.get("yil"), "volume": k.get("cilt"), "number": k.get("sayi"),
                   "pages": _sayfa(k).replace("–", "--"), "publisher": k.get("yayinevi"), "address": k.get("sehir"),
                   "doi": k.get("doi"), "url": k.get("url"), "school": k.get("universite")}
        alanlar["journal" if t == "article" else "booktitle"] = k.get("yayin")
        govde = ",\n".join(f"  {a} = {{{v}}}" for a, v in alanlar.items() if v)
        out.append(f"@{t}{{{anahtar},\n{govde}\n}}\n")
    return "\n".join(out)
