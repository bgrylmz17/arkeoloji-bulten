/* Arkix — Kazı Başı: Kazı Sezonu, Kayıp Eser ve kariyer (kazi-oyun.js'in üstüne kurulu; ondan sonra yüklenir).
 *
 * Kazı Sezonu (#oyun/kazi/sezon): keşfedilmiş bir alanda 8–12 günlük sezon. Bütçe, ekip morali ve itibar yönetilir.
 *   Açma günler boyunca korunur (D.kzSezon.acma). Her gün: sabah ara sahnesi → olay kartı (seçim) → günün işi:
 *   kaz (kazi-oyun.js › kzBasla(alan, false, sz)), yüzey araştırması (yeni alan keşfi), laboratuvar (tarihlendirme),
 *   mimari restorasyon (alanın yapısını alttan üste kurma), dinlenme. Her gün Kazı Defteri'ne yazılır; oyuncu not ekler.
 *   Gerçek gün başına SZ_GUNLUK sezon günü (mobil oyun döngüsü). Sezon sonunda puan günlük Kazı Başı skoruna eklenir.
 * Kayıp Eser (#oyun/kazi/hazine): günlük macera. Defineciler eski bir kazı defterinin sayfasını çalmış: ipuçlarıyla
 *   (siluet, dönem, il) alanı bul, sıcak-soğuk ile eseri onlardan önce çıkar, müzeye teslim et. Herkese aynı (tohumlu).
 * Kariyer (D.kzKariyer): itibar → unvan; sezon süresi ve bütçe unvanla artar. Keşfedilen alanlar kesif'te.
 * Metinler: arayüz szM("tr", "en"), veri { tr, en } (szL). Eşitleme: hesap.js › oyunAl/oyunBirlestir. */

const SZ_GUNLUK = 3, SZ_BASLANGIC = ["karain", "catal", "efes", "pompeii"];
const szM = (tr, en, v) => { let s = DIL === "en" ? en : tr; if (v) for (const [k, x] of Object.entries(v)) s = s.split("{" + k + "}").join(x); return s; };
const szL = o => !o ? "" : typeof o === "string" ? o : DIL === "en" ? (o.en ?? o.tr) : o.tr;
const szYonetici = () => typeof oyunYoneticisi === "function" && oyunYoneticisi();
const sinirla = (x, a, b) => Math.max(a, Math.min(b, x));

/* ---------------------------------------------------------------- kariyer */
const KZ_UNVANLAR = [
  { i: 0, tr: "Arkeoloji öğrencisi", en: "Archaeology student" },
  { i: 150, tr: "Araştırma görevlisi", en: "Research assistant" },
  { i: 400, tr: "Doktor araştırmacı", en: "Postdoctoral researcher" },
  { i: 800, tr: "Doçent", en: "Associate professor" },
  { i: 1500, tr: "Profesör", en: "Professor" },
  { i: 2500, tr: "Kazı başkanı", en: "Excavation director" },
];
function kariyer() {
  const k = D.kzKariyer = D.kzKariyer || {};
  k.itibar = k.itibar || 0; k.sezonlar = k.sezonlar || 0; k.kesif = k.kesif || {}; k.yapilar = k.yapilar || {};
  return k;
}
function unvanSira(itibar = kariyer().itibar) { let s = 0; KZ_UNVANLAR.forEach((u, i) => { if (itibar >= u.i) s = i; }); return s; }
const sezonSuresi = () => 8 + Math.min(4, unvanSira());
const sezonButcesi = () => 100 + unvanSira() * 10;
function alanKesfedildi(a) {
  const d = D.buluntuDefteri || {};
  return SZ_BASLANGIC.includes(a.id) || !!kariyer().kesif[a.id] || a.buluntular.some(b => d[b.id]);
}
function sezonEnerji() {
  const g = oyunGunu();
  if (!D.kzSezonGun || D.kzSezonGun.gun !== g) D.kzSezonGun = { gun: g, kalan: SZ_GUNLUK };
  if (szYonetici()) D.kzSezonGun.kalan = SZ_GUNLUK;
  return D.kzSezonGun;
}
function kariyerHtml() {
  const k = kariyer(), s = unvanSira(), u = KZ_UNVANLAR[s], son = KZ_UNVANLAR[s + 1];
  const oran = son ? Math.round((k.itibar - u.i) / (son.i - u.i) * 100) : 100;
  return `<div class="sz-kariyer"><span class="sz-unvan">🎓 <b>${esc(szL(u))}</b><small>${szM("İtibar {n}", "Reputation {n}", { n: k.itibar })}${son ? ` · ${szM("sonraki: {u}", "next: {u}", { u: szL(son) })}` : ""}</small></span>
    <span class="sz-cubuk" role="progressbar" aria-valuenow="${oran}" aria-valuemin="0" aria-valuemax="100"><i style="width:${oran}%"></i></span></div>`;
}

/* ---------------------------------------------------------------- ara sahneler */
const SAHNELER = {
  karain: { tr: "Antalya yakınlarındaki büyük Karain Mağarası. İnsanlar burada yüz binlerce yıl boyunca barındı; ilk kazıları 1946'da İsmail Kılıç Kökten başlattı.",
    en: "The great Karain Cave near Antalya. People sheltered here for hundreds of thousands of years; İsmail Kılıç Kökten began the first excavations in 1946." },
  kizilin: { tr: "Katran Dağı'ndaki Kızılin. Küçük dilgicikler, Epipaleolitik avcı-toplayıcıların ince işçilikli taş aletlerini anlatıyor.",
    en: "Kızılin on Katran Dağı. Tiny bladelets tell of the finely made stone tools of Epipalaeolithic hunter-gatherers." },
  gobekli: { tr: "Şanlıurfa yakınlarında, Göbeklitepe. T biçimli dikilitaşlar çiftçilikten önce yapılmış anıtsal yapılara ait; kazılar 1995'te Klaus Schmidt ile başladı.",
    en: "Göbeklitepe, near Şanlıurfa. Its T-shaped pillars belong to monumental buildings raised before farming; excavations began in 1995 under Klaus Schmidt." },
  catal: { tr: "Konya Ovası'nda Çatalhöyük: yan yana kerpiç evlerden oluşan büyük bir Neolitik yerleşim. Evlere çatıdaki açıklıktan merdivenle girilirdi.",
    en: "Çatalhöyük on the Konya Plain: a great Neolithic settlement of houses built wall to wall. People entered them by ladder through the roof." },
  hattusa: { tr: "Çorum Boğazkale'de Hattuşa, Hitit İmparatorluğu'nun başkenti. Burada bulunan binlerce çivi yazılı tablet Hitit tarihini yeniden yazdırdı.",
    en: "Hattusa at Boğazkale, Çorum, capital of the Hittite Empire. Thousands of cuneiform tablets found here rewrote Hittite history." },
  troya: { tr: "Çanakkale'de, Hisarlık Tepesi'nde Troya. Üst üste dokuz ana yerleşim katı var; kazılar 1870'lerde Heinrich Schliemann ile başladı.",
    en: "Troy, on Hisarlık hill in Çanakkale. Nine main settlement levels lie one above the other; Heinrich Schliemann began digging in the 1870s." },
  efes: { tr: "İzmir Selçuk'ta Efes, Roma döneminde Asya eyaletinin en önemli kentlerinden biri. Celsus Kütüphanesi'nin cephesi anastilozla yeniden ayağa kaldırıldı.",
    en: "Ephesus at Selçuk, İzmir, one of the leading cities of Roman Asia. The façade of the Library of Celsus was raised again by anastylosis." },
  zeugma: { tr: "Fırat kıyısında Zeugma. Villaların bir bölümü baraj suları altında kaldı; kurtarma kazılarında çıkan mozaikler bugün Gaziantep'te müzede.",
    en: "Zeugma on the Euphrates. Part of its villas lies under a dam lake; the mosaics saved by rescue excavations are now in a museum in Gaziantep." },
  pompeii: { tr: "MS 79'da Vezüv'ün külleri altında kalan Pompeii. Bir Roma kentinin gündelik hayatı, donmuş gibi bekliyor.",
    en: "Pompeii, buried by Vesuvius' ash in AD 79. The daily life of a Roman town waits as if frozen." },
  giza: { tr: "Gize'de piramitlerin gölgesinde, onları yapan işçilerin kenti de kazıldı: fırınlar, ekmek ve bira atölyeleri.",
    en: "At Giza, in the shadow of the pyramids, the town of the workers who built them was excavated too: ovens, bakeries and breweries." },
  knossos: { tr: "Girit'te Knossos sarayı, Minos uygarlığının merkezi. Arthur Evans 1900'de kazmaya başladı ve bazı bölümleri yeniden kurdurdu.",
    en: "The palace of Knossos on Crete, heart of the Minoan civilisation. Arthur Evans began digging in 1900 and had some parts rebuilt." },
  stonehenge: { tr: "Wiltshire'da Stonehenge. Büyük sarsen taşlarının yanında Galler'den getirilen mavi taşlar var; anıt yüzyıllar boyunca evre evre yapıldı.",
    en: "Stonehenge in Wiltshire. Beside the great sarsens stand bluestones brought from Wales; the monument was built in phases over centuries." },
  machu: { tr: "And Dağları'nda Machu Picchu, 15. yüzyılda İnkalar tarafından yapıldı. Teraslar hem tarla hem de yamacı tutan bir mühendislik eseri.",
    en: "Machu Picchu in the Andes, built by the Inca in the 15th century. Its terraces are both fields and feats of engineering that hold the slope." },
  xian: { tr: "Xi'an yakınlarında, ilk Qin imparatorunun mezar kompleksi. Pişmiş toprak ordunun çukurları 1974'te kuyu kazan köylülerce fark edildi.",
    en: "Near Xi'an, the tomb complex of the first Qin emperor. The pits of the terracotta army were noticed in 1974 by villagers digging a well." },
  petra: { tr: "Ürdün'de Petra, Nabatilerin kayaya oyulmuş başkenti. Su kanalları ve sarnıçlar çölde bir kenti yaşatıyordu.",
    en: "Petra in Jordan, the rock-cut capital of the Nabataeans. Channels and cisterns kept a city alive in the desert." },
};
/* Piksel sahne + yürüyen arkeolog + daktilo yazı. Dokununca yazı tamamlanır, sonra devam. */
function araSahne(alan, satirlar, sonra, dugme) {
  const ark = arkeolog(), renk = kiyafetRenk();
  let bitti = false, harf = 0, x = -14, dongu = null;
  const metin = satirlar.join("\n\n");
  levhaAc(`<div class="sz-sahne"><canvas width="160" height="48" id="sz-sahne-tuval"></canvas>
    <p class="sz-sahne-yazi" id="sz-sahne-yazi" aria-live="polite"></p>
    <p><button class="buyuk-dugme" id="sz-sahne-devam">${esc(dugme || szM("Devam", "Continue"))}</button></p></div>`, lv => {
    const cv = lv.querySelector("#sz-sahne-tuval"), ctx = cv.getContext("2d"), yazi = lv.querySelector("#sz-sahne-yazi");
    const azHareket = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (azHareket) harf = metin.length;
    const kare = () => {
      if (!document.body.contains(cv)) return;
      kzSahne(ctx, alan, 160);
      if (x < 70) x += 0.6;
      const zip = x < 70 ? Math.floor(performance.now() / 120) % 2 : 0;
      spriteCiz(ctx, ark ? ark.sprite : "ark_saha", Math.round(x), 24 - zip, 1, false, renk);
      if (harf < metin.length) { harf = Math.min(metin.length, harf + 2); yazi.textContent = metin.slice(0, harf); }
      else if (!bitti) { bitti = true; yazi.textContent = metin; }
      dongu = requestAnimationFrame(kare);
    };
    kare();
    const gec = () => { cancelAnimationFrame(dongu); levhaKapat(); if (sonra) sonra(); };
    lv.querySelector("#sz-sahne-devam").onclick = () => { if (harf < metin.length) { harf = metin.length; yazi.textContent = metin; } else gec(); };
  });
}

