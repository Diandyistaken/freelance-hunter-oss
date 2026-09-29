import type { NextConfig } from "next";

// ÜRÜN DEMOSU — Hunter panelinden AYRI, bağımsız uygulama.
//
// Neden ayrıldı (13 Eyl 2026, kullanıcı kararı): demo panelin içindeyken
// tablette gösterirken iki sorun çıkıyordu — sunumdan çıkınca müşteri
// Hunter panelini görüyordu, ve demo ev bilgisayarına + Tailscale'e
// bağımlıydı. Bilgisayar kapalıysa ya da bağlantı takılırsa randevuda
// gösterecek bir şey kalmıyordu.
//
// Bu yüzden: sunucu YOK. Bütün veri tarayıcıda üretilir ve orada durur.
// Statik dosya olarak dışa aktarılır, herhangi bir yere konabilir, hatta
// bir kez açıldıktan sonra internetsiz de çalışır.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Geliştirici rozeti KAPALI. Prova hep dev sunucusunda yapılıyor ve rozet
  // sol altta, Sunum'un "Geri" düğmesinin tam üstünde duruyordu: yanlışlıkla
  // dev sunucusuyla görüşmeye girilirse ekranın köşesinde "bu bir ürün değil,
  // bir geliştirme ortamı" diyen tek kare o. Statik çıktıyı etkilemez.
  devIndicators: false,
  // Arama motorlarına kapalı (kullanıcı kararı: linki bilen açar).
  // Statik dışa aktarmada HTTP başlığı ayarlanamaz; bu yüzden iki katman:
  // layout.tsx içindeki meta robots etiketi ve public/robots.txt.

  // REACT COMPILER KAPALI — AnimatePresence'ı bozuyor.
  //
  // Belirti: uygulamanın HİÇBİR yerinde "kaybolan" şey kaybolmuyordu.
  // Üye defterinde filtreye basınca liste 24 satırda kalıyor, aramada da
  // öyle; /program'da açılan mesaj satırı bir daha kapanmıyor. Sebebi
  // ekranların kendi mantığı değil: AnimatePresence çıkış animasyonu hiç
  // tamamlanmıyor, dolayısıyla React düğümü DOM'dan hiç kaldırmıyor.
  // Derleyicinin belleğe alma (memoization) davranışı, AnimatePresence'ın
  // çocuklarını klonlayıp varlıklarını izleme yöntemiyle çakışıyor.
  //
  // Bu bir "animasyon süsü" hatası değildi: filtre düğmeleri çalışmıyor
  // görünüyordu — yani ürünün satılan davranışı kırıktı.
  reactCompiler: false,
};

export default nextConfig;
