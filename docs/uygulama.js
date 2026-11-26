/* Arkix — telefon uygulaması (PWA)
 * Veri: veri/bulten.json (GitHub Actions günde 4 kez günceller).
 * Kişisel olanlar (favoriler, konular, notlar, kaynakça, okundu bilgisi) yalnızca bu cihazda,
 * tarayıcının yerel deposunda tutulur; hiçbir sunucuya gitmez.
 */
"use strict";

const SURUM = "1.25.0";
const DEPO_ANAHTARI = "harrix-bulten";
const TURLER = ["Makale", "Tez", "Haber", "Rapor"];
// Ekranda görünen adlar (dil değişince sayfa yeniden yüklenir, bu sabitler yeni dille kurulur)
const TUR_COGUL = { Makale: tx("Makaleler"), Tez: tx("Tezler"), Haber: tx("Haberler"), Rapor: tx("Raporlar") };
const DIL_AD = { tr: tx("Türkçe"), en: tx("İngilizce"), de: tx("Almanca"), fr: tx("Fransızca"), it: tx("İtalyanca"), es: tx("İspanyolca") };
const AYLAR = DIL === "en"
  ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  : ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const YEREL = DIL === "en" ? "en-GB" : "tr-TR";
/** Tür adı ekranda (veri değeri Türkçe kalır). */
const turAdi = k => tx(k);
/** Kavram (dönem/terim) adı: İngilizce arayüzde bülten verisindeki İngilizce karşılığı. */
const kavramAdi = k => (DIL === "en" ? k.en || k.ad : k.ad);

