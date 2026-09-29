"""Radar v2 — Adım 1: işletme keşfi (Overture Maps açık veri seti).

NEDEN OSM/OVERPASS DEĞİL
------------------------
Radar v2'nin hedefi "sitesi OLAN ama sitesi kötü/görünmez" işletme. OSM bu iş
için ölçüldü ve yetersiz çıktı — ev merkezli 2.500 m'de 500 isimli işletmenin
yalnız 18'inde hem telefon hem `website` etiketi vardı, onların da çoğu zincir
(Starbucks, H&M) ya da Yemeksepeti linkiydi. Aynı bölgede Overture: hedef
kategorilerde 2.865 telefonlu+siteli işletme, 2.469'u kendi alan adına sahip
bağımsız esnaf. (Ölçüm: 2 Ağu 2026.)

YASALLIK — bu modül hiçbir siteye dokunmaz
------------------------------------------
Overture Maps Foundation'ın herkese açık yayınladığı veri seti (CC BY 4.0)
doğrudan public S3 kovasından okunur. Kazıma yok, oturum/giriş yok, hedef
işletmelerin sitelerine tek bir istek bile gitmez — burada sadece "hangi
işletmenin hangi adresi var" bilgisi toplanır. Sitelerin denetimi ayrı
modülde ve yalnız public sinyallerle yapılır (bkz. audit.py yasak listesi).

MALİYET: $0. API anahtarı yok, kredi kartı yok, kota yok. Sonuç diske
önbelleklenir (veri seti ayda bir yayınlanır). SÜRE: 2 Ağu'da siteliler için
15-25 sn ölçülmüştü; havuz (8 bölge, sitesizler dahil, ~12.900 kayıt) 25 Eyl
ölçümünde 3,5-5 dk sürdü — eski ve yeni sorgu biçimi aynı sürede. Yeni sürüm
çıkınca yalnız ilk "Havuzu yenile" bu kadar bekler, sonrası önbellekten gelir.

ŞEMA: 2026-09-23.0 ile `categories` kalktı, `taxonomy` geldi (bkz.
TAKSONOMI_ESKI_AD). Sorgu kategori alanını her seferinde sürümün şemasından
seçer; ikisi de yoksa ne olduğunu söyleyen bir hata verir.
"""

import hashlib
import json
import math
import re
import time
from datetime import datetime

import requests

from packages.shared.config import settings
from services.radar.filtreler import (
    alan_adi,
    bilinen_zincir_mi,
    kamu_kurumu_mu,
    platform_sitesi_mi,
)

S3_BUCKET = "overturemaps-us-west-2"
S3_LISTE = f"https://{S3_BUCKET}.s3.amazonaws.com/"
# Otomatik sürüm tespiti başarısız olursa kullanılacak, canlı doğrulanmış sürüm.
# Overture eski sürümleri ~2 ay sonra kovadan SİLİYOR: burada 2026-07-22.0
# duruyordu ve 25 Eyl'de artık yoktu — yedek, düştüğü an kırık çıkacaktı.
# Güncellerken kovada hâlâ durduğunu doğrula.
YEDEK_SURUM = "2026-09-23.0"
ONBELLEK_DIR = settings.data_dir / "overture"

