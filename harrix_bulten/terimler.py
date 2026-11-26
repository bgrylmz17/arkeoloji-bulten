"""Türkçe–İngilizce arkeoloji terim sözlüğü.

Her terim bir "kavram"dır: Türkçe ve İngilizce bütün yazılışları tek kavrama bağlanır.
- Aramada: kavramın Türkçe ve İngilizce adlarıyla ayrı ayrı (veya OR ile) sorgu yapılır.
- Puanlamada: hangi dilde/yazılışta geçerse geçsin aynı kavram sayılır.
- Etiketlemede: kayda kavram adı etiket olarak eklenir; listelerde dönem filtresi buna göre çalışır.

Yeni terim eklemek için TERIMLER listesine bir satır eklemeniz yeterli.
"""
from __future__ import annotations
from dataclasses import dataclass, field

from .metin import katla


@dataclass
class Kavram:
    kimlik: str
    grup: str            # Dönem / Kültür-Endüstri / Teknoloji / Yöntem / Bölge / Bilim dalı
    tr: list[str]        # ilk eleman Türkçe ana ad
    en: list[str]        # ilk eleman İngilizce ana ad
    varsayilan: bool = False
    _katli: list[str] = field(default_factory=list, repr=False)

    @property
    def ad(self) -> str:
        return f"{self.tr[0]} / {self.en[0]}"

    @property
    def kisa(self) -> str:
        return self.tr[0]

    def varyantlar(self) -> list[str]:
        return self.tr + self.en

    def katli(self) -> list[str]:
        if not self._katli:
            self._katli = sorted({katla(v) for v in self.varyantlar()}, key=len, reverse=True)
        return self._katli


