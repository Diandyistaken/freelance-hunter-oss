// Radar v2 — lead'e ÖZEL telefon senaryosu, fiyat bandı ve teslimat planı.
//
// Fark: /arama sayfasındaki Konuşma Ağacı SEKTÖRE göre geneldir. Burası
// KUSURA göre çalışır — radar o işletmenin sitesinde neyi ölçtüyse, telefonu
// açtığın ilk 5 saniyede söyleyeceğin cümle ondan üretilir.
//
// Dürüstlük çerçevesi (offer.md §4 kırmızı çizgiler):
//  · "sıfırdan size yaptım" DENMEZ → "hazır şablonumdan örnek"
//  · abartı vaat yok ("Google'da 1. sıra" gibi)
//  · işletme başına en fazla 1 takip
//  · korku satma; ölçülen kusuru söyle, çözümü öner

import type { RadarHit } from "@/components/RadarPanel";
import { raporVurgulari, sayiMetni } from "@/lib/kusurAnlatimi";

// ─────────────────────────────────────────────── 5 saniyelik açılış

export interface KusurSenaryo {
  // Telefon açıldıktan sonraki 3-5 saniyede söylenecek TEK cümle.
  // Somut, ölçülmüş, işletmeye özel; sonunda soru var ki karşı taraf konuşsun.
  gozlem: (h: RadarHit) => string;
  // "Haberiniz var mıydı?" dedikten sonra, izin verirse söylenecek.
  devam: string;
  // Bu kusura ÖZEL itirazlar (genel itirazlar /arama sayfasında).
  itirazlar: { soru: string; cevap: string }[];
}

