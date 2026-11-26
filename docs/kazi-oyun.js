/* Arkix — Kazı Başı (#oyun/kazi): 2D piksel kazı oyunu.
 * Arkeolog seç (her birinin bir üstünlüğü var) → ören yeri seç → 10×8 açma; her tıklama bir hücreyi bir katman kazar (3 katman).
 * Buluntular farklı derinliklerde: sık buluntular çoğu 1–2 vuruşta, değerliler 2–3 vuruşta çıkar. Her kazıda 32 vuruş; günde 5 kazı izni.
 * Alanın bütün değerli buluntuları ve 14 sık buluntu gizlidir; çıkan buluntu tanıtılır, Buluntu Defteri'ne yazılır.
 * Her alanın kendi müziği var (WebAudio ile çalınan özgün kısa döngüler; kz-muzik).
 * İpucu: boş çıkan hücre, yakında değerli buluntu varsa "sıcak" görünür (1 hücre: kızıl, 2 hücre: amber).
 * Puan: buluntu puanları + hepsi bulunursa kalan vuruş × 5. Günlük toplam skor tablosuna gider (oyunlar.js › skorGonder).
 * Piksel çizimler 12×12 metin haritası; harf → renk. Hepsi özgün, basit çizimler. */

const KZ_SUTUN = 10, KZ_SATIR = 8, KZ_HUCRE = 16, KZ_SAHNE = 48, KZ_VURUS = 32, KZ_HAK = 5, KZ_SIK_SAYI = 14;