# Hedef kitle: "web sitesi/vitrin/randevu sayfası SATIN ALIR MI" süzgecinden
# geçmiş kategoriler. Liste tahminle değil, 4 bölgede fiilen bulunan Overture
# kategorileri sayılarak kuruldu (2 Ağu 2026).
#
# BİLEREK DIŞARIDA: doctor/medical_center/hospital (sağlık reklamı yasal
# kısıtlı, dönüşüm düşük — overpass.py'deki muayenehane kararıyla aynı),
# advertising_agency/software_development/it_service (rakip, sitesini kendi
# yapar), bank/atm/insurance/corporate_office (kurumsal, karar yerel değil),
# elementary_school/high_school/college/hospital (kamu ya da çok büyük),
# electronics/mobile_phone_store/hardware_store (komodite, vitrin satmaz).
KATEGORI_TR: dict[str, str] = {
    # --- yeme & içme ---
    "restaurant": "Restoran",
    "turkish_restaurant": "Türk mutfağı restoran",
    "seafood_restaurant": "Balık restoranı",
    "pizza_restaurant": "Pizzacı",
    "italian_restaurant": "İtalyan restoran",
    "steakhouse": "Steakhouse",
    "sushi_restaurant": "Suşi restoranı",
    "burger_restaurant": "Burgerci",
    "kebab_restaurant": "Kebapçı",
    "breakfast_and_brunch_restaurant": "Kahvaltı & brunch",
    "meyhane": "Meyhane",
    "cafe": "Kafe",
    "coffee_shop": "Kahveci",
    "tea_room": "Çay evi",
    "bakery": "Fırın/Pastane",
    "desserts": "Tatlıcı",
    "ice_cream_shop": "Dondurmacı",
    "bar": "Bar",
    "cocktail_bar": "Kokteyl bar",
    "wine_bar": "Şarap evi",
    "brewery": "Bira evi",
    "juice_bar_and_smoothies": "Smoothie & meyve suyu",
    "food_truck": "Yemek aracı",
    "caterer": "Catering firması",
    # --- güzellik & bakım ---
    "hair_salon": "Kuaför",
    "barber": "Berber",
    "beauty_salon": "Güzellik salonu",
    "beauty_and_spa": "Güzellik & spa",
    "spas": "Spa",
    "day_spa": "Spa merkezi",
    "nail_salon": "Nail studio",
    "massage": "Masaj salonu",
    "hair_removal": "Epilasyon merkezi",
    "makeup_artist": "Makyaj sanatçısı",
    "tattoo_and_piercing": "Dövme & piercing",
    "tanning_salon": "Solaryum",
    # --- sağlık (reklamı yapılabilen, randevu odaklı dallar) ---
    "dentist": "Diş kliniği",
    "dental_clinic": "Diş kliniği",
    "orthodontist": "Ortodontist",
    "plastic_surgeon": "Estetik cerrah",
    "cosmetic_dentist": "Estetik diş hekimi",
    "dermatologist": "Dermatolog",
    "psychologist": "Psikolog",
    "counseling_and_mental_health": "Psikolojik danışmanlık",
    "physical_therapy": "Fizik tedavi",
    "nutritionist": "Diyetisyen",
    "veterinarian": "Veteriner",
    "animal_hospital": "Hayvan hastanesi",
    "optometrist": "Optisyen",
    "eyewear_and_opticians": "Gözlükçü",
    "hearing_aid_provider": "İşitme merkezi",
    # --- konaklama ---
    "hotel": "Otel",
    "boutique_hotel": "Butik otel",
    "bed_and_breakfast": "Pansiyon",
    "guest_house": "Konukevi",
    "hostel": "Hostel",
    "vacation_rental": "Kiralık tatil evi",
    # --- profesyonel butik hizmet ---
    "lawyer": "Avukatlık bürosu",
    "notary": "Noter/danışman",
    "accountant": "Mali müşavir",
    "architectural_designer": "Mimar",
    "interior_design": "İç mimari",
    "landscaping": "Peyzaj",
    "real_estate_agent": "Emlak danışmanı",
    "real_estate": "Emlak ofisi",
    "property_management": "Site/emlak yönetimi",
    "event_planning": "Organizasyon firması",
    "wedding_planning": "Düğün organizasyonu",
    "photographer": "Fotoğrafçı",
    "photography_studio": "Fotoğraf stüdyosu",
    "videographer": "Video prodüksiyon",
    "travel_services": "Seyahat acentesi",
    "travel_agency": "Seyahat acentesi",
    "car_rental_agency": "Araç kiralama",
    # --- özel eğitim & kurs ---
    "preschool": "Anaokulu",
    "child_care_and_day_care": "Kreş",
    "language_school": "Dil kursu",
    "driving_school": "Sürücü kursu",
    "music_school": "Müzik kursu",
    "art_school": "Sanat atölyesi",
    "tutoring_center": "Etüt merkezi",
    "dance_school": "Dans kursu",
    "specialty_school": "Özel kurs",
    # --- spor & hareket ---
    "gym": "Spor salonu",
    "fitness_center": "Fitness merkezi",
    "pilates_studio": "Pilates stüdyosu",
    "yoga_studio": "Yoga stüdyosu",
    "martial_arts_school": "Dövüş sporları kulübü",
    "swimming_pool": "Yüzme havuzu",
    "sports_club": "Spor kulübü",
    # --- butik perakende (vitrin/portfolyo satar) ---
    "furniture_store": "Mobilyacı",
    "home_goods_store": "Ev tekstili/dekorasyon",
    "antique_store": "Antikacı",
    "art_gallery": "Sanat galerisi",
    "arts_and_crafts": "El sanatları atölyesi",
    "jewelry_store": "Kuyumcu",
    "watch_store": "Saatçi",
    "clothing_store": "Giyim mağazası",
    "womens_clothing_store": "Kadın giyim",
    "mens_clothing_store": "Erkek giyim",
    "childrens_clothing_store": "Çocuk giyim",
    "bridal_shop": "Gelinlik evi",
    "shoe_store": "Ayakkabıcı",
    "leather_goods": "Deri ürünleri",
    "flowers_and_gifts_shop": "Çiçekçi & hediyelik",
    "florist": "Çiçekçi",
    "gift_shop": "Hediyelik eşya",
    "bookstore": "Kitapçı",
    "pet_store": "Pet shop",
    "pet_groomer": "Pet kuaförü",
    "cosmetic_and_beauty_supplies": "Kozmetik mağazası",
    "toy_store": "Oyuncakçı",
    "bicycle_shop": "Bisikletçi",
    "music_store": "Müzik aletleri",
    "sporting_goods": "Spor mağazası",
    "tailor": "Terzi",
    "dry_cleaning": "Kuru temizleme",
    "carpet_store": "Halıcı",
    "lighting_store": "Aydınlatma mağazası",
    "kitchen_and_bath": "Mutfak & banyo",
    # --- servis ---
    "automotive_repair": "Oto servis",
    "car_wash": "Oto yıkama",
    "auto_detailing": "Oto detailing",
    "moving_company": "Nakliyat firması",
}

