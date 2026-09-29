"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useDemo } from "@/lib/durum";
import { FORM_SORULARI, RUH_HALI, gunYaz } from "@/lib/veri";
import { formDoldur, gunlukYaz, iptalEt, rezerveEt, takvim } from "@/lib/islem";
import { belir, Cetvel, GIRIS, ONAY, sira } from "@/components/animasyon";

// DANIŞAN EKRANI — karşı tarafın telefonunda göreceği sayfa.
//
// TASARIM KURALI: bu ekranda tek bir iş var — saat ayırtmak. Büyük yazı,
// tek sütun, her saat için TEK düğme, jargon yok.
//
// TELEFON KABUĞU EKRANA SIĞAR. Sabit 780px'ken hedef cihazda (1024×768)
// kabuğun alt 220px'i ve 44px'lik alt köşeleri HİÇ görünmüyordu: geriye üstü
// çentikli, altı kesik beyaz bir dikdörtgen kalıyor ve "bu üyenizin telefonu"
// cümlesinin tek görsel dayanağı çöküyordu. Kabuk artık gerçek ölçüsünde
// (390×780) kurulup ekrana göre ÖLÇEKLENİYOR — çerçeve her zaman bütün
// görünüyor, oran da doğru kalıyor (bkz. useKabukOlcegi).
//
// SOLDAKİ ÖLÜ ALAN DOLDU: kabuğun yanında ~330px boş çukur duruyordu. Oraya
// "üye ne yapıyor" anlatımı geldi; sunumu yapan kişi ekranı gösterirken
// söyleyeceği üç cümle artık yazılı.
//
// Yapışkan gün başlığı da ancak böyle çalışıyor: `sticky top-0` en yakın
// kaydırma kabına göre hesaplanır, eskiden o kap sayfanın kendisiydi ve başlık
// hiç yapışmıyordu (kodda anlatılan özellik ekranda yoktu).
//
// TEKRAR EDEN İKON KALKTI: 28 satırın 28'inde de aynı saat ikonu vardı; her
// yerde olan işaret hiçbir şey işaretlemez. İkon artık yalnız ayırt edici
// durumu (yeriniz ayrıldı) gösteriyor.

const GUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
  "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// TELEFON GERÇEK ÖLÇÜSÜNDE KURULUR, SONRA KUTU ÖLÇEKLENİR.
//
// Kabuk daha önce ekrandan hesaplanan bir yükseklikle (min(780, 100svh-146))
// diziliyordu: gösterim cihazında 311×622 render ediliyor ama İÇERİK uygulama
// puntosunda kalıyordu (h1 30px, gövde 17px). Sonuç ölçüldü — 596px'lik
// pencerede 1543px içerik, yani 2,6 ekran gizli, ve `.cubuksuz` çubuğu da
// sildiği için hiçbir işaret yok; aynı anda 2,5 ders satırı görünüyordu.
// 311px'lik bir çerçevede 30px başlık gerçek bir telefon değil küçültülmüş bir
// tablet gibi okunuyor: cihaz yanılsaması kuruluyor ama oranla çürütülüyor.
//
// Artık düzen 390×780'de (gerçek bir telefonun CSS ölçüsü) kuruluyor ve
// kutunun KENDİSİ ölçekleniyor. Ekrandaki ayak izi birebir aynı kalıyor
// (780×0.797 ≈ 622), ama aynı kadraja ~4 satır giriyor ve oran doğru.
const TELEFON_EN = 390;
const TELEFON_BOY = 780;
/** Üst şerit + sayfa dolgusu + sahne dolgusu — kabuğa kalan yer bunun dışı. */
const SAHNE_PAYI = 146;

/**
 * Kabuğun ekrana sığma oranı.
 *
 * CSS'te hesaplanamıyor: `calc()` uzunluğu uzunluğa bölemez, `transform:
 * scale()` ise birimsiz sayı ister. Ölçü bağlandıktan hemen sonra bir kez
 * yazılır — sayfa `yukleniyor` perdesinin arkasındayken, yani kabuk ilk
 * göründüğünde oran zaten doğru; ekranda sıçrama olmuyor.
 */
