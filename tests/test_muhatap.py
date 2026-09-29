"""python -m unittest tests.test_muhatap"""
import unittest
from collections import Counter

from services.radar.muhatap import (
    ad_anahtari, havuzu_suz, kurumsal_ad_mi, muhatap_puani, spam_ad_mi,
    telefon_turu,
)


def av(name, phone="+905321112233", **ek):
    return {"name": name, "phone": phone, "kind_tr": "Kafe", **ek}


class TelefonTuru(unittest.TestCase):
    def test_cep_numarasi_cep_doner(self):
        self.assertEqual(telefon_turu("+90 532 111 22 33"), "cep")
        self.assertEqual(telefon_turu("05321112233"), "cep")

    def test_sabit_hat_sabit_doner(self):
        self.assertEqual(telefon_turu("+902164188855"), "sabit")
        self.assertEqual(telefon_turu("0212 555 66 77"), "sabit")

    def test_0850_ve_444_cagri_merkezi(self):
        self.assertEqual(telefon_turu("08502223344"), "cagri_merkezi")
        self.assertEqual(telefon_turu("+90 444 1 234 567"), "cagri_merkezi")

    def test_bos_veya_kisa_yok(self):
        self.assertEqual(telefon_turu(""), "yok")
        self.assertEqual(telefon_turu(None), "yok")
        self.assertEqual(telefon_turu("12345"), "yok")


class KurumsalAd(unittest.TestCase):
    def test_kurumsal_anahtarlar_yakalanir(self):
        for ad in ("The Key Aesthetic A.Ş.", "Dent Group", "EsteNuvo Health Group",
                   "KOLOMON Yapı A.Ş.", "Bağdat Cad. Şubesi", "Fermuar Hastanesi",
                   "Optimum AVM", "Siyomer Gayrimenkul Yatırım"):
            self.assertTrue(kurumsal_ad_mi(ad), ad)

    def test_kucuk_esnaf_kurumsal_sayilmaz(self):
        for ad in ("Nazlı Otomotiv", "Ayşe Kuaför Ltd. Şti.", "Manolya Pastanesi",
                   "Grupo Latino Dans"):
            self.assertFalse(kurumsal_ad_mi(ad), ad)

    def test_hayvan_hastanesi_istisna(self):
        self.assertFalse(kurumsal_ad_mi("Univet Hayvan Hastanesi"))


class SpamAd(unittest.TestCase):
    def test_seo_ilani_spam(self):
        self.assertTrue(spam_ad_mi("Suadiye gümüş alanlar 0533 653 19 19"))
        self.assertTrue(spam_ad_mi("Kadıköy antika eşya alım satım"))

    def test_normal_ad_spam_degil(self):
        self.assertFalse(spam_ad_mi("Köşe Kahve"))
        self.assertFalse(spam_ad_mi("Studio 34 Pilates"))


class HavuzSuzme(unittest.TestCase):
    def test_ortak_telefon_elenir(self):
        avlar = [av("Antika Merkezi A", "+905336531919"),
                 av("Gümüş Evi B", "+905336531919"),
                 av("Köşe Kahve", "+905321112233")]
        kalan, sayac = havuzu_suz(avlar)
        self.assertEqual([k["name"] for k in kalan], ["Köşe Kahve"])
        self.assertEqual(sayac["ortak_telefon"], 2)

    def test_uc_subeli_ad_zincir_sayilir(self):
        avlar = [av("Komşufırın", f"+90532111{i:04d}") for i in range(3)] + [av("Tek Fırın")]
        kalan, sayac = havuzu_suz(avlar)
        self.assertEqual([k["name"] for k in kalan], ["Tek Fırın"])
        self.assertEqual(sayac["coklu_sube"], 3)

    def test_kalanlara_telefon_turu_ve_puan_yazilir(self):
        kalan, _ = havuzu_suz([av("Köşe Kahve", "+902161112233")])
        self.assertEqual(kalan[0]["telefon_turu"], "sabit")
        self.assertEqual(kalan[0]["muhatap_puani"], 0.75)

    def test_cagri_merkezi_ve_kurumsal_elenir(self):
        kalan, sayac = havuzu_suz([av("Seyahat A.Ş.", "+905321112233"),
                                   av("Tur Merkezi", "08502223344")])
        self.assertEqual(kalan, [])
        self.assertEqual(sayac["kurumsal_ad"], 1)
        self.assertEqual(sayac["cagri_merkezi"], 1)

    def test_girdi_degistirilmez(self):
        girdi = [av("Köşe Kahve")]
        havuzu_suz(girdi)
        self.assertNotIn("muhatap_puani", girdi[0])


class MuhatapPuani(unittest.TestCase):
    def test_cep_tam_puan_sabit_dusuk(self):
        self.assertEqual(muhatap_puani(av("x", "+905321112233")), 1.0)
        self.assertEqual(muhatap_puani(av("x", "+902161112233")), 0.75)

    def test_iki_sube_puani_dusurur(self):
        sayac = Counter({ad_anahtari("Manolya Pastanesi"): 2})
        self.assertEqual(muhatap_puani(av("Manolya Pastanesi"), sayac), 0.8)


if __name__ == "__main__":
    unittest.main()
