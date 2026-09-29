"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useDemo } from "@/lib/durum";
import { aylikOzet } from "@/lib/islem";
import {
  Belir, belir, Cetvel, Cubuk, Halka, SAHNE, Sayac, Sutun, sira,
} from "@/components/animasyon";

// AYLIK DOLULUK ÖZETİ — 5. ürün.
//
// Uydurma rapor değil: her rakam işletmenin kendi kayıtlarından hesaplanıyor
// (bkz. islem.ts / aylikOzet). Stüdyo sahibinin elle tablo tutarak
// öğrenebileceği ama pratikte hiç tutmadığı şeyler.
//
// RENK KURALI (bu ekranın bütün mesele si): eskiden çubuk rengi MUTLAK eşikten
// geliyordu (<%50 kırmızı, <%75 sarı, üstü yeşil) ve doluluk %56-%59 arasına
// sıkıştığı için on çubuğun onu da aynı hardal renkteydi — yani grafik hiçbir
// şey söylemiyordu. Artık renk VERİ İÇİ GÖRELİ KONUMDAN geliyor: setin en
// yükseği mürekkep, en düşüğü vurgu, kalan hepsi sönük. İki işaretli, gerisi
// sessiz — göz nereye bakacağını biliyor.
//
// KIRILIM `lg`: eski `xl` (1280px) gösterim cihazında (1024×768 tablet) HİÇ
// devreye girmiyordu; iki sütunlu yerleşim hiç görünmedi.

/** Setin tamamı anlamsız farktaysa hiçbir şey işaretlenmez. */
const YAYILIM_ESIGI = 0.08;

/**
 * Setin renk haritası: en yüksek DEĞER mürekkep, en düşük DEĞER vurgu,
 * gerisi sönük.
 *
 * ÜÇ HATANIN SONUNCUSU DA KAPANDI.
 *  1. Önce renk MUTLAK eşikten geliyordu (<%50 kırmızı, <%75 sarı) ve doluluk
 *     %56-%59 arasına sıkıştığı için on çubuğun onu da aynı hardaldı.
 *  2. Sonra kural eşitliğe bağlandı ama az kademeli veride dejenere oldu:
 *     dört çubuk mürekkep, iki vurgu, SIFIR sönük — "hepsi işaretli".
 *  3. Sonra işaretleme `indexOf` ile İLK eşleşmeye bağlandı ve grafik
 *     kendi kendisiyle çelişmeye başladı: canlıda ölçüldü, 09:30 ile 12:00
 *     ikisi de %50 ve piksel piksel aynı yükseklikteydi ama biri kiremit
 *     biri griydi; 18:30 ile 20:00 ikisi de %67, biri mürekkep biri gri.
 *     Aynı sayının iki renkte olduğunu gören stüdyo sahibi üç saniyede
 *     grafiğin doğruluğundan şüphe eder — bu ekranın tek işi güven vermek.
 *
 * Kural artık DEĞERE bakıyor, sıraya değil: uç değeri PAYLAŞAN her çubuk aynı
 * rengi alır. Dejenerasyona karşı koruma yayılım kapısında: yayılım 8 puandan
 * küçükse set bütünüyle sönük çizilir ve sebebi yazıyla söylenir.
 *
 * İKİNCİ KAPI — ÇOĞUNLUK SÖNÜK KALMALI. Dört değerli bir sette iki uç değeri
 * paylaşanlar dörtte dördü işaretliyordu: iki mürekkep, iki vurgu, SIFIR
 * sönük. "Çoğunluk sessiz, uçlar işaretli" kuralının çalışması için sönük
 * kalanlar setin en az yarısı olmalı; olamıyorsa yalnız EN DÜŞÜK işaretlenir
 * (eyleme çağıran değer odur — boş saat doldurulabilir, dolu saat zaten iyi).
 * Mürekkep tonu altı ve daha çok kademeli setlere saklanıyor. Bu aynı zamanda
 * /ozet'in vurgu bütçesini dörtten üçe indiriyor.
 *
 * VURGU TAVANI — İŞARET ÇOĞUNLUK OLAMAZ. İkinci kapı yalnız en düşüğü
 * işaretliyordu ama "en düşük" birden çok çubuk olabiliyor: gün grafiğinde
 * altı çubuğun DÖRDÜ kiremit çıkıyordu. Altıda dört işaretliyse işaret değil
 * kategori rengi olur; göz nereye bakacağını yine bilmez ve kırmızıya yakın
 * bir ton, "doluluk" başlıklı bir grafikte açıklamasız biçimde çoğunluğu
 * kaplar. Tavan 2: işaretlenecek çubuk sayısı bunu aşıyorsa hiçbiri
 * işaretlenmez — grafik "fark yok" bilgisini renkle değil uzunlukla söyler.
 * (Fonksiyonun başındaki yayılım kapısının mantığıyla birebir aynı: bilgi
 * yoksa vurgu da yok.)
 */
const VURGU_TAVANI = 2;

