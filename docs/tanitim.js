/* Arkix — açılış tanıtımı (Harri anlatır). İlk açılışta tema seçiminden sonra bir kez; Ayarlar › Hakkında › Tanıtımı yeniden göster.
 * Native: harrix-arkeoloji-mobil/src/components/Tanitim.tsx (aynı metinler). Metin değişirse TANITIM_SURUM'u artırın. */
const TANITIM_SURUM = 1;
const TANITIM = [
  { ikon: "avatar/harri.png", baslik: "Merhaba, ben Harri!",
    metin: "Arkix, arkeoloji haberlerini, makaleleri, tezleri ve kazı raporlarını yüzü aşkın kaynaktan senin için toplar. Bülten günde dört kez kendiliğinden güncellenir. Birkaç sayfada neyin nerede olduğunu göstereyim." },
  { ikon: "☀", baslik: "Bugün",
    metin: "En üstte Günün Ören Yeri var; dokununca kısa bir bilgi açılır. Son dakika, birden çok sitede birden çıkan haberleri gösterir. Dünün özetini “Dinle” ile sesli dinleyebilirsin. Aşağıda yeni kayıtlar, kazı tabakaları gibi gün gün dizilir." },
  { ikon: "🔎", baslik: "Tez ve makale arama",
    metin: "Yayınlar sekmesinde “Bülten” son günlerin kayıtlarıdır. “Tüm literatür”e geçince bütün yıllardaki makale, tez ve kitaplarda ararsın (OpenAlex). Türü “Tez” yap, dönem seç ya da yalnız açık erişimlileri göster. Türkçe yazman yeter; arama terimlerini İngilizceye de genişletir." },
  { ikon: "📡", baslik: "Takip et",
    metin: "Bir kaydın altındaki “Takip et” ile o yazarı, dergiyi ya da dönemi takibe al. Kitaplık › Takip ettiklerim'den anahtar kelime de ekleyebilirsin (ör. obsidyen, Kızılin). Uyan yeni kayıtlar Bugün sayfasının başında sayılır." },
  { ikon: "📚", baslik: "Kitaplık ve kaynakça",
    metin: "Bir kaydı sola kaydırınca favorilere girer. “Konuya ekle” ile tez bölümlerine göre klasör kurarsın. Kaynakçan APA 7'ye göre kendiliğinden dizilir; RIS ya da BibTeX olarak alabilirsin. Açık erişimli PDF'leri arşivine indirip internetsiz okursun." },
  { ikon: "💬", baslik: "Yorum yap, bildir",
    metin: "Giriş yapınca kayıtların altına yorum yazabilirsin; uzmanların yorumunda rozet görünür. Arkeolojiyle ilgisiz ya da hatalı bir kayıt görürsen kaydın altındaki “Bildir”e ya da üst çubuktaki bayrağa dokun. Bülteni birlikte temizliyoruz." },
];

function tanitimGoster() {
  return new Promise(tamam => {
    let i = 0;
    const k = document.createElement("div");
    k.className = "onay-kapi tanitim-kapi"; k.setAttribute("role", "dialog"); k.setAttribute("aria-modal", "true"); k.setAttribute("aria-labelledby", "tanitim-baslik");
    const bitir = () => { k.remove(); document.removeEventListener("keydown", tus); tamam(); };
    const tus = e => { if (e.key === "Escape") bitir(); else if (e.key === "ArrowRight") git(1); else if (e.key === "ArrowLeft") git(-1); };
    const git = n => { i = Math.max(0, Math.min(TANITIM.length - 1, i + n)); ciz(); };
    const ciz = () => {
      const s = TANITIM[i], son = i === TANITIM.length - 1;
      k.innerHTML = `<div class="onay-kutu tanitim-kutu">
        <button class="tanitim-atla" id="tanitim-atla">${tx("Atla")}</button>
        <div class="tanitim-ikon">${s.ikon.includes("/") ? `<img src="${s.ikon}" alt="" width="96" height="96">` : `<span>${s.ikon}</span>`}</div>
        <h2 id="tanitim-baslik">${tx(s.baslik)}</h2>
        <p>${tx(s.metin)}</p>
        <div class="tanitim-nokta">${TANITIM.map((_, j) => `<i class="${j === i ? "secili" : ""}"></i>`).join("")}</div>
        <div class="tanitim-dugmeler">${i ? `<button class="ikincil-dugme" id="tanitim-geri">${tx("Geri")}</button>` : "<span></span>"}
          <button class="buyuk-dugme" id="tanitim-ileri">${son ? tx("Başla") : tx("İleri")}</button></div></div>`;
      k.querySelector("#tanitim-atla").onclick = bitir;
      k.querySelector("#tanitim-ileri").onclick = () => (son ? bitir() : git(1));
      const g = k.querySelector("#tanitim-geri"); if (g) g.onclick = () => git(-1);
      k.querySelector("#tanitim-ileri").focus();
    };
    let x0 = null;
    k.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    k.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) git(dx < 0 ? 1 : -1); x0 = null; });
    document.addEventListener("keydown", tus);
    ciz();
    document.body.appendChild(k);
  });
}
