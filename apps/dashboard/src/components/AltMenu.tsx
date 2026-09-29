"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock3, LayoutDashboard, MapPin, Phone, Settings } from "lucide-react";

// Telefon menüsü: kenar çubuğu küçük ekranda gizli (max-lg:hidden), yani
// telefonda hiç gezinme yoktu. Bu şerit altta sabit durur; parmakla
// erişilebilir yükseklikte ve iPhone'un alt çubuğu için güvenli boşluk bırakır.
const nav = [
  { label: "Arama", icon: Phone, href: "/arama-listesi" },
  { label: "Harita", icon: MapPin, href: "/radar" },
  { label: "Düşünen", icon: Clock3, href: "/dusunenler" },
  { label: "Özet", icon: LayoutDashboard, href: "/" },
  { label: "Ayar", icon: Settings, href: "/ayarlar" },
];

export default function AltMenu() {
  const pathname = usePathname();
  const [gizle, setGizle] = useState(false);

  // Giriş ekranında menü olmasın.
  useEffect(() => setGizle(pathname.startsWith("/giris")), [pathname]);
  if (gizle) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-white/10 bg-[#090e1a]/95 px-1 pt-1.5 backdrop-blur lg:hidden"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      {nav.map(({ label, icon: Icon, href }) => {
        const secili = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] ${
              secili ? "text-emerald-300" : "text-white/55"
            }`}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
