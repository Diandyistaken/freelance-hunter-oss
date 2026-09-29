"use client";

// Tasarım yönü kartları — hover'da o yönün TEMSİLÎ mini önizlemesi canlanır.
// Gerçek site değil, "ne hissettireceğinin" özeti: tipografi, renk, ritim ve
// hareket. Saf CSS/inline SVG — üretim öncesi anında, $0.

export type StilKodu = "sicak" | "premium" | "enerjik";

export interface StilTanimi {
  kod: StilKodu;
  ad: string;
  aciklama: string;
}

export const STILLER: StilTanimi[] = [
  {
    kod: "sicak",
    ad: "Sıcak & Aile",
    aciklama: "Yumuşak toprak tonları, yuvarlak hatlar, samimi dil. Anaokulu, kuaför, kafe.",
  },
  {
    kod: "premium",
    ad: "Modern Premium",
    aciklama: "Koyu zemin, ince başlıklar, altın vurgu. Klinik, avukat, mimar, otel.",
  },
  {
    kod: "enerjik",
    ad: "Canlı & Enerjik",
    aciklama: "Doygun gradyanlar, cesur tipografi, hareketli sayaçlar. Spor, restoran, etkinlik.",
  },
];

const ONIZLEME: Record<StilKodu, { arka: string; vurgu: string; yazi: string; ikinci: string }> = {
  sicak: {
    arka: "linear-gradient(160deg,#f6ece2,#efdcc9)",
    vurgu: "#c2683f",
    yazi: "#3d2b21",
    ikinci: "#8a6a55",
  },
  premium: {
    arka: "linear-gradient(160deg,#12161d,#1d242f)",
    vurgu: "#c9a227",
    yazi: "#f2f4f7",
    ikinci: "#95a0ae",
  },
  enerjik: {
    arka: "linear-gradient(140deg,#4b2cc4,#c026a5 60%,#f0603c)",
    vurgu: "#ffe14d",
    yazi: "#ffffff",
    ikinci: "#f2d9ff",
  },
};

function MiniOnizleme({ kod }: { kod: StilKodu }) {
  const r = ONIZLEME[kod];
  const yuvarlak = kod === "sicak" ? 8 : kod === "premium" ? 2 : 5;
  return (
    <div
      className="stil-onizleme pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 overflow-hidden rounded-xl border border-white/15 shadow-2xl group-hover:block"
      style={{ background: r.arka }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ color: r.ikinci }}>
        <span className="text-[8px] font-semibold tracking-[0.2em]">İŞLETME</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-[3px] w-4 rounded-full"
              style={{ background: r.ikinci, opacity: 0.5 }}
            />
          ))}
        </span>
      </div>
      <div className="px-3 pb-1">
        <div
          className="stil-satir h-2.5 w-4/5 rounded"
          style={{ background: r.yazi, animationDelay: "0ms" }}
        />
        <div
          className="stil-satir mt-1.5 h-2.5 w-3/5 rounded"
          style={{ background: r.vurgu, animationDelay: "90ms" }}
        />
        <div
          className="stil-satir mt-2 h-1 w-full rounded"
          style={{ background: r.ikinci, opacity: 0.5, animationDelay: "180ms" }}
        />
        <div
          className="stil-satir mt-1 h-1 w-4/6 rounded"
          style={{ background: r.ikinci, opacity: 0.5, animationDelay: "230ms" }}
        />
        <div
          className="stil-satir mt-2.5 h-4 w-20 rounded"
          style={{ background: r.vurgu, borderRadius: yuvarlak, animationDelay: "300ms" }}
        />
      </div>
      <div className="mt-2 flex gap-1.5 px-3 pb-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="stil-kart h-9 flex-1"
            style={{
              background: r.yazi,
              borderRadius: yuvarlak,
              animationDelay: `${380 + i * 80}ms`,
            }}
          />
        ))}
      </div>
      <p
        className="px-3 pb-2 text-[8px] tracking-wide"
        style={{ color: r.ikinci }}
      >
        temsilî — gerçek site içeriğinizle üretilir
      </p>
    </div>
  );
}

interface Props {
  secili: StilKodu;
  onSec: (kod: StilKodu) => void;
}

export default function StilKartlari({ secili, onSec }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {STILLER.map((s) => (
        <div key={s.kod} className="group relative">
          <button
            type="button"
            onClick={() => onSec(s.kod)}
            className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
              secili === s.kod
                ? "border-cyan-400/50 bg-cyan-400/[0.1]"
                : "border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.07]"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="size-3 shrink-0 rounded-full border border-white/20"
                style={{ background: ONIZLEME[s.kod].arka }}
              />
              <span className="text-[11px] font-semibold text-white/90">{s.ad}</span>
              {secili === s.kod && <span className="text-[10px] text-cyan-300">✓</span>}
            </span>
            <span className="mt-1 block text-[10px] leading-relaxed text-white/50">
              {s.aciklama}
            </span>
          </button>
          <MiniOnizleme kod={s.kod} />
        </div>
      ))}
    </div>
  );
}
