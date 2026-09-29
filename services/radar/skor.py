"""Radar v2 - Adim 4: iki eksenli hedef skoru.

MANTIK (kullanicinin kilitli karari)
------------------------------------
Eski radar "sitesi olmayan esnafi" ariyordu: musteriye once "web sitesi
gerekli mi" fikrini satmak gerekiyordu - 100 aramada 0 donus. Yeni hedef:

  EKSEN A - Isletme kalitesi : isi IYI GIDEN, koklu, butik isletme
  EKSEN B - Site kusuru      : sitesi eski/bozuk/gorunmez

  HEDEF SKORU = sqrt(A x B)

Carpim oldugu icin bir eksen sifirsa sonuc sifirdir:
  * iyi isletme + berbat site  -> en degerli lead (ikna edilecek bir sey yok,
                                   zaten siteye inaniyor; sadece kotu olani
                                   duzeltiyoruz)
  * iyi isletme + iyi site     -> elenir (satacak bir kusur yok)
  * kotu/olu isletme           -> elenir (parasi da niyeti de yok)

Puanlama DETERMINISTIK ve ACIKLANABILIR: her puanin nereden geldigi
`kalite_kirilim` listesinde durur, panelde gosterilir. AI cagrisi YOK,
maliyet $0.

GOOGLE PUANI: Places API acikken (varsayilan KAPALI, kart gerektirir) gercek
puan/yorum sayisi Eksen A'ya girer. Kapaliyken ucretsiz vekiller kullanilir:
alan adi yasi (RDAP - koklu isletme sinyali), Overture guven skoru, kac
bagimsiz kaynagin dogruladigi, kendi alan adina sahip olmasi, kategori degeri.
"""

import math

from services.radar.audit import Denetim

# Vitrin/portfolyo/randevu ile en kolay paraya donen kategoriler (offer.md
# butik/vitrin listesiyle uyumlu). Overture kategori adlariyla.
YUKSEK_DEGER = frozenset({
    "restaurant", "turkish_restaurant", "seafood_restaurant", "steakhouse",
    "kebab_restaurant", "meyhane", "cafe", "coffee_shop", "bakery", "desserts",
    "hair_salon", "barber", "beauty_salon", "beauty_and_spa", "spas", "day_spa",
    "nail_salon", "hair_removal", "makeup_artist",
    "dentist", "dental_clinic", "orthodontist", "plastic_surgeon",
    "cosmetic_dentist", "dermatologist", "veterinarian", "animal_hospital",
    "psychologist", "counseling_and_mental_health", "nutritionist",
    "hotel", "boutique_hotel", "bed_and_breakfast", "guest_house",
    "lawyer", "architectural_designer", "interior_design",
    "real_estate_agent", "real_estate", "event_planning", "wedding_planning",
    "photographer", "photography_studio", "bridal_shop",
    "preschool", "child_care_and_day_care", "language_school", "driving_school",
    "gym", "fitness_center", "pilates_studio", "yoga_studio",
    "jewelry_store", "furniture_store", "florist", "flowers_and_gifts_shop",
    "art_gallery", "travel_services", "travel_agency",
})

# Bu esiklerin altinda kalan lead listeye girmez (uydurma kanca uretilmesin).
MIN_KALITE = 30
MIN_KUSUR = 45
# Listeye girmek icin EN AZ BIR ciddi kusur sart. Sirf "sitemap yok, JSON-LD
# yok, H1 yok" gibi kozmetik eksiklerle kimseyi aramayiz - elde gosterilecek
# somut bir bozukluk olmadan yapilan temas, satmaya calistigimiz durustlugun
# ta kendisini bozar (offer.md S6: korku satma, gercek problemi coz).
MIN_AGIR_KUSUR = 6


def _domain_yasi_puani(yas: float | None) -> tuple[int, str]:
    """Alan adi yasi = 'koklu isletme' vekili (RDAP, ucretsiz ve resmi)."""
    if yas is None:
        return 6, "Alan adı yaşı bilinmiyor"
    if yas >= 10:
        return 25, f"{yas:.0f} yıldır ayakta (köklü işletme)"
    if yas >= 5:
        return 20, f"{yas:.0f} yıllık alan adı"
    if yas >= 3:
        return 14, f"{yas:.0f} yıllık alan adı"
    if yas >= 1:
        return 8, f"{yas:.1f} yıllık alan adı"
    return 2, "Alan adı çok yeni (1 yıldan az)"


def _guven_puani(guven: float) -> tuple[int, str]:
    """Overture guven skoru: kaydin gercekten var oldugundan ne kadar emin."""
    if guven >= 0.90:
        return 18, "Kayıt çok güvenilir"
    if guven >= 0.75:
        return 14, "Kayıt güvenilir"
    if guven >= 0.60:
        return 10, "Kayıt orta güvenilir"
    return 6, "Kayıt zayıf doğrulanmış"


