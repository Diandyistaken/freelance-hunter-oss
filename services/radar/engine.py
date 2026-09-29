"""Radar motoru.

RADAR v2 (GÜNCEL AKIŞ) — `run_radar_v2()`
-----------------------------------------
Hedef: işi İYİ GİDEN ama sitesi kötü/görünmez işletme.
  Overture (işletme keşfi) → audit (yasal site denetimi) → skor (iki eksen)
  → data/radar.json (hedef skoruna göre sıralı)
Maliyet $0, AI çağrısı yok, tüm sinyaller herkese açık.

RADAR v1 (EMEKLİ) — `run_radar()`, `run_radar_yakin()`, `run_radar_all()`
------------------------------------------------------------------------
Sitesi OLMAYAN esnafı bulup soğuk arama akışıydı; 100 aramada 0 dönüş verdiği
için kullanıcı kararıyla devre dışı. Kod SİLİNMEDİ — `RADAR_SITESIZ_KATMAN=1`
ile ikincil katman olarak geri açılabilir (bkz. config.py). Yeni taramalarda
çağrılmaz.
"""

import json
import time
from datetime import datetime

from packages.shared import db
from packages.shared.config import settings
from services.radar import audit, overture
from services.radar.audit import Denetim, denetle
from services.radar.overpass import scan_area
from services.radar.skor import degerlendir, kalite_puani

RADAR_JSON = settings.data_dir / "radar.json"
# v1 (EMEKLİ "sitesiz esnaf") taraması ARTIK radar.json'a YAZMAZ.
# Sebep (16 Ağu 2026): paneldeki "Yakın Tarama"/"Geniş Tarama" düğmelerine
# basılınca v1 sonucu radar.json'u eziyordu; panel de surum!=2 görünce eski
# "Sitesiz İşletmeler" arayüzüne düşüyordu. Kullanıcı haklı olarak "eski
# versiyon açılıyor" dedi — kod değil VERİ geriye gidiyordu. v1 çıktısı
# kendi dosyasına yazılır, sıcak lead listesi asla bozulmaz.
RADAR_V1_JSON = settings.data_dir / "radar_v1.json"

# Web sitesi / rezervasyon / menü işine en kolay dönüşen türler — overpass.py
# SHOP/AMENITY/OFFICE beyaz listesiyle birebir eşleşir (eczane/muayenehane/
# market gibi vitrine ihtiyacı olmayan türler bilerek yok, bkz. overpass.py).
HIGH_VALUE = {
    "hairdresser", "beauty", "dentist", "clinic", "restaurant",
    "cafe", "fitness_centre", "car_repair", "estate_agent", "bakery",
    "travel_agency", "veterinary", "driving_school", "lawyer", "tailor",
    "florist", "pet", "furniture", "jewelry", "clothes", "shoes",
    "optician", "photo", "wedding", "interior_decoration",
}

KIND_TR = {
    "hairdresser": "Kuaför/Berber", "beauty": "Güzellik salonu",
    "dentist": "Diş kliniği", "clinic": "Klinik",
    "restaurant": "Restoran", "cafe": "Kafe", "fast_food": "Fast food",
    "fitness_centre": "Spor salonu", "car_repair": "Oto servis",
    "estate_agent": "Emlak ofisi", "bakery": "Fırın/Pastane",
    "travel_agency": "Seyahat acentesi", "veterinary": "Veteriner",
    "driving_school": "Sürücü kursu", "language_school": "Dil kursu",
    "clothes": "Giyim mağazası", "florist": "Çiçekçi", "tailor": "Terzi",
    "jewelry": "Kuyumcu", "furniture": "Mobilyacı", "pet": "Pet shop",
    "lawyer": "Avukatlık bürosu", "kindergarten": "Kreş", "bar": "Bar",
    "shoes": "Ayakkabıcı", "gift": "Hediyelik eşya", "optician": "Gözlükçü",
    "photo": "Fotoğrafçı", "interior_decoration": "İç mimari/dekorasyon",
    "wedding": "Gelinlik/düğün organizasyonu",
}


def _kind_tr(kind: str) -> str:
    return KIND_TR.get(kind, kind.replace("_", " ").capitalize())


def _score(hit: dict) -> int:
    """Kural tabanlı Av puanı — Places verisi gelince zenginleşecek."""
    s = 55 if not hit.get("website") else 30  # site yoksa yüksek taban, varsa düşük (öncelik siteless'te)
    if hit["phone"]:
        s += 15  # ulaşılabilir — satış görüşmesi mümkün
    if hit["kind"] in HIGH_VALUE:
        s += 15  # siteye/rezervasyona dönüşme olasılığı yüksek tür
    if hit["street"]:
        s += 5   # kayıt kaliteli, adres doğrulanabilir
    return min(s, 95)


