// Telefonda TÜM kusurların anlatımı — aramaSenaryosu.ts yalnız EN AĞIR
// kusurdan 5 saniyelik açılış üretir; burası kalan her kusuru esnafın
// anlayacağı TEK cümleye çevirir, önem sırasına ve etki grubuna dizer,
// kopyalanabilir "tam anlatım" metni üretir.
//
// Kurallar (offer.md §4 + dogrula ilkesi):
//  · yalnız ÖLÇÜLEN kusur söylenir, korku satılmaz, abartı yok
//  · her cümle SONUÇ söyler (müşteri/Google/güven ne kaybediyor), sebep değil
//  · teknik terim yok — "DMARC" değil "sahte mail atılabilir"

import type { RadarHit, RadarKusur } from "@/components/RadarPanel";

// Kusur kodu → telefonda söylenecek tek cümle.
const CUMLELER: Record<string, (h: RadarHit) => string> = {
  mobil_uyumsuz: () =>
    "Siteniz telefonda kullanılamıyor — yazılar minicik çıkıyor, okumak için " +
    "parmakla büyütmek gerekiyor. Oysa müşterinizin onda dokuzu size telefondan bakıyor.",
  https_yok: () =>
    "Siteniz güvenli bağlantıyı (adres çubuğundaki kilidi) hiç desteklemiyor — " +
    "tarayıcı 'Güvenli Değil' damgası vuruyor, müşteri numarasını bırakmaya çekiniyor.",
  https_yonlendirme_yok: () =>
    "Adresinizi yazan müşteri sitenin korumasız hâline düşüyor — kilit işareti hiç çıkmıyor.",
  https_yonlendirme_eksik: () =>
    "Adresin eski hâli güvenli hâline kendiliğinden geçmiyor — ziyaretçi çoğunlukla " +
    "fark etmez ama Google bunu not ediyor.",
  tls_gecersiz: () =>
    "Sitenize giren müşteriyi tarayıcı kırmızı uyarı ekranıyla karşılıyor — " +
    "çoğu insan orada geri dönüyor.",
  tls_suresi_dolmus: () =>
    "Güvenlik sertifikanızın süresi dolmuş — ziyaretçi uyarı ekranı görüyor.",
  karisik_icerik: () =>
    "Sayfanızda bazı görseller güvensiz bağlantıyla yükleniyor — kilit işareti kayboluyor.",
  sayfa_hatasi: () =>
    "Sitenizin ana sayfası açılmıyor — giren müşteri hata ekranı görüyor.",
  olu_domain: (h) =>
    `Kayıtlı adresiniz ${h.domain ?? ""} artık açılmıyor — oraya düşen müşteri boş sayfa görüyor.`,
  yavas_google: () =>
    "Google kendi ölçümünde sitenize düşük hız notu veriyor — sayfa geç açıldıkça " +
    "müşteri beklemeden çıkıyor.",
  yavas: () => "Siteniz geç açılıyor — bekleyen müşteri çoğunlukla vazgeçip gidiyor.",
  agir_sayfa: () => "Sayfanız gereğinden ağır — telefonda geç açılıyor.",
  eski_icerik: (h) => {
    const yil = h.denetim_olcumler?.copyright_yili;
    return (
      `Sitenizin altında hâlâ ${yil ?? "eski bir yıl"} yazıyor — giren müşteri ` +
      `"burası hâlâ açık mı" diye tereddüt ediyor.`
    );
  },
  baslik_yok: () =>
    "Google'da çıktığınızda başlık yerine boş/anlamsız bir yazı görünüyor — " +
    "listede sizi kimse tanıyamıyor.",
  aciklama_yok: () =>
    "Google sizi listelediğinde altınızda tanıtım yazısı çıkmıyor — rakibin " +
    "altında iki satır davet var, sizinki boş.",
  h1_yok: () =>
    "Sayfanızda Google'ın 'burası ne iş yapar' diye baktığı ana başlık yok — " +
    "hangi aramada göstereceğini kestiremiyor.",
  yapisal_veri_yok: () =>
    "Adres, telefon ve çalışma saatiniz Google'ın anlayacağı biçimde " +
    "işaretlenmemiş — haritada ve aramada eksik görünüyorsunuz.",
  sitemap_yok: () =>
    "Google'a 'şu sayfalarım var' listesi sunulmamış — Google sitenizi el " +
    "yordamıyla keşfetmeye çalışıyor.",
  dmarc_yok: (h) =>
    `Alan adınız e-posta sahteciliğine açık — isteyen, ${h.domain ?? "sizin"} ` +
    "adınızdan sahte fatura maili atabilir.",
  eposta_korumasiz: (h) =>
    `Alan adınız e-posta sahteciliğine açık — isteyen, ${h.domain ?? "sizin"} ` +
    "adınızdan sahte fatura maili atabilir.",
  kendi_sitesi_yok: (h) =>
    `Kendi siteniz yok — müşteri sizi yalnız ${h.domain ?? "başka bir platform"} ` +
    "üzerinden görüyor, kuralları orası koyuyor.",

  // ---- 16 Ağu 2026: derinleştirilmiş denetimin yeni bulguları ----
  gercek_kullanici_yavas: (h) => {
    const y = h.denetim_olcumler?.crux_yavas_yuzde;
    return (
      `Google'ın gerçek ziyaretçi ölçümüne göre sitenize girenlerin ` +
      `%${y ?? "büyük bölümü"}'i yavaş açılma yaşıyor — bu tahmin değil, ` +
      "sizin kendi ziyaretçilerinizin verisi."
    );
  },
  psi_seo_dusuk: (h) => {
    const p = h.denetim_olcumler?.psi_seo;
    return (
      `Google'ın kendi SEO denetimi sitenize 100 üzerinden ${p ?? "düşük"} ` +
      "veriyor — yani aramalarda hak ettiğiniz yerde çıkmıyorsunuz."
    );
  },
  erisilebilirlik_dusuk: (h) => {
    const p = h.denetim_olcumler?.psi_erisilebilirlik;
    return (
      `Google erişilebilirlik denetiminden ${p ?? "düşük"} puan almış: yazılar ` +
      "kontrastsız, butonlar küçük — yaşlı müşteri ve gözlüklü kullanıcı zorlanıyor."
    );
  },
  guvenlik_basliklari_eksik: () =>
    "Sitenizde tarayıcı koruma ayarları tanımlı değil — siteniz başkasının " +
    "sayfasına çerçevelenip müşterinize sizmiş gibi gösterilebilir.",
  cerez_korumasiz: () =>
    "Site çerezleri korumasız işaretlenmiş — oturum bilgisi çalınmaya daha açık.",
  eski_yazilim: (h) => {
    const s = h.denetim_olcumler?.surum_generator;
    return (
      `Sitenizin altyapısı eski sürümde kalmış${s ? ` (${s})` : ""} ve bunu ` +
      "herkese açık yayınlıyor — güncellenmeyen kurulumlar zamanla riskli hale geliyor."
    );
  },
  sosyal_onizleme_yok: () =>
    "Sitenizin linkini WhatsApp'ta paylaştığınızda çıplak bir adres görünüyor — " +
    "görsel, başlık, tanıtım hiçbiri çıkmıyor.",
  kvkk_metni_yok: () =>
    "Sitenizde KVKK aydınlatma metni görünmüyor — randevu/iletişim formuyla " +
    "kişisel veri topluyorsanız bunun yazılı olması yasal zorunluluk.",
  olcum_araci_yok: () =>
    "Siteye kaç kişi geldiğini hiç ölçmüyorsunuz — reklam verseniz bile " +
    "işe yarayıp yaramadığını göremezsiniz.",
  domain_suresi_bitiyor: (h) => {
    const g = h.denetim_olcumler?.domain_kalan_gun;
    return (
      `Alan adınızın süresi ${g ?? "yakında"} gün sonra doluyor — yenilenmezse ` +
      "hem siteniz hem o adresteki e-postalarınız bir anda kapanır."
    );
  },
  sertifika_bitiyor: (h) => {
    const g = h.denetim_olcumler?.sertifika_kalan_gun;
    return (
      `Güvenlik sertifikanız ${g ?? "yakında"} gün sonra doluyor — yenilenmezse ` +
      "siteniz kırmızı uyarı ekranıyla açılmaya başlar."
    );
  },
  tls_zincir_eksik: () =>
    "Sertifikanız eksik kurulmuş — Chrome çoğunlukla toparlıyor ama bazı " +
    "telefonlarda müşteri güvenlik uyarısı görüyor.",
  tls_eski_protokol: () =>
    "Sunucunuz eski ve güvenli olmayan bir şifreleme protokolü kullanıyor — " +
    "bu, yıllar önce kapatılması gereken bir açık kapı; güncel kurulumda " +
    "kendiliğinden kapanır.",
  hsts_cok_kisa: () =>
    "Sitenizin güvenli bağlantı talimatı neredeyse hiç sürmüyor — tarayıcı " +
    "bir sonraki ziyarette güvenli bağlantıyı yeniden doğrulamak zorunda kalıyor.",
  csp_zayif: () =>
    "Sitenizin kod güvenliği kuralı gevşek tanımlanmış — bu, sayfaya kötü " +
    "kod enjekte edilmeye karşı ana siperin etkisiz olduğu anlamına geliyor.",
  cerez_secure_yok: () =>
    "Oturum çerezleriniz güvenli bağlantıyla sınırlandırılmamış — bu bilgi " +
    "açık ağda dinlenebilir durumda.",
  cerez_samesite_yok: () =>
    "Oturum çerezleriniz çapraz site isteklerine karşı işaretlenmemiş — " +
    "başka bir sitede onaylı işlem yapılmasına açık.",
  wp_kullanici_ifsa: (h) => {
    const ad = (h.denetim_olcumler?.wp_kullanici_ifsa as string[] | undefined)?.[0];
    return (
      `Sitenizin yönetici kullanıcı adları herkese açık şekilde görünüyor` +
      (ad ? ` (${ad})` : "") +
      ` — isteyen biri bununla otomatik şifre deneyebilir.`
    );
  },
  wp_dizin_listeleme: () =>
    "Sitenizin dosya klasörü herkese açık listeleniyor — yüklediğiniz " +
    "belgeler ve görseller o listeden görülebiliyor.",
  arsiv_degismemis: (h) => {
    const y = h.denetim_olcumler?.arsiv_ilk_yil;
    return (
      `Sitenizin görünümü${y ? ` ${new Date().getFullYear() - Number(y)} yıldır` : " uzun süredir"} ` +
      "neredeyse hiç değişmemiş — giren müşteri vitrini terk edilmiş sanıyor."
    );
  },
  robots_ifsa: () =>
    "Sitenizin harita dosyası yönetim ve yedek bölümlerinizi herkese " +
    "listeliyor — bunlar kötü niyetli tarayıcıların işini kolaylaştırıyor.",
  eposta_acik: () =>
    "Sitede e-posta adresiniz korumasız biçimde açıkça yazıyor — otomatik " +
    "toplayıcılar bunu alıp spam ve oltalama listelerine ekliyor.",
  spf_yok: (h) =>
    `Alan adınızda e-posta gönderim izni tanımlı değil — ${h.domain ?? "adınıza"} ` +
    "yazdığınız mailler karşı tarafta spam'e düşebiliyor.",
  adres_calismiyor: (h) =>
    `Adresinizin bir yazılışı (${h.domain ?? ""}) açılmıyor — müşteri ne ` +
    "yazdığına göre ya siteyi görüyor ya hata alıyor.",
};

