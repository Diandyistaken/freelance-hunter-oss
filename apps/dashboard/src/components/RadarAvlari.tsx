"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  Globe,
  Hammer,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  RadarIcon,
  Sparkles,
  Target,
  Undo2,
  X,
  XCircle,
} from "lucide-react";
import type { RadarHit } from "./RadarPanel";
import AramaKarti from "./AramaKarti";
import BolgeSecici from "./BolgeSecici";
import RadarKusurRaporu from "./RadarKusurRaporu";
import { slugla } from "@/lib/slug";
import { telefonBicimle } from "@/lib/telefon";
import type { RadarDurum, RadarDurumKaydi } from "@/hooks/useRadarDurum";

interface RadarIstatistik {
  aday_havuzu: number;
  denetlenen: number;
  bu_turda_yeni: number;
  sicak_lead: number;
  elenen: number;
  sure_sn: number;
  places_acik: boolean;
}

interface RadarData {
  scanned_at?: string;
  hits: RadarHit[];
  hatalar?: string[];
  surum?: number; // 2 = radar v2 (iyi giden işletme + kötü site)
  istatistik?: RadarIstatistik;
}

interface Sablon {
  id: string;
  ad: string;
  aciklama: string;
}

const SABLON_RENKLERI = [
  "#22d3ee",
  "#34d399",
  "#a78bfa",
  "#fb7185",
  "#fbbf24",
  "#60a5fa",
  "#f472b6",
  "#2dd4bf",
];

function sablonRengi(id: string) {
  const toplam = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return SABLON_RENKLERI[toplam % SABLON_RENKLERI.length];
}

