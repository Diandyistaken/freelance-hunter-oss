"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Copy, RotateCcw } from "lucide-react";
import type { RadarHit } from "./RadarPanel";
import { aramaAgaciKur, type AgacDugumu, type Ton } from "@/lib/aramaAgaci";

// Konuşurken kullanılan dallanan akış: karşı taraf ne derse ona tıklarsın,
// ne söyleyeceğin gelir. Üstteki breadcrumb "buraya nasıl geldim"i gösterir,
// her adıma tek tıkla geri dönülür. Aynı anda yalnız TEK düğüm görünür —
// telefonda göz yormasın diye (bkz. /arama Konuşma Ağacı tasarımı).

const TON_STILI: Record<Ton, string> = {
  olumlu:
    "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-100 hover:bg-emerald-400/[0.15]",
  olumsuz: "border-red-400/25 bg-red-400/[0.06] text-red-100 hover:bg-red-400/[0.13]",
  notr: "border-white/[0.1] bg-white/[0.03] text-white/80 hover:bg-white/[0.09]",
};

const SONUC_STILI = {
  kazanildi: { arka: "border-emerald-400/40 bg-emerald-400/[0.1]", yazi: "text-emerald-200" },
  kaybedildi: { arka: "border-red-400/30 bg-red-400/[0.07]", yazi: "text-red-200" },
  beklemede: { arka: "border-amber-400/30 bg-amber-400/[0.07]", yazi: "text-amber-200" },
} as const;

function Kopya({ metin }: { metin: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(metin.replace(/[“”]/g, ""));
          setOk(true);
          window.setTimeout(() => setOk(false), 1800);
        } catch {
          setOk(false);
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-cyan-300/30 hover:text-cyan-200"
    >
      {ok ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
      {ok ? "Kopyalandı" : "Kopyala"}
    </button>
  );
}

interface Props {
  hit: RadarHit;
  demoLinki: string;
  referansModu: boolean;
}

export default function AramaAgaci({ hit, demoLinki, referansModu }: Props) {
  const agac = useMemo(
    () => aramaAgaciKur(hit, demoLinki, referansModu),
    [hit, demoLinki, referansModu],
  );
  const [yol, setYol] = useState<string[]>(["acilis"]);
  const mevcut: AgacDugumu = agac[yol[yol.length - 1]] ?? agac.acilis;
  const sonuc = mevcut.sonuc ? SONUC_STILI[mevcut.sonuc] : null;

  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Konuşma ağacı — ne derse ona tıkla
        </h3>
        {yol.length > 1 && (
          <button
            type="button"
            onClick={() => setYol(["acilis"])}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/[0.12]"
          >
            <RotateCcw className="size-3" /> Baştan
          </button>
        )}
      </div>

      {/* Breadcrumb — buraya nasıl geldin, her adıma tek tıkla dön */}
      <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.06] bg-black/25 p-1.5">
        {yol.map((id, i) => (
          <span key={`${id}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 shrink-0 text-white/25" />}
            <button
              type="button"
              onClick={() => setYol(yol.slice(0, i + 1))}
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                i === yol.length - 1
                  ? "bg-cyan-400/20 text-cyan-100"
                  : "text-white/50 hover:bg-white/[0.08] hover:text-white/80"
              }`}
            >
              {agac[id]?.baslik.split("—")[0].trim().slice(0, 26) ?? id}
            </button>
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mevcut.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className={`rounded-lg border p-3 ${sonuc ? sonuc.arka : "border-white/[0.08] bg-white/[0.02]"}`}
        >
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <p
              className={`text-[11px] font-semibold ${sonuc ? sonuc.yazi : "text-white/60"}`}
            >
              {mevcut.baslik}
            </p>
            <Kopya metin={mevcut.metin} />
          </div>

          <p className="whitespace-pre-line text-xs leading-relaxed text-white/90">
            {mevcut.metin}
          </p>

          {mevcut.ipucu && (
            <p className="mt-2 rounded-md bg-black/25 p-2 text-[11px] leading-relaxed text-amber-200/85">
              💡 {mevcut.ipucu}
            </p>
          )}

          {mevcut.tepkiler.length > 0 ? (
            <div className="mt-2.5 flex flex-col gap-1.5">
              <p className="text-[10px] uppercase tracking-wider text-white/35">
                Karşı taraf ne dedi?
              </p>
              {mevcut.tepkiler.map((t) => (
                <button
                  key={t.hedef + t.etiket}
                  type="button"
                  onClick={() => setYol([...yol, t.hedef])}
                  className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition-colors ${TON_STILI[t.ton]}`}
                >
                  {t.ton === "olumlu" ? "👍 " : t.ton === "olumsuz" ? "👎 " : "• "}
                  {t.etiket}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-white/45">
              Konuşma burada bitiyor — radar satırında durumu işaretle.
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
