/* Arkix web — Google AdSense reklam ayarı.
 * ACIK false iken hiçbir Google reklam betiği yüklenmez, yuva çizilmez, KVKK metni değişmez.
 *
 * Açmak için (AdSense onayı geldikten sonra):
 *   1. AdSense › Reklamlar › Reklam birimine göre › "Akış içi" (In-feed) ya da "Görüntülü" birim oluştur;
 *      verdiği data-ad-slot değerini YUVA'ya yaz.
 *   2. ACIK = true yap.
 *   3. uygulama.js ve sw.js içindeki SURUM değerlerini artır.
 * Açılınca KVKK metnine reklam/çerez maddesi eklenir ve herkesten yeniden onay istenir.
 * Avrupa (AB/BK/İsviçre) ziyaretçileri için rıza penceresi AdSense › Gizlilik ve mesajlaşma'dan açılır;
 * Google'ın betiği onu kendiliğinden gösterir. */
window.REKLAM = {
  ACIK: false,
  ISTEMCI: "ca-pub-2036956501293604",
  YUVA: "",
  ILK_SONRA: 1,     // ilk reklam kaçıncı gün tabakasından sonra
  ARALIK: 3,        // sonra her kaç tabakada bir
  EN_FAZLA: 3,      // bir sayfada en çok kaç reklam
};