K = Kavram
TERIMLER: list[Kavram] = [
    # ------------------------------------------------------------ Dönemler
    K("paleolitik", "Dönem", ["Paleolitik", "Paleolitik Çağ", "Eski Taş Çağı", "Yontma Taş Çağı"],
      ["Palaeolithic", "Paleolithic", "Old Stone Age"], True),
    K("alt_paleolitik", "Dönem", ["Alt Paleolitik", "Alt Paleolitik Çağ"],
      ["Lower Palaeolithic", "Lower Paleolithic"], True),
    K("orta_paleolitik", "Dönem", ["Orta Paleolitik", "Orta Paleolitik Çağ"],
      ["Middle Palaeolithic", "Middle Paleolithic"], True),
    K("ust_paleolitik", "Dönem", ["Üst Paleolitik", "Üst Paleolitik Çağ"],
      ["Upper Palaeolithic", "Upper Paleolithic"], True),
    K("epipaleolitik", "Dönem", ["Epipaleolitik", "Epi-Paleolitik", "Epi Paleolitik"],
      ["Epipalaeolithic", "Epipaleolithic", "Epi-Palaeolithic", "Epi-Paleolithic"], True),
    K("mezolitik", "Dönem", ["Mezolitik", "Orta Taş Çağı"], ["Mesolithic", "Middle Stone Age Europe"]),
    K("neolitik", "Dönem", ["Neolitik", "Neolitik Çağ", "Cilalı Taş Çağı"], ["Neolithic"], True),
    K("ccn", "Dönem", ["Çanak Çömleksiz Neolitik", "ÇÇN"],
      ["Pre-Pottery Neolithic", "PPNA", "PPNB"]),
    K("kalkolitik", "Dönem", ["Kalkolitik", "Kalkolitik Çağ", "Bakır Çağı", "Bakırtaş Çağı"],
      ["Chalcolithic", "Copper Age", "Eneolithic"]),
    K("tunc", "Dönem", ["Tunç Çağı", "Erken Tunç Çağı", "Orta Tunç Çağı", "Geç Tunç Çağı"],
      ["Bronze Age", "Early Bronze Age", "Middle Bronze Age", "Late Bronze Age"]),
    K("demir", "Dönem", ["Demir Çağı"], ["Iron Age"]),
    K("pleistosen", "Dönem", ["Pleistosen", "Buzul Çağı"], ["Pleistocene", "Ice Age"]),
    K("holosen", "Dönem", ["Holosen"], ["Holocene"]),

    # ------------------------------------------------------------ Kültür / endüstri
    K("olduvai", "Kültür-Endüstri", ["Olduvai Kültürü", "Oldovan"], ["Oldowan"]),
    K("asolyen", "Kültür-Endüstri", ["Aşölyen", "Acheuléen"], ["Acheulean", "Acheulian"], True),
    K("klaktoniyen", "Kültür-Endüstri", ["Klaktoniyen"], ["Clactonian"]),
    K("levallois", "Kültür-Endüstri", ["Levallois", "Levallua"], ["Levallois"], True),
    K("musteryen", "Kültür-Endüstri", ["Musteryen", "Mustiyen"], ["Mousterian"], True),
    K("orinyasyen", "Kültür-Endüstri", ["Orinyasyen", "Orinyak"], ["Aurignacian"]),
    K("ahmaryen", "Kültür-Endüstri", ["Ahmaryen"], ["Ahmarian"]),
    K("kebaran", "Kültür-Endüstri", ["Kebaran"], ["Kebaran"]),
    K("natufyen", "Kültür-Endüstri", ["Natufyen", "Natuf Kültürü"], ["Natufian"]),

    # ------------------------------------------------------------ Teknoloji / buluntu
    K("yontmatas", "Teknoloji", ["Yontmataş", "Yontma taş", "Taş alet", "Taş endüstrisi"],
      ["Chipped stone", "Lithic", "Stone tool", "Lithic industry"], True),
    K("el_baltasi", "Teknoloji", ["El baltası", "Bifas", "İki yüzeyli alet"],
      ["Handaxe", "Hand axe", "Biface", "Bifacial"]),
    K("cekirdek", "Teknoloji", ["Çekirdek", "Yonga", "Dilgi", "Dilgicik"],
      ["Core", "Flake", "Blade", "Bladelet"]),
    K("mikrolit", "Teknoloji", ["Mikrolit", "Geometrik mikrolit"], ["Microlith", "Geometric microlith"]),
    K("obsidyen", "Teknoloji", ["Obsidyen", "Volkan camı"], ["Obsidian"]),
    K("cakmaktasi", "Teknoloji", ["Çakmaktaşı", "Sileks", "Radyolarit"], ["Flint", "Chert", "Radiolarite"]),
    K("teknotipoloji", "Teknoloji", ["Teknoloji ve tipoloji", "Tipoloji", "Operasyon zinciri"],
      ["Technology and typology", "Typology", "Chaîne opératoire", "Operational sequence"]),
    K("kullanim_izi", "Teknoloji", ["Kullanım izi", "Aşınma izi analizi"], ["Use-wear", "Traceology"]),

    # ------------------------------------------------------------ Yöntem
    K("yuzey", "Yöntem", ["Yüzey araştırması", "Yüzey taraması"], ["Archaeological survey", "Surface survey", "Field survey"]),
    K("kazi_raporu", "Yöntem", ["Kazı sonuçları", "Kazı raporu", "Kazı sezonu"],
      ["Excavation report", "Field season", "Preliminary report"]),
    K("tarihleme", "Yöntem", ["Radyokarbon", "C14 tarihlendirme", "OSL tarihlendirme", "Lüminesans"],
      ["Radiocarbon", "Radiocarbon dating", "OSL dating", "Luminescence dating"]),
    K("fotogrametri", "Yöntem", ["Fotogrametri", "3B modelleme", "3D tarama"],
      ["Photogrammetry", "3D modelling", "3D scanning"]),
    K("cbs", "Yöntem", ["CBS", "Coğrafi bilgi sistemleri", "Uzaktan algılama"], ["GIS", "Remote sensing"]),

    # ------------------------------------------------------------ Bölge
    K("anadolu", "Bölge", ["Anadolu", "Türkiye", "İç Anadolu", "Ankara"], ["Anatolia", "Turkey", "Türkiye", "Central Anatolia"]),
    K("levant", "Bölge", ["Levant", "Doğu Akdeniz"], ["Levant", "Eastern Mediterranean"]),
    K("kafkasya", "Bölge", ["Kafkasya"], ["Caucasus"]),
    K("zagros", "Bölge", ["Zagros"], ["Zagros"]),

    # ------------------------------------------------------------ Bilim dalları (arkeolojiyle birlikte çalışan disiplinler)
    K("arkeobotani", "Bilim dalı", ["Arkeobotani", "Arkeobotanik", "Paleoetnobotanik", "Paleobotanik"],
      ["Archaeobotany", "Archaeobotanical", "Palaeoethnobotany", "Paleoethnobotany"]),
    K("zooarkeoloji", "Bilim dalı", ["Zooarkeoloji", "Arkeozooloji", "Zooarkeolojik"], ["Zooarchaeology", "Archaeozoology", "Zooarchaeological"]),
    K("biyoarkeoloji", "Bilim dalı", ["Biyoarkeoloji", "Fiziki antropoloji", "Paleoantropoloji", "İskelet analizi"],
      ["Bioarchaeology", "Osteoarchaeology", "Physical anthropology", "Palaeoanthropology", "Paleoanthropology"]),
    K("arkeogenetik", "Bilim dalı", ["Arkeogenetik", "Antik DNA", "Paleogenetik", "Paleogenomik"],
      ["Archaeogenetics", "Ancient DNA", "Palaeogenomics", "Paleogenomics", "Palaeogenetics"]),
    K("arkeometri", "Bilim dalı", ["Arkeometri", "Arkeometrik"], ["Archaeometry", "Archaeometric"]),
    K("jeoarkeoloji", "Bilim dalı", ["Jeoarkeoloji", "Mikromorfoloji"], ["Geoarchaeology", "Micromorphology"]),
    K("arkeometalurji", "Bilim dalı", ["Arkeometalurji", "Antik metalurji", "Eski metalurji"], ["Archaeometallurgy", "Ancient metallurgy"]),
    K("izotop", "Bilim dalı", ["İzotop analizi", "Kararlı izotop", "Stabil izotop", "Stronsiyum izotop"],
      ["Isotope analysis", "Stable isotope", "Strontium isotope"]),
    K("palinoloji", "Bilim dalı", ["Palinoloji", "Polen analizi"], ["Palynology", "Pollen analysis"]),
    K("dendrokronoloji", "Bilim dalı", ["Dendrokronoloji", "Ağaç halkası"], ["Dendrochronology", "Tree-ring dating"]),
    K("kalinti_analizi", "Bilim dalı", ["Organik kalıntı analizi", "Kalıntı analizi", "Lipit analizi"],
      ["Organic residue analysis", "Residue analysis", "Lipid residue"]),
    K("seramik_analizi", "Bilim dalı", ["Seramik analizi", "Seramik petrografisi", "Çanak çömlek analizi"],
      ["Ceramic analysis", "Ceramic petrography", "Pottery analysis"]),
    K("paleocevre", "Bilim dalı", ["Paleoiklim", "Paleoklimatoloji", "Paleoçevre", "Paleoekoloji"],
      ["Palaeoclimate", "Paleoclimate", "Palaeoenvironment", "Paleoenvironment", "Palaeoecology"]),
    K("tafonomi", "Bilim dalı", ["Tafonomi"], ["Taphonomy"]),
    K("sualti", "Bilim dalı", ["Sualtı arkeolojisi", "Batık kazısı"], ["Underwater archaeology", "Maritime archaeology", "Nautical archaeology"]),
    K("epigrafi", "Bilim dalı", ["Epigrafi", "Epigrafik"], ["Epigraphy", "Epigraphic"]),
    K("numismatik", "Bilim dalı", ["Nümismatik", "Sikke definesi"], ["Numismatics", "Numismatic", "Coin hoard"]),
    K("etnoarkeoloji", "Bilim dalı", ["Etnoarkeoloji"], ["Ethnoarchaeology"]),
    K("deneysel", "Bilim dalı", ["Deneysel arkeoloji"], ["Experimental archaeology"]),
    K("arkeoastronomi", "Bilim dalı", ["Arkeoastronomi"], ["Archaeoastronomy"]),
    K("konservasyon", "Bilim dalı", ["Konservasyon", "Restorasyon", "Arkeolojik koruma"], ["Conservation", "Archaeological conservation"]),
    K("kulturel_miras", "Bilim dalı", ["Kültürel miras", "Kültür mirası", "Miras yönetimi"], ["Cultural heritage", "Heritage management"]),
    K("muzecilik", "Bilim dalı", ["Müzecilik", "Müzeoloji"], ["Museology", "Museum studies"]),
    K("dijital_arkeoloji", "Bilim dalı", ["Dijital arkeoloji", "Hesaplamalı arkeoloji"], ["Digital archaeology", "Computational archaeology"]),
]