function useKabukOlcegi(): number {
  const [olcek, setOlcek] = useState(1);
  useEffect(() => {
    const hesapla = () => {
      const dikey = (window.innerHeight - SAHNE_PAYI) / TELEFON_BOY;
      // Dar ekranda kolon tam genişliğe düşer: kabuk oradan da taşmasın
      // (kâğıt payı 64px, sahne dolgusu 2×20px).
      const yatay = (Math.min(window.innerWidth - 64, 1080) - 40) / TELEFON_EN;
      setOlcek(Math.max(0.5, Math.min(1, dikey, yatay)));
    };
    hesapla();
    window.addEventListener("resize", hesapla);
    return () => window.removeEventListener("resize", hesapla);
  }, []);
  return olcek;
}

function gunBasligi(baslar: string): string {
  const t = new Date(`${baslar.slice(0, 10)}T00:00:00`);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  const fark = Math.round((t.getTime() - b.getTime()) / 86400000);
  if (fark === 0) return "Bugün";
  if (fark === 1) return "Yarın";
  return `${GUN[t.getDay()]}, ${t.getDate()} ${AY[t.getMonth()]}`;
}

export default function DanisanPage() {
  const { durum, deri, yukleniyor, guncelle } = useDemo();
  const [benId, setBenId] = useState<number | null>(null);
  const [secAcik, setSecAcik] = useState(false);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const [formYanit, setFormYanit] = useState<string[]>([]);
  const [kvkk, setKvkk] = useState(false);
  const [gunlukNot, setGunlukNot] = useState("");
  // 3. günden itibaren günler katlı. Hepsi açıkken telefonun içinde 28 öğe
  // oluyor ve sunumu yapan kişi "yarın"ı göstermek için uzun uzun kaydırmak
  // zorunda kalıyordu.
  const [acikGunler, setAcikGunler] = useState<string[]>([]);
  // KAYDIRMA İŞARETİ HAREKETE BAĞLI.
  // Alt maske ile tutamak sabit duruyordu ve tutamak aynı anda cihaz
  // metaforunun parçası olduğu için "kaydırılabilir" değil "burası bir
  // telefon" diyordu — iki işaret aynı nesneye yüklüydü. Ölçüldü: kadrajda
  // 754px görünürken içerik 1602px, yani 1,1 ekran gizli ve `.cubuksuz`
  // çubuğu bilerek sildiği için başka hiçbir ipucu yok. Gösterimde sunucu
  // kaydırmayı biliyor, müşteri bilmiyor. Maske dipte kaybolup yukarı
  // çekilince geri gelince işaret HAREKET EDİYOR; duran bir işaretten
  // anlaşılır olan budur.
  const [dipte, setDipte] = useState(false);
  // TUTAMAK PASİF İŞARET DEĞİL, GÖSTERGE.
  // Maske + tutamak "burada devamı var" bilgisini yalnız İMA ediyordu; oysa
  // kadrajda 754px görünürken içerik pilateste 1602px, psikologda 3100px
  // (2,1 ve 4,1 ekran). "Devamı var" ile "dört ekran daha var" aynı şey
  // değil ve `.cubuksuz` çubuğu bilerek sildiği için ikincisini söyleyen
  // hiçbir şey yoktu. Aynı `onScroll` olayından oran da hesaplanıyor:
  // tutamağın izi dolarak kaydırma yolunun NE KADARINI geçtiğinizi söylüyor.
  // Cihaz yanılsaması bozulmuyor — iz hâlâ 28px'lik bir tutamak.
  const [oran, setOran] = useState(0);
  const olcek = useKabukOlcegi();

  const ben = durum.uyeler.find((u) => u.id === benId) ?? durum.uyeler[0];

  const dersler = useMemo(() => {
    const simdi = new Date();
    return takvim(durum, gunYaz(simdi), 7)
      .filter((d) => new Date(d.baslar.replace(" ", "T")) > simdi)
      .map((d) => ({
        ...d,
        bosYer: Math.max(0, d.kapasite - d.kayitli),
        benim: durum.kayitlar.find(
          (k) => k.dersId === d.id && k.uyeId === ben?.id
            && (k.durum === "kayitli" || k.durum === "bekleme"),
        ) ?? null,
      }));
  }, [durum, ben?.id]);

  // Form ve günlük psikoloğa özel; başka sektörde hiç görünmez.
  const ruhsal = deri.kod === "psikolog";
  const benimForm = ruhsal
    ? durum.formlar.find((f) => f.uyeId === ben?.id && !f.dolduruldu) ?? null
    : null;
  const bugunku = durum.gunlukler.find(
    (g) => g.uyeId === ben?.id && g.tarih === gunYaz(new Date()),
  ) ?? null;

  if (yukleniyor) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-ink-3" />
      </div>
    );
  }

  const duyur = (m: string) => {
    setBildirim(m);
    setTimeout(() => setBildirim(null), 4000);
  };

  const gunler = dersler.reduce<Record<string, typeof dersler>>((g, d) => {
    (g[gunBasligi(d.baslar)] ??= []).push(d);
    return g;
  }, {});

  return (
    <div
      data-deri={durum.ayar.deri}
      // Anlatım solda, cihaz sağda: iki kolon da ekranın kendi yüksekliğine
      // sığıyor, sayfa kaydırması yok. Kaydırılan tek şey telefonun İÇİ —
      // demoda parmakla kaydırılması gereken nesne zaten o.
      className="grid gap-b5 pb-b3 lg:grid-cols-12"
    >
      {/* Demo çerçevesi — gerçek telefonda BU ŞERİT OLMAZ. Kâğıt üstünde,
          cihazın DIŞINDA: sunucunun notu, üyenin ekranı değil. */}
      {/* SOL KOLON TELEFONUN BOYUNCA YAYILIR. Ölçüldü: kolon 89'dan 751'e
          uzanıyor ama içeriği 575'te bitiyordu — altında 176px ölü boşluk,
          üç adım da üst %70'e sıkışık. Bu "kasıtlı nefes" değil "içerik bitti
          ama kutu bitmedi" diye okunuyor. Başlık bloğu üstte kalır, üç adımlı
          liste kalan yeri paylaşır ve iki kolon aynı tabanda biter. */}
      <div className="flex flex-col lg:col-span-5">
        <div className="min-w-0">
          {/* EKRANIN KENDİ SAYFA BAŞLIĞI. DOM'da tek h1 telefonun İÇİNDEYDİ
              ("Ders saatleri", 30px), yani sayfanın kendi en büyük puntosu
              30px'ti; diğer dört ekran etiket + 44px h1 ya da 76px kapakla
              açılıyor. Sekmeler arası gezerken tip ölçeği bir anda düşünce bu
              ekran ailenin üyesi gibi değil bir alt sayfa gibi duruyordu. */}
          <Cetvel />
          <p className="etiket mt-b3">{deri.uyeEkraniAdi}</p>
          <h1 className="mt-b1 text-sayfa">
            {deri.uyeIyelik[0].toUpperCase() + deri.uyeIyelik.slice(1)} telefonu
          </h1>
          {/* Demo notu artık kendi cetvelini TAŞIMAZ: bir kolonda iki cetvel
              iki bölüm demektir, oysa bu not sayfa başlığının altıdır. */}
          <p className="etiket mt-b5">Demo notu</p>
          <p className="olcu mt-b1 text-govde text-ink-2">
            <b className="text-ink">
              {deri.uyeIyelik[0].toUpperCase() + deri.uyeIyelik.slice(1)} telefonunda
              göreceği ekran.
            </b>{" "}
            Gerçekte kendi numarasıyla girer; burada göstermek için kişi seçiliyor.
          </p>
          <div className="mt-b3">
            <motion.button
              onClick={() => setSecAcik((a) => !a)}
              whileTap={{ scale: 0.985 }}
              className="flex h-dokunma items-center gap-b2 rounded-kontrol border border-cizgi-koyu px-b3 text-govde"
            >
              {ben?.ad} olarak görüntüleniyor
              <ChevronDown className={`size-4 transition-transform ${secAcik ? "rotate-180" : ""}`} />
            </motion.button>
            {/* AnimatePresence yok — gerekcesi uyeler/page.tsx'te. */}
            {secAcik && (
                <motion.div {...belir()}>
                  <div className="mt-b2 flex flex-wrap gap-b2">
                    {durum.uyeler.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setSecAcik(false); setBenId(u.id); }}
                        className={`h-dokunma rounded-kontrol px-b3 text-govde ${
                          u.id === ben?.id
                            ? "bg-ink text-uzeri"
                            : "border border-cizgi text-ink-2"
                        }`}
                      >
                        {u.ad}
                      </button>
                    ))}
                  </div>
                </motion.div>
            )}
          </div>
        </div>

        {/* ÜYE NE YAPIYOR — kabuğun solundaki ölü alan. Etiket + tek cümle,
            cetvelle ayrılmış: sunucunun ezberlemesi gereken üç adım. */}
        <ul className="mt-b6 border-t border-cizgi lg:flex lg:flex-1 lg:flex-col lg:justify-between">
          {[
            {
              e: "1 · Saatini seçer",
              c: `Haftanın ${deri.seanslar}ını görür, boş saate tek dokunuşla yer ayırtır.`,
            },
            {
              e: "2 · Dolu saatte sıraya girer",
              c: "Yer açılırsa sırayla girer; kimse kimseyi aramaz.",
            },
            {
              e: "3 · Gelemeyeceğini bildirir",
              c: "Yeri bekleyendeki ilk kişiye anında geçer, boşa gitmez.",
            },
          ].map((x) => (
            <li key={x.e} className="border-b border-cizgi py-b3">
              <p className="etiket">{x.e}</p>
              <p className="olcu mt-b1 text-govde text-ink-2">{x.c}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* ------------------------------------------------------ telefon sahnesi */}
      {/* Düzen 390×780'de kurulur, kutu `olcek` ile küçülür (bkz. yukarıdaki
          not). Ayak izi ölçekli boy kadar: dış kutu o yeri ayırır, ölçeklenen
          katman `top left` köşesinden büyüyüp küçülür, böylece ortalama
          `place-items-center` ile bozulmadan çalışır. */}
      <div className="cukur-zeminde grid place-items-center overflow-hidden rounded-sahne p-b4 lg:col-span-7">
        <div style={{ width: TELEFON_EN * olcek, height: TELEFON_BOY * olcek }}>
        <div
          style={{
            width: TELEFON_EN,
            height: TELEFON_BOY,
            transform: `scale(${olcek})`,
            transformOrigin: "top left",
          }}
        >
        <motion.div
          initial={{ y: 18 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.45, ease: GIRIS }}
          className="flex size-full flex-col overflow-hidden rounded-cihaz bg-yuzey shadow-kalkik-3"
        >
          {/* 26px durum çubuğu: cihaz olduğunu söyleyen en ucuz işaret. */}
          <div className="flex h-[26px] shrink-0 items-center justify-center bg-ink">
            <span className="h-1 w-20 rounded-full bg-uzeri/40" />
          </div>

          {/* Kaydırma CİHAZIN İÇİNDE. Alt kenardaki 24px maske kaydırılabildiğini
              söyler: dokunmatik tablette ince kaydırma çubuğu hiç görünmüyor. */}
          <div className="relative min-h-0 flex-1">
          <div
            // 8px pay: alt kenarda kalan kesirli piksel yüzünden maske dipte
            // "neredeyse kaybolmuş" hâlde takılmasın.
            onScroll={(e) => {
              const el = e.currentTarget;
              setDipte(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
              const yol = el.scrollHeight - el.clientHeight;
              setOran(yol > 0 ? Math.min(1, Math.max(0, el.scrollTop / yol)) : 0);
            }}
            className="cubuksuz h-full overflow-y-auto px-b4 pb-b5 pt-b4"
          >
            <header className="mb-b4">
              <Cetvel />
              <h1 className="mt-b3 text-bolum">
                {deri.seans[0].toUpperCase() + deri.seans.slice(1)} saatleri
              </h1>
              <p className="mt-b1 text-govde text-ink-2">
                Merhaba {ben?.ad?.split(" ")[0]} · kalan hakkınız{" "}
                <b className="tnum text-ink">{ben?.paketKalan} {deri.seans}</b>
              </p>
            </header>

            {/* OPAKLIK YOK: rAF durmussa bu satir opacity 0'da KALIR — uye
                ekraninda "yeriniz ayrildi" onayi hic gorunmez. Yalniz 10px. */}
            {bildirim && (
                <motion.p
                  initial={{ y: -10 }}
                  animate={{ y: 0 }}
                  transition={ONAY}
                  className="mb-b3 flex items-start gap-b2 bg-durum-iyi-tint px-b4 py-b3 text-govde text-durum-iyi"
                >
                  <Check className="mt-b1 size-4 shrink-0" />
                  {bildirim}
                </motion.p>
            )}

            {/* ÖN FORM — tablette doldurulur, uzmanın ekranında anında belirir. */}
            {benimForm && (
              <section className="mb-b5 bg-cukur p-b4">
                <Cetvel dar />
                <h2 className="mt-b3 text-one">İlk görüşme ön formu</h2>
                <p className="mt-b1 text-govde text-ink-2">
                  Seansa başlamadan önce birkaç kısa soru. Cevaplarınız yalnızca
                  uzmanınızla paylaşılır.
                </p>
                <div className="mt-b4 flex flex-col gap-b3">
                  {FORM_SORULARI.map((soru, i) => (
                    <label key={soru} className="block">
                      <span className="mb-b2 block text-govde">{soru}</span>
                      <textarea
                        rows={2}
                        value={formYanit[i] ?? ""}
                        onChange={(e) => setFormYanit((y) => {
                          const k = [...y];
                          k[i] = e.target.value;
                          return k;
                        })}
                        placeholder="Kısaca yazmanız yeterli"
                        // `resize-none`: tarayıcı varsayılanı (resize: vertical)
                        // her alanın sağ alt köşesine büyütme tutamağı koyuyordu.
                        // GERÇEK BİR TELEFONDA KÖŞE TUTAMAĞI YOKTUR — bu ekranın
                        // tek işi "danışanınız telefonunda BUNU görecek" demek ve
                        // tutamak, cihaz yanılsamasını kurulduğu saniyede
                        // çürütüyordu. Müşteri parmağıyla sürükleyip alanı
                        // büyütürse gösterimin ortasında düzen de bozuluyordu.
                        className="w-full resize-none rounded-kontrol border border-cizgi-koyu bg-yuzey px-b4 py-b2 text-govde outline-none placeholder:text-ink-3"
                      />
                    </label>
                  ))}
                  <label className="flex items-start gap-b3 bg-yuzey px-b4 py-b3">
                    <input
                      type="checkbox"
                      checked={kvkk}
                      onChange={(e) => setKvkk(e.target.checked)}
                      className="mt-b1 size-5 shrink-0 accent-[var(--color-ink)]"
                    />
                    <span className="text-govde text-ink-2">
                      Verdiğim bilgilerin yalnızca danışmanlık sürecim için işlenmesini ve
                      saklanmasını kabul ediyorum (KVKK aydınlatma metni).
                    </span>
                  </label>
                  <motion.button
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      if (!kvkk) return;
                      guncelle((d) => formDoldur(d, benimForm.id, formYanit));
                      setFormYanit([]);
                      setKvkk(false);
                      duyur("Formunuz iletildi, teşekkür ederiz.");
                    }}
                    disabled={!kvkk}
                    className="h-eylem w-full rounded-kontrol bg-ink text-govde font-medium text-uzeri disabled:opacity-35"
                  >
                    Formu gönder
                  </motion.button>
                </div>
              </section>
            )}

            {/* SEANS ARASI GÜNLÜK — tek dokunuş, uzun anket değil. */}
            {ruhsal && (
              <section className="mb-b5 bg-cukur p-b4">
                <Cetvel dar />
                <h2 className="mt-b3 text-one">Bugün nasılsınız?</h2>
                <p className="mt-b1 text-govde text-ink-2">
                  Tek dokunuş yeterli. Uzmanınız seans öncesi topluca görür.
                </p>
                <div className="mt-b4 flex gap-b1">
                  {RUH_HALI.map((etiket, i) => {
                    const secili = bugunku?.ruh === i + 1;
                    return (
                      <motion.button
                        key={etiket}
                        onClick={() => {
                          guncelle((d) => gunlukYaz(d, ben.id, i + 1, gunlukNot));
                          duyur("Kaydedildi, teşekkürler.");
                        }}
                        whileTap={{ scale: 0.96 }}
                        className={`relative min-h-dokunma flex-1 px-b1 py-b2 text-etiket ${
                          secili ? "text-uzeri" : "border border-cizgi-koyu text-ink-2"
                        }`}
                      >
                        {secili && (
                          <motion.span
                            layoutId="ruh-secim"
                            className="absolute inset-0 bg-ink"
                            transition={ONAY}
                          />
                        )}
                        <span className="relative">{etiket}</span>
                      </motion.button>
                    );
                  })}
                </div>
                <input
                  value={gunlukNot}
                  onChange={(e) => setGunlukNot(e.target.value)}
                  placeholder="İsterseniz tek cümle ekleyin (zorunlu değil)"
                  className="mt-b3 h-eylem w-full rounded-kontrol border border-cizgi-koyu bg-yuzey px-b4 text-govde outline-none placeholder:text-ink-3"
                />
                {bugunku && (
                  <p className="mt-b2 text-govde text-ink-2">
                    Bugün için kaydedildi: <b className="text-ink">{RUH_HALI[bugunku.ruh - 1]}</b>
                    {bugunku.not ? ` — "${bugunku.not}"` : ""}
                  </p>
                )}
              </section>
            )}

            {/* --------------------------------------------------- gün gün */}
            {Object.entries(gunler).map(([gun, liste], gi) => {
              // Bugün ve yarın açık; 3. günden itibaren gün tek satıra katlanır
              // ve dokununca açılır. Hepsi açıkken telefonun içinde 28 öğe
              // oluyor ve "yarın"ı göstermek bile uzun bir kaydırma gerektiriyordu.
              const katlanabilir = gi >= 2;
              const acik = !katlanabilir || acikGunler.includes(gun);
              const bosToplam = liste.reduce((t, d) => t + d.bosYer, 0);
              return (
              <section key={gun}>
                {/* Yapışkan gün başlığı: telefonda aşağı inerken "hangi gündeyim"
                    bilgisi ekranda kalır. */}
                <h2 className="etiket sticky top-0 z-10 -mx-b4 border-b border-cizgi bg-yuzey px-b4 py-b2">
                  {katlanabilir ? (
                    <button
                      onClick={() => setAcikGunler((g) =>
                        g.includes(gun) ? g.filter((x) => x !== gun) : [...g, gun])}
                      className="flex min-h-dokunma w-full items-center justify-between gap-b2 text-left"
                    >
                      <span>{gun}</span>
                      <span className="tnum flex items-center gap-b2 normal-case tracking-normal">
                        {liste.length} {deri.seans} · {bosToplam} yer
                        <ChevronDown
                          className={`size-4 transition-transform ${acik ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>
                  ) : (
                    gun
                  )}
                </h2>
                {acik && (
                <motion.div
                  variants={sira.kap}
                  initial="gizli"
                  animate="gorunur"
                  className="mb-b4"
                >
                  {liste.map((d, i) => {
                    const benim = d.benim;
                    const dolu = d.bosYer === 0;
                    // BİR AMİRAL + KÜNYELER. Sekiz özdeş satır alt alta
                    // dizilince ekran bir bileşen kütüphanesi demosu gibi
                    // okunuyordu; aynı kural Sunum'un ürün listesinde
                    // uygulanmış, burada uygulanmamıştı. İlk günün ilk
                    // dersi kalkık bir yüzey (sıradaki ders o), kalanı 1px
                    // kıl çizgiyle ayrılmış künye satırı.
                    const amiral = gi === 0 && i === 0;
                    return (
                      <motion.article
                        key={d.id}
                        custom={i}
                        variants={sira.oge}
                        layout
                        className={`relative ${
                          amiral
                            ? "mb-b3 rounded-yuzey bg-yuzey p-b3 shadow-kalkik-1"
                            : "border-b border-cizgi py-b3"
                        }`}
                      >
                        {/* Kayıtlı satırın işareti MUTLAK konumlu: kenarlık
                            +padding ile yapılınca o satır diğerlerine göre
                            15px içeri kayıyor ve saat kolonu hizasını
                            kaybediyordu. Şerit artık yerleşimi hiç bozmuyor. */}
                        {benim && (
                          <motion.span
                            aria-hidden
                            layout
                            className="absolute inset-y-0 -left-b2 w-[3px] bg-ink"
                          />
                        )}
                        {/* HİYERARŞİ DÜZELTİLDİ: en güçlü öğe DERS ADI.
                            Saat 20px/600, ders adı 17px/400 iken liste bir
                            tren tarifesine dönüyordu; oysa üyenin sorusu
                            "hangi ders / kim / kaçta / yer var mı" sırasıyla
                            geliyor. Düğme de satır içinde ve İÇERİK
                            GENİŞLİĞİNDE: sekiz-on tam genişlik hayalet düğme
                            alt alta dizilince "tek tip kart ızgarası"nın
                            dikey hâli oluyordu. */}
                        {/* SATIR SARMAZ — BEŞ SATIRIN ANATOMİSİ AYNI.
                            Sarmaya izin verilince 390px'lik telefonda yalnız
                            dolu saatin düğmesi ("Bekleme listesine gir") alt
                            satıra düşüyordu: beş satırın dördü tek anatomi,
                            biri başka; satırın sağ kenarı tek düşey eksende
                            değil L biçiminde kırılıyor ve o satır
                            komşularından ~30px yüksek kalıyordu. Bu ekranın
                            tek işi "üyeniz telefonunda BUNU görecek" demek;
                            gösterimde en çok bakılan çerçevede kaza gibi duran
                            bir satır "parça parça eklenmiş arayüz" diye
                            okunuyor.
                            Çözüm düzeni esnetmek değil metni kısaltmak:
                            "Sıraya gir" 390px'te satır içinde kalıyor ve
                            bilgi kaybı yok — "Dolu · N kişi bekliyor" zaten
                            künye satırında yazılı, basınca gelen bildirim de
                            bekleme listesini adıyla söylüyor. */}
                        <div className="flex flex-nowrap items-start gap-b2">
                          <div className="min-w-0 flex-1 basis-1/2">
                            <p className="truncate text-one">{d.ad}</p>
                            <p className="tnum mt-b1 truncate text-govde text-ink-2">
                              {d.baslar.slice(11, 16)}
                              <span className="text-kunye text-ink-3">
                                {" · "}{d.egitmen}
                              </span>
                            </p>
                            <motion.p
                              key={benim?.durum ?? "bos"}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, ease: GIRIS }}
                              className={`mt-b1 flex items-center gap-b1 text-kunye ${
                                benim?.durum === "kayitli" ? "text-durum-iyi"
                                  : benim?.durum === "bekleme" ? "text-durum-dikkat"
                                    : "text-ink-3"
                              }`}
                            >
                              {benim?.durum === "kayitli" && (
                                <Check className="size-4 shrink-0" />
                              )}
                              {benim?.durum === "kayitli"
                                ? "Yeriniz ayrıldı"
                                : benim?.durum === "bekleme"
                                  ? `Bekleme listesinde ${benim.sira}. sıradasınız`
                                  : dolu
                                    ? `Dolu${d.bekleyen ? ` · ${d.bekleyen} kişi bekliyor` : ""}`
                                    : `${d.bosYer} yer var`}
                            </motion.p>
                          </div>

                          <div className="ml-auto shrink-0">
                        {benim ? (
                          <motion.button
                            whileTap={{ scale: 0.985 }}
                            // Bildirim `guncelle` güncelleyicisinin İÇİNDE
                            // çağrılmıyor: React onu "render sırasında
                            // setState" sayıp uyarı basıyordu. `durum` zaten
                            // güncel; önce hesapla, sonra ikisini de yaz.
                            onClick={() => {
                              const r = iptalEt(durum, benim.id, deri);
                              guncelle(() => r.durum);
                              duyur(r.yukselen
                                ? `Yeriniz bırakıldı — ${r.yukselen.uye} bekleme listesinden girdi.`
                                : "Yeriniz bırakıldı.");
                            }}
                            className="h-dokunma rounded-kontrol border border-durum-yikici px-b3 text-govde text-durum-yikici"
                          >
                            Gelemeyeceğim
                          </motion.button>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.985 }}
                            onClick={() => {
                              const r = rezerveEt(durum, d.id, ben.id);
                              guncelle(() => r.durum);
                              duyur(r.sonuc.durum === "bekleme"
                                ? `Saat doluydu, bekleme listesine ${r.sonuc.sira}. sıradan yazıldınız. Yer açılırsa haber gelecek.`
                                : "Yeriniz ayrıldı.");
                            }}
                            // DOLGU KEYFÎ BİR SIRAYA DEĞİL BİR DURUMA BAĞLI.
                            // İlk boş saatin düğmesi dolgulu, aşağıdaki
                            // özdeş "Yer ayırt"ların hepsi hayaletti: etiketi
                            // aynı, işlevi aynı, ağırlığı farklı iki düğme alt
                            // alta durunca kullanıcı bir fark arıyor ve
                            // bulamıyor ("ilki seçili mi?"). Üye ekranının tek
                            // işi "bu, üyenin telefonunda böyle görünür"
                            // demek; orada anlamsız bir vurgu farkı ürünün
                            // kendi kurallarını bilmediğini gösteriyor.
                            //
                            // Hepsi aynı hayalet düğme; dolgu yalnız BASILDIĞI
                            // anda geliyor, yani "gerçekleşen eylem" anlamını
                            // taşıyor. Sonucu satırın kendisi söylüyor:
                            // "Yeriniz ayrıldı" / "… sıradasınız".
                            //
                            // VURGU RENGİ "YER AYIRT"TA DEĞİL. Canlıda sayıldı:
                            // altı özdeş kiremit konturlu pil + bekleme düğmesi
                            // + sekme çizgisi = sekiz vurgu; kural "ekran başına
                            // en fazla üç". Altı özdeş pilin dikey tekrarı da
                            // şablon hissinin kalan en güçlü kaynağıydı: vurgu
                            // altı yerde kullanılınca "önce buraya bak" demeyi
                            // bırakıyor, geriye desen kalıyor. "Yer ayırt"
                            // Program'daki hayalet düğme diliyle birebir aynı
                            // (1px --cizgi-koyu, basılınca mürekkep dolar);
                            // vurgu yalnız BEKLEME LİSTESİ düğmesinde kalıyor —
                            // o gerçekten başka bir cins eylem ve ürünün
                            // satışlık cümlesi orada.
                            className={`h-dokunma whitespace-nowrap rounded-kontrol border px-b3 text-govde transition-colors ${
                              dolu
                                ? "border-vurgu font-medium text-vurgu active:bg-vurgu active:text-uzeri"
                                : "border-cizgi-koyu text-ink active:bg-ink active:text-uzeri"
                            }`}
                          >
                            {dolu ? "Sıraya gir" : "Yer ayırt"}
                          </motion.button>
                        )}
                          </div>
                        </div>

                        {benim?.durum === "kayitli" && (
                            <motion.p
                              {...belir()}
                              className="mt-b2 text-kunye text-ink-3"
                            >
                              Öncesinde hatırlatma gelecek
                            </motion.p>
                        )}
                      </motion.article>
                    );
                  })}
                </motion.div>
                )}
              </section>
              );
            })}
          </div>
          {/* ALT MASKE + TUTAMAK. Maske 24px'ten 40px'e çıktı ve ortasına
              cihaz tutamağı geldi: üstte siyah durum çubuğu varken altta
              hiçbir şey yoktu, yani cihaz yarım kalıyordu. Tutamak aynı anda
              "burası kaydırılıyor" işareti — `.cubuksuz` çubuğu bilerek
              sildiği için başka hiçbir işaret yok; artık pasif bir ima değil,
              dolan bir iz (bkz. `oran`). */}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 transition-opacity duration-200 ${
              dipte ? "opacity-0" : "opacity-100"
            }`}
            style={{ background: "linear-gradient(transparent, var(--color-yuzey))" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-b2 left-1/2 h-[3px] w-7 -translate-x-1/2 overflow-hidden rounded-full bg-cizgi-koyu"
          >
            {/* Dolum `transform` ile: yükseklik/genişlik animasyonu düzen
                hesabı tetikler, `scaleX` etmez. Kaynak sol kenar, çünkü
                okuma yönü ile kaydırma yönü aynı eksende ilerliyor. */}
            <span
              className="block size-full origin-left rounded-full bg-ink"
              style={{ transform: `scaleX(${oran})` }}
            />
          </span>
          </div>
        </motion.div>
        </div>
        </div>
      </div>
    </div>
  );
}
