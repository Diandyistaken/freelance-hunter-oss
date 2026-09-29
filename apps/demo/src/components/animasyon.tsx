"use client";

import { animate, motion, type Transition, type Variants } from "framer-motion";
import { useEffect, useState } from "react";

// ORTAK ANİMASYON PARÇALARI
//
// Animasyon süs değil, anlatım aracı: sayı sayarak artınca göz rakamı takip
// eder, çubuk dolarken oran hissedilir, boşalan yer dolduğunda hareket
// "bak, kendiliğinden oldu" der.
//
// TETİKLEME KARARI — önce hepsi `useInView` / `whileInView` ile görünürlüğe
// bağlıydı. Tarayıcı görünür alanı ölçemediğinde (gömülü panel, bazı tablet
// tarayıcıları) animasyon HİÇ başlamıyor ve ekranda rakamlar 0, çubuklar boş
// kalıyordu. Demoda "Yapılan ders: 0" yazması ürünü ilk saniyede çürütür.
// Bu yüzden hepsi bağlandıktan sonra başlar: görünürlük ölçümüne güvenmiyoruz.
//
// PERFORMANS KURALI: yalnız transform + opacity. Genişlik/yükseklik animasyonu
// her karede yerleşimi yeniden hesaplatıyordu; Özet'te onlarca çubuk aynı anda
// canlandığı için tablette takılma riski somuttu. Hepsi scaleX/scaleY'ye geçti,
// görsel sonuç birebir aynı.
//
// OKUNAKLILIK KURALI (bu dosyanın en önemli maddesi): GİRİŞ HAREKETİ OPAKLIK
// KULLANMAZ. Metin ve rakam ilk kareden itibaren %100 opak gelir, hareket eden
// tek şey konumdur (12px yükselme, 16px yan kayma).
//
// Sebebi ölçüldü: tarayıcı sayfayı görünmez saydığında (gömülü panel, arka
// plan sekmesi, bazı tablet tarayıcıları) requestAnimationFrame ilerlemiyor.
// Opaklıkla gelen her şey 0'da KALIYOR ve ekran gerçekten bomboş görünüyor —
// beş ekranın beşinde birden. Konumla gelen bir öğe aynı durumda en kötü
// ihtimalle 12px aşağıda durur ve okunur. Animasyon anlatım taşır,
// OKUNAKLILIK taşımaz; ürünün görünmesi hiçbir koşulda animasyona bağlı
// olamaz. (Aynı gerekçe Sayac'ın `document.hidden` kısayolunda da yazılı.)

// ------------------------------------------------------------------ eğriler
//
// ÜÇ EASING, ÜÇ İŞ. Tek eğri her yerde kullanılınca hareket bilgi taşımıyor:
// giriş yumuşak ve sessiz, veri dolumu kararlı ("hesaplanıyor"), onay kısa ve
// keskin ("iş bitti").

/** Bölüm/kart/satır belirmesi. */
export const GIRIS: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

/** Çubuk/sütun/halka dolumu. */
export const VERI: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Durum değişimi: "Gönderildi", "geldi", koltuk dolması, sekme alt çizgisi. */
export const ONAY: Transition = { type: "spring", stiffness: 520, damping: 34 };

/**
 * SAHNE ZAMAN ÇİZELGESİ.
 *
 * Çağrı yerlerinde elle gecikme ayarlanınca her ekran kendi ritmini uyduruyor
 * ve hareket anlatıyı takip etmiyordu. Burada tek çizelge var: önce cetvel,
 * sonra başlık, sonra ana yüzey, en sonda rakamlar ve grafikler. Çağrı yerleri
 * adım ADINI verir, sayı vermez.
 */
export const SAHNE = {
  cetvel: 0,
  baslik: 0.08,
  yuzey: 0.18,
  rakam: 0.3,
  detay: 0.46,
} as const;