const SENARYOLAR: Record<string, KusurSenaryo> = {
  olu_domain: {
    gozlem: (h) =>
      `İnternette kayıtlı olan ${h.domain} adresiniz artık açılmıyor — ` +
      `oraya giren müşteri boş bir hata sayfası görüyor.`,
    devam:
      "Muhtemelen alan adının süresi dolmuş. Yenisini kendi adınıza alıp " +
      "sayfayı bugün yayına alabiliriz. Nasıl görüneceğine dair hazır " +
      "şablonumdan bir örnek hazırladım, WhatsApp'tan atayım, 2 dakika bakın.",
    itirazlar: [
      {
        soru: "Zaten kullanmıyorduk / gerek yok",
        cevap:
          "Anladım. Ama Google'da ve haritada o adres hâlâ görünüyor; sizi " +
          "arayan yeni müşteri oraya düşüp hata alıyor. En azından bunu " +
          "bilmenizi istedim.",
      },
      {
        soru: "Kim kapattı, ben mi?",
        cevap:
          "Genelde yıllık ücret ödenmeyince otomatik düşer. Kimseyi suçlamak " +
          "için aramadım, düzeltmesi zor değil.",
      },
    ],
  },

  kendi_sitesi_yok: {
    gozlem: (h) =>
      `İnternette sizi aradığımda kendi siteniz çıkmadı, sadece ` +
      `${h.domain} sayfanız çıkıyor.`,
    devam:
      "Orası sizin vitriniz değil; kuralları ve görünümü başkası belirliyor. " +
      "Kendi adınızda bir sayfanız olsa hem Google'da siz çıkarsınız hem " +
      "müşteri doğrudan sizi arar. Hazır bir örnek göndereyim mi?",
    itirazlar: [
      {
        soru: "Instagram bize yetiyor",
        cevap:
          "Instagram müşteriyi bulmak için iyi. Ama telefon numarası, " +
          "çalışma saati, yol tarifi arayan müşteri orada kayboluyor. İkisi " +
          "birbirinin yerine değil, yanına geçiyor.",
      },
      {
        soru: "Yemeksepeti zaten sipariş getiriyor",
        cevap:
          "Getiriyor, ama her siparişten komisyon alıyor. Kendi sayfanızdan " +
          "gelen müşteride o kesinti yok.",
      },
    ],
  },

  sayfa_hatasi: {
    gozlem: () =>
      "Sitenizin ana sayfası açılmıyor — sunucu hata veriyor, sayfa hiç gelmiyor.",
    devam:
      "Yani şu an siteniz var ama çalışmıyor. Yerine bugün ayağa " +
      "kaldırabileceğim bir örnek hazırladım, bakmak ister misiniz?",
    itirazlar: [
      {
        soru: "Bizde açılıyor ama",
        cevap:
          "Sizin telefonunuzda önbellekte kalmış olabilir. Başka bir " +
          "telefondan, mobil veriyle deneyin; ben de tam olarak ne hata " +
          "verdiğini yazılı gönderebilirim.",
      },
    ],
  },

  mobil_uyumsuz: {
    gozlem: () =>
      "Siteniz telefondan bakınca minicik çıkıyor — yazıyı okumak için " +
      "parmakla büyütmek gerekiyor.",
    devam:
      "Müşterilerinizin çoğu size telefondan bakıyor. Telefona göre " +
      "hazırlanmış bir örnek yaptım; yan yana koyunca farkı hemen " +
      "görürsünüz. WhatsApp'tan atayım mı?",
    itirazlar: [
      {
        soru: "Bilgisayarda gayet iyi görünüyor",
        cevap:
          "Doğru, bilgisayarda sorun yok. Sorun telefonda. Şimdi kendi " +
          "telefonunuzdan açın, ben bekliyorum — ne demek istediğimi " +
          "görürsünüz.",
      },
    ],
  },

  yavas_google: {
    gozlem: (h) => {
      const skor = h.kusurlar?.find((k) => k.kod === "yavas_google");
      const not = skor?.baslik.match(/(\d+)$/)?.[1] ?? "düşük";
      const lcp = h.denetim_olcumler?.lcp;
      return (
        `Google sitenize telefon hızı için 100 üzerinden ${not} vermiş` +
        (lcp ? `; sayfanız ${lcp} sonra açılıyor.` : ".")
      );
    },
    devam:
      "Bu benim yorumum değil, Google'ın kendi ölçümü — isterseniz raporun " +
      "linkini de atayım. Hızlı açılan bir örnek hazırladım, aradaki farkı " +
      "kendi telefonunuzda görebilirsiniz.",
    itirazlar: [
      {
        soru: "Bizim internetimiz yavaş, ondandır",
        cevap:
          "Ölçüm sizin internetinizden değil, Google'ın sunucusundan " +
          "yapılıyor. Yani müşteri nerede olursa olsun aynı sonucu alıyor.",
      },
    ],
  },

  tls_gecersiz: {
    gozlem: () =>
      "Sitenize giren müşteriye tarayıcı önce 'Bağlantınız gizli değil' " +
      "diye kırmızı bir uyarı ekranı gösteriyor.",
    devam:
      "Çoğu insan o ekranı görünce geri dönüyor — yani reklamınız çalışsa " +
      "bile müşteri içeri giremiyor. Bu düzeltilebilir bir şey.",
    itirazlar: [
      {
        soru: "Siteyi yapan arkadaş baksın",
        cevap:
          "Tabii, en doğrusu o. Ona da söyleyebileceğiniz teknik detayı " +
          "yazılı göndereyim; ilgilenmezse ben hallederim.",
      },
    ],
  },

  tls_suresi_dolmus: {
    gozlem: () =>
      "Sitenizin güvenlik sertifikasının süresi dolmuş — tarayıcı " +
      "ziyaretçiyi uyarı ekranıyla karşılıyor.",
    devam:
      "Bu genelde yenilenmesi unutulmuş bir kayıttır. Ben yeni kurulumda " +
      "otomatik yenilenen bir yapı kuruyorum, bir daha uğraşmıyorsunuz.",
    itirazlar: [],
  },

  https_yonlendirme_yok: {
    gozlem: () =>
      "Chrome adres çubuğunda sitenizin adının yanında 'Güvenli Değil' yazıyor.",
    devam:
      "Müşteri form doldurmaya, telefon bırakmaya çekiniyor; Google da " +
      "sıralamada bunu dikkate alıyor. Düzgün kurulmuş bir örnek hazırladım, " +
      "göndereyim mi?",
    itirazlar: [
      {
        soru: "Biz kredi kartı almıyoruz ki",
        cevap:
          "Almasanız da tarayıcı o uyarıyı gösteriyor. Mesele ödeme değil, " +
          "müşterinin gördüğü ilk izlenim.",
      },
    ],
  },

  https_yok: {
    gozlem: () =>
      "Siteniz güvenli bağlantıyı (HTTPS) hiç desteklemiyor; tarayıcı " +
      "'Güvenli Değil' diye işaretliyor.",
    devam:
      "Bu artık standart oldu ve ücretsiz. Yeni kurulumda otomatik geliyor.",
    itirazlar: [],
  },

  eski_icerik: {
    gozlem: (h) => {
      const yil = h.denetim_olcumler?.copyright_yili;
      return (
        `Sitenizin altında hâlâ ${yil ?? "eski bir"} yazıyor — ` +
        `giren müşteri "burası hâlâ açık mı" diye tereddüt ediyor.`
      );
    },
    devam:
      "İşletme çalışıyor ama vitrin eskimiş görünüyor. Güncel bir örnek " +
      "hazırladım, bakar mısınız?",
    itirazlar: [
      {
        soru: "Site duruyor işte, ne olmuş",
        cevap:
          "Duruyor tabii. Ama müşteri gözüyle bakınca terk edilmiş izlenimi " +
          "veriyor; sizin işiniz o kadar iyi giderken vitrin geride kalmış.",
      },
    ],
  },

  eposta_korumasiz: {
    gozlem: (h) =>
      `Alan adınızda koruma kaydı yok — şu an isteyen herkes ${h.domain} ` +
      `adınıza görünen sahte e-posta atabilir.`,
    devam:
      "Bunu kötü niyetli biri müşterinize fatura göndermek için kullanabilir. " +
      "Kurulumda bu kaydı da açıyorum, ek ücreti yok.",
    itirazlar: [
      {
        soru: "Bize kimse öyle bir şey yapmaz",
        cevap:
          "Umarım yapmaz. Bu genelde hedef seçilerek değil, otomatik " +
          "taramayla yapılıyor. 5 dakikalık bir ayar, kapatalım gitsin.",
      },
    ],
  },

  karisik_icerik: {
    gozlem: () =>
      "Sitenizde bazı görseller güvensiz bağlantıyla yükleniyor; tarayıcı " +
      "adres çubuğundaki kilit işaretini kaldırıyor.",
    devam: "Küçük bir kurulum hatası ama müşteriye güvensiz görünüyor.",
    itirazlar: [],
  },

  baslik_yok: {
    gozlem: () =>
      "Google'da çıktığınızda başlık yerine boş/anlamsız bir yazı görünüyor.",
    devam:
      "Yani arayan kişi listede sizi göremiyor. Bu, düzeltilmesi en kolay " +
      "ama etkisi en hızlı görünen şeylerden biri.",
    itirazlar: [],
  },

  adres_calismiyor: {
    gozlem: (h) =>
      `Kartvizitinizde/haritada yazan ${h.domain} adresi açılmıyor.`,
    devam:
      "Adresin bir hâli çalışıyor, diğeri çalışmıyor — müşteri hangisini " +
      "yazdığına göre ya siteyi görüyor ya hata alıyor.",
    itirazlar: [],
  },

  wp_kullanici_ifsa: {
    gozlem: (h) => {
      const adlar = (h.denetim_olcumler?.wp_kullanici_ifsa as string[] | undefined) ?? [];
      const ornek = adlar[0] ? ` (${adlar[0]})` : "";
      return (
        `Sitenizin yönetici kullanıcı adı${ornek} herkese açık şekilde ` +
        "görünüyor — Google'a yazınca bile bulunabiliyor."
      );
    },
    devam:
      "İsteyen biri bu adla otomatik şifre denemeleri yapabilir. Bunu " +
      "kapatmak ve iki adımlı doğrulama açmak 2 dakika — yeni kurulumda " +
      "bunlar zaten kapalı gelir.",
    itirazlar: [
      {
        soru: "Şifremiz güçlü",
        cevap:
          "Güçlü şifre iyi. Ama kullanıcı adını bilen biri şifreyi otomatik " +
          "deneyebilir; mesele şifrenin güçlü olması değil, saldırganın " +
          "nereden başlayacağını bilmesi.",
      },
      {
        soru: "Bunu siz nereden gördünüz",
        cevap:
          "Siteniz bu bilgiyi herkese açık sunuyor; ben de sizin gibi bir " +
          "ziyaretçi olarak gördüm. İsterseniz aynı adresi siz de açıp " +
          "doğrulayabilirsiniz.",
      },
    ],
  },

  wp_dizin_listeleme: {
    gozlem: () =>
      "Sitenizin dosya klasörü herkese açık listeleniyor — yüklediğiniz " +
      "belgeler ve görseller tarayıcıdan görülebiliyor.",
    devam:
      "Oraya konulan faturalar, müşteri belgeleri, özel görseller dışarıdan " +
      "görünebilir. Klasörü kapatmak bir ayar; yeni kurulumda zaten kapalı gelir.",
    itirazlar: [
      {
        soru: "Orada önemli bir şey yok",
        cevap:
          "Umarım yoktur. Ama bir gün yüklerseniz ve listeleme açık kalırsa " +
          "görünür olur. Bu 1 dakikalık bir kapatma işlemi.",
      },
    ],
  },

  tls_eski_protokol: {
    gozlem: () =>
      "Sitenizin sunucusu eski ve güvenli olmayan bir şifreleme protokolüne " +
      "izin veriyor — yıllar önce kapatılması gereken bir açık kapı.",
    devam:
      "Güncel kurulumda bu kendiliğinden kapanır; müşteri verisinin " +
      "güvenliği için bu artık standart.",
    itirazlar: [],
  },

  arsiv_degismemis: {
    gozlem: (h) => {
      const y = h.denetim_olcumler?.arsiv_ilk_yil;
      const yas = y ? new Date().getFullYear() - Number(y) : 0;
      return (
        `Sitenizin görünümü${yas ? ` ${yas} yıldır` : " uzun süredir"} ` +
        "neredeyse hiç değişmemiş — arşiv kayıtları bunu gösteriyor."
      );
    },
    devam:
      "Giren müşteri vitrini terk edilmiş sanıyor. Sizinki gibi bir işletme " +
      "bu görünümü hak etmiyor; güncel bir örnek hazırladım, bakar mısınız?",
    itirazlar: [
      {
        soru: "İşimize yarıyor, dokunmadık",
        cevap:
          "Çalışıyor olması sorunu çözmüyor — müşteri gözü eski görünce " +
          "'burası açık mı' diye şüpheleniyor. Değiştirmeden güncellemek de " +
          "mümkün, eskisini bozmadan.",
      },
    ],
  },
};

