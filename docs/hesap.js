/* Harrix Arkeoloji Bülteni — hesap ve eşitleme (Firebase)
 * Giriş isteğe bağlıdır. Giriş yapınca favoriler, konular, notlar ve kaynakça hesaba yazılır;
 * aynı hesapla açılan her cihazda görünür. Giriş yapmayanların kayıtları yalnızca o cihazda kalır.
 * Firestore yapısı:
 *   kullanicilar/{uid}                    { kitaplik: {fav, notlar, konular, kaynakca}, guncelleme, cihaz }
 *   kullanicilar/{uid}/kayitlar/{kimlik}  { r: kayıt }   (listelerdeki kayıtların kopyası)
 */
"use strict";

const FB_SURUM = "13.2.0";
const FB_CDN = `https://www.gstatic.com/firebasejs/${FB_SURUM}`;
const CIHAZ = (() => {
  try {
    let c = localStorage.getItem("harrix-cihaz");
    if (!c) { c = Math.random().toString(36).slice(2, 10); localStorage.setItem("harrix-cihaz", c); }
    return c;
  } catch (e) { return "bilinmiyor"; }
})();

const H = { hazir: false, fb: null, auth: null, db: null, kullanici: null, durum: "", bulutKayitlar: new Set(),
            dinleyiciler: [], gonderZamani: null, uygulaniyor: false, sonEsitleme: "" };

