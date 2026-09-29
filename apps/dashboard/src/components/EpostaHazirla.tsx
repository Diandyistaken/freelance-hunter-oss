"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import type { RadarHit } from "./RadarPanel";
import { epostaTaslagi, tahminiEposta } from "@/lib/aramaSenaryosu";

// "Mail atın" diyen işletmeye gönderilecek taslağı üretir.
//
// GÖNDERMEZ — mailto ile SENİN mail uygulamanı açar; gönder tuşuna sen
// basarsın. Sistemin "insan onaylı gönderim" kuralı burada da geçerli
// (oto-gönderim = spam = itibar kaybı).

interface Props {
  hit: RadarHit;
  demoLinki: string;
  referansModu: boolean;
}

export default function EpostaHazirla({ hit, demoLinki, referansModu }: Props) {
  const kayitli = hit.eposta ?? "";
  const tahmin = tahminiEposta(hit);
  const [adres, setAdres] = useState(kayitli || tahmin);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [acik, setAcik] = useState(false);

  const taslak = useMemo(
    () => epostaTaslagi(hit, demoLinki, referansModu),
    [hit, demoLinki, referansModu],
  );

  const tahminMi = !kayitli && adres.trim() === tahmin;
  const gecerli = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adres.trim());
  const mailto =
    `mailto:${encodeURIComponent(adres.trim())}` +
    `?subject=${encodeURIComponent(taslak.konu)}` +
    `&body=${encodeURIComponent(taslak.govde)}`;

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(`${taslak.konu}\n\n${taslak.govde}`);
      setKopyalandi(true);
      window.setTimeout(() => setKopyalandi(false), 2000);
    } catch {
      setKopyalandi(false);
    }
  };

  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          E-posta hazırla
        </h3>
        <button
          type="button"
          onClick={() => setAcik((v) => !v)}
          className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/[0.12]"
        >
          {acik ? "Metni gizle" : "Metni gör"}
        </button>
      </div>

      <label className="block text-[11px] text-white/55" htmlFor="eposta-adres">
        Alıcı adresi
      </label>
      <input
        id="eposta-adres"
        type="email"
        value={adres}
        onChange={(e) => setAdres(e.target.value)}
        placeholder="ornek@firma.com"
        className="mt-1 w-full rounded-lg border border-white/[0.1] bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none transition-colors focus:border-cyan-400/40"
      />
      {kayitli ? (
        <p className="mt-1 text-[11px] text-emerald-300/80">
          ✓ Bu adres işletmenin kendi kaydından geldi.
        </p>
      ) : tahminMi ? (
        <p className="mt-1 text-[11px] text-amber-200/80">
          ⚠ Bu bir <b>tahmin</b> ({tahmin}). Telefonda teyit etmeden gönderme —
          yanlış adrese giden mail spam sayılır.
        </p>
      ) : null}

      {acik && (
        <div className="mt-2 rounded-lg border border-white/[0.07] bg-black/25 p-2.5">
          <p className="text-[11px] font-semibold text-white/70">Konu:</p>
          <p className="mb-2 text-[11px] text-white/85">{taslak.konu}</p>
          <p className="text-[11px] font-semibold text-white/70">Gövde:</p>
          <pre className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-white/80">
            {taslak.govde}
          </pre>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={gecerli ? mailto : undefined}
          aria-disabled={!gecerli}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
            gecerli
              ? "bg-cyan-400/20 text-cyan-100 hover:bg-cyan-400/30"
              : "cursor-not-allowed bg-white/[0.05] text-white/30"
          }`}
        >
          <Mail className="size-3.5" />
          Mail uygulamasında aç
        </a>
        <button
          type="button"
          onClick={() => void kopyala()}
          className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-3 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/[0.14]"
        >
          {kopyalandi ? (
            <Check className="size-3.5 text-emerald-300" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {kopyalandi ? "Kopyalandı" : "Metni kopyala"}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/40">
        Sistem mail GÖNDERMEZ — kendi mail uygulamanı açar, gönder tuşuna sen
        basarsın. İşletme başına en fazla 1 takip.
      </p>
    </section>
  );
}