// Radar'ın güncel kodları: dmarc_yok (eposta_korumasiz'ın denetimdeki adı) ve
// https_yonlendirme_eksik (TLS sağlamken şiddet-3'e indirilen hâl — ziyaretçiye
// görünmez, telefonda ANA KOZ olarak KULLANMA; bkz. audit.py).
SENARYOLAR.dmarc_yok = SENARYOLAR.eposta_korumasiz;
SENARYOLAR.https_yonlendirme_eksik = {
  gozlem: () =>
    "Adresin eski hâli güvenli hâline kendiliğinden geçmiyor — ziyaretçi " +
    "çoğunlukla fark etmez ama Google bunu not ediyor.",
  devam: "Küçük bir sunucu ayarı; yeni kurulumda kendiliğinden doğru gelir.",
  itirazlar: [],
};

// Kusur eşleşmezse: işletmeye özel olmayan ama yine de dürüst bir açılış.
const VARSAYILAN: KusurSenaryo = {
  gozlem: () =>
    "Sitenize baktım, müşteri gözüyle birkaç aksayan yer var.",
  devam:
    "Nasıl görünebileceğine dair hazır şablonumdan bir örnek hazırladım. " +
    "İsterseniz WhatsApp'tan atayım, 2 dakikada bakarsınız.",
  itirazlar: [],
};

