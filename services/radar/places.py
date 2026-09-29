"""Radar v2 - Eksen A takviyesi: Google Places (New) - VARSAYILAN KAPALI.

NE ISE YARAR
------------
"Isletme iyi mi gidiyor" eksenini gercek Google puani + yorum sayisiyla
olcer (ucretsiz vekiller: alan adi yasi, Overture guven skoru, kaynak sayisi
- bkz. skor.py). Acikken kalite skoru objektiflesir.

NEDEN KAPALI
------------
Google Maps Platform, UCRETSIZ katmani kullanmak icin bile Google Cloud'da
FATURALANDIRMA (kredi karti) acilmasini sart kosar. Kullanicinin kurali:
"ilk gelir gelmeden platforma para yok". Bu yuzden:

  * GOOGLE_PLACES_API_KEY girilmeden VE PLACES_ENABLED=1 yapilmadan
    bu modul tek bir istek bile atmaz.
  * Gunluk cagri tavani vardir (PLACES_DAILY_CAP, varsayilan 30).
  * Sonuclar 30 GUN onbelleklenir - hem maliyet hem Google'in onbellek
    kurali (Places icerigi 30 gunden uzun saklanamaz; yalnizca place id
    suresiz saklanabilir).

MALIYET (2026 fiyatlandirmasi, dogrulanmasi kullaniciya birakildi):
puan/yorum alanlari Enterprise SKU'ya girer; aylik ilk 1.000 cagri ucretsiz,
sonrasi ~$35-40/1.000. Gunluk 30 tavaniyla aylik ~900 cagri = ucretsiz
katmanin icinde kalir.
"""

import json
from datetime import datetime

import requests

from packages.shared.config import settings

TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText"
SAYAC_DOSYA = settings.data_dir / "places_usage.json"
ALAN_MASKESI = ("places.id,places.displayName,places.rating,"
                "places.userRatingCount,places.websiteUri")


class PlacesKapali(RuntimeError):
    """Anahtar yok ya da PLACES_ENABLED=1 degil."""


def acik_mi() -> bool:
    return bool(settings.places_enabled and settings.places_api_key)


def _bugun() -> str:
    return datetime.now().date().isoformat()


def _sayac_oku() -> int:
    try:
        kayit = json.loads(SAYAC_DOSYA.read_text(encoding="utf-8"))
        return int(kayit.get("adet", 0)) if kayit.get("gun") == _bugun() else 0
    except Exception:
        return 0


def _sayac_arttir(n: int = 1) -> None:
    SAYAC_DOSYA.write_text(
        json.dumps({"gun": _bugun(), "adet": _sayac_oku() + n}), encoding="utf-8")


def bugun_kalan() -> int:
    return max(0, settings.places_daily_cap - _sayac_oku())


def enrich_candidate(name: str, lat: float, lon: float) -> dict:
    """Tek isletme icin Google puani + yorum sayisi.

    Doner: {"google_puan": float|None, "google_yorum": int|None, "google_site": str}
    Kapaliysa PlacesKapali firlatir - sessizce bos donmez ki cagiran taraf
    "puan yok" ile "modul kapali"yi karistirmasin.
    """
    if not acik_mi():
        raise PlacesKapali(
            "Places kapali. Acmak icin: Google Cloud'da faturalandirma ac, "
            "GOOGLE_PLACES_API_KEY gir ve PLACES_ENABLED=1 yap."
        )
    if bugun_kalan() <= 0:
        raise PlacesKapali(f"Gunluk Places tavani doldu ({settings.places_daily_cap})")

    resp = requests.post(
        TEXT_SEARCH,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": settings.places_api_key,
            "X-Goog-FieldMask": ALAN_MASKESI,
        },
        json={
            "textQuery": name,
            "maxResultCount": 1,
            "locationBias": {"circle": {
                "center": {"latitude": lat, "longitude": lon},
                "radius": 300.0,
            }},
        },
        timeout=30,
    )
    _sayac_arttir()
    resp.raise_for_status()
    yerler = resp.json().get("places") or []
    if not yerler:
        return {"google_puan": None, "google_yorum": None, "google_site": ""}
    yer = yerler[0]
    return {
        "google_puan": yer.get("rating"),
        "google_yorum": yer.get("userRatingCount"),
        "google_site": yer.get("websiteUri", ""),
    }


def zenginlestir(avlar: list[dict], tavan: int | None = None) -> int:
    """Listenin en ust sirasindaki avlari Google puaniyla zenginlestirir.

    Kapaliyken hicbir sey yapmaz ve 0 doner (tarama akisi bozulmaz).
    """
    if not acik_mi():
        return 0
    kalan = min(tavan if tavan is not None else settings.places_daily_cap, bugun_kalan())
    islenen = 0
    for av in avlar:
        if islenen >= kalan:
            break
        if av.get("google_puan") is not None:
            continue
        try:
            av.update(enrich_candidate(av["name"], av["lat"], av["lon"]))
            islenen += 1
        except PlacesKapali:
            break
        except Exception as exc:
            print(f"Places zenginlestirme hatasi ({av.get('name')}): {exc}")
    return islenen