/* ---------------------------------------------------------------- çizimler */
const SPRITE = {
  /* dünya alanları */
  amfora: { r: { o: "#c0703a", d: "#7a4424", l: "#dc9a62" }, h: [
    "....d..d....", "...dooood...", "....oooo....", "...oolloo...", "..oolllloo..", "..oolllloo..", "..oooooooo..", "...oooooo...", "....oooo....", ".....oo.....", ".....dd.....", "............"] },
  pfresk: { r: { r: "#a8322a", k: "#2b2420", y: "#d9a43a", w: "#efe6d2" }, h: [
    "............", ".rrrrrrrr...", ".rrrrrrrrr..", ".rkkkkkkrr..", ".rkyyyykrrr.", ".rkywwykrrr.", ".rkyyyykrr..", ".rkkkkkkrr..", ".rrrrrrrr...", "..rrrrrr....", "............", "............"] },
  ekmek: { r: { b: "#4a3020", d: "#22160e", l: "#6e4a32" }, h: [
    "............", "............", "....bbbb....", "..bbdbbdbb..", ".bblbdblbbb.", ".bdddddddddb", ".bblbdblbbb.", "..bbdbbdbb..", "....bbbb....", "............", "............", "............"] },
  kopek: { r: { w: "#ece4d4", k: "#2b2420", r: "#a8322a" }, h: [
    "wwwwwwwwwwww", "wwkwwwwwwwww", "wkkkwwwwwwww", "wkkkkkkkkkww", "wwwkkkkkkkkw", "wwwkkkkkkkkw", "wwrkwwwwkwkw", "wwkwkwwwkwkw", "wwkwkwwwkwwk", "wwwwwwwwwwww", "wkwkwkwkwkww", "wwwwwwwwwwww"] },
  ekmekkalibi: { r: { o: "#b5703f", d: "#7d4a28" }, h: [
    "............", "..oooooooo..", "..oddddddo..", "..oddddddo..", "...oddddo...", "...oddddo...", "....oddo....", "....oddo....", ".....oo.....", "............", "............", "............"] },
  biratesti: { r: { o: "#c08050", d: "#8a5432", l: "#d9a274" }, h: [
    "....oooo....", "....dddd....", "...oooooo...", "..oooooooo..", "..oolooooo..", "..oolooooo..", "..oooooooo..", "...oooooo...", "....oooo....", ".....oo.....", "............", "............"] },
  keski: { r: { c: "#c07a3a", d: "#7a4a24" }, h: [
    "..........cc", ".........ccd", "........ccd.", ".......ccd..", "......ccd...", ".....ccd....", "....ccd.....", "...ccd......", "..ccd.......", ".ccd........", "cc..........", "............"] },
  kabartma: { r: { g: "#d9cdb4", k: "#6b5a44" }, h: [
    "gggggggggggg", "gkkggggkgggg", "gkggkggkkkgg", "gkkggggkgggg", "gggggggggggg", "ggkkkggkggkg", "ggkgkggkkkkg", "ggkkkggggggg", "gggggggggggg", "gkkkkkkkkkkg", "gggggggggggg", "............"] },
  lineerb: { r: { t: "#c9a27a", k: "#6b4a30" }, h: [
    "............", "..tttttttt..", ".tttttttttt.", ".tktkktkktt.", ".tttttttttt.", ".tkktktkktt.", ".tttttttttt.", ".tktkkttkt..", "..tttttttt..", "............", "............", "............"] },
  labrys: { r: { b: "#b8863a", w: "#7a5530" }, h: [
    "............", ".bb..ww..bb.", ".bbb.ww.bbb.", ".bbbbwwbbbb.", ".bbbbwwbbbb.", ".bbb.ww.bbb.", ".bb..ww..bb.", ".....ww.....", ".....ww.....", ".....ww.....", ".....ww.....", "............"] },
  kamares: { r: { k: "#2b2420", w: "#efe6d2", r: "#c0502a" }, h: [
    "............", "..kkkkkkkk..", "..kwkrkwkk..", "..kkwkkrkk..", "..krkwkkwk..", "...kkkkkk...", "....kkkk....", ".....kk.....", "....kkkk....", "............", "............", "............"] },
  bogafresk: { r: { b: "#6fa7c4", d: "#7a4a2a", w: "#efe6d2", y: "#d9a43a" }, h: [
    "bbbbbbbbbbbb", "bbbbbwwbbbbb", "bbbbwwwwbbbb", "bdbbbbbbbbdb", "bbdddddddbbb", "bddddddddddb", "bbdbbbbbbdbb", "bbdbbbbbbdbb", "yyyyyyyyyyyy", "............", "............", "............"] },
  /* dünya alanları (2) */
  geyikkazma: { r: { a: "#d9c7a4", d: "#a08a64" }, h: [
    "............", ".a..........", ".aa.........", "..aa..a.....", "...aaaa.....", "....aa......", ".....aa.....", "......aa....", ".......aa...", "........ad..", ".........ad.", "............"] },
  mavitas: { r: { b: "#6f8a96", l: "#9db3bd", d: "#4a5f68" }, h: [
    "............", "....bbb.....", "...bbllb....", "..bbblbbb...", "..bbbbbbbd..", ".bbbbbbbbd..", ".bbbbbbbdd..", "..bbbbbddd..", "...ddddd....", "............", "............", "............"] },
  olukcanak: { r: { o: "#9a6a44", d: "#6a4428", l: "#b88a5e" }, h: [
    "............", "..oooooooo..", "..dlldlldl..", "..oooooooo..", "..dlldlldl..", "...oooooo...", "...dlldld...", "....oooo....", "............", "............", "............", "............"] },
  domuzdisi: { r: { w: "#efe6d2", s: "#c2b294" }, h: [
    "............", "..........w.", ".........ww.", "........www.", ".......wws..", "......wws...", "....wwws....", "..wwwws.....", ".wwwss......", ".sss........", "............", "............"] },
  aribalo: { r: { o: "#b5643a", k: "#2b2420", w: "#e8dcc4" }, h: [
    "....oooo....", ".....oo.....", "...oooooo...", "..oowkwkoo..", "o.okwkwkko.o", "o.oowkwkoo.o", "..oooooooo..", "...oooooo...", "....oooo....", ".....oo.....", "......o.....", "............"] },
  tupu: { r: { b: "#b8863a", d: "#7a5530" }, h: [
    "....bbbb....", "...bbbbbb...", "...bbddbb...", "....bbbb....", ".....bb.....", ".....bb.....", ".....bb.....", ".....bb.....", ".....bd.....", ".....bd.....", "......d.....", "............"] },
  tascekic: { r: { g: "#8a8a82", l: "#b0b0a8", d: "#5e5e58" }, h: [
    "............", "............", "....gggg....", "...gllggg...", "..gllgggggd.", "..ggggggggd.", "..gggggggdd.", "...gggggdd..", "....dddd....", "............", "............", "............"] },
  kustabak: { r: { o: "#c07a4a", k: "#2b2420", d: "#8a5030" }, h: [
    "............", "............", "........oo..", ".......okoo.", "oooooooooo..", "okkokkokko..", ".oooooooo...", "..dddddd....", "............", "............", "............", "............"] },
  askerbas: { r: { g: "#9a8f80", d: "#6e655a", k: "#3e3830" }, h: [
    "....kkkk....", "...kkkkkk...", "...gggggg...", "..gggggggg..", "..gkkggkkg..", "..gggggggg..", "..ggggdggg..", "..ggdddggg..", "...gggggg...", "....gggg....", "...dddddd...", "............"] },
  bronzok: { r: { b: "#8a7a3a", d: "#5a4e24", w: "#7a5530" }, h: [
    ".....bb.....", "....bbbb....", "....bbbb....", "...bbbbbb...", "...bbddbb...", "....bddb....", ".....ww.....", ".....ww.....", ".....ww.....", ".....ww.....", ".....ww.....", "............"] },
  banliang: { r: { c: "#8a7a3a", d: "#4a4024", l: "#b0a050" }, h: [
    "............", "....cccc....", "...cllllc...", "..clddddlc..", "..cld..dlc..", "..cld..dlc..", "..clddddlc..", "...cllllc...", "....cccc....", "............", "............", "............"] },
  tetik: { r: { b: "#8a7a3a", d: "#5a4e24" }, h: [
    "............", "...bb.......", "...bbb......", "...bbbbbbb..", "...bdddddb..", "...bbbbbbb..", "....bb......", "....bb......", "....bbb.....", ".....bb.....", "............", "............"] },
  nabaticanak: { r: { o: "#d9a070", r: "#8a3a2a", k: "#5a2a1a" }, h: [
    "............", "............", "oooooooooooo", "orooroorooro", ".okookookoo.", "..orooroor..", "...oooooo...", "....oooo....", "............", "............", "............", "............"] },
  nabatisikke: { r: { c: "#a8a8a0", d: "#6a6a64", l: "#d0d0c8" }, h: [
    "............", "....cccc....", "...cllllc...", "..cldddllc..", "..clddddlc..", "..cllddllc..", "..clldlllc..", "...cllllc...", "....cccc....", "............", "............", "............"] },
  sukanali: { r: { o: "#b5703f", d: "#7d4a28", i: "#3a2418" }, h: [
    "............", "............", "............", "oooooooooo..", "oiiiiiiiioo.", "oiiiiiiiioo.", "oooooooooo..", "dddddddddd..", "............", "............", "............", "............"] },
  nabatiyazit: { r: { p: "#d9a08a", k: "#7a4a3a" }, h: [
    "pppppppppppp", "pkpkkpkpkkpp", "pkkpkpkkpkpp", "pppppppppppp", "ppkkpkpkkpkp", "pkpkkpkpkkpp", "pppppppppppp", "pkkpkkpkpkkp", "pppppppppppp", "............", "............", "............"] },
  /* aletler */
  alet_kazma: { r: { m: "#9aa3ab", w: "#7a5530" }, h: [
    "............", "..mmmmmmmm..", ".mm..ww..mm.", "m....ww....m", ".....ww.....", ".....ww.....", ".....ww.....", ".....ww.....", ".....ww.....", ".....ww.....", "............", "............"] },
  alet_mala: { r: { m: "#9aa3ab", w: "#7a5530" }, h: [
    "..........ww", ".........ww.", "........ww..", ".......m....", "......mmm...", ".....mmmmm..", "....mmmmmm..", "...mmmmmm...", "...mmmmm....", "...mmmm.....", "...mm.......", "............"] },
  alet_firca: { r: { w: "#7a5530", m: "#9aa3ab", b: "#d9b36a" }, h: [
    "......ww....", "......ww....", "......ww....", "......ww....", "......ww....", ".....mmmm...", ".....bbbb...", "....bbbbbb..", "....bbbbbb..", "....b.bb.b..", "............", "............"] },
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
Object.assign(SPRITE, {
  yonga: { r: { f: "#9c8f7e", d: "#6a5f52", l: "#c7bcac" }, h: [
    "............", "............", "....ff......", "...flfd.....", "..flffd.....", "..fffffd....", "...ffffd....", "....fdd.....", "............", "............", "............", "............"] },
  elbaltasi: { r: { f: "#b2a48c", d: "#7c6f5a", l: "#d6ccb8" }, h: [
    ".....ff.....", "....fffd....", "....fldd....", "...flffd....", "...fffddd...", "..fflfffdd..", "..fffffddd..", "..ffffddd...", "...fffdd....", "....fdd.....", "............", "............"] },
  levallois: { r: { f: "#a99a84", d: "#6f6352", l: "#d0c6b4" }, h: [
    ".....l......", ".....ld.....", "....lfd.....", "....lffd....", "...lfffd....", "...lffffd...", "..lffffffd..", "..lffffffd..", "..dddddddd..", "............", "............", "............"] },
  dis: { r: { w: "#f1ead8", s: "#c9bea4" }, h: [
    "............", "...wwwwww...", "..wwwwwwww..", "..wwswwsww..", "..wwwwwwww..", "..wwwwwwww..", "...wwwwww...", "...ww..ww...", "...ws..sw...", "...w....w...", "............", "............"] },
  kaziyici: { r: { f: "#a38f74", d: "#6c5c47", l: "#cdbfa8" }, h: [
    "............", "............", "..ffffffff..", ".flllllllfd.", ".ffffffffd..", "..fffffffd..", "...ffffffd..", "....fffdd...", ".....dd.....", "............", "............", "............"] },
  dilgicik: { r: { f: "#8d8478", d: "#5b544b", l: "#bdb4a6" }, h: [
    "............", "..l...l...l.", "..f...f...f.", "..f..lf...f.", "..fd.fd..fd.", "..fd.fd..fd.", "..fd.fd..fd.", "..fd.fd..fd.", "...d..d...d.", "............", "............", "............"] },
  nukleus: { r: { f: "#958a7c", d: "#5e564c", l: "#c2b9ab" }, h: [
    "............", "............", "....ffff....", "...fdfdfd...", "..fdlfdlfd..", "..fdlfdlfd..", "..fdlfdlfd..", "...fdfdfd...", "....dddd....", "............", "............", "............"] },
  tasfigurin: { r: { s: "#cbbfa9", d: "#8a7e6a" }, h: [
    "............", ".....ss.....", "....ssss....", ".....ss.....", "....ssss....", "...ssddss...", "...ssssss...", "....ssss....", "....s..s....", "....d..d....", "............", "............"] },
  // arkeologlar (12×16)
  ark_zoo: { r: { h: "#6b7a3a", s: "#d9a87e", k: "#2b2420", c: "#a8743a", p: "#4d4a42", b: "#3a2e24", w: "#efe6d2" }, h: [
    "............", "...hhhhhh...", "..hhhhhhhh..", "....ssss....", "....sksk....", "....ssss....", ".....ss.....", "...cccccc...", "..cccccccc..", "..sccccccsww", "..s.cccc..w.", "....pppp....", "....pppp....", "....p..p....", "....p..p....", "...bb..bb..."] },
  ark_konservator: { r: { k: "#3a2a20", s: "#e8c4a0", e: "#2b2420", c: "#e8e4da", g: "#7ab0c8", p: "#4d5a6a", b: "#3a2e24" }, h: [
    "....kkkk....", "...kkkkkk...", "...kssssk...", "....eses....", "....ssss....", ".....ss.....", "...cccccc...", "..cccccccc..", "..gccccccg..", "..g.cccc.g..", "....cccc....", "....pppp....", "....p..p....", "....p..p....", "...bb..bb...", "............"] },
  ark_epigrafist: { r: { r: "#8a3a2a", s: "#d9a87e", k: "#2b2420", c: "#4a5a78", p: "#5a4a3a", b: "#3a2e24", t: "#c9a27a" }, h: [
    "............", "...rrrrr....", "..rrrrrrr...", "....ssss....", "....sksk....", "....ssss....", ".....ss.....", "...cccccc...", "..cccccccc..", "..sccccccstt", "..s.cccc.stt", "....pppp....", "....pppp....", "....p..p....", "....p..p....", "...bb..bb..."] },
  boncuk: { r: { b: "#3a8aa8", l: "#8fd0e0", k: "#1f4a5a" }, h: [
    "............", "............", "............", "....kbbk....", "...kbllbk...", "...kbbbbk...", "...kbbbbk...", "....kbbk....", "............", "............", "............", "............"] },
  komur: { r: { k: "#1f1a17", g: "#3d3530" }, h: [
    "............", "............", "....kkk.....", "...kkgkk....", "..kkkkgkk...", "..kgkkkkk...", "...kkkgk....", "....kkk.....", "............", "............", "............", "............"] },
  mikrolit: { r: { f: "#b9b2a6", d: "#7e776c" }, h: [
    "............", "............", "..........f.", "........ffd.", "......fffd..", "....ffffd...", "..fffffd....", ".fffffd.....", "............", "............", "............", "............"] },
  sikke: { r: { c: "#b8863a", d: "#7a5530", l: "#e0b860" }, h: [
    "............", "....cccc....", "...cllllc...", "..clddddlc..", "..cldlldlc..", "..cldlldlc..", "..clddddlc..", "...cllllc...", "....cccc....", "............", "............", "............"] },
  ark_saha: { r: { h: "#c9a25a", s: "#e8c4a0", k: "#2b2420", c: "#5c7d5a", p: "#5a4a3a", b: "#3a2e24" }, h: [
    "....hhhh....", "..hhhhhhhh..", "....ssss....", "....sksk....", "....ssss....", ".....ss.....", "...cccccc...", "..cccccccc..", "..sccccccs..", "..s.cccc.s..", "....pppp....", "....pppp....", "....p..p....", "....p..p....", "...bb..bb...", "............"] },
  ark_prehistorya: { r: { k: "#7a4a2a", s: "#d9a87e", e: "#2b2420", c: "#b8863b", p: "#4d5a6a", b: "#3a2e24", f: "#9c8f7e" }, h: [
    ".....kk.....", "....kkkk....", "...kssssk...", "...ksese....", "....ssss....", ".....ss.....", "...cccccc...", "..cccccccc..", "..sccccccsf.", "..s.cccc..f.", "....pppp....", "....pppp....", "....p..p....", "....p..p....", "...bb..bb...", "............"] },
  ark_klasik: { r: { h: "#3f5c7a", s: "#f0cfae", k: "#2b2420", c: "#e7e1d3", p: "#7a6a52", b: "#3a2e24", g: "#d6a23a" }, h: [
    "............", "...hhhhh....", "..hhhhhhh...", "....ssss....", "....sksk....", "....ssss....", "...cccccc...", "..cccggccc..", "..sccccccs..", "..s.cccc.s..", "....pppp....", "....pppp....", "....p..p....", "....p..p....", "...bb..bb...", "............"] },
  ark_jeofizik: { r: { h: "#e06a2b", s: "#c99472", k: "#2b2420", c: "#e0a12c", p: "#3d4a5a", b: "#3a2e24", g: "#6d7a84", y: "#9be27a" }, h: [
    "....hhhh....", "...hhhhhh...", "....ssss....", "....sksk....", "....ssss....", ".....ss.....", "...cccccc...", "..cccccccc..", "..sccccccs..", "..s.cccc.sg.", "....pppp..g.", "....pppp..g.", "....p..p..g.", "....p..p.ggg", "...bb..bb.y.", "............"] },
});

function spriteCiz(ctx, ad, x, y, olcek = 1, golge = false, renk = null) {
  const s = SPRITE[ad]; if (!s) return;
  const gen = Math.max(...s.h.map(x => x.length));
  s.h.forEach((satir, j) => [...satir.padEnd(gen, ".")].forEach((c, i) => {
    if (c === ".") return;
    ctx.fillStyle = golge ? "rgba(60,45,35,.55)" : ((renk && renk[c]) || s.r[c] || "#000");
    ctx.fillRect(x + i * olcek, y + j * olcek, olcek, olcek);
  }));
}

/* Kırılan buluntunun üstüne çatlak (12×12 ızgarada) */
function kirikCiz(ctx, x, y, olcek = 1) {
  ctx.fillStyle = "rgba(35,22,14,.9)";
  for (const [i, j] of [[2, 1], [3, 2], [4, 3], [4, 4], [5, 5], [6, 5], [7, 6], [7, 7], [8, 8], [9, 9], [6, 4], [7, 3], [8, 2], [3, 7], [2, 8]])
    ctx.fillRect(x + i * olcek, y + j * olcek, olcek, olcek);
}

/* Aletler: kazma hızlı ama kırılgan buluntuyu kırabilir; fırça kırmaz ama iki vuruş harcar */
const KZ_ALETLER = {
  kazma: { ad: "Kazma", ad_en: "Pickaxe", kisa: "2 katman · kırabilir", kisa_en: "2 layers · may break", katman: 2, bedel: 1, kirma: 0.5, sprite: "alet_kazma" },
  mala:  { ad: "Mala", ad_en: "Trowel", kisa: "1 katman · az risk", kisa_en: "1 layer · low risk", katman: 1, bedel: 1, kirma: 0.1, sprite: "alet_mala" },
  firca: { ad: "Fırça", ad_en: "Brush", kisa: "1 katman · 2 vuruş · kırmaz", kisa_en: "1 layer · 2 strikes · safe", katman: 1, bedel: 2, kirma: 0, sprite: "alet_firca" },
};
const aletAd = a => DIL === "en" ? a.ad_en : a.ad;
const KZ_KIRIK_ORAN = 0.3;   // kırılan buluntu puanın %30'unu getirir, deftere yazılmaz

/* Tohumlu rastgele (Günün Açması: herkese aynı açma) */
function kzTohum(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function kzRng(tohum) {
  let a = tohum >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function karistir(dizi, rng) { for (let i = dizi.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [dizi[i], dizi[j]] = [dizi[j], dizi[i]]; } return dizi; }

/* ---------------------------------------------------------------- ören yerleri ve buluntular */
const KZ_SIK = [
  { id: "yonga", ad: "Çakmaktaşı yongası", ad_en: "Flint flake", puan: 15, tarihOncesi: true,
    bilgi: "Taş alet yapılırken kopan parça. Yongalar, aletin nerede ve nasıl yapıldığını anlatır; tarih öncesi alanların en sık buluntusudur.",
    bilgi_en: "A piece struck off while making stone tools. Flakes show where and how tools were made; the commonest find at prehistoric sites." },
  { id: "canak", ad: "Çanak çömlek parçası", ad_en: "Potsherd", puan: 15, cag: true,
    bilgi: "Arkeolojinin en sık buluntusu. Hamuru, biçimi ve süslemesi, bulunduğu katmanı tarihlemeye yardım eder.",
    bilgi_en: "The most common archaeological find. Its fabric, shape and decoration help date the layer it came from." },
  { id: "kemik", ad: "Hayvan kemiği", ad_en: "Animal bone", puan: 10,
    bilgi: "Zooarkeologlar kemiklerden ne yendiğini ve hangi hayvanların evcilleştirildiğini öğrenir.",
    bilgi_en: "Zooarchaeologists learn from bones what people ate and which animals were domesticated." },
  { id: "tohum", ad: "Kömürleşmiş tohum", ad_en: "Charred seeds", puan: 20,
    bilgi: "Yanarak kömürleşen tohumlar binlerce yıl korunur. Arkeobotanikçiler bunlarla tarımı izler; radyokarbon tarihlemesinde de kullanılır.",
    bilgi_en: "Seeds charred by fire survive for millennia. Archaeobotanists use them to trace farming, and they are also used for radiocarbon dating." },
];
/* Elekte çıkan küçük buluntular (sık buluntu sayılır). Kazılan her katman kovaya gider; 3 kova = 1 eleme (1 vuruş). */
const KZ_ELEK = [
  { id: "boncuk", ad: "Boncuk", ad_en: "Bead", puan: 25,
    bilgi: "Taş, kemik, cam ya da fayanstan küçük boncuklar. Gözden kaçacak kadar küçük oldukları için çoğu ancak elekte bulunur.",
    bilgi_en: "Small beads of stone, bone, glass or faience. They are so small that most are found only in the sieve." },
  { id: "komur", ad: "Kömür parçası", ad_en: "Charcoal fragment", puan: 20,
    bilgi: "Ocaklardan kalan kömür, radyokarbon (C14) tarihlemesinde en sık kullanılan malzemedir; hangi ağaçların yakıldığını da gösterir.",
    bilgi_en: "Charcoal from hearths is the material most often used for radiocarbon dating, and it shows which trees were burned." },
  { id: "mikrolit", tarihOncesi: true, ad: "Mikrolit", ad_en: "Microlith", puan: 30,
    bilgi: "Birkaç santimlik geometrik taş aletler. Sapa dizilerek ok ve orak yapılırdı; Epipaleolitik'te yaygındır.",
    bilgi_en: "Geometric stone tools a few centimetres long, set in hafts to make arrows and sickles; common in the Epipalaeolithic." },
  { id: "sikke", sikke: true, ad: "Küçük bronz sikke", ad_en: "Small bronze coin", puan: 35,
    bilgi: "Gündelik alışverişte kullanılan küçük bronz sikkeler toprakta kolay gözden kaçar; çoğu ancak elekte bulunur.",
    bilgi_en: "Small bronze coins for everyday shopping are easy to miss in the soil; most turn up only in the sieve." },
];
const KZ_ELEK_KOVA = 3, KZ_ELEK_OLASILIK = 0.6;
const KZ_SAGLAM_VURUS = 3;   // değerli buluntuyu kırmadan çıkarana ödül
/* Hava: her kazı başında (Günün Açması'nda herkese aynı). Yağmur: çamurlu 2 sırada kazma 1 vuruş fazla. Rüzgâr/kum fırtınası: ipucu menzili 1 kısa. */
const KZ_HAVA = {
  gunes:  { simge: "☀️", ad: "Güneşli", ad_en: "Sunny", aciklama: "", aciklama_en: "" },
  yagmur: { simge: "🌧️", ad: "Yağmurlu", ad_en: "Rainy", aciklama: "Çamurlu iki sırada her kazma 1 vuruş fazla harcar.", aciklama_en: "In the two muddy rows every dig costs 1 extra strike." },
  ruzgar: { simge: "💨", ad: "Rüzgârlı", ad_en: "Windy", aciklama: "Toz ipuçlarını örtüyor: değerli buluntu yalnız hemen yanındaki hücreden sezilir.", aciklama_en: "Dust hides the hints: valuable finds are sensed only from the adjacent square." },
  kum:    { simge: "🌪️", ad: "Kum fırtınası", ad_en: "Sandstorm", aciklama: "Kum ipuçlarını örtüyor: değerli buluntu yalnız hemen yanındaki hücreden sezilir.", aciklama_en: "Sand hides the hints: valuable finds are sensed only from the adjacent square." },
};
const havaAd = h => DIL === "en" ? h.ad_en : h.ad, havaAciklama = h => DIL === "en" ? h.aciklama_en : h.aciklama;
const KZ_RESTORE_ORAN = 0.4;   // restorasyon kırık buluntunun puanını %30'dan %70'e çıkarır
const KZ_KEMIK = new Set(["kemik", "dis", "bukranion", "domuzdisi", "geyikkazma"]);   // zooarkeolog ×2
const KZ_YAZITLI = new Set(["tablet", "bulla", "zbulla", "kilic", "lineerb", "kabartma", "kopek", "sikke", "ari", "banliang", "nabatisikke", "nabatiyazit"]);   // epigrafist ×2

const KZ_ALANLAR = [
  { id: "karain", ad: "Karain Mağarası", il: "Antalya", tarihOncesi: true, donem: "Paleolitik: Alt Paleolitik'ten Epipaleolitik'e", donem_en: "Palaeolithic: Lower Palaeolithic to Epipalaeolithic",
    toprak: ["#b49a7c", "#8f7660", "#6a5544", "#cbbfae"], gok: ["#e9e2d4", "#cfc4b0"],
    buluntular: [
      { id: "elbaltasi", ad: "El baltası", ad_en: "Hand axe", puan: 220,
        bilgi: "İki yüzü yontulmuş, çok amaçlı Alt Paleolitik aleti. Karain, Türkiye'de en uzun süre kullanılmış mağaralardan biridir; en alt katları Alt Paleolitik'e iner.",
        bilgi_en: "A bifacially worked, multi-purpose Lower Palaeolithic tool. Karain is one of Türkiye's longest-used caves; its lowest layers reach the Lower Palaeolithic." },
      { id: "levallois", ad: "Levallois uç", ad_en: "Levallois point", puan: 180,
        bilgi: "Taşın önceden hazırlanıp tek darbeyle uç koparıldığı Levallois tekniği, Orta Paleolitik'in, yani Neandertaller çağının işaretidir.",
        bilgi_en: "The Levallois technique, preparing a core to strike off a point in one blow, marks the Middle Palaeolithic, the age of Neanderthals." },
      { id: "dis", ad: "Neandertal dişi", ad_en: "Neanderthal tooth", puan: 250,
        bilgi: "Karain'in Orta Paleolitik katlarında Neandertallere ait insan kalıntıları, özellikle dişler bulundu.",
        bilgi_en: "Human remains attributed to Neanderthals, mainly teeth, were found in Karain's Middle Palaeolithic layers." },
      { id: "kaziyici", ad: "Kazıyıcı", ad_en: "Scraper", puan: 120,
        bilgi: "Deri ve odun işlemek için kenarı düzeltilmiş taş alet. Karain'den binlerce yontmataş alet çıktı.",
        bilgi_en: "A stone tool with a retouched edge for working hides and wood. Thousands of chipped-stone tools came from Karain." },
    ] },
  { id: "kizilin", ad: "Kızılin", il: "Antalya, Katran Dağı", tarihOncesi: true, donem: "Epipaleolitik", donem_en: "Epipalaeolithic",
    toprak: ["#b88a68", "#956a50", "#6e4d3a", "#d0bba4"], gok: ["#e3eadf", "#bcd0b8"],
    buluntular: [
      { id: "dilgicik", ad: "Dilgicikler", ad_en: "Bladelets", puan: 150,
        bilgi: "Kızılin'de yoğun bir dilgicik üretimi saptandı. Bu küçük taş kesiciler sapa dizilerek ok ve mızrak uçlarında kullanılırdı.",
        bilgi_en: "Intensive bladelet production was identified at Kızılin. These small stone blades were set in hafts for arrows and spears." },
      { id: "nukleus", ad: "Dilgicik çekirdeği", ad_en: "Bladelet core", puan: 140,
        bilgi: "Dilgiciklerin koparıldığı taş çekirdek (nükleus). Üzerindeki izler, alet yapımcısının hangi sırayla vurduğunu gösterir.",
        bilgi_en: "The stone core from which bladelets were struck. Its scars show the order of the knapper's blows." },
      { id: "tasfigurin", ad: "Taş figürin", ad_en: "Stone figurine", puan: 250,
        bilgi: "Kızılin'de çıkan küçük taş figürinler, 2025'te Höyük dergisinde Anadolu'nun bilinen en eski taş figürinleri olarak tanıtıldı.",
        bilgi_en: "Small stone figurines from Kızılin were presented in the journal Höyük in 2025 as the oldest known stone figurines in Anatolia." },
    ] },
  { id: "gobekli", ad: "Göbeklitepe", il: "Şanlıurfa", tarihOncesi: true, donem: "Çanak Çömleksiz Neolitik, MÖ 9600–8200", donem_en: "Pre-Pottery Neolithic, 9600–8200 BC",
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
  { id: "catal", ad: "Çatalhöyük", il: "Konya", tarihOncesi: true, canak: true, donem: "Neolitik, MÖ 7100–5950", donem_en: "Neolithic, 7100–5950 BC",
    toprak: ["#c9ad86", "#a88a64", "#7f6648", "#dccfb6"], gok: ["#f1e2bd", "#dcc79a"],
    buluntular: [
      { id: "figurin", kirilgan: true, ad: "Oturan kadın figürini", ad_en: "Seated woman figurine", puan: 250,
        bilgi: "Yanlarında iki kedigil bulunan bir tahtta oturan pişmiş toprak kadın figürini. Yaklaşık 8.000 yıllık; Ankara'daki Anadolu Medeniyetleri Müzesi'nde.",
        bilgi_en: "A clay figure of a woman seated on a throne flanked by two felines, about 8,000 years old; in the Museum of Anatolian Civilizations, Ankara." },
      { id: "ayna", kirilgan: true, ad: "Obsidyen ayna", ad_en: "Obsidian mirror", puan: 200,
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
      { id: "tablet", kirilgan: true, ad: "Çivi yazılı tablet", ad_en: "Cuneiform tablet", puan: 220,
        bilgi: "Hitit başkentinde on binlerce tablet parçası bulundu. Kadeş Antlaşması'nın Akadca metni de Hattuşa arşivlerinden geliyor.",
        bilgi_en: "Tens of thousands of tablet fragments were found in the Hittite capital, including the Akkadian text of the Treaty of Kadesh." },
      { id: "riton", kirilgan: true, ad: "Boğa biçimli kap", ad_en: "Bull-shaped vessel", puan: 200,
        bilgi: "Fırtına Tanrısı'nın boğaları Şeri ve Hurri'yi canlandırdığı düşünülen iki pişmiş toprak kap, 1963'te Büyükkale'de bulundu.",
        bilgi_en: "Two clay vessels thought to depict Serri and Hurri, the Storm God's bulls, found on Büyükkale in 1963." },
      { id: "kilic", ad: "Tunç kılıç", ad_en: "Bronze sword", puan: 240,
        bilgi: "1991'de bulunan kılıcın Akadca yazıtı, Kral II. Tudhaliya'nın Assuwa zaferinden sonra onu Fırtına Tanrısı'na adadığını söyler.",
        bilgi_en: "Found in 1991, its Akkadian inscription says King Tudhaliya II dedicated it to the Storm God after his victory over Assuwa." },
      { id: "bulla", ad: "Mühür baskısı", ad_en: "Seal impression", puan: 130,
        bilgi: "Nişantepe arşivinde belgelere basılmış binlerce kil mühür baskısı bulundu. Kralların adları hiyeroglif ve çivi yazısıyla geçer.",
        bilgi_en: "Thousands of clay sealings from documents were found in the Nişantepe archive, naming kings in hieroglyphic and cuneiform script." },
    ] },
  { id: "troya", sikke: true, ad: "Troya", il: "Çanakkale", donem: "Tunç Çağı – Roma, MÖ 3000 – MS 500", donem_en: "Bronze Age – Roman, 3000 BC – AD 500",
    toprak: ["#bfa07c", "#9b7d5c", "#755b42", "#d2c3a8"], gok: ["#d8ecf2", "#a9d0de"],
    buluntular: [
      { id: "depas", kirilgan: true, ad: "İki kulplu kadeh", ad_en: "Two-handled goblet", puan: 180,
        bilgi: "Depas amphikypellon denen uzun, iki kulplu kadeh Erken Tunç Çağı'nda, Troya II'de yaygındı. Paylaşılarak içmek için kullanıldığı düşünülür.",
        bilgi_en: "The tall, two-handled depas amphikypellon was common in Early Bronze Age Troy II, probably used for shared drinking." },
      { id: "kupe", ad: "Altın küpe", ad_en: "Gold earring", puan: 250,
        bilgi: "Schliemann'ın 'Priamos'un Hazinesi' dediği altın takılar aslında Priamos'tan yaklaşık bin yıl eskidir; Erken Tunç Çağı'na aittir.",
        bilgi_en: "The gold jewellery Schliemann called 'Priam's Treasure' is about a thousand years older than Priam, from the Early Bronze Age." },
      { id: "agirsak", ad: "İğ ağırşağı", ad_en: "Spindle whorl", puan: 110,
        bilgi: "Yün ve keten eğirirken iğe takılan delikli pişmiş toprak ağırlık. Troya'da binlercesi bulundu.",
        bilgi_en: "A pierced clay weight fitted to a spindle for spinning wool and flax. Thousands were found at Troy." },
      { id: "pitos", kirilgan: true, ad: "Pitos (depolama küpü)", ad_en: "Pithos (storage jar)", puan: 150,
        bilgi: "Tahıl, yağ ve şarap saklanan insan boyunda küpler. Troya VI–VII evlerinde tabana gömülü olarak bulundu.",
        bilgi_en: "Person-sized jars for grain, oil and wine, found sunk into house floors of Troy VI–VII." },
    ] },
  { id: "efes", sikke: true, ad: "Efes", il: "İzmir", donem: "Helenistik – Roma, MÖ 300 – MS 600", donem_en: "Hellenistic – Roman, 300 BC – AD 600",
    toprak: ["#c4a47e", "#a2825e", "#7a5f44", "#e0d4bd"], gok: ["#cfe6f5", "#9cc8e6"],
    buluntular: [
      { id: "kandil", kirilgan: true, ad: "Pişmiş toprak kandil", ad_en: "Clay oil lamp", puan: 110,
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
  { id: "zeugma", sikke: true, ad: "Zeugma", il: "Gaziantep", donem: "Helenistik – Roma, MÖ 300 – MS 256", donem_en: "Hellenistic – Roman, 300 BC – AD 256",
    toprak: ["#b99b78", "#977a5a", "#715a42", "#d6c8ae"], gok: ["#e4eef2", "#b4d3df"],
    buluntular: [
      { id: "mozaik", ad: "Çingene Kızı mozaiği", ad_en: "Gypsy Girl mosaic", puan: 250,
        bilgi: "Zeugma'nın simgesi; Gaziantep Zeugma Mozaik Müzesi'nde. Kimi betimlediği tartışmalıdır: Gaia ya da Ariadne olduğu öne sürülür.",
        bilgi_en: "Zeugma's emblem, in the Zeugma Mosaic Museum, Gaziantep. Whom it shows is debated; Gaia or Ariadne have been suggested." },
      { id: "zbulla", kirilgan: true, ad: "Kil mühür baskısı", ad_en: "Clay bulla", puan: 140,
        bilgi: "Zeugma'da arşivin yanmasıyla pişip korunan on binlerce mühür baskısı bulundu; dünyanın en büyük bulla buluntularından.",
        bilgi_en: "Tens of thousands of sealings, baked and preserved when an archive burned, make Zeugma one of the largest bulla finds in the world." },
      { id: "mars", ad: "Tunç Mars heykeli", ad_en: "Bronze statue of Mars", puan: 220,
        bilgi: "Savaş tanrısı Mars'ın tunç heykeli kurtarma kazılarında bulundu; bugün Zeugma Mozaik Müzesi'nde.",
        bilgi_en: "The bronze statue of Mars, god of war, was found during rescue excavations and is now in the Zeugma Mosaic Museum." },
      { id: "fresk", kirilgan: true, ad: "Duvar resmi parçası", ad_en: "Wall-painting fragment", puan: 160,
        bilgi: "Zeugma villalarının duvarları fresklerle süslüydü. Birecik Barajı'nın suları basmadan önce kurtarma kazılarıyla çıkarıldı.",
        bilgi_en: "Zeugma's villas had frescoed walls, removed in rescue digs before the Birecik Dam reservoir flooded them." },
    ] },
  /* ---- Dünya */
  { id: "pompeii", sikke: true, bolge: "dunya", ad: "Pompeii", il: "Napoli, İtalya", il_en: "Naples, Italy", donem: "Roma; MS 79'da Vezüv'ün külleri altında kaldı", donem_en: "Roman; buried by Vesuvius in AD 79",
    toprak: ["#8d8579", "#6f685e", "#545049", "#b7ada0"], gok: ["#f2d9c4", "#d9a98e"],
    buluntular: [
      { id: "amfora", kirilgan: true, ad: "Amfora", ad_en: "Amphora", puan: 140,
        bilgi: "Şarap, zeytinyağı ve balık sosu (garum) taşınan iki kulplu küp. Pompeii'de garum satan dükkânlar da bulundu.",
        bilgi_en: "A two-handled jar for wine, olive oil and fish sauce (garum). Shops selling garum were also found at Pompeii." },
      { id: "pfresk", kirilgan: true, ad: "Fresk parçası", ad_en: "Fresco fragment", puan: 200,
        bilgi: "Pompeii evlerinin duvarları canlı renkli fresklerle boyalıydı. Bu boyama biçimleri bugün dört 'Pompeii üslubu' olarak sınıflandırılır.",
        bilgi_en: "Pompeii's house walls were painted with vivid frescoes, classified today into four 'Pompeian styles'." },
      { id: "ekmek", kirilgan: true, ad: "Kömürleşmiş ekmek", ad_en: "Carbonised bread", puan: 180,
        bilgi: "Vezüv'ün sıcak külü fırınlardaki ekmekleri kömürleştirerek korudu. Dilimlere ayrılmış yuvarlak somunlar Roma fırıncılığını gösterir.",
        bilgi_en: "Vesuvius's hot ash carbonised and preserved loaves in the bakeries. Round loaves scored into portions show Roman baking." },
      { id: "kopek", ad: "“Cave canem” mozaiği", ad_en: "“Cave canem” mosaic", puan: 250,
        bilgi: "“Köpeğe dikkat” yazan bu mozaik, Trajik Şair'in Evi'nin girişinde zincirli bir bekçi köpeğini gösterir.",
        bilgi_en: "This 'Beware of the dog' mosaic shows a chained guard dog at the entrance of the House of the Tragic Poet." },
    ] },
  { id: "giza", kurak: true, bolge: "dunya", ad: "Gize", ad_en: "Giza", il: "Kahire, Mısır", il_en: "Cairo, Egypt", donem: "Eski Krallık, MÖ 2600–2500", donem_en: "Old Kingdom, 2600–2500 BC",
    toprak: ["#d8bb8a", "#c09e6c", "#9d7f52", "#e8d6b4"], gok: ["#f6e3b6", "#eec98a"],
    buluntular: [
      { id: "ekmekkalibi", kirilgan: true, ad: "Ekmek kalıbı", ad_en: "Bread mould", puan: 140,
        bilgi: "Piramit işçilerinin kentinde ekmek pişirilen çok sayıda çan biçimli kalıp bulundu. İşçiler ekmek ve birayla beslenirdi.",
        bilgi_en: "Many bell-shaped bread moulds were found in the pyramid workers' town. Workers lived on bread and beer." },
      { id: "biratesti", kirilgan: true, ad: "Bira testisi", ad_en: "Beer jar", puan: 120,
        bilgi: "Bira, Mısırlıların günlük besiniydi. İşçilere verilen erzakın bir bölümü biraydı.",
        bilgi_en: "Beer was a daily staple in Egypt; part of the workers' rations was beer." },
      { id: "keski", ad: "Bakır keski", ad_en: "Copper chisel", puan: 180,
        bilgi: "Kireçtaşı bloklar bakır keskiler, taş çekiçler ve kumla işlendi. Bakır yumuşak olduğu için keskiler sık sık bilenirdi.",
        bilgi_en: "Limestone blocks were worked with copper chisels, stone hammers and sand. Copper is soft, so chisels were sharpened often." },
      { id: "kabartma", ad: "Hiyeroglifli kabartma", ad_en: "Hieroglyphic relief", puan: 240,
        bilgi: "Piramitlerin çevresindeki mastaba mezarlarının duvarlarında ölünün adı, unvanları ve sunuları hiyerogliflerle yazılıdır.",
        bilgi_en: "The walls of the mastaba tombs around the pyramids record the deceased's name, titles and offerings in hieroglyphs." },
    ] },
  { id: "knossos", bolge: "dunya", ad: "Knossos", il: "Girit, Yunanistan", il_en: "Crete, Greece", donem: "Minos (Tunç Çağı), MÖ 2000–1350", donem_en: "Minoan (Bronze Age), 2000–1350 BC",
    toprak: ["#b88b62", "#966c48", "#704f35", "#d4bc9c"], gok: ["#d6ecf5", "#a6d2e6"],
    buluntular: [
      { id: "lineerb", kirilgan: true, ad: "Lineer B tableti", ad_en: "Linear B tablet", puan: 220,
        bilgi: "Saraydaki yangın kil tabletleri pişirip korudu. Lineer B, 1952'de Michael Ventris tarafından çözüldü; dili Yunancanın erken bir biçimidir.",
        bilgi_en: "A palace fire baked and preserved the clay tablets. Linear B was deciphered by Michael Ventris in 1952; it records an early form of Greek." },
      { id: "labrys", ad: "Çift ağızlı balta (labrys)", ad_en: "Double axe (labrys)", puan: 180,
        bilgi: "Minos dininin en önemli simgelerinden. Knossos sarayının taş bloklarına da kazınmıştır.",
        bilgi_en: "One of the chief symbols of Minoan religion, also carved on the stone blocks of the Knossos palace." },
      { id: "kamares", kirilgan: true, ad: "Kamares kabı", ad_en: "Kamares ware cup", puan: 160,
        bilgi: "Koyu zemin üzerine beyaz, kırmızı ve turuncu sarmallarla boyanmış ince cidarlı kaplar. Adını ilk bulunduğu Kamares Mağarası'ndan alır.",
        bilgi_en: "Thin-walled vessels painted with white, red and orange spirals on a dark ground, named after the Kamares Cave where they were first found." },
      { id: "bogafresk", kirilgan: true, ad: "Boğa sıçrama freski", ad_en: "Bull-leaping fresco", puan: 250,
        bilgi: "Bir boğanın üzerinden sıçrayan gençleri gösteren fresk Knossos'ta bulundu; bugün Herakleion Arkeoloji Müzesi'nde.",
        bilgi_en: "The fresco of youths leaping over a bull was found at Knossos and is now in the Heraklion Archaeological Museum." },
    ] },
  { id: "stonehenge", bolge: "dunya", tarihOncesi: true, canak: true, ad: "Stonehenge", il: "Wiltshire, İngiltere", il_en: "Wiltshire, England", donem: "Neolitik – Tunç Çağı, MÖ 3000–1500", donem_en: "Neolithic – Bronze Age, 3000–1500 BC",
    toprak: ["#8a7a5c", "#6e6048", "#544836", "#cfc6b0"], gok: ["#dfe6ea", "#b8c6cf"],
    buluntular: [
      { id: "geyikkazma", ad: "Geyik boynuzu kazma", ad_en: "Antler pick", puan: 200,
        bilgi: "Stonehenge'in çevre hendeği kızıl geyik boynuzundan kazmalarla kazıldı. Hendekte bırakılan kazmalar, radyokarbonla anıtın tarihlenmesine yardım etti.",
        bilgi_en: "Stonehenge's enclosing ditch was dug with red-deer antler picks. Picks left in the ditch helped radiocarbon-date the monument." },
      { id: "mavitas", ad: "Mavi taş parçası", ad_en: "Bluestone chip", puan: 220,
        bilgi: "Stonehenge'in küçük 'mavi taşları' yaklaşık 240 km uzaktaki Galler'in Preseli Tepeleri'nden getirildi.",
        bilgi_en: "Stonehenge's smaller 'bluestones' were brought from the Preseli Hills in Wales, about 240 km away." },
      { id: "olukcanak", kirilgan: true, ad: "Oluklu çömlek", ad_en: "Grooved Ware sherd", puan: 160,
        bilgi: "Geç Neolitik Britanya'nın tipik çömleği. Stonehenge yakınındaki Durrington Walls yerleşiminde bol bulundu.",
        bilgi_en: "The typical pottery of Late Neolithic Britain, found in quantity at nearby Durrington Walls." },
      { id: "domuzdisi", ad: "Domuz dişi", ad_en: "Pig tusk", puan: 130,
        bilgi: "Durrington Walls'ta çok sayıda domuz kemiği bulundu. Dişlerin incelenmesi, domuzların büyük ölçüde kış ortasında kesildiğini, yani büyük şölenler yapıldığını gösterir.",
        bilgi_en: "Many pig bones were found at Durrington Walls. Their teeth show most were slaughtered around midwinter, pointing to great feasts." },
    ] },
  { id: "machu", bolge: "dunya", ad: "Machu Picchu", il: "Cusco, Peru", il_en: "Cusco, Peru", donem: "İnka, MS 1450–1572", donem_en: "Inca, AD 1450–1572",
    toprak: ["#8a6a4c", "#6e5238", "#543e2a", "#c9b69a"], gok: ["#e2ecef", "#b6cdd6"],
    buluntular: [
      { id: "aribalo", kirilgan: true, ad: "Aríbalo (İnka küpü)", ad_en: "Aryballos (Inca jar)", puan: 200,
        bilgi: "Sivri dipli, iki kulplu İnka küpü. Mısır birası chicha taşımak ve saklamak için kullanılırdı; geometrik desenlerle boyanırdı.",
        bilgi_en: "A pointed-based, two-handled Inca jar for carrying and storing maize beer (chicha), painted with geometric designs." },
      { id: "tupu", ad: "Bronz tupu (iğne)", ad_en: "Bronze tupu (pin)", puan: 180,
        bilgi: "İnka kadınlarının şalını tutturan büyük iğne. Machu Picchu'da bronz ve gümüş tupular bulundu.",
        bilgi_en: "The large pin Inca women used to fasten their shawls. Bronze and silver tupus were found at Machu Picchu." },
      { id: "tascekic", ad: "Taş çekiç", ad_en: "Hammerstone", puan: 140,
        bilgi: "İnka taşçıları harçsız kusursuz duvarlarını daha sert taşlardan çekiçlerle döverek biçimlendirdi.",
        bilgi_en: "Inca masons shaped their mortarless, close-fitting walls by pounding with hammerstones of harder rock." },
      { id: "kustabak", kirilgan: true, ad: "Kuş başlı tabak", ad_en: "Bird-handled plate", puan: 160,
        bilgi: "Bir ucunda kuş başı biçimli tutamağı olan sığ İnka tabağı; İnka seramiğinin en tanınan biçimlerinden.",
        bilgi_en: "A shallow Inca plate with a bird-head handle at one end, one of the best-known Inca pottery forms." },
    ] },
  { id: "xian", bolge: "dunya", sikke: true, ad: "Xi'an", il: "Shaanxi, Çin", il_en: "Shaanxi, China", donem: "Qin Hanedanı, MÖ 221–206", donem_en: "Qin dynasty, 221–206 BC",
    toprak: ["#a88a64", "#8a6e4c", "#6a5238", "#d6c4a4"], gok: ["#ece4d6", "#cfc2aa"],
    buluntular: [
      { id: "askerbas", kirilgan: true, ad: "Pişmiş toprak asker başı", ad_en: "Terracotta warrior head", puan: 250,
        bilgi: "İlk imparator Qin Shi Huang'ın mezarı için yapılan yaklaşık 8.000 askerden biri. Yüzleri tek tek işlendiği için birbirine benzemez.",
        bilgi_en: "One of some 8,000 soldiers made for the tomb of the First Emperor, Qin Shi Huang. Each face was finished individually." },
      { id: "bronzok", ad: "Bronz ok ucu", ad_en: "Bronze arrowhead", puan: 150,
        bilgi: "Asker çukurlarından on binlerce bronz ok ucu çıktı. Ölçülerinin birbirine çok yakın olması, seri üretimi gösterir.",
        bilgi_en: "Tens of thousands of bronze arrowheads came from the pits; their near-identical sizes show mass production." },
      { id: "banliang", ad: "Banliang sikkesi", ad_en: "Banliang coin", puan: 180,
        bilgi: "Ortası kare delikli yuvarlak bronz sikke. Qin, ülkenin her yerinde bu tek tip sikkeyi kullandırdı.",
        bilgi_en: "A round bronze coin with a square hole. The Qin made this single coin type standard across the empire." },
      { id: "tetik", ad: "Bronz arbalet tetiği", ad_en: "Bronze crossbow trigger", puan: 200,
        bilgi: "Arbaletlerin ahşap kısımları çürüdü ama bronz tetik düzenekleri kaldı. Qin ordusunun gücü arbaletçilerdendi.",
        bilgi_en: "The crossbows' wooden parts rotted, but the bronze trigger mechanisms survived; crossbowmen were the core of the Qin army." },
    ] },
  { id: "petra", kurak: true, bolge: "dunya", sikke: true, ad: "Petra", il: "Maan, Ürdün", il_en: "Ma'an, Jordan", donem: "Nabati, MÖ 300 – MS 106", donem_en: "Nabataean, 300 BC – AD 106",
    toprak: ["#c89a80", "#a87a62", "#865e4a", "#e2c8b6"], gok: ["#f4e2c8", "#e8c4a0"],
    buluntular: [
      { id: "nabaticanak", kirilgan: true, ad: "Nabati ince çanağı", ad_en: "Nabataean fine ware bowl", puan: 200,
        bilgi: "Yumurta kabuğu kadar ince cidarlı, bitki desenleriyle boyanmış Nabati kapları; Antik Çağ'ın en ince çanak çömleklerindendir.",
        bilgi_en: "Nabataean bowls with eggshell-thin walls painted with plant motifs, among the finest pottery of antiquity." },
      { id: "nabatisikke", ad: "Nabati sikkesi", ad_en: "Nabataean coin", puan: 170,
        bilgi: "Nabati kralları adlarını ve yüzlerini taşıyan sikkeler bastırdı; en çok bilineni IV. Aretas'ın sikkeleridir.",
        bilgi_en: "Nabataean kings struck coins with their names and portraits; those of Aretas IV are the best known." },
      { id: "sukanali", kirilgan: true, ad: "Pişmiş toprak su borusu", ad_en: "Terracotta water pipe", puan: 160,
        bilgi: "Nabatiler çöldeki kentlerine kayalara oyulmuş kanallar ve pişmiş toprak borularla su getirdi.",
        bilgi_en: "The Nabataeans brought water to their desert city through rock-cut channels and terracotta pipes." },
      { id: "nabatiyazit", ad: "Nabati yazıtı", ad_en: "Nabataean inscription", puan: 230,
        bilgi: "Nabati yazısı, Arap yazısının atası kabul edilir. Petra'nın kayalarında yüzlerce Nabati yazıtı vardır.",
        bilgi_en: "The Nabataean script is regarded as the ancestor of the Arabic script; hundreds of Nabataean inscriptions survive at Petra." },
    ] },
];
const kzAlanAd = a => DIL === "en" && a.ad_en ? a.ad_en : a.ad;
const kzAlanIl = a => DIL === "en" && a.il_en ? a.il_en : a.il;
const kzAd = b => DIL === "en" && b.ad_en ? b.ad_en : b.ad;
const kzBilgi = b => DIL === "en" && b.bilgi_en ? b.bilgi_en : b.bilgi;

/* ---------------------------------------------------------------- günlük izin, arkeolog */
function kaziDurumu() {
  const g = oyunGunu();
  if (!D.kaziOyun || D.kaziOyun.gun !== g) D.kaziOyun = { gun: g, hak: KZ_HAK, toplam: 0, kosular: [], surum5: true };
  if (!D.kaziOyun.surum5) { D.kaziOyun.hak += KZ_HAK - 3; D.kaziOyun.surum5 = true; }   // izin 3'ten 5'e çıktı (bugün başlamış eski kayıtlar)
  D.kaziOyun.hak = Math.max(0, Math.min(KZ_HAK, D.kaziOyun.hak));
  if (typeof oyunYoneticisi === "function" && oyunYoneticisi()) D.kaziOyun.hak = KZ_HAK;   // yönetici: sınırsız izin
  return D.kaziOyun;
}
const ARKEOLOGLAR = [
  { id: "saha", sprite: "ark_saha", ad: "Saha arkeoloğu", ad_en: "Field archaeologist", ozellik: "Her kazıda +6 vuruş", ozellik_en: "+6 strikes every dig" },
  { id: "prehistorya", sprite: "ark_prehistorya", ad: "Prehistoryacı", ad_en: "Prehistorian", ozellik: "Tarih öncesi alanlarda buluntu puanı ×1,5", ozellik_en: "Finds score ×1.5 at prehistoric sites" },
  { id: "klasik", sprite: "ark_klasik", ad: "Klasik arkeolog", ad_en: "Classical archaeologist", ozellik: "Tunç Çağı ve sonrası alanlarda buluntu puanı ×1,5", ozellik_en: "Finds score ×1.5 at Bronze Age and later sites" },
  { id: "zoo", sprite: "ark_zoo", ad: "Zooarkeolog", ad_en: "Zooarchaeologist", ozellik: "Kemik buluntular ×2 puan", ozellik_en: "Bone finds score ×2" },
  { id: "konservator", sprite: "ark_konservator", ad: "Konservatör", ad_en: "Conservator", ozellik: "Kırılgan buluntular yarı yarıya az kırılır", ozellik_en: "Fragile finds break half as often" },
  { id: "epigrafist", sprite: "ark_epigrafist", ad: "Epigrafist", ad_en: "Epigraphist", ozellik: "Yazıtlı buluntular ×2 puan", ozellik_en: "Inscribed finds score ×2" },
  { id: "jeofizik", sprite: "ark_jeofizik", ad: "Jeofizikçi", ad_en: "Geophysicist", ozellik: "İpucu 3 hücreden sezilir", ozellik_en: "Hints are felt from 3 squares away" },
];
const arkeolog = () => ARKEOLOGLAR.find(a => a.id === D.kzArkeolog) || null;
const arkAd = a => DIL === "en" ? a.ad_en : a.ad;
const arkOzellik = a => DIL === "en" ? a.ozellik_en : a.ozellik;
/* Haftanın alanı: ISO haftaya göre sırayla; o alanda buluntu puanı ×2 */
function haftaninAlani() { const h = Number(oyunHaftasi().split("-W")[1]) + Number(oyunHaftasi().slice(0, 4)) * 53; return KZ_ALANLAR[h % KZ_ALANLAR.length]; }
function kzCarpan(alan) {
  const a = arkeolog();
  let c = 1;
  if (a && a.id === "prehistorya" && alan.tarihOncesi) c = 1.5;
  if (a && a.id === "klasik" && !alan.tarihOncesi) c = 1.5;
  if (haftaninAlani().id === alan.id) c *= 2;
  return c;
}
const KZ_NADIR_OLASILIK = 0.07;   // değerli buluntunun "olağanüstü korunmuş" çıkma olasılığı (puan ×3, altın çerçeve)
/* Defter ödülü: bir alanın bütün değerli buluntuları defterdeyse o alanın renklerinde kıyafet açılır (şapka/saç h, r; giysi c) */
const kiyafetAcik = a => a.buluntular.every(b => (D.buluntuDefteri || {})[b.id]);
const kiyafetRengi = a => ({ h: a.gok[1], r: a.gok[1], c: a.toprak[1] });
function kiyafetRenk() { const a = KZ_ALANLAR.find(x => x.id === D.kzKiyafet); return a && kiyafetAcik(a) ? kiyafetRengi(a) : null; }
function kiyafetKontrol(alan) {
  if (!alan || !kiyafetAcik(alan)) return;
  D.kiyafetAcildi = D.kiyafetAcildi || {};
  if (D.kiyafetAcildi[alan.id]) return;
  D.kiyafetAcildi[alan.id] = oyunGunu(); kaydet();
  setTimeout(() => bildir(`👕 ${tx("Yeni kıyafet açıldı: {alan}. Arkeolog seçiminden giyebilirsin.", { alan: kzAlanAd(alan) })}`), 1500);
}
function arkeologSecimi(sonra) {
  const renk = kiyafetRenk();
  levhaAc(`<h3>${tx("Arkeoloğunu seç")}</h3><p class="aciklama">${tx("Her arkeoloğun kazıda bir üstünlüğü var. İstediğin zaman değiştirebilirsin.")}</p>
    <div class="ark-izgara">${ARKEOLOGLAR.map(a => `<button class="ark-kart${D.kzArkeolog === a.id ? " secili" : ""}" data-ark="${a.id}">
      <canvas width="48" height="64"></canvas><b>${esc(arkAd(a))}</b><small>${esc(arkOzellik(a))}</small></button>`).join("")}</div>
    <h4 class="kiyafet-baslik">👕 ${tx("Kıyafet")} <small>${tx("Bir alanın defterini tamamla, o alanın kıyafeti açılsın.")}</small></h4>
    <div class="kiyafet-izgara"><button class="kiyafet${!renk ? " secili" : ""}" data-kiyafet=""><i style="background:#c9a25a"></i><i style="background:#5c7d5a"></i><span>${tx("Standart")}</span></button>
      ${KZ_ALANLAR.map(a => { const acik = kiyafetAcik(a), r = kiyafetRengi(a);
        return `<button class="kiyafet${D.kzKiyafet === a.id && acik ? " secili" : ""}" data-kiyafet="${a.id}" ${acik ? "" : `disabled title="${esc(tx("{alan} defterini tamamla", { alan: kzAlanAd(a) }))}"`}>
          <i style="background:${r.h}"></i><i style="background:${r.c}"></i><span>${acik ? "" : "🔒 "}${esc(kzAlanAd(a))}</span></button>`; }).join("")}</div>`, lv => {
    lv.querySelectorAll("[data-kiyafet]").forEach(b => b.onclick = () => { D.kzKiyafet = b.dataset.kiyafet; kaydet(); oyunSesi("tus"); arkeologSecimi(sonra); });
    lv.querySelectorAll("[data-ark]").forEach(b => {
      const a = ARKEOLOGLAR.find(x => x.id === b.dataset.ark);
      spriteCiz(b.querySelector("canvas").getContext("2d"), a.sprite, 0, 0, 4, false, renk);
      b.onclick = () => { D.kzArkeolog = a.id; kaydet(); levhaKapat(); bildir(tx("{ad} kazıya hazır", { ad: arkAd(a) })); if (sonra) sonra(); else if (location.hash === "#oyun/kazi") sayfaKaziOyun(""); };
    });
  });
}

/* ---------------------------------------------------------------- müzik: her alana özgün kısa döngü (WebAudio) */
const MUZIK = {
  karain:   { bpm: 58, kok: 110, olcek: [0, 3, 5, 7, 10], dalga: "sine", melodi: [4, -1, 3, -1, 2, -1, -1, 0, 2, -1, 1, -1, 0, -1, -1, -1], bas: [0, -1, -1, -1], damla: true },
  kizilin:  { bpm: 76, kok: 147, olcek: [0, 2, 3, 7, 9], dalga: "sine", melodi: [0, 2, 3, 2, 4, -1, 3, 2, 0, -1, 1, 2, 3, -1, -1, -1], bas: [0, -1, 3, -1] },
  gobekli:  { bpm: 66, kok: 110, olcek: [0, 3, 5, 7, 10], dalga: "triangle", melodi: [0, -1, 2, 3, 4, -1, 3, -1, 2, -1, 0, 1, 2, -1, -1, -1], bas: [0, -1, -1, -1], davul: [1, 0, 0, 0, 0, 0, 1, 0] },
  catal:    { bpm: 84, kok: 131, olcek: [0, 2, 3, 5, 7, 9, 10], dalga: "sine", melodi: [4, 5, 4, 2, 3, -1, 2, 0, 4, 5, 6, 5, 4, -1, -1, -1], bas: [0, -1, 4, -1], davul: [1, 0, 1, 0, 1, 0, 0, 1] },
  hattusa:  { bpm: 92, kok: 110, olcek: [0, 1, 3, 5, 7, 8, 10], dalga: "square", melodi: [0, 1, 0, -1, 3, 2, 1, 0, 4, -1, 5, 4, 2, 1, 0, -1], bas: [0, 0, 4, 0], davul: [1, 0, 0, 1, 1, 0, 0, 0] },
  troya:    { bpm: 100, kok: 147, olcek: [0, 2, 4, 5, 7, 9, 10], dalga: "sawtooth", melodi: [4, 3, 2, 4, 5, -1, 4, 2, 1, 2, 3, -1, 2, 1, 0, -1], bas: [0, -1, 3, -1], davul: [1, 0, 0, 0, 1, 0, 1, 0] },
  efes:     { bpm: 96, kok: 165, olcek: [0, 2, 4, 6, 7, 9, 11], dalga: "triangle", melodi: [0, 2, 4, 6, 4, 2, 5, -1, 3, 4, 2, 0, 1, -1, 0, -1], bas: [0, 4, 2, 4] },
  pompeii:  { bpm: 88, kok: 147, olcek: [0, 2, 4, 5, 7, 9, 11], dalga: "triangle", melodi: [0, 2, 4, 5, 4, 2, -1, 0, 4, 5, 7, 5, 4, -1, 2, -1], bas: [0, -1, 3, -1], davul: [1, 0, 0, 1, 0, 0, 1, 0] },
  giza:     { bpm: 70, kok: 110, olcek: [0, 1, 4, 5, 7, 8, 11], dalga: "sine", melodi: [4, 3, 2, 1, 2, -1, 0, -1, 2, 3, 4, 5, 4, -1, -1, -1], bas: [0, -1, -1, 0], davul: [1, 0, 0, 0, 1, 0, 0, 0] },
  knossos:  { bpm: 96, kok: 165, olcek: [0, 2, 3, 5, 7, 8, 10], dalga: "triangle", melodi: [0, 2, 4, 2, 3, 1, 0, -1, 4, 5, 6, 5, 4, 2, 0, -1], bas: [0, 4, 0, 3] },
  stonehenge: { bpm: 60, kok: 98, olcek: [0, 2, 3, 5, 7, 10], dalga: "sine", melodi: [0, -1, 2, -1, 3, 2, 0, -1, 4, -1, 3, 2, 0, -1, -1, -1], bas: [0, -1, -1, -1], davul: [1, 0, 0, 0, 0, 0, 0, 0] },
  machu:    { bpm: 90, kok: 147, olcek: [0, 3, 5, 7, 10], dalga: "triangle", melodi: [4, 3, 2, 3, 4, -1, 2, 1, 0, 1, 2, -1, 4, 3, 2, -1], bas: [0, -1, 2, -1], davul: [1, 0, 1, 0, 1, 0, 0, 0] },
  xian:     { bpm: 80, kok: 131, olcek: [0, 2, 4, 7, 9], dalga: "square", melodi: [0, 1, 2, 4, 3, -1, 2, 1, 4, 3, 2, 1, 0, -1, -1, -1], bas: [0, -1, 3, -1], davul: [1, 0, 0, 0, 1, 0, 1, 0] },
  petra:    { bpm: 76, kok: 110, olcek: [0, 1, 4, 5, 7, 8, 10], dalga: "triangle", melodi: [0, 1, 2, 1, 0, -1, 4, 3, 2, 1, 2, -1, 0, -1, -1, -1], bas: [0, -1, 0, 3], davul: [1, 0, 0, 1, 0, 1, 0, 0] },
  zeugma:   { bpm: 84, kok: 147, olcek: [0, 1, 4, 5, 7, 8, 10], dalga: "sawtooth", melodi: [4, 5, 4, 2, 1, 2, -1, 0, 1, 2, 3, 4, 2, 1, 0, -1], bas: [0, -1, 0, 3], davul: [1, 0, 0, 1, 0, 0, 1, 0] },
};
const KM = { ctx: null, zaman: null, adim: 0, sonraki: 0, alan: null, ana: null };
function kzMuzikAcik() { return D.kzMuzik !== false; }
function kzMuzikBaslat(alanId) {
  kzMuzikDur();
  if (!kzMuzikAcik() || !MUZIK[alanId]) return;
  try {
    KM.ctx = KM.ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (KM.ctx.state === "suspended") KM.ctx.resume();
  } catch (e) { return; }
  const ctx = KM.ctx;
  KM.ana = ctx.createGain(); KM.ana.gain.value = 0.07;
  const suzgec = ctx.createBiquadFilter(); suzgec.type = "lowpass"; suzgec.frequency.value = 1800;
  KM.ana.connect(suzgec); suzgec.connect(ctx.destination);
  KM.alan = alanId; KM.adim = 0; KM.sonraki = ctx.currentTime + 0.1;
  const m = MUZIK[alanId], adimSure = 60 / m.bpm / 2;
  const nota = (frek, t, sure, dalga, ses) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = dalga; o.frequency.value = frek;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(ses, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g); g.connect(KM.ana); o.start(t); o.stop(t + sure + 0.05);
  };
  const derece = (i, oktav = 0) => m.kok * Math.pow(2, (m.olcek[((i % m.olcek.length) + m.olcek.length) % m.olcek.length] + 12 * (oktav + Math.floor(i / m.olcek.length))) / 12);
  const davul = t => {
    const uz = Math.floor(ctx.sampleRate * 0.08), b = ctx.createBuffer(1, uz, ctx.sampleRate), v = b.getChannelData(0);
    for (let i = 0; i < uz; i++) v[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / uz, 3);
    const k = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 420; g.gain.value = 0.9;
    k.buffer = b; k.connect(f); f.connect(g); g.connect(KM.ana); k.start(t);
  };
  KM.zaman = setInterval(() => {
    while (KM.sonraki < ctx.currentTime + 0.25) {
      const t = KM.sonraki, a = KM.adim;
      const n = m.melodi[a % m.melodi.length];
      if (n >= 0) nota(derece(n, 1), t, adimSure * 1.8, m.dalga, m.dalga === "sine" || m.dalga === "triangle" ? 0.5 : 0.18);
      if (a % 4 === 0) { const bn = m.bas[(a / 4) % m.bas.length]; if (bn >= 0) nota(derece(bn, -1), t, adimSure * 3.6, "triangle", 0.45); }
      if (m.davul && m.davul[a % m.davul.length]) davul(t);
      if (m.damla && Math.random() < 0.12) nota(derece(Math.floor(Math.random() * 5), 2), t + Math.random() * adimSure, 0.25, "sine", 0.25);
      KM.adim++; KM.sonraki += adimSure;
    }
  }, 90);
}
function kzMuzikDur() { if (KM.zaman) clearInterval(KM.zaman); KM.zaman = null; if (KM.ana) { try { KM.ana.disconnect(); } catch (e) {} KM.ana = null; } }
window.addEventListener("hashchange", () => { if (!location.hash.startsWith("#oyun/kazi/")) kzMuzikDur(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) kzMuzikDur(); else if (KZ && !KZ.bitti && location.hash.startsWith("#oyun/kazi/")) kzMuzikBaslat(KZ.alan.id); });

/* ---------------------------------------------------------------- sahne çizimi (48 px yükseklik) */
function kzSahne(ctx, alan, w) {
  const g = ctx.createLinearGradient(0, 0, 0, KZ_SAHNE);
  g.addColorStop(0, alan.gok[0]); g.addColorStop(1, alan.gok[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, KZ_SAHNE);
  const r = (x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); };
  const t = alan.toprak;
  r(0, 40, w, 8, t[0]);
  if (alan.id === "karain") {
    r(0, 6, w, 34, "#a89a86"); r(0, 6, w, 3, "#bcae98");
    for (const [x, y, ww] of [[10, 14, 30], [120, 12, 28], [60, 30, 40]]) r(x, y, ww, 2, "#93856f");
    r(58, 18, 44, 22, "#2e261f"); r(62, 14, 36, 4, "#2e261f"); r(66, 12, 28, 2, "#2e261f");
  } else if (alan.id === "kizilin") {
    r(0, 18, w, 22, "#9c8a74"); r(30, 8, 60, 10, "#9c8a74"); r(50, 4, 30, 4, "#9c8a74");
    r(64, 24, 22, 16, "#2e261f"); r(68, 21, 14, 3, "#2e261f");
    for (const x of [8, 22, 128, 142]) { r(x + 3, 30, 2, 10, "#5a4030"); r(x, 20, 8, 4, "#3f6b45"); r(x + 1, 16, 6, 4, "#3f6b45"); r(x + 2, 12, 4, 4, "#3f6b45"); }
  } else if (alan.id === "gobekli") {
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
  } else if (alan.id === "pompeii") {
    for (let y = 8; y < 40; y++) { const yar = (y - 8) * 1.7; r(Math.round(112 - yar), y, Math.round(yar * 2), 1, "#6d635a"); }
    r(106, 2, 10, 5, "#9c948c"); r(100, 0, 8, 3, "#b5aea6"); r(112, 0, 6, 2, "#c4bdb5");
    r(10, 16, 48, 3, "#d0c4ae"); for (const x of [14, 28, 42]) r(x, 19, 5, 21, "#e6dccb");
  } else if (alan.id === "giza") {
    const pir = (cx, h, a, k) => { for (let i = 0; i < h; i++) { r(cx - (h - i), 40 - i - 1, h - i, 1, a); r(cx, 40 - i - 1, h - i, 1, k); } };
    pir(42, 22, "#e2c38a", "#c9a66b"); pir(88, 27, "#e2c38a", "#c9a66b"); pir(128, 16, "#e2c38a", "#c9a66b");
  } else if (alan.id === "knossos") {
    r(28, 12, 104, 4, "#d9c7a0"); r(26, 16, 108, 2, "#b8a47c"); r(60, 8, 3, 4, "#ece2cc"); r(66, 8, 3, 4, "#ece2cc"); r(93, 8, 3, 4, "#ece2cc"); r(99, 8, 3, 4, "#ece2cc");
    for (const x of [40, 62, 84, 106]) { r(x, 18, 8, 3, "#2b2420"); r(x + 1, 21, 6, 17, "#b33a2a"); r(x + 2, 36, 4, 2, "#b33a2a"); r(x, 38, 8, 2, "#2b2420"); }
  } else if (alan.id === "stonehenge") {
    r(0, 32, w, 8, "#7a9a5a"); r(0, 34, w, 6, "#6a8a4c");
    for (const [x, h] of [[30, 20], [50, 22], [78, 22], [100, 20], [124, 18]]) r(x, 40 - h, 8, h, "#9a958c");
    for (const [x, ww] of [[28, 30], [76, 32]]) r(x, 16, ww, 4, "#a8a39a");
    r(64, 30, 6, 10, "#8a857c");
  } else if (alan.id === "machu") {
    for (let y = 4; y < 40; y++) { const yar = (y - 4) * 0.7; r(Math.round(120 - yar), y, Math.round(yar * 2), 1, "#5e7a4a"); }
    for (let y = 18; y < 40; y++) { const yar = (y - 18) * 1.4; r(Math.round(40 - yar), y, Math.round(yar * 2), 1, "#6e8a56"); }
    for (let i = 0; i < 4; i++) r(50 + i * 6, 28 + i * 3, 60 - i * 12, 2, "#a89a84");
    r(66, 22, 12, 6, "#b8ab94"); r(70, 19, 4, 3, "#8a6a4c");
  } else if (alan.id === "xian") {
    r(0, 20, w, 20, "#9a7e5c"); r(0, 20, w, 2, "#7a6246");
    for (let s = 0; s < 2; s++) for (let x = 8 + s * 6; x < w - 6; x += 12) { r(x, 24 + s * 7, 4, 3, "#6e655a"); r(x - 1, 27 + s * 7, 6, 5, "#8a8070"); }
  } else if (alan.id === "petra") {
    r(0, 2, w, 38, "#c4866a"); r(0, 2, 18, 38, "#a86a50"); r(142, 2, 18, 38, "#a86a50");
    r(50, 6, 60, 3, "#d9a08a"); for (const x of [54, 66, 90, 102]) r(x, 9, 4, 14, "#d9a08a");
    r(48, 23, 64, 2, "#d9a08a"); for (const x of [52, 64, 92, 104]) r(x, 25, 4, 15, "#d9a08a"); r(74, 26, 12, 14, "#5a3424");
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
let KZ = null;   // { alan, hucreler: [{derinlik, buluntu, bulKat}], vurus, puan, bulunan: [], ozelSayi, bitti }
const sikMi = b => KZ_SIK.includes(b) || KZ_ELEK.includes(b);
/* Uzman çarpanı (Günün Açması'nda yok) */
function kzUzmanCarpan(b) {
  if (!KZ || KZ.meydan || !KZ.ark) return 1;
  if (KZ.ark.id === "zoo" && KZ_KEMIK.has(b.id)) return 2;
  if (KZ.ark.id === "epigrafist" && KZ_YAZITLI.has(b.id)) return 2;
  return 1;
}

/* Günün Açması: herkes aynı alanı, aynı buluntu yerleşimiyle kazar; günde bir deneme, kazı izni harcamaz.
 * Adil olsun diye arkeolog üstünlüğü ve haftanın alanı çarpanı yok. Skor: skorlar › oyun "meydan". */
const meydanAlani = (g = oyunGunu()) => KZ_ALANLAR[kzTohum("alan-" + g) % KZ_ALANLAR.length];
const meydanDurumu = () => { const g = oyunGunu(); return D.kzMeydan && D.kzMeydan.gun === g ? D.kzMeydan : null; };

function sayfaKaziOyun(arg) {
  const kd = kaziDurumu();
  if (arg && KZ && KZ.alan.id === arg && !KZ.bitti) return kzOyunCiz();
  if (arg) { history.replaceState(null, "", "#oyun/kazi"); }
  kzMuzikDur();
  const defter = D.buluntuDefteri || {}, ark = arkeolog();
  const tum = KZ_ALANLAR.flatMap(a => a.buluntular.map(b => ({ ...b, alan: a })));
  const bolge = D.kzBolge === "dunya" ? "dunya" : "anadolu", md = meydanDurumu(), ma = meydanAlani();
  $("#sayfa").innerHTML = `<div class="kazi-oyun">
    <div class="kz-ust"><p>${tx("Bir ören yeri seç, açmayı kaz, buluntuları çıkar.")}</p>
      <p class="kz-izin">${tx("Bugün kalan kazı izni")}: <b>${typeof oyunYoneticisi === "function" && oyunYoneticisi() ? "∞" : `${kd.hak}/${KZ_HAK}`}</b> · ${tx("Bugünkü puan")}: <b>${kd.toplam}</b> · <button class="metin-dugme" id="kz-nasil">${tx("Nasıl oynanır?")}</button></p></div>
    <button class="kz-arkeolog" id="kz-ark"><canvas width="24" height="32"></canvas>
      <span>${ark ? `<b>${esc(arkAd(ark))}</b><small>${esc(arkOzellik(ark))}</small>` : `<b>${tx("Arkeoloğunu seç")}</b><small>${tx("Kazıya başlamadan önce")}</small>`}</span><i>${ark ? tx("Değiştir") : "›"}</i></button>
    <button class="kz-alan kz-meydan" id="kz-meydan" ${md ? "disabled" : ""}><canvas width="160" height="48"></canvas>
      <span><b>🏆 ${tx("Günün Açması")} · ${esc(kzAlanAd(ma))}</b><small>${tx("Herkes aynı açmayı kazar · günde tek deneme · kazı izni harcamaz")}</small>
      <em>${md ? (md.bitti ? tx("Bugünkü puanın: {p}", { p: md.puan }) : tx("Bugünkü denemeni kullandın")) : tx("Kazmaya başla")}</em></span></button>
    <div class="bolumlu kucuk kz-bolge" role="group"><button data-bolge="anadolu" aria-pressed="${bolge === "anadolu"}">${tx("Anadolu")}</button><button data-bolge="dunya" aria-pressed="${bolge === "dunya"}">${tx("Dünya")}</button></div>
    <div class="kz-alanlar">${KZ_ALANLAR.filter(a => (a.bolge || "anadolu") === bolge).map(a => {
      const bulunan = a.buluntular.filter(b => defter[b.id]).length;
      return `<button class="kz-alan" data-alan="${a.id}" ${kd.hak ? "" : "disabled"}><canvas width="160" height="48"></canvas>
        <span><b>${esc(kzAlanAd(a))}</b><small>${esc(kzAlanIl(a))} · ${esc(DIL === "en" ? a.donem_en : a.donem)}</small><em>${tx("Defter")}: ${bulunan}/${a.buluntular.length}${haftaninAlani().id === a.id ? ` · ⭐ ${tx("Haftanın alanı")}` : ""}${kzCarpan(a) > 1 ? ` · ×${String(kzCarpan(a)).replace(".", ",")}` : ""}</em></span></button>`;
    }).join("")}</div>
    ${kd.hak ? "" : `<p class="aciklama" style="text-align:center">${tx("Bugünkü kazı izinlerin bitti. Yarın yeni izin!")}</p>`}
    <section class="kz-defter"><h3>${tx("Buluntu Defteri")} <small>${Object.keys(defter).filter(id => tum.some(b => b.id === id)).length}/${tum.length}</small></h3>
      <div class="kz-defter-izgara">${tum.map(b => `<button class="kz-defter-oge${defter[b.id] ? "" : " kayip"}${(D.altinDefter || {})[b.id] ? " altin" : ""}" data-b="${b.id}" title="${defter[b.id] ? esc(kzAd(b)) : "?"}">
        <canvas width="48" height="48"></canvas><small>${defter[b.id] ? esc(kzAd(b)) : "?"}</small></button>`).join("")}</div></section>
    ${typeof yoneticiSifirlaHtml === "function" ? yoneticiSifirlaHtml("kazi") : ""}${skorBolumuHtml("kazi")}${skorBolumuHtml("meydan")}</div>`;
  $(".oyun-skor h3").textContent = tx("Kazı Başı · Skor tablosu");
  $('.oyun-skor[data-oyun="meydan"] h3').textContent = tx("Günün Açması · Skor tablosu");
  kzSahne($("#kz-meydan canvas").getContext("2d"), ma, 160);
  $("#kz-meydan").onclick = () => arkeolog() ? kzBasla(ma, true) : arkeologSecimi(() => kzBasla(ma, true));
  $$("[data-bolge]").forEach(b => b.onclick = () => { D.kzBolge = b.dataset.bolge; kaydet(); sayfaKaziOyun(""); });
  $("#kz-nasil").onclick = () => typeof nasilGoster === "function" && nasilGoster("kazi");
  if (typeof yoneticiSifirlaBagla === "function") yoneticiSifirlaBagla();
  spriteCiz($("#kz-ark canvas").getContext("2d"), ark ? ark.sprite : "ark_saha", 0, 0, 2, !ark, kiyafetRenk());
  $("#kz-ark").onclick = () => arkeologSecimi();
  $$(".kz-alanlar .kz-alan").forEach(b => {
    const a = KZ_ALANLAR.find(x => x.id === b.dataset.alan);
    kzSahne(b.querySelector("canvas").getContext("2d"), a, 160);
    b.onclick = () => arkeolog() ? kzBasla(a) : arkeologSecimi(() => kzBasla(a));
  });
  if (typeof oyunNasilIlk === "function") oyunNasilIlk("kazi");
  $$(".kz-defter-oge").forEach(b => {
    const bul = tum.find(x => x.id === b.dataset.b), ctx = b.querySelector("canvas").getContext("2d");
    spriteCiz(ctx, bul.id, 0, 0, 4, !defter[bul.id]);
    b.onclick = () => defter[bul.id] ? kzBuluntuLevhasi(bul, bul.alan, false) : bildir(tx("Henüz bulunmadı: {alan}", { alan: kzAlanAd(bul.alan) }));
  });
  skorBolumuBagla($("#sayfa"));
}

function kzBasla(alan, meydan = false) {
  const kd = kaziDurumu(), g = oyunGunu();
  if (meydan) {
    if (meydanDurumu()) { bildir(tx("Bugünün açmasını kazdın. Yarın yeni açma!")); return; }
    D.kzMeydan = { gun: g, puan: 0, bitti: false };   // yenilemeyle tekrar denenmesin
  } else {
    if (kd.hak <= 0) { bildir(tx("Bugünkü kazı izinlerin bitti. Yarın yeni izin!")); return; }
    if (!(typeof oyunYoneticisi === "function" && oyunYoneticisi())) kd.hak--;
  }
  kaydet();
  const rng = meydan ? kzRng(kzTohum("meydan-" + g)) : Math.random;
  const n = KZ_SUTUN * KZ_SATIR, yerler = karistir([...Array(n).keys()], rng);
  const hucreler = Array.from({ length: n }, () => ({ derinlik: 3, buluntu: null, bulKat: 0 }));
  // değerliler: 2–3 vuruşta (bulKat 1 ya da 0); sık buluntular: 1–3 vuruşta
  alan.buluntular.forEach((b, i) => { hucreler[yerler[i]] = { derinlik: 3, buluntu: b, bulKat: rng() < .5 ? 1 : 0, nadir: rng() < KZ_NADIR_OLASILIK }; });
  const sikler = KZ_SIK.filter(b => (b.tarihOncesi ? alan.tarihOncesi : true) && (b.cag ? (!alan.tarihOncesi || alan.canak) : true));
  for (let i = alan.buluntular.length; i < alan.buluntular.length + KZ_SIK_SAYI; i++)
    hucreler[yerler[i]] = { derinlik: 3, buluntu: sikler[Math.floor(rng() * sikler.length)], bulKat: [2, 2, 1, 1, 0][Math.floor(rng() * 5)] };
  const zar = rng(), havaId = zar < 0.6 ? "gunes" : zar < 0.8 ? (alan.kurak ? "kum" : "yagmur") : (alan.kurak ? "kum" : "ruzgar");
  const camur = new Set();
  if (havaId === "yagmur") { const s = Math.floor(rng() * (KZ_SATIR - 1)); camur.add(s); camur.add(s + 1); }
  const ark = arkeolog();
  KZ = { alan, hucreler, vurus: KZ_VURUS + (!meydan && ark && ark.id === "saha" ? 6 : 0), puan: 0, bulunan: [], ozelSayi: alan.buluntular.length, bitti: false, vurgu: -1,
    carpan: meydan ? 1 : kzCarpan(alan), menzil: !meydan && ark && ark.id === "jeofizik" ? 3 : 2, ark, meydan, rng, alet: D.kzAlet && KZ_ALETLER[D.kzAlet] ? D.kzAlet : "mala", kirik: 0, kova: 0, toz: [], hava: havaId, camur, restore: 0, kiyafet: kiyafetRenk() };
  if (havaId === "ruzgar" || havaId === "kum") KZ.menzil = Math.max(1, KZ.menzil - 1);
  if (havaId !== "gunes") setTimeout(() => bildir(`${KZ_HAVA[havaId].simge} ${havaAd(KZ_HAVA[havaId])}: ${havaAciklama(KZ_HAVA[havaId])}`), 600);
  kzMuzikBaslat(alan.id);
  if (location.hash !== `#oyun/kazi/${alan.id}`) location.hash = `#oyun/kazi/${alan.id}`; else kzOyunCiz();
}

function kzOyunCiz() {
  $("#sayfa").innerHTML = `<div class="kazi-oyun"><div class="kz-hud">
      <span><b title="${esc(havaAd(KZ_HAVA[KZ.hava] || KZ_HAVA.gunes))}">${(KZ_HAVA[KZ.hava] || KZ_HAVA.gunes).simge}</b> <b>${KZ.meydan ? "🏆 " : ""}${esc(kzAlanAd(KZ.alan))}</b> · ${esc(KZ.meydan ? tx("Günün Açması") : KZ.ark ? arkAd(KZ.ark) : "")}</span>
      <span class="kz-vurus" title="${tx("Kalan vuruş")}">⛏ <b id="kz-vurus">${KZ.vurus}</b></span>
      <span>${tx("Puan")}: <b id="kz-puan">${KZ.puan}</b></span>
      <span><button class="kz-muzik" id="kz-muzik" aria-label="${tx("Müzik")}" title="${tx("Müzik")}">${kzMuzikAcik() ? "♪" : "♪̸"}</button>${oyunSesDugmesi()}</span></div>
    <div class="kz-aletler" role="group" aria-label="${tx("Alet")}">${Object.entries(KZ_ALETLER).map(([id, a]) => `<button data-alet="${id}" aria-pressed="${KZ.alet === id}">
      <canvas width="24" height="24"></canvas><span><b>${esc(aletAd(a))}</b><small>${esc(DIL === "en" ? a.kisa_en : a.kisa)}</small></span></button>`).join("")}</div>
    <button class="kz-elek" id="kz-elek" title="${tx("3 kova toprak = 1 eleme, 1 vuruş")}">
      <span class="kz-elek-ad">🪣 ${tx("Elek")}</span><span class="kz-kova"><i></i><i></i><i></i></span>
      <span class="kz-elek-durum"><b>0</b> ${tx("eleme hazır")}</span><small>${tx("3 kova = 1 eleme · 1 vuruş")}</small></button>
    <div class="kz-cerceve"><canvas id="kz-tuval" width="${KZ_SUTUN * KZ_HUCRE}" height="${KZ_SAHNE + KZ_SATIR * KZ_HUCRE}" aria-label="${tx("Kazı alanı")}"></canvas></div>
    <p class="aciklama kz-ipucu">${tx("Toprağa dokun: her dokunuş bir katman kazar. Buluntular farklı derinliklerde; boş çıkan hücre kızıl ya da amber parlıyorsa yakında değerli bir buluntu var.")} ${tx("Seramik, cam, tablet ve fresk kırılgandır: kazmayla çıkarırsan kırılabilir, fırça hiç kırmaz.")} ${tx("Değerli buluntuyu sağlam çıkarırsan +3 vuruş.")}</p>
    <p class="kz-bulunanlar" id="kz-bulunanlar"></p>
    <p class="kz-alt-dugmeler"><button class="ikincil-dugme" id="kz-nasil-oyun">❔ ${tx("Nasıl oynanır?")}</button>
      <button class="ikincil-dugme" id="kz-bitir">${tx("Kazıyı bitir")}</button></p></div>`;
  const cv = $("#kz-tuval");
  cv.onclick = e => {
    if (!KM.zaman && kzMuzikAcik()) kzMuzikBaslat(KZ.alan.id);
    const k = cv.getBoundingClientRect(), x = (e.clientX - k.left) / k.width * cv.width, y = (e.clientY - k.top) / k.height * cv.height - KZ_SAHNE;
    if (y < 0) return;
    kzKaz(Math.floor(y / KZ_HUCRE) * KZ_SUTUN + Math.floor(x / KZ_HUCRE));
  };
  $("#kz-muzik").onclick = () => {
    D.kzMuzik = !kzMuzikAcik(); kaydet();
    $("#kz-muzik").textContent = kzMuzikAcik() ? "♪" : "♪̸";
    if (kzMuzikAcik()) kzMuzikBaslat(KZ.alan.id); else kzMuzikDur();
  };
  $("#kz-bitir").onclick = () => kzSon(false);
  $("#kz-elek").onclick = kzEle; kzElekDugmesi();
  $("#kz-nasil-oyun").onclick = () => typeof nasilGoster === "function" && nasilGoster("kazi");
  $$(".kz-aletler [data-alet]").forEach(b => {
    spriteCiz(b.querySelector("canvas").getContext("2d"), KZ_ALETLER[b.dataset.alet].sprite, 0, 0, 2);
    b.onclick = () => { KZ.alet = D.kzAlet = b.dataset.alet; kaydet(); oyunSesi("tus"); $$(".kz-aletler [data-alet]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); };
  });
  oyunSesBagla();
  kzCiz();
}

function kzYakinlik(i) {
  const x = i % KZ_SUTUN, y = Math.floor(i / KZ_SUTUN);
  let en = 99;
  KZ.hucreler.forEach((h, j) => {
    if (!h.buluntu || h.derinlik === 0 || sikMi(h.buluntu)) return;
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
    for (let k = 0; k < 5; k++) {
      const s = (i * 7 + k * 13 + h.derinlik * 31) % 97;
      ctx.fillStyle = h.derinlik ? "rgba(0,0,0,.13)" : "rgba(0,0,0,.06)";
      ctx.fillRect(x + (s * 5) % 15, y + (s * 3) % 15, 1 + (s % 2), 1);
    }
    if (h.derinlik > 0 && h.derinlik < 3) { ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(x, y, KZ_HUCRE, 1); ctx.fillRect(x, y, 1, KZ_HUCRE); }
    if (h.derinlik === 0) {
      ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(x, y, KZ_HUCRE, 2); ctx.fillRect(x, y, 2, KZ_HUCRE);
      if (h.buluntu) { if (h.nadir) { ctx.fillStyle = "#e3b341"; ctx.fillRect(x + 1, y + 1, 14, 14); ctx.fillStyle = t[3]; ctx.fillRect(x + 2, y + 2, 12, 12); } spriteCiz(ctx, h.buluntu.id, x + 2, y + 2, 1); if (h.kirik && !h.restore) kirikCiz(ctx, x + 2, y + 2, 1); }
      else {
        const d = kzYakinlik(i);
        if (d <= KZ.menzil) { ctx.fillStyle = d === 1 ? "#d2452b" : "#e0a12c"; for (const [a, b] of [[5, 6], [9, 9], [7, 11]].slice(0, d === 1 ? 3 : d === 2 ? 2 : 1)) ctx.fillRect(x + a, y + b, 2, 2); }
      }
    }
    if (h.derinlik > 0 && KZ.camur && KZ.camur.has(Math.floor(i / KZ_SUTUN))) {
      ctx.fillStyle = "rgba(55,70,95,.28)"; ctx.fillRect(x, y, KZ_HUCRE, KZ_HUCRE);
      ctx.fillStyle = "rgba(170,200,225,.55)"; ctx.fillRect(x + (i * 5) % 12 + 2, y + 4, 1, 2); ctx.fillRect(x + (i * 7) % 11 + 3, y + 10, 1, 2);
    }
    if (i === KZ.vurgu) { ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x, y, KZ_HUCRE, KZ_HUCRE); }
  });
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
  ctx.strokeRect(0.5, KZ_SAHNE + 0.5, cv.width - 1, KZ_SATIR * KZ_HUCRE - 1); ctx.setLineDash([]);
  if (!KZ.arkKonum) KZ.arkKonum = { x: 4, y: 24, salla: 0 };
  kzArkCiz(ctx);
  if (KZ.toz && KZ.toz.length) kzTozCiz(ctx);
  $("#kz-vurus").textContent = KZ.vurus; $("#kz-puan").textContent = KZ.puan;
  $("#kz-bulunanlar").innerHTML = KZ.bulunan.map(b => `<span>${esc(kzAd(b))}</span>`).join("");
}
/* Arkeolog: tıklanan hücreye hızla yürür (adım sesleri), kazma sallar. Kazı anında işlenir; yürüyüş yalnız görüntü. */
function kzArkCiz(ctx) {
  const a = KZ.arkKonum; if (!a || !KZ.ark) return;
  const zip = a.yuruyor ? (Math.floor(performance.now() / 70) % 2) : 0;
  spriteCiz(ctx, KZ.ark.sprite, Math.round(a.x), Math.round(a.y) - zip, 1, false, KZ.kiyafet);
  const kx = Math.round(a.x) + 10, ky = Math.round(a.y) + 8, kalk = a.salla > 0, an = Math.floor(performance.now() / 80) % 2;
  if (KZ.alet === "firca") {   // fırça: eğilip sağa sola fırçalar
    const dx = kalk ? (an ? 2 : -1) : 0;
    ctx.fillStyle = "#7a5530"; ctx.fillRect(kx + dx, ky + 2, 3, 1); ctx.fillStyle = "#d9b36a"; ctx.fillRect(kx + 3 + dx, ky + 1, 2, 3);
  } else if (KZ.alet === "mala") {   // mala: toprağı kazır, aşağı yukarı
    const dy = kalk ? (an ? 2 : 0) : 0;
    ctx.fillStyle = "#7a5530"; ctx.fillRect(kx, ky + dy, 2, 1); ctx.fillStyle = "#9aa3ab"; ctx.fillRect(kx + 2, ky + dy, 3, 2); ctx.fillRect(kx + 3, ky + 2 + dy, 1, 1);
  } else {   // kazma: sap ve demir; sallanırken yukarı kalkar
    ctx.fillStyle = "#7a5530";
    if (kalk) { ctx.fillRect(kx, ky - 6, 1, 7); ctx.fillStyle = "#9aa3ab"; ctx.fillRect(kx - 2, ky - 7, 5, 1); }
    else { ctx.fillRect(kx, ky, 4, 1); ctx.fillRect(kx + 3, ky + 1, 1, 1); ctx.fillStyle = "#9aa3ab"; ctx.fillRect(kx + 4, ky - 1, 1, 4); }
  }
  if (a.not > 0) {   // buluntudan sonra deftere not alır
    const nx = Math.round(a.x) - 7, ny = Math.round(a.y) + 4;
    ctx.fillStyle = "#efe6d2"; ctx.fillRect(nx, ny, 6, 7); ctx.fillStyle = "#8a5a3a"; ctx.fillRect(nx, ny, 1, 7);
    ctx.fillStyle = "#6b5a44"; for (let s = 0; s < 3; s++) ctx.fillRect(nx + 2, ny + 2 + s * 2, (a.not >> 3) % 3 >= s ? 3 : 1, 1);
  }
}
/* Not alma animasyonu (buluntu penceresi kapanınca) */
function kzNotAl() {
  if (!KZ || !KZ.arkKonum) return;
  KZ.arkKonum.not = 70;
  if (!KZ.arkKonum.dongu) { const a = KZ.arkKonum; const adim = () => { if (!KZ || !$("#kz-tuval")) { a.dongu = null; return; } a.not--; kzTozIlerlet(); kzCiz(); a.dongu = a.not > 0 || KZ.toz.length ? requestAnimationFrame(adim) : null; }; a.dongu = requestAnimationFrame(adim); }
}
/* Değerli buluntuda altın parıltı */
function kzParilti(i) {
  const x = (i % KZ_SUTUN) * KZ_HUCRE + 8, y = KZ_SAHNE + Math.floor(i / KZ_SUTUN) * KZ_HUCRE + 8;
  for (let k = 0; k < 14; k++) { const aci = k / 14 * Math.PI * 2; KZ.toz.push({ x, y, vx: Math.cos(aci) * 1.6, vy: Math.sin(aci) * 1.6 - .6, o: 18, c: k % 2 ? "#e3b341" : "#fff3c4" }); }
}
/* Kazarken toz: yalnız görüntü (Günün Açması'nın tohumlu rastgelesine dokunmaz) */
function kzToz(i) {
  const x = (i % KZ_SUTUN) * KZ_HUCRE + 8, y = KZ_SAHNE + Math.floor(i / KZ_SUTUN) * KZ_HUCRE + 8, t = KZ.alan.toprak;
  for (let k = 0; k < 7; k++) KZ.toz.push({ x, y, vx: (Math.random() - .5) * 2, vy: -Math.random() * 1.8 - .4, o: 12 + Math.random() * 10, c: t[Math.floor(Math.random() * 3)] });
}
function kzTozCiz(ctx) {
  for (const p of KZ.toz) { ctx.globalAlpha = Math.min(1, p.o / 14); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
  ctx.globalAlpha = 1;
}
function kzTozIlerlet() { for (const p of KZ.toz) { p.x += p.vx; p.y += p.vy; p.vy += .16; p.o--; } KZ.toz = KZ.toz.filter(p => p.o > 0); }

/* Elek: 3 kova toprak = 1 eleme, 1 vuruş; %60 küçük buluntu */
function kzElekDugmesi() {
  const b = $("#kz-elek"); if (!b || !KZ) return;
  const n = Math.floor(KZ.kova / KZ_ELEK_KOVA), dolu = n >= 1 ? KZ_ELEK_KOVA : KZ.kova % KZ_ELEK_KOVA;
  b.disabled = KZ.bitti || n < 1 || KZ.vurus < 1;
  b.classList.toggle("hazir", !b.disabled);
  b.querySelector("b").textContent = n;
  b.querySelectorAll(".kz-kova i").forEach((x, k) => x.classList.toggle("dolu", k < dolu));
}
function kzEle() {
  if (!KZ || KZ.bitti || KZ.kova < KZ_ELEK_KOVA || KZ.vurus < 1) return;
  KZ.kova -= KZ_ELEK_KOVA; KZ.vurus--;
  oyunSesi("elek");
  const rng = KZ.rng || Math.random, a = KZ.alan;
  const havuz = KZ_ELEK.filter(b => (!b.tarihOncesi || a.tarihOncesi) && (!b.sikke || a.sikke));
  let yeni = null;
  if (rng() < KZ_ELEK_OLASILIK) {
    const b = havuz[Math.floor(rng() * havuz.length)], p = Math.round(b.puan * kzUzmanCarpan(b));
    KZ.bulunan.push(b); KZ.puan += p; yeni = { ...b, kazanilan: p };
    setTimeout(() => oyunSesi("sik"), 300);
  }
  kzCiz(); kzElekDugmesi();
  const son = () => { if (KZ.vurus <= 0) kzSon(false); };
  if (yeni) kzBuluntuLevhasi(yeni, a, false, son, true);
  else { bildir(tx("Elekten bir şey çıkmadı")); setTimeout(son, 250); }
}
function kzYuru(i) {
  const hx = (i % KZ_SUTUN) * KZ_HUCRE, hy = KZ_SAHNE + Math.floor(i / KZ_SUTUN) * KZ_HUCRE;
  const hedef = { x: Math.min(KZ_SUTUN * KZ_HUCRE - 14, hx + 2), y: hy - 8 };
  const a = KZ.arkKonum || (KZ.arkKonum = { x: 4, y: 24, salla: 0 });
  a.hedef = hedef; a.salla = 2;
  if (a.dongu) return;
  let sonAdim = 0;
  const adim = zaman => {
    if (!KZ || !$("#kz-tuval")) { a.dongu = null; return; }
    const dx = a.hedef.x - a.x, dy = a.hedef.y - a.y, uz = Math.hypot(dx, dy), hiz = 9;   // fıtı fıtı: kare başına 9 piksel
    a.yuruyor = uz > 0.5;
    if (a.yuruyor) {
      a.x += uz <= hiz ? dx : dx / uz * hiz; a.y += uz <= hiz ? dy : dy / uz * hiz;
      if (zaman - sonAdim > 60) { oyunSesi("adim"); sonAdim = zaman; }
    } else if (a.salla > 0) { a.salla--; }
    if (a.not > 0) a.not--;
    kzTozIlerlet();
    kzCiz();
    if (a.yuruyor || a.salla > 0 || a.not > 0 || KZ.toz.length) a.dongu = requestAnimationFrame(adim);
    else { a.dongu = null; kzCiz(); }
  };
  a.dongu = requestAnimationFrame(adim);
}
function kzKaz(i) {
  if (!KZ || KZ.bitti || KZ.vurus <= 0 || i < 0 || i >= KZ.hucreler.length) return;   // vuruş bitince (kzSon gecikmeli) hızlı dokunuşlar eksiye düşürmesin
  const h = KZ.hucreler[i], alet = KZ_ALETLER[KZ.alet] || KZ_ALETLER.mala;
  if (h.derinlik === 0) return;
  const bedel = alet.bedel + (KZ.camur && KZ.camur.has(Math.floor(i / KZ_SUTUN)) ? 1 : 0);   // çamur: 1 vuruş fazla
  if (KZ.vurus < bedel) { bildir(tx("Yeterli vuruş kalmadı")); return; }
  const once = h.derinlik;
  h.derinlik = Math.max(0, h.derinlik - alet.katman); KZ.vurus -= bedel; KZ.vurgu = i;
  KZ.kova += once - h.derinlik; kzElekDugmesi();
  kzToz(i);
  oyunSesi(KZ.alet === "firca" ? "firca" : "kazma", 2 - h.derinlik);
  kzYuru(i);
  setTimeout(() => { if (KZ && KZ.vurgu === i) { KZ.vurgu = -1; kzCiz(); } }, 90);
  if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
  let yeni = null;
  if (h.buluntu && h.derinlik <= h.bulKat) {
    h.derinlik = 0; yeni = h.buluntu; KZ.bulunan.push(yeni);
    h.kirik = !!yeni.kirilgan && (KZ.rng || Math.random)() < alet.kirma * (!KZ.meydan && KZ.ark && KZ.ark.id === "konservator" ? 0.5 : 1);   // kırılgan buluntu alete göre kırılabilir
    if (h.kirik) { h.nadir = false; KZ.kirik++; }
    let p = Math.round((sikMi(yeni) ? yeni.puan : yeni.puan * KZ.carpan * (h.nadir ? 3 : 1)) * kzUzmanCarpan(yeni));
    const tam = p;
    if (h.kirik) p = Math.round(p * KZ_KIRIK_ORAN);
    const ekVurus = !sikMi(yeni) && !h.kirik ? KZ_SAGLAM_VURUS : 0;
    KZ.vurus += ekVurus;
    KZ.puan += p; yeni = { ...yeni, kazanilan: p, nadir: !!h.nadir, kirik: h.kirik, tam, hucre: i, ekVurus };
    if (h.nadir) { D.altinDefter = D.altinDefter || {}; D.altinDefter[h.buluntu.id] = oyunGunu(); kaydet(); if (typeof rozetVer === "function") rozetVer("nadir"); }
    setTimeout(() => oyunSesi(h.kirik ? "kirik" : sikMi(h.buluntu) ? "sik" : "buluntu"), 120);
  }
  kzCiz();
  const ozelBitti = KZ.bulunan.filter(b => !sikMi(b)).length >= KZ.ozelSayi;
  if (yeni) {
    const ozel = !sikMi(h.buluntu);
    const ilk = ozel && !h.kirik && !(D.buluntuDefteri || {})[h.buluntu.id];
    if (ozel && !h.kirik) { D.buluntuDefteri = D.buluntuDefteri || {}; D.buluntuDefteri[h.buluntu.id] = D.buluntuDefteri[h.buluntu.id] || oyunGunu(); kaydet(); kiyafetKontrol(KZ.alan); }
    const devam = () => kzBuluntuLevhasi(yeni, KZ.alan, ilk, () => { kzNotAl(); if (ozelBitti || KZ.vurus <= 0) kzSon(ozelBitti); }, !ozel);
    if (ozel && !h.kirik) { kzParilti(i); setTimeout(() => kzTanimla(yeni, devam), 350); } else devam();
    return;
  }
  if (ozelBitti || KZ.vurus <= 0) setTimeout(() => kzSon(ozelBitti), 250);
}
function kzBuluntuLevhasi(b, alan, ilk, sonra, sik) {
  const ozel = sik === undefined ? !KZ_SIK.some(x => x.id === b.id) : !sik;
  levhaAc(`<div class="kz-buluntu${b.nadir ? " nadir" : ""}${b.kirik ? " kirik" : ""}">${b.nadir ? `<p class="kz-yeni">✨ ${tx("Olağanüstü korunmuş! Puan ×3")}</p>` : ""}
    ${b.ekVurus ? `<p class="kz-yeni kz-ekvurus">⛏ ${tx("Sağlam çıkardın: +{n} vuruş!", { n: b.ekVurus })}</p>` : ""}
    ${b.kirik ? `<p class="kz-yeni">💔 ${tx("Kırıldı! Parçaları topladın: puanın %30'u, deftere yazılmaz. Kırılgan buluntularda mala ya da fırça kullan.")}</p>` : ""}${ilk ? `<p class="kz-yeni">${tx("Deftere yeni buluntu!")}</p>` : ""}
    <canvas width="144" height="144" id="kz-buyuk"></canvas>
    <h3>${esc(kzAd(b))}</h3>
    <p class="aciklama">${ozel ? `${esc(kzAlanAd(alan))}, ${esc(kzAlanIl(alan))} · ${esc(DIL === "en" ? alan.donem_en : alan.donem)}` : tx("Sık buluntu")} · <b>+${b.kazanilan || b.puan}</b></p>
    <p>${esc(kzBilgi(b))}</p>
    ${b.kirik && b.tam && !b.restore ? `<p style="margin-top:14px"><button class="ikincil-dugme" id="kz-restore">🧩 ${tx("Parçaları birleştir (restorasyon)")}</button></p>` : ""}
    <p style="margin-top:14px"><button class="buyuk-dugme" id="kz-devam">${sonra ? tx("Kazmaya devam") : tx("Kapat")}</button></p></div>`, lv => {
    const ctx = lv.querySelector("#kz-buyuk").getContext("2d");
    ctx.fillStyle = alan.toprak[3]; ctx.fillRect(0, 0, 144, 144);
    spriteCiz(ctx, b.id, 0, 0, 12); if (b.kirik) kirikCiz(ctx, 0, 0, 12);
    const perde = () => { if (sonra) sonra(); };
    if (sonra) $("#tabaka").addEventListener("click", perde, { once: true });
    lv.querySelector("#kz-devam").onclick = () => { $("#tabaka").removeEventListener("click", perde); levhaKapat(); if (sonra) sonra(); };
    const rs = lv.querySelector("#kz-restore");
    if (rs) rs.onclick = () => { $("#tabaka").removeEventListener("click", perde); kzRestorasyon(b, alan, sonra); };
  });
}
/* Sonuç paylaşımı: açma ızgarası emojiyle (🟫 kazılmadı, 🟨 yarım, ⬛ boş, 🟩 sık, 💎 değerli, 💔 kırık) */
function kzPaylas() {
  if (!KZ) return;
  const izgara = [];
  for (let s = 0; s < KZ_SATIR; s++) izgara.push(KZ.hucreler.slice(s * KZ_SUTUN, (s + 1) * KZ_SUTUN).map(h =>
    h.derinlik === 3 ? "🟫" : h.derinlik > 0 ? "🟨" : !h.buluntu ? "⬛" : h.restore ? "🧩" : h.kirik ? "💔" : sikMi(h.buluntu) ? "🟩" : "💎").join(""));
  const ozel = KZ.bulunan.filter(b => !sikMi(b)).length, tarih = new Date().toLocaleDateString(DIL === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "short" });
  const metin = `Arkix · ${KZ.meydan ? "🏆 " + tx("Günün Açması") : tx("Kazı Başı")} · ${kzAlanAd(KZ.alan)} · ${tarih}
⛏ ${KZ.puan} ${tx("puan")} · 💎 ${ozel}/${KZ.ozelSayi}${KZ.kirik ? ` · 💔 ${KZ.kirik}` : ""}

${izgara.join("\n")}`;
  paylasLevhasi({ baslik: tx("Kazı Başı"), url: "https://arkix.harrixapp.com/#oyun/kazi", metin });
}
/* Tanımlama: değerli buluntu çıkınca "Bu ne?" (3 seçenek). Doğru bilen +%25 puan alır. */
const KZ_TANIM_ORAN = 0.25;
function kzTanimla(b, devam0) {
  let gitti = false;
  const devam = () => { if (gitti) return; gitti = true; devam0(); };   // cevap + perdeye dokunma iki kez açmasın
  const diger = karistir(KZ_ALANLAR.flatMap(a => a.buluntular).filter(x => x.id !== b.id), Math.random).slice(0, 2);
  const secenek = karistir([b, ...diger], Math.random);
  levhaAc(`<div class="kz-buluntu"><h3>🔎 ${tx("Bu buluntu ne?")}</h3>
    <canvas width="144" height="144" id="kz-tanim"></canvas>
    <p class="aciklama">${tx("Doğru tanımlarsan +%25 puan.")}</p>
    <div class="kz-tanim-secenek">${secenek.map(x => `<button class="ikincil-dugme" data-t="${x.id}">${esc(kzAd(x))}</button>`).join("")}</div></div>`, lv => {
    const ctx = lv.querySelector("#kz-tanim").getContext("2d");
    ctx.fillStyle = KZ.alan.toprak[3]; ctx.fillRect(0, 0, 144, 144); spriteCiz(ctx, b.id, 0, 0, 12);
    lv.querySelectorAll("[data-t]").forEach(d => d.onclick = () => {
      const dogru = d.dataset.t === b.id;
      lv.querySelectorAll("[data-t]").forEach(x => { x.disabled = true; if (x.dataset.t === b.id) x.classList.add("dogru"); else if (x === d) x.classList.add("yanlis"); });
      if (dogru && KZ) { const ek = Math.round((b.tam || b.kazanilan || b.puan) * KZ_TANIM_ORAN); KZ.puan += ek; b.kazanilan = (b.kazanilan || 0) + ek; KZ.tanim = (KZ.tanim || 0) + 1; kzCiz(); oyunSesi("yerinde", 3); }
      else oyunSesi("sil");
      setTimeout(devam, dogru ? 700 : 1300);
    });
  });
  // kapatılırsa (perdeye dokunma) buluntu penceresine geç
  const perde = () => setTimeout(() => { if ($("#levha").hidden) devam(); }, 0);
  $("#tabaka").addEventListener("click", perde, { once: true });
  const temizle = new MutationObserver(() => { if (!document.querySelector("#kz-tanim")) { $("#tabaka").removeEventListener("click", perde); temizle.disconnect(); } });
  temizle.observe($("#levha"), { childList: true });
}
/* Restorasyon: kırık buluntunun 3×3 parçasını yerine diz (iki parçaya dokun, yer değiştirsinler). Başarınca puan %70'e çıkar, deftere yazılır. */
function kzRestorasyon(b, alan, sonra) {
  const sira = [...Array(9).keys()];
  do { karistir(sira, Math.random); } while (sira.every((v, i) => v === i));
  let secili = -1, hamle = 0;
  const bitir = () => { levhaKapat(); if (sonra) sonra(); };
  levhaAc(`<div class="kz-buluntu"><h3>🧩 ${tx("Restorasyon")}</h3>
    <p class="aciklama">${esc(kzAd(b))} · ${tx("İki parçaya dokun, yer değiştirsinler. Bütün parçalar yerine oturunca buluntu kurtulur.")}</p>
    <div class="kz-restore" id="kz-rs"></div>
    <p class="aciklama" id="kz-rs-hamle"></p>
    <p style="margin-top:10px"><button class="ikincil-dugme" id="kz-rs-vazgec">${tx("Vazgeç")}</button></p></div>`, lv => {
    const kap = lv.querySelector("#kz-rs");
    const ciz = () => {
      kap.innerHTML = sira.map((p, i) => `<button data-i="${i}" class="${i === secili ? "secili" : ""}${p === i ? " yerinde" : ""}"><canvas width="48" height="48"></canvas></button>`).join("");
      kap.querySelectorAll("button").forEach(d => {
        const i = +d.dataset.i, p = sira[i], ctx = d.querySelector("canvas").getContext("2d");
        ctx.fillStyle = alan.toprak[3]; ctx.fillRect(0, 0, 48, 48);
        spriteCiz(ctx, b.id, -(p % 3) * 48, -Math.floor(p / 3) * 48, 12);
        d.onclick = () => {
          if (secili < 0) { secili = i; oyunSesi("tus"); return ciz(); }
          if (secili !== i) { [sira[secili], sira[i]] = [sira[i], sira[secili]]; hamle++; oyunSesi("firca"); }
          secili = -1; ciz();
          if (sira.every((v, k) => v === k)) {
            const ek = Math.round(b.tam * KZ_RESTORE_ORAN);
            if (KZ) { KZ.puan += ek; KZ.restore++; const h = KZ.hucreler[b.hucre]; if (h) h.restore = true; kzCiz(); }
            D.buluntuDefteri = D.buluntuDefteri || {}; if (!D.buluntuDefteri[b.id]) D.buluntuDefteri[b.id] = oyunGunu(); kaydet(); kiyafetKontrol(alan);
            oyunSesi("buluntu");
            kap.insertAdjacentHTML("afterend", `<p class="kz-yeni">✨ ${tx("Restore edildi! +{p} puan, deftere yazıldı.", { p: ek })}</p>`);
            lv.querySelector("#kz-rs-vazgec").textContent = sonra ? tx("Kazmaya devam") : tx("Kapat");
            kap.querySelectorAll("button").forEach(x => x.disabled = true);
          }
        };
      });
      lv.querySelector("#kz-rs-hamle").textContent = tx("{n} hamle", { n: hamle });
    };
    ciz();
    lv.querySelector("#kz-rs-vazgec").onclick = bitir;
  });
}
function kzSon(hepsi) {
  if (!KZ || KZ.bitti) return;
  KZ.bitti = true;
  kzMuzikDur();
  setTimeout(() => oyunSesi("bitis"), 150);
  const bonus = hepsi ? KZ.vurus * 5 : 0;
  KZ.puan += bonus;
  const kd = kaziDurumu();
  if (KZ.meydan) {
    D.kzMeydan = { gun: oyunGunu(), puan: KZ.puan, bitti: true }; kaydet();
    try { skorGonder("meydan", KZ.puan, `${KZ.bulunan.filter(b => !sikMi(b)).length}/${KZ.ozelSayi}`); } catch (e) {}
    const ozeller = KZ.bulunan.filter(b => !sikMi(b));
    levhaAc(`<div class="kz-buluntu"><h3>🏆 ${tx("Günün Açması bitti")}</h3>
      <p>${esc(kzAlanAd(KZ.alan))} · ${tx("{n} değerli buluntu", { n: ozeller.length })}${KZ.kirik ? ` · 💔 ${KZ.kirik}` : ""}</p>
      ${bonus ? `<p>${tx("Kalan vuruş bonusu")}: <b>+${bonus}</b></p>` : ""}
      <p class="kz-toplam">${tx("Puanın")}: <b>${KZ.puan}</b></p>
      <p class="aciklama">${tx("Herkes aynı açmayı kazdı; skor tablosunda yerini gör. Yarın yeni açma!")}${H.kullanici ? "" : ` <a href="#giris">${tx("Giriş yap")}</a>, ${tx("skorların tabloya yazılsın")}`}</p>
      <p style="margin-top:14px"><button class="buyuk-dugme" id="kz-geri">${tx("Ören yerlerine dön")}</button></p>
      <p style="text-align:center"><button class="ikincil-dugme" id="kz-paylas">${tx("Sonucu paylaş")}</button></p></div>`, lv => {
      lv.querySelector("#kz-geri").onclick = () => { levhaKapat(); location.hash = "#oyun/kazi"; };
      lv.querySelector("#kz-paylas").onclick = kzPaylas;
    });
    if ($("#kz-bitir")) $("#kz-bitir").outerHTML = `<a class="ikincil-dugme" href="#oyun/kazi">${tx("Ören yerlerine dön")}</a>`;
    return;
  }
  kd.toplam += KZ.puan; kd.kosular.push({ alan: KZ.alan.id, puan: KZ.puan }); kaydet();
  // skor ve rozet hatası sonuç penceresini engellemesin (yoksa KZ.bitti true kalır, "Kazıyı bitir" bir daha tepki vermez)
  try { skorGonder("kazi", kd.toplam, `${kd.kosular.length} kazı`); } catch (e) {}
  try { if (typeof rozetVer === "function") { rozetVer("ilk_kazi"); if (haftaninAlani().id === KZ.alan.id) rozetVer("haftanin"); if (typeof rozetKontrol === "function") rozetKontrol(); } } catch (e) {}
  const ozeller = KZ.bulunan.filter(b => !sikMi(b));
  levhaAc(`<div class="kz-buluntu"><h3>${hepsi ? tx("Açma tamamlandı!") : tx("Kazı bitti")}</h3>
    <p>${esc(kzAlanAd(KZ.alan))} · ${tx("{n} değerli buluntu", { n: ozeller.length })} · ${tx("{n} sık buluntu", { n: KZ.bulunan.length - ozeller.length })}${KZ.kirik ? ` · 💔 ${tx("{n} kırık", { n: KZ.kirik })}` : ""}</p>
    ${bonus ? `<p>${tx("Kalan vuruş bonusu")}: <b>+${bonus}</b></p>` : ""}
    <p class="kz-toplam">${tx("Bu kazı")}: <b>${KZ.puan}</b> · ${tx("Bugün")}: <b>${kd.toplam}</b></p>
    <p class="aciklama">${tx("Kalan kazı izni")}: ${kd.hak}/${KZ_HAK}${H.kullanici ? "" : ` · <a href="#giris">${tx("Giriş yap")}</a>, ${tx("skorların tabloya yazılsın")}`}</p>
    <p style="margin-top:14px"><button class="buyuk-dugme" id="kz-geri">${tx("Ören yerlerine dön")}</button></p>
    <p style="text-align:center"><button class="ikincil-dugme" id="kz-paylas">${tx("Sonucu paylaş")}</button></p></div>`, lv => {
    lv.querySelector("#kz-geri").onclick = () => { levhaKapat(); location.hash = "#oyun/kazi"; };
    lv.querySelector("#kz-paylas").onclick = kzPaylas;
  });
  if ($("#kz-bitir")) $("#kz-bitir").outerHTML = `<a class="ikincil-dugme" href="#oyun/kazi">${tx("Ören yerlerine dön")}</a>`;
}