export function senaryoSec(hit: RadarHit): KusurSenaryo {
  const enAgir = hit.kusurlar?.[0];
  return (enAgir && SENARYOLAR[enAgir.kod]) || VARSAYILAN;
}

/** PSI ölçüldüyse Google'ın 100 üzerinden notu (yavas_google başlığından). */
export function psiNotu(hit: RadarHit): string | null {
  const kusur = hit.kusurlar?.find((k) => k.kod === "yavas_google");
  return kusur?.baslik.match(/(\d+)$/)?.[1] ?? null;
}

/**
 * Telefon açıldıktan sonraki ilk ~5 saniye — tek parça, kopyalanabilir.
 *
 * Kimlik satırı bilinçli "Google'ın işletme araçlarıyla tarama" der (3 Ağu
 * kullanıcı kararı): otorite hook'u — ama PARTNERLİK İDDİASI DEĞİL. DoH,
 * PageSpeed ve Google'daki görünüm ölçümleri gerçekten Google'ın araçları;
 * yalansız tek çerçeve bu. "Google ile partneriz / Google'dan arıyorum"
 * YASAK: doğrulanabilir yalan + yanıltıcı ticari uygulama.
 * PSI rakamı varsa ve açılış kusuru zaten hız değilse, Google tanıklığı
 * TEK kısa cümle olarak eklenir.
 */
