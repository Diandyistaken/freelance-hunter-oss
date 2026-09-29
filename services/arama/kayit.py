"""Arama kaydı — mikrofondan WAV, sonra transkript + konuşan ayrımı + analiz.

KULLANIM (panelden düğmelerle; komut satırından da çalışır)
    python run.py --kayit basla <slug>    # kaydı başlatır (arka planda)
    python run.py --kayit dur             # kaydı bitirir, işlemeyi başlatır
    python run.py --kayit durum           # nerede olduğunu yazar

AKIŞ: kayıt (WAV) → faster-whisper ile Türkçe transkript → konuşan ayrımı
(services/arama/konusan.py, kurulum gerektirmeyen frekans yöntemi) → Claude
Code CLI ile analiz ($0, Max aboneliği). Her aşama `data/aramalar/<kayit>.json`
dosyasına yazılır; panel bu dosyayı okur.

GİZLİLİK: ses dosyası ve döküm YALNIZCA bu bilgisayarda kalır, hiçbir yere
yüklenmez (analiz istemine yalnız METİN gider). Karşı tarafa kaydettiğini
söylemek en güvenlisidir — KVKK açısından da, güven açısından da.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime
from pathlib import Path

from packages.shared.config import settings

KAYIT_DIR = settings.data_dir / "aramalar"
DUR_DOSYASI = KAYIT_DIR / ".dur"
AKTIF_DOSYASI = KAYIT_DIR / ".aktif.json"
ORNEKLEME = 16_000          # whisper zaten 16 kHz'e indiriyor
EN_UZUN_SN = 45 * 60        # kaza ile açık kalan kayıt diski doldurmasın


# --------------------------------------------------------------- yardımcılar
def _kayitlar_hazirla() -> None:
    KAYIT_DIR.mkdir(parents=True, exist_ok=True)


def kayit_yolu(kimlik: str) -> Path:
    return KAYIT_DIR / f"{kimlik}.json"


def durum_yaz(kimlik: str, **alanlar) -> dict:
    """Kayıt dosyasını günceller. `kimlik` alanını kendisi yazar — çağıran
    ayrıca geçirmemeli (aynı ada iki değer hatası verir)."""
    yol = kayit_yolu(kimlik)
    veri = json.loads(yol.read_text(encoding="utf-8")) if yol.exists() else {}
    veri.update(alanlar)
    veri["kimlik"] = kimlik
    veri["guncelleme"] = datetime.now().isoformat(timespec="seconds")
    yol.write_text(json.dumps(veri, ensure_ascii=False, indent=1), encoding="utf-8")
    return veri


def aktif_kayit() -> dict | None:
    if not AKTIF_DOSYASI.exists():
        return None
    try:
        return json.loads(AKTIF_DOSYASI.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def kayitlari_listele(slug: str | None = None) -> list[dict]:
    _kayitlar_hazirla()
    kayitlar = []
    for yol in sorted(KAYIT_DIR.glob("*.json"), reverse=True):
        if yol.name.startswith("."):
            continue
        try:
            veri = json.loads(yol.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if slug and veri.get("slug") != slug:
            continue
        kayitlar.append(veri)
    return kayitlar


# ------------------------------------------------------------------- kayıt
def basla(slug: str, ad: str = "") -> dict:
    """Mikrofonu açar, `.dur` dosyası gelene kadar kaydeder, sonra işler.

    Bu fonksiyon KAYIT BOYUNCA bloklar — panel bunu ayrı süreçte başlatır.
    """
    import numpy as np
    import sounddevice as sd
    import soundfile as sf

    _kayitlar_hazirla()
    DUR_DOSYASI.unlink(missing_ok=True)
    kimlik = f"{slug}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    ses_yolu = KAYIT_DIR / f"{kimlik}.wav"

    AKTIF_DOSYASI.write_text(
        json.dumps({"kimlik": kimlik, "slug": slug, "ad": ad,
                    "baslangic": datetime.now().isoformat(timespec="seconds")},
                   ensure_ascii=False),
        encoding="utf-8",
    )
    durum_yaz(kimlik, slug=slug, ad=ad, asama="kaydediyor",
              ses=str(ses_yolu.name),
              baslangic=datetime.now().isoformat(timespec="seconds"))

    parcalar: list[np.ndarray] = []
    t0 = time.time()
    try:
        with sd.InputStream(samplerate=ORNEKLEME, channels=1, dtype="float32") as akis:
            while not DUR_DOSYASI.exists() and time.time() - t0 < EN_UZUN_SN:
                veri, _ = akis.read(int(ORNEKLEME * 0.25))
                parcalar.append(veri.copy())
    except Exception as hata:  # mikrofon yoksa/kullanımdaysa kullanıcı görsün
        AKTIF_DOSYASI.unlink(missing_ok=True)
        durum_yaz(kimlik, asama="hata", hata=f"mikrofon açılamadı: {hata}")
        raise
    finally:
        DUR_DOSYASI.unlink(missing_ok=True)
        AKTIF_DOSYASI.unlink(missing_ok=True)

    ses = np.concatenate(parcalar) if parcalar else np.zeros((0, 1), dtype="float32")
    sf.write(ses_yolu, ses, ORNEKLEME)
    sure = round(len(ses) / ORNEKLEME, 1)
    durum_yaz(kimlik, asama="kayit_bitti", sure_sn=sure)

    return isle(kimlik)


def dur() -> bool:
    """Kaydı bitir (kayıt süreci bunu görüp dosyayı kapatır)."""
    _kayitlar_hazirla()
    if not AKTIF_DOSYASI.exists():
        return False
    DUR_DOSYASI.write_text("dur", encoding="utf-8")
    return True


# ------------------------------------------------------------------ işleme
def isle(kimlik: str) -> dict:
    """WAV → transkript → konuşan ayrımı → analiz. Aşamaları dosyaya yazar."""
    from services.arama import analiz as analiz_mod
    from services.arama import konusan as konusan_mod
    from services.arama import transkript as transkript_mod

    veri = json.loads(kayit_yolu(kimlik).read_text(encoding="utf-8"))
    ses_yolu = KAYIT_DIR / veri["ses"]

    durum_yaz(kimlik, asama="yaziya_dokuyor")
    try:
        parcalar, dil = transkript_mod.dokum(ses_yolu)
    except Exception as hata:
        return durum_yaz(kimlik, asama="hata", hata=f"transkript: {hata}")
    if not parcalar:
        return durum_yaz(kimlik, asama="bitti", parcalar=[], analiz=None,
                         uyari="Kayıtta konuşma bulunamadı (mikrofon sessiz miydi?)")

    durum_yaz(kimlik, asama="konusan_ayiriyor")
    import numpy as np
    import soundfile as sf

    dalga, ornekleme = sf.read(ses_yolu, dtype="float32")
    if dalga.ndim > 1:
        dalga = dalga.mean(axis=1)
    olculu = konusan_mod.olc(np.asarray(dalga), ornekleme, parcalar)
    etiketli, guven = konusan_mod.etiketle(olculu)
    durum_yaz(kimlik, parcalar=etiketli, konusan_guven=guven, dil=dil)

    durum_yaz(kimlik, asama="analiz_ediyor")
    try:
        sonuc = analiz_mod.analiz_et(veri.get("slug", ""), etiketli, veri.get("sure_sn"))
    except Exception as hata:
        return durum_yaz(kimlik, asama="bitti", analiz=None,
                         uyari=f"analiz yapılamadı: {hata}")
    return durum_yaz(kimlik, asama="bitti", analiz=sonuc)


def etiketleri_ters_cevir(kimlik: str) -> dict:
    """Makine 'ben/karşı' etiketlerini ters koyduysa tek çağrıda düzelt."""
    from services.arama import konusan as konusan_mod

    veri = json.loads(kayit_yolu(kimlik).read_text(encoding="utf-8"))
    return durum_yaz(kimlik, parcalar=konusan_mod.ters_cevir(veri.get("parcalar", [])))


# ------------------------------------------------------------------- komut
def _ozet(veri: dict) -> str:
    if not veri:
        return "Kayıt yok."
    sat = [f"🎙 {veri.get('kimlik')} · {veri.get('asama')} · {veri.get('sure_sn', '?')} sn"]
    if veri.get("analiz"):
        a = veri["analiz"]
        sat.append(f"   puan {a.get('puan', '?')}/10 · {a.get('ozet', '')}")
    if veri.get("uyari"):
        sat.append(f"   ⚠ {veri['uyari']}")
    return "\n".join(sat)


def komut(args: list[str]) -> None:
    eylem = args[0] if args else "durum"
    if eylem == "basla":
        slug = args[1] if len(args) > 1 else "arama"
        print(_ozet(basla(slug, ad=" ".join(args[2:]))))
    elif eylem == "dur":
        print("Kayıt durduruldu." if dur() else "Aktif kayıt yok.")
    elif eylem == "isle":
        print(_ozet(isle(args[1])))
    elif eylem == "durum":
        aktif = aktif_kayit()
        print(f"Aktif kayıt: {aktif['kimlik']}" if aktif else "Aktif kayıt yok.")
        for veri in kayitlari_listele()[:5]:
            print(_ozet(veri))
    else:
        print(__doc__)


if __name__ == "__main__":
    komut(sys.argv[1:])
