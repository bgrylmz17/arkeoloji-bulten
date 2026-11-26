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
    levhaAc(`<div class="nasil"><h3>${tx("Kazı Başı nasıl oynanır?")}</h3>
      <p class="nasil-adim"><b>1</b> ${tx("Bir arkeolog ve bir ören yeri seç. Günde 5 kazı iznin, her kazıda 32 vuruşun var.")}</p>
      <p class="nasil-adim"><b>2</b> ${tx("Açmadaki bir kareye dokun: arkeolog oraya yürür ve bir katman kazar. Her karede 3 katman var; bir kareyi bitirmek için 3 kez dokunman gerekebilir.")}</p>
      <div class="nasil-seri">
        <figure><canvas width="16" height="16" data-d="3"></canvas><figcaption>${tx("Üst toprak")}</figcaption></figure><i>→</i>
        <figure><canvas width="16" height="16" data-d="2"></canvas><figcaption>${tx("1. vuruş")}</figcaption></figure><i>→</i>
        <figure><canvas width="16" height="16" data-d="1"></canvas><figcaption>${tx("2. vuruş")}</figcaption></figure><i>→</i>
        <figure><canvas width="16" height="16" data-d="0" data-s="tdikili"></canvas><figcaption>${tx("3. vuruş: buluntu!")}</figcaption></figure>
      </div>
      <p class="nasil-adim"><b>3</b> ${tx("Buluntular farklı derinliklerde: sık buluntular çoğu kez 1–2 vuruşta, değerliler 2–3 vuruşta çıkar.")}</p>
      <div class="nasil-seri">
        <figure><canvas width="16" height="16" data-d="0" data-s="canak"></canvas><figcaption>${tx("Sık buluntu")}</figcaption></figure>
        <figure><canvas width="16" height="16" data-d="0" data-n="1"></canvas><figcaption>${tx("Kızıl: değerli buluntu hemen yanında")}</figcaption></figure>
        <figure><canvas width="16" height="16" data-d="0" data-n="2"></canvas><figcaption>${tx("Amber: 2 kare ötede")}</figcaption></figure>
      </div>
      <p class="nasil-adim"><b>4</b> ${tx("Çıkan her buluntu tanıtılır ve Buluntu Defteri'ne yazılır. Alanın bütün değerli buluntularını bulursan kalan her vuruş 5 puan getirir.")}</p>
      <p class="aciklama">⭐ ${tx("Haftanın alanında puan ×2. ✨ Nadiren olağanüstü korunmuş buluntu çıkar: ×3.")}</p>
      <p><button class="buyuk-dugme" id="nasil-tamam">${tx("Kazmaya başla")}</button></p></div>`, lv => {
      lv.querySelectorAll("canvas").forEach(c => nasilHucre(c, +c.dataset.d, c.dataset.s, +c.dataset.n || 0));
      lv.querySelector("#nasil-tamam").onclick = levhaKapat;
    });
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
