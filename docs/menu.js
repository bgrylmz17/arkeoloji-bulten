/* Arkix — sol yan menü (≡): profil, takip, kitaplık bölümleri, ayarlar, geri bildirim, yönetim. Ana gezinme alttaki bardadır. */
function cekmeceAc() {
  const c = $("#cekmece"), p = $("#cekmece-perde");
  const girdi = typeof H !== "undefined" && H.kullanici;
  const ad = girdi ? hesapAdi() : tx("Giriş yap ya da hesap oluştur");
  const takipYeni = typeof takipYeniSayisi === "function" ? takipYeniSayisi() : 0;
  const satir = (href, metin, sag = "", ek = "") => `<a class="cekmece-satir" href="${href}"${ek}><span>${metin}</span>${sag !== "" ? `<small>${sag}</small>` : ""}<i>›</i></a>`;
  c.innerHTML = `
    <a class="cekmece-profil" href="${girdi ? "#ayarlar" : "#giris"}">${girdi && typeof avatarHtml === "function" ? avatarHtml(48) : `<span class="avatar avatar-bas" style="width:48px;height:48px">A</span>`}
      <span><b>${esc(ad)}</b><small>${girdi ? esc(H.kullanici.email || "") : tx("Kayıtların her cihazda")}</small></span></a>
    <nav class="cekmece-liste">
      ${satir("#oyunlar", tx("Oyunlar"), tx("Yeni"))}
      ${satir("#ozel/kazi", tx("Kazı duyuruları"))}
      ${satir("#takip", tx("Takip ettiklerim"), takipYeni ? tx("{n} yeni", { n: takipYeni }) : String((D.takip || []).length))}
      ${satir("#favoriler", tx("Favoriler"), D.fav.length)}
      ${satir("#notlar", tx("Notlu kayıtlar"), Object.keys(D.notlar).length)}
      ${satir("#kitaplik", tx("Konular"), D.konular.length)}
      ${satir("#kaynakca", tx("Kaynakçam (APA 7)"), D.kaynakca.length)}
      ${satir("#pdfler", tx("PDF arşivim"))}
      ${satir("#sozler", tx("Arkeoloji sözleri"))}
      <hr>
      ${satir("#durum", tx("Kaynakların durumu"))}
      <button class="cekmece-satir" id="cekmece-bildir"><span>${tx("Hata bildir ya da öneride bulun")}</span><i>›</i></button>
      ${typeof yoneticiMi === "function" && yoneticiMi() ? satir("#yonetim", `<b>${tx("Yönetim paneli")}</b>`) : ""}
      <hr>
      ${satir("#ayarlar", tx("Ayarlar"))}
      ${satir("#yasal", tx("Kullanım koşulları ve KVKK"))}
    </nav>
    <p class="cekmece-alt">Arkix ${SURUM} · <a href="https://www.instagram.com/harrixapp/" target="_blank" rel="noopener">@harrixapp</a></p>`;
  c.classList.toggle("ust", D.menuKonum === "ust");
  if (D.menuKonum === "ust") c.insertAdjacentHTML("beforeend", `<button class="cekmece-tutamak" aria-label="${tx("Kapat")}"><span></span></button>`);
  c.hidden = false; p.hidden = false;
  requestAnimationFrame(() => { c.classList.add("acik"); p.classList.add("acik"); });
  c.querySelectorAll("a").forEach(a => a.addEventListener("click", cekmeceKapat));
  const b = c.querySelector("#cekmece-bildir");
  if (b) b.onclick = () => { cekmeceKapat(); if (typeof bildirSecimi === "function") bildirSecimi(); };
  const tut = c.querySelector(".cekmece-tutamak"); if (tut) tut.onclick = cekmeceKapat;
  const ilk = c.querySelector("a, button"); if (ilk) ilk.focus();
}
function cekmeceKapat() {
  const c = $("#cekmece"), p = $("#cekmece-perde");
  c.classList.remove("acik"); p.classList.remove("acik");
  setTimeout(() => { c.hidden = true; p.hidden = true; }, 220);
}
$("#menu-ac").addEventListener("click", cekmeceAc);
$("#cekmece-perde").addEventListener("click", cekmeceKapat);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#cekmece").hidden) cekmeceKapat(); });
/* kaydırarak aç: "sol" modda ekranın sol kenarından sağa; "ust" modda üst çubuktan (sayfa en üstteyken) aşağı.
 * Üst modda açık menü yukarı kaydırılınca kapanır. */
(function () {
  let x0 = null, y0 = null, bas = null;
  document.addEventListener("touchstart", e => {
    const t = e.touches[0]; bas = { x: t.clientX, y: t.clientY };
    const ustCubuk = $("#ust").getBoundingClientRect().bottom;
    x0 = D.menuKonum !== "ust" && t.clientX < 24 ? t.clientX : null;
    y0 = D.menuKonum === "ust" && t.clientY < ustCubuk + 8 && window.scrollY < 4 ? t.clientY : null;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    const t = e.changedTouches[0], kapali = $("#cekmece").hidden;
    if (x0 !== null && kapali && t.clientX - x0 > 60 && Math.abs(t.clientY - bas.y) < 50) cekmeceAc();
    else if (y0 !== null && kapali && t.clientY - y0 > 50 && Math.abs(t.clientX - bas.x) < 60) cekmeceAc();
    else if (!kapali && D.menuKonum === "ust" && bas && bas.y - t.clientY > 60 && Math.abs(t.clientX - bas.x) < 60) cekmeceKapat();
    x0 = y0 = null;
  });
})();