KAVRAM = {k.kimlik: k for k in TERIMLER}
GRUPLAR = ["Dönem", "Kültür-Endüstri", "Teknoloji", "Yöntem", "Bölge"]
VARSAYILAN_SECILI = [k.kimlik for k in TERIMLER if k.varsayilan]
BOLGE_ONCELIGI = "anadolu"   # bu kavram geçerse ek puan (Anadolu çalışan biri için)


def serbest_kavram(kelime: str) -> Kavram:
    """Kullanıcının serbest yazdığı kelime. Sözlükte bir varyanta denk geliyorsa o kavramı döndürür."""
    k = katla(kelime)
    for kav in TERIMLER:
        if k in kav.katli():
            return kav
    return Kavram("serbest:" + k, "Serbest", [kelime.strip()], [kelime.strip()])


def aktif_kavramlar(secili: list[str], serbest: list[str]) -> list[Kavram]:
    """Seçili sözlük kavramları + serbest kelimeler (tekrarsız)."""
    sonuc, gorulen = [], set()
    for kid in secili:
        if kid in KAVRAM and kid not in gorulen:
            sonuc.append(KAVRAM[kid])
            gorulen.add(kid)
    for s in serbest:
        if not s.strip():
            continue
        kav = serbest_kavram(s)
        if kav.kimlik not in gorulen:
            sonuc.append(kav)
            gorulen.add(kav.kimlik)
    return sonuc


def openalex_sorgusu(kav: Kavram) -> str:
    """OpenAlex boolean arama: "Upper Palaeolithic" OR "Üst Paleolitik" ..."""
    terimler = list(dict.fromkeys(kav.tr[:2] + kav.en[:2]))
    return " OR ".join(f'"{t}"' for t in terimler)


def haber_sorgusu(kav: Kavram, dil: str) -> str:
    liste = kav.tr if dil == "tr" else kav.en
    return " OR ".join(f'"{t}"' for t in liste[:2])
