/* Arkix — Takip ettiklerim: anahtar kelime, dönem/konu (kavram), yazar, dergi ve haber kaynağı takibi.
 * D.takip = [{ id, tur, deger, ad }]; hesapla eşitlenir (kitaplik.takip; native ile aynı şema).
 * Bugün sayfası, son bakıştan (D.takipGorulen) beri eşleşen yeni kayıtları sayar; #takip sayfası hepsini listeler. */
const TAKIP_TURLERI = ["kelime", "kavram", "yazar", "dergi", "kaynak"];
const takipTurAdi = tur => ({ kelime: tx("Anahtar kelime"), kavram: tx("Dönem / konu"), yazar: tx("Yazar"), dergi: tx("Dergi / yayın"), kaynak: tx("Haber kaynağı") }[tur] || tur);
const kucukHarf = s => (s || "").toLocaleLowerCase("tr");

function takipEslesir(r, t) {
  const d = kucukHarf(t.deger);
  if (t.tur === "kelime") return [r.b, r.o, r.bt, r.ot, r.be, r.oe].some(x => kucukHarf(x).includes(d));
  if (t.tur === "kavram") return (r.e || []).includes(t.deger);
  if (t.tur === "yazar") return kucukHarf(r.y).includes(d);
  if (t.tur === "dergi") return kucukHarf(r.w).includes(d);
  if (t.tur === "kaynak") return kucukHarf(r.s) === d;
  return false;
}
const takipListesi = () => D.takip || [];
function takipKayitlari(t) {
  const liste = t ? [t] : takipListesi();
  return liste.length ? VERI.kayitlar.filter(r => liste.some(x => takipEslesir(r, x))) : [];
}
function takipYeniSayisi() {
  const g = D.takipGorulen || "";
  return takipKayitlari().filter(r => (r.g || "") > g).length;
}

function takipEkle(tur, deger, ad) {
  deger = String(deger || "").trim();
  if (!deger || (tur === "kelime" && deger.length < 3)) { bildir(tx("En az 3 harf yazın")); return false; }
  D.takip = takipListesi();
  if (D.takip.some(t => t.tur === tur && kucukHarf(t.deger) === kucukHarf(deger))) { bildir(tx("Zaten takip ediyorsunuz")); return false; }
  if (!D.takipGorulen) D.takipGorulen = VERI.guncelleme || "";   // ilk takipte eski kayıtlar "yeni" sayılmasın
  D.takip.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), tur, deger, ad: ad || deger });
  kaydet();
  bildir(tx("Takibe alındı: {ad}", { ad: ad || deger }));
  return true;
}
function takipCikar(id) { D.takip = takipListesi().filter(t => t.id !== id); kaydet(); }

