"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import type { RadarHit } from "./RadarPanel";
import StilKartlari, { type StilKodu } from "./StilKarti";
import { slugla } from "@/lib/slug";

// Şablon devri kapandı: demo artık üç adımda üretiliyor —
//   1) ANALİZ: mevcut siteden gerçek metin + fotoğraflar çekilir, model bu
//      işletmeye ÖZEL sorular üretir ("hangi fotoğraf vitrin olsun?" gibi)
//   2) SORULAR: cevaplarsın + tasarım yönünü seçersin (hover'da önizleme)
//   3) ÜRETİM: cevaplarla, bol animasyonlu tek sayfa sıfırdan yazılır
// İki uzun adım da arka planda koşar; burası iş dosyasını yoklar.

interface Soru {
  id: string;
  soru: string;
  tip?: "secim" | "metin" | "foto";
  secenekler?: string[];
  neden?: string;
}

interface IsDurumu {
  asama?: "analiz" | "sorular_hazir" | "uretiliyor" | "hazir" | "hata";
  sorular?: Soru[];
  ozet?: string;
  hata?: string;
  url?: string;
  foto_sayisi?: number;
  sayfa_sayisi?: number;
  uretim_maliyet?: { usd?: number; cikti_token?: number };
}

const YOKLAMA_MS = 4000;

interface Props {
  hit: RadarHit;
  /** radar listesindeki sıra numarası — run.py --demo-* ile aynı indeks */
  n: number;
  onKapat: () => void;
}

