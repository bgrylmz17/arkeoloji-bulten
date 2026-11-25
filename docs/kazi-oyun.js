/* Arkix — Kazı Başı (#oyun/kazi): 2D piksel kazı oyunu.
 * Ören yeri seç → 10×8 açma; her tıklama bir hücreyi bir katman kazar (3 katman). Her kazıda 30 vuruş; günde 3 kazı izni.
 * Alanın gerçek buluntularından 3'ü ve sık buluntular gizlidir; çıkan buluntu tanıtılır, Buluntu Defteri'ne yazılır.
 * İpucu: boş çıkan hücre, yakında değerli buluntu varsa "sıcak" görünür (1 hücre: kızıl, 2 hücre: amber).
 * Puan: buluntu puanları + hepsi bulunursa kalan vuruş × 5. Günlük toplam skor tablosuna gider (oyunlar.js › skorGonder).
 * Piksel çizimler 12×12 metin haritası; harf → renk. Hepsi özgün, basit çizimler. */

const KZ_SUTUN = 10, KZ_SATIR = 8, KZ_HUCRE = 16, KZ_SAHNE = 48, KZ_VURUS = 30, KZ_HAK = 3;

/* ---------------------------------------------------------------- çizimler */
const SPRITE = {
  canak: { r: { o: "#c0703a", d: "#8a4a24", l: "#dc9a62" }, h: [
    "............", "....oooo....", "...oolllo...", "..oolllloo..", "..oooooooo..", ".odddddddddo", ".oooooooooo.", "..oooooooo..", "...oooooo...", "....ooo.....", "............", "............"] },
  kemik: { r: { w: "#efe6d2", s: "#c2b294" }, h: [
    "............", ".ww......ww.", "wwws....swww", ".wwwwwwwwww.", "..ssssssss..", ".wwwwwwwwww.", "wwws....swww", ".ww......ww.", "............", "............", "............", "............"] },
  tohum: { r: { k: "#2b2420", g: "#5a4a3e" }, h: [
    "............", "............", "..kk....kk..", ".kggk..kggk.", ".kkkk..kkkk.", "..kk....kk..", ".....kk.....", "....kggk....", "....kkkk....", ".....kk.....", "............", "............"] },
  tdikili: { r: { g: "#b9b2a6", d: "#7e776c", f: "#5f574d" }, h: [
    "............", "gggggggggggd", "gggggggggggd", "ddddggggdddd", "....gggd....", "....gfgd....", "....gffd....", "....gfgd....", "....gggd....", "....gggd....", "....gggd....", "...ddddddd.."] },
  akbaba: { r: { s: "#b9b2a6", d: "#6e665b", b: "#3f3830" }, h: [
    "ssssssssssss", "ssssssbbssss", "sssssbbbssss", "sbbssbbssbbs", "sbbbbbbbbbbs", "ssbbbbbbbbss", "ssssbbbbssss", "sssssbbsssss", "ssssbssbssss", "ssssssssssss", "ddssssssssdd", "dddddddddddd"] },
  okucu: { r: { f: "#9a8c7a", d: "#6a5d4e", l: "#c4b8a6" }, h: [
    ".....ll.....", ".....lf.....", "....lfff....", "....lffd....", "...lfffd....", "...lfffdd...", "...lffffd...", "....lffd....", "....lffd....", ".....fd.....", ".....fd.....", "............"] },
  bas: { r: { s: "#cfc6b6", d: "#8f8676", k: "#4a4238" }, h: [
    "............", "....ssss....", "...ssssss...", "..ssssssss..", "..skksskks..", "..ssssssss..", "..sssddsss..", "..ssssssss..", "...skkkks...", "...ssssss...", "....dddd....", "............"] },
  figurin: { r: { c: "#c98d5a", d: "#94603a", k: "#6b4128" }, h: [
    "............", ".....cc.....", ".....cc.....", "....cccc....", "...cccccc...", "..ccdccdcc..", "k.cccccccc.k", "kkccccccccdk", "kccccccccccd", "kddddddddddk", "kk........kk", "............"] },
  ayna: { r: { k: "#141414", g: "#3a3a42", w: "#cfd6e4" }, h: [
    "............", "....kkkk....", "..kkkkkkkk..", "..kkwwgkkk..", ".kkwwggkkkk.", ".kkwggkkkkk.", ".kkggkkkkkk.", ".kkkkkkkkkk.", "..kkkkkkkk..", "..kkkkkkkk..", "....kkkk....", "............"] },
  bukranion: { r: { w: "#ece3d0", s: "#c6b896", k: "#3f362c" }, h: [
    "w..........w", "ww........ww", ".ww......ww.", "..wwssssww..", "...ssssss...", "...skssks...", "...ssssss...", "....ssss....", "....ssss....", ".....ss.....", "............", "............"] },
  muhur: { r: { c: "#b0683a", d: "#7a4426", l: "#d99a68" }, h: [
    "............", ".....dd.....", ".....cc.....", "....cccc....", "..cccccccc..", ".cldlddldlc.", ".cdldlldldc.", ".cldlddldlc.", ".cdldlldldc.", "..cccccccc..", "............", "............"] },
  tablet: { r: { c: "#caa476", d: "#8a6a42" }, h: [
    "............", ".cccccccccc.", ".cddcdcdcdc.", ".cccccccccc.", ".cdcdddcdcc.", ".cccccccccc.", ".cddcdcddcc.", ".cccccccccc.", ".cdcddcdcdc.", ".cccccccccc.", ".cccccccccc.", "............"] },
  riton: { r: { c: "#b5602f", d: "#7c3b1c", w: "#efe3c8" }, h: [
    "............", "w.........w.", "ww.......ww.", ".wcccccccw..", "..ccdcccccc.", "..cccccccccc", "..cccccccccd", "...ccccccc..", "...cc...cc..", "...dd...dd..", "............", "............"] },
  kilic: { r: { b: "#b78a4a", d: "#7d5a2c", k: "#4a3a22" }, h: [
    "...........b", "..........bd", ".........bd.", "........bd..", ".......bd...", "......bd....", ".....bd.....", "..k.bd......", "...kd.......", "..kdk.......", ".k...k......", "k..........."] },
  bulla: { r: { c: "#b8784a", d: "#7a4a2a", l: "#d6a074" }, h: [
    "............", "....cccc....", "..cccccccc..", "..cclllldcc.", ".ccldddddlc.", ".ccldcdcdlc.", ".ccldddddlc.", ".cclllllldc.", "..cccccccc..", "...cccccc...", "............", "............"] },
  depas: { r: { c: "#9c6a44", d: "#6a4428" }, h: [
    "............", "....cccc....", "dd.cccccc.dd", "d.dcccccccd.", "d..cccccc..d", "d..cccccc..d", ".d.cccccc.d.", "..dcccccccd.", "....cccc....", "....cccc....", "...dddddd...", "............"] },
  kupe: { r: { y: "#e3b341", o: "#a87a1c", w: "#fff1b8" }, h: [
    "............", "....yyyy....", "...y....y...", "...y....y...", "....yyyy....", ".....yy.....", "....yyyy....", "...yywyyy...", "...yyyyoy...", "....yyoy....", ".....oo.....", "............"] },
  agirsak: { r: { c: "#8f6a4c", d: "#5e4230", k: "#2b211a" }, h: [
    "............", "............", "....cccc....", "..cccccccc..", ".cccdkkdccc.", ".ccdkkkkdcc.", ".cccdkkdccc.", "..cccccccc..", "...dddddd...", "............", "............", "............"] },
  pitos: { r: { c: "#b77a4e", d: "#835233", l: "#d09a6e" }, h: [
    "...cccccc...", "...dddddd...", "..cccccccc..", ".cllcccccccc", ".clcccccccc.", ".cddddddddc.", ".cccccccccc.", ".cccccccccc.", "..cccccccc..", "...cccccc...", "....cccc....", ".....dd....."] },
  kandil: { r: { c: "#c88a58", d: "#8c5634", f: "#f2b134", r: "#e06a2b" }, h: [
    "............", "..........f.", ".........frf", "..........f.", "...ccccccd..", "..ccddcccccd", ".ccdccdcccd.", "..cccccccd..", "...dddddd...", "............", "............", "............"] },
  ari: { r: { s: "#c7ccd3", d: "#878e98", k: "#4f5560" }, h: [
    "............", "...ssssss...", "..ssssssss..", ".sssskksssd.", ".ssdkkkkdsd.", ".sdkskkskds.", ".ssdkkkkdsd.", ".ssskkkkssd.", ".sssskksssd.", "..sssssssd..", "...dddddd...", "............"] },
  artemis: { r: { m: "#e4ddcc", d: "#a69d88", k: "#6d6555" }, h: [
    ".....mm.....", "....mmmm....", ".....mm.....", "...mmmmmm...", "..mmkmkmmm..", "..mkmkmkmm..", "..mmkmkmmm..", "...mmmmmm...", "...mdmdmm...", "...mmmmmm...", "...mdmdmm...", "..dddddddd.."] },
  gladyator: { r: { s: "#cbbfa8", d: "#8b7f68", k: "#5d5444" }, h: [
    "..ssssssss..", ".ssssssssss.", ".sssskkssss.", ".ssskkkksss.", ".sssskksskk.", ".sskkkkkskk.", ".ssskkkksss.", ".sssskskssd.", ".ssskssksss.", ".ssssssssss.", ".dddddddddd.", "............"] },
  mozaik: { r: { a: "#d9a066", b: "#8e5a3a", c: "#e8d5b5", k: "#3b2a20", g: "#6f8a6a" }, h: [
    "gcgcgcgcgcgc", "cbbbbbbbbbbg", "gbbaaaaaabbc", "cbaakaakaabg", "gbaaaaaaaabc", "cbaaabbaaabg", "gbbaaaaaabbc", "cbbbaaaabbbg", "gbbbbbbbbbbc", "cgcgcgcgcgcg", "............", "............"] },
  zbulla: { r: { c: "#9c6038", d: "#5e3820", l: "#c48a5e" }, h: [
    "............", "...cccccc...", "..cllllllc..", ".clddddddlc.", ".cldclcldlc.", ".clddddddlc.", ".cldlclcdlc.", ".clddddddlc.", "..cllllllc..", "...cccccc...", "............", "............"] },
  mars: { r: { b: "#6d8f7a", d: "#3f5c4b", y: "#b89a4a" }, h: [
    ".....yy.....", "....bbbb....", "....bbbb....", ".....bb.....", "..bbbbbbbb..", ".b.bbbbbb.b.", ".b.bbbbbb.b.", "...bbbbbb..y", "...bb..bb..y", "...bb..bb..y", "...dd..dd...", "..ddd..ddd.."] },
  fresk: { r: { p: "#e7d6b8", r: "#a8442e", y: "#d6a23a", g: "#5e7d5a", d: "#9d8d70" }, h: [
    "pppppppppppd", "prrrrrrrrrpd", "prpppppppppd", "prpyyppggppd", "prpyyppggppd", "prppppppppd.", "prrrrrrrrrpd", "ppppppppppd.", "pdpppppppd..", "ddpppppd....", "..dddd......", "............"] },
};
function spriteCiz(ctx, ad, x, y, olcek = 1, golge = false) {
  const s = SPRITE[ad]; if (!s) return;
  s.h.forEach((satir, j) => [...satir.padEnd(12, ".").slice(0, 12)].forEach((c, i) => {
    if (c === ".") return;
    ctx.fillStyle = golge ? "rgba(60,45,35,.55)" : (s.r[c] || "#000");
    ctx.fillRect(x + i * olcek, y + j * olcek, olcek, olcek);
  }));
}

