"use client";

import { useEffect } from "react";

// KAYDA ODAK — "#kayit-<slug>" ile gelinen kartı bulur.
//
// "Kim aradı?" bir sonuca tıklanınca kullanıcıyı o kayıt üzerinde iş
// yapılabilen sayfaya götürüyor. Sayfa verisini ağdan sonradan yüklediği için
// tarayıcının kendi hash kaydırması işe yaramıyor (hash okunduğunda kart
// henüz DOM'da yok); bu kanca `hazir` olunca VE her hash değişiminde çağırır.
//
// Kartı nasıl göstereceğini (sekme değiştirme, seçme, kaydırma) sayfa kendisi
// bilir — kanca yalnız "hangi slug" sorusunu cevaplar.
//
// Hash işlendikten sonra SİLİNİR: kalırsa sayfa her yeniden yüklemede aynı
// karta geri zıplar, ve aynı sonuca ikinci kez tıklandığında hash
// değişmediği için olay hiç tetiklenmez.
//
// `odaklan` KARARLI olmalı (useCallback): her çizimde değişirse etki her
// çizimde yeniden çalışır.
export function useKayitOdagi(hazir: boolean, odaklan: (slug: string) => void): void {
  useEffect(() => {
    if (!hazir) return;
    const oku = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash.startsWith("kayit-")) return;
      odaklan(hash.slice("kayit-".length));
      window.history.replaceState(
        window.history.state, "", window.location.pathname + window.location.search,
      );
    };
    oku();
    window.addEventListener("hashchange", oku);
    return () => window.removeEventListener("hashchange", oku);
  }, [hazir, odaklan]);
}

/** Aynı sayfadaysa hash atar (bu `hashchange` üretir), değilse yönlendirir. */
export function kaydaGit(
  sayfa: string, slug: string, suankiYol: string, git: (href: string) => void,
): void {
  const hash = `kayit-${encodeURIComponent(slug)}`;
  if (suankiYol === sayfa) window.location.hash = hash;
  else git(`${sayfa}#${hash}`);
}
