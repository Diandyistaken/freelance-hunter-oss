"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Copy,
  Gift,
  Lightbulb,
  Loader2,
  Phone,
  PhoneMissed,
  RefreshCw,
  Smartphone,
  StickyNote,
  Target,
  Undo2,
} from "lucide-react";
import AramaKaydi from "@/components/AramaKaydi";
import BotStatus from "@/components/BotStatus";
import FiyatKarti, { type FiyatBilgisi } from "@/components/FiyatKarti";
import type { RadarHit } from "@/components/RadarPanel";
import { useKayitOdagi } from "@/hooks/useKayitOdagi";
import { useRadarDurum, type RadarDurum } from "@/hooks/useRadarDurum";
import { DURUM_ETIKETI } from "@/lib/durumEtiketi";
import { slugla } from "@/lib/slug";
import { zamanOku, zamaniGeldiMi } from "@/lib/tekrarSaati";
import { telefonBicimle } from "@/lib/telefon";

// MapLibre window'a ihtiyaç duyar — SSR kapalı yüklenir.
const RadarMap = dynamic(() => import("@/components/RadarMap"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.04] xl:h-full" />
  ),
});

// ARAMA LİSTESİ (10 Eyl 2026 düzeni)
// Solda hedef kartları, sağda SABİT harita + fiyat rehberi — geniş ekranda
// sağ/sol boş kalmasın, aranan yer haritada nerede görünsün.
// İşaretlenen kayıt LİSTEDEN KAYBOLMAZ: durum sekmeleri (Randevu / Düşünüyor /
// Olmaz / Arandı) ayrı ayrı durur, işaretlediğin kart o an ekranda kalır.

interface HavuzBilgi {
  olusturuldu: string;
  bolgeler: string[];
  istatistik: Record<string, unknown>;
}

interface Fikir {
  kod: string;
  ad: string;
  soru: string;
  aci: string;
  yapar: string;
  para: string;
  kurulum: string;
  aylik: string;
  zorluk: number;
  demo: boolean;
}

interface Konusma {
  acilis: string;
  soru?: string;
  soru2?: string;
  sus?: string;
  dinle?: { cevap: string; ne_yap: string }[];
  sebep?: string;
  somut?: string;
  randevu: string;
  itirazlar?: { itiraz: string; cevap: string }[];
  yan_not?: string;
}

interface Hedef {
  slug?: string;
  ad: string;
  sektor: string | null;
  grup: string;
  bolge: string | null;
  telefon: string;
  telefon_turu?: string;
  eposta: string;
  adres: string;
  domain: string;
  site?: string;
  lat?: number | null;
  lon?: number | null;
  arama_skoru: number;
  urun: string;
  fikirler?: Fikir[];
  demo?: string;
  demo_hazir?: boolean;
  yan_not?: string;
  konusma: Konusma;
}

const DURUM_BUTONLARI: { kod: RadarDurum; etiket: string; sinif: string }[] = [
  { kod: "randevu", etiket: "📅 Randevu aldım", sinif: "bg-violet-400/15 text-violet-200 hover:bg-violet-400/25" },
  { kod: "dusunuyor", etiket: "🤔 Düşünüyor", sinif: "bg-amber-400/15 text-amber-200 hover:bg-amber-400/25" },
  { kod: "arandi", etiket: "✅ Aradım", sinif: "bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25" },
  { kod: "ulasilamadi", etiket: "☎ Açmadı", sinif: "bg-slate-400/15 text-slate-200 hover:bg-slate-400/25" },
  { kod: "olmaz", etiket: "🙅 Olmaz dedi", sinif: "bg-orange-400/15 text-orange-200 hover:bg-orange-400/25" },
  { kod: "gizli", etiket: "❌ Atla", sinif: "bg-white/[0.06] text-white/70 hover:bg-white/[0.12]" },
];

