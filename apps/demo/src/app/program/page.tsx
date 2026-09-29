"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useDemo } from "@/lib/durum";
import {
  Belir, belir, Cetvel, GIRIS, ONAY, SAHNE, Sayac, sira, Supurme, Sutun,
} from "@/components/animasyon";
import {
  BolumBasi, Koltuklar, KuyrukGrubu, WhatsApp, type Grup,
} from "@/components/program-parcalar";
import { OdemeAl } from "@/components/AcikHesap";
import { FORM_BASLIKLARI, RUH_HALI, gunYaz } from "@/lib/veri";
import { tl } from "@/lib/fiyat";
import {
  dersKayitlari, denemeIsaretle, denemeler, denemeMesajlari, eriyenler,
  formGonder, geldiIsaretle, hatirlatmalar, iptalEt, kalanBorc, odemeAl,
  onlineSeansMesajlari, paketiBitenler, takvim, uyelikler,
  type Mesaj, type UyelikSatiri,
} from "@/lib/islem";

// PROGRAM EKRANI — işletme sahibinin/uzmanın göreceği tek sayfa.
//
// TASARIM KURALI: ekranda sadece İKİ iş var — (1) program, (2) bugün
// gönderilecek mesajlar. Büyük yazı, büyük düğme, jargon yok; her mesajın
// yanında NEDEN çıktığı bir cümleyle yazılı.
//
// YERLEŞİM: bu ekran bir ÇALIŞMA YÜZEYİ, bir tanıtım sayfası değil. Bu yüzden
// sayfa açılış boşluğu (--b7) yok, blok arası --b5'te kalıyor ve takvim 7,
// mesaj kuyruğu 5 kolon. Eskiden beş bölüm de birebir aynı karttı ("her şey
// kardeş"); artık ekranın TEK kalkık yüzeyi takvim — göz oraya düşüyor.
//
// KUYRUK KARTSIZ: satırlar kart değil, 1px kıl çizgiyle ayrılmış sürekli bir
// dikey eksen. Göz bir sütunu yukarıdan aşağı tarayabiliyor; her satırın
// kendi kutusu olduğunda bu mümkün değildi. İç kaydırma (max-h + overflow)
// da kalktı: gösterimde parmakla iç kutuyu kaydırmak her seferinde kazaydı.
//
// İKİ KOLONUN DENGESİ: iç kaydırma kalkınca kuyruk sayfayı uzattı ve sol 7
// kolon boyunca bomboş kâğıt aktı. Çözüm YAPIŞKAN TAKVİM DEĞİL: donmuş kart
// yalnız seçili günün derslerini gösterdiği için sayfanın üçte ikisi boyunca
// ekranın tek kalkık yüzeyi ölü duruyor, altında ~400px boş kâğıtla — bağlam
// korumuyor, sol tarafa yapıştırılmış bir kartvizit gibi duruyordu. İki kolon
// da artık AKIYOR ve doğal yüksekliğinde bitiyor; dengeyi kuyruk tarafındaki
// iki kural sağlıyor: (1) aynı derse ait hatırlatmalar tek satırda kümeleniyor,
// (2) altıncı satırdan sonrası grup başlığındaki metin düğmesinin arkasında
// katlı duruyor.
//
// FİGÜR/ZEMİN: ekranda TEK beyaz yüzey var — takvim. Kuyruk kâğıdın kendi
// üstünde, solunda 1px kıl çizgiyle ayrılmış bir sütun. İki beyaz panel yan
// yana durduğunda kalkik-1 ile kalkik-2 farkı kâğıt üstünde görünmüyor ve
// ikisi kardeş gibi okunuyordu.

const GUN_KISA = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
// Gün şeridinde ay adı KISA: 70px'lik bir hücrede "14 Eylül" üç satıra
// bölünüyor ve şerit bitmemiş görünüyordu.
const AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem",
  "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function gunEtiketi(tarih: string, bugun: string): { ust: string; alt: string } {
  const t = new Date(`${tarih}T00:00:00`);
  const b = new Date(`${bugun}T00:00:00`);
  const fark = Math.round((t.getTime() - b.getTime()) / 86400000);
  const alt = `${t.getDate()} ${AY[t.getMonth()]}`;
  if (fark === 0) return { ust: "Bugün", alt };
  if (fark === 1) return { ust: "Yarın", alt };
  if (fark === -1) return { ust: "Dün", alt };
  return { ust: GUN_KISA[t.getDay()], alt };
}

/**
 * Deneme takip satırı — KUYRUK SATIRIYLA AYNI ANATOMİ.
 *
 * Eskiden aynı ekranda aynı türden nesne (kişi + eylem) iki farklı görsel
 * dilde diziliyordu. Sağ kuyrukta: ad solda, sağda TEK hayalet "Mesaj at" +
 * ChevronDown, dikeyde ortalı. Sol karttaki deneme listesinde: ad solda,
 * ALTINDA sağa yaslı ÜÇ eşit hayalet düğme (Mesaj at / Üye oldu /
 * İlgilenmiyor) — üstelik aynı kolonun sağ kenarında üç ayrı nesne türü
 * (üç düğmeli satır, "Üye oldu" rozeti, "İlgilenmiyor" rozeti) üç farklı
 * yükseklikte duruyor ve satırlar L şeklinde kırılıyordu. Bir kişiye ne
 * yapılacağı iki dilde anlatılınca arayüz "düşünülmüş" değil "parça parça
 * eklenmiş" okunuyor; üç eşit ağırlıkta hayalet düğme arasında birincil
 * olan da belli değil, göz her satırda üç kez karar veriyordu.
 *
 * Artık kalıp tek: solda ad + künye, sağda TEK birincil hayalet eylem ve
 * ChevronDown. Kararlar ("Üye oldu" / "İlgilenmiyor") açılan alt satıra
 * indi — MesajSatiri'nin açılır bölümüyle birebir aynı hareket.
 *
 * EYLEM KUTUSU SABİT GENİŞLİKTE (w-40) ve çözülmüş satırlarda chevron'un
 * yerini aynı ölçüde bir boşluk tutar: kartın içindeki her satırın sağ
 * eylem kutusu aynı x'te başlıyor, aynı x'te bitiyor. Rozetler de aynı
 * `h-dokunma` kutusunda dikeyde ortalı — işaretlenince satır yüksekliği
 * değişmiyor.
 */
