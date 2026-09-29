"""Katalog bütünlüğü: her Overture kategorisi kapsanıyor mu, her türde 3-5
fikir var mı, alanlar dolu mu. python -m unittest tests.test_fikirler"""
import unittest

from services.radar import fikirler
from services.radar.overture import KATEGORI_TR


class KatalogKapsami(unittest.TestCase):
    def test_her_overture_kategorisinin_turu_var(self):
        eksik = sorted({tr for tr in KATEGORI_TR.values() if tr not in fikirler.TURLER})
        self.assertEqual(eksik, [], f"katalogda olmayan türler: {eksik}")

    def test_her_turde_3_ile_5_fikir(self):
        for ad, tur in fikirler.TURLER.items():
            self.assertTrue(3 <= len(tur.fikirler) <= 5, f"{ad}: {len(tur.fikirler)} fikir")

    def test_her_turde_tek_demo(self):
        for ad, tur in fikirler.TURLER.items():
            demo = [f for f in tur.fikirler if f.demo]
            self.assertEqual(len(demo), 1, f"{ad}: {len(demo)} demo işaretli")

    def test_fikir_kodlari_tur_icinde_tekil(self):
        for ad, tur in fikirler.TURLER.items():
            kodlar = [f.kod for f in tur.fikirler]
            self.assertEqual(len(kodlar), len(set(kodlar)), f"{ad}: {kodlar}")

    def test_alanlar_dolu_ve_soru_soru_isareti_ile_biter(self):
        for ad, tur in fikirler.TURLER.items():
            for f in tur.fikirler:
                for alan in ("kod", "ad", "soru", "aci", "yapar", "para", "kurulum", "aylik"):
                    self.assertTrue(getattr(f, alan).strip(), f"{ad}/{f.kod}: {alan} boş")
                self.assertTrue(f.soru.rstrip().endswith("?"), f"{ad}/{f.kod}: soru '?' ile bitmeli")
                self.assertIn(f.zorluk, (1, 2, 3), f"{ad}/{f.kod}")

    def test_katsayilar_aralikta(self):
        for ad, tur in fikirler.TURLER.items():
            self.assertTrue(0.5 <= tur.bilet <= 1.7, f"{ad} bilet {tur.bilet}")
            self.assertTrue(0.5 <= tur.hiz <= 1.5, f"{ad} hiz {tur.hiz}")
            self.assertTrue(0.3 <= tur.muhatap <= 1.0, f"{ad} muhatap {tur.muhatap}")

    def test_her_grubun_bilgisi_var(self):
        for ad, tur in fikirler.TURLER.items():
            g = fikirler.grup_bilgisi(tur.grup)
            self.assertTrue(g.sebep and g.kapanis and g.demo_senaryo, f"{ad}: grup {tur.grup}")


class KatalogApi(unittest.TestCase):
    def test_bilinmeyen_tur_varsayilana_duser(self):
        self.assertEqual(fikirler.tur_profili("İşletme").grup, "diger")
        self.assertEqual(fikirler.tur_profili(None).grup, "diger")

    def test_demo_urunu_isaretli_olani_doner(self):
        self.assertTrue(fikirler.demo_urunu("Kuaför").demo)
        self.assertEqual(fikirler.demo_urunu("Berber").kod, "sira_bildirim")

    def test_demo_hazir_dosya_yoksa_false(self):
        self.assertFalse(fikirler.demo_hazir_mi("yeme"))


if __name__ == "__main__":
    unittest.main()