function sayfaTakip() {
  const liste = takipListesi();
  const kavramlar = VERI.kavramlar.filter(k => k.grup !== "Kazım");
  const gruplar = [...new Set(kavramlar.map(k => k.grup))];
  const kayitlar = takipKayitlari().sort((a, b) => (b.g || "").localeCompare(a.g || "") || (b.t || "").localeCompare(a.t || ""));
  const onceki = D.takipGorulen || "";
  $("#sayfa").innerHTML = `
    <div class="grup"><h3>${tx("Takip ettiklerim")}</h3>
      ${liste.length ? `<div class="takip-cipler">${liste.map(t => `<span class="takip-cip"><small>${esc(takipTurAdi(t.tur))}</small>${esc(t.ad)}
          <em>${takipKayitlari(t).length}</em><button data-takip-sil="${esc(t.id)}" aria-label="${tx("Takipten çıkar")}">×</button></span>`).join("")}</div>`
        : `<p class="aciklama">${tx("Konunuzu, döneminizi, bölgenizi, bir yazarı ya da dergiyi takibe alın; bültene uyan yeni kayıtlar burada ve Bugün sayfasında görünür.")}</p>`}
    </div>
    <form class="grup takip-form" id="takip-form"><h3>${tx("Yeni takip")}</h3><div class="kutu" style="padding:12px">
      <div class="bolumlu" role="group">${TAKIP_TURLERI.map((tur, i) => `<button type="button" data-takip-tur="${tur}" aria-pressed="${i === 0}">${esc(takipTurAdi(tur))}</button>`).join("")}</div>
      <div id="takip-girdi" style="margin-top:10px"></div>
      <p style="margin:10px 0 0"><button class="ikincil-dugme" type="submit">${tx("Takibe al")}</button></p></div>
      <p class="aciklama">${tx("Örnek: “Göbeklitepe”, “obsidyen”, “Kızılin” anahtar kelimesi; “Neolitik” dönemi; “Anatolian Studies” dergisi.")}</p></form>
    ${liste.length ? `<div class="grup"><h3>${tx("Takibinize uyan kayıtlar")} <small>${kayitlar.length}</small></h3></div>
      ${kayitlar.length ? tabakalarHtml(kayitlar.slice(0, 150), { reklamsiz: true }) : bosHtml(tx("Şimdilik uyan kayıt yok"), tx("Yeni kayıtlar günde dört kez toplanır; uyanlar burada birikir."))}` : ""}`;
  let tur = TAKIP_TURLERI[0];
  const girdiCiz = () => {
    $("#takip-girdi").innerHTML = tur === "kavram"
      ? `<select id="takip-deger" style="width:100%">${gruplar.map(g => `<optgroup label="${esc(tx(g))}">${kavramlar.filter(k => k.grup === g).map(k => `<option value="${esc(k.id)}">${esc(kavramAdi(k))}</option>`).join("")}</optgroup>`).join("")}</select>`
      : `<input id="takip-deger" style="width:100%" maxlength="80" placeholder="${esc({ kelime: tx("Ör. obsidyen"), yazar: tx("Ör. Özdoğan"), dergi: tx("Ör. Anatolian Studies"), kaynak: tx("Ör. Arkeofili") }[tur])}"
          ${tur === "kaynak" ? 'list="takip-kaynaklar"' : ""}>${tur === "kaynak" ? `<datalist id="takip-kaynaklar">${[...new Set(VERI.kayitlar.filter(r => r.k === "Haber").map(r => r.s))].sort().map(s => `<option value="${esc(s)}">`).join("")}</datalist>` : ""}`;
  };
  girdiCiz();
  $("#sayfa").querySelectorAll("[data-takip-tur]").forEach(b => b.onclick = () => {
    tur = b.dataset.takipTur;
    $("#sayfa").querySelectorAll("[data-takip-tur]").forEach(x => x.setAttribute("aria-pressed", x === b));
    girdiCiz();
  });
  $("#takip-form").onsubmit = e => {
    e.preventDefault();
    const el = $("#takip-deger");
    const deger = el.value;
    const ad = tur === "kavram" ? el.options[el.selectedIndex].text : deger.trim();
    if (takipEkle(tur, deger, ad)) sayfaTakip();
  };
  $("#sayfa").querySelectorAll("[data-takip-sil]").forEach(b => b.onclick = () => { takipCikar(b.dataset.takipSil); sayfaTakip(); });
  kaydirmaBagla();
  if (VERI.guncelleme && VERI.guncelleme !== onceki) { D.takipGorulen = VERI.guncelleme; kaydet(); }
}

/* Kayıt ayrıntısından hızlı takip: yazar, dergi, kaynak, kavramlar */
function takipLevhasi(r) {
  const secenek = [];
  const ilkYazar = (r.y || "").split(/[;,]/)[0].trim();
  if (ilkYazar && r.k !== "Haber") secenek.push(["yazar", ilkYazar.split(/\s+/).slice(-1)[0], ilkYazar]);
  if (r.w && r.k !== "Haber") secenek.push(["dergi", r.w, r.w]);
  if (r.s && r.k === "Haber") secenek.push(["kaynak", r.s, r.s]);
  (r.e || []).filter(e => KAVRAM.has(e) && e !== "kazim").slice(0, 5).forEach(e => secenek.push(["kavram", e, kavramAdi(KAVRAM.get(e))]));
  levhaAc(`<h3>${tx("Takip et")}</h3><p class="aciklama">${tx("Bu kayda benzeyen yeni yayın ve haberler gelince Bugün sayfasında görürsünüz.")}</p>
    <div class="kutu">${secenek.map(([tur, deger, ad], i) => `<button class="satir" data-takip-i="${i}">${esc(ad)}<span class="sag">${esc(takipTurAdi(tur))}</span></button>`).join("")
      || `<p class="aciklama" style="padding:12px">${tx("Bu kayıt için hazır seçenek yok; Kitaplık › Takip ettiklerim'den anahtar kelime ekleyebilirsiniz.")}</p>`}</div>
    <p style="text-align:center"><a class="ikincil-dugme" href="#takip">${tx("Takip ettiklerim")}</a></p>`, lv => {
    lv.querySelectorAll("[data-takip-i]").forEach(b => b.onclick = () => { const [tur, deger, ad] = secenek[+b.dataset.takipI]; if (takipEkle(tur, deger, ad)) levhaKapat(); });
  });
}
