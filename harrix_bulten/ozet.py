"""'Arkeoloji camiası özeti': yerel istatistik özeti + isteğe bağlı Claude ile yazılı özet."""
from __future__ import annotations
import collections
import datetime as dt
import json
import urllib.request

from .metin import kelimeler

KAT_ADI = {"Makale": "makale", "Tez": "tez", "Haber": "haber", "Rapor": "kazı raporu/haberi"}


def yerel_ozet(depo, onceki_acilis: str) -> dict:
    """Son açılıştan beri gelenler + son 7 günün gündem kelimeleri."""
    yeni = depo.listele(sadece_yeni_sonrasi=onceki_acilis, limit=1000) if onceki_acilis else []
    hafta = (dt.datetime.now() - dt.timedelta(days=7)).isoformat()
    son7 = depo.listele(sadece_yeni_sonrasi=hafta, limit=1500)

    say = collections.Counter(r["kategori"] for r in yeni)
    sayac = collections.Counter()
    for r in son7:
        sayac.update(set(kelimeler(r["baslik"])))
    gundem = [k for k, n in sayac.most_common(15) if n >= 2][:10]

    onerilen = sorted(yeni or son7, key=lambda r: (r["puan"], r["tarih"]), reverse=True)[:8]
    return {"yeni_sayi": dict(say), "yeni_toplam": len(yeni), "gundem": gundem,
            "onerilen": onerilen, "son7_toplam": len(son7)}


def ozet_metni(o: dict) -> str:
    if o["yeni_toplam"]:
        parca = [f"{n} yeni {KAT_ADI.get(k, k)}" for k, n in sorted(o["yeni_sayi"].items())]
        s = "Son açılıştan bu yana: " + ", ".join(parca) + "."
    else:
        s = "Son açılıştan bu yana yeni kayıt yok (ya da henüz kontrol yapılmadı)."
    s += f"\nSon 7 günde toplam {o['son7_toplam']} kayıt toplandı."
    if o["gundem"]:
        s += "\nGündemdeki kelimeler: " + ", ".join(o["gundem"]) + "."
    return s


def claude_ozet(anahtar: str, kayitlar, model: str = "claude-haiku-5-5") -> str:
    """Claude API ile kısa, Türkçe bir 'camia bülteni' yazdırır (isteğe bağlı)."""
    satirlar = []
    for r in kayitlar[:40]:
        satirlar.append(f"- [{r['kategori']}] {r['baslik']} ({r['yayin_yeri'] or r['kaynak']}, "
                        f"{r['tarih']}) — {(r['ozet'] or '')[:300]}")
    istem = (
        "Sen bir arkeoloji bülteni editörüsün. Aşağıda son günlerde toplanan makale, tez, "
        "haber ve kazı raporu başlıkları var. Türkiye'deki bir prehistorya yüksek lisans "
        "öğrencisi ve kazı ekibi için Türkçe, en fazla 200 kelimelik bir 'arkeoloji camiası "
        "özeti' yaz: önce 2-3 cümlelik genel tablo, sonra öne çıkan 3-5 madde. Listede "
        "olmayan bir bilgi ekleme.\n\n" + "\n".join(satirlar)
    )
    govde = json.dumps({"model": model, "max_tokens": 900,
                        "messages": [{"role": "user", "content": istem}]}).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=govde, method="POST",
        headers={"x-api-key": anahtar, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"})
    from .kaynaklar import ssl_baglami
    with urllib.request.urlopen(req, timeout=90, context=ssl_baglami()) as r:
        veri = json.loads(r.read())
    return "".join(b.get("text", "") for b in veri.get("content", []) if b.get("type") == "text")


def kaynakca(r) -> str:
    """APA'ya yakın kısa kaynakça satırı."""
    yazar = (r["yazarlar"] or "").split("; ")
    yazar_s = ", ".join(y for y in yazar[:3] if y) + (" vd." if len(yazar) > 3 else "")
    yil = (r["tarih"] or "t.y.")[:4]
    s = f"{yazar_s + ' ' if yazar_s else ''}({yil}). {r['baslik']}."
    if r["yayin_yeri"]:
        s += f" {r['yayin_yeri']}."
    if r["doi"]:
        s += f" https://doi.org/{r['doi']}"
    elif r["url"]:
        s += f" {r['url']}"
    return s
