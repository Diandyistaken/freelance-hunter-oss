"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Phone, X } from "lucide-react";
import type { RadarHit } from "./RadarPanel";
import AramaAgaci from "./AramaAgaci";
import EpostaHazirla from "./EpostaHazirla";
import SenaryoCizelgesi from "./SenaryoCizelgesi";
import TeklifKarti from "./TeklifKarti";
import TumKusurlar from "./TumKusurlar";
import WhatsappRaporu from "./WhatsappRaporu";
import { alanAdiSupheli } from "@/lib/alanAdiUyumu";
import { tamAnlatim } from "@/lib/kusurAnlatimi";
import { paraCercevesi, REKLAM_KALDIRACI } from "@/lib/paraDili";
import { telefonBicimle } from "@/lib/telefon";
import {
  acilis,
  bizimAdimlar,
  fiyatPlani,
  hazirlikMesaji,
  isinCercevesi,
  musteridenIstenecekler,
  senaryoSec,
} from "@/lib/aramaSenaryosu";

// Telefonu açmadan önce 10 saniyede okunacak kart: ilk 5 saniyede ne diyeceğin,
// elindeki kanıt, itiraz gelirse cevabı, fiyat, kaç gün, müşteriden ne isteyeceğin.
// Konuşurken bakılacağı için üstteki açılış cümlesi bilerek BÜYÜK.

function KopyaButonu({ metin, etiket }: { metin: string; etiket: string }) {
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
      {ok ? "Kopyalandı" : etiket}
    </button>
  );
}

function Bolum({
  baslik,
  sag,
  children,
}: {
  baslik: string;
  sag?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          {baslik}
        </h3>
        {sag}
      </div>
      {children}
    </section>
  );
}

interface Props {
  hit: RadarHit;
  demoLinki: string;
  onKapat: () => void;
}

