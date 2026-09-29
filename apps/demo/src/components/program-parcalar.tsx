"use client";

import { motion } from "framer-motion";
import { Fragment, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { belir, Cetvel, GIRIS, ONAY, SAHNE, sira } from "@/components/animasyon";
import type { Mesaj } from "@/lib/islem";

// PROGRAM EKRANININ TEKRAR EDEN PARÇALARI
//
// Ekranın kendisi (page.tsx) beş bölümü birbirine bağlıyor; buradakiler o
// bölümlerin hepsinde aynı biçimde kullanılan yapı taşları. Ayrı dosyada
// durmalarının sebebi sadece satır sayısı değil: bölüm başlığının,
// koltuk ızgarasının ve mesaj satırının kuralı TEK yerde yazılı olsun ki
// beş bölüm gerçekten aynı görünsün.

/** Kuyruk grubu: başlığı, mesajları ve React anahtarını üreten işlev. */
export interface Grup {
  ad: string;
  liste: Mesaj[];
  anahtar: (m: Mesaj, i: number) => string;
  /** Yalnız deneme takibinde var: gönderilen mesaj kayda işleniyor. */
  gonderildi?: (m: Mesaj) => void;
}

/** Bölüm başlığı: üstünde 2px cetvel, altında etiket. Beş bölümde de aynı. */
export function BolumBasi({
  etiket, baslik, altYazi, gecikme = SAHNE.cetvel, sag, vurguCetvel = false,
}: {
  etiket: string; baslik: React.ReactNode; altYazi?: string;
  gecikme?: number; sag?: React.ReactNode;
  /** Ekranın ANA yüzeyinin üst cetveli kiremit olur — ekran başına en fazla
      bir kez. Bkz. program/page.tsx'teki vurgu bütçesi notu. */
  vurguCetvel?: boolean;
}) {
  return (
    <div className="mb-b4">
      <Cetvel gecikme={gecikme} vurgu={vurguCetvel} />
      <div className="mt-b3 flex flex-wrap items-end justify-between gap-b3">
        <div className="min-w-0">
          <p className="etiket">{etiket}</p>
          <h2 className="mt-b1 text-bolum">{baslik}</h2>
        </div>
        {sag}
      </div>
      {altYazi && <p className="olcu mt-b2 text-govde text-ink-2">{altYazi}</p>}
    </div>
  );
}

/**
 * KOLTUK IZGARASI — kapasite kadar küçük kare.
 *
 * Ders satırının ortasında ~600px hiçlik vardı; oradaki "4/8" rakamı da
 * doluluğu ANLATMIYORDU. Kareler tek bakışta söylüyor. Dolu kareler sırayla
 * ve yaylı doluyor: "az önce biri girdi" hissi buradan geliyor.
 *
 * Köşe yarıçapı sıfır — veri alanı yuvarlanmaz.
 *
 * BOŞ KARE KONTURLA DEĞİL DOLGUYLA: 12px kare + 1px açık gri kontur, kol
 * mesafesindeki parlak camlı bir tablette (bu yönün bütün gerekçesi o cihaz)
 * kayboluyordu ve ızgara "kaç kare var" bilgisini veremiyordu. Kare 14px'e
 * çıktı, boşlar --cukur-koyu dolgulu: dolgu o ekranda kaybolmuyor.
 */
export function Koltuklar({ dolu, kapasite }: { dolu: number; kapasite: number }) {
  // Psikologda kapasite 1. Tek kare ızgara olmaz; o deride durum rozeti
  // (Dolu / Boş) sağdaki sütunda zaten yazıyor, burada ikinci kez yazmak
  // aynı bilgiyi iki yere koymak olurdu. Kolon boş kalıyor ve seans adına
  // yer açıyor — "Bireysel seans" artık kesilmiyor.
  if (kapasite <= 1) return null;
  return (
    <span className="flex flex-wrap items-center gap-b1" aria-hidden>
      {Array.from({ length: kapasite }).map((_, i) =>
        i < dolu ? (
          <motion.span
            key={i}
            className="block size-3.5 bg-ink"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...ONAY, delay: i * 0.03 }}
          />
        ) : (
          <span key={i} className="block size-3.5 bg-cukur-koyu" />
        ),
      )}
    </span>
  );
}

