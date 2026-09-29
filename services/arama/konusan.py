"""Konuşan ayrımı — "bunu ben mi söyledim, karşı taraf mı?"

FİKİR (kurulum gerektirmeyen yol, 10 Eyl 2026)
----------------------------------------------
Kayıt düzeni belli: telefon HOPARLÖRDE, laptop mikrofonu iki sesi birden
alıyor. Bu iki ses fiziksel olarak farklı:

  * Senin sesin mikrofona DOĞRUDAN gelir → geniş bant. 4 kHz üstünde
    (s, ş, f, t seslerinin tıslaması) belirgin enerji vardır.
  * Karşı tarafın sesi telefon hattından geçip hoparlörden çıkar. GSM/VoIP
    kodekleri bandı ~300-3400 Hz'e kırpar; 4 kHz üstü neredeyse boştur.
    Üstelik hoparlör mikrofona daha uzaktır → seviye düşüktür.

Yani "kim konuştu" sorusu, pahalı bir sinir ağı yerine iki ölçümle
cevaplanabilir: yüksek frekans oranı ve seviye. Bu yüzden pyannote/torch
model indirmesi, HuggingFace jetonu ve 500 MB'lık kurulum GEREKMİYOR.

SINIRLARI (dürüstlük): iki taraf aynı anda konuşursa o parça tek etikete
düşer; kulaklıkla konuşursan (hoparlör kapalı) karşı taraf mikrofona hiç
gelmez, ayrım anlamsızlaşır; çok gürültülü ortamda oran bulanır. Panelde
"etiketleri ters çevir" düğmesi var — makine yanılırsa tek tıkla düzelir.
Daha iyisi gerekirse pyannote sonradan eklenebilir, arayüz aynı kalır.
"""

from __future__ import annotations

import math

import numpy as np

# 4 kHz üstü "tıslama" bandı: telefon kodeki burayı keser, doğrudan ses kesmez.
ESIK_HZ = 4000.0
# Bir parçayı ölçmeye değer kılan en kısa süre (sn) — çok kısa parçada oran gürültülü.
EN_KISA_SN = 0.35


def _parca_olcumu(dalga: np.ndarray, ornekleme: int) -> tuple[float, float]:
    """(yüksek frekans oranı, rms) — parçanın iki ölçüsü."""
    if dalga.size < 256:
        return 0.0, 0.0
    pencere = np.hanning(dalga.size)
    izge = np.abs(np.fft.rfft(dalga * pencere)) ** 2
    frekanslar = np.fft.rfftfreq(dalga.size, 1 / ornekleme)
    toplam = float(izge.sum()) + 1e-12
    yuksek = float(izge[frekanslar >= ESIK_HZ].sum())
    rms = float(np.sqrt(np.mean(dalga.astype(np.float64) ** 2)))
    return yuksek / toplam, rms


def olc(dalga: np.ndarray, ornekleme: int, parcalar: list[dict]) -> list[dict]:
    """Her parçaya `hf_oran` ve `rms` ekler (kopya döndürür)."""
    cikti: list[dict] = []
    for p in parcalar:
        bas = max(0, int(float(p["baslangic"]) * ornekleme))
        son = min(dalga.size, int(float(p["bitis"]) * ornekleme))
        hf, rms = _parca_olcumu(dalga[bas:son], ornekleme) if son > bas else (0.0, 0.0)
        cikti.append({**p, "hf_oran": round(hf, 5), "rms": round(rms, 5)})
    return cikti


def _esik_bul(degerler: list[float]) -> float:
    """İki kümeyi ayıran eşik — tek boyutlu 2-ortalama (k-means)."""
    if not degerler:
        return 0.0
    dizi = np.array(degerler, dtype=np.float64)
    alt, ust = float(dizi.min()), float(dizi.max())
    if math.isclose(alt, ust):
        return alt
    m1, m2 = alt, ust
    for _ in range(40):
        orta = (m1 + m2) / 2
        g1, g2 = dizi[dizi <= orta], dizi[dizi > orta]
        if not g1.size or not g2.size:
            break
        y1, y2 = float(g1.mean()), float(g2.mean())
        if math.isclose(y1, m1) and math.isclose(y2, m2):
            break
        m1, m2 = y1, y2
    return (m1 + m2) / 2