# YENİ TAKSONOMİ ADI → ESKİ ANAHTAR.
#
# 2026-09-23.0 sürümüyle `categories` alanı kaldırıldı; yerini 2026-08'de
# eklenen `taxonomy` aldı ve hedef kategorilerden 26'sının adı değişti. Yalnız
# alan adını değiştirmek hatayı gideriyor ama havuzu SESSİZCE küçültüyordu:
# 8 varsayılan bölgede 12.723 kaydın 2.809'u (%22) düşüyordu — spa, avukat,
# psikolog, dans kursu, diyetisyen...
#
# Tablo tahmin değil, ölçüm: iki alanın birlikte bulunduğu 2026-08-19.0'da
# Türkiye kutusundaki 637.650 hedef kayıt eşleştirildi; her eski ad %100 TEK
# bir yeni ada gidiyor. Eski anahtara çevirmek, `kind`/`kind_tr`'ye bağlı her
# şeyi (fikir kancaları, saha katsayısı, panel) olduğu gibi bırakıyor.
# Türkiye'de hiç görülmeyen 20 anahtar (ör. massage, notary) doğrulanamadı;
# yeni taksonomide aynı adla gelirse zaten eşleşir.
TAKSONOMI_ESKI_AD: dict[str, str] = {
    "arts_crafts_and_hobby_store": "arts_and_crafts",
    "attorney_or_law_firm": "lawyer",
    "beauty_supply_store": "cosmetic_and_beauty_supplies",
    "behavioral_or_mental_health_clinic": "counseling_and_mental_health",
    "bike_store": "bicycle_shop",
    "car_rental_service": "car_rental_agency",
    "cosmetic_dentistry": "cosmetic_dentist",
    "dance_studio": "dance_school",
    "dental_clinic": "dentist",
    "dermatology": "dermatologist",
    "dessert_shop": "desserts",
    "flowers_and_gifts_store": "flowers_and_gifts_shop",
    "food_truck_stand": "food_truck",
    "hearing_aid_store": "hearing_aid_provider",
    "kitchen_and_bath_store": "kitchen_and_bath",
    "leather_goods_store": "leather_goods",
    "nutrition_service": "nutritionist",
    "optometry": "optometrist",
    "orthodontics": "orthodontist",
    "photography_service": "photographer",
    "plastic_and_reconstructive_surgery": "plastic_surgeon",
    "psychology": "psychologist",
    "spa": "spas",
    "sporting_goods_store": "sporting_goods",
    "travel_service": "travel_services",
    "tutoring_service": "tutoring_center",
}

