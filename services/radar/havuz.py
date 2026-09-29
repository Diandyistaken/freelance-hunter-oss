"""Arama havuzu — sitesizler DAHİL, muhatap süzgecinden geçmiş işletmeler.

NEDEN AYRI (9 Eyl 2026, kullanıcı kararı)
----------------------------------------
Radar v2 yalnız SİTELİ işletmeleri çeker (site kusuru avlar). Yeni kanca
yazılım fikri olduğu için site şart değil: havuz Overture'dan `sitesiz_dahil`
ile çekilir, `muhatap.havuzu_suz` ile kurumsal/çağrı merkezi/spam/zincir
elenir, sonuç `data/havuz.json`'a yazılır. `hedefleme.py` bu dosyayı okur.

Ölçüm (9 Eyl 2026, 10 bölge): Overture 13.215 kayıt → 12.032 aday.
Ağa çıkan tek yer `overture.tara` (Overture açık veri, $0, anahtarsız).
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime

from packages.shared.bolgeler import VARSAYILAN_SECIM, bolge_getir
from packages.shared.config import settings
from services.radar import overture
from services.radar.fikirler import tur_profili
from services.radar.muhatap import havuzu_suz

HAVUZ_JSON = settings.data_dir / "havuz.json"
SURUM = 1


def havuz_bolgeleri() -> list[tuple[str, float, float, int]]:
    """Varsayılan 8 bölge + panelde seçili semtler (tekrarsız, katalog sırası)."""
    secili = [b[0] for b in settings.secili_bolgeler()]
    adlar = list(dict.fromkeys(VARSAYILAN_SECIM + secili))
    return bolge_getir(adlar)


def olustur(onbellek_kullan: bool = True) -> dict:
    """Overture → süz → data/havuz.json. Dönen sözlük dosyaya yazılanla aynı."""
    bolgeler = havuz_bolgeleri()
    avlar = overture.tara(bolgeler, sitesiz_dahil=True, onbellek_kullan=onbellek_kullan)
    if not avlar:
        raise RuntimeError("Overture taraması boş döndü — ağ/veri seti sorunu")

    kalan, elenen = havuzu_suz(avlar)
    isletmeler = [{**av, "grup": tur_profili(av.get("kind_tr")).grup} for av in kalan]
    veri = {
        "surum": SURUM,
        "olusturuldu": datetime.now().isoformat(timespec="seconds"),
        "bolgeler": [b[0] for b in bolgeler],
        "istatistik": {
            "overture": len(avlar),
            "aranabilir": len(isletmeler),
            "elenen": dict(elenen),
            "telefon": dict(Counter(i["telefon_turu"] for i in isletmeler)),
            "siteli": sum(1 for i in isletmeler if i.get("website")),
            "tur_sayisi": len({i.get("kind_tr") for i in isletmeler}),
        },
        "isletmeler": isletmeler,
    }
    HAVUZ_JSON.write_text(json.dumps(veri, ensure_ascii=False), encoding="utf-8")
    return veri


def yukle() -> dict:
    if not HAVUZ_JSON.exists():
        raise FileNotFoundError(
            "data/havuz.json yok — önce havuzu kur: python run.py --havuz")
    return json.loads(HAVUZ_JSON.read_text(encoding="utf-8"))


def ozet(veri: dict) -> str:
    ist = veri["istatistik"]
    sat = [
        f"🏊 Havuz: {ist['aranabilir']} aranabilir işletme / {ist['overture']} Overture kaydı "
        f"({len(veri['bolgeler'])} bölge, {ist['tur_sayisi']} tür) → {HAVUZ_JSON}",
        "   telefon: " + ", ".join(f"{k} {v}" for k, v in sorted(ist["telefon"].items())),
        "   elenen: " + ", ".join(f"{k} {v}" for k, v in sorted(ist["elenen"].items(), key=lambda kv: -kv[1])),
        f"   siteli {ist['siteli']} · sitesiz {ist['aranabilir'] - ist['siteli']}",
    ]
    return "\n".join(sat)
