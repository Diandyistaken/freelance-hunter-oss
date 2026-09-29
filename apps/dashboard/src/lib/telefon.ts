// Telefonun her yerde OKUNABİLİR gösterimi: +905551234567 → 0555 123 45 67.
// Yalnız GÖRÜNÜM içindir — tel:/wa.me linkleri ham rakamla kurulmaya devam eder.
export function telefonBicimle(ham?: string | null): string {
  if (!ham) return "";
  let rakam = ham.replace(/\D/g, "");
  if (rakam.length === 12 && rakam.startsWith("90")) rakam = rakam.slice(2);
  if (rakam.length === 10) rakam = `0${rakam}`;
  // Beklenmedik biçime (uluslararası, eksik hane...) el sürme — yanlış
  // bölmektense olduğu gibi göstermek daha az yanıltıcı.
  if (rakam.length !== 11 || !rakam.startsWith("0")) return ham;
  return `${rakam.slice(0, 4)} ${rakam.slice(4, 7)} ${rakam.slice(7, 9)} ${rakam.slice(9, 11)}`;
}