// Sekmeler: kullanıcı kararı (10 Eyl) — "onay verilenler ayrı, reddedilenler
// ayrı, düşünenler ayrı sekmede olsun; işaretleyince kaybolmasın".
const SEKMELER = [
  { kod: "sirada", etiket: "Sırada", durumlar: [] as RadarDurum[] },
  { kod: "tekrar", etiket: "☎ Tekrar ara", durumlar: ["ulasilamadi"] as RadarDurum[] },
  { kod: "randevu", etiket: "📅 Randevu", durumlar: ["randevu", "musteri"] as RadarDurum[] },
  { kod: "dusunuyor", etiket: "🤔 Düşünüyor", durumlar: ["dusunuyor"] as RadarDurum[] },
  { kod: "olmaz", etiket: "🙅 Olmaz", durumlar: ["olmaz", "gizli", "kapandi"] as RadarDurum[] },
  { kod: "arandi", etiket: "✅ Arandı", durumlar: ["arandi"] as RadarDurum[] },
  { kod: "hepsi", etiket: "Hepsi", durumlar: [] as RadarDurum[] },
] as const;

type SekmeKodu = (typeof SEKMELER)[number]["kod"];

// 11 Eyl 2026: sıra değişti — kanca sorusu sebepten ÖNCE geldi. Ürün ancak
// karşı tarafın cevabı duyulduktan sonra (4. ve 5. adımda) anlatılıyor.
const ADIMLAR: { alan: keyof Konusma; no: number; baslik: string }[] = [
  { alan: "acilis", no: 1, baslik: "Açılış · 0-10 sn" },
  { alan: "soru", no: 2, baslik: "Kanca sorusu · 10-25 sn" },
  { alan: "sus", no: 3, baslik: "SUS → dinle → etiketle · 25-45 sn" },
  { alan: "sebep", no: 4, baslik: "Sebep — neden aradım · 45-60 sn" },
  { alan: "somut", no: 5, baslik: "Somut değer · 60-75 sn" },
  { alan: "randevu", no: 6, baslik: "Randevu iste · 75-90 sn" },
];