/** Kusuru esnaf diline çevirir; eşleşme yoksa ölçülen başlık zaten sade. */
export function telefonCumlesi(hit: RadarHit, kusur: RadarKusur): string {
  return CUMLELER[kusur.kod]?.(hit) ?? kusur.baslik;
}

export type SiddetSinifi = "kritik" | "ciddi" | "kucuk";

/** RadarKusurRaporu'daki rozetlerle AYNI eşikler — panel tutarlı kalsın. */
export function siddetSinifi(siddet: number): SiddetSinifi {
  if (siddet >= 9) return "kritik";
  if (siddet >= 6) return "ciddi";
  return "kucuk";
}

export function kusurSayilari(hit: RadarHit): {
  kritik: number;
  ciddi: number;
  kucuk: number;
} {
  const sayilar = { kritik: 0, ciddi: 0, kucuk: 0 };
  for (const k of hit.kusurlar ?? []) sayilar[siddetSinifi(k.siddet)] += 1;
  return sayilar;
}

export function sayiMetni(hit: RadarHit): string {
  const s = kusurSayilari(hit);
  const parcalar = [
    s.kritik ? `${s.kritik} kritik` : "",
    s.ciddi ? `${s.ciddi} ciddi` : "",
    s.kucuk ? `${s.kucuk} küçük` : "",
  ].filter(Boolean);
  return parcalar.join(", ");
}

