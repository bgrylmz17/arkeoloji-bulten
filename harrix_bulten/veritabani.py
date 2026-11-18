"""SQLite tabanlı yerel depo: bulunan kayıtlar, okundu/favori bilgisi ve ayarlar."""
from __future__ import annotations
import datetime as dt
import json
import os
import sqlite3
import threading

SEMA = """
CREATE TABLE IF NOT EXISTS kayitlar (
    id          TEXT PRIMARY KEY,
    kategori    TEXT,      -- Makale / Tez / Haber / Rapor
    kaynak      TEXT,      -- OpenAlex, Crossref, Arkeofili, Google Haberler...
    baslik      TEXT,
    yazarlar    TEXT,
    yayin_yeri  TEXT,      -- dergi / haber sitesi / üniversite
    tarih       TEXT,      -- YYYY-MM-DD
    url         TEXT,
    doi         TEXT,
    ozet        TEXT,
    eslesen     TEXT,      -- eşleşen anahtar kelimeler (virgüllü)
    puan        INTEGER DEFAULT 0,
    ilk_gorulme TEXT,
    okundu      INTEGER DEFAULT 0,
    favori      INTEGER DEFAULT 0,
    etiketler   TEXT DEFAULT '',   -- ",ust_paleolitik,anadolu," biçiminde kavram kimlikleri
    pdf_url     TEXT DEFAULT '',
    pdf_yol     TEXT DEFAULT '',   -- indirilmiş PDF'in diskteki yeri
    icerik      TEXT DEFAULT '',   -- RSS'ten gelen tam metin (okuyucu için)
    dil         TEXT DEFAULT '',   -- tr / en / de / fr / ... (boş: bilinmiyor)
    baslik_tr   TEXT DEFAULT '',   -- Türkçe çeviriler (Çevir düğmesiyle)
    ozet_tr     TEXT DEFAULT '',
    ceviri_servis TEXT DEFAULT '',
    gercek_url  TEXT DEFAULT '',   -- Google Haberler bağlantısının çözülmüş hâli (hızlı açılış için)
    kaynakcada  INTEGER DEFAULT 0, -- Kaynakçam'a eklendi mi
    kunye       TEXT DEFAULT ''    -- JSON: ayrıntılı künye (yazarlar, cilt, sayı, sayfa, yayınevi...)
);
CREATE TABLE IF NOT EXISTS konu (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ad TEXT NOT NULL, aciklama TEXT DEFAULT '',
    olusturma TEXT, sira INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS konu_kayit (
    konu_id INTEGER, kayit_id TEXT, eklenme TEXT, PRIMARY KEY (konu_id, kayit_id)
);
CREATE TABLE IF NOT EXISTS not_ (
    id INTEGER PRIMARY KEY AUTOINCREMENT, kayit_id TEXT, konu_id INTEGER,
    metin TEXT DEFAULT '', guncelleme TEXT
);
CREATE INDEX IF NOT EXISTS ix_not_kayit ON not_(kayit_id);
CREATE INDEX IF NOT EXISTS ix_kat ON kayitlar(kategori);
CREATE INDEX IF NOT EXISTS ix_tarih ON kayitlar(tarih);
CREATE TABLE IF NOT EXISTS ayarlar (anahtar TEXT PRIMARY KEY, deger TEXT);
CREATE TABLE IF NOT EXISTS kontroller (
    zaman TEXT, yeni INTEGER, hatalar TEXT
);
"""


def veri_klasoru() -> str:
    yol = os.path.join(os.path.expanduser("~"), ".harrix_arkeoloji")
    os.makedirs(yol, exist_ok=True)
    return yol


