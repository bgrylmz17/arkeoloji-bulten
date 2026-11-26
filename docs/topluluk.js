/* Arkix — topluluk: avatar ve görünen ad, kayıtlara yorum, hata/istek bildirimi, yönetim paneli.
 * Firestore (harrix-bulten), kurallar: mobil/firestore.rules (Firebase konsolundan yayımlanır).
 *   yorumlar/{id}      { kayit, uid, ad, avatar, uzman, metin, tarih, gizli }   herkes okur (gizli değilse)
 *   sikayetler/{id}    { yorum, kayit, uid, neden, tarih }                      yalnız yönetici okur
 *   geribildirim/{id}  { tur, metin, eposta, uid, surum, cihaz, sayfa, tarih, durum } yalnız yönetici okur
 *   uzmanlar/{uid}, engelliler/{uid}                                          yalnız yönetici yazar
 *   profiller/{uid}.unvan, unvanlar/{uid} { unvan }, unvan_talepleri/{uid}    akademik ünvan yönetici onayıyla
 *   ziyaret/{gun} { n, k }   günlük açan cihaz sayısı (k: kurulu uygulama); yonetim/kullanicilar  (toplayici/kullanici_listesi.py)
 * Yönetici: ADMIN_EPOSTA ile (doğrulanmış e-posta) giriş yapan hesap. Kurallardaki adresle aynı olmalı. */
const ADMIN_EPOSTA = "harrixapp@gmail.com";
const YORUM_SINIR = 1000;
const yoneticiMi = () => !!(H.kullanici && H.kullanici.email === ADMIN_EPOSTA && H.kullanici.emailVerified);

/* ---------------------------------------------------------------- avatarlar ve görünen ad */
let AVATARLAR = [];
fetch("avatar/avatarlar.json").then(y => y.json()).then(v => { AVATARLAR = v.avatarlar || []; }).catch(() => {});
const avatarAdresi = id => `avatar/${encodeURIComponent(id)}.png`;
const gorunenAd = () => (profilAl().ad || (H.kullanici && H.kullanici.displayName) || "").trim();

function avatarSecLevhasi() {
  const p = profilAl();
  levhaAc(`<h3>${tx("Profil resmi")}</h3>
    <p class="aciklama">${tx("Arkix'e özel çizimlerden birini seçin ya da kendi fotoğrafınızı yükleyin.")}</p>
    <div class="avatar-izgara">${AVATARLAR.map(a => `<button type="button" class="avatar-sec${p.avatar === a.id && !p.foto ? " secili" : ""}" data-avatar="${esc(a.id)}" aria-label="${esc(a.ad)}">
      <img src="${avatarAdresi(a.id)}" alt="" width="72" height="72"><small>${esc(a.ad)}</small></button>`).join("")}</div>
    <p style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0">
      <label class="ikincil-dugme">${tx("Kendi fotoğrafımı yükle")}<input type="file" id="avatar-foto" accept="image/*" hidden></label>
      ${p.foto || p.avatar ? `<button class="ikincil-dugme" id="avatar-kaldir">${tx("Kaldır")}</button>` : ""}
    </p>`, lv => {
    lv.querySelectorAll("[data-avatar]").forEach(b => b.onclick = async () => {
      await profilKaydet({ avatar: b.dataset.avatar, foto: "" }); levhaKapat(); bildir(tx("Profil resmi kaydedildi")); rota(true);
    });
    lv.querySelector("#avatar-foto").onchange = async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try { await profilKaydet({ foto: await fotoKucult(f), avatar: "" }); levhaKapat(); bildir(tx("Profil resmi kaydedildi")); rota(true); }
      catch (err) { bildir(tx("Fotoğraf yüklenemedi.")); }
    };
    const k = lv.querySelector("#avatar-kaldir");
    if (k) k.onclick = async () => { await profilKaydet({ avatar: "", foto: "" }); levhaKapat(); rota(true); };
  });
}

function adLevhasi(sonra) {
  levhaAc(`<h3>${tx("Görünen ad")}</h3>
    <p class="aciklama">${tx("Yorumlarınızda bu ad görünür. Gerçek adınız ya da bir takma ad olabilir; e-posta adresiniz hiçbir yerde görünmez.")}</p>
    <input id="ad-girdi" maxlength="40" value="${esc(gorunenAd())}" placeholder="${tx("Ör. Ayşe K. ya da Neolitikçi")}" style="width:100%">
    <p style="margin:14px 0 0"><button class="buyuk-dugme" id="ad-kaydet">${tx("Kaydet")}</button></p>`, lv => {
    lv.querySelector("#ad-kaydet").onclick = async () => {
      const ad = lv.querySelector("#ad-girdi").value.trim().slice(0, 40);
      if (ad.length < 2) { bildir(tx("Ad en az 2 harf olmalı")); return; }
      if (kufurVar(ad)) { bildir(tx("Bu ad kullanılamaz")); return; }
      await profilKaydet({ ad }); levhaKapat(); if (sonra) sonra(); else rota(true);
    };
  });
}

/* ---------------------------------------------------------------- ünvan
 * Arkeolog ve öğrenci beyanla görünür. Akademik ünvanlar talep → yönetici onayı (unvanlar/{uid}) ile görünür.
 * Kazı duyurusunu yalnız onaylı Prof. Dr., Doç. Dr., Dr. Öğr. Üyesi ve Dr. gönderir (kurallar: duyuruYetkili). */
