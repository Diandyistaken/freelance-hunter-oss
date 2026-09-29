"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ExternalLink,
  Gem,
  Info,
  Languages,
  LoaderCircle,
  Maximize2,
} from "lucide-react";
import HuntDetailModal from "@/components/HuntDetailModal";

const marketBadge = {
  global: { label: "🌍 Global", cls: "bg-cyan-400/10 text-cyan-300" },
  tr: { label: "🇹🇷 TR", cls: "bg-emerald-400/10 text-emerald-300" },
} as const;

const TR_PLATFORMS = ["Bionluk", "Armut"];
const BASE_PLATFORMS = ["Freelancer.com", "Armut", "Upwork", "Fiverr", "Bionluk"];
const PAGE_SIZE = 30;

interface Hunt {
  external_id: string;
  source: string;
  title: string;
  lang: string;
  score: number;
  sinif: string;
  created_at: string;
  url: string | null;
}

interface PlatformStat {
  platform: string;
  today: number;
  notified: number;
}

interface HuntResponse {
  hunts?: Hunt[];
  elemeCount?: number;
  platforms?: PlatformStat[];
  total?: number;
}

function StatusBadge({ sinif, score }: { sinif: string; score: number }) {
  if (sinif.startsWith("eleme"))
    return <span className="text-[var(--muted)]">elendi · {score}</span>;
  if (sinif === "suspicious")
    return (
      <>
        <AlertTriangle className="size-3.5 text-amber-400" />
        <span className="text-amber-300">şüpheli · {score}</span>
      </>
    );
  if (sinif === "firsat")
    return (
      <>
        <Gem className="size-3.5 text-violet-300" />
        <span className="text-violet-200">fırsat · {score}</span>
      </>
    );
  return (
    <>
      <CheckCircle2 className="size-3.5 text-emerald-400" />
      <span className="text-emerald-300">uygun · {score}</span>
    </>
  );
}

function rowCls(sinif: string): string {
  if (sinif === "suspicious") return "border-amber-400/25 bg-amber-400/[0.04]";
  if (sinif === "firsat") return "border-violet-400/30 bg-violet-400/[0.05]";
  if (sinif.startsWith("eleme")) return "border-white/[0.05] bg-white/[0.01] opacity-60";
  return "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.045]";
}

function emptyPlatformMessage(platform: string | null): string {
  if (platform === "Fiverr" || platform === "Bionluk") {
    return "Bu platformlar ilan yayınlamaz; alıcılar satıcıyı bulur. Buradan gig siparişi/mesaj bildirimi düşer, ilan akışı beklenmez.";
  }
  if (platform === "Upwork") {
    return "Upwork ilanları ancak Upwork'te ‘Saved Search + e-posta uyarısı’ kurunca mail olarak gelir. Kurulum: Upwork → Search Jobs → filtre → Save Search → Email alerts ON.";
  }
  if (platform) {
    return `${platform} için henüz gösterilecek bir bildirim yok. Yeni ilan geldiğinde bu sekmede otomatik olarak görünecek.`;
  }
  return "Henüz gösterilecek bir av yok. Motorun işlediği ilk bildirim burada görünecek.";
}