/* ---------------------------------------------------------------- olay kartları (seçimler) */
/* etki: butce, moral, itibar (sezon sonunda kariyere), vurus (bugünkü kazı), kalici (sezon boyu kazı vuruşu), puan */
const OLAYLAR = [
  { id: "coban", metin: { tr: "Köyden bir çoban, tarlasında bulduğu eski bir sikkeyi kazı evine getirdi.", en: "A shepherd from the village brings an old coin he found in his field to the dig house." },
    secenek: [
      { ad: { tr: "Tutanakla teslim al, müzeye bildir", en: "Record it and report it to the museum" }, etki: { itibar: 15, vurus: -2 },
        sonuc: { tr: "Tutanak tutuldu, sikke müzeye teslim edilecek. Doğrusu buydu: tesadüfen bulunan eser de yetkililere bildirilir.", en: "A report was written and the coin will go to the museum. That was right: chance finds must be reported too." } },
      { ad: { tr: "Teşekkür edip geri ver", en: "Thank him and hand it back" }, etki: { itibar: -15, moral: -5 },
        sonuc: { tr: "Kültür varlığını bildirmemek yasaya aykırı. Ekip bundan rahatsız oldu.", en: "Not reporting a cultural object is against the law. The team was uneasy." } }] },
  { id: "saganak", kosul: a => !a.kurak, metin: { tr: "Hava raporu öğleden sonra sağanak diyor.", en: "The forecast says heavy rain this afternoon." },
    secenek: [
      { ad: { tr: "Açmayı brandayla ört, erken paydos", en: "Cover the trench with tarpaulin, stop early" }, etki: { vurus: -5, moral: 5 },
        sonuc: { tr: "Kesitler korundu, ekip kuru kaldı.", en: "The sections were protected and the team stayed dry." } },
      { ad: { tr: "Devam, yağmur geçer", en: "Carry on, it will pass" }, etki: { vurus: 3, moral: -10, puan: -20 },
        sonuc: { tr: "İş ilerledi ama bir kesit duvarı göçtü; düzeltmek zaman aldı.", en: "Work went on, but a section wall collapsed and took time to fix." } }] },
  { id: "kumfirtina", kosul: a => !!a.kurak, metin: { tr: "Ufukta kum fırtınası yükseliyor.", en: "A sandstorm is rising on the horizon." },
    secenek: [
      { ad: { tr: "Buluntuları kasalara al, açmayı ört", en: "Box the finds and cover the trench" }, etki: { vurus: -5, moral: 5 },
        sonuc: { tr: "Fırtına geçti; açma ve buluntular güvende.", en: "The storm passed; trench and finds are safe." } },
      { ad: { tr: "Gözlükleri tak, devam", en: "Put on goggles and carry on" }, etki: { vurus: 2, moral: -12 },
        sonuc: { tr: "Kum her yere doldu; ekip yorgun düştü.", en: "Sand got everywhere and the team is worn out." } }] },
  { id: "kacak", metin: { tr: "Sabah açmanın yakınında taze bir defineci çukuru gördünüz.", en: "In the morning you find a fresh looters' pit near the trench." },
    secenek: [
      { ad: { tr: "Fotoğrafla belgele, yetkililere bildir", en: "Photograph it and report it" }, etki: { itibar: 20, vurus: -3 },
        sonuc: { tr: "Tutanak tutuldu, alanda gece bekçisi görevlendirildi.", en: "A report was filed and a night guard was assigned to the site." } },
      { ad: { tr: "Üstünü örtüp işe dön", en: "Fill it in and get back to work" }, etki: { itibar: -10 },
        sonuc: { tr: "Defineciler bir sonraki gece yine geldi.", en: "The looters came back the next night." } }] },
  { id: "yorgun", kosul: (a, s) => s.moral < 60, metin: { tr: "Ekip günlerdir güneş altında. Yüzler asık.", en: "The team has been in the sun for days. Faces are long." },
    secenek: [
      { ad: { tr: "Öğleden sonra izin ver", en: "Give the afternoon off" }, etki: { vurus: -6, moral: 25 },
        sonuc: { tr: "Ekip dinlendi, akşam kazı evinde şarkılar söylendi.", en: "The team rested and there was singing at the dig house that evening." } },
      { ad: { tr: "Akşam karpuz kes, devam", en: "Watermelon tonight, carry on" }, etki: { butce: -3, moral: 10 },
        sonuc: { tr: "Karpuz iyi geldi.", en: "The watermelon helped." } }] },
  { id: "denetci", metin: { tr: "İzni veren kurumdan bir denetçi yarın ziyarete geliyor.", en: "An inspector from the permitting authority visits tomorrow." },
    secenek: [
      { ad: { tr: "Kesitleri temizle, çizimleri ve defteri güncelle", en: "Clean the sections, update drawings and the notebook" }, etki: { vurus: -4, itibar: 15 },
        sonuc: { tr: "Denetçi belgelemeyi övdü.", en: "The inspector praised the documentation." } },
      { ad: { tr: "İşe devam, olduğu gibi görsün", en: "Keep working, let them see it as it is" }, etki: { itibar: -5 },
        sonuc: { tr: "Eksik çizimler rapora not düşüldü.", en: "The missing drawings were noted in the report." } }] },
  { id: "jenerator", metin: { tr: "Kazı evinin jeneratörü bozuldu; akşam buluntu yıkama ve envanter yapılamıyor.", en: "The dig house generator broke; no find washing or inventory tonight." },
    secenek: [
      { ad: { tr: "Bütçeden tamir ettir", en: "Pay for the repair" }, etki: { butce: -10 },
        sonuc: { tr: "Usta akşama yetişti.", en: "The mechanic made it by evening." } },
      { ad: { tr: "Fenerle idare et", en: "Make do with torches" }, etki: { moral: -10 },
        sonuc: { tr: "Envanter gece yarısına kadar sürdü.", en: "The inventory dragged on until midnight." } }] },
  { id: "okul", metin: { tr: "Köy okulu kazıyı görmek istiyor.", en: "The village school asks to visit the dig." },
    secenek: [
      { ad: { tr: "Kabul et, öğrencilere açmayı anlat", en: "Say yes and show the children the trench" }, etki: { vurus: -3, itibar: 10, moral: 5 },
        sonuc: { tr: "Çocuklar elek başında bir boncuk buldu; köyle bağ güçlendi.", en: "The children found a bead at the sieve; ties with the village grew stronger." } },
      { ad: { tr: "Alan güvenli değil, kibarca ertele", en: "The site isn't safe, politely postpone" }, etki: {},
        sonuc: { tr: "Ziyaret sezon sonuna kaldı.", en: "The visit was put off to the end of the season." } }] },
  { id: "renk", metin: { tr: "Açmada toprağın rengi değişti: koyu, külü bol bir tabaka.", en: "The soil in the trench changes colour: a dark layer full of ash." },
    secenek: [
      { ad: { tr: "Yeni birim aç, kesiti çiz, örnek al", en: "Open a new unit, draw the section, take a sample" }, etki: { vurus: -2, puan: 40 },
        sonuc: { tr: "Yeni bir dolgu birimi kaydedildi; kül örneği radyokarbon için ayrıldı.", en: "A new fill unit was recorded; an ash sample was set aside for radiocarbon." } },
      { ad: { tr: "Fark etmez, kazmaya devam", en: "Never mind, keep digging" }, etki: { puan: -20, itibar: -5 },
        sonuc: { tr: "Tabakalar karıştı; bağlam bilgisi kayboldu.", en: "The layers got mixed and the context was lost." } }] },
  { id: "sponsor", metin: { tr: "Bir firma, tişörtlere logosunu basmak karşılığında destek öneriyor.", en: "A company offers funding in return for its logo on the team T-shirts." },
    secenek: [
      { ad: { tr: "Kabul et", en: "Accept" }, etki: { butce: 15 },
        sonuc: { tr: "Ödenek arttı, tişörtler yeni.", en: "More funds and new T-shirts." } },
      { ad: { tr: "Teşekkür et, reddet", en: "Thank them and decline" }, etki: {},
        sonuc: { tr: "Ekip eski tişörtlerle devam etti.", en: "The team carried on in old T-shirts." } }] },
  { id: "gazeteci", metin: { tr: "Bir gazeteci “hazine bulundu” başlığı atmak istiyor.", en: "A journalist wants to run a “treasure found” headline." },
    secenek: [
      { ad: { tr: "Bilimsel bir açıklama yap", en: "Give a proper scientific statement" }, etki: { itibar: 10, vurus: -2 },
        sonuc: { tr: "Haber doğru çıktı; arkeolojinin hazine avı olmadığı da yazıldı.", en: "The story was accurate, and it said archaeology is not treasure hunting." } },
      { ad: { tr: "Başlığa karışma", en: "Leave the headline alone" }, etki: { itibar: -10, moral: -5 },
        sonuc: { tr: "Haber yayıldı; ertesi gece açmanın çevresinde defineci izi vardı.", en: "The story spread; the next night there were looters' tracks around the trench." } }] },
  { id: "kemik", metin: { tr: "Bir öğrenci açmanın köşesinde insan kemiğine benzer bir şey gördü.", en: "A student spots something like a human bone in the corner of the trench." },
    secenek: [
      { ad: { tr: "Kazmayı bırak, antropoloğu çağır, fırçayla aç", en: "Stop digging, call the anthropologist, use brushes" }, etki: { vurus: -3, puan: 30, itibar: 5 },
        sonuc: { tr: "Gömü dikkatle açıldı, çizildi ve fotoğraflandı.", en: "The burial was carefully exposed, drawn and photographed." } },
      { ad: { tr: "Kazmaya devam", en: "Keep digging" }, etki: { puan: -30, itibar: -10 },
        sonuc: { tr: "Kemikler dağıldı; gömünün bağlamı kayboldu.", en: "The bones were scattered and the burial's context was lost." } }] },
  { id: "isci", metin: { tr: "Köyden iki kişi kazıda çalışmak istiyor.", en: "Two people from the village want to work on the dig." },
    secenek: [
      { ad: { tr: "İşe al", en: "Hire them" }, etki: { butce: -8, kalici: 2 },
        sonuc: { tr: "Ekip büyüdü: sezon boyunca her kazı gününe +2 vuruş.", en: "The team grew: +2 strikes on every dig day this season." } },
      { ad: { tr: "Bütçe yetmez", en: "The budget won't allow it" }, etki: {},
        sonuc: { tr: "Mevcut ekiple devam.", en: "Carrying on with the current team." } }] },
  { id: "su", metin: { tr: "Kazı evine iki gündür su gelmiyor.", en: "There has been no water at the dig house for two days." },
    secenek: [
      { ad: { tr: "Tankerle su getirt", en: "Order a water tanker" }, etki: { butce: -6 },
        sonuc: { tr: "Su geldi, buluntu yıkama sürdü.", en: "Water arrived and find washing went on." } },
      { ad: { tr: "İdare edin", en: "Make do" }, etki: { moral: -12 },
        sonuc: { tr: "Ekip söylendi ama dayandı.", en: "The team grumbled but held on." } }] },
];
const ETKI_SIMGE = { butce: "💰", moral: "🙂", itibar: "🎓", vurus: "⛏", kalici: "⛏+", puan: "⭐" };
function etkiYaz(e) {
  return Object.entries(e || {}).filter(([, v]) => v).map(([k, v]) => `<span class="sz-etki ${v > 0 ? "arti" : "eksi"}">${ETKI_SIMGE[k]} ${v > 0 ? "+" : ""}${v}</span>`).join(" ");
}

