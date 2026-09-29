// SEKTÖR DERİSİ
//
// 20 hedefin 14'ü aslında AYNI üründür: müşteri kaydı + randevu takvimi +
// bekleme listesi + hatırlatma kuralları. Değişen tek şey kelimeler ve hangi
// kuralın varsayılan açık olduğu. Pilatesçide "ders", psikologda "seans",
// veterinerde "aşı", güzellik salonunda "paket seansı" deniyor.
//
// Bu yüzden motor TEK, deri ince: yeni sektör eklemek buraya bir kayıt yazmak.
// Hiçbir metin çalışma anında üretilmiyor — hepsi burada elle yazılı.

export interface MesajBaglami {
  uye: string;
  seans: string;
  saat: string;
  gun: string;
  egitmen: string;
  kalan?: number;
  gecenGun?: number;
  /** Deneme takibinde kaçıncı gün mesajı (1 / 3 / 7). `gun` gün ADIdır. */
  gunNo?: number;
  /** Üyelik bitişine kalan gün. Eksi ise süre DOLMUŞ. */
  kalanGun?: number;
  /** Üyelik bitiş tarihi, okunur hâlde: "24 Eylül Perşembe". */
  bitisTarihi?: string;
  /** Açık hesapta kalan tutar, ₺. */
  kalanTutar?: number;
  /** İşletmenin kendi ödeme linki — boşsa mesaja hiç girmez. */
  odemeLinki?: string;
}

export interface Deri {
  kod: string;
  sektor: string;
  urunAdi: string;
  /** Tekil/çoğul isimler — ekrandaki her başlık bunlardan kuruluyor. */
  seans: string;
  seanslar: string;
  uye: string;
  uyeler: string;
  /**
   * "Üyenin gördüğü ekran" — eki koda yazdırmak Türkçede işlemiyor:
   * "üye" + "ın" = "üyeın". Sesliyle biten kelimede kaynaştırma harfi
   * gerekiyor, bu yüzden iyelik hâli elle yazılıyor.
   */
  uyeIyelik: string;
  egitmen: string;
  paket: string;
  /** Kaç gün gelmeyen "eriyor" sayılır (üye erime alarmı). */
  erimeGun: number;
  /** Tohum takvimindeki seans adları ve uzman adları — sektöre göre değişir. */
  seansTurleri: string[];
  uzmanlar: string[];
  /** Kapasite: pilateste 8 reformer, psikologda tek uzman = 1 kişi. */
  kapasite: number;
  /**
   * Üst şeritteki sekme adı.
   *
   * "Üye ekranı" psikolog müşterisi için yanlış terim ve arayüzün en çok
   * bakılan öğesinde sayfa içi dilin ("danışanınızın gördüğü ekran") aksini
   * söylüyordu — deri sisteminin sızdığını ele veren tek cümle buydu.
   */
  uyeEkraniAdi: string;
  /** Hatırlatma kaç saat önce gider. */
  hatirlatmaSaat: number;
  /**
   * DERİNİN TEK GÖRSEL DEĞİŞKENİ.
   *
   * Ölçek, yüzey, gölge, hareket, ızgara derilere göre çatallanmaz; yalnız
   * vurgu rengi değişir. Bu yüzden renk CSS'te `[data-deri=...]` bloğuyla
   * değil burada duruyor: üçüncü bir deri eklenince tek kayıt yazılır,
   * renk iki ayrı yerden yönetilmek zorunda kalmaz.
   *
   * KABUL ÖLÇÜTÜ: vurgu ile `--color-ink` (#14161A) arasındaki açıklık farkı
   * en az 25 ΔL* olacak. Altına inince gri tonlamada ink dolgulu düğme ile
   * vurgulu düğme aynı okunuyor ve deri farkı ortadan kalkıyor.
   */
  vurgu: { ana: string; koyu: string; tint: string };
  mesaj: {
    hatirlatma: (b: MesajBaglami) => string;
    bosalanYer: (b: MesajBaglami) => string;
    erime: (b: MesajBaglami) => string;
    paketBitiyor: (b: MesajBaglami) => string;
    deneme: (b: MesajBaglami) => string;
    /**
     * Üyelik süresi bitiyor / bitti.
     *
     * `paketBitiyor`dan AYRI bir metin: o "ders hakkın azaldı" der, bu
     * "takvimde süren doluyor" der. İkisi aynı cümleyle geçiştirilirse
     * ders paketiyle süreli üyeliği ayırt etmeyen bir sistem gibi görünür —
     * oysa satılan şey tam olarak bu ayrımı tutmak.
     */
    uyelikBitiyor: (b: MesajBaglami) => string;
    /**
     * Açık hesap — BORÇ DİLİ YOK (komite şartnamesi §4, kapatma maddesi 3).
     *
     * Sahibin asıl engeli "bilmiyorum" değil "isteyemiyorum": müşteri kaçmasın
     * diye istemiyor. Metin bu yüzden parayı bir sonraki GELİŞE bağlar
     * ("dersinizde alabiliriz"), acele koymaz ve yüz kurtaran bir kapı
     * bırakır ("kaydımızda yanlışlık varsa söyleyin") — kayıt hatalıysa
     * karşı taraf savunmaya geçmeden düzeltebilir.
     */
    acikHesap: (b: MesajBaglami) => string;
  };
}