# Kategori adlarında yalnızca bu karakterler beklenir — SQL'e literal olarak
# gömülmeden önce doğrulanır (dışarıdan veri gelmiyor ama kural kuraldır).
_GUVENLI_KATEGORI = re.compile(r"^[a-z0-9_]+$")


def _kategori_listesi_sql() -> str:
    """Sorgudaki IN listesi: eski anahtarlar + yeni taksonomi adları."""
    adlar = dict.fromkeys([*KATEGORI_TR, *TAKSONOMI_ESKI_AD])
    return ", ".join(f"'{k}'" for k in adlar if _GUVENLI_KATEGORI.match(k))


def _kategori_ifadesi(sutunlar: set[str]) -> str:
    """Sürümün şemasına göre kategori alanı.

    `taxonomy` varsa o (2026-08 ve sonrası), yoksa eski `categories`. İkisi de
    yoksa Overture şemayı yine değiştirmiştir: DuckDB'nin "Referenced table
    categories not found" hatası yerine ne olduğunu söyleyen bir hata.
    """
    if "taxonomy" in sutunlar:
        return "taxonomy.primary"
    if "categories" in sutunlar:
        return "categories.primary"
    raise RuntimeError(
        "Overture sürümünde kategori alanı yok (ne `taxonomy` ne `categories`) — "
        f"şema değişmiş olabilir. Mevcut sütunlar: {sorted(sutunlar)}. Geçici çözüm: "
        ".env'de OVERTURE_RELEASE ile önceki sürümü sabitle."
    )


def son_surum(zaman_asimi: int = 20) -> str:
    """Overture'ın en yeni yayın sürümü (public S3 listesinden).

    Veri seti ayda bir yayınlanır; sabit sürüm gömmek zamanla bayatlar.
    Liste alınamazsa canlı doğrulanmış YEDEK_SURUM'a düşer.
    """
    if settings.overture_release:
        return settings.overture_release
    try:
        resp = requests.get(
            S3_LISTE,
            params={"list-type": "2", "prefix": "release/", "delimiter": "/"},
            timeout=zaman_asimi,
        )
        resp.raise_for_status()
        surumler = re.findall(r"<Prefix>release/([^<]+)/</Prefix>", resp.text)
        # "2026-07-22.0" biçimindekiler; alfabetik sıralama = kronolojik sıralama
        gecerli = sorted(s for s in surumler if re.match(r"^\d{4}-\d{2}-\d{2}\.\d+$", s))
        if gecerli:
            return gecerli[-1]
    except Exception as exc:  # ağ/S3 sorunu taramayı durdurmasın
        # NOT: Windows konsolu cp1254 — print'lerde ok/emoji gibi ASCII dışı
        # karakter KULLANMA, UnicodeEncodeError ile taramayı çökertir.
        print(f"Overture surum tespiti basarisiz ({exc}) -> {YEDEK_SURUM}")
    return YEDEK_SURUM


