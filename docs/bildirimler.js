/* Arkix — Bildirimler (alt bardaki 🔔 sekmesi, #ozet): üstte dünün özeti, altında bildirim akışı.
 * Akış istemcide üretilir: Arkix Özel yazıları, son dakika (çok kaynaklı haberler), elle duyurular, takip ettiklerinden
 * yeni kayıtlar, onaylı kazı duyuruları ve Arkix'teki yenilikler. Okunmamış sayısı sekme rozetinde.
 * Telefona bildirim (web push): Firebase Cloud Messaging. Abonelik Firestore bildirim_abonelik/{sha256(token)[:40]}
 *   { token, platform: "web"|"ios"|"android", kategoriler: [...], uid, dil, guncelleme }; gönderen: toplayici/bildirim_gonder.py (saatlik).
 * Native karşılığı: harrix-arkeoloji-mobil/src/services/bildirimler.ts ve app/(tabs)/ozet.tsx. */
const FCM_VAPID = "BOMcDeXgJ5_vgZhS5wam6ejQC1JED7C8gxl0yFRU7bSanPygoZzNb5SFWEBWedNBMGa4cJ3aer1hurgEmh3bxMw";   // Firebase konsolu › Proje ayarları › Cloud Messaging › Web Push sertifikaları › Anahtar çifti (herkese açık anahtar)
const PUSH_KATEGORILER = [
  ["ozel", "Arkix Özel yazıları"],
  ["sondakika", "Son dakika: çok kaynağın verdiği haberler"],
  ["takip", "Takip ettiklerinden yeni kayıtlar (günde bir)"],
  ["kazi", "Yeni kazı duyuruları"],
];
const YENILIKLER = [
  { tarih: "2026-11-26T00:10:00Z", baslik: "Arkix'te yeni: Katman Sırala ve rozetler", metin: "Günün 5 buluntusunu en eskiden en yeniye diz; rozet topla, haftanın alanında ×2 puan kazan.", adres: "#oyunlar" },
  { tarih: "2026-11-25T23:20:00Z", baslik: "Arkix'te yeni: Oyunlar", metin: "Kelime Kazısı ve piksel kazı oyunu Kazı Başı; skor tablosunda yarış.", adres: "#oyunlar" },
  { tarih: "2026-11-25T22:50:00Z", baslik: "Arkix'te yeni: Bildirimler", metin: "Önemli gelişmeler artık burada; istersen telefonuna da gelsin.", adres: "#ozet" },
  { tarih: "2026-11-25T21:00:00Z", baslik: "Arkix'te yeni: Kazı duyuruları", metin: "Sezona başlayan kazılar, gönüllü ve öğrenci ilanları Özel sekmesinde.", adres: "#ozel/kazi" },
  { tarih: "2026-11-25T19:00:00Z", baslik: "Arkix'te yeni: Günün Katmanları", metin: "Dünün öne çıkanları katman katman; dinleyerek de takip edebilirsin.", adres: "#bugun" },
];
const BILDIRIM_IKON = {
  ozel: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  sondakika: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  duyuru: '<path d="M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6"/>',
  takip: '<path d="M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0"/><circle cx="12" cy="12" r="1.2"/>',
  kazi: '<path d="M14 4l6 6M4 20l9-9M12 6l6 6-3 3-6-6z"/>',
  yenilik: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
};