function DenemeKisi({ d, mesaj, gonderildi, onGonder, onIsaretle }: {
  d: { id: number; ad: string; gecenGun: number; durum: string; siradaki: number };
  mesaj: Mesaj | null;
  gonderildi: boolean;
  onGonder: () => void;
  onIsaretle: (yeni: "kaydoldu" | "ilgilenmiyor") => void;
}) {
  const [acik, setAcik] = useState(false);
  const cozuldu = d.durum !== "bekliyor";

  // Tek kutu, tek ölçü: hangi durumda olursa olsun eylem alanı aynı.
  const kutu = "flex h-dokunma w-full items-center justify-center gap-b1 rounded-kontrol";

  return (
    <li className="border-b border-cizgi last:border-b-0">
      <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-b3 py-b3">
        <div className="min-w-0">
          <p className="text-one">{d.ad}</p>
          <p className="text-kunye text-ink-3">
            {d.gecenGun} gün önce geldi
            {d.durum === "bekliyor" && d.siradaki > 0 && ` · bugün ${d.siradaki}. gün mesajı var`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-b2">
          <div className="w-40">
            {/* ROZET DOLGUSUZ — HİYERARŞİ DÜZ DURSUN.
                "✓ Üye oldu" mint yeşil dolguda, "İlgilenmiyor" gri dolgudaydı;
                eylem bekleyen satırların düğmeleri ise 1px hayalet. Yani altı
                satırın BİTMİŞ ikisi, YAPILACAK dördünden görsel olarak daha
                ağırdı ve göz önce "artık bir şey yapılmayacak" satırlara
                gidiyordu. Üstelik mint dolgulu pil, kâğıt sisteminin içindeki
                en "SaaS" görünen nesneydi — fiyat slaytından yeşil tikler tam
                da bu gerekçeyle çıkarılmışken. Kutu ölçüsü (h-dokunma) aynı
                kalıyor, yani satır yükseklikleri bozulmuyor; değişen yalnız
                zemin. */}
            {d.durum === "kaydoldu" ? (
              <span className={`${kutu} text-etiket text-durum-iyi`}>
                <Check className="size-4" /> Üye oldu
              </span>
            ) : d.durum === "ilgilenmiyor" ? (
              <span className={`${kutu} text-etiket text-ink-3`}>İlgilenmiyor</span>
            ) : gonderildi ? (
              <span className={`${kutu} bg-ink text-govde font-medium text-uzeri`}>
                <Check className="size-4" /> Gönderildi
              </span>
            ) : mesaj ? (
              <motion.a
                href={mesaj.link}
                target="_blank"
                rel="noopener noreferrer"
                whileTap={{ scale: 0.985 }}
                onClick={onGonder}
                className={`${kutu} border border-cizgi-koyu text-govde text-ink transition-colors hover:border-ink`}
              >
                <WhatsApp /> Mesaj at
              </motion.a>
            ) : (
              // Bugün sırada mesajı olmayan bekleyen satır: eylem kutusu boş
              // kalmaz, açılır bölümün kendisi birincil eylem olur.
              <motion.button
                whileTap={{ scale: 0.985 }}
                onClick={() => setAcik((a) => !a)}
                className={`${kutu} border border-cizgi-koyu text-govde text-ink-2 transition-colors hover:border-ink hover:text-ink`}
              >
                Sonucu işaretle
              </motion.button>
            )}
          </div>
          {cozuldu ? (
            // Çözülmüş satırda açılacak bir şey yok; yer TUTULUR ki sağ kenar
            // satırdan satıra kaymasın.
            <span className="size-dokunma shrink-0" aria-hidden />
          ) : (
            <motion.button
              onClick={() => setAcik((a) => !a)}
              whileTap={{ scale: 0.985 }}
              title="Sonucu işaretle"
              aria-label="Sonucu işaretle"
              className="grid size-dokunma shrink-0 place-items-center rounded-kontrol text-ink-3 transition-colors hover:text-ink"
            >
              <ChevronDown className={`size-5 transition-transform ${acik ? "rotate-180" : ""}`} />
            </motion.button>
          )}
        </div>
      </div>

      {/* ANIMATEPRESENCE YOK: cikis animasyonu bitene kadar dugum DOM'da kalir
          ve animasyon rAF ile ilerler; sayfa gorunmez sayilirsa (gomulu panel,
          arka plan sekmesi) acilan bir daha KAPANMAZ. Yukseklik animasyonu da
          ayni sebeple kalkti: rAF durmussa `height: 0` kalir ve dokunulan sey
          hic acilmaz. Geriye 12px kayma kaldi — yarim kalirsa icerik 12px
          yukarida durur, yani okunur. Gerekce: uyeler/page.tsx. */}
      {acik && !cozuldu && (
        <motion.div {...belir()}>
            <div className="mb-b3 flex flex-wrap items-center gap-b3 bg-cukur px-b4 py-b3">
              <p className="min-w-0 flex-1 text-govde text-ink-2">
                Deneme sonucu ne oldu? İşaretleyince takip mesajları kesilir.
              </p>
              <div className="flex gap-b2">
                <motion.button
                  whileTap={{ scale: 0.985 }}
                  onClick={() => onIsaretle("kaydoldu")}
                  className="h-dokunma rounded-kontrol border border-cizgi-koyu bg-yuzey px-b3 text-govde text-ink transition-colors hover:border-ink"
                >
                  Üye oldu
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.985 }}
                  onClick={() => onIsaretle("ilgilenmiyor")}
                  className="h-dokunma rounded-kontrol border border-cizgi px-b3 text-govde text-ink-3 transition-colors hover:border-cizgi-koyu hover:text-ink"
                >
                  İlgilenmiyor
                </motion.button>
              </div>
            </div>
        </motion.div>
      )}
    </li>
  );
}

