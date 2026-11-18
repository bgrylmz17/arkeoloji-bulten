"""Bundle'ın beslendiği yayıncılar ve arkeoloji siteleri — doğrudan RSS akışları.

Bundle kendi haberini üretmez; yayıncıların RSS akışlarını toplar. Burada aynı yayıncıların
akışlarını doğrudan okuyoruz (Bundle web sitesinde Kasım 2026'da görülen kaynaklar + bilinen
arkeoloji siteleri).

mod:
  "arkeo" -> tamamen arkeoloji/tarih sitesi: her yazı alınır
  "genel" -> genel haber sitesi: yalnızca arkeoloji bağlamı olan haberler alınır
             (arkeoloji, arkeolojik, höyük, kazı heyeti, antik kent, excavation… — metin.arkeoloji_mi)

Doğrulama (18 Kasım 2026, tarayıcıdan): Arkeofili, ScienceDaily, Phys.org, Live Science, Smithsonian,
Archaeology Magazine, TRT Haber, Hürriyet, Milliyet, Sabah, NTV, CNN Türk, Habertürk, Cumhuriyet, Sözcü,
Euronews akışları çalışıyor. Arkeonews ve HeritageDaily bot korumalı olabilir; onlar ve Arkeolojik Haber
(akışı yok) ayrıca Google Haberler site sorgusuyla taranır.

Bir akış kapanır ya da adres değişirse toplayıcı onu atlar ve kaynak_durumu'na hata olarak yazar;
diğerleri etkilenmez.
"""
from __future__ import annotations

# (ad, adres, mod, dil)
AKISLAR = [
    # --- doğrudan arkeoloji / tarih
    ("Arkeofili", "https://arkeofili.com/feed/", "arkeo", "tr"),
    ("Arkeonews", "https://arkeonews.net/feed/", "arkeo", "en"),
    ("HeritageDaily", "https://www.heritagedaily.com/feed", "arkeo", "en"),
    ("ScienceDaily Arkeoloji", "https://www.sciencedaily.com/rss/fossils_ruins/archaeology.xml", "arkeo", "en"),
    ("Phys.org Arkeoloji", "https://phys.org/rss-feed/science-news/archaeology/", "arkeo", "en"),
    ("Live Science", "https://www.livescience.com/feeds.xml", "genel", "en"),
    ("Smithsonian", "https://www.smithsonianmag.com/rss/latest_articles/", "genel", "en"),
    ("Archaeology Magazine", "https://archaeology.org/feed/", "arkeo", "en"),
    ("The Conversation", "https://theconversation.com/global/articles.atom", "genel", "en"),
    # --- Bundle'daki Türkçe yayıncılar (arkeoloji haberleri süzülür)
    ("TRT Haber Kültür-Sanat", "https://www.trthaber.com/kultur_sanat_articles.rss", "genel", "tr"),
    ("TRT Haber Bilim", "https://www.trthaber.com/bilim_teknoloji_articles.rss", "genel", "tr"),
    ("Anadolu Ajansı Kültür", "https://www.aa.com.tr/tr/rss/default?cat=kultur-sanat", "genel", "tr"),
    ("Anadolu Ajansı Güncel", "https://www.aa.com.tr/tr/rss/default?cat=guncel", "genel", "tr"),
    ("Hürriyet", "https://www.hurriyet.com.tr/rss/anasayfa", "genel", "tr"),
    ("Milliyet", "https://www.milliyet.com.tr/rss/rssnew/gundemrss.xml", "genel", "tr"),
    ("Sabah", "https://www.sabah.com.tr/rss/gundem.xml", "genel", "tr"),
    ("NTV", "https://www.ntv.com.tr/turkiye.rss", "genel", "tr"),
    ("CNN Türk", "https://www.cnnturk.com/feed/rss/all/news", "genel", "tr"),
    ("Habertürk", "https://www.haberturk.com/rss", "genel", "tr"),
    ("Cumhuriyet", "https://www.cumhuriyet.com.tr/rss/son_dakika.xml", "genel", "tr"),
    ("Sözcü", "https://www.sozcu.com.tr/feeds-rss-category-sozcu", "genel", "tr"),
    ("BBC Türkçe", "https://feeds.bbci.co.uk/turkce/rss.xml", "genel", "tr"),
    ("DW Türkçe", "https://rss.dw.com/rdf/rss-tur-all", "genel", "tr"),
    ("Euronews Türkçe", "https://tr.euronews.com/rss", "genel", "tr"),
    ("Independent Türkçe", "https://www.indyturk.com/rss.xml", "genel", "tr"),
    ("Sputnik Türkiye", "https://anlatilaninotesi.com.tr/export/rss2/archive/index.xml", "genel", "tr"),
    ("T24", "https://t24.com.tr/rss", "genel", "tr"),
    ("Gazete Oksijen", "https://gazeteoksijen.com/rss", "genel", "tr"),
    ("Notbir", "https://notbir.com.tr/rss", "genel", "tr"),
    ("GZT", "https://www.gzt.com/rss", "genel", "tr"),
    ("Haberler.com", "https://rss.haberler.com/rss.asp", "genel", "tr"),
    ("Dünya", "https://www.dunya.com/rss", "genel", "tr"),
    ("Yeni Şafak", "https://www.yenisafak.com/rss", "genel", "tr"),
    ("İHA", "https://www.iha.com.tr/rss", "genel", "tr"),
    ("Evrim Ağacı", "https://evrimagaci.org/rss.xml", "genel", "tr"),
    ("Bant Mag", "https://bantmag.com/feed/", "genel", "tr"),
    ("Ekşi Şeyler", "https://eksiseyler.com/rss", "genel", "tr"),
    # --- Türkiye'den İngilizce yayınlar (Anadolu kazıları sık geçer)
    ("Türkiye Today", "https://www.turkiyetoday.com/feed", "genel", "en"),
    ("Hürriyet Daily News", "https://www.hurriyetdailynews.com/rss", "genel", "en"),
    ("Daily Sabah", "https://www.dailysabah.com/rss/arts", "genel", "en"),
]

# Akışı olmayan ya da akışı kapanan yayıncılara Google Haberler üzerinden ulaşılır:
# her grup tek sorgu; yalnızca o sitelerin arkeoloji haberleri gelir.
SITE_GRUPLARI = [
    ["ntv.com.tr", "hurriyet.com.tr", "milliyet.com.tr", "sabah.com.tr", "sozcu.com.tr"],
    ["cnnturk.com", "haberturk.com", "cumhuriyet.com.tr", "trthaber.com", "aa.com.tr"],
    ["bbc.com/turkce", "dw.com/tr", "tr.euronews.com", "indyturk.com", "t24.com.tr"],
    ["gazeteoksijen.com", "notbir.com.tr", "nationalgeographic.com.tr", "atlasdergisi.com", "arkeofili.com"],
    ["dha.com.tr", "iha.com.tr", "haberler.com", "gzt.com", "yenisafak.com"],
    ["arkeolojikhaber.com", "arkeonews.net", "heritagedaily.com", "turkiyetoday.com", "dailysabah.com"],
]
SITE_SORGUSU = "(arkeoloji OR arkeolojik OR kazı OR höyük OR \"antik kent\")"


def site_sorgulari() -> list[str]:
    return [f"{SITE_SORGUSU} ({' OR '.join('site:' + s for s in grup)})" for grup in SITE_GRUPLARI]
