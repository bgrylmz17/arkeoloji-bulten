/* Harrix Arkeoloji Bülteni — arayüz dili (Türkçe / English).
 * Türkçe metnin kendisi anahtardır: tx("Ayarlar") → İngilizcede EN["Ayarlar"]; karşılığı yoksa Türkçe görünür.
 * Değişken: tx("{n} kayıt", { n: 5 }). Veri değerleri ("Haber", "Makale"…) Türkçe kalır, yalnız ekranda çevrilir.
 * İngilizce karşılıklar dil-en.js içindedir (EN). */
"use strict";
let DIL = (() => {
  try { const d = (JSON.parse(localStorage.getItem("harrix-bulten")) || {}).dil; if (d === "tr" || d === "en") return d; } catch (e) {}
  return /^tr/i.test(navigator.language || "") ? "tr" : "en";
})();
function tx(tr, deg) {
  let s = DIL === "en" && typeof EN === "object" && EN[tr] != null ? EN[tr] : tr;
  if (deg) for (const k of Object.keys(deg)) s = s.split("{" + k + "}").join(String(deg[k]));
  return s;
}
/** Dile göre iki metinden birini seçer (uzun, biçimli metinler için). */
function dilSec(tr, en) { return DIL === "en" ? en : tr; }