class Depo:
    def __init__(self, yol: str | None = None):
        self.yol = yol or os.path.join(veri_klasoru(), "veri.db")
        self._kilit = threading.Lock()
        with self._bag() as c:
            c.executescript(SEMA)
            # 1. sürüm veritabanını yükselt
            var = {r["name"] for r in c.execute("PRAGMA table_info(kayitlar)")}
            for kol in ("etiketler", "pdf_url", "pdf_yol", "icerik", "dil", "baslik_tr", "ozet_tr",
                        "ceviri_servis", "gercek_url", "kunye", "kaynakcada"):
                if kol not in var:
                    tip = "INTEGER DEFAULT 0" if kol == "kaynakcada" else "TEXT DEFAULT ''"
                    c.execute(f"ALTER TABLE kayitlar ADD COLUMN {kol} {tip}")
                    if kol == "dil":
                        self._dilleri_doldur(c)

    def _bag(self):
        c = sqlite3.connect(self.yol, timeout=30)
        c.row_factory = sqlite3.Row
        return c

    @staticmethod
    def _dilleri_doldur(c):
        """Eski sürümden gelen kayıtlara dil tahmini yaz."""
        from .metin import dil_tahmin
        satirlar = c.execute("SELECT id, baslik, ozet, kaynak, url FROM kayitlar").fetchall()
        for r in satirlar:
            d = dil_tahmin(r["baslik"] or "", r["ozet"] or "")
            if not d and r["kaynak"] == "Arkeofili":
                d = "tr"
            elif not d and "hl=en" in (r["url"] or ""):
                d = "en"
            c.execute("UPDATE kayitlar SET dil=? WHERE id=?", (d, r["id"]))

    # ---------- kayıtlar ----------
    def kaydet(self, kayitlar: list[dict]) -> list[dict]:
        """Yeni olanları ekler, var olanların puanını günceller. Yeni eklenenleri döndürür."""
        simdi = dt.datetime.now().isoformat(timespec="seconds")
        yeniler = []
        with self._kilit, self._bag() as c:
            for k in kayitlar:
                var = c.execute("SELECT puan FROM kayitlar WHERE id=?", (k["id"],)).fetchone()
                if var:
                    if k.get("puan", 0) >= var["puan"]:
                        c.execute("UPDATE kayitlar SET puan=?, eslesen=?, etiketler=? WHERE id=?",
                                  (k["puan"], k.get("eslesen", ""), k.get("etiketler", ""), k["id"]))
                    if k.get("pdf_url"):
                        c.execute("UPDATE kayitlar SET pdf_url=? WHERE id=? AND pdf_url=''",
                                  (k["pdf_url"], k["id"]))
                    continue
                c.execute(
                    """INSERT INTO kayitlar (id,kategori,kaynak,baslik,yazarlar,yayin_yeri,tarih,
                       url,doi,ozet,eslesen,puan,ilk_gorulme,etiketler,pdf_url,icerik,dil)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (k["id"], k["kategori"], k["kaynak"], k["baslik"], k.get("yazarlar", ""),
                     k.get("yayin_yeri", ""), k.get("tarih", ""), k.get("url", ""), k.get("doi", ""),
                     k.get("ozet", ""), k.get("eslesen", ""), k.get("puan", 0), simdi,
                     k.get("etiketler", ""), k.get("pdf_url", ""), k.get("icerik", ""), k.get("dil", "")),
                )
                yeniler.append(k)
        return yeniler

    def listele(self, kategori=None, favori=False, arama="", sadece_yeni_sonrasi=None,
                min_puan=0, limit=600, etiket=None, sadece_pdf=False, dil=None, konu=None,
                kaynakca=False, literatur=None) -> list[sqlite3.Row]:
        q, p = "SELECT * FROM kayitlar WHERE 1=1", []
        # Literatür aramasıyla gelen eski yayınlar bülten listelerine karışmasın;
        # kişinin kendi seçtikleri (favori, konu, kaynakça, PDF) her yerde görünür.
        if literatur is None:
            literatur = bool(favori or konu or kaynakca or sadece_pdf or etiket == "literatur")
        if not literatur:
            q += " AND etiketler NOT LIKE '%,literatur,%'"
        if konu:
            q += " AND id IN (SELECT kayit_id FROM konu_kayit WHERE konu_id=?)"
            p.append(konu)
        if kaynakca:
            q += " AND kaynakcada=1"
        if dil == "diger":
            q += " AND dil NOT IN ('tr','en','de','fr')"
        elif dil:
            q += " AND dil=?"
            p.append(dil)
        if etiket:
            q += " AND etiketler LIKE ?"
            p.append(f"%,{etiket},%")
        if sadece_pdf:
            q += " AND pdf_yol<>''"
        if kategori:
            q += " AND kategori=?"
            p.append(kategori)
        if favori:
            q += " AND favori=1"
        if sadece_yeni_sonrasi:
            q += " AND ilk_gorulme>=?"
            p.append(sadece_yeni_sonrasi)
        if min_puan:
            q += " AND puan>=?"
            p.append(min_puan)
        if arama:
            q += (" AND (baslik LIKE ? OR ozet LIKE ? OR yazarlar LIKE ? OR yayin_yeri LIKE ?"
                  " OR baslik_tr LIKE ? OR ozet_tr LIKE ?)")
            p += [f"%{arama}%"] * 6
        q += " ORDER BY tarih DESC, puan DESC LIMIT ?"
        p.append(limit)
        with self._bag() as c:
            return c.execute(q, p).fetchall()

    def literatur_kaydet(self, kayitlar: list[dict]) -> None:
        """Literatür arama sonuçlarını saklar. Yalnız yeni kayıtlar eklenir ve 'literatur'
        etiketi alır; bültende zaten olan kayıtlara dokunulmaz."""
        simdi = dt.datetime.now().isoformat(timespec="seconds")
        with self._kilit, self._bag() as c:
            for k in kayitlar:
                if c.execute("SELECT 1 FROM kayitlar WHERE id=?", (k["id"],)).fetchone():
                    if k.get("pdf_url"):
                        c.execute("UPDATE kayitlar SET pdf_url=? WHERE id=? AND pdf_url=''",
                                  (k["pdf_url"], k["id"]))
                    continue
                et = (k.get("etiketler") or ",").rstrip(",") + ",literatur,"
                if not et.startswith(","):
                    et = "," + et
                c.execute(
                    """INSERT INTO kayitlar (id,kategori,kaynak,baslik,yazarlar,yayin_yeri,tarih,
                       url,doi,ozet,eslesen,puan,ilk_gorulme,etiketler,pdf_url,icerik,dil,okundu)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)""",
                    (k["id"], k["kategori"], k["kaynak"], k["baslik"], k.get("yazarlar", ""),
                     k.get("yayin_yeri", ""), k.get("tarih", ""), k.get("url", ""), k.get("doi", ""),
                     k.get("ozet", ""), k.get("eslesen", ""), k.get("puan", 0), simdi,
                     et, k.get("pdf_url", ""), k.get("icerik", ""), k.get("dil", "")),
                )

    def getir_cok(self, idler: list[str]) -> list[sqlite3.Row]:
        """Verilen kimlikleri verilen sırayla döndürür."""
        if not idler:
            return []
        with self._bag() as c:
            satir = {r["id"]: r for r in c.execute(
                f"SELECT * FROM kayitlar WHERE id IN ({','.join('?' * len(idler))})", idler)}
        return [satir[i] for i in idler if i in satir]

    def getir(self, kid: str):
        with self._bag() as c:
            return c.execute("SELECT * FROM kayitlar WHERE id=?", (kid,)).fetchone()

    def isaretle(self, kid: str, okundu=None, favori=None):
        with self._kilit, self._bag() as c:
            if okundu is not None:
                c.execute("UPDATE kayitlar SET okundu=? WHERE id=?", (int(okundu), kid))
            if favori is not None:
                c.execute("UPDATE kayitlar SET favori=? WHERE id=?", (int(favori), kid))

    def pdf_kaydet(self, kid: str, yol: str, url: str = ""):
        with self._kilit, self._bag() as c:
            c.execute("UPDATE kayitlar SET pdf_yol=?, pdf_url=CASE WHEN ?<>'' THEN ? ELSE pdf_url END "
                      "WHERE id=?", (yol, url, url, kid))

    # ---------- konular ----------
    def konular(self):
        with self._bag() as c:
            return c.execute("""SELECT k.*, (SELECT COUNT(*) FROM konu_kayit kk WHERE kk.konu_id=k.id) AS sayi
                                FROM konu k ORDER BY k.sira, k.ad COLLATE NOCASE""").fetchall()

    def konu_ekle(self, ad: str, aciklama: str = "") -> int:
        with self._kilit, self._bag() as c:
            return c.execute("INSERT INTO konu (ad, aciklama, olusturma) VALUES (?,?,?)",
                             (ad.strip(), aciklama, dt.datetime.now().isoformat(timespec="seconds"))).lastrowid

    def konu_guncelle(self, kid: int, ad: str | None = None, aciklama: str | None = None):
        with self._kilit, self._bag() as c:
            if ad is not None:
                c.execute("UPDATE konu SET ad=? WHERE id=?", (ad.strip(), kid))
            if aciklama is not None:
                c.execute("UPDATE konu SET aciklama=? WHERE id=?", (aciklama, kid))

    def konu_sil(self, kid: int):
        with self._kilit, self._bag() as c:
            c.execute("DELETE FROM konu_kayit WHERE konu_id=?", (kid,))
            c.execute("DELETE FROM not_ WHERE konu_id=?", (kid,))
            c.execute("DELETE FROM konu WHERE id=?", (kid,))

    def konuya_ekle(self, konu_id: int, kayit_id: str):
        with self._kilit, self._bag() as c:
            c.execute("INSERT OR IGNORE INTO konu_kayit VALUES (?,?,?)",
                      (konu_id, kayit_id, dt.datetime.now().isoformat(timespec="seconds")))

    def konudan_cikar(self, konu_id: int, kayit_id: str):
        with self._kilit, self._bag() as c:
            c.execute("DELETE FROM konu_kayit WHERE konu_id=? AND kayit_id=?", (konu_id, kayit_id))

    def kaydin_konulari(self, kayit_id: str):
        with self._bag() as c:
            return c.execute("SELECT k.* FROM konu k JOIN konu_kayit kk ON kk.konu_id=k.id "
                             "WHERE kk.kayit_id=? ORDER BY k.ad", (kayit_id,)).fetchall()

    # ---------- notlar ----------
    def not_oku(self, kayit_id: str | None = None, konu_id: int | None = None) -> str:
        with self._bag() as c:
            if kayit_id:
                r = c.execute("SELECT metin FROM not_ WHERE kayit_id=? AND konu_id IS NULL", (kayit_id,)).fetchone()
            else:
                r = c.execute("SELECT metin FROM not_ WHERE konu_id=? AND kayit_id IS NULL", (konu_id,)).fetchone()
        return r["metin"] if r else ""

    def not_yaz(self, metin: str, kayit_id: str | None = None, konu_id: int | None = None):
        simdi = dt.datetime.now().isoformat(timespec="seconds")
        with self._kilit, self._bag() as c:
            if kayit_id:
                c.execute("DELETE FROM not_ WHERE kayit_id=? AND konu_id IS NULL", (kayit_id,))
                if metin.strip():
                    c.execute("INSERT INTO not_ (kayit_id, metin, guncelleme) VALUES (?,?,?)", (kayit_id, metin, simdi))
            else:
                c.execute("DELETE FROM not_ WHERE konu_id=? AND kayit_id IS NULL", (konu_id,))
                if metin.strip():
                    c.execute("INSERT INTO not_ (konu_id, metin, guncelleme) VALUES (?,?,?)", (konu_id, metin, simdi))

    def notlu_kayitlar(self) -> set:
        with self._bag() as c:
            return {r[0] for r in c.execute("SELECT kayit_id FROM not_ WHERE kayit_id IS NOT NULL")}

    # ---------- kaynakça ----------
    def kaynakca_isaretle(self, kid: str, var: bool = True, kunye: dict | None = None):
        with self._kilit, self._bag() as c:
            c.execute("UPDATE kayitlar SET kaynakcada=? WHERE id=?", (int(var), kid))
            if kunye is not None:
                c.execute("UPDATE kayitlar SET kunye=? WHERE id=?", (json.dumps(kunye, ensure_ascii=False), kid))

    def kunye_yaz(self, kid: str, kunye: dict):
        with self._kilit, self._bag() as c:
            c.execute("UPDATE kayitlar SET kunye=? WHERE id=?", (json.dumps(kunye, ensure_ascii=False), kid))

    def gercek_url_yaz(self, kid: str, url: str):
        with self._kilit, self._bag() as c:
            c.execute("UPDATE kayitlar SET gercek_url=? WHERE id=?", (url, kid))

    def cozulecek_google(self, limit: int = 60):
        with self._bag() as c:
            return c.execute("SELECT id, url FROM kayitlar WHERE kaynak='Google Haberler' AND gercek_url='' "
                             "ORDER BY ilk_gorulme DESC LIMIT ?", (limit,)).fetchall()

    def degisim_imi(self) -> tuple:
        """Başka bir pencerenin (ör. uygulama penceresinden 'Harrix'e ekle') yaptığı değişikliği fark etmek için."""
        with self._bag() as c:
            r = c.execute("SELECT COUNT(*), MAX(ilk_gorulme), SUM(kaynakcada) FROM kayitlar").fetchone()
            k = c.execute("SELECT COUNT(*) FROM konu_kayit").fetchone()
        return tuple(r) + tuple(k)

    def ceviri_kaydet(self, kid: str, baslik_tr: str, ozet_tr: str, servis: str):
        with self._kilit, self._bag() as c:
            c.execute("UPDATE kayitlar SET baslik_tr=?, ozet_tr=?, ceviri_servis=? WHERE id=?",
                      (baslik_tr, ozet_tr, servis, kid))

    def tumunu_okundu(self, kategori=None):
        with self._kilit, self._bag() as c:
            if kategori:
                c.execute("UPDATE kayitlar SET okundu=1 WHERE kategori=?", (kategori,))
            else:
                c.execute("UPDATE kayitlar SET okundu=1")

    def sayilar(self, sonrasi: str | None = None) -> dict:
        q = "SELECT kategori, COUNT(*) n, SUM(okundu=0) okunmamis FROM kayitlar"
        q += " WHERE etiketler NOT LIKE '%,literatur,%'"
        p = []
        if sonrasi:
            q += " AND ilk_gorulme>=?"
            p.append(sonrasi)
        q += " GROUP BY kategori"
        with self._bag() as c:
            return {r["kategori"]: (r["n"], r["okunmamis"] or 0) for r in c.execute(q, p)}

    def dil_sayilari(self, sonrasi: str | None = None) -> dict:
        q, p = "SELECT dil, COUNT(*) n FROM kayitlar WHERE etiketler NOT LIKE '%,literatur,%'", []
        if sonrasi:
            q += " AND ilk_gorulme>=?"
            p.append(sonrasi)
        with self._bag() as c:
            return {r["dil"] or "": r["n"] for r in c.execute(q + " GROUP BY dil", p)}

    def eski_temizle(self, gun: int = 365):
        """Favori olmayan, çok eski kayıtları siler (veritabanı şişmesin)."""
        sinir = (dt.datetime.now() - dt.timedelta(days=gun)).isoformat()
        with self._kilit, self._bag() as c:
            c.execute("DELETE FROM kayitlar WHERE favori=0 AND pdf_yol='' AND kaynakcada=0 AND ilk_gorulme<? "
                      "AND id NOT IN (SELECT kayit_id FROM konu_kayit) "
                      "AND id NOT IN (SELECT kayit_id FROM not_ WHERE kayit_id IS NOT NULL)", (sinir,))

    def haber_temizle(self) -> int:
        """Arkeolojiyle ilgisi olmayan eski Google Haberler kayıtlarını siler (favoriler hariç)."""
        from .metin import arkeoloji_mi
        with self._bag() as c:
            satirlar = c.execute("SELECT id, baslik, ozet FROM kayitlar WHERE kaynak='Google Haberler' "
                                 "AND favori=0").fetchall()
        sil = [r["id"] for r in satirlar if not arkeoloji_mi(r["baslik"] or "", r["ozet"] or "")]
        with self._kilit, self._bag() as c:
            c.executemany("DELETE FROM kayitlar WHERE id=?", [(i,) for i in sil])
        return len(sil)

    # ---------- ayarlar ----------
    def ayar(self, anahtar: str, varsayilan=None):
        with self._bag() as c:
            r = c.execute("SELECT deger FROM ayarlar WHERE anahtar=?", (anahtar,)).fetchone()
        return json.loads(r["deger"]) if r else varsayilan

    def ayar_yaz(self, anahtar: str, deger):
        with self._kilit, self._bag() as c:
            c.execute("INSERT OR REPLACE INTO ayarlar VALUES (?,?)",
                      (anahtar, json.dumps(deger, ensure_ascii=False)))

    # ---------- kontrol geçmişi ----------
    def kontrol_kaydet(self, yeni: int, hatalar: list[str]):
        with self._kilit, self._bag() as c:
            c.execute("INSERT INTO kontroller VALUES (?,?,?)",
                      (dt.datetime.now().isoformat(timespec="seconds"), yeni,
                       json.dumps(hatalar, ensure_ascii=False)))

    def son_kontrol(self):
        with self._bag() as c:
            return c.execute("SELECT * FROM kontroller ORDER BY zaman DESC LIMIT 1").fetchone()
