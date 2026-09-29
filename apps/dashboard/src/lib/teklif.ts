// KUSURA ÖZEL TEKLİF — "kaça yapıyorsunuz?" sorusunun hazır cevabı.
//
// Kural (kullanıcı): her fiyat, O İŞLETMEDE GÖRDÜĞÜMÜZ eksikler üzerine
// kurulacak. Aynı rakam herkese okunmayacak; teklif lead'in gerçek kusur
// listesinden kalem kalem üretilir. Böylece müşteri "bu fiyat nereden
// çıktı" diye sorduğunda cevap hazır: her kalem bir bulguya bağlı.
//
// Fiyat bandı: docs/fiyat-ve-teslimat-rehberi.md (16 Ağu 2026 güncellemesi).

import type { RadarHit } from "@/components/RadarPanel";
import { fiyatPlani } from "@/lib/aramaSenaryosu";
import { onarimPlani } from "@/lib/onarimPlani";

export interface TeklifKalemi {
  ad: string;
  /** Hangi bulgudan doğdu — müşteri "niye" derse gösterilir. */
  gerekce: string;
  dahil: boolean; // paket fiyatına dahil mi, ek kalem mi
}

export interface Teklif {
  baslik: string;
  min: number;
  max: number;
  gunMin: number;
  gunMax: number;
  bakimAylik: number;
  kalemler: TeklifKalemi[];
  /** Onarım alternatifi (site kalsın denirse) — mümkünse dolu. */
  onarim: { min: number; max: number; mumkun: boolean; uyari?: string };
  odeme: string;
}

// Kusur kodu → teklife girecek iş kalemi.
const KALEM: Record<string, string> = {
  mobil_uyumsuz: "Telefona göre yeniden tasarım (mobil-önce)",
  https_yok: "Güvenli bağlantı (SSL) kurulumu + yönlendirme",
  https_yonlendirme_yok: "Güvenli adrese yönlendirme",
  https_yonlendirme_eksik: "Adres yönlendirme düzeltmesi",
  tls_gecersiz: "Geçerli güvenlik sertifikası kurulumu",
  tls_zincir_eksik: "Sertifika kurulum düzeltmesi",
  sertifika_bitiyor: "Otomatik yenilenen sertifika yapısı",
  sayfa_hatasi: "Sitenin yeniden ayağa kaldırılması",
  olu_domain: "Alan adı yenileme + sitenin kurulması",
  adres_calismiyor: "Adres varyantlarının düzeltilmesi",
  domain_suresi_bitiyor: "Alan adı yenileme takibi",
  yavas_google: "Hız optimizasyonu (görsel/önbellek)",
  yavas: "Hız optimizasyonu",
  agir_sayfa: "Sayfa ağırlığının düşürülmesi",
  gercek_kullanici_yavas: "Gerçek kullanıcı hız iyileştirmesi",
  eski_icerik: "İçerik tazeleme + güncel yıl",
  baslik_yok: "Google başlığı ve tanıtım yazısı",
  aciklama_yok: "Google tanıtım metni (description)",
  h1_yok: "Sayfa başlık hiyerarşisi",
  yapisal_veri_yok: "İşletme bilgisi işaretlemesi (Google için)",
  sitemap_yok: "Site haritası (sitemap)",
  psi_seo_dusuk: "Teknik SEO düzeltmeleri",
  erisilebilirlik_dusuk: "Okunabilirlik/erişilebilirlik düzeltmeleri",
  eposta_korumasiz: "E-posta sahteciliği koruması (SPF+DMARC)",
  dmarc_yok: "DMARC kaydı tamamlama",
  dmarc_pasif: "DMARC politikasının etkinleştirilmesi",
  spf_yok: "SPF kaydı",
  mail_spam_riski: "E-posta ulaşabilirliği düzeltmesi",
  saldiri_filtresi_yok: "Saldırı/bot filtresi (CDN) kurulumu",
  guvenlik_basliklari_eksik: "Güvenlik başlıkları",
  cerez_korumasiz: "Çerez güvenlik ayarları",
  eski_yazilim: "Altyapı güncellemesi",
  kvkk_metni_yok: "KVKK aydınlatma metni yerleşimi",
  sosyal_onizleme_yok: "WhatsApp/sosyal paylaşım önizlemesi",
  olcum_araci_yok: "Ziyaretçi ölçümü (Analytics) kurulumu",
  kendi_sitesi_yok: "Kendi alan adınızda site kurulumu",
  karisik_icerik: "Karışık içerik temizliği",
};

