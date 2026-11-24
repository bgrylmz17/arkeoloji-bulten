/* Harrix Arkeoloji Bülteni — telefon uygulaması (PWA)
 * Veri: veri/bulten.json (GitHub Actions günde 4 kez günceller).
 * Kişisel olanlar (favoriler, konular, notlar, kaynakça, okundu bilgisi) yalnızca bu cihazda,
 * tarayıcının yerel deposunda tutulur; hiçbir sunucuya gitmez.
 */
"use strict";

const SURUM = "1.5.0";
const DEPO_ANAHTARI = "harrix-bulten";
const TURLER = ["Makale", "Tez", "Haber", "Rapor"];
const TUR_COGUL = { Makale: "Makaleler", Tez: "Tezler", Haber: "Haberler", Rapor: "Raporlar" };
const DIL_AD = { tr: "Türkçe", en: "İngilizce", de: "Almanca", fr: "Fransızca", it: "İtalyanca", es: "İspanyolca" };
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/* ---------------------------------------------------------------- sesli okuma (telefonun kendi Türkçe sesi) */
// Uzun metin cümle öbeklerine bölünür: bazı tarayıcılar 15 saniyeyi aşan tek konuşmayı yarıda keser.
const SES = {
  destek: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
  kuyruk: [], calisiyor: false, baslik: "", kusak: 0,
  turkceSesler() {
    try {
      const puan = v => (/premium|enhanced|gelişmiş|natural|neural/i.test(v.name) ? 40 : 0) + (/yelda|cem|filiz|emel/i.test(v.name) ? 20 : 0) + (v.localService ? 5 : 0);
      return speechSynthesis.getVoices().filter(v => /^tr/i.test(v.lang)).sort((a, b) => puan(b) - puan(a));
    } catch (e) { return []; }
  },
  ses() { const l = this.turkceSesler(); return (D.sesId && l.find(v => v.voiceURI === D.sesId)) || l[0] || null; },
  sesAdi() { try { const v = this.ses(); return v ? v.name : ""; } catch (e) { return ""; } },
  obekler(metinler) {
    const out = [];
    for (const m of metinler) {
      const temiz = sesIcinTemizle(m);
      let cari = "";
      for (const c0 of temiz.match(/.+?(?:[.!?…]+(?=\s|$)|$)/g) || []) { const c = c0.trim(); if (!c) continue;
        if (cari && (cari + " " + c).length > 220) { out.push(cari); cari = c; } else cari = (cari + " " + c).trim();
        while (cari.length > 400) { out.push(cari.slice(0, 220)); cari = cari.slice(220); }
      }
      if (cari) out.push(cari);
    }
    return out;
  },
  oku(metinler, baslik) {
    this.durdur(true);
    this.kuyruk = this.obekler(metinler); this.baslik = baslik || "Sesli okuma"; this.calisiyor = true; this.kusak++;
    if (!this.ses()) bildir("Telefonda Türkçe ses bulunamadı; varsayılan sesle okunuyor. Ayarlar › Sesli okuma'ya bakın.");
    this.cubuk(); this.sonraki(this.kusak);
  },
  sonraki(kusak) {
    if (kusak !== this.kusak) return;
    const m = this.kuyruk.shift();
    if (!m) { this.durdur(); return; }
    const u = new SpeechSynthesisUtterance(m);
    u.lang = "tr-TR"; u.rate = D.sesHiz || 1;
    const v = this.ses(); if (v) u.voice = v;
    u.onend = () => this.sonraki(kusak);
    u.onerror = e => { if (e.error !== "interrupted" && e.error !== "canceled") this.sonraki(kusak); };
    speechSynthesis.speak(u);
    this.cubuk();
  },
  durdur(sessiz) { this.kusak++; this.kuyruk = []; this.calisiyor = false; try { speechSynthesis.cancel(); } catch (e) {} if (!sessiz) this.cubuk(); },
  duraklat() { if (speechSynthesis.paused) speechSynthesis.resume(); else speechSynthesis.pause(); this.cubuk(); },
  atla() { try { speechSynthesis.cancel(); } catch (e) {} },   // onerror/onend sıradaki öbeğe geçer
  cubuk() {
    let c = document.getElementById("ses-cubuk");
    if (!this.calisiyor) { if (c) c.remove(); return; }
    if (!c) {
      c = document.createElement("div"); c.id = "ses-cubuk"; c.setAttribute("role", "region"); c.setAttribute("aria-label", "Sesli okuma");
      c.innerHTML = `<span class="ses-baslik"></span><button data-s="d" aria-label="Duraklat"></button><button data-s="a" aria-label="Sonraki">⏭</button><button data-s="x" aria-label="Durdur">⏹</button>`;
      c.querySelector('[data-s="d"]').onclick = () => this.duraklat();
      c.querySelector('[data-s="a"]').onclick = () => this.atla();
      c.querySelector('[data-s="x"]').onclick = () => this.durdur();
      document.body.appendChild(c);
    }
    c.querySelector(".ses-baslik").textContent = "🔊 " + this.baslik;
    c.querySelector('[data-s="d"]').textContent = speechSynthesis.paused ? "▶" : "⏸";
  },
};
/* Arkeoloji metnindeki kısaltmaları Türkçe sesin doğru okuyacağı biçime çevirir. */
function sesIcinTemizle(ham) {
  return String(ham || "")
    .replace(/https?:\/\/\S+/g, "").replace(/\bdoi:\s*\S+/gi, "").replace(/\[\d+(?:,\s*\d+)*\]/g, "")
    .replace(/(^|\s)M\.?Ö\.?(?=[\s.,;0-9]|$)/g, "$1milattan önce").replace(/(^|\s)M\.?S\.?(?=[\s.,;0-9]|$)/g, "$1milattan sonra")
    .replace(/Prof\.\s*Dr\./gi, "Profesör Doktor").replace(/Doç\.\s*Dr\./gi, "Doçent Doktor").replace(/Dr\.(?=\s)/g, "Doktor")
    .replace(/(\d)\s*yy\./gi, "$1 yüzyıl").replace(/\bvb\./gi, "ve benzeri").replace(/\bvd\./gi, "ve diğerleri").replace(/\börn\./gi, "örneğin")
    .replace(/(\d+)\s*m²/g, "$1 metrekare").replace(/(\d+)\s*km\b/g, "$1 kilometre").replace(/(\d+)\s*cm\b/g, "$1 santimetre").replace(/(\d+)\s*mm\b/g, "$1 milimetre")
    .replace(/\s+/g, " ").trim();
}
if (SES.destek) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch (e) {} }

function okunacakMetin(r, kisa) {
  const bas = (r.l && r.l !== "tr" && r.bt) ? r.bt : r.b;
  let oz = (r.l && r.l !== "tr") ? (r.ot || "") : (r.o || "");
  if (kisa && oz.length > 350) oz = oz.slice(0, 350).replace(/\s+\S*$/, "") + "…";
  return `${String(bas || "").replace(/\.$/, "")}. ${r.w || r.s ? `Kaynak: ${r.w || r.s}. ` : ""}${oz}`;
}
async function kaydiDinle(r) {
  if (r.l && r.l !== "tr" && (!r.bt || (r.o && !r.ot))) {
    bildir("Okumadan önce Türkçeye çevriliyor…");
    try { if (!r.bt) r.bt = await cevir(r.b, r.l); if (r.o && !r.ot) r.ot = await cevir(r.o, r.l); }
    catch (e) { bildir("Çeviri servisine ulaşılamadı; kayıt Türkçe olmadığı için okunamıyor."); return; }
  }
  SES.oku([okunacakMetin(r)], r.k === "Haber" ? "Haber okunuyor" : "Kayıt okunuyor");
}
function bulteniDinle(kayitlar, ozet) {
  const turkce = r => !r.l || r.l === "tr" || r.bt;
  const haber = kayitlar.filter(r => r.k === "Haber" && turkce(r)).slice(0, 8);
  const diger = kayitlar.filter(r => r.k !== "Haber" && turkce(r)).slice(0, 5);
  const atlanan = kayitlar.filter(r => !turkce(r)).length;
  const m = [String(ozet || "").trim()];
  if (haber.length) { m.push(`${haber.length} haber okunacak.`); haber.forEach((r, i) => m.push(`Haber ${i + 1}. ${okunacakMetin(r, true)}`)); }
  if (diger.length) { m.push("Yeni yayınlardan başlıklar."); diger.forEach((r, i) => m.push(`${i + 1}. ${TUR_COGUL[r.k] ? r.k : ""}: ${String((r.l && r.l !== "tr" && r.bt) || r.b).replace(/\.$/, "")}.`)); }
  if (atlanan) m.push(`Türkçeye çevrilmemiş ${atlanan} yabancı kayıt okunmadı; ayrıntısında Dinle'ye basınca çevrilip okunur.`);
  if (!haber.length && !diger.length) m.push("Okunacak Türkçe kayıt yok.");
  SES.oku(m, "Bülten okunuyor");
}

/* ---------------------------------------------------------------- durum (yerel depo) */
const D = Object.assign({
  fav: [], okundu: {}, notlar: {}, konular: [], kaynakca: [], kayitlar: {},
  gorulen: "", tema: "oto", palet: "kum", yazi: 1, bildirim: false, kurulumIpucu: true,
  uid: null, esitleme: 0, girisSoruldu: false, hepTurkce: false, oaAnahtar: "", sesHiz: 1, sesId: "",
  ozelSozler: [], zoteroKullanici: "", zoteroAnahtar: "",
}, guvenliOku());

function guvenliOku() {
  try { return JSON.parse(localStorage.getItem(DEPO_ANAHTARI)) || {}; } catch (e) { return {}; }
}
function kaydet() {
  try { localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(D)); }
  catch (e) { bildir("Cihazda yer kalmadı; son değişiklik kaydedilemedi."); }
  if (typeof hesapDegisti === "function") hesapDegisti();   // giriş yapıldıysa hesaba da yaz
}
/* Kişisel listelerde geçen kayıtların bir kopyası saklanır: bülten eski kayıtları silse de kaybolmasın. */
function kopyala(r) { if (r && !D.kayitlar[r.i]) D.kayitlar[r.i] = r; }
function kullaniliyorMu(id) {
  return D.fav.includes(id) || D.kaynakca.includes(id) || !!D.notlar[id] || D.konular.some(k => k.ids.includes(id));
}
function kopyaTemizle(id) { if (!kullaniliyorMu(id)) delete D.kayitlar[id]; }

/* ---------------------------------------------------------------- veri */
let VERI = { kayitlar: [], kavramlar: [], guncelleme: "", kazi: "" };
let DIZIN = new Map();
let KAVRAM = new Map();
let SOZLER = [];
let ESIK = D.gorulen;           // bu oturumda "yeni" sayılacakların eşiği
let kurulumOlayi = null;

async function veriYukle(sessiz) {
  try {
    const yanit = await fetch("veri/bulten.json", { cache: "no-cache" });
    if (!yanit.ok) throw new Error(yanit.status);
    const v = await yanit.json();
    const onceki = VERI.guncelleme;
    VERI = v;
    DIZIN = new Map(v.kayitlar.map(r => [r.i, r]));
    for (const id in D.kayitlar) if (!DIZIN.has(id)) DIZIN.set(id, D.kayitlar[id]);
    KAVRAM = new Map(v.kavramlar.map(k => [k.id, k]));
    if (onceki && onceki !== v.guncelleme && !sessiz) bildir(`Bülten güncellendi: ${v.yeni_sayisi} yeni kayıt`);
    rozetGuncelle();
    return true;
  } catch (e) {
    if (!sessiz) bildir("Bülten indirilemedi. İnternet bağlantınızı kontrol edin.");
    for (const id in D.kayitlar) if (!DIZIN.has(id)) DIZIN.set(id, D.kayitlar[id]);
    return false;
  }
}
async function sozleriYukle() {
  try { SOZLER = await (await fetch("veri/sozler.json")).json(); } catch (e) { SOZLER = []; }
}