/**
 * SUNUM'UN SAYFA GEÇİŞİ — yalnız KAYMA, opaklık YOK.
 *
 * Slayt metni opaklıkla gelemez. Sekiz sayfalık, elle çevrilen bir akışta
 * her çevirmede 0,3-1 saniye boyunca boş kâğıt görünüyor; bu "ferahlık"
 * değil "yükleniyor mu?" olarak okunuyor. Daha kötüsü: tarayıcı sayfayı
 * görünmez sayarsa (gömülü panel, arka plan sekmesi) rAF hiç ilerlemiyor ve
 * metin opaklık 0'da KALIYOR — yani ekran gerçekten bomboş.
 *
 * Bu yüzden Sunum'da metin İLK KAREDEN itibaren %100 opak; hareket eden tek
 * şey cetvel (scaleX) ve başlık (16px yatay kayma). Kayma yarım kalırsa
 * okunaklılık bozulmaz, en kötü ihtimalle başlık 16px sağda durur.
 */
export const kayYan = (gecikme: number = 0) => ({
  initial: { x: 16 },
  animate: { x: 0 },
  transition: { duration: 0.26, delay: gecikme, ease: GIRIS },
});

/** Yükselerek gelen öğe — tek yerden süre/eğri. Opaklık YOK (bkz. yukarı). */
export const belir = (gecikme: number = 0) => ({
  initial: { y: 12 },
  animate: { y: 0 },
  transition: { duration: 0.38, delay: gecikme, ease: GIRIS },
});

// ------------------------------------------------------------------ cetvel

/**
 * 2px mürekkep cetveli — "bölüm buradan başlıyor" demenin en ucuz yolu.
 * Kendini soldan sağa çizer: bölümün başladığını hareket söyler.
 *
 * İKİ MEŞRU VARYANT, ÜÇÜNCÜSÜ YOK. Cetvel bu tasarımın imzası; aynı işaret
 * bir ekranda 700px, başkasında 28px olunca iki farklı şey gibi okunuyor ve
 * "beş ekran aynı dili konuşuyor mu" sorusunun karşı örneği oluyordu.
 *  · varsayılan — TAM KOLON GENİŞLİĞİ. Sayfa ve bölüm başlıklarının üstünde
 *    daima bu kullanılır.
 *  · `dar` — 64px çentik. Yalnız bir kartın İÇİNDEKİ alt başlıkta.
 */
export function Cetvel({ gecikme = SAHNE.cetvel, dar = false, vurgu = false }: {
  gecikme?: number; dar?: boolean;
  /** Kiremit cetvel: "kiremit, sayfanın ANA yüzeyinin üst cetvelindedir"
      kuralının tek uygulama noktası. Renk sınıfla değil style ile geçiliyor:
      `.cetvel` kendi arka planını bileşen katmanında yazıyor ve bir utility
      sınıfı onu ezmiyor (fiyat slaytındaki amiral kartta da aynı kalıp). */
  vurgu?: boolean;
}) {
  return (
    <motion.span
      style={vurgu ? { background: "var(--color-vurgu)" } : undefined}
      // Varsayılanda genişlik sınıfı YAZILMAZ: `.cetvel` zaten `display:block`,
      // yani kolonu kendiliğinden dolduruyor. `w-full` yazılsaydı utilities
      // katmanı kazanır ve doruk rakamın taşmasını kuran
      // `.doruk + .cetvel { width: calc(100% + 5px) }` kuralını ezerdi.
      className={`cetvel ${dar ? "w-16" : ""}`}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.5, delay: gecikme, ease: GIRIS }}
    />
  );
}

// ------------------------------------------------------------------- rakam

/**
 * 0'dan hedefe sayan rakam.
 *
 * Değeri React state'inde tutuyoruz. Önce MotionValue doğrudan çocuk olarak
 * veriliyordu (`<motion.span>{motionValue}</motion.span>`); bu kurulumda
 * güncellemeler DOM'a yansımadı ve ekranda HER SAYAÇ 0 kaldı — demoda
 * "Yapılan ders: 0" yazması ürünü ilk saniyede çürütürdü. Birkaç sayaç için
 * state maliyeti önemsiz, doğruluk her şeyden önemli.
 *
 * FİYATTA KULLANILMAZ: fiyatın güveni kesinlikten gelir, sayarken okunan ara
 * rakam ("14.795 ₺") o güveni bozar. Sayaç yalnız Özet'in istatistiklerinde.
 */