function renkHaritasi(oranlar: number[]): string[] {
  const enYuksek = Math.max(...oranlar);
  const enDusuk = Math.min(...oranlar);
  if (enYuksek - enDusuk < YAYILIM_ESIGI) return oranlar.map(() => "bg-veri-sonuk");
  const isaretli = oranlar.filter((o) => o === enYuksek || o === enDusuk).length;
  if (isaretli > oranlar.length / 2) {
    const dusukSayisi = oranlar.filter((o) => o === enDusuk).length;
    const yuksekSayisi = oranlar.filter((o) => o === enYuksek).length;
    if (dusukSayisi > VURGU_TAVANI) {
      // Düşükler kalabalık: onları işaretlemek "çoğunluk kırmızı" tablosu
      // yapardı. AMA en yüksek hâlâ bilgi taşıyor ve başlık bir SORU soruyor
      // ("Hangi gün yoğun geçiyor?"). Grafiği tamamen griye indirmek soruyu
      // cevapsız bırakıyordu — göz önce grafiğe gidiyor, altındaki özet
      // cümlesine değil. Tek bir koyu mürekkep işaret soruyu cevaplar ve
      // vurgu bütçesini harcamaz.
      return yuksekSayisi <= VURGU_TAVANI
        ? oranlar.map((o) => (o === enYuksek ? "bg-ink" : "bg-veri-sonuk"))
        : oranlar.map(() => "bg-veri-sonuk");
    }
    return oranlar.map((o) => (o === enDusuk ? "bg-vurgu" : "bg-veri-sonuk"));
  }
  return oranlar.map((o) =>
    o === enYuksek ? "bg-ink" : o === enDusuk ? "bg-vurgu" : "bg-veri-sonuk",
  );
}

/** Üst satırdaki ikincil rakamların tek tipi. */
interface Kunye { etiket: string; deger: number; alt: string; dikkat: boolean }

/**
 * ÇUKUR KÜNYE KUTUSU — İKİ YERDE AYNI NESNE.
 *
 * Üçü de üst satırdaydı; biri alt satırın SAĞ kolonuna indi (gerekçe orada
 * yazılı) ve iki yerde birebir aynı görünmesi gerektiği için kutu tek bir
 * yerde tanımlı.
 *
 * Köşe dili aynı görsel bantta çatallanmaz: künyeler de altlarındaki
 * panellerle aynı 14px'i konuşur. `.cukur-zeminde`: bu kutular doğrudan KÂĞIT
 * zemininde duruyor (beyaz kart içinde değil). Çukur ton kâğıda karşı 1.10:1;
 * kıl kenar sınırı garantiye alıyor, yoksa manşetin yanındaki üç künye tek bir
 * düz metin bloğu gibi okunuyordu.
 */
function KunyeKutu({ k }: { k: Kunye }) {
  return (
    <div
      className={`cukur-zeminde rounded-yuzey p-b4 ${
        k.dikkat ? "border-l-2 border-durum-dikkat" : ""
      }`}
    >
      <p className="etiket">{k.etiket}</p>
      {/* `text-veri` (34px), `text-sayfa` (44px) DEĞİL: bu rakamlar sayfanın
          h1'iyle aynı puntodayken başlık ile veri kardeş okunuyordu —
          hiyerarşide h1'in kazanacağı bir yer kalmıyordu. */}
      <p className={`mt-b2 text-veri ${k.dikkat ? "text-durum-dikkat" : ""}`}>
        <Sayac deger={k.deger} />
      </p>
      <p className="tnum mt-b1 text-govde text-ink-3">{k.alt}</p>
    </div>
  );
}

