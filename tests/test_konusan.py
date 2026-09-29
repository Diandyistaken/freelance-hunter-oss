"""Konuşan ayrımı — kurulum gerektirmeyen frekans yönteminin sınavı.

python -m unittest tests.test_konusan

Sentetik ses gerçek kayıt değil ama YÖNTEMİN dayandığı fiziği birebir taklit
eder: doğrudan ses geniş bant, hoparlörden gelen telefon sesi 300-3400 Hz'e
kırpılmış. Yöntem bu farkı göremiyorsa gerçek kayıtta da göremez.
"""

import unittest

import numpy as np

from services.arama import konusan

ORNEKLEME = 16_000


def _genis_bant(n: int, rng) -> np.ndarray:
    """Mikrofona doğrudan gelen ses — 4 kHz üstünde de enerji var."""
    return (rng.standard_normal(n) * 0.30).astype("float32")


def _telefon_bandi(n: int, rng) -> np.ndarray:
    """Hoparlörden çıkan telefon sesi — 300-3400 Hz dışı kesilmiş, daha kısık."""
    x = rng.standard_normal(n)
    izge = np.fft.rfft(x)
    frekans = np.fft.rfftfreq(n, 1 / ORNEKLEME)
    izge[(frekans < 300) | (frekans > 3400)] = 0
    return (np.fft.irfft(izge, n) * 0.12).astype("float32")


def _gorusme(desen: str, sn: float = 1.5):
    """desen: 'bkbk' → ben, karşı, ben, karşı sırayla konuşur."""
    rng = np.random.default_rng(7)
    dalga, parcalar, t = [], [], 0.0
    n = int(ORNEKLEME * sn)
    for harf in desen:
        dalga.append(_genis_bant(n, rng) if harf == "b" else _telefon_bandi(n, rng))
        parcalar.append({"baslangic": round(t, 2), "bitis": round(t + sn, 2),
                         "metin": f"{harf} parçası"})
        t += sn
    return np.concatenate(dalga), parcalar


class OlcumTesti(unittest.TestCase):
    def test_genis_bant_yuksek_frekans_orani_daha_buyuk(self):
        dalga, parcalar = _gorusme("bk")
        olculu = konusan.olc(dalga, ORNEKLEME, parcalar)
        self.assertGreater(olculu[0]["hf_oran"], olculu[1]["hf_oran"])

    def test_kisa_parca_cokmeden_olculur(self):
        dalga, parcalar = _gorusme("b", sn=0.01)
        olculu = konusan.olc(dalga, ORNEKLEME, parcalar)
        self.assertEqual(olculu[0]["hf_oran"], 0.0)


class EtiketTesti(unittest.TestCase):
    def test_sirayla_konusma_dogru_etiketlenir(self):
        dalga, parcalar = _gorusme("bkbkbk")
        etiketli, guven = konusan.etiketle(konusan.olc(dalga, ORNEKLEME, parcalar))
        self.assertEqual([p["konusan"] for p in etiketli],
                         ["ben", "karsi", "ben", "karsi", "ben", "karsi"])
        self.assertGreaterEqual(guven["guven"], 0.9)
        self.assertEqual(guven["ben_parca"], 3)
        self.assertEqual(guven["karsi_parca"], 3)

    def test_dengesiz_konusmada_da_ayirir(self):
        # Gerçek arama böyle: ben çok konuşurum, karşı taraf iki kelime eder.
        dalga, parcalar = _gorusme("bbbbk")
        etiketli, _ = konusan.etiketle(konusan.olc(dalga, ORNEKLEME, parcalar))
        self.assertEqual([p["konusan"] for p in etiketli][-1], "karsi")
        self.assertEqual([p["konusan"] for p in etiketli][:4], ["ben"] * 4)

    def test_tek_parca_varsa_bana_yazar_ve_guven_sifir(self):
        dalga, parcalar = _gorusme("b")
        etiketli, guven = konusan.etiketle(konusan.olc(dalga, ORNEKLEME, parcalar))
        self.assertEqual(etiketli[0]["konusan"], "ben")
        self.assertEqual(guven["guven"], 0.0)

    def test_ters_cevir_etiketleri_degistirir(self):
        dalga, parcalar = _gorusme("bk")
        etiketli, _ = konusan.etiketle(konusan.olc(dalga, ORNEKLEME, parcalar))
        ters = konusan.ters_cevir(etiketli)
        self.assertEqual([p["konusan"] for p in ters], ["karsi", "ben"])

    def test_girdi_degistirilmez(self):
        dalga, parcalar = _gorusme("bk")
        konusan.etiketle(konusan.olc(dalga, ORNEKLEME, parcalar))
        self.assertNotIn("konusan", parcalar[0])


class DokumTesti(unittest.TestCase):
    def test_konusma_metni_kim_ne_dedi_yazar(self):
        metin = konusan.konusma_metni([
            {"baslangic": 0.0, "bitis": 1.0, "metin": "Merhaba", "konusan": "ben"},
            {"baslangic": 1.0, "bitis": 2.0, "metin": "Buyurun", "konusan": "karsi"},
        ])
        self.assertIn("BEN: Merhaba", metin)
        self.assertIn("KARŞI: Buyurun", metin)


if __name__ == "__main__":
    unittest.main()
