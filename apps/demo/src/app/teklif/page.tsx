"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Printer } from "lucide-react";
import { paketAl, tl, urunler } from "@/lib/fiyat";
import { useDemo } from "@/lib/durum";

// TEKLİF KÂĞIDI — görüşmede bırakılacak TEK sayfa.
//
// Neden var: karşı taraf "bir düşüneyim / ortağıma sorayım" derse elinde
// somut bir şey kalsın. Ekranda anlatılan şey akılda kalmaz, kâğıt kalır.
//
// KURALLAR
//  * Fiyat ARALIK DEĞİL TEK RAKAM (kullanıcı kararı, 12 Eyl 2026): tablodaki
//    her satır kesin tutardır, "kapsama göre" gibi kaçamak yok. Rakamların
//    kaynağı `fiyat.ts`; bu sayfa hesap yapmaz, yazar.
//  * Tasarruf/ucuzluk iddiası YOK: iki rakam yan yana durur, aradaki farkı
//    kâğıt söylemez (bkz. fiyat.ts dürüstlük notu).
//  * Abartı yok: "%40 artış" gibi ölçülmemiş iddia geçmiyor.
//  * Otomatik WhatsApp gönderimi VAAT EDİLMİYOR — kâğıtta da doğrusu yazılı.
//  * Baskıda ekran menüsü görünmez, gövde 10pt/1.4'e iner ve bölümler
//    `break-inside: avoid` ile parçalanmaz.
//
// GÖRÜNÜŞ: kâğıt artık ekranın geri kalanıyla AYNI malzemeden — aynı Archivo,
// aynı mürekkep tonları, aynı 2px cetveller. Eskiden ekran koyu, kâğıt beyazdı
// ve görüşmeden sonra masada kalan tek nesnenin gösterilen ürünle görsel
// akrabalığı sıfırdı. Şimdi çıktı "dışarıdan gelen ek" değil, demonun son
// sayfası. Tek metin değiştirmeden elde edilen en büyük satış kazancı bu.
//
// Kâğıt A4 ORANINDA (794 × 1123) çukur bir sahnede duruyor; araç şeridi
// kâğıdın DIŞINDA, çünkü basılan şeyin üstünde düğme olmaz. Oran ölçüyü de
// disipline ediyor: ekranda 2.375 oranında, yani A4'ten 1.7 kat uzun bir
// şerit vardı ve "kâğıt" değil "uzun bir kaydırma" gibi okunuyordu. İçerik
// buna göre sıkıştırıldı — altı madde iki sütuna, dört adım dört sütuna indi
// ve ürün satırlarındaki teslim alt satırı kalktı (teslim bilgisi paket
// satırında tek kez duruyor).

const YAPAR_PILATES = [
  {
    baslik: "Üyelik bitişlerini siz takip etmezsiniz",
    satir: "Her üyenin başlangıç, bitiş ve ödeme kaydı tek ekranda durur. " +
      "Liste bitişi en yakın olandan sıralanır; yenileme mesajı hazır bekler.",
  },
  {
    baslik: "Üye kendi yerini ayırtır",
    satir: "Üye telefonundan haftanın derslerini görür, tek tuşla yer ayırtır. " +
      "Ders doluysa bekleme listesine girer. Sizi aramaz, mesaj atmaz.",
  },
  {
    baslik: "Boşalan yer kendiliğinden dolar",
    satir: "Biri gelemeyeceğini bildirince yer, bekleme listesindeki ilk kişiye " +
      "anında geçer ve o kişiye gidecek mesaj hazır gelir. Siz bir şey yapmazsınız.",
  },
  {
    baslik: "Ders hatırlatması",
    satir: "Ders başlamadan 24 saat önce hatırlatma hazırlanır. Gelemeyecek olan " +
      "önceden bildirir, yer boşa gitmez.",
  },
  {
    baslik: "Uzun süredir gelmeyenler",
    satir: "Hakkı durduğu hâlde 3 haftadır uğramayan üyeler listelenir. " +
      "Kimse aramazsa sessizce düşen üyeler bunlar.",
  },
  {
    baslik: "Paketi bitmek üzere olanlar",
    satir: "Son dersler yaklaşınca haber verir; yenileme konuşması ders bitmeden " +
      "yapılır, saatler kaymaz. İsterseniz kendi ödeme linkiniz mesaja eklenir.",
  },
  {
    baslik: "Deneme dersine gelenler",
    satir: "Deneme dersinden sonra 1., 3. ve 7. gün mesajı sıraya girer. " +
      "Kaydolan ya da ilgilenmeyen işaretlenince mesaj kesilir.",
  },
];