// ─────────────────────────────────────────────── etki grupları

export interface AnlatimKusuru {
  kusur: RadarKusur;
  cumle: string;
  sinif: SiddetSinifi;
}

export interface KusurGrubu {
  ad: string;
  ikon: string;
  kusurlar: AnlatimKusuru[];
}

const GRUP_TANIMLARI: { ad: string; ikon: string; kodlar: Set<string> }[] = [
  {
    ad: "Müşteri kaçıranlar",
    ikon: "🚪",
    kodlar: new Set([
      "mobil_uyumsuz", "https_yok", "https_yonlendirme_yok", "tls_gecersiz",
      "tls_suresi_dolmus", "karisik_icerik", "sayfa_hatasi", "yavas_google",
      "yavas", "agir_sayfa", "olu_domain", "kendi_sitesi_yok", "adres_calismiyor",
      "gercek_kullanici_yavas", "sosyal_onizleme_yok", "erisilebilirlik_dusuk",
      "tls_zincir_eksik", "arsiv_degismemis",
    ]),
  },
  {
    ad: "Google'da görünmez bırakanlar",
    ikon: "🔍",
    kodlar: new Set([
      "baslik_yok", "aciklama_yok", "h1_yok", "yapisal_veri_yok",
      "sitemap_yok", "https_yonlendirme_eksik", "psi_seo_dusuk",
      "olcum_araci_yok",
    ]),
  },
  {
    ad: "Güveni zedeleyenler",
    ikon: "🛡️",
    kodlar: new Set([
      "eski_icerik", "dmarc_yok", "eposta_korumasiz", "spf_yok",
      "guvenlik_basliklari_eksik", "cerez_korumasiz", "eski_yazilim",
      "kvkk_metni_yok", "domain_suresi_bitiyor", "sertifika_bitiyor",
      "tls_eski_protokol", "hsts_cok_kisa", "csp_zayif", "cerez_secure_yok",
      "cerez_samesite_yok", "wp_kullanici_ifsa", "wp_dizin_listeleme",
      "robots_ifsa", "eposta_acik",
    ]),
  },
];