/**
 * Mesajın NEDEN çıktığını söyleyen künye — KIRPILMAZ, PARÇALANIR.
 *
 * Tek cümle olarak basılıp `line-clamp-2` ile kesiliyordu ve dar kolonda
 * (5/12, ~400px) üç künyenin üçü de "…" ile yarım kalıyordu: "3 gün önce
 * deneme dersine geldi · 3. gün…". Satılan ürünün ekranında yarım kalmış
 * cümle, karşı tarafa "bu yazılım kendi verisini gösteremiyor" diye okunur.
 * Kolon genişliği sabit olduğu için bu rastlantı değil, her zaman oluyordu.
 *
 * Künye zaten " · " ile bölünmüş parçalardan kurulu: ilk parça (zaman) üstte
 * tnum ile, kalanı (durum) altta. İkisi de kendi satırına sığıyor.
 *
 * PUNTO 17px DEĞİL, 15px KÜNYE KADEMESİ. 17px'e çıkarmak satırı 140px'e
 * taşıyor ve altı satırda kolon tek başına sayfayı ikiye katlıyordu; ama 13px
 * de doğru değildi: `text-etiket` tek satırlık, sarmayan ETİKET kademesidir ve
 * sarmalayan üç satırlık bir cümle 13/16'da (1.23) kol mesafesinden
 * okunmuyordu — üstelik 26px ritmindeki gövdenin yanında sıkışık bir blok
 * gibi duruyor ve "Uzm. / Psk. Elif" satır ortasından bölünüyordu. Ara kademe
 * (15/20) ikisini de çözüyor: satır yüksekliği sadece 4px artıyor.
 */
function Kunye({ aciklama }: { aciklama: string }) {
  const [ilk, ...kalan] = aciklama.split(" · ");
  return (
    <>
      <p className="tnum text-kunye text-ink-3">{ilk}</p>
      {kalan.length > 0 && (
        // İKİNCİ SATIRDA `truncate` YOK: psikolog derisinde sebep üç parçalı
        // ("bugün 09:30 · Bireysel seans · Uzm. Psk. Elif") ve zaman ayrıldıktan
        // sonra bile kalanı tek satıra sığmıyordu. Kırpmak yerine sarıyor —
        // bu ürünün kuralı "her mesajın yanında NEDEN çıktığı YAZILI olsun",
        // yarısı yazılı olsun değil.
        //
        // SARMA YERİ SEÇİLİR, RASTGELE DEĞİL. Düz `join(" · ")` ile satır
        // "Uzm." ile "Psk. Elif" arasından bölünüyordu (ölçüldü: 149px kutu,
        // psikolog kuyruğunda iki satırda birden) — bir unvan kısaltmasının
        // ortasından kırılmak, bu turda `· 3` için `whitespace-nowrap` ile
        // düzeltilen kusurun kardeşi. Her parça kendi içinde sarmıyor, ayraç
        // parçanın SONUNDA kalıyor: kırılma ancak " · "den olur ve hiçbir
        // satır "Uzm." ile bitmez. Kap `min-w-0` olduğu için taşma riski yok.
        <p className="text-kunye text-ink-3">
          {kalan.map((parca, i) => (
            <Fragment key={parca}>
              {i > 0 && " "}
              <span className="whitespace-nowrap">
                {parca}{i < kalan.length - 1 ? " ·" : ""}
              </span>
            </Fragment>
          ))}
        </p>
      )}
    </>
  );
}

/**
 * Kuyruktaki tek mesaj satırı.
 *
 * HAYALET DÜĞME DİSİPLİNİ: bu ekranda otuzdan fazla "Mesaj at" var; hepsi
 * dolgulu olsaydı vurgu bütçesi tek bölümde biterdi. Düğme 1px kenarlıklı
 * hayalet; basılınca --ink'e dolar ve "Gönderildi"ye geçer. Doymuş WhatsApp
 * yeşili kâğıda yapıştırılmış gibi durduğu için hiç kullanılmıyor.
 */
