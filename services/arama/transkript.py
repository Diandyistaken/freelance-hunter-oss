"""Ses → Türkçe yazı (faster-whisper, yerel, $0, ağa çıkmaz).

Model seçimi ölçüye dayalı: `small` Türkçe telefon konuşmasında kabul edilebilir
doğrulukta ve CPU'da 1 dakikalık kaydı ~1 dakikada çıkarır. Daha iyisi
gerekirse WHISPER_MODEL=medium (yavaş ama daha isabetli). Model ilk
çalıştırmada indirilir (~500 MB), sonra önbellekten gelir.

SEVİYELENDİRME (10 Eyl 2026'da ölçülerek eklendi): hoparlörden gelen karşı
taraf, mikrofona uzak olduğu için kısık kaydediliyor ve whisper'ın sessizlik
süzgeci onu tamamen atabiliyor — sınavda karşı tarafın üç repliğinin üçü de
kayboldu. Çözüm: DÖKÜM İÇİN sesin kopyası yükseltilir. Konuşan ayrımı ise
ORİJİNAL kayıttan ölçülür (bkz. konusan.py), yoksa seviye farkı silinir ve
ayrımın dayandığı ipucu yok olur.
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np

_model = None
HEDEF_TEPE = 0.92


def _model_getir():
    """Model bir kez yüklenir; her kayıtta yeniden yüklemek dakikalar yer."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        boy = os.getenv("WHISPER_MODEL", "small")
        # int8: CPU'da en hızlı, kalite kaybı telefon konuşmasında ihmal edilir.
        _model = WhisperModel(boy, device="cpu", compute_type="int8")
    return _model


def _seviyelendir(dalga: np.ndarray) -> np.ndarray:
    """Tepeyi hedefe çek + kısık bölümleri yumuşak sıkıştırmayla öne al."""
    if not dalga.size:
        return dalga
    tepe = float(np.abs(dalga).max())
    if tepe > 1e-6:
        dalga = dalga * (HEDEF_TEPE / tepe)
    # Yumuşak sıkıştırma: işaretini koru, genliğin karekökünü al → kısık
    # konuşma duyulur olur, yüksek olan kırpılmaz.
    sikistirilmis = np.sign(dalga) * np.sqrt(np.abs(dalga))
    return (sikistirilmis * (HEDEF_TEPE / (float(np.abs(sikistirilmis).max()) + 1e-9))).astype(
        "float32"
    )


def dokum(ses_yolu: Path | str) -> tuple[list[dict], str]:
    """(parçalar, dil) — parça: {baslangic, bitis, metin}."""
    import soundfile as sf

    dalga, ornekleme = sf.read(str(ses_yolu), dtype="float32")
    if dalga.ndim > 1:
        dalga = dalga.mean(axis=1)
    if ornekleme != 16_000:  # whisper 16 kHz ister
        yeni = int(len(dalga) * 16_000 / ornekleme)
        dalga = np.interp(
            np.linspace(0, len(dalga) - 1, yeni), np.arange(len(dalga)), dalga
        ).astype("float32")

    model = _model_getir()
    parcalar, bilgi = model.transcribe(
        _seviyelendir(np.asarray(dalga, dtype="float32")),
        language="tr",
        vad_filter=True,
        # Eşik varsayılan 0.5; kısık telefon sesini atmasın diye düşürüldü.
        vad_parameters={"min_silence_duration_ms": 400, "threshold": 0.3},
        beam_size=5,
        condition_on_previous_text=False,  # telefonda konu atlar; zincir hatasını keser
    )
    cikti = [
        {"baslangic": round(p.start, 2), "bitis": round(p.end, 2), "metin": p.text.strip()}
        for p in parcalar
        if p.text and p.text.strip()
    ]
    return cikti, getattr(bilgi, "language", "tr")