// Şablon seçici / çoklu yayınla modallarının yanındaki canlı önizleme —
// hover ile değişen, o işletmeye özel gerçek demo sitesi (küçültülmüş iframe).
function SablonOnizlemePaneli({
  slug,
  aktifStil,
  stilAdi,
  durum,
}: {
  slug: string | null;
  aktifStil: string | null;
  stilAdi: (id: string) => string;
  durum: "yukleniyor" | "hazir" | "hata" | undefined;
}) {
  return (
    <div className="hidden w-[280px] shrink-0 flex-col gap-2 sm:flex">
      <p className="text-[11px] font-semibold text-white/50">
        Canlı önizleme{aktifStil ? ` — ${stilAdi(aktifStil)}` : ""}
      </p>
      <div className="relative h-[606px] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black/30">
        {durum !== "hazir" || !slug || !aktifStil ? (
          <div className="flex h-full items-center justify-center gap-2 px-4 text-center text-xs text-white/50">
            {durum === "hata" ? (
              "Önizleme üretilemedi."
            ) : (
              <>
                <Loader2 className="size-4 animate-spin" /> Tüm şablonlar hazırlanıyor…
              </>
            )}
          </div>
        ) : (
          // ÖNEMLİ: iframe'in width/height'i o sayfanın GERÇEK tarayıcı
          // penceresi gibi davranır (100svh/100vh bunlara göre hesaplanır) —
          // gerçekçi bir viewport vermezsek hero dev bir kutuya sıkışıp
          // fotoğraf çarpık/kırpık görünür. Telefon viewport'u (390×844)
          // kullanıyoruz: esnafa link genelde WhatsApp'tan telefonda açılıyor,
          // hem mobil görünüm doğru ölçekte hem de dikey panele daha çok sığıyor.
          <iframe
            key={`${slug}--${aktifStil}`}
            src={`/api/demo/${slug}--${aktifStil}`}
            title="Şablon önizlemesi"
            className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
            style={{ width: 390, height: 844, transform: "scale(0.7179)" }}
          />
        )}
      </div>
      {durum === "hazir" && slug && aktifStil && (
        <a
          href={`/api/demo/${slug}--${aktifStil}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-[11px] text-cyan-300 underline"
        >
          Yeni sekmede büyük aç
        </a>
      )}
    </div>
  );
}

// site_builder.VITRIN_5 ile birebir aynı varsayılan 5 stil — kullanıcı tik
// değiştirmezse /api/yayinla5 bu setle yayınlar.
const VARSAYILAN_5 = ["klasik", "vitrin", "neon", "aydinlik", "zarif"];

interface Varyant {
  stil: string;
  url: string;
  qr: string;
  qrMenu: string;
}

const DURUM_FILTRELERI = [
  { kod: "hepsi", etiket: "Hepsi", renk: "text-white", aciklama: "Tüm lead'ler" },
  { kod: "arandi", etiket: "✅ Arandı", renk: "text-emerald-300", aciklama: "Aradığın ve olumlu/nötr geçen kayıtlar" },
  { kod: "dusunuyor", etiket: "🤔 Düşünüyor", renk: "text-amber-300", aciklama: "Düşüneceğim diyenler — takip edilecek" },
  { kod: "olmaz", etiket: "🙅 Olmaz dedi", renk: "text-orange-300", aciklama: "Aradık, ilgilenmiyor dedi" },
  { kod: "randevu", etiket: "📅 Randevu", renk: "text-violet-300", aciklama: "Yüz yüze görüşme sözü alındı" },
  { kod: "musteri", etiket: "🎉 Müşteri", renk: "text-cyan-300", aciklama: "Anlaşıldı, iş alındı" },
  { kod: "gizli", etiket: "❌ Gizlendi", renk: "text-red-300", aciklama: "Listeden çıkarılanlar" },
  { kod: "kapandi", etiket: "🚫 Kapanmış", renk: "text-slate-400", aciklama: "Kalıcı kapanmış işletmeler" },
] as const;

interface Props {
  durumlar: Record<string, RadarDurumKaydi>;
  isaretle: (
    slug: string,
    ad: string,
    durum: RadarDurum,
    ekstra?: { tur?: string; telefon?: string },
  ) => void;
  geriAl: (slug: string) => void;
  // Haritada bir avın işaretçisine tıklanınca set edilir — aşağıdaki liste bu
  // avın satırına kayıp geçici olarak vurgular (bkz. RadarHaritaBuyuk).
  secilenSlug?: string | null;
  // Listeden bir satıra tıklanınca çağrılır — yukarıdaki harita o işletmenin
  // üzerine yakınlaşıp kalp atışı gibi nabız atan işaretçiyle kendini belli eder.
  onSecim?: (slug: string) => void;
}

// Radar avları + her av için tek tıkla: Demo Üret → Önizle → Yayınla.
// Numaralar Telegram /site listesiyle birebir aynıdır (puan sırası).
export default function RadarAvlari({ durumlar, isaretle, geriAl, secilenSlug, onSecim }: Props) {
  const [data, setData] = useState<RadarData | null>(null);
  const [demolar, setDemolar] = useState<Set<string>>(new Set());
  const [mesgul, setMesgul] = useState<Record<number, string>>({});
  const [canli, setCanli] = useState<Record<number, { url: string; qr: string; qrMenu: string }>>({});
  const [canli5, setCanli5] = useState<Record<number, Varyant[]>>({});
  const [hata, setHata] = useState("");
  const [taraniyor, setTaraniyor] = useState(false);
  const [sablonlar, setSablonlar] = useState<Sablon[] | null>(null);
  const [sablonSecilenAv, setSablonSecilenAv] = useState<number | null>(null);
  const [secimModu, setSecimModu] = useState<"demo" | "brief">("demo");
  const [brief, setBrief] = useState("");
  const [kopyalandi, setKopyalandi] = useState(false);
  const [tumunuGoster, setTumunuGoster] = useState(false);
  const [cokluYayinAv, setCokluYayinAv] = useState<number | null>(null);
  const [secilenStiller, setSecilenStiller] = useState<Set<string>>(new Set(VARSAYILAN_5));
  const satirRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Şablon seçici / çoklu yayınla modallarında hover ile canlı önizleme —
  // modal açılır açılmaz TÜM şablonlar arka planda üretilir (data/demo_sites/
  // <slug>--<stil>.html), hover sadece hangisinin gösterileceğini değiştirir.
  const [onizlemeDurum, setOnizlemeDurum] = useState<Record<number, "yukleniyor" | "hazir" | "hata">>({});
  const [aktifOnizlemeStil, setAktifOnizlemeStil] = useState<string | null>(null);
  const onizlemeIstekleri = useRef<Set<number>>(new Set());

  const onizlemeleriHazirla = useCallback((n: number) => {
    if (onizlemeIstekleri.current.has(n)) return;
    onizlemeIstekleri.current.add(n);
    setOnizlemeDurum((d) => ({ ...d, [n]: "yukleniyor" }));
    fetch("/api/onizleme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ n }),
    })
      .then((r) => r.json())
      .then((r) => setOnizlemeDurum((d) => ({ ...d, [n]: r.ok ? "hazir" : "hata" })))
      .catch(() => setOnizlemeDurum((d) => ({ ...d, [n]: "hata" })));
  }, []);

  // Haritadan bir av seçildiğinde: işaretliyse geçici olarak göster, satıra kaydır.
  useEffect(() => {
    if (!secilenSlug) return;
    if (durumlar[secilenSlug]) setTumunuGoster(true);
    const kayma = window.setTimeout(() => {
      satirRefs.current[secilenSlug]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => window.clearTimeout(kayma);
  }, [secilenSlug, durumlar]);

  const yukle = useCallback(() => {
    fetch("/api/radar")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ hits: [] }));
    fetch("/api/demos")
      .then((r) => r.json())
      .then((d) =>
        setDemolar(new Set((d.demos ?? []).map((x: { slug: string }) => x.slug))),
      )
      .catch(() => {});
  }, []);

  useEffect(yukle, [yukle]);

  const sablonlariGetir = useCallback(async () => {
    if (sablonlar !== null) return sablonlar;
    try {
      const sonuc = await fetch("/api/sablonlar").then((r) => r.json());
      const liste = Array.isArray(sonuc) ? (sonuc as Sablon[]) : [];
      setSablonlar(liste);
      return liste;
    } catch {
      setSablonlar([]);
      return [];
    }
  }, [sablonlar]);

  useEffect(() => {
    void sablonlariGetir();
  }, [sablonlariGetir]);

  useEffect(() => {
    const kapat = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (brief) setBrief("");
      else if (sablonSecilenAv !== null) setSablonSecilenAv(null);
      else if (cokluYayinAv !== null) setCokluYayinAv(null);
    };
    window.addEventListener("keydown", kapat);
    return () => window.removeEventListener("keydown", kapat);
  }, [brief, sablonSecilenAv, cokluYayinAv]);

  const stilAdi = (id: string) => sablonlar?.find((s) => s.id === id)?.ad ?? id;

  const demoUret = async (n: number, stil?: string) => {
    setSablonSecilenAv(null);
    setMesgul((m) => ({ ...m, [n]: "uret" }));
    setHata("");
    try {
      const r = await fetch("/api/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, ...(stil ? { stil } : {}) }),
      }).then((x) => x.json());
      if (r.ok) setDemolar((d) => new Set(d).add(r.slug));
      else setHata(r.error ?? "üretilemedi");
    } finally {
      setMesgul((m) => ({ ...m, [n]: "" }));
    }
  };

  const sablonSeciminiAc = async (n: number, mod: "demo" | "brief") => {
    const liste = await sablonlariGetir();
    if (liste.length === 0) {
      if (mod === "demo") void demoUret(n);
      else setHata("Brief için şablon listesi yüklenemedi.");
      return;
    }
    setSecimModu(mod);
    setSablonSecilenAv(n);
    setAktifOnizlemeStil(liste[0]?.id ?? null);
    onizlemeleriHazirla(n);
  };

  const briefUret = async (n: number, stil: string) => {
    setSablonSecilenAv(null);
    setMesgul((m) => ({ ...m, [n]: "brief" }));
    setHata("");
    try {
      const r = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, stil }),
      }).then((x) => x.json());
      if (r.ok) {
        setKopyalandi(false);
        setBrief(r.brief);
      } else setHata(r.error ?? "brief üretilemedi");
    } finally {
      setMesgul((m) => ({ ...m, [n]: "" }));
    }
  };

  const panoyaKopyala = async () => {
    try {
      await navigator.clipboard.writeText(brief);
      setKopyalandi(true);
      window.setTimeout(() => setKopyalandi(false), 2000);
    } catch {
      setHata("Brief panoya kopyalanamadı.");
    }
  };

  const yayinla = async (n: number) => {
    setMesgul((m) => ({ ...m, [n]: "yayin" }));
    setHata("");
    try {
      const r = await fetch("/api/yayinla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n }),
      }).then((x) => x.json());
      if (r.ok) setCanli((c) => ({ ...c, [n]: { url: r.url, qr: r.qr, qrMenu: r.qrMenu } }));
      else setHata(r.error ?? "yayınlanamadı");
    } finally {
      setMesgul((m) => ({ ...m, [n]: "" }));
    }
  };

  const cokluYayiniAc = async (n: number) => {
    const liste = await sablonlariGetir();
    if (liste.length === 0) {
      setHata("Şablon listesi yüklenemedi.");
      return;
    }
    setSecilenStiller(new Set(VARSAYILAN_5.filter((s) => liste.some((l) => l.id === s))));
    setCokluYayinAv(n);
    setAktifOnizlemeStil(liste[0]?.id ?? null);
    onizlemeleriHazirla(n);
  };

  const stilTikle = (id: string) => {
    setSecilenStiller((s) => {
      const yeni = new Set(s);
      if (yeni.has(id)) yeni.delete(id);
      else yeni.add(id);
      return yeni;
    });
  };

  const yayinla5 = async (n: number, styles?: string[]) => {
    setCokluYayinAv(null);
    setMesgul((m) => ({ ...m, [n]: "yayin5" }));
    setHata("");
    try {
      const r = await fetch("/api/yayinla5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, ...(styles ? { styles } : {}) }),
      }).then((x) => x.json());
      if (r.ok) setCanli5((c) => ({ ...c, [n]: r.variants }));
      else setHata(r.error ?? "yayınlanamadı");
    } finally {
      setMesgul((m) => ({ ...m, [n]: "" }));
    }
  };

  const [taraModu, setTaraModu] = useState<"" | "genis" | "yakin" | "v2">("");
  const [acikRapor, setAcikRapor] = useState<string | null>(null);
  // Telefonu açmadan önce bakılacak kart: ilk 5 saniye + kanıt + fiyat + süre.
  const [aramaKartiAv, setAramaKartiAv] = useState<number | null>(null);
  const [durumFiltre, setDurumFiltre] = useState<string>("hepsi");
  const [bolgeSeciciAcik, setBolgeSeciciAcik] = useState(false);

  // Tek tarama yolu: v2 (Overture + yasal site denetimi + iki eksenli skor).
  // v1 ("sitesiz esnaf") emekli — panelden tetiklenemez, bkz. yukarıdaki not.
  const taraBaslat = async (mod: "v2") => {
    setTaraniyor(true);
    setTaraModu(mod);
    setHata("");
    try {
      const r = await fetch("/api/radar/scan-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tavan: 80 }),
      }).then((x) => x.json());
      if (!r.ok) setHata(r.error ?? "tarama hatası");
      yukle();
    } finally {
      setTaraniyor(false);
      setTaraModu("");
    }
  };

  const hits = data?.hits ?? [];
  const v2 = data?.surum === 2;
  const ist = data?.istatistik;
  // Hangi durumdakiler listelensin (üstteki filtre şeridi).
  const gorunenHits =
    durumFiltre === "hepsi"
      ? hits
      : hits.filter((h) => durumlar[slugla(h.name)]?.durum === durumFiltre);
  const aktifModalAv = sablonSecilenAv ?? cokluYayinAv;
  const aktifModalSlug = aktifModalAv !== null ? slugla(hits[aktifModalAv - 1]?.name ?? "") : null;
  const durumSayilari = Object.values(durumlar).reduce(
    (acc, kayit) => ({ ...acc, [kayit.durum]: (acc[kayit.durum] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  const dusunenler = Object.values(durumlar)
    .filter((k) => k.durum === "dusunuyor")
    .sort((a, b) => b.guncelleme.localeCompare(a.guncelleme));

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass rounded-2xl p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide">
          {v2 ? `🎯 Sıcak Lead'ler (${hits.length})` : `📡 Sitesiz İşletmeler (${hits.length})`}
          {data?.scanned_at && (
            <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">
              son tarama: {new Date(data.scanned_at).toLocaleString("tr-TR")}
            </span>
          )}
          {v2 && (
            <span className="mt-0.5 block text-[11px] font-normal text-[var(--muted)]">
              İşi iyi giden ama sitesi bozuk/görünmez işletmeler — en sıcak üstte.
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button

            type="button"

            onClick={() => setBolgeSeciciAcik(true)}

            title="Hangi semtlerin taranacağını seç — 34 semt, kategorili"

            className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.12]"

          >

            <MapPin className="size-4" /> Bölge Seç

          </button>
          <button
            onClick={() => void taraBaslat("v2")}
            disabled={taraniyor}
            title="RADAR v2: Overture açık verisinden işletmeleri bulur, sitelerini YASAL yoldan denetler (ölü alan adı, mobil uyumsuzluk, geçersiz sertifika, Google'da görünmezlik) ve iyi giden + sitesi kötü olanları sıralar. Her turda 80 yeni site denetlenir, sonuçlar 30 gün saklanır."
            className="flex items-center gap-2 rounded-xl bg-fuchsia-400/15 px-4 py-2 text-xs font-medium text-fuchsia-200 transition-colors hover:bg-fuchsia-400/25 disabled:opacity-50"
          >
            {taraniyor && taraModu === "v2" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Target className="size-4" />
            )}
            {taraniyor && taraModu === "v2" ? "Denetleniyor (2-5 dk)…" : "🎯 Sıcak Lead Tara"}
          </button>
          <button
            onClick={() => setTumunuGoster((v) => !v)}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              tumunuGoster
                ? "bg-white/[0.1] text-white"
                : "bg-white/[0.04] text-[var(--muted)] hover:bg-white/[0.08]"
            }`}
          >
            {tumunuGoster ? "İşaretlileri Gizle" : "Tümünü Göster"}
          </button>
          {/* "Yakın Tarama" / "Geniş Tarama" düğmeleri KALDIRILDI (16 Ağu 2026).
              Bunlar EMEKLİ v1 motorunu ("sitesiz esnaf") çalıştırıyor ve sonucu
              radar.json'a yazıyordu; panel de surum!=2 görünce eski arayüze
              düşüyordu. Kullanıcı "eski versiyon açılıyor" derken tam olarak
              bunu görüyordu. v1 artık kendi dosyasına yazıyor (radar_v1.json)
              ve buradan tetiklenemiyor. Tek tarama yolu: 🎯 Sıcak Lead Tara. */}
        </div>
      </div>

      {ist && (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-fuchsia-400/15 bg-fuchsia-400/[0.04] px-3 py-2 text-[11px] text-[var(--muted)]">
          <span>
            Havuz <b className="text-white/85">{ist.aday_havuzu.toLocaleString("tr-TR")}</b> işletme
          </span>
          <span>
            denetlenen <b className="text-white/85">{ist.denetlenen}</b>
          </span>
          <span>
            elenen <b className="text-white/85">{ist.elenen}</b> (sitesi iyi / kanıt yok)
          </span>
          <span className="text-emerald-300/90">
            her tur <b>{ist.bu_turda_yeni}</b> yeni site denetlendi ({ist.sure_sn} sn)
          </span>
          {!ist.places_acik && (
            <span
              title="Google puanı/yorum sayısı için Places API kapalı (kredi kartı gerektiriyor). İşletme kalitesi ücretsiz sinyallerle ölçülüyor: alan adı yaşı, kayıt güvenilirliği, kendi alan adı. Puanı her lead'de tek tıkla Google'da kendin görebilirsin."
              className="rounded-full bg-white/[0.06] px-2 py-0.5"
            >
              Google puanı: kapalı (ücretsiz mod)
            </span>
          )}
        </p>
      )}

      {/* DURUM FİLTRESİ (16 Ağu 2026) — sayaçlar artık tıklanabilir: bir
          duruma basınca yalnız o durumdakiler listelenir. "Aradıklarımızı,
          yok diyenleri, düşünenleri ayrı ayrı görebilelim" isteği. */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {DURUM_FILTRELERI.map((f) => {
          const adet =
            f.kod === "hepsi"
              ? hits.length
              : (durumSayilari[f.kod] ?? 0);
          const aktif = durumFiltre === f.kod;
          return (
            <button
              key={f.kod}
              type="button"
              onClick={() => setDurumFiltre(aktif ? "hepsi" : f.kod)}
              title={f.aciklama}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                aktif
                  ? "border-cyan-400/50 bg-cyan-400/[0.14] text-cyan-100"
                  : "border-white/[0.08] bg-white/[0.03] text-white/65 hover:bg-white/[0.08]"
              }`}
            >
              {f.etiket} <b className={f.renk}>{adet}</b>
            </button>
          );
        })}
      </div>

      {hata && (
        <p className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs text-amber-200">
          ⚠ {hata}
        </p>
      )}

      {data?.hatalar && data.hatalar.length > 0 && (
        <p className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs text-amber-200">
          ⚠ Son taramada bazı bölgeler taranamadı, sonuç eksik olabilir: {data.hatalar.join(" · ")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {gorunenHits.map((hit, i) => {
          const n = i + 1;
          const slug = slugla(hit.name);
          const demoVar = demolar.has(slug);
          const isMesgul = mesgul[n];
          const kayit = durumlar[slug];
          if (kayit && !tumunuGoster) return null;
          const isaretleBu = (durum: RadarDurum) =>
            isaretle(slug, hit.name, durum, { tur: hit.kind_tr, telefon: hit.phone });
          const secili = secilenSlug === slug;
          return (
            <div
              key={`${hit.name}-${hit.lat}`}
              ref={(el) => {
                satirRefs.current[slug] = el;
              }}
              className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors ${
                secili
                  ? "border-amber-400/50 bg-amber-400/[0.08] ring-1 ring-amber-400/40"
                  : kayit
                    ? "border-white/[0.05] bg-white/[0.01] opacity-50 hover:opacity-90"
                    : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
              <span className="w-7 text-right text-xs text-[var(--muted)]">{n}.</span>
              <div
                className={`min-w-0 flex-1 ${onSecim ? "cursor-pointer" : ""}`}
                onClick={onSecim ? () => onSecim(slug) : undefined}
                title={onSecim ? "Haritada göster" : undefined}
              >
                <p className="truncate text-sm font-medium">{hit.name}</p>
                <p className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                  {hit.kind_tr}
                  {hit.bolge && (
                    <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-cyan-300">
                      {hit.bolge}
                    </span>
                  )}{" "}
                  {v2 ? (
                    <span
                      title={`Hedef skoru = √(işletme kalitesi ${hit.kalite_puani} × site kusuru ${hit.kusur_puani})`}
                      className="whitespace-nowrap"
                    >
                      · hedef{" "}
                      <span className="font-semibold text-fuchsia-300">{hit.score}</span>
                      <span className="text-white/35">
                        {" "}
                        ({hit.kalite_puani}×{hit.kusur_puani})
                      </span>
                    </span>
                  ) : (
                    <>
                      · puan{" "}
                      <span className="font-semibold text-emerald-300">{hit.score}</span>
                    </>
                  )}
                  {hit.phone && (
                    <span className="flex items-center gap-1 text-xs font-semibold tabular-nums text-emerald-300/90">
                      <Phone className="size-3.5" /> {telefonBicimle(hit.phone)}
                    </span>
                  )}
                  {hit.website && (
                    <a
                      href={hit.website.startsWith("http") ? hit.website : `https://${hit.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={
                        v2
                          ? "Denetlenen mevcut site — kendi gözünle gör"
                          : "Kayıtlı site — tıklayıp güncel/eski olduğunu kendin kontrol et"
                      }
                      className="flex items-center gap-1 text-amber-300/80 underline"
                    >
                      <Globe className="size-3" />
                      {v2 ? hit.domain || "mevcut site" : "sitesi var, kontrol et"}
                    </a>
                  )}
                </p>
                {v2 && hit.kanca && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAcikRapor((s) => (s === slug ? null : slug));
                    }}
                    className="mt-1 flex w-full items-start gap-1.5 rounded-lg bg-red-400/[0.07] px-2 py-1 text-left text-[11px] leading-snug text-red-100/90 transition-colors hover:bg-red-400/[0.13]"
                  >
                    <ChevronDown
                      className={`mt-0.5 size-3 shrink-0 transition-transform ${
                        acikRapor === slug ? "rotate-180" : ""
                      }`}
                    />
                    <span className="min-w-0">{hit.kanca}</span>
                  </button>
                )}
                {canli[n] && (
                  <span className="flex flex-wrap items-center gap-2 text-[11px]">
                    <a
                      href={canli[n].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 underline"
                    >
                      🌍 {canli[n].url}
                    </a>
                    <a
                      href={canli[n].qr}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-300 underline"
                    >
                      📱 QR kodu
                    </a>
                    <a
                      href={canli[n].qrMenu}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-300 underline"
                    >
                      📋 QR menü
                    </a>
                  </span>
                )}
                {canli5[n] && (
                  <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2">
                    <span className="text-[11px] font-semibold text-white/80">
                      🌍 {canli5[n].length} farklı tasarım canlı — esnafa hepsini gönder:
                    </span>
                    {canli5[n].map((v) => (
                      <span
                        key={v.stil}
                        className="flex flex-wrap items-center gap-2 text-[11px]"
                      >
                        <span
                          className="rounded-full px-2 py-0.5 font-semibold"
                          style={{
                            backgroundColor: `${sablonRengi(v.stil)}22`,
                            color: sablonRengi(v.stil),
                          }}
                        >
                          {stilAdi(v.stil)}
                        </span>
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-300 underline"
                        >
                          {v.url}
                        </a>
                        <a
                          href={v.qr}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-300 underline"
                        >
                          📱 QR
                        </a>
                        <a
                          href={v.qrMenu}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-300 underline"
                        >
                          📋 QR menü
                        </a>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {kayit ? (
                  <button
                    onClick={() => geriAl(slug)}
                    title={`İşaret: ${
                      kayit.durum === "arandi"
                        ? "✅ Arandı"
                        : kayit.durum === "gizli"
                          ? "❌ Gizli"
                          : kayit.durum === "kapandi"
                            ? "🚫 Kalıcı Kapanmış"
                            : kayit.durum === "olmaz"
                              ? "🙅 Olmaz dedi"
                              : kayit.durum === "musteri"
                                ? "🎉 Müşteri"
                                : "🤔 Düşünüyor"
                    } — geri almak için tıkla`}
                    className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.12]"
                  >
                    <Undo2 className="size-3.5" />
                    Geri Al
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => isaretleBu("arandi")}
                      title="Arandı — listeden gizle"
                      className="rounded-lg p-1.5 text-emerald-300/80 transition-colors hover:bg-emerald-400/15 hover:text-emerald-200"
                    >
                      <CheckCircle2 className="size-4" />
                    </button>
                    <button
                      onClick={() => isaretleBu("gizli")}
                      title="İlgilenmiyor — listeden gizle"
                      className="rounded-lg p-1.5 text-red-300/80 transition-colors hover:bg-red-400/15 hover:text-red-200"
                    >
                      <XCircle className="size-4" />
                    </button>
                    <button
                      onClick={() => isaretleBu("olmaz")}
                      title="Aradık, ilgilenmiyor dedi — kaydı tut, listeden düşür"
                      className="rounded-lg p-1.5 text-orange-300/80 transition-colors hover:bg-orange-400/15 hover:text-orange-200"
                    >
                      <span className="block text-[13px] leading-4">🙅</span>
                    </button>
                    <button
                      onClick={() => isaretleBu("musteri")}
                      title="ANLAŞILDI — müşteri oldu"
                      className="rounded-lg p-1.5 text-cyan-300/80 transition-colors hover:bg-cyan-400/15 hover:text-cyan-200"
                    >
                      <span className="block text-[13px] leading-4">🎉</span>
                    </button>
                    <button
                      onClick={() => isaretleBu("dusunuyor")}
                      title="Düşünüyor — Düşünenler listesine taşı"
                      className="rounded-lg p-1.5 text-amber-300/80 transition-colors hover:bg-amber-400/15 hover:text-amber-200"
                    >
                      <Clock3 className="size-4" />
                    </button>
                    <button
                      onClick={() => isaretleBu("kapandi")}
                      title="Kalıcı kapanmış — baktım, artık yok (listeden çıkar)"
                      className="rounded-lg p-1.5 text-slate-400/80 transition-colors hover:bg-slate-400/15 hover:text-slate-300"
                    >
                      <Ban className="size-4" />
                    </button>
                  </>
                )}
              </div>
              {/* ŞABLON BUTONLARI KALDIRILDI (3 Ağu 2026): 10 hazır şablon
                  "şablondan çıkma" hissi veriyordu. Tek üretim yolu artık
                  kusur raporundaki sorulu sihirbaz (DemoSihirbazi) — mevcut
                  sitenin gerçek içeriğiyle, bol animasyonlu, sıfırdan.
                  Şablon kodu (site_builder, publisher, /api/site, /api/yayinla)
                  repoda duruyor; acil toplu iş gerekirse geri açılabilir. */}
              <div className="flex items-center gap-2">
                {demoVar && (
                  <a
                    href={`/api/demo/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-400/15 px-3 py-1.5 text-xs text-cyan-200 transition-colors hover:bg-cyan-400/25"
                  >
                    <Eye className="size-3.5" />
                    Önizle
                  </a>
                )}
                {demoVar && (
                  <button
                    onClick={() => yayinla(n)}
                    disabled={!!isMesgul}
                    className="flex items-center gap-1.5 rounded-lg bg-violet-400/15 px-3 py-1.5 text-xs text-violet-200 transition-colors hover:bg-violet-400/25 disabled:opacity-50"
                  >
                    {isMesgul === "yayin" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Globe className="size-3.5" />
                    )}
                    Yayınla
                  </button>
                )}
                {v2 && (
                  <button
                    onClick={() => setAramaKartiAv(n)}
                    title={`${hit.name} için: telefonda ilk 5 saniyede ne diyeceğin, elindeki kanıt, fiyat bandı, kaç günde teslim, müşteriden isteyeceklerin`}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-400/20 px-3 py-1.5 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-400/30"
                  >
                    <Phone className="size-3.5" />
                    ☎️ Arama Kartı
                  </button>
                )}
                <a
                  href={`/arama?ad=${encodeURIComponent(hit.name)}&tur=${encodeURIComponent(hit.kind_tr)}&slug=${encodeURIComponent(slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${hit.name} için kişiselleştirilmiş konuşma ağacını aç`}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-400/15 px-3 py-1.5 text-xs text-emerald-200 transition-colors hover:bg-emerald-400/25"
                >
                  <MessageCircle className="size-3.5" />
                  İkna Et
                </a>
              </div>
              </div>

              {/* Kusur raporu SATIRIN ALTINDA, tam genişlikte. Eskiden
                  ortadaki flex-1 sütunun içindeydi; yanındaki buton grupları
                  onu ezdiği için metin tek kelimelik şeritlere düşüyordu. */}
              {v2 && acikRapor === slug && (
                <RadarKusurRaporu
                  hit={hit}
                  n={n}
                  demoLinki={canli[n]?.url ?? canli5[n]?.[0]?.url ?? ""}
                />
              )}
            </div>
          );
        })}
        {gorunenHits.length === 0 && (
          <p className="p-4 text-center text-sm text-[var(--muted)]">
            Henüz tarama verisi yok — &quot;🎯 Sıcak Lead Tara&quot;ya bas.
          </p>
        )}
      </div>

      {dusunenler.length > 0 && (
        <a
          href="/dusunenler"
          className="mt-5 flex items-center justify-between gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3 text-xs transition-colors hover:bg-amber-400/[0.08]"
        >
          <span className="flex items-center gap-1.5 font-semibold text-amber-200">
            <Clock3 className="size-3.5" />
            🤔 {dusunenler.length} işletme düşünüyor — tekrar aramak ve not tutmak için Düşünenler sayfasına git
          </span>
          <span className="text-amber-300/80">Aç →</span>
        </a>
      )}

      {sablonSecilenAv !== null && sablonlar && sablonlar.length > 0 && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSablonSecilenAv(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sablon-baslik"
            className="glass max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:max-w-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 id="sablon-baslik" className="text-sm font-semibold">
                  {secimModu === "brief"
                    ? "Müşteri hangi şablonu beğendi?"
                    : "Şablon seç"}
                </h3>
                <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[11px] text-cyan-200">
                  {sablonlar.length} şablon
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSablonSecilenAv(null)}
                aria-label="Şablon seçiciyi kapat"
                className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex max-h-[calc(80vh-57px)] gap-4 overflow-y-auto p-3 sm:overflow-hidden">
              <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
                {secimModu === "demo" && (
                  <button
                    type="button"
                    onClick={() => void demoUret(sablonSecilenAv)}
                    className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07] p-3 text-left transition-colors hover:bg-cyan-400/[0.13]"
                  >
                    <span className="block text-sm font-semibold">🔄 Otomatik (sıradaki stil)</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      Mevcut rotasyondaki sıradaki şablonu kullanır.
                    </span>
                  </button>
                )}
                {sablonlar.map((sablon) => (
                  <button
                    key={sablon.id}
                    type="button"
                    onMouseEnter={() => setAktifOnizlemeStil(sablon.id)}
                    onClick={() =>
                      void (secimModu === "brief"
                        ? briefUret(sablonSecilenAv, sablon.id)
                        : demoUret(sablonSecilenAv, sablon.id))
                    }
                    className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-left transition-colors hover:bg-white/[0.07]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1 size-3 shrink-0 rounded-full shadow-[0_0_12px_currentColor]"
                      style={{ backgroundColor: sablonRengi(sablon.id), color: sablonRengi(sablon.id) }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{sablon.ad}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">
                        {sablon.aciklama}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <SablonOnizlemePaneli
                slug={aktifModalSlug}
                aktifStil={aktifOnizlemeStil}
                stilAdi={stilAdi}
                durum={sablonSecilenAv !== null ? onizlemeDurum[sablonSecilenAv] : undefined}
              />
            </div>
          </div>
        </div>
      )}

      {cokluYayinAv !== null && sablonlar && sablonlar.length > 0 && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCokluYayinAv(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="coklu-yayin-baslik"
            className="glass max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:max-w-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 id="coklu-yayin-baslik" className="text-sm font-semibold">
                  Hangi tasarımlar yayınlansın?
                </h3>
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-200">
                  {secilenStiller.size} seçili
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCokluYayinAv(null)}
                aria-label="Şablon seçiciyi kapat"
                className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex max-h-[calc(80vh-127px)] gap-4 overflow-y-auto p-3 sm:overflow-hidden">
              <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
                {sablonlar.map((sablon) => {
                  const secili = secilenStiller.has(sablon.id);
                  return (
                    <button
                      key={sablon.id}
                      type="button"
                      onMouseEnter={() => setAktifOnizlemeStil(sablon.id)}
                      onClick={() => stilTikle(sablon.id)}
                      aria-pressed={secili}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                        secili
                          ? "border-amber-400/40 bg-amber-400/[0.1]"
                          : "border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.07]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] border text-[10px] font-bold ${
                          secili
                            ? "border-amber-300 bg-amber-300 text-slate-900"
                            : "border-white/25 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full shadow-[0_0_12px_currentColor]"
                            style={{ backgroundColor: sablonRengi(sablon.id), color: sablonRengi(sablon.id) }}
                          />
                          <span className="block text-sm font-semibold">{sablon.ad}</span>
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">
                          {sablon.aciklama}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <SablonOnizlemePaneli
                slug={aktifModalSlug}
                aktifStil={aktifOnizlemeStil}
                stilAdi={stilAdi}
                durum={cokluYayinAv !== null ? onizlemeDurum[cokluYayinAv] : undefined}
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-4 py-3">
              <button
                type="button"
                onClick={() => setCokluYayinAv(null)}
                className="rounded-xl bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.12]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={secilenStiller.size === 0}
                onClick={() => void yayinla5(cokluYayinAv, Array.from(secilenStiller))}
                className="rounded-xl bg-amber-400/20 px-4 py-2 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-400/30 disabled:opacity-40"
              >
                {secilenStiller.size} tasarımı yayınla
              </button>
            </div>
          </div>
        </div>
      )}

      {bolgeSeciciAcik && (
        <BolgeSecici
          onKapat={() => setBolgeSeciciAcik(false)}
          onKaydedildi={() => setHata("Bölgeler kaydedildi — 🎯 Sıcak Lead Tara ile yeni bölgeleri tara.")}
        />
      )}

      {aramaKartiAv !== null && hits[aramaKartiAv - 1] && (
        <AramaKarti
          hit={hits[aramaKartiAv - 1]}
          demoLinki={canli[aramaKartiAv]?.url ?? canli5[aramaKartiAv]?.[0]?.url ?? ""}
          onKapat={() => setAramaKartiAv(null)}
        />
      )}

      {brief && (
        <div className="fixed inset-0 z-[1100] flex bg-slate-950/90 p-3 backdrop-blur-md sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="brief-baslik"
            className="glass flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
              <h3 id="brief-baslik" className="text-sm font-semibold">
                Fable 5 Tasarım Brief&apos;i
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void panoyaKopyala()}
                  className="rounded-xl bg-cyan-400/15 px-4 py-2 text-xs font-medium text-cyan-200 transition-colors hover:bg-cyan-400/25"
                >
                  {kopyalandi ? "Kopyalandı ✓" : "📋 Panoya Kopyala"}
                </button>
                <button
                  type="button"
                  onClick={() => setBrief("")}
                  aria-label="Brief'i kapat"
                  className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-white/85 sm:p-6 sm:text-sm">
              {brief}
            </pre>
          </div>
        </div>
      )}
    </motion.section>
  );
}