/** Kusurları etki grubuna dizer (grup içinde şiddet sırası korunur). */
export function kusurGruplari(hit: RadarHit): KusurGrubu[] {
  const gruplar: KusurGrubu[] = GRUP_TANIMLARI.map((g) => ({
    ad: g.ad,
    ikon: g.ikon,
    kusurlar: [],
  }));
  const diger: KusurGrubu = { ad: "Diğer", ikon: "•", kusurlar: [] };

  for (const kusur of hit.kusurlar ?? []) {
    const kayit: AnlatimKusuru = {
      kusur,
      cumle: telefonCumlesi(hit, kusur),
      sinif: siddetSinifi(kusur.siddet),
    };
    const hedef =
      GRUP_TANIMLARI.findIndex((g) => g.kodlar.has(kusur.kod));
    if (hedef >= 0) gruplar[hedef].kusurlar.push(kayit);
    else diger.kusurlar.push(kayit);
  }
  return [...gruplar, diger].filter((g) => g.kusurlar.length > 0);
}

// ─────────────────────────────────────────────── devam anlatımı (hook)

/**
 * Vurgu seçimi: kalan kusurlardan en fazla `adet` tanesi, mümkünse FARKLI
 * etki gruplarından (güvenlik + eskilik + Google çeşitliliği tek gruptan üç
 * benzer cümleden daha vurucu). Uzun liste hook'u öldürür — gerisi "yazılı
 * gönderirim"e kalır.
 */