/** "12.000" — deri.ts fiyat.ts'i içe aktaramaz (döngü), biçim burada. */
const tutarYaz = (n?: number) => (n ?? 0).toLocaleString("tr-TR");

export const DERILER: Record<string, Deri> = {
  pilates: {
    kod: "pilates",
    sektor: "Pilates stüdyosu / spor salonu",
    urunAdi: "Ders rezervasyonu + bekleme listesi",
    seans: "ders",
    seanslar: "dersler",
    uye: "üye",
    uyeler: "üyeler",
    uyeIyelik: "üyenizin",
    egitmen: "eğitmen",
    paket: "paket hakkı",
    erimeGun: 21,
    hatirlatmaSaat: 24,
    seansTurleri: ["Reformer", "Mat Pilates", "Reformer", "Reformer"],
    uzmanlar: ["Selda", "Kübra", "Selda", "Kübra"],
    kapasite: 8,
    uyeEkraniAdi: "Üye ekranı",
    // Kiremit: kâğıtta 5.2:1, beyaz metinle dolgu üstünde AA üstü.
    vurgu: { ana: "#a8472a", koyu: "#86351d", tint: "#f6e9e3" },
    mesaj: {
      hatirlatma: (b) =>
        `Merhaba ${b.uye}, ${b.gun} ${b.saat} ${b.seans} dersiniz var (${b.egitmen}). ` +
        `Gelemeyecekseniz buradan yazın, yeriniz bekleyen birine açılsın.`,
      bosalanYer: (b) =>
        `Merhaba ${b.uye}, ${b.gun} ${b.saat} dersinde yer açıldı — bekleme listesinde ilk sıradaydınız. ` +
        `Yeriniz ayrıldı, gelemeyecekseniz haber verin yeter.`,
      erime: (b) =>
        `Merhaba ${b.uye}, ${b.gecenGun} gündür göremedik, iyi misiniz? ` +
        `${b.kalan} ders hakkınız duruyor — bu hafta uygun bir saat ayarlayalım mı?`,
      paketBitiyor: (b) =>
        `Merhaba ${b.uye}, paketinizde ${b.kalan} ders kaldı. ` +
        `Devam etmek isterseniz yeni paketi şimdiden açabiliriz, saatleriniz kaymasın.` +
        (b.odemeLinki ? ` Yenilemek isterseniz: ${b.odemeLinki}` : ""),
      // Deneme dersinden sonra üç dokunuş. Israr yok: 7. günde konu kapanıyor.
      deneme: (b) =>
        b.gunNo === 1
          ? `Merhaba ${b.uye}, dün deneme dersimize katıldınız — nasıl geçti, ` +
            `bir yeriniz ağrıdı mı? Sorunuz olursa buradan yazabilirsiniz.`
          : b.gunNo === 3
            ? `Merhaba ${b.uye}, derse devam etmek isterseniz bu hafta ` +
              `${b.egitmen || "eğitmenimizle"} uygun saatlerimiz var. Hangi saatler size uyar?`
            : `Merhaba ${b.uye}, rahatsız etmeyeyim — sadece kapıyı açık bırakmak ` +
              `istedim. İlerde denemek isterseniz yeriniz hazır, iyi günler.`,
      uyelikBitiyor: (b) =>
        (b.kalanGun ?? 0) < 0
          ? `Merhaba ${b.uye}, üyeliğiniz ${b.bitisTarihi} tarihinde doldu. ` +
            `Devam etmek isterseniz yenileyelim, ders saatleriniz duruyor.` +
            (b.odemeLinki ? ` Yenileme için: ${b.odemeLinki}` : "")
          : `Merhaba ${b.uye}, üyeliğiniz ${b.bitisTarihi} tarihinde bitiyor — ` +
            `${b.kalanGun} gün kaldı. Devam edecekseniz şimdiden yenileyelim, ` +
            `saatleriniz başkasına gitmesin.` +
            (b.odemeLinki ? ` Yenileme için: ${b.odemeLinki}` : ""),
      acikHesap: (b) =>
        `Merhaba ${b.uye}, ` +
        (b.gun && b.saat
          ? `${b.gun} ${b.saat} dersinizde `
          : "bir sonraki gelişinizde ") +
        `kalan ${tutarYaz(b.kalanTutar)} ₺'yi alabiliriz, acelesi yok. ` +
        `Kaydımızda bir yanlışlık varsa lütfen söyleyin, hemen düzeltelim.`,
    },
  },

  psikolog: {
    kod: "psikolog",
    sektor: "Psikolojik danışmanlık",
    urunAdi: "Seans takibi ve danışan hattı",
    seans: "seans",
    seanslar: "seanslar",
    uye: "danışan",
    uyeler: "danışanlar",
    uyeIyelik: "danışanınızın",
    egitmen: "uzman",
    paket: "seans paketi",
    erimeGun: 30,
    hatirlatmaSaat: 48,
    seansTurleri: ["Bireysel seans", "Bireysel seans", "Çift seansı", "Bireysel seans"],
    uzmanlar: ["Uzm. Psk. Elif", "Uzm. Psk. Elif", "Uzm. Psk. Deniz", "Uzm. Psk. Deniz"],
    // Psikologda saat bire birdir: bir saatte bir danışan.
    kapasite: 1,
    uyeEkraniAdi: "Danışan ekranı",
    // #17627F denendi ve geri alındı: doygun camgöbeği-mavi jenerik yapay
    // zekâ paneli rengidir — "vibe coding" şikâyetinin renk tarafındaki tam
    // karşılığı, üstelik yönün yasak listesindeki cyan/sky ailesinin ortası.
    // #1F4E6B mürekkep mavisi: kâğıtta 7.9:1, beyaz metinle dolgu üstünde
    // AA üstü, gri tonlamada mürekkepten ayrışacak kadar açık.
    vurgu: { ana: "#1f4e6b", koyu: "#163a50", tint: "#e4edf3" },
    mesaj: {
      hatirlatma: (b) =>
        `Merhaba ${b.uye}, ${b.gun} ${b.saat} seansınız var (${b.egitmen}). ` +
        `Gelemeyecekseniz 24 saat öncesine kadar buradan yazmanız yeterli.`,
      bosalanYer: (b) =>
        `Merhaba ${b.uye}, ${b.gun} ${b.saat} saati boşaldı. ` +
        `Beklediğiniz için önce size soruyorum — uygun mudur?`,
      erime: (b) =>
        `Merhaba ${b.uye}, ${b.gecenGun} gündür görüşemedik. ` +
        `Devam etmek isterseniz bu hafta uygun saatlerim var, yazmanız yeterli.`,
      paketBitiyor: (b) =>
        `Merhaba ${b.uye}, paketinizde ${b.kalan} seans kaldı. ` +
        `Devam kararınızı birlikte konuşalım, saatiniz başkasına verilmesin.` +
        (b.odemeLinki ? ` Yenileme için: ${b.odemeLinki}` : ""),
      deneme: (b) =>
        b.gunNo === 1
          ? `Merhaba ${b.uye}, dünkü ilk görüşmemiz için teşekkür ederim. ` +
            `Aklınıza takılan bir şey olursa buradan yazabilirsiniz.`
          : b.gunNo === 3
            ? `Merhaba ${b.uye}, devam etmek isterseniz bu hafta uygun saatlerim var. ` +
              `Hangi saatler size uyar?`
            : `Merhaba ${b.uye}, üstelemeyeyim — sadece kapıyı açık bırakmak istedim. ` +
              `İhtiyaç duyarsanız yazmanız yeterli, iyi günler.`,
      uyelikBitiyor: (b) =>
        (b.kalanGun ?? 0) < 0
          ? `Merhaba ${b.uye}, paketinizin süresi ${b.bitisTarihi} tarihinde doldu. ` +
            `Devam etmek isterseniz yeni paketi açalım, saatiniz duruyor.` +
            (b.odemeLinki ? ` Yenileme için: ${b.odemeLinki}` : "")
          : `Merhaba ${b.uye}, paketinizin süresi ${b.bitisTarihi} tarihinde doluyor — ` +
            `${b.kalanGun} gün kaldı. Devam kararınızı birlikte konuşalım.` +
            (b.odemeLinki ? ` Yenileme için: ${b.odemeLinki}` : ""),
      acikHesap: (b) =>
        `Merhaba ${b.uye}, ` +
        (b.gun && b.saat
          ? `${b.gun} ${b.saat} seansınızda `
          : "bir sonraki seansınızda ") +
        `kalan ${tutarYaz(b.kalanTutar)} ₺'yi alabiliriz. ` +
        `Kaydımızda bir yanlışlık varsa lütfen söyleyin, hemen düzeltelim.`,
    },
  },
};