async function firebaseYukle() {
  if (H.fb) return H.fb;
  if (!window.FIREBASE_AYAR || !window.FIREBASE_AYAR.apiKey) throw new Error("ayar-yok");
  const [app, auth, fs] = await Promise.all([
    import(`${FB_CDN}/firebase-app.js`), import(`${FB_CDN}/firebase-auth.js`), import(`${FB_CDN}/firebase-firestore.js`)]);
  const uyg = app.initializeApp(window.FIREBASE_AYAR);
  H.auth = auth.initializeAuth(uyg, {
    persistence: [auth.indexedDBLocalPersistence, auth.browserLocalPersistence],
    popupRedirectResolver: auth.browserPopupRedirectResolver,
  });
  H.auth.languageCode = "tr";
  try {
    H.db = fs.initializeFirestore(uyg, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (e) { H.db = fs.getFirestore(uyg); }
  H.fb = { auth, fs };
  return H.fb;
}

const HATA_METNI = {
  "auth/invalid-email": tx("E-posta adresi geçerli değil."),
  "auth/missing-password": tx("Şifreyi yazın."),
  "auth/weak-password": tx("Şifre en az 6 karakter olmalı."),
  "auth/email-already-in-use": tx("Bu e-postayla zaten bir hesap var. \"Giriş yap\"ı deneyin."),
  "auth/invalid-credential": tx("E-posta ya da şifre yanlış."),
  "auth/wrong-password": tx("E-posta ya da şifre yanlış."),
  "auth/user-not-found": tx("Bu e-postayla bir hesap yok. \"Hesap oluştur\"u deneyin."),
  "auth/too-many-requests": tx("Çok fazla deneme yapıldı. Birkaç dakika sonra yeniden deneyin."),
  "auth/network-request-failed": tx("İnternet bağlantısı yok."),
  "auth/popup-closed-by-user": tx("Google penceresi kapatıldı."),
  "auth/cancelled-popup-request": tx("Google penceresi kapatıldı."),
  "auth/unauthorized-domain": tx("Bu adres Firebase'de izinli değil (yönetici ayarı)."),
  "ayar-yok": tx("Hesap sistemi henüz kurulmadı."),
  "auth/requires-recent-login": tx("Güvenlik için önce çıkış yapıp yeniden giriş yapın, sonra hesabı silin."),
};
const hataMetni = e => HATA_METNI[e && (e.code || e.message)] || tx("Giriş yapılamadı. Biraz sonra yeniden deneyin.");

/* ---------------------------------------------------------------- birleştirme */
function birlestir(yerel, bulut) {
  const k = bulut || {};
  const konular = [...(yerel.konular || [])].map(x => ({ ...x, ids: [...x.ids] }));
  for (const b of k.konular || []) {
    const v = konular.find(x => x.id === b.id);
    if (!v) konular.push(b);
    else { v.ids = [...new Set([...v.ids, ...b.ids])]; if (!v.not && b.not) v.not = b.not; }
  }
  const notlar = { ...(k.notlar || {}) };
  for (const [id, n] of Object.entries(yerel.notlar || {})) {
    if (!notlar[id]) notlar[id] = n;
    else if (notlar[id] !== n) notlar[id] = notlar[id].includes(n) ? notlar[id] : `${notlar[id]}\n\n${n}`;
  }
  return {
    fav: [...new Set([...(yerel.fav || []), ...(k.fav || [])])],
    kaynakca: [...new Set([...(yerel.kaynakca || []), ...(k.kaynakca || [])])],
    notlar, konular,
  };
}
const kitaplikAl = () => ({ fav: D.fav, notlar: D.notlar, konular: D.konular, kaynakca: D.kaynakca });
const belgeAdi = id => encodeURIComponent(id).replace(/\./g, "%2E");

/* ---------------------------------------------------------------- buluta yaz */
function hesapDegisti() {
  if (!H.kullanici || H.uygulaniyor) return;
  clearTimeout(H.gonderZamani);
  H.gonderZamani = setTimeout(buluttaKaydet, 1200);
}
async function buluttaKaydet() {
  if (!H.kullanici) return;
  const { fs } = H.fb;
  const uid = H.kullanici.uid;
  try {
    const parti = fs.writeBatch(H.db);
    const simdi = Date.now();
    parti.set(fs.doc(H.db, "kullanicilar", uid), { kitaplik: kitaplikAl(), guncelleme: simdi, cihaz: CIHAZ });
    let n = 0;
    for (const [id, r] of Object.entries(D.kayitlar)) {
      if (!H.bulutKayitlar.has(id) && n < 400) { parti.set(fs.doc(H.db, "kullanicilar", uid, "kayitlar", belgeAdi(id)), { r }); H.bulutKayitlar.add(id); n++; }
    }
    for (const id of [...H.bulutKayitlar]) {
      if (!D.kayitlar[id] && n < 450) { parti.delete(fs.doc(H.db, "kullanicilar", uid, "kayitlar", belgeAdi(id))); H.bulutKayitlar.delete(id); n++; }
    }
    await parti.commit();
    D.esitleme = simdi; H.sonEsitleme = new Date().toISOString();
    try { localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(D)); } catch (e) {}
    if (n >= 400) hesapDegisti();   // kalanlar bir sonraki partide
  } catch (e) {
    H.durum = tx("Eşitlenemedi; internet gelince yeniden denenecek.");
  }
}

/* ---------------------------------------------------------------- buluttan oku */
function dinle() {
  const { fs } = H.fb;
  const uid = H.kullanici.uid;
  H.dinleyiciler.forEach(c => c()); H.dinleyiciler = [];
  H.dinleyiciler.push(fs.onSnapshot(fs.collection(H.db, "kullanicilar", uid, "kayitlar"), anlik => {
    let degisti = false;
    anlik.docChanges().forEach(d => {
      const r = d.doc.data().r;
      if (!r || !r.i) return;
      if (d.type === "removed") { H.bulutKayitlar.delete(r.i); return; }
      H.bulutKayitlar.add(r.i);
      if (!D.kayitlar[r.i]) { D.kayitlar[r.i] = r; degisti = true; }
      if (!DIZIN.has(r.i)) DIZIN.set(r.i, r);
    });
    if (degisti) { try { localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(D)); } catch (e) {} }
  }));
  H.dinleyiciler.push(fs.onSnapshot(fs.doc(H.db, "kullanicilar", uid), belge => {
    if (!belge.exists() || belge.metadata.hasPendingWrites) return;
    const v = belge.data();
    if (v.cihaz === CIHAZ || !(v.guncelleme > (D.esitleme || 0))) return;
    H.uygulaniyor = true;
    Object.assign(D, { fav: v.kitaplik.fav || [], notlar: v.kitaplik.notlar || {}, konular: v.kitaplik.konular || [],
                       kaynakca: v.kitaplik.kaynakca || [], esitleme: v.guncelleme });
    try { localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(D)); } catch (e) {}
    H.uygulaniyor = false;
    H.sonEsitleme = new Date().toISOString();
    if (!/^#(giris|k\/)/.test(location.hash) && $("#levha").hidden) rota(true);
  }));
}

