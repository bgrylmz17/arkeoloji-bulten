/* Arkix — oyunların görselli "nasıl oynanır" pencereleri. Her oyun ilk açıldığında bir kez (D.nasilGoruldu), sonra "Nasıl oynanır?" ile.
 * Yönetici (topluluk.js › yoneticiMi) için: sınırsız kazı izni, bugünü sıfırla; yönetici skorları tabloya yazılmaz (adil kalsın). */
const oyunYoneticisi = () => typeof yoneticiMi === "function" && yoneticiMi();

function oyunNasilIlk(oyun) {
  D.nasilGoruldu = D.nasilGoruldu || {};
  if (D.nasilGoruldu[oyun]) return;
  D.nasilGoruldu[oyun] = true; kaydet();
  setTimeout(() => nasilGoster(oyun), 350);
}

/* Kazı örneği: tek hücre (16 px) 4 kat büyütülmüş */
function nasilHucre(cv, derinlik, sprite, nokta) {
  const ctx = cv.getContext("2d"), t = ["#c7a27a", "#a9825c", "#8a6646", "#d8c9b0"];
  ctx.fillStyle = [t[3], t[2], t[1], t[0]][derinlik]; ctx.fillRect(0, 0, 16, 16);
  for (let k = 0; k < 6; k++) { ctx.fillStyle = "rgba(0,0,0,.13)"; ctx.fillRect((k * 5 + derinlik * 3) % 15, (k * 7 + 3) % 15, 1, 1); }
  if (derinlik === 0) { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(0, 0, 16, 2); ctx.fillRect(0, 0, 2, 16); }
  if (derinlik > 0 && derinlik < 3) { ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 0, 1, 16); }
  if (sprite) spriteCiz(ctx, sprite, 2, 2, 1);
  if (nokta) { ctx.fillStyle = nokta === 1 ? "#d2452b" : "#e0a12c"; for (const [a, b] of [[5, 6], [9, 9], [7, 11]].slice(0, nokta === 1 ? 3 : 2)) ctx.fillRect(a, b, 2, 2); }
}

