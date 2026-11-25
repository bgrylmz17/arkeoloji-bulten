/* Arkix — her gün değişen arka plan deseni.
 * Yedi çizgi çizimi motif takımı (özgün çizimler; fotoğraf ya da başkasının görseli yok). Hangi takımın
 * görüneceğini günün sırası belirler. Desen CSS maskesi olarak kullanılır; rengi stil.css'teki
 * #zemin-desen kuralından (palet rengi) gelir, böylece açık/koyu temaya ve toprak rengine kendiliğinden uyar. */
(function () {
  const g = (d, x, y, s = 1, a = 0) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})">${d}</g>`;
  const p = d => `<path d="${d}"/>`;
  const c = (r, ek = "") => `<circle r="${r}" ${ek}/>`;

  const TAKIMLAR = [
    { ad: "Çanak çömlek", en: "Pottery", ogeler: [
      // küp: ağız, boyun, gövde, taban ve zikzak bezeme
      p("M-10 -50H10M-8 -50C-8 -40 -15 -38 -23 -26C-33 -10 -31 20 -13 38H13C31 20 33 -10 23 -26C15 -38 8 -40 8 -50"
        + "M-25 -15H25M-27 -8H27M-25 -15L-19 -8L-13 -15L-7 -8L-1 -15L5 -8L11 -15L17 -8L23 -15"),
      // kâse
      p("M-45 -12H45C43 13 25 28 0 28C-25 28 -43 13 -45 -12ZM-10 28V34H10V28M-38 -2H38"),
      // amfora
      p("M-7 -48H7M-5 -48V-34M5 -48V-34M-5 -34C-21 -24 -23 12 0 44C23 12 21 -24 5 -34"
        + "M-5 -42C-15 -42 -17 -30 -11 -26M5 -42C15 -42 17 -30 11 -26"),
    ] },
    { ad: "Yontmataş", en: "Chipped stone", ogeler: [
      // yaprak biçimli uç ve yonga izleri
      p("M0 -50C18 -28 20 10 8 46L0 52L-8 46C-20 10 -18 -28 0 -50Z"
        + "M0 -46V48M-14 -20L0 -10M14 -18L0 -6M-17 6L0 14M17 8L0 20M-12 30L0 34M12 30L0 36"),
      // saplı ok ucu
      p("M0 -36L14 10L6 6L4 24H-4L-6 6L-14 10ZM0 -30V4M-8 -6L0 0M8 -6L0 0"),
      // dilgi
      p("M-6 -50C6 -40 10 20 4 50H-4C-10 20 -12 -40 -6 -50ZM-1 -44V46M3 -30V40"),
    ] },
    { ad: "Dikilitaş", en: "Standing stones", ogeler: [
      // T biçimli dikilitaş, kemer ve kol kabartması
      p("M-30 -60H30V-38H10V62H-10V-38H-30ZM-10 26H10M-10 6C-4 12 4 12 10 6M-24 -52H24"),
      // taş halka
      p("M-60 30A60 18 0 0 0 60 30M-60 30A60 18 0 0 1 60 30") + g(p("M-6 -16H6V16H-6Z"), -40, 18)
        + g(p("M-6 -16H6V16H-6Z"), 0, 10) + g(p("M-6 -16H6V16H-6Z"), 40, 18),
      p("M-16 -40H16V-26H6V40H-6V-26H-16Z"),
    ] },
    { ad: "Sikkeler", en: "Coins", ogeler: [
      c(34) + c(28, 'stroke-dasharray="2 4"')
        + [0, 45, 90, 135].map(a => g(p("M0 -18C6 -8 6 8 0 18C-6 8 -6 -8 0 -18"), 0, 0, 1, a)).join("") + c(3),
      c(26) + c(21, 'stroke-dasharray="1.5 3.5"') + p("M0 -14L4 -4L14 0L4 4L0 14L-4 4L-14 0L-4 -4Z"),
      c(20) + p("M-8 -6H8M-8 0H8M-8 6H8"),
    ] },
    { ad: "Mimari", en: "Architecture", ogeler: [
      // İon başlığı ve yivli gövde
      p("M-50 -24H50M-40 -16H40M-40 -16A12 12 0 1 0 -40 8A8 8 0 1 0 -40 -8A4 4 0 1 0 -40 0"
        + "M40 -16A12 12 0 1 1 40 8A8 8 0 1 1 40 -8A4 4 0 1 1 40 0M-30 8H30"
        + "M-26 8V70M-13 8V70M0 8V70M13 8V70M26 8V70"),
      // kemer ve kilit taşı
      p("M-40 50V0A40 40 0 0 1 40 0V50M-52 50V-2A52 52 0 0 1 52 -2V50M-6 -52L-5 -40H5L6 -52"
        + "M-37 -26L-28 -19M37 -26L28 -19"),
      // sütun tamburu
      p("M-24 -10A24 7 0 0 0 24 -10A24 7 0 0 0 -24 -10M-24 -10V12A24 7 0 0 0 24 12V-10"),
    ] },
    { ad: "Kazı aletleri", en: "Field tools", ogeler: [
      // mala
      p("M0 -50L18 0L0 10L-18 0ZM0 -44V6M0 10V22M-4 22H4V50H-4Z"),
      // kuzey oku ve ölçek
      p("M0 -30L8 10L0 4L-8 10ZM-4 -36V-46L4 -36V-46") + g(p("M0 0H80M0 -4V4M20 -3V3M40 -4V4M60 -3V3M80 -4V4"), -40, 30),
      // fırça
      p("M-3 -46H3V-12H-3ZM-8 -12H8V-4H-8ZM-8 -4L-11 26M-4 -4L-5 28M0 -4V28M4 -4L5 28M8 -4L11 26"),
    ] },
    { ad: "Kaya resimleri", en: "Rock art", ogeler: [
      // dağ keçisi
      p("M-30 0C-20 -8 10 -8 22 -2L30 -12M22 -2L26 6M-24 2L-28 22M-16 2L-14 22M10 0L8 22M18 0L22 22"
        + "M28 -12C24 -30 6 -36 -4 -30M-30 0L-36 -6"),
      // sarmal
      p("M0 0a3 3 0 1 1 6 0a6 6 0 1 1 -12 0a9 9 0 1 1 18 0a12 12 0 1 1 -24 0a15 15 0 1 1 30 0"),
      // insan figürü
      g(c(5), 0, -22) + p("M0 -16V8M-12 -8L0 -4L12 -10M0 8L-8 24M0 8L8 24"),
    ] },
  ];

  // yerleşim: 360 px'lik karede dört öge, farklı boy ve açılarda (tekrar göze batmasın)
  const YER = [[92, 104, 1, -8], [266, 246, 0.95, 12], [270, 76, 0.7, 18], [100, 282, 0.8, -14]];

  function gunSirasi(t = new Date()) {
    return Math.floor((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
  }
  function bugununTakimi() { return TAKIMLAR[gunSirasi() % TAKIMLAR.length]; }

  let sonAcik = true;
  function desenUygula(acik = sonAcik) {
    sonAcik = acik;
    let kat = document.getElementById("zemin-desen");
    if (!acik) { if (kat) kat.remove(); return; }
    const takim = bugununTakimi();
    const ic = YER.map(([x, y, s, a], i) => g(takim.ogeler[i % takim.ogeler.length], x, y, s, a)).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">`
      + `<g fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ic}</g></svg>`;
    if (!kat) {
      kat = document.createElement("div");
      kat.id = "zemin-desen"; kat.setAttribute("aria-hidden", "true");
      document.body.prepend(kat);
    }
    kat.style.setProperty("--desen", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    kat.dataset.takim = takim.en;
  }

  window.DESEN = { uygula: desenUygula, bugun: bugununTakimi };
  // gün değişince (uygulama açık kalmışsa) yeni desen
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") desenUygula(); });
})();
