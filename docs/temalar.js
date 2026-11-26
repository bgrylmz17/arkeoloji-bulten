/* Arkix — ören yeri temaları. Renkler stil.css'te (:root[data-palet="…"]); varsayılan Göbeklitepe = :root.
 * Native: harrix-arkeoloji-mobil/src/theme/palettes.ts (aynı kimlikler ve renkler).
 * İlk açılışta (KVKK onayından sonra) bir kez seçici çıkar; sonra Ayarlar › Görünüm › Tema. */
const TEMALAR = [
  { id: "gobeklitepe", ad: "Göbeklitepe", aciklama: { tr: "Kireçtaşı ve Urfa toprağı", en: "Limestone and Urfa soil" }, renk: ["#eef0e9", "#b8863b", "#d8c6a6", "#a8805a", "#6b4a35", "#3a2c24"] },
  { id: "efes", ad: "Efes", en: "Ephesus", aciklama: { tr: "Mermer ve Ege mavisi", en: "Marble and Aegean blue" }, renk: ["#f3f4f2", "#2f6f9f", "#d9dde0", "#9fb3c3", "#4f6f8a", "#263a4d"] },
  { id: "catalhoyuk", ad: "Çatalhöyük", aciklama: { tr: "Kerpiç ve aşı boyası", en: "Mudbrick and red ochre" }, renk: ["#f2ebe3", "#a3412b", "#e2c3a8", "#b9795a", "#7d3f2a", "#3f2118"] },
  { id: "hattusa", ad: "Hattuşa", en: "Hattusa", aciklama: { tr: "Bazalt ve Hitit tuncu", en: "Basalt and Hittite bronze" }, renk: ["#eceae6", "#856526", "#c9c6bf", "#8f8b84", "#55524d", "#2b2a28"] },
  { id: "nemrut", ad: "Nemrut", aciklama: { tr: "Zirvede gün doğumu", en: "Sunrise on the summit" }, renk: ["#f4eee6", "#b5561f", "#e8cdb2", "#c99470", "#8a5a3c", "#4a2f22"] },
  { id: "zeugma", ad: "Zeugma", aciklama: { tr: "Mozaik laciverti ve terrakota", en: "Mosaic blue and terracotta" }, renk: ["#f1efe9", "#2e4a7a", "#e0c6b0", "#c27a52", "#7a4630", "#1f2f4f"] },
  { id: "kapadokya", ad: "Kapadokya", en: "Cappadocia", aciklama: { tr: "Tüf kayaların pembesi", en: "Pink of the tuff rocks" }, renk: ["#f4efeb", "#9e5359", "#ecd8cf", "#cfa79a", "#8c6158", "#4a3330"] },
];
/* eski palet adları (1.10 öncesi) */
const ESKI_PALET = { kum: "gobeklitepe", lacivert: "efes", zeytin: "hattusa", murdum: "kapadokya" };
const temaAdi = t => (typeof DIL !== "undefined" && DIL === "en" && t.en) || t.ad;
const temaAciklama = t => t.aciklama[typeof DIL !== "undefined" && DIL === "en" ? "en" : "tr"];

function temaKartlariHtml(secili) {
  return `<div class="tema-izgara">${TEMALAR.map(t => `<button type="button" class="tema-kart${t.id === secili ? " secili" : ""}" data-tema-sec="${t.id}" aria-pressed="${t.id === secili}">
    <span class="tema-onizleme" style="background:${t.renk[0]}"><span style="background:${t.renk[1]}"></span>${t.renk.slice(2).map(r => `<i style="background:${r}"></i>`).join("")}</span>
    <b>${temaAdi(t)}</b><small>${temaAciklama(t)}</small></button>`).join("")}</div>`;
}

/* Tam ekran seçici. uygula(id) temayı hemen uygular (canlı önizleme), bitince tamam() */
function temaSecici(secili, uygula) {
  return new Promise(tamam => {
    const k = document.createElement("div");
    k.className = "onay-kapi tema-kapi"; k.setAttribute("role", "dialog"); k.setAttribute("aria-modal", "true"); k.setAttribute("aria-labelledby", "tema-baslik");
    const ciz = () => {
      k.innerHTML = `<div class="onay-kutu"><h2 id="tema-baslik">${tx("Temanızı seçin")}</h2>
        <p>${tx("Her tema bir ören yerinin taşından ve toprağından renk alır. Sonra Ayarlar › Görünüm'den değiştirebilirsiniz.")}</p>
        ${temaKartlariHtml(secili)}
        <button class="buyuk-dugme" id="tema-tamam">${tx("Devam et")}</button></div>`;
      k.querySelectorAll("[data-tema-sec]").forEach(b => b.onclick = () => { secili = b.dataset.temaSec; uygula(secili); ciz(); });
      k.querySelector("#tema-tamam").onclick = () => { k.remove(); tamam(secili); };
    };
    ciz();
    document.body.appendChild(k);
  });
}
