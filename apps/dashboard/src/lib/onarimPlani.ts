// "Site kalsın, sadece sorunları düzeltin" senaryosu + her senaryonun gidişat
// çizelgesi.
//
// Fiyat mantığı offer.md §4: "fiyat düşürme, kapsam küçült" — onarım paketi
// tam da küçük kapsamın kendisi. Kalem bantları 2026 TR taramasıyla
// (aramaSenaryosu.ts vitrin 7.500-12.000 ₺) orantılı seçildi; kasıtlı olarak
// onarım toplamı yenileme girişine YAKIN durur ki dürüst kıyas müşteriyi
// yenilemeye taşısın. NOT: bu bantlar offer.md'ye YAZILMADI — iş kararı
// kullanıcının (bkz. HANDOFF "kullanıcı kararı bekleyen").
//
// Dürüstlük: yapısal kusurlar (mobil uyum gibi) onarım paketine KONMAZ —
// yamayla düzelmeyecek şeye para aldırmayız; "çözülmeyenler" listesi hem
// kartta hem yazılı kapsamda açıkça gösterilir.

import type { RadarHit } from "@/components/RadarPanel";
import { fiyatPlani } from "@/lib/aramaSenaryosu";

const tl = (n: number) => n.toLocaleString("tr-TR");

interface KalemTanimi {
  ad: string;
  kodlar: string[];
  min: number;
  max: number;
  not?: string;
}

const KALEM_TANIMLARI: KalemTanimi[] = [
  {
    ad: "Güvenli bağlantı (HTTPS) kurulumu + yönlendirme",
    kodlar: [
      "https_yok", "https_yonlendirme_yok", "https_yonlendirme_eksik",
      "tls_gecersiz", "tls_suresi_dolmus", "karisik_icerik",
    ],
    min: 3500,
    max: 5000,
    not: "Mevcut sunucu desteklemiyorsa küçük bir taşıma gerekir — o ayrıca konuşulur.",
  },
  {
    ad: "Google görünürlük düzeltmeleri (başlık, açıklama, işaretleme, sitemap)",
    kodlar: ["baslik_yok", "aciklama_yok", "h1_yok", "yapisal_veri_yok", "sitemap_yok"],
    min: 2500,
    max: 4000,
  },
  {
    ad: "E-posta sahteciliği koruması (SPF/DMARC kayıtları)",
    kodlar: ["dmarc_yok", "eposta_korumasiz"],
    min: 1000,
    max: 2000,
    not: "Siteye dokunmadan, alan adı ayarından yapılır.",
  },
  {
    ad: "İçerik tazeleme (yıl, iletişim, küçük rötuşlar)",
    kodlar: ["eski_icerik"],
    min: 1000,
    max: 2000,
  },
  {
    ad: "Hız iyileştirme (görsel sıkıştırma, önbellek)",
    kodlar: ["yavas_google", "yavas", "agir_sayfa"],
    min: 3000,
    max: 5000,
    not: "Eski altyapıda kazanç sınırlı olabilir — bunu baştan söyle.",
  },
];

// Onarımla ÇÖZÜLMEYEN yapısal kusurlar — pakete koyup para alınmaz.
const YAPISAL_NEDEN: Record<string, string> = {
  mobil_uyumsuz:
    "Telefon görünümü sitenin iskeletinde — yamayla düzelmez, ancak yeniden yapımla çözülür.",
  olu_domain: "Ortada onarılacak site yok — alan adı düşmüş.",
  kendi_sitesi_yok: "Onarılacak kendi siteniz yok; platform sayfası bizim değil.",
  sayfa_hatasi: "Site hiç açılmıyor — bu onarım değil, yeniden kurulum konusu.",
};

export const ERISIM_SARTI =
  "Mevcut sitenin dosyalarına/yönetim paneline erişim ŞART (hosting hesabı). " +
  "Erişim yoksa alan adı (DNS) kalemleri dışında onarım yapılamaz.";

export interface OnarimKalemi {
  ad: string;
  min: number;
  max: number;
  not?: string;
  kusurSayisi: number;
}

