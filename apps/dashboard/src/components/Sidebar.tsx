"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import KimAradi from "@/components/KimAradi";
import {
  Clock3,
  Crosshair,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Phone,
  Settings,
} from "lucide-react";

// 10 Eyl 2026 — sekme temizliği (kullanıcı kararı). Kaldırılanlar: Konuşma
// Ağacı ve Arama (sade) [eski site-kusuru kancasına göre yazılmıştı, yerini
// arama listesindeki 6 adım aldı], Reklam Radarı, Rehberler, Portföy.
// Kodları git geçmişinde duruyor; istenirse geri alınır.
const nav = [
  { label: "Arama Listesi", icon: Phone, href: "/arama-listesi" },
  { label: "Radar & Demolar", icon: MapPin, href: "/radar" },
  { label: "Düşünenler", icon: Clock3, href: "/dusunenler" },
  { label: "Genel Bakış", icon: LayoutDashboard, href: "/" },
  // Freelance avcısı kapalıyken listede işi yok — anahtar açılınca görünür.
  { label: "Av Listesi", icon: ListChecks, href: "/avlar", avciyaBagli: true },
  { label: "Ayarlar", icon: Settings, href: "/ayarlar" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [alive, setAlive] = useState<boolean | null>(null);
  const [avciKapali, setAvciKapali] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch("/api/status")
        .then((r) => r.json())
        .then((s) => {
          setAlive(s.botAlive);
          setAvciKapali(!!s.avciKapali);
        })
        .catch(() => setAlive(false));
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="glass sticky top-4 flex h-[calc(100vh-2rem)] w-60 shrink-0 flex-col overflow-y-auto rounded-2xl p-4 max-lg:hidden">
      <div className="mb-8 flex items-center gap-2.5 px-2 pt-1">
        <span className="grid size-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
          <Crosshair className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-wide">HUNTER</p>
          <p className="text-[11px] text-[var(--muted)]">Freelance & Yerel Av</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {nav
          .filter((n) => !(n.avciyaBagli && avciKapali && pathname !== n.href))
          .map(({ label, icon: Icon, href }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
              pathname === href
                ? "bg-white/[0.07] text-white"
                : "text-[var(--muted)] hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Numaradan isme: telefon caldiginda son haneleri yaz, kim oldugunu
          gor. Kenar cubugunda duruyor cunku her sayfadan erisilmeli —
          telefon arama listesinde degilken de calabilir. Ctrl+K odaklar. */}
      <KimAradi />

      <div className="glass mt-auto rounded-xl p-3">
        <div className="flex items-center gap-2">
          <span
            className={`relative inline-flex size-2 rounded-full ${
              alive === null ? "bg-white/40" : alive ? "bg-emerald-400" : "bg-red-400"
            }`}
          >
            {alive && (
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
            )}
          </span>
          <p className="text-xs font-medium">
            {alive === null ? "Kontrol ediliyor…" : alive ? "Sistem: CANLI" : "Bot KAPALI"}
          </p>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
          {alive
            ? "Bot avlanıyor — 3 dk'da bir Gmail taranıyor."
            : "hunter_baslat.bat'a çift tıkla veya PC'yi yeniden başlat."}
        </p>
      </div>
    </aside>
  );
}
