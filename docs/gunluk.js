/* Arkix — Günün Ören Yeri: Bugün sayfasının başındaki fotoğraflı kart, günde bir kez açılış kartı, isteğe bağlı arka plan.
 * Veri gunluk/gunluk.json (native de aynı dosyayı okur). Fotoğraflar Wikimedia Commons'tan özgür lisanslı (CC BY / CC BY-SA);
 * gösterildiği her yerde çeken, lisans ve kaynak yazılır. Gün sırası UTC gün sayısıdır; alan = sıra % alan sayısı,
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
    const f = a.foto || {};
    return { id: a.id, gorsel: a.gorsel, ad: a.ad[d] || a.ad.tr, bilgi: b[d] || b.tr, foto: f,
             kunye: f.yazar ? `${d === "en" ? "Photo" : "Fotoğraf"}: ${f.yazar} · ${f.lisans} · Wikimedia Commons` : "" };
  }

  /* kip: "siluet" (sayfanın altında Günün Ören Yeri çizimi), "milimetrik" (ızgara; stil.css) ya da "sade" */
  function zemin(kip) {
    let kat = document.getElementById("zemin-siluet");
    const g = bugun();
    const a = g && kip === "siluet" ? VERI.alanlar.find(x => x.id === g.id) : null;
    if (!a || !a.siluet) { if (kat) kat.remove(); return; }
    if (!kat) {
      kat = document.createElement("div");
      kat.id = "zemin-siluet"; kat.setAttribute("aria-hidden", "true");
      document.body.prepend(kat);
    }
    if (kat.dataset.alan !== a.id) {
      kat.dataset.alan = a.id;
      kat.innerHTML = `<svg viewBox="0 0 1200 240" preserveAspectRatio="xMidYMax meet"><path d="${kac(a.siluet)}" fill="none" stroke="currentColor"
        stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
    }
  }

  const kunyeHtml = g => g.kunye ? `<a class="gunluk-kunye" href="${kac(g.foto.sayfa || "#")}" target="_blank" rel="noopener">${kac(g.kunye)}</a>` : "";

  /* Bugün sayfasının başındaki fotoğraflı kart */
  function kahramanHtml(metin) {
    const g = bugun();
    if (!g) return "";
    return `<section class="gunluk-kahraman" aria-label="${kac(metin.baslik)}">
      <img src="${kac(g.gorsel)}" alt="${kac(g.ad)}">
      <div class="gunluk-kahraman-ic"><small>${kac(metin.baslik)}</small><h2>${kac(g.ad)}</h2><p>${kac(g.bilgi)}</p></div>
      ${kunyeHtml(g)}</section>`;
  }

  /* Günde bir kez tam ekran kart. goruldu(gun) / yaz(gun) uygulamanın deposuna bakar. */
  function acilis(metin, gorulenGun, gunuYaz) {
    const g = bugun(), gun = gunAnahtari();
    if (!g || gorulenGun === gun) return Promise.resolve();
    return new Promise(tamam => {
      const k = document.createElement("div");
      k.className = "gunluk-kapi"; k.setAttribute("role", "dialog"); k.setAttribute("aria-modal", "true"); k.setAttribute("aria-labelledby", "gunluk-baslik");
      k.innerHTML = `<div class="gunluk-kutu">
        <figure><img src="${kac(g.gorsel)}" alt="${kac(g.ad)}"><figcaption>${kunyeHtml(g)}</figcaption></figure>
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

  window.GUNLUK = { yukle, bugun, zemin, kahramanHtml, acilis };
})();
