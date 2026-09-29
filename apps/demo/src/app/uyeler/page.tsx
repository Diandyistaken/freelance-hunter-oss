"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Printer, Search, Send } from "lucide-react";
import { useDemo } from "@/lib/durum";
import {
  borcYasi, gunOnce, kalanBorc, kovalamaDegistir, odemeAl, sonrakiDersi,
  uyelikler, uyelikOzeti, uyeligiUzat,
  type UyelikHali, type UyelikSatiri,
} from "@/lib/islem";
import { whatsappLinki } from "@/lib/deri";
import { tl } from "@/lib/fiyat";
import { Belir, belir, Cetvel, Cubuk, SAHNE, Sayac, sira, Supurme } from "@/components/animasyon";
import AcikHesap from "@/components/AcikHesap";
import AcikHesapCizelgesi from "@/components/AcikHesapCizelgesi";

// ÜYE DEFTERİ — 1. ürün.
//
// İkinci stüdyo sahibinin telefonunda tuttuğu şey bu: kim üye, ne zaman
// başladı, ne zaman bitiyor, parasını aldım mı. Kendi ifadesiyle "sürekli
// kimin ne zaman üyeliğinin biteceğini takip etmem gerekiyor ve çok
// zorlanıyorum". Ekranın tek iddiası buna cevap veriyor: SIRALAMAYI SEN
// YAPMAYACAKSIN. Liste her açılışta bitişe en yakın olandan gelir.
//
// Bu yüzden burada "tümünü göster" diye bir varsayılan yok; varsayılan
// görünüm zaten sıradaki iştir. Filtre çipleri listeyi daraltır, kurmaz.
//
// TELEFON ÖNCELİKLİ: gösterim tablette AMA bu ekranın gerçek kullanımı
// telefonda olacak (adam zaten telefonunda takip ediyor). Tek kolon tasarlandı,
// `lg`de ikinci kolon açılıyor — tersi değil.

type Filtre = "hepsi" | "aktif" | "bu_hafta" | "bu_ay" | "gecti" | "borclu";

const FILTRELER: { kod: Filtre; ad: string }[] = [
  { kod: "hepsi", ad: "Hepsi" },
  // "Aktif üye" stüdyo sahibinin isteği: üyeliği süren herkesi tek listede
  // görmek istiyor. "Hepsi"den farkı, süresi dolmuşları dışarıda bırakması —
  // yani bugün itibarıyla gerçekten üye olanlar.
  { kod: "aktif", ad: "Aktif üye" },
  { kod: "gecti", ad: "Süresi dolmuş" },
  { kod: "bu_hafta", ad: "Bu hafta bitiyor" },
  { kod: "bu_ay", ad: "30 gün içinde" },
  { kod: "borclu", ad: "Açık hesap" },
];

/**
 * Kalan gün rozeti.
 *
 * ÜÇ HAL, ÜÇ TON — VE DÖRDÜNCÜ BİR RENK YOK. Süresi dolmuş "dikkat",
 * bu hafta bitecek "vurgu", gerisi sessiz. Sistemin renk bütçesi ekran
 * başına iki işaret; üçüncüsü eklenince liste ışık panosuna dönüyor ve
 * hangisinin acil olduğu kayboluyor.
 */
function KalanRozet({ s }: { s: UyelikSatiri }) {
  const yazi = s.kalanGun < 0
    ? `${-s.kalanGun} gün önce doldu`
    : s.kalanGun === 0 ? "Bugün bitiyor" : `${s.kalanGun} gün kaldı`;
  const ton = s.hal === "gecti"
    ? "bg-durum-dikkat-tint text-durum-dikkat"
    : s.hal === "bu_hafta"
      ? "text-uzeri"
      : "cukur-zeminde text-ink-2";
  return (
    <span
      className={`tnum shrink-0 whitespace-nowrap rounded-kontrol px-b2 py-b1 text-etiket ${ton}`}
      style={s.hal === "bu_hafta" ? { background: "var(--color-vurgu)" } : undefined}
    >
      {yazi}
    </span>
  );
}

