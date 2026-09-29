import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import AltMenu from "@/components/AltMenu";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Hunter — Freelance & Yerel Müşteri Avcısı",
  description:
    "7/24 çalışan, ban-güvenli freelance iş ve yerel müşteri avcısı: Freelancer API, e-posta ayrıştırma ve insan onaylı teklif hattı.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Hunter", statusBarStyle: "black-translucent" },
  icons: { icon: "/ikon-192.png", apple: "/apple-touch-icon.png" },
};

// Telefonda "Ana Ekrana Ekle" ile uygulama gibi açılsın; çentik/alt çubuk
// alanları içeriği kesmesin (viewport-fit=cover + safe-area boşlukları).
export const viewport: Viewport = {
  themeColor: "#090e1a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <head>
        {/* Harita kutucukları OpenFreeMap'ten gelir; el sıkışmayı önden yap. */}
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
      </head>
      <body className="font-sans antialiased">
        {/* 10 Eyl 2026: gövde 1280px→1760px (geniş ekranda sağ/sol boş kalmasın).
            Telefonda alt menü sabit durduğu için altta yer bırakılır. */}
        <div className="mx-auto flex max-w-[110rem] gap-4 p-4 pb-24 lg:pb-4">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col gap-4">{children}</main>
        </div>
        <AltMenu />
      </body>
    </html>
  );
}
