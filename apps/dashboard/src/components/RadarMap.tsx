"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// maplibre-gl v6 varsayılan dışa aktarım vermiyor — ad alanı olarak alınır.
import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";

type MLMap = maplibregl.Map;
type GeoJSONSource = maplibregl.GeoJSONSource;
import "maplibre-gl/dist/maplibre-gl.css";
import { radarHits as demoHits } from "@/lib/mock";
import type { RadarHit } from "./RadarPanel";
import { slugla } from "@/lib/slug";
import { telefonBicimle } from "@/lib/telefon";
import { oyunStili } from "@/lib/haritaStili";
import type { RadarDurum } from "@/hooks/useRadarDurum";

// FETİH HARİTASI (Faz B, 9 Eyl 2026)
// ----------------------------------
// Leaflet + raster kutucuk yerine MapLibre + OpenFreeMap vektör kutucuk:
//   * CARTO artık anahtar istiyordu ("API KEY REQUIRED" damgası) — bu anahtarsız.
//   * Vektör olduğu için görünüm bizim (bkz. lib/haritaStili.ts): gece paleti,
//     parlayan arterler, z15'ten sonra 3B binalar, eğik kamera.
//   * İşletmeler artık HTML işaretçi değil GeoJSON katmanı — 10 binlik havuzda
//     bile akıcı kalsın diye (Leaflet'te her nokta bir DOM düğümüydü).
//
// Oyun katmanı: her semt bir "bölge"dir. Bölgenin rengi o semtte KAÇ işletmeyi
// işaretlediğine göre koyulaşır (fetih oranı). Amaç oyunlaştırma değil, tek
// bakışta "nereyi taradım, nereye hiç girmedim" sorusunu cevaplamak.

const VARSAYILAN_MERKEZ: [number, number] = [29.1228, 40.9497]; // [lon, lat] — Maltepe

// Durum → renk. Radar listesi ve arama listesiyle AYNI dil (globals.css rozetleri).
const DURUM_RENGI: Record<string, string> = {
  arandi: "#64748b",
  // Açılmadı: kararı verilmiş yerlerden AYRI bir renk — haritada hâlâ
  // aranacak hedef olduğu görülsün (11 Eyl 2026).
  ulasilamadi: "#94a3b8",
  gizli: "#475569",
  kapandi: "#475569",
  olmaz: "#f97316",
  dusunuyor: "#fbbf24",
  randevu: "#a78bfa",
  musteri: "#22d3ee",
};

/** ["match", ["get","durum"], "arandi", "#64748b", …, varsayilan] */
function durumRengi(varsayilan: string): ExpressionSpecification {
  const ifade: unknown[] = ["match", ["get", "durum"]];
  for (const [kod, renk] of Object.entries(DURUM_RENGI)) ifade.push(kod, renk);
  ifade.push(varsayilan);
  return ifade as unknown as ExpressionSpecification;
}

const ISARET_DUGMELERI: { kod: RadarDurum; etiket: string; sinif: string }[] = [
  { kod: "arandi", etiket: "✅ Aradım", sinif: "bg-emerald-400/20 text-emerald-100" },
  { kod: "randevu", etiket: "📅 Randevu", sinif: "bg-violet-400/20 text-violet-100" },
  { kod: "dusunuyor", etiket: "🤔 Düşünüyor", sinif: "bg-amber-400/20 text-amber-100" },
  { kod: "gizli", etiket: "❌ Atla", sinif: "bg-white/10 text-white/70" },
  { kod: "kapandi", etiket: "🚫 Kapanmış", sinif: "bg-white/10 text-white/70" },
];

interface Props {
  scanCenter?: [number, number] | null; // [lat, lon] — radar.json tarama merkezi
  liveHits?: RadarHit[] | null;
  isaretle?: (
    slug: string,
    ad: string,
    durum: RadarDurum,
    ekstra?: { tur?: string; telefon?: string },
  ) => void;
  durumlar?: Record<string, { durum: string }>;
  secilenSlug?: string | null;
  onSecim?: (slug: string) => void;
  yukseklikClassName?: string;
  rozetMetni?: string; // sağ üst etiket (varsayılan: tarama/konum durumu)
}