// Psikolog sürümü: randevu alan danışan telefonda "bende son dakika iptali
// olmuyor, diğer yazılımları görmek isterim" dedi. Kâğıt da ona göre.
const YAPAR_PSIKOLOG = [
  {
    baslik: "İlk görüşme ön formu",
    satir: "Randevu alınınca danışana KVKK aydınlatmalı kısa bir form gider. " +
      "Cevaplar seanstan önce ekranınıza düşer; ilk seansı bilgi toplamakla " +
      "geçirmezsiniz.",
  },
  {
    baslik: "Seans arası günlük",
    satir: "Danışan gün içinde tek dokunuşla nasıl olduğunu işaretler, isterse " +
      "tek cümle ekler. Siz seanstan önce iki haftanın seyrini bir bakışta " +
      "görürsünüz. Kayıt danışanın kendi isteğiyle bırakılır.",
  },
  {
    baslik: "Online seans bağlantısı",
    satir: "Seansa 30 dakika kala bağlantı hazırlanır; her seferinde link " +
      "aramak, kopyalamak, göndermek yok.",
  },
  {
    baslik: "Ücret hatırlatması",
    satir: "Seans bitince hatırlatma, sizin kendi ödeme linkinizle hazırlanır. " +
      "Para doğrudan sizin hesabınıza gider, aradan kimse geçmez.",
  },
  {
    baslik: "Seans hatırlatma ve iptal kuralı",
    satir: "Seanstan 48 saat önce hatırlatma. Bir saat boşalırsa bekleyen " +
      "danışana açılır — ihtiyacınız yoksa bu kural kapalı kalır.",
  },
  {
    baslik: "Uzun süredir gelmeyenler",
    satir: "Hakkı durduğu hâlde bir aydır görüşülmeyen danışanlar listelenir. " +
      "Takip edip etmemek sizin kararınız; sistem sadece hatırlatır.",
  },
];