export function MesajSatiri({ m, sira: i, onGonderildi, icerde = false }: {
  m: Mesaj; sira: number; onGonderildi?: () => void;
  /** Küme içindeki satır: açıklama üstteki grup satırında zaten yazılı. */
  icerde?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [gonderildi, setGonderildi] = useState(false);

  return (
    <motion.li custom={i} variants={sira.oge} className="border-b border-cizgi last:border-b-0">
      <div
        className={`flex items-center gap-b3 py-b3 ${
          icerde ? "min-h-dokunma" : "min-h-16"
        }`}
      >
        {/* Kuyruk kolonu 5/12, yani ~400px. Ad 22px, ALT METİN 15px künye:
            mesajın NEDEN çıktığını söyleyen satır dipnot kademesindedir ama
            sarmalayan bir cümledir. 17px'te düğmeleri alt satıra itiyor ve her
            satır 140px'e çıkıyordu — altı satırda 850px, yani kolon tek başına
            sayfayı ikiye katlıyordu. */}
        <div className="min-w-0 flex-1">
          <p className={`truncate ${icerde ? "text-govde" : "text-one"}`}>{m.uye}</p>
          {/* Aynı cümlenin beş kez alt alta tekrarı veri üreticisinin
              çıktısını olduğu gibi dökmek demektir; küme içinde açıklama
              tek kez, grup satırında yazılı. */}
          {!icerde && <Kunye aciklama={m.aciklama} />}
        </div>
        <div className="flex shrink-0 items-center gap-b2">
          <motion.a
            href={m.link}
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.985 }}
            onClick={() => { setGonderildi(true); onGonderildi?.(); }}
            className={`flex h-dokunma items-center gap-b2 rounded-kontrol px-b4 text-govde transition-colors ${
              gonderildi
                ? "bg-ink font-medium text-uzeri"
                : "border border-cizgi-koyu text-ink hover:border-ink"
            }`}
          >
            {gonderildi ? <Check className="size-4" /> : <WhatsApp />}
            {gonderildi ? "Gönderildi" : "Mesaj at"}
          </motion.a>
          <motion.button
            onClick={() => setAcik((a) => !a)}
            whileTap={{ scale: 0.985 }}
            title="Ne yazacak?"
            aria-label="Ne yazacak?"
            className="grid size-dokunma place-items-center rounded-kontrol text-ink-3 transition-colors hover:text-ink"
          >
            <ChevronDown className={`size-5 transition-transform ${acik ? "rotate-180" : ""}`} />
          </motion.button>
        </div>
      </div>
      {/* ANIMATEPRESENCE YOK: cikis animasyonu bitene kadar dugum DOM'da
          kaliyor ve animasyon rAF ile ilerliyor; tarayici sayfayi gorunmez
          sayarsa (gomulu panel, arka plan sekmesi) satir bir daha KAPANMIYOR.
          Yukseklik animasyonu da ayni sebeple kalkti: rAF durmussa `height: 0`
          kalir ve dokunulan satir hic acilmaz. Geriye 12px kayma kaldi —
          yarim kalirsa metin 12px yukarida durur, yani okunur. */}
      {acik && (
        <motion.div {...belir()}>
          <p className="mb-b3 bg-cukur px-b4 py-b3 text-govde text-ink-2">{m.metin}</p>
        </motion.div>
      )}
    </motion.li>
  );
}


// ---------------------------------------------------------------- kuyruk ---

/** Aynı derse ait mesajlar tek küme; küme tek satır olur. */
interface Kume { aciklama: string; liste: Mesaj[] }

function kumele(liste: Mesaj[]): Kume[] {
  const harita = new Map<string, Mesaj[]>();
  for (const m of liste) {
    const oncekiler = harita.get(m.aciklama);
    if (oncekiler) oncekiler.push(m);
    else harita.set(m.aciklama, [m]);
  }
  return [...harita.entries()].map(([aciklama, liste]) => ({ aciklama, liste }));
}