type Nokta = {
  slug: string;
  ad: string;
  tur: string;
  bolge: string;
  telefon: string;
  website: string;
  issue: string;
  skor: number;
  durum: string;
  lat: number;
  lon: number;
};

/** Merkez + yarıçaptan (metre) kaba daire poligonu — bölge alanı için. */
function daire(lon: number, lat: number, metre: number, adim = 48): number[][] {
  const derece = metre / 111_320;
  const enlemDuzeltme = Math.cos((lat * Math.PI) / 180) || 1;
  const halka: number[][] = [];
  for (let i = 0; i <= adim; i += 1) {
    const aci = (i / adim) * Math.PI * 2;
    halka.push([lon + (derece / enlemDuzeltme) * Math.cos(aci), lat + derece * Math.sin(aci)]);
  }
  return halka;
}

function noktaKoleksiyonu(noktalar: Nokta[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: noktalar.map((n) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [n.lon, n.lat] },
      properties: { ...n },
    })),
  };
}

/**
 * Semt bazlı fetih alanları: nokta bulutunun merkezi + yayılımı.
 * Etiketler AYRI bir nokta katmanına gider: büyük poligon birden çok vektör
 * kutucuğa bölündüğü için etiketi poligona bağlarsak her kutucuk kendi
 * kopyasını basıyor (9 Eyl 2026'da "BOSTANCI 0/90" 4 kez çıktı).
 */
function bolgeKoleksiyonu(noktalar: Nokta[]): GeoJSON.FeatureCollection {
  const gruplar = new Map<string, Nokta[]>();
  for (const n of noktalar) {
    if (!n.bolge) continue;
    const liste = gruplar.get(n.bolge);
    if (liste) liste.push(n);
    else gruplar.set(n.bolge, [n]);
  }
  const ozellikler: GeoJSON.Feature[] = [];
  for (const [bolge, liste] of gruplar) {
    if (liste.length < 4) continue; // 2-3 noktalık "bölge" çizmek yanıltıcı
    const lat = liste.reduce((t, n) => t + n.lat, 0) / liste.length;
    const lon = liste.reduce((t, n) => t + n.lon, 0) / liste.length;
    const yaricap = Math.min(
      1400,
      Math.max(
        450,
        Math.max(
          ...liste.map((n) =>
            Math.hypot((n.lat - lat) * 111_320, (n.lon - lon) * 111_320 * Math.cos((lat * Math.PI) / 180)),
          ),
        ) * 1.15,
      ),
    );
    const islenmis = liste.filter((n) => n.durum).length;
    const kazanilmis = liste.filter((n) => n.durum === "randevu" || n.durum === "musteri").length;
    ozellikler.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [daire(lon, lat, yaricap)] },
      properties: {
        bolge,
        oran: liste.length ? islenmis / liste.length : 0,
        kazanilmis,
        etiket: `${bolge.toUpperCase()}  ${islenmis}/${liste.length}`,
        merkezLat: lat,
        merkezLon: lon,
      },
    });
  }
  return { type: "FeatureCollection", features: ozellikler };
}

/** Bölge etiketleri — her semt için TEK nokta (kutucuk tekrarını önler). */
function bolgeEtiketleri(alanlar: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: alanlar.features.map((f) => {
      const p = f.properties as { merkezLat: number; merkezLon: number; etiket: string };
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.merkezLon, p.merkezLat] },
        properties: { etiket: p.etiket },
      };
    }),
  };
}

