"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ExternalLink, MapPin, Phone, Radar } from "lucide-react";
import { radarHits as demoHits } from "@/lib/mock";
import { slugla } from "@/lib/slug";
import type { RadarDurum, RadarDurumKaydi } from "@/hooks/useRadarDurum";

// Leaflet window'a ihtiyaç duyar — SSR kapalı yüklenir
const RadarMap = dynamic(() => import("./RadarMap"), {
  ssr: false,
  loading: () => (
    <div className="mb-4 h-72 w-full animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.04]" />
  ),
});

// Radar v2 alanları opsiyoneldir: eski (v1) radar.json dosyaları ve ana
// sayfadaki küçük özet widget'ı bunlar olmadan da çalışmaya devam eder.
export interface RadarKusur {
  kod: string;
  baslik: string;
  siddet: number; // 1-10
  kanit: string;
  // "Bunu 10 saniyede kendin nasıl doğrularsın" — telefonu açmadan ÖNCE bak.
  // İşletme sahibi de aynı adımı izleyip göremezse o kusuru SÖYLEME.
  dogrula?: string;
}

export interface RadarHit {
  name: string;
  kind_tr: string;
  issue: string;
  score: number; // v2'de HEDEF SKORU = sqrt(kalite × kusur)
  lat: number;
  lon: number;
  phone?: string;
  street?: string;
  website?: string; // v2'de: işletmenin denetlenen mevcut sitesi
  bolge?: string; // çoklu bölge taramasında avın semti (Kadıköy, Üsküdar...)
  // --- v2 ---
  domain?: string;
  eposta?: string; // Overture'da işletmenin KENDİ ilan ettiği adres (tahmin değil)
  platform_sayfasi?: boolean; // "sitesi" aslında Yemeksepeti/Instagram sayfası
  kalite_puani?: number; // Eksen A: işletme ne kadar iyi gidiyor
  kusur_puani?: number; // Eksen B: site ne kadar kötü/görünmez
  kalite_kirilim?: { puan: number; etiket: string }[];
  kusurlar?: RadarKusur[];
  kanca?: string; // tek cümlelik açılış (en ağır kusurdan)
  denetim_olcumler?: Record<string, string | number | boolean | string[]>;
}

interface RadarData {
  scanned_at?: string;
  center?: { lat: number; lon: number };
  hits: RadarHit[];
}

interface Props {
  // Ana sayfadaki küçük özet widget'ı işaretleme olmadan da çalışsın diye opsiyonel —
  // tam işaretleme deneyimi /radar sayfasında (bkz. radar/page.tsx).
  durumlar?: Record<string, RadarDurumKaydi>;
  isaretle?: (
    slug: string,
    ad: string,
    durum: RadarDurum,
    ekstra?: { tur?: string; telefon?: string },
  ) => void;
}

export default function RadarPanel({ durumlar = {}, isaretle }: Props) {
  const [data, setData] = useState<RadarData | null>(null);

  useEffect(() => {
    fetch("/api/radar")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ hits: [] }));
  }, []);

  const live = !!(data?.hits && data.hits.length > 0);
  const bekleyenHits = live ? data!.hits.filter((h) => !durumlar[slugla(h.name)]) : [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.45, ease: "easeOut" }}
      className="glass flex flex-col rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide">
          <Radar className="size-4 text-emerald-300" />
          Yerel Radar
        </h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] ${
            live
              ? "bg-emerald-400/15 text-emerald-200"
              : "bg-white/[0.06] text-[var(--muted)]"
          }`}
        >
          {live
            ? `📡 canlı · ${data!.hits.length} av · ${new Date(
                data!.scanned_at!,
              ).toLocaleDateString("tr-TR")}`
            : "işletmeler: demo"}
        </span>
      </div>

      <RadarMap
        scanCenter={live && data?.center ? [data.center.lat, data.center.lon] : null}
        liveHits={live ? bekleyenHits.slice(0, 25) : null}
        isaretle={isaretle}
      />

      <div className="flex flex-col gap-2.5">
        {live
          ? bekleyenHits.slice(0, 6).map((hit) => (
              <a
                key={`${hit.name}-${hit.lat}`}
                href={`https://www.google.com/maps/search/?api=1&query=${hit.lat},${hit.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {hit.name}
                    <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                  </p>
                  <span className="text-xs font-semibold text-emerald-300">
                    {hit.score}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {hit.kind_tr} · {hit.issue}
                  </span>
                  {hit.phone && (
                    <span className="flex items-center gap-1 text-emerald-300/80">
                      <Phone className="size-3" />
                      ulaşılabilir
                    </span>
                  )}
                </p>
              </a>
            ))
          : demoHits.map((hit) => (
              <a
                key={hit.name}
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${hit.name} ${hit.district}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {hit.name}
                    <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                  </p>
                  <span className="text-xs font-semibold text-emerald-300">
                    {hit.score}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--muted)]">
                  <MapPin className="size-3" />
                  {hit.district} · {hit.issue}
                </p>
              </a>
            ))}
      </div>
    </motion.section>
  );
}