/**
 * Küme satırının başlığı — zaman üstte, ders altta.
 *
 * `<button>` içinde olduğu için hepsi `span`: satır içi olmayan bir öğe
 * (p, div) buraya konamaz, HTML geçersiz olur ve tarayıcı ağacı bozar.
 */
function KumeBasligi({ aciklama }: { aciklama: string }) {
  const [ilk, ...kalan] = aciklama.split(" · ");
  if (kalan.length === 0) return <span className="block truncate text-one">{ilk}</span>;
  return (
    <>
      <span className="tnum block truncate text-kunye text-ink-3">{ilk}</span>
      <span className="block truncate text-one">{kalan.join(" · ")}</span>
    </>
  );
}

/** Baş harf dairesi — küme satırında kimlerin olduğunu tek bakışta söyler. */
function Basharfler({ liste }: { liste: Mesaj[] }) {
  const gorunen = liste.slice(0, 4);
  const kalan = liste.length - gorunen.length;
  return (
    <span className="flex items-center -space-x-b1" aria-hidden>
      {gorunen.map((m) => (
        <span
          key={m.telefon}
          className="grid size-7 place-items-center rounded-full bg-cukur-koyu text-etiket text-ink ring-2 ring-kagit"
        >
          {m.uye[0]}
        </span>
      ))}
      {kalan > 0 && (
        <span className="tnum grid size-7 place-items-center rounded-full bg-cukur text-etiket text-ink-3 ring-2 ring-kagit">
          +{kalan}
        </span>
      )}
    </span>
  );
}

/**
 * KÜME SATIRI — aynı dersin bütün hatırlatmaları.
 *
 * Eskiden "Hatırlatma · 23" grubunda arka arkaya 23 satır vardı ve beş ardışık
 * satırın alt metni birebir aynıydı ("bugün 09:30 · Reformer · Selda"). Ürün
 * "siz hiçbir şey yapmazsınız" derken ekran 23 kez tıklama gösteriyordu.
 * Artık ders başına TEK satır: kimler olduğu baş harflerden, kaç kişi olduğu
 * rozetten okunuyor.
 *
 * DOLGULU DÜĞME BURADA DEĞİL, GRUP BAŞLIĞINDA — kural buydu ama uygulama
 * değildi: tek bir HATIRLATMA grubunun içinde dört adet dolgulu siyah pil
 * sayıldı (·4, ·5, ·8, ·6). Sağ kolon ~110px'de bir tekrarlayan siyah
 * bantlardan oluşan bir merdiven gibi okunuyordu ve gözün takip edeceği tek
 * dikey eksen kalmıyordu (biri solda düğmeler, biri sağda hayalet düğmeler —
 * iki eksen yarışıyordu). Swiss disiplininin bütün kazancı ekranın en
 * kalabalık ve en çok bakılan yerinde geri veriliyordu.
 *
 * Küme satırı artık düğmesiz: ne olduğu üstte, KİMLER olduğu baş harflerde,
 * KAÇ KİŞİ olduğu künyede. Satırın kendisi açılıp kişi satırlarını gösteriyor;
 * eylem zaten oradaki hayalet düğmelerde. Toplu eylem grup başlığında TEK.
 */
