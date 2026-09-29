"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { RadarHit } from "./RadarPanel";
import { senaryoCizelgesi } from "@/lib/onarimPlani";

// "Ne derse hangi yola girilir" çizelgesi: baştan yapım / sadece onarım /
// mini paket / demo / ret — her satırda fiyat + süre görünür, tıklayınca
// adımlar ve dikkat notu açılır. Onarım fiyatı lead'in GERÇEK kusur
// listesinden hesaplanır (lib/onarimPlani.ts).

interface Props {
  hit: RadarHit;
  demoVar: boolean;
  referansModu: boolean;
}

export default function SenaryoCizelgesi({ hit, demoVar, referansModu }: Props) {
  const [acik, setAcik] = useState<string | null>(null);
  const senaryolar = senaryoCizelgesi(hit, demoVar, referansModu);

  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
        Senaryo çizelgesi — ne derse hangi yol
      </h3>
      <div className="flex flex-col gap-1.5">
        {senaryolar.map((s) => {
          const acikMi = acik === s.id;
          return (
            <div
              key={s.id}
              className={`rounded-lg border transition-colors ${
                acikMi
                  ? "border-cyan-400/25 bg-cyan-400/[0.05]"
                  : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <button
                type="button"
                onClick={() => setAcik(acikMi ? null : s.id)}
                className="flex w-full items-center gap-2 p-2 text-left"
              >
                <span className="shrink-0 text-sm">{s.ikon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-white/85">
                    {s.kosul}
                    {s.onerilen && (
                      <span className="ml-1.5 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200">
                        önerilen
                      </span>
                    )}
                  </span>
                  <span className="block text-[10px] text-white/50">
                    {s.fiyat}
                    {s.sure !== "—" ? ` · ${s.sure}` : ""}
                  </span>
                </span>
                <ChevronDown
                  className={`size-3.5 shrink-0 text-white/40 transition-transform ${
                    acikMi ? "rotate-180" : ""
                  }`}
                />
              </button>
              {acikMi && (
                <div className="border-t border-white/[0.06] p-2">
                  <p className="text-[11px] leading-relaxed text-white/75">{s.ozet}</p>
                  <ol className="mt-1.5 flex flex-col gap-1">
                    {s.adimlar.map((a, i) => (
                      <li key={a} className="flex gap-1.5 text-[11px] text-white/65">
                        <span className="shrink-0 font-semibold text-cyan-300">
                          {i + 1}.
                        </span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ol>
                  {s.dikkat && (
                    <p className="mt-1.5 rounded-md bg-amber-400/[0.06] p-1.5 text-[10px] leading-relaxed text-amber-200/90">
                      ⚠ {s.dikkat}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
