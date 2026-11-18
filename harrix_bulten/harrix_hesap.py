"""Harrix (Kazı Takip) hesabıyla giriş — isteğe bağlı.

Giriş yapılınca kazının adı, türü ve (yetki varsa) yeri öğrenilir; Bülten bunlarla
"Kazım" aramaları yapar ve kazıyla ilgili haberleri ayrı bir sekmede toplar.

Güvenlik: parola hiçbir yere yazılmaz. Yalnızca kazı sunucusunun verdiği oturum çerezi
(sunucunun kendi süresiyle) Bülten'in yerel veritabanında saklanır; "Çıkış" ile silinir.
Harrix Merkez'in içinde çalışırken giriş gerekmez: Merkez seçili kazının bilgisini verir.
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request

from .kaynaklar import ssl_baglami
from .terimler import Kavram

TUR_AD = {"acikalan": "Açık alan", "magara": "Mağara / kaya sığınağı", "hoyuk": "Höyük", "sualti": "Sualtı",
          "kent": "Antik kent", "nekropol": "Nekropol / tümülüs", "yuzey": "Yüzey araştırması"}
# kazı türüne göre haber aramasına eklenecek kelimeler
TUR_KELIME = {"magara": "mağara", "hoyuk": "höyük", "sualti": "batık", "kent": "antik kent",
              "nekropol": "nekropol", "yuzey": "yüzey araştırması", "acikalan": "kazı"}


class GirisHatasi(Exception):
    pass


def _istek(adres: str, yol: str, govde=None, cerez: str | None = None, sure: int = 15):
    adres = adres.rstrip("/")
    veri = json.dumps(govde).encode("utf-8") if govde is not None else None
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if cerez:
        h["Cookie"] = cerez
    r = urllib.request.Request(adres + yol, data=veri, headers=h, method="POST" if veri is not None else "GET")
    try:
        ac = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_baglami()))
        with ac.open(r, timeout=sure) as y:
            cerezler = y.headers.get_all("Set-Cookie") or []
            return json.loads(y.read().decode("utf-8") or "{}"), cerezler
    except urllib.error.HTTPError as e:
        try:
            m = json.loads(e.read().decode("utf-8")).get("hata")
        except Exception:
            m = None
        raise GirisHatasi(m or f"Sunucu hatası ({e.code})") from None
    except (urllib.error.URLError, OSError) as e:
        raise GirisHatasi(f"Kazı sunucusuna ulaşılamıyor ({getattr(e, 'reason', e)}). Adresi ve "
                          "sunucunun Harrix Merkez'de açık olduğunu kontrol edin.") from None


def adres_duzelt(adres: str) -> str:
    adres = (adres or "").strip().rstrip("/")
    if adres and not re.match(r"^https?://", adres):
        adres = "http://" + adres
    return adres


def _oturum_cerezi(cerezler: list[str]) -> str:
    for c in cerezler:
        ad, _, deger = c.split(";")[0].partition("=")
        if ad.strip().startswith("oturum_") and deger:
            return f"{ad.strip()}={deger}"
    return ""


def giris(adres: str, kadi: str, parola: str) -> dict:
    """Dönüş: {'ikiadim': True, 'gecici': ...} ya da oturum sözlüğü."""
    adres = adres_duzelt(adres)
    yanit, cerezler = _istek(adres, "/api/giris", {"kadi": kadi.strip().lower(), "parola": parola})
    if yanit.get("ikiadim"):
        return {"ikiadim": True, "gecici": yanit.get("gecici"), "adres": adres, "ad": yanit.get("ad", "")}
    return _oturum_kur(adres, yanit, cerezler)


def kod_dogrula(adres: str, gecici: str, kod: str) -> dict:
    adres = adres_duzelt(adres)
    yanit, cerezler = _istek(adres, "/api/giris/kod", {"gecici": gecici, "kod": kod.strip()})
    return _oturum_kur(adres, yanit, cerezler)


def _oturum_kur(adres, yanit, cerezler) -> dict:
    cerez = _oturum_cerezi(cerezler)
    if not cerez:
        raise GirisHatasi("Sunucu oturum açmadı.")
    ben = yanit.get("ben") or {}
    o = {"adres": adres, "cerez": cerez, "ad": ben.get("ad", ""), "kadi": ben.get("kadi", ""), "rol": ben.get("rol", "")}
    o.update(kazi_bilgisi(o))
    return o


def kazi_bilgisi(o: dict) -> dict:
    """Kazının adı, türü ve (yetki varsa) yer bilgisi."""
    bilgi = {}
    try:
        d, _ = _istek(o["adres"], "/api/durum", sure=10)
        bilgi.update(kaziAdi=d.get("kaziAdi", ""), kaziTuru=d.get("kaziTuru", ""))
    except GirisHatasi:
        pass
    if o.get("cerez"):
        try:
            y, _ = _istek(o["adres"], "/api/yonetim", cerez=o["cerez"], sure=15)
            a = y.get("ayar") or {}
            bilgi["kaziAdi"] = a.get("kaziAdi") or bilgi.get("kaziAdi", "")
            bilgi["kaziTuru"] = a.get("kaziTuru") or bilgi.get("kaziTuru", "")
            bilgi["sezon"] = str(a.get("sezon") or "")
            bilgi["yer"] = _yer_bul(a)
        except GirisHatasi:
            pass   # başkan/yardımcı değilse ayarlar okunamaz; ad ve tür yeterli
    return bilgi


def _yer_bul(a: dict) -> list[str]:
    """Ayarların içinde il/ilçe/köy gibi yer adlarını arar (alan adları kazıdan kazıya değişebilir)."""
    yer = []

    def gez(x, derinlik=0):
        if derinlik > 3:
            return
        if isinstance(x, dict):
            for k, v in x.items():
                if k.lower() in ("il", "ilce", "ilçe", "koy", "köy", "mahalle", "yer", "konum", "bolge") and \
                        isinstance(v, str) and 2 < len(v) < 40:
                    yer.append(v.strip())
                elif k.lower() in ("ilceler",) and isinstance(v, list):
                    yer.extend(s for s in v if isinstance(s, str))
                else:
                    gez(v, derinlik + 1)
        elif isinstance(x, list):
            for v in x[:20]:
                gez(v, derinlik + 1)
    gez(a)
    return list(dict.fromkeys(yer))[:4]


def cikis(o: dict):
    try:
        _istek(o["adres"], "/api/cikis", {}, cerez=o.get("cerez"), sure=8)
    except GirisHatasi:
        pass


# ------------------------------------------------------------------ Bülten'e etkisi
def kazim_kavrami(kazi: dict | None) -> Kavram | None:
    """'Kazım' araması: kazının adı (ve varsa yeri) — sonuçlar 'kazim' etiketiyle Kazım sekmesine düşer."""
    if not kazi or not (kazi.get("kaziAdi") or "").strip():
        return None
    ad = kazi["kaziAdi"].strip()
    tr = [ad] + [f"{ad} {TUR_KELIME[kazi['kaziTuru']]}"] if kazi.get("kaziTuru") in TUR_KELIME else [ad]
    return Kavram("kazim", "Kazım", tr, [ad])


def kazim_haber_sorgulari(kazi: dict | None) -> list[tuple[str, str]]:
    if not kazi or not kazi.get("kaziAdi"):
        return []
    ad = kazi["kaziAdi"].strip()
    sorgular = [(f'"{ad}" (kazı OR kazısı OR arkeoloji OR arkeolojik OR höyük OR mağara)', "tr")]
    for yer in (kazi.get("yer") or [])[:2]:
        sorgular.append((f'"{yer}" (kazı OR arkeolojik OR arkeoloji) "{ad}"', "tr"))
    sorgular.append((f'"{ad}" (excavation OR archaeology OR archaeological)', "en"))
    return sorgular


def ozet_metni(kazi: dict | None, oturum: dict | None = None) -> str:
    if not kazi or not kazi.get("kaziAdi"):
        return "Harrix hesabı bağlı değil."
    parca = [kazi["kaziAdi"]]
    if kazi.get("kaziTuru"):
        parca.append(TUR_AD.get(kazi["kaziTuru"], kazi["kaziTuru"]))
    if kazi.get("yer"):
        parca.append(", ".join(kazi["yer"]))
    if kazi.get("sezon"):
        parca.append(f"{kazi['sezon']} sezonu")
    kim = f" · {oturum['ad']}" if oturum and oturum.get("ad") else ""
    return " · ".join(parca) + kim
