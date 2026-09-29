"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useDemo } from "@/lib/durum";
import { paketAl, PIYASA, tl, urunler } from "@/lib/fiyat";
import { Cetvel, kayYan } from "@/components/animasyon";

// SUNUM — tablette, karşı tarafa dönük gösterilir.
//
// AKIŞ (kullanıcı kararı, 14 Eyl 2026): fiyat her sayfaya serpiştirilmez.
// Önce ne yaptığımız anlatılır, fiyat TEK sayfada toplanır. Sebebi basit:
// her ürün sayfasında iki büyük rakam varken karşı taraf ürünü değil
// rakamı okuyor ve daha üçüncü sayfada "pahalı" diye karar veriyor.
//
//   0            Giriş — ürünler yalnız ADLARIYLA. Fiyat yok.
//   1..N         Her ürün tek tek: ne yapar, şimdi ne göstereceğim, teslim.
//   N+1          FİYATLAR — ayrı ayrı, hepsi birden, aylık bakım.
//   N+2          Hazır programlarla karşılaştırma.
//
// Ekran bir SLAYT gibi kurulu: üç satırlı ızgara (ilerleme / içerik / eylem).
// Alt şerit `fixed` değil ızgaranın üçüncü satırı — eskiden sabitti ve içerik
// şeridin arkasında kalıyordu.
//
// SAYFA GEÇİŞİ: tam sayfa fade YOK. Eskiden `AnimatePresence mode="wait"` ile
// önce eski sayfa siliniyor, sonra yenisi geliyordu; arada ~0.3 saniye ekran
// bomboş kalıyordu ve sekiz sayfada sekiz kez "yükleniyor mu?" hissi
// doğuruyordu. Artık içerik basıldığı KAREDE yerinde; `key={sayfa}` alt ağacı
// yeniden kurduğu için yalnız cetvel yatayda süpürüyor ve başlık 16px kayıyor.

// OPAKLIK ANİMASYONU BU EKRANDA HİÇ YOK. Metin ilk kareden itibaren %100
// opak; hareket eden tek şey cetvel (scaleX) ve başlık (16px yatay kayma).
// Ölçüldü: opaklıkla gelen bir slayt, tarayıcı sayfayı görünmez saydığında
// (gömülü panel, arka plan sekmesi) rAF ilerlemediği için SÜRESİZ bomboş
// kalıyor. Sekiz kez elle çevrilen bir akışta alınabilecek en büyük risk bu;
// kayma yarım kalırsa en kötü ihtimalle başlık 16px sağda durur, metin okunur.

/** Rakam + ₺. İşaret rakamın 0.62 katı ve bir ton açık: göz önce sayıya gitsin. */
function Para({ tutar, mirasIsaret = false }: { tutar: number; mirasIsaret?: boolean }) {
  return (
    <span className="tnum">
      {tl(tutar)}
      {/* `mirasIsaret`: işaret rengini satırdan MİRAS alır. `.para`nın sabit
          ink-3 tonu kâğıt üstündeki her rakamda doğru, ama vurgu renkli tek
          bir satırda gri bir ₺ rakamdan kopuyor ve "yarım yüklenmiş" gibi
          duruyor. Boyut (0.62em) ve ağırlık kuralı aynen kalır; değişen
          yalnız renk. */}
      <span className={mirasIsaret ? "para text-current" : "para"}> ₺</span>
    </span>
  );
}