export function acilis(hit: RadarHit): string {
  const senaryo = senaryoSec(hit);
  const psi = psiNotu(hit);
  const googleTanigi =
    psi && hit.kusurlar?.[0]?.kod !== "yavas_google"
      ? ` Google'ın kendi ölçümü de sitenize 100 üzerinden ${psi} vermiş.`
      : "";
  return (
    `İyi günler, ${hit.name} mi?\n` +
    "Ben Muhammed — Google'ın işletme araçlarıyla bölgedeki siteleri " +
    "tarıyorum; sizinki raporda uyarı verdi.\n" +
    `${senaryo.gozlem(hit)}${googleTanigi}\n` +
    `Haberiniz var mıydı?`
  );
}

// ─────────────────────────────────────────────── fiyat & teslimat

export interface FiyatPlani {
  paket: string;
  min: number;
  max: number;
  bakimAylik: number;
  gunMin: number;
  gunMax: number;
  gerekce: string;
}

// Çok sayfalı/kurumsal görünüm beklenen sektörler — burada müşteri "ciddi"
// bir site bekler, iş yükü de fazladır (hizmet sayfaları, ekip, referans).
// Reklam Radarı da aynı listeyi kullanır: Meta'da reklam bütçesi olması
// muhtemel türler bunlar (bkz. lib/reklamRadari.ts).
export const KURUMSAL_TURLER = [
  "diş", "klinik", "estetik", "cerrah", "dermatolog", "psikolog",
  "avukat", "mimar", "iç mimari", "otel", "hastane", "poliklinik",
];

// İlk 5 iş "kâr için değil YORUM için" (offer.md §4) — bu modda alt banda inilir.
export const REFERANS_MODU_INDIRIMI = 0.55;

function kurumsalMi(hit: RadarHit): boolean {
  const tur = (hit.kind_tr || "").toLocaleLowerCase("tr");
  return KURUMSAL_TURLER.some((k) => tur.includes(k));
}

export function fiyatPlani(hit: RadarHit, referansModu = false): FiyatPlani {
  const kurumsal = kurumsalMi(hit);
  const temel: FiyatPlani = kurumsal
    ? {
        paket: "Kurumsal görünüm (çok bölümlü tek sayfa + hizmet detayları)",
        min: 25000,
        max: 40000,
        bakimAylik: 750,
        gunMin: 5,
        gunMax: 10,
        gerekce:
          "Bu sektörde müşteri kurumsal bir izlenim bekliyor: hizmet " +
          "açıklamaları, ekip/uzmanlık, randevu yönlendirmesi. TR pazarında " +
          "ajanslar bu işi 40.000–80.000 ₺ bandında veriyor; biz altındayız " +
          "ama 'ucuz iş' algısı yaratmayacak yerdeyiz.",
      }
    : {
        paket: "Vitrin sitesi (tek sayfa + QR menü/fiyat listesi dahil)",
        min: 12000,
        max: 20000,
        bakimAylik: 750,
        gunMin: 2,
        gunMax: 4,
        gerekce:
          "TR pazarında tek sayfa girişi 12.000–18.000 ₺, küçük işletme " +
          "kurumsal sitesi 25.000–45.000 ₺. Bağdat Caddesi hattında bu bandın " +
          "altına inmek 'kalitesi nasıl' sorusunu doğurur.",
      };

  if (!referansModu) return temel;
  return {
    ...temel,
    paket: `${temel.paket} — referans/yorum fiyatı`,
    min: Math.round((temel.min * REFERANS_MODU_INDIRIMI) / 500) * 500,
    max: Math.round((temel.max * REFERANS_MODU_INDIRIMI) / 500) * 500,
    gerekce:
      "İlk işlerde amaç kâr değil YORUM (offer.md §4). Fiyatı düşürürken " +
      "kapsamı da küçült — 'ucuz fiyat değil, ucuz kapsam sat'. Karşılığında " +
      "Google yorumu + isim kullanma izni iste.",
  };
}

