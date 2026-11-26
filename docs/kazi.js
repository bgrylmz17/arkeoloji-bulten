/* Arkix — Kazı duyuruları: sezon başlangıcı, gönüllü/öğrenci arayışı, etkinlik. Kazı ekipleri gönderir, yönetici onaylar.
 * Firestore kazi_duyurulari/{id} { tur, baslik, kazi, il, baslangic, bitis, basvuru_son, metin, iletisim, uid, ad, tarih, durum }
 *   durum: "bekliyor" → yönetici "onayli" ya da "red" yapar. Onaylılar herkese açık; kurallar: mobil/firestore.rules.
 * Native: harrix-arkeoloji-mobil/src/components/KaziDuyurulari.tsx (aynı şema). */
const KAZI_TURLERI = { sezon: "Sezon başlıyor", gonullu: "Gönüllü / öğrenci aranıyor", etkinlik: "Etkinlik", diger: "Diğer" };
const ILLER = ["Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman",
  "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan",
  "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkâri", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars",
  "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
  "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Şırnak", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli",
  "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak", "Yurt dışı"];
const KD = { liste: null, tur: "", il: "", gecmis: false, yukleniyor: false, hata: "" };
const bugunTarih = () => new Date().toISOString().slice(0, 10);
const kdTarih = t => t ? tarihYaz(t) : "";

async function kaziDuyurulariYukle(zorla) {
  if (KD.liste && !zorla) return KD.liste;
  KD.yukleniyor = true;
  try {
    const { fs } = await firebaseYukle();
    const a = await fs.getDocs(fs.query(fs.collection(H.db, "kazi_duyurulari"), fs.where("durum", "==", "onayli"), fs.limit(300)));
    KD.liste = a.docs.map(d => ({ id: d.id, ...d.data() }));
    KD.hata = "";
  } catch (e) { KD.liste = KD.liste || []; KD.hata = tx("Duyurular şu an yüklenemedi."); }
  KD.yukleniyor = false;
  return KD.liste;
}
function kaziGorunenler() {
  const bugun = bugunTarih();
  return (KD.liste || [])
    .filter(d => (!KD.tur || d.tur === KD.tur) && (!KD.il || d.il === KD.il))
    .filter(d => KD.gecmis || (d.bitis || d.basvuru_son || d.baslangic || "9999") >= bugun)
    .sort((a, b) => (a.basvuru_son || a.baslangic || "9999").localeCompare(b.basvuru_son || b.baslangic || "9999"));
}
function kaziKartHtml(d) {
  const tarih = [kdTarih(d.baslangic), d.bitis ? kdTarih(d.bitis) : ""].filter(Boolean).join(" – ");
  const yakin = d.basvuru_son && d.basvuru_son >= bugunTarih() && (new Date(d.basvuru_son) - new Date()) / 864e5 < 10;
  return `<button class="kazi-kart" data-kazi="${esc(d.id)}">
    <span class="kazi-tur kazi-${esc(d.tur)}">${esc(tx(KAZI_TURLERI[d.tur] || "Diğer"))}</span>
    <b>${esc(d.baslik)}</b>
    <small>${esc([d.kazi, d.il].filter(Boolean).join(" · "))}${tarih ? ` · ${esc(tarih)}` : ""}</small>
    ${d.basvuru_son ? `<em class="${yakin ? "yakin" : ""}">${tx("Son başvuru: {t}", { t: kdTarih(d.basvuru_son) })}</em>` : ""}</button>`;
}