export interface OnarimPlani {
  mumkun: boolean;
  kalemler: OnarimKalemi[];
  cozulmeyenler: { baslik: string; neden: string }[];
  min: number;
  max: number;
  gunMin: number;
  gunMax: number;
  erisimSarti: string;
  /** Yenilemeyle dürüst kıyas cümlesi — satışta aynen söylenebilir. */
  kiyas: string;
}

export function onarimPlani(hit: RadarHit, referansModu = false): OnarimPlani {
  const kodlar = new Set((hit.kusurlar ?? []).map((k) => k.kod));

  const kalemler: OnarimKalemi[] = [];
  for (const tanim of KALEM_TANIMLARI) {
    const kusurSayisi = tanim.kodlar.filter((k) => kodlar.has(k)).length;
    if (kusurSayisi > 0)
      kalemler.push({
        ad: tanim.ad,
        min: tanim.min,
        max: tanim.max,
        not: tanim.not,
        kusurSayisi,
      });
  }

  const cozulmeyenler = (hit.kusurlar ?? [])
    .filter((k) => YAPISAL_NEDEN[k.kod])
    .map((k) => ({ baslik: k.baslik, neden: YAPISAL_NEDEN[k.kod] }));

  const min = kalemler.reduce((a, k) => a + k.min, 0);
  const max = kalemler.reduce((a, k) => a + k.max, 0);
  const yeni = fiyatPlani(hit, referansModu);

  let kiyas = "";
  if (kalemler.length) {
    kiyas =
      yeni.min <= max
        ? `Onarımın üst bandı (${tl(max)} ₺) sıfır km sitenin başlangıcıyla ` +
          `(${tl(yeni.min)} ₺) aynı yerde — aynı paraya yama yerine yenisi var.`
        : `Onarımın üst bandı ${tl(max)} ₺; sıfır km site ${tl(yeni.min)} ₺'den ` +
          `başlıyor — aradaki fark ${tl(yeni.min - max)} ₺.`;
    if (cozulmeyenler.length)
      kiyas += " Üstelik yapısal sorunlar (ör. telefon görünümü) onarımla düzelmiyor.";
  }

  return {
    mumkun: kalemler.length > 0,
    kalemler,
    cozulmeyenler,
    min,
    max,
    gunMin: kalemler.length > 1 ? 2 : 1,
    gunMax: kalemler.length > 1 ? 4 : 2,
    erisimSarti: ERISIM_SARTI,
    kiyas,
  };
}

// ─────────────────────────────────────────────── senaryo çizelgesi

export interface Senaryo {
  id: string;
  ikon: string;
  /** Karşı taraf ne derse bu yola girilir. */
  kosul: string;
  fiyat: string;
  sure: string;
  ozet: string;
  adimlar: string[];
  dikkat?: string;
  onerilen?: boolean;
}