const zamanIso = z => !z ? "" : typeof z === "string" ? z : z.toDate ? z.toDate().toISOString() : "";
function bildirimListesi() {
  const l = [];
  const kayitSatiri = (tur, r, onEk) => l.push({ tur, zaman: r.g || r.t || VERI.guncelleme, baslik: onEk ? `${onEk}: ${baslikGoster(r)}` : baslikGoster(r),
    metin: tur === "sondakika" ? [r.ks ? tx("{n} kaynakta", { n: r.ks }) : "", r.w || r.s].filter(Boolean).join(" · ") : (r.w || r.s || ""),
    adres: `#k/${encodeURIComponent(r.i)}`, kimlik: `${tur}/${r.i}` });
  VERI.kayitlar.filter(r => r.oz).forEach(r => kayitSatiri("ozel", r, "Arkix Özel"));
  VERI.kayitlar.filter(r => r.flash).slice(0, 10).forEach(r => kayitSatiri("sondakika", r));
  (VERI.duyurular || []).filter(d => !d.yalnizEskiAdres).forEach((d, i) => l.push({ tur: "duyuru", zaman: d.tarih || VERI.guncelleme, baslik: d.baslik,
    metin: d.ozet || tx("Harrix duyurusu"), adres: d.url || "#bugun", dis: !!d.url, kimlik: `duyuru/${i}` }));
  if (typeof takipKayitlari === "function" && (D.takip || []).length) {
    const gunluk = {};
    takipKayitlari().filter(r => (r.g || "") >= gunOnce(7)).forEach(r => { const g = (r.g || "").slice(0, 10); (gunluk[g] = gunluk[g] || []).push(r); });
    Object.entries(gunluk).forEach(([g, rr]) => l.push({ tur: "takip", zaman: rr.map(r => r.g).sort().pop(),
      baslik: tx("Takip ettiklerinden {n} yeni kayıt", { n: rr.length }), metin: rr.slice(0, 2).map(r => baslikGoster(r)).join(" · "), adres: "#takip", kimlik: `takip/${g}` }));
  }
  if (typeof KD !== "undefined" && KD.liste) KD.liste.forEach(d => l.push({ tur: "kazi", zaman: zamanIso(d.tarih),
    baslik: `${tx("Kazı duyurusu")}: ${d.baslik}`, metin: [d.kazi, d.il, d.basvuru_son ? tx("Son başvuru: {t}", { t: tarihYaz(d.basvuru_son) }) : ""].filter(Boolean).join(" · "),
    adres: "#ozel/kazi", kimlik: `kazi/${d.id}` }));
  // takip edilen etkinlik yaklaşınca: 7 gün, 1 gün kala ve o gün (en son ulaşılan eşik)
  const bugunMs = new Date(new Date().toDateString()).getTime();
  (D.takip || []).filter(e => e.tur === "etkinlik" && e.t).forEach(e => {
    const gunMs = new Date(e.t + "T00:00:00").getTime(), kalan = Math.round((gunMs - bugunMs) / 864e5);
    const esik = [0, 1, 7].find(x => kalan >= 0 && kalan <= x);
    if (esik === undefined) return;
    l.push({ tur: "duyuru", zaman: new Date(gunMs - esik * 864e5).toISOString(), baslik: `📅 ${esik === 0 ? tx("Bugün") : esik === 1 ? tx("Yarın") : tx("Bir hafta kaldı")}: ${e.ad}`,
      metin: e.s || "", adres: e.u || "#takip", dis: /^https?:/.test(e.u || ""), kimlik: `etk/${e.deger}/${esik}` });
  });
  // UKAAS (Kazı, Araştırma ve Arkeometri Sempozyumu) duyuruları ve bildiri kitapları: herkese önemli duyuru
  (VERI.etkinlikler || []).filter(d => d.onemli && (d.yt || d.t || "") >= gunOnce(21)).forEach(d => l.push({ tur: "duyuru", zaman: (d.g || "").slice(0, 19) || d.yt,
    baslik: `${d.du === "yayin" ? "📚 " + tx("Yayımlandı") : "📣 " + tx("Önemli duyuru")}: ${d.b}`, metin: d.s || "", adres: d.u, dis: true, kimlik: `onemli/${d.i}` }));
  YENILIKLER.forEach((y, i) => l.push({ tur: "yenilik", zaman: y.tarih, baslik: tx(y.baslik), metin: tx(y.metin), adres: y.adres, kimlik: `yenilik/${i}` }));
  const sinir = new Date(Date.now() - 21 * 864e5).toISOString();
  return l.filter(b => b.zaman && b.zaman >= sinir).sort((a, b) => b.zaman.localeCompare(a.zaman)).slice(0, 80);
}
function bildirimOkunmamis() {
  if (!D.bildirimGoruldu) return Math.min(3, bildirimListesi().length);   // ilk açılışta en yeni üçü
  return bildirimListesi().filter(b => b.zaman > D.bildirimGoruldu).length;
}
function bildirimAkisiHtml(okunmamisSinir) {
  const l = bildirimListesi();
  if (!l.length) return bosHtml(tx("Bildirim yok"), tx("Arkix Özel yazıları, son dakika haberleri, takip ettiklerin ve kazı duyuruları burada görünür."));
  const grup = b => { const g = b.zaman.slice(0, 10); return g >= gunOnce(0) ? tx("Bugün") : g >= gunOnce(1) ? tx("Dün") : g >= gunOnce(7) ? tx("Bu hafta") : tx("Daha önce"); };
  let son = "";
  return `<ul class="bildirim-liste">${l.map((b, i) => {
    const g = grup(b), baslikSatiri = g !== son ? `<li class="bildirim-grup">${g}</li>` : ""; son = g;
    const yeni = okunmamisSinir === null ? i < 3 : b.zaman > okunmamisSinir;
    return `${baslikSatiri}<li><a class="bildirim${yeni ? " yeni" : ""}" href="${escUrl(b.adres)}" ${b.dis ? 'target="_blank" rel="noopener"' : ""}>
      <span class="bildirim-ikon b-${b.tur}"><svg viewBox="0 0 24 24">${BILDIRIM_IKON[b.tur] || BILDIRIM_IKON.duyuru}</svg></span>
      <span class="bildirim-govde"><b>${esc(b.baslik)}</b>${b.metin ? `<small>${esc(b.metin)}</small>` : ""}</span>
      <time>${esc(bildirimNeZaman(b.zaman))}</time></a></li>`;
  }).join("")}</ul>`;
}
function bildirimNeZaman(z) {
  const dk = (Date.now() - new Date(z)) / 6e4;
  if (dk < 60) return tx("{n} dk", { n: Math.max(1, Math.round(dk)) });
  if (dk < 1440) return tx("{n} sa", { n: Math.round(dk / 60) });
  return tarihYaz(z.slice(0, 10)).replace(/ \d{4}$/, "");
}
function bildirimleriGorulduSay() {
  D.bildirimGoruldu = new Date().toISOString(); kaydet();
  if (typeof ozetRozeti === "function") ozetRozeti();
}

