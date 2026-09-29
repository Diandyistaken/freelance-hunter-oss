"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Mic, Square } from "lucide-react";

// ARAMA KAYDI (10 Eyl 2026, kullanıcı fikri)
// Telefon HOPARLÖRDE, laptop mikrofonu iki tarafı da duyar. Kayıt bitince:
// yazıya dökülür → kim konuştu ayrılır → görüşme analiz edilir (Claude CLI, $0).
// Ses ve döküm bu bilgisayardan çıkmaz. Karşı tarafa kaydettiğini söylemek
// hem doğrusu hem güvenlisi.

interface Parca {
  baslangic: number;
  bitis: number;
  metin: string;
  konusan?: string;
}

interface Analiz {
  puan?: number;
  ozet?: string;
  olcutler?: Record<string, string>;
  sorun_kimde?: string;
  sorun_gerekcesi?: string;
  en_kritik_an?: { saniye?: number; ne_oldu?: string };
  itiraz?: string | null;
  sonraki_sefer?: string[];
  iyi_giden?: string | null;
}

interface Kayit {
  kimlik: string;
  slug: string;
  asama: string;
  sure_sn?: number;
  parcalar?: Parca[];
  analiz?: Analiz | null;
  konusan_guven?: { guven?: number; not?: string };
  uyari?: string;
  hata?: string;
}

const ASAMA_METNI: Record<string, string> = {
  kaydediyor: "🎙 kaydediyor",
  kayit_bitti: "kayıt bitti",
  yaziya_dokuyor: "yazıya döküyor (whisper)",
  konusan_ayiriyor: "kim konuştu ayrılıyor",
  analiz_ediyor: "görüşme analiz ediliyor",
  bitti: "hazır",
  hata: "hata",
};

const OLCUT_ADI: Record<string, string> = {
  acilis_izin: "açılış + izin",
  sebep_cunku: "sebep + çünkü",
  kanca_sorusu: "kanca sorusu",
  sus: "30. sn sustu",
  randevu: "randevu istendi",
  fiyat_vermedi: "fiyat vermedi",
};

