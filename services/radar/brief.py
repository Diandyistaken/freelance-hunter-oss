"""Radar avı ve beğenilen şablondan Fable 5 tasarım brief'i üretir."""

import json
import sys
from datetime import datetime
from pathlib import Path

from packages.shared.config import settings
from services.radar.site_builder import (
    STIL_SIRASI,
    _load_hits,
    _phone_parts,
    _site_photos,
    _slugify,
)


CATALOG_JSON = settings.root / "templates" / "business-landing" / "catalog.json"


def _dolu(value: object) -> bool:
    return value is not None and str(value).strip() != ""


def uret_brief(n: int, stil: str) -> Path:
    """n. radar avı için seçilen stile göre Markdown brief üretir."""
    hits = _load_hits()
    if not 1 <= n <= len(hits):
        raise IndexError(f"Geçersiz numara: {n} (listede {len(hits)} av var)")
    if stil not in STIL_SIRASI:
        raise ValueError(
            f"Geçersiz stil: {stil!r}. Geçerli stiller: {', '.join(STIL_SIRASI)}"
        )

    hit = hits[n - 1]
    catalog = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    sablon = next((item for item in catalog if item.get("id") == stil), None)
    if sablon is None:
        raise ValueError(f"Şablon kataloğunda stil bulunamadı: {stil!r}")

    ad = str(hit.get("name") or "").strip()
    photo_kind = hit.get("category") or hit.get("kind", "")
    photos = _site_photos(photo_kind, ad, count=6)
    bilgi_satirlari = []
    alanlar = (
        ("Ad", ad),
        ("Tür", hit.get("kind_tr")),
        ("Bölge/Semt", hit.get("bolge")),
        ("Telefon", hit.get("phone")),
    )
    for etiket, value in alanlar:
        if _dolu(value):
            bilgi_satirlari.append(f"- {etiket}: {str(value).strip()}")

    if _dolu(hit.get("phone")):
        _, _, wa_digits = _phone_parts(str(hit["phone"]))
        if wa_digits:
            bilgi_satirlari.append(f"- WhatsApp: wa.me/{wa_digits}")
    if _dolu(hit.get("score")):
        bilgi_satirlari.append(f"- Radar puanı: {hit['score']}")
    if _dolu(hit.get("lat")) and _dolu(hit.get("lon")):
        lat, lon = hit["lat"], hit["lon"]
        bilgi_satirlari.append(
            f"- Konum: [{lat},{lon}](https://www.google.com/maps/search/?api=1&query={lat},{lon})"
        )
    adres = hit.get("addr") or hit.get("street")
    if _dolu(adres):
        bilgi_satirlari.append(f"- Adres: {str(adres).strip()}")

    brief = f"""# Tasarım Brief'i — {ad}
> Bu metni OLDUĞU GİBİ Fable 5'e yapıştır; çıktı üretim kalitesinde tek dosyalık site olmalı.

## Görev
{ad} için SIFIRDAN, üretim kalitesinde, tek dosyalık (index.html) modern bir tanıtım sitesi tasarla ve kodla.
Hazır şablon kullanma — aşağıda müşterinin beğendiği stilin karakteri referans; onu özgün bir tasarıma dönüştür.

## İşletme bilgileri
{chr(10).join(bilgi_satirlari)}

## Müşterinin beğendiği stil: {sablon['ad']}
{sablon['aciklama']}
Bu karakteri koru: renk duygusu, tipografi tavrı, yoğunluk ve enerji düzeyi buna uysun.

## Demoda beğenilen görseller (aynı görsel dilini kullan)
{chr(10).join(f'- {url}' for url in photos)}

## Sayfa bölümleri (en az)
Hero (güçlü başlık + CTA) · Hizmetler · Hakkında · Galeri · Müşteri yorumları · Çalışma saatleri · İletişim (tıkla-ara + WhatsApp CTA + harita linki)

## Teknik kabuller
- Tek index.html; saf HTML/CSS/JS, harici JS/CSS bağımlılığı yok (görseller Unsplash'tan gelebilir)
- Mobil öncelikli responsive; sticky mobil CTA
- SEO: title/description/OG etiketleri Türkçe; semantik HTML; erişilebilirlik + prefers-reduced-motion desteği
- WhatsApp CTA hazır mesaj içersin ("Merhaba, web siteniz için yazıyorum..." tarzı işletmeye uyarlanmış)
- Tüm içerik Türkçe, gerçekçi ve işletmeye özgü yazılmış (lorem ipsum YASAK)

## Teslim
Tek index.html dosyası — Cloudflare Pages'e doğrudan yüklenebilir durumda.
"""

    out_dir = settings.data_dir / "design_briefs"
    out_dir.mkdir(parents=True, exist_ok=True)
    zaman = datetime.now().strftime("%Y%m%d-%H%M")
    path = out_dir / f"{zaman}-{_slugify(ad)}-{stil}.md"
    path.write_text(brief, encoding="utf-8")
    return path


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 3 or not sys.argv[1].isdigit():
        raise SystemExit(
            "Hata: kullanım: python -m services.radar.brief <n> <stil>"
        )
    path = uret_brief(int(sys.argv[1]), sys.argv[2].lower())
    print(f"BRIEF-DOSYA: {path}")
    print("===BRIEF-BASLA===")
    print(path.read_text(encoding="utf-8"), end="")


if __name__ == "__main__":
    main()
