// İşletme adı ile tablodaki alan adı HİÇ örtüşmüyorsa telefon öncesi uyarı.
//
// Sebep (3 Ağu 2026): Overture'daki website alanı bayat/yanlış olabiliyor —
// Bir spor salonu kaydında alakasız bir alan adı yazıyordu, işletmenin gerçek
// sitesi fitlifesports.com çıktı. Böyle bir lead'i "siteniz bozuk" diye
// aramak bizi yalancı çıkarır (kusurlar başkasının sitesine ait).
//
// Bu bir KESİN yargı değil, "Google'da doğrula" hatırlatmasıdır — işletme
// adıyla alakasız bir alan adını gerçekten kullanıyor olabilir.

const GENEL = new Set([
  "spor", "sports", "salon", "salonu", "kuafor", "guzellik", "emlak",
  "gayrimenkul", "restaurant", "restoran", "cafe", "kafe", "coffee", "hotel",
  "otel", "veteriner", "klinik", "klinigi", "anaokulu", "mobilya", "ozel",
  "merkezi", "merkez", "studio", "life", "club", "shop", "beauty", "hair",
  "gym", "fitness", "center", "sanat", "egitim", "kurumlari",
]);

function sadelestir(metin: string): string {
  return metin
    .toLocaleLowerCase("tr")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ş", "s")
    .replaceAll("ü", "u")
    .replace(/[^a-z0-9 ]/g, " ");
}

export function alanAdiSupheli(name?: string, domain?: string): boolean {
  if (!name || !domain) return false;
  const duzDomain = sadelestir(domain).replace(/ /g, "");
  const hepsi = sadelestir(name)
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  // Önce ayırt edici kelimelere bak; ad tamamen genel kelimelerden oluşuyorsa
  // (ör. "Örnek Spor Salonu") genel kelimelerle karşılaştır.
  const ozgun = hepsi.filter((t) => !GENEL.has(t));
  const tokenlar = ozgun.length ? ozgun : hepsi;
  if (!tokenlar.length) return false;
  return !tokenlar.some((t) => duzDomain.includes(t.slice(0, 6)));
}