export function Sayac({
  deger, sure = 1.1, ondalik = 0, son = "", bas = "",
}: { deger: number; sure?: number; ondalik?: number; son?: string; bas?: string }) {
  const [su, setSu] = useState(0);

  useEffect(() => {
    // Sayfa görünmezken (arka plan sekmesi, gömülü panel) tarayıcı
    // requestAnimationFrame'i durdurur; animasyon hiç başlamaz ve ekranda 0
    // kalır. Böyle bir durumda animasyonu atlayıp doğru rakamı yazıyoruz —
    // kimse hareketi görmüyor zaten, ama rakam yanlış görünemez.
    if (typeof document !== "undefined" && document.hidden) {
      setSu(deger);
      return;
    }
    const kontrol = animate(0, deger, {
      duration: sure,
      ease: VERI,
      onUpdate: setSu,
      // Animasyon herhangi bir sebeple kesilirse ekranda yarım rakam kalmasın.
      onComplete: () => setSu(deger),
    });
    return () => kontrol.stop();
  }, [deger, sure]);

  const yazi = su.toLocaleString("tr-TR", {
    minimumFractionDigits: ondalik, maximumFractionDigits: ondalik,
  });
  // tnum: sayarken 1 ile 8 aynı genişlikte, rakam zıplamıyor.
  //
  // ÖNEK/SONEK DÜZ METİN DEĞİL `.para`: "%" düz string basılınca doruk
  // rakamla AYNI ağırlıkta (76px/700/ink) geliyordu ve göz "%58"de üç glifli
  // tek blok görüyordu — sayfanın doruk rakamı kendi işaretiyle yarışıyordu.
  // Üstelik aynı üründe "45.000 ₺"de işaret bilinçli olarak geri çekilmişti:
  // kural vardı, tutarlı uygulanmıyordu. `.para` ölçüsü `em` tabanlı olduğu
  // için hem 76px dorukta hem 44px halkada hem 13px sütun etiketinde doğru
  // oranda küçülüyor.
  return (
    <span className="tnum">
      {bas ? <span className="para">{bas}</span> : null}
      {yazi}
      {son ? <span className="para">{son}</span> : null}
    </span>
  );
}

// ------------------------------------------------------------------ grafik
//
// GRAFİK DOLUMU KARE DÖNGÜSÜNE DEĞİL SAATE BAĞLI.
//
// Çubuk, sütun ve halka önceden framer-motion ile doluyordu; framer kendi
// döngüsünü requestAnimationFrame üstünde çeviriyor. Tarayıcı sayfayı görünmez
// saydığında rAF ilerlemiyor ve dolgu scaleX(0)'da KALIYOR: ekranda iz
// görünüyor, veri görünmüyor. "Doluluk %0" yazan bir özet ekranı ürünü ilk
// saniyede çürütür ve bu tam olarak Sayac'ın `document.hidden` kısayoluyla
// önlediği hata.
//
// CSS geçişi zamana bağlıdır: sayfa boyanmasa bile süre işler ve görünür
// olduğunda dolgu yerindedir. Maliyeti de daha düşük — transform geçişi
// derleyici katmanında, JS'te kare başına hesap yok.

/** Bağlandıktan bir kare sonra "dolu" olur; CSS geçişini bu tetikler. */
function useDolum(gecikme: number): boolean {
  const [dolu, setDolu] = useState(false);
  useEffect(() => {
    // setTimeout arka plan sekmesinde kısılır ama DURMAZ; rAF durur.
    const id = setTimeout(() => setDolu(true), Math.max(16, gecikme * 1000));
    return () => clearTimeout(id);
  }, [gecikme]);
  return dolu;
}

/** Veri dolumunun ortak geçişi — VERI eğrisinin CSS karşılığı. */
const VERI_GECIS = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * Soldan dolan oran çubuğu.
 *
 * Arkasındaki iz HER ZAMAN görünür: %100'ün nerede olduğu bilinmeden %58
 * "çok mu az mı" okunamıyor. Köşe yarıçapı sıfır — veri alanı yuvarlanmaz.
 */
export function Cubuk({
  oran, renk = "bg-veri-sonuk", gecikme = 0, yukseklik = 20,
}: { oran: number; renk?: string; gecikme?: number; yukseklik?: number }) {
  const dolu = useDolum(gecikme);
  return (
    <div className="relative w-full bg-veri-iz" style={{ height: yukseklik }}>
      <div
        className={`absolute inset-0 origin-left ${renk}`}
        style={{
          transform: `scaleX(${dolu ? Math.max(0.004, oran) : 0})`,
          transition: `transform 720ms ${VERI_GECIS}`,
        }}
      />
    </div>
  );
}