/* ---------------------------------------------------------------- ören yerleri ve buluntular */
const KZ_SIK = [
  { id: "canak", ad: "Çanak çömlek parçası", ad_en: "Potsherd", puan: 15,
    bilgi: "Arkeolojinin en sık buluntusu. Hamuru, biçimi ve süslemesi, bulunduğu katmanı tarihlemeye yardım eder.",
    bilgi_en: "The most common archaeological find. Its fabric, shape and decoration help date the layer it came from." },
  { id: "kemik", ad: "Hayvan kemiği", ad_en: "Animal bone", puan: 10,
    bilgi: "Zooarkeologlar kemiklerden ne yendiğini ve hangi hayvanların evcilleştirildiğini öğrenir.",
    bilgi_en: "Zooarchaeologists learn from bones what people ate and which animals were domesticated." },
  { id: "tohum", ad: "Kömürleşmiş tohum", ad_en: "Charred seeds", puan: 20,
    bilgi: "Yanarak kömürleşen tohumlar binlerce yıl korunur. Arkeobotanikçiler bunlarla tarımı izler; radyokarbon tarihlemesinde de kullanılır.",
    bilgi_en: "Seeds charred by fire survive for millennia. Archaeobotanists use them to trace farming, and they are also used for radiocarbon dating." },
];
const KZ_ALANLAR = [
  { id: "gobekli", ad: "Göbeklitepe", il: "Şanlıurfa", donem: "Çanak Çömleksiz Neolitik, MÖ 9600–8200", donem_en: "Pre-Pottery Neolithic, 9600–8200 BC",
    toprak: ["#c7a27a", "#a9825c", "#8a6646", "#d8c9b0"], gok: ["#f4d9a8", "#e9b98a"],
    buluntular: [
      { id: "tdikili", ad: "T biçimli dikilitaş", ad_en: "T-shaped pillar", puan: 250,
        bilgi: "Göbeklitepe'nin simgesi. Yaklaşık 11.000 yıl önce dikildi. Gövdesine kollar ve eller işlendiği için insanı ya da ataları simgelediği düşünülür.",
        bilgi_en: "The emblem of Göbeklitepe, raised about 11,000 years ago. Arms and hands carved on its shaft suggest it represents humans or ancestors." },
      { id: "akbaba", ad: "Akbaba kabartması", ad_en: "Vulture relief", puan: 200,
        bilgi: "D Yapısı'ndaki 43 numaralı dikilitaşta kanatlarını açmış bir akbaba var. Akbaba, Neolitik inançlarda ölümle ilişkilendirilir.",
        bilgi_en: "Pillar 43 in Enclosure D shows a vulture with spread wings, a bird linked with death in Neolithic beliefs." },
      { id: "okucu", ad: "Çakmaktaşı ok ucu", ad_en: "Flint arrowhead", puan: 120,
        bilgi: "Göbeklitepe'de binlerce çakmaktaşı alet bulundu. Avcılar ok uçlarını taşı yontarak ve basınçla düzelterek yapıyordu.",
        bilgi_en: "Thousands of flint tools were found at Göbeklitepe. Hunters made arrowheads by knapping and pressure-flaking stone." },
      { id: "bas", ad: "Kireçtaşı insan başı", ad_en: "Limestone human head", puan: 180,
        bilgi: "Göbeklitepe'de kireçtaşından yontulmuş insan başları bulundu. Bir kısmının heykellerden kopmuş parçalar olduğu düşünülür.",
        bilgi_en: "Human heads carved in limestone were found at Göbeklitepe; some are thought to have broken off larger statues." },
    ] },
  { id: "catal", ad: "Çatalhöyük", il: "Konya", donem: "Neolitik, MÖ 7100–5950", donem_en: "Neolithic, 7100–5950 BC",
    toprak: ["#c9ad86", "#a88a64", "#7f6648", "#dccfb6"], gok: ["#f1e2bd", "#dcc79a"],
    buluntular: [
      { id: "figurin", ad: "Oturan kadın figürini", ad_en: "Seated woman figurine", puan: 250,
        bilgi: "Yanlarında iki kedigil bulunan bir tahtta oturan pişmiş toprak kadın figürini. Yaklaşık 8.000 yıllık; Ankara'daki Anadolu Medeniyetleri Müzesi'nde.",
        bilgi_en: "A clay figure of a woman seated on a throne flanked by two felines, about 8,000 years old; in the Museum of Anatolian Civilizations, Ankara." },
      { id: "ayna", ad: "Obsidyen ayna", ad_en: "Obsidian mirror", puan: 200,
        bilgi: "Volkanik camın cilalanmasıyla yapılan aynalar, bilinen en eski aynalar arasındadır. Obsidyen Kapadokya'daki volkanlardan geliyordu.",
        bilgi_en: "Mirrors of polished volcanic glass are among the oldest known. The obsidian came from Cappadocian volcanoes." },
      { id: "bukranion", ad: "Boğa boynuzlu bukranion", ad_en: "Bull bucranium", puan: 160,
        bilgi: "Evlerin duvarlarına sıvayla yerleştirilmiş yaban sığırı boynuzları. Boğa, Çatalhöyük evlerindeki simgelerin başında gelir.",
        bilgi_en: "Wild cattle horns set into house walls with plaster; the bull is among the leading symbols in Çatalhöyük houses." },
      { id: "muhur", ad: "Damga mühür", ad_en: "Stamp seal", puan: 130,
        bilgi: "Pişmiş topraktan damga mühürler. Kumaşa, ekmeğe ya da bedene desen basmak için kullanılmış olabilir.",
        bilgi_en: "Clay stamp seals, possibly used to print patterns on cloth, bread or the body." },
    ] },
  { id: "hattusa", ad: "Hattuşa", il: "Çorum", donem: "Hitit, MÖ 1650–1200", donem_en: "Hittite, 1650–1200 BC",
    toprak: ["#b89a74", "#957756", "#6e563e", "#cfc0a4"], gok: ["#dfe8ef", "#b9cbd8"],
    buluntular: [
      { id: "tablet", ad: "Çivi yazılı tablet", ad_en: "Cuneiform tablet", puan: 220,
        bilgi: "Hitit başkentinde on binlerce tablet parçası bulundu. Kadeş Antlaşması'nın Akadca metni de Hattuşa arşivlerinden geliyor.",
        bilgi_en: "Tens of thousands of tablet fragments were found in the Hittite capital, including the Akkadian text of the Treaty of Kadesh." },
      { id: "riton", ad: "Boğa biçimli kap", ad_en: "Bull-shaped vessel", puan: 200,
        bilgi: "Fırtına Tanrısı'nın boğaları Şeri ve Hurri'yi canlandırdığı düşünülen iki pişmiş toprak kap, 1963'te Büyükkale'de bulundu.",
        bilgi_en: "Two clay vessels thought to depict Serri and Hurri, the Storm God's bulls, found on Büyükkale in 1963." },
      { id: "kilic", ad: "Tunç kılıç", ad_en: "Bronze sword", puan: 240,
        bilgi: "1991'de bulunan kılıcın Akadca yazıtı, Kral II. Tudhaliya'nın Assuwa zaferinden sonra onu Fırtına Tanrısı'na adadığını söyler.",
        bilgi_en: "Found in 1991, its Akkadian inscription says King Tudhaliya II dedicated it to the Storm God after his victory over Assuwa." },
      { id: "bulla", ad: "Mühür baskısı", ad_en: "Seal impression", puan: 130,
        bilgi: "Nişantepe arşivinde belgelere basılmış binlerce kil mühür baskısı bulundu. Kralların adları hiyeroglif ve çivi yazısıyla geçer.",
        bilgi_en: "Thousands of clay sealings from documents were found in the Nişantepe archive, naming kings in hieroglyphic and cuneiform script." },
    ] },
  { id: "troya", ad: "Troya", il: "Çanakkale", donem: "Tunç Çağı – Roma, MÖ 3000 – MS 500", donem_en: "Bronze Age – Roman, 3000 BC – AD 500",
    toprak: ["#bfa07c", "#9b7d5c", "#755b42", "#d2c3a8"], gok: ["#d8ecf2", "#a9d0de"],
    buluntular: [
      { id: "depas", ad: "İki kulplu kadeh", ad_en: "Two-handled goblet", puan: 180,
        bilgi: "Depas amphikypellon denen uzun, iki kulplu kadeh Erken Tunç Çağı'nda, Troya II'de yaygındı. Paylaşılarak içmek için kullanıldığı düşünülür.",
        bilgi_en: "The tall, two-handled depas amphikypellon was common in Early Bronze Age Troy II, probably used for shared drinking." },
      { id: "kupe", ad: "Altın küpe", ad_en: "Gold earring", puan: 250,
        bilgi: "Schliemann'ın 'Priamos'un Hazinesi' dediği altın takılar aslında Priamos'tan yaklaşık bin yıl eskidir; Erken Tunç Çağı'na aittir.",
        bilgi_en: "The gold jewellery Schliemann called 'Priam's Treasure' is about a thousand years older than Priam, from the Early Bronze Age." },
      { id: "agirsak", ad: "İğ ağırşağı", ad_en: "Spindle whorl", puan: 110,
        bilgi: "Yün ve keten eğirirken iğe takılan delikli pişmiş toprak ağırlık. Troya'da binlercesi bulundu.",
        bilgi_en: "A pierced clay weight fitted to a spindle for spinning wool and flax. Thousands were found at Troy." },
      { id: "pitos", ad: "Pitos (depolama küpü)", ad_en: "Pithos (storage jar)", puan: 150,
        bilgi: "Tahıl, yağ ve şarap saklanan insan boyunda küpler. Troya VI–VII evlerinde tabana gömülü olarak bulundu.",
        bilgi_en: "Person-sized jars for grain, oil and wine, found sunk into house floors of Troy VI–VII." },
    ] },
  { id: "efes", ad: "Efes", il: "İzmir", donem: "Helenistik – Roma, MÖ 300 – MS 600", donem_en: "Hellenistic – Roman, 300 BC – AD 600",
    toprak: ["#c4a47e", "#a2825e", "#7a5f44", "#e0d4bd"], gok: ["#cfe6f5", "#9cc8e6"],
    buluntular: [
      { id: "kandil", ad: "Pişmiş toprak kandil", ad_en: "Clay oil lamp", puan: 110,
        bilgi: "Zeytinyağıyla yanan kandiller Roma döneminin en yaygın eşyalarındandı. Kalıpla çok sayıda üretilirdi.",
        bilgi_en: "Olive-oil lamps were among the most common Roman objects, mass-produced in moulds." },
      { id: "ari", ad: "Arılı gümüş sikke", ad_en: "Silver bee coin", puan: 200,
        bilgi: "Arı Efes'in simgesiydi ve sikkelerine basıldı. Arı figürü Artemis kültüyle ilişkilendirilir.",
        bilgi_en: "The bee was Ephesus's emblem and was struck on its coins; it is linked with the cult of Artemis." },
      { id: "artemis", ad: "Efes Artemisi heykelciği", ad_en: "Artemis of Ephesus statuette", puan: 250,
        bilgi: "Göğsündeki yumrular meme, yumurta ya da kurban boğalarının testisleri diye farklı yorumlanır. Efes Müzesi'nde iki ünlü heykeli var.",
        bilgi_en: "The orbs on her chest are read as breasts, eggs or sacrificed bulls' testicles. Two famous statues are in the Ephesus Museum." },
      { id: "gladyator", ad: "Gladyatör mezar steli", ad_en: "Gladiator gravestone", puan: 180,
        bilgi: "1993'te Efes'te bir gladyatör mezarlığı bulundu. Kemikler gladyatörlerin iyi beslendiğini ve yaralarının tedavi edildiğini gösterdi.",
        bilgi_en: "A gladiator cemetery was found at Ephesus in 1993. The bones show gladiators were well fed and their wounds treated." },
    ] },
  { id: "zeugma", ad: "Zeugma", il: "Gaziantep", donem: "Helenistik – Roma, MÖ 300 – MS 256", donem_en: "Hellenistic – Roman, 300 BC – AD 256",
    toprak: ["#b99b78", "#977a5a", "#715a42", "#d6c8ae"], gok: ["#e4eef2", "#b4d3df"],
    buluntular: [
      { id: "mozaik", ad: "Çingene Kızı mozaiği", ad_en: "Gypsy Girl mosaic", puan: 250,
        bilgi: "Zeugma'nın simgesi; Gaziantep Zeugma Mozaik Müzesi'nde. Kimi betimlediği tartışmalıdır: Gaia ya da Ariadne olduğu öne sürülür.",
        bilgi_en: "Zeugma's emblem, in the Zeugma Mosaic Museum, Gaziantep. Whom it shows is debated; Gaia or Ariadne have been suggested." },
      { id: "zbulla", ad: "Kil mühür baskısı", ad_en: "Clay bulla", puan: 140,
        bilgi: "Zeugma'da arşivin yanmasıyla pişip korunan on binlerce mühür baskısı bulundu; dünyanın en büyük bulla buluntularından.",
        bilgi_en: "Tens of thousands of sealings, baked and preserved when an archive burned, make Zeugma one of the largest bulla finds in the world." },
      { id: "mars", ad: "Tunç Mars heykeli", ad_en: "Bronze statue of Mars", puan: 220,
        bilgi: "Savaş tanrısı Mars'ın tunç heykeli kurtarma kazılarında bulundu; bugün Zeugma Mozaik Müzesi'nde.",
        bilgi_en: "The bronze statue of Mars, god of war, was found during rescue excavations and is now in the Zeugma Mosaic Museum." },
      { id: "fresk", ad: "Duvar resmi parçası", ad_en: "Wall-painting fragment", puan: 160,
        bilgi: "Zeugma villalarının duvarları fresklerle süslüydü. Birecik Barajı'nın suları basmadan önce kurtarma kazılarıyla çıkarıldı.",
        bilgi_en: "Zeugma's villas had frescoed walls, removed in rescue digs before the Birecik Dam reservoir flooded them." },
    ] },
];
const kzAd = b => DIL === "en" && b.ad_en ? b.ad_en : b.ad;
const kzBilgi = b => DIL === "en" && b.bilgi_en ? b.bilgi_en : b.bilgi;