function nasilGoster(oyun) {
  if (oyun === "kazi") {
    // sayfa sayfa rehber: her sayfada başlık, kısa anlatım ve çizim
    const h = (d, s, n, k) => `<canvas width="16" height="16" data-d="${d}"${s ? ` data-s="${s}"` : ""}${n ? ` data-n="${n}"` : ""}${k ? ` data-k="1"` : ""}></canvas>`;
    const f = (cizim, yazi) => `<figure>${cizim}<figcaption>${yazi}</figcaption></figure>`;
    const SAYFALAR = [
      { ikon: "🎯", baslik: tx("Amaç"), metin: tx("Bir ören yeri seç ve açmadaki gizli değerli buluntuları çıkar. Her buluntu Buluntu Defteri'ne yazılır, puan getirir."),
        ek: `<div class="nasil-seri">${f(h(0, "tdikili"), tx("Değerli buluntu"))}${f(h(0, "canak"), tx("Sık buluntu"))}${f(h(0, "ayna"), tx("Deftere yazılır"))}</div>
          <div class="nasil-kutu"><span>📅 ${tx("Günde 5 kazı izni")}</span><span>⛏ ${tx("Her kazıda 32 vuruş")}</span></div>` },
      { ikon: "⛏", baslik: tx("Kazmak"), metin: tx("Açmadaki bir kareye dokun: arkeoloğun oraya yürür ve bir katman kazar. Her karede 3 katman var; buluntu hangi katmanda olduğunu bilmeden çıkar."),
        ek: `<div class="nasil-seri">${f(h(3), tx("Üst toprak"))}<i>→</i>${f(h(2), tx("1. vuruş"))}<i>→</i>${f(h(1), tx("2. vuruş"))}<i>→</i>${f(h(0, "tdikili"), tx("Buluntu!"))}</div>` },
      { ikon: "🔥", baslik: tx("İpuçlarını oku"), metin: tx("Boş çıkan karede renkli noktalar varsa yakında değerli bir buluntu var. Kızıl: hemen yanında. Amber: iki kare ötede. Noktaları izle, vuruşunu boşa harcama."),
        ek: `<div class="nasil-seri">${f(h(0, "", 1), tx("Kızıl: hemen yanında"))}${f(h(0, "", 2), tx("Amber: 2 kare ötede"))}${f(h(0), tx("Boş: yakında yok"))}</div>` },
      { ikon: "🧰", baslik: tx("Aletini seç"), metin: tx("Seramik, cam, tablet ve fresk kırılgandır. Hızlı mı kazacaksın, dikkatli mi? Karar senin."),
        ek: `<div class="nasil-alet">
          <div>${h(0, "alet_kazma")}<b>${tx("Kazma")}</b><span>${tx("2 katman")} · 1 ${tx("vuruş")}</span><em class="risk">${tx("%50 kırar")}</em></div>
          <div>${h(0, "alet_mala")}<b>${tx("Mala")}</b><span>${tx("1 katman")} · 1 ${tx("vuruş")}</span><em>${tx("%10 kırar")}</em></div>
          <div>${h(0, "alet_firca")}<b>${tx("Fırça")}</b><span>${tx("1 katman")} · 2 ${tx("vuruş")}</span><em class="guvenli">${tx("Kırmaz")}</em></div></div>` },
      { ikon: "💎", baslik: tx("Değerli buluntu çıkınca"), metin: tx("Önce ne olduğunu tahmin et: doğru bilirsen +%25 puan. Sağlam çıkardıysan +3 vuruş kazanırsın. Kırıldıysa puanın %30'u gelir; parçaları birleştirip restore edersen %70'e çıkar."),
        ek: `<div class="nasil-seri">${f(h(0, "ayna"), "⛏ +3 " + tx("vuruş"))}${f(h(0, "ayna", 0, 1), "💔 %30")}${f(h(0, "ayna"), "🧩 %70")}</div>` },
      { ikon: "🪣", baslik: tx("Elek"), metin: tx("Kazdığın her katman kovaya gider. Açmanın altındaki Elek'e dokun: 3 kova toprağı 1 vuruşla elersin, çoğu kez gözden kaçan küçük buluntular çıkar."),
        ek: `<div class="nasil-seri">${f(h(0, "boncuk"), tx("Boncuk"))}${f(h(0, "komur"), tx("Kömür"))}${f(h(0, "mikrolit"), tx("Mikrolit"))}${f(h(0, "sikke"), tx("Sikke"))}</div>` },
      { ikon: "🌦️", baslik: tx("Hava ve bonuslar"), metin: tx("Her kazının havası farklı: yağmurda çamurlu sıralar 1 vuruş fazla ister, rüzgârda ve kum fırtınasında ipuçları kısalır."),
        ek: `<div class="nasil-kutu dikey"><span>⭐ ${tx("Haftanın alanında puan ×2")}</span><span>✨ ${tx("Olağanüstü korunmuş buluntu ×3")}</span><span>🏁 ${tx("Bütün değerlileri bulursan kalan her vuruş +5 puan")}</span><span>🧑‍🔬 ${tx("Her arkeoloğun bir üstünlüğü var")}</span></div>` },
      { ikon: "🏆", baslik: tx("Günün Açması ve turnuva"), metin: tx("Günün Açması'nda herkes aynı açmayı kazar; günde tek deneme, kazı izni harcamaz. Puanlar haftalık turnuvada birikir. Bir alanın defterini tamamla, o alanın kıyafeti açılsın."),
        ek: `<div class="nasil-kutu dikey"><span>🥇 ${tx("Haftalık turnuva, pazar gece biter")}</span><span>👕 ${tx("Defter tamamla, kıyafet aç")}</span><span>🌍 ${tx("Anadolu ve Dünya sekmelerinde 15 ören yeri")}</span></div>` },
    ];
    let i = 0;
    const ciz = () => {
      const s = SAYFALAR[i], sonSayfa = i === SAYFALAR.length - 1;
      levhaAc(`<div class="nasil nasil-sayfa"><p class="nasil-ust">${tx("Kazı Başı nasıl oynanır?")} <small>${i + 1}/${SAYFALAR.length}</small></p>
        <div class="nasil-ikon">${s.ikon}</div><h3>${s.baslik}</h3><p class="nasil-metin">${s.metin}</p>${s.ek}
        <div class="tanitim-nokta">${SAYFALAR.map((_, j) => `<i class="${j === i ? "secili" : ""}"></i>`).join("")}</div>
        <div class="tanitim-dugmeler">${i ? `<button class="ikincil-dugme" id="nasil-geri">${tx("Geri")}</button>` : `<button class="ikincil-dugme" id="nasil-atla">${tx("Atla")}</button>`}
          <button class="buyuk-dugme" id="nasil-ileri">${sonSayfa ? tx("Kazmaya başla") : tx("İleri")}</button></div></div>`, lv => {
        lv.querySelectorAll("canvas").forEach(c => { nasilHucre(c, +c.dataset.d, c.dataset.s, +c.dataset.n || 0); if (c.dataset.k && typeof kirikCiz === "function") kirikCiz(c.getContext("2d"), 2, 2, 1); });
        lv.querySelector("#nasil-ileri").onclick = () => { if (sonSayfa) levhaKapat(); else { i++; ciz(); } };
        const g = lv.querySelector("#nasil-geri"); if (g) g.onclick = () => { i--; ciz(); };
        const a = lv.querySelector("#nasil-atla"); if (a) a.onclick = levhaKapat;
        let x0 = null;   // kaydırarak sayfa değiştir
        lv.ontouchstart = e => { x0 = e.touches[0].clientX; };
        lv.ontouchend = e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
          if (dx < -50 && !sonSayfa) { i++; ciz(); } else if (dx > 50 && i) { i--; ciz(); } };
      });
    };
    ciz();
  } else if (oyun === "kelime") {
    const ornek = (k, d) => `<div class="kk-satir nasil-ornek">${[...k].map((h, i) => `<span class="tas ${d[i]}">${h}</span>`).join("")}</div>`;
    levhaAc(`<div class="nasil"><h3>${tx("Kelime Kazısı nasıl oynanır?")}</h3>
      <p class="nasil-adim"><b>1</b> ${tx("Günün 5 harfli arkeoloji terimini 6 denemede bul. Klavyeden 5 harf yaz, “Dene”ye bas.")}</p>
      <p class="nasil-adim"><b>2</b> ${tx("Her denemeden sonra harfler işaretlenir. Örnek: günün kelimesi HÖYÜK ise")}</p>
      ${ornek("KAZMA", ["var", "yok", "yok", "yok", "yok"])}
      <div class="kutu nasil-anahtar"><div class="satir"><span class="tas yerinde">H</span>${tx("Harf doğru yerde")}</div>
        <div class="satir"><span class="tas var">K</span>${tx("Harf kelimede var ama başka yerde")}</div>
        <div class="satir"><span class="tas yok">A</span>${tx("Harf kelimede yok")}</div></div>
      ${ornek("HÖYÜK", ["yerinde", "yerinde", "yerinde", "yerinde", "yerinde"])}
      <p class="nasil-adim"><b>3</b> ${tx("Takılırsan 💡 İpucu al: terimin türü ve ilk harfi görünür (−100 puan). Çözünce terimin anlamını öğrenirsin.")}</p>
      <p class="aciklama">${tx("Kelime her gece yarısı değişir; herkes aynı kelimeyi çözer. Puan: 1. denemede 600, 6. denemede 100.")}</p>
      <p><button class="buyuk-dugme" id="nasil-tamam">${tx("Başla")}</button></p></div>`, lv => { lv.querySelector("#nasil-tamam").onclick = levhaKapat; });
  } else if (oyun === "sirala") {
    const kart = (id, ad, donem, oklar) => `<div class="sirala-kart nasil-kart"><canvas width="48" height="48" data-s="${id}"></canvas>
      <span><b>${esc(ad)}</b><small>${esc(donem)}</small></span>${oklar ? `<span class="sirala-oklar"><button disabled>▲</button><button disabled>▼</button></span>` : ""}</div>`;
    levhaAc(`<div class="nasil"><h3>${tx("Katman Sırala nasıl oynanır?")}</h3>
      <p class="nasil-adim"><b>1</b> ${tx("Her gün 5 buluntu gelir. ▲ ▼ oklarıyla taşıyıp en eskisini en üste, en yenisini en alta diz.")}</p>
      <p class="sirala-ok">${tx("En eski")} ↑</p>
      ${kart("elbaltasi", tx("El baltası"), tx("Alt Paleolitik"), true)}
      ${kart("tdikili", tx("T biçimli dikilitaş"), tx("Çanak Çömleksiz Neolitik"), true)}
      ${kart("mozaik", tx("Çingene Kızı mozaiği"), tx("Roma dönemi"), true)}
      <p class="sirala-ok">${tx("En yeni")} ↓</p>
      <p class="nasil-adim"><b>2</b> ${tx("“Sırayı kontrol et”e bas: kaç buluntunun doğru yerde olduğunu görürsün. 3 deneme hakkın var.")}</p>
      <p class="nasil-adim"><b>3</b> ${tx("Bitince her buluntunun dönemi açılır; dokunarak bilgisini oku. Puan: 1. denemede 500, 2.'de 300, 3.'de 150.")}</p>
      <p><button class="buyuk-dugme" id="nasil-tamam">${tx("Başla")}</button></p></div>`, lv => {
      lv.querySelectorAll("canvas[data-s]").forEach(c => spriteCiz(c.getContext("2d"), c.dataset.s, 0, 0, 4));
      lv.querySelector("#nasil-tamam").onclick = levhaKapat;
    });
  }
}

/* Yönetici: bugünkü oyunu sıfırla (deneme için) */
function yoneticiSifirlaHtml(oyun) {
  return oyunYoneticisi() ? `<p class="yonetici-oyun"><button class="metin-dugme" data-sifirla="${oyun}">${tx("Yönetici: bugünü sıfırla")}</button> · ${tx("skorların tabloya yazılmaz")}</p>` : "";
}
function yoneticiSifirlaBagla() {
  $$("[data-sifirla]").forEach(b => b.onclick = () => {
    const o = b.dataset.sifirla;
    if (o === "kelime") { delete D.kelime; kelimeGirdi = ""; }
    if (o === "sirala") delete D.sirala;
    if (o === "kazi") { delete D.kaziOyun; }
    kaydet(); bildir(tx("Sıfırlandı")); rota(true);
  });
}