/**
 * Aşağıdan yükselen sütun (saat/gün grafiklerinde).
 *
 * ETİKET SÜTUNUN İÇİNDE: daha önce izin TEPESİNDE duruyordu ve %50'lik bir
 * sütunda etiket ile dolgu arasında 130px soluk boşluk kalıyordu — göz yüzdeyi
 * üstteki boş bloğa ait sanıyordu. Artık etiket dolgunun tam üstünde, ama
 * ölçeklenen katmanın DIŞINDA: scaleY onu ezmiyor.
 *
 * `koyuDolgu` — ETİKET RENGİ DOLGUYA BAĞLI. Mürekkep renkli bir etiket,
 * mürekkep renkli bir bloğun 3px üstünde duruyordu (ölçüldü: etiket kutusunun
 * alt kenarı y=325, dolgunun üstü y=324): iki katman optik olarak kaynaşıyor
 * ve parlak camlı bir tablette rakam sütunun içinden oyulmuş gibi okunuyordu.
 * Aynı grafikte açık iz üstündeki etiketler net okunurken bu okunmuyordu —
 * yani tek grafikte iki farklı okunabilirlik sınıfı vardı. Artık etiket ya
 * açık izin üstünde mürekkep, ya koyu dolgunun İÇİNDE beyaz; ikisi de AA üstü
 * ve aynı optik mesafede duruyor.
 */
export function Sutun({
  oran, gecikme = 0, renk = "bg-veri-sonuk", enYuksek = 260, etiket,
  koyuDolgu = false, iz = "bg-veri-iz",
}: {
  oran: number; gecikme?: number; renk?: string; enYuksek?: number;
  etiket?: React.ReactNode; koyuDolgu?: boolean;
  /** İz tonu: varsayılan iz KÂĞIT/BEYAZ zemin içindir. Çukur zeminde
      (#e9e4d9) --veri-iz (#ece8e1) ile aralarında 1.02:1 kalıyor, yani iz
      fiilen görünmüyor ve sütun neyin içinde bittiğini söyleyemiyor; orada
      sistemin kendi grafik izi olan --cukur-koyu geçilir. */
  iz?: string;
}) {
  const dolu = useDolum(gecikme);
  const y = (dolu ? Math.max(0.012, oran) : 0) * 100;
  return (
    <div className="relative w-full" style={{ height: enYuksek }}>
      {/* %100 referans izi — çubuğun arkasında hep durur. */}
      <div className={`absolute inset-0 ${iz}`} />
      <div
        className={`absolute inset-0 origin-bottom ${renk}`}
        style={{
          transform: `scaleY(${dolu ? Math.max(0.012, oran) : 0})`,
          transition: `transform 720ms ${VERI_GECIS}`,
        }}
      />
      {etiket !== undefined && (
        // Etiket her zaman okunur; yalnız dolgunun tepesine BİRLİKTE kayar.
        // Koyu dolguda 26px aşağı iner ve beyaza döner: aynı yerde kalıp
        // rengini değiştirmek yetmezdi, mürekkep üstünde beyaz yazı ancak
        // dolgunun İÇİNDE anlam taşıyor.
        <span
          className={`absolute inset-x-0 block text-center text-etiket ${
            koyuDolgu ? "pt-b2 text-uzeri" : "pb-b2 text-ink"
          }`}
          style={{
            // ETİKET İZİN DIŞINA ÇIKMAZ. %100 dolu bir sütunda `bottom: 100%`
            // etiketi izin ÜSTÜNE atıyor ve kap (`overflow-x-auto`, yani
            // dikeyde de auto) onu kırpıyordu: psikolog derisinde /ozet'in
            // saat grafiğinde dört sütunun ikisi rakamsız kalıyordu —
            // "grafiğin yarısı yüklenmemiş" izlenimi. Tavana değince etiket
            // izin en üstünde, dolgunun içinde durur. Renk güvenli: %100'e
            // ulaşan sütun ya açık dolguludur (bg-veri-sonuk) ya da mürekkep,
            // mürekkepte zaten koyuDolgu dalı çalışıyor.
            bottom: koyuDolgu
              ? `calc(${y}% - 26px)`
              : `min(${y}%, calc(100% - 26px))`,
            transition: `bottom 720ms ${VERI_GECIS}`,
          }}
        >
          {etiket}
        </span>
      )}
    </div>
  );
}

