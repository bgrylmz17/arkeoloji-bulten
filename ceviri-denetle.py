"""Web sürümü (docs/) çeviri denetimi: tx("…") anahtarlarından docs/dil-en.js'de karşılığı olmayanları listeler.
Kullanım: python3 ceviri-denetle.py [--json]   (eksik varsa çıkış kodu 1)"""
import json, re, sys
from pathlib import Path

KOK = Path(__file__).resolve().parent / "docs"
DINAMIK = ["Haber", "Makale", "Tez", "Rapor", "Kitap",               # turAdi(r.k)
           "{n} haber", "{n} yeni makale", "{n} tez", "{n} rapor",   # sabahOzeti parçaları
           "Son 48 saatte arkeoloji gündeminde {liste} öne çıktı.", "Dün arkeoloji gündeminde {liste} öne çıktı.",
           "Bugün", "Yayınlar", "Kitaplık", "Ayarlar", "Geri", "Ara", "Bölümler"]  # statikCevir
anahtar = set(DINAMIK)
for f in ("uygulama.js", "hesap.js"):
    for m in re.finditer(r'(?<![\w.])tx\(("(?:\\.|[^"\\])*")', (KOK / f).read_text(encoding="utf-8")):
        anahtar.add(json.loads(m.group(1)))
en_metin = (KOK / "dil-en.js").read_text(encoding="utf-8")
en = json.loads(en_metin[en_metin.index("{"):en_metin.rindex("}") + 1]) if "{" in en_metin else {}
eksik = sorted(a for a in anahtar if a not in en)
fazla = sorted(a for a in en if a not in anahtar)
if "--json" in sys.argv:
    print(json.dumps(eksik, ensure_ascii=False, indent=1))
else:
    print(f"{len(anahtar)} anahtar, {len(eksik)} eksik, {len(fazla)} kullanılmayan")
    for a in eksik: print("  eksik:", a)
    for a in fazla: print("  kullanılmayan:", a)
sys.exit(1 if eksik else 0)
