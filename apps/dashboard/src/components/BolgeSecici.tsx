"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, MapPin, X } from "lucide-react";

// Hangi semtler taranacak — panelden tek tek seçilir.
// Bölge listesi artık .env ayarı değil; katalog Python'da (bolgeler.py),
// seçim data/radar_bolge_secim.json'da. "Sıcak Lead Tara" bu seçimi kullanır.

interface Semt {
  ad: string;
  lat: number;
  lon: number;
  yaricap: number;
  not: string;
}

interface Props {
  onKapat: () => void;
  onKaydedildi: (secilen: string[]) => void;
}

export default function BolgeSecici({ onKapat, onKaydedildi }: Props) {
  const [kategoriler, setKategoriler] = useState<Record<string, Semt[]>>({});
  const [secilen, setSecilen] = useState<Set<string>>(new Set());
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState("");

  const yukle = useCallback(async () => {
    try {
      const r = await fetch("/api/radar/bolgeler").then((x) => x.json());
      if (r.ok) {
        setKategoriler(r.kategoriler);
        setSecilen(new Set<string>(r.secilen ?? []));
      } else setHata(r.error ?? "katalog okunamadı");
    } catch {
      setHata("istek başarısız");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onKapat();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onKapat]);

  const degistir = (ad: string) =>
    setSecilen((eski) => {
      const yeni = new Set(eski);
      if (yeni.has(ad)) yeni.delete(ad);
      else yeni.add(ad);
      return yeni;
    });

  const kategoriToplu = (semtler: Semt[], ekle: boolean) =>
    setSecilen((eski) => {
      const yeni = new Set(eski);
      semtler.forEach((s) => (ekle ? yeni.add(s.ad) : yeni.delete(s.ad)));
      return yeni;
    });

  const kaydet = async () => {
    setKaydediliyor(true);
    setHata("");
    try {
      const liste = Array.from(secilen);
      const r = await fetch("/api/radar/bolgeler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secilen: liste }),
      }).then((x) => x.json());
      if (r.ok) {
        onKaydedildi(liste);
        onKapat();
      } else setHata(r.error ?? "kaydedilemedi");
    } catch {
      setHata("istek başarısız");
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1250] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onKapat()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bolge-secici-baslik"
        className="glass flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <div>
            <h2 id="bolge-secici-baslik" className="text-sm font-semibold">
              📍 Hangi semtler taransın?
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              Seçtiklerin taranır · {secilen.size} semt seçili
            </p>
          </div>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {hata && (
            <p className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-2 text-[11px] text-amber-200">
              ⚠ {hata}
            </p>
          )}
          {yukleniyor ? (
            <p className="flex items-center gap-2 text-xs text-white/60">
              <Loader2 className="size-4 animate-spin" /> Katalog yükleniyor…
            </p>
          ) : (
            Object.entries(kategoriler).map(([kategori, semtler]) => {
              const secili = semtler.filter((s) => secilen.has(s.ad)).length;
              return (
                <section key={kategori}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-200/80">
                      {kategori}
                      <span className="ml-2 font-normal normal-case tracking-normal text-white/40">
                        {secili}/{semtler.length}
                      </span>
                    </h3>
                    <span className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => kategoriToplu(semtler, true)}
                        className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/[0.12]"
                      >
                        Hepsini seç
                      </button>
                      <button
                        type="button"
                        onClick={() => kategoriToplu(semtler, false)}
                        className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/[0.12]"
                      >
                        Kaldır
                      </button>
                    </span>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {semtler.map((s) => {
                      const acik = secilen.has(s.ad);
                      return (
                        <button
                          key={s.ad}
                          type="button"
                          onClick={() => degistir(s.ad)}
                          className={`flex items-start gap-2 rounded-lg border p-2 text-left transition-colors ${
                            acik
                              ? "border-emerald-400/40 bg-emerald-400/[0.1]"
                              : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06]"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                              acik
                                ? "border-emerald-400/60 bg-emerald-400/30"
                                : "border-white/20"
                            }`}
                          >
                            {acik && <Check className="size-3 text-emerald-100" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-medium text-white/90">
                              {s.ad}
                            </span>
                            <span className="block text-[10px] text-white/45">
                              {s.not} · {(s.yaricap / 1000).toFixed(1)} km
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] px-4 py-3">
          <p className="text-[11px] text-white/45">
            Her semt ayrı sorgu — çok seçersen tarama uzar (semt başına ~30-60 sn).
          </p>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={onKapat}
              className="rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/[0.12]"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => void kaydet()}
              disabled={kaydediliyor || secilen.size === 0}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-400/20 px-4 py-2 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/30 disabled:opacity-50"
            >
              {kaydediliyor ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <MapPin className="size-3.5" />
              )}
              {secilen.size} semti kaydet
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