/** Site yok/ölü mü, yoksa mevcut site yenileniyor mu — teklifin çerçevesi. */
export function isinCercevesi(hit: RadarHit): "sifirdan" | "yenileme" {
  const kod = hit.kusurlar?.[0]?.kod;
  return kod === "olu_domain" || kod === "kendi_sitesi_yok" || kod === "sayfa_hatasi"
    ? "sifirdan"
    : "yenileme";
}

// ─────────────────────────────────────────────── checklist'ler

/** Anlaşınca müşteriden istenecekler (WhatsApp'tan tek mesaj olarak atılır). */
export function musteridenIstenecekler(hit: RadarHit): string[] {
  const yemek = /restoran|kafe|kahve|fırın|pastane|tatlı|bar|balık|kebap|pizza|mutfak/i.test(
    hit.kind_tr || "",
  );
  return [
    "İşletme adının doğru yazımı + varsa logo (yoksa yazıyla hallederiz)",
    "2-3 cümlelik tanıtım: ne yapıyorsunuz, sizi farklı kılan ne",
    "Telefon + WhatsApp numarası + açık adres (harita linki yeterli)",
    "Çalışma saatleri (hafta içi / hafta sonu)",
    yemek
      ? "Menü: ürün adları + fiyatlar (fotoğrafı da olur, ben yazarım)"
      : "Hizmet listesi + fiyatlar (yaklaşık da olur)",
    "8-15 gerçek fotoğraf — telefonla çekilmiş olması yeter, stok fotoğraf gerekmiyor",
    "Varsa Instagram/Facebook adresleri",
    "Alan adı SİZİN adınıza, sizin kartınızla alınır (yıllık ~350-600 ₺, bana ödeme yok)",
  ];
}

/** "Gelin yapın" derse bizim adımlarımız — süreyle birlikte. */
export interface Adim {
  gun: string;
  baslik: string;
  detay: string;
}

export function bizimAdimlar(hit: RadarHit, referansModu = false): Adim[] {
  const plan = fiyatPlani(hit, referansModu);
  const cerceve = isinCercevesi(hit);
  return [
    {
      gun: "0. gün",
      baslik: "Kapora + kapsam yazılı",
      detay:
        "%50 kapora alınır (kaporasız iş = hobi). Kapsam WhatsApp mesajıyla " +
        "yazılı: şu bölümler, şu içerik, 1 tur revizyon.",
    },
    {
      gun: "0. gün",
      baslik: "Tasarım seçimi",
      detay:
        "5 hazır tasarım aynı anda gösterilir (Çoklu Yayınla), müşteri " +
        "beğendiğini seçer. Bu adım fiyatı değiştirmez.",
    },
    {
      gun: "1-3. gün",
      baslik: "İçerik toplama",
      detay:
        "Yukarıdaki liste müşteriden gelir. 3 gün içinde gelmezse süre " +
        "işlemez (offer.md kuralı) — bunu baştan söyle.",
    },
    {
      gun: `${plan.gunMin}. gün`,
      baslik:
        cerceve === "sifirdan"
          ? "Kurulum + alan adı"
          : "Kurulum + mevcut adrese geçiş",
      detay:
        cerceve === "sifirdan"
          ? "Alan adı müşteri adına alınır, site kurulur, DNS bağlanır " +
            "(Cloudflare). Hiçbir şifre bizde durmaz."
          : "Yeni site kurulur, mevcut alan adı yeni sunucuya yönlendirilir. " +
            "Eski siteye DOKUNULMAZ, yayına geçene kadar ayakta kalır.",
    },
    {
      gun: `${plan.gunMin}. gün`,
      baslik: "QR menü + Google İşletme Profili",
      detay:
        "QR menü/fiyat listesi site paketine dahil. Google İşletme Profili " +
        "kaydı kontrol edilir, site linki oraya eklenir.",
    },
    {
      gun: `${plan.gunMax}. gün`,
      baslik: "Teslim + revizyon",
      detay:
        "Kalan %50 tahsil edilir. 1 tur revizyon ücretsiz, sonrası 500 ₺/saat. " +
        "Kaynak kod müşterinin; aylık zorunlu abonelik yok.",
    },
    {
      gun: "Sonrası",
      baslik: `Bakım (opsiyonel, ${plan.bakimAylik} ₺/ay)`,
      detay:
        "Alan adı/SSL yenileme takibi, ayda 2 içerik değişikliği, Google " +
        "profil bakımı, arıza müdahalesi. Her satışta öner — tekrarlayan gelir.",
    },
  ];
}