/* ---------------------------------------------------------------- yardımcılar */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const katla = s => String(s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
const titres = ms => { if (navigator.vibrate) try { navigator.vibrate(ms || 8); } catch (e) {} };

function tarihYaz(t) {
  if (!t) return "";
  const [y, a, g] = t.slice(0, 10).split("-").map(Number);
  if (!a) return String(y);
  return g ? `${g} ${AYLAR[a - 1]} ${y}` : `${AYLAR[a - 1]} ${y}`;
}
function gunAnahtari(r) { return (r.g || r.t || "").slice(0, 10); }
function gunEtiketi(gun) {
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const d = new Date(gun + "T00:00:00");
  const fark = Math.round((bugun - d) / 86400000);
  if (fark <= 0) return "Bugün";
  if (fark === 1) return "Dün";
  if (fark < 7) return d.toLocaleDateString("tr-TR", { weekday: "long" });
  return tarihYaz(gun);
}
function saatYaz(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
const yeniMi = r => !!ESIK && (r.g || "") > ESIK && !D.okundu[r.i];
const baslikGoster = r => (r.l && r.l !== "tr" && r.bt) ? r.bt : r.b;

let bildirimZamani;
function bildir(metin) {
  const b = $("#bildirim");
  b.textContent = metin;
  b.classList.add("gorunur");
  clearTimeout(bildirimZamani);
  bildirimZamani = setTimeout(() => b.classList.remove("gorunur"), 2600);
}

function rozetGuncelle() {
  const yeni = VERI.kayitlar.filter(r => (r.g || "") > (D.gorulen || "") && !D.okundu[r.i]).length;
  if ("setAppBadge" in navigator) {
    try { yeni ? navigator.setAppBadge(yeni) : navigator.clearAppBadge(); } catch (e) {}
  }
}

/* ---------------------------------------------------------------- tema */
function temaUygula() {
  const kok = document.documentElement;
  if (D.tema === "oto") kok.removeAttribute("data-tema"); else kok.dataset.tema = D.tema;
  if (D.palet === "kum") kok.removeAttribute("data-palet"); else kok.dataset.palet = D.palet;
  kok.style.setProperty("--yazi-olcek", D.yazi);
  const koyu = D.tema === "koyu" || (D.tema === "oto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", koyu ? "#161916" : "#eef0e9"));
}

/* ---------------------------------------------------------------- kayıt satırı */
function satirHtml(r, secenek = {}) {
  const tur = r.k || "Haber";
  const kaynak = r.k === "Haber" || r.k === "Rapor" ? (r.w || r.s) : (r.w || r.s);
  const yazar = r.y && ["Makale", "Tez", "Kitap"].includes(r.k) ? r.y.split(";").slice(0, 3).join(",") : "";
  const alt = secenek.not ? D.notlar[r.i] : secenek.litAlt
    ? [yazar, (r.t || "").slice(0, 4), r.atif ? `${r.atif} atıf` : ""].filter(Boolean).join(" · ")
    : (yazar || (r.l !== "tr" && r.ot ? r.ot : r.o));
  const etiketler = (r.e || []).filter(e => KAVRAM.has(e) && e !== "kazim").slice(0, 3)
    .map(e => `<span class="etiket">${esc(KAVRAM.get(e).ad)}</span>`).join("");
  const dil = r.l && r.l !== "tr" ? `<span class="dil" title="${esc(DIL_AD[r.l] || r.l)}">${esc(r.l.toUpperCase())}</span>` : "";
  return `<li class="kayit${D.okundu[r.i] ? " okundu" : ""}" data-id="${esc(r.i)}">
    <div class="kaydirma-arka">${D.fav.includes(r.i) ? "Favoriden çıkar" : "Favorilere ekle"}</div>
    <a class="kayit-ic" href="#k/${encodeURIComponent(r.i)}">
      <div class="kayit-ust">${yeniMi(r) ? '<span class="yeni-nokta" title="Yeni"></span>' : ""}<span class="tur" data-tur="${esc(tur)}">${esc(tur)}</span><span class="kaynak">${esc(kaynak || "")}</span>${D.fav.includes(r.i) ? "<span aria-label='Favori'>★</span>" : ""}${dil}</div>
      <h3 class="kayit-baslik">${esc(baslikGoster(r))}</h3>
      ${alt ? `<p class="kayit-alt">${esc(alt)}</p>` : ""}
      ${etiketler ? `<div class="isaretler">${etiketler}</div>` : ""}
    </a></li>`;
}

/* Günlere göre tabakalar: en üstte bugün, aşağı indikçe toprak koyulaşır. */
function tabakalarHtml(kayitlar, secenek = {}) {
  if (!kayitlar.length) return "";
  const gruplar = new Map();
  for (const r of kayitlar) {
    const g = secenek.yayinTarihi ? (r.t || gunAnahtari(r)).slice(0, 10) : gunAnahtari(r);
    if (!gruplar.has(g)) gruplar.set(g, []);
    gruplar.get(g).push(r);
  }
  let i = 0, html = "";
  for (const [gun, liste] of gruplar) {
    const derinlik = Math.min(4, 1 + Math.floor(i / 2));
    html += `<section class="tabaka" data-derinlik="${derinlik}">
      <div class="tabaka-bas"><h2>${esc(gunEtiketi(gun))}</h2><small>${liste.length} kayıt</small></div>
      <ul class="liste">${liste.map(r => satirHtml(r, secenek)).join("")}</ul></section>`;
    i++;
  }
  return html;
}

function bosHtml(baslik, metin, dugme) {
  return `<div class="bos"><strong>${esc(baslik)}</strong>${esc(metin)}${dugme ? `<p>${dugme}</p>` : ""}</div>`;
}

/* ---------------------------------------------------------------- sayfalar */
const S = { tur: "", donem: "", dil: "", arama: "", kitaplik: "fav", mod: "bulten" };
let gosterilecek = 60;

function sayfaBugun() {
  const soz = gununSozu();
  const son = VERI.kayitlar.filter(r => (r.g || "").slice(0, 10) >= gunOnce(2));
  const yeni = VERI.kayitlar.filter(yeniMi);
  const say = t => (yeni.length ? yeni : son).filter(r => r.k === t).length;
  const so = sabahOzeti();
  const ust = `
    ${VERI.guncelleme ? `<section class="sabah" aria-label="Dünün özeti">
      <div class="sabah-ust"><div><h2>${so.selam} · Dünün özeti</h2><p>${esc(so.etiket)}</p></div>
        ${SES.destek && so.havuz.length ? `<button class="sabah-dinle" id="sabah-dinle"><svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>Dinle</button>` : ""}</div>
      <p class="sabah-metin">${esc(so.paragraf)}</p>
      ${so.oneCikanlar.slice(0, 2).map(r => `<a class="sabah-madde" href="#k/${encodeURIComponent(r.i)}">${esc(baslikGoster(r))}</a>`).join("")}
    </section>` : ""}
    ${soz ? `<a class="soz soz-bag" href="#sozler"><blockquote>${esc(soz)}</blockquote><span class="soz-kim">Günün sözü · Söz ekle</span></a>` : ""}
    <form class="arama-kutu lit-hizli" id="lit-hizli"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>
      <input id="lit-hizli-q" type="search" placeholder="Tüm literatürde ara (ör. Göbeklitepe taş alet)" enterkeyhint="search" autocomplete="off" aria-label="Tüm literatürde ara">
      <button class="ara-git" type="submit">Ara</button></form>
    <p class="ozet">${!VERI.guncelleme ? "Bülten henüz ilk kez toplanmadı." : yeni.length
      ? `Son bakışınızdan beri <b>${yeni.length} yeni kayıt</b> geldi.`
      : `Son iki günde ${son.length} kayıt toplandı.`}${VERI.guncelleme ? ` Bülten ${esc(saatYaz(VERI.guncelleme))} güncellendi.` : ""}</p>
    <div class="ozet-satir">${TURLER.map(t => `<a class="sayac" href="#akis" data-tur-git="${t}"><strong>${say(t)}</strong><span>${TUR_COGUL[t]}</span></a>`).join("")}</div>
    ${SES.destek ? `<div class="dinle-satir"><button class="dinle-dugme" id="bulten-dinle"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>Bülteni dinle</button><span class="aciklama">Özeti ve haberleri sesli okur</span></div>` : ""}
    ${kurulumIpucuHtml()}`;
  const liste = (yeni.length ? yeni : son).slice(0, 80);
  $("#sayfa").innerHTML = ust + (liste.length ? tabakalarHtml(liste)
    : bosHtml("Henüz kayıt yok", "Bülten ilk kez toplanıyor olabilir; birkaç dakika sonra yeniden bakın."));
  document.querySelectorAll("[data-tur-git]").forEach(a => a.addEventListener("click", () => { S.tur = a.dataset.turGit; }));
  const sd = $("#sabah-dinle");
  if (sd) sd.onclick = () => SES.oku(so.sesli, "Dünün özeti");
  $("#lit-hizli").onsubmit = e => {
    e.preventDefault(); const q = $("#lit-hizli-q").value.trim(); if (!q) return;
    S.mod = "lit"; L.q = q; L.donem = ""; location.hash = "#akis"; litAra(false);
  };
  const dinle = $("#bulten-dinle");
  if (dinle) dinle.onclick = () => bulteniDinle(yeni.length ? yeni : son, $(".ozet").textContent);
  if (VERI.guncelleme && VERI.guncelleme > (D.gorulen || "")) { D.gorulen = VERI.guncelleme; kaydet(); }
}
function gunOnce(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function tumSozler() { return [...(D.ozelSozler || []), ...SOZLER]; }
function gununSozu() {
  const l = tumSozler();
  if (!l.length) return "";
  const d = new Date(); const sira = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  return l[sira % l.length];
}

/* Dünün (dün boşsa son 48 saatin) kayıtlarından kısa özet ve sesli metin. */
function sabahOzeti() {
  const saat = new Date().getHours();
  const selam = saat >= 5 && saat < 12 ? "Günaydın" : saat < 18 && saat >= 12 ? "İyi günler" : "İyi akşamlar";
  const dun = gunOnce(1);
  let havuz = VERI.kayitlar.filter(r => gunAnahtari(r) === dun);
  let etiket = `Dün, ${tarihYaz(dun)}`;
  if (!havuz.length) { havuz = VERI.kayitlar.filter(r => gunAnahtari(r) >= gunOnce(2)); etiket = "Son 48 saat"; }
  const say = t => havuz.filter(r => r.k === t).length;
  const parca = [[say("Haber"), "haber"], [say("Makale"), "yeni makale"], [say("Tez"), "tez"], [say("Rapor"), "rapor"]]
    .filter(([n]) => n).map(([n, ad]) => `${n} ${ad}`);
  const turk = r => !r.l || r.l === "tr" || r.bt;
  const oneCikanlar = [...havuz.filter(r => r.k === "Haber" && turk(r)).slice(0, 3), ...havuz.filter(r => r.k === "Makale").slice(0, 2),
    ...havuz.filter(r => r.k === "Tez").slice(0, 1)].slice(0, 5);
  const paragraf = havuz.length
    ? `${etiket === "Son 48 saat" ? "Son 48 saatte" : "Dün"} arkeoloji gündeminde ${parca.join(", ").replace(/, ([^,]*)$/, " ve $1")} öne çıktı.`
    : "Dünden bu yana yeni kayıt gelmedi.";
  const sesli = [`${selam}. Harrix Arkeoloji Bülteni, dünün özeti.`, paragraf,
    ...oneCikanlar.map((r, i) => `${i + 1}. ${r.k}: ${String(baslikGoster(r)).replace(/\.$/, "")}.`)];
  return { selam, etiket, havuz, paragraf, oneCikanlar, sesli };
}

/* ---------------------------------------------------------------- sözler (bülten + kendi eklediğiniz) */
function sayfaSozler() {
  const ozel = D.ozelSozler || [];
  $("#sayfa").innerHTML = `
    <div class="grup"><h3>Söz ekle</h3>
      <textarea class="not-alani" id="yeni-soz" rows="3" placeholder="Bir arkeoloji sözü, ardından isterseniz — Söyleyen"></textarea>
      <p style="margin:10px 0 0"><button class="buyuk-dugme" id="soz-ekle">Sözü ekle</button></p>
      <p class="aciklama">Eklediğiniz sözler bu cihazda saklanır, yedeğe girer ve "Günün sözü"nde sırayla çıkar.</p></div>
    ${ozel.length ? `<div class="grup"><h3>Sizin sözleriniz</h3><div class="kutu">${ozel.map((z, i) => `<div class="satir soz-satir"><span>${esc(z)}</span>
      <button class="ikincil-dugme" data-soz-sil="${i}" aria-label="Sözü sil">Sil</button></div>`).join("")}</div></div>` : ""}
    <div class="grup"><h3>Bültenin sözleri</h3><div class="kutu">${SOZLER.map(z => `<div class="satir soz-satir"><span>${esc(z)}</span></div>`).join("")
      || '<p class="aciklama" style="padding:12px">Sözler yüklenemedi.</p>'}</div></div>`;
  $("#soz-ekle").onclick = () => {
    const m = $("#yeni-soz").value.replace(/\s+/g, " ").replace(/["“”]/g, "").trim();
    if (m.length < 8) { bildir("Sözü yazın"); return; }
    if (tumSozler().includes(m)) { bildir("Bu söz zaten var"); return; }
    D.ozelSozler = [m, ...ozel]; kaydet(); bildir("Söz eklendi"); rota(true);
  };
  $("#sayfa").querySelectorAll("[data-soz-sil]").forEach(b => b.onclick = () => {
    D.ozelSozler = ozel.filter((_, i) => i !== Number(b.dataset.sozSil)); kaydet(); bildir("Söz silindi"); rota(true);
  });
}

function suzulmus(temel) {
  const q = katla(S.arama.trim());
  return temel.filter(r =>
    (!S.tur || r.k === S.tur) &&
    (!S.donem || (r.e || []).includes(S.donem)) &&
    (!S.dil || (S.dil === "diger" ? !["tr", "en"].includes(r.l || "") : r.l === S.dil)) &&
    (!q || katla([r.b, r.bt, r.o, r.ot, r.y, r.w].join(" ")).includes(q)));
}

function sayfaAkis(temel, baslikMetni, secenek = {}) {
  const donemler = VERI.kavramlar.filter(k => k.grup === "Dönem" && temel.some(r => r.e.includes(k.id)));
  const sonuc = suzulmus(temel);
  $("#sayfa").innerHTML = (secenek.modDugmesi ? modDugmesiHtml() : "") + `
    <div class="bolumlu" role="group" aria-label="Tür">${["", ...TURLER].map(t =>
      `<button data-tur="${t}" aria-pressed="${S.tur === t}">${t ? (t === "Rapor" ? "Rapor" : t) : "Tümü"}</button>`).join("")}</div>
    <div class="arama-kutu"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>
      <input id="ara" type="search" placeholder="${esc(secenek.aramaYeri || "Başlık, yazar, özet içinde ara")}" value="${esc(S.arama)}" enterkeyhint="search" autocomplete="off"></div>
    <div class="suzgec" role="group" aria-label="Dil">
      ${[["", "Her dil"], ["tr", "Türkçe"], ["en", "İngilizce"], ["diger", "Diğer diller"]].map(([d, ad]) =>
        `<button class="cip" data-dil="${d}" aria-pressed="${S.dil === d}">${ad}</button>`).join("")}
    </div>
    ${donemler.length ? `<div class="suzgec" role="group" aria-label="Dönem">
      <button class="cip" data-donem="" aria-pressed="${!S.donem}">Bütün dönemler</button>
      ${donemler.map(k => `<button class="cip" data-donem="${k.id}" aria-pressed="${S.donem === k.id}">${esc(k.ad)}</button>`).join("")}
    </div>` : ""}
    <div id="sonuclar">${sonuclarHtml(sonuc, secenek)}</div>`;
  const yenile = () => { gosterilecek = 60; $("#sonuclar").innerHTML = sonuclarHtml(suzulmus(temel), secenek); kaydirmaBagla(); };
  $("#sayfa").querySelectorAll("[data-tur]").forEach(b => b.onclick = () => { S.tur = b.dataset.tur; titres(); rota(); });
  $("#sayfa").querySelectorAll("[data-dil]").forEach(b => b.onclick = () => { S.dil = b.dataset.dil; titres(); rota(); });
  $("#sayfa").querySelectorAll("[data-donem]").forEach(b => b.onclick = () => { S.donem = b.dataset.donem; titres(); rota(); });
  let zaman;
  $("#ara").addEventListener("input", e => { S.arama = e.target.value; clearTimeout(zaman); zaman = setTimeout(yenile, 180); });
  if (secenek.odakla) $("#ara").focus();
  if (secenek.modDugmesi) modDugmesiBagla();
  void baslikMetni;
}
function sonuclarHtml(sonuc, secenek) {
  if (!sonuc.length) {
    return S.arama || S.tur || S.dil || S.donem
      ? bosHtml("Bu süzgeçlerle kayıt yok", "Süzgeçlerden birini kaldırmayı deneyin.", `<button class="ikincil-dugme" id="suzgec-sifirla">Süzgeçleri temizle</button>`)
      : bosHtml(secenek.bosBaslik || "Kayıt yok", secenek.bosMetin || "");
  }
  const parca = sonuc.slice(0, gosterilecek);
  return tabakalarHtml(parca, secenek) + (sonuc.length > gosterilecek
    ? `<p style="text-align:center;margin:18px"><button class="ikincil-dugme" id="daha">${sonuc.length - gosterilecek} kayıt daha göster</button></p>` : "");
}
document.addEventListener("click", e => {
  if (e.target.id === "daha") { gosterilecek += 80; rota(true); }
  if (e.target.id === "suzgec-sifirla") { Object.assign(S, { tur: "", dil: "", donem: "", arama: "" }); rota(); }
});

/* ---------------------------------------------------------------- tüm literatür (OpenAlex)
 * Bülten yalnız son günlerin yayınlarını toplar. Burada tarih sınırı olmadan bütün
 * yıllardaki makale, tez ve kitaplarda aranır (OpenAlex; YÖK tezleri ve DergiPark dahil). */
const L = { q: "", tur: "", donem: "", sirala: "ilgi", acik: false, ids: [], toplam: 0, sayfa: 0, yukleniyor: false, hata: "", aranan: "" };
const LIT_TUR = { "": "", Makale: "type:article|review", Tez: "type:dissertation", Kitap: "type:book|book-chapter" };
const LIT_SIRA = { ilgi: "relevance_score:desc", yeni: "publication_date:desc", atif: "cited_by_count:desc" };

function modDugmesiHtml() {
  return `<div class="bolumlu mod-secici" role="group" aria-label="Arama alanı">
    <button data-mod="bulten" aria-pressed="${S.mod !== "lit"}">Bülten</button>
    <button data-mod="lit" aria-pressed="${S.mod === "lit"}">Tüm literatür</button></div>`;
}
function modDugmesiBagla() {
  $("#sayfa").querySelectorAll("[data-mod]").forEach(b => b.onclick = () => { S.mod = b.dataset.mod; titres(); rota(); });
}

/* Türkçe yazılan aramayı OpenAlex'te İngilizce yayınları da bulacak biçime getirir:
 * "Göbeklitepe taş alet" → ("göbekli tepe" OR Göbeklitepe) AND ("taş alet" OR lithic OR "stone tools") */
const TERIM_SOZLUK = [
  ["alt paleolitik", '"Lower Palaeolithic" OR "Lower Paleolithic"'], ["orta paleolitik", '"Middle Palaeolithic" OR "Middle Paleolithic"'],
  ["üst paleolitik", '"Upper Palaeolithic" OR "Upper Paleolithic"'], ["paleolitik", "Palaeolithic OR Paleolithic"],
  ["epipaleolitik", "Epipalaeolithic OR Epipaleolithic"], ["mezolitik", "Mesolithic"], ["neolitik", "Neolithic"],
  ["kalkolitik", "Chalcolithic"], ["tunç çağı", '"Bronze Age"'], ["demir çağı", '"Iron Age"'], ["hitit", "Hittite"],
  ["urartu", "Urartu OR Urartian"], ["frig", "Phrygian OR Phrygia"], ["likya", "Lycia OR Lycian"], ["lidya", "Lydia OR Lydian"],
  ["helenistik", "Hellenistic"], ["roma", "Roman"], ["bizans", "Byzantine"], ["osmanlı", "Ottoman"], ["selçuklu", "Seljuk"],
  ["göbeklitepe", '"Göbekli Tepe"'], ["göbekli tepe", '"Göbekli Tepe"'], ["karahantepe", "Karahantepe OR Karahan"], ["çatalhöyük", "Çatalhöyük OR Catalhoyuk"],
  ["taş alet", 'lithic OR "stone tools"'], ["yontmataş", 'lithic OR "chipped stone"'], ["el baltası", 'handaxe OR "hand axe"'],
  ["obsidyen", "obsidian"], ["çakmaktaşı", "flint OR chert"], ["seramik", "ceramics OR pottery"], ["çanak çömlek", "pottery OR ceramics"],
  ["mezar", "burial OR grave"], ["nekropol", "necropolis OR cemetery"], ["kazı", "excavation"], ["yüzey araştırması", 'survey'],
  ["anadolu", "Anatolia"], ["mağara", "cave"], ["höyük", "mound OR höyük"], ["antik dna", '"ancient DNA" OR aDNA'],
  ["radyokarbon", "radiocarbon"], ["tarihlendirme", "dating OR chronology"], ["epigrafi", "epigraphy OR inscription"], ["yazıt", "inscription"],
  ["sikke", "coins OR numismatics"], ["nümizmatik", "numismatics OR coins"], ["zooarkeoloji", "zooarchaeology OR faunal"],
  ["arkeobotanik", "archaeobotany OR archaeobotanical"], ["mozaik", "mosaic"], ["heykel", "sculpture OR statue"],
  ["tapınak", "temple OR sanctuary"], ["sur", "fortification OR city wall"], ["kale", "fortress OR citadel"], ["iskelet", "skeletal OR skeleton"],
];
const ARAMA_DOLGU = new Set(["ve", "veya", "ile", "için", "son", "yıl", "yılı", "olan", "hakkında", "makale", "makaleler", "tez", "tezler", "ara", "bul", "üzerine", "dair"]);
function terimGenislet(metin) {
  let kalan = " " + metin.toLocaleLowerCase("tr").replace(/[(),"]/g, " ") + " ";
  const gruplar = [], eslesen = [];
  for (const [tr, en] of TERIM_SOZLUK.slice().sort((a, b) => b[0].length - a[0].length)) {
    const i = kalan.indexOf(" " + tr);
    if (i < 0) continue;
    const son = kalan.indexOf(" ", i + 1 + tr.length);         // ekler: "kazısı", "mezarları"
    const kelime = kalan.slice(i + 1, son).trim();
    gruplar.push(`(${kelime.includes(" ") ? `"${kelime}"` : kelime} OR ${en})`); eslesen.push(tr);
    kalan = kalan.slice(0, i) + " " + kalan.slice(son);
  }
  if (!gruplar.length) return { sorgu: metin.trim(), aciklama: "" };
  const diger = kalan.split(/\s+/).filter(w => w.length > 2 && !ARAMA_DOLGU.has(w));
  return { sorgu: [...gruplar, ...diger].join(" AND "), aciklama: `İngilizce yayınlar da aranıyor: ${eslesen.join(", ")}` };
}
function litSorgu() {
  const k = L.donem && KAVRAM.get(L.donem);
  const donem = k ? (k.q || `"${k.en}"`) : "";
  const ham = L.q.trim();
  const g = /\b(AND|OR|NOT)\b|"/.test(ham) ? { sorgu: ham, aciklama: "" } : terimGenislet(ham);   // kendi sorgusunu yazana dokunma
  L.aciklama = g.aciklama;
  const q = g.sorgu;
  return q && donem ? `(${q}) AND (${donem})` : (q || donem);
}

async function sha1Kisa(metin) {
  const b = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(metin));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("").slice(0, 20);
}
function oaOzet(inv) {
  if (!inv) return "";
  const s = [];
  for (const [w, yerler] of Object.entries(inv)) for (const i of yerler) s[i] = w;
  return s.filter(Boolean).join(" ");
}
async function oaKayit(w) {
  const doi = (w.doi || "").replace("https://doi.org/", "");
  const loc = w.primary_location || {};
  const url = w.doi || loc.landing_page_url || w.id;
  const anahtar = doi ? doi.toLowerCase() : url.split("?")[0].replace(/\/+$/, "").toLowerCase();
  const id = await sha1Kisa(anahtar);           // masaüstü ve bültenle aynı kimlik
  if (DIZIN.has(id)) return DIZIN.get(id);
  const tur = w.type === "dissertation" ? "Tez" : /^(book|book-chapter|monograph|edited-book)$/.test(w.type) ? "Kitap" : "Makale";
  const yazarlar = (w.authorships || []).slice(0, 8).map(a => (a.author || {}).display_name).filter(Boolean);
  let yer = (loc.source || {}).display_name || "";
  if (!yer && tur === "Tez") yer = (((w.authorships || [])[0] || {}).institutions || [{}])[0]?.display_name || "";
  const en = w.best_oa_location || {};
  const b = (w.display_name || "").replace(/<[^>]+>/g, "");
  const o = oaOzet(w.abstract_inverted_index).slice(0, 1500);
  const r = {
    i: id, k: tur, s: "OpenAlex", b, y: yazarlar.join("; "), w: yer, t: w.publication_date || String(w.publication_year || ""),
    u: url, d: doi, o, e: donemBul(b + " " + o), p: en.pdf_url || loc.pdf_url || "", l: (w.language || "").slice(0, 2),
    g: "", lit: 1, atif: w.cited_by_count || 0,
    ku: { yazarlar: yazarlar.map(ad => { const p = ad.trim().split(/\s+/); return [p.pop() || "", p.join(" ")]; }), yayin: yer,
          cilt: (w.biblio || {}).volume || "", sayi: (w.biblio || {}).issue || "",
          sayfa: [(w.biblio || {}).first_page, (w.biblio || {}).last_page].filter(Boolean).join("–"), universite: tur === "Tez" ? yer : "" },
  };
  DIZIN.set(id, r);
  return r;
}
/* Başlık/özetten dönem etiketleri: bültenin kavram listesindeki TR ve EN adlarla basit eşleme. */
function donemBul(metin) {
  const m = katla(metin);
  return VERI.kavramlar.filter(k => k.grup !== "Kazım" && [k.ad, k.en].some(t => t && m.includes(katla(t)))).map(k => k.id).slice(0, 4);
}

async function litAra(devam) {
  const sorgu = litSorgu();
  if (!sorgu) { bildir("Bir kelime yazın ya da bir dönem seçin"); return; }
  if (L.yukleniyor) return;
  L.yukleniyor = true; L.hata = "";
  if (!devam) { L.ids = []; L.sayfa = 0; L.toplam = 0; L.aranan = sorgu; }
  litCiz();
  const filtre = [LIT_TUR[L.tur], L.acik ? "is_oa:true" : ""].filter(Boolean).join(",");
  const p = new URLSearchParams({ search: L.aranan, "per-page": "25", page: String(L.sayfa + 1),
    select: "id,doi,display_name,publication_date,publication_year,type,language,cited_by_count,authorships,primary_location,best_oa_location,abstract_inverted_index,biblio" });
  if (filtre) p.set("filter", filtre);
  if (L.sirala !== "ilgi") p.set("sort", LIT_SIRA[L.sirala]);
  if (D.oaAnahtar) p.set("api_key", D.oaAnahtar);
  try {
    let y = await fetch("https://api.openalex.org/works?" + p);
    if (y.status === 503) { await new Promise(r => setTimeout(r, 2500)); y = await fetch("https://api.openalex.org/works?" + p); }
    if (y.status === 429 || y.status === 503) throw new Error("sinir");
    if (!y.ok) throw new Error(String(y.status));
    const j = await y.json();
    const kayitlar = await Promise.all((j.results || []).filter(w => w.display_name).map(oaKayit));
    for (const r of kayitlar) if (!L.ids.includes(r.i)) L.ids.push(r.i);
    L.toplam = (j.meta || {}).count || 0; L.sayfa += 1;
  } catch (e) {
    L.hata = e.message === "sinir" ? (D.oaAnahtar ? "Literatür arama sunucusu (OpenAlex) şu an yanıt vermiyor. Biraz sonra yeniden deneyin."
        : "Literatür arama sunucusu (OpenAlex) anahtarsız aramaları şu an durdurmuş ya da günlük ücretsiz sınır doldu. Biraz sonra yeniden deneyin ya da Ayarlar'a ücretsiz bir OpenAlex anahtarı girin.")
      : navigator.onLine ? "Arama yapılamadı. Biraz sonra yeniden deneyin." : "İnternet bağlantısı yok.";
  }
  L.yukleniyor = false;
  if (location.hash.startsWith("#akis") && S.mod === "lit") litCiz(true);
}

function litBaglantilar() {
  const q = encodeURIComponent(L.q.trim() || (L.donem && KAVRAM.get(L.donem) ? KAVRAM.get(L.donem).ad : ""));
  return `<div class="dis-baglantilar"><span>Başka yerde ara:</span>
    <a href="https://scholar.google.com/scholar?hl=tr&q=${q}" target="_blank" rel="noopener">Google Akademik</a>
    <a href="https://tez.yok.gov.tr/UlusalTezMerkezi/" target="_blank" rel="noopener">YÖK Tez</a>
    <a href="https://dergipark.org.tr/tr/search?q=${q}&section=articles" target="_blank" rel="noopener">DergiPark</a></div>`;
}

function litSonucHtml() {
  if (L.yukleniyor && !L.ids.length) return `<p class="aciklama" style="text-align:center;margin:24px">Aranıyor…</p>`;
  if (L.hata && !L.ids.length) return bosHtml("Arama yapılamadı", L.hata);
  if (!L.aranan) return bosHtml("Bütün literatürde arayın",
    "Bülten yalnız yeni yayınları toplar. Burada bütün yıllardaki makale, tez ve kitaplar aranır (OpenAlex; YÖK tezleri ve DergiPark dergilerinin çoğu dahil). Bir kelime yazın ya da dönem seçin.");
  if (!L.ids.length) return bosHtml("Sonuç yok", "Daha genel bir kelime ya da İngilizce karşılığını deneyin." + (L.aciklama ? " (" + L.aciklama + ")" : ""));
  const liste = kayitlarDen(L.ids);
  const daha = L.ids.length < Math.min(L.toplam, 10000);
  return `<p class="lit-sayi">${L.toplam.toLocaleString("tr-TR")} yayın · ${liste.length} gösteriliyor</p>
    ${L.aciklama ? `<p class="lit-sayi" style="margin-top:0">${esc(L.aciklama)}</p>` : ""}
    <ul class="liste">${liste.map(r => satirHtml(r, { litAlt: true })).join("")}</ul>
    ${L.hata ? `<p class="aciklama" style="text-align:center">${esc(L.hata)}</p>` : ""}
    ${daha ? `<p style="text-align:center;margin:18px"><button class="ikincil-dugme" id="lit-daha"${L.yukleniyor ? " disabled" : ""}>${L.yukleniyor ? "Yükleniyor…" : "Daha fazla sonuç"}</button></p>` : ""}`;
}

function litCiz(sadeceSonuc) {
  if (sadeceSonuc && $("#lit-sonuc")) { $("#lit-sonuc").innerHTML = litSonucHtml(); litSonucBagla(); kaydirmaBagla(); return; }
  sayfaLiteratur();
}
function litSonucBagla() {
  const d = $("#lit-daha"); if (d) d.onclick = () => litAra(true);
}

function sayfaLiteratur() {
  const donemler = VERI.kavramlar.filter(k => k.grup === "Dönem");
  $("#sayfa").innerHTML = modDugmesiHtml() + `
    <div class="bolumlu" role="group" aria-label="Tür">${["", "Makale", "Tez", "Kitap"].map(t =>
      `<button data-lit-tur="${t}" aria-pressed="${L.tur === t}">${t || "Tümü"}</button>`).join("")}</div>
    <form class="arama-kutu" id="lit-form"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>
      <input id="lit-q" type="search" placeholder="Konu, buluntu yeri, yazar… (ör. Karain, Levallois)" value="${esc(L.q)}" enterkeyhint="search" autocomplete="off">
      <button class="ara-git" type="submit">Ara</button></form>
    ${donemler.length ? `<div class="suzgec" role="group" aria-label="Dönem">
      <button class="cip" data-lit-donem="" aria-pressed="${!L.donem}">Her dönem</button>
      ${donemler.map(k => `<button class="cip" data-lit-donem="${k.id}" aria-pressed="${L.donem === k.id}">${esc(k.ad)}</button>`).join("")}
    </div>` : ""}
    <div class="suzgec" role="group" aria-label="Sıralama">
      ${[["ilgi", "En ilgili"], ["yeni", "En yeni"], ["atif", "En çok atıf"]].map(([k, ad]) =>
        `<button class="cip" data-lit-sira="${k}" aria-pressed="${L.sirala === k}">${ad}</button>`).join("")}
      <button class="cip" data-lit-acik aria-pressed="${L.acik}">Yalnız açık erişim</button>
    </div>
    ${litBaglantilar()}
    <div id="lit-sonuc">${litSonucHtml()}</div>`;
  modDugmesiBagla(); litSonucBagla();
  const yeniden = () => { titres(); if (litSorgu()) litAra(false); else sayfaLiteratur(); };
  $("#lit-form").onsubmit = e => { e.preventDefault(); L.q = $("#lit-q").value; $("#lit-q").blur(); litAra(false); };
  $("#lit-q").oninput = e => { L.q = e.target.value; };
  $("#sayfa").querySelectorAll("[data-lit-tur]").forEach(b => b.onclick = () => { L.tur = b.dataset.litTur; yeniden(); });
  $("#sayfa").querySelectorAll("[data-lit-donem]").forEach(b => b.onclick = () => { L.donem = b.dataset.litDonem; L.q = $("#lit-q").value; yeniden(); });
  $("#sayfa").querySelectorAll("[data-lit-sira]").forEach(b => b.onclick = () => { L.sirala = b.dataset.litSira; yeniden(); });
  $("#sayfa").querySelector("[data-lit-acik]").onclick = () => { L.acik = !L.acik; yeniden(); };
}

/* Ayrıntıda PDF'i olmayan DOI'li kayıt için yasal açık erişim kopyası arar (OpenAlex tekil sorgu, ücretsiz). */
async function acikKopyaAra(r) {
  bildir("Açık erişim kopyası aranıyor…");
  try {
    const w = await (await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(r.d)}?select=best_oa_location,open_access`)).json();
    const en = w.best_oa_location || {};
    const adres = en.pdf_url || en.landing_page_url || (w.open_access || {}).oa_url;
    if (adres) { r.p = en.pdf_url || ""; if (D.kayitlar[r.i]) D.kayitlar[r.i].p = r.p; kaydet(); window.open(adres, "_blank", "noopener"); rota(true); }
    else bildir("Yasal açık erişim kopyası bulunamadı. Yazara ya da kütüphanenize sorabilirsiniz.");
  } catch (e) { bildir("Bağlantı kurulamadı."); }
}

/* ---------------------------------------------------------------- ayrıntı */
function sayfaAyrinti(id) {
  const r = DIZIN.get(id);
  if (!r) { $("#sayfa").innerHTML = bosHtml("Kayıt bulunamadı", "Bu kayıt bültenden kaldırılmış olabilir."); return; }
  if (!D.okundu[r.i]) { D.okundu[r.i] = 1; kaydet(); rozetGuncelle(); }
  const yabanci = r.l && r.l !== "tr";
  const cevrili = yabanci && (r.bt || r.ot);
  const goster = { tr: cevrili, };
  const ciz = () => {
    const bas = goster.tr && r.bt ? r.bt : r.b;
    const ozet = goster.tr && r.ot ? r.ot : r.o;
    const etiketler = (r.e || []).filter(e => KAVRAM.has(e)).map(e => KAVRAM.get(e).ad);
    const satirlar = [
      ["Tür", r.k], ["Yazar", r.y], ["Yayın", r.w || r.s], ["Tarih", tarihYaz(r.t)],
      ["Dil", DIL_AD[r.l] || r.l], ["Dönem / konu", etiketler.join(", ")], ["DOI", r.d], ["Kaynak", r.s],
    ].filter(([, v]) => v);
    $("#sayfa").innerHTML = `<article class="ayrinti">
      <h2>${esc(bas)}</h2>
      ${goster.tr && r.bt ? `<p class="ceviri-not">Özgün başlık: ${esc(r.b)}</p>` : ""}
      <dl class="form-tablo">${satirlar.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      ${ozet ? `<div class="metin">${esc(ozet)}</div>` : `<p class="aciklama">Bu kayıt için özet yok.</p>`}
      ${goster.tr && r.ot ? `<p class="ceviri-not">Makine çevirisidir; alıntı yapmadan önce özgün metne bakın.</p>` : ""}
      ${(() => {
        const ad = r.k === "Makale" || r.k === "Tez" ? "Yayını aç" : "Haberi aç";
        if (!yabanci) return `<a class="buyuk-dugme" href="${esc(r.u)}" target="_blank" rel="noopener">${ad}</a>`;
        const tr = turkceAdres(r.u);
        return D.hepTurkce
          ? `<a class="buyuk-dugme" href="${esc(tr)}" target="_blank" rel="noopener">${ad} (Türkçe)</a>
             <p class="cift-bag"><a href="${esc(r.u)}" target="_blank" rel="noopener">Özgün dilinde aç</a></p>`
          : `<div class="iki-dugme"><a class="buyuk-dugme" href="${esc(r.u)}" target="_blank" rel="noopener">${ad}</a>
             <a class="buyuk-dugme ikinci" href="${esc(tr)}" target="_blank" rel="noopener">🌐 Türkçe aç</a></div>`;
      })()}
      <div class="eylemler">
        <button class="eylem" data-e="fav" aria-pressed="${D.fav.includes(r.i)}"><svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>Favori</button>
        ${yabanci ? `<button class="eylem" data-e="cevir" aria-pressed="${!!goster.tr}"><svg viewBox="0 0 24 24"><path d="M4 5h8M8 3v2m2 0c-1 4-3 7-6 9m2-5c1 2 3 4 5 5M13 21l4-10 4 10m-6.5-3h5"/></svg>${goster.tr ? "Özgün" : "Türkçe"}</button>` : ""}
        <button class="eylem" data-e="konu"><svg viewBox="0 0 24 24"><path d="M3 7h6l2 2h10v10H3z"/></svg>Konuya ekle</button>
        <button class="eylem" data-e="not" aria-pressed="${!!D.notlar[r.i]}"><svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5zM8 12h8M8 16h5"/></svg>Not</button>
        <button class="eylem" data-e="kaynakca" aria-pressed="${D.kaynakca.includes(r.i)}"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>Kaynakça</button>
        ${SES.destek ? `<button class="eylem" data-e="dinle"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6"/></svg>Dinle</button>` : ""}
        <button class="eylem" data-e="paylas"><svg viewBox="0 0 24 24"><path d="M12 15V3m-4 4l4-4 4 4M5 12v8h14v-8"/></svg>Paylaş</button>
        ${r.p ? `<a class="eylem" href="${esc(r.p)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M12 4v11m-4-4l4 4 4-4M5 20h14"/></svg>PDF</a>`
          : r.d ? `<button class="eylem" data-e="acik"><svg viewBox="0 0 24 24"><path d="M12 4v11m-4-4l4 4 4-4M5 20h14"/></svg>Açık kopya ara</button>` : ""}
        <button class="eylem" data-e="kunye"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>APA kopyala</button>
        <button class="eylem" data-e="zotero"><svg viewBox="0 0 24 24"><path d="M5 5h14L5 19h14"/></svg>Zotero'ya gönder</button>
        ${r.p ? `<button class="eylem" data-e="arsiv"><svg viewBox="0 0 24 24"><path d="M4 4h16v4H4zM6 8v12h12V8M10 12h4"/></svg>PDF'i arşive al</button>` : ""}
      </div>
      ${D.notlar[r.i] ? `<div class="kunye"><b>Notunuz:</b> ${esc(D.notlar[r.i])}</div>` : ""}
      <div class="kunye">${apaHtml(r)}</div>
    </article>`;
    $("#sayfa").querySelectorAll("[data-e]").forEach(b => b.onclick = () => eylem(b.dataset.e, r, ciz, goster));
  };
  ciz();
  // başlık bulutta çevrilmiş ama özet çevrilmemişse özeti cihazda çevir
  if (goster.tr && r.o && !r.ot) {
    cevir(r.o, r.l).then(t => { r.ot = t; if (location.hash === "#k/" + encodeURIComponent(r.i)) ciz(); }).catch(() => {});
  }
}

async function eylem(ad, r, ciz, goster) {
  titres();
  if (ad === "fav") { favDegistir(r); ciz(); }
  else if (ad === "acik") { acikKopyaAra(r); }
  else if (ad === "cevir") {
    if (!goster.tr && (!r.bt || (r.o && !r.ot))) {
      bildir("Çevriliyor…");
      try {
        if (!r.bt) r.bt = await cevir(r.b, r.l);
        if (r.o && !r.ot) r.ot = await cevir(r.o, r.l);
        if (kullaniliyorMu(r.i)) { D.kayitlar[r.i] = r; kaydet(); }
      } catch (e) { bildir("Çeviri servisine ulaşılamadı. Biraz sonra yeniden deneyin."); return; }
    }
    goster.tr = !goster.tr; ciz();
  }
  else if (ad === "konu") konuLevhasi(r);
  else if (ad === "not") notLevhasi(r, ciz);
  else if (ad === "kaynakca") {
    if (D.kaynakca.includes(r.i)) { D.kaynakca = D.kaynakca.filter(x => x !== r.i); kopyaTemizle(r.i); bildir("Kaynakçadan çıkarıldı"); }
    else { kopyala(r); D.kaynakca.push(r.i); bildir("Kaynakçaya eklendi"); }
    kaydet(); ciz();
  }
  else if (ad === "paylas") paylasLevhasi(kayitPaylasimi(r));
  else if (ad === "dinle") kaydiDinle(r);
  else if (ad === "kunye") panoya(apaDuz(r), "APA 7 künyesi kopyalandı");
  else if (ad === "zotero") zoteroyaGonder([r]);
  else if (ad === "arsiv") pdfIndirArsivle(r);
}

/* Yabancı sayfayı Google Çeviri ile Türkçe açar (sayfa düzeni korunur). */
function turkceAdres(u) {
  return `https://translate.google.com/translate?sl=auto&tl=tr&hl=tr&u=${encodeURIComponent(u)}`;
}

function favDegistir(r) {
  if (D.fav.includes(r.i)) { D.fav = D.fav.filter(x => x !== r.i); kopyaTemizle(r.i); bildir("Favorilerden çıkarıldı"); }
  else { kopyala(r); D.fav.unshift(r.i); bildir("Favorilere eklendi"); }
  kaydet();
}

/* Paylaşım: WhatsApp, Telegram, X, e-posta, kopyala ve telefonun kendi paylaşım menüsü */
function kayitPaylasimi(r) {
  const yer = [r.w || r.s, tarihYaz(r.t)].filter(Boolean).join(", ");
  const baslik = baslikGoster(r);
  return { baslik, url: r.u, metin: `${baslik}${yer ? "\n" + yer : ""}` };
}
const PAYLAS_IKON = {
  whatsapp: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1z"/><path d="M9 8.5c.5 2.7 2.8 5 5.5 5.5l1-1.4-1.8-.9-.8.8a4.6 4.6 0 0 1-2-2l.8-.8-.9-1.8z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l9-7"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M4 4l16 16M20 4L4 20"/></svg>',
  eposta: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  kopyala: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>',
  diger: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
};
function paylasLevhasi({ baslik, url, metin }) {
  const tam = url ? `${metin}\n${url}` : metin;
  const e = encodeURIComponent;
  const hedefler = [
    ["whatsapp", "WhatsApp", `https://wa.me/?text=${e(tam)}`],
    ["telegram", "Telegram", `https://t.me/share/url?url=${e(url || "")}&text=${e(metin)}`],
    ["x", "X", `https://x.com/intent/post?text=${e(metin)}${url ? "&url=" + e(url) : ""}`],
    ["eposta", "E-posta", `mailto:?subject=${e(baslik)}&body=${e(tam)}`],
  ];
  levhaAc(`<h3>Paylaş</h3>
    <p class="aciklama" style="margin:-6px 0 12px">${esc(baslik)}</p>
    <div class="paylas-izgara">
      ${hedefler.map(([k, ad, u]) => `<a class="paylas-hedef" data-k="${k}" href="${esc(u)}" target="_blank" rel="noopener">${PAYLAS_IKON[k]}<span>${ad}</span></a>`).join("")}
      <button class="paylas-hedef" id="pl-kopyala">${PAYLAS_IKON.kopyala}<span>Kopyala</span></button>
      ${navigator.share ? `<button class="paylas-hedef" id="pl-diger">${PAYLAS_IKON.diger}<span>Diğer</span></button>` : ""}
    </div>`, lv => {
    lv.querySelectorAll("a.paylas-hedef").forEach(a => a.addEventListener("click", () => setTimeout(levhaKapat, 300)));
    lv.querySelector("#pl-kopyala").onclick = () => { panoya(tam, "Kopyalandı"); levhaKapat(); };
    const d = lv.querySelector("#pl-diger");
    if (d) d.onclick = async () => { try { await navigator.share({ title: baslik, text: metin, url }); } catch (er) {} levhaKapat(); };
  });
}
async function panoya(metin, mesaj) {
  try { await navigator.clipboard.writeText(metin); bildir(mesaj); }
  catch (e) {
    const t = document.createElement("textarea"); t.value = metin; document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); bildir(mesaj); } catch (e2) { bildir("Kopyalanamadı"); }
    t.remove();
  }
}

/* Çeviri: bulut toplayıcı çevirmediyse cihazdan MyMemory'ye sorulur (ücretsiz, anahtarsız). */
async function cevir(metin, dil) {
  const parcalar = [];
  let p = "";
  for (const cumle of metin.split(/(?<=[.!?])\s+/)) {
    if ((p + " " + cumle).length > 450 && p) { parcalar.push(p); p = cumle; } else p = p ? p + " " + cumle : cumle;
  }
  if (p) parcalar.push(p);
  const sonuc = [];
  for (const parca of parcalar.slice(0, 8)) {
    const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(parca.slice(0, 480))}&langpair=${encodeURIComponent(dil || "en")}|tr`;
    const j = await (await fetch(u)).json();
    if (j.responseStatus !== 200 && j.responseStatus !== "200") throw new Error(j.responseDetails);
    sonuc.push(j.responseData.translatedText);
  }
  return sonuc.join(" ");
}

/* ---------------------------------------------------------------- levhalar */
function levhaAc(html, hazir) {
  $("#levha").innerHTML = html;
  $("#levha").hidden = false; $("#tabaka").hidden = false;
  if (hazir) hazir($("#levha"));
  const ilk = $("#levha").querySelector("input, textarea, button");
  if (ilk) setTimeout(() => ilk.focus(), 60);
}
function levhaKapat() { $("#levha").hidden = true; $("#tabaka").hidden = true; $("#levha").innerHTML = ""; }
$("#tabaka").addEventListener("click", levhaKapat);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#levha").hidden) levhaKapat(); });

function konuLevhasi(r) {
  levhaAc(`<h3>Konuya ekle</h3>
    <div class="kutu">${D.konular.map(k => `<button class="satir" data-konu="${k.id}">${esc(k.ad)}<span class="sag">${k.ids.includes(r.i) ? "✓ Ekli" : k.ids.length + " kayıt"}</span></button>`).join("")
      || '<p class="aciklama" style="padding:12px">Henüz konu yok. Aşağıdan ilk konuyu oluşturun.</p>'}</div>
    <div class="arama-kutu" style="margin:12px 0"><input id="yeni-konu" placeholder="Yeni konu adı (ör. Ankara Paleolitiği)" enterkeyhint="done"></div>
    <button class="buyuk-dugme" id="konu-olustur">Konuyu oluştur ve ekle</button>`, lv => {
    lv.querySelectorAll("[data-konu]").forEach(b => b.onclick = () => {
      const k = D.konular.find(x => x.id === b.dataset.konu);
      if (k.ids.includes(r.i)) { k.ids = k.ids.filter(x => x !== r.i); kopyaTemizle(r.i); bildir(`"${k.ad}" konusundan çıkarıldı`); }
      else { kopyala(r); k.ids.unshift(r.i); bildir(`"${k.ad}" konusuna eklendi`); }
      kaydet(); levhaKapat();
    });
    const olustur = () => {
      const ad = lv.querySelector("#yeni-konu").value.trim();
      if (!ad) { bildir("Konuya bir ad verin"); return; }
      kopyala(r);
      D.konular.push({ id: "k" + Date.now().toString(36), ad, not: "", ids: [r.i] });
      kaydet(); levhaKapat(); bildir(`"${ad}" konusu oluşturuldu`);
    };
    lv.querySelector("#konu-olustur").onclick = olustur;
    lv.querySelector("#yeni-konu").addEventListener("keydown", e => { if (e.key === "Enter") olustur(); });
  });
}

function notLevhasi(r, sonra) {
  levhaAc(`<h3>Not</h3><p class="aciklama" style="margin:-6px 0 10px">${esc(baslikGoster(r))}</p>
    <textarea class="not-alani" id="not-metni" placeholder="Bu kayıtla ilgili notunuz…">${esc(D.notlar[r.i] || "")}</textarea>
    <p style="display:flex;gap:8px;margin:12px 0 0"><button class="buyuk-dugme" id="not-kaydet">Notu kaydet</button></p>
    ${D.notlar[r.i] ? '<p style="text-align:center"><button class="ikincil-dugme" id="not-sil">Notu sil</button></p>' : ""}`, lv => {
    lv.querySelector("#not-kaydet").onclick = () => {
      const m = lv.querySelector("#not-metni").value.trim();
      if (m) { kopyala(r); D.notlar[r.i] = m; } else { delete D.notlar[r.i]; kopyaTemizle(r.i); }
      kaydet(); levhaKapat(); bildir(m ? "Not kaydedildi" : "Not silindi"); sonra && sonra();
    };
    const sil = lv.querySelector("#not-sil");
    if (sil) sil.onclick = () => { delete D.notlar[r.i]; kopyaTemizle(r.i); kaydet(); levhaKapat(); bildir("Not silindi"); sonra && sonra(); };
  });
}

/* ---------------------------------------------------------------- kitaplık */
function kayitlarDen(ids) { return ids.map(id => DIZIN.get(id) || D.kayitlar[id]).filter(Boolean); }

function sayfaKitaplik() {
  const notlu = Object.keys(D.notlar);
  $("#sayfa").innerHTML = `
    <div class="grup"><h3>Toplananlar</h3><div class="kutu">
      <a class="satir" href="#favoriler">★ Favoriler<span class="sag">${D.fav.length}</span></a>
      <a class="satir" href="#notlar">Notlu kayıtlar<span class="sag">${notlu.length}</span></a>
      <a class="satir" href="#kaynakca">Kaynakçam (APA 7)<span class="sag">${D.kaynakca.length}</span></a>
      <a class="satir" href="#pdfler">PDF arşivim<span class="sag" id="pdf-sayi"></span></a>
      <a class="satir" href="#sozler">Arkeoloji sözleri<span class="sag">${tumSozler().length}</span></a>
    </div></div>
    <div class="grup"><h3>Konular</h3><div class="kutu">
      ${D.konular.map(k => `<a class="satir" href="#konu/${k.id}">${esc(k.ad)}<span class="sag">${k.ids.length}</span></a>`).join("")
        || '<p class="aciklama" style="padding:12px 14px">Bir kaydın ayrıntısında "Konuya ekle"ye dokunarak tez bölümlerinize ya da araştırma başlıklarınıza göre kayıt toplayabilirsiniz.</p>'}
    </div></div>`;
  pdfListe().then(l => { const e = $("#pdf-sayi"); if (e) e.textContent = l.length; }).catch(() => {});
}

function sayfaListe(ids, bos, secenek = {}) {
  const k = kayitlarDen(ids);
  $("#sayfa").innerHTML = k.length ? `<ul class="liste" style="margin-top:8px">${k.map(r => satirHtml(r, secenek)).join("")}</ul>` : bos;
}

function sayfaKonu(id) {
  const k = D.konular.find(x => x.id === id);
  if (!k) { location.hash = "#kitaplik"; return; }
  $("#baslik").textContent = k.ad;
  const liste = kayitlarDen(k.ids);
  $("#sayfa").innerHTML = `<div class="grup"><h3>Konu notu</h3>
      <textarea class="not-alani" id="konu-not" placeholder="Bu konuyla ilgili düşünceleriniz, yapılacaklar…">${esc(k.not)}</textarea>
      <p class="aciklama">Yazdıkça kaydedilir.</p></div>
    <div class="grup"><h3>${liste.length} kayıt</h3></div>
    ${liste.length ? `<ul class="liste">${liste.map(r => satirHtml(r)).join("")}</ul>` : bosHtml("Bu konu boş", "Bir kaydın ayrıntısında \"Konuya ekle\"ye dokunun.")}
    <div class="grup" style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="ikincil-dugme" id="konu-paylas">Paylaş</button>
      <button class="ikincil-dugme" id="konu-kaynakca">Kayıtları kaynakçaya ekle</button>
      <button class="ikincil-dugme" id="konu-adlandir">Yeniden adlandır</button>
      <button class="ikincil-dugme" id="konu-sil">Konuyu sil</button></div>`;
  let zaman;
  $("#konu-not").addEventListener("input", e => { clearTimeout(zaman); zaman = setTimeout(() => { k.not = e.target.value; kaydet(); }, 300); });
  $("#konu-paylas").onclick = () => paylasLevhasi({ baslik: k.ad, url: "",
    metin: `${k.ad}\n\n` + (k.not ? k.not + "\n\n" : "") + liste.map((r, i) => `${i + 1}. ${baslikGoster(r)}\n${r.u}`).join("\n\n") });
  $("#konu-kaynakca").onclick = () => {
    let n = 0;
    for (const r of liste) if (!D.kaynakca.includes(r.i)) { D.kaynakca.push(r.i); n++; }
    kaydet(); bildir(n ? `${n} kayıt kaynakçaya eklendi` : "Hepsi zaten kaynakçada");
  };
  $("#konu-adlandir").onclick = () => {
    const ad = prompt("Konunun yeni adı", k.ad);
    if (ad && ad.trim()) { k.ad = ad.trim(); kaydet(); rota(); }
  };
  $("#konu-sil").onclick = () => {
    if (!confirm(`"${k.ad}" konusu silinsin mi? Kayıtlar silinmez, yalnızca konu kaldırılır.`)) return;
    D.konular = D.konular.filter(x => x !== k); k.ids.forEach(kopyaTemizle); kaydet(); history.back();
  };
}

/* ---------------------------------------------------------------- kaynakça */
function yazarlarListesi(r) {
  if (r.ku && r.ku.yazarlar && r.ku.yazarlar.length) return r.ku.yazarlar.map(([soyad, ad]) => ({ soyad, ad }));
  return (r.y || "").split(";").map(s => s.trim()).filter(Boolean).map(t => {
    if (t.includes(",")) { const [s, a] = t.split(","); return { soyad: s.trim(), ad: (a || "").trim() }; }
    const p = t.split(/\s+/); return { soyad: p.pop(), ad: p.join(" ") };
  });
}
const basHarf = ad => (ad || "").split(/[\s-]+/).filter(Boolean).map(p => p[0].toLocaleUpperCase("tr") + ".").join(" ");
function apaParcalar(r) {
  if (r.a) return null;
  const y = yazarlarListesi(r).map(a => a.ad ? `${a.soyad}, ${basHarf(a.ad)}` : a.soyad);
  const yazar = y.length <= 1 ? (y[0] || "") : y.length === 2 ? `${y[0]}, & ${y[1]}` : `${y.slice(0, -1).join(", ")}, & ${y[y.length - 1]}`;
  const yil = (r.t || "").slice(0, 4) || "t.y.";
  const ku = r.ku || {};
  const doi = r.d ? `https://doi.org/${r.d.replace(/^https?:\/\/doi\.org\//, "")}` : r.u;
  if (r.k === "Tez") return [[`${yazar} (${yil}). `, 0], [r.b.replace(/\.$/, ""), 1], [` [${ku.tez_turu === "Doktora" ? "Doktora tezi" : "Yüksek lisans tezi"}${ku.universite || r.w ? ", " + (ku.universite || r.w) : ""}]. `, 0], [doi || "", 0]];
  if (r.k === "Kitap") return [[`${yazar} (${yil}). `, 0], [r.b.replace(/\.$/, ""), 1], [`. ${r.w ? r.w + ". " : ""}`, 0], [r.d ? doi : "", 0]];
  if (r.k === "Makale") {
    const p = [[`${yazar} (${yil}). ${r.b.replace(/\.$/, "")}. `, 0]];
    if (ku.yayin || r.w) { p.push([ku.yayin || r.w, 1]); if (ku.cilt) { p.push([", ", 0]); p.push([ku.cilt, 1]); } if (ku.sayi) p.push([`(${ku.sayi})`, 0]); if (ku.sayfa) p.push([`, ${ku.sayfa}`, 0]); p.push([". ", 0]); }
    p.push([doi || "", 0]); return p;
  }
  const t = (r.t || "").split("-").map(Number);
  const tarih = t[1] ? `${t[0]}, ${t[2] ? t[2] + " " : ""}${AYLAR[t[1] - 1]}` : yil;
  return yazar ? [[`${yazar} (${tarih}). `, 0], [r.b, 1], [`. ${r.w || r.s}. ${r.u}`, 0]] : [[r.b, 1], [` (${tarih}). ${r.w || r.s}. ${r.u}`, 0]];
}
function apaHtml(r) { const p = apaParcalar(r); return p ? p.map(([m, i]) => i ? `<i>${esc(m)}</i>` : esc(m)).join("") : r.a; }
function apaDuz(r) { const d = document.createElement("div"); d.innerHTML = apaHtml(r); return d.textContent; }
function apaSirala(liste) { return liste.slice().sort((a, b) => apaDuz(a).localeCompare(apaDuz(b), "tr")); }

function ris(liste) {
  return liste.map(r => {
    const tur = r.k === "Makale" ? "JOUR" : r.k === "Tez" ? "THES" : "ELEC";
    const s = [`TY  - ${tur}`, ...yazarlarListesi(r).map(a => `AU  - ${a.soyad}${a.ad ? ", " + a.ad : ""}`), `TI  - ${r.b}`];
    if (r.t) s.push(`PY  - ${r.t.slice(0, 4)}`);
    const ku = r.ku || {};
    if (r.k === "Makale" && (ku.yayin || r.w)) s.push(`JO  - ${ku.yayin || r.w}`);
    if (ku.cilt) s.push(`VL  - ${ku.cilt}`); if (ku.sayi) s.push(`IS  - ${ku.sayi}`);
    if (r.k === "Tez" && (ku.universite || r.w)) s.push(`PB  - ${ku.universite || r.w}`);
    if (r.d) s.push(`DO  - ${r.d}`);
    if (r.u) s.push(`UR  - ${r.u}`);
    if (r.o) s.push(`AB  - ${r.o.replace(/\s+/g, " ")}`);
    s.push("ER  - ");
    return s.join("\r\n");
  }).join("\r\n\r\n");
}
function bibtex(liste) {
  const kul = new Set();
  return liste.map(r => {
    const y = yazarlarListesi(r);
    let anahtar = katla((y[0] || {}).soyad || "kayit").replace(/[^a-z0-9]/g, "") + ((r.t || "").slice(0, 4) || "ty");
    while (kul.has(anahtar)) anahtar += "a"; kul.add(anahtar);
    const tur = r.k === "Makale" ? "article" : r.k === "Tez" ? (r.ku && r.ku.tez_turu === "Doktora" ? "phdthesis" : "mastersthesis") : "online";
    const a = { author: y.map(x => `${x.soyad}${x.ad ? ", " + x.ad : ""}`).join(" and "), title: r.b, year: (r.t || "").slice(0, 4) };
    if (tur === "article") a.journal = (r.ku && r.ku.yayin) || r.w;
    if (tur.endsWith("thesis")) a.school = (r.ku && r.ku.universite) || r.w;
    if (r.d) a.doi = r.d; if (r.u) a.url = r.u;
    return `@${tur}{${anahtar},\n` + Object.entries(a).filter(([, v]) => v).map(([k, v]) => `  ${k} = {${String(v).replace(/[{}]/g, "")}}`).join(",\n") + "\n}";
  }).join("\n\n");
}
function dosyaIndir(ad, icerik, tur) {
  const blob = new Blob([icerik], { type: tur });
  const dosya = new File([blob], ad, { type: tur });
  if (navigator.canShare && navigator.canShare({ files: [dosya] })) {
    navigator.share({ files: [dosya], title: ad }).catch(() => {});
    return;
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = ad;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function sayfaKaynakca() {
  const liste = apaSirala(kayitlarDen(D.kaynakca));
  $("#sayfa").innerHTML = `
    <div class="grup" style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="ikincil-dugme" id="kc-paylas" ${liste.length ? "" : "disabled"}>Paylaş</button>
      <button class="ikincil-dugme" id="kc-kopyala" ${liste.length ? "" : "disabled"}>Tümünü kopyala</button>
      <button class="ikincil-dugme" id="kc-ris" ${liste.length ? "" : "disabled"}>RIS (Zotero, Mendeley)</button>
      <button class="ikincil-dugme" id="kc-bib" ${liste.length ? "" : "disabled"}>BibTeX</button>
      <button class="ikincil-dugme" id="kc-zotero" ${liste.length ? "" : "disabled"}>Zotero'ya gönder</button>
      <button class="ikincil-dugme" id="kc-doi">DOI ile ekle</button>
    </div>
    ${liste.length ? `<div class="grup"><h3>APA 7, alfabetik</h3>${liste.map(r => `
      <div class="kunye" data-id="${esc(r.i)}">${apaHtml(r)}
        <div style="margin-top:6px;display:flex;gap:14px;font-size:.8rem"><a href="#k/${encodeURIComponent(r.i)}">Ayrıntı</a>
        <a href="#" data-cikar="${esc(r.i)}">Kaynakçadan çıkar</a></div></div>`).join("")}</div>`
      : bosHtml("Kaynakçanız boş", "Bir yayının ayrıntısında \"Kaynakça\"ya dokunun ya da DOI ile ekleyin.")}`;
  if (liste.length) {
    $("#kc-kopyala").onclick = () => panoya(liste.map(apaDuz).join("\n\n"), `${liste.length} künye kopyalandı`);
    $("#kc-paylas").onclick = () => paylasLevhasi({ baslik: "Kaynakça", url: "", metin: "Kaynakça (APA 7)\n\n" + liste.map(apaDuz).join("\n\n") });
    $("#kc-ris").onclick = () => dosyaIndir("kaynakca.ris", ris(liste), "application/x-research-info-systems");
    $("#kc-bib").onclick = () => dosyaIndir("kaynakca.bib", bibtex(liste), "application/x-bibtex");
    $("#kc-zotero").onclick = () => zoteroyaGonder(liste);
  }
  $("#kc-doi").onclick = doiLevhasi;
  $("#sayfa").querySelectorAll("[data-cikar]").forEach(a => a.onclick = e => {
    e.preventDefault(); const id = a.dataset.cikar;
    D.kaynakca = D.kaynakca.filter(x => x !== id); kopyaTemizle(id); kaydet(); rota();
  });
}

function doiLevhasi() {
  levhaAc(`<h3>DOI ile ekle</h3>
    <div class="arama-kutu" style="margin:0 0 12px"><input id="doi" placeholder="10.xxxx/… ya da doi.org bağlantısı" inputmode="url" autocapitalize="off"></div>
    <button class="buyuk-dugme" id="doi-ekle">Künyeyi getir ve ekle</button>
    <p class="aciklama">Künye Crossref'ten alınır. DergiPark makalelerinin çoğunda DOI vardır.</p>`, lv => {
    lv.querySelector("#doi-ekle").onclick = async () => {
      const doi = lv.querySelector("#doi").value.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
      if (!/^10\.\S+\/\S+/.test(doi)) { bildir("Geçerli bir DOI yazın (10. ile başlar)"); return; }
      bildir("Crossref'e soruluyor…");
      try {
        const j = await (await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)).json();
        const m = j.message;
        const parca = ((m.issued || {})["date-parts"] || [[]])[0];
        const r = {
          i: "doi-" + doi.toLowerCase(), k: /thesis|dissertation/.test(m.type) ? "Tez" : "Makale", s: "Crossref",
          b: (m.title || [""])[0], y: (m.author || []).map(a => a.family ? `${a.family}, ${a.given || ""}` : a.name).join("; "),
          w: (m["container-title"] || [""])[0], t: parca.filter(Boolean).map(n => String(n).padStart(2, "0")).join("-"),
          u: `https://doi.org/${doi}`, d: doi, o: (m.abstract || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          e: [], l: "", g: new Date().toISOString(),
          ku: { yazarlar: (m.author || []).map(a => [a.family || a.name || "", a.given || ""]), yayin: (m["container-title"] || [""])[0],
                cilt: m.volume || "", sayi: m.issue || "", sayfa: m.page || "" },
        };
        D.kayitlar[r.i] = r; DIZIN.set(r.i, r);
        if (!D.kaynakca.includes(r.i)) D.kaynakca.push(r.i);
        kaydet(); levhaKapat(); bildir("Kaynakçaya eklendi"); rota();
      } catch (e) { bildir("Bu DOI Crossref'te bulunamadı ya da bağlantı yok."); }
    };
  });
}

/* ---------------------------------------------------------------- ayarlar */
const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const kurulu = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function kurulumIpucuHtml() {
  if (kurulu() || !D.kurulumIpucu) return "";
  const metin = iOS
    ? "Uygulama gibi kullanmak için Safari'de Paylaş düğmesine, sonra “Ana Ekrana Ekle”ye dokunun."
    : kurulumOlayi ? "" : "Uygulama gibi kullanmak için tarayıcı menüsünden “Ana ekrana ekle”yi seçin.";
  return `<div class="grup"><div class="kutu" style="padding:12px 14px">
    ${kurulumOlayi ? `<button class="buyuk-dugme" id="kur">Ana ekrana ekle</button>` : `<p style="margin:0">${metin}</p>`}
    <p style="margin:8px 0 0;text-align:right"><a href="#" id="ipucu-kapat" style="font-size:.85rem">Bir daha gösterme</a></p></div></div>`;
}
document.addEventListener("click", async e => {
  if (e.target.id === "ipucu-kapat") { e.preventDefault(); D.kurulumIpucu = false; kaydet(); rota(); }
  if (e.target.id === "kur" && kurulumOlayi) { kurulumOlayi.prompt(); await kurulumOlayi.userChoice; kurulumOlayi = null; rota(); }
});
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); kurulumOlayi = e; if (location.hash === "#bugun" || !location.hash) rota(true); });

function sayfaAyarlar() {
  const bildirimDestek = "Notification" in window && "serviceWorker" in navigator;
  $("#sayfa").innerHTML = `${typeof hesapGrubuHtml === "function" ? hesapGrubuHtml() : ""}
    <div class="grup"><h3>Görünüm</h3><div class="kutu">
      <label class="satir">Tema<select id="tema"><option value="oto">Telefona uy</option><option value="acik">Açık</option><option value="koyu">Koyu</option></select></label>
      <label class="satir">Toprak rengi<select id="palet"><option value="kum">Kum</option><option value="lacivert">Lacivert</option><option value="zeytin">Zeytin</option><option value="murdum">Mürdüm</option></select></label>
      <label class="satir">Yazı boyutu<select id="yazi"><option value="0.9">Küçük</option><option value="1">Normal</option><option value="1.12">Büyük</option><option value="1.25">Çok büyük</option></select></label>
    </div></div>
    <div class="grup"><h3>Çeviri</h3><div class="kutu">
      <label class="satir">Yabancı sayfaları Türkçe aç<input type="checkbox" class="anahtar" id="hep-turkce" ${D.hepTurkce ? "checked" : ""}></label>
    </div><p class="aciklama">Açıkken İngilizce ve diğer dillerdeki haber ve makale sayfaları Google Çeviri ile Türkçe açılır. Kapalıyken yabancı kayıtlarda ayrıca "Türkçe aç" düğmesi görünür. Başlık ve özetler her durumda uygulama içinde Türkçe gösterilir.</p></div>
    ${SES.destek ? `<div class="grup"><h3>Sesli okuma</h3><div class="kutu">
      <label class="satir">Okuma hızı<select id="ses-hiz"><option value="0.8">Yavaş</option><option value="1">Normal</option><option value="1.2">Hızlı</option><option value="1.4">Çok hızlı</option></select></label>
      ${SES.turkceSesler().length > 1 ? `<label class="satir">Ses<select id="ses-sec" style="max-width:60%"><option value="">Otomatik (en iyisi)</option>
        ${SES.turkceSesler().map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)}</option>`).join("")}</select></label>` : ""}
      <button class="satir" id="ses-dene">Sesi dene<span class="sag">${esc(SES.sesAdi() || "Türkçe ses yok")}</span></button>
    </div><p class="aciklama">Özetler ve haberler telefonun kendi Türkçe sesiyle, internet olmadan okunur. Türkçe ses yoksa telefonun ayarlarından (Android: Metin okuma çıkışı; iPhone: Erişilebilirlik › Seslendirilen İçerik › Sesler) Türkçe ses indirin. Ekran kapanınca okuma çoğu telefonda durur.</p></div>` : ""}
    <div class="grup"><h3>Literatür araması</h3><div class="kutu">
      <label class="satir">OpenAlex anahtarı<input id="oa-anahtar" type="password" autocomplete="off" placeholder="isteğe bağlı" value="${esc(D.oaAnahtar)}" style="max-width:55%"></label>
    </div><p class="aciklama">Tüm literatür araması anahtarsız da çalışır, ama OpenAlex yoğun saatlerde anahtarsız aramaları durdurabiliyor. openalex.org'dan ücretsiz alınan anahtarı buraya yazarsanız arama kesintisiz olur. Anahtar yalnız bu telefonda saklanır.</p></div>
    <div class="grup"><h3>Zotero</h3><div class="kutu">
      <label class="satir">Kullanıcı kimliği<input id="zt-kullanici" inputmode="numeric" autocomplete="off" placeholder="ör. 1234567" value="${esc(D.zoteroKullanici)}" style="max-width:55%"></label>
      <label class="satir">API anahtarı<input id="zt-anahtar" type="password" autocomplete="off" placeholder="yazma izinli anahtar" value="${esc(D.zoteroAnahtar)}" style="max-width:55%"></label>
      <button class="satir" id="zt-dene">Bağlantıyı dene</button>
    </div><p class="aciklama">Kaynakçanızı ve tek tek kayıtları Zotero kütüphanenize gönderir. zotero.org › Settings › Security sayfasında "Your user ID" numarasını görürsünüz; aynı sayfadan "Allow write access" işaretli yeni bir anahtar oluşturun. Anahtar yalnız bu cihazda saklanır.</p></div>
    <div class="grup"><h3>Bildirimler</h3><div class="kutu">
      <label class="satir">Yeni kayıt gelince haber ver<input type="checkbox" class="anahtar" id="bildirim-ac" ${D.bildirim && bildirimDestek && Notification.permission === "granted" ? "checked" : ""} ${bildirimDestek ? "" : "disabled"}></label>
    </div><p class="aciklama">${bildirimDestek
      ? (iOS ? "iPhone'da bildirimler yalnızca uygulama ana ekrana eklendiyse çalışır (iOS 16.4 ve sonrası). Uygulama simgesindeki sayı yeni kayıtları gösterir."
             : "Android'de uygulama ana ekrana eklendiğinde Chrome, bülteni arka planda günde birkaç kez yoklayıp yeni kayıt varsa bildirir.")
      : "Bu tarayıcı bildirimleri desteklemiyor."}</p></div>
    <div class="grup"><h3>Bülten</h3><div class="kutu">
      <a class="satir" href="#durum">Kaynakların durumu<span class="sag">${esc(saatYaz(VERI.guncelleme))}</span></a>
      <button class="satir" id="yenile">Şimdi yenile</button>
    </div><p class="aciklama">Kayıtlar her gün 06.17, 12.17, 18.17 ve 00.17'de GitHub'da toplanır: OpenAlex, Crossref, DergiPark, Google Haberler ve Bundle'daki haber siteleri.</p></div>
    <div class="grup"><h3>Verileriniz</h3><div class="kutu">
      <button class="satir" id="yedek-al">Yedeği dışa aktar<span class="sag">${D.fav.length + D.kaynakca.length + Object.keys(D.notlar).length} öge</span></button>
      <label class="satir" style="cursor:pointer">Yedeği içe aktar<input type="file" id="yedek-yukle" accept="application/json,.json" hidden></label>
    </div><p class="aciklama">Favoriler, konular, notlar ve kaynakça yalnızca bu telefonda tutulur. Telefon değiştirirken yedeği dışa aktarıp yenisine yükleyin.</p></div>
    <div class="grup"><h3>Hakkında</h3><div class="kutu">
      <div class="satir">Harrix Arkeoloji Bülteni<span class="sag">${SURUM}</span></div>
      <a class="satir" style="color:inherit" href="mailto:harrixapp@gmail.com?subject=${encodeURIComponent("Harrix Bülten")}">Destek ve iletişim<span class="sag">harrixapp@gmail.com</span></a>
      <a class="satir" style="color:inherit" href="https://www.instagram.com/harrixapp/" target="_blank" rel="noopener">Instagram<span class="sag">@harrixapp</span></a>
      <a class="satir" style="color:inherit" href="#yasal">Kullanım koşulları ve KVKK</a>
    </div><p class="aciklama">Soru, öneri ve sorunlar için Harrix ekibine yazabilirsiniz.</p></div>`;
  if (typeof hesapGrubuBagla === "function") hesapGrubuBagla();
  const sec = (id, deger, isle) => { const s = $("#" + id); s.value = String(deger); s.onchange = () => { isle(s.value); kaydet(); temaUygula(); }; };
  $("#oa-anahtar").onchange = e => { D.oaAnahtar = e.target.value.trim(); kaydet(); bildir(D.oaAnahtar ? "OpenAlex anahtarı kaydedildi" : "OpenAlex anahtarı kaldırıldı"); };
  $("#zt-kullanici").onchange = e => { D.zoteroKullanici = e.target.value.replace(/\D/g, ""); kaydet(); };
  $("#zt-anahtar").onchange = e => { D.zoteroAnahtar = e.target.value.trim(); kaydet(); };
  $("#zt-dene").onclick = async () => {
    D.zoteroKullanici = $("#zt-kullanici").value.replace(/\D/g, ""); D.zoteroAnahtar = $("#zt-anahtar").value.trim(); kaydet();
    if (!D.zoteroKullanici || !D.zoteroAnahtar) { bildir("Kullanıcı kimliğini ve anahtarı yazın"); return; }
    bildir("Deneniyor…");
    bildir(await zoteroDene() ? "Zotero bağlantısı çalışıyor" : "Zotero bağlanamadı; kimliği ve anahtarı kontrol edin");
  };
  $("#hep-turkce").onchange = e => { D.hepTurkce = e.target.checked; kaydet(); bildir(D.hepTurkce ? "Yabancı sayfalar Türkçe açılacak" : "Sayfalar özgün dilinde açılacak"); };
  sec("tema", D.tema, v => D.tema = v);
  sec("palet", D.palet, v => D.palet = v);
  sec("yazi", D.yazi, v => D.yazi = Number(v));
  if ($("#ses-hiz")) {
    sec("ses-hiz", D.sesHiz || 1, v => D.sesHiz = Number(v));
    $("#ses-dene").onclick = () => SES.oku(["Merhaba. Harrix Arkeoloji Bülteni sesli okuma böyle duyulur. Milattan önce 9600 yılına tarihlenen yapılar."], "Ses denemesi");
    if ($("#ses-sec")) { $("#ses-sec").value = D.sesId || ""; $("#ses-sec").onchange = e => { D.sesId = e.target.value; kaydet(); rota(true); }; }
  }
  $("#yenile").onclick = async () => { bildir("Yenileniyor…"); if (await veriYukle(true)) bildir(`Bülten ${saatYaz(VERI.guncelleme)} tarihli`); };
  $("#bildirim-ac").onchange = async e => {
    if (e.target.checked) {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") { e.target.checked = false; bildir("Bildirim izni verilmedi. Telefon ayarlarından açabilirsiniz."); return; }
      D.bildirim = true; await arkaPlanKaydi();
      bildir("Yeni kayıtlar için bildirim açık");
    } else D.bildirim = false;
    kaydet();
  };
  $("#yedek-al").onclick = () => dosyaIndir(`harrix-bulten-yedek-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify({ uygulama: "harrix-bulten", surum: 1, fav: D.fav, notlar: D.notlar, konular: D.konular, kaynakca: D.kaynakca, kayitlar: D.kayitlar, okundu: D.okundu, ozelSozler: D.ozelSozler }), "application/json");
  $("#yedek-yukle").onchange = async e => {
    try {
      const y = JSON.parse(await e.target.files[0].text());
      if (y.uygulama !== "harrix-bulten") throw new Error();
      D.fav = [...new Set([...D.fav, ...(y.fav || [])])];
      D.kaynakca = [...new Set([...D.kaynakca, ...(y.kaynakca || [])])];
      Object.assign(D.notlar, y.notlar || {}); Object.assign(D.kayitlar, y.kayitlar || {}); Object.assign(D.okundu, y.okundu || {});
      for (const k of y.konular || []) if (!D.konular.some(x => x.id === k.id)) D.konular.push(k);
      D.ozelSozler = [...new Set([...(D.ozelSozler || []), ...(y.ozelSozler || [])])];
      for (const id in D.kayitlar) if (!DIZIN.has(id)) DIZIN.set(id, D.kayitlar[id]);
      kaydet(); bildir("Yedek yüklendi"); rota();
    } catch (err) { bildir("Bu dosya bir Bülten yedeği değil."); }
  };
}

async function sayfaDurum() {
  $("#sayfa").innerHTML = bosHtml("Yükleniyor", "");
  try {
    const d = await (await fetch("veri/durum.json", { cache: "no-cache" })).json();
    const sirali = d.kaynaklar.slice().sort((a, b) => (!!b.hata - !!a.hata) || b.adet - a.adet);
    $("#sayfa").innerHTML = `<p class="ozet">Son toplama ${esc(saatYaz(d.guncelleme))}: ${d.kaynak_sayisi} kaynak tarandı, <b>${d.yeni} yeni kayıt</b> geldi${d.hatali_kaynak ? `, ${d.hatali_kaynak} kaynağa ulaşılamadı` : ""}.</p>
      <div class="grup"><div class="kutu">${sirali.map(s => `<div class="satir" style="align-items:flex-start">
        <span style="min-width:0">${esc(s.ad)}${s.hata ? `<br><small style="color:var(--rapor)">${esc(s.hata)}</small>` : ""}</span>
        <span class="sag">${s.hata ? "hata" : s.adet}</span></div>`).join("")}</div></div>`;
  } catch (e) { $("#sayfa").innerHTML = bosHtml("Durum bilgisi alınamadı", "İnternet bağlantınızı kontrol edin."); }
}

/* Android Chrome: kurulu uygulama arka planda bülteni yoklar (Periodic Background Sync). */
async function arkaPlanKaydi() {
  try {
    const kayit = await navigator.serviceWorker.ready;
    if ("periodicSync" in kayit) {
      const izin = await navigator.permissions.query({ name: "periodic-background-sync" });
      if (izin.state === "granted") await kayit.periodicSync.register("bulten-yokla", { minInterval: 6 * 3600 * 1000 });
    }
    navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage({ tur: "esik", deger: VERI.guncelleme });
  } catch (e) { /* desteklemeyen tarayıcılar sessizce geçer */ }
}

/* ---------------------------------------------------------------- Zotero (Web API v3; anahtar yalnız bu cihazda) */
function zoteroOge(r) {
  const tur = r.k === "Makale" ? "journalArticle" : r.k === "Tez" ? "thesis" : r.k === "Kitap" ? "book" : "webpage";
  const ku = r.ku || {};
  const o = { itemType: tur, title: r.b, abstractNote: r.o || "", date: r.t || "", url: r.u || "", language: r.l || "",
    creators: yazarlarListesi(r).map(y => ({ creatorType: "author", firstName: y.ad || "", lastName: y.soyad || "" })),
    tags: (r.e || []).filter(e => KAVRAM.has(e)).map(e => ({ tag: KAVRAM.get(e).ad })) };
  if (tur === "journalArticle") Object.assign(o, { publicationTitle: ku.yayin || r.w || "", volume: ku.cilt || "", issue: ku.sayi || "", pages: ku.sayfa || "", DOI: r.d || "" });
  else if (tur === "thesis") Object.assign(o, { university: ku.universite || r.w || "", thesisType: ku.tez_turu === "Doktora" ? "Doktora tezi" : "Yüksek lisans tezi" });
  else if (tur === "book") Object.assign(o, { publisher: r.w || "" });
  else Object.assign(o, { websiteTitle: r.w || r.s || "" });
  return o;
}
const zoteroBaslik = () => ({ "Zotero-API-Version": "3", "Zotero-API-Key": D.zoteroAnahtar });
async function zoteroDene() {
  try { return (await fetch(`https://api.zotero.org/users/${encodeURIComponent(D.zoteroKullanici)}/items?limit=1`, { headers: zoteroBaslik() })).ok; }
  catch (e) { return false; }
}
async function zoteroyaGonder(liste) {
  if (!D.zoteroKullanici || !D.zoteroAnahtar) { bildir("Önce Ayarlar › Zotero'ya kullanıcı kimliğinizi ve anahtarınızı yazın"); location.hash = "#ayarlar"; return; }
  bildir(liste.length > 1 ? `${liste.length} kayıt Zotero'ya gönderiliyor…` : "Zotero'ya gönderiliyor…");
  let tamam = 0, hata = 0;
  try {
    for (let i = 0; i < liste.length; i += 50) {
      const y = await fetch(`https://api.zotero.org/users/${encodeURIComponent(D.zoteroKullanici)}/items`, {
        method: "POST", headers: { ...zoteroBaslik(), "Content-Type": "application/json" }, body: JSON.stringify(liste.slice(i, i + 50).map(zoteroOge)) });
      if (y.status === 403) throw new Error("izin");
      if (!y.ok) throw new Error(String(y.status));
      const j = await y.json();
      tamam += Object.keys(j.successful || {}).length; hata += Object.keys(j.failed || {}).length;
    }
    bildir(hata ? `${tamam} kayıt Zotero'ya gönderildi, ${hata} kayıt gönderilemedi` : `${tamam} kayıt Zotero kütüphanenize eklendi`);
  } catch (e) {
    bildir(e.message === "izin" ? "Zotero anahtarının yazma izni yok. zotero.org'da \"Allow write access\" ile yeni anahtar oluşturun." : "Zotero'ya ulaşılamadı. Biraz sonra yeniden deneyin.");
  }
}

/* ---------------------------------------------------------------- PDF arşivi (bu cihazda, IndexedDB) */
function pdfDb() {
  return new Promise((ok, red) => {
    const q = indexedDB.open("harrix-pdf", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("pdfler", { keyPath: "id" });
    q.onsuccess = () => ok(q.result); q.onerror = () => red(q.error);
  });
}
async function pdfIslem(kip, f) {
  const db = await pdfDb();
  return new Promise((ok, red) => {
    const t = db.transaction("pdfler", kip); const st = t.objectStore("pdfler");
    const q = f(st); t.oncomplete = () => ok(q && q.result); t.onerror = () => red(t.error);
  });
}
const pdfListe = async () => ((await pdfIslem("readonly", st => st.getAll())) || []).sort((a, b) => b.tarih.localeCompare(a.tarih));
const pdfKaydet = o => pdfIslem("readwrite", st => st.put(o));
const pdfSil = id => pdfIslem("readwrite", st => st.delete(id));
async function pdfEkleDosya(dosya, kayit) {
  if (!dosya || !/pdf$/i.test(dosya.type || dosya.name)) { bildir("Yalnız PDF dosyası eklenebilir"); return false; }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  await pdfKaydet({ id: "p" + Date.now().toString(36), ad: kayit ? baslikGoster(kayit) : dosya.name.replace(/\.pdf$/i, ""),
    boyut: dosya.size, tarih: new Date().toISOString(), kayitId: kayit ? kayit.i : "", blob: dosya });
  return true;
}
async function pdfIndirArsivle(r) {
  bildir("PDF indiriliyor…");
  try {
    const y = await fetch(r.p, { mode: "cors" });
    const tur = y.headers.get("content-type") || "";
    if (!y.ok || !/pdf|octet-stream/i.test(tur)) throw new Error();
    const blob = await y.blob();
    await pdfEkleDosya(new File([blob], "makale.pdf", { type: "application/pdf" }), r);
    bildir("PDF arşivinize kaydedildi; internetsiz de açılır");
  } catch (e) {
    levhaAc(`<h3>PDF doğrudan alınamadı</h3>
      <p class="aciklama">Yayıncının sitesi PDF'in uygulama içinden indirilmesine izin vermiyor. PDF'i açıp telefona indirin, sonra buradan seçerek arşive ekleyin.</p>
      <p style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
        <a class="buyuk-dugme" href="${esc(r.p)}" target="_blank" rel="noopener">PDF'i aç</a>
        <label class="buyuk-dugme ikinci" style="cursor:pointer">İndirdiğim PDF'i seç<input type="file" accept="application/pdf,.pdf" hidden id="arsiv-sec"></label></p>`, lv => {
      lv.querySelector("#arsiv-sec").onchange = async e => { if (await pdfEkleDosya(e.target.files[0], r)) { levhaKapat(); bildir("PDF arşivinize eklendi"); } };
    });
  }
}
const boyutYaz = b => b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
async function sayfaPdfler() {
  let liste = [];
  try { liste = await pdfListe(); } catch (e) { $("#sayfa").innerHTML = bosHtml("PDF arşivi açılamadı", "Bu tarayıcı cihazda dosya saklamaya izin vermiyor (gizli sekme olabilir)."); return; }
  $("#sayfa").innerHTML = `
    <div class="grup"><label class="buyuk-dugme" style="cursor:pointer">PDF ekle<input type="file" id="pdf-ekle" accept="application/pdf,.pdf" multiple hidden></label>
      <p class="aciklama">Kendi PDF'lerinizi ve açık erişim makaleleri bu cihazda saklayın; internet olmadan açılır. Arşiv hesabınıza eşitlenmez ve yedeğe girmez.</p></div>
    ${liste.length ? `<div class="grup"><h3>${liste.length} PDF · ${boyutYaz(liste.reduce((t, p) => t + p.boyut, 0))}</h3><div class="kutu">${liste.map(p => `
      <div class="satir pdf-satir"><button class="pdf-ac" data-pdf-ac="${p.id}"><span>${esc(p.ad)}</span><small>${tarihYaz(p.tarih.slice(0, 10))} · ${boyutYaz(p.boyut)}</small></button>
        ${p.kayitId ? `<a class="ikincil-dugme" href="#k/${encodeURIComponent(p.kayitId)}">Kayıt</a>` : ""}
        <button class="ikincil-dugme" data-pdf-sil="${p.id}" aria-label="PDF'i sil">Sil</button></div>`).join("")}</div></div>`
      : bosHtml("Arşiviniz boş", "Yukarıdan PDF ekleyin ya da PDF'i olan bir yayının ayrıntısında \"PDF'i arşive al\"a dokunun.")}`;
  $("#pdf-ekle").onchange = async e => { let n = 0; for (const f of e.target.files) if (await pdfEkleDosya(f)) n++; if (n) bildir(`${n} PDF eklendi`); rota(true); };
  $("#sayfa").querySelectorAll("[data-pdf-ac]").forEach(b => b.onclick = () => {
    const p = liste.find(x => x.id === b.dataset.pdfAc);
    const url = URL.createObjectURL(p.blob);
    const w = window.open(url, "_blank");
    if (!w) location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  $("#sayfa").querySelectorAll("[data-pdf-sil]").forEach(b => b.onclick = async () => {
    const p = liste.find(x => x.id === b.dataset.pdfSil);
    if (!confirm(`"${p.ad}" arşivden silinsin mi?`)) return;
    await pdfSil(p.id); bildir("PDF silindi"); rota(true);
  });
}

/* ---------------------------------------------------------------- kullanım koşulları ve KVKK */
function sayfaYasal() {
  $("#sayfa").innerHTML = `<article class="ayrinti yasal">
    <h2>Kullanım koşulları</h2>
    <p>Harrix Arkeoloji Bülteni; açık akademik veritabanlarından (OpenAlex, Crossref, DergiPark) ve kamuya açık haber kaynaklarından derlenen arkeoloji başlıklarını, özetlerini ve bağlantılarını sunar. İçeriklerin telif hakları özgün yayıncılarına aittir; uygulama yalnızca kaynağa bağlantı, künye ve kişisel araştırma araçları sağlar. Makine çevirileri yardımcıdır; alıntı yapmadan önce özgün metne bakın.</p>
    <h2>KVKK aydınlatma metni</h2>
    <p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu Harrix'tir (harrixapp@gmail.com).</p>
    <ul>
      <li>Giriş yapmadan kullandığınızda favorileriniz, notlarınız, konularınız, kaynakçanız, PDF arşiviniz ve ayarlarınız yalnızca bu cihazda saklanır; hiçbir sunucuya gönderilmez.</li>
      <li>İsteğe bağlı olarak giriş yaptığınızda e-posta adresiniz (Google ile girişte adınız) ve favori, konu, not ve kaynakça listeleriniz yalnızca cihazlarınız arasında eşitleme amacıyla Firebase (Google Cloud) altyapısında işlenir.</li>
      <li>OpenAlex, Zotero ve çeviri servislerine yalnızca sizin başlattığınız aramalar ve gönderimler iletilir. OpenAlex ve Zotero anahtarlarınız bu cihazda kalır.</li>
      <li>Kanunun 11. maddesindeki haklarınızı kullanmak için harrixapp@gmail.com adresine yazabilirsiniz. Verilerinizi Ayarlar › Yedeği dışa aktar ile alabilir, Ayarlar › Hesabı sil ile hesabınızı ve buluttaki bütün verilerinizi kalıcı olarak silebilirsiniz.</li>
    </ul></article>`;
}

/* ---------------------------------------------------------------- yana kaydırma: favori */
function kaydirmaBagla() {
  document.querySelectorAll(".kayit-ic").forEach(el => {
    if (el.dataset.bagli) return; el.dataset.bagli = 1;
    let x0 = 0, y0 = 0, dx = 0, aktif = false, yatay = null;
    el.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; aktif = true; yatay = null; }, { passive: true });
    el.addEventListener("touchmove", e => {
      if (!aktif) return;
      const ddx = e.touches[0].clientX - x0, ddy = e.touches[0].clientY - y0;
      if (yatay === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) yatay = Math.abs(ddx) > Math.abs(ddy) && ddx < 0;
      if (!yatay) return;
      dx = Math.max(-140, Math.min(0, ddx));
      el.style.transition = "none"; el.style.transform = `translateX(${dx}px)`;
    }, { passive: true });
    el.addEventListener("touchend", () => {
      aktif = false; el.style.transition = ""; el.style.transform = "";
      if (yatay && dx < -90) {
        const r = DIZIN.get(el.closest(".kayit").dataset.id);
        if (r) { titres(14); favDegistir(r); setTimeout(() => rota(true), 200); }
      }
    });
    el.addEventListener("click", e => { if (yatay && Math.abs(dx) > 6) e.preventDefault(); });
  });
}

/* ---------------------------------------------------------------- yönlendirme */
const UST = { bugun: "Bugün", akis: "Yayınlar", kitaplik: "Kitaplık", ayarlar: "Ayarlar", giris: "Giriş",
  favoriler: "Favoriler", notlar: "Notlu kayıtlar", kaynakca: "Kaynakçam", durum: "Kaynakların durumu", ara: "Ara", konu: "Konu", k: "",
  sozler: "Arkeoloji sözleri", pdfler: "PDF arşivim", yasal: "Koşullar ve KVKK" };
const ALT_SAYFA = { giris: "ayarlar", favoriler: "kitaplik", notlar: "kitaplik", kaynakca: "kitaplik", konu: "kitaplik", durum: "ayarlar", k: null, ara: "akis",
  sozler: "kitaplik", pdfler: "kitaplik", yasal: "ayarlar" };
let sonSekme = "bugun";

function rota(kaydirmayiKoru) {
  const y = window.scrollY;
  const h = decodeURIComponent(location.hash.slice(1)) || "bugun";
  const [ad, ...kalan] = h.split("/");
  const arg = kalan.join("/");
  const sekme = ad in ALT_SAYFA ? (ALT_SAYFA[ad] || sonSekme) : ad;
  if (!(ad in ALT_SAYFA)) sonSekme = sekme;
  document.querySelectorAll("#sekmeler a").forEach(a => {
    if (a.dataset.sekme === sekme) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  $("#geri").hidden = !(ad in ALT_SAYFA);
  $("#baslik").textContent = UST[ad] ?? "Bülten";
  $("#ara-ac").hidden = ad !== "bugun" && ad !== "akis";
  levhaKapat();
  if (ad === "bugun") sayfaBugun();
  else if (ad === "akis") { if (S.mod === "lit") sayfaLiteratur(); else sayfaAkis(VERI.kayitlar, "Yayınlar", { modDugmesi: true }); }
  else if (ad === "ara") { sayfaAkis(VERI.kayitlar, "Ara", { odakla: !kaydirmayiKoru }); }
  else if (ad === "kazim") { location.replace("#bugun"); return; }
  else if (ad === "kitaplik") sayfaKitaplik();
  else if (ad === "favoriler") sayfaListe(D.fav, bosHtml("Favori yok", "Bir kaydı sola kaydırarak ya da ayrıntısındaki yıldıza dokunarak favorilere ekleyin."));
  else if (ad === "notlar") sayfaListe(Object.keys(D.notlar), bosHtml("Not yok", "Bir kaydın ayrıntısında \"Not\"a dokunun."), { not: true });
  else if (ad === "kaynakca") sayfaKaynakca();
  else if (ad === "konu") sayfaKonu(arg);
  else if (ad === "ayarlar") sayfaAyarlar();
  else if (ad === "giris") { if (typeof sayfaGiris === "function") sayfaGiris(); else location.replace("#ayarlar"); }
  else if (ad === "durum") sayfaDurum();
  else if (ad === "sozler") sayfaSozler();
  else if (ad === "pdfler") sayfaPdfler();
  else if (ad === "yasal") sayfaYasal();
  else if (ad === "k") sayfaAyrinti(arg);
  else { location.hash = "#bugun"; return; }
  kaydirmaBagla();
  window.scrollTo(0, kaydirmayiKoru ? y : 0);
}

$("#geri").addEventListener("click", () => { if (history.length > 1) history.back(); else location.hash = "#" + sonSekme; });
$("#ara-ac").addEventListener("click", () => { location.hash = "#ara"; });
window.addEventListener("hashchange", () => rota());
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    const onceki = VERI.guncelleme;
    if (await veriYukle(true) && VERI.guncelleme !== onceki) { bildir(`${VERI.yeni_sayisi} yeni kayıt geldi`); rota(true); }
  }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", temaUygula);

/* ---------------------------------------------------------------- başlangıç */
(async function baslat() {
  temaUygula();
  const acilis = $("#acilis");
  const sure = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 950;
  const bekle = new Promise(r => setTimeout(r, sure));
  await Promise.all([veriYukle(true), sozleriYukle(), bekle]);
  // ilk açılışta bir kez giriş ekranını göster (isteyen "Giriş yapmadan devam et" der)
  if (!D.girisSoruldu && !D.uid && window.FIREBASE_AYAR && window.FIREBASE_AYAR.apiKey) {
    D.girisSoruldu = true; kaydet();
    history.replaceState(null, "", "#bugun"); location.hash = "#giris";
  }
  rota();
  acilis.classList.add("bitti");
  setTimeout(() => acilis.remove(), 600);
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js"); if (D.bildirim) arkaPlanKaydi(); } catch (e) {}
  }
})();
