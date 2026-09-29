// SQLite ZAMANI — tek yerden okunur.
//
// `datetime('now')` UTC yazar ama saat dilimi eki KOYMAZ: "2026-09-12 11:29:20".
// Eksiz ve boşluklu bu dize V8'de YEREL saat sayılıyor; Türkiye'de ekranda
// 3 saat geri görünüyor. Panelde iki doğru okuma zaten vardı
// (HuntTable.tsx, DiamondTracking.tsx — ikisi de sona `Z` ekliyor) ama
// kural paylaşılmadığı için "Kim aradı?" ve Düşünenler aynı hatayı yeniden
// yaptı. Bu dosya o kuralın tek adresi.

/** SQLite UTC dizesini gerçek bir ana çevirir. Zaten ekliyse dokunmaz. */
export function utcOku(ham: string | null | undefined): Date | null {
  if (!ham) return null;
  const iso = ham.includes("T") ? ham : ham.replace(" ", "T");
  const ekli = /[zZ]|[+-]\d\d:\d\d$/.test(iso);
  const t = new Date(ekli ? iso : `${iso}Z`);
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Yerel takvim günü "YYYY-MM-DD". `toISOString().slice(0,10)` UTC günü
 *  verir; gece 00:00-03:00 arası yapılan aramayı "dün"e yazıyordu. */
export function yerelGun(t: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** Liste başlığı için gün adı: "Bugün", "Dün", "23 Eyl" — yerel takvimle. */
export function gunEtiketi(t: Date, simdi: Date = new Date()): string {
  const dun = new Date(simdi);
  dun.setDate(dun.getDate() - 1);
  if (yerelGun(t) === yerelGun(simdi)) return "Bugün";
  if (yerelGun(t) === yerelGun(dun)) return "Dün";
  return `${t.getDate()} ${AY_KISA[t.getMonth()]}`;
}

/** Bugünse "14:29", değilse "12.09 14:29" — yerel saatle. */
export function kisaZaman(t: Date | null): string {
  if (!t) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  const saat = `${p(t.getHours())}:${p(t.getMinutes())}`;
  return yerelGun(t) === yerelGun(new Date())
    ? saat
    : `${p(t.getDate())}.${p(t.getMonth() + 1)} ${saat}`;
}