def _google_puani(av: dict) -> tuple[int, str] | None:
    """Places acikken gercek Google puani/yorum sayisi (varsayilan KAPALI)."""
    puan, yorum = av.get("google_puan"), av.get("google_yorum")
    if puan is None or yorum is None:
        return None
    if puan >= 4.5 and yorum >= 100:
        return 30, f"Google {puan} ({yorum} yorum) — çok sevilen işletme"
    if puan >= 4.3 and yorum >= 50:
        return 22, f"Google {puan} ({yorum} yorum) — köklü ve beğenilen"
    if puan >= 4.0 and yorum >= 20:
        return 12, f"Google {puan} ({yorum} yorum)"
    return -15, f"Google {puan} ({yorum} yorum) — işletme zayıf"


def kalite_puani(av: dict) -> tuple[int, list[dict]]:
    """EKSEN A: isletme ne kadar iyi gidiyor. (0-100, kirilimiyla birlikte)"""
    kirilim: list[dict] = []

    def ekle(puan: int, etiket: str) -> None:
        if puan:
            kirilim.append({"puan": puan, "etiket": etiket})

    if av.get("kind") in YUKSEK_DEGER:
        ekle(20, f"{av.get('kind_tr', 'İşletme')} — siteden doğrudan iş döner")
    else:
        ekle(10, f"{av.get('kind_tr', 'İşletme')}")

    yas = (av.get("denetim_olcumler") or {}).get("domain_yasi_yil")
    ekle(*_domain_yasi_puani(yas))
    ekle(*_guven_puani(float(av.get("confidence") or 0)))

    kaynak = int(av.get("kaynak_sayisi") or 0)
    if kaynak >= 4:
        ekle(12, f"{kaynak} bağımsız kaynak doğruluyor")
    elif kaynak == 3:
        ekle(9, "3 bağımsız kaynak doğruluyor")
    elif kaynak == 2:
        ekle(6, "2 kaynak doğruluyor")
    elif kaynak == 1:
        ekle(3, "Tek kaynak")

    if av.get("website") and not av.get("platform_sayfasi"):
        ekle(10, "Kendi alan adı var (siteye zaten yatırım yapmış)")
    if av.get("street"):
        ekle(5, "Açık adres kayıtlı")

    google = _google_puani(av)
    if google:
        ekle(*google)

    toplam = max(0, min(100, sum(k["puan"] for k in kirilim)))
    return toplam, kirilim


def hedef_skoru(kalite: int, kusur: int) -> int:
    """Iki eksenin geometrik ortalamasi - biri sifirsa sonuc sifir."""
    return round(math.sqrt(max(0, kalite) * max(0, kusur)))


def degerlendir(av: dict, denetim: Denetim) -> dict:
    """Av kaydini denetim raporuyla birlestirip skorlar (yeni sozluk doner)."""
    zengin = dict(av)
    zengin["denetim_olcumler"] = denetim.olcumler
    zengin["denetlendi"] = denetim.denetlendi
    zengin["kusurlar"] = [
        {"kod": k.kod, "baslik": k.baslik, "siddet": k.siddet, "kanit": k.kanit,
         # "kendi gözünle 10 saniyede doğrula" — panelde gösterilir; telefonu
         # açmadan önce teyit edilsin diye (yanlış kusur = kaybedilen itibar).
         "dogrula": k.dogrula}
        for k in sorted(denetim.kusurlar, key=lambda k: k.siddet, reverse=True)
    ]
    zengin["kanca"] = denetim.kanca

    kusur = denetim.kusur_puani
    kalite, kirilim = kalite_puani(zengin)
    zengin["kalite_puani"] = kalite
    zengin["kalite_kirilim"] = kirilim
    zengin["kusur_puani"] = kusur
    zengin["score"] = hedef_skoru(kalite, kusur)   # panel/harita "score" bekliyor
    zengin["hedef_skoru"] = zengin["score"]

    if not denetim.denetlendi:
        zengin["elendi"] = True
        zengin["eleme_sebebi"] = denetim.denetlenemedi_sebep or "Site denetlenemedi"
    elif denetim.en_agir_siddet < MIN_AGIR_KUSUR:
        zengin["elendi"] = True
        zengin["eleme_sebebi"] = "Sitesinde gösterilebilir ciddi bir kusur yok"
    elif kusur < MIN_KUSUR:
        zengin["elendi"] = True
        zengin["eleme_sebebi"] = "Sitesi yeterince iyi — satacak kusur yok"
    elif kalite < MIN_KALITE:
        zengin["elendi"] = True
        zengin["eleme_sebebi"] = "İşletme sinyali zayıf"
    else:
        zengin["elendi"] = False
        zengin["eleme_sebebi"] = ""

    # Panelde eski alan adiyla gosterilen tek satirlik ozet
    zengin["issue"] = (zengin["kusurlar"][0]["baslik"] if zengin["kusurlar"]
                       else zengin.get("eleme_sebebi") or "Kusur bulunamadi")
    return zengin
