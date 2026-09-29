"""Istanbul semt katalogu — panelden tek tek secilebilen tarama bolgeleri.

NEDEN AYRI DOSYA: bolge listesi artik bir AYAR degil, kullanicinin panelden
sectigi bir SECIM. Katalog burada durur (koordinat + kategori), kullanicinin
sectikleri data/radar_bolge_secim.json'da tutulur.

Kategoriler bilincli: "Bana en yakin" (yuruyerek gidilebilir - ilk musteride
en guclu koz), "Bagdat Caddesi hatti" ve digerleri (yuksek biletli isletme
yogunlugu). Koordinatlar semt merkezine yakin secildi; yaricap semtin
yogunluguna gore.
"""

# (ad, lat, lon, yaricap_m, kategori, not)
KATALOG: list[tuple[str, float, float, int, str, str]] = [
    # ---------------- Bana en yakın (yürüme/kısa araç mesafesi) ----------------
    ("Altıntepe", 40.9544, 29.1029, 1500, "Bana en yakın", "Ev — yürüme mesafesi"),
    ("Küçükyalı", 40.9430, 29.1180, 1400, "Bana en yakın", "Komşu semt"),
    ("Bostancı", 40.9540, 29.0940, 1400, "Bana en yakın", "Sahil hattı"),
    ("Maltepe Merkez", 40.9350, 29.1300, 1600, "Bana en yakın", "İlçe merkezi"),
    ("İdealtepe", 40.9480, 29.1120, 1200, "Bana en yakın", "Yürüme mesafesi"),
    ("Cevizli", 40.9210, 29.1450, 1400, "Bana en yakın", "Kartal sınırı"),

    # ---------------- Bağdat Caddesi hattı (varlıklı bant) ----------------
    ("Suadiye", 40.9617, 29.0836, 1600, "Bağdat Caddesi hattı", "Yüksek bilet"),
    ("Caddebostan", 40.9689, 29.0653, 1600, "Bağdat Caddesi hattı", "Yüksek bilet"),
    ("Erenköy", 40.9720, 29.0790, 1500, "Bağdat Caddesi hattı", "Klinik yoğun"),
    ("Göztepe", 40.9780, 29.0640, 1500, "Bağdat Caddesi hattı", "Bağdat Cad."),
    ("Feneryolu", 40.9820, 29.0530, 1300, "Bağdat Caddesi hattı", "Bağdat Cad."),
    ("Fenerbahçe-Kalamış", 40.9760, 29.0400, 1800, "Bağdat Caddesi hattı", "Stadyum çevresi"),
    ("Sahrayıcedit", 40.9740, 29.0900, 1400, "Bağdat Caddesi hattı", "Klinik/ofis"),
    ("Kozyatağı", 40.9720, 29.1030, 1500, "Bağdat Caddesi hattı", "İş merkezi"),
    ("Ataşehir", 40.9923, 29.1244, 2000, "Bağdat Caddesi hattı", "Kurumsal yoğun"),

    # ---------------- Kadıköy merkez ----------------
    ("Kadıköy Merkez", 40.9903, 29.0290, 1800, "Kadıköy merkez", "Moda/Bahariye"),
    ("Moda", 40.9800, 29.0270, 1300, "Kadıköy merkez", "Butik/kafe"),
    ("Acıbadem", 41.0000, 29.0490, 1500, "Kadıköy merkez", "Hastane bandı"),

    # ---------------- Boğaz hattı (Anadolu) ----------------
    ("Üsküdar", 41.0226, 29.0150, 2000, "Boğaz hattı", "Merkez"),
    ("Kuzguncuk", 41.0370, 29.0350, 1100, "Boğaz hattı", "Butik"),
    ("Beylerbeyi", 41.0430, 29.0430, 1200, "Boğaz hattı", "Sahil"),
    ("Çengelköy", 41.0530, 29.0530, 1300, "Boğaz hattı", "Sahil/kafe"),
    ("Kandilli", 41.0700, 29.0600, 1200, "Boğaz hattı", "Villa bandı"),
    ("Beykoz", 41.1200, 29.1000, 1800, "Boğaz hattı", "Geniş"),

    # ---------------- Avrupa lüks ----------------
    ("Nişantaşı", 41.0480, 28.9940, 1400, "Avrupa lüks", "En yüksek bilet"),
    ("Teşvikiye", 41.0510, 28.9970, 1200, "Avrupa lüks", "Klinik/butik"),
    ("Etiler", 41.0800, 29.0330, 1500, "Avrupa lüks", "Villa/klinik"),
    ("Bebek", 41.0770, 29.0430, 1300, "Avrupa lüks", "Sahil lüks"),
    ("Arnavutköy-Kuruçeşme", 41.0680, 29.0400, 1400, "Avrupa lüks", "Sahil"),
    ("Levent", 41.0810, 29.0100, 1600, "Avrupa lüks", "Plaza/ofis"),
    ("Zekeriyaköy", 41.1900, 29.0400, 1800, "Avrupa lüks", "Villa siteleri"),
    ("Florya", 40.9750, 28.7850, 1600, "Avrupa lüks", "Sahil/villa"),
    ("Yeşilköy", 40.9620, 28.8250, 1500, "Avrupa lüks", "Butik/klinik"),
    ("Bakırköy", 40.9770, 28.8720, 1800, "Avrupa lüks", "Merkez"),
]

# Panel hiç seçim yapmadıysa taranacak varsayılan set.
VARSAYILAN_SECIM = [
    "Altıntepe", "Suadiye", "Caddebostan", "Erenköy",
    "Fenerbahçe-Kalamış", "Kadıköy Merkez", "Ataşehir", "Üsküdar",
]

# Denetim sırasında öne alınacak kategoriler (yeni bölge hiç denetlenmemiş
# olur; öncelik verilmezse eski bölgeler her turda önü kapatır).
ONCELIKLI_KATEGORILER = {"Bağdat Caddesi hattı", "Avrupa lüks", "Boğaz hattı"}


def kategoriler() -> dict[str, list[dict]]:
    """Panel için kategori → semt listesi."""
    gruplar: dict[str, list[dict]] = {}
    for ad, lat, lon, r, kat, aciklama in KATALOG:
        gruplar.setdefault(kat, []).append(
            {"ad": ad, "lat": lat, "lon": lon, "yaricap": r, "not": aciklama}
        )
    return gruplar


def bolge_getir(adlar: list[str]) -> list[tuple[str, float, float, int]]:
    """Seçilen semt adlarını tarama biçimine çevirir (bilinmeyen ad atlanır)."""
    harita = {ad: (ad, lat, lon, r) for ad, lat, lon, r, _, _ in KATALOG}
    secilen = [harita[a] for a in adlar if a in harita]
    return secilen or [harita[a] for a in VARSAYILAN_SECIM if a in harita]


def oncelikli_adlar() -> set[str]:
    return {ad for ad, _, _, _, kat, _ in KATALOG if kat in ONCELIKLI_KATEGORILER}