export const VARSAYILAN_DERI = "pilates";

/**
 * Vurgu değişkenleri — BELGE KÖKÜNE basılır, sayfa sarmalayıcılarına değil.
 *
 * Eskiden her ekran bunu kendi kök `div`ine, üst şerit de kendi `header`ına
 * yazıyordu. `body` ise hiç almıyordu; oysa `::selection` ve `:focus-visible`
 * kuralları kök seviyede tanımlı. Sonuç: psikolog derisinde mavi arayüzün
 * ortasında KİREMİT odak halkası ve kiremit metin seçimi. Tek değişken
 * kuralı ancak tek YERDEN yazılınca tutuyor.
 */
export function vurguDegiskenleri(deri: Deri): Record<string, string> {
  return {
    "--color-vurgu": deri.vurgu.ana,
    "--color-vurgu-koyu": deri.vurgu.koyu,
    "--color-vurgu-tint": deri.vurgu.tint,
  };
}

export function deriAl(kod?: string | null): Deri {
  return DERILER[kod ?? ""] ?? DERILER[VARSAYILAN_DERI];
}

/** wa.me tıkla-konuş linki: OTOMATİK GÖNDERİM DEĞİL — gönder tuşuna insan basar. */
export function whatsappLinki(telefon: string, metin: string): string {
  const sade = telefon.replace(/[^0-9]/g, "").replace(/^0/, "");
  const numara = sade.startsWith("90") ? sade : `90${sade}`;
  return `https://wa.me/${numara}?text=${encodeURIComponent(metin)}`;
}
