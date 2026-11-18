"""Türkçe metin yardımcıları: harf katlama, kavram eşleştirme/puanlama, kategori tahmini."""
from __future__ import annotations
import html
import re
import unicodedata

HARF = "a-z0-9çğıöşüâîû"


def tr_kucuk(s: str) -> str:
    """Türkçe I/İ kuralına uygun küçük harf."""
    return (s or "").replace("I", "ı").replace("İ", "i").lower()


def katla(s: str) -> str:
    """Eşleştirme için normalleştirme: küçük harf, ı→i, aksan temizliği (é→e), tire→boşluk.

    Böylece "PALAEOLITHIC", "Palaeolithic", "Epi-Paleolitik", "Acheuléen" gibi yazılışlar
    birbirini bulur.
    """
    s = tr_kucuk(s).replace("ı", "i")
    s = "".join(c for c in unicodedata.normalize("NFKD", s)
                if not unicodedata.combining(c) or c in "̧̆̈")  # ç ş ğ ö ü korunur
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"[-‐–_/]", " ", s)
    return re.sub(r"\s+", " ", s)


def html_temizle(s: str) -> str:
    """HTML/JATS etiketlerini ve fazla boşlukları temizler."""
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


_desen_onbellek: dict[str, re.Pattern] = {}


def _desen(varyant_katli: str) -> re.Pattern:
    """Sol tarafı kelime sınırı olan desen; sağ taraf serbest (Türkçe ekler: Neolitik'te, Neolitikte)."""
    d = _desen_onbellek.get(varyant_katli)
    if d is None:
        d = re.compile(rf"(?<![{HARF}]){re.escape(varyant_katli)}")
        _desen_onbellek[varyant_katli] = d
    return d


def gecer_mi(katli_metin: str, kavram) -> bool:
    return any(_desen(v).search(katli_metin) for v in kavram.katli())


def puanla(baslik: str, ozet: str, kavramlar, bolge_kimlik: str = "anadolu") -> tuple[int, list[str], list[str]]:
    """Kavram bazlı puan.

    Bir kavram (TR ya da EN, hangi yazılışla olursa) başlıkta geçerse 3, sadece özette geçerse 1 puan.
    Bölge kavramı (Anadolu/Anatolia...) geçerse +2 öncelik puanı.
    Dönüş: (puan, eşleşen kavram adları, etiketler [kavram kimlikleri])
    """
    b, o = katla(baslik), katla(ozet)
    puan, eslesen, etiket = 0, [], []
    for kav in kavramlar:
        if kav.kimlik == bolge_kimlik:
            continue
        if gecer_mi(b, kav):
            puan += 3
        elif o and gecer_mi(o, kav):
            puan += 1
        else:
            continue
        eslesen.append(kav.kisa)
        etiket.append(kav.kimlik)
    from .terimler import KAVRAM  # döngüsel içe aktarmayı önlemek için burada
    bolge = KAVRAM.get(bolge_kimlik)
    if bolge and (gecer_mi(b, bolge) or (o and gecer_mi(o, bolge))):
        etiket.append(bolge.kimlik)
        if puan:
            puan += 2
            eslesen.append(bolge.kisa)
    return puan, eslesen, etiket


def donem_etiketleri(baslik: str, ozet: str) -> list[str]:
    """Kayıt, seçili olmasa bile hangi sözlük kavramlarına değiniyor? (filtre için)"""
    from .terimler import TERIMLER
    t = katla(baslik + " " + ozet)
    return [k.kimlik for k in TERIMLER if gecer_mi(t, k)]


_RAPOR_DESENI = re.compile(
    r"kazi(?:si|lari|larinda|sinda)?\s+(?:sonuc|rapor)"
    r"|kazi\s+sezonu|sezonu?\s+(?:tamamlandi|basladi|sona erdi)"
    r"|kazi(?:si|lari)?\s+(?:basladi|tamamlandi|sona erdi|devam ediyor)"
    r"|kazi\s+calismalari|yuzey\s+arastirmasi"
    r"|excavation\s+report|field\s+season|preliminary\s+report|on\s+rapor",
)