/* ---------------------------------------------------------------- sesli okuma */
// "Dünün özeti" toplayıcının doğal (nöral) sesle hazırladığı MP3'ten çalınır (veri/ozet.mp3).
// Diğer metinler cihazın en doğal Türkçe sesiyle okunur. Uzun metin cümle öbeklerine bölünür:
// bazı tarayıcılar 15 saniyeyi aşan tek konuşmayı yarıda keser.
const SES = {
  destek: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
  kuyruk: [], calisiyor: false, baslik: "", kusak: 0, calan: null,
  turkceSesler() {
    try {
      // Önce bulut/nöral sesler (Edge: "Microsoft Emel Online (Natural)", Chrome: "Google Türkçe"), sonra
      // cihazın gelişmiş sesleri (iPhone/Mac: Yelda Gelişmiş), en son sıradan sesler.
      const puan = v => (/online|natural|neural/i.test(v.name) ? 60 : 0) + (/premium|enhanced|gelişmiş|siri/i.test(v.name) ? 40 : 0)
        + (/google/i.test(v.name) ? 30 : 0) + (/emel|ahmet|yelda|cem|filiz|tolga|seda/i.test(v.name) ? 10 : 0);
      const dil = DIL === "en" ? /^en/i : /^tr/i;
      return speechSynthesis.getVoices().filter(v => dil.test(v.lang)).sort((a, b) => puan(b) - puan(a));
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
    this.kuyruk = this.obekler(metinler); this.baslik = baslik || tx("Sesli okuma"); this.calisiyor = true; this.kusak++;
    if (!this.ses()) bildir(tx("Telefonda Türkçe ses bulunamadı; varsayılan sesle okunuyor. Ayarlar › Sesli okuma'ya bakın."));
    this.cubuk(); this.sonraki(this.kusak);
  },
  /* Hazır MP3'ü çalar; çalınamazsa (internetsiz, eski dosya) yedek metni cihazın sesiyle okur. */
  mp3(adres, baslik, yedek) {
    this.durdur(true);
    const k = ++this.kusak, a = new Audio(adres);
    this.calan = a; this.baslik = baslik || tx("Sesli okuma"); this.calisiyor = true;
    const dus = () => { if (k !== this.kusak) return; this.calan = null; if (yedek && this.destek) this.oku(yedek, baslik); else this.durdur(); };
    a.onended = () => { if (k === this.kusak) this.durdur(); };
    a.onerror = dus;
    a.onpause = a.onplay = () => { if (k === this.kusak) this.cubuk(); };
    const p = a.play(); if (p && p.catch) p.catch(dus);
    this.cubuk();
  },
  sonraki(kusak) {
    if (kusak !== this.kusak) return;
    const m = this.kuyruk.shift();
    if (!m) { this.durdur(); return; }
    const u = new SpeechSynthesisUtterance(m);
    u.lang = DIL === "en" ? "en-GB" : "tr-TR"; u.rate = D.sesHiz || 1;
    const v = this.ses(); if (v) u.voice = v;
    u.onend = () => this.sonraki(kusak);
    u.onerror = e => { if (e.error !== "interrupted" && e.error !== "canceled") this.sonraki(kusak); };
    speechSynthesis.speak(u);
    this.cubuk();
  },
  durdur(sessiz) {
    this.kusak++; this.kuyruk = []; this.calisiyor = false;
    if (this.calan) { try { this.calan.pause(); } catch (e) {} this.calan = null; }
    try { speechSynthesis.cancel(); } catch (e) {}
    if (!sessiz) this.cubuk();
  },
  duraklat() {
    if (this.calan) { if (this.calan.paused) this.calan.play(); else this.calan.pause(); return; }
    if (speechSynthesis.paused) speechSynthesis.resume(); else speechSynthesis.pause(); this.cubuk();
  },
  atla() { if (this.calan) { this.durdur(); return; } try { speechSynthesis.cancel(); } catch (e) {} },   // onerror/onend sıradaki öbeğe geçer
  cubuk() {
    let c = document.getElementById("ses-cubuk");
    if (!this.calisiyor) { if (c) c.remove(); return; }
    if (!c) {
      c = document.createElement("div"); c.id = "ses-cubuk"; c.setAttribute("role", "region"); c.setAttribute("aria-label", tx("Sesli okuma"));
      c.innerHTML = `<span class="ses-baslik"></span><button data-s="d" aria-label="${tx("Duraklat")}"></button><button data-s="a" aria-label="${tx("Sonraki")}">⏭</button><button data-s="x" aria-label="${tx("Durdur")}">⏹</button>`;
      c.querySelector('[data-s="d"]').onclick = () => this.duraklat();
      c.querySelector('[data-s="a"]').onclick = () => this.atla();
      c.querySelector('[data-s="x"]').onclick = () => this.durdur();
      document.body.appendChild(c);
    }
    c.querySelector(".ses-baslik").textContent = "🔊 " + this.baslik;
    c.querySelector('[data-s="d"]').textContent = (this.calan ? this.calan.paused : this.destek && speechSynthesis.paused) ? "▶" : "⏸";
  },
};
/* Arkeoloji metnindeki kısaltmaları Türkçe sesin doğru okuyacağı biçime çevirir. */
function sesIcinTemizle(ham) {
  if (DIL === "en") return String(ham || "").replace(/https?:\/\/\S+/g, "").replace(/\bdoi:\s*\S+/gi, "").replace(/\[\d+(?:,\s*\d+)*\]/g, "").replace(/\s+/g, " ").trim();
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
  const bas = baslikGoster(r);
  let oz = yabanciMi(r) ? cevOzet(r) : (r.o || "");
  if (kisa && oz.length > 350) oz = oz.slice(0, 350).replace(/\s+\S*$/, "") + "…";
  return `${String(bas || "").replace(/\.$/, "")}. ${r.w || r.s ? `${tx("Kaynak")}: ${r.w || r.s}. ` : ""}${oz}`;
}
async function kaydiDinle(r) {
  if (yabanciMi(r) && (!cevBaslik(r) || (r.o && !cevOzet(r)))) {
    bildir(tx("Okumadan önce Türkçeye çevriliyor…"));
    try { if (!cevBaslik(r)) cevYaz(r, await cevir(r.b, r.l)); if (r.o && !cevOzet(r)) cevYaz(r, null, await cevir(r.o, r.l)); }
    catch (e) { bildir(tx("Çeviri servisine ulaşılamadı; kayıt Türkçe olmadığı için okunamıyor.")); return; }
  }
  SES.oku([okunacakMetin(r)], r.k === "Haber" ? tx("Haber okunuyor") : tx("Kayıt okunuyor"));
}
function bulteniDinle(kayitlar, ozet) {
  // okunacaklar arayüz dilinde: Türkçede Türkçe (ya da çevrilmiş), İngilizcede İngilizce kayıtlar
  const turkce = r => !yabanciMi(r) || !!cevBaslik(r);   // arayüz dilinde okunabilir
  const haber = kayitlar.filter(r => r.k === "Haber" && turkce(r)).slice(0, 8);
  const diger = kayitlar.filter(r => r.k !== "Haber" && turkce(r)).slice(0, 5);
  const atlanan = kayitlar.filter(r => !turkce(r)).length;
  const m = [String(ozet || "").trim()];
  if (haber.length) { m.push(tx("{n} haber okunacak.", { n: haber.length })); haber.forEach((r, i) => m.push(`${tx("Haber {n}.", { n: i + 1 })} ${okunacakMetin(r, true)}`)); }
  if (diger.length) { m.push(tx("Yeni yayınlardan başlıklar.")); diger.forEach((r, i) => m.push(`${i + 1}. ${TUR_COGUL[r.k] ? turAdi(r.k) : ""}: ${String((yabanciMi(r) && cevBaslik(r)) || r.b).replace(/\.$/, "")}.`)); }
  if (atlanan && DIL !== "en") m.push(`Türkçeye çevrilmemiş ${atlanan} yabancı kayıt okunmadı; ayrıntısında Dinle'ye basınca çevrilip okunur.`);
  if (!haber.length && !diger.length) m.push(tx("Okunacak Türkçe kayıt yok."));
  SES.oku(m, tx("Bülten okunuyor"));
}

/* ---------------------------------------------------------------- durum (yerel depo) */
const D = Object.assign({
  fav: [], okundu: {}, notlar: {}, konular: [], kaynakca: [], kayitlar: {},
  gorulen: "", tema: "oto", palet: "gobeklitepe", yazi: 1, bildirim: false, kurulumIpucu: true,
  uid: null, esitleme: 0, girisSoruldu: false, hepTurkce: false, desen: true, oaAnahtar: "", sesHiz: 1, sesId: "",
  ozelSozler: [], kvkkSurum: "", dil: DIL, zemin: "siluet", gunlukGun: "", profil: {}, temaSecildi: false, takip: [], takipGorulen: "", tanitimGoruldu: 0,
}, guvenliOku());
// arka plan: eski "desen" anahtarı kapalıysa sade. 1.11: tam ekran fotoğraf yerine Bugün'ün başında kart; arka plan çizim deseni
if (!("zemin" in guvenliOku()) && D.desen === false) D.zemin = "sade";
if ((D.zeminSurum || 0) < 3) { if (D.zemin !== "sade") D.zemin = "siluet"; D.zeminSurum = 3; }
// eski paletler ören yeri temalarına
if (typeof ESKI_PALET !== "undefined" && ESKI_PALET[D.palet]) D.palet = ESKI_PALET[D.palet];

function guvenliOku() {
  try { return JSON.parse(localStorage.getItem(DEPO_ANAHTARI)) || {}; } catch (e) { return {}; }
}
function kaydet() {
  try { localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(D)); }
  catch (e) { bildir(tx("Cihazda yer kalmadı; son değişiklik kaydedilemedi.")); }
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
    if (onceki && onceki !== v.guncelleme && !sessiz) bildir(tx("Bülten güncellendi: {n} yeni kayıt", { n: v.yeni_sayisi }));
    rozetGuncelle();
    return true;
  } catch (e) {
    if (!sessiz) bildir(tx("Bülten indirilemedi. İnternet bağlantınızı kontrol edin."));
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
/* Bağlantı adresi: http(s), mailto ve şemasız (uygulama içi) adresler geçer; javascript:, data: vb. "#" olur. */
const guvenliUrl = s => { s = String(s ?? "").trim(); return /^[a-z][a-z0-9+.-]*:/i.test(s) && !/^(https?|mailto):/i.test(s) ? "#" : s; };
const escUrl = s => esc(guvenliUrl(s));
const katla = s => String(s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
const titres = ms => { if (navigator.vibrate) try { navigator.vibrate(ms || 8); } catch (e) {} };

function tarihYaz(t) {
  if (!t) return "";
  const [y, a, g] = t.slice(0, 10).split("-").map(Number);
  if (!a) return String(y);
  if (DIL === "en") return g ? `${AYLAR[a - 1]} ${g}, ${y}` : `${AYLAR[a - 1]} ${y}`;
  return g ? `${g} ${AYLAR[a - 1]} ${y}` : `${AYLAR[a - 1]} ${y}`;
}
function gunAnahtari(r) { return (r.g || r.t || "").slice(0, 10); }
function gunEtiketi(gun) {
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const d = new Date(gun + "T00:00:00");
  const fark = Math.round((bugun - d) / 86400000);
  if (fark <= 0) return tx("Bugün");
  if (fark === 1) return tx("Dün");
  if (fark < 7) return d.toLocaleDateString(YEREL, { weekday: "long" });
  return tarihYaz(gun);
}
function saatYaz(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(YEREL, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
const yeniMi = r => !!ESIK && (r.g || "") > ESIK && !D.okundu[r.i];
// İngilizce arayüzde özgün başlık; Türkçede yabancı kaydın (varsa) Türkçe çevirisi
// Çeviri hedefi arayüz dilidir: Türkçe arayüzde Türkçe olmayanlar Türkçeye (bt/ot), İngilizce arayüzde İngilizce olmayanlar İngilizceye (be/oe)
const HEDEF = DIL === "en" ? "en" : "tr";
const HEDEF_AD = HEDEF === "en" ? "English" : "Türkçe";
const yabanciMi = r => !!r.l && r.l !== HEDEF;
const cevBaslik = r => (HEDEF === "en" ? r.be : r.bt) || "";
const cevOzet = r => (HEDEF === "en" ? r.oe : r.ot) || "";
const cevYaz = (r, b, o) => { if (b != null) r[HEDEF === "en" ? "be" : "bt"] = b; if (o != null) r[HEDEF === "en" ? "oe" : "ot"] = o; };
const baslikGoster = r => (yabanciMi(r) && cevBaslik(r)) || r.b;

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
  if (!D.palet || D.palet === "gobeklitepe") kok.removeAttribute("data-palet"); else kok.dataset.palet = D.palet;
  kok.style.setProperty("--yazi-olcek", D.yazi);
  const koyu = D.tema === "koyu" || (D.tema === "oto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const kagit = getComputedStyle(kok).getPropertyValue("--kagit").trim() || (koyu ? "#161916" : "#eef0e9");
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", kagit));
  kok.dataset.zemin = D.zemin;
  if (window.GUNLUK) GUNLUK.zemin(D.zemin);
}

/* ---------------------------------------------------------------- kayıt satırı */
function satirHtml(r, secenek = {}) {
  const tur = r.k || "Haber";
  const kaynak = r.k === "Haber" || r.k === "Rapor" ? (r.w || r.s) : (r.w || r.s);
  const yazar = r.y && ["Makale", "Tez", "Kitap"].includes(r.k) ? r.y.split(";").slice(0, 3).join(",") : "";
  const alt = secenek.not ? D.notlar[r.i] : secenek.litAlt
    ? [yazar, (r.t || "").slice(0, 4), r.atif ? tx("{n} atıf", { n: r.atif }) : ""].filter(Boolean).join(" · ")
    : (yazar || (yabanciMi(r) && cevOzet(r) ? cevOzet(r) : r.o));
  const etiketler = (r.e || []).filter(e => KAVRAM.has(e) && e !== "kazim").slice(0, 3)
    .map(e => `<span class="etiket">${esc(kavramAdi(KAVRAM.get(e)))}</span>`).join("");
  const dil = yabanciMi(r) ? `<span class="dil" title="${esc(DIL_AD[r.l] || r.l)}">${esc(r.l.toUpperCase())}</span>` : "";
  return `<li class="kayit${D.okundu[r.i] ? " okundu" : ""}${r.oz ? " ozel" : ""}" data-id="${esc(r.i)}">
    <div class="kaydirma-arka">${D.fav.includes(r.i) ? tx("Favoriden çıkar") : tx("Favorilere ekle")}</div>
    <a class="kayit-ic" href="#k/${encodeURIComponent(r.i)}">
      <div class="kayit-ust">${yeniMi(r) ? '<span class="yeni-nokta" title="Yeni"></span>' : ""}<span class="tur" data-tur="${esc(tur)}">${esc(turAdi(tur))}</span><span class="kaynak">${esc(kaynak || "")}</span>${r.ys ? `<span class="yorum-sayi" title="${tx("{n} yorum", { n: r.ys })}"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>${r.ys}</span>` : ""}${D.fav.includes(r.i) ? "<span aria-label='Favori'>★</span>" : ""}${dil}</div>
      ${r.oz && r.gv ? `<img class="kayit-kapak" src="${esc(r.gv)}" alt="" loading="lazy">` : ""}
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
  let i = 0, html = "", reklamSay = 0;
  const reklamli = !secenek.reklamsiz && reklamGoster();
  for (const [gun, liste] of gruplar) {
    const derinlik = Math.min(4, 1 + Math.floor(i / 2));
    html += `<section class="tabaka" data-derinlik="${derinlik}">
      <div class="tabaka-bas"><h2>${esc(gunEtiketi(gun))}</h2><small>${tx("{n} kayıt", { n: liste.length })}</small></div>
      <ul class="liste">${liste.map(r => satirHtml(r, secenek)).join("")}</ul></section>`;
    i++;
    if (reklamli && reklamSay < REKLAM.EN_FAZLA && i >= REKLAM.ILK_SONRA && (i - REKLAM.ILK_SONRA) % REKLAM.ARALIK === 0) {
      html += reklamYuvasiHtml(); reklamSay++;
    }
  }
  return html;
}

/* ---------------------------------------------------------------- reklam (Google AdSense; ayar reklam.js)
 * Yalnız REKLAM.ACIK ve yuva kimliği varken, KVKK onayından sonra. Kapalıyken Google'a hiçbir istek gitmez. */
function reklamAcik() { return !!(window.REKLAM && REKLAM.ACIK && REKLAM.ISTEMCI && REKLAM.YUVA); }
function reklamGoster() { return reklamAcik() && D.kvkkSurum === KVKK_SURUM; }
function reklamYuvasiHtml() {
  return `<aside class="reklam-yuva" aria-label="${tx("Reklam")}"><small>${tx("Reklam")}</small>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(REKLAM.ISTEMCI)}" data-ad-slot="${esc(REKLAM.YUVA)}"
      data-ad-format="auto" data-full-width-responsive="true"></ins></aside>`;
}
let reklamBetigi = null;
function reklamlariDoldur() {
  if (!reklamGoster()) return;
  const bos = [...document.querySelectorAll("ins.adsbygoogle:not([data-adsbygoogle-status])")];
  if (!bos.length) return;
  if (!reklamBetigi) {
    reklamBetigi = document.createElement("script");
    reklamBetigi.async = true; reklamBetigi.crossOrigin = "anonymous";
    reklamBetigi.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(REKLAM.ISTEMCI)}`;
    reklamBetigi.onerror = () => document.querySelectorAll(".reklam-yuva").forEach(y => y.remove());   // reklam engelleyici
    document.head.appendChild(reklamBetigi);
  }
  for (const _ of bos) { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_h) { /* yuva zaten dolu */ } }
}

function bosHtml(baslik, metin, dugme) {
  return `<div class="bos"><strong>${esc(baslik)}</strong>${esc(metin)}${dugme ? `<p>${dugme}</p>` : ""}</div>`;
}

/* ---------------------------------------------------------------- sayfalar */
const S = { tur: "", donem: "", dil: "", arama: "", kitaplik: "fav", mod: "bulten" };
let gosterilecek = 60;

function sayfaBugun() {
  const son = VERI.kayitlar.filter(r => (r.g || "").slice(0, 10) >= gunOnce(2));
  const yeni = VERI.kayitlar.filter(yeniMi);
  const b = VERI.banner;
  const sd = sonDakika();
  const ust = `
    ${window.GUNLUK ? GUNLUK.kahramanHtml({ baslik: tx("Günün Ören Yeri") }) : ""}
    ${b && b.aktif ? `<a class="harrix-banner" ${b.url ? `href="${escUrl(b.url)}" target="_blank" rel="noopener"` : ""}>
      <span class="banner-etiket">${esc(b.etiket || "HARRIX")}</span><span class="banner-metin"><b>${esc(b.baslik)}</b>${b.altBaslik ? `<small>${esc(b.altBaslik)}</small>` : ""}</span></a>` : ""}
    ${sd.length ? `<section class="son-dakika" aria-label="${tx("Son dakika ve öne çıkanlar")}"><h2><span class="nabiz" aria-hidden="true"></span>${tx("Son dakika ve öne çıkanlar")}</h2>
      <div class="sd-serit">${sd.map(d => `<a class="sd-kart${d.onemli ? " onemli" : ""}" href="${escUrl(d.adres)}" ${d.dis ? 'target="_blank" rel="noopener"' : ""}>
        <b>${esc(d.baslik)}</b><small>${esc(d.alt)}</small></a>`).join("")}</div></section>` : ""}
    ${VERI.guncelleme ? `<button class="katman-kart" id="anlat-ac" aria-label="${tx("Günün Katmanları")}">
      <span class="katman-simge" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="katman-yazi"><b>${tx("Günün Katmanları")}</b><small>${tx("Dünün {n} önemli gelişmesi, katman katman · dinle", { n: Math.max(1, sabahOzeti().oneCikanlar.length) })}</small></span><i class="katman-ok">›</i></button>` : ""}
    <a class="oyun-serit" href="#oyunlar"><span class="oyun-serit-tas"><i>K</i><i>A</i><i>Z</i></span><span><b>${tx("Günün oyunları")}</b><small>${tx("Kelime Kazısı · Kazı Başı · Katman Sırala")}</small></span><i class="katman-ok">›</i></a>
    <p class="ozet">${!VERI.guncelleme ? tx("Bülten henüz ilk kez toplanmadı.") : yeni.length
      ? tx("Son bakışınızdan beri {b}{n} yeni kayıt{/b} geldi.", { n: yeni.length, b: "<b>", "/b": "</b>" })
      : tx("Son iki günde {n} kayıt toplandı.", { n: son.length })}${VERI.guncelleme ? " " + tx("Bülten {saat} güncellendi.", { saat: esc(saatYaz(VERI.guncelleme)) }) : ""}
      <a href="#ozet">${tx("Özete git")} ›</a></p>
    ${kurulumIpucuHtml()}`;
  const liste = (yeni.length ? yeni : son).slice(0, 80);
  $("#sayfa").innerHTML = ust + (liste.length ? tabakalarHtml(liste)
    : bosHtml(tx("Henüz kayıt yok"), tx("Bülten ilk kez toplanıyor olabilir; birkaç dakika sonra yeniden bakın.")));
  const anlat = $("#anlat-ac"); if (anlat) anlat.onclick = gunuAnlat;
  const kahraman = document.querySelector(".gunluk-kahraman");
  if (kahraman) kahraman.addEventListener("click", e => {
    if (e.target.closest("a")) return;
    GUNLUK.acilis({ baslik: tx("Günün Ören Yeri"), dugme: tx("Kapat") }, "", () => {});
  });
  if (VERI.guncelleme && VERI.guncelleme > (D.gorulen || "")) { D.gorulen = VERI.guncelleme; kaydet(); }
}

/* Özet (çan): dünün özeti, son dakika, takip, tartışılanlar, Arkix Özel, sayaçlar ve günün sözü */
function sayfaOzet() {
  const soz = gununSozu();
  const so = sabahOzeti();
  const sinir = D.bildirimGoruldu || null;
  const ciz = () => {
    $("#sayfa").innerHTML = `
    ${VERI.guncelleme ? `<section class="sabah" aria-label="${tx("Dünün özeti")}">
      <div class="sabah-ust"><div><h2>${so.selam} · ${tx("Dünün özeti")}</h2><p>${esc(so.etiket)}</p></div>
        ${SES.destek && so.havuz.length ? `<button class="sabah-dinle" id="sabah-dinle"><svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>${tx("Dinle")}</button>` : ""}</div>
      <p class="sabah-metin">${esc(so.paragraf)}</p>
      ${so.oneCikanlar.length ? `<div class="ozet-kartlar">${so.oneCikanlar.slice(0, 6).map(r => `<a class="ozet-kart" href="#k/${encodeURIComponent(r.i)}">
        <span class="tur" data-tur="${esc(r.k)}">${esc(turAdi(r.k))}</span><b>${esc(baslikGoster(r))}</b><small>${esc(r.w || r.s || "")}</small></a>`).join("")}</div>` : ""}
    </section>` : ""}
    <button class="push-serit" id="push-serit"><svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>
      <span><b>${tx("Telefona bildirim")}</b><small>${tx("Önemli gelişmeler telefonuna gelsin")}</small></span><em>${esc(typeof pushDurumMetni === "function" ? pushDurumMetni() : "")}</em><i>›</i></button>
    <section class="ozet-bolumu bildirim-bolumu"><h2>${tx("Bildirimler")}</h2>${typeof bildirimAkisiHtml === "function" ? bildirimAkisiHtml(sinir) : ""}</section>
    ${soz ? `<a class="soz soz-bag kompakt" href="#sozler"><blockquote>${esc(soz)}</blockquote><span class="soz-kim">${tx("Günün sözü · Söz ekle")}</span></a>` : ""}`;
    $("#push-serit").onclick = () => pushLevhasi();
    const sDinle = $("#sabah-dinle");
    if (sDinle) sDinle.onclick = () => {
      const mp3 = VERI.sesli_ozet;   // toplayıcının doğal sesle okuduğu özet; yalnız aynı "dün" içinse
      if (mp3 && mp3.dosya && DIL !== "en" && !so.son48 && mp3.gun === gunOnce(1)) SES.mp3(`${mp3.dosya}?v=${mp3.imza}`, tx("Dünün özeti"), so.sesli);
      else SES.oku(so.sesli, tx("Dünün özeti"));
    };
  };
  ciz();
  // kazı duyuruları Firestore'dan gelir; gelince akışı yeniden çiz
  if (typeof kaziDuyurulariYukle === "function" && !KD.liste && !H.yok) kaziDuyurulariYukle().then(() => { if (location.hash.startsWith("#ozet")) ciz(); }).catch(() => {});
  if (VERI.guncelleme && D.ozetGorulen !== VERI.guncelleme) D.ozetGorulen = VERI.guncelleme;
  if (typeof bildirimleriGorulduSay === "function") bildirimleriGorulduSay();
}

/* "Günün Katmanları": dünün öne çıkanları stratigrafi katmanları gibi üstten alta (en önemlisi en üstte); altta oynatıcı (doğal sesli mp3 varsa ilerleme ve hız) */
function gunuAnlat() {
  const so = sabahOzeti();
  const mp3 = VERI.sesli_ozet;
  const mp3Var = mp3 && mp3.dosya && DIL !== "en" && !so.son48 && mp3.gun === gunOnce(1);
  const kisa = m => { m = String(m || "").replace(/\s+/g, " ").trim(); return m.length > 320 ? m.slice(0, 320).replace(/\s\S*$/, "") + "…" : m; };
  const k = document.createElement("div");
  k.className = "anlat-kapi"; k.setAttribute("role", "dialog"); k.setAttribute("aria-modal", "true"); k.setAttribute("aria-labelledby", "anlat-baslik");
  k.innerHTML = `<div class="anlat-panel">
    <div class="anlat-ust"><h2 id="anlat-baslik">${tx("Günün Katmanları")}<small>${esc(so.etiket)}</small></h2><button class="ikon-dugme" id="anlat-kapat" aria-label="${tx("Kapat")}"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></div>
    <p class="anlat-giris">${esc(so.selam)}. ${esc(so.paragraf)}</p>
    ${so.oneCikanlar.map((r, i) => `<article class="anlat-madde katman-${i % 5}"><span class="katman-no">${tx("Katman {n}", { n: i + 1 })} · ${esc(turAdi(r.k))}</span><a href="#k/${encodeURIComponent(r.i)}"><h3>${esc(baslikGoster(r))}</h3></a>
      ${(cevOzet(r) || r.o) ? `<p>${esc(kisa(yabanciMi(r) ? (cevOzet(r) || r.o) : r.o))}</p>` : ""}
      <p class="anlat-kaynak">${tx("Kaynak:")} <span>${esc(r.w || r.s || "")}</span></p></article>`).join("") || `<p class="aciklama">${tx("Dünden bu yana yeni kayıt gelmedi.")}</p>`}
    <div class="anlat-calar">
      <button class="anlat-oynat" id="anlat-oynat" aria-label="${tx("Dinle")}"><svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg></button>
      ${mp3Var ? `<span id="anlat-sure">00:00</span><input type="range" id="anlat-ilerle" min="0" max="100" value="0" step="0.1" aria-label="${tx("İlerleme")}"><span id="anlat-toplam">--:--</span>
        <button class="anlat-hiz" id="anlat-hiz">1x</button><audio id="anlat-ses" preload="metadata" src="${esc(`${mp3.dosya}?v=${mp3.imza}`)}"></audio>`
        : `<span class="anlat-not">${tx("Cihazın sesiyle okunur")}</span>`}
    </div></div>`;
  document.body.appendChild(k);
  const kapat = () => { const a = k.querySelector("#anlat-ses"); if (a) a.pause(); else SES.durdur(); k.remove(); document.removeEventListener("keydown", tus); };
  const tus = e => { if (e.key === "Escape") kapat(); };
  document.addEventListener("keydown", tus);
  k.querySelector("#anlat-kapat").onclick = kapat;
  k.addEventListener("click", e => { if (e.target === k) kapat(); });
  k.querySelectorAll(".anlat-madde a").forEach(a => a.addEventListener("click", kapat));
  const oynat = k.querySelector("#anlat-oynat");
  const simge = calar => { oynat.innerHTML = calar ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>'; };
  const a = k.querySelector("#anlat-ses");
  if (a) {
    const z = t => isFinite(t) ? `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}` : "--:--";
    const ilerle = k.querySelector("#anlat-ilerle"), hiz = k.querySelector("#anlat-hiz");
    a.addEventListener("loadedmetadata", () => { k.querySelector("#anlat-toplam").textContent = z(a.duration); });
    a.addEventListener("timeupdate", () => { k.querySelector("#anlat-sure").textContent = z(a.currentTime); if (a.duration) ilerle.value = (a.currentTime / a.duration) * 100; });
    a.addEventListener("play", () => simge(true)); a.addEventListener("pause", () => simge(false)); a.addEventListener("ended", () => simge(false));
    ilerle.oninput = () => { if (a.duration) a.currentTime = (ilerle.value / 100) * a.duration; };
    oynat.onclick = () => (a.paused ? a.play() : a.pause());
    const hizlar = [1, 1.2, 1.5, 0.8];
    hiz.onclick = () => { const i = (hizlar.indexOf(a.playbackRate) + 1) % hizlar.length; a.playbackRate = hizlar[i]; hiz.textContent = hizlar[i] + "x"; };
  } else {
    let caliyor = false;
    oynat.onclick = () => {
      if (caliyor) { SES.durdur(); caliyor = false; simge(false); return; }
      const metin = [tx("{selam}. Arkix, günün katmanları.", { selam: so.selam }), so.paragraf, ...so.oneCikanlar.map(r => `${baslikGoster(r)}. ${kisa(yabanciMi(r) ? (cevOzet(r) || "") : r.o)}`)];
      SES.oku(metin, tx("Günün Katmanları")); caliyor = true; simge(true);
    };
  }
}

/* Arkix Özel: kendi yazılarımız (alt bardaki ★) */
function sayfaOzel(arg) {
  const kazi = arg === "kazi";
  const sekme = `<div class="bolumlu ozel-sekme" role="group"><a href="#ozel" aria-pressed="${!kazi}">Arkix Özel</a><a href="#ozel/kazi" aria-pressed="${kazi}">${tx("Kazı duyuruları")}</a></div>`;
  if (kazi) {
    $("#sayfa").innerHTML = sekme + `<div id="kazi-kap"></div>`;
    if (typeof kaziBolumuCiz === "function") kaziBolumuCiz($("#kazi-kap"));
    return;
  }
  const yazilar = VERI.kayitlar.filter(r => r.oz).sort((x, y) => (y.t || "").localeCompare(x.t || ""));
  $("#sayfa").innerHTML = sekme + (yazilar.length ? `<div class="ozel-sayfa">${yazilar.map((r, i) => `<a class="ozel-buyuk${i ? "" : " ilk"}" href="#k/${encodeURIComponent(r.i)}">
      ${r.gv ? `<img src="${esc(r.gv)}" alt="${esc(r.ga || "")}" loading="${i ? "lazy" : "eager"}">` : ""}
      <div><small>${esc(tarihYaz(r.t))}${r.y ? " · " + esc(r.y) : ""}${r.ys ? ` · ${tx("{n} yorum", { n: r.ys })}` : ""}</small>
        <h2>${esc(baslikGoster(r))}</h2><p>${esc(r.o || "")}</p></div></a>`).join("")}</div>`
    : bosHtml(tx("Henüz Arkix Özel yazısı yok"), tx("Sahadan notlar, duyurular ve kendi haberlerimiz burada yayımlanacak.")));
}

/* Bildirimler sekmesindeki rozet: okunmamış bildirim sayısı (bildirimler.js) */
function ozetRozeti() {
  const r = document.getElementById("ozet-rozet"); if (!r) return;
  const n = typeof bildirimOkunmamis === "function" ? bildirimOkunmamis() : 0;
  r.hidden = !n;
  r.textContent = n > 99 ? "99+" : String(n);
  r.classList.remove("nokta");
}
function gunOnce(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function tumSozler() { return [...(D.ozelSozler || []), ...SOZLER]; }
function gununSozu() {
  const l = tumSozler();
  if (!l.length) return "";
  const d = new Date(); const sira = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  return l[sira % l.length];
}

/* Son dakika: toplayıcının elle yazılan duyuruları ve en az 3 sitede çıkan yeni haberler (r.flash). */
function sonDakika() {
  // yalnizEskiAdres: eski github.io adresinde takılan kurulu kopyalara "yeni adres" duyurusu; bu sürüm göstermez
  const elle = (VERI.duyurular || []).filter(d => !d.yalnizEskiAdres).map(d => ({ baslik: d.baslik, alt: d.ozet || tx("Harrix duyurusu"), adres: d.url || "#bugun", dis: !!d.url, onemli: d.onemli !== false }));
  const flash = VERI.kayitlar.filter(r => r.flash).slice(0, 6).map(r => ({ baslik: baslikGoster(r),
    alt: `${r.ks ? tx("{n} kaynakta", { n: r.ks }) : ""}${r.ks && (r.w || r.s) ? " · " : ""}${r.w || r.s || ""}`, adres: `#k/${encodeURIComponent(r.i)}`, dis: false, onemli: true }));
  return [...elle, ...flash].slice(0, 8);
}

/* Dünün (dün boşsa son 48 saatin) kayıtlarından kısa özet ve sesli metin. */
function sabahOzeti() {
  const saat = new Date().getHours();
  const selam = saat >= 5 && saat < 12 ? tx("Günaydın") : saat < 18 && saat >= 12 ? tx("İyi günler") : tx("İyi akşamlar");
  const dun = gunOnce(1);
  let havuz = VERI.kayitlar.filter(r => gunAnahtari(r) === dun);
  let etiket = tx("Dün, {tarih}", { tarih: tarihYaz(dun) }), son48 = false;
  if (!havuz.length) { havuz = VERI.kayitlar.filter(r => gunAnahtari(r) >= gunOnce(2)); etiket = tx("Son 48 saat"); son48 = true; }
  const say = t => havuz.filter(r => r.k === t).length;
  const parca = [[say("Haber"), "{n} haber"], [say("Makale"), "{n} yeni makale"], [say("Tez"), "{n} tez"], [say("Rapor"), "{n} rapor"]]
    .filter(([n]) => n).map(([n, ad]) => tx(ad, { n }));
  const turk = r => !yabanciMi(r) || !!cevBaslik(r);
  const oneCikanlar = [...havuz.filter(r => r.k === "Haber" && turk(r)).slice(0, 3), ...havuz.filter(r => r.k === "Makale").slice(0, 2),
    ...havuz.filter(r => r.k === "Tez").slice(0, 1)].slice(0, 5);
  const paragraf = havuz.length
    ? tx(son48 ? "Son 48 saatte arkeoloji gündeminde {liste} öne çıktı." : "Dün arkeoloji gündeminde {liste} öne çıktı.",
      { liste: parca.join(", ").replace(/, ([^,]*)$/, tx(" ve ") + "$1") })
    : tx("Dünden bu yana yeni kayıt gelmedi.");
  const sesli = [tx("{selam}. Arkix, dünün özeti.", { selam }), paragraf,
    ...oneCikanlar.map((r, i) => `${i + 1}. ${turAdi(r.k)}: ${String(baslikGoster(r)).replace(/\.$/, "")}.`)];
  return { selam, etiket, son48, havuz, paragraf, oneCikanlar, sesli };
}

/* ---------------------------------------------------------------- sözler (bülten + kendi eklediğiniz) */
function sayfaSozler() {
  const ozel = D.ozelSozler || [];
  $("#sayfa").innerHTML = `
    <div class="grup"><h3>${tx("Söz ekle")}</h3>
      <textarea class="not-alani" id="yeni-soz" rows="3" placeholder="${tx("Bir arkeoloji sözü, ardından isterseniz — Söyleyen")}"></textarea>
      <p style="margin:10px 0 0"><button class="buyuk-dugme" id="soz-ekle">${tx("Sözü ekle")}</button></p>
      <p class="aciklama">${tx("Eklediğiniz sözler bu cihazda saklanır, yedeğe girer ve “Günün sözü”nde sırayla çıkar.")}</p></div>
    ${ozel.length ? `<div class="grup"><h3>${tx("Sizin sözleriniz")}</h3><div class="kutu">${ozel.map((z, i) => `<div class="satir soz-satir"><span>${esc(z)}</span>
      <button class="ikincil-dugme" data-soz-sil="${i}" aria-label="${tx("Sözü sil")}">${tx("Sil")}</button></div>`).join("")}</div></div>` : ""}
    <div class="grup"><h3>${tx("Bültenin sözleri")}</h3><div class="kutu">${SOZLER.map(z => `<div class="satir soz-satir"><span>${esc(z)}</span></div>`).join("")
      || `<p class="aciklama" style="padding:12px">${tx("Sözler yüklenemedi.")}</p>`}</div></div>`;
  $("#soz-ekle").onclick = () => {
    const m = $("#yeni-soz").value.replace(/\s+/g, " ").replace(/["“”]/g, "").trim();
    if (m.length < 8) { bildir(tx("Sözü yazın")); return; }
    if (tumSozler().includes(m)) { bildir(tx("Bu söz zaten var")); return; }
    D.ozelSozler = [m, ...ozel]; kaydet(); bildir(tx("Söz eklendi")); rota(true);
  };
  $("#sayfa").querySelectorAll("[data-soz-sil]").forEach(b => b.onclick = () => {
    D.ozelSozler = ozel.filter((_, i) => i !== Number(b.dataset.sozSil)); kaydet(); bildir(tx("Söz silindi")); rota(true);
  });
}

function suzulmus(temel) {
  const q = katla(S.arama.trim());
  return temel.filter(r =>
    (!S.tur || r.k === S.tur) &&
    (!S.donem || (r.e || []).includes(S.donem)) &&
    (!S.dil || (S.dil === "diger" ? !["tr", "en"].includes(r.l || "") : r.l === S.dil)) &&
    (!q || katla([r.b, r.bt, r.be, r.o, r.ot, r.oe, r.y, r.w].join(" ")).includes(q)));
}

function sayfaAkis(temel, baslikMetni, secenek = {}) {
  const donemler = VERI.kavramlar.filter(k => k.grup === "Dönem" && temel.some(r => r.e.includes(k.id)));
  const sonuc = suzulmus(temel);
  $("#sayfa").innerHTML = (secenek.modDugmesi ? modDugmesiHtml() : "") + `
    <div class="bolumlu" role="group" aria-label="${tx("Tür")}">${["", ...TURLER].map(t =>
      `<button data-tur="${t}" aria-pressed="${S.tur === t}">${t ? (t === "Rapor" ? "Rapor" : t) : tx("Tümü")}</button>`).join("")}</div>
    <div class="arama-kutu"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>
      <input id="ara" type="search" placeholder="${esc(secenek.aramaYeri || tx("Başlık, yazar, özet içinde ara"))}" value="${esc(S.arama)}" enterkeyhint="search" autocomplete="off"></div>
    <div class="suzgec" role="group" aria-label="${tx("Dil")}">
      ${[["", tx("Her dil")], ["tr", tx("Türkçe")], ["en", tx("İngilizce")], ["diger", tx("Diğer diller")]].map(([d, ad]) =>
        `<button class="cip" data-dil="${d}" aria-pressed="${S.dil === d}">${ad}</button>`).join("")}
    </div>
    ${donemler.length ? `<div class="suzgec" role="group" aria-label="${tx("Dönem")}">
      <button class="cip" data-donem="" aria-pressed="${!S.donem}">${tx("Bütün dönemler")}</button>
      ${donemler.map(k => `<button class="cip" data-donem="${k.id}" aria-pressed="${S.donem === k.id}">${esc(kavramAdi(k))}</button>`).join("")}
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
      ? bosHtml(tx("Bu süzgeçlerle kayıt yok"), tx("Süzgeçlerden birini kaldırmayı deneyin."), `<button class="ikincil-dugme" id="suzgec-sifirla">${tx("Süzgeçleri temizle")}</button>`)
      : bosHtml(secenek.bosBaslik || tx("Kayıt yok"), secenek.bosMetin || "");
  }
  const parca = sonuc.slice(0, gosterilecek);
  return tabakalarHtml(parca, secenek) + (sonuc.length > gosterilecek
    ? `<p style="text-align:center;margin:18px"><button class="ikincil-dugme" id="daha">${tx("{n} kayıt daha göster", { n: sonuc.length - gosterilecek })}</button></p>` : "");
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
  return `<div class="bolumlu mod-secici" role="group" aria-label="${tx("Arama alanı")}">
    <button data-mod="bulten" aria-pressed="${S.mod !== "lit"}">${tx("Bülten")}</button>
    <button data-mod="lit" aria-pressed="${S.mod === "lit"}">${tx("Tüm literatür")}</button></div>`;
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
  return { sorgu: [...gruplar, ...diger].join(" AND "), aciklama: tx("İngilizce yayınlar da aranıyor: {liste}", { liste: eslesen.join(", ") }) };
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
  if (!sorgu) { bildir(tx("Bir kelime yazın ya da bir dönem seçin")); return; }
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
    L.hata = e.message === "sinir" ? (D.oaAnahtar ? tx("Literatür arama sunucusu (OpenAlex) şu an yanıt vermiyor. Biraz sonra yeniden deneyin.")
        : tx("Literatür arama sunucusu (OpenAlex) anahtarsız aramaları şu an durdurmuş ya da günlük ücretsiz sınır doldu. Biraz sonra yeniden deneyin ya da Ayarlar'a ücretsiz bir OpenAlex anahtarı girin."))
      : navigator.onLine ? tx("Arama yapılamadı. Biraz sonra yeniden deneyin.") : tx("İnternet bağlantısı yok.");
  }
  L.yukleniyor = false;
  if (location.hash.startsWith("#akis") && S.mod === "lit") litCiz(true);
}

function litBaglantilar() {
  const q = encodeURIComponent(L.q.trim() || (L.donem && KAVRAM.get(L.donem) ? KAVRAM.get(L.donem).ad : ""));
  return `<div class="dis-baglantilar"><span>${tx("Başka yerde ara:")}</span>
    <a href="https://scholar.google.com/scholar?hl=tr&q=${q}" target="_blank" rel="noopener">Google Akademik</a>
    <a href="https://tez.yok.gov.tr/UlusalTezMerkezi/" target="_blank" rel="noopener">YÖK Tez</a>
    <a href="https://dergipark.org.tr/tr/search?q=${q}&section=articles" target="_blank" rel="noopener">DergiPark</a></div>`;
}

function litSonucHtml() {
  if (L.yukleniyor && !L.ids.length) return `<p class="aciklama" style="text-align:center;margin:24px">${tx("Aranıyor…")}</p>`;
  if (L.hata && !L.ids.length) return bosHtml(tx("Arama yapılamadı"), L.hata);
  if (!L.aranan) return bosHtml(tx("Bütün literatürde arayın"),
    tx("Bülten yalnız yeni yayınları toplar. Burada bütün yıllardaki makale, tez ve kitaplar aranır (OpenAlex; YÖK tezleri ve DergiPark dergilerinin çoğu dahil). Bir kelime yazın ya da dönem seçin."));
  if (!L.ids.length) return bosHtml(tx("Sonuç yok"), tx("Daha genel bir kelime ya da İngilizce karşılığını deneyin.") + (L.aciklama ? " (" + L.aciklama + ")" : ""));
  const liste = kayitlarDen(L.ids);
  const daha = L.ids.length < Math.min(L.toplam, 10000);
  return `<p class="lit-sayi">${tx("{toplam} yayın · {n} gösteriliyor", { toplam: L.toplam.toLocaleString(YEREL), n: liste.length })}</p>
    ${L.aciklama ? `<p class="lit-sayi" style="margin-top:0">${esc(L.aciklama)}</p>` : ""}
    <ul class="liste">${liste.map(r => satirHtml(r, { litAlt: true })).join("")}</ul>
    ${L.hata ? `<p class="aciklama" style="text-align:center">${esc(L.hata)}</p>` : ""}
    ${daha ? `<p style="text-align:center;margin:18px"><button class="ikincil-dugme" id="lit-daha"${L.yukleniyor ? " disabled" : ""}>${L.yukleniyor ? tx("Yükleniyor…") : tx("Daha fazla sonuç")}</button></p>` : ""}`;
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
    <div class="bolumlu" role="group" aria-label="${tx("Tür")}">${["", "Makale", "Tez", "Kitap"].map(t =>
      `<button data-lit-tur="${t}" aria-pressed="${L.tur === t}">${t || tx("Tümü")}</button>`).join("")}</div>
    <form class="arama-kutu" id="lit-form"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>
      <input id="lit-q" type="search" placeholder="${tx("Konu, buluntu yeri, yazar… (ör. Karain, Levallois)")}" value="${esc(L.q)}" enterkeyhint="search" autocomplete="off">
      <button class="ara-git" type="submit">${tx("Ara")}</button></form>
    ${donemler.length ? `<div class="suzgec" role="group" aria-label="${tx("Dönem")}">
      <button class="cip" data-lit-donem="" aria-pressed="${!L.donem}">${tx("Her dönem")}</button>
      ${donemler.map(k => `<button class="cip" data-lit-donem="${k.id}" aria-pressed="${L.donem === k.id}">${esc(kavramAdi(k))}</button>`).join("")}
    </div>` : ""}
    <div class="suzgec" role="group" aria-label="${tx("Sıralama")}">
      ${[["ilgi", tx("En ilgili")], ["yeni", tx("En yeni")], ["atif", tx("En çok atıf")]].map(([k, ad]) =>
        `<button class="cip" data-lit-sira="${k}" aria-pressed="${L.sirala === k}">${ad}</button>`).join("")}
      <button class="cip" data-lit-acik aria-pressed="${L.acik}">${tx("Yalnız açık erişim")}</button>
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
  bildir(tx("Açık erişim kopyası aranıyor…"));
  try {
    const w = await (await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(r.d)}?select=best_oa_location,open_access`)).json();
    const en = w.best_oa_location || {};
    const adres = en.pdf_url || en.landing_page_url || (w.open_access || {}).oa_url;
    if (adres) { r.p = en.pdf_url || ""; if (D.kayitlar[r.i]) D.kayitlar[r.i].p = r.p; kaydet(); window.open(adres, "_blank", "noopener"); rota(true); }
    else bildir(tx("Yasal açık erişim kopyası bulunamadı. Yazara ya da kütüphanenize sorabilirsiniz."));
  } catch (e) { bildir(tx("Bağlantı kurulamadı.")); }
}

/* ---------------------------------------------------------------- ayrıntı */
function sayfaAyrinti(id) {
  const r = DIZIN.get(id);
  if (!r) { $("#sayfa").innerHTML = bosHtml(tx("Kayıt bulunamadı"), tx("Bu kayıt bültenden kaldırılmış olabilir.")); return; }
  if (!D.okundu[r.i]) { D.okundu[r.i] = 1; kaydet(); rozetGuncelle(); }
  const yabanci = yabanciMi(r);
  const cevrili = yabanci && (cevBaslik(r) || cevOzet(r));
  const goster = { tr: cevrili, };
  const ciz = () => {
    const bas = goster.tr && cevBaslik(r) ? cevBaslik(r) : r.b;
    const ozet = goster.tr && cevOzet(r) ? cevOzet(r) : r.o;
    const etiketler = (r.e || []).filter(e => KAVRAM.has(e)).map(e => kavramAdi(KAVRAM.get(e)));
    const satirlar = [
      [tx("Tür"), turAdi(r.k)], [tx("Yazar"), r.y], [tx("Yayın"), r.w || r.s], [tx("Tarih"), tarihYaz(r.t)],
      [tx("Dil"), DIL_AD[r.l] || r.l], [tx("Dönem / konu"), etiketler.join(", ")], ["DOI", r.d], [tx("Kaynak"), r.s],
    ].filter(([, v]) => v);
    if (r.oz) {
      $("#sayfa").innerHTML = `<article class="ayrinti ozel-yazi">
        <p class="ozel-etiket">Arkix Özel</p>
        <h2>${esc(baslikGoster(r))}</h2>
        <p class="ozel-kunye">${[r.y, tarihYaz(r.t)].filter(Boolean).map(esc).join(" · ")}
          <button class="yorum-cip" data-e="yorumlar"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>${r.ys ? tx("{n} yorum", { n: r.ys }) : tx("Yorum yaz")}</button></p>
        ${r.gv ? `<figure class="ozel-kapak"><img src="${esc(r.gv)}" alt="${esc(r.ga || "")}">${r.ga ? `<figcaption>${esc(r.ga)}</figcaption>` : ""}</figure>` : ""}
        ${DIL === "en" ? `<p class="ceviri-not">${tx("Bu yazı yalnız Türkçe yayımlandı.")}</p>` : ""}
        <div class="ozel-govde">${r.h || `<p>${esc(r.o || "")}</p>`}</div>
        <div class="eylemler">
          <button class="eylem eylem-yorum" data-e="yorumlar"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>${r.ys ? tx("{n} yorum", { n: r.ys }) : tx("Yorum yaz")}</button>
        <button class="eylem" data-e="fav" aria-pressed="${D.fav.includes(r.i)}"><svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>${tx("Favori")}</button>
          <button class="eylem" data-e="konu"><svg viewBox="0 0 24 24"><path d="M3 7h6l2 2h10v10H3z"/></svg>${tx("Konuya ekle")}</button>
          <button class="eylem" data-e="not" aria-pressed="${!!D.notlar[r.i]}"><svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5zM8 12h8M8 16h5"/></svg>${tx("Not")}</button>
          ${SES.destek ? `<button class="eylem" data-e="dinle"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6"/></svg>${tx("Dinle")}</button>` : ""}
          <button class="eylem" data-e="paylas"><svg viewBox="0 0 24 24"><path d="M12 15V3m-4 4l4-4 4 4M5 12v8h14v-8"/></svg>${tx("Paylaş")}</button>
        </div>
        <p class="kayit-bildir"><button data-e="bildir">${tx("Bir sorun mu var? Bildir")}</button></p>
        ${D.notlar[r.i] ? `<div class="kunye"><b>${tx("Notunuz:")}</b> ${esc(D.notlar[r.i])}</div>` : ""}
      </article>`;
      $("#sayfa").querySelectorAll("[data-e]").forEach(b => b.onclick = () => eylem(b.dataset.e, r, ciz, goster));
      if (typeof yorumlarCiz === "function") yorumlarCiz(r);
      return;
    }
    $("#sayfa").innerHTML = `<article class="ayrinti">
      <h2>${esc(bas)}</h2>
      ${goster.tr && cevBaslik(r) ? `<p class="ceviri-not">${tx("Özgün başlık:")} ${esc(r.b)}</p>` : ""}
      <dl class="form-tablo">${satirlar.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      ${ozet ? `<div class="metin">${esc(ozet)}</div>` : `<p class="aciklama">${tx("Bu kayıt için özet yok.")}</p>`}
      ${ozet && r.kisa ? `<p class="ceviri-not">${tx("Kısaltılmış özet; tamamı yayıncının sayfasında.")}</p>` : ""}
      ${goster.tr && cevOzet(r) ? `<p class="ceviri-not">${tx("Makine çevirisidir; alıntı yapmadan önce özgün metne bakın.")}</p>` : ""}
      ${(() => {
        const ad = r.k === "Makale" || r.k === "Tez" ? tx("Yayını aç") : tx("Haberi aç");
        if (!yabanci) return `<a class="buyuk-dugme" href="${escUrl(r.u)}" target="_blank" rel="noopener">${ad}</a>`;
        const tr = turkceAdres(r.u);
        return D.hepTurkce
          ? `<a class="buyuk-dugme" href="${esc(tr)}" target="_blank" rel="noopener">${ad} (${HEDEF_AD})</a>
             <p class="cift-bag"><a href="${escUrl(r.u)}" target="_blank" rel="noopener">${tx("Özgün dilinde aç")}</a></p>`
          : `<div class="iki-dugme"><a class="buyuk-dugme" href="${escUrl(r.u)}" target="_blank" rel="noopener">${ad}</a>
             <a class="buyuk-dugme ikinci" href="${esc(tr)}" target="_blank" rel="noopener">${HEDEF === "en" ? "🌐 Open in English" : "🌐 Türkçe aç"}</a></div>`;
      })()}
      <div class="eylemler">
        <button class="eylem eylem-yorum" data-e="yorumlar"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>${r.ys ? tx("{n} yorum", { n: r.ys }) : tx("Yorum yaz")}</button>
        <button class="eylem" data-e="fav" aria-pressed="${D.fav.includes(r.i)}"><svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>${tx("Favori")}</button>
        ${yabanci ? `<button class="eylem" data-e="cevir" aria-pressed="${!!goster.tr}"><svg viewBox="0 0 24 24"><path d="M4 5h8M8 3v2m2 0c-1 4-3 7-6 9m2-5c1 2 3 4 5 5M13 21l4-10 4 10m-6.5-3h5"/></svg>${goster.tr ? tx("Özgün") : HEDEF_AD}</button>` : ""}
        <button class="eylem" data-e="takip"><svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/></svg>${tx("Takip et")}</button>
        <button class="eylem" data-e="konu"><svg viewBox="0 0 24 24"><path d="M3 7h6l2 2h10v10H3z"/></svg>${tx("Konuya ekle")}</button>
        <button class="eylem" data-e="not" aria-pressed="${!!D.notlar[r.i]}"><svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5zM8 12h8M8 16h5"/></svg>${tx("Not")}</button>
        <button class="eylem" data-e="kaynakca" aria-pressed="${D.kaynakca.includes(r.i)}"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>${tx("Kaynakça")}</button>
        ${SES.destek ? `<button class="eylem" data-e="dinle"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6"/></svg>${tx("Dinle")}</button>` : ""}
        <button class="eylem" data-e="paylas"><svg viewBox="0 0 24 24"><path d="M12 15V3m-4 4l4-4 4 4M5 12v8h14v-8"/></svg>${tx("Paylaş")}</button>
        ${r.p ? `<a class="eylem" href="${escUrl(r.p)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M12 4v11m-4-4l4 4 4-4M5 20h14"/></svg>PDF</a>`
          : r.d ? `<button class="eylem" data-e="acik"><svg viewBox="0 0 24 24"><path d="M12 4v11m-4-4l4 4 4-4M5 20h14"/></svg>${tx("Açık kopya ara")}</button>` : ""}
        <button class="eylem" data-e="kunye"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>${tx("APA kopyala")}</button>
        ${r.p ? `<button class="eylem" data-e="arsiv"><svg viewBox="0 0 24 24"><path d="M4 4h16v4H4zM6 8v12h12V8M10 12h4"/></svg>${tx("PDF'i arşive al")}</button>` : ""}
      </div>
      <p class="kayit-bildir"><button data-e="bildir">${tx("Alakasız ya da hatalı mı? Bildir")}</button></p>
      ${D.notlar[r.i] ? `<div class="kunye"><b>${tx("Notunuz:")}</b> ${esc(D.notlar[r.i])}</div>` : ""}
      <div class="kunye">${apaHtml(r)}</div>
    </article>`;
    $("#sayfa").querySelectorAll("[data-e]").forEach(b => b.onclick = () => eylem(b.dataset.e, r, ciz, goster));
    if (typeof yorumlarCiz === "function") yorumlarCiz(r);
  };
  ciz();
  // başlık bulutta çevrilmiş ama özet çevrilmemişse özeti cihazda çevir
  if (goster.tr && r.o && !cevOzet(r)) {
    cevir(r.o, r.l).then(t => { cevYaz(r, null, t); if (location.hash === "#k/" + encodeURIComponent(r.i)) ciz(); }).catch(() => {});
  }
}

async function eylem(ad, r, ciz, goster) {
  titres();
  if (ad === "takip") { if (typeof takipLevhasi === "function") takipLevhasi(r); return; }
  if (ad === "bildir") { if (typeof geriBildirimLevhasi === "function") geriBildirimLevhasi("kayit", r); return; }
  if (ad === "yorumlar") { const y = document.getElementById("yorumlar"); if (y) y.scrollIntoView({ behavior: "smooth", block: "start" }); const g = document.getElementById("yorum-metin"); if (g) setTimeout(() => g.focus(), 400); return; }
  if (ad === "fav") { favDegistir(r); ciz(); }
  else if (ad === "acik") { acikKopyaAra(r); }
  else if (ad === "cevir") {
    if (!goster.tr && (!cevBaslik(r) || (r.o && !cevOzet(r)))) {
      bildir(tx("Çevriliyor…"));
      try {
        if (!cevBaslik(r)) cevYaz(r, await cevir(r.b, r.l));
        if (r.o && !cevOzet(r)) cevYaz(r, null, await cevir(r.o, r.l));
        if (kullaniliyorMu(r.i)) { D.kayitlar[r.i] = r; kaydet(); }
      } catch (e) { bildir(tx("Çeviri servisine ulaşılamadı. Biraz sonra yeniden deneyin.")); return; }
    }
    goster.tr = !goster.tr; ciz();
  }
  else if (ad === "konu") konuLevhasi(r);
  else if (ad === "not") notLevhasi(r, ciz);
  else if (ad === "kaynakca") {
    if (D.kaynakca.includes(r.i)) { D.kaynakca = D.kaynakca.filter(x => x !== r.i); kopyaTemizle(r.i); bildir(tx("Kaynakçadan çıkarıldı")); }
    else { kopyala(r); D.kaynakca.push(r.i); bildir(tx("Kaynakçaya eklendi")); }
    kaydet(); ciz();
  }
  else if (ad === "paylas") paylasLevhasi(kayitPaylasimi(r));
  else if (ad === "dinle") kaydiDinle(r);
  else if (ad === "kunye") panoya(apaDuz(r), tx("APA 7 künyesi kopyalandı"));
  else if (ad === "arsiv") pdfIndirArsivle(r);
}

/* Yabancı sayfayı Google Çeviri ile arayüz dilinde açar (sayfa düzeni korunur). */
function turkceAdres(u) {
  return `https://translate.google.com/translate?sl=auto&tl=${HEDEF}&hl=${HEDEF}&u=${encodeURIComponent(u)}`;
}

function favDegistir(r) {
  if (D.fav.includes(r.i)) { D.fav = D.fav.filter(x => x !== r.i); kopyaTemizle(r.i); bildir(tx("Favorilerden çıkarıldı")); }
  else { kopyala(r); D.fav.unshift(r.i); bildir(tx("Favorilere eklendi")); }
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
  levhaAc(`<h3>${tx("Paylaş")}</h3>
    <p class="aciklama" style="margin:-6px 0 12px">${esc(baslik)}</p>
    <div class="paylas-izgara">
      ${hedefler.map(([k, ad, u]) => `<a class="paylas-hedef" data-k="${k}" href="${esc(u)}" target="_blank" rel="noopener">${PAYLAS_IKON[k]}<span>${ad}</span></a>`).join("")}
      <button class="paylas-hedef" id="pl-kopyala">${PAYLAS_IKON.kopyala}<span>${tx("Kopyala")}</span></button>
      ${navigator.share ? `<button class="paylas-hedef" id="pl-diger">${PAYLAS_IKON.diger}<span>${tx("Diğer")}</span></button>` : ""}
    </div>`, lv => {
    lv.querySelectorAll("a.paylas-hedef").forEach(a => a.addEventListener("click", () => setTimeout(levhaKapat, 300)));
    lv.querySelector("#pl-kopyala").onclick = () => { panoya(tam, tx("Kopyalandı")); levhaKapat(); };
    const d = lv.querySelector("#pl-diger");
    if (d) d.onclick = async () => { try { await navigator.share({ title: baslik, text: metin, url }); } catch (er) {} levhaKapat(); };
  });
}
async function panoya(metin, mesaj) {
  try { await navigator.clipboard.writeText(metin); bildir(mesaj); }
  catch (e) {
    const t = document.createElement("textarea"); t.value = metin; document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); bildir(mesaj); } catch (e2) { bildir(tx("Kopyalanamadı")); }
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
    const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(parca.slice(0, 480))}&langpair=${encodeURIComponent(dil || (HEDEF === "en" ? "tr" : "en"))}|${HEDEF}`;
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
  levhaAc(`<h3>${tx("Konuya ekle")}</h3>
    <div class="kutu">${D.konular.map(k => `<button class="satir" data-konu="${k.id}">${esc(k.ad)}<span class="sag">${k.ids.includes(r.i) ? tx("✓ Ekli") : tx("{n} kayıt", { n: k.ids.length })}</span></button>`).join("")
      || `<p class="aciklama" style="padding:12px">${tx("Henüz konu yok. Aşağıdan ilk konuyu oluşturun.")}</p>`}</div>
    <div class="arama-kutu" style="margin:12px 0"><input id="yeni-konu" placeholder="${tx("Yeni konu adı (ör. Ankara Paleolitiği)")}" enterkeyhint="done"></div>
    <button class="buyuk-dugme" id="konu-olustur">${tx("Konuyu oluştur ve ekle")}</button>`, lv => {
    lv.querySelectorAll("[data-konu]").forEach(b => b.onclick = () => {
      const k = D.konular.find(x => x.id === b.dataset.konu);
      if (k.ids.includes(r.i)) { k.ids = k.ids.filter(x => x !== r.i); kopyaTemizle(r.i); bildir(tx("\"{ad}\" konusundan çıkarıldı", { ad: k.ad })); }
      else { kopyala(r); k.ids.unshift(r.i); bildir(`"${k.ad}" konusuna eklendi`); }
      kaydet(); levhaKapat();
    });
    const olustur = () => {
      const ad = lv.querySelector("#yeni-konu").value.trim();
      if (!ad) { bildir(tx("Konuya bir ad verin")); return; }
      kopyala(r);
      D.konular.push({ id: "k" + Date.now().toString(36), ad, not: "", ids: [r.i] });
      kaydet(); levhaKapat(); bildir(tx("\"{ad}\" konusu oluşturuldu", { ad }));
    };
    lv.querySelector("#konu-olustur").onclick = olustur;
    lv.querySelector("#yeni-konu").addEventListener("keydown", e => { if (e.key === "Enter") olustur(); });
  });
}

function notLevhasi(r, sonra) {
  levhaAc(`<h3>${tx("Not")}</h3><p class="aciklama" style="margin:-6px 0 10px">${esc(baslikGoster(r))}</p>
    <textarea class="not-alani" id="not-metni" placeholder="${tx("Bu kayıtla ilgili notunuz…")}">${esc(D.notlar[r.i] || "")}</textarea>
    <p style="display:flex;gap:8px;margin:12px 0 0"><button class="buyuk-dugme" id="not-kaydet">${tx("Notu kaydet")}</button></p>
    ${D.notlar[r.i] ? `<p style="text-align:center"><button class="ikincil-dugme" id="not-sil">${tx("Notu sil")}</button></p>` : ""}`, lv => {
    lv.querySelector("#not-kaydet").onclick = () => {
      const m = lv.querySelector("#not-metni").value.trim();
      if (m) { kopyala(r); D.notlar[r.i] = m; } else { delete D.notlar[r.i]; kopyaTemizle(r.i); }
      kaydet(); levhaKapat(); bildir(m ? tx("Not kaydedildi") : tx("Not silindi")); sonra && sonra();
    };
    const sil = lv.querySelector("#not-sil");
    if (sil) sil.onclick = () => { delete D.notlar[r.i]; kopyaTemizle(r.i); kaydet(); levhaKapat(); bildir(tx("Not silindi")); sonra && sonra(); };
  });
}

/* ---------------------------------------------------------------- kitaplık */
function kayitlarDen(ids) { return ids.map(id => DIZIN.get(id) || D.kayitlar[id]).filter(Boolean); }

function sayfaKitaplik() {
  const notlu = Object.keys(D.notlar);
  $("#sayfa").innerHTML = `
    <div class="grup"><h3>${tx("Takip")}</h3><div class="kutu">
      <a class="satir" href="#takip">${tx("Takip ettiklerim")}<span class="sag">${(D.takip || []).length}</span></a>
    </div></div>
    <div class="grup"><h3>${tx("Toplananlar")}</h3><div class="kutu">
      <a class="satir" href="#favoriler">${tx("★ Favoriler")}<span class="sag">${D.fav.length}</span></a>
      <a class="satir" href="#notlar">${tx("Notlu kayıtlar")}<span class="sag">${notlu.length}</span></a>
      <a class="satir" href="#kaynakca">${tx("Kaynakçam (APA 7)")}<span class="sag">${D.kaynakca.length}</span></a>
      <a class="satir" href="#pdfler">${tx("PDF arşivim")}<span class="sag" id="pdf-sayi"></span></a>
      <a class="satir" href="#sozler">${tx("Arkeoloji sözleri")}<span class="sag">${tumSozler().length}</span></a>
    </div></div>
    <div class="grup"><h3>${tx("Konular")}</h3><div class="kutu">
      ${D.konular.map(k => `<a class="satir" href="#konu/${k.id}">${esc(k.ad)}<span class="sag">${k.ids.length}</span></a>`).join("")
        || `<p class="aciklama" style="padding:12px 14px">${tx("Bir kaydın ayrıntısında “Konuya ekle”ye dokunarak tez bölümlerinize ya da araştırma başlıklarınıza göre kayıt toplayabilirsiniz.")}</p>`}
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
  $("#sayfa").innerHTML = `<div class="grup"><h3>${tx("Konu notu")}</h3>
      <textarea class="not-alani" id="konu-not" placeholder="${tx("Bu konuyla ilgili düşünceleriniz, yapılacaklar…")}">${esc(k.not)}</textarea>
      <p class="aciklama">${tx("Yazdıkça kaydedilir.")}</p></div>
    <div class="grup"><h3>${tx("{n} kayıt", { n: liste.length })}</h3></div>
    ${liste.length ? `<ul class="liste">${liste.map(r => satirHtml(r)).join("")}</ul>` : bosHtml(tx("Bu konu boş"), tx("Bir kaydın ayrıntısında “Konuya ekle”ye dokunun."))}
    <div class="grup" style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="ikincil-dugme" id="konu-paylas">${tx("Paylaş")}</button>
      <button class="ikincil-dugme" id="konu-kaynakca">${tx("Kayıtları kaynakçaya ekle")}</button>
      <button class="ikincil-dugme" id="konu-adlandir">${tx("Yeniden adlandır")}</button>
      <button class="ikincil-dugme" id="konu-sil">${tx("Konuyu sil")}</button></div>`;
  let zaman;
  $("#konu-not").addEventListener("input", e => { clearTimeout(zaman); zaman = setTimeout(() => { k.not = e.target.value; kaydet(); }, 300); });
  $("#konu-paylas").onclick = () => paylasLevhasi({ baslik: k.ad, url: "",
    metin: `${k.ad}\n\n` + (k.not ? k.not + "\n\n" : "") + liste.map((r, i) => `${i + 1}. ${baslikGoster(r)}\n${r.u}`).join("\n\n") });
  $("#konu-kaynakca").onclick = () => {
    let n = 0;
    for (const r of liste) if (!D.kaynakca.includes(r.i)) { D.kaynakca.push(r.i); n++; }
    kaydet(); bildir(n ? tx("{n} kayıt kaynakçaya eklendi", { n }) : tx("Hepsi zaten kaynakçada"));
  };
  $("#konu-adlandir").onclick = () => {
    const ad = prompt(tx("Konunun yeni adı"), k.ad);
    if (ad && ad.trim()) { k.ad = ad.trim(); kaydet(); rota(); }
  };
  $("#konu-sil").onclick = () => {
    if (!confirm(tx("\"{ad}\" konusu silinsin mi? Kayıtlar silinmez, yalnızca konu kaldırılır.", { ad: k.ad }))) return;
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
  if (r.k === "Tez") return [[`${yazar} (${yil}). `, 0], [r.b.replace(/\.$/, ""), 1], [` [${ku.tez_turu === "Doktora" ? dilSec("Doktora tezi", "Doctoral dissertation") : dilSec("Yüksek lisans tezi", "Master’s thesis")}${ku.universite || r.w ? ", " + (ku.universite || r.w) : ""}]. `, 0], [doi || "", 0]];
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
      <button class="ikincil-dugme" id="kc-paylas" ${liste.length ? "" : "disabled"}>${tx("Paylaş")}</button>
      <button class="ikincil-dugme" id="kc-kopyala" ${liste.length ? "" : "disabled"}>${tx("Tümünü kopyala")}</button>
      <button class="ikincil-dugme" id="kc-ris" ${liste.length ? "" : "disabled"}>RIS (EndNote, Mendeley)</button>
      <button class="ikincil-dugme" id="kc-bib" ${liste.length ? "" : "disabled"}>BibTeX</button>
      <button class="ikincil-dugme" id="kc-doi">${tx("DOI ile ekle")}</button>
    </div>
    ${liste.length ? `<div class="grup"><h3>${tx("APA 7, alfabetik")}</h3>${liste.map(r => `
      <div class="kunye" data-id="${esc(r.i)}">${apaHtml(r)}
        <div style="margin-top:6px;display:flex;gap:14px;font-size:.8rem"><a href="#k/${encodeURIComponent(r.i)}">${tx("Ayrıntı")}</a>
        <a href="#" data-cikar="${esc(r.i)}">${tx("Kaynakçadan çıkar")}</a></div></div>`).join("")}</div>`
      : bosHtml(tx("Kaynakçanız boş"), tx("Bir yayının ayrıntısında “Kaynakça”ya dokunun ya da DOI ile ekleyin."))}`;
  if (liste.length) {
    $("#kc-kopyala").onclick = () => panoya(liste.map(apaDuz).join("\n\n"), tx("{n} künye kopyalandı", { n: liste.length }));
    $("#kc-paylas").onclick = () => paylasLevhasi({ baslik: tx("Kaynakça"), url: "", metin: tx("Kaynakça (APA 7)") + "\n\n" + liste.map(apaDuz).join("\n\n") });
    $("#kc-ris").onclick = () => dosyaIndir("kaynakca.ris", ris(liste), "application/x-research-info-systems");
    $("#kc-bib").onclick = () => dosyaIndir("kaynakca.bib", bibtex(liste), "application/x-bibtex");
  }
  $("#kc-doi").onclick = doiLevhasi;
  $("#sayfa").querySelectorAll("[data-cikar]").forEach(a => a.onclick = e => {
    e.preventDefault(); const id = a.dataset.cikar;
    D.kaynakca = D.kaynakca.filter(x => x !== id); kopyaTemizle(id); kaydet(); rota();
  });
}

function doiLevhasi() {
  levhaAc(`<h3>${tx("DOI ile ekle")}</h3>
    <div class="arama-kutu" style="margin:0 0 12px"><input id="doi" placeholder="${tx("10.xxxx/… ya da doi.org bağlantısı")}" inputmode="url" autocapitalize="off"></div>
    <button class="buyuk-dugme" id="doi-ekle">${tx("Künyeyi getir ve ekle")}</button>
    <p class="aciklama">${tx("Künye Crossref'ten alınır. DergiPark makalelerinin çoğunda DOI vardır.")}</p>`, lv => {
    lv.querySelector("#doi-ekle").onclick = async () => {
      const doi = lv.querySelector("#doi").value.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
      if (!/^10\.\S+\/\S+/.test(doi)) { bildir(tx("Geçerli bir DOI yazın (10. ile başlar)")); return; }
      bildir(tx("Crossref'e soruluyor…"));
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
        kaydet(); levhaKapat(); bildir(tx("Kaynakçaya eklendi")); rota();
      } catch (e) { bildir(tx("Bu DOI Crossref'te bulunamadı ya da bağlantı yok.")); }
    };
  });
}

/* ---------------------------------------------------------------- ayarlar */
const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const kurulu = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function kurulumIpucuHtml() {
  if (kurulu() || !D.kurulumIpucu) return "";
  const metin = iOS
    ? tx("Uygulama gibi kullanmak için Safari'de Paylaş düğmesine, sonra “Ana Ekrana Ekle”ye dokunun.")
    : kurulumOlayi ? "" : tx("Uygulama gibi kullanmak için tarayıcı menüsünden “Ana ekrana ekle”yi seçin.");
  return `<div class="grup"><div class="kutu" style="padding:12px 14px">
    ${kurulumOlayi ? `<button class="buyuk-dugme" id="kur">${tx("Ana ekrana ekle")}</button>` : `<p style="margin:0">${metin}</p>`}
    <p style="margin:8px 0 0;text-align:right"><a href="#" id="ipucu-kapat" style="font-size:.85rem">${tx("Bir daha gösterme")}</a></p></div></div>`;
}
document.addEventListener("click", async e => {
  if (e.target.id === "ipucu-kapat") { e.preventDefault(); D.kurulumIpucu = false; kaydet(); rota(); }
  if (e.target.id === "kur" && kurulumOlayi) { kurulumOlayi.prompt(); await kurulumOlayi.userChoice; kurulumOlayi = null; rota(); }
});
/* İlk açılışta bir kez: "Uygulama olarak kur" penceresi (Android/Chrome'da doğrudan kurar, iPhone'da adımları gösterir). */
function kurulumPenceresi() {
  return new Promise(tamam => {
    if (kurulu() || D.kurulumSoruldu) return tamam();
    D.kurulumSoruldu = true; kaydet();
    const k = document.createElement("div");
    k.className = "onay-kapi"; k.setAttribute("role", "dialog"); k.setAttribute("aria-modal", "true"); k.setAttribute("aria-labelledby", "kurulum-baslik");
    const bitir = () => { k.remove(); window.removeEventListener("beforeinstallprompt", ciz); tamam(); };
    const ciz = () => {
      const adim = iOS
        ? `<ol class="kurulum-adim"><li>${tx("Safari'nin altındaki Paylaş düğmesine dokunun")} <b aria-hidden="true">⬆︎</b></li><li>${tx("“Ana Ekrana Ekle”yi seçin")}</li><li>${tx("Sağ üstteki “Ekle”ye dokunun")}</li></ol>`
        : kurulumOlayi ? "" : `<ol class="kurulum-adim"><li>${tx("Tarayıcının menüsünü açın (⋮)")}</li><li>${tx("“Uygulamayı yükle” ya da “Ana ekrana ekle”yi seçin")}</li></ol>`;
      k.innerHTML = `<div class="onay-kutu tanitim-kutu">
        <div class="tanitim-ikon"><img src="ikon/ikon-192.png" alt="" width="96" height="96"></div>
        <h2 id="kurulum-baslik">${tx("Arkix'i uygulama olarak kur")}</h2>
        <p>${tx("Ana ekranınıza ekleyin: tek dokunuşla açılır, tam ekran çalışır, internet yokken de okursunuz. Mağaza gerekmez, yer kaplamaz.")}</p>
        ${adim}
        <div class="tanitim-dugmeler"><button class="ikincil-dugme" id="kurulum-sonra">${tx("Şimdi değil")}</button>
          ${kurulumOlayi ? `<button class="buyuk-dugme" id="kurulum-kur">${tx("Uygulamayı kur")}</button>` : `<button class="buyuk-dugme" id="kurulum-tamam">${tx("Anladım")}</button>`}</div></div>`;
      k.querySelector("#kurulum-sonra").onclick = bitir;
      const kur = k.querySelector("#kurulum-kur");
      if (kur) kur.onclick = async () => { const o = kurulumOlayi; kurulumOlayi = null; bitir(); try { o.prompt(); await o.userChoice; } catch (e) {} };
      const t = k.querySelector("#kurulum-tamam"); if (t) t.onclick = bitir;
    };
    window.addEventListener("beforeinstallprompt", ciz);   // olay pencere açıkken gelirse "kur" düğmesi belirsin
    ciz(); document.body.appendChild(k);
  });
}
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); kurulumOlayi = e; if (location.hash === "#bugun" || !location.hash) rota(true); });

function sayfaAyarlar() {
  const bildirimDestek = "Notification" in window && "serviceWorker" in navigator;
  $("#sayfa").innerHTML = `${typeof hesapGrubuHtml === "function" ? hesapGrubuHtml() : ""}
    <div class="grup"><h3>${tx("Görünüm")}</h3><div class="kutu">
      <div class="satir">Dil / Language${dilSeciciHtml()}</div>
      <label class="satir">${tx("Tema")}<select id="tema"><option value="oto">${tx("Telefona uy")}</option><option value="acik">${dilSec("Açık", "Light")}</option><option value="koyu">${tx("Koyu")}</option></select></label>
      <label class="satir">${tx("Tema")} · ${tx("ören yeri")}<select id="palet">${TEMALAR.map(t => `<option value="${t.id}">${esc(temaAdi(t))}</option>`).join("")}</select></label>
      <label class="satir">${tx("Arka plan")}<select id="zemin"><option value="siluet">${tx("Ören yeri çizimi")}</option><option value="milimetrik">${tx("Milimetrik kâğıt")}</option><option value="sade">${tx("Sade")}</option></select></label>
      <label class="satir">${tx("Menü")}<select id="menu-konum"><option value="sol">${tx("Soldan açılsın")}</option><option value="ust">${tx("Üstten insin")}</option></select></label>
      <label class="satir">${tx("Yazı boyutu")}<select id="yazi"><option value="0.9">${tx("Küçük")}</option><option value="1">${tx("Normal")}</option><option value="1.12">${tx("Büyük")}</option><option value="1.25">${tx("Çok büyük")}</option></select></label>
    </div>${D.zemin === "siluet" && window.GUNLUK && GUNLUK.bugun() ? `<p class="aciklama">${tx("Sayfanın altında her gün Günün Ören Yeri'nin çizimi. Bugün: {ad}.", { ad: GUNLUK.bugun().ad })}</p>` : ""}</div>
    <div class="grup"><h3>${tx("Çeviri")}</h3><div class="kutu">
      <label class="satir">${tx("Yabancı sayfaları Türkçe aç")}<input type="checkbox" class="anahtar" id="hep-turkce" ${D.hepTurkce ? "checked" : ""}></label>
    </div><p class="aciklama">${tx("Açıkken İngilizce ve diğer dillerdeki haber ve makale sayfaları Google Çeviri ile Türkçe açılır. Kapalıyken yabancı kayıtlarda ayrıca “Türkçe aç” düğmesi görünür. Başlık ve özetler her durumda uygulama içinde Türkçe gösterilir.")}</p></div>
    ${SES.destek ? `<div class="grup"><h3>${tx("Sesli okuma")}</h3><div class="kutu">
      <label class="satir">${tx("Okuma hızı")}<select id="ses-hiz"><option value="0.8">${tx("Yavaş")}</option><option value="1">${tx("Normal")}</option><option value="1.2">${tx("Hızlı")}</option><option value="1.4">${tx("Çok hızlı")}</option></select></label>
      ${SES.turkceSesler().length > 1 ? `<label class="satir">${tx("Ses")}<select id="ses-sec" style="max-width:60%"><option value="">Otomatik (en iyisi)</option>
        ${SES.turkceSesler().map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)}</option>`).join("")}</select></label>` : ""}
      <button class="satir" id="ses-dene">${tx("Sesi dene")}<span class="sag">${esc(SES.sesAdi() || tx("Türkçe ses yok"))}</span></button>
    </div><p class="aciklama">${tx("“Dünün özeti” doğal bir insan sesiyle (Microsoft Emel) hazır gelir. Haberler ve diğer metinler telefonun en doğal Türkçe sesiyle okunur; “Otomatik” en iyisini seçer (Edge’de “Emel Online (Natural)”, iPhone’da Yelda Gelişmiş). Türkçe ses yoksa telefonun ayarlarından (Android: Metin okuma çıkışı; iPhone: Erişilebilirlik › Seslendirilen İçerik › Sesler) Türkçe ses indirin. Ekran kapanınca okuma çoğu telefonda durur.")}</p></div>` : ""}
    <div class="grup"><h3>${tx("Literatür araması")}</h3><div class="kutu">
      <label class="satir">${tx("OpenAlex anahtarı")}<input id="oa-anahtar" type="password" autocomplete="off" placeholder="${tx("isteğe bağlı")}" value="${esc(D.oaAnahtar)}" style="max-width:55%"></label>
    </div><p class="aciklama">${tx("Tüm literatür araması anahtarsız da çalışır, ama OpenAlex yoğun saatlerde anahtarsız aramaları durdurabiliyor. openalex.org'dan ücretsiz alınan anahtarı buraya yazarsanız arama kesintisiz olur. Anahtar yalnız bu telefonda saklanır.")}</p></div>
    <div class="grup"><h3>${tx("Bildirimler")}</h3><div class="kutu">
      <label class="satir">${tx("Yeni kayıt gelince haber ver")}<input type="checkbox" class="anahtar" id="bildirim-ac" ${D.bildirim && bildirimDestek && Notification.permission === "granted" ? "checked" : ""} ${bildirimDestek ? "" : "disabled"}></label>
    </div><p class="aciklama">${bildirimDestek
      ? (iOS ? tx("iPhone'da bildirimler yalnızca uygulama ana ekrana eklendiyse çalışır (iOS 16.4 ve sonrası). Uygulama simgesindeki sayı yeni kayıtları gösterir.")
             : tx("Android'de uygulama ana ekrana eklendiğinde Chrome, bülteni arka planda günde birkaç kez yoklayıp yeni kayıt varsa bildirir."))
      : tx("Bu tarayıcı bildirimleri desteklemiyor.")}</p></div>
    <div class="grup"><h3>${tx("Bülten")}</h3><div class="kutu">
      <a class="satir" href="#durum">${tx("Kaynakların durumu")}<span class="sag">${esc(saatYaz(VERI.guncelleme))}</span></a>
      <button class="satir" id="yenile">${tx("Şimdi yenile")}</button>
    </div><p class="aciklama">${tx("Kayıtlar her gün 06.17, 12.17, 18.17 ve 00.17'de GitHub'da toplanır: OpenAlex, Crossref, DergiPark, Google Haberler ve Bundle'daki haber siteleri.")}</p></div>
    <div class="grup"><h3>${tx("Verileriniz")}</h3><div class="kutu">
      <button class="satir" id="yedek-al">${tx("Yedeği dışa aktar")}<span class="sag">${tx("{n} öge", { n: D.fav.length + D.kaynakca.length + Object.keys(D.notlar).length })}</span></button>
      <label class="satir" style="cursor:pointer">${tx("Yedeği içe aktar")}<input type="file" id="yedek-yukle" accept="application/json,.json" hidden></label>
    </div><p class="aciklama">${tx("Favoriler, konular, notlar ve kaynakça yalnızca bu telefonda tutulur. Telefon değiştirirken yedeği dışa aktarıp yenisine yükleyin.")}</p></div>
    ${typeof toplulukGrubuHtml === "function" ? toplulukGrubuHtml() : ""}
    <div class="grup"><h3>${tx("Hakkında")}</h3><div class="kutu">
      <div class="satir">${tx("Arkix")}<span class="sag">${SURUM}</span></div>
      <a class="satir" style="color:inherit" href="mailto:harrixapp@gmail.com?subject=${encodeURIComponent("Harrix Bülten")}">${tx("Destek ve iletişim")}<span class="sag">harrixapp@gmail.com</span></a>
      <a class="satir" style="color:inherit" href="https://www.instagram.com/harrixapp/" target="_blank" rel="noopener">Instagram<span class="sag">@harrixapp</span></a>
      <button class="satir" id="tanitim-tekrar">${tx("Tanıtımı yeniden göster")}</button>
      <a class="satir" style="color:inherit" href="#yasal">${tx("Kullanım koşulları ve KVKK")}</a>
    </div><p class="aciklama">${tx("Soru, öneri ve sorunlar için Harrix ekibine yazabilirsiniz.")}</p><p class="aciklama">© ${new Date().getFullYear()} Harrix. ${tx("Tüm hakları saklıdır.")}</p></div>`;
  if (typeof hesapGrubuBagla === "function") hesapGrubuBagla();
  if (typeof toplulukGrubuBagla === "function") toplulukGrubuBagla();
  const tt = $("#tanitim-tekrar"); if (tt) tt.onclick = () => tanitimGoster();
  const sec = (id, deger, isle) => { const s = $("#" + id); s.value = String(deger); s.onchange = () => { isle(s.value); kaydet(); temaUygula(); }; };
  $("#oa-anahtar").onchange = e => { D.oaAnahtar = e.target.value.trim(); kaydet(); bildir(D.oaAnahtar ? tx("OpenAlex anahtarı kaydedildi") : tx("OpenAlex anahtarı kaldırıldı")); };
  $("#menu-konum").value = D.menuKonum === "ust" ? "ust" : "sol";
  $("#menu-konum").onchange = e => { D.menuKonum = e.target.value; kaydet(); bildir(e.target.value === "ust" ? tx("Menü üstten inecek; üst çubuktan aşağı kaydırarak da açabilirsin.") : tx("Menü soldan açılacak")); };
  $("#zemin").value = D.zemin;
  $("#zemin").onchange = e => { D.zemin = e.target.value; kaydet(); temaUygula(); rota(true); };
  $("#hep-turkce").onchange = e => { D.hepTurkce = e.target.checked; kaydet(); bildir(D.hepTurkce ? tx("Yabancı sayfalar Türkçe açılacak") : tx("Sayfalar özgün dilinde açılacak")); };
  dilSeciciBagla($("#sayfa"));
  sec("tema", D.tema, v => D.tema = v);
  sec("palet", D.palet, v => D.palet = v);
  sec("yazi", D.yazi, v => D.yazi = Number(v));
  if ($("#ses-hiz")) {
    sec("ses-hiz", D.sesHiz || 1, v => D.sesHiz = Number(v));
    $("#ses-dene").onclick = () => SES.oku([tx("Merhaba. Arkix sesli okuma böyle duyulur. Milattan önce 9600 yılına tarihlenen yapılar.")], tx("Ses denemesi"));
    if ($("#ses-sec")) { $("#ses-sec").value = D.sesId || ""; $("#ses-sec").onchange = e => { D.sesId = e.target.value; kaydet(); rota(true); }; }
  }
  $("#yenile").onclick = async () => { bildir(tx("Yenileniyor…")); if (await veriYukle(true)) bildir(tx("Bülten {saat} tarihli", { saat: saatYaz(VERI.guncelleme) })); };
  $("#bildirim-ac").onchange = async e => {
    if (e.target.checked) {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") { e.target.checked = false; bildir(tx("Bildirim izni verilmedi. Telefon ayarlarından açabilirsiniz.")); return; }
      D.bildirim = true; await arkaPlanKaydi();
      bildir(tx("Yeni kayıtlar için bildirim açık"));
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
      kaydet(); bildir(tx("Yedek yüklendi")); rota();
    } catch (err) { bildir(tx("Bu dosya bir Bülten yedeği değil.")); }
  };
}

async function sayfaDurum() {
  $("#sayfa").innerHTML = bosHtml(tx("Yükleniyor"), "");
  try {
    const d = await (await fetch("veri/durum.json", { cache: "no-cache" })).json();
    const sirali = d.kaynaklar.slice().sort((a, b) => (!!b.hata - !!a.hata) || b.adet - a.adet);
    $("#sayfa").innerHTML = `<p class="ozet">${tx("Son toplama {saat}: {n} kaynak tarandı,", { saat: esc(saatYaz(d.guncelleme)), n: d.kaynak_sayisi })} <b>${tx("{n} yeni kayıt", { n: d.yeni })}</b> ${tx("geldi")}${d.hatali_kaynak ? tx(", {n} kaynağa ulaşılamadı", { n: d.hatali_kaynak }) : ""}.</p>
      <div class="grup"><div class="kutu">${sirali.map(s => `<div class="satir" style="align-items:flex-start">
        <span style="min-width:0">${esc(s.ad)}${s.hata ? `<br><small style="color:var(--rapor)">${esc(s.hata)}</small>` : ""}</span>
        <span class="sag">${s.hata ? "hata" : s.adet}</span></div>`).join("")}</div></div>`;
  } catch (e) { $("#sayfa").innerHTML = bosHtml(tx("Durum bilgisi alınamadı"), tx("İnternet bağlantınızı kontrol edin.")); }
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
  if (!dosya || !/pdf$/i.test(dosya.type || dosya.name)) { bildir(tx("Yalnız PDF dosyası eklenebilir")); return false; }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  await pdfKaydet({ id: "p" + Date.now().toString(36), ad: kayit ? baslikGoster(kayit) : dosya.name.replace(/\.pdf$/i, ""),
    boyut: dosya.size, tarih: new Date().toISOString(), kayitId: kayit ? kayit.i : "", blob: dosya });
  return true;
}
async function pdfIndirArsivle(r) {
  bildir(tx("PDF indiriliyor…"));
  try {
    const y = await fetch(r.p, { mode: "cors" });
    const tur = y.headers.get("content-type") || "";
    if (!y.ok || !/pdf|octet-stream/i.test(tur)) throw new Error();
    const blob = await y.blob();
    await pdfEkleDosya(new File([blob], "makale.pdf", { type: "application/pdf" }), r);
    bildir(tx("PDF arşivinize kaydedildi; internetsiz de açılır"));
  } catch (e) {
    levhaAc(`<h3>${tx("PDF doğrudan alınamadı")}</h3>
      <p class="aciklama">${tx("Yayıncının sitesi PDF'in uygulama içinden indirilmesine izin vermiyor. PDF'i açıp telefona indirin, sonra buradan seçerek arşive ekleyin.")}</p>
      <p style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
        <a class="buyuk-dugme" href="${escUrl(r.p)}" target="_blank" rel="noopener">${tx("PDF'i aç")}</a>
        <label class="buyuk-dugme ikinci" style="cursor:pointer">${tx("İndirdiğim PDF'i seç")}<input type="file" accept="application/pdf,.pdf" hidden id="arsiv-sec"></label></p>`, lv => {
      lv.querySelector("#arsiv-sec").onchange = async e => { if (await pdfEkleDosya(e.target.files[0], r)) { levhaKapat(); bildir(tx("PDF arşivinize eklendi")); } };
    });
  }
}
const boyutYaz = b => b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
async function sayfaPdfler() {
  let liste = [];
  try { liste = await pdfListe(); } catch (e) { $("#sayfa").innerHTML = bosHtml(tx("PDF arşivi açılamadı"), tx("Bu tarayıcı cihazda dosya saklamaya izin vermiyor (gizli sekme olabilir).")); return; }
  $("#sayfa").innerHTML = `
    <div class="grup"><label class="buyuk-dugme" style="cursor:pointer">${tx("PDF ekle")}<input type="file" id="pdf-ekle" accept="application/pdf,.pdf" multiple hidden></label>
      <p class="aciklama">${tx("Kendi PDF’lerinizi ve açık erişim makaleleri bu cihazda saklayın; internet olmadan açılır. Arşiv hesabınıza eşitlenmez ve yedeğe girmez.")}</p></div>
    ${liste.length ? `<div class="grup"><h3>${liste.length} PDF · ${boyutYaz(liste.reduce((t, p) => t + p.boyut, 0))}</h3><div class="kutu">${liste.map(p => `
      <div class="satir pdf-satir"><button class="pdf-ac" data-pdf-ac="${p.id}"><span>${esc(p.ad)}</span><small>${tarihYaz(p.tarih.slice(0, 10))} · ${boyutYaz(p.boyut)}</small></button>
        ${p.kayitId ? `<a class="ikincil-dugme" href="#k/${encodeURIComponent(p.kayitId)}">${tx("Kayıt")}</a>` : ""}
        <button class="ikincil-dugme" data-pdf-sil="${p.id}" aria-label="${tx("PDF'i sil")}">${tx("Sil")}</button></div>`).join("")}</div></div>`
      : bosHtml(tx("Arşiviniz boş"), tx("Yukarıdan PDF ekleyin ya da PDF’i olan bir yayının ayrıntısında “PDF’i arşive al”a dokunun."))}`;
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
    if (!confirm(tx("\"{ad}\" arşivden silinsin mi?", { ad: p.ad }))) return;
    await pdfSil(p.id); bildir(tx("PDF silindi")); rota(true);
  });
}

/* ---------------------------------------------------------------- kullanım koşulları ve KVKK */
const KVKK_SURUM = "2026-11d" + (window.REKLAM && REKLAM.ACIK ? "-r" : "");   // metin değişince artırın: herkesten yeniden onay istenir; reklam açılınca da değişir
function sayfaYasal() { $("#sayfa").innerHTML = `<article class="ayrinti yasal">${yasalHtml()}</article>`; }
/* İlk açılışta (ya da metin değişince) koşullar ve KVKK onaylanmadan uygulama kullanılamaz. */
function kvkkKapisi() {
  if (D.kvkkSurum === KVKK_SURUM) return Promise.resolve();
  return new Promise(tamam => {
    const k = document.createElement("div");
    k.className = "onay-kapi"; k.setAttribute("role", "dialog"); k.setAttribute("aria-modal", "true"); k.setAttribute("aria-labelledby", "onay-baslik");
    k.innerHTML = `<div class="onay-kutu">
      <div class="onay-dil">${dilSeciciHtml()}</div>
      <h2 id="onay-baslik">${tx("Arkix'e hoş geldiniz")}</h2>
      <p>${tx("Devam etmeden önce kullanım koşullarını ve KVKK aydınlatma metnini okuyup onaylayın. Giriş yapmadan kullandığınızda kişisel verileriniz yalnız bu cihazda kalır.")}</p>
      <details><summary>${tx("Metni oku")}</summary><div class="yasal">${yasalHtml()}</div></details>
      <label class="onay-satir"><input type="checkbox" id="onay-kutu"> ${tx("Kullanım koşullarını ve KVKK aydınlatma metnini okudum, kabul ediyorum.")}</label>
      <button class="buyuk-dugme" id="onay-dugme" disabled>${tx("Devam et")}</button></div>`;
    document.body.appendChild(k);
    dilSeciciBagla(k);
    const kutu = k.querySelector("#onay-kutu"), dugme = k.querySelector("#onay-dugme");
    kutu.onchange = () => { dugme.disabled = !kutu.checked; };
    dugme.onclick = () => { D.kvkkSurum = KVKK_SURUM; D.kvkkTarih = new Date().toISOString(); kaydet(); k.remove(); tamam(); };
    dugme.focus();
  });
}
function yasalHtml() {
  if (DIL === "en") return `
    <h2>Terms of Use</h2>
    <p>Arkix presents archaeology headlines, abstracts and links collected from open academic databases (OpenAlex, Crossref, DergiPark) and publicly available news sources. All content remains the copyright of its original publishers; the app only provides links, references and personal research tools. Machine translations are an aid; check the original before quoting. Comments must be respectful and on topic; insults, personal data, spam and copyrighted material are removed and the author may be blocked from commenting. Abstracts of publications without an open licence (such as CC BY or CC0) are shown shortened; the full text is on the publisher's page.</p>
    <p>If you are a rights holder and do not want your content to appear here, write to harrixapp@gmail.com; it will be removed within 48 hours and the source will no longer be collected.</p>
    <h2>Privacy Notice (Turkish Personal Data Protection Law, KVKK No. 6698)</h2>
    <p>Data controller: Harrix (harrixapp@gmail.com).</p>
    <ul>
      <li>If you use the app without signing in, your favorites, notes, topics, bibliography, PDF archive and settings are stored only on this device and are never sent to any server.</li>
      <li>If you choose to sign in, your email address (and your name, with Google sign-in) and your favorite, topic, note, bibliography and follow lists are processed on Firebase (Google Cloud) solely to sync them between your devices.</li>
      <li>Comments you write are public together with your display name and avatar; your email address is never shown. You can delete your comments at any time. Comments you report and bug reports or suggestions you send (with the email address and device information you choose to add) are seen only by the Arkix administrator and are used only to resolve them.</li>
      <li>A profile photo is optional. If you add one, a small copy (160 px) is stored in your account and can be removed at any time.</li>
      <li>Email updates are sent only if you give separate, explicit consent in Settings › Account. Your email address and the date of consent are kept for this purpose; you can withdraw consent at any time in Settings or via the link in every email.</li>
      <li>Only the searches you start are sent to OpenAlex and the translation services. Your OpenAlex key stays on this device.</li>
      ${reklamAcik() ? `<li>The free web version shows Google AdSense ads. Google and its partners may use cookies and similar technologies to serve and measure ads; visitors from the EEA, UK and Switzerland are asked for their ad choices in Google's consent window. Details: <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">policies.google.com/technologies/ads</a>.</li>` : ""}
      <li>To exercise your rights, write to harrixapp@gmail.com. You can export your data in Settings › Export backup, and permanently delete your account and all cloud data in Settings › Delete account.</li>
    </ul>`;
  return `
    <h2>Kullanım koşulları</h2>
    <p>Arkix (Arkix); açık akademik veritabanlarından (OpenAlex, Crossref, DergiPark) ve kamuya açık haber kaynaklarından derlenen arkeoloji başlıklarını, özetlerini ve bağlantılarını sunar. İçeriklerin telif hakları özgün yayıncılarına aittir; uygulama yalnızca kaynağa bağlantı, künye ve kişisel araştırma araçları sağlar. Makine çevirileri yardımcıdır; alıntı yapmadan önce özgün metne bakın. Yorumlar saygılı ve konuyla ilgili olmalıdır; hakaret, kişisel veri, spam ve telifli içerik kaldırılır, yazarı yorum yazmaktan men edilebilir. Serbest lisanslı (CC BY, CC0 vb.) olmayan yayınların özetleri kısaltılmış olarak gösterilir; tamamı yayıncının sayfasındadır.</p>
    <p>Hak sahibiyseniz ve bir içeriğin burada yer almasını istemiyorsanız harrixapp@gmail.com adresine yazın; içerik en geç 48 saat içinde kaldırılır ve kaynak bir daha toplanmaz.</p>
    <h2>KVKK aydınlatma metni</h2>
    <p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu Harrix'tir (harrixapp@gmail.com).</p>
    <ul>
      <li>Giriş yapmadan kullandığınızda favorileriniz, notlarınız, konularınız, kaynakçanız, PDF arşiviniz ve ayarlarınız yalnızca bu cihazda saklanır; hiçbir sunucuya gönderilmez.</li>
      <li>İsteğe bağlı olarak giriş yaptığınızda e-posta adresiniz (Google ile girişte adınız) ve favori, konu, not, kaynakça ve takip listeleriniz yalnızca cihazlarınız arasında eşitleme amacıyla Firebase (Google Cloud) altyapısında işlenir.</li>
      <li>Yazdığınız yorumlar görünen adınız ve avatarınızla birlikte herkese açık görünür; e-posta adresiniz hiçbir yerde gösterilmez. Yorumlarınızı istediğiniz an silebilirsiniz. Bildirdiğiniz yorumları ve gönderdiğiniz hata bildirimi ya da önerileri (eklemeyi seçtiğiniz e-posta ve cihaz bilgisiyle) yalnız Arkix yöneticisi görür ve yalnız bunları çözmek için kullanır.</li>
      <li>Profil fotoğrafı isteğe bağlıdır. Eklerseniz küçük bir kopyası (160 piksel) hesabınızda saklanır; dilediğiniz an kaldırabilirsiniz.</li>
      <li>Yenilik ve duyuru e-postaları yalnızca Ayarlar › Hesap bölümünde ayrıca verdiğiniz açık rızayla gönderilir. Bu amaçla e-posta adresiniz ve rıza tarihiniz saklanır; rızanızı Ayarlar'dan ya da her e-postadaki bağlantıdan istediğiniz an geri alabilirsiniz.</li>
      <li>OpenAlex ve çeviri servislerine yalnızca sizin başlattığınız aramalar iletilir. OpenAlex anahtarınız bu cihazda kalır.</li>
      ${reklamAcik() ? `<li>Ücretsiz web sürümünde Google AdSense reklamları gösterilir. Google ve iş ortakları reklam sunmak ve ölçmek için çerez ve benzeri teknolojiler kullanabilir; Avrupa Ekonomik Alanı, Birleşik Krallık ve İsviçre'den erişimde reklam tercihleriniz Google'ın onay penceresinde sorulur. Ayrıntılar: <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">policies.google.com/technologies/ads</a>.</li>` : ""}
      <li>Kanunun 11. maddesindeki haklarınızı kullanmak için harrixapp@gmail.com adresine yazabilirsiniz. Verilerinizi Ayarlar › Yedeği dışa aktar ile alabilir, Ayarlar › Hesabı sil ile hesabınızı ve buluttaki bütün verilerinizi kalıcı olarak silebilirsiniz.</li>
    </ul>`;
}

/* ---------------------------------------------------------------- dil seçimi (Türkçe / English) */
function dilSeciciHtml() {
  return `<div class="dil-secici" role="radiogroup" aria-label="Dil / Language">${[["tr", "Türkçe"], ["en", "English"]].map(([d, ad]) =>
    `<button type="button" role="radio" aria-checked="${DIL === d}" data-dil="${d}">${ad}</button>`).join("")}</div>`;
}
/* Dil değişince sayfa yeniden yüklenir: bütün metinler ve sabitler yeni dille kurulur. */
function dilSeciciBagla(kok) {
  kok.querySelectorAll("[data-dil]").forEach(b => b.onclick = () => {
    if (b.dataset.dil === DIL) return;
    D.dil = b.dataset.dil; kaydet(); location.reload();
  });
}
/* index.html'deki sabit yazılar (sekmeler, düğme etiketleri) */
function statikCevir() {
  document.documentElement.lang = DIL;
  const ad = { bugun: "Bugün", akis: "Ara", ozel: "Özel", ozet: "Bildirimler", kitaplik: "Kitaplık" };
  document.querySelectorAll("#sekmeler [data-sekme]").forEach(a => { const sp = a.querySelector("span"); if (sp) sp.textContent = tx(ad[a.dataset.sekme]); });
  const etiket = { "#geri": "Geri", "#menu-ac": "Menü", "#bildir-ac": "Bildir", "#sekmeler": "Bölümler" };
  for (const [sec, m] of Object.entries(etiket)) { const el = $(sec); if (el) el.setAttribute("aria-label", tx(m)); }
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
const UST = { bugun: tx("Bugün"), ozet: tx("Bildirimler"), ozel: "Arkix Özel", akis: tx("Ara"), kitaplik: tx("Harrix Kitaplık"), ayarlar: tx("Ayarlar"), giris: tx("Giriş"),
  favoriler: tx("Favoriler"), notlar: tx("Notlu kayıtlar"), kaynakca: tx("Kaynakçam"), durum: tx("Kaynakların durumu"), ara: tx("Ara"), konu: tx("Konu"), k: "",
  sozler: tx("Arkeoloji sözleri"), pdfler: tx("PDF arşivim"), yasal: tx("Koşullar ve KVKK"), yonetim: tx("Yönetim paneli"), takip: tx("Takip ettiklerim"), ayril: tx("E-posta özeti"), oyunlar: tx("Oyunlar"), oyun: tx("Oyunlar") };
const ALT_SAYFA = { giris: null, favoriler: "kitaplik", notlar: "kitaplik", kaynakca: "kitaplik", konu: "kitaplik", durum: null, k: null, ara: "akis",
  sozler: "kitaplik", pdfler: "kitaplik", yasal: null, yonetim: null, takip: null, ayarlar: null, ayril: null, oyunlar: null, oyun: null };
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
  $("#baslik").textContent = UST[ad] ?? tx("Bülten");
  $("#menu-ac").hidden = ad in ALT_SAYFA;
  levhaKapat();
  if (ad === "bugun") sayfaBugun();
  else if (ad === "ozet") sayfaOzet();
  else if (ad === "ozel") sayfaOzel(arg);
  else if (ad === "ayril") { if (typeof sayfaAyril === "function") sayfaAyril(arg); }
  else if (ad === "akis") { if (S.mod === "lit") sayfaLiteratur(); else sayfaAkis(VERI.kayitlar, tx("Yayınlar"), { modDugmesi: true }); }
  else if (ad === "ara") { sayfaAkis(VERI.kayitlar, tx("Ara"), { odakla: !kaydirmayiKoru }); }
  else if (ad === "kazim") { location.replace("#bugun"); return; }
  else if (ad === "kitaplik") sayfaKitaplik();
  else if (ad === "favoriler") sayfaListe(D.fav, bosHtml(tx("Favori yok"), tx("Bir kaydı sola kaydırarak ya da ayrıntısındaki yıldıza dokunarak favorilere ekleyin.")));
  else if (ad === "notlar") sayfaListe(Object.keys(D.notlar), bosHtml(tx("Not yok"), tx("Bir kaydın ayrıntısında “Not”a dokunun.")), { not: true });
  else if (ad === "kaynakca") sayfaKaynakca();
  else if (ad === "konu") sayfaKonu(arg);
  else if (ad === "ayarlar") sayfaAyarlar();
  else if (ad === "giris") { if (typeof sayfaGiris === "function") sayfaGiris(); else location.replace("#ayarlar"); }
  else if (ad === "durum") sayfaDurum();
  else if (ad === "sozler") sayfaSozler();
  else if (ad === "pdfler") sayfaPdfler();
  else if (ad === "yasal") sayfaYasal();
  else if (ad === "takip") { if (typeof sayfaTakip === "function") sayfaTakip(); else location.replace("#kitaplik"); }
  else if (ad === "yonetim") { if (typeof sayfaYonetim === "function") sayfaYonetim(); else location.replace("#ayarlar"); }
  else if (ad === "k") sayfaAyrinti(arg);
  else if (ad === "oyunlar" && typeof sayfaOyunlar === "function") sayfaOyunlar();
  else if (ad === "oyun" && typeof sayfaKelime === "function") {
    const [oyun, ...geri] = arg.split("/");
    if (oyun === "kelime") { $("#baslik").textContent = tx("Kelime Kazısı"); sayfaKelime(); }
    else if (oyun === "kazi") { $("#baslik").textContent = tx("Kazı Başı"); sayfaKaziOyun(geri.join("/")); }
    else if (oyun === "sirala" && typeof sayfaSirala === "function") { $("#baslik").textContent = tx("Katman Sırala"); sayfaSirala(); }
    else { location.replace("#oyunlar"); return; }
  }
  else { location.hash = "#bugun"; return; }
  kaydirmaBagla();
  reklamlariDoldur();
  ozetRozeti();
  window.scrollTo(0, kaydirmayiKoru ? y : 0);
}

$("#geri").addEventListener("click", () => { if (history.length > 1) history.back(); else location.hash = "#" + sonSekme; });
$("#bildir-ac").addEventListener("click", () => { if (typeof bildirSecimi === "function") bildirSecimi(); });
window.addEventListener("hashchange", () => rota());
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    const onceki = VERI.guncelleme;
    if (await veriYukle(true) && VERI.guncelleme !== onceki) { bildir(tx("{n} yeni kayıt geldi", { n: VERI.yeni_sayisi })); rota(true); }
  }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", temaUygula);

/* ---------------------------------------------------------------- başlangıç */
window.acilisBitti = new Promise(r => { window.acilisBittiCoz = r; });   // açılış ekranları (KVKK, tema, tanıtım, günlük) bitince
(async function baslat() {
  statikCevir();
  temaUygula();
  const acilis = $("#acilis");
  const sure = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 950;
  const bekle = new Promise(r => setTimeout(r, sure));
  await Promise.all([veriYukle(true), sozleriYukle(), bekle, window.GUNLUK ? GUNLUK.yukle() : null]);
  temaUygula();   // günün görseli veri gelince
  // ilk açılışta bir kez giriş ekranını göster (isteyen "Giriş yapmadan devam et" der)
  if (!D.girisSoruldu && !D.uid && window.FIREBASE_AYAR && window.FIREBASE_AYAR.apiKey) {
    D.girisSoruldu = true; kaydet();
    history.replaceState(null, "", "#bugun"); location.hash = "#giris";
  }
  rota();
  acilis.classList.add("bitti");
  setTimeout(() => acilis.remove(), 600);
  await kvkkKapisi();
  if (!D.temaSecildi && typeof temaSecici === "function") {
    D.palet = await temaSecici(D.palet || "gobeklitepe", id => { D.palet = id; temaUygula(); });
    D.temaSecildi = true; kaydet(); temaUygula(); rota(true);
  }
  if (typeof tanitimGoster === "function" && (D.tanitimGoruldu || 0) < TANITIM_SURUM) {
    await tanitimGoster(); D.tanitimGoruldu = TANITIM_SURUM; kaydet();
  }
  await kurulumPenceresi();
  if (window.GUNLUK) await GUNLUK.acilis({ baslik: tx("Günün Ören Yeri"), dugme: tx("Bugüne başla") }, D.gunlukGun, g => { D.gunlukGun = g; kaydet(); });
  window.acilisBittiCoz();
  if (typeof epostaSorusuKontrol === "function") setTimeout(epostaSorusuKontrol, 1200);
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js"); if (D.bildirim) arkaPlanKaydi(); } catch (e) {}
  }
})();
