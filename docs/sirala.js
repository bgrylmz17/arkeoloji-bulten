/* Arkix — Katman Sırala (#oyun/sirala) ve oyun rozetleri.
 * Her gün 5 buluntu (Kazı Başı'nın buluntuları, kazi-oyun.js › KZ_ALANLAR/SPRITE): en eskiden en yeniye sırala. 3 deneme.
 * Buluntular yalnız birbirine karışmayan dönem gruplarından seçilir (SIRALA_DONEM); her gruptan en çok bir tane → doğru sıra kesin.
 * Puan: 1. denemede 500, 2.'de 300, 3.'de 150. Rozetler: D.rozetler { id: gün }. */
const SIRALA_DONEM = [
  { sira: 1, ad: "Alt Paleolitik", ad_en: "Lower Palaeolithic", ids: ["elbaltasi"] },
  { sira: 2, ad: "Orta Paleolitik (Neandertaller çağı)", ad_en: "Middle Palaeolithic (age of Neanderthals)", ids: ["levallois", "dis"] },
  { sira: 3, ad: "Epipaleolitik (yaklaşık 20.000–12.000 yıl önce)", ad_en: "Epipalaeolithic (about 20,000–12,000 years ago)", ids: ["dilgicik", "nukleus", "tasfigurin"] },
  { sira: 4, ad: "Çanak Çömleksiz Neolitik (MÖ 9600–8200)", ad_en: "Pre-Pottery Neolithic (9600–8200 BC)", ids: ["tdikili", "akbaba", "okucu", "bas"] },
  { sira: 5, ad: "Neolitik (MÖ 7100–5950)", ad_en: "Neolithic (7100–5950 BC)", ids: ["figurin", "ayna", "bukranion", "muhur"] },
  { sira: 6, ad: "Erken Tunç Çağı (MÖ 3. binyıl)", ad_en: "Early Bronze Age (3rd millennium BC)", ids: ["depas", "kupe"] },
  { sira: 7, ad: "Hitit dönemi (MÖ 1650–1200)", ad_en: "Hittite period (1650–1200 BC)", ids: ["tablet", "riton", "kilic", "bulla"] },
  { sira: 8, ad: "Roma dönemi (MS 1.–3. yüzyıl)", ad_en: "Roman period (1st–3rd century AD)", ids: ["kandil", "artemis", "gladyator", "mozaik", "mars", "fresk"] },
];
const SIRALA_PUAN = [500, 300, 150];
function siralaRastgele(tohum) {   // mulberry32
  return () => { tohum |= 0; tohum = tohum + 0x6D2B79F5 | 0; let t = Math.imul(tohum ^ tohum >>> 15, 1 | tohum); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function siralaBuluntu(id) {
  for (const a of KZ_ALANLAR) { const b = a.buluntular.find(x => x.id === id); if (b) return { ...b, alan: a }; }
  return null;
}
function gununSiralamasi() {
  const gun = oyunGunu(), r = siralaRastgele(Number(gun.replace(/-/g, "")) * 7919);
  const gruplar = [...SIRALA_DONEM].sort(() => r() - .5).slice(0, 5);
  const ogeler = gruplar.map(g => ({ id: g.ids[Math.floor(r() * g.ids.length)], donem: g })).filter(o => siralaBuluntu(o.id));
  let karisik = [...ogeler].sort(() => r() - .5);
  if (karisik.every((o, i) => o.donem.sira === [...ogeler].sort((a, b) => a.donem.sira - b.donem.sira)[i].donem.sira)) karisik = karisik.reverse();
  return { dogru: [...ogeler].sort((a, b) => a.donem.sira - b.donem.sira).map(o => o.id), karisik: karisik.map(o => o.id), donem: Object.fromEntries(ogeler.map(o => [o.id, o.donem])) };
}
function siralaDurumu() {
  const g = oyunGunu();
  if (!D.sirala || D.sirala.gun !== g) D.sirala = { gun: g, dizi: gununSiralamasi().karisik, denemeler: [], bitti: false, kazandi: false };
  return D.sirala;
}
function sayfaSirala() {
  const sd = siralaDurumu(), gs = gununSiralamasi();
  const dogruSayi = d => d.filter((id, i) => id === gs.dogru[i]).length;
  const son = sd.denemeler[sd.denemeler.length - 1];
  const dEn = d => DIL === "en" ? d.ad_en : d.ad;
  $("#sayfa").innerHTML = `<div class="sirala-oyun">
    <p class="kk-ust">${tx("Buluntuları en eskiden en yeniye sırala")} · ${esc(tarihYaz(oyunGunu()))} ${oyunSesDugmesi()}</p>
    <p class="sirala-ok">${tx("En eski")} ↑</p>
    <ol class="sirala-liste">${(sd.bitti ? gs.dogru : sd.dizi).map((id, i) => {
      const b = siralaBuluntu(id);
      const isaret = sd.bitti ? "" : son ? (son[i] === gs.dogru[i] && son[i] === id ? " dogru" : "") : "";
      return `<li class="sirala-kart${isaret}${sd.bitti ? " acik" : ""}" data-id="${id}"><canvas width="48" height="48"></canvas>
        <span><b>${esc(kzAd(b))}</b><small>${esc(b.alan.ad)}${sd.bitti ? ` · <em>${esc(dEn(gs.donem[id]))}</em>` : ""}</small></span>
        ${sd.bitti ? "" : `<span class="sirala-oklar"><button data-yon="-1" data-i="${i}" aria-label="${tx("Yukarı")}" ${i === 0 ? "disabled" : ""}>▲</button><button data-yon="1" data-i="${i}" aria-label="${tx("Aşağı")}" ${i === 4 ? "disabled" : ""}>▼</button></span>`}</li>`;
    }).join("")}</ol>
    <p class="sirala-ok">${tx("En yeni")} ↓</p>
    ${sd.bitti ? `<div class="kk-sonuc"><p><b>${sd.kazandi ? tx("Kusursuz! {n}. denemede · {p} puan", { n: sd.denemeler.length, p: SIRALA_PUAN[sd.denemeler.length - 1] }) : tx("Bu sefer olmadı. Doğru sıra yukarıda.")}</b></p>
        <p class="aciklama">${tx("Dönemleri öğrenmek için buluntulara dokun.")}</p>
        <p style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="buyuk-dugme" id="sr-paylas">${tx("Sonucu paylaş")}</button><a class="ikincil-dugme" href="#oyunlar">${tx("Oyunlar")}</a></p></div>`
      : `<p class="sirala-durum">${son ? tx("{n}/5 doğru yerde · kalan deneme: {k}", { n: dogruSayi(son), k: 3 - sd.denemeler.length }) : tx("3 deneme hakkın var. Okla yukarı-aşağı taşı.")}</p>
        <p style="text-align:center"><button class="buyuk-dugme" id="sr-kontrol" style="max-width:320px;margin:0 auto">${tx("Sırayı kontrol et")}</button></p>`}
    ${skorBolumuHtml("sirala")}</div>`;
  $(".oyun-skor h3").textContent = tx("Katman Sırala · Skor tablosu");
  skorBolumuBagla($("#sayfa"));
  oyunSesBagla();
  $$(".sirala-kart").forEach(li => {
    spriteCiz(li.querySelector("canvas").getContext("2d"), li.dataset.id, 0, 0, 4);
    if (sd.bitti) li.onclick = () => { const b = siralaBuluntu(li.dataset.id); kzBuluntuLevhasi(b, b.alan, false); };
  });
  if (sd.bitti) { $("#sr-paylas").onclick = siralaPaylas; return; }
  $$(".sirala-oklar button").forEach(b => b.onclick = () => {
    const i = +b.dataset.i, j = i + +b.dataset.yon;
    [sd.dizi[i], sd.dizi[j]] = [sd.dizi[j], sd.dizi[i]]; kaydet(); oyunSesi("tus");
    const y = window.scrollY; sayfaSirala(); window.scrollTo(0, y);
  });
  $("#sr-kontrol").onclick = () => {
    sd.denemeler.push([...sd.dizi]);
    const n = dogruSayi(sd.dizi);
    if (n === 5) { sd.bitti = true; sd.kazandi = true; }
    else if (sd.denemeler.length >= 3) sd.bitti = true;
    kaydet();
    if (sd.bitti) {
      oyunSesi(sd.kazandi ? "kazan" : "kaybet");
      skorGonder("sirala", sd.kazandi ? SIRALA_PUAN[sd.denemeler.length - 1] : 0, `${sd.kazandi ? sd.denemeler.length : "X"}/3`);
      if (sd.kazandi && sd.denemeler.length === 1) rozetVer("sirala_tam");
      rozetKontrol();
    } else { oyunSesi(n >= 3 ? "var" : "hata"); }
    const y = window.scrollY; sayfaSirala(); window.scrollTo(0, y);
  };
}
function siralaPaylas() {
  const sd = siralaDurumu(), gs = gununSiralamasi();
  const satir = sd.denemeler.map(d => d.map((id, i) => id === gs.dogru[i] ? "🟧" : "⬛").join("")).join("\n");
  const metin = `${tx("Katman Sırala")} ${tarihYaz(oyunGunu())} · ${sd.kazandi ? sd.denemeler.length : "X"}/3\n${satir}\n${location.origin}${location.pathname}#oyun/sirala`;
  if (navigator.share) navigator.share({ text: metin }).catch(() => {});
  else navigator.clipboard.writeText(metin).then(() => bildir(tx("Panoya kopyalandı")), () => {});
}

/* ---------------------------------------------------------------- rozetler */
function rozetListesi() {
  return [
    { id: "ilk_kazi", simge: "⛏", ad: "İlk kazı", ad_en: "First dig", nasil: "Kazı Başı'nda bir kazıyı bitir", nasil_en: "Finish a dig in Dig Site" },
    { id: "haftanin", simge: "⭐", ad: "Haftanın alanı", ad_en: "Site of the week", nasil: "Haftanın alanında kaz", nasil_en: "Dig at the site of the week" },
    { id: "nadir", simge: "✨", ad: "Olağanüstü buluntu", ad_en: "Exceptional find", nasil: "Olağanüstü korunmuş bir buluntu çıkar", nasil_en: "Uncover an exceptionally preserved find" },
    ...KZ_ALANLAR.map(a => ({ id: `alan_${a.id}`, simge: "📜", ad: `${a.ad}`, ad_en: `${a.ad}`, nasil: `${a.ad} defterini tamamla`, nasil_en: `Complete the ${a.ad} register` })),
    { id: "defter_tamam", simge: "🏛", ad: "Tam defter", ad_en: "Full register", nasil: "Bütün buluntuları bul", nasil_en: "Find every find" },
    { id: "kelime_ilk", simge: "🔤", ad: "İlk kelime", ad_en: "First word", nasil: "Kelime Kazısı'nı çöz", nasil_en: "Solve Word Dig" },
    { id: "kelime_tek", simge: "🎯", ad: "Tek seferde", ad_en: "First try", nasil: "Kelimeyi ilk denemede bul", nasil_en: "Find the word on the first try" },
    { id: "seri3", simge: "🔥", ad: "3 gün seri", ad_en: "3-day streak", nasil: "Kelimeyi 3 gün üst üste çöz", nasil_en: "Solve the word 3 days in a row" },
    { id: "seri7", simge: "☄", ad: "7 gün seri", ad_en: "7-day streak", nasil: "Kelimeyi 7 gün üst üste çöz", nasil_en: "Solve the word 7 days in a row" },
    { id: "sirala_tam", simge: "🧭", ad: "Kusursuz stratigrafi", ad_en: "Perfect stratigraphy", nasil: "Katman Sırala'yı ilk denemede çöz", nasil_en: "Solve Layer Order on the first try" },
    { id: "uc_oyun", simge: "🏆", ad: "Tam gün", ad_en: "Full day", nasil: "Aynı gün üç oyunu da oyna", nasil_en: "Play all three games on the same day" },
  ];
}
function rozetVer(id) {
  D.rozetler = D.rozetler || {};
  if (D.rozetler[id]) return false;
  D.rozetler[id] = oyunGunu(); kaydet();
  const r = rozetListesi().find(x => x.id === id);
  setTimeout(() => { bildir(`${r ? r.simge : "🏅"} ${tx("Yeni rozet")}: ${r ? (DIL === "en" ? r.ad_en : r.ad) : id}`); oyunSesi("ipucu"); }, 900);
  return true;
}
function rozetKontrol() {
  const defter = D.buluntuDefteri || {}, g = oyunGunu();
  KZ_ALANLAR.forEach(a => { if (a.buluntular.every(b => defter[b.id])) rozetVer(`alan_${a.id}`); });
  if (KZ_ALANLAR.every(a => a.buluntular.every(b => defter[b.id]))) rozetVer("defter_tamam");
  const kd = D.kelime || {}, ks = D.kelimeSeri || {};
  if (kd.kazandi) rozetVer("kelime_ilk");
  if (kd.kazandi && kd.tahminler && kd.tahminler.length === 1) rozetVer("kelime_tek");
  if ((ks.seri || 0) >= 3) rozetVer("seri3");
  if ((ks.seri || 0) >= 7) rozetVer("seri7");
  const kz = D.kaziOyun || {}, sr = D.sirala || {};
  if (kd.gun === g && kd.bitti && kz.gun === g && (kz.kosular || []).length && sr.gun === g && sr.bitti) rozetVer("uc_oyun");
}
function rozetlerHtml() {
  const var_ = D.rozetler || {}, l = rozetListesi();
  return `<section class="rozetler"><h3>${tx("Rozetlerim")} <small>${l.filter(r => var_[r.id]).length}/${l.length}</small></h3>
    <div class="rozet-izgara">${l.map(r => `<button class="rozet${var_[r.id] ? "" : " kilitli"}" data-rozet="${r.id}" title="${esc(DIL === "en" ? r.nasil_en : r.nasil)}">
      <span>${r.simge}</span><small>${esc(DIL === "en" ? r.ad_en : r.ad)}</small></button>`).join("")}</div></section>`;
}
function rozetleriBagla() {
  $$(".rozet").forEach(b => b.onclick = () => {
    const r = rozetListesi().find(x => x.id === b.dataset.rozet), ne = (D.rozetler || {})[r.id];
    bildir(`${r.simge} ${DIL === "en" ? r.ad_en : r.ad}: ${ne ? tx("kazanıldı · {t}", { t: tarihYaz(ne) }) : (DIL === "en" ? r.nasil_en : r.nasil)}`);
  });
}
