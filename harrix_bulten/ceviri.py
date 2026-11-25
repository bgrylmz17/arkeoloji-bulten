"""Türkçe dışındaki başlık, özet ve sayfa metinlerini Türkçeye çevirir.

Servisler (sırayla denenir):
  1. Claude  — Ayarlar'da API anahtarı varsa ve 'Çeviride Claude'u kullan' açıksa. Arkeoloji
               terimlerini Türkçe literatürdeki karşılıklarıyla verir (en iyi akademik çeviri).
  2. Google  — anahtarsız, ücretsiz çeviri ucu (translate.googleapis.com).
  3. MyMemory— Google'a ulaşılamazsa yedek (günlük kotası düşüktür).
Çeviriler veritabanında saklanır; aynı özet ikinci kez çevrilmez.
"""
from __future__ import annotations
import json
import re
import urllib.parse

from . import kaynaklar
from .metin import html_temizle

CLAUDE_MODELI = "claude-haiku-5-5"
SERVIS_ADI = {"claude": "Claude", "google": "Google Çeviri", "mymemory": "MyMemory"}

# Google'ın bazen yanlış çevirdiği arkeoloji terimleri için düzeltmeler
_DUZELTME = [
    (r"\b[Üü]st Paleolitik\b", "Üst Paleolitik"), (r"\bYukarı Paleolitik", "Üst Paleolitik"),
    (r"\bAşağı Paleolitik", "Alt Paleolitik"), (r"\bEl ekseni\b", "El baltası"),
    (r"\bel ekseni", "el baltası"), (r"\bel eksenleri", "el baltaları"),
    (r"\bPre-Çömlek Neolitik", "Çanak Çömleksiz Neolitik"),
    (r"\bÇömlek Öncesi Neolitik", "Çanak Çömleksiz Neolitik"), (r"\bMousterian\b", "Musteryen"),
    (r"\bAcheulean\b", "Aşölyen"), (r"\bAurignacian\b", "Orinyasyen"), (r"\bNatufian\b", "Natufyen"),
]


def _duzelt(metin: str) -> str:
    for desen, yerine in _DUZELTME:
        metin = re.sub(desen, yerine, metin)
    return metin


def parcala(metin: str, sinir: int = 1500) -> list[str]:
    """Metni cümle sınırlarından, her biri 'sinir' karakteri geçmeyen parçalara böler."""
    cumleler = re.split(r"(?<=[.!?])\s+", metin.strip())
    parcalar, simdiki = [], ""
    for c in cumleler:
        while len(c) > sinir:            # tek cümle çok uzunsa zorla böl
            parcalar.append(c[:sinir])
            c = c[sinir:]
        if len(simdiki) + len(c) + 1 > sinir and simdiki:
            parcalar.append(simdiki)
            simdiki = c
        else:
            simdiki = f"{simdiki} {c}".strip()
    if simdiki:
        parcalar.append(simdiki)
    return parcalar


# ---------------------------------------------------------------- servisler
def google_cevir(metin: str, kaynak: str = "auto", hedef: str = "tr") -> str:
    sonuc = []
    for p in parcala(metin, 1500):
        url = ("https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode(
            {"client": "gtx", "sl": kaynak or "auto", "tl": hedef, "dt": "t", "q": p}))
        veri = json.loads(kaynaklar.indir(url, zaman_asimi=20)[0].decode("utf-8"))
        sonuc.append("".join(parca[0] for parca in veri[0] if parca and parca[0]))
    return _duzelt(" ".join(sonuc))


def mymemory_cevir(metin: str, kaynak: str = "en", hedef: str = "tr") -> str:
    sonuc = []
    for p in parcala(metin, 450):
        url = ("https://api.mymemory.translated.net/get?" + urllib.parse.urlencode(
            {"q": p, "langpair": f"{kaynak or 'en'}|{hedef}"}))
        veri = json.loads(kaynaklar.indir(url, zaman_asimi=20, api=True)[0].decode("utf-8"))
        cevrilen = (veri.get("responseData") or {}).get("translatedText") or ""
        if "MYMEMORY WARNING" in cevrilen.upper():
            raise RuntimeError("MyMemory günlük çeviri kotası doldu")
        sonuc.append(cevrilen)
    return _duzelt(html_temizle(" ".join(sonuc)))