export default function RadarMap({
  scanCenter,
  liveHits,
  isaretle,
  durumlar,
  secilenSlug,
  onSecim,
  yukseklikClassName = "h-72 mb-4",
  rozetMetni,
}: Props) {
  const kapsayici = useRef<HTMLDivElement | null>(null);
  const haritaRef = useRef<MLMap | null>(null);
  const merkezIsaretRef = useRef<maplibregl.Marker | null>(null);
  const [hazir, setHazir] = useState(false);
  const [hata, setHata] = useState("");
  const [secili, setSecili] = useState<Nokta | null>(null);
  const [canliKonum, setCanliKonum] = useState<[number, number] | null>(null);
  const [egik, setEgik] = useState(true);
  // GPS: telefonda "ben neredeyim, hangi dükkân yanımda" için canlı konum.
  const [gpsAcik, setGpsAcik] = useState(false);
  const [gpsHata, setGpsHata] = useState("");
  const [gpsKonum, setGpsKonum] = useState<{ lat: number; lon: number; dogruluk: number } | null>(
    null,
  );
  const gpsIzleyici = useRef<number | null>(null);
  const gpsIsaretRef = useRef<maplibregl.Marker | null>(null);
  const takipRef = useRef(true);

  const merkez: [number, number] = useMemo(() => {
    if (scanCenter) return [scanCenter[1], scanCenter[0]];
    if (canliKonum) return canliKonum;
    return VARSAYILAN_MERKEZ;
  }, [scanCenter, canliKonum]);

  // Demo modunda (canlı veri yokken) örnek noktalar merkez çevresine serpilir.
  const noktalar: Nokta[] = useMemo(() => {
    const kaynak = liveHits;
    if (kaynak) {
      return kaynak.map((h) => {
        const slug = slugla(h.name);
        return {
          slug,
          ad: h.name,
          tur: h.kind_tr ?? "",
          bolge: (h as { bolge?: string }).bolge ?? "",
          telefon: h.phone ?? "",
          website: h.website ?? "",
          issue: h.issue ?? "",
          skor: h.score ?? 70,
          durum: durumlar?.[slug]?.durum ?? "",
          lat: h.lat,
          lon: h.lon,
        };
      });
    }
    const sapma: [number, number][] = [
      [0.004, 0.006],
      [-0.005, 0.003],
      [0.0025, -0.0065],
    ];
    return demoHits.map((h, i) => ({
      slug: slugla(h.name),
      ad: h.name,
      tur: h.district ?? "",
      bolge: h.district ?? "",
      telefon: "",
      website: "",
      issue: h.issue ?? "",
      skor: h.score ?? 70,
      durum: "",
      lat: merkez[1] + sapma[i % sapma.length][0],
      lon: merkez[0] + sapma[i % sapma.length][1],
    }));
  }, [liveHits, durumlar, merkez]);

  const fetih = useMemo(() => {
    const islenmis = noktalar.filter((n) => n.durum).length;
    const kazanilmis = noktalar.filter((n) => n.durum === "randevu" || n.durum === "musteri").length;
    return { toplam: noktalar.length, islenmis, kazanilmis };
  }, [noktalar]);

  // Tarama merkezi yoksa tarayıcıdan konum iste (eski davranış korunuyor).
  useEffect(() => {
    if (scanCenter || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCanliKonum([p.coords.longitude, p.coords.latitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [scanCenter]);

  // ------------------------------------------------------------ harita kurulum
  useEffect(() => {
    if (!kapsayici.current || haritaRef.current) return;
    // maplibre v6 worker'ı ayrı ESM dosyası; Next onu yayımlamadığı için
    // public/maplibre'den servis ediliyor (scripts/maplibre-worker-kopyala.mjs).
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    let harita: MLMap;
    try {
      harita = new maplibregl.Map({
        container: kapsayici.current,
        style: oyunStili(),
        center: merkez,
        zoom: 14.2,
        pitch: 48,
        bearing: -18,
        maxPitch: 70,
        attributionControl: { compact: true },
        // Kamera hafif eğik dursun ama kullanıcı düzleştirebilsin.
        dragRotate: true,
      });
    } catch {
      setHata("Harita başlatılamadı (WebGL).");
      return;
    }
    haritaRef.current = harita;
    // Hata ayıklama tutamağı: tarayıcı konsolundan kamera/katman durumu
    // sorgulanabilsin (harita "boş" göründüğünde tek bakışta teşhis).
    (window as unknown as { hunterHarita?: MLMap }).hunterHarita = harita;
    harita.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    harita.on("error", (e) => {
      // Hata handler'ı kaydedince MapLibre kendi konsol çıktısını susturuyor —
      // stil/ifade hataları görünmez oluyordu (binaların çizilmemesi böyle
      // fark edilmemişti). Her hatayı konsola yaz, ağ hatasını ekrana da bas.
      const mesaj = (e as { error?: { message?: string } })?.error?.message ?? "";
      console.warn("[harita]", mesaj || e);
      if (mesaj.includes("Failed to fetch") || mesaj.includes("NetworkError"))
        setHata("Harita kutucukları yüklenemedi (internet?). Noktalar yine de çizili.");
    });

    harita.on("load", () => {
      const bosAlan = bolgeKoleksiyonu([]);
      harita.addSource("bolgeler", { type: "geojson", data: bosAlan });
      harita.addSource("bolge-etiketleri", { type: "geojson", data: bolgeEtiketleri(bosAlan) });
      harita.addSource("avlar", { type: "geojson", data: noktaKoleksiyonu([]) });

      // --- bölge fethi: işaretledikçe koyulaşan VE yükselen alan.
      // Prizma bilinçli: OpenFreeMap'te bina verisi olmadığı için (bkz.
      // haritaStili.ts) haritadaki tek 3B hacim bu. "İşlediğin semt yükselir."
      harita.addLayer({
        id: "bolge-3b",
        type: "fill-extrusion",
        source: "bolgeler",
        paint: {
          "fill-extrusion-color": [
            "interpolate", ["linear"], ["get", "oran"],
            0, "#233056",
            0.5, "#4b3a86",
            1, "#2f7d5c",
          ],
          "fill-extrusion-height": ["interpolate", ["linear"], ["get", "oran"], 0, 15, 1, 200],
          "fill-extrusion-base": 0,
          // Hiç işlenmemiş bölge neredeyse görünmez; işledikçe hem yükselir
          // hem belirginleşir. Yoksa boş bölge tüm haritayı boyuyor.
          "fill-extrusion-opacity": 0.22,
        },
      });
      harita.addLayer({
        id: "bolge-dolgu",
        type: "fill",
        source: "bolgeler",
        paint: {
          "fill-color": [
            "interpolate", ["linear"], ["get", "oran"],
            0, "#1b2540",
            0.5, "#3b2f6b",
            1, "#2f6b52",
          ],
          "fill-opacity": ["interpolate", ["linear"], ["get", "oran"], 0, 0.04, 1, 0.22],
        },
      });
      harita.addLayer({
        id: "bolge-cizgi",
        type: "line",
        source: "bolgeler",
        paint: {
          "line-color": ["interpolate", ["linear"], ["get", "oran"], 0, "#3d4d7a", 1, "#4ade80"],
          "line-width": 1.4,
          "line-dasharray": [4, 3],
          "line-opacity": 0.6,
        },
      });
      harita.addLayer({
        id: "bolge-etiket",
        type: "symbol",
        source: "bolge-etiketleri",
        layout: {
          "text-field": ["get", "etiket"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 11,
          "text-letter-spacing": 0.16,
          "text-offset": [0, -1.2],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#9fb6e0",
          "text-halo-color": "#050810",
          "text-halo-width": 1.8,
          "text-opacity": 0.85,
        },
      });

      // --- işletmeler: hale + çekirdek + sıcak halka + seçili nabız
      harita.addLayer({
        id: "av-hale",
        type: "circle",
        source: "avlar",
        paint: {
          "circle-color": durumRengi("#34d399"),
          "circle-radius": ["interpolate", ["linear"], ["get", "skor"], 60, 9, 100, 22],
          "circle-blur": 1,
          "circle-opacity": ["case", ["==", ["get", "durum"], ""], 0.5, 0.22],
        },
      });
      harita.addLayer({
        id: "av-nokta",
        type: "circle",
        source: "avlar",
        paint: {
          "circle-color": durumRengi("#4ade80"),
          "circle-radius": ["interpolate", ["linear"], ["get", "skor"], 60, 4, 100, 9],
          "circle-stroke-color": "#08111f",
          "circle-stroke-width": 1.2,
          "circle-opacity": ["case", ["==", ["get", "durum"], ""], 1, 0.75],
        },
      });
      harita.addLayer({
        id: "av-sicak",
        type: "circle",
        source: "avlar",
        filter: ["all", [">=", ["get", "skor"], 90], ["==", ["get", "durum"], ""]],
        paint: {
          "circle-radius": 14,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#4ade80",
          "circle-stroke-width": 1.2,
          "circle-stroke-opacity": 0.55,
        },
      });
      harita.addLayer({
        id: "av-nabiz",
        type: "circle",
        source: "avlar",
        filter: ["==", ["get", "slug"], "___yok___"],
        paint: {
          "circle-radius": 10,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#f0abfc",
          "circle-stroke-width": 2,
        },
      });

      const elIsaret = (e: maplibregl.MapLayerMouseEvent) => {
        const ozellik = e.features?.[0];
        if (!ozellik) return;
        const p = ozellik.properties as unknown as Nokta;
        setSecili(p);
        onSecim?.(p.slug);
      };
      harita.on("click", "av-nokta", elIsaret);
      harita.on("click", "av-hale", elIsaret);
      harita.on("mouseenter", "av-nokta", () => {
        harita.getCanvas().style.cursor = "pointer";
      });
      harita.on("mouseleave", "av-nokta", () => {
        harita.getCanvas().style.cursor = "";
      });

      setHazir(true);
    });

    return () => {
      harita.remove();
      haritaRef.current = null;
      setHazir(false);
    };
    // merkez/onSecim bilerek dışarıda: harita bir kez kurulur, veri ayrı efektlerle akar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ veri akışı
  useEffect(() => {
    const harita = haritaRef.current;
    if (!harita || !hazir) return;
    const alanlar = bolgeKoleksiyonu(noktalar);
    (harita.getSource("avlar") as GeoJSONSource | undefined)?.setData(noktaKoleksiyonu(noktalar));
    (harita.getSource("bolgeler") as GeoJSONSource | undefined)?.setData(alanlar);
    (harita.getSource("bolge-etiketleri") as GeoJSONSource | undefined)?.setData(
      bolgeEtiketleri(alanlar),
    );
  }, [noktalar, hazir]);

  // Merkez değişince (tarama merkezi geldi / konum bulundu) kamerayı taşı.
  useEffect(() => {
    const harita = haritaRef.current;
    if (!harita || !hazir) return;
    harita.easeTo({ center: merkez, duration: 900 });
    merkezIsaretRef.current?.remove();
    const el = document.createElement("span");
    el.className = "map-me";
    merkezIsaretRef.current = new maplibregl.Marker({ element: el }).setLngLat(merkez).addTo(harita);
  }, [merkez, hazir]);

  // Seçili işletme: nabız katmanını ona kilitle + görüş alanına al.
  useEffect(() => {
    const harita = haritaRef.current;
    if (!harita || !hazir) return;
    harita.setFilter("av-nabiz", ["==", ["get", "slug"], secilenSlug ?? "___yok___"]);
    if (!secilenSlug) return;
    const hedef = noktalar.find((n) => n.slug === secilenSlug);
    if (hedef) {
      harita.flyTo({ center: [hedef.lon, hedef.lat], zoom: Math.max(harita.getZoom(), 16.5), duration: 900 });
      setSecili(hedef);
    }
  }, [secilenSlug, hazir, noktalar]);

  // Nabız animasyonu — seçili nokta 10→26 px arası soluklaşarak büyür.
  useEffect(() => {
    const harita = haritaRef.current;
    if (!harita || !hazir || !secilenSlug) return;
    let kare = 0;
    const tik = () => {
      const t = (performance.now() % 1600) / 1600;
      harita.setPaintProperty("av-nabiz", "circle-radius", 10 + t * 16);
      harita.setPaintProperty("av-nabiz", "circle-stroke-opacity", 0.9 * (1 - t));
      kare = requestAnimationFrame(tik);
    };
    kare = requestAnimationFrame(tik);
    return () => cancelAnimationFrame(kare);
  }, [secilenSlug, hazir]);

  // ------------------------------------------------------------------- GPS
  // iOS Safari konumu YALNIZCA güvenli bağlamda verir: https:// ya da
  // localhost. Ev ağında http://192.168… ile açtıysan tarayıcı reddeder —
  // o durumda tünel adresini (https) kullan.
  const gpsKapat = useCallback(() => {
    if (gpsIzleyici.current !== null) {
      navigator.geolocation.clearWatch(gpsIzleyici.current);
      gpsIzleyici.current = null;
    }
    gpsIsaretRef.current?.remove();
    gpsIsaretRef.current = null;
    const harita = haritaRef.current;
    if (harita?.getLayer("gps-dogruluk")) harita.removeLayer("gps-dogruluk");
    if (harita?.getSource("gps-alan")) harita.removeSource("gps-alan");
    setGpsAcik(false);
    setGpsKonum(null);
  }, []);

  const gpsAc = useCallback(() => {
    setGpsHata("");
    if (!("geolocation" in navigator)) {
      setGpsHata("Tarayıcı konum vermiyor.");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGpsHata("Konum için https gerekiyor — tünel adresinden aç.");
      return;
    }
    setGpsAcik(true);
    takipRef.current = true;
    gpsIzleyici.current = navigator.geolocation.watchPosition(
      (konum) =>
        setGpsKonum({
          lat: konum.coords.latitude,
          lon: konum.coords.longitude,
          dogruluk: konum.coords.accuracy ?? 0,
        }),
      (hata) => {
        setGpsHata(
          hata.code === hata.PERMISSION_DENIED
            ? "Konum izni verilmedi (Ayarlar > Safari > Konum)."
            : "Konum alınamadı.",
        );
        setGpsAcik(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }, []);

  // Konum geldikçe işaretçiyi ve doğruluk halkasını güncelle.
  useEffect(() => {
    const harita = haritaRef.current;
    if (!harita || !hazir || !gpsKonum) return;

    if (!gpsIsaretRef.current) {
      const el = document.createElement("span");
      el.className = "map-me";
      gpsIsaretRef.current = new maplibregl.Marker({ element: el }).setLngLat([
        gpsKonum.lon,
        gpsKonum.lat,
      ]).addTo(harita);
    } else {
      gpsIsaretRef.current.setLngLat([gpsKonum.lon, gpsKonum.lat]);
    }

    const alan: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [daire(gpsKonum.lon, gpsKonum.lat, Math.max(15, gpsKonum.dogruluk))],
          },
        },
      ],
    };
    const kaynak = harita.getSource("gps-alan") as GeoJSONSource | undefined;
    if (kaynak) {
      kaynak.setData(alan);
    } else {
      harita.addSource("gps-alan", { type: "geojson", data: alan });
      harita.addLayer({
        id: "gps-dogruluk",
        type: "fill",
        source: "gps-alan",
        paint: { "fill-color": "#38bdf8", "fill-opacity": 0.14 },
      });
    }

    if (takipRef.current) {
      harita.easeTo({
        center: [gpsKonum.lon, gpsKonum.lat],
        zoom: Math.max(harita.getZoom(), 16),
        duration: 700,
      });
    }
  }, [gpsKonum, hazir]);

  // Kullanıcı haritayı sürüklerse takip bırakılsın (yoksa kamera geri zıplar).
  useEffect(() => {
    const harita = haritaRef.current;
    if (!harita || !hazir) return;
    const birak = () => {
      takipRef.current = false;
    };
    harita.on("dragstart", birak);
    return () => {
      harita.off("dragstart", birak);
    };
  }, [hazir]);

  useEffect(() => () => gpsKapat(), [gpsKapat]);

  const egimDegistir = useCallback(() => {
    const harita = haritaRef.current;
    if (!harita) return;
    const yeni = !egik;
    setEgik(yeni);
    harita.easeTo({ pitch: yeni ? 48 : 0, bearing: yeni ? -18 : 0, duration: 700 });
  }, [egik]);

  const isaretleVeKapat = (durum: RadarDurum) => {
    if (!secili || !isaretle) return;
    isaretle(secili.slug, secili.ad, durum, { tur: secili.tur, telefon: secili.telefon });
    setSecili(null);
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-white/[0.07] ${yukseklikClassName}`}
      style={{ background: "#060912" }}
    >
      <div ref={kapsayici} className="h-full w-full" />

      {/* İlk boyama ağa bağlı (vektör kutucuklar ~1-2 sn, yavaş hatta daha
          uzun). Boş siyah kutu yerine bunu göster — panel donmuş sanılmasın. */}
      {!hazir && !hata && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#060912]">
          <span className="animate-pulse text-xs text-white/50">harita yükleniyor…</span>
        </div>
      )}

      {/* --- HUD: fetih sayacı */}
      <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] text-white/80 backdrop-blur">
        🏴 {fetih.islenmis}/{fetih.toplam} işlendi
        {fetih.kazanilmis > 0 && <span className="text-violet-200"> · 🎯 {fetih.kazanilmis} randevu</span>}
      </div>

      {/* --- HUD: kamera + GPS düğmeleri */}
      <div className="absolute right-2 top-2 z-10 flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (gpsAcik) {
              gpsKapat();
            } else {
              gpsAc();
            }
          }}
          title={gpsAcik ? "konumu bırak" : "beni haritada göster (telefonda https gerekir)"}
          className={`rounded-full px-2.5 py-1 text-[11px] backdrop-blur transition-colors ${
            gpsAcik
              ? "bg-sky-400/30 text-sky-100"
              : "bg-black/45 text-white/80 hover:bg-black/70"
          }`}
        >
          {gpsAcik ? "📍 takipte" : "📍 konumum"}
        </button>
        <button
          type="button"
          onClick={egimDegistir}
          className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur transition-colors hover:bg-black/70"
        >
          {egik ? "🗺️ düz" : "🏙️ eğik"}
        </button>
      </div>

      {gpsHata && (
        <p className="absolute right-2 top-11 z-10 max-w-[70%] rounded-lg bg-amber-500/20 px-2.5 py-1.5 text-[10px] text-amber-100 backdrop-blur">
          {gpsHata}
        </p>
      )}

      <span
        className={`absolute right-2 top-[4.5rem] z-10 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur ${
          scanCenter || canliKonum ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-white/70"
        }`}
      >
        {rozetMetni ??
          (scanCenter ? "📡 gerçek tarama verisi" : canliKonum ? "● canlı konum" : "varsayılan: Maltepe")}
      </span>

      {/* --- HUD: renk anahtarı */}
      <div className="pointer-events-none absolute bottom-6 left-2 z-10 flex flex-col gap-0.5 rounded-lg bg-black/45 px-2.5 py-1.5 text-[10px] text-white/70 backdrop-blur">
        {[
          ["#4ade80", "sırada"],
          ["#fbbf24", "düşünüyor"],
          ["#a78bfa", "randevu"],
          ["#22d3ee", "müşteri"],
          ["#64748b", "arandı"],
        ].map(([renk, etiket]) => (
          <span key={etiket} className="flex items-center gap-1.5">
            <i className="size-2 rounded-full" style={{ background: renk }} />
            {etiket}
          </span>
        ))}
      </div>

      {hata && (
        <p className="absolute bottom-6 right-2 z-10 max-w-[60%] rounded-lg bg-red-500/20 px-2.5 py-1.5 text-[10px] text-red-100 backdrop-blur">
          {hata}
        </p>
      )}

      {/* --- HUD: seçilen işletme kartı (Leaflet popup'ının yerini alır) */}
      {secili && (
        <div className="absolute bottom-2 right-2 z-20 w-[min(20rem,calc(100%-1rem))] rounded-xl border border-white/10 bg-[#0b1220]/95 p-3 text-xs shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{secili.ad}</p>
              <p className="text-[11px] text-white/50">
                {secili.tur}
                {secili.bolge && ` · ${secili.bolge}`} · puan {secili.skor}
              </p>
            </div>
            <button
              onClick={() => setSecili(null)}
              className="shrink-0 rounded-md px-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          {secili.issue && <p className="mt-1.5 leading-relaxed text-white/70">{secili.issue}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {secili.telefon && (
              <a
                href={`tel:${secili.telefon}`}
                className="rounded-lg bg-emerald-400/20 px-2.5 py-1 font-medium text-emerald-100 hover:bg-emerald-400/30"
              >
                ☎ {telefonBicimle(secili.telefon)}
              </a>
            )}
            {secili.website && (
              <a
                href={secili.website.startsWith("http") ? secili.website : `https://${secili.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-white/10 px-2.5 py-1 text-white/80 hover:bg-white/20"
              >
                🌍 site ↗
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${secili.lat},${secili.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/10 px-2.5 py-1 text-white/80 hover:bg-white/20"
            >
              📍 Maps ↗
            </a>
          </div>

          {isaretle && (
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
              {ISARET_DUGMELERI.map((d) => (
                <button
                  key={d.kod}
                  onClick={() => isaretleVeKapat(d.kod)}
                  className={`rounded-lg px-2 py-1 text-[11px] transition-opacity hover:opacity-80 ${d.sinif}`}
                >
                  {d.etiket}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