/* ---------------------------------------------------------------- mimari restorasyon: yapı planları (alttan üste) */
/* Her yuva yalnız alt sırada, altı doluyken ya da yanı doluyken (lento, kemer) konur. duz: taban/mozaik (dayanak kuralı yok). */
const YAPILAR = {
  karain: { ad: { tr: "Mağara kesiti (stratigrafi)", en: "Cave section (stratigraphy)" }, duz: true, sirali: true,
    bilgi: { tr: "Kesit, en eski katman altta olmak üzere çizilir. Karain'in dolguları Alt Paleolitik'ten Epipaleolitik'e uzanır.", en: "A section is drawn with the oldest layer at the bottom. Karain's deposits run from the Lower Palaeolithic to the Epipalaeolithic." },
    tip: { y: ["#8a7a5a", "Yüzey toprağı", "Topsoil"], e: ["#a8865a", "Epipaleolitik", "Epipalaeolithic"], u: ["#b89a6e", "Üst Paleolitik", "Upper Palaeolithic"],
      o: ["#9a7a58", "Orta Paleolitik", "Middle Palaeolithic"], a: ["#7a6248", "Alt Paleolitik", "Lower Palaeolithic"], k: ["#5e574e", "Ana kaya", "Bedrock"] },
    h: ["yyyyyyyy", "eeeeeeee", "uuuuuuuu", "oooooooo", "aaaaaaaa", "kkkkkkkk"] },
  kizilin: { ad: { tr: "Ocak çevresi (taş dizisi)", en: "Hearth ring (stone setting)" }, duz: true,
    bilgi: { tr: "Avcı-toplayıcı kamplarında ocaklar çoğu kez taşla çevrilirdi. Küldeki kömür, ocağın tarihlenmesini sağlar.", en: "Hunter-gatherer camps often had stone-lined hearths. Charcoal in the ash allows the hearth to be dated." },
    tip: { t: ["#8a8a82", "Çevre taşı", "Ring stone"], k: ["#4a4038", "Kül ve kömür", "Ash and charcoal"], z: ["#b49a7c", "Yürüme yüzeyi", "Floor surface"] },
    h: ["zzzzzzz", "zztttzz", "ztkkktz", "ztkkktz", "zztttzz", "zzzzzzz"] },
  gobekli: { ad: { tr: "T biçimli dikilitaşlar", en: "T-shaped pillars" },
    bilgi: { tr: "Dikilitaşların gövdesi insanı, T başlığı başı simgeler; çevreleri taş duvar ve sekilerle kuşatılır.", en: "The pillar shafts stand for human bodies and the T tops for heads; they are ringed by stone walls and benches." },
    tip: { t: ["#d2cbbf", "T başlığı", "T top"], g: ["#b9b2a6", "Dikilitaş gövdesi", "Pillar shaft"], r: ["#a39a8a", "Kabartmalı gövde", "Relief shaft"], b: ["#8f8676", "Seki taşı", "Bench stone"] },
    h: ["ttt..ttt", ".g....g.", ".r....r.", ".g....g.", "bbbbbbbb"] },
  catal: { ad: { tr: "Kerpiç ev ve çatı girişi", en: "Mudbrick house and roof entrance" },
    bilgi: { tr: "Çatalhöyük evleri bitişikti; sokak yoktu. Giriş çatıdaki açıklıktan, merdivenle yapılırdı.", en: "Çatalhöyük houses were built wall to wall with no streets. People came in through a roof opening by ladder." },
    tip: { c: ["#9a7e5c", "Sazlı çatı", "Reed roof"], k: ["#cdb58e", "Kerpiç", "Mudbrick"], b: ["#efe6d2", "Bukranionlu duvar", "Bucranium wall"], m: ["#7a5530", "Merdiven", "Ladder"], z: ["#b79a74", "Sıvalı taban", "Plastered floor"] },
    h: ["cccc.ccc", "kbkkmkkk", "kkkkmkkk", "kkkkmkbk", "zzzzzzzz"] },
  hattusa: { ad: { tr: "Sur ve Aslanlı Kapı", en: "City wall and Lion Gate" },
    bilgi: { tr: "Hattuşa'nın surları büyük taş temeller üzerine kurulmuştu; Aslanlı Kapı'nın iki yanında kabartma aslanlar durur.", en: "Hattusa's walls stood on massive stone footings; relief lions guard both sides of the Lion Gate." },
    tip: { d: ["#a4927a", "Mazgal", "Crenel"], s: ["#8f7e66", "Sur taşı", "Wall block"], a: ["#c9b48e", "Aslan kabartması", "Lion relief"], t: ["#6e604e", "Temel taşı", "Footing"] },
    h: ["d.d..d.d", "dddddddd", "sss..sss", "sas..ass", "sss..sss", "tttttttt"] },
  troya: { ad: { tr: "Taş temelli kerpiç sur", en: "Mudbrick wall on stone footing" },
    bilgi: { tr: "Troya surlarının alt kısmı eğimli taş örgü, üstü kerpiçti. Kerpiç zamanla eridiği için bugün çoğunlukla taş kısım görülür.", en: "Troy's walls had a sloping stone base and a mudbrick top. The mudbrick has mostly melted away, so the stone part is what survives." },
    tip: { k: ["#c7a27a", "Kerpiç", "Mudbrick"], s: ["#9a8a74", "Kireçtaşı örgü", "Limestone masonry"], t: ["#6e604e", "Temel", "Footing"] },
    h: ["..kkkk..", ".kkkkkk.", ".ssssss.", "ssssssss", "ssssssss", "tttttttt"] },
  efes: { ad: { tr: "Celsus Kütüphanesi cephesi", en: "Library of Celsus façade" },
    bilgi: { tr: "Anastiloz: yıkılmış bir yapının özgün parçalarını yerine koyup eksikleri ayırt edilir biçimde tamamlamak.", en: "Anastylosis: putting a ruined building's original pieces back in place and completing the gaps in a distinguishable way." },
    tip: { a: ["#e6dccb", "Alınlık", "Pediment"], e: ["#d9cdb4", "Arşitrav", "Architrave"], c: ["#f2ebde", "Sütun", "Column"], b: ["#c9bba0", "Podyum", "Podium"], p: ["#b0a288", "Basamak", "Step"] },
    h: ["..aaaa..", "eeeeeeee", "c.c..c.c", "c.c..c.c", "bbbbbbbb", "pppppppp"] },
  zeugma: { ad: { tr: "Mozaik taban (tessera)", en: "Mosaic floor (tesserae)" }, duz: true,
    bilgi: { tr: "Mozaik, küçük taş ve cam parçalarıyla (tessera) yapılır. Kurtarılan mozaikler kaldırılıp yeni bir taşıyıcı üzerine aktarılır.", en: "Mosaics are made of small pieces of stone and glass (tesserae). Rescued mosaics are lifted and transferred onto a new backing." },
    tip: { c: ["#6b4a30", "Çerçeve", "Border"], w: ["#efe6d2", "Zemin", "Ground"], y: ["#d9a43a", "Sarı tessera", "Yellow tesserae"], r: ["#a8322a", "Kırmızı tessera", "Red tesserae"] },
    h: ["cccccccc", "cwwyywwc", "cwyrrywc", "cwyrrywc", "cwwyywwc", "cccccccc"] },
  pompeii: { ad: { tr: "Freskli Roma evi", en: "Roman house with frescoes" },
    bilgi: { tr: "Pompeii evlerinin duvarları fresklerle süslüydü; kül, renkleri neredeyse iki bin yıl korudu.", en: "Pompeian house walls were painted with frescoes; the ash kept their colours for nearly two thousand years." },
    tip: { r: ["#a8322a", "Kiremit", "Roof tile"], w: ["#d0c4ae", "Duvar", "Wall"], f: ["#c0503a", "Fresk paneli", "Fresco panel"], t: ["#8a7a66", "Temel", "Footing"] },
    h: ["..rrrr..", ".rrrrrr.", "wwwwwwww", "wfw..wfw", "wfw..wfw", "tttttttt"] },
  giza: { ad: { tr: "Piramit ve kaplama taşları", en: "Pyramid and casing stones" },
    bilgi: { tr: "Piramitlerin dışı bir zamanlar parlak beyaz kireçtaşı kaplamayla örtülüydü; çoğu sonradan sökülüp başka yapılarda kullanıldı.", en: "The pyramids were once faced with bright white limestone casing; most of it was later removed for other buildings." },
    tip: { k: ["#efe2c4", "Kaplama taşı", "Casing stone"], p: ["#d9b98a", "Çekirdek bloğu", "Core block"], t: ["#a08a64", "Kaya zemin", "Bedrock"] },
    h: ["...kk...", "..kppk..", ".kppppk.", "kppppppk", "tttttttt"] },
  knossos: { ad: { tr: "Minos sütunları", en: "Minoan columns" },
    bilgi: { tr: "Minos sütunları aşağı doğru incelir; kırmızıya boyanırdı. Knossos'takiler Evans döneminde yeniden yapıldı.", en: "Minoan columns taper downwards and were painted red. Those at Knossos were rebuilt in Evans' time." },
    tip: { e: ["#d9c7a0", "Saçak", "Cornice"], w: ["#c9b892", "Duvar", "Wall"], h: ["#2b2420", "Sütun başlığı", "Capital"], r: ["#b33a2a", "Kırmızı sütun", "Red column"], b: ["#6b5a44", "Kaide", "Base"], p: ["#a89878", "Taş döşeme", "Paving"] },
    h: ["eeeeeeee", "wh.hh.hw", "wr.rr.rw", "wr.rr.rw", "wb.bb.bw", "pppppppp"] },
  stonehenge: { ad: { tr: "Sarsen trilitonları", en: "Sarsen trilithons" },
    bilgi: { tr: "Triliton: iki dikme taşın üstüne yatay bir lento. Lentolar dikmelere geçme yuvalarla oturtulmuştu.", en: "A trilithon is two uprights with a horizontal lintel; the lintels were fixed with joints like woodworking." },
    tip: { l: ["#a8a39a", "Lento", "Lintel"], d: ["#9a958c", "Sarsen dikme", "Sarsen upright"], m: ["#7d8f98", "Mavi taş", "Bluestone"], g: ["#6a8a4c", "Tebeşirli zemin", "Chalk ground"] },
    h: ["lll..lll", "d.d..d.d", "d.d..d.d", "d.dmmd.d", "gggggggg"] },
  machu: { ad: { tr: "Teras ve İnka yapısı", en: "Terrace and Inca building" },
    bilgi: { tr: "İnka duvarcılığında taşlar harçsız, birbirine sıkıca oturacak biçimde işlenirdi. Trapez nişler İnka yapılarının imzasıdır.", en: "Inca masons shaped stones to fit tightly without mortar. Trapezoidal niches are a hallmark of Inca buildings." },
    tip: { c: ["#9a7e4a", "Saz çatı", "Thatch"], w: ["#b8ab94", "İşlenmiş taş", "Dressed stone"], n: ["#5e544a", "Trapez niş", "Trapezoidal niche"], t: ["#8a8070", "Teras duvarı", "Terrace wall"] },
    h: ["...cc...", "..wwww..", "..wnnw..", ".tttttt.", "tttttttt"] },
  xian: { ad: { tr: "Asker çukuru koridorları", en: "Army pit corridors" },
    bilgi: { tr: "Askerler sıkıştırılmış toprak duvarlarla ayrılan koridorlarda dururdu; üstü ahşap kirişlerle örtülüydü.", en: "The figures stood in corridors divided by rammed-earth walls and roofed with timber beams." },
    tip: { k: ["#7a5530", "Ahşap kiriş", "Timber beam"], h: ["#9a7e5c", "Sıkıştırılmış toprak", "Rammed earth"], t: ["#6e655a", "Tuğla döşeme", "Brick floor"] },
    h: ["kkkkkkk", "h..h..h", "h..h..h", "ttttttt"] },
  petra: { ad: { tr: "Kaya cephesi", en: "Rock-cut façade" },
    bilgi: { tr: "Petra cepheleri yukarıdan aşağıya kayaya oyuldu. Restorasyonda yeni taş, özgününden ayırt edilecek biçimde kullanılır.", en: "Petra's façades were carved from the top down. In restoration, new stone is used so that it can be told apart from the original." },
    tip: { u: ["#e0aa90", "Taş küp", "Stone urn"], a: ["#d9a08a", "Alınlık", "Pediment"], e: ["#c98a70", "Saçaklık", "Entablature"], c: ["#d29a80", "Sütun", "Column"], p: ["#a86a50", "Basamak", "Step"] },
    h: ["...uu...", "..aaaa..", "eeeeeeee", "c.c..c.c", "c.c..c.c", "pppppppp"] },
};

/* ---------------------------------------------------------------- laboratuvar: tarihleme yöntemleri */
const YONTEM = {
  c14: { tr: "Radyokarbon (C14)", en: "Radiocarbon (C14)" }, seramik: { tr: "Seramik tipolojisi", en: "Pottery typology" },
  numizmatik: { tr: "Nümizmatik (sikke tipi)", en: "Numismatics (coin type)" }, dendro: { tr: "Dendrokronoloji (ağaç halkası)", en: "Dendrochronology (tree rings)" },
  teknoloji: { tr: "Yontma tekniği ve tipoloji", en: "Knapping technique and typology" },
};
const BULUNTU_YONTEM = { kemik: "c14", tohum: "c14", komur: "c14", canak: "seramik", sikke: "numizmatik", yonga: "teknoloji", mikrolit: "teknoloji" };