/* ---------------------------------------------------------------- telefona bildirim (web push) */
const pushDestek = () => !!FCM_VAPID && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
function pushDurumMetni() {
  if (!FCM_VAPID) return tx("Yakında");
  if (!pushDestek()) return tx("Bu tarayıcıda yok");
  return D.push && D.push.id ? tx("{n} konu açık", { n: (D.push.kategoriler || []).length }) : tx("Kapalı");
}
async function pushKimlik(token) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
async function pushJetonu() {
  const { fs } = await firebaseYukle();
  const m = await import(`${FB_CDN}/firebase-messaging.js`);
  const reg = await navigator.serviceWorker.ready;
  return { fs, m, token: await m.getToken(m.getMessaging(), { vapidKey: FCM_VAPID, serviceWorkerRegistration: reg }) };
}
async function pushKaydet(kategoriler) {
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted")
    throw new Error(tx("Bildirim izni verilmedi. Tarayıcı ayarlarından açabilirsin."));
  const { fs, token } = await pushJetonu();
  const id = await pushKimlik(token);
  await fs.setDoc(fs.doc(H.db, "bildirim_abonelik", id), { token, platform: "web", kategoriler, uid: (H.kullanici && H.kullanici.uid) || "",
    dil: DIL === "en" ? "en" : "tr", guncelleme: fs.serverTimestamp() });
  D.push = { id, kategoriler }; kaydet();
}
async function pushKapat() {
  try {
    const { fs, m } = await pushJetonu();
    if (D.push && D.push.id) await fs.deleteDoc(fs.doc(H.db, "bildirim_abonelik", D.push.id));
    await m.deleteToken(m.getMessaging());
  } catch (e) { /* çevrimdışı: yerelde kapat yeter; geçersiz jeton sunucuda silinir */ }
  D.push = null; kaydet();
}
function pushLevhasi() {
  const iOSTarayici = /iPhone|iPad/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches;
  const secili = new Set(D.push && D.push.kategoriler ? D.push.kategoriler : PUSH_KATEGORILER.map(k => k[0]));
  levhaAc(`<h3>${tx("Telefona bildirim")}</h3>
    <p class="aciklama">${tx("Seçtiğin önemli gelişmeler telefonuna bildirim olarak gelir. Az ve öz: son dakika günde en çok iki, takip günde bir.")}</p>
    ${!FCM_VAPID ? `<p class="aciklama"><b>${tx("Çok yakında açılıyor.")}</b></p>`
      : iOSTarayici ? `<p class="aciklama"><b>${tx("iPhone'da önce Arkix'i ana ekrana ekle (Paylaş › Ana Ekrana Ekle), sonra oradan aç.")}</b></p>`
      : !pushDestek() ? `<p class="aciklama">${tx("Bu tarayıcı bildirimleri desteklemiyor.")}</p>` : ""}
    <div class="kutu">${PUSH_KATEGORILER.map(([k, ad]) => `<label class="satir">${tx(ad)}<input type="checkbox" class="anahtar" data-pk="${k}" ${secili.has(k) ? "checked" : ""}></label>`).join("")}</div>
    <p style="margin:14px 0 0"><button class="buyuk-dugme" id="push-ac" ${pushDestek() && !iOSTarayici ? "" : "disabled"}>${D.push && D.push.id ? tx("Kaydet") : tx("Bildirimleri aç")}</button></p>
    ${D.push && D.push.id ? `<p style="text-align:center;margin:8px 0 0"><button class="ikincil-dugme" id="push-kapat">${tx("Bildirimleri kapat")}</button></p>` : ""}`, lv => {
    lv.querySelector("#push-ac").onclick = async e => {
      const k = [...lv.querySelectorAll("[data-pk]:checked")].map(x => x.dataset.pk);
      if (!k.length) { bildir(tx("En az bir konu seç.")); return; }
      e.target.disabled = true;
      try { await pushKaydet(k); levhaKapat(); bildir(tx("Bildirimler açık")); rota(true); }
      catch (h) { e.target.disabled = false; bildir(h && h.message && !/^[A-Za-z]+\//.test(h.message) ? h.message : tx("Açılamadı. Biraz sonra yeniden dene.")); }
    };
    const kapat = lv.querySelector("#push-kapat");
    if (kapat) kapat.onclick = async () => { await pushKapat(); levhaKapat(); bildir(tx("Bildirimler kapalı")); rota(true); };
  });
}
/* Girişten sonra aboneliği hesaba bağla (takip bildirimi için uid gerekir) */
async function pushHesabaBagla() {
  if (!D.push || !D.push.id || !H.kullanici || !pushDestek() || Notification.permission !== "granted") return;
  try { await pushKaydet(D.push.kategoriler); } catch (e) {}
}
