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


# "Kazı" sözcüğü altyapı, yol ve inşaat haberlerinde de geçer ("kazı alanına düşen otomobil").
# Kaza/asayiş ya da altyapı bağlamı varsa ve güçlü bir arkeoloji sözcüğü yoksa haber atılır.
_DIS_DESENI = re.compile(
    r"(?<![a-z])(?:"
    r"kaza(?:da|si|sinda|ya|dan)?(?![a-z])|ters\s+dondu|devril|yaralan|hayatini\s+kaybet|can\s+verdi|olu\s+ve"
    r"|(?:otomobil|arac|kamyon|tir|minibus|otobus|motosiklet|is\s+makine|kepce|ekskavator)\w*\s+(?:\w+\s+){0,3}(?:dus|devril|gomul|mahsur)"
    r"|dusen\s+(?:otomobil|arac|kamyon|tir|motosiklet|cocuk|isci|yasli)"
    r"|altyapi|dogal\s*gaz|kanalizasyon|icme\s+suyu|yagmur\s+suyu|fiber|elektrik\s+(?:hatt|kablo|altyapi)|asfalt"
    r"|gocuk|goctu|toprak\s+kaymasi|isci\s+(?:mahsur|toprak\s+altinda)"
    r")")
_GUCLU_DESENI = re.compile(
    r"(?<![a-z])(?:arkeolo|archaeolo|archeolo|hoyuk|oren\s+yeri|antik|tarih\s*oncesi|neoliti|paleoliti|kalkoliti"
    r"|tarihi\s+(?:eser|yapi|mezar|kalinti|duvar|sarnic|kilise|hamam|su\s+yolu)|kurtarma\s+kazi|muze|lahit|mozaik|sikke"
    r"|nekropol|bizans|roma\s+(?:donem|imparator)|hellenisti|osmanli\s+donem|tumulus|kaya\s+mezar|buluntu)")


def arkeoloji_disi(baslik: str, ozet: str = "") -> bool:
    """Haber arkeolojiyle ilgisiz bir kaza/altyapı haberi mi? (kazı sözcüğü yüzünden süzgeçten geçenler)"""
    metin = _ascii(baslik + " " + ozet)
    return bool(_DIS_DESENI.search(metin)) and not _GUCLU_DESENI.search(metin)


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


# ---------------------------------------------------------------- aynı haber, farklı kaynak
# Aynı haber birkaç siteden (ya da Google Haberler'in iki ayrı aramasından) farklı bağlantıyla gelir;
# bağlantıya göre kimlik farklı olduğundan ikisi de kaydedilirdi. Başlıkların kelime "imzası"
# karşılaştırılır: önce gelen kalır, sonradan gelen kopya atılır.
_BOS_KELIME = {katla(k) for k in (
    "ve ile bir bu da de için olarak olan gibi daha çok en yeni ilk son yıl yılda kadar sonra önce "
    "nin nın the and for with from that this into over are was its their after has have been how why what").split()}
TEKRAR_GUN = 3   # haberlerde yalnız ± bu kadar gün içindeki kayıtlar karşılaştırılır


def baslik_imzasi(baslik: str) -> frozenset:
    """Başlığın anlamlı kelimelerinin ilk 6 harfi (Türkçe ekler: kazısında/kazısı → kazısi).
    Kesme işaretinden sonraki ek atılır (Göbeklitepe'de → göbeklitepe). Rakam içeren kelimeler
    (NVL3793, BMR1191x19) kısaltılmaz: ayrı envanter/katalog kayıtları birbirine karışmasın."""
    k = katla(html_temizle(baslik))
    k = re.sub(r"[’'`´]\w*", "", k)
    kelimeler = re.findall(rf"[{HARF}]+", k)
    return frozenset(w if re.search(r"\d", w) else w[:6] for w in kelimeler
                     if (len(w) > 2 or w.isdigit()) and w not in _BOS_KELIME)


def ayni_baslik_mi(a: frozenset, b: frozenset, siki: bool = False) -> bool:
    """İki imza aynı haberi mi anlatıyor? siki=True (makale/tez): kelimeler birebir aynı olmalı.
    Haberde: en az 4 ortak kelime ve kısa başlığın kelimelerinin en az %75'i öbüründe geçmeli."""
    if not a or not b:
        return False
    kucuk = min(len(a), len(b))
    if siki or kucuk < 4:
        return a == b and len(a) >= (4 if siki else 3)
    ortak = len(a & b)
    return ortak >= 4 and ortak / kucuk >= 0.75


def _gun_sirasi(tarih: str) -> int:
    import datetime as _dt
    try:
        return _dt.date.fromisoformat((tarih or "")[:10]).toordinal()
    except ValueError:
        return _dt.date.today().toordinal()


class TekrarDenetci:
    """Kayıtları sırayla görür; daha önce görülmüş bir haberin kopyasını tanır.

        d = TekrarDenetci()
        if d.tekrar_mi(kategori, baslik, tarih): atla  else: d.ekle(kimlik, kategori, baslik, tarih)
    Haber ve Rapor tek grup (aynı haber bir sitede rapor sayılabilir), yalnız ±TEKRAR_GUN gün içinde aranır.
    Makale ve Tez tek grup; başlık birebir aynıysa (DOI'siz kopyalar) tarihe bakılmaz.
    """

    def __init__(self):
        self._haber: dict[int, list[tuple[frozenset, str]]] = {}
        self._yayin: dict[frozenset, str] = {}

    @staticmethod
    def _grup(kategori: str) -> str | None:
        return "haber" if kategori in ("Haber", "Rapor") else "yayin" if kategori in ("Makale", "Tez") else None

    def tekrar_mi(self, kategori: str, baslik: str, tarih: str = "") -> str | None:
        """Kopyaysa ilk görülen kaydın kimliğini, değilse None döndürür."""
        g, imza = self._grup(kategori), baslik_imzasi(baslik)
        if g == "yayin":
            return self._yayin.get(imza) if len(imza) >= 4 else None
        if g == "haber":
            gun = _gun_sirasi(tarih)
            for d in range(gun - TEKRAR_GUN, gun + TEKRAR_GUN + 1):
                for diger, kid in self._haber.get(d, ()):
                    if ayni_baslik_mi(imza, diger):
                        return kid
        return None

    def ekle(self, kimlik: str, kategori: str, baslik: str, tarih: str = ""):
        g, imza = self._grup(kategori), baslik_imzasi(baslik)
        if g == "yayin" and len(imza) >= 4:
            self._yayin.setdefault(imza, kimlik)
        elif g == "haber" and imza:
            self._haber.setdefault(_gun_sirasi(tarih), []).append((imza, kimlik))