def _bbox(lat: float, lon: float, radius_m: int) -> tuple[float, float, float, float]:
    """Merkez+yarıçaptan (min_lat, max_lat, min_lon, max_lon)."""
    dlat = radius_m / 111_320
    dlon = radius_m / (111_320 * max(math.cos(math.radians(lat)), 0.01))
    return lat - dlat, lat + dlat, lon - dlon, lon + dlon


def _mesafe_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Kaba (düzlemsel) mesafe — yalnız "hangi bölgeye daha yakın" için yeterli."""
    dlat = (lat1 - lat2) * 111_320
    dlon = (lon1 - lon2) * 111_320 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dlat, dlon)


def _onbellek_yolu(surum: str, bolgeler: list[tuple[str, float, float, int]],
                   sitesiz_dahil: bool) -> "object":
    imza = json.dumps([surum, sorted(bolgeler), sitesiz_dahil], ensure_ascii=False)
    ad = hashlib.sha1(imza.encode("utf-8")).hexdigest()[:12]
    return ONBELLEK_DIR / f"{surum}_{ad}.json"


def _duckdb():
    try:
        import duckdb  # noqa: PLC0415 — isteğe bağlı bağımlılık, sadece radar v2'de gerekli
    except ImportError as exc:
        raise RuntimeError(
            "Radar v2 için duckdb gerekli. Kur: pip install duckdb "
            "(ücretsiz, yalnız açık veri setini okumak için)"
        ) from exc
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
    # İlerleme çubuğu ASCII dışı karakter basıyor (Windows cp1254'te çöker) +
    # log dosyasını kirletiyor.
    con.execute("SET enable_progress_bar=false;")
    return con


def _satiri_ave_cevir(row: dict, bolgeler: list[tuple[str, float, float, int]]) -> dict | None:
    """Overture satırını radar av kaydına çevirir; elenmesi gerekiyorsa None."""
    ad = (row.get("ad") or "").strip()
    if not ad:
        return None
    if row.get("marka"):          # Overture "brand" doluysa zincir şubesi
        return None
    if bilinen_zincir_mi(ad) or kamu_kurumu_mu(ad):
        return None

    siteler = [s for s in (row.get("siteler") or []) if s]
    # Birden fazla adres varsa işletmenin KENDİ sitesi tercih edilir; yoksa
    # elindeki tek adres bir platform sayfasıdır ve bu başlı başına kancadır.
    kendi = next((s for s in siteler if not platform_sitesi_mi(s)), "")
    website = kendi or (siteler[0] if siteler else "")
    platform_sayfasi = bool(website) and not kendi

    telefonlar = [t for t in (row.get("telefonlar") or []) if t]
    # İşletmenin KENDİ ilan ettiği e-posta (varsa) — tahmin DEĞİL. Yoksa panel
    # "info@alanadi" önerir ama "tahmin" diye işaretler; onaylamak kullanıcıda.
    epostalar = [e for e in (row.get("epostalar") or []) if e and "@" in e]
    lat, lon = float(row["lat"]), float(row["lon"])
    bolge = min(bolgeler, key=lambda b: _mesafe_m(lat, lon, b[1], b[2]))[0]
    ham_kat = row.get("kat") or ""
    kat = TAKSONOMI_ESKI_AD.get(ham_kat, ham_kat)

    return {
        "name": ad,
        "kind": kat or "isletme",
        "kind_tr": KATEGORI_TR.get(kat, "İşletme"),
        "lat": lat,
        "lon": lon,
        "phone": telefonlar[0] if telefonlar else "",
        "eposta": epostalar[0] if epostalar else "",
        "street": (row.get("adres") or "").strip(),
        "website": website,
        "domain": alan_adi(website),
        "platform_sayfasi": platform_sayfasi,
        "confidence": round(float(row.get("guven") or 0), 3),
        "kaynak_sayisi": int(row.get("kaynak_sayisi") or 0),
        "bolge": bolge,
        "kaynak": "overture",
    }


def tara(bolgeler: list[tuple[str, float, float, int]] | None = None,
         sitesiz_dahil: bool | None = None,
         onbellek_kullan: bool = True) -> list[dict]:
    """Verilen bölgelerdeki hedef-kategori işletmeleri (tek sorguda).

    Varsayılan: yalnız TELEFONU ve WEB SİTESİ olan işletmeler — radar v2'nin
    hedefi zaten "sitesi var ama kötü" olan işletme. `sitesiz_dahil=True`
    eski (sitesiz esnaf) katmanını da açar; kullanıcı kararıyla varsayılan
    KAPALI, çünkü o motor 100 aramada 0 dönüş verdi.
    """
    bolgeler = bolgeler or settings.radar_bolgeler()
    if sitesiz_dahil is None:
        sitesiz_dahil = settings.radar_sitesiz_katman

    surum = son_surum()
    ONBELLEK_DIR.mkdir(parents=True, exist_ok=True)
    onbellek = _onbellek_yolu(surum, bolgeler, sitesiz_dahil)
    if onbellek_kullan and onbellek.exists():
        try:
            kayit = json.loads(onbellek.read_text(encoding="utf-8"))
            print(f"Overture onbellegi kullanildi ({len(kayit['avlar'])} isletme, "
                  f"surum {surum}, {kayit.get('tarih', '?')})")
            return kayit["avlar"]
        except Exception:
            pass  # bozuk önbellek sorun değil, yeniden sorgulanır

    kaynak = (f"read_parquet('s3://{S3_BUCKET}/release/{surum}"
              f"/theme=places/type=place/*', hive_partitioning=1)")
    kutular = " OR ".join(
        f"(bbox.xmin BETWEEN {lo_min} AND {lo_max} AND bbox.ymin BETWEEN {la_min} AND {la_max})"
        for la_min, la_max, lo_min, lo_max in (_bbox(lat, lon, r) for _, lat, lon, r in bolgeler)
    )
    site_kosulu = "" if sitesiz_dahil else "AND websites IS NOT NULL AND len(websites) > 0"

    t0 = time.time()
    con = _duckdb()
    try:
        # Şema sürümden sürüme değişiyor (bkz. TAKSONOMI_ESKI_AD): kategori
        # alanı sorgudan ÖNCE ilk dosyanın şemasından okunur.
        sutunlar = {s[0] for s in con.execute(f"DESCRIBE SELECT * FROM {kaynak}").fetchall()}
        satirlar = _sorgula(con, kaynak, kutular, site_kosulu, _kategori_ifadesi(sutunlar))
    finally:
        con.close()

    avlar = [av for av in (_satiri_ave_cevir(s, bolgeler) for s in satirlar) if av]
    print(f"Overture {surum}: {len(satirlar)} kayit -> {len(avlar)} aday "
          f"({time.time() - t0:.1f} sn)")

    onbellek.write_text(
        json.dumps({"surum": surum, "tarih": datetime.now().isoformat(timespec="seconds"),
                    "avlar": avlar}, ensure_ascii=False),
        encoding="utf-8",
    )
    return avlar


def _sorgula(con, kaynak: str, kutular: str, site_kosulu: str, kat_alani: str) -> list[dict]:
    """Tek sorgu: bölge kutuları × hedef kategoriler × telefon/güven süzgeci."""
    sorgu = f"""
        SELECT names.primary        AS ad,
               {kat_alani}          AS kat,
               confidence           AS guven,
               websites             AS siteler,
               phones               AS telefonlar,
               emails               AS epostalar,
               addresses[1].freeform AS adres,
               brand.names.primary  AS marka,
               len(sources)         AS kaynak_sayisi,
               bbox.xmin            AS lon,
               bbox.ymin            AS lat
        FROM {kaynak}
        WHERE ({kutular})
          AND {kat_alani} IN ({_kategori_listesi_sql()})
          AND confidence >= {float(settings.overture_min_confidence)}
          AND phones IS NOT NULL AND len(phones) > 0
          {site_kosulu}
    """
    sonuc = con.execute(sorgu)
    kolonlar = [c[0] for c in sonuc.description]
    return [dict(zip(kolonlar, s, strict=True)) for s in sonuc.fetchall()]
