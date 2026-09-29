"use client";

import { useCallback, useEffect, useState } from "react";

// "olmaz" = aradık, ilgilenmiyor dedi (geri dönüş kaydı) ·
// "musteri" = anlaştık, iş alındı. İkisi de 16 Ağu 2026'da eklendi:
// kullanıcı "aradıklarımızı, yok diyenleri, düşünenleri ayrı ayrı
// görebilelim" dedi — durum artık filtrelenebilir bir alan.
// "ulasilamadi" = aradık, AÇMADI. Bir karar değil, bir deneme: kayıt listede
// kalır, deneme sayacı artar ve farklı bir saat dilimine kayar (11 Eyl 2026).
// "randevu" = aradık, yüz yüze görüşme sözü aldık (henüz para yok).
// Arama listesinin başarı ölçüsü budur; "musteri" ise iş alındı demektir.
export type RadarDurum =
  | "arandi"
  | "gizli"
  | "dusunuyor"
  | "kapandi"
  | "olmaz"
  | "randevu"
  | "musteri"
  | "ulasilamadi";

export interface RadarDurumKaydi {
  slug: string;
  ad: string;
  tur: string | null;
  telefon: string | null;
  durum: RadarDurum;
  not_metni: string | null;
  deneme?: number;
  tekrar_saat?: string | null;
  guncelleme: string;
}

// Radar avlarının "aradım / aramadım-gizle / düşünüyor" durumunu tutar —
// /radar sayfasındaki hem harita hem liste bu tek kaynağı paylaşır ki
// bir yerde işaretlenen av diğerinde de kaybolsun/görünsün.
export function useRadarDurum() {
  const [durumlar, setDurumlar] = useState<Record<string, RadarDurumKaydi>>({});
  const [yuklendi, setYuklendi] = useState(false);

  const yenile = useCallback(() => {
    fetch("/api/radar/durum")
      .then((r) => r.json())
      .then((d) => setDurumlar(d.durumlar ?? {}))
      .catch(() => {})
      .finally(() => setYuklendi(true));
  }, []);

  useEffect(yenile, [yenile]);

  const isaretle = useCallback(
    (
      slug: string,
      ad: string,
      durum: RadarDurum,
      ekstra?: { tur?: string; telefon?: string; yeniDeneme?: boolean },
    ) => {
      const { yeniDeneme, ...kimlik } = ekstra ?? {};
      setDurumlar((d) => ({
        ...d,
        [slug]: {
          slug,
          ad,
          tur: kimlik.tur ?? null,
          telefon: kimlik.telefon ?? null,
          durum,
          not_metni: d[slug]?.not_metni ?? null, // durum değişse de mevcut not korunur
          deneme: (d[slug]?.deneme ?? 0) + (yeniDeneme && durum === "ulasilamadi" ? 1 : 0),
          tekrar_saat: d[slug]?.tekrar_saat ?? null,
          guncelleme: new Date().toISOString(),
        },
      }));
      // Tekrar saatini SUNUCU hesaplıyor (tek kaynak) — yanıtı alınca
      // yerel kopyayı düzelt ki kartta doğru saat yazsın.
      void fetch("/api/radar/durum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ad, durum, ...kimlik, yeniDeneme }),
      })
        .then((r) => r.json())
        .then((d: { deneme?: number; tekrar_saat?: string | null }) => {
          setDurumlar((mevcut) =>
            mevcut[slug]
              ? {
                  ...mevcut,
                  [slug]: {
                    ...mevcut[slug],
                    deneme: d.deneme ?? mevcut[slug].deneme,
                    tekrar_saat: d.tekrar_saat ?? null,
                  },
                }
              : mevcut,
          );
        })
        .catch(() => {});
    },
    [],
  );

  // Var olan bir kayda serbest not ekler/günceller — "kaçta arayacağım",
  // "ne dedi" gibi hatırlatmalar için (bkz. Düşünenler bölümü).
  const notGuncelle = useCallback(
    (slug: string, notMetni: string) => {
      const mevcut = durumlar[slug];
      if (!mevcut) return;
      setDurumlar((d) => ({
        ...d,
        [slug]: { ...mevcut, not_metni: notMetni, guncelleme: new Date().toISOString() },
      }));
      void fetch("/api/radar/durum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sunucu ON CONFLICT ile ad/tur/telefon/durum'u da yeniden yazıyor —
        // bu yüzden mevcut değerleri de göndermek gerekiyor.
        body: JSON.stringify({
          slug,
          ad: mevcut.ad,
          tur: mevcut.tur ?? undefined,
          telefon: mevcut.telefon ?? undefined,
          durum: mevcut.durum,
          not: notMetni,
        }),
      }).catch(() => {});
    },
    [durumlar],
  );

  const geriAl = useCallback((slug: string) => {
    setDurumlar((d) => {
      const kopya = { ...d };
      delete kopya[slug];
      return kopya;
    });
    void fetch("/api/radar/durum", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch(() => {});
  }, []);

  return { durumlar, yuklendi, isaretle, notGuncelle, geriAl, yenile };
}
