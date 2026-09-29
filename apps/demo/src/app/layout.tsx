import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { DurumSaglayici } from "@/lib/durum";
import UstSerit from "@/components/UstSerit";
import Hareket from "@/components/Hareket";

// TEK YAZI AİLESİ: Archivo.
//
// İki aile = iki indirme, iki eşleştirme riski, iki deri için iki ayar.
// Kapak karakteri ikinci bir aileyle değil AYNI ailenin GENİŞLİK ekseniyle
// kuruluyor (kapak %112, arayüz %100) — bu yüzden `axes: ["wdth"]` şart:
// unutulursa kapak normal genişlikte düşer ve afiş karakteri kaybolur.
//
// `latin-ext` alt kümesi pazarlıksız: ş ğ ü ö ç ı İ ve ₺ oradan geliyor.
// Yazı statik çıktının içine gömülür; gösterim yerinde internet olmayabilir.
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  weight: "variable",
  display: "swap",
  variable: "--yazi-ailesi",
});

// Arama motorlarına kapalı (kullanıcı kararı): linki bilen açar.
export const metadata: Metadata = {
  title: "Ürün demosu",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  // Tarayıcı çerçevesi de kâğıt tonunda olsun; tablette şerit farkı görünmesin.
  // globals.css'teki --color-kagit ile EŞ: ayrı düşerse tam ekran olmayan bir
  // gösterimde ekranın üstünde yarım tonluk bir renk kırılması görünüyor.
  themeColor: "#f4f1ea",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang="tr" pazarlıksız: büyük harf dile duyarlıdır. lang yoksa
    // "iptal" → "IPTAL" olur; doğrusu "İPTAL".
    <html lang="tr" className={archivo.variable}>
      <body className="antialiased">
        <Hareket>
        <DurumSaglayici>
          <div className="sahne">
            {/* UstSerit YALNIZ /teklif'te null döner (bkz. UstSerit.tsx,
                GIZLI dizisi); o zaman bu sarmalayıcı boş kalır ve tepede
                boşluk bırakmaz. /danisan'da şerit BİLİNÇLİ olarak duruyor —
                bu yorum bunun aksini söylüyordu ve sonraki oturum ona
                güvenip şeridi gizlerse gezinme kırılır.
                Şerit TAM GENİŞLİKTE: kendi zemini ve altındaki
                kıl çizgi, içerik kartlarıyla aynı malzemeden olmadığını
                söyler (figür/zemin ayrımı). Bu yüzden `.kabuk` içinde
                değil, kabuğu kendi içinde taşıyor. */}
            <UstSerit />
            {/* Kaydırma gövdede değil burada: Sunum kendini bir slayt gibi
                (ilerleme şeridi, akan içerik, alt eylem şeridi) bu kutunun
                KESİN yüksekliğine oturtuyor. Uzun ekranlar (Program, Teklif)
                aynı kutunun içinde kayıyor.
                `w-full` YAZILMAZ: .kabuk'un kenar payını (min(100% - 64px,
                1080px)) ezer ve içerik ekranın kenarına yapışır. */}
            {/* DOLGU MAIN'DE DEĞİL İÇERİDEKİ SARMALAYICIDA.
                `position: sticky` hesabı kaydıran kabın PADDING kutusuna göre
                yapılır: `main` 32px üst dolgu taşırken kuyruk grup başlıkları
                ekranın görünen üstüne değil 32px aşağısına yapışıyordu ve o
                pencereden bir önceki grubun son satırı geçip görünüyordu —
                ekranda iki metin üst üste biniyordu. Dolgu içeri alınınca
                görünüm aynı, yapışma noktası doğru. */}
            <main className="kabuk sahne-akis flex flex-col">
              <div className="flex min-h-0 flex-1 flex-col pt-b5">{children}</div>
            </main>
          </div>
        </DurumSaglayici>
        </Hareket>
      </body>
    </html>
  );
}
