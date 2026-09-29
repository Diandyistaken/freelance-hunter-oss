import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

/**
 * "Fetih haritası" — gerçek İstanbul sokakları, oyun görünümü.
 *
 * NEDEN KENDİ STİLİMİZ: hazır stiller (CARTO dark) 9 Eyl 2026'dan beri API
 * anahtarı istiyor ve kutucuğa "API KEY REQUIRED" basıyor. OpenFreeMap
 * (OpenMapTiles şeması, CC-BY OpenStreetMap) anahtarsız ve ücretsiz —
 * kutucukları ham vektör geldiği için görünümü tamamen biz kuruyoruz.
 *
 * Tasarım kararları:
 *   - Zemin gece mavisi; su daha koyu ama parlak kenarlı → şehir "ada" gibi okunur.
 *   - Yollar iki katman: geniş sönük gövde (kılıf) + ince parlak çekirdek.
 *     Ana arterler kehribar, ara sokaklar soğuk mavi — Bağdat Caddesi hattı
 *     haritada kendini belli etsin diye.
 *   - Binalar z15'ten sonra 3B (fill-extrusion); yükseklikle rengi açılır.
 *   - Etiketler az ve sönük: kahraman noktalar (işletmeler) öne çıksın.
 *
 * Kaynak zorunluluğu: OSM atıfı haritanın üstünde AYRI bir katmanda gösterilir
 * (RadarMap.tsx altındaki atıf şeridi) — lisans gereği kaldırılmaz.
 */

const KAYNAK = "openmaptiles";
const TILEJSON = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

// Palet — tek yerde dursun, harita dışı rozetler de buradan beslenir.
export const HARITA_RENK = {
  zemin: "#060912",
  su: "#081a30",
  suKenar: "#12406b",
  yesil: "#0b2418",
  yerlesim: "#0a0f1c",
  binaAlt: "#111a2e",
  binaUst: "#22314f",
  binaKenar: "#2f4570",
  arterKilif: "#1a1408",
  arter: "#f0a04b",
  anaKilif: "#0d1526",
  ana: "#3f6ea8",
  araKilif: "#0a1120",
  ara: "#22304a",
  etiket: "#8fa6cc",
  etiketHale: "#050810",
  sinir: "#2b3d63",
} as const;

