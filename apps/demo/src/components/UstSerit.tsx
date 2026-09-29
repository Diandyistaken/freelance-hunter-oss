"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings2, X } from "lucide-react";
import { useDemo } from "@/lib/durum";
import type { Deri } from "@/lib/deri";
import { Cetvel, GIRIS, ONAY } from "@/components/animasyon";

// ÜST ŞERİT — demo içinde gezinme.
//
// Panel sürümünde burada Hunter'ın kenar çubuğu vardı ve müşteri tablette
// onu görüyordu. Artık yalnız demonun kendi sayfaları var; dışarı çıkan
// hiçbir bağlantı yok.
//
// TASARIM KARARLARI
//  * Şerit TAM GENİŞLİKTE ve kendi zemini var (--yuzey + altında 1px kıl
//    çizgi). Daha önce içerik kartlarıyla aynı malzemeden bir kart gibi
//    duruyordu; şerit "mobilya", kartlar "iş" — ikisi aynı görünemez.
//  * Etkin sekme dolgulu rozet değil 3px alt çizgi. Dolgu, vurgu bütçesinin
//    tamamını gezinmeye harcıyordu; asıl vurgu ekrandaki veriye ait.
//  * Şeritte YALNIZ sekmeler ve sessiz bir dişli var. "Sıfırla" bir
//    geliştirici kontrolü; ayarlar levhasının içine, "Tamam"ın soluna indi.
//    Ayarlar akışa giren üçüncü levha değil, üstten gelen bir sheet.
//
// Şerit YALNIZ bırakılan kâğıtta gizlenir. /danisan'da da duruyor: beş
// ekrandan biri ortak kabuğu paylaşmayınca sunumu yapan kişi sekmelere
// dönmek için başka bir düğme aramak zorunda kalıyor ve müşteri açısından
// ekran başka bir uygulamaya geçmiş gibi duruyordu. Üye ekranı zaten bir
// sekme; cihaz yanılsamasını telefon kabuğu kuruyor, şeridin yokluğu değil.
const GIZLI = ["/teklif"];

interface Sekme { yol: string; ad: (d: Deri) => string; yalnizDeri?: string }

// Sekme adları deriden geliyor: "Üye ekranı" psikolog müşterisi için yanlış
// terim ve arayüzün en çok bakılan öğesinde sayfa içi dilin ("danışanınızın
// gördüğü ekran") aksini söylüyordu.
//
// ÖZET yalnız pilateste: aylık doluluk özeti psikolog ürün listesinde HİÇ
// yok (bkz. fiyat.ts, PSIKOLOG_URUNLERI dört ürün). Satılmayan bir ürünün
// ekranı sekmede durursa demo kendi fiyat sayfasıyla çelişir.
const SEKMELER: Sekme[] = [
  { yol: "/", ad: () => "Sunum" },
  // Üye defteri yalnız pilateste: psikolog ürün listesinde süreli üyelik
  // diye bir şey yok (orada satılan şey seans paketi). Satılmayan bir ürünün
  // sekmesi durursa demo kendi fiyat sayfasıyla çelişir.
  { yol: "/uyeler", ad: () => "Üyeler", yalnizDeri: "pilates" },
  { yol: "/program", ad: () => "Program" },
  { yol: "/ozet", ad: () => "Özet", yalnizDeri: "pilates" },
  { yol: "/danisan", ad: (d) => d.uyeEkraniAdi },
  { yol: "/teklif", ad: () => "Teklif" },
];

// Örnek metin deriye bağlı: pilates derisindeyken psikolog örneği yazmak
// karşı tarafın gözü önünde açılan bir levhada dikkatsizlik işaretidir.
const ALANLAR = [
  {
    alan: "isletmeAdi" as const,
    etiket: (sektor: string) => `${sektor} adı`,
    ipucu: "Görüşmeden önce yaz — ekranda kendi adını görsün. " +
      "Yalnız bu tarayıcıda kalır, hiçbir yere gönderilmez.",
    yer: (deriKodu: string) => deriKodu === "psikolog"
      ? "ör. Örnek Psikolojik Danışmanlık"
      : "ör. Denge Pilates Stüdyosu",
  },
  {
    alan: "onlineLink" as const,
    etiket: () => "Online görüşme adresi",
    ipucu: "Seansa 30 dakika kala danışana bu bağlantı gönderilir. " +
      "Boşsa hiç gönderilmez.",
    yer: () => "Zoom / Meet bağlantısı",
  },
  {
    alan: "odemeLinki" as const,
    etiket: () => "Ödeme linki",
    ipucu: "Ücret hatırlatmasına eklenir. Boşsa mesajda hiç geçmez.",
    yer: () => "https://...",
  },
  {
    alan: "iletisim" as const,
    etiket: () => "Telefon numaran",
    ipucu: "Teklif kâğıdının altına basılır. Boşsa numara hiç yazmaz.",
    yer: () => "05.. ... .. ..",
  },
];