/* ---------------------------------------------------------------- günlük izin */
function kaziDurumu() {
  const g = oyunGunu();
  if (!D.kaziOyun || D.kaziOyun.gun !== g) D.kaziOyun = { gun: g, hak: KZ_HAK, toplam: 0, kosular: [] };
  return D.kaziOyun;
}

/* ---------------------------------------------------------------- sahne çizimi (48 px yükseklik) */
function kzSahne(ctx, alan, w) {
  const g = ctx.createLinearGradient(0, 0, 0, KZ_SAHNE);
  g.addColorStop(0, alan.gok[0]); g.addColorStop(1, alan.gok[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, KZ_SAHNE);
  const r = (x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); };
  const t = alan.toprak;
  r(0, 40, w, 8, t[0]);
  if (alan.id === "gobekli") {
    r(0, 34, 60, 6, "#d6b48c"); r(100, 32, 60, 8, "#d6b48c");
    for (const x of [40, 64, 92, 116]) { r(x, 22, 10, 3, "#b9b2a6"); r(x + 3, 25, 4, 15, "#b9b2a6"); r(x + 7, 25, 1, 15, "#7e776c"); }
  } else if (alan.id === "catal") {
    r(10, 30, 140, 10, "#cdb58e");
    for (const [x, h] of [[24, 8], [40, 10], [58, 7], [76, 11], [96, 8], [114, 9]]) { r(x, 40 - h - 4, 14, h, "#b79a74"); r(x + 5, 40 - h - 6, 4, 2, "#6b5238"); }
  } else if (alan.id === "hattusa") {
    r(0, 26, w, 14, "#a4927a"); r(56, 14, 14, 26, "#8f7e66"); r(90, 14, 14, 26, "#8f7e66");
    r(70, 22, 20, 18, "#a4927a"); r(74, 26, 12, 14, "#3d342b");
    for (let x = 0; x < w; x += 8) r(x, 24, 5, 2, "#8f7e66");
  } else if (alan.id === "troya") {
    for (let i = 0; i < 4; i++) r(10 + i * 10, 22 + i * 4, w - 20 - i * 20, 4, ["#b59d80", "#a58d70", "#957d60", "#866e52"][i]);
    r(120, 12, 3, 28, "#6a5a48");
  } else if (alan.id === "efes") {
    r(44, 10, 72, 4, "#e6dccb"); r(44, 24, 72, 3, "#e6dccb");
    for (let x = 48; x < 112; x += 12) { r(x, 14, 4, 10, "#f2ebde"); r(x, 27, 4, 13, "#f2ebde"); }
    r(40, 38, 80, 2, "#d0c4ae");
  } else if (alan.id === "zeugma") {
    r(0, 34, w, 6, "#6ea1b5"); r(0, 36, w, 1, "#9ccbd9");
    for (let x = 30; x < 130; x += 16) r(x, 20, 4, 14, "#e2d6c0");
    r(26, 18, 110, 3, "#d0c2a8");
  }
}
function kaziKartGorseli(cv) {
  if (!cv) return;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#a9825c"; ctx.fillRect(0, 0, 48, 32);
  ctx.fillStyle = "#c7a27a"; ctx.fillRect(0, 0, 48, 8);
  ctx.fillStyle = "#8a6646"; ctx.fillRect(0, 20, 48, 12);
  spriteCiz(ctx, "tdikili", 6, 10, 1); spriteCiz(ctx, "ayna", 20, 14, 1); spriteCiz(ctx, "depas", 33, 12, 1);
}