export default function OzetPage() {
  const { durum, deri, yukleniyor } = useDemo();
  const o = useMemo(() => aylikOzet(durum, deri), [durum, deri]);

  if (yukleniyor) return null;

  const yuzde = (x: number) => `%${Math.round(x * 100)}`;
  // TÜRKÇE LİSTE KURALI: üç ve daha fazla öğe "a, b ve c" diye bağlanır.
  // `join(" ve ")` ekranda "09:30 ve 12:00 ve 18:30 ve 20:00" üretiyordu —
  // bu zincir doğrudan "otomatik üretilmiş metin" imzası; ürünün kendi
  // cümlesini bir şablon gibi gösteriyor.
  const veIle = (a: string[]) =>
    a.length < 2 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} ve ${a[a.length - 1]}`;
  // En boş saat: stüdyo sahibinin ilk bakacağı şey bu.
  //
  // UÇ DEĞERİ PAYLAŞAN SAATLERİN HEPSİ YAZILIR. Tek bir saat seçilirken
  // grafikte iki çubuk aynı renkteyken cümle yalnız birini adlandırıyordu;
  // "en dolu saat 18:30" diyen bir yazının yanında 20:00 de mürekkep olunca
  // metin ile grafik birbirini yalanlıyor. Renk kuralı değere bakıyor, cümle
  // de değere bakmalı.
  const saatOranlari = o.saatler.map((x) => x.oran);
  const enDoluOran = saatOranlari.length ? Math.max(...saatOranlari) : 0;
  const enBosOran = saatOranlari.length ? Math.min(...saatOranlari) : 0;
  const enDolular = o.saatler.filter((s) => s.oran === enDoluOran).map((s) => s.saat);
  const enBoslar = o.saatler.filter((s) => s.oran === enBosOran).map((s) => s.saat);
  // EŞİTLİK KAPISI: uçlar aynı orandaysa "en boş" ile "en dolu" AYNI saatler
  // olur ve cümle kendi kendini yalanlar — canlıda birebir şu satır
  // duruyordu: "En boş saatler 09:30 ve 12:00 ve 18:30 ve 20:00 (%0), en dolu
  // saatler 09:30 ve 12:00 ve 18:30 ve 20:00 (%0)". Kendini yalanlayan bir
  // cümle, arayüzün üretebileceği en hızlı güven kaybıdır: okuyan kişi o
  // andan sonra sayfadaki hiçbir rakama inanmaz. Uçlar eşitken karşılaştırma
  // cümlesi kurulmaz, tek satırlık künye yazılır.
  const ayirtEdiciSaat = enDoluOran > enBosOran;
  const saatRenkleri = renkHaritasi(saatOranlari);
  const gunOranlari = o.gunler.map((g) => g.oran);
  const gunRenkleri = renkHaritasi(gunOranlari);
  const gunYayilimi = Math.max(...gunOranlari) - Math.min(...gunOranlari);
  // GÜN GRAFİĞİNİN DE KENDİ AÇIKLAMA ŞERİDİ VAR — komşusuyla aynı kalıpta.
  // Saat grafiği "en boş X, en dolu Y" cümlesini altına yazarken gün grafiği
  // hiçbir şey yazmıyordu: iki komşu grafik aynı renk sözleşmesini iki farklı
  // sertlikte uyguluyordu. Vurgu tavanı çubukları sönüğe indirdiği için bilgi
  // ARTIK YALNIZ BURADA — cümle süs değil, grafiğin okunmasının kendisi.
  const enDoluGunOran = gunOranlari.length ? Math.max(...gunOranlari) : 0;
  const enBosGunOran = gunOranlari.length ? Math.min(...gunOranlari) : 0;
  const enDoluGunler = o.gunler.filter((g) => g.oran === enDoluGunOran).map((g) => g.gun);
  const enBosGunler = o.gunler.filter((g) => g.oran === enBosGunOran).map((g) => g.gun);

  // İkincil rakamlar: doruk rakam SAYFA BAŞINA TEK. İkincisi konursa ikisi de
  // ölür — bu yüzden ortalama doluluk 76px, kalan üçü 44px.
  //
  // DORUK RAKAM NEDEN DOLULUK: eskiden "Yapılan ders 24 / 24 ders planlandı"
  // idi, yani %100 — planlananın tamamı yapılmış. Bu bir başarı değil bir
  // sabit; 76px'i hak etmiyor ve stüdyo sahibine hiçbir şey söylemiyordu.
  // Ortalama doluluk tek başına cironun kendisidir.
  const ikincil: Kunye[] = [
    {
      // "Boş giden yer" yazıyordu ve kapasite artığını kayıp gibi
      // gösteriyordu (192 yerin 144'ü boş → "144 kayıp"). Tartışmaya
      // açık bir rakamla başlamak yerine tartışılmaz olanı gösteriyoruz.
      etiket: "İptal edilen", deger: o.iptal,
      alt: `Son ${o.gunSayisi} günde`,
      dikkat: false,
    },
    {
      etiket: `Aktif ${deri.uye}`, deger: o.aktifUye,
      alt: `${o.paketiBiten} kişinin paketi bitiyor`,
      dikkat: false,
    },
    {
      // EYLEME ÇAĞIRAN TEK KÜNYE: üç kutu birebir aynı olduğunda "bir manşet
      // üç künye" kurulmuş ama künyeler kendi aralarında hiç ayrışmamış
      // oluyordu. Dikkat rengi ekran başına en fazla iki yerde; burası biri.
      etiket: `Eriyen ${deri.uye}`, deger: o.eriyenUye,
      alt: `${deri.erimeGun} gündür gelmeyen`,
      dikkat: true,
    },
  ];
  // SAYFA BAŞTAN SONA 8/4 — VE SAĞ KOLON GERÇEKTEN DOLU.
  // "Gün gün" bandı doğru şekilde soldaki karta indi ama sol kartı ~130px
  // uzattı: alt satırdaki iki kartın farkı 70px'ten 353px'e çıktı (ölçüldü,
  // 1024×768: sol 620×881, sağ 294×528) ve sayfanın kapanışı sağ altta koca
  // bir boş kâğıt oldu. 70px "kasıtlı asimetri" diye okunabiliyordu, 353px
  // "bir şey eksik kalmış" diye okunuyor — bu ekranın kodda yazılı tek işi
  // güven vermek, bitişi yarım görünen bir sayfa tam tersini yapıyor.
  // Çözüm kartı zorla uzatmak (h-full, ortasında ölü bant) değil, sağ kolona
  // GERÇEK içerik vermek: üç künyeden biri oraya iniyor. Üst satır iki künyeye
  // düşüyor (12 kolonda 5 + 3.5 + 3.5), alt satırın sağ kolonu uzuyor.
  // Üst satır 5+3.5+3.5 iken sağ kolona tek künye inince fark 353'ten 191px'e
  // düşüyordu, yani hâlâ "bir şey eksik kalmış". İki künye inince fark 60px'in
  // altına iniyor VE ızgara sadeleşiyor: üst satır da alt satır gibi 8/4 olur,
  // sağ kenarda tek bir künye ekseni kurulur (üstte bir kutu, altta halka
  // kartı, onun altında iki kutu daha) ve dördünün de sol kenarı aynı x'te
  // başlar. Manşet 8 kolona çıkınca altındaki cetvel de saat grafiğinin
  // kartıyla aynı genişlikte biter — iki satır arasındaki hizayı da bu kuruyor.
  // KOLON DENGESİ KARTI UZATARAK DEĞİL, YÜKÜ TAŞIYARAK KURULUR.
  // Alt satırın sağ kolonu iki künyeyle 868px'e çıkınca sol kart `h-full` ile
  // ona eşitlenmişti: kart 868, içeriği 626'da bitiyor, altında 242px bomboş
  // beyaz kâğıt. Sayfanın en büyük beyaz yüzeyinin dörtte biri boş — bu
  // dosyanın kendi yorumlarının (aşağıda, halka kartında) adıyla reddettiği
  // çözüm. `h-full` kalkıyor; dengeyi sağlamak için künyelerden biri
  // ("Eriyen üye", eyleme çağıran tek künye) ÜST satıra, manşetin yanındaki
  // künyenin altına çıkıyor. Sağ kolon 868'den 714'e iner, sol kart kendi
  // içeriği kadar (626) kalır ve hiçbir kartın içinde ölü bant olmaz.
  const ustKunyeler = [ikincil[1], ikincil[2]];
  const yanKunyeler = [ikincil[0]];

  return (
    <div
      data-deri={durum.ayar.deri}
      className="flex flex-col gap-b6 pb-b6"
    >
      {/* ------------------------------------------------------------ başlık */}
      <motion.header {...belir(SAHNE.cetvel)}>
        <Cetvel />
        <p className="etiket mt-b3">Aylık özet</p>
        <h1 className="mt-b1 text-sayfa">
          <span className="tnum">Son {o.gunSayisi} günün özeti</span>
        </h1>
        <p className="olcu mt-b3 text-govde text-ink-2">
          Hepsi kendi kayıtlarınızdan hesaplanır — elle tablo tutmazsınız.
        </p>
      </motion.header>

      {/* ------------------------------------------------ üst dört rakam ---
          Birincil 5 kolon + doruk rakam; diğer üçü 2.33'er kolon ve çukur
          zeminli. Dört eşit kart yerine bir manşet ve üç künye. */}
      <motion.div
        variants={sira.kap}
        initial="gizli"
        animate="gorunur"
        className="grid gap-b4 lg:grid-cols-12"
      >
        {/* `.doruk-onek`: Türkçede "%" rakamdan ÖNCE gelir, bu yüzden fiyat
            slaytındaki taşma hamlesi burada kurulamaz — taşacak olan glif
            rakam değil soluk işaret olurdu. Blok tek sol kenarda duruyor;
            manşet karakterini ölçek veriyor. Gerekçe globals.css'te.
            Sayfanın tek doruk rakamı budur. */}
        <motion.div
          custom={0}
          variants={sira.oge}
          className="doruk-onek lg:col-span-8"
        >
          <p className="etiket">Ortalama doluluk</p>
          <p className="genis doruk-rakam mt-b2 text-kapak">
            <Sayac deger={Math.round(o.doluluk * 100)} bas="%" />
          </p>
          <Cetvel gecikme={SAHNE.rakam} />
          <p className="tnum mt-b2 text-govde text-ink-2">
            {o.yapilanDers} / {o.toplamDers} {deri.seans} yapıldı
          </p>
        </motion.div>

        {/* Manşetin yanındaki künye ekseni: kalan 4 kolon, yani altındaki
            halka kartıyla birebir aynı genişlik ve aynı sol kenar. Sağ kenarda
            yukarıdan aşağı tek bir künye sütunu kuruluyor. */}
        <motion.div
          custom={1}
          variants={sira.oge}
          className="flex flex-col gap-b4 lg:col-span-4"
        >
          {ustKunyeler.map((k) => <KunyeKutu key={k.etiket} k={k} />)}
        </motion.div>
      </motion.div>

      {/* ------------------------------------------------ gün gün doluluk ---
          SIRA DEĞİŞTİ: bu bölüm eskiden sayfanın SONUNDAYDI ve ekran "burada
          görülecek bir şey yok" cümlesiyle kapanıyordu — satış ekranının son
          bakışı boş bir grafiğe düşmemeli. Şimdi genelden özele okunuyor
          (gün → saat → dönüşüm) ve sayfa eyleme çağıran halkayla bitiyor. */}
      {/* FARK EŞİĞİN ALTINDAYSA BÖLÜM DİYE BİR ŞEY KURULMAZ.
          Eskiden 2px cetvel + 13px etiket + 30px başlık + alt yazı basılıyor,
          sonra grafik yerine tek satırlık gri bir not geliyordu — sayfanın en
          büyük ikinci başlık bloğu bir grafik vaat edip dipnot teslim ediyordu.
          O dönemde tohum veride yayılım HER ZAMAN eşiğin altındaydı, yani boş
          hâl demonun değişmez hâliydi.
          İPTAL TOHUMU DÜZELTİLDİKTEN SONRA (bkz. veri.ts) DURUM TERSİNE
          DÖNDÜ: iki deride de yayılım eşiğin ÜSTÜNDE (pilateste %59-%69,
          psikologda %75-%100) ve gösterimde artık hep bu gerçek grafik
          açılıyor. Aşağıdaki eşik-altı band ölü kod değil, gerçekten düz
          günlere sahip bir işletmenin verisinde devreye giren yedek yol —
          ama demonun VARSAYILAN hâli bu bölümdür.

          Eşik altında artık başlıksız bir CETVEL ŞERİT var: gün başına eşit
          yükseklikte bir blok. Çubuk değil — zorla renklendirilmiş altı çubuk
          yanıltıcı olurdu; şerit "yedi gün, hepsi aynı" bilgisini yapının
          kendisiyle söylüyor ve "fark yok" cümlesi şeridin ALTINDA kanıtlanmış
          oluyor. Eşik aşılınca bölüm başlığıyla birlikte gerçek grafik gelir. */}
      {gunYayilimi >= YAYILIM_ESIGI && (
        <Belir gecikme={SAHNE.yuzey}>
          <section>
            <Cetvel gecikme={SAHNE.baslik} />
            <p className="etiket mt-b3">Gün gün</p>
            {/* ETİKET KATEGORİ, BAŞLIK SORU — komşu bölümdeki kalıbın aynısı
                ("Saat saat" / "Hangi saat boş geçiyor?"). Başlık "Gün gün
                doluluk" iken etiketin birebir tekrarıydı: iki satır tek bilgi
                için harcanıyor ve kol mesafesinden kekeme okunuyordu. */}
            <h2 className="mt-b1 text-bolum">Hangi gün yoğun geçiyor?</h2>
            <p className="olcu mt-b2 text-govde text-ink-2">
              Hangi gün yoğun, hangi gün seyrek — eğitmen planlaması buna göre yapılır.
            </p>
            {/* SATIR ARALIĞI --b4 (20px). İşaretli satırların yüzdesi 600
                ağırlıkta: renk işaretini tipografi de tekrarlıyor, böylece gri
                tonlamada ve gün ışığında bilgi kaybolmuyor. */}
            <div className="mt-b4 flex flex-col gap-b4">
              {o.gunler.map((g, i) => {
                const isaretli = gunRenkleri[i] !== "bg-veri-sonuk";
                return (
                  <div key={g.gun} className="flex items-center gap-b4">
                    <span
                      className={`w-12 shrink-0 text-govde ${
                        isaretli ? "font-semibold text-ink" : "text-ink-2"
                      }`}
                    >
                      {g.gun}
                    </span>
                    <div className="flex-1">
                      <Cubuk
                        oran={g.oran}
                        gecikme={SAHNE.detay + 0.05 * i}
                        renk={gunRenkleri[i]}
                      />
                    </div>
                    <span
                      className={`tnum w-14 shrink-0 text-right text-govde ${
                        isaretli ? "font-semibold" : ""
                      }`}
                    >
                      {yuzde(g.oran)}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Saat grafiğindeki açıklama şeridiyle BİREBİR aynı kutu: aynı
                çukur zemin, aynı dolgu, aynı cümle sırası (önce boş gün,
                çünkü eyleme çağıran değer odur). */}
            <p className="olcu mt-b4 bg-cukur px-b4 py-b3 text-govde text-ink-2">
              En boş {enBosGunler.length > 1 ? "günler" : "gün"}{" "}
              <b className="text-ink">{veIle(enBosGunler)}</b> ({yuzde(enBosGunOran)}),
              en dolu {enDoluGunler.length > 1 ? "günler" : "gün"}{" "}
              <b className="text-ink">{veIle(enDoluGunler)}</b> ({yuzde(enDoluGunOran)}).
            </p>
          </section>
        </Belir>
      )}

      <div className="grid gap-b5 lg:grid-cols-12">
        {/* -------------------------------------------- saat saat doluluk */}
        {/* `lg:self-start`: kart komşusuyla aynı ÜST hizada başlar, kendi
            içeriği bittiğinde biter. Izgara varsayılanı (stretch) + `h-full`
            ikilisi kartı 868px'e uzatıp altında 242px ölü beyaz bant
            bırakıyordu. */}
        <Belir gecikme={SAHNE.yuzey} className="lg:col-span-8 lg:self-start">
          <section className="rounded-yuzey bg-yuzey p-b5 shadow-kalkik-2">
            <Cetvel gecikme={SAHNE.baslik} />
            <p className="etiket mt-b3">Saat saat</p>
            {/* BAŞLIĞIN FİİLİ İLE KİREMİDİN İŞARET ETTİĞİ ŞEY AYNI YÖNE
                BAKAR. Başlık "Hangi saat doluyor?" iken renk kuralı EN BOŞ
                saatleri vurguyla işaretliyordu: sayfanın en yüksek sesli
                cümlesi ile en güçlü görsel işaret birbirinin tersini
                söylüyordu ve kol mesafesinden bakan stüdyo sahibi kiremidi
                "dolu saat" diye okuyordu — yani ürün ona yanlış bilgi
                veriyordu. renkHaritasi doğru (eyleme çağıran değer boş
                saattir); düzeltilecek olan cümleydi. */}
            <h2 className="mt-b1 text-bolum">Hangi saat boş geçiyor?</h2>
            <p className="olcu mt-b2 text-govde text-ink-2">
              Son {o.gunSayisi} günün ortalaması. Boş geçen saati görmek, program
              değiştirmenin ilk adımı.
            </p>

            {/* SÜTUN GENİŞLİĞİ SABİT DEĞİL, KAPTAN HESAPLANIR.
                Önce sabit 72/96px'ti ve cetvel `w-fit` ile yalnız sütun
                kümesinin altındaydı: dört sütun 444px tutuyor, kart içi
                genişlik 474px olduğu için 2px kalın mürekkep çizgisi ne
                sütunlarla ne kartla hizalı, 30px'lik bir artık bırakıyordu.
                Artık kap tam genişlikte, sütunlar `justify-between` ile iki
                uca yaslı: İLK sütunun sol kenarı ve SON sütunun sağ kenarı
                cetvelin uçlarıyla birebir çakışıyor, artan yer sütun içine
                değil ARALARA gidiyor. Üst sınır 112px: dört saatlik bir sette
                sütunlar 159px'e genişleyip grafik değil pano gibi durmasın.
                Alt sınır 56px, saat etiketinin kendi genişliği. */}
            <div className="mt-b5 overflow-x-auto">
              <div className="flex w-full items-end justify-between gap-b4 border-b-2 border-cetvel">
                {o.saatler.map((s, i) => (
                  <div key={s.saat} className="min-w-14 max-w-28 flex-1">
                    <Sutun
                      oran={s.oran}
                      gecikme={SAHNE.detay + 0.05 * i}
                      renk={saatRenkleri[i]}
                      // Etiket rengi dolguya bağlı: mürekkep dolgunun üstünde
                      // mürekkep yazı okunmuyordu (bkz. animasyon.tsx).
                      koyuDolgu={saatRenkleri[i] === "bg-ink"}
                      etiket={<Sayac deger={Math.round(s.oran * 100)} sure={1} bas="%" />}
                    />
                  </div>
                ))}
              </div>
              {/* Saat etiketleri ölçeklenen katmanın DIŞINDA ve sütunlarla
                  BİREBİR aynı ızgarada: aynı flex kuralları, aynı sınırlar. */}
              <div className="flex w-full justify-between gap-b4 pt-b2">
                {o.saatler.map((s) => (
                  <div
                    key={s.saat}
                    className="flex min-w-14 max-w-28 flex-1 flex-col items-center"
                  >
                    <span className="tnum text-govde">{s.saat}</span>
                    <span className="tnum text-etiket text-ink-3">
                      {s.ders} {deri.seans}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {enDolular.length > 0 && enBoslar.length > 0 && (
              <Belir gecikme={1}>
                {/* CÜMLE SIRASI DA RENGE UYAR: kiremit boş saatleri
                    işaretlediği için cümle de oradan başlar. Önce dolu saati
                    yazmak, gözü grafiğin işaretlemediği sütunlara
                    gönderiyordu. */}
                <p className="olcu mt-b5 bg-cukur px-b4 py-b3 text-govde text-ink-2">
                  {ayirtEdiciSaat ? (
                    <>
                      En boş {enBoslar.length > 1 ? "saatler" : "saat"}{" "}
                      <b className="tnum text-ink">{veIle(enBoslar)}</b> ({yuzde(enBosOran)}),
                      en dolu {enDolular.length > 1 ? "saatler" : "saat"}{" "}
                      <b className="tnum text-ink">{veIle(enDolular)}</b> ({yuzde(enDoluOran)}).
                      Aradaki fark kapanırsa aynı eğitmenle daha fazla {deri.uye} alırsınız.
                    </>
                  ) : (
                    <>
                      Saatlerin hepsi aynı oranda geçiyor{" "}
                      <b className="tnum text-ink">{yuzde(enBosOran)}</b> — şu an
                      ayırt edici bir boş saat yok.
                    </>
                  )}
                </p>
              </Belir>
            )}

            {/* GÜN GÜN — RÜTBESİ KÜNYE, BÖLÜM DEĞİL.
                Yayılım eşiğin altındayken bu band kendi 2px cetveli, kendi
                13px etiketi ve kendi 30px başlığıyla sayfanın ikinci en büyük
                başlık bloğuydu — ve teslim ettiği bilgi "burada söylenecek bir
                şey yok"tu. O dönemde tohum veride yayılım her zaman eşiğin
                altındaydı; iptal tohumu düzeltildikten sonra iki deride de
                eşiğin üstüne çıktı, yani bu dal artık yedek yol. Rütbesi yine
                de künye kalıyor: eşiğin altına düşen bir veride söylenecek şey
                gerçekten bir dipnottur. Band saat grafiğinin
                kartı İÇİNDE, açıklama şeridinin altında, etiket kademesinde
                duruyor: sayfa "bir manşet + bir gerçek grafik + bir halka"
                olarak okunuyor.

                BİÇİM DE DÜZELDİ: altı gün YATAY dizilirken dolum da YATAY
                akıyordu (Cubuk) — komşu hücrelerde sola yaslı uzunluk
                karşılaştırmak gözün yapabileceği en zor iş. Aynı dosya 40
                satır yukarıda aynı tür veriyi dikey Sutun ile çiziyor; tek
                sayfada iki grafik grameri kalmasın diye burası da Sutun.
                Tepe noktaları tek bakışta karşılaştırılıyor. Renk
                zorlanmıyor: yayılım eşiğin altında, hepsi sönük kalır. */}
            {gunYayilimi < YAYILIM_ESIGI && (
              <Belir gecikme={1}>
                <div className="mt-b5 border-t border-cizgi pt-b4">
                  {/* İFŞA BÖLÜM AÇICI DEĞİL, GRAFİĞİN KÜNYESİ.
                      "%50 tabanı" kendi başına bir `.etiket` satırı olarak
                      gün adlarının ALTINDA duruyordu; aynı kademe bu sayfada
                      bölüm açıcı ("Saat saat", "Gün gün", "Dönüşüm") olduğu
                      için altındaki paragrafın başlığı gibi okunuyordu — yani
                      `.etiket` tek sayfada iki rol taşıyordu. İfşa artık
                      ölçeğin sahibiyle aynı satırda, sağ uçta: rol yeniden
                      tek. */}
                  <p className="etiket flex items-baseline justify-between">
                    <span>Gün gün</span>
                    <span className="text-ink-3">%50 tabanı</span>
                  </p>
                  {/* TABAN SIFIR DEĞİL %50.
                      Sıfır tabanında altı çubuk 40px'lik izde %56-%59 arasını
                      çiziyordu: en yüksekle en düşük arasındaki fark 1.2 PİKSEL,
                      yani ekranda birbirinden ayırt edilemeyen altı açık kutu.
                      Kol mesafesinden bu bir grafik değil, henüz yüklenmemiş bir
                      iskelet gibi okunuyor — ve iskelet, "arayüz yarım kalmış"
                      izleniminin en tanıdık işareti. Taban %50'ye çekilince aynı
                      fark ~6px oluyor ve çubuklar gerçekten ayrışıyor. Ölçek
                      yanıltmasın diye altında künye kademesinde yazılı:
                      kesilmiş eksen SÖYLENMEDEN kullanılmaz. */}
                  <div className="mt-b3 flex items-end gap-b2">
                    {o.gunler.map((g, i) => (
                      <div key={g.gun} className="flex-1">
                        {/* HER SÜTUN KENDİ DEĞERİNİ YAZAR. Kesilmiş eksen 3
                            puanlık farkı 12px ile 18px arasına açıyor, yani
                            grafik "cumartesi belirgin dolu" diyor, altındaki
                            cümle "anlamlı fark yok" diyor — grafik ile metin
                            birbirini yalanlıyordu. Rakam sütunun üstünde
                            olunca okunan şey yükseklik değil değer oluyor ve
                            ikisi aynı şeyi söylüyor. */}
                        <p className="tnum mb-b1 text-center text-etiket text-ink-3">
                          {yuzde(g.oran)}
                        </p>
                        <Sutun
                          oran={Math.min(1, Math.max(0, (g.oran - 0.5) / 0.2))}
                          gecikme={SAHNE.detay + 0.05 * i}
                          enYuksek={40}
                          renk="bg-veri-sonuk"
                        />
                        <p className="mt-b2 text-center text-etiket text-ink-3">{g.gun}</p>
                      </div>
                    ))}
                  </div>
                  <p className="olcu mt-b3 text-govde text-ink-2">
                    Günler arasında anlamlı fark yok ({yuzde(Math.min(...gunOranlari))}–
                    {yuzde(Math.max(...gunOranlari))}) — {deri.seans} planı gün
                    değil saat üzerinden değişir.
                  </p>
                </div>
              </Belir>
            )}
          </section>
        </Belir>

        {/* ------------------------------------------- deneme dönüşümü ---
            Kartta TEK hizalama ekseni: her şey sola. Eskiden başlık solda,
            halka ortada, metin ortalıydı — üç ayrı eksen, sıfır düzen. */}
        <Belir gecikme={SAHNE.rakam} className="lg:col-span-4 lg:self-start">
          {/* SIRADAN KART (kalkik-1): bu ekranda üç basamak da görünür
              olsun diye — ana grafik kalkik-2, bu panel kalkik-1, üstteki üç
              künye çukur. Üçü de çıplak beyaz kalınca merdiven iki basamağa
              iniyor ve "her şey kardeş" sorunu renk yerine yükseltiden
              geri geliyordu. Kenarlık YOK: gölgenin ring'i zaten var. */}
          {/* KART KOMŞUSUYLA AYNI ÜST HİZADA BAŞLAR, AYNI ALTTA BİTMEK
              ZORUNDA DEĞİL. `h-full` + `mt-auto` ikilisi kartın ORTASINDA
              ~90px'lik bir bant bırakıyordu: "kasıtlı boşluk" değil "içerik
              bitti ama kutu bitmedi" demek. Kabın kendisi zaten 8/4 asimetrik;
              iki kartın alt hizasının tutması diye bir kural yok. */}
          <div className="flex flex-col gap-b4">
          <section className="flex flex-col rounded-yuzey bg-yuzey p-b5 shadow-kalkik-1">
            <Cetvel gecikme={SAHNE.baslik} />
            <p className="etiket mt-b3">Dönüşüm</p>
            <h2 className="mt-b1 text-bolum">Deneme dönüşümü</h2>
            <p className="mt-b2 text-govde text-ink-2">
              Deneme dersine gelenlerin kaçı {deri.uye} oldu?
            </p>

            <div className="mt-b5">
              <Halka
                oran={o.denemeOrani}
                // BOYUT 200 → 168. İki gerekçe:
                //  1. Kolon ölçüsü: 4/12 kolonun iç genişliği 233px; 200px'lik
                //     halka onun %86'sını kaplıyor ve kartın kenarına
                //     yapışıyordu. 168px'te %72 — nefes payı var.
                //  2. YAKIN AMA EŞİT OLMAYAN yükseklik hatadır, AÇIKÇA farklı
                //     olan karardır. İki kart 672'ye 572 iken (fark 100px,
                //     ~%15) sağ kolonun altındaki kâğıt "kasıtlı boşluk"
                //     değil "sağ kart eksik kalmış" diye okunuyordu. Kartı
                //     zorla uzatmak (h-full) ortasında ölü bant bırakıyor.
                //     Gün gün bandı soldaki karta indiği için sol kart artık
                //     belirgin biçimde uzun: 8/12'lik ana panel ile 4/12'lik
                //     kenar kartı ayrı rütbede okunuyor, "aynı hizada bitmesi
                //     gereken iki kardeş" izlenimi ortadan kalkıyor.
                boyut={200}
                // VURGU BÜTÇESİ: ekran başına en fazla üç yer. Bu ekranda
                // dört oluyordu — etkin sekme, saat grafiğindeki iki kiremit
                // sütun ve halkanın yayı. Göz aynı anda üç ayrı "önce buraya
                // bak" işareti görünce hiçbirine gitmiyor. Dönüşüm oranı bu
                // ekranın EYLEME ÇAĞIRAN verisi değil, durum bildirimi; vurgu
                // bütçesi boş saatlere ait. Yay mürekkebe indi, sütunlar
                // ekranın tek odak noktası kaldı.
                renk="var(--color-ink)"
                // "%" işareti `.para` ile geri çekiliyor: rakamla aynı
                // 44px/700 ağırlıkta basılınca göz üç glifli tek blok görüyor
                // ve halkanın ortasındaki sayı kendi işaretiyle yarışıyordu.
                // Aynı kural ₺'de ve Sayac'ın önek/sonekinde de geçerli.
                etiket={
                  <>
                    <span className="para">%</span>
                    {Math.round(o.denemeOrani * 100)}
                  </>
                }
                altYazi={`${o.denemeDonusen} / ${o.denemeToplam}`}
              />
            </div>

            <p className="mt-b4 text-govde text-ink-2">
              Takip mesajları çalıştıkça bu oran görünür hâle gelir. Şu an
              <b className="tnum text-ink"> {o.denemeToplam - o.denemeDonusen} kişi</b> hâlâ
              karar aşamasında.
            </p>
          </section>
          {/* Kolonu KAPATAN künye: sağ kenardaki künye ekseninin son halkası
              (bkz. yanKunyeler). */}
          {yanKunyeler.map((k) => <KunyeKutu key={k.etiket} k={k} />)}
          </div>
        </Belir>
      </div>

    </div>
  );
}