/** Telefonda çıkabilecek HER sonucun gidişatı — tek bakışta yol haritası. */
export function senaryoCizelgesi(
  hit: RadarHit,
  demoVar: boolean,
  referansModu = false,
): Senaryo[] {
  const plan = fiyatPlani(hit, referansModu);
  const onarim = onarimPlani(hit, referansModu);
  const kodlar = new Set((hit.kusurlar ?? []).map((k) => k.kod));
  const senaryolar: Senaryo[] = [];

  senaryolar.push({
    id: "yenile",
    ikon: "🟢",
    kosul: "“Baştan yapın” derse",
    fiyat: `${tl(plan.min)}–${tl(plan.max)} ₺ (+${tl(plan.bakimAylik)} ₺/ay bakım, ops.)`,
    sure: `${plan.gunMin}-${plan.gunMax} gün`,
    ozet: "Kalıcı çözüm: ölçülen kusurların TAMAMI tek kurulumda kökten kapanır.",
    adimlar: [
      "%50 kapora + kapsam WhatsApp'tan YAZILI",
      "Tasarım seçimi (sıfırdan üretim / Çoklu Yayınla)",
      "İçerik listesi müşteriden (3 gün kuralı: gelmezse süre işlemez)",
      "Kurulum → mevcut adrese geçiş (eski site yayına kadar ayakta kalır)",
      "Teslim + 1 tur revizyon; kalan %50 teslimde",
    ],
    dikkat: "Alan adı müşteri adına, müşterinin kartıyla — hiçbir şifre bizde durmaz.",
    onerilen: onarim.cozulmeyenler.length > 0,
  });

  if (onarim.mumkun) {
    senaryolar.push({
      id: "onarim",
      ikon: "🔧",
      kosul: "“Site kalsın, sorunları düzeltin” derse",
      fiyat: `${tl(onarim.min)}–${tl(onarim.max)} ₺ (tek sefer)`,
      sure: `${onarim.gunMin}-${onarim.gunMax} gün`,
      ozet:
        `${onarim.kalemler.length} onarım kalemi: ` +
        onarim.kalemler.map((k) => k.ad.split("(")[0].trim()).join(" · ") +
        ".",
      adimlar: [
        "Hosting/panel erişimini teyit et — erişim yoksa bu yol kapalı",
        "%50 kapora + kalem listesi YAZILI (çözülmeyenler de yazılır)",
        "Kalemler uygulanır",
        "Önce/sonra ölçüm raporuyla teslim; kalan %50",
      ],
      dikkat: onarim.cozulmeyenler.length
        ? `Bu pakette DÜZELMEZ: ${onarim.cozulmeyenler
            .map((c) => c.neden)
            .join(" ")} ${onarim.kiyas}`
        : onarim.kiyas || undefined,
    });
  } else {
    senaryolar.push({
      id: "onarim",
      ikon: "🔧",
      kosul: "“Site kalsın, düzeltin” derse",
      fiyat: "—",
      sure: "—",
      ozet:
        "Bu lead'de onarım seçeneği yok: " +
        (onarim.cozulmeyenler[0]?.neden ?? "onarılacak sağlam gövde yok."),
      adimlar: [
        "Dürüstçe söyle: bu yola para vermesin",
        "Yeniden kurulum senaryosuna yönlendir",
      ],
    });
  }

  if (kodlar.has("dmarc_yok") || kodlar.has("eposta_korumasiz") || kodlar.has("yapisal_veri_yok")) {
    senaryolar.push({
      id: "mini",
      ikon: "📮",
      kosul: "Kararsız / küçük başlamak isterse",
      fiyat: "750–1.500 ₺",
      sure: "aynı gün",
      ozet:
        "Güven adımı — siteye hiç dokunmadan yapılabilenler: e-posta koruması " +
        "(alan adı ayarı) + Google İşletme Profili düzeni.",
      adimlar: [
        "Ücreti peşin al (küçük iş, kapora bölünmez)",
        "Alan adı kayıtları + profil düzeni aynı gün",
        "1 hafta sonra kanıt görüntüsüyle dön → büyük paketi konuş",
      ],
      dikkat: "Bu paket kapı açar: memnuniyet, yenileme satışının referansı olur.",
    });
  }

  senaryolar.push({
    id: "demo",
    ikon: "🎨",
    kosul: "“Önce göreyim” derse",
    fiyat: "$0 (Max aboneliği)",
    sure: "2-5 dk",
    ozet: demoVar
      ? "Demo hazır — WhatsApp'tan linki at, 'geçici konsept' de."
      : "Kusura özel sıfırdan tasarımı üret (para harcamaz), linki WhatsApp'tan at.",
    adimlar: [
      "Linki gönder; 'hazır çalışmamdan örnek, son hâli değil' de",
      "2 gün sonra BİR kez hatırlat — işletme başına maks 1 takip",
      "Beğenmezse: farklı tasarımlar göster (Çoklu Yayınla), tartışma",
    ],
  });

  senaryolar.push({
    id: "red",
    ikon: "🚪",
    kosul: "“İlgilenmiyorum” derse",
    fiyat: "—",
    sure: "—",
    ozet: "Temiz çık, kapıyı açık bırak — mahalle küçük, itibar büyük.",
    adimlar: [
      "Teşekkür et, numaranı bırak",
      "Radar'da ❌ işaretle",
      "Aylarca tekrar arama; takip hakkı kullanıldıysa hiç",
    ],
  });

  return senaryolar;
}