/* ---------------------------------------------------------------- oyun ekranları */
let KZ = null;   // { alan, hucreler: [{derinlik, buluntu}], vurus, puan, bulunan: [] , bitti }

function sayfaKaziOyun(arg) {
  const kd = kaziDurumu();
  if (arg && KZ && KZ.alan.id === arg && !KZ.bitti) return kzOyunCiz();
  const defter = D.buluntuDefteri || {};
  const tum = KZ_ALANLAR.flatMap(a => a.buluntular.map(b => ({ ...b, alan: a })));
  $("#sayfa").innerHTML = `<div class="kazi-oyun">
    <div class="kz-ust"><p>${tx("Bir ören yeri seç, açmayı kaz, buluntuları çıkar.")}</p>
      <p class="kz-izin">${tx("Bugün kalan kazı izni")}: <b>${kd.hak}/${KZ_HAK}</b> · ${tx("Bugünkü puan")}: <b>${kd.toplam}</b></p></div>
    <div class="kz-alanlar">${KZ_ALANLAR.map(a => {
      const bulunan = a.buluntular.filter(b => defter[b.id]).length;
      return `<button class="kz-alan" data-alan="${a.id}" ${kd.hak ? "" : "disabled"}><canvas width="160" height="48"></canvas>
        <span><b>${esc(a.ad)}</b><small>${esc(a.il)} · ${esc(DIL === "en" ? a.donem_en : a.donem)}</small><em>${tx("Defter")}: ${bulunan}/${a.buluntular.length}</em></span></button>`;
    }).join("")}</div>
    ${kd.hak ? "" : `<p class="aciklama" style="text-align:center">${tx("Bugünkü kazı izinlerin bitti. Yarın yeni izin!")}</p>`}
    <section class="kz-defter"><h3>${tx("Buluntu Defteri")} <small>${Object.keys(defter).filter(id => tum.some(b => b.id === id)).length}/${tum.length}</small></h3>
      <div class="kz-defter-izgara">${tum.map(b => `<button class="kz-defter-oge${defter[b.id] ? "" : " kayip"}" data-b="${b.id}" title="${defter[b.id] ? esc(kzAd(b)) : "?"}">
        <canvas width="48" height="48"></canvas><small>${defter[b.id] ? esc(kzAd(b)) : "?"}</small></button>`).join("")}</div></section>
    ${skorBolumuHtml("kazi")}</div>`;
  $(".oyun-skor h3").textContent = tx("Kazı Başı · Skor tablosu");
  $$(".kz-alan").forEach(b => {
    const a = KZ_ALANLAR.find(x => x.id === b.dataset.alan);
    kzSahne(b.querySelector("canvas").getContext("2d"), a, 160);
    b.onclick = () => kzBasla(a);
  });
  $$(".kz-defter-oge").forEach(b => {
    const bul = tum.find(x => x.id === b.dataset.b), ctx = b.querySelector("canvas").getContext("2d");
    spriteCiz(ctx, bul.id, 0, 0, 4, !defter[bul.id]);
    b.onclick = () => defter[bul.id] ? kzBuluntuLevhasi(bul, bul.alan, false) : bildir(tx("Henüz bulunmadı: {alan}", { alan: bul.alan.ad }));
  });
  skorBolumuBagla($("#sayfa"));
}

