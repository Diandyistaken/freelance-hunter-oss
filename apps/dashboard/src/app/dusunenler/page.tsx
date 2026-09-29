"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Phone, StickyNote, Undo2, XCircle, Ban } from "lucide-react";
import { useRadarDurum } from "@/hooks/useRadarDurum";
import { useKayitOdagi } from "@/hooks/useKayitOdagi";
import { telefonBicimle } from "@/lib/telefon";
import { utcOku } from "@/lib/zaman";

// "Düşünüyor" işaretli avlar radar listesinden ayrı, kendi sayfasında —
// kullanıcı buraya gelip tek tıkla arayabilsin, notunu (kaçta arayacağım,
// ne dedi vb.) görüp güncelleyebilsin diye (bkz. radar/page.tsx'teki
// isaretle akışıyla aynı ortak radar_durum kaynağı).
export default function DusunenlerPage() {
  const { durumlar, yuklendi, isaretle, notGuncelle, geriAl } = useRadarDurum();
  const [taslaklar, setTaslaklar] = useState<Record<string, string>>({});
  // "Kim aradı?"dan gelinen kart: düşünen biri geri aradığında notuna bakıp
  // güncelleyebilesin, konuşma bitince "Arandı" diyebilesin diye doğrudan
  // onun kartına iniliyor ve kart işaretleniyor.
  const [odak, setOdak] = useState<string | null>(null);
  const kayitaOdaklan = useCallback((slug: string) => {
    setOdak(slug);
    document.getElementById(`kayit-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  useKayitOdagi(yuklendi, kayitaOdaklan);

  const dusunenler = Object.values(durumlar)
    .filter((k) => k.durum === "dusunuyor")
    .sort((a, b) => b.guncelleme.localeCompare(a.guncelleme));

  const notMetni = (slug: string, kayitli: string | null) => taslaklar[slug] ?? kayitli ?? "";

  const notuKaydet = (slug: string, kayitli: string | null) => {
    const metin = taslaklar[slug];
    if (metin === undefined || metin === (kayitli ?? "")) return;
    notGuncelle(slug, metin);
  };

  return (
    <>
      <header className="glass flex items-center justify-between rounded-2xl px-5 py-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Clock3 className="size-5 text-amber-300" />
            🤔 Düşünenler
          </h1>
          <p className="text-xs text-[var(--muted)]">
            &quot;Düşünüyorum&quot; dediği işletmeler — tekrar ara, notunu tut (kaçta arayacağın, ne dediği).
          </p>
        </div>
        <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200">
          {dusunenler.length} bekliyor
        </span>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="glass rounded-2xl p-5"
      >
        {!yuklendi ? (
          <p className="p-4 text-center text-sm text-[var(--muted)]">Yükleniyor…</p>
        ) : dusunenler.length === 0 ? (
          <p className="p-4 text-center text-sm text-[var(--muted)]">
            Şu an düşünen yok — radar listesinde bir yeri 🤔 ile işaretlersen burada görünür.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {dusunenler.map((k) => (
              <div
                key={k.slug}
                id={`kayit-${k.slug}`}
                className={`flex flex-col gap-3 rounded-xl border bg-amber-400/[0.04] p-4 ${
                  odak === k.slug ? "border-amber-300 ring-2 ring-amber-300/40" : "border-amber-400/20"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{k.ad}</p>
                    <p className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                      {k.tur && <span>{k.tur}</span>}
                      {/* utcOku: SQLite UTC yazıyor, eksiz dize V8'de yerel
                          saat sayılıyordu — burada 3 saat GERİ görünüyordu. */}
                      <span>· işaretlendi: {utcOku(k.guncelleme)?.toLocaleString("tr-TR") ?? "—"}</span>
                    </p>
                  </div>
                  {k.telefon && (
                    <a
                      href={`tel:${k.telefon.replace(/\s+/g, "")}`}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-400/15 px-3 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25"
                    >
                      <Phone className="size-4" />
                      <span className="text-sm font-semibold tabular-nums tracking-wide">
                        {telefonBicimle(k.telefon)}
                      </span>
                      — Ara
                    </a>
                  )}
                </div>

                <label className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/60">
                    <StickyNote className="size-3.5" />
                    Not — kaçta arayacağın, ne dediği, fiyat itirazı vb.
                  </span>
                  <textarea
                    value={notMetni(k.slug, k.not_metni)}
                    onChange={(e) => setTaslaklar((t) => ({ ...t, [k.slug]: e.target.value }))}
                    onBlur={() => notuKaydet(k.slug, k.not_metni)}
                    placeholder="ör. Cuma 15:00'te tekrar ara, fiyat konusunda eşiyle konuşacakmış"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-xs text-white/90 outline-none placeholder:text-white/30 focus:border-amber-400/40"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => isaretle(k.slug, k.ad, "arandi", { tur: k.tur ?? undefined, telefon: k.telefon ?? undefined })}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-400/15 px-3 py-1.5 text-xs text-emerald-200 transition-colors hover:bg-emerald-400/25"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Arandı — kapat
                  </button>
                  <button
                    onClick={() => isaretle(k.slug, k.ad, "gizli", { tur: k.tur ?? undefined, telefon: k.telefon ?? undefined })}
                    className="flex items-center gap-1.5 rounded-lg bg-red-400/15 px-3 py-1.5 text-xs text-red-200 transition-colors hover:bg-red-400/25"
                  >
                    <XCircle className="size-3.5" />
                    İlgilenmiyor
                  </button>
                  <button
                    onClick={() => isaretle(k.slug, k.ad, "kapandi", { tur: k.tur ?? undefined, telefon: k.telefon ?? undefined })}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-400/15 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-400/25"
                  >
                    <Ban className="size-3.5" />
                    Kalıcı Kapanmış
                  </button>
                  <button
                    onClick={() => geriAl(k.slug)}
                    className="ml-auto flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.12]"
                  >
                    <Undo2 className="size-3.5" />
                    Radar listesine döndür
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </>
  );
}