export default function SunumPage() {
  // `deri` ÇEKİLMİYOR: bu ekran sektör sözlüğünü hiç kullanmıyor, ürün
  // listesini ve paketi doğrudan `durum.ayar.deri` koduyla alıyor. Okunmayan
  // bir bağlama, sonraki okuyucuya "burada deri sözlüğü de var" diye yanlış
  // ipucu veriyordu.
  const { durum, yukleniyor } = useDemo();
  const [n, setN] = useState(0);

  const liste = useMemo(() => urunler(durum.ayar.deri), [durum.ayar.deri]);

  // TEK TEK ALINIRSA ne tutuyor. Rakam fiyat.ts'ten TÜRETİLİR, elle yazılmaz:
  // bir ürün eklenir/çıkarılır ya da bir kurulum bedeli değişirse hem toplam
  // hem paketle arasındaki fark kendiliğinden düzelir. Aynı ekranda birbirini
  // tutmayan iki rakam görmek, bu görüşmede güvenin bittiği an olurdu.
  const tekTekToplam = useMemo(
    () => liste.reduce((toplam, u) => toplam + u.kurulum, 0),
    [liste],
  );

  // KAYITLI DERİ OKUNMADAN HİÇBİR ŞEY ÇİZİLMEZ.
  //
  // `durum.tsx` kayıt gelene kadar `tohumla(VARSAYILAN_AYAR)` döndürüyor,
  // yani ilk boyama HER ZAMAN pilates. Kayıtlı deri psikologken müşterinin
  // gördüğü İLK ekran kendini düzelten bir ekran oluyordu: 5 ürün → 4 ürün,
  // kiremit → lacivert, 5 sekme → 4 sekme. Statik çıktıda bu her açılışta
  // tekrarlanıyor ve "bitmemiş yazılım" demenin en hızlı yolu.
  //
  // İskelet AYNI ızgarayı taşıyor (auto/1fr/auto): şerit ve alt eylem satırı
  // yerlerinde kalıyor, kayıt gelince içerik zıplamadan doluyor.
  if (yukleniyor) return <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto]" />;
  const paket = paketAl(durum.ayar.deri);

  // Paket indirimi. SIFIR YA DA NEGATİFSE HİÇ GÖSTERİLMEZ: fiyat.ts bir gün
  // paketi tek tek toplamın üstüne çıkarırsa ekran "0 ₺ daha az" ya da eksi
  // bir sayı yazmaz, indirim iddiasını tamamen bırakır. Söylenmeyen iddia
  // düzeltilebilir, yanlış yazılmış rakam düzeltilemez.
  const indirim = tekTekToplam - paket.kurulum;
  const sayfaSayisi = liste.length + 3;   // giriş + ürünler + fiyatlar + karşılaştırma
  const son = sayfaSayisi - 1;
  const fiyatSayfasi = son - 1;
  const adi = durum.ayar.isletmeAdi;

  // Deri değişince ürün sayısı da değişiyor (5 → 4). Elde kalan sayfa
  // numarası listenin dışına düşerse ekran BOMBOŞ kalır — görüşmenin
  // ortasında olabilecek en kötü şey. Numara her render'da aralığa çekiliyor.
  const sayfa = Math.min(n, son);

  const git = (hedef: number) => setN(Math.max(0, Math.min(son, hedef)));

  return (
    // data-deri: vurgu rengi deriye göre değişir, başka hiçbir token değişmez.
    <div
      data-deri={durum.ayar.deri}
      className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto]"
    >
        {/* --- 1. satır: nerede olduğumuz. Tek gösterge; alttaki "1 / 8"
                sayacı kalktı, iki ayrı yerde aynı bilgi durmuyor. --- */}
        <nav aria-label="Sunum adımları" className="flex gap-b1 pb-b3">
          {Array.from({ length: sayfaSayisi }).map((_, i) => (
            <button
              key={i}
              onClick={() => git(i)}
              aria-label={`${i + 1}. sayfa`}
              aria-current={i === sayfa ? "step" : undefined}
              className="hedef relative flex-1 py-b3"
            >
              {/* ÜÇ KADEME, HEPSİ KÂĞIT TONUNDA: geçilmiş adım koyu çizgi,
                  bulunulan adım vurgu, sıradakiler kıl çizgi.
                  GEÇİLMİŞ ADIM MÜREKKEPTEN ÇIKTI. Mürekkep olduğunda 8.
                  slaytta ekranın en üstünde 7×115px, yani 805px'lik neredeyse
                  kesintisiz ve sayfanın EN KOYU tonunda bir bant duruyordu:
                  destenin en önemli sayfasında h1'den de 45.000 ₺'den de uzun
                  ve güçlü bir kütle, üstelik taşıdığı bilgi ("neredeyim")
                  sekme alt çizgisinde zaten bir kez veriliyor. Vurgu bütçesi
                  düzelirken mürekkep bütçesi bozulmuştu; şerit artık üç
                  kademeli ama tek renkli nesnesi yine BULUNULAN adım. */}
              <span
                className={`block h-b1 transition-colors duration-200 ${
                  i === sayfa ? "bg-vurgu" : i < sayfa ? "bg-cizgi-koyu" : "bg-cizgi"
                }`}
              />
            </button>
          ))}
        </nav>

        {/* --- 2. satır: içerik. Kısa sayfa dikeyde ortalanır, uzun sayfa
                (fiyatlar) kaydırılır — hiçbir şey kırpılmaz. --- */}
        {/* Alt kenara 24px kâğıt maskesi: bir sayfa sığmazsa kesilen satır
            "bitmemiş ekran" gibi değil, "devamı var" gibi okunsun. Dokunmatik
            tablette ince kaydırma çubuğu hiç görünmüyor. */}
        <div className="relative flex min-h-0 flex-col">
          {/* `flex-1` olmadan bu kutu yalnız içeriği kadar yüksekti; `m-auto`
              paylaşacak boş alan bulamıyor ve her slayt üste yapışıyordu —
              ölçümde içeriğin üstünde 72px, altında 344px boşluk vardı. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div
              key={sayfa}
              // SEKİZ SLAYTIN SEKİZİ DE DİKEYDE ORTALI. Fiyat slaytı tek
              // istisnaydı (üste yaslı) ve sayfa çevirirken içerik bloğu her
              // seferinde yukarı zıplıyordu — elle çevrilen bir akışta göz her
              // adımda yeniden konumlanıyor. Slayt artık kadraja pay bırakarak
              // sığdığı için ortalanması hiçbir şeyi kırpmıyor.
              className="m-auto w-full"
            >
              {/* ------------------------------------------------ 0: giriş */}
              {sayfa === 0 && (
                // KAPAK: açılış boşluğu ARTIK PADDING'DEN DEĞİL, slaytın
                // dikey ortalanmasından geliyor. `pt-b7` ile ikisi üst üste
                // binince içeriğin üstünde 108px, altında 48px kalıyordu —
                // "boşluk" değil "sayfa yukarı kaymış" gibi okunuyor.
                <section className="grid gap-b6 lg:grid-cols-12 lg:gap-b5">
                  {/* İKİ KOLON AYNI TABANDA BİTER. Ürün slaytlarında bu
                      `lg:mt-auto` ile çözülmüştü, sunumun İLK ekranında
                      çözülmemişti: sağdaki liste soldan ~83px yukarıda,
                      havada asılı bir kıl çizgiyle bitiyordu. Swiss
                      disiplininde tutmayan taban, ızgaranın hesaplanmadığını
                      söyler — hele ki ilk ekranda. */}
                  <div className="flex flex-col lg:col-span-7">
                    <Cetvel />
                    <p className="etiket mt-b3">{adi ? adi : "Ürün tanıtımı"}</p>
                    <motion.h1 {...kayYan()} className="genis mt-b3 text-kapak">
                      Size neler yapabiliriz?
                    </motion.h1>
                    <p className="olcu mt-b5 text-govde text-ink-2">
                      {liste.length} ayrı şey. Hepsini birden almak zorunda değilsiniz —
                      hangisi işinize yarıyorsa onu kurarız, gerisi kapalı kalır ve
                      ücreti olmaz.
                    </p>
                    <p className="cukur-zeminde olcu mt-b5 rounded-yuzey px-b4 py-b4 text-govde text-ink-2 lg:mt-auto">
                      Önce hepsini tek tek göstereceğim. Ne kadar tuttuğunu
                      sonunda, tek sayfada konuşacağız.
                    </p>
                  </div>

                  <div className="flex flex-col lg:col-span-5">
                    <Cetvel gecikme={0.12} />
                    <p className="etiket mt-b3">{liste.length} ürün</p>
                    {/* Çizgi DÜĞMEDE değil `<li>`de ve sonuncuda YOK: listenin
                        altında havada duran bir kıl çizgi "bitti mi, devamı mı
                        var" belirsizliği yaratıyordu. Satır aralıkları
                        esneyerek iki kolonun tabanını tutturuyor. */}
                    <ul className="mt-b3 lg:flex lg:flex-1 lg:flex-col lg:justify-between">
                      {liste.map((u, i) => (
                        <li key={u.kod} className="border-b border-cizgi last:border-b-0">
                          <motion.button
                            onClick={() => git(i + 1)}
                            whileTap={{ scale: 0.985 }}
                            className="flex min-h-16 w-full items-center gap-b4 py-b3 text-left"
                          >
                            <span className="tnum text-etiket text-ink-3">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="min-w-0 flex-1 text-one">{u.ad}</span>
                            <ChevronRight className="size-4 shrink-0 text-ink-3" />
                          </motion.button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {/* -------------------------------------------- ürünler tek tek */}
              {sayfa >= 1 && sayfa <= liste.length && (() => {
                const u = liste[sayfa - 1];
                return (
                  // İKİ KOLON AYNI TABANDA BİTER: sol kolonun "Teslim" bloğu
                  // `lg:mt-auto` ile dibe oturuyor, sağdaki çukur kutu zaten
                  // kolonu dolduruyor. Eskiden ikisi farklı yüksekliklerde
                  // bitiyor ve iki kolonlu yerleşim hizasız duruyordu.
                  <section className="grid gap-b6 lg:grid-cols-12 lg:gap-b5">
                    <div className="flex flex-col lg:col-span-7">
                      <Cetvel />
                      <p className="etiket mt-b3">
                        {sayfa}. ürün · {liste.length} üründen
                      </p>
                      <motion.h1 {...kayYan()} className="mt-b3 text-sayfa">
                        {u.ad}
                      </motion.h1>
                      <p className="olcu mt-b5 text-govde text-ink-2">{u.neYapar}</p>

                      <div className="mt-b5 border-t border-cizgi pt-b3 lg:mt-auto">
                        <p className="etiket">Teslim</p>
                        <p className="tnum mt-b1 text-one">{u.teslim}</p>
                      </div>
                    </div>

                    {/* "Şimdi göstereceğim" — ezberlemek gerekmesin diye hangi
                        ekrana gidip ne yapacağı yazılı. Çukur zemin: bu bir
                        vaat değil, sunucuya not. */}
                    <div className="cukur-zeminde rounded-yuzey p-b5 lg:col-span-5">
                      <p className="etiket">Şimdi göstereceğim</p>
                      <p className="mt-b3 text-govde">{u.demoAdimi}</p>
                      <Link
                        href={u.yol}
                        className="mt-b4 inline-flex min-h-dokunma items-center gap-b2 rounded-kontrol border border-cizgi-koyu px-b4 text-govde"
                      >
                        Ekrana geç <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </section>
                );
              })()}

              {/* ------------------------------------------------ fiyatlar */}
              {sayfa === fiyatSayfasi && (
                // ÜÇ RAKAM: tek tek toplam → paket → fark. Bir ara sürümde
                // toplam da fark da kaldırılmıştı; gerekçe "çıkarma işlemi ima
                // ediyor, fiyat.ts'in dürüstlük notuyla çelişiyor" idi. O
                // gerekçe yanlış yerden alınmıştı: oradaki not HAZIR
                // PROGRAMLARLA piyasa karşılaştırmasına dair ("biz daha ucuzuz"
                // denmez, çünkü 3 yıllık toplamda değiliz). Kendi paketimize
                // verdiğimiz toplu alım indirimi başka bir şeydir ve sıradan
                // bir ticari karardır — üstelik çizilen rakam piyasanınki değil,
                // aynı sayfada satır satır yazılı KENDİ toplamımız. Gizlenecek
                // bir yanı yok; gizlendiğinde karşı taraf zaten kafadan
                // topluyor ve "neden 45?" sorusunun cevabı ekranda olmuyordu.
                //
                // Ekranın doruğu 45.000 ve onun altındaki fark. Toplam (68.000)
                // kasten SOL kolonun sağ kenarında, ayıran çizginin dibinde:
                // iki rakam çizginin iki yanından birbirine bakıyor ve
                // aralarındaki ilişkiyi söz değil konum + ölçek kuruyor.
                // Satır arası b4, kolon arası b5: bu sayfa 1024×768'de
                // KAYDIRMASIZ sığmak zorunda — satışın en güçlü cümlesi
                // ("bir hafta deneyin") eskiden kadrajın altında yarısı
                // kesilmiş duruyordu ve sunucu bunu fark etmiyordu.
                <section className="grid gap-x-b5 gap-y-b2 lg:grid-cols-12">
                  {/* Sol kolon: tek tek.
                      FATURA SÜTUNU GERİ KURULDU — bu sefer yarım değil.
                      Bir tur "satır içi fiyat" denendi ve ortada kaldı:
                      kıl çizgili tablo satırları korundu ama fiyatlar satır
                      içine alındı, canlıda ölçüldü ve beş rakamın sol
                      kenarları x=185/191/207/220/329 arasına saçıldı (144px
                      yayılım). Üstlerinde ise hiçbir sütunu toplamayan, 2px
                      cetvelli, sağa yaslı bir TOPLAM duruyordu. Yani fatura
                      dokusunun OKUNABİLİR yanı (hizalı sütun) atılmış,
                      okunmayan yanı (ruled satırlar + toplama çizgisi)
                      tutulmuştu: hem tablo gibi duruyor hem taranamıyordu.

                      Kullanıcının bu sayfadan açık isteği bir SIRA: tek tek
                      fiyat → toplam → paket. Sıra ancak beş rakam TEK BİR
                      SAĞ EKSENDE hizalanırsa kurulur; 68.000'in nereden
                      geldiğini gözle doğrulayabildiği tek yer burası.
                      `grid-cols-[1fr_auto]` + `items-baseline` bunu yapıyor,
                      " — " ayracı kalkıyor (ızgara zaten ayırıyor).

                      PUNTO MERDİVENİ: ad 17 → fiyat 30 → toplam 34.
                      Fiyatlar 22px'ti, adla farkı 1.29 kat — iki metin kardeş
                      okunuyordu. 30px'te fark 1.76. Toplam bir kademe DAHA
                      yukarıda (34) olmak zorunda: kendi topladığı sayılardan
                      küçük bir toplam satırı aritmetiği ters çeviriyor. 44px
                      (h1) ve 76px (doruk) bu kolonda zaten dolu. */}
                  <div className="lg:col-span-6">
                    <Cetvel />
                    <p className="etiket mt-b3">Ayrı ayrı · kurulum</p>
                    <motion.h1 {...kayYan()} className="mt-b3 text-sayfa">
                      Ne kadar tutuyor?
                    </motion.h1>
                    {/* Dürüstlük şeridine dört kenar dolgu açmak için iki
                        adım geri alındı (b3 → b2, b4 → b3): sayfa 1024×768'e
                        KAYDIRMASIZ sığmak zorunda ve kazanılan ~14px oraya
                        gidiyor. */}
                    {/* `md:hidden` — BU CÜMLE SAYFADA İKİ KEZ YAZILI DEĞİL.
                        Altındaki güvence şeridinin ilk maddesi ("İstemediğiniz
                        bölüm kapalı kalır, ücreti olmaz") bunun aynısını
                        söylüyor; şerit ise telefonda gizli (`max-md:hidden`).
                        İkisi tam olarak birbirini tamamlıyor: telefonda bu
                        paragraf, md üstünde şerit. Altıncı ürün eklenince
                        kalem listesi bir satır uzadı ve slayt 1024×768'de
                        44px taşıdı — yani satışın en güçlü cümlesi ("bir hafta
                        deneyin") yine yarısı kesilmiş duruyordu. Kazanılan yer
                        bir şeyi küçülterek değil, iki kez söylenen şeyi bir kez
                        söyleyerek geldi. */}
                    <p className="olcu mt-b2 text-govde text-ink-3 md:hidden">
                      Hangisi işinize yarıyorsa onu kurarız, gerisi kapalı kalır
                      ve ücreti olmaz.
                    </p>

                    {/* SATILAN ŞEYİN ADI EN ZAYIF TİPOGRAFİ OLAMAZ.
                        Bu slaydın konusu "ne satın alıyorum"du ama ürün adları
                        sayfanın en küçük puntosu + en açık tonu + en hafif
                        ağırlığıydı, rakamlar ise en güçlüsü: müşteri beş ürünü
                        okuyamadan beş fiyatı okuyordu. Ad mürekkebe ve 500
                        ağırlığa çıkıyor — punto aynı, yani yer maliyeti sıfır.

                        KIL ÇİZGİLER KALKTI, RİTMİ DOLGU DEĞİL ARALIK KURUYOR.
                        4px dolgu + 1px ayraç + değişmez ritim "fatura dokusu"
                        şikâyetini hafifletmek yerine sıkıştırmıştı: satırlar
                        banka ekstresi gibi okunuyordu. Beş rakam zaten TEK sağ
                        eksende hizalı, yani sütunu kuran şey çizgi değil hiza;
                        ayraç kalkınca aynı tarama kolaylığı nefesle kuruluyor.

                        YER BÜTÇESİ ÖLÇÜLDÜ, TAHMİN EDİLMEDİ. Slaydın gerçek
                        kaydırma kutusu `.sahne-akis` değil slayt gövdesi:
                        1024×768'de iç yükseklik 558px ve bu kolon dolu hâlde
                        546px tutuyor — yani toplam pay 12px. `py-b1`den
                        `py-b2`ye çıkmak (Tailwind'de İKİ kenara birden 4'er
                        px) 40px isterdi ve dürüstlük şeridinin ikinci satırını
                        kadrajın altına itiyordu (ölçüldü: 582/558). Dolgu
                        sıfırlanıp aralık `gap-b3`e alınınca satır aralığı
                        8px'ten 12px'e ÇIKIYOR, maliyet yalnız +4px ve şerit
                        yerinde kalıyor. */}
                    <ul className="mt-b3 flex flex-col gap-b3">
                      {liste.map((u) => (
                        <li
                          key={u.kod}
                          className="grid grid-cols-[1fr_auto] items-baseline gap-b3"
                        >
                          <span className="text-govde font-medium text-ink">{u.ad}</span>
                          <b className="text-bolum font-semibold text-ink">
                            <Para tutar={u.kurulum} />
                          </b>
                        </li>
                      ))}
                    </ul>

                    {/* TOPLAM — kullanıcının açık isteği: "ürün fiyatları tek
                        tek bu kadardır, TOPLU ALINCA BİRAZ İNDİRİM SAĞLARIZ".
                        Rakam 34px (`text-veri`): listedeki 30px'lik satırlardan
                        bir kademe büyük (kapanış olduğu belli), doruk 76px'in
                        yarısından küçük (onunla yarışmıyor). Üstündeki 2px cetvel,
                        sayfanın her yerinde olduğu gibi "burada yeni bir şey
                        başlıyor" diyor — burada başlayan şey karşılaştırma.
                        IZGARASI ÜSTÜNDEKİ LİSTEYLE AYNI: toplam artık gerçek
                        bir toplam satırı, yani rakamı beş fiyatla aynı sağ
                        eksende bitiyor. */}
                    <p className="grid grid-cols-[1fr_auto] items-baseline gap-b3 border-t-2 border-cetvel pt-b2">
                      <span className="text-govde text-ink-2">Tek tek alınırsa</span>
                      <b className="text-veri text-ink">
                        <Para tutar={tekTekToplam} />
                      </b>
                    </p>
                  </div>

                  {/* Sağ kolon: hepsi birden + aylık. Ekranın TEK kalkık
                      yüzeyi burası; "her şey kardeş" hissini bu kural bitiriyor.
                      İki kolonu ayıran şey 2px cetvel DEĞİL 1px kıl çizgi:
                      kalın mürekkep çizgi "solu topla, sağı bul" okumasını
                      güçlendiriyordu. */}
                  <div className="flex flex-col gap-b3 lg:col-span-6 lg:border-l lg:border-cizgi-koyu lg:pl-b5">
                    {/* DOLGU YATAYDA b5, DİKEYDE b3. Cömertlik hissini yatay
                        dolgu kuruyor; dikeyde 32px, dürüstlük şeridinin dört
                        kenar dolgusunu bu sayfanın KAYDIRMASIZ sığma kuralıyla
                        çatıştırıyordu (ölçüldü: 583px içerik, 558px kadraj —
                        satışın en güçlü cümlesi yine yarım kalıyordu). */}
                    <div className="rounded-yuzey bg-yuzey px-b5 py-b3 shadow-kalkik-2">
                      {/* "BEŞİ BİRDEN · HEPSİ BİRDEN, BİR KEZ" yazıyordu:
                          ekranın en büyük rakamının üstündeki tek etiket
                          kendini tekrar ediyordu. Statik kısım tek kelimeye
                          indi; aylık kutusunun etiketiyle birlikte iki kutu
                          artık "bir kez" / "her ay" karşıtlığıyla okunuyor. */}
                      {/* CETVEL RAKAMIN ALTINDA DEĞİL, BÖLÜMÜN ÜSTÜNDE.
                          Ölçüldü: rakam kutusu 302px, altındaki 2px cetvel
                          387px, ikisi aynı x'ten başlıyor ve arada 3px var.
                          Kol mesafesinden bu bileşim ALTI ÇİZİLİ FİYAT olarak
                          okunuyordu — projenin kendi dürüstlük kuralının
                          (fiyat.ts) yasakladığı görüntüyü tipografi geri
                          getiriyordu. Üstelik diğer dört ekranda 2px cetvel
                          DAİMA etiketin üstünde; yalnız burada bir rakamın
                          altındaydı. Manşet karakteri rakamın kolon kenarını
                          20px taşmasıyla (.doruk) zaten kuruluyor. */}
                      {/* AMİRAL KARTIN CETVELİ KİREMİT — sayfanın tek "önce
                          buraya bak" işareti. Üst şeritteki sekme çizgisi
                          mürekkebe indi (bkz. UstSerit); boşalan vurgu slotu
                          doruk rakamın kartına geldi. Rakamın kendisi güvenini
                          mürekkepten alıyor, işaret yalnız okuma sırasını
                          kuruyor. */}
                      <span
                        className="cetvel"
                        style={{ background: "var(--color-vurgu)" }}
                      />
                      {/* ÜSTÜ ÇİZİLİ TOPLAM KALKTI — RAKAM DEĞİL SUNUM DEĞİŞTİ.
                          Üstü çizili fiyat + renkli tasarruf satırı, perakende
                          indirim etiketinin birebir kalıbı; desteyi baştan sona
                          taşıyan dürüstlük tonuyla ("istemediğiniz bölüm kapalı
                          kalır", "bir hafta deneyin") çelişen tek görsel oydu ve
                          bilgi doğru olsa bile SUNUMU baskı kuruyor gibi
                          okunuyordu. Üstelik 68.000 iki kez görünüyordu: aynı
                          rakam sol kolonun son satırında ("Tek tek alınırsa")
                          zaten var ve iki kolonu bağlayan köprü de o satır.
                          Tek kaynak orada kaldı. */}
                      <p className="etiket mt-b3">{paket.ad} · bir kez</p>
                      <p className="genis doruk mt-b2 text-kapak">
                        <Para tutar={paket.kurulum} />
                      </p>

                      {/* FARK — İDDİA DEĞİL AMA DİPNOT DA DEĞİL.
                          Vurgu renginde basıldığında satır "indirim rozeti"
                          gibi çalışıyordu ve çözüm RENGİ kısmaktı; 22px/ink-2
                          ile rütbe de düşürülünce ekrandaki HER fiyattan hem
                          küçük hem soluk oldu (beş ürün 30px siyah, toplam
                          34px siyah). Oysa 68.000 ile 45.000'i bağlayan tek
                          köprü cümle bu: karşı taraf sayfadan "45.000" ile
                          değil "23.000 daha az" ile ayrılmalı. Renk hâlâ
                          kiremit DEĞİL (o gerçekten rozet olurdu) ama punto
                          ürün fiyatlarıyla aynı kademeye çıkıyor: "aynı
                          cinsten bir rakam" diye okunur, indirim etiketi diye
                          değil. Doruk 76px'in çok altında kaldığı için
                          hiyerarşi bozulmuyor. */}
                      {indirim > 0 && (
                        <p className="mt-b2 text-bolum font-semibold text-ink">
                          <Para tutar={indirim} mirasIsaret /> daha az
                        </p>
                      )}

                      {/* Açıklama 22px'ten 17px gövdeye indi. Sebep çift: (1)
                          22px'lik üç satır artık kartın en uzun bloğuydu ve
                          fark satırıyla aynı kademede duruyordu — hiyerarşi
                          76 → 22 → 22 diye düzleşiyordu; (2) kazanılan 38px
                          farkın satırını 1024×768 kadrajına KAYDIRMASIZ
                          sığdıran şeyin ta kendisi. */}
                      {/* mt-b3 → mt-b2: fark satırının bir kademe büyümesiyle
                          gelen 8px buradan geri alınıyor, sayfanın kaydırmasız
                          sığma kuralı korunuyor. */}
                      <p className="mt-b2 text-govde text-ink-2">
                        Birlikte kurulduğunda tek sistem olduğu için daha kısa
                        sürüyor. Teslim {paket.teslim}.
                      </p>
                    </div>

                    <div
                      // YATAY DOLGU AMİRAL KARTLA ORTAK (b5), DİKEY DOLGU
                      // AYRI (b4). Dış kenarları zaten aynıydı (ölçüldü: ikisi
                      // de x=556, w=424) ama iç dolgu farklı olduğu için
                      // "BEŞİ BİRDEN" etiketi x=588'de, 12px altındaki "AYLIK
                      // BAKIM" x=576'da başlıyordu: satın alma kararının
                      // verildiği yerde, dikeyde 12px arayla duran iki kutunun
                      // metin sol kenarı kayıktı — kol mesafesinden bu
                      // "ızgara hesaplanmamış" diye okunuyor. Rütbe farkını
                      // DİKEY dolgu taşır (b4'e karşı b3); yatayda ortak kenar
                      // ızgaranın kendisidir. Sayfanın 1024×768'e kaydırmasız
                      // sığması bozulmuyor: değişen tek şey yatay dolgu.
                      className="rounded-yuzey bg-cukur px-b5 py-b4"
                    >
                      <p className="etiket">Aylık bakım · dahil olanlar</p>
                      <p className="mt-b2 flex items-baseline gap-b2">
                        <span className="text-sayfa">
                          <Para tutar={paket.aylik} />
                        </span>
                        <span className="etiket">her ay</span>
                      </p>
                      {/* TİKLER KALKTI. Dört yeşil `Check` bu sayfada üçüncü
                          bir renk ailesi açıyordu (mürekkep + kiremit + yeşil)
                          ve kısa etiketlerle birlikte klasik SaaS fiyat kartı
                          dokusu üretiyordu — Anti-Template kuralının doğrudan
                          hedefi. Dahası `--durum-iyi` sistemde "oldu / doldu /
                          gönderildi" anlamına AYRILMIŞ bir durum rengi;
                          dekoratif liste işareti olarak kullanılınca rengin
                          sözleşmesi bozuluyordu. Etiket zaten "dahil olanlar"
                          diyor, işaretin taşıdığı bilgi tekrardı. Sayfa iki
                          renge indi. */}
                      <p className="mt-b2 text-govde text-ink-2">
                        {["Sunucu", "Yedek", "Arıza", "Küçük değişiklikler"].join(" · ")}
                      </p>
                    </div>
                  </div>

                  {/* DÜRÜSTLÜK ŞERİDİ — satışın en güçlü cümlesi burada ve
                      kadrajın İÇİNDE. Üç ayrı satırken üçüncüsü ("bir hafta
                      deneyin") ekranın alt kenarında yarısı kesilmiş duruyordu.
                      Çukur zemin: bunlar dipnot değil, rakamlarla aynı hizada
                      duran söz. Onay işareti YOK — aynı simge bu ekranda yalnız
                      "dahil olanlar" listesinde, yalnız bir anlamda kullanılıyor. */}
                  {/* DOLGU DÖRT KENARDA b4. `py-b2` (8px) sistemin "satır içi
                      öğeler" adımı; blok dolgusu değil. İki satıra saran metin
                      kutunun üst ve alt kenarına yapışıyor, sütunları ayıran
                      dikey çizgiler metinden uzun duruyordu — yedi adımlı
                      sistemin en görünür yerinde yanlış adım. Üstteki 2px
                      cetvel "bölüm buradan başlıyor" kuralını sayfanın
                      kapanışında da işletiyor. */}
                  {/* TELEFONDA GİZLİ. Bu üç güvence cümlesi telefonda fiyat
                      slaytının 351px taşmasının üçte birini tek başına
                      üretiyordu ve destenin EN ÖNEMLİ sayfasında rakamları
                      ekran dışına itiyordu. İçerik kaybolmuyor: üçü de
                      bırakılan teklif kâğıdında (/teklif) aynen duruyor ve
                      zaten sözlü olarak söylenen cümleler. Rakamın ekranda
                      tam görünmesi, yanındaki güvencenin görünmesinden
                      önce gelir. */}
                  <ul className="cukur-zeminde grid gap-b3 border-t-2 border-cetvel px-b4 py-b3 max-md:hidden lg:col-span-12 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-cizgi">
                    {[
                      "İstemediğiniz bölüm kapalı kalır, ücreti olmaz.",
                      "Ödemeleriniz doğrudan sizin hesabınıza gider.",
                      "Bir hafta deneyin; beğenmezseniz bir bedeli yok.",
                    ].map((s) => (
                      <li
                        key={s}
                        className="text-govde text-ink-2 lg:px-b4 lg:first:pl-0 lg:last:pr-0"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* ------------------------------------------ karşılaştırma */}
              {sayfa === son && (
                <section>
                  <Cetvel />
                  <p className="etiket mt-b3">Karşılaştırma</p>
                  <motion.h1 {...kayYan()} className="mt-b3 text-sayfa">
                    Hazır programlarla farkı
                  </motion.h1>
                  <p className="olcu mt-b4 text-govde text-ink-2">
                    Hazır programlar var ve bazıları iyi. Fark fiyatta değil:
                    orada siz programa uyarsınız, burada program size uyar.
                  </p>

                  {/* Gerçek tablo: sütun başlıkları yazılı, satır kartları yok.
                      "Bizde" sütunu beyaz kâğıt üstünde ve solunda tepeden
                      tabana 2px cetvel — hangi sütunun bizim olduğu renkle
                      değil yapıyla belli. */}
                  {/* TELEFONDA TABLO DEĞİL KART LİSTESİ.
                      Üç sütunlu tablo 375px'te yatay taşıyordu: "Bizde"
                      sütununun metni kesiliyor, alt şeritteki birincil düğme
                      bile kadrajın dışında kalıyordu. Yatay kaydırma bir
                      sunumda en görünür kusur — karşı taraf ekranı parmakla
                      sağa itmek zorunda kalıyor.
                      Aynı veri, iki yerleşim: dar ekranda her satır kendi
                      kartı (konu başlık, iki değer alt alta), md ve üstünde
                      gerçek tablo. Kaynak tek: PIYASA.satirlar. */}
                  <ul className="mt-b4 flex flex-col gap-b3 md:hidden">
                    {PIYASA.satirlar.map((s) => (
                      <li key={s.baslik} className="cukur-zeminde rounded-yuzey p-b4">
                        <p className="etiket">{s.baslik}</p>
                        <p className="mt-b2 text-govde text-ink-3">{s.hazir}</p>
                        {/* Bizim değerimiz kâğıt yüzeyinde ve solunda cetvel:
                            hangi tarafın bizim olduğu renkle değil yapıyla
                            belli — masaüstü tablosundaki kuralın aynısı. */}
                        <p className="mt-b2 border-l-2 border-cetvel bg-yuzey py-b1 pl-b3 text-govde">
                          {s.bizde}
                        </p>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-b4 hidden overflow-x-auto md:block">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b-2 border-cetvel">
                          <th className="etiket w-[22%] pb-b3 align-bottom">Konu</th>
                          <th className="etiket w-[33%] px-b3 pb-b3 align-bottom">
                            Hazır program
                          </th>
                          <th className="etiket w-[45%] border-l-2 border-cetvel bg-yuzey px-b4 pb-b3 align-bottom">
                            Bizde
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {PIYASA.satirlar.map((s) => (
                          <tr key={s.baslik} className="border-b border-cizgi odd:bg-cukur">
                            <td className="py-b2 pr-b3 align-top text-govde text-ink-2">
                              {s.baslik}
                            </td>
                            <td className="px-b3 py-b2 align-top text-govde text-ink-2">
                              {s.hazir}
                            </td>
                            <td className="border-l-2 border-cetvel bg-yuzey px-b4 py-b2 align-top text-govde">
                              {s.bizde}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* İçerikteki ikinci "Teklif kâğıdı" düğmesi KALKTI: alt
                      şeritteki birincil düğmeyle yarışıyordu ve göz iki eylem
                      arasında bölünüyordu. Burada yalnız kaynak notu kalır. */}
                  <p className="mt-b3 text-etiket text-ink-3">
                    Hazır program fiyatları: {PIYASA.kaynak}.
                  </p>
                </section>
              )}
            </div>
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
            style={{ background: "linear-gradient(transparent, var(--color-kagit))" }}
          />
        </div>

        {/* --- 3. satır: eylem şeridi. Izgaranın satırı, `fixed` değil:
                içeriğin arkasında kalması artık yapısal olarak imkânsız. --- */}
        {/* PASİF DÜĞME HİÇBİR YERDE VURGU DOLGULU KALMAZ. Soluklaştırılmış
            kiremit bir düğme "devre dışı" değil "bozuk / yükleniyor" diye
            okunuyor ve göz önce ona gidiyordu. Pasif hâl artık 1px kenar +
            soluk mürekkep metin; son sayfada ise "İleri" DOM'dan tamamen
            çıkıyor (odak sırası da temizlensin) ve aynı yeri ekranın gerçek
            birincil eylemi alıyor: teklif kâğıdı. */}
        <div className="flex items-center gap-b3 border-t border-cizgi py-b3">
          <motion.button
            onClick={() => git(sayfa - 1)}
            disabled={sayfa === 0}
            whileTap={{ scale: 0.985 }}
            className="flex h-eylem items-center gap-b2 rounded-kontrol border border-cizgi-koyu px-b4 text-govde text-ink-2 disabled:border-cizgi disabled:text-ink-3"
          >
            <ChevronLeft className="size-4" /> Geri
          </motion.button>
          <span className="flex-1" />
          {sayfa === son ? (
            <Link
              href="/teklif"
              className="flex h-eylem items-center gap-b2 rounded-kontrol bg-vurgu px-b5 text-govde font-medium text-uzeri transition-colors active:bg-vurgu-koyu"
            >
              Teklif kâğıdı <ArrowRight className="size-4" />
            </Link>
          ) : (
            <motion.button
              onClick={() => git(sayfa + 1)}
              whileTap={{ scale: 0.985 }}
              // FİYAT SLAYTINDA "İLERİ" MÜREKKEP DOLGULU — HAYALET DEĞİL.
              // Ölçüldü: o sayfada ekrandaki en büyük kiremit kütle bu
              // düğmeydi, yani satın alma kararının verildiği ekranda renk
              // karardan UZAKLAŞMAYI işaret ediyordu; vurgu bütçesi amiral
              // kartın olmalı. Ama düğme hayalete indirilince ikinci bir
              // sorun doğdu: gösterimi yapan kişi aynı düğmeye arka arkaya
              // sekiz kez basıyor, eli tek bir görsel hedefe alışıyor ve
              // kadrajın sağ alt köşesindeki kütlenin bir kez sönüp sonra
              // geri yanması kol mesafesinden "düğme devre dışı kaldı" diye
              // okunuyordu. Düğmenin KİMLİĞİ (dolgulu, aynı kütle, aynı yer)
              // sekiz slayt boyunca sabit kalır; yalnız dolgu rengi bir kez
              // mürekkebe iner. Mürekkep zaten uygulamanın "kapat/ilerlet"
              // dolgusu (ayarlar levhasındaki "Tamam", kuyruktaki "Hepsine").
              // NOT: fiyat slaytında dolgu bir süre mürekkebe iniyordu
              // (vurgu bütçesini amiral karta bırakmak için). Ama aynı
              // konumdaki aynı düğmenin sekiz slayttan yalnız birinde renk
              // değiştirmesi kol mesafesinden hiyerarşi değil RENDER HATASI
              // gibi okunuyor. Gezinme kimliği sabit kalır; fiyat kartı
              // vurguyu kendi üst cetvelinden zaten alıyor.
              className="flex h-eylem items-center gap-b2 rounded-kontrol bg-vurgu px-b5 text-govde font-medium text-uzeri transition-colors active:bg-vurgu-koyu"
            >
              İleri <ChevronRight className="size-4" />
            </motion.button>
          )}
        </div>
    </div>
  );
}