function Kopyala({ metin }: { metin: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(metin).then(
          () => {
            setOk(true);
            setTimeout(() => setOk(false), 1500);
          },
          () => {},
        );
      }}
      title="kopyala"
      className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-white/[0.08] hover:text-white"
    >
      {ok ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function Adim({ no, baslik, metin, vurgu }: { no: number; baslik: string; metin: string; vurgu?: boolean }) {
  if (!metin) return null;
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border p-3 ${
        vurgu ? "border-rose-400/25 bg-rose-400/[0.06]" : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-white/[0.08] text-[10px] font-semibold">
        {no}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{baslik}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-white/90">{metin}</p>
      </div>
      <Kopyala metin={metin} />
    </div>
  );
}

export default function AramaListesiPage() {
  const { durumlar, isaretle, geriAl, yenile } = useRadarDurum();
  const [hedefler, setHedefler] = useState<Hedef[]>([]);
  const [uretildi, setUretildi] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [uretiliyor, setUretiliyor] = useState(false);
  const [havuz, setHavuz] = useState<HavuzBilgi | null>(null);
  const [havuzKuruluyor, setHavuzKuruluyor] = useState(false);
  const [hata, setHata] = useState("");
  const [sekme, setSekme] = useState<SekmeKodu>("sirada");
  const [taslak, setTaslak] = useState<Record<string, string>>({});
  const [secilen, setSecilen] = useState<string | null>(null);
  // Bu sekmede az önce işaretlenenler: durumu değişse de kart ekranda kalsın
  // ("yeşil tik atınca kayboluyor" şikâyeti, 10 Eyl).
  const [tazeIsaretli, setTazeIsaretli] = useState<Set<string>>(new Set());
  const kartlar = useRef<Record<string, HTMLElement | null>>({});

  const listeyiOku = useCallback(
    () =>
      fetch("/api/arama-listesi")
        .then((r) => r.json())
        .then((d) => {
          setHedefler(d.hedefler ?? []);
          setUretildi(d.uretildi ?? null);
          setHavuz(d.havuz ?? null);
        })
        .catch(() => setHata("liste okunamadı"))
        .finally(() => setYukleniyor(false)),
    [],
  );

  useEffect(() => {
    void listeyiOku();
  }, [listeyiOku]);

  const uret = async (adet: number) => {
    setUretiliyor(true);
    setHata("");
    try {
      const r = await fetch("/api/arama-listesi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adet }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error ?? "üretilemedi");
      setTazeIsaretli(new Set());
      await listeyiOku();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "üretilemedi");
    } finally {
      setUretiliyor(false);
    }
  };

  const havuzKur = async () => {
    setHavuzKuruluyor(true);
    setHata("");
    try {
      const r = await fetch("/api/arama-listesi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "havuz" }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error ?? "havuz kurulamadı");
      await listeyiOku();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "havuz kurulamadı");
    } finally {
      setHavuzKuruluyor(false);
    }
  };

  const notuKaydet = async (h: Hedef, metin: string) => {
    const slug = h.slug ?? slugla(h.ad);
    const mevcut = durumlar[slug];
    await fetch("/api/radar/durum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        ad: h.ad,
        tur: h.sektor ?? undefined,
        telefon: h.telefon,
        durum: mevcut?.durum ?? "arandi",
        not: metin,
      }),
    }).catch(() => {});
    yenile();
  };

  const isaretleVeKal = (h: Hedef, kod: RadarDurum) => {
    const slug = h.slug ?? slugla(h.ad);
    isaretle(slug, h.ad, kod, {
      tur: h.sektor ?? undefined,
      telefon: h.telefon,
      // Her "Açmadı" tıklaması AYRI bir denemedir; sayacı bu artırır.
      yeniDeneme: kod === "ulasilamadi",
    });
    setTazeIsaretli((s) => new Set(s).add(slug));
  };

  const sayilar = useMemo(() => {
    let sirada = 0;
    let randevu = 0;
    let dusunuyor = 0;
    let olmaz = 0;
    let arandi = 0;
    let tekrar = 0;
    let denemeToplam = 0;
    for (const h of hedefler) {
      const kayit = durumlar[h.slug ?? slugla(h.ad)];
      const d = kayit?.durum;
      denemeToplam += kayit?.deneme ?? 0;
      if (!d) sirada += 1;
      else if (d === "ulasilamadi") {
        tekrar += 1;
        // Saati gelmiş tekrar aramalar "Sırada" sayılır — bugünün işi odur.
        if (zamaniGeldiMi(kayit?.tekrar_saat ?? null)) sirada += 1;
      } else if (d === "randevu" || d === "musteri") randevu += 1;
      else if (d === "dusunuyor") dusunuyor += 1;
      else if (d === "arandi") arandi += 1;
      else olmaz += 1;
    }
    return {
      sirada,
      randevu,
      dusunuyor,
      olmaz,
      arandi,
      tekrar,
      // Ölçüm "kaç arama yaptım"dır; açılmayanlar da aramadır.
      cevirme: denemeToplam + randevu + dusunuyor + olmaz + arandi,
      toplam: hedefler.length,
      islenmis: hedefler.length - sirada,
    };
  }, [hedefler, durumlar]);

  const gorunen = useMemo(() => {
    if (sekme === "hepsi") return hedefler;
    const tanim = SEKMELER.find((s) => s.kod === sekme);
    const suzulen = hedefler.filter((h) => {
      const slug = h.slug ?? slugla(h.ad);
      const d = durumlar[slug]?.durum;
      if (sekme === "sirada") {
        if (!d || tazeIsaretli.has(slug)) return true;
        // Saati gelen tekrar aramalar kuyruğa geri döner.
        return d === "ulasilamadi" && zamaniGeldiMi(durumlar[slug]?.tekrar_saat ?? null);
      }
      return !!d && (tanim?.durumlar as string[]).includes(d);
    });
    // Tekrar kuyruğunda sıra saate göredir: saati gelen üstte.
    if (sekme !== "tekrar") return suzulen;
    return [...suzulen].sort((a, b) => {
      const sa = durumlar[a.slug ?? slugla(a.ad)]?.tekrar_saat ?? "";
      const sb = durumlar[b.slug ?? slugla(b.ad)]?.tekrar_saat ?? "";
      return sa.localeCompare(sb);
    });
  }, [hedefler, durumlar, sekme, tazeIsaretli]);

  // Harita, listedeki hedeflerin AYNISINI gösterir (radar avlarını değil).
  const haritaNoktalari: RadarHit[] = useMemo(
    () =>
      hedefler
        .filter((h) => typeof h.lat === "number" && typeof h.lon === "number")
        .map((h) => {
          const demoFikri = h.fikirler?.find((f) => f.kod === h.demo) ?? h.fikirler?.[0];
          return {
            name: h.ad,
            kind_tr: h.sektor ?? "",
            issue: demoFikri ? `${demoFikri.ad} — ${demoFikri.soru}` : h.urun,
            // Nokta boyu için 60-100 bandına indir (arama skoru ~100-170).
            score: Math.max(60, Math.min(100, Math.round(h.arama_skoru * 0.6))),
            lat: h.lat as number,
            lon: h.lon as number,
            phone: h.telefon,
            street: h.adres,
            website: h.site || h.domain,
            bolge: h.bolge ?? undefined,
          };
        }),
    [hedefler],
  );

  // Harita hedeflerin ortasına baksın (varsayılan Maltepe merkezi değil).
  const haritaMerkezi = useMemo<[number, number] | null>(() => {
    if (!haritaNoktalari.length) return null;
    const lat = haritaNoktalari.reduce((t, n) => t + n.lat, 0) / haritaNoktalari.length;
    const lon = haritaNoktalari.reduce((t, n) => t + n.lon, 0) / haritaNoktalari.length;
    return [lat, lon];
  }, [haritaNoktalari]);

  const seciliHedef = useMemo(
    () => hedefler.find((h) => (h.slug ?? slugla(h.ad)) === secilen) ?? null,
    [hedefler, secilen],
  );

  const seciliFiyat: FiyatBilgisi | null = useMemo(() => {
    if (!seciliHedef) return null;
    const f = seciliHedef.fikirler?.find((x) => x.kod === seciliHedef.demo) ?? seciliHedef.fikirler?.[0];
    return f ? { urun: f.ad, kurulum: f.kurulum, aylik: f.aylik, zorluk: f.zorluk } : null;
  }, [seciliHedef]);

  // BİR KARTA ODAKLAN — haritadan seçince de, "Kim aradı?"dan gelince de.
  //
  // BAŞA HİZALANIR, ORTAYA DEĞİL: arama kartı altı konuşma adımıyla ekrandan
  // uzun. "center" kartın ortasını ekranın ortasına koyuyordu ve ölçüldü —
  // başlık ekranın 359 px yukarısında kalıyordu. Karta gelme sebebi olan
  // kısım (ad, telefon, durum düğmeleri) tam da görünmeyen yerdi.
  //
  // Eskiden haritadaki seçim kartın ref'ine doğrudan kaydırıyordu; kart o an
  // açık olmayan bir sekmedeyse (ör. "Randevu" sekmesindeyken "Sırada"daki
  // bir iğne) kart çizili değildi, ref boştu ve kaydırma SESSİZCE hiçbir şey
  // yapmıyordu. Artık kart çiziliyse hemen kaydırılır; değilse sekme
  // "Hepsi"ye alınır ve kaydırma kart DOM'a girdikten sonraki çizimde yapılır.
  const bekleyenOdak = useRef<string | null>(null);
  const kayitaOdaklan = useCallback((slug: string) => {
    setSecilen(slug);
    const kart = kartlar.current[slug];
    if (kart?.isConnected) {
      kart.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    bekleyenOdak.current = slug;
    setSekme("hepsi");
  }, []);
  useEffect(() => {
    const slug = bekleyenOdak.current;
    if (!slug) return;
    const kart = kartlar.current[slug];
    if (!kart) return;
    bekleyenOdak.current = null;
    kart.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sekme, secilen]);
  useKayitOdagi(!yukleniyor, kayitaOdaklan);

  return (
    <>
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Phone className="size-5 text-violet-300" />
            📞 Arama Listesi
          </h1>
          <p className="text-xs text-[var(--muted)]">
            İşletme türüne özel <b>yazılım fikri</b> kancası · cep numarası öncelikli ·
            kurumsal/çağrı merkezi elenmiş. Amaç satış değil, <b>10 dakikalık yüz yüze randevu</b>.
          </p>
        </div>
        {/* Telefonda tek satıra sığmıyordu, "Listeyi yenile" ekrandan taşıyordu. */}
        <div className="flex flex-wrap items-center gap-2">
          <BotStatus />
          <button
            onClick={havuzKur}
            disabled={havuzKuruluyor || uretiliyor}
            title="Overture'dan işletmeleri çeker, aranamayacakları eler. Ayda bir ya da bölge değişince."
            className="flex items-center gap-1.5 rounded-xl bg-sky-400/15 px-3 py-2 text-xs text-sky-100 transition-colors hover:bg-sky-400/25 disabled:opacity-50"
          >
            {havuzKuruluyor ? <Loader2 className="size-3.5 animate-spin" /> : <span>🏊</span>}
            {havuzKuruluyor ? "Havuz kuruluyor…" : havuz ? "Havuzu yenile" : "Havuzu kur"}
          </button>
          <button
            onClick={() => uret(20)}
            disabled={uretiliyor || havuzKuruluyor}
            className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-white/90 transition-colors hover:bg-white/[0.12] disabled:opacity-50"
          >
            {uretiliyor ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {hedefler.length ? "Listeyi yenile" : "Listeyi üret"}
          </button>
        </div>
      </header>

      <details className="glass rounded-2xl px-5 py-3 text-xs">
        <summary className="cursor-pointer text-[var(--muted)]">
          Bu iki düğme ne yapar, ne zaman basılır?
          {havuz && (
            <span className="ml-2 text-white/50">
              havuz: {String(havuz.istatistik?.aranabilir ?? "?")} işletme ·{" "}
              {havuz.olusturuldu.replace("T", " ").slice(0, 16)}
            </span>
          )}
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-semibold text-sky-200">🏊 Havuzu kur — ayda bir / bölge değişince</p>
            <p className="text-[var(--muted)]">
              Overture haritasından bölgedeki tüm işletmeleri çeker (sitesi olmayanlar dahil);
              0850/444 çağrı merkezlerini, zincirleri, A.Ş./holding gibi kurumsalları ve spam
              ilanları eler. Önbellek varsa saniyeler, yeni bölge varsa ~4 dakika.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-white/90">🔄 Listeyi yenile — her arama günü</p>
            <p className="text-[var(--muted)]">
              Havuzdan 20 taze hedef seçer: cep numaralılar önce, aynı türden en fazla 3, eve yakın
              olan üstte. İşaretlediklerini atlar, ağa çıkmaz.
              {uretildi && ` Son liste: ${uretildi.replace("T", " ").slice(0, 16)}.`}
            </p>
          </div>
        </div>
      </details>

      {hata && <p className="rounded-2xl bg-red-400/10 px-4 py-3 text-xs text-red-200">{hata}</p>}

      {/* Solda liste, sağda sabit harita + fiyat rehberi */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="glass flex flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2 text-xs">
            {SEKMELER.map((s) => {
              const adet =
                s.kod === "hepsi" ? sayilar.toplam : (sayilar as Record<string, number>)[s.kod] ?? 0;
              return (
                <button
                  key={s.kod}
                  onClick={() => {
                    setSekme(s.kod);
                    setTazeIsaretli(new Set());
                  }}
                  className={`rounded-lg px-2.5 py-1.5 transition-colors ${
                    sekme === s.kod ? "bg-white/[0.14] text-white" : "text-[var(--muted)] hover:bg-white/[0.06]"
                  }`}
                >
                  {s.etiket} <span className="tabular-nums opacity-70">{adet}</span>
                </button>
              );
            })}
          </div>

          {yukleniyor ? (
            <p className="glass rounded-2xl p-6 text-center text-sm text-[var(--muted)]">Yükleniyor…</p>
          ) : hedefler.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-[var(--muted)]">
              <Target className="mx-auto mb-2 size-6 text-violet-300" />
              Liste henüz üretilmedi. Havuz kuruluysa <b>Listeyi üret</b>&apos;e bas; havuz yoksa önce{" "}
              <b>Havuzu kur</b>.
            </div>
          ) : gorunen.length === 0 ? (
            <p className="glass rounded-2xl p-6 text-center text-sm text-[var(--muted)]">
              Bu sekmede kayıt yok.
            </p>
          ) : (
            gorunen.map((h) => {
              const slug = h.slug ?? slugla(h.ad);
              const kayit = durumlar[slug];
              const sira = hedefler.indexOf(h) + 1;
              const notDegeri = taslak[slug] ?? kayit?.not_metni ?? "";
              const fikirler = h.fikirler ?? [];
              const demoFikri = fikirler.find((f) => f.kod === h.demo) ?? fikirler[0];
              const cepte = h.telefon_turu === "cep";
              const itirazlar = h.konusma.itirazlar ?? [];
              const seciliMi = secilen === slug;

              return (
                <motion.article
                  key={slug}
                  ref={(el) => {
                    kartlar.current[slug] = el;
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => setSecilen(slug)}
                  className={`glass scroll-mt-4 rounded-2xl p-5 transition-shadow ${
                    seciliMi ? "ring-1 ring-violet-400/50" : ""
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                        <span className="text-[var(--muted)]">{sira}.</span>
                        {h.ad}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            cepte ? "bg-emerald-400/15 text-emerald-200" : "bg-white/[0.08] text-white/60"
                          }`}
                        >
                          {cepte ? "📱 cep — sahibi açar" : "☎ sabit — resepsiyon olabilir"}
                        </span>
                        {h.demo_hazir ? (
                          <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] text-cyan-200">
                            demo hazır
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200">
                            demo yok — &quot;kuruyorum&quot; de
                          </span>
                        )}
                        {kayit && (
                          <span className="rounded-full bg-white/[0.1] px-2 py-0.5 text-[10px] text-white/80">
                            {DURUM_ETIKETI[kayit.durum] ?? kayit.durum}
                          </span>
                        )}
                      </h2>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {h.sektor} · {h.bolge} · skor {h.arama_skoru}
                        {h.domain ? ` · ${h.domain}` : " · sitesi yok"}
                        {h.adres && ` · ${h.adres}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${h.telefon}`}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-400/15 px-3 py-2 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25"
                      >
                        {cepte ? <Smartphone className="size-3.5" /> : <Phone className="size-3.5" />}
                        {telefonBicimle(h.telefon)}
                      </a>
                      <Kopyala metin={h.telefon} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {ADIMLAR.map((a) => (
                      <div key={a.no}>
                        <Adim
                          no={a.no}
                          baslik={a.baslik}
                          metin={(h.konusma[a.alan] as string) ?? ""}
                          vurgu={a.alan === "sus"}
                        />
                        {a.alan === "soru" && h.konusma.soru2 && (
                          <p className="mt-1 pl-9 text-[11px] text-[var(--muted)]">
                            Yedek soru (ilk soru havada kalırsa):{" "}
                            <span className="text-white/70">{h.konusma.soru2}</span>
                          </p>
                        )}
                        {a.alan === "sus" && !!h.konusma.dinle?.length && (
                          <ul className="mt-1 space-y-1 pl-9 text-[11px] leading-relaxed">
                            {h.konusma.dinle.map((d) => (
                              <li key={d.cevap}>
                                <span className="text-rose-200">{d.cevap}</span>{" "}
                                <span className="text-white/70">→ {d.ne_yap}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>

                  {demoFikri && (
                    <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200">
                        <Lightbulb className="size-3.5" />
                        Bu aramanın ürünü: {demoFikri.ad}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/70">
                        {demoFikri.yapar} · <span className="text-white/50">{demoFikri.para}</span>
                        <br />
                        Fiyat sorulursa: kurulum {demoFikri.kurulum} ₺ · aylık {demoFikri.aylik} ₺{" "}
                        <span className="text-white/40">(bant söylenir, kesin rakam görüşmede)</span>
                      </p>
                    </div>
                  )}

                  {fikirler.length > 1 && (
                    <details className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                      <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-[11px] text-white/70">
                        <ChevronDown className="size-3.5" />
                        Bu türe satılabilecek {fikirler.length} fikir (ikinci görüşme için)
                      </summary>
                      <div className="overflow-x-auto px-3 pb-3">
                        <table className="w-full min-w-[32rem] text-left text-[11px]">
                          <thead className="text-[var(--muted)]">
                            <tr>
                              <th className="py-1 pr-2 font-normal">Fikir</th>
                              <th className="py-1 pr-2 font-normal">Kanca sorusu</th>
                              <th className="whitespace-nowrap py-1 pr-2 font-normal">₺ kurulum / ay</th>
                              <th className="py-1 font-normal">Zorluk</th>
                            </tr>
                          </thead>
                          <tbody className="text-white/75">
                            {fikirler.map((f) => (
                              <tr key={f.kod} className="border-t border-white/[0.05]">
                                <td className="py-1.5 pr-2 align-top">
                                  {f.kod === h.demo && <span className="text-cyan-300">★ </span>}
                                  {f.ad}
                                </td>
                                <td className="py-1.5 pr-2 align-top text-white/60">{f.soru}</td>
                                <td className="whitespace-nowrap py-1.5 pr-2 align-top">
                                  {f.kurulum} / {f.aylik}
                                </td>
                                <td className="py-1.5 align-top">{"⚙️".repeat(f.zorluk)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}

                  {itirazlar.length > 0 && (
                    <details className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                      <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-[11px] text-white/70">
                        <ChevronDown className="size-3.5" />
                        İtiraz gelirse ne diyeceğim ({itirazlar.length})
                      </summary>
                      <ul className="space-y-1.5 px-3 pb-3 text-[11px]">
                        {itirazlar.map((it) => (
                          <li key={it.itiraz} className="leading-relaxed">
                            <span className="text-amber-200">&quot;{it.itiraz}&quot;</span>{" "}
                            <span className="text-white/70">→ {it.cevap}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {h.yan_not && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-white/70">
                      <Gift className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />
                      <span>
                        Görüşme iyi giderse, kapatmadan önce <b>ücretsiz gözlem</b> (satma,
                        sadece söyle): &quot;Bu arada bakarken gördüm: {h.yan_not}. İsterseniz
                        ekran görüntüsünü atayım.&quot; — aramadan önce kendin bir kez bak.
                      </span>
                    </p>
                  )}

                  {kayit?.durum === "ulasilamadi" && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-slate-400/20 bg-slate-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-slate-100">
                      <PhoneMissed className="mt-0.5 size-3.5 shrink-0 text-slate-300" />
                      <span>
                        <b>{kayit.deneme ?? 1}. deneme</b> açılmadı.
                        {kayit.tekrar_saat && (
                          <>
                            {" "}Sıradaki deneme: <b>{zamanOku(kayit.tekrar_saat)}</b> —
                            farklı bir saat dilimi, aynı saatte tekrar aramanın anlamı yok.
                          </>
                        )}
                        {(kayit.deneme ?? 1) >= 4 && (
                          <>
                            {" "}4 deneme oldu; listeyi yenileyince bu numara artık gelmeyecek.
                          </>
                        )}
                      </span>
                    </p>
                  )}

                  <AramaKaydi slug={slug} ad={h.ad} />

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {DURUM_BUTONLARI.map((d) => (
                      <button
                        key={d.kod}
                        onClick={() => isaretleVeKal(h, d.kod)}
                        className={`rounded-xl px-3 py-1.5 text-xs transition-colors ${d.sinif} ${
                          kayit?.durum === d.kod ? "ring-1 ring-white/40" : ""
                        }`}
                      >
                        {d.etiket}
                      </button>
                    ))}
                    {kayit && (
                      <button
                        onClick={() => geriAl(slug)}
                        className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-[var(--muted)] transition-colors hover:bg-white/[0.08] hover:text-white"
                      >
                        <Undo2 className="size-3.5" /> geri al
                      </button>
                    )}
                  </div>

                  {kayit && sekme === "sirada" && (
                    <p className="mt-2 rounded-lg bg-emerald-400/[0.08] px-3 py-1.5 text-[11px] text-emerald-100">
                      Kaydedildi — <b>{DURUM_ETIKETI[kayit.durum] ?? kayit.durum}</b> sekmesinde
                      duruyor. Kayıt silinmez, sekme değiştirince buradan çıkar.
                    </p>
                  )}

                  <div className="mt-3">
                    <p className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      Gelen itiraz (tıkla, nota geçsin) — hangisi kaç kez geldi, kancayı bu belirler
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...itirazlar.map((i) => i.itiraz), "resepsiyon geçmedi"].map((it) => (
                        <button
                          key={it}
                          onClick={() => {
                            const metin = notDegeri ? `${notDegeri} · ${it}` : it;
                            setTaslak((t) => ({ ...t, [slug]: metin }));
                            void notuKaydet(h, metin);
                          }}
                          className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
                        >
                          {it}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <StickyNote className="size-3.5 shrink-0 text-[var(--muted)]" />
                      <input
                        value={notDegeri}
                        onChange={(e) => setTaslak((t) => ({ ...t, [slug]: e.target.value }))}
                        onBlur={() => {
                          const metin = taslak[slug];
                          if (metin !== undefined && metin !== (kayit?.not_metni ?? "")) {
                            void notuKaydet(h, metin);
                          }
                        }}
                        placeholder="ne dedi, kaç saniye sürdü, ne zaman tekrar aranacak…"
                        className="w-full rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-white/90 outline-none transition-colors placeholder:text-white/30 focus:bg-white/[0.07]"
                      />
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </div>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <RadarMap
            scanCenter={haritaMerkezi}
            liveHits={haritaNoktalari.length ? haritaNoktalari : null}
            durumlar={durumlar}
            isaretle={isaretle}
            secilenSlug={secilen}
            onSecim={kayitaOdaklan}
            rozetMetni={`📞 ${haritaNoktalari.length} hedef`}
            yukseklikClassName="h-64 xl:h-auto xl:min-h-0 xl:flex-1 mb-0"
          />

          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { etiket: "Sırada", deger: sayilar.sirada, renk: "text-sky-300" },
              { etiket: "Tekrar", deger: sayilar.tekrar, renk: "text-slate-300" },
              { etiket: "Randevu", deger: sayilar.randevu, renk: "text-violet-300" },
              { etiket: "Düşünen", deger: sayilar.dusunuyor, renk: "text-amber-300" },
              { etiket: "Arandı", deger: sayilar.arandi, renk: "text-emerald-300" },
            ].map((k) => (
              <div key={k.etiket} className="glass rounded-xl px-2 py-2">
                <p className="text-[10px] text-[var(--muted)]">{k.etiket}</p>
                <p className={`text-lg font-semibold tabular-nums ${k.renk}`}>{k.deger}</p>
              </div>
            ))}
          </div>

          <p className="glass rounded-xl border border-violet-400/20 px-3 py-2 text-[11px] leading-relaxed text-violet-100">
            {sayilar.cevirme >= 20 ? (
              <>
                🎯 <b>{sayilar.cevirme} çevirme</b> tamam — eşik <b>en az 2 randevu</b>, sende{" "}
                <b>{sayilar.randevu}</b> var. Altındaysa sorun soruda değil açılıştadır.
              </>
            ) : (
              <>
                🎯 Ölçüm eşiği <b>20 çevirme</b>: <b>{sayilar.cevirme}</b> oldu,{" "}
                <b>{20 - sayilar.cevirme}</b> kaldı. Açılmayan da bir çevirmedir — işaretle,
                yoksa ölçecek veri kalmıyor.
              </>
            )}
          </p>

          <FiyatKarti fiyat={seciliFiyat} />
        </aside>
      </div>
    </>
  );
}
