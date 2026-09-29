"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { RadarHit } from "./RadarPanel";
import {
  kusurGruplari,
  sayiMetni,
  tamAnlatim,
  type SiddetSinifi,
} from "@/lib/kusurAnlatimi";

// Arama Kartı'nın "tüm kusurlar" paneli: eski "Elindeki kanıt" bölümü yalnız
// EN AĞIR kusuru gösteriyordu; telefonda diğer 8 bulgu anlatılamıyordu.
// Burada her kusur esnaf diline çevrilmiş TEK cümle olarak, önem rozetiyle
// ve etki grubuyla listelenir; üstteki buton telefonda okunabilir tam
// anlatımı kopyalar. Kanıt + "kendin doğrula" satırları her cümlenin altında.

const SINIF_STILI: Record<SiddetSinifi, { arka: string; yazi: string; etiket: string }> = {
  kritik: { arka: "bg-red-400/15", yazi: "text-red-200", etiket: "kritik" },
  ciddi: { arka: "bg-amber-400/15", yazi: "text-amber-200", etiket: "ciddi" },
  kucuk: { arka: "bg-slate-400/15", yazi: "text-slate-300", etiket: "küçük" },
};

function AnlatimKopyala({ metin }: { metin: string }) {
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
      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/[0.14]"
    >
      {ok ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
      {ok ? "Kopyalandı" : "Tam anlatımı kopyala"}
    </button>
  );
}

export default function TumKusurlar({ hit }: { hit: RadarHit }) {
  const gruplar = kusurGruplari(hit);

  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Tüm kusurlar — telefonda bu sırayla
          {gruplar.length > 0 && (
            <span className="ml-2 rounded-full bg-white/[0.07] px-2 py-0.5 normal-case tracking-normal text-white/70">
              {sayiMetni(hit)}
            </span>
          )}
        </h3>
        {gruplar.length > 0 && <AnlatimKopyala metin={tamAnlatim(hit)} />}
      </div>

      {gruplar.length === 0 ? (
        <p className="text-xs text-white/50">Kayıtlı kusur yok.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {gruplar.map((grup) => (
            <div key={grup.ad}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-200/70">
                {grup.ikon} {grup.ad}
              </p>
              <ul className="flex flex-col gap-1.5">
                {grup.kusurlar.map((k) => {
                  const stil = SINIF_STILI[k.sinif];
                  return (
                    <li key={k.kusur.kod} className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${stil.arka} ${stil.yazi}`}
                      >
                        {stil.etiket}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs leading-relaxed text-white/90">
                          {k.cumle}
                        </span>
                        <span className="block font-mono text-[10px] text-white/40">
                          kanıt: {k.kusur.kanit}
                        </span>
                        {k.kusur.dogrula && (
                          <span className="block text-[10px] text-cyan-200/60">
                            🔍 {k.kusur.dogrula}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p className="rounded-md bg-black/25 p-2 text-[11px] leading-relaxed text-amber-200/85">
            💡 Üstteki &ldquo;Sonraki 20 saniye&rdquo; metni en vurucu 3&apos;ünü
            seçer — bu liste senin kanıt depon. &ldquo;Neymiş onlar?&rdquo; derse
            buradan sırayla oku; her cümleden sonra tepki bekle. Doğrulama adımını
            göremeyeceği kusuru SÖYLEME.
          </p>
        </div>
      )}
    </section>
  );
}