export default function AramaKaydi({ slug, ad }: { slug: string; ad: string }) {
  const [aktif, setAktif] = useState<{ kimlik?: string; slug?: string } | null>(null);
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [mesaj, setMesaj] = useState("");
  const [bekleniyor, setBekleniyor] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setInterval> | null>(null);

  const oku = useCallback(async () => {
    try {
      const r = await fetch(`/api/arama-kaydi?slug=${encodeURIComponent(slug)}`);
      const d = await r.json();
      setAktif(d.aktif ?? null);
      setKayitlar(d.kayitlar ?? []);
    } catch {
      /* panel açıkken ağ hatası olmaz; sessiz geç */
    }
  }, [slug]);

  useEffect(() => {
    void oku();
  }, [oku]);

  const sonuncu = kayitlar[0];
  const bizeAit = aktif?.slug === slug;
  const isleniyor =
    bizeAit || (sonuncu && !["bitti", "hata"].includes(sonuncu.asama ?? ""));

  // Yalnız iş varken yokla — boş panelde ağ trafiği olmasın.
  useEffect(() => {
    if (!isleniyor) {
      if (zamanlayici.current) clearInterval(zamanlayici.current);
      zamanlayici.current = null;
      return;
    }
    zamanlayici.current = setInterval(() => void oku(), 3000);
    return () => {
      if (zamanlayici.current) clearInterval(zamanlayici.current);
    };
  }, [isleniyor, oku]);

  const cagir = async (govde: Record<string, unknown>) => {
    setBekleniyor(true);
    setMesaj("");
    try {
      const r = await fetch("/api/arama-kaydi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
      const d = await r.json();
      if (!d.ok) setMesaj(d.error ?? "olmadı");
      await oku();
    } catch {
      setMesaj("istek gitmedi");
    } finally {
      setBekleniyor(false);
    }
  };

  const analiz = sonuncu?.analiz;

  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-2">
        {bizeAit ? (
          <button
            onClick={() => cagir({ action: "dur" })}
            disabled={bekleniyor}
            className="flex items-center gap-1.5 rounded-xl bg-rose-400/20 px-3 py-1.5 text-xs font-medium text-rose-100 transition-colors hover:bg-rose-400/30 disabled:opacity-50"
          >
            <Square className="size-3.5" /> Kaydı bitir
          </button>
        ) : (
          <button
            onClick={() => cagir({ action: "basla", slug, ad })}
            disabled={bekleniyor || !!aktif?.kimlik}
            title={aktif?.kimlik ? "başka bir kayıt sürüyor" : "telefonu hoparlöre al, sonra bas"}
            className="flex items-center gap-1.5 rounded-xl bg-white/[0.07] px-3 py-1.5 text-xs text-white/90 transition-colors hover:bg-white/[0.14] disabled:opacity-40"
          >
            <Mic className="size-3.5" /> Görüşmeyi kaydet
          </button>
        )}

        {isleniyor && (
          <span className="flex items-center gap-1.5 text-[11px] text-amber-200">
            <Loader2 className="size-3 animate-spin" />
            {ASAMA_METNI[bizeAit ? "kaydediyor" : (sonuncu?.asama ?? "")] ?? sonuncu?.asama}
          </span>
        )}
        {!isleniyor && sonuncu && (
          <span className="text-[11px] text-white/50">
            son kayıt: {sonuncu.sure_sn ?? "?"} sn
            {typeof analiz?.puan === "number" && ` · iskelet uyumu ${analiz.puan}/10`}
          </span>
        )}
        <span className="ml-auto text-[10px] text-white/35">
          telefonu hoparlöre al · kayıt bu bilgisayarda kalır
        </span>
      </div>

      {mesaj && <p className="mt-2 text-[11px] text-rose-200">{mesaj}</p>}
      {sonuncu?.uyari && <p className="mt-2 text-[11px] text-amber-200">⚠ {sonuncu.uyari}</p>}
      {sonuncu?.hata && <p className="mt-2 text-[11px] text-rose-200">⚠ {sonuncu.hata}</p>}

      {analiz && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-white/90">{analiz.ozet}</p>

          {analiz.olcutler && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(analiz.olcutler).map(([k, v]) => (
                <span
                  key={k}
                  className={`rounded-lg px-2 py-0.5 text-[10px] ${
                    v === "evet"
                      ? "bg-emerald-400/15 text-emerald-200"
                      : v === "hayir"
                        ? "bg-rose-400/15 text-rose-200"
                        : "bg-white/[0.06] text-white/50"
                  }`}
                >
                  {OLCUT_ADI[k] ?? k}: {v}
                </span>
              ))}
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-white/70">
            <b>
              {analiz.sorun_kimde === "ben"
                ? "Sorun bendeydi"
                : analiz.sorun_kimde === "karsi"
                  ? "Sorun karşı taraftaydı"
                  : "Kimsede sorun yok"}
              :
            </b>{" "}
            {analiz.sorun_gerekcesi}
            {analiz.en_kritik_an?.ne_oldu && (
              <>
                <br />
                <span className="text-white/50">
                  Kritik an ({Math.round(analiz.en_kritik_an.saniye ?? 0)}. sn):{" "}
                  {analiz.en_kritik_an.ne_oldu}
                </span>
              </>
            )}
            {analiz.itiraz && (
              <>
                <br />
                <span className="text-amber-200">İtiraz: {analiz.itiraz}</span>
              </>
            )}
          </p>

          {!!analiz.sonraki_sefer?.length && (
            <ul className="space-y-0.5 text-[11px] text-white/75">
              {analiz.sonraki_sefer.map((m) => (
                <li key={m} className="flex gap-1.5">
                  <span className="text-violet-300">→</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!!sonuncu?.parcalar?.length && (
        <details className="mt-2">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] text-white/60">
            <ChevronDown className="size-3.5" />
            Görüşme dökümü ({sonuncu.parcalar.length} parça)
            {typeof sonuncu.konusan_guven?.guven === "number" && (
              <span className="text-white/40">
                · ayrım güveni %{Math.round((sonuncu.konusan_guven.guven ?? 0) * 100)}
              </span>
            )}
          </summary>
          <div className="mt-1.5 max-h-64 space-y-1 overflow-y-auto pr-1">
            {sonuncu.parcalar.map((p, i) => (
              <p key={i} className="text-[11px] leading-relaxed">
                <span className="tabular-nums text-white/30">
                  {Math.floor(p.baslangic / 60)}:{String(Math.floor(p.baslangic % 60)).padStart(2, "0")}
                </span>{" "}
                <b className={p.konusan === "ben" ? "text-violet-200" : "text-cyan-200"}>
                  {p.konusan === "ben" ? "BEN" : "KARŞI"}
                </b>{" "}
                <span className="text-white/75">{p.metin}</span>
              </p>
            ))}
          </div>
          <button
            onClick={() => cagir({ action: "ters", kimlik: sonuncu.kimlik })}
            className="mt-1.5 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] text-white/60 hover:bg-white/[0.12] hover:text-white"
          >
            ↔ Etiketler ters çıktı, çevir
          </button>
        </details>
      )}
    </div>
  );
}