async function oturumAcildi(kullanici) {
  const { fs } = H.fb;
  H.kullanici = kullanici;
  H.bulutKayitlar = new Set();
  try {
    if (D.uid !== kullanici.uid) {
      // bu cihazda bu hesapla ilk giriş: cihazdakilerle hesaptakileri birleştir
      const [belge, kayitlar] = await Promise.all([
        fs.getDoc(fs.doc(H.db, "kullanicilar", kullanici.uid)),
        fs.getDocs(fs.collection(H.db, "kullanicilar", kullanici.uid, "kayitlar"))]);
      kayitlar.forEach(d => { const r = d.data().r; if (r && r.i) { H.bulutKayitlar.add(r.i); if (!D.kayitlar[r.i]) D.kayitlar[r.i] = r; if (!DIZIN.has(r.i)) DIZIN.set(r.i, r); } });
      const birlesik = birlestir(kitaplikAl(), belge.exists() ? belge.data().kitaplik : null);
      Object.assign(D, birlesik, { uid: kullanici.uid });
      try { localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(D)); } catch (e) {}
      await buluttaKaydet();
    }
  } catch (e) { H.durum = tx("Hesaptaki kayıtlar şimdi alınamadı; internet gelince eşitlenecek."); }
  dinle();
}

/* ---------------------------------------------------------------- giriş işlemleri */
async function hesapBaslat() {
  try {
    const { auth } = await firebaseYukle();
    try { await auth.getRedirectResult(H.auth); } catch (e) { if (e.code) bildir(hataMetni(e)); }
    auth.onAuthStateChanged(H.auth, async k => {
      if (k) { await oturumAcildi(k); }
      else { H.kullanici = null; H.dinleyiciler.forEach(c => c()); H.dinleyiciler = []; }
      H.hazir = true;
      if (/^#(ayarlar|giris)/.test(location.hash)) rota(true);
    });
  } catch (e) { H.hazir = true; H.yok = true; }
}

async function googleIleGir() {
  const { auth } = await firebaseYukle();
  const saglayici = new auth.GoogleAuthProvider();
  saglayici.setCustomParameters({ prompt: "select_account" });
  try {
    await auth.signInWithPopup(H.auth, saglayici);
  } catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      await auth.signInWithRedirect(H.auth, saglayici);
      return;
    }
    throw e;
  }
}
async function epostaIleGir(eposta, sifre, yeni) {
  const { auth } = await firebaseYukle();
  if (yeni) await auth.createUserWithEmailAndPassword(H.auth, eposta, sifre);
  else await auth.signInWithEmailAndPassword(H.auth, eposta, sifre);
}
async function sifreSifirla(eposta) {
  const { auth } = await firebaseYukle();
  await auth.sendPasswordResetEmail(H.auth, eposta);
}
async function cikisYap() {
  const { auth } = await firebaseYukle();
  await buluttaKaydet();
  await auth.signOut(H.auth);
  D.uid = null; D.esitleme = 0; kaydet();
}

/* Hesabı ve buluttaki bütün verileri kalıcı olarak siler (KVKK m.11; App Store 5.1.1(v)).
 * Bu cihazdaki kayıtlar yerinde kalır. */
