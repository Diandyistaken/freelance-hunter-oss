// Reklam Radarı — Meta Ad Library "boşluk" avcılığı yardımcıları.
//
// BAN-GÜVENLİĞİ (mutlak kural 1): Ad Library OTOMATİK TARANMAZ. Meta'nın
// resmî API'si TR ticari reklamlarını vermiyor, web arayüzünü kazımak yasak.
// Bu modül yalnız (a) elle bakış için hazır link üretir, (b) kullanıcının
// GÖZÜYLE GÖRÜP girdiği sayılardan boşluk skoru + kanıtlı mesaj üretir.
// Yani ölçümü insan yapar (30 sn), gerisini sistem yapar.

export interface RakipSayim {
  ad: string;
  sayi: number | null; // Ad Library'de görülen aktif reklam sayısı (girilmediyse null)
}

export type AdayDurum = "yeni" | "arandi" | "ilgilenmiyor" | "musteri" | "gizli";

export interface ReklamAdayi {
  slug: string;
  ad: string;
  tur: string | null;
  telefon: string | null;
  kaynak: "radar" | "manuel";
  reklam_sayisi: number | null; // işletmenin kendi aktif reklam sayısı
  sayim_tarihi: string | null; // YYYY-MM-DD — sayının hangi gün görüldüğü
  rakipler: RakipSayim[];
  durum: AdayDurum;
  not_metni: string | null;
  guncelleme: string;
}

/** Herkese açık Ad Library arama sayfası — elle bakış için. */
export function adLibraryUrl(sorgu: string, ulke = "TR"): string {
  const q = encodeURIComponent(sorgu.trim());
  return (
    "https://www.facebook.com/ads/library/?active_status=active&ad_type=all" +
    `&country=${ulke}&q=${q}&search_type=keyword_unordered&media_type=all`
  );
}

// Kategoriye göre bilinen BÜYÜK reklamverenler — yalnız öneridir: sayılarını
// sistem bilmez, kullanıcı Ad Library'de bakıp elle girer. Amaç videodaki
// "Work Louder 20 reklam / Razer 700" kıyasının TR karşılığını hızlandırmak.
const RAKIP_ONERILERI: { anahtar: string[]; rakipler: string[] }[] = [
  { anahtar: ["diş", "dental"], rakipler: ["DentGroup", "Hospitadent", "Dentakay"] },
  {
    anahtar: ["estetik", "cerrah", "dermatolog", "saç"],
    rakipler: ["Vera Clinic", "Estetik International"],
  },
  { anahtar: ["klinik", "poliklinik", "hastane"], rakipler: ["Acıbadem", "Memorial"] },
  { anahtar: ["otel"], rakipler: ["Elite World", "Dedeman"] },
];

export function rakipOner(tur: string | null): string[] {
  const t = (tur || "").toLocaleLowerCase("tr");
  for (const grup of RAKIP_ONERILERI) {
    if (grup.anahtar.some((a) => t.includes(a))) return grup.rakipler;
  }
  return [];
}

export function rakipOrtalama(rakipler: RakipSayim[]): number | null {
  const sayili = rakipler.filter((r) => typeof r.sayi === "number" && r.sayi >= 0);
  if (sayili.length === 0) return null;
  const toplam = sayili.reduce((acc, r) => acc + (r.sayi as number), 0);
  return Math.round(toplam / sayili.length);
}

export function enBuyukRakip(rakipler: RakipSayim[]): RakipSayim | null {
  let enBuyuk: RakipSayim | null = null;
  for (const r of rakipler) {
    if (typeof r.sayi !== "number") continue;
    if (!enBuyuk || r.sayi > (enBuyuk.sayi as number)) enBuyuk = r;
  }
  return enBuyuk;
}

export interface BoslukSonucu {
  skor: number; // 0-10: rakipler ne kadar önde ise o kadar yüksek
  zayifSinyal: boolean; // rakip ortalaması < 5 ise kıyas anlamlı değil
}

/**
 * Boşluk skoru: kendi sayısı rakip ortalamasının ne kadar altında?
 * 0 reklam + rakip ort. 40 → 10.0 · rakiple başa baş → 0.
 */
export function boslukSkoru(
  kendi: number | null,
  rakipler: RakipSayim[],
): BoslukSonucu | null {
  const ort = rakipOrtalama(rakipler);
  if (kendi === null || ort === null || ort <= 0) return null;
  const oran = Math.max(0, Math.min(1, 1 - kendi / ort));
  return { skor: Math.round(oran * 100) / 10, zayifSinyal: ort < 5 };
}

// ─────────────────────────── kanıtlı mesajlar
// aramaSenaryosu.acilis ile aynı kalıp: yerellik + ölçülmüş gözlem + soru.
// Dürüstlük çerçevesi (offer.md §4-5): yalnız GÖRÜLMÜŞ sayı söylenir, abartı
// vaat yok, numune "hazır şablondan örnek" diye sunulur, 1 takip sınırı.

function kendiSayiCumlesi(sayi: number): string {
  return sayi === 0 ? "sizin adınıza hiç aktif reklam görünmüyor" : `sizin yalnızca ${sayi} aktif reklamınız görünüyor`;
}

/** Telefon açıldıktan sonraki ilk ~5 saniye. Sayım girilmeden üretilmez. */
export function reklamAcilis(aday: ReklamAdayi): string | null {
  if (aday.reklam_sayisi === null) return null;
  const rakip = enBuyukRakip(aday.rakipler);
  const gozlem =
    rakip && typeof rakip.sayi === "number"
      ? `Meta'nın herkese açık reklam kütüphanesine baktım: ${rakip.ad} şu an ` +
        `${rakip.sayi} reklam dönüyor, ${kendiSayiCumlesi(aday.reklam_sayisi)}.`
      : `Meta'nın herkese açık reklam kütüphanesine baktım: ${kendiSayiCumlesi(aday.reklam_sayisi)}.`;
  return (
    `İyi günler, ${aday.ad} mi?\n` +
    `Ben Muhammed, Altıntepe'den — web sitesi ve reklam görseli işi yapıyorum.\n` +
    `${gozlem}\n` +
    `Haberiniz var mıydı?`
  );
}

/** Telefonu açmayana WhatsApp'tan gidecek kanıtlı mesaj. */
export function reklamWhatsapp(aday: ReklamAdayi): string | null {
  if (aday.reklam_sayisi === null) return null;
  const tarih = aday.sayim_tarihi ? ` (${aday.sayim_tarihi})` : "";
  const satirlar = [
    `Merhaba, ben Muhammed — Altıntepe'den, web sitesi ve reklam görseli işi yapıyorum.`,
    `Meta'nın herkese açık reklam kütüphanesine baktım${tarih}:`,
    `• ${aday.ad}: ${aday.reklam_sayisi} aktif reklam`,
  ];
  for (const r of aday.rakipler) {
    if (typeof r.sayi === "number") satirlar.push(`• ${r.ad}: ${r.sayi} aktif reklam`);
  }
  satirlar.push(
    `Reklam görsellerini çoğaltmak isterseniz hazır şablonlarımdan markanıza ` +
      `uyarlanmış birkaç örnek gösterebilirim — yayın ve bütçe kararı tamamen sizde kalır.`,
    `Uygun olursanız 2 dakikalık bir görüşme yeterli.`,
  );
  return satirlar.join("\n");
}