// ─────────────────────────────────────────────── e-posta

/** Adresi bilinmiyorsa önerilecek kurumsal kalıp — TAHMİN, onay ister. */
export function tahminiEposta(hit: RadarHit): string {
  return hit.domain ? `info@${hit.domain}` : "";
}

export interface EpostaTaslagi {
  konu: string;
  govde: string;
}

/**
 * Telefonda "mail atın" diyene gönderilecek taslak.
 *
 * Neden bu biçim: esnaf uzun pazarlama maili okumaz. Yapı —
 *  1) telefonda konuştuk hatırlatması (soğuk mail değil, izinli)
 *  2) ÖLÇÜLEN kusur + kanıt + kendisinin doğrulayabileceği adım
 *  3) çözüm + süre + fiyat aralığı (kaçamak yok)
 *  4) tek net soru
 * Dürüstlük: "sıfırdan size özel yaptım" yok; demo geçici; sisteme girilmedi.
 */
export function epostaTaslagi(
  hit: RadarHit,
  demoLinki: string,
  referansModu = false,
  telefondaKonusuldu = true,
): EpostaTaslagi {
  const plan = fiyatPlani(hit, referansModu);
  const kusurlar = (hit.kusurlar ?? []).filter((k) => k.siddet >= 5).slice(0, 4);
  const tl = (n: number) => n.toLocaleString("tr-TR");

  const konu = kusurlar[0]
    ? `${hit.name} – web sitenizde tespit ettiğim konu (${kusurlar[0].baslik.split("—")[0].trim()})`
    : `${hit.name} – web siteniz hakkında`;

  const satirlar: string[] = [
    "Merhaba,",
    "",
    telefondaKonusuldu
      ? `Az önce telefonda görüştük, ${hit.name} için yazıyorum.`
      : `${hit.name} için yazıyorum.`,
    "",
    "Sitenize dışarıdan, herkesin görebildiği bilgilerle baktım. Bulduklarım:",
    "",
  ];

  kusurlar.forEach((k, i) => {
    satirlar.push(`${i + 1}) ${k.baslik}`);
    satirlar.push(`   Ölçüm: ${k.kanit}`);
    if (k.dogrula) {
      // Doğrulama notundaki "bize" uyarılarını müşteriye göndermiyoruz.
      const temiz = k.dogrula.split("NOT:")[0].trim();
      if (temiz) satirlar.push(`   Kendiniz görmek için: ${temiz}`);
    }
    satirlar.push("");
  });

  if (demoLinki) {
    satirlar.push(
      "Nasıl görünebileceğini göstermek için hazır şablonumdan bir örnek sayfa hazırladım",
      "(konsept — yazılar ve görseller temsilîdir, birebir son hâli değil):",
      demoLinki,
      "",
      "İlgilenmezseniz bu geçici linki kaldırıyorum.",
      "",
    );
  }

  satirlar.push(
    `Bu işi ${plan.paket.toLocaleLowerCase("tr")} kapsamında ${tl(plan.min)}–${tl(plan.max)} ₺ ` +
      `arasında, içerikler geldikten sonra ${plan.gunMin}-${plan.gunMax} günde teslim ediyorum. ` +
      `Aylık ${tl(plan.bakimAylik)} ₺ bakım isteğe bağlı — kaynak kod sizin olur, zorunlu abonelik yok.`,
    "",
    "Alan adı sizin adınıza, sizin kartınızla alınır; hiçbir şifreniz bende durmaz.",
    "",
    "Uygun olursa kısa bir görüşmeyle detayları netleştirelim mi?",
    "",
    "Not: Sitenize veya sunucunuza hiçbir şekilde giriş yapmadım; yukarıdaki",
    "tespitlerin tamamı dışarıdan, herkesin erişebildiği bilgilerden.",
    "",
    "İyi çalışmalar,",
    "Ad Soyad",
  );

  return { konu, govde: satirlar.join("\n") };
}

