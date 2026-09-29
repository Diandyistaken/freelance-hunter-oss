"""Yerel Radar — Adım 1: OpenStreetMap Overpass API (ücretsiz, anahtarsız).

Konum çevresindeki isimli işletmeleri çeker. "website" etiketi OLMAYANLAR ana
av adayıdır ("dijital vitrini eksik"). "website" etiketi OLANLAR da listeden
ATILMAZ — OSM etiketi bir sitenin var olduğunu gösterir ama GÜNCEL/kaliteli
olduğunu göstermez; bunlar "sitesi var, kontrol et" olarak ayrı işaretlenip
düşük öncelikle listeye eklenir, kullanıcı linke tıklayıp siteyi kendi gözüyle
inceler (otomatik site içeriği taraması YOK — insan kararı). Google Places
(places.py) anahtar girilince yalnızca av adaylarını zenginleştirmek için
devreye girer. Maliyet: $0.

Zincir şubeler ("brand" etiketi taşıyanlar + OSM'de brand eksik girilse
bile isimden tanınan büyük zincirler, bkz. _ZINCIR_ANAHTAR) ve OSM'de
kalıcı kapanmış işaretlenenler ("disused:"/"was:"/"abandoned:" önekli
etiketler) baştan elenir — butik/bağımsız esnaf hedeflendiği için. Aynı
mantıkla kamu kurumları da (aile sağlığı merkezi, belediye...) elenir —
bkz. _KAMU_ANAHTAR.

Telefonu OLMAYANLAR da elenir — arayıp anlaşılamayacak bir işletmenin av
listesinde bulunmasının bir anlamı yok, kullanıcı her satırı fiilen arıyor.

Tür filtreleri (shop/amenity/office) artık KEYFİ ETİKET değil, "bu işletme
gerçekten bir web sitesi/vitrin/randevu sayfası SATIN ALIR MI" mantığıyla
seçilmiş bir beyaz listedir. Eczane (fiyatlar sabit, reklam/randevu ihtiyacı
yok, semt başına onlarca tane var → av listesini tek başına boğuyordu) ve
genel "doctors"/muayenehane (sağlık reklamı yasal olarak kısıtlı, düşük
dönüşüm) bu yüzden bilerek dışarıda bırakıldı. Eskiden `["shop"]` ve
`["office"]` HİÇBİR değer filtresi olmadan her şeyi çekiyordu (market,
bakkal, telefon tamircisi, kuru temizleme zinciri...) — artık yalnızca
vitrin/portfolyo/randevu ile gerçekten satılabilir türler taranıyor.
"""

import time

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_RETRY_STATUS = {429, 502, 503, 504}
_MAX_RETRIES = 2

# Vitrin/menü/randevu sayfasına gerçekten dönüşen işletme türleri — eczane ve
# genel muayenehane bilerek YOK (bkz. modül docstring'i).
AMENITY = ("restaurant|cafe|fast_food|bar|dentist|clinic|"
           "veterinary|driving_school|language_school|kindergarten")
LEISURE = "fitness_centre|sports_centre|dance"
# Ürün/portfolyo vitrinine ihtiyaç duyan butik dükkan türleri — market,
# bakkal, telefon/elektronik tamircisi gibi komoditeler bilerek dışarıda.
SHOP = ("hairdresser|beauty|tailor|florist|jewelry|furniture|pet|bakery|"
        "clothes|shoes|gift|optician|photo|interior_decoration|wedding|"
        "estate_agent|travel_agency|car_repair")
# Ofis türlerinde yalnız avukatlık bürosu — diğer office=* değerleri
# (sigorta acenteleri, kurumsal ofisler...) hedef kitle dışı.
OFFICE = "lawyer"

# Zincir/kamu eleme listeleri radar v2 (Overture) ile ORTAK — tek doğruluk
# kaynağı filtreler.py, iki motorun aynı işletmeyi farklı elemesin diye.
from services.radar.filtreler import bilinen_zincir_mi as _bilinen_zincir_mi  # noqa: E402
from services.radar.filtreler import kamu_kurumu_mu as _kamu_kurumu_mu  # noqa: E402


def scan_area(lat: float, lon: float, radius_m: int = 1500) -> list[dict]:
    """Yarıçap içindeki isimli, web sitesi etiketi OLMAYAN işletmeler."""
    query = f"""
[out:json][timeout:40];
(
  node(around:{radius_m},{lat},{lon})["shop"~"{SHOP}"]["name"];
  node(around:{radius_m},{lat},{lon})["amenity"~"{AMENITY}"]["name"];
  node(around:{radius_m},{lat},{lon})["office"~"{OFFICE}"]["name"];
  node(around:{radius_m},{lat},{lon})["leisure"~"{LEISURE}"]["name"];
);
out body 300;
"""
    resp = None
    for attempt in range(_MAX_RETRIES + 1):
        resp = requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": "FreelanceHunter/1.0 (kisisel radar; iletisim: you@example.com)"},
            timeout=90,
        )
        if resp.status_code == 200:
            break
        if resp.status_code in _RETRY_STATUS and attempt < _MAX_RETRIES:
            time.sleep(5 * (attempt + 1))  # ücretsiz Overpass sunucusu yoğunken 504 atabiliyor
            continue
        raise RuntimeError(f"Overpass {resp.status_code}: {resp.text[:300]}")

    hits = []
    for el in resp.json().get("elements", []):
        tags = el.get("tags", {})
        # Zincir/franchise şubesi — OSM'de "brand" etiketi bir merkeze bağlı
        # şube demektir (ör. Starbucks, Simit Sarayı şubeleri hep brand
        # taşır); bunlar zaten kurumsal web sitesine sahip, butik esnaf değil.
        if tags.get("brand") or tags.get("brand:wikidata"):
            continue
        if _bilinen_zincir_mi(tags.get("name", "")):
            continue
        # Kalıcı kapanmış: OSM'de "disused:"/"was:"/"abandoned:" önekli
        # etiketler işletmenin artık faal olmadığını gösterir.
        if any(key.startswith(("disused:", "was:", "abandoned:")) for key in tags):
            continue
        phone = (tags.get("phone") or tags.get("contact:phone")
                  or tags.get("contact:mobile") or tags.get("mobile") or "")
        # Telefonsuz işletme aranamaz — av listesinde işe yaramaz, elenir.
        if not phone:
            continue
        # Kamu kurumu (devlet hastanesi/aile sağlığı merkezi/belediye...) —
        # web sitesi satın almaz, elenir.
        if _kamu_kurumu_mu(tags.get("name", "")):
            continue
        website = tags.get("website") or tags.get("contact:website") or tags.get("url") or ""
        kind = (tags.get("shop") or tags.get("amenity")
                or tags.get("leisure") or tags.get("office") or "isletme")
        hits.append({
            "name": tags["name"],
            "kind": kind,
            "lat": el["lat"],
            "lon": el["lon"],
            "phone": phone,
            "street": tags.get("addr:street", ""),
            "website": website,
        })
    return hits
