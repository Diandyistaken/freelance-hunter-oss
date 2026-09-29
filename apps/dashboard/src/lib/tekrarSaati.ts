// Açılmayan numara ne zaman tekrar aranır?
//
// 11 Eyl 2026: ilk 5 aramanın 4'ü açılmadı ve hiçbiri kayda geçmedi — açılmayan
// numara "ölü" sayılıyordu. Soğuk aramada olan şey bu değil: numara ölü değil,
// SAAT yanlış. Tek konuşmaya dönen arama 13:53'te bir pilates stüdyosunaydı,
// yani ders saatinin ortası.
//
// Kural basit ve elle doğrulanabilir olsun diye üç sabit dilim var; açılmayan
// her denemeden sonra hedef BİR SONRAKİ dilime kayar, gün biterse ertesi güne.

export interface SaatDilimi {
  kod: string;
  etiket: string;
  saat: number;   // dilimin başlangıç saati (0-23)
  dakika: number;
}

export const SAAT_DILIMLERI: readonly SaatDilimi[] = [
  { kod: "sabah", etiket: "10:00-11:30", saat: 10, dakika: 0 },
  { kod: "ogle-sonrasi", etiket: "14:00-15:30", saat: 14, dakika: 0 },
  { kod: "aksamustu", etiket: "17:00-18:30", saat: 17, dakika: 0 },
];

/**
 * Bu denemeden sonraki ilk uygun dilimin başlangıcı.
 * Bugün geride kalmayan bir dilim varsa o; yoksa yarının ilk dilimi.
 */
export function sonrakiDeneme(simdi: Date = new Date()): Date {
  const suAn = simdi.getHours() * 60 + simdi.getMinutes();
  for (const d of SAAT_DILIMLERI) {
    const dakika = d.saat * 60 + d.dakika;
    if (dakika > suAn) {
      const hedef = new Date(simdi);
      hedef.setHours(d.saat, d.dakika, 0, 0);
      return hedef;
    }
  }
  const ilk = SAAT_DILIMLERI[0];
  const yarin = new Date(simdi);
  yarin.setDate(yarin.getDate() + 1);
  yarin.setHours(ilk.saat, ilk.dakika, 0, 0);
  return yarin;
}

/** SQLite'ta karşılaştırılabilir olsun diye "YYYY-MM-DD HH:MM" (yerel saat). */
export function zamanYaz(t: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ` +
    `${p(t.getHours())}:${p(t.getMinutes())}`;
}

/** "bugün 17:00" / "yarın 10:00" / "12.09 10:00" — kartta okunacak hâli. */
export function zamanOku(metin: string, simdi: Date = new Date()): string {
  const t = new Date(metin.replace(" ", "T"));
  if (Number.isNaN(t.getTime())) return metin;
  const gun = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const yarin = new Date(simdi);
  yarin.setDate(yarin.getDate() + 1);
  const saat = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  if (gun(t) === gun(simdi)) return `bugün ${saat}`;
  if (gun(t) === gun(yarin)) return `yarın ${saat}`;
  return `${String(t.getDate()).padStart(2, "0")}.${String(t.getMonth() + 1).padStart(2, "0")} ${saat}`;
}

/** Bu zaman geldi mi (kuyruğun başına alınsın mı)? */
export function zamaniGeldiMi(metin: string | null, simdi: Date = new Date()): boolean {
  if (!metin) return true;
  const t = new Date(metin.replace(" ", "T"));
  return Number.isNaN(t.getTime()) || t <= simdi;
}
