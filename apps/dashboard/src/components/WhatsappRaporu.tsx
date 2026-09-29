"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import type { RadarHit } from "./RadarPanel";
import { whatsappRaporu } from "@/lib/aramaSenaryosu";

// WhatsApp TAM RAPORU bölümü: hook üstte + tüm ölçümler altta (lib tarafında
// kurulur). İki varyant — fiyatlı / fiyatsız — her biri için Kopyala ve
// (telefon varsa) metni hazır yazılmış WhatsApp penceresi açan buton.
// GÖNDERMEZ: wa.me linki mesajı yalnızca kutuya yazar, göndermeyi insan yapar
// (insan onaylı gönderim kuralı).

function KopyaBtn({ metin }: { metin: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(metin);
          setOk(true);
          window.setTimeout(() => setOk(false), 1800);
        } catch {
          setOk(false);
        }
      }}
      className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/[0.14]"
    >
      {ok ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
      {ok ? "Kopyalandı" : "Kopyala"}
    </button>
  );
}

interface Props {
  hit: RadarHit;
  referansModu: boolean;
}

export default function WhatsappRaporu({ hit, referansModu }: Props) {
  const telefon = (hit.phone || "").replace(/[^0-9]/g, "");
  const varyantlar = [
    { ad: "Fiyatlı rapor", metin: whatsappRaporu(hit, referansModu, true) },
    { ad: "Fiyatsız rapor", metin: whatsappRaporu(hit, referansModu, false) },
  ];
  if (!varyantlar[0].metin) return null;

  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
        WhatsApp tam raporu — hook üstte, ölçümler altta
      </h3>
      <div className="flex flex-col gap-1.5">
        {varyantlar.map((v) => (
          <div
            key={v.ad}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2"
          >
            <span className="text-[11px] font-semibold text-white/80">{v.ad}</span>
            <span className="flex items-center gap-1.5">
              <KopyaBtn metin={v.metin} />
              {telefon && (
                <a
                  href={`https://wa.me/${telefon}?text=${encodeURIComponent(v.metin)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-400/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25"
                >
                  <MessageCircle className="size-3.5" /> WhatsApp&apos;ta aç
                </a>
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/45">
        &ldquo;WhatsApp&apos;ta aç&rdquo; mesajı kutuya HAZIR YAZAR, göndermez —
        son kontrol ve gönderme sende. Fiyatsız varyant pazarlık alanını açık
        bırakır; fiyatlıyı telefonda rakam konuştuysan kullan.
      </p>
    </section>
  );
}