export default function DemoSihirbazi({ hit, n, onKapat }: Props) {
  const slug = slugla(hit.name);
  const [is, setIs] = useState<IsDurumu | null>(null);
  const [cevaplar, setCevaplar] = useState<Record<string, string>>({});
  const [stil, setStil] = useState<StilKodu>("sicak");
  const [hata, setHata] = useState("");
  const [baslatildi, setBaslatildi] = useState(false);
  const yoklamaRef = useRef<number | null>(null);

  const yokla = useCallback(async () => {
    try {
      const r = await fetch(`/api/demo-is?slug=${encodeURIComponent(slug)}`).then((x) =>
        x.json(),
      );
      if (r.ok) setIs(r.is);
    } catch {
      /* geçici ağ hatası — bir sonraki yoklamada düzelir */
    }
  }, [slug]);

  // Açılışta mevcut işi oku; iş bitene kadar yoklamayı sürdür.
  useEffect(() => {
    void yokla();
    yoklamaRef.current = window.setInterval(() => void yokla(), YOKLAMA_MS);
    return () => {
      if (yoklamaRef.current) window.clearInterval(yoklamaRef.current);
    };
  }, [yokla]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onKapat();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onKapat]);

  const asama = is?.asama;
  const calisiyor = asama === "analiz" || asama === "uretiliyor";

  const gonder = async (govde: Record<string, unknown>) => {
    setHata("");
    try {
      const r = await fetch("/api/demo-is", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, slug, ...govde }),
      }).then((x) => x.json());
      if (!r.ok) setHata(r.error ?? "başlatılamadı");
      else {
        setBaslatildi(true);
        void yokla();
      }
    } catch {
      setHata("istek başarısız");
    }
  };

  const analizBaslat = () => {
    setIs({ asama: "analiz" });
    void gonder({ asama: "analiz" });
  };
  const uretimBaslat = () => {
    setIs({ ...(is ?? {}), asama: "uretiliyor" });
    void gonder({ asama: "uret", cevaplar, stil });
  };

  const fotoUrl = (dosya: string) => `/api/demo/${slug}--fable/img/${dosya}`;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onKapat()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-sihirbaz-baslik"
        className="glass flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <div className="min-w-0">
            <h2 id="demo-sihirbaz-baslik" className="truncate text-sm font-semibold">
              🎨 {hit.name} — sıfırdan tasarım
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              Şablon yok · mevcut sitenizin gerçek içeriğiyle · Max aboneliği, $0
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

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {hata && (
            <p className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-2 text-[11px] text-amber-200">
              ⚠ {hata}
            </p>
          )}

          {/* HAZIR */}
          {asama === "hazir" && is?.url && (
            <>
              <a
                href={is.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.09] p-3 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-400/[0.16]"
              >
                <ExternalLink className="size-4 shrink-0" />
                Tasarım hazır — aç
              </a>
              <p className="text-[11px] text-white/50">
                Maliyet ${is.uretim_maliyet?.usd ?? 0} (Max aboneliği) ·{" "}
                {is.foto_sayisi ?? 0} gerçek fotoğraf · {is.sayfa_sayisi ?? 0} sayfa
                okundu. Beğenmediysen aşağıdan farklı stil/cevaplarla yeniden üret.
              </p>
              <button
                type="button"
                onClick={() => setIs({ ...is, asama: "sorular_hazir" })}
                className="self-start rounded-lg bg-white/[0.07] px-3 py-1.5 text-[11px] text-white/75 transition-colors hover:bg-white/[0.14]"
              >
                Cevapları değiştir / yeniden üret
              </button>
            </>
          )}

          {/* ÇALIŞIYOR */}
          {calisiyor && (
            <div className="flex items-start gap-3 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] p-3">
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-cyan-300" />
              <div>
                <p className="text-xs font-medium text-cyan-100">
                  {asama === "analiz"
                    ? "Mevcut site okunuyor (ana sayfa + iç sayfalar), fotoğraflar indiriliyor, sorular hazırlanıyor…"
                    : "Tasarım yazılıyor — bol animasyonlu tek sayfa üretiliyor…"}
                </p>
                <p className="mt-1 text-[11px] text-cyan-200/70">
                  {asama === "analiz" ? "Yaklaşık 1-3 dakika." : "Yaklaşık 3-6 dakika."}{" "}
                  Arka planda çalışıyor — bu pencereyi kapatabilirsin, sonra tekrar
                  açtığında kaldığı yerden görürsün.
                </p>
              </div>
            </div>
          )}

          {/* HATA */}
          {asama === "hata" && (
            <div className="rounded-xl border border-red-400/25 bg-red-400/[0.07] p-3">
              <p className="text-xs text-red-100">İş yarıda kaldı: {is?.hata}</p>
              <button
                type="button"
                onClick={analizBaslat}
                className="mt-2 rounded-lg bg-white/[0.07] px-3 py-1.5 text-[11px] text-white/75 transition-colors hover:bg-white/[0.14]"
              >
                Baştan dene
              </button>
            </div>
          )}

          {/* BAŞLANGIÇ */}
          {!is && !baslatildi && (
            <>
              <p className="text-xs leading-relaxed text-white/75">
                Önce <b>mevcut sitenizden</b> gerçek metinleri ve fotoğrafları
                çekeceğim (ana sayfa + en fazla 5 iç sayfa), sonra bu işletmeye özel
                birkaç soru soracağım. Cevaplarına göre site sıfırdan, ölçülen
                kusurları giderecek ve <b>bol animasyonlu</b> biçimde yazılacak.
              </p>
              <button
                type="button"
                onClick={analizBaslat}
                className="self-start rounded-xl bg-fuchsia-400/20 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-400/30"
              >
                Başla — siteyi oku ve soruları hazırla
              </button>
            </>
          )}

          {/* SORULAR */}
          {asama === "sorular_hazir" && (
            <>
              {is?.ozet && (
                <p className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-[11px] leading-relaxed text-white/70">
                  📋 {is.ozet}
                </p>
              )}
              <p className="text-[11px] text-white/45">
                {is?.sayfa_sayisi ?? 0} sayfa okundu · {is?.foto_sayisi ?? 0} fotoğraf
                indirildi. Cevaplaman şart değil — boş bıraktıklarına ben karar veririm.
              </p>

              <div className="flex flex-col gap-3">
                {(is?.sorular ?? []).map((s) => (
                  <div key={s.id}>
                    <p className="text-xs font-medium text-white/85">{s.soru}</p>
                    {s.neden && (
                      <p className="mb-1 text-[10px] text-white/40">↳ {s.neden}</p>
                    )}
                    {s.tip === "foto" && s.secenekler?.length ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {s.secenekler.map((dosya) => (
                          <button
                            key={dosya}
                            type="button"
                            onClick={() =>
                              setCevaplar((c) => ({ ...c, [s.soru]: dosya }))
                            }
                            className={`overflow-hidden rounded-lg border-2 transition-colors ${
                              cevaplar[s.soru] === dosya
                                ? "border-cyan-400"
                                : "border-transparent hover:border-white/30"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={fotoUrl(dosya)}
                              alt={dosya}
                              className="h-16 w-24 object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    ) : s.tip === "secim" && s.secenekler?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {s.secenekler.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setCevaplar((c) => ({ ...c, [s.soru]: sec }))}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
                              cevaplar[s.soru] === sec
                                ? "border-cyan-400/50 bg-cyan-400/[0.12] text-cyan-100"
                                : "border-white/[0.1] bg-white/[0.03] text-white/75 hover:bg-white/[0.08]"
                            }`}
                          >
                            {sec}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={cevaplar[s.soru] ?? ""}
                        onChange={(e) =>
                          setCevaplar((c) => ({ ...c, [s.soru]: e.target.value }))
                        }
                        placeholder="(isteğe bağlı)"
                        className="mt-1 w-full rounded-lg border border-white/[0.1] bg-black/25 px-2.5 py-1.5 text-[11px] text-white/90 outline-none transition-colors focus:border-cyan-400/40"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-white/85">
                  Tasarım yönü{" "}
                  <span className="text-[10px] font-normal text-white/40">
                    (üzerine gel — nasıl duracağını gör)
                  </span>
                </p>
                <StilKartlari secili={stil} onSec={setStil} />
              </div>

              <button
                type="button"
                onClick={uretimBaslat}
                className="mt-1 self-start rounded-xl bg-fuchsia-400/20 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-400/30"
              >
                Tasarımı üret ({Object.keys(cevaplar).length} cevap)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