def _isle(hits: list[dict], bolge: str) -> list[dict]:
    for h in hits:
        h.setdefault("website", "")
        h["score"] = _score(h)
        h["kind_tr"] = _kind_tr(h["kind"])
        # Site etiketi var diye otomatik elenmiyor/taranmıyor (scraping YOK) —
        # kullanıcı linke tıklayıp siteyi kendi gözüyle inceler (eski/güncel mi).
        h["issue"] = "Sitesi var — kontrol et (eski olabilir)" if h["website"] else "Web sitesi yok"
        h["bolge"] = bolge
    return hits


def _kota_ile_kirp(hits: list[dict], limit: int, kota_orani: float = 0.15) -> list[dict]:
    """Puana göre sıralı listeyi `limit`'e kırpar — ama "sitesi var" işletmeler
    her zaman daha düşük puanlandığı için limit dolduğunda tamamen ekarte
    olabiliyorlardı. En iyi puanlı birkaçına küçük bir kota ayırıp listede
    görünür kalmalarını garanti eder (kullanıcı "eski site" olanları da görmek
    istiyor)."""
    sitesiz = sorted((h for h in hits if not h.get("website")), key=lambda h: h["score"], reverse=True)
    siteli = sorted((h for h in hits if h.get("website")), key=lambda h: h["score"], reverse=True)
    if not siteli:
        return sitesiz[:limit]
    kota = min(len(siteli), max(1, round(limit * kota_orani)))
    secilenler = sitesiz[: max(0, limit - kota)] + siteli[:kota]
    secilenler.sort(key=lambda h: h["score"], reverse=True)
    return secilenler[:limit]


def run_radar(lat: float | None = None, lon: float | None = None,
              radius_m: int | None = None, bolge: str = "Altıntepe",
              limit: int = 40) -> dict:
    """Tek bölge taraması (hızlı) — ev çevresi varsayılan."""
    lat = lat if lat is not None else settings.radar_lat
    lon = lon if lon is not None else settings.radar_lon
    radius_m = radius_m or settings.radar_radius_m

    hits = _isle(scan_area(lat, lon, radius_m), bolge)
    hits.sort(key=lambda h: h["score"], reverse=True)

    data = {
        "scanned_at": datetime.now().isoformat(timespec="seconds"),
        "center": {"lat": lat, "lon": lon},
        "radius_m": radius_m,
        "bolgeler": [bolge],
        "hits": _kota_ile_kirp(hits, limit),
    }
    RADAR_V1_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1),
                             encoding="utf-8")
    return data


def run_radar_yakin() -> dict:
    """YAKIN tarama: yalnızca ev/Cihadiye Cad. merkezli, geniş yarıçap +
    yüksek limit (100) — çoklu bölge taramasının uzak semtleri işin içine
    katıp yakın işletmeleri ekarte etmesini istemeyen kullanıcı için."""
    return run_radar(
        settings.radar_lat, settings.radar_lon,
        radius_m=max(settings.radar_radius_m, 2500),
        bolge="Altıntepe", limit=100,
    )


def run_radar_all() -> dict:
    """ÇOKLU BÖLGE taraması: Altıntepe + Kadıköy + Ataşehir + Üsküdar.
    Bölgeler sırayla taranır (Overpass'e nazik davranmak için aralıklı);
    toplam 2-4 dk sürebilir. Sonuç tek radar.json'da birleşir.

    Bölgeler saf puana göre birleştirilmEZ: yoğun/yüksek puanlı bir bölge
    (ör. Kadıköy) diğerlerini (ör. ev bölgesi Altıntepe) tamamen ekarte
    edebiliyordu. Bunun yerine bölgeler arasında sırayla (round-robin,
    kendi içinde puana göre) seçilir — her bölgeden pay garanti edilir."""
    bolge_hits: dict[str, list[dict]] = {}
    hatalar: list[str] = []
    bolgeler = settings.radar_bolgeler()
    for i, (ad, lat, lon, r) in enumerate(bolgeler):
        if i:
            time.sleep(3)  # ardışık Overpass sorguları arasında bekle
        try:
            hits = _isle(scan_area(lat, lon, r), ad)
            hits.sort(key=lambda h: h["score"], reverse=True)
            bolge_hits[ad] = hits
        except Exception as exc:
            hatalar.append(f"{ad}: {exc}")
            print(f"Radar bölge hatası ({ad}): {exc}")

    # Round-robin SONUNA kadar (erken kesmeden) birleştirilir — erken kesilirse
    # "sitesi var" işletmeler kendi bölgesinin puan sıralı listesinin
    # kuyruğunda kalıp _kota_ile_kirp'e hiç ulaşamayabiliyordu.
    tum_hits: list[dict] = []
    havuzlar = list(bolge_hits.values())
    while any(havuzlar):
        for havuz in havuzlar:
            if havuz:
                tum_hits.append(havuz.pop(0))

    data = {
        "scanned_at": datetime.now().isoformat(timespec="seconds"),
        "center": {"lat": settings.radar_lat, "lon": settings.radar_lon},
        "radius_m": settings.radar_radius_m,
        "bolgeler": list(bolge_hits.keys()),
        "hatalar": hatalar,
        "hits": _kota_ile_kirp(tum_hits, 100),
    }
    RADAR_V1_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1),
                             encoding="utf-8")
    return data