/* ---------------------------------------------------------------- yardımcılar */
const szAlan = s => KZ_ALANLAR.find(a => a.id === s.alan);
function buluntuBul(id, alan) {
  return KZ_SIK.find(b => b.id === id) || KZ_ELEK.find(b => b.id === id) || (alan && alan.buluntular.find(b => b.id === id))
    || KZ_ALANLAR.flatMap(a => a.buluntular).find(b => b.id === id) || null;
}
const buluntuAlani = id => KZ_ALANLAR.find(a => a.buluntular.some(b => b.id === id)) || null;
function szAcmaKur(alan) {
  const n = KZ_SUTUN * KZ_SATIR, yer = karistir([...Array(n).keys()], Math.random);
  const acma = Array.from({ length: n }, () => ({ d: 3 }));
  alan.buluntular.forEach((b, i) => { acma[yer[i]] = { d: 3, b: b.id, k: Math.random() < .5 ? 1 : 0, ...(Math.random() < KZ_NADIR_OLASILIK ? { n: 1 } : {}) }; });
  const sikler = KZ_SIK.filter(b => (b.tarihOncesi ? alan.tarihOncesi : true) && (b.cag ? (!alan.tarihOncesi || alan.canak) : true));
  for (let i = alan.buluntular.length; i < alan.buluntular.length + 22; i++)
    acma[yer[i]] = { d: 3, b: sikler[Math.floor(Math.random() * sikler.length)].id, k: [2, 2, 1, 1, 0][Math.floor(Math.random() * 5)] };
  return acma;
}
const acmaHucre = (h, alan) => ({ derinlik: h.d, buluntu: h.b ? buluntuBul(h.b, alan) : null, bulKat: h.k || 0, nadir: !!h.n, kirik: !!h.kr, restore: !!h.r });
const hucreAcma = h => ({ d: h.derinlik, ...(h.buluntu ? { b: h.buluntu.id, k: h.bulKat } : {}), ...(h.nadir ? { n: 1 } : {}), ...(h.kirik ? { kr: 1 } : {}), ...(h.restore ? { r: 1 } : {}) });
function szHava(alan) { const z = Math.random(); return z < 0.6 ? "gunes" : z < 0.8 ? (alan.kurak ? "kum" : "yagmur") : (alan.kurak ? "kum" : "ruzgar"); }
function szDefter(s, kayit) {
  s.defter = s.defter || [];
  const v = { g: s.gun, t: oyunGunu(), hava: s.bugun ? s.bugun.hava : "gunes", ...kayit };
  const i = s.defter.findIndex(x => x.g === s.gun);
  if (i >= 0) s.defter[i] = { ...s.defter[i], ...v, metin: [s.defter[i].metin, kayit.metin].filter(Boolean).join(" ") };
  else s.defter.push(v);
}
function szUygula(s, e) {
  if (!e) return;
  if (e.butce) s.butce = Math.max(0, s.butce + e.butce);
  if (e.moral) s.moral = sinirla(s.moral + e.moral, 0, 100);
  if (e.itibar) s.itibar = (s.itibar || 0) + e.itibar;
  if (e.puan) s.puan = Math.max(0, s.puan + e.puan);
  if (e.vurus && s.bugun) s.bugun.ekVurus = (s.bugun.ekVurus || 0) + e.vurus;
  if (e.kalici) s.ekVurus = (s.ekVurus || 0) + e.kalici;
}
const IS = {
  kaz: { simge: "⛏", ad: { tr: "Açmada kaz", en: "Dig the trench" }, butce: 8, moral: -6 },
  yuzey: { simge: "🧭", ad: { tr: "Yüzey araştırması", en: "Field survey" }, butce: 4, moral: -3 },
  lab: { simge: "🔬", ad: { tr: "Laboratuvar: tarihlendirme", en: "Lab: dating" }, butce: 3, moral: 0 },
  restore: { simge: "🏛", ad: { tr: "Mimari restorasyon", en: "Architectural restoration" }, butce: 5, moral: -3 },
  dinlen: { simge: "☕", ad: { tr: "Dinlenme günü", en: "Rest day" }, butce: 2, moral: 20 },
};
function szKazVurus(s) {
  const ark = arkeolog();
  return Math.max(6, 14 + Math.floor(s.moral / 10) + (ark && ark.id === "saha" ? 6 : 0) + (s.ekVurus || 0) + ((s.bugun && s.bugun.ekVurus) || 0));
}
/* Laboratuvara gidebilecek buluntular: değerliler (dönem sorusu) ve yöntemi belli sık buluntular (bir kez) */
function szLabAdaylari(s) { const t = s.tarihlenen || {}; return [...new Set(s.bulunan || [])].filter(x => !(x in t) && (buluntuAlani(x) || BULUNTU_YONTEM[x])); }

/* ---------------------------------------------------------------- yönlendirme */
function sayfaSezonYonlendir(arg) {
  if (arg === "hazine") return sayfaHazine();
  if (arg === "arsiv") return sayfaSezonArsiv();
  return sayfaSezon();
}

/* Kazı Başı ana ekranındaki kariyer şeridi ve kartlar (kazi-oyun.js › sayfaKaziOyun) */
function sezonHubHtml() {
  const s = D.kzSezon, a = s && szAlan(s), e = sezonEnerji(), hz = hazineDurumu();
  return `${kariyerHtml()}
    <a class="kz-alan sz-kart" href="#oyun/kazi/sezon"><canvas width="160" height="48" id="sz-kart-tuval"></canvas>
      <span><b>🗓 ${szM("Kazı Sezonu", "Field Season")}</b><small>${s && a ? szM("{alan} · Gün {g}/{n} · 💰 {b} · 🙂 {m}", "{alan} · Day {g}/{n} · 💰 {b} · 🙂 {m}", { alan: esc(kzAlanAd(a)), g: s.gun, n: s.sure, b: s.butce, m: s.moral })
        : szM("Bir alan seç, ekibini yönet, günleri planla, defterini tut.", "Pick a site, run your team, plan the days, keep your notebook.")}</small>
      <em>${s ? szM("Devam et · bugün {k}/{t} sezon günü", "Continue · {k}/{t} season days today", { k: e.kalan, t: SZ_GUNLUK }) : szM("Yeni sezon başlat", "Start a new season")}</em></span></a>
    <a class="kz-alan sz-kart sz-hazine-kart" href="#oyun/kazi/hazine"><canvas width="160" height="48" id="sz-hazine-tuval"></canvas>
      <span><b>🗺 ${szM("Kayıp Eser", "The Lost Find")}</b><small>${szM("Defineciler eski bir kazı defterinin sayfasını çaldı. Eseri onlardan önce bul!", "Looters stole a page from an old dig notebook. Find the object before they do!")}</small>
      <em>${hz && hz.asama === "bitti" ? szM("Bugünkü puanın: {p}", "Today's score: {p}", { p: hz.puan }) : hz ? szM("Devam et", "Continue") : szM("Günün macerası · herkese aynı", "Today's adventure · same for everyone")}</em></span></a>`;
}
function sezonHubBagla() {
  const cv = $("#sz-kart-tuval"); if (cv) kzSahne(cv.getContext("2d"), (D.kzSezon && szAlan(D.kzSezon)) || KZ_ALANLAR[0], 160);
  const hv = $("#sz-hazine-tuval"); if (hv) hazineKartCiz(hv.getContext("2d"));
}