def _ascii(s: str) -> str:
    return katla(s).translate(str.maketrans("çğşöü", "cgsou"))


_BAGLAM_DESENI = re.compile(
    r"(?<![a-z])(?:"
    r"arkeolo|archaeolo|archeolo"
    r"|kazi(?:si|nin|da|sinda)?\s+(?:sezon|ekib|heyet|baskan|alan|evi|sonuc|rapor|direktor|buluntu)"
    r"|kazilar(?:i|da|inda|in|dan)?(?![a-z])|kazibilim"
    r"|hoyuk|tepe\s+kazi|oren\s+yeri|antik(?!a)|tarih\s*oncesi|prehistor"
    r"|paleoliti|palaeolith|paleolith|epipaleo|epipalaeo|mezoliti|mesolith|neoliti|neolith"
    r"|kalkoliti|chalcolith|tunc\s+cag|bronze\s+age|demir\s+cag|iron\s+age|tas\s+cag|stone\s+age"
    r"|fosil(?!\s*yakit)|fossil(?!\s*fuel)|hominin|hominid|neandert|homo\s+(?:erectus|sapiens)"
    r"|excavat|ancient|lithic|yontmata|obsidyen|obsidian|nekropol|necropol"
    r"|muze(?:si|de|ye|nin|ler|lerde|sinde)?(?![a-z])|museum|epigraf|yazit|inscription"
    r"|mozaik|mosaic|lahit|sarcophag|tumulus|tumulus|kurgan|megalit|megalith|rock\s+art|kaya\s+resim"
    r"|stratigra|radyokarbon|radiocarbon|zooarkeo|zooarchaeo|arkeobotan|archaeobotan"
    r")"
)


def arkeoloji_mi(baslik: str, ozet: str = "") -> bool:
    """Metin arkeolojiyle ilgili bir bağlam içeriyor mu? (genel haberleri elemek için)"""
    return bool(_BAGLAM_DESENI.search(_ascii(baslik + " " + ozet)))


# Genel haber akışları (Hürriyet, NTV…) için daha sıkı bağlam: "müze kart zammı",
# "fosil yakıt", "antika", "mozaik parke" gibi haberler girmesin.
_KESIN_DESENI = re.compile(
    r"(?<![a-z])(?:"
    r"arkeolo|archaeolo|archeolo|kazibilim"
    r"|kazi(?:si|nin|da|sinda)?\s+(?:sezon|ekib|heyet|baskan|alan|evi|sonuc|rapor|direktor|buluntu)"
    r"|kazi\s+calisma|kazilarda|hoyuk|oren\s+yeri|antik\s+(?:kent|tiyatro|liman|yerlesim|donem|cag|mezar)"
    r"|tarih\s*oncesi|prehistor|paleoliti|palaeolith|paleolith|epipaleo|mezoliti|mesolith|neoliti|neolith"
    r"|kalkoliti|chalcolith|tunc\s+cag|bronze\s+age|iron\s+age|tas\s+cag|stone\s+age"
    r"|hominin|hominid|neandert|homo\s+(?:erectus|sapiens)|excavat|lithic|yontmata"
    r"|nekropol|necropol|lahit|sarcophag|tumulus|kurgan|megalit|megalith|radyokarbon|radiocarbon"
    r"|gobekli|karahan\s*tepe|tas\s+tepeler|catalhoyuk|hattus|urartu|hitit\s+(?:donem|kral|dev|baskent|yazit|tablet)|hittite|frigya|lidya|urartu"
    r")")


_ESKI_YAS = re.compile(r"\d[\d.,]*\s*(?:-|\s)?(?:year[- ]old|years?\s+ago|yillik|yil\s+once)"
                       r"|(?<![a-z])(?:ancient|prehistoric|mummif|mumya|skeleton|iskelet|tomb|mezar)")