export default function TeklifPage() {
  const { durum, yukleniyor } = useDemo();
  const adi = durum.ayar.isletmeAdi;
  const iletisim = durum.ayar.iletisim;
  const psikolog = durum.ayar.deri === "psikolog";
  const liste = urunler(durum.ayar.deri);
  const paket = paketAl(durum.ayar.deri);
  const YAPAR = psikolog ? YAPAR_PSIKOLOG : YAPAR_PILATES;

  // Kayıtlı deri okunmadan kâğıt dizilmez: aksi hâlde psikolog kaydı varken
  // kâğıt önce pilates başlığı ve beş ürünle basılıp gözün önünde kendini
  // yeniden yazıyor. Masada kalan tek nesne bu; yanlış sürümü bir kare bile
  // göstermemeli. (Aynı koruma Sunum ve üst şeritte de var.)
  if (yukleniyor) return null;

  return (
    <div
      data-deri={durum.ayar.deri}
      className="pb-b6"
    >
      {/* Araç şeridi kâğıdın DIŞINDA: basılacak yüzeyin üstünde düğme olmaz.
          Ama kâğıtla AYNI kolondan başlar (794px, ortalanmış): şeridin sol
          kenarı x=24'te, kâğıdınki x=90'dayken ikisi birbiriyle ilgisiz iki
          nesne gibi duruyordu. */}
      {/* ŞERİT KÂĞITTAN GÖRSEL OLARAK AYRI: çukur zemin "bu, ürünün parçası
          değil, araç çubuğu" mesajını yapıyla veriyor. Sunucuya seslenen not
          (ikinci tekil şahıs) 17px gövde puntosunda ve şeridin ORTASINDAYDI —
          karşı taraf ekranı görürken sahne arkası notunu okuyordu. Artık
          "Geri"nin yanında, 13px, sönük ve doğal genişliğinde; sağ uçta yalnız
          "Yazdır" kalıyor. /program'daki "ÖRNEK VERİ" rozeti aynı işi böyle
          yapıyor: küçük, sönük, kenarda. */}
      {/* ŞERİT YAPIŞKAN: kâğıt 1123px + sahne dolgusu, yani 1024×768'de sayfa
          iki ekran sürüyor ve fiyat bölümü ekrana geldiğinde "Yazdır" ekranın
          DIŞINDA kalıyordu. Görüşmenin sonunda basılacak tek düğme, tam da o an
          bakılan yerde olmalı; sunucunun yukarı kaydırması küçük ama müşterinin
          gözü önünde olan bir sürtünme. `print:hidden` zaten var, baskıya
          etkisi yok. */}
      {/* YAPIŞKANLIK DIŞ SARMALAYICIDA, ŞERİDİN KENDİSİNDE DEĞİL.
          `sticky top-0` doğrudan şeritteyken şerit kaydırma başlar başlamaz
          pencere kenarına SIFIR boşlukla dokunuyor ve altındaki kâğıt tam
          dibinden geçiyordu: masaya konmuş bir kâğıdın üstünde yüzen araç
          şeridi değil, tarayıcının kendi çubuğu gibi okunuyordu. /teklif'te
          üst gezinme şeridi olmadığı için yukarıda onu tutan başka bir şey de
          yok. Sarmalayıcı kâğıt zeminli ve 12px üst dolgulu: pay geri geliyor,
          içerik de o payın arkasından görünmüyor. Baskıya etkisi yok. */}
      <div className="sticky top-0 z-10 bg-kagit pt-b3 print:hidden">
      <div className="mx-auto mb-b4 flex w-[794px] max-w-full flex-wrap items-center gap-b3 rounded-kontrol bg-cukur p-b3 shadow-kalkik-1">
        <Link
          href="/"
          className="flex h-dokunma shrink-0 items-center gap-b2 rounded-kontrol border border-cizgi-koyu bg-yuzey px-b3 text-govde"
        >
          <ArrowLeft className="size-4" /> Geri
        </Link>
        <p className="min-w-0 text-kunye text-ink-3">
          Görüşmede bırakacağın tek sayfa. Ctrl+P ile yazdır ya da PDF olarak kaydet.
        </p>
        {/* "YAZDIR" HAYALET DÜĞME. Mürekkep dolgu bu sistemde WhatsApp bağına
            ve toplu eyleme ayrılmış bir malzeme (Program'daki "Hepsine · 23",
            "Gönderildi"). Burada aynı dolgu bir yazıcı komutuna veriliyordu ve
            ekranın optik olarak en ağır öğesi oluyordu — kâğıdın kendi 34px'lik
            başlığından bile güçlü. Görüşmede masada kalacak nesne kâğıt,
            sunucunun aleti değil; sahnedeki tek ağırlık artık kâğıdın kendisi
            (kalkik-3) ve araç şeridi dolgulu hiçbir öğe taşımıyor. */}
        <motion.button
          onClick={() => window.print()}
          whileTap={{ scale: 0.985 }}
          className="ml-auto flex h-dokunma shrink-0 items-center gap-b2 rounded-kontrol border border-cizgi-koyu bg-yuzey px-b4 text-govde text-ink"
        >
          <Printer className="size-4" /> Yazdır
        </motion.button>
      </div>
      </div>

      {/* Nötr sahne: kâğıdın kâğıt olduğu ancak bir zemine oturunca anlaşılıyor. */}
      {/* --b7 (84px) sistemin en büyük boşluk adımı ve yalnız iki yerde
          kullanılıyor: Sunum kapağı ve bu sahne. Kâğıdın "bırakılan nesne"
          olduğunu etrafındaki boşluk söylüyor. */}
      <div className="flex justify-center rounded-sahne bg-cukur px-b5 py-b7 print:block print:bg-transparent print:p-0">
        {/* `.kagit` ölçüyü veriyor (794px genişlik, 18mm kenar payı, 10pt'nin
            ekrandaki karşılığı); `aspect` de A4 oranını taban yapıyor, böylece
            içeriği daha kısa olan psikolog derisinde kâğıt tam A4 kalıyor. */}
        {/* SERT A4 SINIRI: `aspect` oranı içerik taşınca esniyordu (ölçümde
            kâğıt 1123 yerine 1162px'ti, yani çıktı kıl payıyla ikinci sayfaya
            taşmak üzereydi). `h-[1123px] overflow-hidden` ile kutu artık
            esnemiyor: bir satır fazlası geliştirme sırasında GÖRÜNÜR oluyor,
            müşterinin elinde yarım ikinci sayfa olarak değil. */}
        <article className="kagit h-[1123px] max-w-full overflow-hidden rounded-kagit bg-baski shadow-kalkik-3 print:h-auto print:overflow-visible print:rounded-none print:shadow-none">
          {/* CETVEL MÜREKKEP, KİREMİT DEĞİL. 2px kiremit çizgi künyenin 8px
              altında duruyordu ve "bölüm ayracı" değil "künyenin altı çizili"
              gibi okunuyordu; üstelik vurgu baskıda griye düştüğü için kâğıdın
              tek renkli öğesi çıktıda anlamını kaybediyordu. Sistemin kuralı
              zaten "hiyerarşi renge değil ağırlığa yaslanır". Kâğıttaki tek
              kiremit artık paket kutusunun sol kenarındaki 2px dikey çizgi:
              orada baskıda solsa bile kutu --cukur zeminiyle ayrışıyor. */}
          <header className="border-b-2 border-cetvel pb-b3">
            <p className="etiket">Teklif</p>
            <h1 className="mt-b2 text-sayfa">
              {psikolog ? "Seans takibi ve danışan hattı" : "Ders rezervasyonu ve üye takibi"}
            </h1>
            <p className="mt-b2 text-govde text-ink-2">
              {adi
                ? `${adi} için hazırlandı`
                : psikolog
                  ? "Psikolojik danışmanlık için"
                  : "Pilates stüdyoları ve spor salonları için"}
              {" · Ad Soyad · yazılım"}
            </p>
          </header>

          <section className="mt-b2">
            <h2 className="etiket">Ne yapıyor</h2>
            {/* Altı madde alt alta kâğıdı tek başına yarım sayfa uzatıyordu;
                iki sütunda aynı metin, A4 oranını bozmadan duruyor. */}
            <ul className="mt-b2 grid gap-x-b5 sm:grid-cols-2">
              {YAPAR.map((y) => (
                <li key={y.baslik} className="border-b border-cizgi py-b1">
                  <p className="text-govde">
                    <b>{y.baslik}.</b> {y.satir}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-b2 bg-cukur p-b3">
            <h2 className="etiket">Nasıl çalışır</h2>
            <p className="mt-b2 text-govde">
              İki ekran var: {psikolog ? "danışanlarınızın" : "üyelerinizin"} telefonundan
              girdiği ekran ve sizin gördüğünüz program ekranı. İkisi aynı veriyi kullanır —
              {psikolog ? " danışan formu doldurduğu" : " üye yer ayırttığı"} anda sizin
              ekranınızda görünür.
            </p>
            <p className="mt-b2 text-govde">
              Mesajlar WhatsApp&apos;ta hazır metin olarak açılır, <b>gönder tuşuna
              siz basarsınız</b>. Otomatik gönderim WhatsApp&apos;ın ücretli
              kurumsal onayını gerektirir; istenirse o da ayrıca kurulabilir.
            </p>
          </section>

          <section className="mt-b2">
            <h2 className="etiket">Fiyat</h2>
            {/* Aralık YOK — kullanıcı kararı (12 Eyl 2026): tek rakam söylenir. */}

            {/* KALEM TABLOSU — EKRANDAKİ LİSTEYLE AYNI IZGARA.
                Beş kalem akan metin içinde diziliyor, kurulum bedelleri her
                satırda başka bir x'te bitiyordu. Gerekçesi "kâğıtta toplama
                sütunu kurulmasın"dı; o gerekçe artık geçersiz, çünkü Sunum'un
                fiyat sayfası aynı beş rakamı sağa hizalı bir sütunda veriyor ve
                toplamı ("Tek tek alınırsa 68.000 ₺") kendisi açıkça yazıyor.
                Yani hizayı gizlemek hiçbir şeyi önlemiyor, yalnız masada KALAN
                nesneyi — müşterinin sonra tek başına bakacağı yeri — taranamaz
                kılıyordu: hangi kalemin ne tuttuğunu karşılaştırmak için
                rakamların tek eksende bitmesi gerekiyor. Aynı veri iki ekranda
                iki farklı yapıda durmuyor artık.
                TOPLAM SATIRI YOK ve ayraç çizgisi de eklenmedi: sağa hizalı
                sütun tabloyu zaten kuruyor, paket kutusu ise kendi etiketiyle
                ve SOLA yaslı rakamıyla ayrı bir cins taahhüt olarak duruyor.
                Aylık bedel adın yanında kalıyor — ikinci satıra inseydi beş
                satır ~80px büyür ve kâğıdın sert A4 sınırını zorlardı. */}
            <ul className="mt-b2">
              {liste.map((u) => (
                <li
                  key={u.kod}
                  // Dikey dolgu YOK: satırın yüksekliğini 17px'lik fiyatın
                  // kendi satır kutusu (23px) veriyor. Kâğıt A4'e SIĞMAK
                  // zorunda (kutu `h-[1123px] overflow-hidden`), fiyat listesi
                  // de bir belgede zaten sık dizilir.
                  //
                  // `grid-cols-[1fr_auto]`: sağ hücre kendi içeriği kadar ve
                  // satırın sağ ucunda, yani beş rakamın SAĞ kenarı tek düşey
                  // eksende. Sunum'daki kalem listesi de birebir bu ızgarayı
                  // kullanıyor.
                  className="grid grid-cols-[1fr_auto] items-baseline gap-b3 border-b border-cizgi text-govde text-ink-2"
                >
                  <span>
                    {u.ad}
                    {/* ₺ DAİMA `.para`: aynı satırda kurulum bedelinin işareti
                        0.62em'ken aylığınki tam puntoydu — masada kalan TEK
                        nesnede, yan yana, kol mesafesinden görülen bir
                        dikkatsizlik. */}
                    <span className="tnum text-ink-3">
                      {" · "}aylık {tl(u.aylik)}<span className="para"> ₺</span>
                    </span>
                  </span>
                  <b className="tnum text-one font-semibold text-ink">
                    {tl(u.kurulum)}<span className="para"> ₺</span>
                  </b>
                </li>
              ))}
            </ul>

            {/* PAKET: ayrımı renkli çizgi değil BOŞLUK kuruyor (--b5). Rakam
                sütunun devamı gibi sağ altta değil, kendi etiketinin altında
                SOLDA; sağda yalnız aylık bedel duruyor. Böylece iki rakam iki
                ayrı CİNS taahhüt olarak okunuyor ve dikey bir toplama sütunu
                hiç oluşmuyor. */}
            {/* AYLIK BEDEL EKRANDA MANŞET, KÂĞITTA DİPNOT OLAMAZ. Sunum'un
                fiyat sayfasında aylık bakım kendi etiketiyle ve 44px'lik
                rakamıyla İKİNCİ BİR CİNS TAAHHÜT olarak duruyordu; kâğıtta ise
                sağ altta 17px'lik bir künyeydi. Kâğıda tek başına bakan kişi
                için aylık taahhüdün ağırlığı kayboluyor, iki belge aynı rakam
                hakkında iki farklı hiyerarşi anlatıyordu. Artık kâğıtta da
                etiket + rakam + "her ay": 23px'lik bölüm puntosu, 34px'lik
                kurulum bedeliyle arasında 1.48 kat fark bırakıyor — iki ayrı
                cins, tek bir toplama sütunu yok. Sol kenardaki 2px kiremit
                kâğıdın tek vurgusu. */}
            {/* İKİ RAKAM AYNI TABAN ÇİZGİSİNDE — ÜÇ SATIRLI IZGARA.
                Önce `flex items-end` vardı: blokların ALT kenarı hizalanıyor,
                solda rakamın altında bir satır daha ("teslim 2 hafta") olduğu
                için 45.000 yukarıda, 2.500 yaklaşık 9px aşağıda kalıyordu.
                `items-baseline` tek başına da yetmedi — flex'te hizalanan şey
                blokların İLK satırı, yani rakamlar değil ETİKETLER oluyor ve
                34px ile 23px rakam yine 7px kayıyordu. Izgarada etiketler
                birinci satırı, rakamlar İKİNCİ satırı paylaşıyor; `items-
                baseline` her satırı kendi içinde hizalıyor, yani iki manşet
                rakam gerçekten aynı taban çizgisinde buluşuyor. Teslim bilgisi
                de rakamın altından çıkıp iki kolonun ortak künyesi oldu. */}
            <div className="mt-b4 grid grid-cols-[1fr_auto] items-baseline gap-x-b3 border-l-2 border-vurgu bg-cukur p-b2">
              <p className="etiket">{paket.ad} · bir kez</p>
              <p className="etiket">aylık bakım</p>
              <p className="tnum mt-b1 text-sayfa">
                {tl(paket.kurulum)}<span className="para"> ₺</span>
              </p>
              <p className="mt-b1 flex items-baseline gap-b2">
                <span className="tnum text-bolum">
                  {tl(paket.aylik)}<span className="para"> ₺</span>
                </span>
                <span className="etiket">her ay</span>
              </p>
              {/* ink-3 DEĞİL ink-2: bu satır kâğıdın en küçük metni ve tam da
                  fiyat kutusunun içinde duruyor; baskıda gri tonlamayla
                  birlikte en soluk mürekkep okunmuyordu. Punto tabanı
                  globals.css'te `.kagit .text-etiket` ile kalktı. */}
              <p className="tnum col-span-2 text-etiket font-normal text-ink-2">
                teslim {paket.teslim}
              </p>
            </div>
            <p className="mt-b2 text-govde text-ink-2">
              Fiyatlar nettir, sonradan eklenen kalem yoktur. İstemediğiniz bölüm
              kapalı kalır ve ücreti olmaz. Aylık bakıma sunucu, yedek, arıza ve
              küçük değişiklikler dahildir. Ödemeleriniz kendi hesabınıza gider,
              aradan kimse geçmez.
            </p>
          </section>

          {psikolog && (
            <section className="mt-b2 border-t-2 border-cetvel pt-b2">
              <h2 className="etiket">Veri ve gizlilik</h2>
              <p className="mt-b2 text-govde">
                Ön form ve günlük kayıtları yalnızca KVKK onayı verildikten sonra
                kaydedilir; onay yoksa sistem kaydı almaz. Kayıtlar sizin
                kurulumunuzda durur, üçüncü bir tarafa gönderilmez.
              </p>
            </section>
          )}

          <section className="mt-b2">
            <h2 className="etiket">Nasıl ilerler</h2>
            {/* OKLARLA BİRLEŞTİRİLMİŞ TEK PARAGRAF KALKTI. Üç adım kâğıdın en
                küçük puntosunda sürekli metin olarak diziliyordu; aşağıda
                ~80px ölü bant dururken sayfanın alt üçte biri sıkışıyordu.
                Numaralı liste sırayı gözle okunur yapıyor ve kazanılan yer o
                ölü bandı yiyor — tek sayfa kuralı bozulmuyor. */}
            <ol className="mt-b2">
              {[
                `${psikolog ? "Danışan listenizi ve seans saatlerinizi" : "Üye listenizi ve ders programınızı"} alırım.`,
                `Sisteme kurarım, kendi ${psikolog ? "kliniğinizin" : "stüdyonuzun"} verisiyle çalışır hâle getiririm.`,
                `Size ve ${psikolog ? "ekibinize" : "eğitmenlere"} 20 dakikada gösteririm — kullanması tek ekran.`,
              ].map((adim, i) => (
                <li key={adim} className="flex gap-b3 text-govde text-ink-2">
                  <span className="etiket tnum w-[3ch] shrink-0">{i + 1}</span>
                  <span>{adim}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* SATIŞIN EN GÜÇLÜ CÜMLESİ DİPNOT DEĞİL.
              Akışın son adımıydı ve 10px'lik gri bir paragrafın içinde
              kayboluyordu; aynı cümle Sunum'un fiyat sayfasında kendi
              dürüstlük şeridinde 17px'te duruyor. Masada kalan TEK nesnede
              risksizlik vaadinin dipnot kademesinde olması ekran ile kâğıt
              arasındaki hiyerarşi sözleşmesini kopartıyordu. Artık kâğıdın
              ikinci en büyük metni ve imzanın hemen üstünde. */}
          <p className="mt-b2 bg-cukur px-b3 py-b1 text-one">
            Bir hafta deneyin. Beğenmezseniz bir bedeli yok.
          </p>

          <footer className="mt-b3 border-t-2 border-cetvel pt-b2">
            <p className="text-govde">
              <b>Ad Soyad</b> · İstanbul
            </p>
            {iletisim ? (
              <p className="mt-b1 text-govde text-ink-2">
                <b className="tnum text-ink">{iletisim}</b> — sorularınız için istediğiniz zaman
                arayabilir ya da WhatsApp&apos;tan yazabilirsiniz.
              </p>
            ) : (
              // Numara ayarlardan girilmediyse "arayın" demek anlamsız olur.
              <p className="mt-b1 text-govde text-ink-2">
                Sorularınız için istediğiniz zaman ulaşabilirsiniz.
              </p>
            )}
          </footer>
        </article>
      </div>
    </div>
  );
}