/* ---------------------------------------------------------------- sezon ekranı */
function sayfaSezon() {
  $("#baslik").textContent = szM("Kazı Sezonu", "Field Season");
  const s = D.kzSezon;
  if (!s || !szAlan(s)) { D.kzSezon = null; return sezonSecimi(); }
  if (!D.nasilGoruldu || !D.nasilGoruldu.sezon) sezonNasil();
  const a = szAlan(s), e = sezonEnerji(), b = s.bugun;
  const defter = [...(s.defter || [])].reverse();
  $("#sayfa").innerHTML = `<div class="kazi-oyun sz">
    <canvas class="sz-buyuk-sahne" width="160" height="48" id="sz-sahne"></canvas>
    <div class="sz-durum">
      <span><b>${esc(kzAlanAd(a))}</b><small>${szM("Gün {g}/{n}", "Day {g}/{n}", { g: s.gun, n: s.sure })}${b ? ` · ${(KZ_HAVA[b.hava] || KZ_HAVA.gunes).simge} ${esc(havaAd(KZ_HAVA[b.hava] || KZ_HAVA.gunes))}` : ""}</small></span>
      <span class="sz-sayac" title="${szM("Bütçe", "Budget")}">💰 <b>${s.butce}</b></span>
      <span class="sz-sayac" title="${szM("Ekip morali", "Team morale")}">🙂 <b>${s.moral}</b></span>
      <span class="sz-sayac" title="${szM("Sezon puanı", "Season score")}">⭐ <b>${s.puan}</b></span></div>
    <div class="sz-cubuklar"><label>${szM("Bütçe", "Budget")}<span class="sz-cubuk"><i style="width:${Math.min(100, s.butce / s.butce0 * 100)}%"></i></span></label>
      <label>${szM("Moral", "Morale")}<span class="sz-cubuk moral"><i style="width:${s.moral}%"></i></span></label></div>
    <section class="sz-bugun" id="sz-bugun"></section>
    <section class="sz-defter"><h3>📓 ${szM("Kazı Defteri", "Excavation Notebook")}</h3>
      ${defter.length ? defter.map(d => szDefterHtml(d)).join("") : `<p class="aciklama">${szM("Her gün buraya kendiliğinden yazılır; sen de not ekleyebilirsin.", "Each day is written here automatically; you can add your own notes too.")}</p>`}</section>
    <p class="kz-alt-dugmeler"><a class="ikincil-dugme" href="#oyun/kazi">${szM("Kazı Başı'na dön", "Back to Dig Site")}</a>
      <button class="ikincil-dugme" id="sz-nasil">❔ ${szM("Nasıl oynanır?", "How to play")}</button>
      <button class="ikincil-dugme" id="sz-kapat">${szM("Sezonu kapat", "Close the season")}</button></p></div>`;
  kzSahne($("#sz-sahne").getContext("2d"), a, 160);
  spriteCiz($("#sz-sahne").getContext("2d"), (arkeolog() || ARKEOLOGLAR[0]).sprite, 72, 24, 1, false, kiyafetRenk());
  $("#sz-nasil").onclick = sezonNasil;
  $("#sz-kapat").onclick = () => { if (confirm(szM("Sezon şimdi kapansın mı? Kalan günler kullanılmaz.", "Close the season now? The remaining days are lost."))) sezonSonu(); };
  $$("[data-not]").forEach(t => t.onchange = () => { const d = (s.defter || []).find(x => String(x.g) === t.dataset.not); if (d) { d.not = t.value.slice(0, 280); kaydet(); bildir(szM("Not deftere yazıldı", "Note saved to the notebook")); } });
  szBugunCiz();
}
function szDefterHtml(d) {
  const h = KZ_HAVA[d.hava] || KZ_HAVA.gunes;
  return `<article class="sz-sayfa"><p class="sz-sayfa-ust"><b>${szM("Gün {g}", "Day {g}", { g: d.g })}</b> · ${esc(tarihYaz(d.t))} · ${h.simge}${d.is ? ` · ${IS[d.is] ? IS[d.is].simge : ""}` : ""}${d.puan ? ` · ⭐ ${d.puan}` : ""}</p>
    ${d.olay ? `<p class="sz-sayfa-olay">❗ ${esc(d.olay)}</p>` : ""}${d.metin ? `<p>${esc(d.metin)}</p>` : ""}
    <textarea class="not-alani sz-not" rows="2" maxlength="280" data-not="${d.g}" placeholder="${szM("Kendi notun: gözlem, kesit, yorum…", "Your note: observations, section, interpretation…")}">${esc(d.not || "")}</textarea></article>`;
}
/* Bugünün kartı: güne başla → (sahne, olay) → iş seçimi → iş → gün sonu */
function szBugunCiz() {
  const s = D.kzSezon, kap = $("#sz-bugun"); if (!s || !kap) return;
  const a = szAlan(s), b = s.bugun, e = sezonEnerji();
  if (!b) {
    kap.innerHTML = `<h3>${szM("Gün {g} sabahı", "Morning of day {g}", { g: s.gun })}</h3>
      <p class="aciklama">${szM("Bugün kalan sezon günü: {k}/{t}. Her gerçek gün {t} yeni sezon günü gelir.", "Season days left today: {k}/{t}. You get {t} new season days every real day.", { k: e.kalan, t: SZ_GUNLUK })}</p>
      <p class="sz-eylem"><button class="buyuk-dugme" id="sz-gune-basla" ${e.kalan ? "" : "disabled"}>${e.kalan ? szM("Güne başla", "Start the day") : szM("Yarın yeni sezon günleri!", "New season days tomorrow!")}</button></p>`;
    const d = $("#sz-gune-basla"); if (d) d.onclick = szGuneBasla;
    return;
  }
  if (b.olay && !b.olayBitti) return szOlayGoster();
  if (!b.is) {
    const lab = szLabAdaylari(s).length, res = !s.restore && YAPILAR[a.id];
    kap.innerHTML = `<h3>${szM("Bugün ne yapalım?", "What shall we do today?")}</h3>
      <div class="sz-isler">${Object.entries(IS).map(([id, x]) => {
        const kapali = (id === "lab" && !lab) || (id === "restore" && !res);
        const neden = id === "lab" && !lab ? szM("İncelenecek buluntu yok", "Nothing to study yet") : id === "restore" && !res ? szM("Bu sezon yapıldı", "Done this season") : "";
        const ek = id === "kaz" ? szM("{n} vuruş", "{n} strikes", { n: szKazVurus(s) }) : id === "lab" ? szM("{n} buluntu bekliyor", "{n} finds waiting", { n: lab }) : id === "restore" && res ? szL(YAPILAR[a.id].ad) : id === "yuzey" ? szM("Yeni alan keşfet", "Discover a new site") : szM("Moral +{n}", "Morale +{n}", { n: x.moral });
        return `<button class="sz-is" data-is="${id}" ${kapali || s.butce < x.butce ? "disabled" : ""}><span class="sz-is-simge">${x.simge}</span>
          <span><b>${esc(szL(x.ad))}</b><small>${esc(neden || ek)}</small></span><em>💰 −${x.butce}</em></button>`; }).join("")}</div>`;
    $$("[data-is]").forEach(d => d.onclick = () => szIsBasla(d.dataset.is));
    return;
  }
  if (!b.bitti) {
    kap.innerHTML = `<h3>${IS[b.is].simge} ${esc(szL(IS[b.is].ad))}</h3><p class="sz-eylem"><button class="buyuk-dugme" id="sz-ise-don">${szM("İşe dön", "Back to work")}</button></p>`;
    $("#sz-ise-don").onclick = () => szIsDevam();
    return;
  }
  const d = (s.defter || []).find(x => x.g === s.gun) || {};
  kap.innerHTML = `<h3>${szM("Gün {g} bitti", "Day {g} is done", { g: s.gun })}</h3>
    <p>${esc(d.metin || "")}</p>
    <textarea class="not-alani" id="sz-gun-not" rows="3" maxlength="280" placeholder="${szM("Deftere bugünün notunu yaz (isteğe bağlı)", "Write today's note in the notebook (optional)")}">${esc(d.not || "")}</textarea>
    <p class="sz-eylem"><button class="buyuk-dugme" id="sz-gunu-kapat">${s.gun >= s.sure || s.butce < 2 ? szM("Sezonu bitir", "End the season") : szM("Günü kapat", "Close the day")}</button></p>`;
  $("#sz-gunu-kapat").onclick = () => {
    const not = $("#sz-gun-not").value.trim().slice(0, 280);
    if (not) { const x = (s.defter || []).find(y => y.g === s.gun); if (x) x.not = not; }
    if (s.gun >= s.sure || s.butce < 2) { kaydet(); return sezonSonu(); }
    s.gun++; s.bugun = null; kaydet(); oyunSesi("tus"); sayfaSezon();
  };
}
function szGuneBasla() {
  const s = D.kzSezon, a = szAlan(s), e = sezonEnerji();
  if (!e.kalan) return;
  if (!szYonetici()) e.kalan--;
  const uygun = OLAYLAR.filter(o => (!o.kosul || o.kosul(a, s)) && !(s.olaylar || []).includes(o.id));
  const olay = s.gun > 1 && uygun.length && Math.random() < 0.65 ? uygun[Math.floor(Math.random() * uygun.length)].id : null;
  s.bugun = { hava: szHava(a), olay, olayBitti: !olay, is: null, bitti: false };
  if (olay) s.olaylar = [...(s.olaylar || []), olay];
  kaydet();
  const h = KZ_HAVA[s.bugun.hava];
  const satir = [szM("Gün {g}. {simge} {hava}.", "Day {g}. {simge} {hava}.", { g: s.gun, simge: h.simge, hava: havaAd(h) }) + (havaAciklama(h) ? " " + havaAciklama(h) : "")];
  if (s.gun === 1) satir.unshift(szL(SAHNELER[a.id]));
  araSahne(a, satir, () => sayfaSezon());
}
function szOlayGoster() {
  const s = D.kzSezon, o = OLAYLAR.find(x => x.id === s.bugun.olay);
  if (!o) { s.bugun.olayBitti = true; kaydet(); return szBugunCiz(); }
  oyunSesi("ipucu"); if (navigator.vibrate) try { navigator.vibrate([20, 40, 20]); } catch (e) {}
  levhaAc(`<div class="sz-olay"><p class="kz-yeni">❗ ${szM("Gün {g}", "Day {g}", { g: s.gun })}</p><h3>${esc(szL(o.metin))}</h3>
    <div class="sz-secenekler">${o.secenek.map((x, i) => `<button class="sz-secenek" data-s="${i}"><b>${esc(szL(x.ad))}</b><span>${etkiYaz(x.etki)}</span></button>`).join("")}</div></div>`, lv => {
    lv.querySelectorAll("[data-s]").forEach(d => d.onclick = () => {
      const x = o.secenek[+d.dataset.s];
      szUygula(s, x.etki); s.bugun.olayBitti = true;
      szDefter(s, { olay: `${szL(o.metin)} → ${szL(x.ad)}. ${szL(x.sonuc)}`, puan: (x.etki && x.etki.puan) || 0 });
      kaydet(); oyunSesi("tus");
      lv.innerHTML = `<div class="sz-olay"><h3>${esc(szL(x.ad))}</h3><p>${esc(szL(x.sonuc))}</p><p>${etkiYaz(x.etki)}</p>
        <p style="margin-top:14px"><button class="buyuk-dugme" id="sz-olay-tamam">${szM("Tamam", "OK")}</button></p></div>`;
      lv.querySelector("#sz-olay-tamam").onclick = () => { levhaKapat(); sayfaSezon(); };
    });
  });
  // perdeye dokunup kapatırsa olay bekler (seçim zorunlu); sayfa yeniden çizilince tekrar sorulur
  const kap = $("#sz-bugun");
  if (kap) { kap.innerHTML = `<h3>❗ ${szM("Karar bekleyen bir durum var", "A decision is waiting")}</h3><p class="sz-eylem"><button class="buyuk-dugme" id="sz-olay-ac">${szM("Göster", "Show")}</button></p>`; $("#sz-olay-ac").onclick = szOlayGoster; }
}
function szIsBasla(id) {
  const s = D.kzSezon, x = IS[id];
  if (!s || !s.bugun || s.bugun.is || s.butce < x.butce) return;
  s.butce -= x.butce; s.moral = sinirla(s.moral + x.moral, 0, 100);
  s.bugun.is = id;
  if (id === "kaz") s.bugun.vurus = szKazVurus(s);
  kaydet(); oyunSesi("tus");
  if (id === "dinlen") return szIsBitti({ metin: szM("Dinlenme günü. Ekip çamaşır yıkadı, buluntu fişleri yazıldı, akşam kazı evinde uzun bir sohbet oldu.", "A rest day. The team did laundry, filled in find cards and talked long into the evening at the dig house.") });
  szIsDevam();
}
function szIsDevam() {
  const s = D.kzSezon, b = s && s.bugun; if (!b) return;
  if (b.is === "kaz") return szKazBasla();
  if (b.is === "yuzey") return yuzeyOyunu();
  if (b.is === "lab") return labOyunu();
  if (b.is === "restore") return restorasyonOyunu();
}
function szIsBitti({ metin, puan = 0, itibar = 0 }) {
  const s = D.kzSezon; if (!s || !s.bugun) return;
  s.puan += puan; s.itibar = (s.itibar || 0) + itibar;
  s.bugun.bitti = true;
  const once = (s.defter || []).find(x => x.g === s.gun);
  szDefter(s, { is: s.bugun.is, metin, puan: ((once && once.puan) || 0) + puan });
  kaydet();
  if (location.hash !== "#oyun/kazi/sezon") location.hash = "#oyun/kazi/sezon"; else sayfaSezon();
}

