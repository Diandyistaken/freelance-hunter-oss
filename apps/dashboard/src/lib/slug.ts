// site_builder._slugify (Python) ile birebir aynı dönüşüm — radar_durum kayıtlarının
// ve önizleme linklerinin anahtarı burada üretilen slug'a bağlı, iki tarafta da
// AYNI kelime AYNI slug'ı vermeli.
export function slugla(ad: string): string {
  return (
    ad
      .toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ş/g, "s")
      .replace(/ğ/g, "g")
      .replace(/ç/g, "c")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "isletme"
  );
}
