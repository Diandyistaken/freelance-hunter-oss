"use client";

import { Banknote } from "lucide-react";

/**
 * Fiyat rehberi — "ne kadar isteyeyim, ne zaman söyleyeyim?".
 *
 * KAYNAK: bantlar `services/radar/fikirler/` kataloğundan (fikrin kendi
 * kurulum/aylık alanı), kurallar `docs/yazilim-fikirleri.md` §4 ve
 * `_HQ/knowledge/offer.md` §1.2'den. Bu bantlar ÖNERİ; offer.md'ye
 * işlenmedi — nihai fiyat kullanıcının kararı (uydurma yasak kuralı).
 */
export interface FiyatBilgisi {
  urun: string;
  kurulum: string;
  aylik: string;
  zorluk: number;
}

const KURALLAR = [
  "Telefonda rakam YOK. \"Görmeden fiyat vermek doğru olmaz, 10 dakikada gösterip yüzünüze söylerim.\"",
  "Rakam ikinci görüşmede, ekran açıkken söylenir — önce değer, sonra fiyat.",
  "Önce aylık bakımı konuş, kurulumu ona göre esnet: asıl iş tekrarlayan gelirde.",
  "İndirim istenirse fiyatı düşürme, KAPSAMI küçült (tek modül, tek şube).",
  "Bedava iş yok. Deneme istenirse süreli pilot: 1 ay ücretli, memnun kalmazsa devam yok.",
];

export default function FiyatKarti({ fiyat }: { fiyat: FiyatBilgisi | null }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
        <Banknote className="size-4" />
        Fiyat rehberi
      </p>

      {fiyat ? (
        <div className="mt-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3">
          <p className="text-[11px] text-white/60">Seçili hedefin ürünü</p>
          <p className="text-sm font-medium text-white/90">{fiyat.urun}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
              <p className="text-[10px] text-white/50">kurulum</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-200">{fiyat.kurulum} ₺</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
              <p className="text-[10px] text-white/50">aylık</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-200">{fiyat.aylik} ₺</p>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] text-white/40">
            {"⚙️".repeat(fiyat.zorluk)} yapım süresi · bantlar öneri, offer.md&apos;ye işlenmedi
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Haritadan ya da listeden bir hedef seç — o türün fiyat bandı burada çıkar.
        </p>
      )}

      <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-white/70">
        {KURALLAR.map((k) => (
          <li key={k} className="flex gap-1.5">
            <span className="text-emerald-300">•</span>
            <span>{k}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] leading-relaxed text-white/40">
        Hedef: 15 işletme × ~900 ₺/ay ≈ 13.500 ₺ tekrarlayan gelir. offer.md&apos;deki
        &quot;10 × 400 ₺&quot; hedefi bu segment için düşük kalıyor; Bağdat hattında 600-1.200 ₺/ay
        bandı konuşulabilir (docs/yazilim-fikirleri.md §4).
      </p>
    </div>
  );
}