/* ---------------------------------------------------------------- sezon seçimi ve sonu */
function sezonSecimi() {
  const k = kariyer(), d = D.buluntuDefteri || {};
  const bolge = D.kzBolge === "dunya" ? "dunya" : "anadolu";
  const alanlar = KZ_ALANLAR.filter(a => (a.bolge || "anadolu") === bolge);
  $("#sayfa").innerHTML = `<div class="kazi-oyun sz">${kariyerHtml()}
    <div class="kz-ust"><p>${szM("Sezonu nerede açacaksın? Kazı yalnız keşfedilmiş alanlarda yapılır; yenilerini sezon içindeki yüzey araştırmalarıyla bulursun.", "Where will you open the season? You can only dig at discovered sites; find new ones with field surveys during a season.")}</p>
      <p class="kz-izin">${szM("Sezon: {n} gün · Bütçe: {b} · Unvanın yükseldikçe ikisi de artar.", "Season: {n} days · Budget: {b} · Both grow with your title.", { n: sezonSuresi(), b: sezonButcesi() })}</p></div>
    <div class="bolumlu kucuk kz-bolge" role="group"><button data-bolge="anadolu" aria-pressed="${bolge === "anadolu"}">${tx("Anadolu")}</button><button data-bolge="dunya" aria-pressed="${bolge === "dunya"}">${tx("Dünya")}</button></div>
    <div class="kz-alanlar">${alanlar.map(a => { const acik = alanKesfedildi(a);
      return `<button class="kz-alan${acik ? "" : " sz-kilitli"}" data-sz-alan="${a.id}"><canvas width="160" height="48"></canvas>
        <span><b>${acik ? esc(kzAlanAd(a)) : "🔒 " + szM("Keşfedilmemiş alan", "Undiscovered site")}</b><small>${acik ? `${esc(kzAlanIl(a))} · ${esc(DIL === "en" ? a.donem_en : a.donem)}` : szM("Yüzey araştırmasıyla keşfet", "Discover it with a field survey")}</small>
        ${acik ? `<em>${YAPILAR[a.id] ? "🏛 " + esc(szL(YAPILAR[a.id].ad)) : ""}${k.yapilar[a.id] ? " ✓" : ""}</em>` : ""}</span></button>`; }).join("")}</div>
    <p class="kz-alt-dugmeler"><a class="ikincil-dugme" href="#oyun/kazi">${szM("Kazı Başı'na dön", "Back to Dig Site")}</a>${(D.kzArsiv || []).length ? `<a class="ikincil-dugme" href="#oyun/kazi/arsiv">📚 ${szM("Geçmiş sezonlar", "Past seasons")}</a>` : ""}</p></div>`;
  $$("[data-bolge]").forEach(b => b.onclick = () => { D.kzBolge = b.dataset.bolge; kaydet(); sezonSecimi(); });
  $$("[data-sz-alan]").forEach(b => {
    const a = KZ_ALANLAR.find(x => x.id === b.dataset.szAlan), acik = alanKesfedildi(a), ctx = b.querySelector("canvas").getContext("2d");
    kzSahne(ctx, a, 160);
    if (!acik) { ctx.fillStyle = "rgba(40,30,22,.72)"; ctx.fillRect(0, 0, 160, 48); }
    b.onclick = () => {
      if (!acik) { bildir(szM("Bu alan henüz keşfedilmedi. Bir sezonda yüzey araştırması yap.", "This site isn't discovered yet. Do a field survey during a season.")); return; }
      const basla = () => sezonBaslat(a);
      arkeolog() ? basla() : arkeologSecimi(basla);
    };
  });
}
function sezonBaslat(a) {
  const butce = sezonButcesi();
  D.kzSezon = { id: Date.now().toString(36), alan: a.id, baslangic: oyunGunu(), gun: 1, sure: sezonSuresi(), butce, butce0: butce, moral: 80, puan: 0, itibar: 0,
    acma: szAcmaKur(a), defter: [], bulunan: [], tarihlenen: {}, olaylar: [], ekVurus: 0, bugun: null };
  kaydet();
  if (location.hash !== "#oyun/kazi/sezon") location.hash = "#oyun/kazi/sezon"; else sayfaSezon();
}
function sezonSonu() {
  const s = D.kzSezon; if (!s) return;
  const a = szAlan(s), k = kariyer();
  const itibar = Math.max(0, Math.round(s.puan / 20) + (s.itibar || 0));
  const onceki = unvanSira();
  k.itibar += itibar; k.sezonlar++;
  const yeniUnvan = unvanSira() > onceki ? KZ_UNVANLAR[unvanSira()] : null;
  D.kzArsiv = [{ id: s.id, alan: s.alan, bas: s.baslangic, bit: oyunGunu(), gun: s.gun, puan: s.puan, itibar, defter: s.defter || [] }, ...(D.kzArsiv || []).filter(x => x.id !== s.id)].slice(0, 12);
  D.kzSezon = null;
  const kd = kaziDurumu();
  kd.toplam += s.puan; kd.kosular.push({ alan: s.alan, puan: s.puan, sezon: 1 });
  kaydet();
  try { skorGonder("kazi", kd.toplam, `${kd.kosular.length} kazı`); } catch (e) {}
  try { if (typeof rozetVer === "function") { rozetVer("ilk_sezon"); if (yeniUnvan && unvanSira() >= 5) rozetVer("kazi_baskani"); } } catch (e) {}
  oyunSesi("bitis");
  araSahne(a, [szM("Sezon kapandı. Açma örtüldü, buluntular envantere girdi ve müzeye teslim edilecek; sezon raporu yazılıyor.", "The season is over. The trench is covered, the finds are inventoried for the museum and the season report is being written.")], () => {
    levhaAc(`<div class="kz-buluntu"><h3>🗓 ${szM("Sezon raporu", "Season report")}</h3>
      <p>${esc(kzAlanAd(a))} · ${szM("{g} gün", "{g} days", { g: s.gun })} · ${szM("{n} buluntu", "{n} finds", { n: (s.bulunan || []).length })}</p>
      <p class="kz-toplam">${szM("Sezon puanı", "Season score")}: <b>${s.puan}</b> · ${szM("İtibar", "Reputation")}: <b>+${itibar}</b></p>
      ${yeniUnvan ? `<p class="kz-yeni">🎓 ${szM("Yeni unvan: {u}!", "New title: {u}!", { u: szL(yeniUnvan) })}</p>` : ""}
      <p class="aciklama">${szM("Sezon puanı bugünkü Kazı Başı skoruna eklendi.", "The season score was added to today's Dig Site score.")}</p>
      <p style="margin-top:14px"><button class="buyuk-dugme" id="sz-rapor-tamam">${szM("Kazı Başı'na dön", "Back to Dig Site")}</button></p>
      <p style="text-align:center"><button class="ikincil-dugme" id="sz-paylas">${szM("Defteri paylaş", "Share the notebook")}</button></p></div>`, lv => {
      lv.querySelector("#sz-rapor-tamam").onclick = () => { levhaKapat(); location.hash = "#oyun/kazi"; };
      lv.querySelector("#sz-paylas").onclick = () => sezonPaylas(D.kzArsiv[0]);
    });
  }, szM("Raporu gör", "See the report"));
}
function sezonPaylas(x) {
  if (!x) return;
  const a = KZ_ALANLAR.find(y => y.id === x.alan);
  const metin = `Arkix · ${szM("Kazı Sezonu", "Field Season")} · ${a ? kzAlanAd(a) : ""}\n⭐ ${x.puan} · ${szM("{g} gün", "{g} days", { g: x.gun })}\n\n${(x.defter || []).map(d => `${szM("Gün {g}", "Day {g}", { g: d.g })}: ${[d.metin, d.not].filter(Boolean).join(" · ")}`).join("\n").slice(0, 1800)}`;
  paylasLevhasi({ baslik: szM("Kazı Defteri", "Excavation Notebook"), url: "https://arkix.harrixapp.com/#oyun/kazi", metin });
}
function sayfaSezonArsiv() {
  $("#baslik").textContent = szM("Geçmiş sezonlar", "Past seasons");
  const l = D.kzArsiv || [];
  $("#sayfa").innerHTML = `<div class="kazi-oyun sz">${kariyerHtml()}
    ${l.length ? l.map((x, i) => { const a = KZ_ALANLAR.find(y => y.id === x.alan);
      return `<details class="sz-arsiv"><summary><b>${a ? esc(kzAlanAd(a)) : "?"}</b> · ${esc(tarihYaz(x.bas))} · ⭐ ${x.puan} · 🎓 +${x.itibar}</summary>
        ${(x.defter || []).map(d => `<article class="sz-sayfa"><p class="sz-sayfa-ust"><b>${szM("Gün {g}", "Day {g}", { g: d.g })}</b> · ${(KZ_HAVA[d.hava] || KZ_HAVA.gunes).simge}${d.puan ? ` · ⭐ ${d.puan}` : ""}</p>
          ${d.olay ? `<p class="sz-sayfa-olay">❗ ${esc(d.olay)}</p>` : ""}${d.metin ? `<p>${esc(d.metin)}</p>` : ""}${d.not ? `<p class="sz-not-yazi">✎ ${esc(d.not)}</p>` : ""}</article>`).join("")}
        <p><button class="ikincil-dugme" data-paylas="${i}">${szM("Paylaş", "Share")}</button></p></details>`; }).join("")
      : bosHtml(szM("Henüz sezon yok", "No seasons yet"), "")}
    <p class="kz-alt-dugmeler"><a class="ikincil-dugme" href="#oyun/kazi">${szM("Kazı Başı'na dön", "Back to Dig Site")}</a></p></div>`;
  $$("[data-paylas]").forEach(b => b.onclick = () => sezonPaylas(l[+b.dataset.paylas]));
}
function sezonNasil() {
  D.nasilGoruldu = D.nasilGoruldu || {}; D.nasilGoruldu.sezon = true; kaydet();
  levhaAc(`<div class="nasil"><h3>🗓 ${szM("Kazı Sezonu nasıl oynanır?", "How the Field Season works")}</h3>
    <p class="nasil-adim"><b>1</b> ${szM("Keşfedilmiş bir alanda sezon aç. Sezon {n} gün sürer; açman günler boyunca kalır.", "Open a season at a discovered site. It lasts {n} days and your trench stays open the whole time.", { n: sezonSuresi() })}</p>
    <p class="nasil-adim"><b>2</b> ${szM("Her sabah hava ve bazen bir olay gelir. Seçimin bütçeyi, morali, itibarı ve o günkü vuruşları etkiler. Gerçek kazı pratiğine uygun karar ver.", "Each morning brings the weather and sometimes an event. Your choice affects budget, morale, reputation and the day's strikes. Decide as a real excavator would.")}</p>
    <p class="nasil-adim"><b>3</b> ${szM("Günün işini seç: kaz, yüzey araştırmasıyla yeni alan keşfet, laboratuvarda buluntuları tarihlendir, alanın yapısını restore et ya da ekibi dinlendir. Her işin bütçesi var.", "Choose the day's work: dig, discover new sites by field survey, date finds in the lab, restore the site's building or rest the team. Each job costs budget.")}</p>
    <p class="nasil-adim"><b>4</b> ${szM("Her gün Kazı Defteri'ne yazılır; kendi notunu ekle. Moral düşerse vuruşlar azalır, bütçe biterse sezon kapanır.", "Every day goes into the Excavation Notebook; add your own note. Low morale means fewer strikes; when the budget runs out, the season ends.")}</p>
    <p class="nasil-adim"><b>5</b> ${szM("Sezon sonunda puanın Kazı Başı skoruna eklenir, itibar kazanırsın. Unvanın yükseldikçe sezon uzar, bütçe artar.", "At the end your score joins your Dig Site total and you earn reputation. Higher titles bring longer seasons and bigger budgets.")}</p>
    <p class="aciklama">${szM("Her gerçek gün {t} sezon günü oynayabilirsin. Kazıda karenin üstüne basılı tutarsan fırçayla kazarsın.", "You can play {t} season days per real day. While digging, press and hold a square to use the brush.", { t: SZ_GUNLUK })}</p>
    <p style="margin-top:14px"><button class="buyuk-dugme" onclick="levhaKapat()">${szM("Başla", "Start")}</button></p></div>`);
}

/* ---------------------------------------------------------------- 1) kazı günü (kazi-oyun.js'in açmasıyla) */
function szKazBasla() {
  const s = D.kzSezon, a = szAlan(s), b = s.bugun;
  const hucreler = s.acma.map(h => acmaHucre(h, a));
  const kalanDegerli = hucreler.filter(h => h.buluntu && h.derinlik > 0 && !sikMi(h.buluntu)).length;
  const camur = new Set();
  if (b.hava === "yagmur") { if (b.camur == null) b.camur = Math.floor(Math.random() * (KZ_SATIR - 1)); camur.add(b.camur); camur.add(b.camur + 1); }
  const bugunBulunan = (b.bulunan || []).map(id => buluntuBul(id, a)).filter(Boolean);
  const bugunDegerli = bugunBulunan.filter(x => !sikMi(x)).length;   // kzKaz bugünküleri de sayar
  kzBasla(a, false, { hucreler, vurus: b.vurus, hava: b.hava, camur, ozelSayi: kalanDegerli ? kalanDegerli + bugunDegerli : Infinity, puan: b.puan || 0, gun: s.gun, bulunan: bugunBulunan });
}
/* kzCiz her çizimde çağırır: değişiklik varsa açmayı ve günün durumunu kaydeder (yenilemede kaldığı yerden sürer) */
function sezonAnlik() {
  const s = D.kzSezon; if (!s || !s.bugun || !KZ || !KZ.sezon) return;
  const imza = `${KZ.vurus}|${KZ.puan}|${KZ.bulunan.length}|${KZ.restore}`;
  if (KZ.sezonImza === imza) return;
  KZ.sezonImza = imza;
  s.acma = KZ.hucreler.map(hucreAcma);
  s.bugun.vurus = KZ.vurus; s.bugun.puan = KZ.puan; s.bugun.bulunan = KZ.bulunan.map(b => b.id);
  kaydet();
}
function sezonKaziBitti(hepsi) {
  const s = D.kzSezon; if (!s || !s.bugun) { location.hash = "#oyun/kazi"; return; }
  sezonAnlik();
  const bonus = hepsi && KZ.vurus > 0 ? KZ.vurus * 5 : 0;
  const ozel = KZ.bulunan.filter(b => !sikMi(b)), sik = KZ.bulunan.length - ozel.length;
  s.bulunan = [...(s.bulunan || []), ...KZ.bulunan.filter(b => !KZ.hucreler.some(h => h.buluntu === b && h.kirik && !h.restore)).map(b => b.id)];
  const metin = [szM("Açmada kazı.", "Dug the trench."),
    ozel.length ? szM("Değerli buluntular: {l}.", "Notable finds: {l}.", { l: ozel.map(kzAd).join(", ") }) : szM("Değerli buluntu çıkmadı.", "No notable finds."),
    sik ? szM("{n} sık buluntu (seramik, kemik, taş, elek).", "{n} common finds (pottery, bone, stone, sieve).", { n: sik }) : "",
    KZ.kirik ? szM("{n} buluntu kırık çıktı.", "{n} finds came out broken.", { n: KZ.kirik }) : "",
    bonus ? szM("Bütün değerliler çıktı: kalan vuruş bonusu +{b}.", "All notable finds recovered: remaining strike bonus +{b}.", { b: bonus }) : ""].filter(Boolean).join(" ");
  const puan = KZ.puan + bonus;
  s.bugun.puan = 0;   // KZ.puan sezon puanına bir kez eklenir
  oyunSesi("bitis");
  szIsBitti({ metin, puan });
}