// Paket fiyatına dahil OLMAYAN, ayrıca konuşulacak kalemler.
const EK_KALEMLER = new Set(["olu_domain", "domain_suresi_bitiyor", "eski_yazilim"]);

export function teklifUret(hit: RadarHit, referansModu = false): Teklif {
  const plan = fiyatPlani(hit, referansModu);
  const onarim = onarimPlani(hit, referansModu);
  const kusurlar = hit.kusurlar ?? [];

  const gorulen = new Set<string>();
  const kalemler: TeklifKalemi[] = [];
  for (const k of kusurlar) {
    const ad = KALEM[k.kod];
    if (!ad || gorulen.has(ad)) continue;
    gorulen.add(ad);
    kalemler.push({
      ad,
      gerekce: k.baslik,
      dahil: !EK_KALEMLER.has(k.kod),
    });
  }

  return {
    baslik: plan.paket,
    min: plan.min,
    max: plan.max,
    gunMin: plan.gunMin,
    gunMax: plan.gunMax,
    bakimAylik: plan.bakimAylik,
    kalemler,
    onarim: {
      min: onarim.min,
      max: onarim.max,
      mumkun: onarim.mumkun,
      uyari: onarim.cozulmeyenler[0]?.neden,
    },
    odeme: "%50 kapora ile başlanır, kalan %50 teslimde.",
  };
}

const tl = (n: number) => n.toLocaleString("tr-TR");

/** Telefonda okunacak kısa teklif (fiyat sorulduğu an). */
export function teklifKisa(t: Teklif): string {
  const dahil = t.kalemler.filter((k) => k.dahil).length;
  return (
    `${t.baslik} için ${tl(t.min)}–${tl(t.max)} ₺. ` +
    `Bu fiyata sizde gördüğüm ${dahil} maddenin hepsi dahil — ` +
    `içerikler geldikten sonra ${t.gunMin}-${t.gunMax} günde teslim. ` +
    `${t.odeme} Aylık ${tl(t.bakimAylik)} ₺ bakım isteğe bağlı; kaynak kod sizin olur, zorunlu abonelik yok.`
  );
}

/** WhatsApp'tan gidecek yazılı teklif — kalem kalem, gerekçeli. */
export function teklifMetni(hit: RadarHit, t: Teklif): string {
  const dahil = t.kalemler.filter((k) => k.dahil);
  const ek = t.kalemler.filter((k) => !k.dahil);
  const satirlar: string[] = [
    `${hit.name} — teklif`,
    "",
    `${t.baslik}: ${tl(t.min)}–${tl(t.max)} ₺ · ${t.gunMin}-${t.gunMax} gün`,
    "",
    "Bu fiyata dahil olan işler (hepsi sizde ölçtüğüm bir bulguya karşılık geliyor):",
  ];
  dahil.forEach((k, i) => {
    satirlar.push(`${i + 1}) ${k.ad}`);
    satirlar.push(`   — çünkü: ${k.gerekce}`);
  });
  if (ek.length) {
    satirlar.push("", "Ayrıca konuşulacak (fiyata dahil değil):");
    ek.forEach((k) => satirlar.push(`· ${k.ad} — ${k.gerekce}`));
  }
  if (t.onarim.mumkun) {
    satirlar.push(
      "",
      `Alternatif: siteyi olduğu gibi bırakıp yalnız kusurları onarmak ` +
        `${tl(t.onarim.min)}–${tl(t.onarim.max)} ₺.`,
    );
    if (t.onarim.uyari) satirlar.push(`Yalnız dürüst olayım: ${t.onarim.uyari}`);
  }
  satirlar.push(
    "",
    t.odeme,
    `Aylık ${tl(t.bakimAylik)} ₺ bakım isteğe bağlı — kaynak kod sizin olur, zorunlu abonelik yok.`,
    "Alan adı sizin adınıza, sizin kartınızla alınır; hiçbir şifreniz bizde durmaz.",
    "",
    "İyi çalışmalar,",
    "Muhammed",
  );
  return satirlar.join("\n");
}