function vurguSec(kalan: RadarKusur[], adet = 3): RadarKusur[] {
  const grupNo = (kod: string) =>
    GRUP_TANIMLARI.findIndex((g) => g.kodlar.has(kod));
  const secilen: RadarKusur[] = [];
  const gorulen = new Set<number>();
  for (const k of kalan) {
    const g = grupNo(k.kod);
    if (gorulen.has(g)) continue;
    secilen.push(k);
    gorulen.add(g);
    if (secilen.length === adet) return secilen;
  }
  for (const k of kalan) {
    if (secilen.includes(k)) continue;
    secilen.push(k);
    if (secilen.length === adet) break;
  }
  return secilen;
}

/**
 * WhatsApp raporunun "Dahası var" bölümü: açılışta söylenen en ağır kusur
 * hariç, farklı etki gruplarından en vurucu cümleler (esnaf dilinde).
 */
export function raporVurgulari(hit: RadarHit): string[] {
  const kalan = (hit.kusurlar ?? []).slice(1);
  return vurguSec(kalan).map((k) => telefonCumlesi(hit, k));
}

/**
 * İlk 5 saniyeden SONRASI — açılışla aynı ritimde, hook'lu devam metni.
 * Açılış en ağır kusuru zaten söyledi; burası "tek sorun o değil" der, en
 * vurucu 3 kusuru kısa satırlarla sayar, sayıyla ağırlık verir ve İKİ yolu
 * (yenileme/onarım) masaya koyan soruyla kapanır — seçim sorusuna "hayır"
 * demek, teklife "hayır" demekten zordur.
 *
 * baglam "rapor": WhatsApp tam raporunun üst bloğu — detaylar hemen altında
 * olduğu için "kalanını yazılı gönderirim" yerine "hepsi aşağıda" der.
 */
export function tamAnlatim(
  hit: RadarHit,
  baglam: "telefon" | "rapor" = "telefon",
): string {
  const kusurlar = hit.kusurlar ?? [];
  if (!kusurlar.length) return "";
  const kalan = kusurlar.slice(1);
  if (!kalan.length)
    return [
      "Ölçtüğüm bu — dışarıdan görülen, uydurma olmayan tek net bulgu.",
      "İyi haber şu: düzelir.",
      "Baştan mı yapalım, olanı mı onaralım?",
    ].join("\n");
  const vurgular = vurguSec(kalan);
  const digerSayisi = kalan.length - vurgular.length;

  const sayiSatiri =
    baglam === "rapor"
      ? `Toplamda ${sayiMetni(hit)} bulgu ölçtüm — hepsi aşağıda, kanıtları ve ` +
        "kendiniz doğrulayabileceğiniz adımlarıyla."
      : `Toplamda ${sayiMetni(hit)} bulgu ölçtüm` +
        (digerSayisi > 0 ? ` — kalanını yazılı gönderirim` : "") +
        ". Hepsi dışarıdan görülen şeyler, uydurma yok.";

  const satirlar: string[] = [
    "Dahası var — az önce söylediğim tek sorun değil.",
    ...vurgular.map((k) => telefonCumlesi(hit, k)),
    sayiSatiri,
    "İyi haber şu: hepsi düzelir.",
    "Baştan mı yapalım, olanı mı onaralım?",
  ];
  return satirlar.join("\n");
}