/* ---------------------------------------------------------------- 2) yüzey araştırması (alan keşfi) */
const YZ_N = 7, YZ_ADIM = 9;
function yuzeyOyunu() {
  const s = D.kzSezon, b = s.bugun;
  if (!b.yuzey) {
    const hedef = Math.floor(Math.random() * YZ_N * YZ_N);
    b.yuzey = { hedef, acik: {}, zemin: Array.from({ length: YZ_N * YZ_N }, () => "ttccsd"[Math.floor(Math.random() * 6)]) };
    kaydet();
  }
  const y = b.yuzey;
  const uzak = i => Math.max(Math.abs(i % YZ_N - y.hedef % YZ_N), Math.abs(Math.floor(i / YZ_N) - Math.floor(y.hedef / YZ_N)));
  const adim = Object.keys(y.acik).length, bulundu = y.acik[y.hedef] != null;
  const ZEMIN = { t: "#c9b27a", c: "#a7b06e", s: "#b3a796", d: "#8fb0b8" };
  $("#baslik").textContent = szL(IS.yuzey.ad);
  $("#sayfa").innerHTML = `<div class="kazi-oyun sz"><div class="kz-ust"><p>${szM("Ekibinle vadiyi tara. Dokunduğun karede yerdeki seramik ve taş parçalarını sayarsın: yerleşime yaklaştıkça yüzey buluntusu artar.", "Walk the valley with your team. Each square you tap counts the pottery and stone on the surface: the closer to a settlement, the more you find.")}</p>
    <p class="kz-izin">${szM("Kalan tarama: {n}", "Survey walks left: {n}", { n: YZ_ADIM - adim })} · 🟤 ${szM("3: yerleşim · 2: çok yakın · 1: yakın", "3: settlement · 2: very close · 1: close")}</p></div>
    <div class="sz-yuzey" style="--n:${YZ_N}">${y.zemin.map((z, i) => { const v = y.acik[i];
      return `<button data-y="${i}" style="background:${ZEMIN[z] || ZEMIN.t}" ${v != null || bulundu || adim >= YZ_ADIM ? "disabled" : ""} aria-label="${szM("Kare {n}", "Square {n}", { n: i + 1 })}">${v == null ? "" : v === 3 ? "🏚" : "🟤".repeat(v) || "0"}</button>`; }).join("")}</div>
    <p class="kz-alt-dugmeler">${bulundu || adim >= YZ_ADIM ? `<button class="buyuk-dugme" id="yz-bitir">${szM("Günü tamamla", "Finish the day")}</button>` : ""}</p></div>`;
  $$("[data-y]").forEach(d => d.onclick = () => {
    const i = +d.dataset.y, u = uzak(i);
    y.acik[i] = u === 0 ? 3 : u === 1 ? 2 : u === 2 ? 1 : 0;
    oyunSesi(u === 0 ? "buluntu" : u <= 2 ? "sik" : "adim");
    if (navigator.vibrate) try { navigator.vibrate(u === 0 ? [30, 50, 30] : 8); } catch (e) {}
    kaydet(); yuzeyOyunu();
    if (u === 0) setTimeout(yuzeyKesif, 400);
  });
  const bt = $("#yz-bitir"); if (bt) bt.onclick = () => bulundu ? yuzeyKesif() : yuzeyBitir(false);
}
function yuzeyKesif() {
  const s = D.kzSezon, b = s.bugun; if (!b || b.bitti) return;
  const ilk = KZ_ALANLAR.filter(a => !alanKesfedildi(a)), a0 = szAlan(s);
  const ayni = ilk.filter(a => (a.bolge || "anadolu") === (a0.bolge || "anadolu"));
  const yeni = (ayni.length ? ayni : ilk)[Math.floor(Math.random() * (ayni.length || ilk.length))];
  if (!yeni) return yuzeyBitir(true, null);
  kariyer().kesif[yeni.id] = oyunGunu(); kaydet();
  try { if (typeof rozetVer === "function") rozetVer("kesif"); } catch (e) {}
  araSahne(yeni, [szM("Yeni alan keşfedildi: {a}!", "New site discovered: {a}!", { a: kzAlanAd(yeni) }), szL(SAHNELER[yeni.id])], () => yuzeyBitir(true, yeni));
}
function yuzeyBitir(bulundu, yeni) {
  const s = D.kzSezon, y = s.bugun.yuzey || { acik: {} };
  const izli = Object.values(y.acik).filter(v => v > 0).length;
  if (!bulundu) return szIsBitti({ metin: szM("Yüzey araştırması: {n} karede yüzey malzemesi toplandı, yerleşim yeri bulunamadı.", "Field survey: surface material collected in {n} squares; no settlement found.", { n: izli }), puan: izli * 10 });
  szIsBitti({ metin: yeni ? szM("Yüzey araştırması: yoğun bir yüzey buluntusu saçılımı izlendi ve yeni bir alan belgelendi: {a}.", "Field survey: a dense scatter of surface finds was traced and a new site recorded: {a}.", { a: kzAlanAd(yeni) })
    : szM("Yüzey araştırması: yeni bir buluntu yeri belgelendi ve koordinatları alındı.", "Field survey: a new find spot was recorded and its coordinates taken."), puan: yeni ? 80 : 60, itibar: yeni ? 20 : 10 });
}

/* ---------------------------------------------------------------- 3) laboratuvar (tarihlendirme ve yöntem) */
function labOyunu() {
  const s = D.kzSezon, b = s.bugun;
  if (!b.lab) { b.lab = { liste: karistir(szLabAdaylari(s), Math.random).slice(0, 3), sira: 0, dogru: 0, puan: 0, notlar: [] }; kaydet(); }
  const l = b.lab;
  if (l.sira >= l.liste.length) return szIsBitti({ metin: szM("Laboratuvar: {n} buluntu incelendi, {d} doğru tarihlendirme. {notlar}", "Lab: {n} finds studied, {d} correctly dated. {notlar}", { n: l.liste.length, d: l.dogru, notlar: l.notlar.join(" ") }), puan: l.puan });
  const id = l.liste[l.sira], bul = buluntuBul(id), alan = buluntuAlani(id), a0 = szAlan(s);
  let soru, dogru, secenek;
  if (alan) {
    soru = szM("Bu buluntu hangi döneme ait?", "Which period does this find belong to?");
    dogru = DIL === "en" ? alan.donem_en : alan.donem;
    const diger = [...new Set(KZ_ALANLAR.filter(x => x.id !== alan.id).map(x => DIL === "en" ? x.donem_en : x.donem))].filter(x => x !== dogru);
    secenek = karistir([dogru, ...karistir(diger, Math.random).slice(0, 3)], Math.random);
  } else {
    soru = szM("Bu buluntu en iyi hangi yöntemle tarihlenir?", "Which method dates this find best?");
    const y = BULUNTU_YONTEM[id]; dogru = szL(YONTEM[y]);
    secenek = karistir([dogru, ...karistir(Object.keys(YONTEM).filter(k => k !== y && !(y === "c14" && k === "dendro")).map(k => szL(YONTEM[k])), Math.random).slice(0, 3)], Math.random);
  }
  $("#baslik").textContent = szL(IS.lab.ad);
  $("#sayfa").innerHTML = `<div class="kazi-oyun sz"><div class="sz-lab">
    <p class="kz-izin">${szM("Buluntu {i}/{n}", "Find {i}/{n}", { i: l.sira + 1, n: l.liste.length })}</p>
    <canvas width="144" height="144" id="lab-tuval"></canvas><h3>${esc(kzAd(bul))}</h3>
    <p><b>${soru}</b></p><div class="kz-tanim-secenek">${secenek.map((x, i) => `<button class="ikincil-dugme" data-l="${i}">${esc(x)}</button>`).join("")}</div>
    <p class="aciklama" id="lab-yorum"></p><p id="lab-ileri"></p></div></div>`;
  const ctx = $("#lab-tuval").getContext("2d"); ctx.fillStyle = (alan || a0).toprak[3]; ctx.fillRect(0, 0, 144, 144); spriteCiz(ctx, id, 0, 0, 12);
  $$("[data-l]").forEach(d => d.onclick = () => {
    const ok = secenek[+d.dataset.l] === dogru;
    $$("[data-l]").forEach(x => { x.disabled = true; if (secenek[+x.dataset.l] === dogru) { x.classList.add("dogru"); x.textContent = "✓ " + x.textContent; } else if (x === d) { x.classList.add("yanlis"); x.textContent = "✗ " + x.textContent; } });
    const p = ok ? (alan ? 40 : 20) : 0;
    l.puan += p; if (ok) l.dogru++;
    s.tarihlenen = s.tarihlenen || {}; s.tarihlenen[id] = ok ? 1 : 0;
    l.notlar.push(`${kzAd(bul)}: ${dogru}.`);
    l.sira++; kaydet();
    oyunSesi(ok ? "yerinde" : "sil", 3);
    $("#lab-yorum").textContent = `${ok ? "✓ +" + p + " " : ""}${kzBilgi(bul)}`;
    $("#lab-ileri").innerHTML = `<button class="buyuk-dugme" id="lab-devam">${l.sira >= l.liste.length ? szM("Raporu yaz", "Write the report") : szM("Sıradaki buluntu", "Next find")}</button>`;
    $("#lab-devam").onclick = labOyunu;
  });
}

/* ---------------------------------------------------------------- 4) mimari restorasyon */
function restorasyonOyunu() {
  const s = D.kzSezon, a = szAlan(s), y = YAPILAR[a.id], b = s.bugun;
  if (!y) return szIsBitti({ metin: "", puan: 0 });
  const W = Math.max(...y.h.map(r => r.length)), H = y.h.length;
  const plan = y.h.map(r => r.padEnd(W, ".")).join("");
  if (!b.restore) { b.restore = { dolu: {}, hata: 0, sec: null }; kaydet(); }
  const r = b.restore;
  const kalan = t => [...plan].filter((c, i) => c === t && !r.dolu[i]).length;
  const tipler = Object.keys(y.tip).filter(t => plan.includes(t));
  const bitti = [...plan].every((c, i) => c === "." || r.dolu[i]);
  const destek = i => {
    if (y.duz && !y.sirali) return true;
    const x = i % W, sat = Math.floor(i / W);
    if (sat === H - 1) return true;
    if (r.dolu[i + W]) return true;
    if (y.sirali) return false;
    return (x > 0 && r.dolu[i - 1]) || (x < W - 1 && r.dolu[i + 1]);
  };
  const renk = t => y.tip[t][0], ad = t => DIL === "en" ? y.tip[t][2] : y.tip[t][1];
  $("#baslik").textContent = szL(IS.restore.ad);
  $("#sayfa").innerHTML = `<div class="kazi-oyun sz"><div class="kz-ust"><p><b>🏛 ${esc(szL(y.ad))}</b></p>
    <p class="aciklama">${y.sirali ? szM("Plan yok: dönemleri bilginle sırala. Kesit alttan üste kurulur; en eski katman en altta. Bir dokunuş bütün katmanı serer.", "No plan here: order the periods from what you know. A section is built bottom up, oldest layer at the bottom. One tap lays the whole layer.")
      : y.duz ? szM("Plana bak, doğru parçayı doğru yuvaya koy.", "Read the plan and put the right piece in the right slot.")
      : szM("Plana bak, parçayı seç ve yuvasına koy. Yapı alttan üste kurulur: bir taş ancak altı ya da yanı doluysa oturur.", "Read the plan, pick a piece and place it. Build from the bottom up: a stone sits only on or beside another.")}</p>
    <p class="kz-izin">${szM("Hata: {n}", "Mistakes: {n}", { n: r.hata })}</p></div>
    ${y.sirali ? "" : `<div class="sz-yapi-ust"><div class="sz-plan" style="--w:${W}" aria-label="${szM("Plan", "Plan")}">${[...plan].map(c => `<i style="${c === "." ? "" : `background:${renk(c)}`}"></i>`).join("")}</div>
      <p class="aciklama">${szM("Plan", "Plan")}</p></div>`}
    <div class="sz-yapi" style="--w:${W}">${[...plan].map((c, i) => c === "." ? `<span></span>` : `<button data-yv="${i}" class="${r.dolu[i] ? "dolu" : ""}" style="${r.dolu[i] ? `background:${renk(c)}` : ""}" ${r.dolu[i] || bitti ? "disabled" : ""} aria-label="${r.dolu[i] ? esc(ad(c)) : szM("Boş yuva", "Empty slot")}"></button>`).join("")}</div>
    <div class="sz-parcalar">${tipler.map(t => `<button data-tip="${t}" aria-pressed="${r.sec === t}" ${kalan(t) ? "" : "disabled"}><i style="background:${renk(t)}"></i><span>${esc(ad(t))}</span><b>×${kalan(t)}</b></button>`).join("")}</div>
    ${bitti ? `<div class="sz-yapi-son"><p class="kz-yeni">✨ ${szM("Restorasyon tamamlandı!", "Restoration complete!")}</p><p>${esc(szL(y.bilgi))}</p>
      <p><button class="buyuk-dugme" id="rs-bitir">${szM("Günü tamamla", "Finish the day")}</button></p></div>` : ""}</div>`;
  $$("[data-tip]").forEach(d => d.onclick = () => { r.sec = d.dataset.tip; kaydet(); oyunSesi("tus"); restorasyonOyunu(); });
  $$("[data-yv]").forEach(d => d.onclick = () => {
    const i = +d.dataset.yv, beklenen = plan[i];
    if (!r.sec) { bildir(szM("Önce aşağıdan bir parça seç", "Pick a piece below first")); return; }
    if (!destek(i)) { r.hata++; kaydet(); oyunSesi("sil"); bildir(y.sirali ? szM("Kesit alttan kurulur: önce alttaki katman", "A section is built from the bottom: the lower layer first") : szM("Bu taş havada kalır: önce altını ya da yanını kur", "This stone would float: build below or beside it first")); return restorasyonOyunu(); }
    if (r.sec !== beklenen) { r.hata++; kaydet(); oyunSesi("sil"); if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) {} bildir(szM("Bu yuvaya {t} gelmez; plana bak", "{t} doesn't go here; check the plan", { t: ad(r.sec) })); return restorasyonOyunu(); }
    if (y.sirali) { const s0 = i - i % W; for (let k = s0; k < s0 + W; k++) r.dolu[k] = 1; }   // kesit: bir dokunuş bütün katmanı serer
    else r.dolu[i] = 1;
    if (!kalan(r.sec)) r.sec = null; kaydet(); oyunSesi("yerinde", 2);
    if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {}
    restorasyonOyunu();
  });
  const bt = $("#rs-bitir");
  if (bt) bt.onclick = () => {
    const puan = Math.max(40, 160 - r.hata * 15);
    s.restore = { puan, hata: r.hata };
    const k = kariyer(); k.yapilar[a.id] = Math.max(k.yapilar[a.id] || 0, puan);
    try { if (r.hata === 0 && typeof rozetVer === "function") rozetVer("mimar"); } catch (e) {}
    szIsBitti({ metin: szM("Mimari restorasyon: {y} yeniden kuruldu ({h} hata).", "Architectural restoration: {y} rebuilt ({h} mistakes).", { y: szL(y.ad), h: r.hata }), puan, itibar: r.hata === 0 ? 10 : 0 });
  };
}

