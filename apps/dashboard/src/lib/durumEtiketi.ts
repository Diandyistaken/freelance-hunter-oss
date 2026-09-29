// radar_durum kodunun ekrandaki adı — tek yerden.
//
// Arama listesinde tanımlıydı; "Kim aradı?" aynı kaydı gösterirken ham kodu
// ("ulasilamadi", "dusunuyor") yazıyordu. İki ekran aynı kaydı iki dilde
// konuşmasın diye buraya taşındı.
export const DURUM_ETIKETI: Record<string, string> = {
  randevu: "📅 Randevu alındı",
  musteri: "🎉 Müşteri oldu",
  dusunuyor: "🤔 Düşünüyor",
  arandi: "✅ Arandı",
  ulasilamadi: "☎ Açmadı — tekrar aranacak",
  olmaz: "🙅 Olmaz dedi",
  gizli: "❌ Atlandı",
  kapandi: "🚫 Kapanmış",
};

export function durumEtiketi(kod: string | null | undefined): string {
  return kod ? (DURUM_ETIKETI[kod] ?? kod) : "";
}
