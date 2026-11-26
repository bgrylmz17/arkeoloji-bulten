"""Bundle'ın beslendiği yayıncılar ve arkeoloji siteleri — doğrudan RSS akışları.

Bundle kendi haberini üretmez; yayıncıların RSS akışlarını toplar. Burada aynı yayıncıların
akışlarını doğrudan okuyoruz (Bundle web sitesinde Kasım 2026'da görülen kaynaklar + bilinen
arkeoloji siteleri).

mod:
  "arkeo" -> tamamen arkeoloji/tarih sitesi: her yazı alınır
  "bilim" -> bilim sitesinin karışık akışı (Phys.org, ScienceDaily): arkeoloji ve "X bin yıllık",
             "ancient" gibi ifadeler geçenler alınır
  "genel" -> genel haber sitesi: yalnızca arkeoloji bağlamı olan haberler alınır
             (arkeoloji, arkeolojik, höyük, kazı heyeti, antik kent, excavation… — metin.arkeoloji_mi)

Doğrulama (18 Kasım 2026, tarayıcıdan): Arkeofili, ScienceDaily, Phys.org, Live Science, Smithsonian,
Archaeology Magazine, TRT Haber, Hürriyet, Milliyet, Sabah, NTV, CNN Türk, Habertürk, Cumhuriyet, Sözcü,
Euronews akışları çalışıyor. Arkeonews ve HeritageDaily bot korumalı olabilir; onlar ve Arkeolojik Haber
(akışı yok) ayrıca Google Haberler site sorgusuyla taranır.
İlk bulut toplamasında (18 Kasım 2026) çalışmayan ve çıkarılan akışlar: Anadolu Ajansı Kültür, Gazete
Oksijen, Notbir (404), Ekşi Şeyler (403), HeritageDaily (bağlantı kesiliyor), T24, İHA (akış değil);
bunların haberleri Google Haberler site gruplarından gelir.

Bir akış kapanır ya da adres değişirse toplayıcı onu atlar ve kaynak_durumu'na hata olarak yazar;
diğerleri etkilenmez.
"""
from __future__ import annotations

# (ad, adres, mod, dil)
AKISLAR = [
    # --- doğrudan arkeoloji / tarih
    ("Arkeofili", "https://arkeofili.com/feed/", "arkeo", "tr"),
    # RSS kapandı (Kasım 2026: /feed/ ana sayfaya yönleniyor); WordPress REST adresi aynı yazıları veriyor
    ("Arkeonews", "https://arkeonews.net/wp-json/wp/v2/posts?per_page=30&_fields=title,link,date_gmt,excerpt", "arkeo", "en"),
    ("ScienceDaily Arkeoloji", "https://www.sciencedaily.com/rss/fossils_ruins/archaeology.xml", "bilim", "en"),
    ("Phys.org Arkeoloji", "https://phys.org/rss-feed/science-news/archaeology/", "bilim", "en"),
    ("Live Science", "https://www.livescience.com/feeds.xml", "bilim", "en"),
    ("Smithsonian", "https://www.smithsonianmag.com/rss/latest_articles/", "bilim", "en"),
    ("Archaeology Magazine", "https://archaeology.org/feed/", "arkeo", "en"),
    ("The Conversation", "https://theconversation.com/global/articles.atom", "genel", "en"),
    # --- Bundle'daki Türkçe yayıncılar (arkeoloji haberleri süzülür)
    ("TRT Haber Kültür-Sanat", "https://www.trthaber.com/kultur_sanat_articles.rss", "genel", "tr"),
    ("TRT Haber Bilim", "https://www.trthaber.com/bilim_teknoloji_articles.rss", "genel", "tr"),
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
    ("GZT", "https://www.gzt.com/rss", "genel", "tr"),
    ("Haberler.com", "https://rss.haberler.com/rss.asp", "genel", "tr"),
    ("Dünya", "https://www.dunya.com/rss", "genel", "tr"),
    ("Yeni Şafak", "https://www.yenisafak.com/rss", "genel", "tr"),
    ("Evrim Ağacı", "https://evrimagaci.org/rss.xml", "genel", "tr"),
    ("Bant Mag", "https://bantmag.com/feed/", "genel", "tr"),
    # --- Türkiye'den İngilizce yayınlar (Anadolu kazıları sık geçer)
    # Türkiye Today: akış Kasım 2026'da kaldırıldı; site Google Haberler site sorgusuyla taranıyor (SITE_GRUPLARI)
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
    ["t24.com.tr", "gazeteoksijen.com", "notbir.com.tr", "eksiseyler.com", "aa.com.tr"],
    ["arkeolojikhaber.com", "arkeonews.net", "heritagedaily.com", "turkiyetoday.com", "dailysabah.com"],
]
SITE_SORGUSU = "(arkeoloji OR arkeolojik OR kazı OR höyük OR \"antik kent\")"


def site_sorgulari() -> list[str]:
    return [f"{SITE_SORGUSU} ({' OR '.join('site:' + s for s in grup)})" for grup in SITE_GRUPLARI]
