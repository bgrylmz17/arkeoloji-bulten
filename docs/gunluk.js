/* Arkix — günün arkeolojik alanı: arka plan görseli, günde bir kez açılış kartı, Bugün sayfasındaki bilgi kartı.
 * Veri gunluk/gunluk.json (native de aynı dosyayı okur). Görseller yapay zekâ ile üretilmiş temsilî görsellerdir;
 * her gösterildiği yerde bu not yazılır. Gün sırası UTC gün sayısıdır; alan = sıra % alan sayısı,
 * bilgi = (sıra / alan sayısı) % bilgi sayısı (7 alan × 3 bilgi: 21 günde bir tekrar). */
(function () {
  let VERI = null;
  const dil = () => (typeof DIL !== "undefined" && DIL === "en" ? "en" : "tr");
  const kac = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function gunSirasi(t = new Date()) {
    return Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 864e5);
  }
  function gunAnahtari(t = new Date()) {
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }

  async function yukle() {
    if (VERI) return VERI;
    try { VERI = await (await fetch("gunluk/gunluk.json")).json(); } catch (e) { VERI = null; }
    return VERI;
  }

  function bugun() {
    if (!VERI || !(VERI.alanlar || []).length) return null;
    const g = gunSirasi(), n = VERI.alanlar.length, a = VERI.alanlar[g % n];
    const b = a.bilgiler[Math.floor(g / n) % a.bilgiler.length];
    const d = dil();
    return { id: a.id, gorsel: a.gorsel, ad: a.ad[d] || a.ad.tr, bilgi: b[d] || b.tr, ai: (VERI.ai_notu || {})[d] || "" };
  }

  /* kip: "gorsel" (günün alanı), "desen" (çizimler; desen.js) ya da "sade" */
  function zemin(kip) {
    let kat = document.getElementById("zemin-gorsel");
    const g = kip === "gorsel" ? bugun() : null;
    if (!g) { if (kat) kat.remove(); return; }
    if (!kat) {
      kat = document.createElement("div");
      kat.id = "zemin-gorsel"; kat.setAttribute("aria-hidden", "true");
      document.body.prepend(kat);
    }
    kat.style.backgroundImage = `url("${g.gorsel}")`;
  }

  function kartHtml(metin) {
    const g = bugun();
    if (!g) return "";
    return `<section class="gunluk-kart" aria-label="${kac(metin.baslik)}">
      <img src="${kac(g.gorsel)}" alt="${kac(g.ad)}" loading="lazy">
      <div><small>${kac(metin.baslik)} · ${kac(g.ad)}</small><p>${kac(g.bilgi)}</p><em>${kac(g.ai)}</em></div></section>`;
  }

  /* Günde bir kez tam ekran kart. goruldu(gun) / yaz(gun) uygulamanın deposuna bakar. */
  function acilis(metin, gorulenGun, gunuYaz) {
    const g = bugun(), gun = gunAnahtari();
    if (!g || gorulenGun === gun) return Promise.resolve();
    return new Promise(tamam => {
      const k = document.createElement("div");
      k.className = "gunluk-kapi"; k.setAttribute("role", "dialog"); k.setAttribute("aria-modal", "true"); k.setAttribute("aria-labelledby", "gunluk-baslik");
      k.innerHTML = `<div class="gunluk-kutu">
        <figure><img src="${kac(g.gorsel)}" alt="${kac(g.ad)}"><figcaption>${kac(g.ai)}</figcaption></figure>
        <div class="gunluk-ic"><small>${kac(metin.baslik)}</small><h2 id="gunluk-baslik">${kac(g.ad)}</h2><p>${kac(g.bilgi)}</p>
        <button class="buyuk-dugme" type="button">${kac(metin.dugme)}</button></div></div>`;
      const kapat = () => { gunuYaz(gun); k.classList.add("gidiyor"); setTimeout(() => k.remove(), 250); document.removeEventListener("keydown", tus); tamam(); };
      const tus = e => { if (e.key === "Escape") kapat(); };
      k.querySelector("button").onclick = kapat;
      k.addEventListener("click", e => { if (e.target === k) kapat(); });
      document.addEventListener("keydown", tus);
      document.body.appendChild(k);
      k.querySelector("button").focus();
    });
  }

  window.GUNLUK = { yukle, bugun, zemin, kartHtml, acilis };
})();
