"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import { slugla } from "@/lib/slug";
import type { RadarHit } from "./RadarPanel";
import type { RadarDurum, RadarDurumKaydi } from "@/hooks/useRadarDurum";

// Leaflet window'a ihtiyaç duyar — SSR kapalı yüklenir
const RadarMap = dynamic(() => import("./RadarMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.04]" />
  ),
});

interface RadarData {
  scanned_at?: string;
  center?: { lat: number; lon: number };
  hits: RadarHit[];
}

interface Props {
  durumlar: Record<string, RadarDurumKaydi>;
  isaretle: (
    slug: string,
    ad: string,
    durum: RadarDurum,
    ekstra?: { tur?: string; telefon?: string },
  ) => void;
  secilenSlug: string | null;
  onSecim: (slug: string) => void;
}

// Radar & Demolar sayfasının EN ÜSTÜNDE, tam genişlikte, öne çıkan harita —
// haritaya tıklanan işletme aşağıdaki listede vurgulanıp görünür kılınır.
export default function RadarHaritaBuyuk({ durumlar, isaretle, secilenSlug, onSecim }: Props) {
  const [data, setData] = useState<RadarData | null>(null);

  useEffect(() => {
    fetch("/api/radar")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ hits: [] }));
  }, []);

  const live = !!(data?.hits && data.hits.length > 0);
  const gorunenHits = live ? data!.hits.filter((h) => !durumlar[slugla(h.name)]) : [];

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass rounded-2xl p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide">
          <Radar className="size-4 text-emerald-300" />
          Harita
        </h2>
        <span className="text-[11px] text-[var(--muted)]">
          Bir işletmeye tıkla — aşağıdaki listede vurgulanır
        </span>
      </div>
      <RadarMap
        durumlar={durumlar}
        scanCenter={live && data?.center ? [data.center.lat, data.center.lon] : null}
        liveHits={live ? gorunenHits : null}
        isaretle={isaretle}
        secilenSlug={secilenSlug}
        onSecim={onSecim}
        yukseklikClassName="h-[420px] mb-0"
      />
    </motion.section>
  );
}