# ============================================================== RADAR v2 ====

def _denetim_al(av: dict, onbellek_kullan: bool = True) -> Denetim | None:
    """Bir avın site denetimi — önce SQLite önbelleği, yoksa canlı denetim."""
    domain = av.get("domain") or ""
    if onbellek_kullan and domain:
        kayitli = db.denetim_getir(domain, settings.audit_cache_days)
        if kayitli:
            return Denetim.sozlukten(kayitli)
    return None


def _denetle_ve_kaydet(av: dict) -> Denetim:
    rapor = denetle(av.get("website", ""))
    if av.get("domain"):
        db.denetim_kaydet(av["domain"], av.get("website", ""),
                          rapor.sozluk(), rapor.kusur_puani)
    return rapor


def run_radar_v2(limit: int = 1000, denetim_tavani: int | None = None,
                 bolgeler: list[tuple[str, float, float, int]] | None = None,
                 onbellek_kullan: bool = True) -> dict:
    """Radar v2: iyi giden işletme + kötü/görünmez site → sıcak lead listesi.

    Aday havuzu binlerce olduğu için her turda yalnız `denetim_tavani` kadar
    YENİ site denetlenir (öncelik: işletme kalitesi yüksek olanlar). Denetim
    sonuçları 30 gün önbelleklendiği için ardışık turlar havuzu kümülatif
    olarak tarar — tek seferde hedef sunucuları yormaz.
    """
    from concurrent.futures import ThreadPoolExecutor  # noqa: PLC0415

    tavan = denetim_tavani if denetim_tavani is not None else settings.audit_daily_cap
    bolgeler = bolgeler or settings.secili_bolgeler()
    t0 = time.time()

    audit.psi_sayaci_sifirla()   # PSI tur tavanı her taramada sıfırdan başlar
    avlar = overture.tara(bolgeler, onbellek_kullan=onbellek_kullan)
    if not avlar:
        raise RuntimeError("Overture taramasi bos dondu - ag/veri seti sorunu")

    # Önbellekte denetimi olanlar bedava; kalanlar kalite sırasına göre denetlenir.
    hazir: list[tuple[dict, Denetim]] = []
    bekleyen: list[dict] = []
    for av in avlar:
        mevcut = _denetim_al(av, onbellek_kullan)
        (hazir.append((av, mevcut)) if mevcut else bekleyen.append(av))

    # ÖNCELİKLİ BÖLGE KURALI (16 Ağu 2026 — varlıklı bant eklenince ölçüldü):
    # Yeni eklenen bölgelerin HİÇBİR işletmesi denetlenmemiş olur; sıra yalnız
    # kalite puanına göre kurulursa eski bölgelerin (zaten denetlenmiş, yüksek
    # puanlı) adayları her turda öne geçer ve yeni bölge asla listeye giremez.
    # İlk taramada tam bu oldu: 2.218 yeni aday geldi, sıcak listede 0 tanesi
    # göründü. Çözüm: denetim sırasında öncelikli bölgeler önde koşar.
    oncelikli = settings.radar_oncelikli_bolgeler()
    bekleyen.sort(
        key=lambda a: (a.get("bolge", "") in oncelikli, kalite_puani(a)[0]),
        reverse=True,
    )
    sirada = bekleyen[:max(0, tavan)]
    print(f"Radar v2: {len(avlar)} aday | onbellekte {len(hazir)} denetim | "
          f"bu turda {len(sirada)} yeni denetim (tavan {tavan})")

    if sirada:
        with ThreadPoolExecutor(max_workers=max(1, settings.audit_paralel)) as havuz:
            for av, rapor in zip(sirada, havuz.map(_denetle_ve_kaydet, sirada), strict=True):
                hazir.append((av, rapor))

    degerlendirilen = [degerlendir(av, rapor) for av, rapor in hazir]
    sicak = [a for a in degerlendirilen if not a["elendi"]]
    # Eşit hedef skorunda önce işletme kalitesi, sonra kusur ağırlığı belirler —
    # aynı puanda "daha köklü işletme" üste çıksın (arama sırası budur).
    sicak.sort(key=lambda a: (a["score"], a["kalite_puani"], a["kusur_puani"]),
               reverse=True)
    # Overture aynı işletmeyi farklı ad yazımıyla iki kez içerebiliyor
    # (ör. "Mena Gayrimenkul" + "MENA GAYRİMENKUL", aynı alan adı) — aynı
    # alan adından yalnız en yüksek skorlusu kalır. Platform sayfaları
    # (kendi sitesi olmayanlar) bu elemeden muaf: paylaşılan platform alan
    # adı farklı işletmeleri yanlışlıkla birleştirmesin.
    gorulen_domain: set[str] = set()
    tekil: list[dict] = []
    for a in sicak:
        dom = a.get("domain") or ""
        if dom and not a.get("platform_sayfasi"):
            if dom in gorulen_domain:
                continue
            gorulen_domain.add(dom)
        tekil.append(a)
    sicak = tekil

    # BÖLGE DENGESİ — v1'de çözülmüş, v2'ye taşınmamış bir sorundu (16 Ağu):
    # saf puan sıralamasında yoğun/eski bir bölge (Altıntepe) listeyi kaplayıp
    # diğer bölgeleri tamamen ekarte ediyordu. Artık bölgeler arasında sırayla
    # (round-robin) alınıyor: her bölge kendi en iyisiyle temsil ediliyor,
    # bölge içi sıra yine puan. Böylece "varlıklı bant" listede görünür kalır.
    if len({a.get("bolge") for a in sicak}) > 1:
        havuzlar: dict[str, list[dict]] = {}
        for a in sicak:
            havuzlar.setdefault(a.get("bolge") or "?", []).append(a)
        dengeli: list[dict] = []
        while any(havuzlar.values()):
            for kuyruk in havuzlar.values():
                if kuyruk:
                    dengeli.append(kuyruk.pop(0))
        sicak = dengeli

    data = {
        "surum": 2,
        "scanned_at": datetime.now().isoformat(timespec="seconds"),
        "center": {"lat": settings.radar_lat, "lon": settings.radar_lon},
        "radius_m": settings.radar_radius_m,
        "bolgeler": [b[0] for b in bolgeler],
        "istatistik": {
            "aday_havuzu": len(avlar),
            "denetlenen": len(hazir),
            "bu_turda_yeni": len(sirada),
            "sicak_lead": len(sicak),
            "elenen": len(degerlendirilen) - len(sicak),
            "sure_sn": round(time.time() - t0),
            "places_acik": settings.places_enabled,
        },
        "hits": sicak[:limit],
    }
    RADAR_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1),
                          encoding="utf-8")
    return data