/* ---------------------------------------------------------------- Kayıp Eser (günlük macera) */
const HZ_N = 6, HZ_KAZMA = 6;
function hazineDurumu() { const g = oyunGunu(); return D.kzHazine && D.kzHazine.gun === g ? D.kzHazine : null; }
function hazineGunu(g = oyunGunu()) {
  const rng = kzRng(kzTohum("hazine-" + g));
  const alan = KZ_ALANLAR[Math.floor(rng() * KZ_ALANLAR.length)], bul = alan.buluntular[Math.floor(rng() * alan.buluntular.length)];
  const hedef = Math.floor(rng() * HZ_N * HZ_N), tuzak = new Set();
  while (tuzak.size < 3) { const t = Math.floor(rng() * HZ_N * HZ_N); if (t !== hedef) tuzak.add(t); }
  return { alan, bul, hedef, tuzak };
}
function hazineKartCiz(ctx) {
  ctx.fillStyle = "#d9c39a"; ctx.fillRect(0, 0, 160, 48);
  ctx.fillStyle = "#c4a874"; for (let i = 0; i < 160; i += 9) ctx.fillRect(i, (i * 7) % 40, 4, 2);
  ctx.fillStyle = "#8a3a2a"; for (let i = 0; i < 9; i++) ctx.fillRect(20 + i * 10, 30 - Math.round(Math.sin(i) * 8), 4, 2);
  ctx.fillRect(118, 18, 10, 2); ctx.fillRect(122, 14, 2, 10);
  spriteCiz(ctx, "ark_saha", 6, 16, 1);
}
function sayfaHazine() {
  $("#baslik").textContent = szM("Kayıp Eser", "The Lost Find");
  const g = oyunGunu(), gun = hazineGunu(g);
  if (!hazineDurumu()) { D.kzHazine = { gun: g, asama: "giris", tahminler: [], kazilar: [], puan: 0 }; kaydet(); }
  const h = D.kzHazine, a = gun.alan;
  if (h.asama === "giris") {
    h.asama = "tahmin"; kaydet();
    return araSahne(a, [szM("Defineciler eski bir kazı defterinin sayfasını çaldı. Sayfada bir eserin yeri işaretli.", "Looters have stolen a page from an old dig notebook. It marks where an object lies."),
      szM("Ipuçlarını oku, alanı bul ve eseri onlardan önce çıkar. Bulduğunu müzeye teslim edeceksin.", "Read the clues, find the site and recover the object before they do. You'll hand it to the museum.")], sayfaHazine, szM("Maceraya başla", "Begin the adventure"));
  }
  const ipucu = [
    { s: "🖋", t: szM("Sayfada eserin kaba bir çizimi var.", "The page has a rough sketch of the object.") },
    { s: "⏳", t: szM("Kenar notu: “{d}”", "Margin note: “{d}”", { d: DIL === "en" ? a.donem_en : a.donem }) },
    { s: "📍", t: szM("Silik bir yer adı: “{il}”", "A faded place name: “{il}”", { il: kzAlanIl(a) }) },
  ];
  const acikIpucu = Math.min(3, h.tahminler.length + 1);
  if (h.asama === "tahmin") {
    $("#sayfa").innerHTML = `<div class="kazi-oyun sz"><div class="sz-hazine">
      <div class="sz-sayfa-kagit"><canvas width="96" height="96" id="hz-siluet"></canvas>
        ${ipucu.slice(0, acikIpucu).map(x => `<p>${x.s} ${esc(x.t)}</p>`).join("")}</div>
      <p><b>${szM("Eser hangi alanda?", "Which site is it at?")}</b> <small class="aciklama">${szM("Deneme: {n}/3 · ilk denemede 300 puan", "Guess {n}/3 · 300 points on the first try", { n: h.tahminler.length + 1 })}</small></p>
      <div class="sz-hz-alanlar">${KZ_ALANLAR.map(x => `<button class="ikincil-dugme${h.tahminler.includes(x.id) ? " yanlis" : ""}" data-hz="${x.id}" ${h.tahminler.includes(x.id) ? "disabled" : ""}>${esc(kzAlanAd(x))}</button>`).join("")}</div>
      <p class="kz-alt-dugmeler"><a class="ikincil-dugme" href="#oyun/kazi">${szM("Kazı Başı'na dön", "Back to Dig Site")}</a></p></div></div>`;
    const ctx = $("#hz-siluet").getContext("2d"); ctx.fillStyle = "#efe2c4"; ctx.fillRect(0, 0, 96, 96); spriteCiz(ctx, gun.bul.id, 0, 0, 8, true);
    $$("[data-hz]").forEach(d => d.onclick = () => {
      if (d.dataset.hz === a.id) { h.puan += [300, 200, 100][h.tahminler.length] || 0; h.asama = "kazi"; kaydet(); oyunSesi("buluntu"); bildir(szM("Doğru! {a}. Şimdi eseri bul.", "Correct! {a}. Now find the object.", { a: kzAlanAd(a) })); return sayfaHazine(); }
      h.tahminler.push(d.dataset.hz); oyunSesi("sil"); if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
      if (h.tahminler.length >= 3) { h.asama = "kazi"; bildir(szM("Alan {a} çıktı. Defineciler bir adım önde!", "It was {a}. The looters are a step ahead!", { a: kzAlanAd(a) })); }
      kaydet(); sayfaHazine();
    });
    return;
  }
  const bulundu = h.kazilar.includes(gun.hedef);
  const harcanan = h.kazilar.reduce((t, i) => t + (gun.tuzak.has(i) ? 2 : 1), 0), kalan = Math.max(0, HZ_KAZMA - harcanan);
  const bitti = h.asama === "bitti" || bulundu || kalan <= 0;
  const yon = i => {
    const dx = gun.hedef % HZ_N - i % HZ_N, dy = Math.floor(gun.hedef / HZ_N) - Math.floor(i / HZ_N);
    return ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"][(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
  };
  const isi = i => { const u = Math.max(Math.abs(gun.hedef % HZ_N - i % HZ_N), Math.abs(Math.floor(gun.hedef / HZ_N) - Math.floor(i / HZ_N)));
    return u <= 1 ? ["🔥", szM("Çok sıcak", "Very hot")] : u === 2 ? ["♨️", szM("Sıcak", "Hot")] : u === 3 ? ["🌤", szM("Ilık", "Warm")] : ["❄️", szM("Soğuk", "Cold")]; };
  $("#sayfa").innerHTML = `<div class="kazi-oyun sz"><div class="sz-hazine">
    <canvas class="sz-buyuk-sahne" width="160" height="48" id="hz-sahne"></canvas>
    <p><b>${esc(kzAlanAd(a))}</b> · ⛏ ${szM("Kalan kazma: {n}", "Digs left: {n}", { n: kalan })} · ⭐ ${h.puan}</p>
    <p class="aciklama">${szM("Bir kareye dokun ve kaz. Boş çıkarsa ok eserin yönünü, simge ne kadar yakın olduğunu gösterir. Defineci çukurlarına dikkat: gevşek toprak 2 kazma yer.", "Tap a square to dig. If it's empty, the arrow points to the object and the icon tells how close it is. Watch for looters' pits: loose soil costs 2 digs.")}</p>
    <div class="sz-hz-izgara" style="--n:${HZ_N}">${Array.from({ length: HZ_N * HZ_N }, (_, i) => { const k = h.kazilar.includes(i);
      const ic = !k ? "" : i === gun.hedef ? "💎" : gun.tuzak.has(i) ? "🕳" : `${isi(i)[0]}<small>${yon(i)}</small>`;
      return `<button data-hk="${i}" class="${k ? "kazildi" : ""}" ${k || bitti ? "disabled" : ""} title="${k && i !== gun.hedef && !gun.tuzak.has(i) ? esc(isi(i)[1]) : ""}">${ic}</button>`; }).join("")}</div>
    <div id="hz-son"></div>
    <p class="kz-alt-dugmeler"><a class="ikincil-dugme" href="#oyun/kazi">${szM("Kazı Başı'na dön", "Back to Dig Site")}</a></p></div></div>`;
  kzSahne($("#hz-sahne").getContext("2d"), a, 160);
  $$("[data-hk]").forEach(d => d.onclick = () => {
    const i = +d.dataset.hk; if (h.kazilar.includes(i)) return;
    h.kazilar.push(i); kaydet();
    if (i === gun.hedef) { oyunSesi("buluntu"); if (navigator.vibrate) try { navigator.vibrate([30, 60, 30, 60, 60]); } catch (e) {} }
    else if (gun.tuzak.has(i)) { oyunSesi("kirik"); bildir(szM("Defineci çukuru! Gevşek toprak: 1 kazma daha gitti.", "A looters' pit! Loose soil: one more dig lost.")); if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {} }
    else { oyunSesi("kazma", 1); if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {} bildir(`${isi(i)[0]} ${isi(i)[1]} ${yon(i)}`); }
    sayfaHazine();
  });
  if (bitti && h.asama !== "bitti") {
    const kalanP = bulundu ? 150 + kalan * 25 : 0;
    h.puan += kalanP; h.asama = "bitti"; h.bulundu = bulundu; kaydet();
    if (bulundu) {
      D.buluntuDefteri = D.buluntuDefteri || {}; if (!D.buluntuDefteri[gun.bul.id]) D.buluntuDefteri[gun.bul.id] = g;
      try { if (typeof rozetVer === "function") rozetVer("kayip_eser"); kiyafetKontrol(a); } catch (e) {}
    }
    const kd = kaziDurumu(); kd.toplam += h.puan; kd.kosular.push({ alan: a.id, puan: h.puan, hazine: 1 }); kaydet();
    try { skorGonder("kazi", kd.toplam, `${kd.kosular.length} kazı`); } catch (e) {}
    setTimeout(() => oyunSesi("bitis"), 300);
  }
  if (h.asama === "bitti") {
    $("#hz-son").innerHTML = `<div class="kz-buluntu sz-hz-son"><canvas width="144" height="144" id="hz-bul"></canvas><h3>${h.bulundu ? "💎 " + esc(kzAd(gun.bul)) : szM("Defineciler önce davrandı", "The looters got there first")}</h3>
      <p>${h.bulundu ? esc(szM("Eser müzeye teslim edildi ve Buluntu Defteri'ne yazıldı. ", "The object was handed to the museum and entered in the Find Register. ", {}) + kzBilgi(gun.bul)) : szM("Eser bu kez kayıp. Yarın yeni bir defter sayfası!", "The object is lost this time. A new notebook page tomorrow!")}</p>
      <p class="kz-toplam">${szM("Puanın", "Your score")}: <b>${h.puan}</b></p>
      <p><button class="ikincil-dugme" id="hz-paylas">${szM("Sonucu paylaş", "Share the result")}</button></p></div>`;
    const ctx = $("#hz-bul").getContext("2d"); ctx.fillStyle = a.toprak[3]; ctx.fillRect(0, 0, 144, 144); spriteCiz(ctx, gun.bul.id, 0, 0, 12, !h.bulundu);
    $("#hz-paylas").onclick = () => {
      const iz = []; for (let s = 0; s < HZ_N; s++) iz.push(Array.from({ length: HZ_N }, (_, x) => { const i = s * HZ_N + x; return !h.kazilar.includes(i) ? "🟫" : i === gun.hedef ? "💎" : gun.tuzak.has(i) ? "🕳" : "⬛"; }).join(""));
      paylasLevhasi({ baslik: szM("Kayıp Eser", "The Lost Find"), url: "https://arkix.harrixapp.com/#oyun/kazi/hazine",
        metin: `Arkix · 🗺 ${szM("Kayıp Eser", "The Lost Find")} · ${tarihYaz(g)}\n${h.bulundu ? "💎" : "🕳"} ${h.puan} ${szM("puan", "points")} · ${szM("{n}. denemede alan", "site on guess {n}", { n: Math.min(3, h.tahminler.length + 1) })}\n\n${iz.join("\n")}` });
    };
  }
}
