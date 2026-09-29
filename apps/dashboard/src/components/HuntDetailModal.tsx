"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Gem,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  ShieldAlert,
  Languages,
  Tag,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
} from "lucide-react";

interface HuntDetail {
  external_id: string;
  platform: string;
  lang: string;
  title_tr: string;
  ceviri_tr: string;
  body: string;
  score: number;
  sinif: string;
  gerekce_tr: string;
  red_flags: string[];
  created_at: string;
  url: string | null;
}

const TR_PLATFORMS = ["Bionluk", "Armut"];

// Satış kitinden (docs/satis-kiti.md) fiyat listesi — web ve Telegram ortak referans.
const FIYAT_TR = [
  ["İşletme tanıtım sitesi (demo şablonundan, QR menü/fiyat listesi DAHİL)", "5.000 – 8.000 ₺", "400 ₺/ay"],
  ["Kurumsal site (çok sayfa, özel tasarım)", "12.000 – 20.000 ₺", "600 ₺/ay"],
  ["Gelişmiş QR menü (çok sayfalı, kendi panelinden anlık güncelleme)", "1.500 – 2.500 ₺ ek", "150 ₺/ay"],
  ["WhatsApp/Telegram randevu botu", "10.000 – 15.000 ₺", "500 ₺/ay"],
  ["AI özet/asistan botu (sektöre özel)", "8.000 – 12.000 ₺", "500 ₺/ay"],
  ["E-posta otomasyonu", "6.000 – 10.000 ₺", "—"],
  ["IT kurulum/destek (yerinde)", "1.500 ₺/gün", "anlaşmalı"],
];
const FIYAT_GLOBAL = [
  ["Saatlik başlangıç", "$15/saat", "5 yorumdan sonra $25–35"],
  ["Landing / tek sayfa", "$150 – 400", "sabit"],
  ["Bot / otomasyon", "$300 – 800", "sabit"],
];

// Öner / önerme genel taktikleri — her ilanda kullanıcıya hatırlatılır.
const ONERILEN = [
  "İlk cevaplayan ol — bot anında haber verdi, hız senin avantajın",
  "Teklifi müşterinin dilinde, ilana ÖZEL yaz (şablon kokusu = eleme)",
  "İşe başlarken %50 kapora al, kapsamı WhatsApp'tan yazılı netleştir",
  "Web işlerinde aylık bakım paketi öner (tekrarlayan gelir)",
];
const ONERILMEYEN = [
  "Platform dışı ödeme/iletişim isteyene ASLA yanaşma (istisnasız scam)",
  "Fiyattan aşağı inme — bütçe düşükse kapsamı küçült",
  "Yapmadığın işi referans gösterme",
  "Kaporasız işe başlama; içerik gelmeden süre işletme",
];

function verdict(sinif: string): {
  icon: React.ReactNode;
  baslik: string;
  metin: string;
  cls: string;
} {
  if (sinif === "firsat")
    return {
      icon: <Gem className="size-5 text-violet-300" />,
      baslik: "💎 KESİNLİKLE TEKLİF VER",
      metin:
        "Elmas değerinde: yüksek skor + iyi bütçe + güvenilir işveren. Öncelik ver ve hızlı davran.",
      cls: "border-violet-400/40 bg-violet-400/[0.08]",
    };
  if (sinif === "uygun")
    return {
      icon: <CheckCircle2 className="size-5 text-emerald-400" />,
      baslik: "✅ TEKLİF VERİLEBİLİR",
      metin:
        "Sana uygun, kaliteli bir iş. İlanı inceleyip teklif vermeye değer.",
      cls: "border-emerald-400/35 bg-emerald-400/[0.06]",
    };
  if (sinif === "suspicious")
    return {
      icon: <ShieldAlert className="size-5 text-amber-400" />,
      baslik: "🚩 DİKKAT — ÖNCE SEN KARAR VER",
      metin:
        "Şüpheli işaretler var. Önermiyoruz demiyoruz ama önce sen değerlendir. Temiz görünmüyorsa geç; platform dışı ödeme/link isteyen kesin dolandırıcı.",
      cls: "border-amber-400/40 bg-amber-400/[0.07]",
    };
  return {
    icon: <AlertTriangle className="size-5 text-[var(--muted)]" />,
    baslik: "Değerlendirildi",
    metin: "Bu ilan elendi ya da sınıflandırılmadı.",
    cls: "border-white/10 bg-white/[0.03]",
  };
}

function Section({
  baslik,
  icon,
  children,
}: {
  baslik: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {icon}
        {baslik}
      </h3>
      {children}
    </div>
  );
}