function KumeSatiri({ kume, sira: i, zorlaAcik = false, onGonderildi }: {
  kume: Kume; sira: number; zorlaAcik?: boolean; onGonderildi?: (m: Mesaj) => void;
}) {
  const [kendiAcik, setKendiAcik] = useState(false);
  const [gonderilen, setGonderilen] = useState(0);
  const n = kume.liste.length;
  // Grup başlığındaki toplu eylem bütün kümeleri açar; satır kendi başına da
  // açılabilir. İkisi tek bir görünür duruma iniyor.
  const acik = kendiAcik || zorlaAcik;

  return (
    <motion.li custom={i} variants={sira.oge} className="border-b border-cizgi">
      {/* Satırın TAMAMI açma hedefi: dar kolonda ayrı bir düğme koymak hem
          ikinci bir eksen açıyor hem 44px'lik hedefi küçültüyordu. */}
      <button
        onClick={() => setKendiAcik((a) => !a)}
        className="flex min-h-16 w-full items-center gap-b3 py-b3 text-left"
      >
        <span className="min-w-0 flex-1">
          {/* Künyeyle aynı kural: " · " ile parçala, kırpma. Tek satıra
              basıldığında dar kolonda "bugün 12:00 · Mat Pilates · K…" diye
              kesiliyordu — satılan ürünün ekranında yarım cümle ucuzluk
              işaretidir. Üstte zaman (tnum), altta dersin kendisi. */}
          <KumeBasligi aciklama={kume.aciklama} />
          <span className="mt-b2 flex items-center gap-b2">
            <Basharfler liste={kume.liste} />
            <span
              className={`tnum text-etiket ${
                gonderilen > 0 ? "text-durum-iyi" : "text-ink-3"
              }`}
            >
              {gonderilen === 0
                ? `· ${n} kişi`
                : gonderilen >= n
                  ? `· ${n} kişiye gönderildi`
                  : `· ${gonderilen} / ${n} gönderildi`}
            </span>
          </span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 text-ink-3 transition-transform ${
            acik ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Kume de ayni sebeple AnimatePresence'siz: acilip kapanmak bir
          animasyonun tamamlanmasina bagli olamaz (bkz. MesajSatiri). */}
      {acik && (
        <motion.div {...belir()}>
            <ul className="mb-b3 border-t border-cizgi bg-cukur px-b4">
              {kume.liste.map((m, j) => (
                <MesajSatiri
                  key={`${m.telefon}-${j}`}
                  m={m}
                  sira={j}
                  icerde
                  onGonderildi={() => {
                    setGonderilen((x) => Math.min(n, x + 1));
                    onGonderildi?.(m);
                  }}
                />
              ))}
            </ul>
        </motion.div>
      )}
    </motion.li>
  );
}

/**
 * KUYRUK GRUBU — bir mesaj türünün tamamı.
 *
 * İKİ KURAL:
 *  1. Grup başlığı YAPIŞKAN. Uzun bir kuyrukta aşağı inerken "bu satırlar
 *     neden çıktı" bilgisi ekranda kalır.
 *  2. AÇIK SATIR SAYISI GRUP SAYISINA BAĞLI (`acikSayi`), gerisi katlı.
 *     Sağ kolon sol kolondan uzun bitmemeli: fark 120px'i aştığı anda kısa
 *     kolonun altında kalan boşluk "nefes" değil "eksik" diye okunuyor —
 *     ölçüldü, altı açık satırla fark 475px'ti. Sayı sabit olamaz çünkü her
 *     grubun kendi başlığı ve cetveli var: üç gruplu deride (pilates) grup
 *     başına dört satır dengeyi kuruyor, dört gruplu deride (psikolog) aynı
 *     sayı kolonu bir ekran daha uzatıyor.
 */
