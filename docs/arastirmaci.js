/* Arkix — Araştırmacı profilim (#profilim): kendi yayınlarına yapılan atıflar.
 * Veri: OpenAlex (CC0, serbest kullanım): atıf, h-indeks, i10, yıllara göre atıf, yayınlar, atıf yapan çalışmalar.
 * Okuma/indirme sayıları yalnız yayıncıda (ör. DergiPark makale sayfası) tutulur; API yok, her yayında yayıncı sayfasına bağlantı verilir.
 * Google Scholar (API yok, otomatik çekme kullanım koşullarında yasak), Web of Science ve Scopus (kurumsal anahtar, gösterim kısıtı)
 * verisi çekilmez; kişinin o sitelerdeki profiline yönlendirilir. Kayıt: D.arastirmaci (girişliyse profil.arastirmaci ile eşitlenir).
 * Native: app/arastirmaci.tsx bu sayfayı gömülü modda açar. */
const OA = "https://api.openalex.org";
const AR = { yazar: null, yayinlar: null, atiflar: null, hata: "", yukleniyor: false, arama: null };

const arastirmaciAl = () => D.arastirmaci || (typeof profilAl === "function" && profilAl().arastirmaci) || null;
function arastirmaciKaydet(a) {
  D.arastirmaci = a; kaydet();
  if (typeof profilKaydet === "function" && H.kullanici) profilKaydet({ arastirmaci: a }).catch(() => {});
}
const oaKisa = id => String(id || "").replace(/^https:\/\/openalex\.org\//, "");
async function oaGetir(yol, parametre = {}) {
  const p = new URLSearchParams({ ...parametre, mailto: "harrixapp@gmail.com" });
  if (D.oaAnahtar) p.set("api_key", D.oaAnahtar);
  const y = await fetch(`${OA}/${yol}?${p}`);
  if (!y.ok) throw new Error(y.status === 404 ? "bulunamadi" : "sunucu");
  return y.json();
}
const orcidMi = s => /^(https?:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(String(s).trim());
const sayiYaz = n => Number(n || 0).toLocaleString(DIL === "en" ? "en-GB" : "tr-TR");

/* Dış profiller: veri çekilmez, yalnız bağlantı */
function disProfiller(a) {
  const ad = encodeURIComponent(a.ad || "");
  return [
    ["Google Scholar", a.scholar && /^https:\/\/scholar\.google\.[a-z.]+\//.test(a.scholar) ? a.scholar : `https://scholar.google.com/citations?view_op=search_authors&mauthors=${ad}`, !!a.scholar],
    ["Web of Science", a.wos ? `https://www.webofscience.com/wos/author/record/${encodeURIComponent(a.wos)}` : "https://www.webofscience.com/wos/author/search", !!a.wos],
    ["Scopus", a.scopus ? `https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(a.scopus)}` : "https://www.scopus.com/freelookup/form/author.uri", !!a.scopus],
    ["ORCID", a.orcid ? `https://orcid.org/${a.orcid}` : "https://orcid.org/", !!a.orcid],
    ["TR Dizin", "https://search.trdizin.gov.tr/", false],
    ["DergiPark", `https://dergipark.org.tr/tr/search?q=${ad}`, false],
  ];
}

async function sayfaArastirmaci() {
  const a = arastirmaciAl();
  if (!a) return arastirmaciKur();
  $("#sayfa").innerHTML = `<div class="arastirmaci"><p class="aciklama" style="margin:16px">${tx("Yükleniyor…")}</p></div>`;
  try {
    if (!AR.yazar || oaKisa(AR.yazar.id) !== a.id) {
      AR.yazar = await oaGetir(`authors/${a.id}`);
      AR.yayinlar = (await oaGetir("works", { filter: `author.id:${a.id}`, sort: "cited_by_count:desc", "per-page": 50,
        select: "id,display_name,publication_year,cited_by_count,doi,primary_location,open_access" })).results || [];
      const enCok = AR.yayinlar.filter(w => w.cited_by_count > 0).slice(0, 40).map(w => oaKisa(w.id));
      AR.atiflar = enCok.length ? (await oaGetir("works", { filter: `cites:${enCok.join("|")}`, sort: "publication_date:desc", "per-page": 10,
        select: "id,display_name,publication_date,doi,authorships,primary_location,referenced_works" })).results || [] : [];
    }
  } catch (e) {
    $("#sayfa").innerHTML = bosHtml(tx("Profil yüklenemedi"), tx("OpenAlex şu an yanıt vermiyor ya da internet yok. Biraz sonra yeniden deneyin."));
    return;
  }
  const y = AR.yazar, ss = y.summary_stats || {}, yayinlar = AR.yayinlar || [];
  const yeni = a.sonAtif != null && y.cited_by_count > a.sonAtif ? y.cited_by_count - a.sonAtif : 0;
  if (a.sonAtif !== y.cited_by_count) arastirmaciKaydet({ ...a, sonAtif: y.cited_by_count });
  const yillar = (y.counts_by_year || []).filter(c => c.year >= new Date().getFullYear() - 9).sort((p, q) => p.year - q.year);
  const enCok = Math.max(1, ...yillar.map(c => c.cited_by_count));
  const kurum = ((y.last_known_institutions || [])[0] || {}).display_name || "";
  const benimkiler = new Set(yayinlar.map(w => w.id));
  const kart = (deger, ad) => `<div class="ist-kart"><b>${esc(String(deger))}</b><small>${ad}</small></div>`;
  $("#sayfa").innerHTML = `<div class="arastirmaci">
    <div class="ar-ust"><div><h2>${esc(y.display_name)}</h2><p class="aciklama">${esc(kurum)}${a.orcid ? ` · ORCID ${esc(a.orcid)}` : ""}</p></div>
      <span style="display:flex;gap:6px"><button class="ikincil-dugme" id="ar-nasil" aria-label="${tx("Nasıl kullanılır?")}">❔</button><button class="ikincil-dugme" id="ar-degis">${tx("Değiştir")}</button></span></div>
    <div class="ar-dis">${disProfiller(a).map(([ad, url, kayitli]) => `<a class="ikincil-dugme" href="${escUrl(url)}" target="_blank" rel="noopener">${esc(ad)}${kayitli ? " ✓" : ""}</a>`).join("")}
      <button class="ikincil-dugme ar-ekle" id="ar-dis-duzenle">＋ ${tx("Profil adreslerimi gir")}</button></div>
    <p class="aciklama ar-not">${tx("Bu sitelerin verisi uygulamaya çekilmez (Google Scholar'da otomatik çekme yasak, Web of Science ve Scopus kurumsal abonelik ister); düğmeler seni oradaki profiline götürür.")}</p>
    ${yeni ? `<p class="turnuva-bant">🎉 ${tx("Son baktığından beri {n} yeni atıf", { n: sayiYaz(yeni) })}</p>` : ""}
    <div class="ist-izgara">${kart(sayiYaz(y.cited_by_count), tx("Atıf"))}${kart(ss.h_index ?? "—", tx("h-indeks"))}${kart(ss.i10_index ?? "—", tx("i10-indeks"))}${kart(sayiYaz(y.works_count), tx("Yayın"))}</div>
    <p class="aciklama ar-not">${tx("Sayılar OpenAlex'ten. Atıf sayıları kaynağa göre değişir; Google Scholar çoğu kez daha yüksek gösterir. Okuma ve indirme sayıları yalnız yayıncının sayfasında görünür.")}</p>
    ${yillar.length ? `<h3 class="ist-baslik">${tx("Yıllara göre atıf")}</h3><ul class="ist-cubuklar">${yillar.map(c => `<li><span>${c.year}</span><i style="width:${Math.round(c.cited_by_count / enCok * 100)}%"></i><b>${sayiYaz(c.cited_by_count)}</b></li>`).join("")}</ul>` : ""}
    <h3 class="ist-baslik">${tx("Son atıf yapanlar")}</h3>
    ${(AR.atiflar || []).length ? `<ul class="ar-liste">${AR.atiflar.map(w => {
      const hangi = (w.referenced_works || []).filter(r => benimkiler.has(r)).map(r => yayinlar.find(x => x.id === r)).filter(Boolean)[0];
      const yazar = ((w.authorships || [])[0] || {}).author || {};
      return `<li><a href="${escUrl(w.doi || w.id)}" target="_blank" rel="noopener"><b>${esc(w.display_name || "")}</b></a>
        <small>${esc(yazar.display_name || "")}${(w.authorships || []).length > 1 ? " vd." : ""} · ${esc(w.publication_date || "")}${w.primary_location && w.primary_location.source ? " · " + esc(w.primary_location.source.display_name) : ""}</small>
        ${hangi ? `<small>↳ ${tx("Atıf yapılan")}: ${esc(hangi.display_name)}</small>` : ""}</li>`; }).join("")}</ul>` : `<p class="aciklama" style="margin:0 16px">${tx("Henüz atıf bulunamadı.")}</p>`}
    <h3 class="ist-baslik">${tx("Yayınlarım")} <small>${tx("en çok atıf alana göre")}</small></h3>
    <ul class="ar-liste">${yayinlar.map(w => `<li><b>${esc(w.display_name || "")}</b>
      <small>${esc(String(w.publication_year || ""))}${w.primary_location && w.primary_location.source ? " · " + esc(w.primary_location.source.display_name) : ""} · <strong>${sayiYaz(w.cited_by_count)} ${tx("atıf")}</strong></small>
      <span class="ar-baglanti">${w.doi ? `<a href="${escUrl(w.doi)}" target="_blank" rel="noopener">${tx("Yayıncı sayfası (okuma/indirme)")}</a>` : ""}
        ${w.open_access && w.open_access.oa_url ? `<a href="${escUrl(w.open_access.oa_url)}" target="_blank" rel="noopener">${tx("Açık erişim")}</a>` : ""}</span></li>`).join("")}</ul>
    </div>`;
  $("#ar-degis").onclick = () => arastirmaciKur(true);
  $("#ar-nasil").onclick = arastirmaciNasil;
  $("#ar-dis-duzenle").onclick = () => disProfilLevhasi(a);
}

/* Nasıl kullanılır: ilk girişte bir kez, sonra "❔" düğmesiyle */
function arastirmaciNasil() {
  D.arNasilGoruldu = true; kaydet();
  const adim = (n, b, m) => `<p class="nasil-adim"><b>${n}</b> <span><strong>${b}</strong><br>${m}</span></p>`;
  levhaAc(`<div class="nasil"><h3>🎓 ${tx("Araştırmacı profili nasıl kullanılır?")}</h3>
    ${adim(1, tx("Kendini bul"), tx("ORCID numaranı (0000-0002-…) ya da adını yaz, listeden kendini seç. Aynı adlı birden çok kişi çıkabilir: kurumuna ve yayın sayısına bak. Yayınların OpenAlex'te iki profile bölünmüşse en çok yayını olanı seç."))}
    ${adim(2, tx("Kartları oku"), tx("Atıf: yayınlarına yapılan toplam atıf. h-indeks: en az h atıf almış h yayının. i10: en az 10 atıf almış yayın sayın."))}
    ${adim(3, tx("Kim atıf yaptı?"), tx("Son atıf yapanlar listesinde hangi çalışmanın hangi yayınına atıf yaptığını görürsün; başlığa dokununca makale açılır."))}
    ${adim(4, tx("Yayınların"), tx("En çok atıf alana göre sıralı. Okuma ve indirme sayıları için yayıncı sayfasına, ücretsiz kopya için Açık erişim bağlantısına dokun."))}
    ${adim(5, tx("Öteki profillerin"), tx("Google Scholar adresini, Web of Science ResearcherID'ni ve Scopus numaranı gir; düğmeler doğrudan profillerine gider. Bu sitelerin sayıları uygulamaya çekilmez."))}
    ${adim(6, tx("Yeni atıfları izle"), tx("Her girişinde son baktığından beri gelen yeni atıflar üstte yazar. Profilin giriş yaptığın her cihazda görünür."))}
    <p><button class="buyuk-dugme" id="ar-nasil-tamam">${tx("Anladım")}</button></p></div>`, lv => { lv.querySelector("#ar-nasil-tamam").onclick = levhaKapat; });
}

function disProfilLevhasi(a) {
  levhaAc(`<h3>${tx("Profil adreslerim")}</h3>
    <p class="aciklama">${tx("Girersen düğmeler doğrudan senin profiline gider. Boş bırakırsan o sitede arama sayfası açılır.")}</p>
    <div class="kazi-form">
      <label>Google Scholar<input id="ar-scholar" type="url" placeholder="https://scholar.google.com/citations?user=…" value="${esc(a.scholar || "")}" autocomplete="off"></label>
      <label>Web of Science ResearcherID<input id="ar-wos" placeholder="ABC-1234-2020" value="${esc(a.wos || "")}" autocomplete="off" autocapitalize="characters"></label>
      <label>Scopus Author ID<input id="ar-scopus" placeholder="57190000000" value="${esc(a.scopus || "")}" inputmode="numeric" autocomplete="off"></label>
    </div>
    <p style="margin:14px 0 0"><button class="buyuk-dugme" id="ar-dis-kaydet">${tx("Kaydet")}</button></p>`, lv => {
    lv.querySelector("#ar-dis-kaydet").onclick = () => {
      const scholar = lv.querySelector("#ar-scholar").value.trim(), wos = lv.querySelector("#ar-wos").value.trim().toUpperCase(), scopus = lv.querySelector("#ar-scopus").value.trim();
      if (scholar && !/^https:\/\/scholar\.google\.[a-z.]+\//.test(scholar)) { bildir(tx("Google Scholar adresi scholar.google ile başlamalı")); return; }
      if (wos && !/^[A-Z]{1,3}-\d{4}-\d{4}$/.test(wos)) { bildir(tx("ResearcherID biçimi ABC-1234-2020 gibi olmalı")); return; }
      if (scopus && !/^\d{6,15}$/.test(scopus)) { bildir(tx("Scopus Author ID yalnız rakamlardan oluşur")); return; }
      arastirmaciKaydet({ ...arastirmaciAl(), scholar, wos, scopus }); levhaKapat(); bildir(tx("Kaydedildi")); sayfaArastirmaci();
    };
  });
}

/* Kurulum: ORCID ya da adla OpenAlex'te kendini bul */
function arastirmaciKur(degistir) {
  $("#sayfa").innerHTML = `<div class="arastirmaci">
    <div class="ar-tanit"><div class="nasil-ikon">🎓</div><h2>${tx("Araştırmacı profilim")}</h2>
      <p class="aciklama">${tx("Yayınlarına yapılan atıfları, h-indeksini ve seni son atıf yapanları burada izle. ORCID numaranı ya da adını yaz, listeden kendini seç.")}</p></div>
    <p style="text-align:center;margin:0"><button class="metin-dugme" id="ar-nasil">❔ ${tx("Nasıl kullanılır?")}</button></p>
    <form class="arama-kutu" id="ar-form" style="margin:12px 16px"><input id="ar-girdi" placeholder="${tx("0000-0002-1825-0097 ya da Ad Soyad")}" autocomplete="off" enterkeyhint="search"></form>
    <div id="ar-sonuc"></div>
    ${degistir ? `<p style="text-align:center"><button class="metin-dugme" id="ar-kaldir">${tx("Profili kaldır")}</button></p>` : ""}</div>`;
  const ara = async () => {
    const q = $("#ar-girdi").value.trim(), kap = $("#ar-sonuc");
    if (q.length < 3) { bildir(tx("En az 3 harf yazın")); return; }
    kap.innerHTML = `<p class="aciklama" style="margin:0 16px">${tx("Aranıyor…")}</p>`;
    try {
      let liste;
      if (orcidMi(q)) liste = [await oaGetir(`authors/https://orcid.org/${q.replace(/^https?:\/\/orcid\.org\//i, "")}`)];
      else liste = (await oaGetir("authors", { search: q, "per-page": 10 })).results || [];
      kap.innerHTML = liste.length ? `<ul class="ar-liste">${liste.map((y, i) => `<li><button class="ar-sec" data-i="${i}"><b>${esc(y.display_name)}</b>
        <small>${esc(((y.last_known_institutions || [])[0] || {}).display_name || "")} · ${sayiYaz(y.works_count)} ${tx("yayın")} · ${sayiYaz(y.cited_by_count)} ${tx("atıf")}</small>
        ${y.orcid ? `<small>ORCID ${esc(y.orcid.replace("https://orcid.org/", ""))}</small>` : ""}</button></li>`).join("")}</ul>
        <p class="aciklama ar-not">${tx("Kendini bulamazsan ORCID numaranla dene; ORCID'in yoksa orcid.org'dan ücretsiz alabilirsin.")}</p>`
        : bosHtml(tx("Bulunamadı"), tx("Adını farklı yazmayı ya da ORCID numaranı dene."));
      kap.querySelectorAll(".ar-sec").forEach(b => b.onclick = () => {
        const y = liste[+b.dataset.i], eski = arastirmaciAl() || {};
        arastirmaciKaydet({ id: oaKisa(y.id), ad: y.display_name, orcid: (y.orcid || "").replace("https://orcid.org/", ""), sonAtif: y.cited_by_count,
          scholar: eski.scholar || "", wos: eski.wos || "", scopus: eski.scopus || "" });
        AR.yazar = null; bildir(tx("Profil bağlandı")); sayfaArastirmaci();
      });
    } catch (e) { kap.innerHTML = bosHtml(tx("Bulunamadı"), e.message === "bulunamadi" ? tx("Bu ORCID OpenAlex'te kayıtlı değil; adınla dene.") : tx("OpenAlex şu an yanıt vermiyor.")); }
  };
  $("#ar-form").onsubmit = e => { e.preventDefault(); ara(); };
  $("#ar-nasil").onclick = arastirmaciNasil;
  if (!D.arNasilGoruldu) setTimeout(arastirmaciNasil, 400);   // ilk girişte bir kez
  const k = $("#ar-kaldir"); if (k) k.onclick = () => { arastirmaciKaydet(null); AR.yazar = null; arastirmaciKur(); };
}