export default function AramaKarti({ hit, demoLinki, onKapat }: Props) {
  const [referansModu, setReferansModu] = useState(false);
  const senaryo = senaryoSec(hit);
  const plan = fiyatPlani(hit, referansModu);
  const adimlar = bizimAdimlar(hit, referansModu);
  const acilisMetni = acilis(hit);
  const devamMetni = tamAnlatim(hit);
  const para = paraCercevesi(hit);
  const cerceve = isinCercevesi(hit);
  const telefon = (hit.phone || "").replace(/[^0-9]/g, "");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onKapat();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onKapat]);

  const tl = (n: number) => n.toLocaleString("tr-TR");

  return (
    <div
      className="fixed inset-0 z-[1200] flex bg-slate-950/90 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onKapat()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="arama-karti-baslik"
        className="glass flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
      >
        {/* başlık */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <div className="min-w-0">
            <h2 id="arama-karti-baslik" className="truncate text-sm font-semibold">
              ☎️ {hit.name}
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              {hit.kind_tr}
              {hit.bolge ? ` · ${hit.bolge}` : ""} · hedef skoru {hit.score} ·{" "}
              {cerceve === "sifirdan" ? "sıfırdan kurulum" : "mevcut siteyi yenileme"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {telefon && (
              <a
                href={`tel:${telefon}`}
                className="flex items-center gap-2 rounded-xl bg-emerald-400/15 px-4 py-2 text-base font-semibold tabular-nums tracking-wide text-emerald-200 transition-colors hover:bg-emerald-400/25"
              >
                <Phone className="size-5" /> {telefonBicimle(hit.phone)}
              </a>
            )}
            <button
              type="button"
              onClick={onKapat}
              aria-label="Arama kartını kapat"
              className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 lg:grid-cols-2">
          {/* SOL: konuşma */}
          <div className="flex flex-col gap-3">
            {alanAdiSupheli(hit.name, hit.domain) && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-3 text-xs leading-relaxed text-amber-200">
                ⚠ <b>ARAMADAN ÖNCE DOĞRULA:</b> tablodaki alan adı (
                <b>{hit.domain}</b>) işletme adıyla uyuşmuyor görünüyor. Google&apos;da
                işletmeyi ara — gerçek sitesi başka olabilir; öyleyse bu karttaki
                kusurlar BAŞKASININ sitesine aittir, bu açılışı KULLANMA.
              </p>
            )}
            <section className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-200">
                  İlk 5 saniye — bunu söyle
                </h3>
                <KopyaButonu metin={acilisMetni} etiket="Kopyala" />
              </div>
              <p className="whitespace-pre-line text-base leading-relaxed text-white sm:text-lg">
                {acilisMetni}
              </p>
              <p className="mt-2 text-[11px] text-cyan-200/70">
                Soruyla bitir ve SUS. İlk konuşan o olsun.
              </p>
            </section>

            {devamMetni && (
              <section className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
                    Sonraki 20 saniye — “ne olmuş?” derse
                  </h3>
                  <KopyaButonu metin={devamMetni} etiket="Kopyala" />
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-white sm:text-base">
                  {devamMetni}
                </p>
                <p className="mt-2 text-[11px] text-emerald-200/70">
                  Satır aralarında dur, tepkisini al. Sonu yine soru — cevabı o
                  versin, oradan Konuşma Ağacı&apos;yla devam et.
                </p>
              </section>
            )}

            {/* "Neden umursayayım?" derse — kusuru PARA diline çevir.
                Rakamı biz uydurmuyoruz: sektörün bilet aralığını söyleyip
                hesabı ona yaptırıyoruz (bkz. docs/neden-onemsesinler.md). */}
            <section className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
                “Bana ne?” derse — para dili
              </h3>
              <p className="text-xs leading-relaxed text-white/90">{para.kayipCumlesi}</p>
              {para.ekKaldirac && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/65">
                  ↳ {para.ekKaldirac}
                </p>
              )}
              <p className="mt-1.5 rounded-md bg-black/25 p-2 text-[11px] leading-relaxed text-amber-200/85">
                💡 Reklam veriyorsa: {REKLAM_KALDIRACI}
              </p>
            </section>

            <TumKusurlar hit={hit} />

            <AramaAgaci hit={hit} demoLinki={demoLinki} referansModu={referansModu} />

            {senaryo.itirazlar.length > 0 && (
              <Bolum baslik="Bu kusura özel itirazlar (yedek)">
                <ul className="flex flex-col gap-2">
                  {senaryo.itirazlar.map((i) => (
                    <li key={i.soru}>
                      <p className="text-[11px] font-semibold text-amber-200">“{i.soru}”</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-white/75">
                        {i.cevap}
                      </p>
                    </li>
                  ))}
                </ul>
                <a
                  href="/arama"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[11px] text-cyan-300 underline"
                >
                  Genel itiraz kütüphanesi + sektör modülleri →
                </a>
              </Bolum>
            )}
          </div>

          {/* SAĞ: ticaret */}
          <div className="flex flex-col gap-3">
            <Bolum
              baslik="Fiyat & süre"
              sag={
                <button
                  type="button"
                  onClick={() => setReferansModu((v) => !v)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    referansModu
                      ? "bg-amber-400/20 text-amber-200"
                      : "bg-white/[0.07] text-white/70 hover:bg-white/[0.14]"
                  }`}
                >
                  {referansModu ? "Referans fiyatı ✓" : "Referans fiyatı"}
                </button>
              }
            >
              <p className="text-xs font-semibold text-white/90">{plan.paket}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-xl font-semibold text-emerald-300">
                  {tl(plan.min)} – {tl(plan.max)} ₺
                </span>
                <span className="text-xs text-white/60">+ {tl(plan.bakimAylik)} ₺/ay bakım</span>
                <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-white/70">
                  {plan.gunMin}–{plan.gunMax} gün
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-white/55">{plan.gerekce}</p>
              <p className="mt-2 rounded-lg bg-white/[0.04] p-2 text-[11px] text-white/70">
                Pazarlıkta <b>fiyatı düşürme, kapsamı küçült.</b> %50 kapora
                başlarken, kalan teslimde. Alan adı müşterinin adına,
                müşterinin kartıyla.
              </p>
            </Bolum>

            <TeklifKarti hit={hit} referansModu={referansModu} />

            <SenaryoCizelgesi
              hit={hit}
              demoVar={Boolean(demoLinki)}
              referansModu={referansModu}
            />

            <Bolum
              baslik="Müşteriden isteyeceklerin"
              sag={<KopyaButonu metin={hazirlikMesaji(hit)} etiket="WhatsApp mesajı" />}
            >
              <ul className="flex flex-col gap-1">
                {musteridenIstenecekler(hit).map((m) => (
                  <li key={m} className="flex gap-2 text-[11px] leading-relaxed text-white/75">
                    <span className="text-emerald-300">▸</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </Bolum>

            <WhatsappRaporu hit={hit} referansModu={referansModu} />

            <EpostaHazirla hit={hit} demoLinki={demoLinki} referansModu={referansModu} />

            <Bolum baslik="“Gelin yapın” derse — bizim adımlarımız">
              <ol className="flex flex-col gap-2">
                {adimlar.map((a) => (
                  <li key={`${a.gun}-${a.baslik}`} className="flex gap-2">
                    <span className="w-14 shrink-0 pt-0.5 text-[10px] font-semibold text-cyan-300">
                      {a.gun}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold text-white/85">
                        {a.baslik}
                      </span>
                      <span className="block text-[11px] leading-relaxed text-white/55">
                        {a.detay}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <a
                href="/rehber?dosya=fiyat-ve-teslimat-rehberi"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[11px] text-cyan-300 underline"
              >
                Tam fiyat & teslimat rehberi →
              </a>
            </Bolum>
          </div>
        </div>
      </div>
    </div>
  );
}
