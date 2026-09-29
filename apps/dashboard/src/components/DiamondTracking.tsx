"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock3, ExternalLink, Gem } from "lucide-react";

interface DiamondHunt {
  external_id: string;
  source: string;
  title: string;
  score: number;
  created_at: string;
  url: string | null;
}

const TRACKING_MS = 72 * 60 * 60 * 1000;

function utcTime(value: string): number {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
}

function remainingLabel(createdAt: string, now: number): string {
  const remaining = Math.max(0, utcTime(createdAt) + TRACKING_MS - now);
  const totalHours = Math.ceil(remaining / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0 && hours > 0) return `${days} gün ${hours} sa kaldı`;
  if (days > 0) return `${days} gün kaldı`;
  return `${hours} sa kaldı`;
}

export default function DiamondTracking() {
  const [hunts, setHunts] = useState<DiamondHunt[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const load = () =>
      fetch("/api/hunts?sinif=firsat&saat=72")
        .then((response) => response.json())
        .then((data) => setHunts(data.hunts ?? []))
        .catch(() => setHunts([]));
    load();
    const refresh = setInterval(load, 20_000);
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16, duration: 0.4, ease: "easeOut" }}
      className="glass rounded-2xl border border-amber-300/20 p-5 shadow-[0_0_32px_rgba(251,191,36,0.05)]"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-amber-100">
            <Gem className="size-4 text-amber-300" /> 💎 Elmas Takip
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Son 72 saatte yakalanan öncelikli fırsatlar
          </p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-200">
          72 saatlik takip
        </span>
      </div>

      {hunts === null ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-[var(--muted)]">
          Elmaslar yükleniyor...
        </div>
      ) : hunts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-300/15 bg-amber-300/[0.025] px-4 py-6 text-center">
          <Gem className="mx-auto mb-2 size-5 text-amber-200/50" />
          <p className="text-sm text-[var(--muted)]">Takipte elmas yok</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hunts.map((hunt) => (
            <article
              key={hunt.external_id}
              className="rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.09] via-white/[0.025] to-violet-400/[0.05] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                  Skor {hunt.score}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-amber-200/15 bg-black/15 px-2 py-0.5 text-[11px] text-amber-200">
                  <Clock3 className="size-3" />
                  {remainingLabel(hunt.created_at, now)}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold leading-snug text-white/95">
                {hunt.title || "Başlıksız ilan"}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                <span>{hunt.source}</span>
                <time dateTime={hunt.created_at}>
                  {new Date(utcTime(hunt.created_at)).toLocaleString("tr-TR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              {hunt.url && (
                <a
                  href={hunt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-amber-200 transition-colors hover:text-amber-100"
                >
                  <ExternalLink className="size-3.5" />
                  İlana git
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </motion.section>
  );
}
