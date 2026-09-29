"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import type { RadarHit } from "./RadarPanel";
import { teklifKisa, teklifMetni, teklifUret } from "@/lib/teklif";

// "Kaça yapıyorsunuz?" — cevabı hazır ve O İŞLETMEYE ÖZEL.
// Her kalem, o sitede ölçtüğümüz bir bulguya bağlı; müşteri "bu fiyat
// nereden çıktı" derse kalem kalem gösterilebiliyor.

interface Props {
  hit: RadarHit;
  referansModu: boolean;
}

export default function TeklifKarti({ hit, referansModu }: Props) {
  const [kopyalandi, setKopyalandi] = useState("");
  const t = teklifUret(hit, referansModu);
  const dahil = t.kalemler.filter((k) => k.dahil);
  const ek = t.kalemler.filter((k) => !k.dahil);
  const telefon = (hit.phone || "").replace(/[^0-9]/g, "");
  const yazili = teklifMetni(hit, t);
  const tl = (n: number) => n.toLocaleString("tr-TR");

  const kopyala = async (metin: string, etiket: string) => {
    try {
      await navigator.clipboard.writeText(metin);
      setKopyalandi(etiket);
      window.setTimeout(() => setKopyalandi(""), 1800);
    } catch {
      setKopyalandi("");
    }
  };

  if (!t.kalemler.length) return null;

  return (
    <section className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
          “Kaça yapıyorsunuz?” — bu işletmeye özel teklif
        </h3>
        <button
          type="button"
          onClick={() => void kopyala(teklifKisa(t), "kisa")}
          className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/[0.14]"
        >
          {kopyalandi === "kisa" ? (
            <Check className="size-3.5 text-emerald-300" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {kopyalandi === "kisa" ? "Kopyalandı" : "Telefonda söylenecek"}
        </button>
      </div>

      <p className="text-sm leading-relaxed text-white">
        <b className="text-emerald-300">
          {tl(t.min)} – {tl(t.max)} ₺
        </b>{" "}
        · {t.gunMin}-{t.gunMax} gün · +{tl(t.bakimAylik)} ₺/ay bakım (isteğe bağlı)
      </p>
      <p className="mt-1 text-[11px] text-white/60">
        Bu fiyata <b className="text-white/85">{dahil.length} madde</b> dahil —
        her biri bu sitede ölçtüğümüz bir bulguya karşılık geliyor.
      </p>

      <ul className="mt-2 flex flex-col gap-1">
        {dahil.map((k) => (
          <li key={k.ad} className="flex gap-2 text-[11px] leading-relaxed">
            <span className="shrink-0 text-emerald-300">▸</span>
            <span className="min-w-0">
              <span className="block text-white/85">{k.ad}</span>
              <span className="block text-white/45">çünkü: {k.gerekce}</span>
            </span>
          </li>
        ))}
      </ul>

      {ek.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200">
            Fiyata dahil değil — ayrıca konuşulacak
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {ek.map((k) => (
              <li key={k.ad} className="text-[11px] text-white/70">
                · {k.ad}
              </li>
            ))}
          </ul>
        </div>
      )}

      {t.onarim.mumkun && (
        <p className="mt-2 rounded-lg bg-white/[0.04] p-2 text-[11px] leading-relaxed text-white/70">
          <b>“Site kalsın, sadece düzeltin” derse:</b> {tl(t.onarim.min)}–
          {tl(t.onarim.max)} ₺.
          {t.onarim.uyari && (
            <span className="block text-amber-200/80">⚠ {t.onarim.uyari}</span>
          )}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void kopyala(yazili, "yazili")}
          className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/[0.14]"
        >
          {kopyalandi === "yazili" ? (
            <Check className="size-3.5 text-emerald-300" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {kopyalandi === "yazili" ? "Kopyalandı" : "Yazılı teklifi kopyala"}
        </button>
        {telefon && (
          <a
            href={`https://wa.me/${telefon}?text=${encodeURIComponent(yazili)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-400/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25"
          >
            <MessageCircle className="size-3.5" /> WhatsApp&apos;ta aç
          </a>
        )}
        <span className="text-[10px] text-white/45">{t.odeme}</span>
      </div>
    </section>
  );
}
