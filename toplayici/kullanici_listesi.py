"""Arkix — yönetim paneli için kullanıcı listesi.

Firebase Auth'taki hesapları (hizmet hesabıyla, Identity Toolkit API) okur, profiller/{uid} ve unvanlar/{uid} ile
birleştirir ve yonetim/kullanicilar belgesine yazar. Belgeyi yalnız yönetici okur (mobil/firestore.rules › yonetim).
İş akışı: is-akisi-yonetici.yml (saatte bir). Elle: FIREBASE_HIZMET_HESABI='…' python toplayici/kullanici_listesi.py
"""
from __future__ import annotations

import datetime as dt
import json
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import eposta_ortak as E  # noqa: E402

AUTH = f"https://identitytoolkit.googleapis.com/v1/projects/{E.PROJE}/accounts:batchGet"
EN_FAZLA = 2500   # belge 1 MB sınırının altında kalsın (kayıt başına ~250 bayt)


def ms_iso(ms) -> str:
    try:
        return dt.datetime.fromtimestamp(int(ms) / 1000, dt.timezone.utc).replace(microsecond=0).isoformat()
    except (TypeError, ValueError):
        return ""


def hesaplar() -> list[dict]:
    l, sayfa = [], ""
    while True:
        url = AUTH + "?maxResults=500" + (f"&nextPageToken={urllib.parse.quote(sayfa)}" if sayfa else "")
        y = E._istek("GET", url)
        l += y.get("users", [])
        sayfa = y.get("nextPageToken", "")
        if not sayfa:
            return l


def main() -> int:
    E.ayar("FIREBASE_HIZMET_HESABI")
    profiller = {p["_id"]: p for p in E.sorgu("profiller", limit=5000)}
    unvanlar = {u["_id"]: u.get("unvan", "") for u in E.sorgu("unvanlar", limit=5000)}
    liste = []
    for h in hesaplar():
        uid = h.get("localId", "")
        p = profiller.get(uid) or {}
        saglayici = sorted({s.get("providerId", "") for s in h.get("providerUserInfo", [])} - {""})
        liste.append({
            "uid": uid, "eposta": h.get("email", ""), "dogrulandi": bool(h.get("emailVerified")),
            "ad": (p.get("ad") or h.get("displayName") or "")[:40], "avatar": p.get("avatar", ""),
            "unvan": unvanlar.get(uid) or p.get("unvan", ""),
            "giris": ",".join("google" if s == "google.com" else "eposta" if s == "password" else s for s in saglayici),
            "kayit": ms_iso(h.get("createdAt")), "son": ms_iso(h.get("lastLoginAt")) or h.get("lastRefreshAt", "")[:19],
            "kapali": bool(h.get("disabled")),
        })
    liste.sort(key=lambda k: k["son"] or k["kayit"], reverse=True)
    E.yaz("yonetim/kullanicilar", {"sayi": len(liste), "liste": liste[:EN_FAZLA],
                                    "guncelleme": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()})
    print(f"{len(liste)} kullanıcı yazıldı")
    return 0


if __name__ == "__main__":
    sys.exit(main())