/**
 * WhatsApp TAM RAPORU — telefonda görüşülen müşteriye tek mesaj.
 *
 * Biçim kullanıcının kendi düzenlemesinden alındı (3 Ağu, Kebap Hocası
 * örneği): kısa giriş + sayı + "hepsi düzelir" → ÖLÇÜMLER (teknik liste,
 * kanıt + "kendiniz görün") → "Dahası var" esnaf-dili vurgu cümleleri →
 * (fiyatlıysa fiyat bloğu) → "Baştan mı yapalım, olanı mı onaralım?" →
 * dürüstlük notu → imza. Fiyatlı/fiyatsız iki varyant.
 */
export function whatsappRaporu(
  hit: RadarHit,
  referansModu = false,
  fiyatli = true,
): string {
  const kusurlar = hit.kusurlar ?? [];
  if (!kusurlar.length) return "";
  const plan = fiyatPlani(hit, referansModu);
  const tl = (n: number) => n.toLocaleString("tr-TR");

  const satirlar: string[] = [
    `Az önce telefonda görüştük — ${hit.name} için yazıyorum.`,
    `Toplamda ${sayiMetni(hit)} bulgu ölçtüm — hepsi aşağıda, kanıtları ve ` +
      "kendiniz doğrulayabileceğiniz adımlarıyla.",
    "İyi haber şu: hepsi düzelir.",
    "— ÖLÇÜMLER (dışarıdan, herkesin görebildiği bilgiler) —",
  ];
  kusurlar.forEach((k, i) => {
    satirlar.push(`${i + 1}) ${k.baslik}`);
    satirlar.push(`   Ölçüm: ${k.kanit}`);
    if (k.dogrula) {
      // Doğrulama notundaki "bize" uyarıları müşteriye gitmez.
      const temiz = k.dogrula.split("NOT:")[0].trim();
      if (temiz) satirlar.push(`   Kendiniz görün: ${temiz}`);
    }
  });

  const vurgular = raporVurgulari(hit);
  if (vurgular.length) {
    satirlar.push("Dahası var — az önce söylediğim tek sorun değil.");
    satirlar.push(...vurgular);
  }

  if (fiyatli) {
    satirlar.push(
      "",
      "— FİYAT & SÜRE —",
      `${plan.paket}: ${tl(plan.min)}–${tl(plan.max)} ₺ · içerikler geldikten ` +
        `sonra ${plan.gunMin}-${plan.gunMax} günde teslim. Kapsam netleşince ` +
        "tam rakamı söylerim, sürpriz çıkmaz.",
      `Aylık ${tl(plan.bakimAylik)} ₺ bakım isteğe bağlı — kaynak kod sizin ` +
        "olur, zorunlu abonelik yok.",
    );
  }

  satirlar.push(
    "",
    "Baştan mı yapalım, olanı mı onaralım?",
    "",
    "Not: Sitenize veya sunucunuza hiçbir şekilde giriş yapmadım; yukarıdaki " +
      "tespitlerin tamamı dışarıdan erişilebilen bilgiler.",
    "",
    "İyi çalışmalar,",
    "Muhammed",
  );
  return satirlar.join("\n");
}

/** Müşteriye WhatsApp'tan gidecek "bize şunlar lazım" mesajı. */
export function hazirlikMesaji(hit: RadarHit): string {
  return (
    `Merhaba, ${hit.name} için başlıyoruz. Bana şunları göndermeniz yeterli:\n\n` +
    musteridenIstenecekler(hit)
      .map((m, i) => `${i + 1}. ${m}`)
      .join("\n") +
    `\n\nEksik olanları birlikte tamamlarız, hepsi bir anda gelmek zorunda değil.`
  );
}
