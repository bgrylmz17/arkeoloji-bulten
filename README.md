# Harrix Arkeoloji Bülteni — telefon sürümü

Arkeoloji makaleleri, tezler, kazı haberleri ve raporları; günde dört kez kendiliğinden toplanır ve
telefonda uygulama gibi açılır. Masaüstündeki Harrix Arkeoloji Bülteni ile aynı toplama kodunu kullanır.

- **Toplayıcı** (`toplayici/topla.py`): GitHub Actions her gün 06.17, 12.17, 18.17 ve 00.17'de (Türkiye
  saati) çalıştırır. Kaynaklar: OpenAlex, Crossref, DergiPark, Google Haberler, Bundle'daki haber
  siteleri (TRT Haber, Hürriyet, NTV, CNN Türk, Sözcü, BBC Türkçe…) ve arkeoloji siteleri (Arkeofili,
  Arkeonews, ScienceDaily, Phys.org…). Genel haber sitelerinden yalnızca arkeolojiyle ilgili haberler alınır.
- **Aynı haber bir kez:** başka kaynaktan gelen kopyalar (başlık karşılaştırmasıyla) bültene alınmaz.
- **Sesli özet:** toplayıcı "Dünün özeti"ni doğal bir insan sesiyle (Microsoft Emel, `edge-tts`) okuyup
  `docs/veri/ozet.mp3` olarak kaydeder; metin değişmedikçe dosya yeniden üretilmez. Uygulama özeti bu dosyadan
  çalar, olmazsa telefonun kendi sesiyle okur.
- **Uygulama** (`docs/`): telefona "ana ekrana ekle" ile kurulan web uygulaması. Favoriler, konular,
  notlar ve kaynakça yalnızca telefonda tutulur.

## İlk kurulum (bir kez, 10 dakika)

1. **Depoyu açın.** <https://github.com/new> → Repository name: `arkeoloji-bulten` → **Public** →
   *Create repository*.
2. **Dosyaları yükleyin.** Açılan sayfada *uploading an existing file* bağlantısına tıklayın.
   `mobil` klasörünün **içindekilerin hepsini** (`.github`, `docs`, `harrix_bulten`, `toplayici`,
   `README.md`) sayfaya sürükleyin → *Commit changes*.
   - Yükledikten sonra depoda `.github/workflows/topla.yml` dosyasını görmüyorsanız: *Add file → Create
     new file* → ad olarak `.github/workflows/topla.yml` yazın, bilgisayardaki aynı dosyanın içeriğini
     yapıştırın → *Commit changes*.
3. **Yazma izni verin.** *Settings → Actions → General* → en altta *Workflow permissions* →
   **Read and write permissions** → *Save*.
4. **Siteyi açın.** *Settings → Pages* → *Source: Deploy from a branch* → Branch: **main**, klasör:
   **/docs** → *Save*.
5. **İlk toplamayı başlatın.** *Actions* sekmesi → soldan **Bülteni topla** → *Run workflow*.
   5–10 dakika sürer; yeşil tik çıkınca bülten hazırdır.
6. **Telefona kurun.** Adres: `https://KULLANICI-ADINIZ.github.io/arkeoloji-bulten/`
   - **iPhone:** Safari'de açın → Paylaş düğmesi → **Ana Ekrana Ekle**. (Bildirimler için iOS 16.4 veya
     sonrası ve ana ekrandan açmak gerekir.)
   - **Android:** Chrome'da açın → sağ üstteki menü → **Uygulamayı yükle** (ya da *Ana ekrana ekle*).

## Ayarlar

`toplayici/ayar.json` dosyasını GitHub'da açıp kalem simgesiyle düzenleyebilirsiniz; bir sonraki
toplamada geçerli olur.

| Alan | Ne işe yarar |
|---|---|
| `kazi` | Kazınızın adı. "Kazım" sekmesi bu kazının haberlerini gösterir. Kapatmak için `null`. |
| `ek_kelimeler` | Ayrıca aranacak kelimeler, ör. `["Keçiören", "Pursaklar"]`. |
| `ek_akislar` | Ek RSS akışları: `"Ad | https://adres/feed | Haber | 1"` (sondaki 1: her yazıyı al). |
| `gun` | Kaç gün geriye bakılacağı. |
| `saklama_gun`, `en_fazla` | Bültende kaç gün / en çok kaç kayıt tutulacağı. |
| `ceviri_siniri` | Her toplamada Türkçeye çevrilecek yabancı dilli kayıt sayısı. |

Haber sitelerinin listesi `harrix_bulten/haber_kaynaklari.py` dosyasındadır. Hangi kaynağın çalıştığını
uygulamada **Ayarlar → Kaynakların durumu** gösterir.

## Bilinmesi gerekenler

- GitHub, 60 gün boyunca depoda hiçbir değişiklik olmazsa zamanlanmış çalışmayı durdurabilir ve
  e-postayla haber verir. Öyle olursa *Actions* sekmesinde **Enable workflow**'a basmanız yeterli.
- Depo herkese açıktır; içinde yalnızca zaten yayımlanmış haber ve makale bilgileri vardır. Kişisel
  notlarınız, konularınız ve kaynakçanız telefondan dışarı çıkmaz. Telefon değiştirirken
  **Ayarlar → Yedeği dışa aktar** ile taşıyın.

## Arkix Özel (kendi haberlerimiz)

GitHub'da depoda `docs/ozel` klasörüne bir `.md` dosyası ve aynı adlı fotoğraf yükleyin
(ör. `2026-12-01-kizilin-sezon-sonu.md` ve `2026-12-01-kizilin-sezon-sonu.jpg`). Biçim ve kurallar
`docs/ozel/_ornek.md` içinde. Yükleme toplayıcıyı başlatır; yazı birkaç dakika içinde Bugün sayfasındaki
**Arkix Özel** bölümünde görünür. Yalnız kendi çektiğiniz ya da yayın izni alınmış fotoğrafları kullanın.