export default function HuntDetailModal({
  externalId,
  onClose,
}: {
  externalId: string;
  onClose: () => void;
}) {
  const [d, setD] = useState<HuntDetail | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch(`/api/hunt/${encodeURIComponent(externalId)}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.ok) return setErr(true);
        setD(res.hunt);
      })
      .catch(() => setErr(true));
  }, [externalId]);

  // ESC ile kapat
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const market = d && TR_PLATFORMS.includes(d.platform) ? "tr" : "global";
  const v = d ? verdict(d.sinif) : null;
  const fiyat = market === "tr" ? FIYAT_TR : FIYAT_GLOBAL;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:p-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="glass relative my-auto w-full max-w-2xl rounded-2xl border border-white/10 p-6 shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </button>

          {err && (
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              Bu ilanın detayı saklanmamış (elenen ilanlar veya eski kayıtlar).
              Detaylar Telegram&apos;da bulunabilir.
            </p>
          )}

          {!d && !err && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--muted)]">
              <Loader2 className="size-4 animate-spin" /> Detay yükleniyor...
            </div>
          )}

          {d && v && (
            <>
              {/* Üst bilgi */}
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    market === "tr"
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-cyan-400/10 text-cyan-300"
                  }`}
                >
                  {market === "tr" ? "🇹🇷 TR" : "🌍 Global"}
                </span>
                <span className="text-xs text-[var(--muted)]">{d.platform}</span>
                <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                  <Languages className="size-3" />
                  {d.lang}
                </span>
                <span className="ml-auto text-xs font-semibold">Skor {d.score}</span>
              </div>

              <h2 className="mt-3 text-lg font-semibold leading-snug">
                {d.title_tr}
              </h2>

              {/* ÖNERİ KUTUSU */}
              <div className={`mt-4 rounded-xl border p-4 ${v.cls}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {v.icon}
                  {v.baslik}
                </div>
                <p className="mt-1.5 text-sm text-white/80">{v.metin}</p>
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-violet-500/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
                  >
                    <ExternalLink className="size-4" />
                    İlana Git ({d.platform})
                  </a>
                ) : (
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    İlan linki bu kayıtta yok — Telegram bildirimindeki linki kullan.
                  </p>
                )}
                {d.red_flags.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-amber-200/90">
                    {d.red_flags.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* TÜRKÇE ÇEVİRİ */}
              <Section baslik="İlan (Türkçe çeviri)" icon={<FileText className="size-3.5" />}>
                <p className="whitespace-pre-wrap rounded-xl bg-white/[0.03] p-3 text-sm leading-relaxed text-white/85">
                  {d.ceviri_tr || "(çeviri yok)"}
                </p>
              </Section>

              {/* DEĞERLENDİRME */}
              {d.gerekce_tr && (
                <Section baslik="Değerlendirme (neden bu skor)">
                  <p className="rounded-xl bg-white/[0.03] p-3 text-sm leading-relaxed text-white/85">
                    {d.gerekce_tr}
                  </p>
                </Section>
              )}

              {/* NE ÖNERİYORUZ / ÖNERMİYORUZ */}
              <Section baslik="Ne öneriyoruz · Ne önermiyoruz">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                      <ThumbsUp className="size-3.5" /> Öneriyoruz
                    </div>
                    <ul className="space-y-1 text-xs text-white/75">
                      {ONERILEN.map((x, i) => (
                        <li key={i}>• {x}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                      <ThumbsDown className="size-3.5" /> Önermiyoruz
                    </div>
                    <ul className="space-y-1 text-xs text-white/75">
                      {ONERILMEYEN.map((x, i) => (
                        <li key={i}>• {x}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Section>

              {/* FİYAT REHBERİ */}
              <Section
                baslik={`Fiyat rehberi — ne kadar isteyelim (${market === "tr" ? "TR" : "Global"})`}
                icon={<Tag className="size-3.5" />}
              >
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.04] text-[var(--muted)]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Hizmet</th>
                        <th className="px-3 py-2 font-medium">Kurulum</th>
                        <th className="px-3 py-2 font-medium">Bakım / not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fiyat.map((r, i) => (
                        <tr key={i} className="border-t border-white/[0.06]">
                          <td className="px-3 py-2 text-white/85">{r[0]}</td>
                          <td className="px-3 py-2 font-medium text-white/90">{r[1]}</td>
                          <td className="px-3 py-2 text-[var(--muted)]">{r[2]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                  Pazarlıkta alta inme, kapsam küçült. İlk 3-5 işten sonra %20-30 artır.
                </p>
              </Section>

              <p className="mt-5 border-t border-white/[0.06] pt-3 text-[11px] text-[var(--muted)]">
                Teklif hazırlama harici uygulamada yapılıyor.
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