def _z(degerler: np.ndarray) -> np.ndarray:
    """Ortalama 0, sapma 1 — iki farklı birimdeki ölçüyü toplayabilmek için."""
    sapma = float(degerler.std())
    if sapma < 1e-9:
        return np.zeros_like(degerler)
    return (degerler - float(degerler.mean())) / sapma


def etiketle(parcalar: list[dict]) -> tuple[list[dict], dict]:
    """Ölçülmüş parçalara "ben" / "karsi" yazar.

    İKİ ÖLÇÜ BİRLİKTE (10 Eyl 2026'da ölçülerek düzeltildi):
      * yüksek frekans oranı — telefon kodeki 3,4 kHz üstünü keser
      * rms (ses seviyesi) — sen mikrofona yakınsın, hoparlör uzakta

    Tek başına frekansa bakmak yetmiyordu: sentetik/tiz-fakiri seslerde iki
    taraf da düşük oran veriyor ve ayrım çöküyordu. Seviye eklenince bir ölçü
    zayıfsa diğeri taşıyor. Yine de emin değilse `guven` düşük döner ve panel
    "etiketler ters çıktı, çevir" düğmesini gösterir.

    Dönüş: (etiketli parçalar, güven bilgisi).
    """
    olculur = [p for p in parcalar if float(p["bitis"]) - float(p["baslangic"]) >= EN_KISA_SN]
    if len(olculur) < 2:
        return ([{**p, "konusan": "ben"} for p in parcalar],
                {"guven": 0.0, "esik": 0.0, "not": "ölçülecek yeterli konuşma yok"})

    hf = _z(np.array([p["hf_oran"] for p in olculur], dtype=np.float64))
    rms = _z(np.array([p["rms"] for p in olculur], dtype=np.float64))
    skorlar = hf + rms                       # ikisi de "bana" işaret eder
    esik = _esik_bul(list(skorlar))

    ust = skorlar[skorlar > esik]
    alt = skorlar[skorlar <= esik]
    ayrim = float(ust.mean() - alt.mean()) if ust.size and alt.size else 0.0
    # z uzayında 1,0'lık fark = bir standart sapma; 2,0 üstü net ayrım.
    guven = max(0.0, min(1.0, ayrim / 2.0))

    # Ölçülemeyecek kadar kısa parçalar da bir etiket almalı: en yakın
    # ölçülmüş parçanın etiketini alsın (konuşma sırası korunur).
    skor_haritasi = {id(p): float(s) for p, s in zip(olculur, skorlar, strict=True)}
    etiketli: list[dict] = []
    son_etiket = "ben"
    for p in parcalar:
        if id(p) in skor_haritasi:
            son_etiket = "ben" if skor_haritasi[id(p)] > esik else "karsi"
        etiketli.append({**p, "konusan": son_etiket})

    return etiketli, {
        "guven": round(guven, 2),
        "esik": round(float(esik), 4),
        "ben_parca": sum(1 for p in etiketli if p["konusan"] == "ben"),
        "karsi_parca": sum(1 for p in etiketli if p["konusan"] == "karsi"),
        "not": "yüksek frekans oranı + ses seviyesi: doğrudan ses (ben) > hoparlör (karşı)",
    }


def ters_cevir(parcalar: list[dict]) -> list[dict]:
    """Panelden "etiketler ters" denince — tek tıkla düzeltme."""
    return [
        {**p, "konusan": "karsi" if p.get("konusan") == "ben" else "ben"} for p in parcalar
    ]


def konusma_metni(parcalar: list[dict]) -> str:
    """Analiz istemine gidecek okunur döküm."""
    satir = []
    for p in parcalar:
        kim = "BEN" if p.get("konusan") == "ben" else "KARŞI"
        satir.append(f"[{float(p['baslangic']):6.1f}s] {kim}: {p['metin'].strip()}")
    return "\n".join(satir)