const UNVANLAR = [
  { id: "prof", ad: "Prof. Dr.", ad_en: "Prof. Dr.", akademik: true, duyuru: true },
  { id: "doc", ad: "Doç. Dr.", ad_en: "Assoc. Prof. Dr.", akademik: true, duyuru: true },
  { id: "dr_ogr", ad: "Dr. Öğr. Üyesi", ad_en: "Asst. Prof. Dr.", akademik: true, duyuru: true },
  { id: "dr", ad: "Dr.", ad_en: "Dr.", akademik: true, duyuru: true },
  { id: "ogr_gor", ad: "Öğr. Gör.", ad_en: "Lecturer", akademik: true },
  { id: "ars_gor", ad: "Arş. Gör.", ad_en: "Research Assistant", akademik: true },
  { id: "arkeolog", ad: "Arkeolog", ad_en: "Archaeologist" },
  { id: "ogrenci", ad: "Öğrenci", ad_en: "Student" },
];
const unvanBul = id => UNVANLAR.find(u => u.id === id) || null;
const unvanAd = id => { const u = unvanBul(id); return u ? (DIL === "en" ? u.ad_en : u.ad) : ""; };
/* Adın yanında: akademik ünvan adın önünde ("Prof. Dr. Ayşe K."), arkeolog/öğrenci küçük etiket */
function unvanliAdHtml(ad, unvan) {
  const u = unvanBul(unvan);
  if (!u) return esc(ad);
  return u.akademik ? `${esc(unvanAd(unvan))} ${esc(ad)}` : `${esc(ad)}<span class="unvan-etiket">${esc(unvanAd(unvan))}</span>`;
}
const UNVAN = { uid: null, onayli: "", onayTarih: "", talep: null };
async function unvanYukle(zorla) {
  if (!H.kullanici) return UNVAN;
  if (UNVAN.uid === H.kullanici.uid && !zorla) return UNVAN;
  const { fs } = H.fb, uid = H.kullanici.uid;
  const [o, t] = await Promise.all([fs.getDoc(fs.doc(H.db, "unvanlar", uid)).catch(() => null), fs.getDoc(fs.doc(H.db, "unvan_talepleri", uid)).catch(() => null)]);
  UNVAN.uid = uid; UNVAN.onayli = o && o.exists() ? o.data().unvan || "" : ""; UNVAN.onayTarih = o && o.exists() ? String(o.data().tarih || "") : ""; UNVAN.talep = t && t.exists() ? t.data() : null;
  return UNVAN;
}
/* Herkese açık profile yazılabilecek ünvan (kurallarla aynı mantık) */
function gecerliUnvan() {
  const u = unvanBul(profilAl().unvan);
  if (!u) return "";
  return !u.akademik || UNVAN.onayli === u.id ? u.id : "";
}
/* Girişte: yeni bir onay geldiyse profile işle; onay kaldırıldıysa akademik ünvanı düşür */
async function unvanEsitle() {
  try {
    await unvanYukle(true);
    if (UNVAN.onayli && D.unvanOnayGoruldu !== UNVAN.onayTarih) {
      D.unvanOnayGoruldu = UNVAN.onayTarih; kaydet();
      if (profilAl().unvan !== UNVAN.onayli) await profilKaydet({ unvan: UNVAN.onayli });
    } else if (!UNVAN.onayli && (unvanBul(profilAl().unvan) || {}).akademik) await profilKaydet({ unvan: "" });
  } catch (e) {}
}
function unvanDurumMetni() {
  const p = profilAl().unvan;
  if (UNVAN.talep && UNVAN.talep.unvan !== UNVAN.onayli) return tx("{u} · onay bekliyor", { u: unvanAd(UNVAN.talep.unvan) });
  return gecerliUnvan() ? unvanAd(gecerliUnvan()) : p && unvanBul(p) ? tx("{u} · onay bekliyor", { u: unvanAd(p) }) : tx("Belirlenmedi");
}
async function unvanLevhasi() {
  if (!H.kullanici) { location.hash = "#giris"; return; }
  await unvanYukle();
  const secili = (UNVAN.talep && UNVAN.talep.unvan) || profilAl().unvan || "";
  levhaAc(`<h3>${tx("Ünvan")}</h3>
    <p class="aciklama">${tx("Ünvanınız yorumlarda adınızın yanında görünür. Akademik ünvanlar kurum sayfanız ya da kurumsal e-postanızla doğrulandıktan sonra görünür; kazı duyurusunu Prof. Dr., Doç. Dr., Dr. Öğr. Üyesi ve Dr. ünvanlı üyeler gönderebilir.")}</p>
    <div class="kutu unvan-liste">
      <label class="satir"><span>${tx("Ünvan göstermeyin")}</span><input type="radio" name="unvan" value="" ${secili ? "" : "checked"}></label>
      ${UNVANLAR.map(u => `<label class="satir"><span>${esc(unvanAd(u.id))}${u.akademik && UNVAN.onayli === u.id ? ` <small>✓ ${tx("doğrulandı")}</small>` : u.akademik ? ` <small>${tx("doğrulama gerekir")}</small>` : ""}</span>
        <input type="radio" name="unvan" value="${u.id}" ${secili === u.id ? "checked" : ""}></label>`).join("")}
    </div>
    <div id="unvan-kanit" hidden>
      <label class="kazi-form">${tx("Kurum")}<input id="unvan-kurum" maxlength="120" placeholder="${tx("Ör. Ankara Üniversitesi DTCF Arkeoloji Bölümü")}" value="${esc((UNVAN.talep || {}).kurum || "")}"></label>
      <label class="kazi-form">${tx("Doğrulama için bağlantı ya da kurumsal e-posta")}<input id="unvan-kanit-girdi" maxlength="300" placeholder="${tx("Ör. akademik.ankara.edu.tr/… ya da ad@ankara.edu.tr")}" value="${esc((UNVAN.talep || {}).kanit || "")}"></label>
    </div>
    <p style="margin:14px 0 0"><button class="buyuk-dugme" id="unvan-kaydet">${tx("Kaydet")}</button></p>`, lv => {
    const kanit = lv.querySelector("#unvan-kanit");
    const guncelle = () => { const u = unvanBul(lv.querySelector("input[name=unvan]:checked").value); kanit.hidden = !(u && u.akademik && UNVAN.onayli !== u.id); };
    lv.querySelectorAll("input[name=unvan]").forEach(r => r.onchange = guncelle); guncelle();
    lv.querySelector("#unvan-kaydet").onclick = async () => {
      const id = lv.querySelector("input[name=unvan]:checked").value, u = unvanBul(id), { fs } = H.fb;
      try {
        if (u && u.akademik && UNVAN.onayli !== id) {
          const kurum = lv.querySelector("#unvan-kurum").value.trim().slice(0, 120), kanitM = lv.querySelector("#unvan-kanit-girdi").value.trim().slice(0, 300);
          if (kurum.length < 2) { bildir(tx("Kurumunuzu yazın")); return; }
          await fs.setDoc(fs.doc(H.db, "unvan_talepleri", H.kullanici.uid), { unvan: id, kurum, kanit: kanitM, ad: gorunenAd().slice(0, 40), tarih: fs.serverTimestamp() });
          await unvanYukle(true);
          levhaKapat(); bildir(tx("Talebiniz alındı. Doğrulandıktan sonra ünvanınız adınızın yanında görünür.")); rota(true); return;
        }
        if (UNVAN.talep) { await fs.deleteDoc(fs.doc(H.db, "unvan_talepleri", H.kullanici.uid)).catch(() => {}); }
        await profilKaydet({ unvan: id });
        await unvanYukle(true);
        levhaKapat(); bildir(tx("Ünvan kaydedildi")); rota(true);
      } catch (e) { bildir(tx("Kaydedilemedi; internet bağlantınızı kontrol edin.")); }
    };
  });
}

/* ---------------------------------------------------------------- ziyaret sayacı: cihaz başına günde bir (kişisel veri yok) */
async function ziyaretSay() {
  try {
    const g = typeof oyunGunu === "function" ? oyunGunu() : new Date().toISOString().slice(0, 10);
    if (D.ziyaretGun === g || H.yok) return;
    const { fs } = await firebaseYukle();
    const ref = fs.doc(H.db, "ziyaret", g), kur = typeof kurulu === "function" && kurulu() ? 1 : 0;
    await fs.runTransaction(H.db, async t => {
      const s = await t.get(ref).catch(() => null);
      if (s && s.exists()) t.update(ref, { n: (s.data().n || 0) + 1, k: (s.data().k || 0) + kur });
      else t.set(ref, { n: 1, k: kur });
    });
    D.ziyaretGun = g; kaydet();
  } catch (e) { /* kurallar yayımlanmadıysa sessizce geç */ }
}
setTimeout(ziyaretSay, 4000);

