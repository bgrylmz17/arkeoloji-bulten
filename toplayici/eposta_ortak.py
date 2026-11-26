"""Arkix e-posta ve yönetici bildirimi ortak araçları (GitHub Actions'ta çalışır).

Gizli ayarlar (depo › Settings › Secrets and variables › Actions):
  FIREBASE_HIZMET_HESABI  Firebase hizmet hesabı JSON'u (Proje ayarları › Hizmet hesapları). Kuralları aşar; asla paylaşmayın.
  SMTP_SUNUCU, SMTP_PORT  ör. mail.guzel.net.tr, 465 (SSL)
  SMTP_KULLANICI          gönderen adres, ör. bulten@harrixapp.com
  SMTP_SIFRE              o adresin şifresi
  ABONELIK_ANAHTARI       ayrılma bağlantılarını imzalayan rastgele anahtar
  NTFY_KONU               (isteğe bağlı) yöneticiye telefon bildirimi için ntfy.sh konu adı
Biri eksikse betikler bir şey göndermeden çıkar.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import smtplib
import ssl
import time
import urllib.parse
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

PROJE = "harrix-bulten"
FS = f"https://firestore.googleapis.com/v1/projects/{PROJE}/databases/(default)/documents"
SITE = "https://arkix.harrixapp.com"


def ayar(ad: str, zorunlu: bool = True) -> str:
    v = os.environ.get(ad, "").strip()
    if zorunlu and not v:
        print(f"{ad} tanımlı değil; gönderim atlandı (gizli ayarlar girilince çalışır).")
        raise SystemExit(0)
    return v


# ---------------------------------------------------------------- Firestore (hizmet hesabı)
_jeton = {"deger": "", "bitis": 0}


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def erisim_jetonu() -> str:
    """Hizmet hesabıyla OAuth jetonu (JWT, RS256). google-auth kütüphanesi gerekir: pip install google-auth"""
    if _jeton["deger"] and time.time() < _jeton["bitis"] - 60:
        return _jeton["deger"]
    from google.oauth2 import service_account          # noqa: PLC0415
    import google.auth.transport.requests as gtr       # noqa: PLC0415
    bilgi = json.loads(ayar("FIREBASE_HIZMET_HESABI"))
    k = service_account.Credentials.from_service_account_info(bilgi, scopes=["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/firebase.messaging",
                                                                         "https://www.googleapis.com/auth/identitytoolkit"])
    k.refresh(gtr.Request())
    _jeton.update(deger=k.token, bitis=time.time() + 3000)
    return k.token


def _istek(yontem: str, url: str, govde: dict | None = None) -> dict:
    r = urllib.request.Request(url, method=yontem, data=json.dumps(govde).encode() if govde is not None else None,
                               headers={"Authorization": f"Bearer {erisim_jetonu()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=30) as y:
        t = y.read()
    return json.loads(t) if t else {}


def _deger(v: dict):
    if "stringValue" in v: return v["stringValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "timestampValue" in v: return v["timestampValue"]
    if "nullValue" in v: return None
    if "mapValue" in v: return {a: _deger(b) for a, b in v["mapValue"].get("fields", {}).items()}
    if "arrayValue" in v: return [_deger(x) for x in v["arrayValue"].get("values", [])]
    return None


def _fs_deger(x):
    if isinstance(x, bool): return {"booleanValue": x}
    if isinstance(x, int): return {"integerValue": str(x)}
    if isinstance(x, float): return {"doubleValue": x}
    if x is None: return {"nullValue": None}
    if isinstance(x, dict): return {"mapValue": {"fields": {a: _fs_deger(b) for a, b in x.items()}}}
    if isinstance(x, list): return {"arrayValue": {"values": [_fs_deger(b) for b in x]}}
    return {"stringValue": str(x)}


def belge(b: dict) -> dict:
    return {"_id": b["name"].rsplit("/", 1)[-1], "_yol": b["name"], **{a: _deger(v) for a, v in b.get("fields", {}).items()}}


def sorgu(koleksiyon: str, suzgec: dict | None = None, sirala: str = "", limit: int = 1000) -> list[dict]:
    q = {"from": [{"collectionId": koleksiyon}], "limit": limit}
    if suzgec: q["where"] = suzgec
    if sirala: q["orderBy"] = [{"field": {"fieldPath": sirala}, "direction": "DESCENDING"}]
    return [belge(s["document"]) for s in _istek("POST", FS + ":runQuery", {"structuredQuery": q}) if "document" in s]


def esit(alan: str, deger) -> dict:
    return {"fieldFilter": {"field": {"fieldPath": alan}, "op": "EQUAL", "value": _fs_deger(deger)}}


def buyuk(alan: str, zaman_iso: str) -> dict:
    return {"fieldFilter": {"field": {"fieldPath": alan}, "op": "GREATER_THAN", "value": {"timestampValue": zaman_iso}}}


def oku(yol: str) -> dict | None:
    try:
        return belge(_istek("GET", f"{FS}/{yol}"))
    except urllib.error.HTTPError as h:
        if h.code == 404:
            return None
        raise


def yaz(yol: str, alanlar: dict, yalniz: list[str] | None = None) -> None:
    """yalniz verilirse yalnız o alan yolları değişir (updateMask); ör. ['profil.eposta_izni.izin']"""
    maske = "".join(f"&updateMask.fieldPaths={urllib.parse.quote(a)}" for a in (yalniz or []))
    _istek("PATCH", f"{FS}/{yol}?{maske.lstrip('&')}" if maske else f"{FS}/{yol}", {"fields": {a: _fs_deger(b) for a, b in alanlar.items()}})


def sil(yol: str) -> None:
    _istek("DELETE", f"{FS}/{yol}")


# ---------------------------------------------------------------- ayrılma bağlantısı
def ayrilma_jetonu(uid: str) -> str:
    return hmac.new(ayar("ABONELIK_ANAHTARI").encode(), uid.encode(), hashlib.sha256).hexdigest()


def ayrilma_adresi(uid: str) -> str:
    return f"{SITE}/#ayril/{urllib.parse.quote(uid)}/{ayrilma_jetonu(uid)}"


def ayrilmalari_isle() -> int:
    """abonelik_iptal/{uid} {token}: imza doğruysa e-posta izni kapatılır, istek silinir."""
    n = 0
    for b in sorgu("abonelik_iptal"):
        uid = b["_id"]
        if hmac.compare_digest(str(b.get("token", "")), ayrilma_jetonu(uid)) and oku(f"kullanicilar/{uid}"):
            yaz(f"kullanicilar/{uid}", {"profil": {"eposta_izni": {"izin": False}}}, ["profil.eposta_izni.izin"])
            n += 1
        sil(f"abonelik_iptal/{uid}")
    return n


# ---------------------------------------------------------------- gönderim
def smtp_baglan() -> smtplib.SMTP_SSL:
    s = smtplib.SMTP_SSL(ayar("SMTP_SUNUCU"), int(ayar("SMTP_PORT", False) or 465), context=ssl.create_default_context(), timeout=30)
    s.login(ayar("SMTP_KULLANICI"), ayar("SMTP_SIFRE"))
    return s


def ileti(kime: str, konu: str, metin: str, html: str, ayril: str = "") -> EmailMessage:
    m = EmailMessage()
    gonderen = ayar("SMTP_KULLANICI")
    m["From"] = formataddr(("Arkix", gonderen))
    m["To"] = kime
    m["Subject"] = konu
    m["Message-ID"] = make_msgid(domain=gonderen.split("@")[-1])
    if ayril:
        m["List-Unsubscribe"] = f"<{ayril}>, <mailto:{gonderen}?subject=ayril>"
    m.set_content(metin)
    m.add_alternative(html, subtype="html")
    return m


def ntfy(baslik: str, metin: str, adres: str = "") -> None:
    """Yöneticiye telefon bildirimi (ntfy.sh; JSON ile, Türkçe karakter sorunsuz). NTFY_KONU yoksa atlanır."""
    konu = ayar("NTFY_KONU", False)
    if not konu:
        return
    govde = {"topic": konu, "title": baslik, "message": metin, "tags": ["bell"], **({"click": adres} if adres else {})}
    r = urllib.request.Request("https://ntfy.sh/", data=json.dumps(govde).encode(), method="POST", headers={"Content-Type": "application/json"})
    urllib.request.urlopen(r, timeout=15).read()