function kzBasla(alan) {
  const kd = kaziDurumu();
  if (kd.hak <= 0) { bildir(tx("Bugünkü kazı izinlerin bitti. Yarın yeni izin!")); return; }
  kd.hak--; kaydet();
  const n = KZ_SUTUN * KZ_SATIR, yerler = [...Array(n).keys()].sort(() => Math.random() - .5);
  const hucreler = Array.from({ length: n }, () => ({ derinlik: 3, buluntu: null }));
  const ozel = [...alan.buluntular].sort(() => Math.random() - .5).slice(0, 3);
  ozel.forEach((b, i) => { hucreler[yerler[i]] = { derinlik: 3, buluntu: b }; });
  for (let i = 3; i < 10; i++) hucreler[yerler[i]].buluntu = KZ_SIK[Math.floor(Math.random() * KZ_SIK.length)];
  KZ = { alan, hucreler, vurus: KZ_VURUS, puan: 0, bulunan: [], ozelSayi: 3, bitti: false, vurgu: -1 };
  if (location.hash !== `#oyun/kazi/${alan.id}`) location.hash = `#oyun/kazi/${alan.id}`; else kzOyunCiz();
}

function kzOyunCiz() {
  $("#sayfa").innerHTML = `<div class="kazi-oyun"><div class="kz-hud">
      <span><b>${esc(KZ.alan.ad)}</b> · ${esc(KZ.alan.il)}</span>
      <span class="kz-vurus" title="${tx("Kalan vuruş")}">⛏ <b id="kz-vurus">${KZ.vurus}</b></span>
      <span>${tx("Puan")}: <b id="kz-puan">${KZ.puan}</b></span></div>
    <div class="kz-cerceve"><canvas id="kz-tuval" width="${KZ_SUTUN * KZ_HUCRE}" height="${KZ_SAHNE + KZ_SATIR * KZ_HUCRE}" aria-label="${tx("Kazı alanı")}"></canvas></div>
    <p class="aciklama kz-ipucu">${tx("Toprağa dokun: her dokunuş bir katman kazar. Boş çıkan hücre kızıl ya da amber parlıyorsa yakında değerli bir buluntu var.")}</p>
    <p class="kz-bulunanlar" id="kz-bulunanlar"></p>
    <p style="text-align:center"><button class="ikincil-dugme" id="kz-bitir">${tx("Kazıyı bitir")}</button></p></div>`;
  const cv = $("#kz-tuval");
  cv.onclick = e => {
    const k = cv.getBoundingClientRect(), x = (e.clientX - k.left) / k.width * cv.width, y = (e.clientY - k.top) / k.height * cv.height - KZ_SAHNE;
    if (y < 0) return;
    kzKaz(Math.floor(y / KZ_HUCRE) * KZ_SUTUN + Math.floor(x / KZ_HUCRE));
  };
  $("#kz-bitir").onclick = () => kzSon(false);
  kzCiz();
}