export function oyunStili(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      [KAYNAK]: { type: "vector", url: TILEJSON },
    },
    // Işık: 3B hacimlerin gölgelenmesi için — düşük şiddet, gece havası.
    light: { anchor: "viewport", color: "#8ab4ff", intensity: 0.28, position: [1.2, 200, 40] },
    // Ufuk: kamera eğikken haritanın "bittiği" yer siyah kesilmesin, gece
    // göğüne dönüşsün — oyun hissinin yarısı burada.
    sky: {
      "sky-color": "#0a1730",
      "horizon-color": "#1d3358",
      "fog-color": "#070c18",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.5,
      "fog-ground-blend": 0.7,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0, 12, 0.4, 16, 0],
    },
    layers: [
      { id: "zemin", type: "background", paint: { "background-color": HARITA_RENK.zemin } },

      // ---------------------------------------------------------- alan dolgular
      {
        id: "yerlesim",
        type: "fill",
        source: KAYNAK,
        "source-layer": "landuse",
        filter: ["match", ["get", "class"], ["residential", "suburb", "neighbourhood"], true, false],
        paint: { "fill-color": HARITA_RENK.yerlesim, "fill-opacity": 0.55 },
      },
      {
        id: "yesil-alan",
        type: "fill",
        source: KAYNAK,
        "source-layer": "park",
        paint: { "fill-color": HARITA_RENK.yesil, "fill-opacity": 0.75 },
      },
      {
        id: "yesil-ortu",
        type: "fill",
        source: KAYNAK,
        "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["wood", "grass", "farmland"], true, false],
        paint: { "fill-color": HARITA_RENK.yesil, "fill-opacity": 0.5 },
      },

      // ------------------------------------------------------------------- su
      {
        id: "su",
        type: "fill",
        source: KAYNAK,
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-color": HARITA_RENK.su },
      },
      {
        // Kıyı çizgisi parlasın — Marmara kıyısı haritanın omurgası.
        id: "su-kenar",
        type: "line",
        source: KAYNAK,
        "source-layer": "water",
        paint: {
          "line-color": HARITA_RENK.suKenar,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.4, 14, 1.4, 17, 2.4],
          "line-blur": 1.2,
          "line-opacity": 0.9,
        },
      },
      {
        id: "dere",
        type: "line",
        source: KAYNAK,
        "source-layer": "waterway",
        paint: { "line-color": HARITA_RENK.su, "line-width": 1 },
      },

      // ---------------------------------------------------------------- yollar
      // Sıra önemli: önce tüm kılıflar, sonra tüm çekirdekler — kavşaklarda
      // çekirdekler kesintisiz aksın (oyun haritası hissi buradan geliyor).
      {
        id: "yol-ara-kilif",
        type: "line",
        source: KAYNAK,
        "source-layer": "transportation",
        minzoom: 12,
        filter: ["match", ["get", "class"], ["minor", "service", "track"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": HARITA_RENK.araKilif,
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 1.5, 16, 6, 19, 18],
        },
      },
      {
        id: "yol-ana-kilif",
        type: "line",
        source: KAYNAK,
        "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["secondary", "tertiary"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": HARITA_RENK.anaKilif,
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 10, 2, 16, 10, 19, 26],
        },
      },
      {
        id: "yol-arter-kilif",
        type: "line",
        source: KAYNAK,
        "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": HARITA_RENK.arterKilif,
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 8, 2, 16, 16, 19, 38],
          "line-blur": 3,
        },
      },
      {
        id: "yol-ara",
        type: "line",
        source: KAYNAK,
        "source-layer": "transportation",
        minzoom: 13,
        filter: ["match", ["get", "class"], ["minor", "service", "track"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": HARITA_RENK.ara,
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 13, 0.5, 16, 2.5, 19, 8],
          "line-opacity": 0.9,
        },
      },
      {
        id: "yol-ana",
        type: "line",
        source: KAYNAK,
        "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["secondary", "tertiary"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": HARITA_RENK.ana,
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 10, 0.6, 16, 3.5, 19, 11],
          "line-opacity": 0.85,
        },
      },
      {
        id: "yol-arter",
        type: "line",
        source: KAYNAK,
        "source-layer": "transportation",
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": HARITA_RENK.arter,
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 8, 0.8, 16, 5, 19, 15],
          "line-opacity": 0.95,
          "line-blur": 0.4,
        },
      },
      {
        id: "raylı",
        type: "line",
        source: KAYNAK,
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["==", ["get", "class"], "rail"],
        paint: {
          "line-color": "#3a4a6b",
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 18, 2.5],
          "line-dasharray": [3, 2],
          "line-opacity": 0.7,
        },
      },

      // --------------------------------------------------------------- binalar
      // ÖLÇÜM (9 Eyl 2026): OpenFreeMap planet kutucuklarında İstanbul için
      // bina verisi yok denecek kadar az (Suadiye z14 kutucuğunda 8 öznitelik-
      // siz kayıt; OpenFreeMap'in KENDİ "liberty" stili de bir şey çizmiyor).
      // Katman yine de duruyor: veri olan yerde kendiliğinden görünür, maliyeti
      // yok. Oyun hissi bina yerine BÖLGE PRİZMALARINDAN geliyor (RadarMap).
      {
        id: "bina-3b",
        type: "fill-extrusion",
        source: KAYNAK,
        "source-layer": "building",
        minzoom: 14,
        paint: {
          // Yükseklik arttıkça renk açılır → siluet okunur.
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "render_height"], 8],
            0, HARITA_RENK.binaAlt,
            25, HARITA_RENK.binaUst,
            80, HARITA_RENK.binaKenar,
          ],
          // DİKKAT: zoom durakları veri ifadesi (["get", …]) içeremez —
          // içerirse MapLibre katmanı sessizce düşürür (9 Eyl 2026'da yaşandı,
          // binalar hiç çizilmedi). Yükseklik veriden, sönümleme zoom'dan.
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, 0.9],
        },
      },

      // -------------------------------------------------------------- sınırlar
      {
        id: "ilce-siniri",
        type: "line",
        source: KAYNAK,
        "source-layer": "boundary",
        filter: [">=", ["get", "admin_level"], 4],
        paint: {
          "line-color": HARITA_RENK.sinir,
          "line-width": 1,
          "line-dasharray": [2, 3],
          "line-opacity": 0.5,
        },
      },

      // -------------------------------------------------------------- etiketler
      {
        id: "semt-adi",
        type: "symbol",
        source: KAYNAK,
        "source-layer": "place",
        filter: ["match", ["get", "class"], ["suburb", "neighbourhood", "quarter"], true, false],
        layout: {
          "text-field": ["coalesce", ["get", "name:tr"], ["get", "name"]],
          "text-font": ["Noto Sans Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 16, 14],
          "text-letter-spacing": 0.12,
          "text-transform": "uppercase",
        },
        paint: {
          "text-color": HARITA_RENK.etiket,
          "text-halo-color": HARITA_RENK.etiketHale,
          "text-halo-width": 1.6,
          "text-opacity": 0.75,
        },
      },
      {
        id: "yol-adi",
        type: "symbol",
        source: KAYNAK,
        "source-layer": "transportation_name",
        minzoom: 14,
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary"], true, false],
        layout: {
          "symbol-placement": "line",
          "text-field": ["coalesce", ["get", "name:tr"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
        },
        paint: {
          "text-color": "#9db4d8",
          "text-halo-color": HARITA_RENK.etiketHale,
          "text-halo-width": 1.4,
          "text-opacity": 0.65,
        },
      },
      {
        id: "su-adi",
        type: "symbol",
        source: KAYNAK,
        "source-layer": "water_name",
        layout: {
          // Yalnız Regular/Bold doğrulandı (OpenFreeMap glyph uç noktası);
          // olmayan bir font adı etiketi tamamen kaybettirir.
          "text-field": ["coalesce", ["get", "name:tr"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-letter-spacing": 0.2,
        },
        paint: {
          "text-color": "#4f7fb8",
          "text-halo-color": HARITA_RENK.etiketHale,
          "text-halo-width": 1.2,
        },
      },
    ],
  } as StyleSpecification;
}