export function KuyrukGrubu({ g, gecikme, acikSayi = 4 }: {
  g: Grup; gecikme: number; acikSayi?: number;
}) {
  const [hepsi, setHepsi] = useState(false);
  const [hepsiAcik, setHepsiAcik] = useState(false);
  const [gonderilen, setGonderilen] = useState(0);
  const kumeler = useMemo(() => kumele(g.liste), [g.liste]);
  // Kalanı "Tümünü göster"in arkasında katlı duruyor (bkz. sınıf notu).
  const gorunen = hepsi ? kumeler : kumeler.slice(0, acikSayi);
  const toplam = g.liste.length;
  // Toplu eylem yalnız gerçekten KÜME varken anlamlı: tek mesajlık bir grupta
  // "Hepsine mesaj at · 1" hem gülünç hem ikinci bir dolgulu düğme demek.
  const cokluVar = kumeler.some((k) => k.liste.length > 1);

  // Gönderim sayacı grup seviyesinde: düğmenin metni ilerlemeyi söylüyor,
  // satırlardaki kopyaları kalktığı için tek yerde toplanıyor.
  const isaretle = (m: Mesaj) => {
    setGonderilen((x) => Math.min(toplam, x + 1));
    g.gonderildi?.(m);
  };

  return (
    <div>
      {/* Yapışkan başlığın ÜSTÜNDE de mürekkep boşluğu olmalı: altından
          geçen satır başlığın hemen dibinde kesilince iki metin üst üste
          binmiş gibi okunuyor. */}
      {/* ALT MASKE: `pb-b2` (8px) yetmiyordu — kaydırırken altından geçen
          satırın üst yarısı başlığın OPAK `bg-kagit` zeminine giriyor ve metin
          tam harf yüksekliğinden KESİLİYORDU (iki deride de görüldü: "bugün
          12:00" satırı başlığın dibinde yarım). Kaydırma yüz yüze gösterimin en
          sık hareketi; her kaydırmada yarım kesilmiş bir satır belirip
          kaybolması "bitmemiş yazılım" izlenimini animasyonla tekrar tekrar
          üretiyordu. 20px'lik geçiş bandı satırın başlığın ALTINA girdiğini
          gösterir. */}
      <div className="sticky top-0 z-10 bg-kagit pb-b3 pt-b2">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-full h-b4"
          style={{ background: "linear-gradient(var(--color-kagit), transparent)" }}
        />
        <Cetvel gecikme={gecikme} />
        {/* TEK SAĞ EKSEN: kolonun bütün eylemleri burada bitiyor. Toplu düğme
            ders alt gruplarında tekrarlanmıyor, grup başlığında TEK duruyor —
            "toplu eylem yalnız grup başlığında dolgulu" kuralının fiilen
            uygulandığı yer burası. */}
        {/* SABİT İKİ KOLON, SARMA YOK. `flex-wrap` ile düğme HER ZAMAN alt
            satıra düşüyordu (etiket 125 + boşluk 8 + düğme 228 = 361 > 342px
            kolon) ve aynı bileşen dört kez kullanılıp dört kez farklı
            görünüyordu: iki başlık 94px, iki başlık 42px yüksekti. Siyah pil
            etiketin sağ altında, etrafında hiçbir şey olmadan asılı duruyordu —
            yerleşmiş değil, düşmüş gibi. Düğme metni de kısaldı: WhatsApp
            ikonu ne yapacağını zaten söylüyor, "mesaj at" kelimeleri satırın
            sığmasına mal oluyordu. Izgara sarmadığı için başlıkların dördü de
            aynı yükseklikte ve düğme daralarak sığıyor (`min-w-0` + truncate). */}
        {/* Başlık satırı SABİT YÜKSEKLİKTE: toplu düğmesi olan grup 70px,
            olmayan 42px kalınca aynı bileşen ekranda iki farklı şey gibi
            okunuyordu. Yükseklik dokunma ölçüsünden geliyor, rastgele bir
            sayıdan değil. */}
        {/* KIRPMA DEĞİL SARMA — VE İKİ DERİDE TEK YERLEŞİM.
            `minmax(0,1fr)` sayacın satır başına düşmesini engelliyordu ama
            bedeli daha ağırdı: kap sağ kenarda kırptığı için psikolog derisinde
            başlık birebir "SEANS PAKETİ BİTİYO…" oluyor, sayaç ("· 3") ve
            "Tümünü göster" bağlantısı kırpılanın içinde tamamen kayboluyordu —
            yani düzeltme, yerinden oynamış bir sayacı KAYBOLMUŞ bir sayaç +
            yarım bir başlıkla takas etmişti. Üstü çizilmiş bölüm başlığı,
            "bitmemiş yazılım" demenin en kısa yolu.
            Artık başlık sarıyor (truncate yok), sayaç `whitespace-nowrap` ile
            addan kopmuyor ve "Tümünü göster" HER DERİDE adın ALTINDA duruyor —
            eskiden pilateste alt alta, psikologda yan yana diziliyordu, yani
            aynı bileşen iki deride iki farklı yerleşim veriyordu. Yükseklik
            `min-h-dokunma` (44px) ile zaten sabit; 13/16'lık iki satır 32px
            tuttuğu için başlıkların yüksekliği eşit kalmaya devam ediyor. */}
        <div className="mt-b2 grid min-h-dokunma grid-cols-[minmax(0,1fr)_auto] items-center gap-b2">
          <div className="flex min-w-0 flex-col items-start gap-b1">
            <p className="etiket min-w-0">
              {g.ad}<span className="whitespace-nowrap"> · {toplam}</span>
            </p>
            {kumeler.length > acikSayi && (
              <button
                onClick={() => setHepsi((x) => !x)}
                className="hedef relative text-etiket font-normal text-ink-3 underline underline-offset-4 transition-colors hover:text-ink"
              >
                {/* SAYI BİR KEZ. Dar kolonun en üst satırında üç ayrı sayı
                    aynı biçimde (" · N") yazılıyordu: 24 (mesaj), 5 (küme),
                    24 (toplu gönderim). Okuyan kişi önce üçünü aynı sayının
                    kopyası sanıyor, sonra farklı olduklarını görüp hangisinin
                    ne olduğunu çözmeye çalışıyor; psikologda ikisi gerçekten
                    aynı sayı olunca da "bir şey iki kez basılmış" izlenimi
                    doğuyor. Küme sayısı düşüyor — başlıkta bir toplam,
                    düğmede bir toplam, aralarında sayısız bir bağlantı. */}
                {hepsi ? "Kısalt" : "Tümünü göster"}
              </button>
            )}
          </div>
          {cokluVar && (
            <motion.button
              whileTap={{ scale: 0.985 }}
              onClick={() => setHepsiAcik(true)}
              className="flex h-dokunma min-w-0 items-center gap-b2 rounded-kontrol bg-ink px-b4 text-govde font-medium text-uzeri"
            >
              {gonderilen === 0 ? <WhatsApp /> : <Check className="size-4" />}
              <span className="truncate">
                {gonderilen === 0
                  ? `Hepsine · ${toplam}`
                  : gonderilen >= toplam
                    ? `Gönderildi · ${toplam}`
                    : `${gonderilen} / ${toplam} gönderildi`}
              </span>
            </motion.button>
          )}
        </div>
      </div>
      <motion.ul
        variants={sira.kap}
        initial="gizli"
        animate="gorunur"
        className="border-t border-cizgi"
      >
        {gorunen.map((k, i) =>
          k.liste.length > 1 ? (
            <KumeSatiri
              key={k.aciklama}
              kume={k}
              sira={i}
              zorlaAcik={hepsiAcik}
              onGonderildi={isaretle}
            />
          ) : (
            <MesajSatiri
              key={g.anahtar(k.liste[0], i)}
              m={k.liste[0]}
              sira={i}
              onGonderildi={() => isaretle(k.liste[0])}
            />
          ),
        )}
      </motion.ul>
    </div>
  );
}

/** 16px WhatsApp işareti — düğmenin kendisi mürekkep, bağ ikondan anlaşılır. */
export function WhatsApp() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.17c-.25.69-1.43 1.32-1.97 1.37-.53.05-1.02.24-3.44-.72-2.9-1.14-4.74-4.1-4.88-4.29-.14-.19-1.16-1.54-1.16-2.94s.73-2.09.99-2.37c.26-.29.57-.36.76-.36h.55c.17 0 .42-.07.65.5.25.6.83 2.08.9 2.23.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.3.37-.42.49-.14.14-.29.29-.12.57.16.29.73 1.2 1.56 1.95 1.07.95 1.98 1.25 2.26 1.39.28.14.45.12.61-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.64-.14.26.09 1.65.78 1.93.92.28.14.47.21.54.33.07.12.07.69-.18 1.37Z" />
    </svg>
  );
}