/** Dairesel oran göstergesi — çizgi kendini çizerek tamamlar. */
export function Halka({
  oran, boyut = 220, kalinlik = 24, renk = "var(--color-vurgu)", etiket, altYazi,
}: {
  oran: number; boyut?: number; kalinlik?: number; renk?: string;
  // Düz metin DEĞİL düğüm: içindeki "%" işareti de `.para` ile geri
  // çekilebilsin (bkz. Sayac). Aksi hâlde halkanın ortasındaki "%20"de işaret
  // rakamla aynı 44px/700 ağırlıkta basılıyor.
  etiket: React.ReactNode; altYazi?: string;
}) {
  const r = (boyut - kalinlik) / 2;
  const cevre = 2 * Math.PI * r;
  const dolu = useDolum(0);
  return (
    <div className="relative grid place-items-center" style={{ width: boyut, height: boyut }}>
      <svg width={boyut} height={boyut} className="-rotate-90">
        <circle
          cx={boyut / 2} cy={boyut / 2} r={r}
          fill="none" stroke="var(--color-cukur-koyu)" strokeWidth={kalinlik}
        />
        <circle
          cx={boyut / 2} cy={boyut / 2} r={r}
          fill="none" stroke={renk} strokeWidth={kalinlik}
          strokeDasharray={cevre}
          strokeDashoffset={dolu ? cevre * (1 - oran) : cevre}
          style={{ transition: `stroke-dashoffset 1100ms ${VERI_GECIS}` }}
        />
      </svg>
      <div className="absolute grid place-items-center text-center">
        <span className="tnum text-sayfa">{etiket}</span>
        {altYazi && <span className="tnum text-etiket">{altYazi}</span>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- sıra

/**
 * Sırayla beliren liste.
 *
 * TAVAN: gecikme 8. öğede durur. Danışan ekranında 28 öğe vardı ve stagger
 * 0.06 ile son satır 5 saniyeden geç geliyordu — yüz yüze demoda bu anlatım
 * değil gecikmedir. İlk ekran ~0.3 saniyede tamamlanır, gerisi anında görünür.
 *
 * Çocuk `custom={i}` almazsa sıfırıncı öğe sayılır; hiçbir çağrı yeri kırılmaz.
 */
export const sira: { kap: Variants; oge: Variants } = {
  kap: {
    gizli: {},
    gorunur: { transition: { delayChildren: 0.04 } },
  },
  oge: {
    gizli: { y: 10 },
    gorunur: (i: number = 0) => ({
      y: 0,
      transition: { duration: 0.34, delay: Math.min(i, 8) * 0.035, ease: GIRIS },
    }),
  },
};

/** Sayfa girişinde yukarı süzülen bölüm. */
export function Belir({
  children, gecikme = 0, className = "",
}: { children: React.ReactNode; gecikme?: number; className?: string }) {
  return (
    <motion.div {...belir(gecikme)} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * İMZA HAREKET — bekleme listesinden yer dolduğunda olayın olduğu satırın
 * üzerinden soldan sağa geçen ışık.
 *
 * Ürünün tek satışlık cümlesi bu. Eskiden ekranın en üstünde bir kartta
 * beliriyordu; kullanıcı aşağı bakıyorsa hiç görmüyordu. Artık tam olarak
 * olayın olduğu yerde geçiyor. Yalnız transform + opacity: yerleşime dokunmaz.
 */
export function Supurme() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* inset-0 olduğu için yüzdelik x satırın KENDİ genişliğine göre
          hesaplanır: ışık satırın solundan girip sağından çıkar. */}
      <motion.span
        className="absolute inset-0 block"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--color-vurgu-tint) 45%," +
            " var(--color-vurgu-tint) 55%, transparent 100%)",
        }}
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ duration: 0.6, ease: "linear" }}
      />
    </span>
  );
}