def claude_cevir(metin: str, anahtar: str, hedef: str = "tr") -> str:
    istem = (
        "Translate the following archaeology text into fluent, academic English. Use the standard terms of the "
        "English-language literature (e.g. Üst Paleolitik → Upper Palaeolithic, Çanak Çömleksiz Neolitik → "
        "Pre-Pottery Neolithic, el baltası → handaxe, dilgi → blade, yonga → flake, höyük → mound). Do not translate "
        "place or personal names. Write only the translation, no comments. Keep any '[[' and ']]' markers exactly.\n\n" + metin
    ) if hedef == "en" else (
        "Aşağıdaki arkeoloji metnini akıcı, akademik Türkçeye çevir. Arkeoloji terimlerini Türkçe "
        "literatürdeki karşılıklarıyla ver (ör. Upper Palaeolithic → Üst Paleolitik, handaxe → el "
        "baltası, Pre-Pottery Neolithic → Çanak Çömleksiz Neolitik, flake → yonga, blade → dilgi, "
        "core → çekirdek, Mousterian → Musteryen). Yer ve kişi adlarını çevirme. Yalnızca çeviriyi "
        "yaz, açıklama ekleme. Metinde '[[' ve ']]' arasındaki ayraçlar varsa aynen koru.\n\n" + metin)
    govde = json.dumps({"model": CLAUDE_MODELI, "max_tokens": 4000,
                        "messages": [{"role": "user", "content": istem}]}).encode()
    yanit = kaynaklar.indir("https://api.anthropic.com/v1/messages", zaman_asimi=120, veri=govde,
                            api=True, basliklar={"x-api-key": anahtar, "anthropic-version": "2023-06-01",
                                                 "content-type": "application/json"})[0]
    veri = json.loads(yanit)
    return "".join(b.get("text", "") for b in veri.get("content", []) if b.get("type") == "text").strip()


def cevir(metin: str, kaynak_dil: str = "", ayar: dict | None = None, hedef: str = "tr") -> tuple[str, str]:
    """Metni hedef dile (varsayılan Türkçe; İngilizce arayüz için "en") çevirir. Dönüş: (çeviri, servis kodu). Hiçbiri olmazsa hata fırlatır."""
    metin = (metin or "").strip()
    if not metin:
        return "", ""
    ayar = ayar or {}
    hatalar = []
    if ayar.get("claude_anahtar") and ayar.get("ceviri_claude", True):
        try:
            return claude_cevir(metin, ayar["claude_anahtar"], hedef), "claude"
        except Exception as e:
            hatalar.append(f"Claude: {e}")
    try:
        return google_cevir(metin, kaynak_dil or "auto", hedef), "google"
    except Exception as e:
        hatalar.append(f"Google: {e}")
    try:
        return mymemory_cevir(metin, kaynak_dil or "en", hedef), "mymemory"
    except Exception as e:
        hatalar.append(f"MyMemory: {e}")
    raise RuntimeError("Çeviri yapılamadı — " + " | ".join(hatalar))


def kayit_cevir(baslik: str, ozet: str, kaynak_dil: str, ayar: dict, hedef: str = "tr") -> tuple[str, str, str]:
    """Başlık ve özeti tek istekte çevirir (ayraçla birleştirip sonra ayırır)."""
    if ozet:
        birlesik = f"{baslik}\n[[OZET]]\n{ozet}" if ayar.get("claude_anahtar") and ayar.get("ceviri_claude", True) \
            else None
        if birlesik:
            try:
                metin, servis = cevir(birlesik, kaynak_dil, ayar, hedef)
                if "[[OZET]]" in metin:
                    b, _, o = metin.partition("[[OZET]]")
                    return b.strip(), o.strip(), servis
            except Exception:
                pass
        b, servis = cevir(baslik, kaynak_dil, ayar, hedef)
        o, servis = cevir(ozet, kaynak_dil, ayar, hedef)
        return b, o, servis
    b, servis = cevir(baslik, kaynak_dil, ayar, hedef)
    return b, "", servis