function kzYakinlik(i) {
  const x = i % KZ_SUTUN, y = Math.floor(i / KZ_SUTUN);
  let en = 99;
  KZ.hucreler.forEach((h, j) => {
    if (!h.buluntu || h.derinlik === 0 || KZ_SIK.includes(h.buluntu)) return;
    en = Math.min(en, Math.max(Math.abs(j % KZ_SUTUN - x), Math.abs(Math.floor(j / KZ_SUTUN) - y)));
  });
  return en;
}
function kzCiz() {
  const cv = $("#kz-tuval"); if (!cv) return;
  const ctx = cv.getContext("2d"), t = KZ.alan.toprak;
  kzSahne(ctx, KZ.alan, cv.width);
  KZ.hucreler.forEach((h, i) => {
    const x = (i % KZ_SUTUN) * KZ_HUCRE, y = KZ_SAHNE + Math.floor(i / KZ_SUTUN) * KZ_HUCRE;
    const renk = h.derinlik === 3 ? t[0] : h.derinlik === 2 ? t[1] : h.derinlik === 1 ? t[2] : t[3];
    ctx.fillStyle = renk; ctx.fillRect(x, y, KZ_HUCRE, KZ_HUCRE);
    // doku: hücreye özgü sabit benekler
    for (let k = 0; k < 5; k++) {
      const s = (i * 7 + k * 13 + h.derinlik * 31) % 97;
      ctx.fillStyle = h.derinlik ? "rgba(0,0,0,.13)" : "rgba(0,0,0,.06)";
      ctx.fillRect(x + (s * 5) % 15, y + (s * 3) % 15, 1 + (s % 2), 1);
    }
    if (h.derinlik > 0 && h.derinlik < 3) { ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(x, y, KZ_HUCRE, 1); ctx.fillRect(x, y, 1, KZ_HUCRE); }
    if (h.derinlik === 0) {
      ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(x, y, KZ_HUCRE, 2); ctx.fillRect(x, y, 2, KZ_HUCRE);
      if (h.buluntu) spriteCiz(ctx, h.buluntu.id, x + 2, y + 2, 1);
      else {
        const d = kzYakinlik(i);
        if (d <= 2) { ctx.fillStyle = d === 1 ? "#d2452b" : "#e0a12c"; for (const [a, b] of [[5, 6], [9, 9], [7, 11]].slice(0, d === 1 ? 3 : 2)) ctx.fillRect(x + a, y + b, 2, 2); }
      }
    }
    if (i === KZ.vurgu) { ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x, y, KZ_HUCRE, KZ_HUCRE); }
  });
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
  ctx.strokeRect(0.5, KZ_SAHNE + 0.5, cv.width - 1, KZ_SATIR * KZ_HUCRE - 1); ctx.setLineDash([]);
  $("#kz-vurus").textContent = KZ.vurus; $("#kz-puan").textContent = KZ.puan;
  $("#kz-bulunanlar").innerHTML = KZ.bulunan.map(b => `<span>${esc(kzAd(b))}</span>`).join("");
}
function kzKaz(i) {
  if (!KZ || KZ.bitti || i < 0 || i >= KZ.hucreler.length) return;
  const h = KZ.hucreler[i];
  if (h.derinlik === 0) return;
  h.derinlik--; KZ.vurus--; KZ.vurgu = i;
  setTimeout(() => { if (KZ && KZ.vurgu === i) { KZ.vurgu = -1; kzCiz(); } }, 90);
  if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
  let yeni = null;
  if (h.derinlik === 0 && h.buluntu) { yeni = h.buluntu; KZ.bulunan.push(yeni); KZ.puan += yeni.puan; }
  kzCiz();
  const ozelBitti = KZ.bulunan.filter(b => !KZ_SIK.includes(b)).length >= KZ.ozelSayi;
  if (yeni) {
    const ozel = !KZ_SIK.includes(yeni);
    const ilk = ozel && !(D.buluntuDefteri || {})[yeni.id];
    if (ozel) { D.buluntuDefteri = D.buluntuDefteri || {}; D.buluntuDefteri[yeni.id] = D.buluntuDefteri[yeni.id] || oyunGunu(); kaydet(); }
    kzBuluntuLevhasi(yeni, KZ.alan, ilk, () => { if (ozelBitti || KZ.vurus <= 0) kzSon(ozelBitti); });
    return;
  }
  if (ozelBitti || KZ.vurus <= 0) setTimeout(() => kzSon(ozelBitti), 250);
}
function kzBuluntuLevhasi(b, alan, ilk, sonra) {
  const ozel = !KZ_SIK.includes(b);
  levhaAc(`<div class="kz-buluntu">${ilk ? `<p class="kz-yeni">${tx("Deftere yeni buluntu!")}</p>` : ""}
    <canvas width="144" height="144" id="kz-buyuk"></canvas>
    <h3>${esc(kzAd(b))}</h3>
    <p class="aciklama">${ozel ? `${esc(alan.ad)}, ${esc(alan.il)} · ${esc(DIL === "en" ? alan.donem_en : alan.donem)}` : tx("Sık buluntu")} · <b>+${b.puan}</b></p>
    <p>${esc(kzBilgi(b))}</p>
    <p style="margin-top:14px"><button class="buyuk-dugme" id="kz-devam">${tx("Kazmaya devam")}</button></p></div>`, lv => {
    const ctx = lv.querySelector("#kz-buyuk").getContext("2d");
    ctx.fillStyle = alan.toprak[3]; ctx.fillRect(0, 0, 144, 144);
    spriteCiz(ctx, b.id, 0, 0, 12);
    // perdeye dokunarak kapatılsa da oyun akışı sürsün
    const perde = () => { if (sonra) sonra(); };
    if (sonra) $("#tabaka").addEventListener("click", perde, { once: true });
    lv.querySelector("#kz-devam").onclick = () => { $("#tabaka").removeEventListener("click", perde); levhaKapat(); if (sonra) sonra(); };
  });
}
function kzSon(hepsi) {
  if (!KZ || KZ.bitti) return;
  KZ.bitti = true;
  const bonus = hepsi ? KZ.vurus * 5 : 0;
  KZ.puan += bonus;
  const kd = kaziDurumu();
  kd.toplam += KZ.puan; kd.kosular.push({ alan: KZ.alan.id, puan: KZ.puan }); kaydet();
  skorGonder("kazi", kd.toplam, `${kd.kosular.length} kazı`);
  const ozeller = KZ.bulunan.filter(b => !KZ_SIK.includes(b));
  levhaAc(`<div class="kz-buluntu"><h3>${hepsi ? tx("Açma tamamlandı!") : tx("Kazı bitti")}</h3>
    <p>${esc(KZ.alan.ad)} · ${tx("{n} değerli buluntu", { n: ozeller.length })} · ${tx("{n} sık buluntu", { n: KZ.bulunan.length - ozeller.length })}</p>
    ${bonus ? `<p>${tx("Kalan vuruş bonusu")}: <b>+${bonus}</b></p>` : ""}
    <p class="kz-toplam">${tx("Bu kazı")}: <b>${KZ.puan}</b> · ${tx("Bugün")}: <b>${kd.toplam}</b></p>
    <p class="aciklama">${tx("Kalan kazı izni")}: ${kd.hak}/${KZ_HAK}${H.kullanici ? "" : ` · <a href="#giris">${tx("Giriş yap")}</a>, ${tx("skorların tabloya yazılsın")}`}</p>
    <p style="margin-top:14px"><button class="buyuk-dugme" id="kz-geri">${tx("Ören yerlerine dön")}</button></p></div>`, lv => {
    lv.querySelector("#kz-geri").onclick = () => { levhaKapat(); location.hash = "#oyun/kazi"; };
  });
}