export default function HuntTable({ all = false }: { all?: boolean }) {
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [elemeCount, setElemeCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (all) params.set("all", "1");
      if (selectedPlatform) params.set("platform", selectedPlatform);

      try {
        const response = await fetch(`/api/hunts?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Av listesi alınamadı");
        const data = (await response.json()) as HuntResponse;
        setHunts(data.hunts ?? []);
        setElemeCount(data.elemeCount ?? 0);
        setPlatformStats(data.platforms ?? []);
        setTotal(data.total ?? 0);
        setError(false);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    setLoading(true);
    load();
    const timer = setInterval(load, 20_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [all, limit, selectedPlatform]);

  const tabs = useMemo(() => {
    const stats = new Map(platformStats.map((stat) => [stat.platform, stat]));
    const dynamic = platformStats
      .map((stat) => stat.platform)
      .filter((platform) => !BASE_PLATFORMS.includes(platform))
      .sort((a, b) => a.localeCompare(b, "tr"));
    const allStat = platformStats.reduce(
      (sum, stat) => ({
        today: sum.today + stat.today,
        notified: sum.notified + stat.notified,
      }),
      { today: 0, notified: 0 },
    );

    return [
      { platform: null, label: "Tümü", ...allStat },
      ...[...BASE_PLATFORMS, ...dynamic].map((platform) => ({
        platform,
        label: platform,
        today: stats.get(platform)?.today ?? 0,
        notified: stats.get(platform)?.notified ?? 0,
      })),
    ];
  }, [platformStats]);

  const selectPlatform = (platform: string | null) => {
    setSelectedPlatform(platform);
    setLimit(PAGE_SIZE);
    setOpenId(null);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.45, ease: "easeOut" }}
      className="glass min-w-0 rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide">🎯 Av Listesi</h2>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
            hunts.length > 0
              ? "bg-emerald-400/15 text-emerald-200"
              : "bg-white/[0.06] text-[var(--muted)]"
          }`}
        >
          {loading ? "yükleniyor…" : `📬 ${hunts.length} / ${total} bildirim · ${elemeCount} elenen`}
        </span>
      </div>

      <div className="mb-4 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2" role="tablist" aria-label="İlan platformları">
          {tabs.map((tab) => {
            const active = selectedPlatform === tab.platform;
            return (
              <button
                key={tab.platform ?? "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectPlatform(tab.platform)}
                title={`${tab.today} bugün gelen / ${tab.notified} bildirilen`}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                    : "border-white/[0.07] bg-white/[0.025] text-[var(--muted)] hover:bg-white/[0.055] hover:text-white"
                }`}
              >
                <span className="block text-xs font-medium">{tab.label}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[10px] opacity-75">
                  <BellRing className="size-2.5" /> {tab.today} gelen / {tab.notified} bildirilen
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-300/15 bg-red-300/[0.04] px-4 py-6 text-center text-sm text-red-100/80">
          Av listesi şu anda alınamadı. Bir sonraki otomatik yenilemede tekrar denenecek.
        </div>
      ) : loading && hunts.length === 0 ? (
        <div className="grid min-h-32 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <LoaderCircle className="size-5 animate-spin text-cyan-300" />
        </div>
      ) : hunts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cyan-300/20 bg-cyan-300/[0.035] px-5 py-7 text-center">
          <Info className="mx-auto mb-2 size-5 text-cyan-200/70" />
          <p className="mx-auto max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {emptyPlatformMessage(selectedPlatform)}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {hunts.map((hunt) => {
            const market = TR_PLATFORMS.includes(hunt.source) ? "tr" : "global";
            const clickable = !hunt.sinif.startsWith("eleme");
            return (
              <div
                key={hunt.external_id}
                onClick={clickable ? () => setOpenId(hunt.external_id) : undefined}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={
                  clickable
                    ? (event) => event.key === "Enter" && setOpenId(hunt.external_id)
                    : undefined
                }
                className={`group rounded-xl border p-4 transition-colors ${rowCls(hunt.sinif)} ${
                  clickable ? "cursor-pointer hover:border-cyan-400/40" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${marketBadge[market].cls}`}
                  >
                    {marketBadge[market].label}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                    <Languages className="size-3" />
                    {hunt.lang || "?"}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">{hunt.source}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
                    <StatusBadge sinif={hunt.sinif} score={hunt.score} />
                  </span>
                </div>

                <p className="mt-2 text-sm font-medium">{hunt.title}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                  <span>
                    {new Date(`${hunt.created_at.replace(" ", "T")}Z`).toLocaleString("tr-TR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {hunt.url && (
                    <a
                      href={hunt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="flex items-center gap-1 text-cyan-300/80 transition-colors hover:text-cyan-200"
                    >
                      <ExternalLink className="size-3.5" />
                      İlana git
                    </a>
                  )}
                  {clickable && (
                    <span className="ml-auto flex items-center gap-1.5 text-cyan-300/80 transition-colors group-hover:text-cyan-300">
                      <Maximize2 className="size-3.5" />
                      Detay · çeviri · fiyat için tıkla
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!error && hunts.length < total && limit < 200 && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => setLimit((current) => Math.min(current + PAGE_SIZE, 200))}
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-300/[0.12] disabled:cursor-wait disabled:opacity-50"
          >
            {loading ? "Yükleniyor…" : `Daha fazla yükle (${hunts.length}/${total})`}
          </button>
        </div>
      )}

      {openId && <HuntDetailModal externalId={openId} onClose={() => setOpenId(null)} />}
    </motion.section>
  );
}