/* ---------------------------------------------------------------- kaba dil süzgeci (basit; son karar yöneticide) */
const KUFUR = ["amk", "aq", "amq", "orospu", "oruspu", "piç", "pic", "sik", "sikik", "siktir", "sikeyim", "yarrak", "yarak", "göt", "got", "götveren",
  "ibne", "pezevenk", "şerefsiz", "serefsiz", "kahpe", "oç", "oc", "amcık", "amcik", "ananı", "anani", "gavat", "kaltak", "salak", "aptal", "gerizekalı", "gerizekali"];
function kufurVar(metin) {
  const sozcukler = metin.toLocaleLowerCase("tr").normalize("NFC").split(/[^\p{L}\p{N}]+/u);
  return sozcukler.some(s => KUFUR.includes(s));
}

/* ---------------------------------------------------------------- yorumlar */
const gizliKisiler = () => D.gizliKisiler || [];
function yorumTarih(t) {
  const d = t && t.toDate ? t.toDate() : new Date();
  return d.toLocaleDateString(DIL === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric" });
}
function yorumHtml(y) {
  const ben = H.kullanici && y.uid === H.kullanici.uid;
  const av = y.foto ? `<img class="avatar" src="${esc(y.foto)}" alt="" width="36" height="36">`
    : y.avatar ? `<img class="avatar" src="${avatarAdresi(y.avatar)}" alt="" width="36" height="36">`
    : `<span class="avatar avatar-bas" style="width:36px;height:36px;font-size:15px">${esc((y.ad || "?")[0].toLocaleUpperCase("tr"))}</span>`;
  return `<li class="yorum${y.gizli ? " gizli" : ""}" data-yorum="${esc(y.id)}">${av}
    <div class="yorum-ic"><p class="yorum-ust"><b>${unvanliAdHtml(y.ad || tx("Okur"), y.unvan)}</b>${y.uzman ? `<span class="uzman-rozet">${tx("Uzman")}</span>` : ""}<small>${esc(yorumTarih(y.tarih))}</small></p>
      <p class="yorum-metin">${esc(y.metin)}</p>
      <p class="yorum-eylem">${ben ? `<button data-y="sil">${tx("Sil")}</button>` : H.kullanici ? `<button data-y="sikayet">${tx("Bildir")}</button><button data-y="gizle">${tx("Bu kişiyi gizle")}</button>` : ""}</p></div></li>`;
}

async function yorumlariGetir(kayitId) {
  const { fs } = await firebaseYukle();
  const q = fs.query(fs.collection(H.db, "yorumlar"), fs.where("kayit", "==", kayitId), fs.where("gizli", "==", false));
  const anlik = await fs.getDocs(q);
  const liste = anlik.docs.map(d => ({ id: d.id, ...d.data() }));
  // yorum yazıldıktan sonra resmini ya da adını değiştirenler güncel haliyle görünsün
  const profiller = await Promise.all([...new Set(liste.map(y => y.uid))].map(uid =>
    fs.getDoc(fs.doc(H.db, "profiller", uid)).then(d => [uid, d.exists() ? d.data() : null]).catch(() => [uid, null])));
  const harita = new Map(profiller);
  for (const y of liste) {
    const p = harita.get(y.uid);
    if (p) { if (p.ad) y.ad = p.ad; y.avatar = p.avatar || ""; y.foto = p.foto || ""; y.unvan = p.unvan || ""; }
  }
  return liste
    .sort((a, b) => ((a.tarih && a.tarih.toMillis ? a.tarih.toMillis() : Date.now()) - (b.tarih && b.tarih.toMillis ? b.tarih.toMillis() : Date.now())));
}

/* Ayrıntı sayfasındaki makalenin altına yorum bölümünü ekler. */
async function yorumlarCiz(r) {
  const makale = document.querySelector("#sayfa article.ayrinti");
  if (!makale || H.yok) return;
  let bolum = document.getElementById("yorumlar");
  if (!bolum) {
    bolum = document.createElement("section"); bolum.id = "yorumlar"; bolum.className = "yorumlar";
    const kunye = makale.querySelector(":scope > .kunye");   // yorumlar APA künyesinin üstünde, eylemlerin hemen altında
    if (kunye) makale.insertBefore(bolum, kunye); else makale.appendChild(bolum);
  }
  bolum.innerHTML = `<h3>${tx("Yorumlar")}</h3><p class="aciklama">${tx("Yükleniyor…")}</p>`;
  let liste = [];
  try { liste = (await yorumlariGetir(r.i)).filter(y => !gizliKisiler().includes(y.uid)); }
  catch (e) { bolum.innerHTML = `<h3>${tx("Yorumlar")}</h3><p class="aciklama">${tx("Yorumlar şu an yüklenemedi.")}</p>`; return; }
  if (!document.body.contains(bolum)) return;
  const engelli = H.kullanici ? await engelliMi() : false;
  bolum.innerHTML = `<h3>${tx("Yorumlar")}${liste.length ? ` <small>${liste.length}</small>` : ""}</h3>
    ${liste.length ? `<ul class="yorum-liste">${liste.map(yorumHtml).join("")}</ul>` : `<p class="aciklama">${tx("Henüz yorum yok. İlk görüşü siz yazın.")}</p>`}
    ${!H.kullanici ? `<p><a class="ikincil-dugme" href="#giris">${tx("Yorum yazmak için giriş yapın")}</a></p>`
      : engelli ? `<p class="aciklama">${tx("Hesabınız yorum yazmaya kapatıldı. Yanlışlık olduğunu düşünüyorsanız harrixapp@gmail.com adresine yazın.")}</p>`
      : `<form class="yorum-form" id="yorum-form">
          <textarea id="yorum-metin" maxlength="${YORUM_SINIR}" rows="3" placeholder="${tx("Görüşünüzü paylaşın. Saygılı, konuya ilişkin ve kaynak gösteren yorumlar yayında kalır.")}"></textarea>
          <p class="yorum-form-alt"><small>${esc(gorunenAd() ? tx("{ad} olarak yazıyorsunuz", { ad: gorunenAd() }) : tx("Önce görünen adınızı belirleyin"))}</small>
          <button class="ikincil-dugme" type="submit">${tx("Gönder")}</button></p></form>`}`;
  bolum.querySelectorAll(".yorum [data-y]").forEach(b => b.onclick = () => yorumEylemi(b.dataset.y, b.closest(".yorum").dataset.yorum, liste, r));
  const form = bolum.querySelector("#yorum-form");
  if (form) form.onsubmit = async e => {
    e.preventDefault();
    const metin = form.querySelector("#yorum-metin").value.trim();
    if (!metin) return;
    if (!gorunenAd()) { adLevhasi(() => form.requestSubmit()); return; }
    if (kufurVar(metin)) { bildir(tx("Yorumunuzda uygun olmayan bir ifade var. Lütfen düzenleyin.")); return; }
    const dugme = form.querySelector("button"); dugme.disabled = true;
    try {
      const { fs } = H.fb;
      const uzman = (await fs.getDoc(fs.doc(H.db, "uzmanlar", H.kullanici.uid))).exists();
      await fs.addDoc(fs.collection(H.db, "yorumlar"), { kayit: r.i, uid: H.kullanici.uid, ad: gorunenAd(), avatar: profilAl().avatar || "",
        uzman, metin: metin.slice(0, YORUM_SINIR), tarih: fs.serverTimestamp(), gizli: false });
      bildir(tx("Yorumunuz yayımlandı"));
      if (typeof acikProfilYaz === "function") acikProfilYaz();
      yorumlarCiz(r);
    } catch (err) { dugme.disabled = false; bildir(tx("Yorum gönderilemedi. Biraz sonra yeniden deneyin.")); }
  };
}

async function engelliMi() {
  try { const { fs } = H.fb; return (await fs.getDoc(fs.doc(H.db, "engelliler", H.kullanici.uid))).exists(); }
  catch (e) { return false; }   // kurallar kendi kaydını okumaya izin vermiyorsa yazarken zaten reddedilir
}

async function yorumEylemi(tur, id, liste, r) {
  const y = liste.find(x => x.id === id); if (!y) return;
  const { fs } = H.fb;
  if (tur === "sil") {
    if (!confirm(tx("Yorumunuz silinsin mi?"))) return;
    await fs.deleteDoc(fs.doc(H.db, "yorumlar", id)); yorumlarCiz(r);
  } else if (tur === "gizle") {
    D.gizliKisiler = [...new Set([...gizliKisiler(), y.uid])]; kaydet(); bildir(tx("Bu kişinin yorumları sizin için gizlendi")); yorumlarCiz(r);
  } else if (tur === "sikayet") {
    levhaAc(`<h3>${tx("Yorumu bildir")}</h3><p class="aciklama">${tx("Hakaret, kişisel veri, spam ya da yanlış bilgi içeren yorumları bildirin; yönetici inceler.")}</p>
      <textarea id="sikayet-neden" maxlength="300" rows="3" style="width:100%" placeholder="${tx("Neden? (isteğe bağlı)")}"></textarea>
      <p style="margin:14px 0 0"><button class="buyuk-dugme" id="sikayet-gonder">${tx("Bildir")}</button></p>`, lv => {
      lv.querySelector("#sikayet-gonder").onclick = async () => {
        try {
          await fs.addDoc(fs.collection(H.db, "sikayetler"), { yorum: id, kayit: r.i, uid: H.kullanici.uid,
            neden: lv.querySelector("#sikayet-neden").value.trim().slice(0, 300), tarih: fs.serverTimestamp() });
          levhaKapat(); bildir(tx("Teşekkürler, yorum incelenecek"));
        } catch (e) { bildir(tx("Bildirilemedi. Biraz sonra yeniden deneyin.")); }
      };
    });
  }
}

/* ---------------------------------------------------------------- hata bildirimi, istek ve öneri */
const KAYIT_NEDENLERI = ["Arkeolojiyle ilgisi yok", "Aynı haber birden çok kez var", "Çeviri ya da başlık yanlış", "Bağlantı açılmıyor", "Tarih ya da tür yanlış"];
function geriBildirimLevhasi(tur, r) {
  const baslik = tur === "hata" ? tx("Hata bildir") : tur === "kayit" ? tx("Bu kaydı bildir") : tx("İstek ya da öneri");
  levhaAc(`<h3>${baslik}</h3>
    ${tur === "kayit" && r ? `<p class="aciklama"><b>${esc(baslikGoster(r))}</b></p>
      <div class="kutu">${KAYIT_NEDENLERI.map((n, i) => `<label class="satir"><span>${tx(n)}</span><input type="radio" name="gb-neden" value="${esc(n)}" ${i === 0 ? "checked" : ""}></label>`).join("")}</div>
      <p class="aciklama" style="margin-top:10px">${tx("İsterseniz kısaca açıklayın:")}</p>`
    : `<p class="aciklama">${tur === "hata" ? tx("Ne yapıyordunuz, ne oldu, ne bekliyordunuz? Ne kadar ayrıntı, o kadar hızlı çözüm.") : tx("Hangi kaynağı, hangi özelliği görmek istersiniz? Her öneriyi okuyoruz.")}</p>`}
    <textarea id="gb-metin" maxlength="3000" rows="${tur === "kayit" ? 3 : 6}" style="width:100%"></textarea>
    <input id="gb-eposta" type="email" maxlength="120" style="width:100%;margin-top:8px" placeholder="${tx("E-posta (isteğe bağlı, size dönmemiz için)")}" value="${esc((H.kullanici && H.kullanici.email) || "")}">
    <label class="onay-satir" style="margin-top:8px"><input type="checkbox" id="gb-cihaz" checked> ${tx("Sürüm ve cihaz bilgisini ekle")}</label>
    <p style="margin:14px 0 0"><button class="buyuk-dugme" id="gb-gonder">${tx("Gönder")}</button></p>`, lv => {
    lv.querySelector("#gb-gonder").onclick = async e => {
      let metin = lv.querySelector("#gb-metin").value.trim();
      if (tur === "kayit") {
        const neden = (lv.querySelector('input[name="gb-neden"]:checked') || {}).value || "";
        metin = `[${neden}] ${r ? r.b : ""}${metin ? "\n" + metin : ""}`;
      } else if (!metin) { bildir(tx("Lütfen birkaç cümle yazın")); return; }
      e.target.disabled = true;
      try {
        const { fs } = await firebaseYukle();
        const cihaz = lv.querySelector("#gb-cihaz").checked;
        await fs.addDoc(fs.collection(H.db, "geribildirim"), {
          tur, metin: metin.slice(0, 3000), eposta: lv.querySelector("#gb-eposta").value.trim().slice(0, 120),
          uid: H.kullanici ? H.kullanici.uid : null, surum: `web ${SURUM}`,
          cihaz: cihaz ? navigator.userAgent.slice(0, 200) : "", sayfa: tur === "kayit" && r ? `k/${r.i}`.slice(0, 120) : cihaz ? location.hash.slice(0, 120) : "",
          tarih: fs.serverTimestamp(), durum: "yeni" });
        levhaKapat(); bildir(tur === "kayit" ? tx("Teşekkürler! Kayıt incelenecek.") : tx("Teşekkürler! Bildiriminiz bize ulaştı."));
      } catch (err) { e.target.disabled = false; bildir(tx("Gönderilemedi. Biraz sonra yeniden deneyin ya da harrixapp@gmail.com adresine yazın.")); }
    };
  });
}

/* Üst çubuktaki bildir simgesi: ayrıntı sayfasındaysa o kaydı bildirme seçeneği de çıkar */
function bildirSecimi() {
  const m = /^#k\/(.+)$/.exec(location.hash), r = m ? DIZIN.get(decodeURIComponent(m[1])) : null;
  levhaAc(`<h3>${tx("Bildir")}</h3><div class="kutu">
    ${r ? `<button class="satir" data-b="kayit">${tx("Bu kaydı bildir (alakasız, yinelenen, hatalı)")}</button>` : ""}
    <button class="satir" data-b="hata">${tx("Uygulamada hata bildir")}</button>
    <button class="satir" data-b="istek">${tx("İstek ya da öneri")}</button></div>
    <p class="aciklama">${tx("Arkeolojiyle ilgisiz bir haber görürseniz kaydın altındaki “Bildir” bağlantısını kullanın; bülteni birlikte temizliyoruz.")}</p>`, lv => {
    lv.querySelectorAll("[data-b]").forEach(b => b.onclick = () => geriBildirimLevhasi(b.dataset.b, r));
  });
}

function toplulukGrubuHtml() {
  return `<div class="grup"><h3>${tx("Geri bildirim")}</h3><div class="kutu">
    <button class="satir" id="gb-hata">${tx("Hata bildir")}</button>
    <button class="satir" id="gb-istek">${tx("İstek ya da öneri")}</button>
    ${yoneticiMi() ? `<a class="satir" href="#yonetim"><b>${tx("Yönetim paneli")}</b></a>` : ""}
  </div><p class="aciklama">${tx("Arkix yeni; gördüğünüz her hata ve aklınıza gelen her fikir bize çok yardımcı olur.")}</p></div>`;
}
function toplulukGrubuBagla() {
  const h = document.getElementById("gb-hata"), i = document.getElementById("gb-istek");
  if (h) h.onclick = () => geriBildirimLevhasi("hata");
  if (i) i.onclick = () => geriBildirimLevhasi("istek");
}

/* ---------------------------------------------------------------- haftalık özet sorusu
 * Giriş yapmış ve kararı olmayan (profil.eposta_izni yok) kullanıcıya bir kez sorulur; cevap (evet ya da hayır)
 * tarihle kaydedilir. Girişsiz kullanıcı bir kez davet edilir (D.ozetDavet). Açılış ekranları bitince çalışır. */
let epostaSorusuAcik = false;
function ustKatmanVar() { return !!document.querySelector(".onay-kapi, .gunluk-kapi, .anlat-kapi") || !$("#levha").hidden; }
async function epostaSorusuKontrol() {
  if (epostaSorusuAcik || H.yok) return;
  await (window.acilisBitti || Promise.resolve());
  for (let i = 0; i < 30 && !H.hazir; i++) await new Promise(r => setTimeout(r, 200));
  if (ustKatmanVar() || epostaSorusuAcik) return;
  if (H.kullanici) {
    if (profilAl().eposta_izni !== undefined) {
      // özete izin vermiş ama konu seçmemiş: bir kez konularını sor
      if (profilAl().eposta_izni.izin && !D.konuSoruldu && typeof konuSecici === "function" && !konuSayisi()) konuSecici();
      return;
    }
    epostaSorusuAcik = true;
    levhaAc(`<div class="eposta-soru"><div class="eposta-soru-ikon">✉️</div><h3>${tx("Haftalık özet e-postana gelsin mi?")}</h3>
      <p class="aciklama">${tx("Her pazartesi sabahı takip ettiklerinden yeni kayıtlar, haftanın öne çıkanları ve Arkix Özel yazıları {eposta} adresine gelir. İstediğin an ayrılabilirsin.", { eposta: esc(H.kullanici.email || "") })}</p>
      <p style="margin:14px 0 0"><button class="buyuk-dugme" id="es-evet">${tx("Evet, gönder")}</button></p>
      <p style="text-align:center;margin:8px 0 0"><button class="ikincil-dugme" id="es-hayir">${tx("Hayır, teşekkürler")}</button></p></div>`, lv => {
      const karar = async izin => {
        epostaSorusuAcik = false; levhaKapat();
        try {
          await profilKaydet({ eposta_izni: { izin, tarih: new Date().toISOString(), eposta: H.kullanici.email || "", metin: EPOSTA_IZIN_METNI } });
          bildir(izin ? tx("Yenilikler e-postanıza gelecek") : tx("Tamam; Ayarlar › Hesap'tan istediğin an açabilirsin."));
          if (izin && typeof konuSecici === "function") setTimeout(() => konuSecici(), 600);
        } catch (e) { bildir(tx("Kaydedilemedi; internet bağlantınızı kontrol edin.")); }
      };
      lv.querySelector("#es-evet").onclick = () => karar(true);
      lv.querySelector("#es-hayir").onclick = () => karar(false);
    });
  } else if (!D.ozetDavet) {
    D.ozetDavet = true; kaydet();
    epostaSorusuAcik = true;
    levhaAc(`<div class="eposta-soru"><div class="eposta-soru-ikon">✉️</div><h3>${tx("Haftalık özet ister misin?")}</h3>
      <p class="aciklama">${tx("Ücretsiz bir hesap açarsan her pazartesi takip ettiklerinden yeni kayıtlar ve haftanın öne çıkanları e-postana gelir; favorilerin ve notların da her cihazda olur.")}</p>
      <p style="margin:14px 0 0"><a class="buyuk-dugme" href="#giris" id="es-giris">${tx("Giriş yap ve aç")}</a></p>
      <p style="text-align:center;margin:8px 0 0"><button class="ikincil-dugme" id="es-sonra">${tx("Şimdi değil")}</button></p></div>`, lv => {
      lv.querySelector("#es-giris").onclick = () => { epostaSorusuAcik = false; levhaKapat(); };
      lv.querySelector("#es-sonra").onclick = () => { epostaSorusuAcik = false; levhaKapat(); };
    });
  }
}

/* ---------------------------------------------------------------- e-posta özetinden ayrılma (#ayril/<uid>/<imza>) */
async function sayfaAyril(arg) {
  const [uid, token] = (arg || "").split("/");
  $("#sayfa").innerHTML = bosHtml(tx("E-posta özetinden ayrılıyorsunuz…"), "");
  try {
    if (!uid || !/^[a-f0-9]{64}$/.test(token || "")) throw new Error("bağlantı");
    const { fs } = await firebaseYukle();
    await fs.setDoc(fs.doc(H.db, "abonelik_iptal", uid), { token, tarih: fs.serverTimestamp() });
    if (H.kullanici && H.kullanici.uid === uid) await profilKaydet({ eposta_izni: { ...(profilAl().eposta_izni || {}), izin: false, tarih: new Date().toISOString() } });
    $("#sayfa").innerHTML = bosHtml(tx("Ayrıldınız"), tx("Artık Arkix özet e-postası almayacaksınız. İsterseniz Ayarlar › Hesap'tan yeniden açabilirsiniz."),
      `<a class="ikincil-dugme" href="#bugun">${tx("Bültene dön")}</a>`);
  } catch (e) {
    $("#sayfa").innerHTML = bosHtml(tx("Ayrılma tamamlanamadı"), tx("Bağlantı geçersiz olabilir. harrixapp@gmail.com adresine “ayrıl” yazmanız da yeterli."));
  }
}

/* ---------------------------------------------------------------- yönetim paneli (#yonetim) */
const YON = { sekme: "istatistik", ara: "" };

/* Yönetim › İstatistik: Firestore sayımları (getCountFromServer) + günlük açan cihaz (ziyaret/{gun}) */
async function istatistikHtml(kutu) {
  const { fs } = H.fb, k = ad => fs.collection(H.db, ad);
  const say = q => fs.getCountFromServer(q).then(s => s.data().count).catch(() => "—");
  const g = oyunGunu(), h = oyunHaftasi(), hafta = fs.Timestamp.fromMillis(Date.now() - 7 * 864e5);
  const [uye, kullanici, yorum, yorumHafta, geri, sikayet, duyuru, unvanT, ziyaret, ...oyun] = await Promise.all([
    say(k("profiller")),
    fs.getDoc(fs.doc(H.db, "yonetim", "kullanicilar")).then(d => d.exists() ? d.data().sayi : "—").catch(() => "—"),
    say(k("yorumlar")), say(fs.query(k("yorumlar"), fs.where("tarih", ">", hafta))),
    say(fs.query(k("geribildirim"), fs.where("durum", "==", "yeni"))), say(k("sikayetler")),
    say(fs.query(k("kazi_duyurulari"), fs.where("durum", "==", "bekliyor"))), say(k("unvan_talepleri")),
    fs.getDocs(fs.query(k("ziyaret"), fs.orderBy(fs.documentId(), "desc"), fs.limit(30))).then(a => a.docs.map(d => ({ gun: d.id, ...d.data() }))).catch(() => []),
    ...["kelime", "kazi", "sirala", "meydan"].flatMap(o => [say(fs.query(k("skorlar"), fs.where("oyun_gun", "==", `${o}_${g}`))), say(fs.query(k("skorlar"), fs.where("oyun_hafta", "==", `${o}_${h}`)))]),
  ]);
  const bugun = ziyaret.find(z => z.gun === g) || { n: 0, k: 0 };
  const top = n => ziyaret.slice(0, n).reduce((a, z) => a + (z.n || 0), 0);
  const enCok = Math.max(1, ...ziyaret.map(z => z.n || 0));
  const kart = (deger, ad, git) => `<${git ? `a href="${git}"` : "div"} class="ist-kart"><b>${esc(String(deger))}</b><small>${ad}</small></${git ? "a" : "div"}>`;
  kutu.innerHTML = `<div class="ist-izgara">
      ${kart(bugun.n || 0, tx("Bugün açan cihaz"))}${kart(top(7), tx("Son 7 gün (cihaz-gün)"))}${kart(bugun.k || 0, tx("Bugün uygulamadan açan"))}
      ${kart(kullanici, tx("Kayıtlı hesap"))}${kart(uye, tx("Profili olan üye"))}${kart((VERI.kayitlar || []).length, tx("Bültendeki kayıt"))}
      ${kart(yorum, tx("Yorum (toplam)"))}${kart(yorumHafta, tx("Yorum (7 gün)"))}${kart(geri, tx("Yeni geri bildirim"))}
      ${kart(sikayet, tx("Şikâyet"))}${kart(duyuru, tx("Bekleyen duyuru"))}${kart(unvanT, tx("Ünvan talebi"))}
    </div>
    <h3 class="ist-baslik">${tx("Oyunlar · oynayan kişi")}</h3>
    <div class="ist-izgara">${["Kelime Kazısı", "Kazı Başı", "Katman Sırala", "Günün Açması"].map((ad, i) => kart(`${oyun[i * 2]} / ${oyun[i * 2 + 1]}`, `${tx(ad)} · ${tx("bugün / hafta")}`)).join("")}</div>
    <h3 class="ist-baslik">${tx("Son 30 gün · açan cihaz")}</h3>
    ${ziyaret.length ? `<ul class="ist-cubuklar">${ziyaret.map(z => `<li><span>${esc(z.gun.slice(5))}</span><i style="width:${Math.round((z.n || 0) / enCok * 100)}%"></i><b>${z.n || 0}${z.k ? ` <small>(${z.k} ${tx("uygulama")})</small>` : ""}</b></li>`).join("")}</ul>`
      : `<p class="aciklama">${tx("Henüz ziyaret kaydı yok (sayaç 1.21 ile başladı).")}</p>`}
    <p class="aciklama">${tx("Misafirler hesapsız olduğu için kişi kişi listelenmez; yalnız günlük açan cihaz sayılır. Okuma/yazma kotası Firebase konsolundadır.")}</p>`;
}

/* Yönetim › Kullanıcılar: yonetim/kullanicilar (saatte bir toplayici/kullanici_listesi.py yazar) */
async function kullanicilarHtml(kutu) {
  const { fs } = H.fb;
  const d = await fs.getDoc(fs.doc(H.db, "yonetim", "kullanicilar"));
  if (!d.exists()) { kutu.innerHTML = bosHtml(tx("Liste henüz hazır değil"), tx("Sunucu listeyi saatte bir günceller (GitHub › Yönetici ve telefon bildirimleri).")); return; }
  const v = d.data(), tum = v.liste || [];
  const tarih = s => s ? new Date(s).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—";
  const ciz = () => {
    const a = katla(YON.ara);
    const l = a ? tum.filter(x => katla(`${x.ad} ${x.eposta} ${unvanAd(x.unvan)}`).includes(a)) : tum;
    kutu.querySelector("#kul-liste").innerHTML = l.slice(0, 300).map(x => `<li class="yon-kart${x.kapali ? " durum-gizli" : ""}" data-uid="${esc(x.uid)}" data-ad="${esc(x.ad || "")}">
      <p class="yon-ust"><b>${unvanliAdHtml(x.ad || tx("(adsız)"), x.unvan)}</b><span class="etiket">${esc(x.giris || "—")}</span>${x.dogrulandi ? "" : `<span class="etiket">${tx("doğrulanmamış")}</span>`}</p>
      <p><a href="mailto:${esc(x.eposta)}">${esc(x.eposta)}</a></p>
      <p><small>${tx("Kayıt")}: ${esc(tarih(x.kayit))} · ${tx("Son giriş")}: ${esc(tarih(x.son))}</small></p>
      <p class="yon-eylem"><button data-u="unvan">${tx("Ünvan ver")}</button><button data-u="uzman">${tx("Uzman yap")}</button><button data-u="engelle">${tx("Yorumdan men et")}</button></p></li>`).join("")
      + (l.length > 300 ? `<li class="aciklama">${tx("İlk 300 gösteriliyor; aramayla daraltın.")}</li>` : "");
    kutu.querySelectorAll("[data-u]").forEach(b => b.onclick = async () => {
      const li = b.closest("[data-uid]"), uid = li.dataset.uid, ad = li.dataset.ad;
      if (b.dataset.u === "unvan") return unvanVerLevhasi(uid, ad, () => sayfaYonetim());
      if (b.dataset.u === "uzman") { await fs.setDoc(fs.doc(H.db, "uzmanlar", uid), { ad, tarih: fs.serverTimestamp() }); bildir(tx("Uzman rozeti verildi (yeni yorumlarda görünür)")); }
      if (b.dataset.u === "engelle") { if (!confirm(tx("Bu kullanıcı yorum yazamayacak. Emin misiniz?"))) return; await fs.setDoc(fs.doc(H.db, "engelliler", uid), { ad, tarih: fs.serverTimestamp() }); bildir(tx("Kullanıcı engellendi")); }
    });
  };
  kutu.innerHTML = `<p class="aciklama" style="margin:12px 16px 0">${tx("{n} hesap", { n: v.sayi || tum.length })} · ${tx("Güncelleme")}: ${esc(tarih(v.guncelleme))}</p>
    <div class="arama-kutu" style="margin:10px 16px"><input id="kul-ara" placeholder="${tx("Ad, e-posta ya da ünvan ara")}" value="${esc(YON.ara)}"></div>
    <ul class="yon-liste" id="kul-liste"></ul>`;
  kutu.querySelector("#kul-ara").oninput = e => { YON.ara = e.target.value; ciz(); };
  ciz();
}

/* Ünvanı onaylar ya da kaldırır: unvanlar/{uid} + profiller/{uid}.unvan (kurallar yöneticiye yalnız bu alanı açar) */
async function unvanOnayla(uid, unvan, ek = {}) {
  const { fs } = H.fb;
  if (unvan) await fs.setDoc(fs.doc(H.db, "unvanlar", uid), { unvan, tarih: new Date().toISOString(), ...ek });
  else await fs.deleteDoc(fs.doc(H.db, "unvanlar", uid));
  await fs.updateDoc(fs.doc(H.db, "profiller", uid), { unvan: unvan || "" }).catch(() => {});
  await fs.deleteDoc(fs.doc(H.db, "unvan_talepleri", uid)).catch(() => {});
}
function unvanVerLevhasi(uid, ad, sonra) {
  levhaAc(`<h3>${tx("Ünvan ver")}</h3><p class="aciklama">${esc(ad)}</p>
    <div class="kutu">${UNVANLAR.filter(u => u.akademik).map(u => `<button class="satir" data-v="${u.id}">${esc(unvanAd(u.id))}</button>`).join("")}
      <button class="satir" data-v="" style="color:var(--rapor)">${tx("Akademik ünvanı kaldır")}</button></div>`, lv => {
    lv.querySelectorAll("[data-v]").forEach(b => b.onclick = async () => {
      try { await unvanOnayla(uid, b.dataset.v, { ad }); levhaKapat(); bildir(b.dataset.v ? tx("Ünvan onaylandı") : tx("Ünvan kaldırıldı")); if (sonra) sonra(); }
      catch (e) { bildir(tx("Kaydedilemedi") + " " + (e.code || "")); }
    });
  });
}
/* Yönetim › Ünvan: bekleyen doğrulama talepleri */
async function unvanTalepHtml(kutu) {
  const { fs } = H.fb;
  const l = (await fs.getDocs(fs.query(fs.collection(H.db, "unvan_talepleri"), fs.limit(200)))).docs.map(d => ({ uid: d.id, ...d.data() }));
  const baglanti = s => /^https?:\/\//i.test(s) ? `<a href="${escUrl(s)}" target="_blank" rel="noopener">${esc(s)}</a>` : /@/.test(s) ? `<a href="mailto:${esc(s)}">${esc(s)}</a>` : esc(s);
  kutu.innerHTML = l.length ? `<ul class="yon-liste">${l.map(t => `<li class="yon-kart durum-yeni" data-uid="${esc(t.uid)}" data-unvan="${esc(t.unvan)}" data-ad="${esc(t.ad || "")}">
      <p class="yon-ust"><b>${esc(t.ad || "")}</b><span class="etiket">${esc(unvanAd(t.unvan))}</span></p>
      <p>${esc(t.kurum || "")}</p>${t.kanit ? `<p><small>${baglanti(t.kanit)}</small></p>` : ""}
      <p class="yon-eylem"><button data-t="onay">${tx("Onayla")}</button><button data-t="red">${tx("Reddet")}</button></p></li>`).join("")}</ul>`
    : bosHtml(tx("Bekleyen ünvan talebi yok"), tx("Kullanıcılar sekmesinden de doğrudan ünvan verebilirsiniz."));
  kutu.querySelectorAll("[data-t]").forEach(b => b.onclick = async () => {
    const li = b.closest("[data-uid]");
    try {
      if (b.dataset.t === "onay") { await unvanOnayla(li.dataset.uid, li.dataset.unvan, { ad: li.dataset.ad }); bildir(tx("Ünvan onaylandı")); }
      else { await fs.deleteDoc(fs.doc(H.db, "unvan_talepleri", li.dataset.uid)); bildir(tx("Talep reddedildi")); }
    } catch (e) { bildir(tx("Kaydedilemedi") + " " + (e.code || "")); }
    sayfaYonetim();
  });
}
async function sayfaYonetim() {
  if (!yoneticiMi()) { $("#sayfa").innerHTML = bosHtml(tx("Yetkiniz yok"), tx("Bu sayfa yalnız yönetici hesabıyla açılır.")); return; }
  const { fs } = H.fb;
  const sekmeler = [["istatistik", tx("İstatistik")], ["kullanicilar", tx("Kullanıcılar")], ["unvan", tx("Ünvan")], ["geri", tx("Geri bildirim")], ["kazi", tx("Kazı duyuruları")], ["sikayet", tx("Şikâyetler")], ["yorum", tx("Son yorumlar")]];
  $("#sayfa").innerHTML = `<div class="bolumlu yon-sekmeler" role="group">${sekmeler.map(([k, ad]) => `<button data-ys="${k}" aria-pressed="${YON.sekme === k}">${ad}</button>`).join("")}</div>
    <div id="yon-icerik"><p class="aciklama" style="margin:16px">${tx("Yükleniyor…")}</p></div>`;
  $("#sayfa").querySelectorAll("[data-ys]").forEach(b => b.onclick = () => { YON.sekme = b.dataset.ys; sayfaYonetim(); });
  const kutu = $("#yon-icerik");
  const tarihSaat = t => (t && t.toDate ? t.toDate() : new Date()).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  try {
    if (YON.sekme === "kazi") { await kaziYonetimHtml(kutu); return; }
    if (YON.sekme === "istatistik") { await istatistikHtml(kutu); return; }
    if (YON.sekme === "kullanicilar") { await kullanicilarHtml(kutu); return; }
    if (YON.sekme === "unvan") { await unvanTalepHtml(kutu); return; }
    if (YON.sekme === "geri") {
      const a = await fs.getDocs(fs.query(fs.collection(H.db, "geribildirim"), fs.orderBy("tarih", "desc"), fs.limit(200)));
      const l = a.docs.map(d => ({ id: d.id, ...d.data() }));
      kutu.innerHTML = l.length ? `<ul class="yon-liste">${l.map(g => `<li class="yon-kart durum-${esc(g.durum)}" data-id="${g.id}">
        <p class="yon-ust"><span class="etiket">${g.tur === "hata" ? tx("Hata") : g.tur === "istek" ? tx("İstek") : g.tur === "kayit" ? tx("Kayıt") : tx("Diğer")}</span><span class="etiket">${esc(g.durum)}</span><small>${esc(tarihSaat(g.tarih))} · ${esc(g.surum || "")}</small></p>
        <p class="yon-metin">${esc(g.metin)}</p>
        ${g.eposta ? `<p><a href="mailto:${esc(g.eposta)}?subject=${encodeURIComponent("Arkix geri bildiriminiz")}">${esc(g.eposta)}</a></p>` : ""}
        ${g.cihaz ? `<p><small>${esc(g.cihaz)} ${esc(g.sayfa || "")}</small></p>` : ""}
        ${/^k\//.test(g.sayfa || "") ? `<p><a href="#${esc(g.sayfa)}">${tx("Kaydı aç")}</a></p>` : ""}
        <p class="yon-eylem">${/^k\//.test(g.sayfa || "") ? `<button data-g="kaldir" data-kayit="${esc(g.sayfa.slice(2))}">${tx("Kaydı bültenden kaldır")}</button>` : ""}<button data-g="inceleniyor">${tx("İnceleniyor")}</button><button data-g="cozuldu">${tx("Çözüldü")}</button><button data-g="sil">${tx("Sil")}</button></p></li>`).join("")}</ul>`
        : bosHtml(tx("Bildirim yok"), "");
      kutu.querySelectorAll("[data-g]").forEach(b => b.onclick = async () => {
        const id = b.closest("[data-id]").dataset.id, ref = fs.doc(H.db, "geribildirim", id);
        if (b.dataset.g === "sil") { if (!confirm(tx("Silinsin mi?"))) return; await fs.deleteDoc(ref); }
        else if (b.dataset.g === "kaldir") {
          if (!confirm(tx("Bu kayıt bir sonraki toplamada bültenden kalkacak ve bir daha alınmayacak. Emin misiniz?"))) return;
          const kayit = b.dataset.kayit;
          await fs.setDoc(fs.doc(H.db, "gizli_kayitlar", encodeURIComponent(kayit).replace(/\./g, "%2E")), { kayit, tarih: fs.serverTimestamp() });
          await fs.updateDoc(ref, { durum: "cozuldu" });
          bildir(tx("Kayıt kaldırılacak (en geç 6 saat içinde)"));
        }
        else await fs.updateDoc(ref, { durum: b.dataset.g });
        sayfaYonetim();
      });
    } else {
      const sikayetler = YON.sekme === "sikayet"
        ? (await fs.getDocs(fs.query(fs.collection(H.db, "sikayetler"), fs.orderBy("tarih", "desc"), fs.limit(200)))).docs.map(d => ({ id: d.id, ...d.data() })) : [];
      let yorumlar;
      if (YON.sekme === "sikayet") {
        const idler = [...new Set(sikayetler.map(s => s.yorum))];
        yorumlar = (await Promise.all(idler.map(id => fs.getDoc(fs.doc(H.db, "yorumlar", id))))).filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() }));
      } else {
        yorumlar = (await fs.getDocs(fs.query(fs.collection(H.db, "yorumlar"), fs.orderBy("tarih", "desc"), fs.limit(150)))).docs.map(d => ({ id: d.id, ...d.data() }));
      }
      kutu.innerHTML = yorumlar.length ? `<ul class="yon-liste">${yorumlar.map(y => {
        const sk = sikayetler.filter(s => s.yorum === y.id), kayit = DIZIN.get(y.kayit);
        return `<li class="yon-kart${y.gizli ? " durum-gizli" : ""}" data-id="${y.id}" data-uid="${esc(y.uid)}" data-ad="${esc(y.ad || "")}">
          <p class="yon-ust"><b>${esc(y.ad || "")}</b>${y.uzman ? `<span class="uzman-rozet">${tx("Uzman")}</span>` : ""}${y.gizli ? `<span class="etiket">${tx("gizli")}</span>` : ""}<small>${esc(tarihSaat(y.tarih))}</small></p>
          <p class="yon-metin">${esc(y.metin)}</p>
          <p><small><a href="#k/${encodeURIComponent(y.kayit)}">${esc(kayit ? baslikGoster(kayit) : y.kayit)}</a></small></p>
          ${sk.length ? `<p class="aciklama">${tx("{n} şikâyet", { n: sk.length })}: ${sk.map(s => esc(s.neden || "—")).join(" · ")}</p>` : ""}
          <p class="yon-eylem"><button data-a="${y.gizli ? "goster" : "gizle"}">${y.gizli ? tx("Göster") : tx("Gizle")}</button><button data-a="sil">${tx("Sil")}</button>
            <button data-a="engelle">${tx("Kullanıcıyı engelle")}</button><button data-a="uzman">${tx("Uzman yap")}</button>
            ${sk.length ? `<button data-a="kapat">${tx("Şikâyeti kapat")}</button>` : ""}</p></li>`; }).join("")}</ul>`
        : bosHtml(YON.sekme === "sikayet" ? tx("Şikâyet yok") : tx("Yorum yok"), "");
      kutu.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => {
        const li = b.closest("[data-id]"), id = li.dataset.id, uid = li.dataset.uid, ref = fs.doc(H.db, "yorumlar", id);
        const a = b.dataset.a;
        if (a === "gizle" || a === "goster") await fs.updateDoc(ref, { gizli: a === "gizle" });
        else if (a === "sil") { if (!confirm(tx("Yorum kalıcı olarak silinsin mi?"))) return; await fs.deleteDoc(ref); }
        else if (a === "engelle") { if (!confirm(tx("Bu kullanıcı yorum yazamayacak. Emin misiniz?"))) return; await fs.setDoc(fs.doc(H.db, "engelliler", uid), { ad: li.dataset.ad, tarih: fs.serverTimestamp() }); bildir(tx("Kullanıcı engellendi")); }
        else if (a === "uzman") { await fs.setDoc(fs.doc(H.db, "uzmanlar", uid), { ad: li.dataset.ad, tarih: fs.serverTimestamp() }); bildir(tx("Uzman rozeti verildi (yeni yorumlarda görünür)")); }
        if (a === "kapat" || a === "sil") await Promise.all(sikayetler.filter(s => s.yorum === id).map(s => fs.deleteDoc(fs.doc(H.db, "sikayetler", s.id))));
        sayfaYonetim();
      });
    }
  } catch (e) {
    kutu.innerHTML = bosHtml(tx("Yüklenemedi"), tx("Firestore kuralları yayımlandı mı? (mobil/firestore.rules)") + " " + (e.code || e.message || ""));
  }
}