def arkeoloji_kesin(baslik: str, ozet: str = "", bilim: bool = False) -> bool:
    """Genel haber sitelerindeki yazılar için sıkı arkeoloji bağlamı denetimi.
    bilim=True: bilim sitelerinin karışık akışları (Phys.org, ScienceDaily) için 'X bin yıllık',
    'ancient', 'tomb' gibi ifadeler de yeterli sayılır."""
    metin = _ascii(baslik + " " + ozet)
    if _KESIN_DESENI.search(metin):
        return True
    return bilim and bool(_ESKI_YAS.search(metin)) and not re.search(r"dinozor|dinosaur", metin)


def rapor_mu(baslik: str, ozet: str = "") -> bool:
    """Haber/yazının bir kazı sonucu / sezon raporu olup olmadığını tahmin eder."""
    return bool(_RAPOR_DESENI.search(_ascii(baslik + " " + ozet)))


# ---------------------------------------------------------------- dil
DILLER = [("tr", "Türkçe"), ("en", "İngilizce"), ("de", "Almanca"), ("fr", "Fransızca")]
DIL_ADI = dict(DILLER)
_DIL_KELIME = {
    "tr": set("ve bir ile bu için olarak olan gibi ait yeni üzerine hakkında bulundu dönem dönemi "
              "kazı kazısı arkeolojik çağ çağı yerleşim buluntu buluntular değerlendirme ilk olan "
              "da de ki ne çok daha göre arasında tarafından yılında sonra önce".split()),
    "en": set("the of and in from on with for an new is are at by this that its their into "
              "evidence site study analysis during between early late".split()),
    "de": set("der die das und von zu mit im den des ein eine für über auf bei aus zur zum "
              "nicht ist sich".split()),
    "fr": set("le la les des et du une dans pour sur au aux par est entre nouvelles "
              "nouveaux".split()),
}


def dil_tahmin(*metinler: str) -> str:
    """Basit dil tahmini (başlık + özet). Emin değilse boş döner."""
    t = tr_kucuk(" ".join(m for m in metinler if m))
    if not t.strip():
        return ""
    kelime = re.findall(r"[a-zçğıöşüâîûäßéèêàù]+", t)
    puan = {d: sum(1 for k in kelime if k in liste) for d, liste in _DIL_KELIME.items()}
    puan["tr"] += 2 * sum(t.count(h) for h in "ğış")       # yalnızca Türkçede olan harfler
    # Türkçede olmayan harf kalıpları (th, w, q, x) İngilizceye işaret eder
    puan["en"] += sum(1 for k in kelime if re.search(r"th|w|q|x|ae|ph", k) and not re.search(r"[äöüßéèêàçğış]", k))
    puan["de"] += 2 * t.count("ß") + sum(t.count(h) for h in "äé" if h == "ä")
    puan["fr"] += sum(t.count(h) for h in "éèêàù")
    en_iyi = max(puan, key=puan.get)
    return en_iyi if puan[en_iyi] >= 2 else ""


def dil_normal(kod: str) -> str:
    """OpenAlex/Crossref/RSS dil kodunu iki harfe indirger: 'tr-TR' → 'tr', 'eng' → 'en'."""
    k = (kod or "").strip().lower().replace("_", "-").split("-")[0]
    return {"eng": "en", "tur": "tr", "ger": "de", "deu": "de", "fre": "fr", "fra": "fr"}.get(k, k)[:3]


DURAK = set(tr_kucuk(w) for w in """
ve ile bir bu da de için olarak olan en çok daha gibi ama ancak veya ya
the of and in a an to on for with from by at as is are was were its their
new yeni ilk büyük kadar sonra önce göre üzerine hakkında arasında yılında
bin yıl yıllık olduğu ortaya çıktı çıkarıldı bulundu keşfedildi
""".split())


def kelimeler(s: str) -> list[str]:
    s = tr_kucuk(s)
    return [w for w in re.findall(r"[a-zçğıöşüâîû]{4,}", s) if w not in DURAK]