async function hesabiSil() {
  const { auth, fs } = await firebaseYukle();
  const k = H.auth.currentUser;
  if (!k) return;
  const uid = k.uid;
  H.dinleyiciler.forEach(c => c()); H.dinleyiciler = [];
  clearTimeout(H.gonderZamani);
  const kayitlar = await fs.getDocs(fs.collection(H.db, "kullanicilar", uid, "kayitlar"));
  const belgeler = kayitlar.docs.map(d => d.ref);
  for (let i = 0; i < belgeler.length; i += 400) {
    const parti = fs.writeBatch(H.db);
    belgeler.slice(i, i + 400).forEach(r => parti.delete(r));
    await parti.commit();
  }
  await fs.deleteDoc(fs.doc(H.db, "kullanicilar", uid));
  H.kullanici = null;          // silme sırasında yeniden yazılmasın
  await auth.deleteUser(k);
  D.uid = null; D.esitleme = 0; kaydet();
}
function hesapSilLevhasi() {
  levhaAc(`<h3>${tx("Hesabı sil")}</h3>
    <p class="aciklama">${esc(hesapAdi())} hesabı ve hesapta saklanan favoriler, konular, notlar ve kaynakça kalıcı olarak silinir. Bu işlem geri alınamaz. Bu cihazdaki kayıtlarınız silinmez.</p>
    <p style="margin:14px 0 0"><button class="buyuk-dugme tehlike" id="sil-onay">${tx("Hesabı kalıcı olarak sil")}</button></p>
    <p style="text-align:center"><button class="ikincil-dugme" id="sil-vazgec">${tx("Vazgeç")}</button></p>`, lv => {
    lv.querySelector("#sil-vazgec").onclick = levhaKapat;
    lv.querySelector("#sil-onay").onclick = async e => {
      e.target.disabled = true; e.target.textContent = tx("Siliniyor…");
      try { await hesabiSil(); levhaKapat(); bildir(tx("Hesabınız ve buluttaki verileriniz silindi")); rota(true); }
      catch (err) {
        levhaKapat(); bildir(hataMetni(err));
        if (H.auth && H.auth.currentUser) { H.kullanici = H.auth.currentUser; dinle(); }
      }
    };
  });
}

/* ---------------------------------------------------------------- arayüz */
function hesapAdi() {
  const k = H.kullanici;
  return k ? (k.displayName || k.email || tx("Hesabınız")) : "";
}

function hesapGrubuHtml() {
  if (H.yok) return "";
  if (!H.hazir) return `<div class="grup"><h3>${tx("Hesap")}</h3><div class="kutu"><div class="satir">${tx("Yükleniyor…")}</div></div></div>`;
  if (!H.kullanici) {
    return `<div class="grup"><h3>${tx("Hesap")}</h3><div class="kutu">
      <a class="satir" href="#giris">${tx("Giriş yap ya da hesap oluştur")}</a></div>
      <p class="aciklama">Giriş yaparsanız favorileriniz, konularınız, notlarınız ve kaynakçanız hesabınızda saklanır; başka telefonda ya da bilgisayarda da görünür.</p></div>`;
  }
  return `<div class="grup"><h3>${tx("Hesap")}</h3><div class="kutu">
    <div class="satir"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(hesapAdi())}</span><span class="sag">${H.kullanici.providerData.some(p => p.providerId === "google.com") ? "Google" : "E-posta"}</span></div>
    <div class="satir">${tx("Eşitleme")}<span class="sag">${esc(H.durum || (H.sonEsitleme ? tx("Eşitlendi, {saat}", { saat: saatYaz(H.sonEsitleme) }) : tx("Açık")))}</span></div>
    <button class="satir" id="cikis">${tx("Çıkış yap")}</button>
    <button class="satir" id="hesap-sil" style="color:var(--rapor)">${tx("Hesabı sil")}</button>
  </div><p class="aciklama">Çıkış yapınca kayıtlarınız bu cihazda da kalır; hesabınızdakiler silinmez. "${tx("Hesabı sil")}" hesabı ve buluttaki bütün verileri kalıcı olarak siler.</p></div>`;
}
function hesapGrubuBagla() {
  const c = document.getElementById("cikis");
  if (c) c.onclick = async () => { await cikisYap(); bildir(tx("Çıkış yapıldı")); rota(true); };
  const sil = document.getElementById("hesap-sil");
  if (sil) sil.onclick = hesapSilLevhasi;
}