export default function UstSerit() {
  const yol = usePathname();
  const { durum, deri, ayarla, sifirla, yukleniyor } = useDemo();
  const [ayarAcik, setAyarAcik] = useState(false);

  // Escape ile kapanır: gösterim sırasında levhayı hızlı kapatmak isteyen
  // kullanıcı küçük bir × düğmesi aramak zorunda kalmamalı.
  useEffect(() => {
    if (!ayarAcik) return;
    const kapat = (e: KeyboardEvent) => { if (e.key === "Escape") setAyarAcik(false); };
    window.addEventListener("keydown", kapat);
    return () => window.removeEventListener("keydown", kapat);
  }, [ayarAcik]);

  if (GIZLI.includes(yol)) return null;

  // Kayıtlı deri okunmadan SEKME YAZILMAZ. "Özet" yalnız pilateste var; kayıt
  // psikologken şerit önce beş sekmeyle basılıp hidrasyondan sonra dörde
  // iniyor ve sekme adları müşterinin gözü önünde yana kayıyordu. Sabit
  // yükseklikte boş şerit: içerik aşağı kaymıyor, yanlış sekme hiç görünmüyor.
  // (Aynı koruma Sunum ve Teklif'te de var.)
  if (yukleniyor) {
    return (
      <header className="relative z-20 border-b border-cizgi bg-yuzey print:hidden">
        <div className="oluk">
          <div className="kabuk h-eylem" />
        </div>
      </header>
    );
  }

  return (
    // Baskıda şerit yok: üye defterinin gün sonu çıktısı (AcikHesapCizelgesi)
    // kâğıdın tepesinden başlamalı; sekmeler kâğıtta işe yaramaz.
    <header
      data-deri={durum.ayar.deri}
      className="relative z-20 border-b border-cizgi bg-yuzey print:hidden"
    >
      {/* `.oluk`: şerit kaydırmıyor ama içerik kabı (`.sahne-akis`) kaydırıyor
          ve çubuğun payını KENDİ genişliğinden yiyor. Pay burada da ayrılmazsa
          şeridin sağ kenarı içeriğinkinden 10px dışarıda kalıyor — sekmelerin
          altındaki içerik her ekranda azıcık içeride duruyordu. */}
      <div className="oluk">
      <div className="kabuk flex items-center gap-b4">
        {/* TELEFONDA SARMAZ, KAYAR. `flex-wrap` beş sekmeyi 375px'te iki
            satıra kırıyordu ve üst şerit tek başına 113px, yani ekranın
            yedide birini yiyordu — sunum desteşi zaten sığmıyorken.
            Yatay kaydırma tek satırı korur; çubuk gizli, kenarda kalan yarım
            sekme "devamı var" işaretidir. `shrink-0` olmadan flex öğeleri
            sıkışıp yine sarıyordu. */}
        <nav className="oluk-gizli flex min-w-0 flex-1 overflow-x-auto max-md:flex-nowrap md:flex-wrap">
          {SEKMELER
            .filter((s) => !s.yalnizDeri || s.yalnizDeri === durum.ayar.deri)
            .map((s) => {
              const etkin = yol === s.yol;
              return (
                <Link
                  key={s.yol}
                  href={s.yol}
                  aria-current={etkin ? "page" : undefined}
                  className={`relative flex h-eylem shrink-0 items-center whitespace-nowrap px-b3 text-govde transition-colors ${
                    etkin ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {s.ad(deri)}
                  {/* layoutId: çizgi sekmeden sekmeye kayar. Tek hareketli
                      öğe olduğu için "neredeyim" bilgisini taşır.
                      ÇİZGİ MÜREKKEP, VURGU DEĞİL: fiyat slaytında vurgu
                      bütçesinin üçü de gezinmeye gidiyordu (sekme çizgisi +
                      ilerleme adımı + "İleri"), üstelik ilk ikisi AYNI
                      bilgiyi taşıyor. Destenin en önemli sayfasında gözün
                      gittiği ilk renkli nesne "bir sonrakine geç" düğmesi
                      oluyordu; boşalan slot 45.000 ₺'nin kartına gitti. */}
                  {etkin && (
                    <motion.span
                      layoutId="sekme-cizgi"
                      transition={ONAY}
                      className="absolute inset-x-0 bottom-0 h-[3px] bg-ink"
                    />
                  )}
                </Link>
              );
            })}
        </nav>

        {/* ŞERİTTE TEK ALET KALDI: sessiz dişli.
            "↺ Sıfırla" dört ekranın dördünde de, metinli, daima görünürdü.
            Satın alınacak bir ürünün üst şeridinde duran bir GELİŞTİRİCİ
            kontrolü; karşı taraf teknolojiden anlamıyor ama o kelimeyi okuyor
            ve kendi verisini silecek bir şey sanıyor. Şikâyetin merkezi tam
            olarak buydu: ekran ürün gibi değil panel gibi konuşuyordu.
            Sunucunun aleti sunucunun levhasına taşındı. */}
        <div className="flex shrink-0 items-center">
          <motion.button
            onClick={() => setAyarAcik(true)}
            whileTap={{ scale: 0.985 }}
            title="Ayarlar"
            aria-label="Ayarlar"
            className="grid size-dokunma place-items-center text-ink-3 transition-colors hover:text-ink"
          >
            <Settings2 className="size-5" />
          </motion.button>
        </div>
      </div>
      </div>

      {/* ANIMATEPRESENCE KALKTI — LEVHA KAPANMAK ZORUNDA.
          Çıkış animasyonu bitene kadar düğüm DOM'da kalıyor ve animasyon
          `requestAnimationFrame` ile ilerliyor. Tarayıcı sayfayı görünmez
          sayarsa (gömülü panel, arka plan sekmesi, uygulama değiştirip geri
          gelme) rAF hiç ilerlemiyor: levha ve perdesi ekranda ASILI KALIYOR.
          Bu levha her görüşmenin başında müşterinin gözü önünde açılıyor;
          kapanmaması demoyu ortasında kilitler. Kapanış artık React'in
          koşullu çizimiyle, yani anında.

          Açılış animasyonundan da opaklık çıktı: rAF durmuşsa `opacity: 0`
          levhayı görünmez ama TIKLANABİLİR bırakıyordu — ekranı kilitlemenin
          ikinci yolu. Geriye yalnız 16px kayma kaldı; yarım kalırsa levha
          16px yukarıda durur, okunur. */}
      {ayarAcik && (
          <>
            {/* Perde: sheet açıkken arkadaki ekran "dondu" desin. */}
            <motion.button
              aria-label="Ayarları kapat"
              onClick={() => setAyarAcik(false)}
              transition={{ duration: 0.2 }}
              // Perde %25'ten %45'e çıktı: altındaki birincil eylem (Sunum'un
              // "İleri"si) sönmüyor, yalnız hafifçe griyordu ve levhanın
              // "Tamam"ıyla aynı optik bantta iki eylem yan yana duruyordu.
              className="fixed inset-0 z-30 cursor-default bg-ink/45"
            />
            <motion.section
              initial={{ y: -16 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.28, ease: GIRIS }}
              // Levha ekranın tamamını değil, alt eylem şeridinin ÜSTÜNE
              // kadarını kaplıyor: tam yükseklikte iki birincil düğme (levhanın
              // "Tamam"ı ile Sunum'un "İleri"si) aynı sağ kenarda, aralarında
              // ~67px'le üst üste biniyordu.
              //
              // EYLEM ŞERİDİ KAYDIRAN GÖVDENİN DIŞINDA. Levha tek bir kaydıran
              // kutuyken gösterim cihazında (1024×768) içerik 722px tutuyor,
              // kutu 680px görünüyordu: "Tamam"ın alt kenarı görünen alanın
              // 10px ALTINDA kalıyor, 28px'lik alt köşe hiç görünmüyordu. Bu
              // levha her görüşmenin başında müşterinin gözü önünde açılıyor;
              // ilk bakışın kenarından kesilmiş bir düğmeye düşmesi tek başına
              // "yarım kalmış yazılım" demek. Kolon artık ikiye ayrık: üstte
              // kaydıran içerik (flex-1 + min-h-0), altta sabit eylem şeridi.
              // İçerik ne kadar uzarsa uzasın iki düğme daima görünür.
              className="fixed inset-x-0 top-0 z-40 flex max-h-[calc(100svh-88px)] flex-col overflow-hidden rounded-b-sahne bg-cukur shadow-kalkik-3"
            >
              <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="kabuk pb-b4 pt-b5">
                {/* Cetvel akışın başında ve TAM KOLON GENİŞLİĞİNDE: flex
                    satırının içinde dururken kutusu içeriği kadar daralıyor ve
                    aynı işaret başka ekranlarda 700px, burada 64px oluyordu. */}
                <Cetvel />
                <div className="mt-b3 flex items-start justify-between gap-b4">
                  <h2 className="text-bolum">Ayarlar</h2>
                  <motion.button
                    onClick={() => setAyarAcik(false)}
                    whileTap={{ scale: 0.985 }}
                    aria-label="Kapat"
                    className="grid size-dokunma shrink-0 place-items-center rounded-kontrol text-ink-3 transition-colors hover:text-ink"
                  >
                    <X className="size-5" />
                  </motion.button>
                </div>

                {/* Bölüm boşlukları b6 → b5: levha bir SAYFA değil, üstten
                    inen bir çekmece; bölüm arası 52px orada iki bölümü aynı
                    ekranda tutamıyordu. */}
                <p className="etiket mt-b5">Sektör</p>
                <div className="mt-b3 flex flex-wrap gap-b2">
                  {[
                    { kod: "pilates", ad: "Pilates / spor" },
                    { kod: "psikolog", ad: "Psikolog" },
                  ].map((d) => {
                    const etkin = durum.ayar.deri === d.kod;
                    return (
                      <motion.button
                        key={d.kod}
                        onClick={() => sifirla(d.kod)}
                        whileTap={{ scale: 0.985 }}
                        className={`flex h-eylem items-center rounded-kontrol px-b5 text-govde transition-colors ${
                          etkin
                            ? "bg-ink font-medium text-uzeri"
                            : "border border-cizgi-koyu text-ink-2 hover:text-ink"
                        }`}
                      >
                        {d.ad}
                      </motion.button>
                    );
                  })}
                </div>

                <p className="etiket mt-b5">Görüşme bilgileri</p>
                {/* İKİ KOLON HER GENİŞLİKTE: `sm:` altında dört alan alt alta
                    dizilince levha 900px'i buluyordu. Levha zaten yalnız
                    gösterim cihazında (yatay tablet) açılıyor. */}
                <div className="mt-b3 grid grid-cols-2 gap-b4">
                  {ALANLAR.map((x) => (
                    <label key={x.alan} className="block">
                      {/* ÜÇ KADEME, ÜÇ PUNTO: etiket 17/500, alan 17/400,
                          ipucu 13. Üçü de 17px olunca levha gri bir metin
                          duvarına dönüyor ve açıklama etiket kadar yüksek
                          sesle konuşuyordu. */}
                      <span className="mb-b2 block text-govde font-medium text-ink">
                        {x.etiket(deri.sektor)}
                      </span>
                      <input
                        defaultValue={durum.ayar[x.alan]}
                        onBlur={(e) => ayarla(x.alan, e.target.value)}
                        placeholder={x.yer(deri.kod)}
                        className="h-eylem w-full rounded-kontrol border border-cizgi-koyu bg-yuzey px-b4 text-govde text-ink outline-none placeholder:text-ink-3"
                      />
                      {/* Sarmalayan cümle künye kademesinde (15/20): 13/16
                          iki-üç satır sardığında kol mesafesinden okunmuyor. */}
                      <span className="mt-b1 block text-kunye text-ink-3">
                        {x.ipucu}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              </div>

              {/* Kapatmanın yolu sağ üstteki küçük × değil, elin gittiği
                  yerde duran düğme. (Escape ve perdeye dokunmak da kapatıyor.)
                  DOLGUSU MÜREKKEP, VURGU DEĞİL: "Tamam" satın alma yönünde
                  bir eylem değil, bir kapatma. Vurgu dolgusu olduğunda
                  levhanın altında kalan Sunum "İleri"siyle aynı sağ kenarda,
                  aynı ölçüde, aynı kiremitte iki birincil eylem yan yana
                  duruyordu — "ekran başına en fazla bir vurgu dolgulu düğme"
                  bütçesi tam da müşterinin gözü önünde açılan levhada
                  ihlal ediliyordu. Vurgu sunum akışının hakkı. */}
              {/* Kıl çizgi eylem şeridinin kendi zemini değil, kaydıran
                  gövdeyle arasındaki ayraç: içerik altından geçerken kesilmiş
                  değil "devam ediyor" görünsün. */}
              <div className="shrink-0 border-t border-cizgi">
                <div className="kabuk flex items-center justify-end gap-b5 pb-b5 pt-b3">
                  {/* Şeritten inen alet. Metin düğme, dolgusuz, sönük: bu bir
                      eylem çağrısı değil, gösterimden önce basılan bir ayar.
                      Adı da ne yaptığını tam olarak söylüyor — "Sıfırla"
                      tek başına "verimi siler mi?" diye okunuyordu. */}
                  <motion.button
                    onClick={() => sifirla()}
                    whileTap={{ scale: 0.985 }}
                    title="Her görüşmeden önce bas."
                    className="hedef relative text-etiket font-normal text-ink-3 underline underline-offset-4 transition-colors hover:text-ink"
                  >
                    Demoyu ilk hâline döndür
                  </motion.button>
                  <motion.button
                    onClick={() => setAyarAcik(false)}
                    whileTap={{ scale: 0.985 }}
                    className="h-eylem rounded-kontrol bg-ink px-b5 text-govde font-medium text-uzeri"
                  >
                    Tamam
                  </motion.button>
                </div>
              </div>
            </motion.section>
          </>
      )}
    </header>
  );
}
