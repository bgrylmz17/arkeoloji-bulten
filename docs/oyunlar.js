/* Arkix — Oyunlar (#oyunlar): Kelime Kazısı (günlük kelime) ve Kazı Başı (piksel kazı, kazi-oyun.js); ortak skor tablosu.
 * Şimdilik yalnız web; uygulama mağazaya çıkınca uygulamaya özel olacak.
 * Skor: Firestore skorlar/{oyun}_{gun}_{uid} { oyun, gun, oyun_gun, oyun_hafta, uid, ad, avatar, puan, ayrinti, tarih }
 *   kişi başına günde bir belge (gün içinde güncellenir); tablo: bugün (oyun_gun) ve bu hafta (oyun_hafta, istemcide toplanır).
 *   Kurallar: mobil/firestore.rules › skorlar. */

const $$ = s => [...document.querySelectorAll(s)];

/* ---------------------------------------------------------------- ortak: gün, hafta, skor */
function oyunGunu(d = new Date()) {   // yerel gün: oyunlar yerel gece yarısında yenilenir
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function oyunHaftasi(d = new Date()) {   // ISO hafta: 2026-W48
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const g = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - g);
  const yb = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - yb) / 864e5 + 1) / 7)).padStart(2, "0")}`;
}
const OYUN_ADI = { kelime: "Kelime Kazısı", kazi: "Kazı Başı" };

async function skorGonder(oyun, puan, ayrinti) {
  if (!H.kullanici || H.yok) return false;
  try {
    const { fs } = await firebaseYukle();
    const gun = oyunGunu(), uid = H.kullanici.uid;
    await fs.setDoc(fs.doc(H.db, "skorlar", `${oyun}_${gun}_${uid}`), {
      oyun, gun, oyun_gun: `${oyun}_${gun}`, oyun_hafta: `${oyun}_${oyunHaftasi()}`, uid,
      ad: (gorunenAd() || tx("Arkeolog")).slice(0, 40), avatar: (profilAl().avatar || "").slice(0, 40),
      puan: Math.max(0, Math.min(5000, Math.round(puan))), ayrinti: String(ayrinti || "").slice(0, 80), tarih: fs.serverTimestamp() });
    return true;
  } catch (e) { return false; }
}

async function skorTablosuCiz(kap, oyun, kapsam = "gun") {
  kap.innerHTML = `<p class="aciklama">${tx("Yükleniyor…")}</p>`;
  let satirlar = [];
  try {
    const { fs } = await firebaseYukle();
    const alan = kapsam === "gun" ? "oyun_gun" : "oyun_hafta";
    const deger = kapsam === "gun" ? `${oyun}_${oyunGunu()}` : `${oyun}_${oyunHaftasi()}`;
    const a = await fs.getDocs(fs.query(fs.collection(H.db, "skorlar"), fs.where(alan, "==", deger), fs.limit(500)));
    const kisi = {};
    a.docs.forEach(d => { const v = d.data(); const k = kisi[v.uid] || (kisi[v.uid] = { ad: v.ad, avatar: v.avatar, puan: 0, gun: 0 }); k.puan += v.puan || 0; k.gun++; k.ad = v.ad; k.avatar = v.avatar; });
    satirlar = Object.entries(kisi).map(([uid, v]) => ({ uid, ...v })).sort((x, y) => y.puan - x.puan);
  } catch (e) { kap.innerHTML = `<p class="aciklama">${tx("Skor tablosu şu an yüklenemedi.")}</p>`; return; }
  const ben = H.kullanici && H.kullanici.uid;
  const benSira = satirlar.findIndex(s => s.uid === ben);
  const goster = satirlar.slice(0, 20);
  const satir = (s, i) => `<li class="${s.uid === ben ? "ben" : ""}"><b class="sira">${i + 1}</b>
      ${s.avatar && typeof avatarAdresi === "function" ? `<img class="avatar" src="${esc(avatarAdresi(s.avatar))}" alt="" width="32" height="32">`
        : `<span class="avatar avatar-bas" style="width:32px;height:32px">${esc((s.ad || "?")[0].toLocaleUpperCase("tr"))}</span>`}
      <span class="ad">${esc(s.ad || tx("Arkeolog"))}</span><span class="puan">${s.puan}</span></li>`;
  kap.innerHTML = satirlar.length
    ? `<ol class="skor-liste">${goster.map(satir).join("")}${benSira >= 20 ? `<li class="ayrac">…</li>${satir(satirlar[benSira], benSira)}` : ""}</ol>`
    : `<p class="aciklama">${tx("Henüz skor yok. İlk sen ol!")}</p>`;
  if (!H.kullanici) kap.insertAdjacentHTML("beforeend", `<p class="aciklama"><a href="#giris">${tx("Giriş yap")}</a> · ${tx("skorların tabloya yazılsın")}</p>`);
}
function skorBolumuHtml(oyun) {
  return `<section class="oyun-skor" data-oyun="${oyun}"><div class="oyun-skor-ust"><h3>${tx("Skor tablosu")}</h3>
    <div class="bolumlu kucuk" role="group"><button data-kapsam="gun" aria-pressed="true">${tx("Bugün")}</button><button data-kapsam="hafta" aria-pressed="false">${tx("Bu hafta")}</button></div></div>
    <div class="skor-kap"></div></section>`;
}
function skorBolumuBagla(kok) {
  kok.querySelectorAll(".oyun-skor").forEach(b => {
    const kap = b.querySelector(".skor-kap"), oyun = b.dataset.oyun;
    b.querySelectorAll("[data-kapsam]").forEach(d => d.onclick = () => {
      b.querySelectorAll("[data-kapsam]").forEach(x => x.setAttribute("aria-pressed", String(x === d)));
      skorTablosuCiz(kap, oyun, d.dataset.kapsam);
    });
    skorTablosuCiz(kap, oyun, "gun");
  });
}

/* ---------------------------------------------------------------- oyunlar merkezi */
function sayfaOyunlar() {
  const kd = kelimeDurumu(), kz = typeof kaziDurumu === "function" ? kaziDurumu() : null;
  $("#sayfa").innerHTML = `<div class="oyun-merkez">
    <p class="aciklama" style="margin:14px 16px 4px">${tx("Her gün yeni bir kelime ve üç kazı izni. Oynarken öğren, skor tablosunda yüksel.")}</p>
    <a class="oyun-kart kelime-kart" href="#oyun/kelime">
      <span class="oyun-gorsel">${["K", "A", "Z", "I"].map((h, i) => `<i class="tas ${["yerinde", "var", "yok", "yerinde"][i]}">${h}</i>`).join("")}</span>
      <span class="oyun-yazi"><b>${tx("Kelime Kazısı")}</b><small>${tx("Günün arkeoloji terimini 6 denemede bul.")}</small>
        <em>${kd.bitti ? (kd.kazandi ? tx("Bugün çözdün · {n}/6", { n: kd.tahminler.length }) : tx("Bugün bitti · yarın yeni kelime")) : tx("Bugünün kelimesi seni bekliyor")}</em></span></a>
    <a class="oyun-kart kazioyun-kart" href="#oyun/kazi">
      <span class="oyun-gorsel"><canvas width="48" height="32" id="oyun-kart-kazi"></canvas></span>
      <span class="oyun-yazi"><b>${tx("Kazı Başı")}</b><small>${tx("Ünlü ören yerlerinde kaz, gerçek buluntuları çıkar ve tanı.")}</small>
        <em>${kz ? tx("Bugün kalan kazı izni: {n}/3", { n: kz.hak }) : ""}</em></span></a>
    ${skorBolumuHtml("kelime")}${skorBolumuHtml("kazi")}
  </div>`;
  $$(".oyun-skor h3").forEach(h => { const o = h.closest(".oyun-skor").dataset.oyun; h.textContent = `${tx(OYUN_ADI[o])} · ${tx("Skor tablosu")}`; });
  if (typeof kaziKartGorseli === "function") kaziKartGorseli($("#oyun-kart-kazi"));
  skorBolumuBagla($("#sayfa"));
}

/* ---------------------------------------------------------------- Kelime Kazısı
 * Her gün herkese aynı 5 harfli terim (KELIMELER sırası, BASLANGIC'tan beri geçen gün). Tahmin herhangi 5 harf olabilir.
 * İşaretler: yerinde (harf doğru yerde), var (kelimede ama başka yerde), yok. Puan: çözülürse (7 − deneme) × 100. */
const KELIME_BASLANGIC = "2026-11-26";
const KELIMELER = [
  ["HÖYÜK", "Üst üste kurulan yerleşimlerin katmanlarıyla yükselmiş yapay tepe.", "An artificial mound built up by layers of successive settlements."],
  ["SİKKE", "Antik madeni para. Batı Anadolu'da Lidya'da ilk örnekleri basıldı.", "An ancient coin. Among the earliest were struck in Lydia, western Anatolia."],
  ["LAHİT", "Taştan ya da pişmiş topraktan yapılmış, çoğu kabartmalı tabut.", "A coffin of stone or terracotta, often carved in relief."],
  ["AGORA", "Antik Yunan kentlerinde pazar yeri ve halkın toplandığı meydan.", "The market and public gathering square of an ancient Greek city."],
  ["FRESK", "Yaş sıva üzerine yapılan, sıva kuruyunca kalıcı olan duvar resmi.", "A wall painting made on wet plaster that becomes permanent as it dries."],
  ["MÜHÜR", "Sahiplik ve onayı göstermek için kile ya da mumda iz bırakan damga.", "A stamp leaving an impression in clay or wax to mark ownership or approval."],
  ["HİTİT", "Tunç Çağı'nda Orta Anadolu'da devlet kuran halk; başkenti Hattuşa.", "Bronze Age people who founded a state in central Anatolia; capital Hattusa."],
  ["KOLON", "Yapıda yükü taşıyan dikey destek; sütun.", "A vertical load-bearing support in a building; a column."],
  ["TROYA", "Çanakkale'de, dokuz ana yerleşim katı olan, İlyada'yla ünlü kent.", "City near Çanakkale with nine main layers, famous from the Iliad."],
  ["APSİS", "Yapıların ucunda yer alan, yarım daire planlı bölüm.", "A semicircular recess at the end of a building."],
  ["RİTON", "Çoğu hayvan başı ya da boynuz biçiminde, törenlerde kullanılan içki kabı.", "A drinking vessel, often animal-headed or horn-shaped, used in rituals."],
  ["TESTİ", "Sıvı taşımak ve saklamak için kulplu, dar ağızlı toprak kap.", "A handled, narrow-mouthed clay jug for carrying and storing liquids."],
  ["KUBBE", "Yarım küre biçimli örtü; Roma ve Bizans yapılarının simgesi.", "A hemispherical roof; a hallmark of Roman and Byzantine buildings."],
  ["YAZIT", "Taşa, metale ya da başka sert bir yüzeye kazınmış yazı.", "Writing carved into stone, metal or another hard surface; an inscription."],
  ["ODEON", "Müzik ve şiir için yapılmış küçük, çoğu üstü kapalı tiyatro.", "A small, often roofed theatre built for music and poetry."],
  ["LİDYA", "Başkenti Sardes olan Batı Anadolu krallığı; ilk sikkelerle anılır.", "A western Anatolian kingdom with its capital at Sardis; linked to the first coins."],
  ["KEMER", "Taşları birbirine yaslayarak açıklığı geçen yay biçimli yapı öğesi.", "A curved structure spanning an opening by stones bearing on each other; an arch."],
  ["TORSO", "Baş ve kolları olmayan heykel gövdesi.", "A statue's body without head and arms."],
  ["SKENE", "Antik tiyatroda oyuncuların arkasındaki sahne binası.", "The stage building behind the actors in an ancient theatre."],
  ["PİTOS", "Tahıl, yağ ve şarap saklanan, insan boyunda büyük küp.", "A large, person-sized storage jar for grain, oil and wine (pithos)."],
  ["KUROS", "Arkaik dönemde ayakta duran çıplak genç erkek heykeli.", "An Archaic standing statue of a nude young man (kouros)."],
  ["ASSOS", "Çanakkale'de, Athena Tapınağı'yla bilinen antik kent.", "Ancient city near Çanakkale known for its Temple of Athena."],
  ["KAVEA", "Antik tiyatroda seyircilerin oturduğu basamaklı bölüm.", "The tiered seating area of an ancient theatre (cavea)."],
  ["ÇANAK", "Pişmiş topraktan kap; çanak çömlek arkeolojinin en sık buluntusu.", "A fired clay vessel; pottery is the most common archaeological find."],
  ["LİKYA", "Teke Yarımadası'nda, kaya mezarlarıyla ünlü antik bölge.", "An ancient region on the Teke Peninsula, famous for rock-cut tombs."],
  ["FORUM", "Roma kentlerinin pazar, yönetim ve tapınak meydanı.", "The market, civic and temple square of a Roman city."],
  ["HAMAM", "Sıcak, ılık ve soğuk bölümleri olan yıkanma yapısı.", "A bathing building with hot, warm and cold rooms."],
  ["KARYA", "Halikarnassos ve Mylasa'nın bulunduğu Güneybatı Anadolu bölgesi.", "Southwest Anatolian region home to Halicarnassus and Mylasa."],
  ["SÜTUN", "Başlık, gövde ve kaideden oluşan taşıyıcı dikme.", "A support made of capital, shaft and base; a column."],
  ["PERGE", "Antalya'da, sütunlu caddeleri ve tiyatrosuyla ünlü antik kent.", "Ancient city near Antalya famous for colonnaded streets and its theatre."],
  ["KAZMA", "Toprağı kazmak için kullanılan, sapı uzun el aleti.", "A long-handled hand tool for breaking ground; a pickaxe."],
  ["BALTA", "Neolitik'te cilalı taştan, sonra tunçtan ve demirden yapılan kesici alet.", "A cutting tool made of polished stone in the Neolithic, later of bronze and iron."],
];
function kelimeGunNo() { return Math.max(0, Math.round((new Date(oyunGunu() + "T00:00:00") - new Date(KELIME_BASLANGIC + "T00:00:00")) / 864e5)); }
function gununKelimesi() { const k = KELIMELER[kelimeGunNo() % KELIMELER.length]; return { kelime: k[0], anlam: DIL === "en" ? k[2] : k[1] }; }
function kelimeDurumu() {
  const g = oyunGunu();
  if (!D.kelime || D.kelime.gun !== g) D.kelime = { gun: g, tahminler: [], bitti: false, kazandi: false };
  return D.kelime;
}
const harfler = s => [...s];
function kelimeIsaretle(tahmin, hedef) {
  const t = harfler(tahmin), h = harfler(hedef), sonuc = t.map(() => "yok"), kalan = {};
  h.forEach((c, i) => { if (t[i] === c) sonuc[i] = "yerinde"; else kalan[c] = (kalan[c] || 0) + 1; });
  t.forEach((c, i) => { if (sonuc[i] !== "yerinde" && kalan[c]) { sonuc[i] = "var"; kalan[c]--; } });
  return sonuc;
}
const TR_HARF = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ";
let kelimeGirdi = "";
function sayfaKelime() {
  const kd = kelimeDurumu(), { kelime, anlam } = gununKelimesi();
  const isaretler = kd.tahminler.map(t => kelimeIsaretle(t, kelime));
  const klavyeDurum = {};
  kd.tahminler.forEach((t, i) => harfler(t).forEach((c, j) => {
    const yeni = isaretler[i][j], eski = klavyeDurum[c];
    if (eski === "yerinde" || (eski === "var" && yeni === "yok")) return;
    klavyeDurum[c] = yeni;
  }));
  const satirlar = [];
  for (let i = 0; i < 6; i++) {
    const t = kd.tahminler[i] || (i === kd.tahminler.length && !kd.bitti ? kelimeGirdi : "");
    const hs = harfler(t);
    satirlar.push(`<div class="kk-satir${i === kd.tahminler.length && !kd.bitti ? " etkin" : ""}">${[0, 1, 2, 3, 4].map(j =>
      `<span class="tas ${kd.tahminler[i] ? isaretler[i][j] : hs[j] ? "dolu" : ""}">${esc(hs[j] || "")}</span>`).join("")}</div>`);
  }
  const tus = c => `<button class="kk-tus ${klavyeDurum[c] || ""}" data-h="${c}">${c}</button>`;
  $("#sayfa").innerHTML = `<div class="kelime-oyun">
    <p class="kk-ust">${tx("Günün arkeoloji terimi · 5 harf")} · <span>${esc(tarihYaz(oyunGunu()))}</span> · <button class="metin-dugme" id="kk-nasil">${tx("Nasıl oynanır?")}</button></p>
    <div class="kk-izgara">${satirlar.join("")}</div>
    ${kd.bitti ? `<div class="kk-sonuc"><p class="kk-kelime">${esc(kelime)}</p><p>${esc(anlam)}</p>
        <p><b>${kd.kazandi ? tx("Tebrikler! {n}. denemede buldun · {p} puan", { n: kd.tahminler.length, p: (7 - kd.tahminler.length) * 100 }) : tx("Bu sefer olmadı. Yarın yeni kelime!")}</b></p>
        <p class="kk-seri">${tx("Seri: {n} gün · En iyi: {e}", { n: (D.kelimeSeri || {}).seri || 0, e: (D.kelimeSeri || {}).enIyi || 0 })}</p>
        <p style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="buyuk-dugme" id="kk-paylas">${tx("Sonucu paylaş")}</button>
          <a class="ikincil-dugme" href="#oyun/kazi">${tx("Kazı Başı'na geç")}</a></p></div>`
      : `<div class="kk-klavye">
        <div>${"ERTYUIOPĞÜ".split("").map(tus).join("")}</div>
        <div>${"ASDFGHJKLŞİ".split("").map(tus).join("")}</div>
        <div><button class="kk-tus genis" data-h="SIL" aria-label="${tx("Sil")}">⌫</button>${"ZCVBNMÖÇ".split("").map(tus).join("")}<button class="kk-tus genis" data-h="TAMAM">${tx("Dene")}</button></div></div>`}
    ${skorBolumuHtml("kelime")}</div>`;
  $(".oyun-skor h3").textContent = tx("Kelime Kazısı · Skor tablosu");
  skorBolumuBagla($("#sayfa"));
  $("#kk-nasil").onclick = kelimeNasil;
  if (kd.bitti) { $("#kk-paylas").onclick = () => kelimePaylas(); return; }
  $$(".kk-tus").forEach(b => b.onclick = () => kelimeTus(b.dataset.h));
}
function kelimeTus(h) {
  const kd = kelimeDurumu();
  if (kd.bitti) return;
  if (h === "SIL") kelimeGirdi = harfler(kelimeGirdi).slice(0, -1).join("");
  else if (h === "TAMAM") {
    if (harfler(kelimeGirdi).length !== 5) { bildir(tx("5 harf yazın")); $(".kk-satir.etkin") && $(".kk-satir.etkin").classList.add("salla"); return; }
    const { kelime } = gununKelimesi();
    kd.tahminler.push(kelimeGirdi); kelimeGirdi = "";
    if (kd.tahminler[kd.tahminler.length - 1] === kelime) { kd.bitti = true; kd.kazandi = true; }
    else if (kd.tahminler.length >= 6) kd.bitti = true;
    if (kd.bitti) kelimeBitti(kd);
    kaydet();
  } else if (TR_HARF.includes(h) && harfler(kelimeGirdi).length < 5) kelimeGirdi += h;
  if (location.hash === "#oyun/kelime") { const y = window.scrollY; sayfaKelime(); window.scrollTo(0, y); }
}
function kelimeBitti(kd) {
  const s = D.kelimeSeri || { seri: 0, enIyi: 0, son: "" };
  const dun = oyunGunu(new Date(Date.now() - 864e5));
  if (kd.kazandi) { s.seri = s.son === dun ? s.seri + 1 : 1; s.enIyi = Math.max(s.enIyi, s.seri); s.son = kd.gun; }
  else s.seri = 0;
  D.kelimeSeri = s;
  const puan = kd.kazandi ? (7 - kd.tahminler.length) * 100 : 0;
  skorGonder("kelime", puan, `${kd.kazandi ? kd.tahminler.length : "X"}/6`).then(ok => { if (ok && location.hash === "#oyun/kelime") skorBolumuBagla($("#sayfa")); });
}
function kelimePaylas() {
  const kd = kelimeDurumu(), { kelime } = gununKelimesi();
  const simge = { yerinde: "🟧", var: "🟫", yok: "⬛" };
  const izgara = kd.tahminler.map(t => kelimeIsaretle(t, kelime).map(x => simge[x]).join("")).join("\n");
  const metin = `${tx("Kelime Kazısı")} ${tarihYaz(oyunGunu())} · ${kd.kazandi ? kd.tahminler.length : "X"}/6\n${izgara}\n${location.origin}${location.pathname}#oyun/kelime`;
  if (navigator.share) navigator.share({ text: metin }).catch(() => {});
  else navigator.clipboard.writeText(metin).then(() => bildir(tx("Panoya kopyalandı")), () => {});
}
function kelimeNasil() {
  levhaAc(`<h3>${tx("Kelime Kazısı nasıl oynanır?")}</h3>
    <p>${tx("Günün 5 harfli arkeoloji terimini 6 denemede bul. Her denemeden sonra harfler işaretlenir:")}</p>
    <div class="kutu"><div class="satir"><span class="tas yerinde">H</span>${tx("Harf doğru yerde")}</div>
      <div class="satir"><span class="tas var">Ö</span>${tx("Harf kelimede var ama başka yerde")}</div>
      <div class="satir"><span class="tas yok">Y</span>${tx("Harf kelimede yok")}</div></div>
    <p class="aciklama">${tx("Kelime her gece yarısı değişir; herkes aynı kelimeyi çözer. Çözünce terimin anlamını öğrenirsin. Puan: 1. denemede 600, 6. denemede 100.")}</p>`);
}
document.addEventListener("keydown", e => {
  if (location.hash !== "#oyun/kelime" || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (!$("#levha").hidden) return;
  if (e.key === "Enter") { e.preventDefault(); kelimeTus("TAMAM"); }
  else if (e.key === "Backspace") { e.preventDefault(); kelimeTus("SIL"); }
  else if (e.key.length === 1) { const h = e.key.toLocaleUpperCase("tr"); if (TR_HARF.includes(h)) kelimeTus(h); }
});