export default function UyelerPage() {
  const { durum, deri, guncelle, yukleniyor } = useDemo();
  const [filtre, setFiltre] = useState<Filtre>("hepsi");
  const [arama, setArama] = useState("");
  const [acik, setAcik] = useState<number | null>(null);
  // Uzatılan satırın üzerinden ışık geçer: işin OLDUĞU yerde, listenin
  // üstünde bir bildirim kutusunda değil.
  const [parlayan, setParlayan] = useState<number | null>(null);
  // PANEL AÇIKKEN SIRA DONAR. Açık hesap listesi "son ödemeden beri gün"e
  // göre dizili; ödeme alınınca o sayı 0'a iniyor ve satır, panel açıkken
  // listenin dibine atlıyordu — sahip parmağının altındaki kartı kaybediyordu.
  // Panel açılırken görünen sıra saklanır, kapanınca gerçek sıra geri gelir.
  const [donukSira, setDonukSira] = useState<number[] | null>(null);

  const satirlar = useMemo(() => uyelikler(durum), [durum]);
  const ozet = useMemo(() => uyelikOzeti(durum), [durum]);

  // HER FİLTRENİN KAÇ ÜYE TUTTUĞU — çipin üstünde yazacak.
  const sayilar = useMemo(() => ({
    hepsi: satirlar.length,
    aktif: satirlar.filter((s) => s.hal !== "gecti").length,
    gecti: satirlar.filter((s) => s.hal === "gecti").length,
    bu_hafta: satirlar.filter((s) => s.hal === "bu_hafta").length,
    bu_ay: satirlar.filter((s) => s.hal === "bu_hafta" || s.hal === "bu_ay").length,
    borclu: satirlar.filter((s) => kalanBorc(s.uye) > 0).length,
  }), [satirlar]);

  // FİLTRE DEĞİŞİNCE KARTIN BAŞI GÖRÜNÜME GELİR.
  //
  // Manşetteki rakam ve künye kutuları sayfanın tepesinde, filtrelediği liste
  // ise bir ekran aşağıda. Kutuya dokunup sonucu görmek için ayrıca kaydırmak
  // gerekiyordu; artık dokunuş sizi doğrudan sonuca götürüyor.
  //
  // KAYIT DÜZELTMESİ (bu dosyanın geçmişi yanıltmasın): "çiplere basılmıyor /
  // hangisine basarsam Ödeme bekleyen'e atıyor" şikâyeti dört tur boyunca
  // yanlış teşhis edildi — önce rAF'a bağlı çıkış animasyonu, sonra çiplerin
  // ekran dışında kalması, sonra `pointerup` kaynaklı kayma sanıldı; en son
  // telefona açılır liste konuldu. Hiçbiri değildi. Gerçek sebep künye
  // kutularının `.hedef` sınıfı taşıyıp KONUMSUZ olmasıydı: `.hedef::after`
  // mutlak konumlu olduğu için boyutunu en yakın konumlu atadan alıyor ve
  // 375×812'de tüm ekranı kaplayan görünmez bir katmana dönüşüyordu. O katman
  // "Ödeme bekleyen" kutusuna aitti. Düzeltme globals.css'te, `.hedef`'in
  // kendisinde (konumlu olmayı artık kural garanti ediyor).
  const kartRef = useRef<HTMLElement | null>(null);
  const filtrele = (kod: Filtre) => {
    setFiltre(kod);
    // Yeni liste, yeni bağlam: açık panel kapanır (yoksa "açık panel listeden
    // düşmez" kuralı onu filtreye uymayan bir listede tutardı) ve donmuş sıra
    // bırakılır (eski listenin sırasıdır).
    setAcik(null);
    setDonukSira(null);
    kartRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  // Önümüzdeki 30 günde bitenler — manşetin altında satır satır yazılacak.
  const otuzGunListesi = useMemo(
    () => satirlar.filter((s) => s.hal === "bu_hafta" || s.hal === "bu_ay"),
    [satirlar],
  );

  const gorunen = useMemo(() => {
    const ara = arama.trim().toLocaleLowerCase("tr");
    const suzulen = satirlar.filter((s) => {
      if (ara && !s.uye.ad.toLocaleLowerCase("tr").includes(ara)) return false;
      // AÇIK PANEL LİSTEDEN DÜŞMEZ. Açık hesap listesinde son taksit alınınca
      // satır filtreye artık uymuyor; anında silinseydi sahip ne olduğunu
      // göremez, yarın biten üyeliği uzatamadan kartı kaybederdi. Panel
      // kapanınca satır listeden çıkar.
      if (s.uye.id === acik) return true;
      if (filtre === "hepsi") return true;
      if (filtre === "aktif") return s.hal !== "gecti";
      if (filtre === "borclu") return kalanBorc(s.uye) > 0;
      if (filtre === "bu_ay") return s.hal === "bu_hafta" || s.hal === "bu_ay";
      return s.hal === (filtre as UyelikHali);
    });
    // AÇIK HESAP BORCUN YAŞINA GÖRE SIRALANIR (şartname §4, "Ne yapar"): en uzun
    // süredir ödemesiz bekleyen en üstte (bkz. islem.borcYasi). Diğer
    // filtreler bitişe göre kalır — orada soru "kim bitiyor", burada "kim en
    // çok bekletti".
    const sirali = filtre === "borclu"
      ? [...suzulen].sort((a, b) => (borcYasi(b.uye) ?? 0) - (borcYasi(a.uye) ?? 0))
      : suzulen;
    if (!donukSira) return sirali;
    const yer = new Map(donukSira.map((id, i) => [id, i]));
    const sona = donukSira.length;
    return [...sirali].sort((a, b) => (yer.get(a.uye.id) ?? sona) - (yer.get(b.uye.id) ?? sona));
  }, [satirlar, arama, filtre, acik, donukSira]);

  if (yukleniyor) return null;

  const adi = durum.ayar.isletmeAdi;

  // İKİ KÜNYE, ÜÇ DEĞİL. "Aktif üye" üçüncü kutu olarak duruyordu ama aynı
  // rakam manşetin altındaki künye satırında zaten yazılı; iki yerde duran
  // bir sayı, ekranın kendini tekrar ettiği ilk yerdir.
  const kunyeler: { etiket: string; deger: number; alt: string; filtre: Filtre; dikkat?: boolean }[] = [
    {
      etiket: "Süresi dolmuş", deger: ozet.gecti,
      alt: "Yenileme konuşulmadı", filtre: "gecti", dikkat: true,
    },
    {
      // "Ödeme bekleyen" yerine "Açık hesap": artık kısmi ödeme tutuluyor ve
      // rakam KALAN'ı topluyor, dönem bedelini değil.
      etiket: "Açık hesap", deger: ozet.acikHesap,
      alt: `${tl(ozet.disaridaTutar)} ₺ dışarıda` +
        (ozet.enEskiBorcGun !== null ? ` · en uzun bekleyen ${ozet.enEskiBorcGun} gün` : ""),
      filtre: "borclu",
    },
  ];

  // ÜRÜN KENDİ EKSİKLİĞİNİ İTİRAF EDER (şartname §4, kapatma maddesi 5). Bir haftadır hiç
  // ödeme işaretlenmediyse sorun büyük ihtimalle tahsilatta değil kayıtta:
  // masadaki kişi nakit aldı ama işaretlemedi. Ekran bunu söylemezse sahip
  // "demek herkes borçlu" diye yanlış kişiye yanlış mesaj atar — bu ürünün
  // tek ölümcül hata modu: ödemiş müşteriye borç mesajı.
  const kayitSessiz = ozet.sonOdemeGunOnce !== null && ozet.sonOdemeGunOnce >= 7;

  return (
    <>
    <div data-deri={durum.ayar.deri} className="flex flex-col gap-b6 pb-b6 print:hidden">
      {/* ------------------------------------------------------------ başlık */}
      <motion.header {...belir(SAHNE.cetvel)}>
        <Cetvel />
        <div className="mt-b3 flex flex-wrap items-end justify-between gap-b4">
          <div className="min-w-0">
            <p className="etiket">{adi ? `${adi} · üye defteri` : "Üye takibi"}</p>
            <h1 className="mt-b1 text-sayfa">Üye defteri</h1>
          </div>
          <span className="etiket cukur-zeminde rounded-kontrol px-b2 py-b1">Örnek veri</span>
        </div>
        <p className="olcu mt-b3 text-govde text-ink-2">
          Liste bitişi en yakın olandan sıralı gelir — kimin ne zaman
          biteceğini aklınızda tutmanız gerekmez.
        </p>
      </motion.header>

      {/* ---------------------------------------------- manşet + üç künye ---
          Doruk rakam SAYFA BAŞINA TEK: "30 gün içinde bitiyor". Stüdyo
          sahibinin ayı planlarken bakacağı tek sayı bu; süresi dolmuş ve
          açık hesap künyeleri onun altında duruyor.

          DÖRT KUTU DA FİLTRE DÜĞMESİ. Rakama dokunmak listeyi o rakama
          indiriyor — "bu hafta bitiyor 3" diyen bir kutunun yanında ayrıca
          bir "göster" düğmesi koymak, ekranın kendi rakamına güvenmediğini
          söyler. */}
      <motion.div
        variants={sira.kap}
        initial="gizli"
        animate="gorunur"
        className="grid gap-b4 lg:grid-cols-12"
      >
        <motion.div custom={0} variants={sira.oge} className="lg:col-span-8">
          {/* Rakam düğme, listesi değil: `<button>` içine liste koymak
              iç içe tıklanabilir öğe demek. Rakama dokunmak listeyi 30 güne
              indiriyor; altındaki satırlar okumak için. */}
          <button
            type="button"
            onClick={() => filtrele("bu_ay")}
            className="hedef relative flex w-full flex-col text-left"
          >
            <span className="etiket">Önümüzdeki 30 günde bitiyor</span>
            <span className="genis mt-b2 block text-kapak">
              <Sayac deger={ozet.buAy} />
            </span>
          </button>
          <Cetvel gecikme={SAHNE.rakam} />

          {/* RAKAM TEK BAŞINA DURMUYOR — KİM, NE ZAMAN.
              Stüdyo sahibinin isteği: "8 kişi varsa hangi üye hangi tarihte
              bitiyor oraya yazsın". Sekiz satır zaten kısa; listeye inip
              filtrelemeye gerek kalmadan ay planı burada okunuyor. Sıra
              bitişe göre, aşağıdaki defterle aynı hesaptan (uyelikler). */}
          <ul className="mt-b3 flex flex-col">
            {otuzGunListesi.map((u) => (
              <li
                key={u.uye.id}
                className="flex items-baseline justify-between gap-b3 border-b border-cizgi py-b2 last:border-b-0"
              >
                <span className="min-w-0 text-govde">{u.uye.ad}</span>
                <span className="tnum shrink-0 text-kunye text-ink-3">
                  {u.bitisYazi.replace(/ \S+$/, "")} ·{" "}
                  <b
                    className={`font-semibold ${
                      u.hal === "bu_hafta" ? "text-vurgu" : "text-ink-2"
                    }`}
                  >
                    {u.kalanGun === 0 ? "bugün" : `${u.kalanGun} gün`}
                  </b>
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          custom={1}
          variants={sira.oge}
          className="flex flex-col gap-b4 lg:col-span-4"
        >
          {kunyeler.map((k) => (
            <button
              key={k.etiket}
              onClick={() => filtrele(k.filtre)}
              className={`hedef cukur-zeminde rounded-yuzey p-b4 text-left ${
                k.dikkat ? "border-l-2 border-durum-dikkat" : ""
              }`}
            >
              <p className="etiket">{k.etiket}</p>
              <p className={`mt-b2 text-veri ${k.dikkat ? "text-durum-dikkat" : ""}`}>
                <Sayac deger={k.deger} />
              </p>
              <p className="tnum mt-b1 text-govde text-ink-3">{k.alt}</p>
            </button>
          ))}

          {/* KAYDIN TAZELİĞİ, RAKAMIN YANINDA. "Açık hesap" yalnız
              işaretlenen ödemeler kadar doğru; bu satır o rakamın ne kadar
              güncel olduğunu söylüyor. Normalde sessiz bir dipnot, bir hafta
              ödeme girilmezse uyarıya dönüyor. */}
          {ozet.sonOdemeGunOnce !== null && (
            <p className={`tnum text-kunye ${kayitSessiz ? "text-durum-dikkat" : "text-ink-3"}`}>
              {kayitSessiz
                ? `${ozet.sonOdemeGunOnce} gündür hiç ödeme işaretlenmedi. Açık hesap listesi eksik olabilir — alınan nakit varsa önce onu işaretleyin.`
                : `Son ödeme kaydı ${gunOnce(ozet.sonOdemeGunOnce)}.`}
            </p>
          )}
        </motion.div>
      </motion.div>

      {/* ------------------------------------------------------ defter ---- */}
      <Belir gecikme={SAHNE.yuzey}>
        <section
          ref={kartRef}
          className="rounded-yuzey bg-yuzey p-b5 shadow-kalkik-1"
        >
          <Cetvel dar />
          <h2 className="mt-b3 text-bolum">Üyelikler</h2>

          {/* ARAMA + FİLTRE tek satırda değil ALT ALTA: 375px'te beş çip ile
              bir arama kutusu aynı satıra sığmıyor ve çipler iki harfe
              kırpılıyordu. */}
          <label className="mt-b4 flex h-eylem items-center gap-b2 rounded-kontrol border border-cizgi-koyu px-b4">
            <Search className="size-4 shrink-0 text-ink-3" />
            <input
              value={arama}
              onChange={(e) => {
                setArama(e.target.value);
                setDonukSira(null);
              }}
              placeholder={`${deri.uye} ara`}
              className="min-w-0 flex-1 bg-transparent text-govde outline-none placeholder:text-ink-3"
            />
          </label>

          {/* ÇİPLER SARAR, KAYMAZ — VE HER GENİŞLİKTE ÇİP.
              Yatay kaydırma satırındayken 375px'te altı çipin yalnız üçü
              ekrandaydı ve devamı olduğuna dair hiçbir işaret yoktu; sarınca
              hepsi görünüyor.
              Bir tur telefonda bunların yerine açılır liste (`<select>`)
              konmuştu — "dokunuş bir sebeple kayboluyorsa işletim sisteminin
              kendi listesi kurtarır" varsayımıyla. Varsayım yanlıştı: dokunuş
              kaybolmuyordu, görünmez bir katman tarafından ÇALINIYORDU ve o
              katman açılır listeyi de örtüyordu (bkz. globals.css `.hedef`).
              Katman kalkınca liste gerekçesini yitirdi ve geri alındı: çipte
              altı durumun sayısı TEK BAKIŞTA okunuyor, listede ancak açınca. */}
          <p className="etiket mt-b4">Filtrele</p>
          <div className="mt-b2 flex flex-wrap gap-b2">
            {FILTRELER.map((f) => {
              const etkin = f.kod === filtre;
              return (
                <button
                  key={f.kod}
                  type="button"
                  onClick={() => filtrele(f.kod)}
                  aria-pressed={etkin}
                  className={`flex h-eylem shrink-0 items-center gap-b2 whitespace-nowrap rounded-kontrol px-b4 text-govde transition-colors ${
                    etkin
                      ? "bg-ink font-medium text-uzeri"
                      : "cukur-zeminde border border-cizgi-koyu text-ink-2"
                  }`}
                >
                  {f.ad}
                  {/* SAYI HER ZAMAN GÖRÜNÜR. Dokunulmasa bile "süresi
                      dolmuş 2" okunuyor; ekranın anlattığı şey dokunuşa
                      bağlı kalmıyor. */}
                  <span className={`tnum text-etiket ${etkin ? "text-uzeri" : "text-ink-3"}`}>
                    {sayilar[f.kod]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* LİSTE. Satır sayısı 24; kaydırma kutusu YOK — sayfa kayar.
              Kart içinde ikinci bir kaydırma alanı, dokunmatikte hangi
              yüzeyin kaydığı belirsizleşiyor. */}
          {/* ANIMATEPRESENCE YOK — VE OLMAYACAK.
              Liste bir animasyonun bitmesine bağlı olamaz. AnimatePresence
              çıkış animasyonu tamamlanana kadar düğümü DOM'da tutuyor;
              animasyon `requestAnimationFrame` ile ilerliyor; tarayıcı
              sayfayı görünmez sayarsa (gömülü panel, arka plan sekmesi,
              uygulama değiştirme) rAF hiç ilerlemiyor. Sonuç ölçüldü:
              filtreye basınca liste 24 satırda KALIYOR, aramada da öyle —
              yani düğmeler bozuk görünüyor. Bu bir animasyon süsü hatası
              değil, ürünün satılan davranışının kırılması.

              Aynı kural bu projede zaten yazılı (bkz. animasyon.tsx: Sayac'ın
              `document.hidden` kısayolu, Sunum'un opaklıksız geçişi): hareket
              yarım kalabilir ama BİLGİ yarım kalamaz. Satırlar artık React'in
              kendi koşullu çizimiyle gelip gidiyor; animasyon yalnız giriş
              sırasında ve yalnız 10px konum. */}
          {/* NE GÖSTERİLİYOR — dokunuşun sonucu sözle de yazılı. Çipin
              koyulaştığını fark etmeyen biri bile hangi listeye baktığını
              buradan okur. */}
          <p className="mt-b3 border-t border-cizgi pt-b3 text-govde text-ink-3">
            <span className="tnum font-medium text-ink">{gorunen.length}</span>
            {" "}
            {deri.uye} gösteriliyor
            {filtre !== "hepsi"
              ? ` · ${FILTRELER.find((f) => f.kod === filtre)?.ad.toLocaleLowerCase("tr")}`
              : ""}
            {arama ? ` · "${arama}"` : ""}
            {filtre === "borclu" ? " · en uzun bekleyen üstte" : ""}
          </p>

          {/* GÜN SONU ÇIKTISI yalnız açık hesap listesindeyken: kâğıt
              defterin yerine sistemden basılan günlük liste (bkz.
              AcikHesapCizelgesi). Arama kutusuna ne yazılmış olursa olsun
              kâğıda BÜTÜN açık hesaplar çıkar — yarım liste masada defter
              yerine geçemez. */}
          {filtre === "borclu" && sayilar.borclu > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-b3 inline-flex h-eylem items-center gap-b2 rounded-kontrol border border-cizgi-koyu px-b4 text-govde text-ink-2"
            >
              <Printer className="size-4" /> Günün listesini yazdır
            </button>
          )}

          <ul className="mt-b3">
            {gorunen.map((s, i) => {
                const acikMi = acik === s.uye.id;
                const borc = kalanBorc(s.uye);
                // Açık hesap listesinde alt satır "ne zaman bitiyor" yerine
                // "ne zamandır ödemesiz" söyler: sıralamanın gerekçesi satırda.
                const bekleyis = borcYasi(s.uye) ?? 0;
                const altSatir = filtre === "borclu" && borc > 0
                  ? `${s.uye.uyelikTipi} · ${s.uye.sonOdeme ? `son ödeme ${gunOnce(bekleyis)}` : "bu dönem hiç ödeme yok"}` +
                    (s.uye.kovalama ? " · kovalanmıyor" : "")
                  : `${s.uye.uyelikTipi} · bitiş ${s.bitisYazi}`;
                const metin = deri.mesaj.uyelikBitiyor({
                  uye: s.uye.ad.split(" ")[0], seans: "", saat: "", gun: "", egitmen: "",
                  kalanGun: s.kalanGun, bitisTarihi: s.bitisYazi,
                  odemeLinki: durum.ayar.odemeLinki,
                });
                return (
                  <motion.li
                    key={s.uye.id}
                    custom={i}
                    variants={sira.oge}
                    initial="gizli"
                    animate="gorunur"
                    className="relative border-b border-cizgi last:border-b-0"
                  >
                    {parlayan === s.uye.id && <Supurme />}

                    <button
                      onClick={() => {
                        setAcik(acikMi ? null : s.uye.id);
                        setDonukSira(acikMi ? null : gorunen.map((x) => x.uye.id));
                      }}
                      aria-expanded={acikMi}
                      className="flex w-full items-center gap-b3 py-b3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-b2 gap-y-b1">
                          <span className="text-one">{s.uye.ad}</span>
                          {/* Tutar rozette: "ödeme bekliyor" demek yetmiyordu,
                              kısmi ödemede asıl soru "ne kadar". Kovalanmayan
                              satır soluk — listede kalır, göze batmaz. */}
                          {borc > 0 ? (
                            <span
                              className={`etiket tnum rounded-kontrol border px-b2 py-b1 ${
                                s.uye.kovalama ? "border-cizgi text-ink-3" : "border-cizgi-koyu text-ink-2"
                              }`}
                            >
                              Kalan {tl(borc)} ₺
                            </span>
                          ) : filtre === "borclu" && (
                            // Açık hesap listesinde hesabı az önce kapanan
                            // satır (paneli açık olduğu için hâlâ burada):
                            // neden listede durduğunu söyler.
                            <span className="etiket rounded-kontrol bg-durum-iyi-tint px-b2 py-b1 text-durum-iyi">
                              Hesap kapandı
                            </span>
                          )}
                        </span>
                        <span className="tnum mt-b1 block text-kunye text-ink-3">
                          {altSatir}
                        </span>
                      </span>
                      <KalanRozet s={s} />
                      <ChevronDown
                        className={`size-4 shrink-0 text-ink-3 transition-transform ${
                          acikMi ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Dönem çubuğu: üyeliğin ne kadarının geçtiği.
                        ÇUBUK KİREMİT OLAMAZ. Bir tur "bu hafta bitecek"
                        satırların çubuğu da vurguya boyandı ve liste üst üste
                        beş kiremit bant oldu: rozet zaten kiremit dolgulu, yani
                        aynı bilgi aynı renkle iki kez söyleniyordu ve ekranın
                        vurgu bütçesi (ekran başına iki işaret) tek satırda
                        tükeniyordu. İşareti ROZET taşır; çubuk yalnız dokudur
                        ve tek istisnası süresi DOLMUŞ olan. */}
                    <Cubuk
                      oran={s.ilerleme}
                      yukseklik={3}
                      gecikme={SAHNE.detay}
                      renk={s.hal === "gecti" ? "bg-durum-dikkat" : "bg-veri-sonuk"}
                    />

                    {/* YÜKSEKLİK ANİMASYONU DA KALKTI, AYNI GEREKÇEYLE.
                        `height: 0 → auto` rAF ile ilerliyor; sayfa görünmez
                        sayılırsa panel 0 yükseklikte KALIYOR — kullanıcı satıra
                        dokunuyor ve hiçbir şey açılmıyor. Yerine 6px'lik konum
                        kayması: yarım kalırsa panel 6px yukarıda durur, yani
                        en kötü ihtimalde okunur. Kapanış anında olur; kapanan
                        bir şeyin animasyonunu kimse beklemez. */}
                    {acikMi && (
                      <motion.div {...belir()}>
                          <div className="cukur-zeminde mt-b3 mb-b3 rounded-yuzey p-b4">
                            {/* Dönem bedeli yalnız hesap KAPALIYKEN burada;
                                açıkken aynı rakam aşağıda "Anlaşılan" olarak
                                duruyor ve iki yerde yazılmıyor. */}
                            <dl className="grid grid-cols-2 gap-b3 sm:grid-cols-4">
                              {[
                                ["Başlangıç", s.baslangicYazi],
                                ["Bitiş", s.bitisYazi],
                                ["Üyelik", s.uye.uyelikTipi],
                                ...(borc === 0 ? [["Dönem bedeli", `${tl(s.uye.aidat)} ₺ · alındı`]] : []),
                              ].map(([e, d]) => (
                                <div key={e}>
                                  <dt className="etiket">{e}</dt>
                                  <dd className="tnum mt-b1 text-govde">{d}</dd>
                                </div>
                              ))}
                            </dl>

                            {/* AÇIK HESAP önce, uzatma sonra: para kapanmadan
                                dönem yenilenmiyor (islem.uyeligiUzat). Anahtar
                                `odenen`i taşıyor — ödeme alınınca blok baştan
                                kurulur (bkz. AcikHesap.tsx başı). */}
                            <AcikHesap
                              key={`${s.uye.id}-${s.uye.odenen}`}
                              uye={s.uye}
                              deri={deri}
                              sonraki={sonrakiDersi(durum, s.uye.id)}
                              onOdeme={(tutar) => guncelle((d) => odemeAl(d, s.uye.id, tutar))}
                              onKovalama={() => guncelle((d) => kovalamaDegistir(d, s.uye.id))}
                            />

                            {/* EYLEMLER. Mesaj OTOMATİK GİTMEZ: WhatsApp
                                açılır, gönder tuşuna insan basar — projenin
                                baştan beri tek kırmızı çizgisi.
                                PANELDE TEK DOLGULU DÜĞME: hesap açıkken o düğme
                                "Ödeme al"; yenileme mesajı kenarlığa iner. */}
                            <div className="mt-b4 flex flex-wrap gap-b2">
                              <a
                                href={whatsappLinki(s.uye.telefon, metin)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex h-eylem items-center gap-b2 rounded-kontrol px-b4 text-govde font-medium ${
                                  borc > 0 ? "border border-cizgi-koyu text-ink" : "bg-ink text-uzeri"
                                }`}
                              >
                                <Send className="size-4" /> Yenileme mesajı
                              </a>
                              <button
                                type="button"
                                disabled={borc > 0}
                                onClick={() => {
                                  guncelle((d) => uyeligiUzat(d, s.uye.id));
                                  setParlayan(s.uye.id);
                                  setAcik(null);
                                  setDonukSira(null);
                                }}
                                className="inline-flex h-eylem items-center rounded-kontrol border border-cizgi-koyu px-b4 text-govde disabled:border-dashed disabled:text-ink-3"
                              >
                                Üyeliği {s.uye.uyelikTipi.toLocaleLowerCase("tr")} uzat
                              </button>
                            </div>

                            {/* Kapalı düğme SEBEBİNİ söyler. Sessizce kapalı
                                bir düğme "bozuk" okunur. */}
                            {borc > 0 && (
                              <p className="tnum mt-b2 text-kunye text-ink-3">
                                Uzatmadan önce açık hesap kapanmalı — kalan {tl(borc)} ₺.
                                Yoksa eski kalan yeni dönemin içinde kaybolur.
                              </p>
                            )}

                            <p className="mt-b3 text-kunye text-ink-3">
                              Mesaj WhatsApp&apos;ta açılır — gönder tuşuna siz
                              basarsınız. Hiçbir mesaj kendiliğinden gitmez.
                            </p>
                          </div>
                      </motion.div>
                    )}
                  </motion.li>
                );
            })}
          </ul>

          {/* BOŞ DURUM BİR ŞEY SÖYLER. "Kayıt yok" yazan bir liste, aramanın
              mı yoksa ürünün mü çalışmadığını belirsiz bırakıyor. */}
          {gorunen.length === 0 && (
            <p className="cukur-zeminde mt-b4 rounded-yuzey p-b4 text-govde text-ink-2">
              {arama
                ? `"${arama}" için kayıt yok.`
                : "Bu başlıkta bekleyen kimse yok — hepsi güncel."}
            </p>
          )}
        </section>
      </Belir>
    </div>

    <AcikHesapCizelgesi uyeler={durum.uyeler} isletmeAdi={adi} />
    </>
  );
}