export default function ProgramPage() {
  const { durum, deri, yukleniyor, guncelle } = useDemo();
  const bugun = gunYaz(new Date());
  const [seciliGun, setSeciliGun] = useState(bugun);
  const [acikDers, setAcikDers] = useState<number | null>(null);
  // İmza olayı: hangi DERSTE yer doldu. Eskiden mesaj ekranın en üstünde bir
  // kartta beliriyordu; kullanıcı aşağı bakıyorsa ürünün tek satışlık cümlesini
  // hiç görmüyordu. Artık olayın olduğu satırda duruyor.
  const [acilanYer, setAcilanYer] = useState<{ dersId: number; mesaj: Mesaj } | null>(null);
  // Deneme takibi kuyruktan sol kolondaki karta taşındı; "Gönderildi" geri
  // bildirimi satırda kalsın diye gönderilenler burada işaretleniyor.
  const [denemeGonderilen, setDenemeGonderilen] = useState<number[]>([]);
  // DERSE GELEN ÜYENİN KARTI — stüdyo sahibinin açık isteği: "bir üye
  // seansa geldiğinde onun hakkındaki bilgileri, ne kadar süresi kaldığını
  // görebileyim". Yoklama listesinde ada dokununca açılıyor; kapıda okutulan
  // bir QR da aynı kartı açar, ekran aynı ekran.
  const [acikUye, setAcikUye] = useState<number | null>(null);

  const dun = new Date();
  dun.setDate(dun.getDate() - 1);

  const dersler = useMemo(() => takvim(durum, gunYaz(dun)), [durum]);
  const kuyruklar = useMemo(() => ({
    online: onlineSeansMesajlari(durum, deri),
    hatirlatma: hatirlatmalar(durum, deri),
    deneme: denemeMesajlari(durum, deri),
    eriyen: eriyenler(durum, deri),
    paket: paketiBitenler(durum, deri),
  }), [durum, deri]);
  const denemeListesi = useMemo(() => denemeler(durum), [durum]);
  // Üyelik bilgisi üye kimliğine göre: yoklama satırı bunu tek bakışta
  // bulsun. Hesap `uyelikler()` içinde — üye defteri ekranıyla AYNI kaynak,
  // yoksa iki ekran aynı üye için farklı "kalan gün" yazabilir.
  const uyelikHaritasi = useMemo(
    () => new Map<number, UyelikSatiri>(uyelikler(durum).map((u) => [u.uye.id, u])),
    [durum],
  );

  if (yukleniyor) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-ink-3" />
      </div>
    );
  }

  const gunler = [...new Set(dersler.map((d) => d.baslar.slice(0, 10)))];
  // Bugün kapalıysa (pazar) şeritte "Bugün" hiç olmaz; seçili gün de orada
  // görünmediği için ekranda sebepsiz bir "ders yok" kalıyordu. Takvimde
  // olmayan bir gün seçiliyse ilk açık güne düşüyoruz.
  const gecerliGun = gunler.includes(seciliGun) ? seciliGun : (gunler[0] ?? seciliGun);
  const gununDersleri = dersler.filter((d) => d.baslar.slice(0, 10) === gecerliGun);
  const psikolog = deri.kod === "psikolog";
  // İşletme adı girilmemişse başlık sektör adına DÜŞMEZ: "Pilates stüdyosu /
  // spor salonu" eğik çizgili bir açılır menü seçeneği gibi okunuyor ve
  // stüdyo sahibi ekranda kendi işini göremiyordu. Sektör 13px etikete iner.
  const adi = durum.ayar.isletmeAdi;
  const toplam = Object.values(kuyruklar).reduce((t, k) => t + k.length, 0);
  // VURGU KOŞULA BAĞLANMAZ — BEŞ EKRANDA TEK KURAL.
  // Eskiden kiremit, takvimde bekleyeni olan ders yoksa sağ raydaki "Bugün
  // gönderilecek N" rakamına kayıyordu: aynı ekran veri durumuna göre bazen
  // renkli bazen renksiz açılıyor, yani "vurgu nereye gider" sorusunun sabit
  // bir cevabı yoktu — sistem kuralı değil tesadüf. Üstelik sayfanın en büyük
  // nesnesi (539×588 beyaz takvim kartı) ile tek renkli nesnesi (sağ raydaki
  // 34px rakam) ayrı yerlerdeydi ve göz iki merkez arasında bölünüyordu.
  // Kural artık fiyat slaytındaki kalıbın aynısı: kiremit, sayfanın ANA
  // yüzeyinin ÜST CETVELİNDEDİR. Takvim kartının cetveli kiremit; rakam
  // güvenini mürekkepten alıyor.
  // ÇOĞUNLUK DURUM SÖNÜK, AZINLIK İŞARETLİ — /ozet'teki renkHaritasi ile
  // birebir aynı mantık, iki ekran arasındaki tutarlılık da buradan geliyor.
  // Psikolog derisinde beş satırın dördü "DOLU" ve dördü de --durum-iyi
  // yeşiliyle basılıyordu: ekranın tek beyaz yüzeyinde dört yeşil kelime, yani
  // renk bütçesini vurgu değil bir DURUM rengi tüketiyor ve tekrar ede ede
  // dekoratif hâle geliyordu. Dört kez tekrarlanan yeşil "iyi haber" demiyor,
  // satırın süsü oluyor. Doluluk çoğunluksa DOLU dipnota iner ve eyleme çağıran
  // azınlık (BOŞ saat) vurguyla işaretlenir — /ozet'in "en boş saat kiremit"
  // kuralının aynısı. Pilateste tek bir DOLU var, yani orada kural devrede
  // değil ve yeşil anlamını koruyor.
  const doluCogunluk =
    gununDersleri.filter((d) => d.kayitli >= d.kapasite).length >
    gununDersleri.length / 2;
  const buyuk = (s: string) => s[0].toUpperCase() + s.slice(1);
  /** Deneme satırının bugün sırada bekleyen mesajı — yoksa null. */
  const denemeMesaji = (id: number) => kuyruklar.deneme.find((m) => m.kimlik === id) ?? null;

  // Kuyruk türe göre gruplu: her grubun kendi etiketi ve cetveli var. Düz bir
  // listede "neden bu mesaj çıktı" sorusu her satırda yeniden soruluyordu.
  // BİR KİŞİ = BİR SATIR. Pilates derisinde aynı iki isim (Özge Keskin /
  // Hande Çetin) ekranda AYNI ANDA iki kez duruyordu: solda "Deneme takibi"
  // kartında "üye oldu / ilgilenmiyor" düğmeleriyle, sağda "DENEME TAKİBİ"
  // kuyruğunda "Mesaj at" düğmesiyle — üstelik iki muamele görsel olarak da
  // ayrı dil konuşuyordu. Teknik olarak iki farklı eylem ama karşı taraf için
  // yazılım kendi verisini organize edememiş demektir. Deneme takibi artık TEK
  // yerde: sol kolondaki kart, üç hayalet düğmesiyle (üye oldu · ilgilenmiyor ·
  // mesaj at). O kartın olmadığı psikolog derisinde grup kuyrukta kalıyor,
  // yoksa mesajlar hiçbir yerde görünmezdi. "Bugün gönderilecek" sayısı iki
  // deride de aynı: mesajlar duruyor, yalnız yerleri değişti.
  const tumGruplar: Grup[] = [
    { ad: "Online seans", liste: kuyruklar.online, anahtar: (m) => `o-${m.tur}-${m.telefon}` },
    { ad: "Hatırlatma", liste: kuyruklar.hatirlatma, anahtar: (m) => `h-${m.telefon}-${m.aciklama}` },
    ...(psikolog
      ? [{
        ad: "Deneme takibi", liste: kuyruklar.deneme, anahtar: (m: Mesaj) => `d-${m.kimlik}`,
        gonderildi: (m: Mesaj) => guncelle((x) => denemeIsaretle(x, m.kimlik ?? 0, "gonderildi")),
      }]
      : []),
    { ad: `Eriyen ${deri.uye}`, liste: kuyruklar.eriyen, anahtar: (m) => `e-${m.telefon}` },
    { ad: `${buyuk(deri.paket)} bitiyor`, liste: kuyruklar.paket, anahtar: (m) => `p-${m.telefon}` },
  ];
  const gruplar = tumGruplar.filter((g) => g.liste.length > 0);
  // KOLON DENGESİ GRUP SAYISINDAN HESAPLANIR. Her grubun kendi cetveli,
  // etiketi ve 52px'lik bölüm arası var; grup sayısı artınca aynı satır
  // sayısı kolonu bir ekran daha uzatıyor. Sayı canlıda ölçülerek seçildi:
  // üç gruplu deride (pilates) grup başına DÖRT satır iki kolonu 40px farkla
  // bitiriyor — üçe indirilince bu kez sol kolon 166px uzun kalıyor, yani
  // boşluk yalnızca sağ yarıya taşınıyor. Dört gruplu deride (psikolog) aynı
  // dört satır kolonu bir ekran daha uzatıyor; orada ikişer açık kalıyor.
  const acikSayi = gruplar.length <= 3 ? 4 : 2;

  return (
    <div
      data-deri={durum.ayar.deri}
      className="flex flex-col gap-b6 pb-b6"
    >
      {/* ------------------------------------------------------------ başlık */}
      <motion.header {...belir(SAHNE.cetvel)}>
        <Cetvel />
        <div className="mt-b3 flex flex-wrap items-end justify-between gap-b4">
          <div className="min-w-0">
            <p className="etiket">
              {adi ? `${buyuk(deri.seans)} programı` : deri.sektor}
            </p>
            <h1 className="mt-b1 text-sayfa">{adi || "Bu hafta"}</h1>
          </div>
          {/* Uydurma veriyle konuşmuyoruz: rozet baştan söylüyor.
              YANINDAKİ "gördüğü ekran" DÜĞMESİ KALKTI: /danisan'a gidiyordu,
              yani üst şeritteki sekmeyle aynı yere ve ondan ~40px aşağıda.
              Aynı hedefe giden iki gezinme kontrolü üst üste durunca karşı
              taraf hangisine basacağını sormak zorunda kalıyor ve arayüz
              "düşünülmüş" değil "eklenmiş" gibi okunuyor. Üye ekranına geçiş
              zaten sekmede ve Sunum'un ürün slaytındaki "Ekrana geç"te var.
              Başlık satırının sağ ucunda artık tek tür öğe kalıyor. */}
          <span className="etiket cukur-zeminde rounded-kontrol px-b2 py-b1">Örnek veri</span>
        </div>
        <p className="olcu mt-b3 text-govde text-ink-2">
          {buyuk(deri.uyeler)} kendi ayırtır · boşalan saat bekleyene açılır ·
          mesajlar hazır gelir
        </p>
      </motion.header>

      <div className="grid items-start gap-b5 lg:grid-cols-12">
        {/* ------------------------------------------------------- program */}
        {/* SOL KOLON AKAR. Takvimin altındaki bölümler eskiden ızgaranın
            DIŞINDA, tam genişlikte duruyordu; kuyruk kolonu iki ekran daha
            devam ettiği için sol 7 kolon o boyunca bomboş kâğıt olarak
            akıyordu — iki kolonlu bir düzen değil, kırılmış bir iki-kolon.
            Aynı içerik sol kolonun devamı olunca iki sütun da dolu. */}
        <div className="flex flex-col gap-b6 lg:col-span-7">
        <Belir gecikme={SAHNE.yuzey}>
          <section className="rounded-yuzey bg-yuzey p-b5 shadow-kalkik-2">
            {/* SAYFANIN TEK KİREMİT NESNESİ: ana yüzeyin üst cetveli. */}
            <BolumBasi
              etiket="Takvim"
              baslik="Program"
              gecikme={SAHNE.baslik}
              vurguCetvel
            />

            {/* Gün şeridi: etkin gün mürekkep dolgulu. Vurgu bu ekranda
                olaya ayrılmış; gezinme onu harcayamaz. */}
            {/* IZGARA, KAYDIRMA DEĞİL: yatay kaydırmada tarayıcının gri çubuğu
                ana beyaz yüzeyin İÇİNDE beliriyor ve son gün etiket ortasından
                kırpılıyordu — "bitmemiş arayüz" izleniminin en hızlı okunan iki
                işareti. Sekiz gün 600px'lik kolona iki satırlı etiketle sığar. */}
            <div className="mb-b4 flex flex-wrap gap-b2">
              {gunler.map((g) => {
                const e = gunEtiketi(g, bugun);
                const etkin = g === gecerliGun;
                return (
                  <motion.button
                    key={g}
                    onClick={() => { setSeciliGun(g); setAcikDers(null); }}
                    whileTap={{ scale: 0.985 }}
                    className={`relative flex min-h-dokunma min-w-[4.5rem] flex-1 flex-col justify-center rounded-kontrol px-b2 py-b2 text-center transition-colors ${
                      etkin ? "text-uzeri" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {etkin && (
                      <motion.span
                        layoutId="gun-secim"
                        className="absolute inset-0 rounded-kontrol bg-ink"
                        transition={ONAY}
                      />
                    )}
                    <span className="relative block text-govde font-medium">{e.ust}</span>
                    <span className={`relative block text-etiket ${etkin ? "" : "text-ink-3"}`}>
                      {e.alt}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {gununDersleri.length === 0 ? (
              <p className="bg-cukur px-b4 py-b5 text-center text-govde text-ink-2">
                Bu gün {deri.seans} yok.
              </p>
            ) : (
              <motion.div
                key={gecerliGun}
                variants={sira.kap}
                initial="gizli"
                animate="gorunur"
                className="border-t border-cizgi"
              >
                {gununDersleri.map((d, i) => {
                  const dolu = d.kayitli >= d.kapasite;
                  const bekleyenVar = d.bekleyen > 0;
                  const acik = acikDers === d.id;
                  const basladi = new Date(d.baslar.replace(" ", "T")) <= new Date();
                  // Koltuk ızgarası yalnız çok kişilik derste çizilir; satırın
                  // bütün anatomisi (ızgara, durumun yeri) buna bağlı.
                  const koltukVar = d.kapasite > 1;
                  const durumEtiketi = dolu
                    ? "DOLU"
                    : basladi ? "GEÇTİ" : koltukVar ? "" : "BOŞ";
                  const durumRengi = dolu
                    ? doluCogunluk ? "text-ink-3" : "text-durum-iyi"
                    : durumEtiketi === "BOŞ" && doluCogunluk
                      ? "text-vurgu"
                      : "text-ink-3";
                  const satirlar = acik ? dersKayitlari(durum, d.id) : [];
                  const kayitli = satirlar.filter((k) => k.durum !== "bekleme");
                  const bekleyen = satirlar.filter((k) => k.durum === "bekleme");
                  // TS daraltması için ayrı değişken: `acilanYer?.dersId === d.id`
                  // doğru olsa da derleyici acilanYer'ı hâlâ null sayıyor.
                  const olayMesaj = acilanYer && acilanYer.dersId === d.id
                    ? acilanYer.mesaj : null;
                  return (
                    <motion.div
                      key={d.id}
                      custom={i}
                      variants={sira.oge}
                      className="border-b border-cizgi"
                    >
                      {/* İMZA: yer dolduğunda ışık TAM BU DERS SATIRINDAN geçer
                          ve kenar bir saniyeliğine vurguya döner. Sarmalayıcı
                          yalnız başlık satırını kapsıyor — açılan detay paneli
                          değil; ışık olayın olduğu yeri işaretlemeli, koca bir
                          paneli değil. */}
                      <div className="relative">
                      {olayMesaj && (
                        <>
                          <Supurme key={`s-${olayMesaj.uye}`} />
                          <motion.span
                            key={`k-${olayMesaj.uye}`}
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 -left-b2 w-[3px] bg-vurgu"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 1, delay: 0.6 }}
                          />
                        </>
                      )}

                      {/* IZGARA İKİ DERİDE DE AYNI — DOLULUK İKİ DERİDE DE AYNI
                          NESNE. Bir tur durum etiketi künye satırına taşınmıştı;
                          o hamle satırın ortasındaki boş bandı kapatıyordu ama
                          yerine daha kötüsünü koyuyordu: aynı bilgi (doluluk)
                          aynı ekranda iki ayrı görsel dille anlatılıyordu —
                          pilateste sağda renkli rozet, psikologda soluk gri
                          künye metninin içinde düz kelime ("Uzm. Psk. Elif ·
                          DOLU"). Bileşenin durumu düşünülmemiş gibi okunuyor,
                          üstelik psikologda satırın ortasında ~250px'lik bant
                          yine boş kalıyordu.
                          Şimdi ızgara şablonu iki deride birebir aynı: rozet
                          daima son 88px'lik kolonda, chevron'un solunda. Tek
                          kişilik seansta koltuk karesi anlamsız olduğu için
                          `auto` kolonu boş bir kap olarak duruyor (genişliği
                          sıfıra iner) — böylece sağ blok iki deride de aynı
                          x'te başlıyor ve "DOLU" hiçbir deride künye metninin
                          içinde geçmiyor. */}
                      <button
                        onClick={() => setAcikDers(acik ? null : d.id)}
                        className="grid min-h-16 w-full grid-cols-[64px_minmax(0,1fr)_88px] items-center gap-b3 py-b3 text-left lg:grid-cols-[64px_minmax(0,1fr)_auto_88px]"
                      >
                        {/* EKRANIN TEK VURGUSU: bekleyeni olan ders. Ürünün
                            satış cümlesi ("boşalan saat kendiliğinden dolar")
                            tam olarak burada başlıyor; göz sayfaya girdiğinde
                            önce buraya düşmeli. Vurgu bütçesinin tamamı
                            gezinmeye harcandığında bu ekranda iki beyaz kutu
                            kardeş gibi duruyordu. */}
                        <span
                          className={`tnum text-one ${bekleyenVar ? "text-vurgu" : ""}`}
                        >
                          {d.baslar.slice(11, 16)}
                        </span>

                        <span className="min-w-0">
                          <span className="block truncate text-one">{d.ad}</span>
                          <span className="block truncate text-etiket text-ink-3">
                            {d.egitmen}
                            {bekleyenVar && (
                              <span className="font-semibold text-vurgu">
                                {" · "}{d.bekleyen} kişi bekliyor
                              </span>
                            )}
                          </span>
                        </span>

                        {/* Koltuklar dar ekranda gizlenir: yer yoksa kareler
                            birbirine girip çamur oluyor. Kap KOŞULSUZ basılır:
                            ızgaranın kolon sırası iki deride de bozulmasın,
                            yani rozet her zaman son kolona düşsün diye. Tek
                            kişilik seansta içi boştur ve `auto` kolon sıfıra
                            iner. */}
                        <span className="hidden lg:block">
                          {koltukVar && (
                            <Koltuklar dolu={d.kayitli} kapasite={d.kapasite} />
                          )}
                        </span>

                        <span className="flex items-center justify-end gap-b2">
                          {/* DOLU DERS İYİ HABERDİR — eskiden kırmızıydı ve
                              stüdyo sahibine cirosunu hata gibi gösteriyordu. */}
                          {/* "4/8" KALKTI: aynı bilgi solda koltuk ızgarasında
                              zaten duruyordu ve iki kez yazılıyordu. Rozet
                              artık iki deride de burada: doluluk tek görsel
                              dille anlatılır. */}
                          <span className={`tnum text-etiket ${durumRengi}`}>
                            {durumEtiketi}
                          </span>
                          <ChevronDown
                            className={`size-5 shrink-0 text-ink-3 transition-transform ${acik ? "rotate-180" : ""}`}
                          />
                        </span>
                      </button>
                      </div>

                      {/* AnimatePresence yok — gerekcesi uyeler/page.tsx'te:
                          acilip kapanmak bir animasyonun bitmesine bagli
                          olamaz. */}
                      {acik && (
                        <motion.div {...belir()}>
                            <div className="bg-cukur px-b4 py-b3">
                              {/* Yer dolduğunda hazırlanan mesaj: olayın
                                  olduğu dersin ALTINDA, başka yerde değil. */}
                              {/* OPAKLIK YOK: rAF durmussa bu kutu opacity 0'da
                                  KALIR — demonun en onemli ani ("bosalan saat
                                  dolduruldu") hic gorunmez. Yalniz 8px kayma. */}
                              {olayMesaj && (
                                  <motion.div
                                    initial={{ y: -8 }}
                                    animate={{ y: 0 }}
                                    transition={ONAY}
                                    className="mb-b3 border-l-[3px] border-vurgu bg-yuzey px-b4 py-b3"
                                  >
                                    <p className="flex items-center gap-b2 text-one">
                                      <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={ONAY}
                                        className="text-durum-iyi"
                                      >
                                        <Check className="size-5" />
                                      </motion.span>
                                      Boşalan saat dolduruldu — {olayMesaj.uye}
                                    </p>
                                    <p className="mt-b1 text-govde text-ink-3">
                                      {olayMesaj.aciklama}
                                    </p>
                                    <p className="mt-b3 bg-cukur px-b4 py-b3 text-govde text-ink-2">
                                      {olayMesaj.metin}
                                    </p>
                                    <motion.a
                                      href={olayMesaj.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      whileTap={{ scale: 0.985 }}
                                      className="mt-b3 inline-flex h-dokunma items-center gap-b2 rounded-kontrol bg-ink px-b4 text-govde font-medium text-uzeri"
                                    >
                                      <WhatsApp /> Mesaj at
                                    </motion.a>
                                  </motion.div>
                              )}

                              <p className="etiket">{buyuk(deri.uyeler)}</p>
                              <motion.ul
                                variants={sira.kap}
                                initial="gizli"
                                animate="gorunur"
                                className="mt-b2"
                              >
                                {kayitli.map((k, j) => (
                                  <motion.li
                                    key={k.id}
                                    custom={j}
                                    variants={sira.oge}
                                    layout
                                    className="flex min-h-dokunma flex-wrap items-center gap-b3 border-b border-cizgi py-b2"
                                  >
                                    {/* AD ARTIK DÜĞME. Stüdyo sahibinin
                                        isteği: "üye seansa geldiğinde onun
                                        bilgilerini, ne kadar süresi kaldığını
                                        göreyim". Bilgiyi ayrı bir ekrana
                                        göndermek yerine yoklamanın İÇİNE
                                        koyuyoruz — üye karşısında dururken
                                        başka sekmeye geçilmez. */}
                                    <button
                                      onClick={() => setAcikUye(
                                        acikUye === k.uyeId ? null : k.uyeId,
                                      )}
                                      aria-expanded={acikUye === k.uyeId}
                                      className="flex min-w-0 flex-1 items-center gap-b2 text-left"
                                    >
                                      <span className="min-w-0 text-govde">
                                        {k.ad}
                                      </span>
                                      <ChevronDown
                                        className={`size-4 shrink-0 text-ink-3 transition-transform ${
                                          acikUye === k.uyeId ? "rotate-180" : ""
                                        }`}
                                      />
                                    </button>
                                    <span className="tnum shrink-0 text-etiket text-ink-3">
                                      {k.paketKalan} {deri.seans}
                                    </span>
                                    {k.durum === "geldi" ? (
                                      <span className="flex items-center gap-b1 text-etiket text-durum-iyi">
                                        <Check className="size-4" /> GELDİ
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-b2">
                                        {basladi && (
                                          <motion.button
                                            whileTap={{ scale: 0.985 }}
                                            onClick={() => guncelle((x) => geldiIsaretle(x, k.id))}
                                            className="h-dokunma rounded-kontrol border border-cizgi-koyu px-b3 text-govde transition-colors hover:border-ink"
                                          >
                                            geldi
                                          </motion.button>
                                        )}
                                        {/* Yıkıcı eylem ASLA dolgu değil:
                                            1px kenar + metin. */}
                                        <motion.button
                                          whileTap={{ scale: 0.985 }}
                                          // Hesap `guncelle` güncelleyicisinin
                                          // İÇİNDE yapılmıyor: React orada
                                          // başka bir bileşeni (setAcilanYer)
                                          // güncellemeyi "render sırasında
                                          // setState" sayıp uyarı basıyordu.
                                          // `durum` zaten güncel; önce sonucu
                                          // hesaplayıp sonra ikisini de yazmak
                                          // hem doğru hem sade.
                                          onClick={() => {
                                            const r = iptalEt(durum, k.id, deri);
                                            guncelle(() => r.durum);
                                            setAcilanYer(r.yukselen
                                              ? { dersId: d.id, mesaj: r.yukselen }
                                              : null);
                                          }}
                                          className="h-dokunma rounded-kontrol border border-durum-yikici px-b3 text-govde text-durum-yikici"
                                        >
                                          gelemiyor
                                        </motion.button>
                                      </span>
                                    )}

                                    {/* ÜYE KARTI — dört bilgi, hepsi bir
                                        bakışta. Sıralama stüdyo sahibinin
                                        soracağı sıra: ne kadar hakkı var,
                                        üyeliği ne zaman bitiyor, parası
                                        alındı mı, numarası ne. */}
                                    {acikUye === k.uyeId && (() => {
                                      const u = uyelikHaritasi.get(k.uyeId);
                                      if (!u) return null;
                                      const kalan = u.kalanGun;
                                      const borc = kalanBorc(u.uye);
                                      return (
                                        <motion.div
                                          {...belir()}
                                          className="cukur-zeminde mb-b2 w-full rounded-yuzey p-b4"
                                        >
                                          <dl className="grid grid-cols-2 gap-b3 sm:grid-cols-4">
                                            <div>
                                              <dt className="etiket">Kalan hak</dt>
                                              <dd className="tnum mt-b1 text-one">
                                                {k.paketKalan} {deri.seans}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt className="etiket">Üyelik</dt>
                                              <dd className="tnum mt-b1 text-govde">
                                                {u.uye.uyelikTipi}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt className="etiket">Bitiş</dt>
                                              <dd className="tnum mt-b1 text-govde">
                                                {u.bitisYazi}
                                              </dd>
                                            </div>
                                            <div>
                                              <dt className="etiket">Telefon</dt>
                                              <dd className="tnum mt-b1 text-govde">
                                                {k.telefon}
                                              </dd>
                                            </div>
                                          </dl>

                                          {/* İKİ İŞARET, ÜÇÜNCÜSÜ YOK: süre
                                              ve ödeme. Üye defteriyle birebir
                                              aynı renk sözleşmesi. */}
                                          <div className="mt-b3 flex flex-wrap gap-b2">
                                            <span
                                              className={`tnum rounded-kontrol px-b2 py-b1 text-etiket ${
                                                u.hal === "gecti"
                                                  ? "bg-durum-dikkat-tint text-durum-dikkat"
                                                  : u.hal === "bu_hafta"
                                                    ? "text-uzeri"
                                                    : "bg-yuzey text-ink-2"
                                              }`}
                                              style={u.hal === "bu_hafta"
                                                ? { background: "var(--color-vurgu)" }
                                                : undefined}
                                            >
                                              {kalan < 0
                                                ? `Üyelik ${-kalan} gün önce doldu`
                                                : kalan === 0
                                                  ? "Üyelik bugün bitiyor"
                                                  : `Üyeliğe ${kalan} gün kaldı`}
                                            </span>
                                            {/* Kovalanmayan hesap burada da
                                                SOLUK: dersteki kişi sahibin
                                                "isteme" kararını görmeli —
                                                yoksa parayı yüz yüze ister. */}
                                            <span
                                              className={`tnum rounded-kontrol px-b2 py-b1 text-etiket ${
                                                borc === 0
                                                  ? "bg-durum-iyi-tint text-durum-iyi"
                                                  : u.uye.kovalama
                                                    ? "bg-yuzey text-ink-3"
                                                    : "bg-durum-dikkat-tint text-durum-dikkat"
                                              }`}
                                            >
                                              {borc === 0
                                                ? "Ödemesi alındı"
                                                : u.uye.kovalama
                                                  ? `Kalan ${tl(borc)} ₺ · istenmiyor`
                                                  : `Kalan ${tl(borc)} ₺`}
                                            </span>
                                          </div>

                                          {/* PARA ÇOĞU ZAMAN DERSTE ALINIR —
                                              açık hesap metni de "dersinizde
                                              alabiliriz" diyor. İşaret burada
                                              olmazsa nakit alınır, deftere
                                              ertesi gün (ya da hiç) geçer:
                                              ürünün tek ölümcül hata modu
                                              (ödemiş kişiye borç mesajı)
                                              tam bu boşlukta doğuyor. */}
                                          {borc > 0 && (
                                            <div className="mt-b3">
                                              <OdemeAl
                                                key={`${u.uye.id}-${u.uye.odenen}`}
                                                kalan={borc}
                                                onOdeme={(tutar) => guncelle((d) => odemeAl(d, u.uye.id, tutar))}
                                              />
                                            </div>
                                          )}
                                        </motion.div>
                                      );
                                    })()}
                                  </motion.li>
                                ))}
                              </motion.ul>

                              {bekleyen.length > 0 && (
                                <motion.div layout className="mt-b4">
                                  <p className="etiket text-durum-dikkat">
                                    Bekleme listesi — yer açılırsa sırayla girerler
                                  </p>
                                  <ul className="mt-b2 flex flex-col gap-b2">
                                    {bekleyen.map((k) => (
                                      <motion.li
                                        key={k.id}
                                        layout
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        className="flex items-center gap-b3 text-govde"
                                      >
                                        <span className="tnum grid size-7 shrink-0 place-items-center bg-durum-dikkat-tint text-etiket text-durum-dikkat">
                                          {k.sira}
                                        </span>
                                        {k.ad}
                                      </motion.li>
                                    ))}
                                  </ul>
                                </motion.div>
                              )}
                            </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </section>
        </Belir>
          {/* ----------------------------------------------- ön form (psikolog) */}
          {psikolog && (
            <Belir gecikme={SAHNE.detay}>
              {/* KARTSIZ BÖLÜM — EKRANIN TEK BEYAZ YÜZEYİ TAKVİM.
                  Bu bölümler beyaz karttaydı ve canlıda ölçüldü: takvim kartı
                  517px, buradaki ikincil kart 784px. kalkik-1 ile kalkik-2
                  farkı (1px ring'e karşı 14px bulanıklık) ısıtılmış kâğıt
                  üstünde zaten zar zor görünüyor; 267px'lik ALAN farkı onu
                  tamamen yutuyordu — "her şey kardeş" sorunu renkle değil
                  alanla geri gelmişti ve göz ekranın ortasına (takvim,
                  ürünün kalbi) değil altına düşüyordu.
                  Dil sağ kuyrukta zaten buydu: 2px cetvelle açılan, kâğıdın
                  kendi üstünde duran bölüm. Sol kolon da aynı dili
                  konuşuyor; bölümleri ayıran şey kart değil --b6 (52px). */}
              <section>
                <BolumBasi
                  etiket="Hazırlık"
                  baslik="İlk görüşme ön formları"
                  altYazi="Randevu alınınca KVKK aydınlatmalı kısa form gider. Danışan doldurunca burada belirir — seansa hazır girersiniz."
                />

                {/* KİŞİ SEÇİCİ SABİT IZGARADA.
                    Etiket satır içindeydi, ardından yedi pil farklı
                    genişliklerde üç satıra ragged sarıyordu (canlıda 2+3+1):
                    uygulamanın geri kalanı katı bir 12 kolon ızgarasına ve
                    yedi adımlı boşluk sistemine otururken buradaki küme
                    tamamen serbest akıyordu — ekrandaki tek "stillenmemiş form
                    bileşeni" ve son satırdaki tek pil "artık kalmış" gibi
                    duruyordu. Etiket kendi satırına çıktı; piller eşit
                    genişlikte hücrelere oturdu. Yedi kişi 3+3+1 diziliyor ama
                    hepsi aynı genişlikte olduğu için son hücre "artık" değil
                    "ızgaranın son hücresi" okunuyor. `truncate`: uzun bir ad
                    hücreyi büyütemez, ızgara bozulmaz. */}
                <p className="etiket mb-b3">Form gönder</p>
                <div className="grid grid-cols-2 gap-b2 sm:grid-cols-3">
                  {durum.uyeler.slice(0, 6).map((u) => (
                    <motion.button
                      key={u.id}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => guncelle((x) => formGonder(x, u.id))}
                      className="h-dokunma w-full truncate rounded-kontrol border border-cizgi-koyu px-b3 text-left text-govde transition-colors hover:border-ink"
                    >
                      {u.ad}
                    </motion.button>
                  ))}
                </div>

                <ul className="mt-b4 border-t border-cizgi">
                  {durum.formlar.length === 0 && (
                    <li className="bg-cukur px-b4 py-b5 text-center text-govde text-ink-2">
                      Henüz form yok.
                    </li>
                  )}
                  {[...durum.formlar]
                    .sort((a, b) => Number(!!a.dolduruldu) - Number(!!b.dolduruldu))
                    .map((f) => {
                      const u = durum.uyeler.find((x) => x.id === f.uyeId);
                      return (
                        <li key={f.id} className="border-b border-cizgi py-b3">
                          <div className="flex flex-wrap items-center justify-between gap-b3">
                            <p className="text-one">{u?.ad}</p>
                            <span
                              // Rozet KÖŞELİDİR (rounded-kontrol). Yarıçapın
                              // sıfırlandığı yerler yönde bilinçli bir karar
                              // (tablo, veri satırı, grafik çubuğu); DURUM
                              // ROZETİ o listede yok, yani buradaki 0 karar
                              // değil unutmaydı — aynı sütunda alt alta hem
                              // köşesiz hem köşeli rozet duruyordu.
                              className={`rounded-kontrol px-b2 py-b1 text-etiket ${
                                f.dolduruldu
                                  ? "bg-durum-iyi-tint text-durum-iyi"
                                  : "bg-durum-dikkat-tint text-durum-dikkat"
                              }`}
                            >
                              {f.dolduruldu ? "Dolduruldu" : "Bekleniyor"}
                            </span>
                          </div>
                          {f.yanit && (
                            <ul className="mt-b3 grid gap-b2 sm:grid-cols-2">
                              {f.yanit.map((y, i) => (
                                <li key={i} className="bg-cukur px-b4 py-b2">
                                  <p className="etiket">{FORM_BASLIKLARI[i]}</p>
                                  <p className="text-govde">{y}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </section>
            </Belir>
          )}

          {/* ------------------------------------------------------ deneme dersi */}
          {!psikolog && (
            <Belir gecikme={SAHNE.detay}>
              {/* KARTSIZ BÖLÜM — gerekçe yukarıdaki "Hazırlık" bölümünde. */}
              <section>
                <BolumBasi
                  etiket="Takip"
                  baslik="Deneme dersine gelenler"
                  altYazi="Deneme dersinden sonra 1., 3. ve 7. gün mesajı kendiliğinden sıraya girer. Kaydolan ya da ilgilenmeyen işaretlenince mesaj kesilir."
                />
                <ul className="border-t border-cizgi">
                  {denemeListesi.map((d) => (
                    <DenemeKisi
                      key={d.id}
                      d={d}
                      mesaj={denemeMesaji(d.id)}
                      gonderildi={denemeGonderilen.includes(d.id)}
                      onGonder={() => {
                        setDenemeGonderilen((x) => [...x, d.id]);
                        guncelle((x) => denemeIsaretle(x, d.id, "gonderildi"));
                      }}
                      onIsaretle={(yeni) => guncelle((x) => denemeIsaretle(x, d.id, yeni))}
                    />
                  ))}
                </ul>
              </section>
            </Belir>
          )}
        </div>

        {/* -------------------------------------------- bugün gönderilecek */}
        <Belir gecikme={SAHNE.rakam} className="lg:col-span-5">
          <section className="bg-kagit lg:border-l lg:border-cizgi lg:pl-b5">
            <BolumBasi
              etiket="Kuyruk"
              baslik={
                <span className="flex items-baseline gap-b2">
                  Bugün gönderilecek
                  {/* `text-veri` (34px): bu rakam sayfa h1'iyle ("Bu hafta",
                      44px) aynı puntodayken RENKLİ olduğu için başlıktan daha
                      güçlü çıkıyordu — ekranın en yüksek rütbesi bir bölüm
                      sayacına gidiyordu. */}
                  <span className="tnum text-veri text-ink">
                    <Sayac deger={toplam} sure={0.8} />
                  </span>
                </span>
              }
              gecikme={SAHNE.yuzey}
              altYazi={'Hepsi kendiliğinden çıkar; siz sadece "Mesaj at"a basarsınız.'}
            />

            {toplam === 0 ? (
              // BOŞ DURUM İYİ HABERDİR: "veri bulamadım" diyen panel değil,
              // "bugün işin yok" diyen ürün.
              <motion.p
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={ONAY}
                className="flex items-center justify-center gap-b2 bg-durum-iyi-tint px-b4 py-b5 text-govde text-durum-iyi"
              >
                <Check className="size-5 shrink-0" />
                Bugün gönderilecek mesaj yok.
              </motion.p>
            ) : (
              // GRUPLAR ARASI --b6 (52px): her grup kendi başına bir bölüm
              // (kendi cetveli, kendi etiketi). Kart içi dolgu (20px) ile
              // arasında 2.6 kat fark olmazsa gruplar birbirine yapışıyor ve
              // "her şey eşit aralıkta" hissi doğuyor — şablon görüntüsünün
              // birinci sebebi bu.
              <div className="flex flex-col gap-b6">
                {gruplar.map((g, gi) => (
                  <KuyrukGrubu
                    key={g.ad}
                    g={g}
                    acikSayi={acikSayi}
                    gecikme={SAHNE.detay + gi * 0.04}
                  />
                ))}
              </div>
            )}
          </section>
        </Belir>

        {/* ------------------------------------------ seans arası günlük */}
        {psikolog && durum.gunlukler.length > 0 && (
          <Belir gecikme={SAHNE.detay} className="lg:col-span-12">
            {/* KARTSIZ BÖLÜM — gerekçe yukarıdaki "Hazırlık" bölümünde. */}
            <section>
              <BolumBasi
                etiket="Seans arası"
                baslik="Günlük"
                altYazi="Danışan gün içinde tek dokunuşla işaret bırakır. Siz seanstan önce iki haftanın seyrini bir bakışta görürsünüz."
              />
              <div className="flex flex-col gap-b4">
                {Object.entries(
                  durum.gunlukler.reduce<Record<string, typeof durum.gunlukler>>((g, x) => {
                    const ad = durum.uyeler.find((u) => u.id === x.uyeId)?.ad ?? "—";
                    (g[ad] ??= []).push(x);
                    return g;
                  }, {}),
                ).map(([ad, kayitlar]) => (
                  // ÇUKUR KUTU, BEYAZ DEĞİL: bu kutu beyaz kartın içinde
                  // birebir aynı yükseltide (kalkik-1) ikinci bir beyaz
                  // karttı — yükselti merdivenini üç basamaktan ikiye
                  // indiriyor ve "her yerde aynı radius/padding/gölge"
                  // şikâyetinin canlı örneği oluyordu. Bölüm artık kartsız,
                  // kutu da sistemin "gömülü alan" tonunda.
                  <div key={ad} className="cukur-zeminde rounded-yuzey p-b4">
                    <p className="text-one">{ad}</p>
                    {/* GRAFİK SOLDA, NOTLAR SAĞDA. Kutu tek kolonluyken
                        bölüm 259px'lik bir çukur kutuyla bitiyor, 539px'lik
                        kolonun sağında ~280px boş kâğıt kalıyordu; sayfanın
                        son ekranı L biçiminde bir boşluğun içinde asılı duran
                        küçük bir kutuydu. Kaydırmanın sonu her gösterimde
                        görülüyor ve orada görülen şey kompozisyonun değil
                        içeriğin bittiğiydi. Bölüm tam genişliğe çıkınca aynı
                        iki parça yan yana oturuyor ve sayfa tek bir blokla
                        kapanıyor. */}
                    <div className="mt-b3 grid gap-b4 sm:grid-cols-2">
                    <div>
                    {/* Sütunlar mürekkep: ruh hâli bir "renk skalası" değil,
                        tek bir ölçü — beşi de aynı tonda, farkı yükseklik verir.

                        DOLUM `Sutun`A GÖÇTÜ. Beş ekran içinde CSS dolumunun
                        dışında kalan tek grafik buydu: elle yazılmış
                        motion.div + initial={{scaleY:0}}, yani rAF durduğunda
                        (gömülü panel, arka plan sekmesi, bazı tablet
                        tarayıcıları) müşterinin gözü önünde scaleY(0)'da
                        boş kalabilecek tek grafik. Göçle birlikte %100
                        referans izi, köşe-sıfır kuralı ve
                        prefers-reduced-motion uyumu da kendiliğinden geldi;
                        `k.ruh * 14` sihirli sayısı ile elle transformOrigin
                        ayarı kalktı (ruh hâli 1-5 ölçeğinde, oran = ruh/5).
                        İz çukur zeminde --cukur-koyu'ya geçer, yoksa
                        görünmez. `title` ipucu sarmalayıcıya taşındı. */}
                    <div className="flex items-end gap-b1">
                      {kayitlar.map((k, i) => (
                        <div
                          key={k.tarih}
                          className="flex flex-1 flex-col items-center gap-b1"
                          title={`${k.tarih} — ${RUH_HALI[k.ruh - 1]}`}
                        >
                          <Sutun
                            oran={k.ruh / 5}
                            enYuksek={80}
                            gecikme={SAHNE.detay + i * 0.03}
                            renk="bg-ink"
                            iz="bg-cukur-koyu"
                          />
                          <span className="tnum text-etiket text-ink-3">{k.tarih.slice(8)}</span>
                        </div>
                      ))}
                    </div>
                    </div>
                    <ul className="flex flex-col gap-b2">
                      {kayitlar.filter((k) => k.not).slice(-3).map((k) => (
                        <li key={k.tarih} className="text-govde text-ink-2">
                          <span className="tnum text-ink-3">{k.tarih.slice(5)}</span> —{" "}
                          {RUH_HALI[k.ruh - 1]}: &quot;{k.not}&quot;
                        </li>
                      ))}
                    </ul>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </Belir>
        )}

      </div>

    </div>
  );
}