function sayfaGiris() {
  if (H.kullanici) {
    $("#sayfa").innerHTML = bosHtml(`${hesapAdi()} olarak giriş yapıldı`, tx("Kayıtlarınız hesabınızla eşitleniyor."),
      `<a class="ikincil-dugme" href="#bugun">${tx("Bültene dön")}</a>`);
    return;
  }
  $("#sayfa").innerHTML = `<div class="giris">
    <img src="ikon/logo.svg" alt="" class="giris-logo">
    <h2>${tx("Kayıtlarınız her cihazda")}</h2>
    <p class="giris-metin">Giriş yaparsanız favorileriniz, konularınız, notlarınız ve kaynakçanız hesabınızda saklanır.
      Telefon değişse de kaybolmaz; bilgisayardan da açabilirsiniz.</p>
    <button class="buyuk-dugme google" id="g-google">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" stroke="none" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#34A853" stroke="none" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" stroke="none" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z"/><path fill="#EA4335" stroke="none" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.8 9.4 6 12 6z"/></svg>
      Google ile devam et</button>
    <div class="ayrac"><span>${tx("ya da e-postayla")}</span></div>
    <form id="g-form" novalidate>
      <label class="alan"><span>E-posta</span><input id="g-eposta" type="email" autocomplete="email" inputmode="email" autocapitalize="off" required></label>
      <label class="alan"><span>${tx("Şifre")}</span><input id="g-sifre" type="password" autocomplete="current-password" minlength="6" required></label>
      <p class="giris-hata" id="g-hata" role="alert"></p>
      <div class="iki-dugme">
        <button class="buyuk-dugme" type="submit" id="g-gir">${tx("Giriş yap")}</button>
        <button class="buyuk-dugme ikinci" type="button" id="g-yeni">${tx("Hesap oluştur")}</button>
      </div>
      <p style="text-align:center;margin:14px 0 0"><a href="#" id="g-unuttum">${tx("Şifremi unuttum")}</a></p>
    </form>
    <p style="text-align:center;margin:26px 0 0"><a href="#bugun" id="g-gec" class="ikincil-dugme">${tx("Giriş yapmadan devam et")}</a></p>
    <p class="aciklama" style="text-align:center">${tx("Giriş yapmazsanız kayıtlarınız yalnızca bu cihazda kalır. İstediğiniz zaman Ayarlar'dan giriş yapabilirsiniz.")}</p>
  </div>`;
  const hata = m => { $("#g-hata").textContent = m || ""; };
  const kilitle = k => document.querySelectorAll(".giris button").forEach(b => b.disabled = k);
  const bitti = () => { bildir(`Hoş geldiniz, ${hesapAdi()}`); location.hash = "#bugun"; };
  $("#g-google").onclick = async () => {
    hata(""); kilitle(true);
    try { await googleIleGir(); if (H.auth && H.auth.currentUser) bitti(); }
    catch (e) { hata(hataMetni(e)); }
    kilitle(false);
  };
  const eposta = async yeni => {
    hata("");
    const ep = $("#g-eposta").value.trim(), sf = $("#g-sifre").value;
    if (!ep || !sf) { hata(tx("E-posta ve şifreyi yazın.")); return; }
    if (yeni && sf.length < 6) { hata(tx("Şifre en az 6 karakter olmalı.")); return; }
    kilitle(true);
    try { await epostaIleGir(ep, sf, yeni); bitti(); } catch (e) { hata(hataMetni(e)); }
    kilitle(false);
  };
  $("#g-form").onsubmit = e => { e.preventDefault(); eposta(false); };
  $("#g-yeni").onclick = () => eposta(true);
  $("#g-unuttum").onclick = async e => {
    e.preventDefault();
    const ep = $("#g-eposta").value.trim();
    if (!ep) { hata(tx("Önce e-posta adresinizi yazın.")); return; }
    try { await sifreSifirla(ep); bildir(tx("Şifre yenileme bağlantısı e-postanıza gönderildi")); hata(""); }
    catch (er) { hata(hataMetni(er)); }
  };
}

hesapBaslat();