def summary_text_v2(data: dict, top: int = 5) -> str:
    """Telegram/CLI özeti — v2 listesi."""
    hits = data["hits"]
    ist = data.get("istatistik", {})
    lines = [
        f"📡 Radar v2: {len(hits)} sıcak lead "
        f"({' + '.join(data.get('bolgeler', []))})",
        f"Havuz {ist.get('aday_havuzu', '?')} işletme · denetlenen "
        f"{ist.get('denetlenen', '?')} · elenen {ist.get('elenen', '?')}",
        "",
        f"En sıcak {min(top, len(hits))}:",
    ]
    for i, h in enumerate(hits[:top], 1):
        lines.append(
            f"{i}. {h['name']} — {h['kind_tr']} · hedef {h['score']} "
            f"(kalite {h['kalite_puani']} × kusur {h['kusur_puani']})"
        )
        if h.get("kanca"):
            lines.append(f"   ↳ {h['kanca']}")
    lines += ["", "🗺 Harita + butonlar: http://localhost:3005/radar"]
    return "\n".join(lines)


def summary_text(data: dict, top: int = 5) -> str:
    hits = data["hits"]
    bolgeler = data.get("bolgeler", [])
    lines = [f"📡 Radar taraması bitti: {len(hits)} sitesiz işletme "
             f"({' + '.join(bolgeler) if bolgeler else 'tek bölge'})"]

    if len(bolgeler) > 1:
        sayilar = {}
        for h in hits:
            sayilar[h.get("bolge", "?")] = sayilar.get(h.get("bolge", "?"), 0) + 1
        lines.append(" · ".join(f"{b}: {n}" for b, n in sayilar.items()))

    lines += ["", f"En iyi {min(top, len(hits))} av:"]
    for i, h in enumerate(hits[:top], 1):
        tel = " · ☎ var" if h["phone"] else ""
        bolge = f" ({h['bolge']})" if h.get("bolge") else ""
        lines.append(f"{i}. {h['name']} — {h['kind_tr']}{bolge} · puan {h['score']}{tel}")
    lines += ["", "🗺 Harita + butonlar: http://localhost:3005/radar"]
    return "\n".join(lines)