/* Özel sekmesinin "Kazı duyuruları" bölümü */
async function kaziBolumuCiz(kap) {
  const ciz = () => {
    const l = kaziGorunenler();
    const iller = [...new Set((KD.liste || []).map(d => d.il).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    kap.innerHTML = `
      <div class="suzgec" role="group" aria-label="${tx("Tür")}">
        <button class="cip" data-kt="" aria-pressed="${!KD.tur}">${tx("Tümü")}</button>
        ${Object.entries(KAZI_TURLERI).map(([k, ad]) => `<button class="cip" data-kt="${k}" aria-pressed="${KD.tur === k}">${tx(ad)}</button>`).join("")}
      </div>
      <div class="kazi-ust">
        ${iller.length ? `<select id="kazi-il"><option value="">${tx("Bütün iller")}</option>${iller.map(i => `<option ${KD.il === i ? "selected" : ""}>${esc(i)}</option>`).join("")}</select>` : "<span></span>"}
        <label class="kazi-gecmis"><input type="checkbox" id="kazi-gecmis" ${KD.gecmis ? "checked" : ""}> ${tx("Geçmişleri de göster")}</label>
      </div>
      <p style="margin:0 16px 12px"><button class="buyuk-dugme" id="kazi-gonder">+ ${tx("Duyuru gönder")}</button></p>
      ${KD.hata ? `<p class="aciklama" style="margin:0 16px">${esc(KD.hata)}</p>` : ""}
      ${l.length ? `<div class="kazi-liste">${l.map(kaziKartHtml).join("")}</div>`
        : KD.yukleniyor ? `<p class="aciklama" style="margin:0 16px">${tx("Yükleniyor…")}</p>`
        : bosHtml(tx("Şu an açık duyuru yok"), tx("Kazınız sezona başlıyor ya da gönüllü, öğrenci arıyorsanız buradan duyurun; incelendikten sonra yayımlanır."))}`;
    kap.querySelectorAll("[data-kt]").forEach(b => b.onclick = () => { KD.tur = b.dataset.kt; ciz(); });
    const il = kap.querySelector("#kazi-il"); if (il) il.onchange = () => { KD.il = il.value; ciz(); };
    kap.querySelector("#kazi-gecmis").onchange = e => { KD.gecmis = e.target.checked; ciz(); };
    kap.querySelector("#kazi-gonder").onclick = kaziFormu;
    kap.querySelectorAll("[data-kazi]").forEach(b => b.onclick = () => kaziAyrinti(KD.liste.find(d => d.id === b.dataset.kazi)));
  };
  ciz();
  await kaziDuyurulariYukle();
  if (document.body.contains(kap)) ciz();
}

function kaziAyrinti(d) {
  if (!d) return;
  const iletisim = String(d.iletisim || "").trim();
  const bag = /^https?:\/\//.test(iletisim) ? iletisim : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(iletisim) ? `mailto:${iletisim}?subject=${encodeURIComponent(d.baslik)}` : "";
  levhaAc(`<span class="kazi-tur kazi-${esc(d.tur)}">${esc(tx(KAZI_TURLERI[d.tur] || "Diğer"))}</span>
    <h3 style="margin:8px 0 4px">${esc(d.baslik)}</h3>
    <p class="aciklama" style="margin:0 0 10px">${esc([d.kazi, d.il].filter(Boolean).join(" · "))}</p>
    <div class="kutu">
      ${d.baslangic ? `<div class="satir">${tx("Başlangıç")}<span class="sag">${esc(kdTarih(d.baslangic))}</span></div>` : ""}
      ${d.bitis ? `<div class="satir">${tx("Bitiş")}<span class="sag">${esc(kdTarih(d.bitis))}</span></div>` : ""}
      ${d.basvuru_son ? `<div class="satir">${tx("Son başvuru")}<span class="sag">${esc(kdTarih(d.basvuru_son))}</span></div>` : ""}
    </div>
    <p class="kazi-metin">${esc(d.metin || "")}</p>
    ${iletisim ? `<p>${bag ? `<a class="buyuk-dugme" style="display:block;text-align:center;text-decoration:none" href="${esc(bag)}" ${bag.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${tx("İletişime geç")}</a>` : ""}
      <small class="aciklama">${esc(iletisim)}</small></p>` : ""}
    <p style="text-align:center;margin:10px 0 0"><button class="ikincil-dugme" id="kazi-paylas">${tx("Paylaş")}</button>
      <button class="ikincil-dugme" id="kazi-bildir">${tx("Bildir")}</button></p>`, lv => {
    lv.querySelector("#kazi-paylas").onclick = () => paylasLevhasi({ baslik: d.baslik, url: `${location.origin}${location.pathname}#ozel/kazi`, metin: `${d.baslik} · ${d.kazi || ""} ${d.il || ""}` });
    lv.querySelector("#kazi-bildir").onclick = () => geriBildirimLevhasi("kayit", { i: `kazi/${d.id}`, b: d.baslik });
  });
}

async function kaziFormu() {
  if (!H.kullanici) { levhaKapat(); location.hash = "#giris"; bildir(tx("Duyuru göndermek için giriş yapın")); return; }
  // yalnız onaylı Prof. Dr., Doç. Dr., Dr. Öğr. Üyesi ve Dr. (kurallar: duyuruYetkili)
  try { await unvanYukle(true); } catch (e) {}
  if (!yoneticiMi() && !(unvanBul(UNVAN.onayli) || {}).duyuru) {
    levhaAc(`<h3>${tx("Kazı duyurusu gönder")}</h3>
      <p class="aciklama">${tx("Kazı duyurularını doğrulanmış Prof. Dr., Doç. Dr., Dr. Öğr. Üyesi ve Dr. ünvanlı üyeler gönderebilir. Ünvanınızı seçin; doğrulandıktan sonra duyuru gönderebilirsiniz.")}</p>
      ${UNVAN.talep ? `<p class="aciklama">${tx("{u} · onay bekliyor", { u: unvanAd(UNVAN.talep.unvan) })}</p>` : ""}
      <p style="margin:14px 0 0"><button class="buyuk-dugme" id="kd-unvan">${tx("Ünvanımı seç")}</button></p>`, lv => { lv.querySelector("#kd-unvan").onclick = unvanLevhasi; });
    return;
  }
  levhaAc(`<h3>${tx("Kazı duyurusu gönder")}</h3>
    <p class="aciklama">${tx("Duyurunuz yönetici incelemesinden sonra yayımlanır. İletişim bilgisi herkese açık görünür.")}</p>
    <form id="kazi-form" class="kazi-form">
      <label>${tx("Tür")}<select name="tur">${Object.entries(KAZI_TURLERI).map(([k, ad]) => `<option value="${k}">${tx(ad)}</option>`).join("")}</select></label>
      <label>${tx("Başlık")}<input name="baslik" maxlength="120" required placeholder="${tx("Ör. Kızılin 2027 sezonu için öğrenci gönüllüler aranıyor")}"></label>
      <label>${tx("Kazı ya da kurum")}<input name="kazi" maxlength="80" placeholder="${tx("Ör. Kızılin Höyük Kazısı")}"></label>
      <label>${tx("İl")}<select name="il"><option value="">—</option>${ILLER.map(i => `<option>${esc(i)}</option>`).join("")}</select></label>
      <div class="kazi-form-iki"><label>${tx("Başlangıç")}<input type="date" name="baslangic"></label><label>${tx("Bitiş")}<input type="date" name="bitis"></label></div>
      <label>${tx("Son başvuru (varsa)")}<input type="date" name="basvuru_son"></label>
      <label>${tx("Açıklama")}<textarea name="metin" rows="6" maxlength="2000" required placeholder="${tx("Kimler başvurabilir, süre, konaklama, ulaşım, istenen belgeler…")}"></textarea></label>
      <label>${tx("İletişim (e-posta ya da bağlantı)")}<input name="iletisim" maxlength="200" placeholder="kazi@universite.edu.tr"></label>
      <p style="margin:12px 0 0"><button class="buyuk-dugme" type="submit">${tx("İncelemeye gönder")}</button></p>
    </form>`, lv => {
    lv.querySelector("#kazi-form").onsubmit = async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      const k = (a, n) => String(f[a] || "").trim().slice(0, n);
      if (kufurVar(`${f.baslik} ${f.metin}`)) { bildir(tx("Metinde uygun olmayan bir ifade var.")); return; }
      const dugme = e.target.querySelector("button[type=submit]"); dugme.disabled = true;
      try {
        const { fs } = H.fb;
        await fs.addDoc(fs.collection(H.db, "kazi_duyurulari"), {
          tur: KAZI_TURLERI[f.tur] ? f.tur : "diger", baslik: k("baslik", 120), kazi: k("kazi", 80), il: k("il", 40),
          baslangic: k("baslangic", 10), bitis: k("bitis", 10), basvuru_son: k("basvuru_son", 10), metin: k("metin", 2000), iletisim: k("iletisim", 200),
          uid: H.kullanici.uid, ad: (typeof gorunenAd === "function" ? gorunenAd() : "").slice(0, 40), tarih: fs.serverTimestamp(), durum: "bekliyor" });
        levhaKapat(); bildir(tx("Teşekkürler! Duyurunuz incelendikten sonra yayımlanacak."));
      } catch (err) { dugme.disabled = false; bildir(tx("Gönderilemedi. Biraz sonra yeniden deneyin.")); }
    };
  });
}

/* Yönetim paneli: bekleyen duyurular */
async function kaziYonetimHtml(kutu) {
  const { fs } = H.fb;
  const a = await fs.getDocs(fs.query(fs.collection(H.db, "kazi_duyurulari"), fs.orderBy("tarih", "desc"), fs.limit(150)));
  const l = a.docs.map(d => ({ id: d.id, ...d.data() }));
  kutu.innerHTML = l.length ? `<ul class="yon-liste">${l.map(d => `<li class="yon-kart durum-${d.durum === "bekliyor" ? "yeni" : d.durum === "onayli" ? "cozuldu" : "gizli"}" data-id="${d.id}">
      <p class="yon-ust"><span class="etiket">${esc(tx(KAZI_TURLERI[d.tur] || "Diğer"))}</span><span class="etiket">${esc(d.durum)}</span><small>${esc(d.ad || "")}</small></p>
      <p><b>${esc(d.baslik)}</b><br><small>${esc([d.kazi, d.il, d.baslangic, d.bitis, d.basvuru_son && "son: " + d.basvuru_son].filter(Boolean).join(" · "))}</small></p>
      <p class="yon-metin">${esc(d.metin || "")}</p><p><small>${esc(d.iletisim || "")}</small></p>
      <p class="yon-eylem"><button data-k="onayli">${tx("Onayla")}</button><button data-k="red">${tx("Reddet")}</button><button data-k="sil">${tx("Sil")}</button></p></li>`).join("")}</ul>`
    : bosHtml(tx("Duyuru yok"), "");
  kutu.querySelectorAll("[data-k]").forEach(b => b.onclick = async () => {
    const ref = fs.doc(H.db, "kazi_duyurulari", b.closest("[data-id]").dataset.id);
    if (b.dataset.k === "sil") { if (!confirm(tx("Silinsin mi?"))) return; await fs.deleteDoc(ref); }
    else await fs.updateDoc(ref, { durum: b.dataset.k });
    KD.liste = null;
    kaziYonetimHtml(kutu);
  });
}
