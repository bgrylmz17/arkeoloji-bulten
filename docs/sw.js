/* Arkix — servis çalışanı
 * Uygulama dosyaları önbellekten (internetsiz açılır), bülten verisi önce ağdan, olmazsa önbellekten.
 * Android'de kurulu uygulama için arka planda yoklayıp yeni kayıt varsa bildirim gösterir. */
const SURUM = "bulten-1.34.0";
const KABUK = ["./", "index.html", "stil.css", "dil.js", "dil-en.js", "uygulama.js", "hesap.js", "firebase-ayar.js", "reklam.js", "desen.js", "gunluk.js", "gunluk/gunluk.json", "topluluk.js", "takip.js", "arastirmaci.js", "temalar.js", "tanitim.js", "menu.js", "kazi.js", "bildirimler.js", "oyunlar.js", "kazi-oyun.js", "sirala.js", "nasil.js", "avatar/avatarlar.json", "manifest.webmanifest",
  "ikon/logo.svg", "ikon/ikon-192.png", "ikon/ikon-512.png", "ikon/apple-touch-icon.png", "ikon/favicon-64.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(KABUK.map(d => new Request(d, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(adlar => Promise.all(adlar.filter(a => a !== SURUM && a !== "bulten-veri").map(a => caches.delete(a))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.endsWith(".mp3")) return;   // ses doğrudan ağdan: iOS Safari parça (Range) isteği ister
  if (u.pathname.includes("/veri/")) {
    // ağ önce; başarılıysa önbelleğe yaz
    e.respondWith(fetch(e.request).then(y => {
      const kopya = y.clone();
      caches.open("bulten-veri").then(c => c.put(u.pathname, kopya));
      return y;
    }).catch(() => caches.open("bulten-veri").then(c => c.match(u.pathname)).then(y => y || Response.error())));
    return;
  }
  // uygulama kabuğu: önbellek önce, arkada tazele
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(onb => {
    const ag = fetch(e.request, { cache: "no-cache" }).then(y => {
      if (y.ok) { const k = y.clone(); caches.open(SURUM).then(c => c.put(e.request, k)); }
      return y;
    }).catch(() => onb);
    return onb || ag;
  }));
});

/* --- arka planda yoklama (Android Chrome, kurulu uygulama) */
async function esikOku() {
  const c = await caches.open("bulten-veri");
  const y = await c.match("__esik");
  return y ? y.text() : "";
}
async function esikYaz(d) {
  const c = await caches.open("bulten-veri");
  await c.put("__esik", new Response(d || ""));
}

self.addEventListener("message", e => {
  if (e.data && e.data.tur === "esik") e.waitUntil(esikYaz(e.data.deger));
});

async function yokla() {
  const y = await fetch("veri/bulten.json", { cache: "no-cache" });
  if (!y.ok) return;
  const kopya = y.clone();
  const v = await y.json();
  const c = await caches.open("bulten-veri");
  await c.put(new URL("veri/bulten.json", self.registration.scope).pathname, kopya);
  const esik = await esikOku();
  if (!esik) { await esikYaz(v.guncelleme); return; }
  if (v.guncelleme <= esik) return;
  const yeniler = v.kayitlar.filter(r => (r.g || "") > esik);
  await esikYaz(v.guncelleme);
  if (!yeniler.length) return;
  if (self.navigator.setAppBadge) self.navigator.setAppBadge(yeniler.length).catch(() => {});
  const ilk = yeniler[0];
  await self.registration.showNotification(
    `${yeniler.length} yeni arkeoloji kaydı`,
    { body: (ilk.bt || ilk.b), icon: "ikon/ikon-192.png", badge: "ikon/favicon-64.png", tag: "bulten",
      data: { url: `./#k/${encodeURIComponent(ilk.i)}` } });
}

/* Telefona bildirim (FCM web push; gönderen: toplayici/bildirim_gonder.py). Yük: { data: { baslik, metin, url, tag } } */
self.addEventListener("push", e => {
  let v = {};
  try { v = e.data ? e.data.json() : {}; } catch (h) { v = {}; }
  const d = v.data || v;
  e.waitUntil(self.registration.showNotification(d.baslik || "Arkix", { body: d.metin || "", icon: "ikon/ikon-192.png", badge: "ikon/favicon-64.png",
    tag: d.tag || "arkix", data: { url: d.url || "./#ozet" } }));
});

self.addEventListener("periodicsync", e => { if (e.tag === "bulten-yokla") e.waitUntil(yokla()); });

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const hedef = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(pencereler => {
    for (const p of pencereler) { p.navigate(hedef); return p.focus(); }
    return self.clients.openWindow(hedef);
  }));
});
