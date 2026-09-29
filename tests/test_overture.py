"""Overture şema uyumu: 2026-09-23.0 sürümüyle `categories` kalktı, yerine
`taxonomy` geldi ve 26 hedef kategorinin adı değişti. Havuz eski anahtarlarla
çalışmaya devam etmeli. Ağa çıkmaz. python -m pytest tests/test_overture.py"""
import unittest

from services.radar import overture

BOLGELER = [("Maltepe", 40.935, 29.13, 2500)]


def satir(kat: str) -> dict:
    return {
        "ad": "Örnek İşletme", "kat": kat, "guven": 0.9,
        "siteler": ["https://ornekisletme.com"], "telefonlar": ["+902161234567"],
        "epostalar": [], "adres": "Bağdat Cd. 1", "marka": None,
        "kaynak_sayisi": 2, "lat": 40.935, "lon": 29.13,
    }


class YeniTaksonomi(unittest.TestCase):
    def test_yeni_ad_eski_anahtara_doner(self):
        av = overture._satiri_ave_cevir(satir("spa"), BOLGELER)
        self.assertEqual(av["kind"], "spas")
        self.assertEqual(av["kind_tr"], "Spa")

    def test_psikolog_katsayisi_icin_turkce_ad_korunur(self):
        # saglik.py psikoloğu Türkçe adıyla sona iter; ad değişirse iterleme kaybolur.
        av = overture._satiri_ave_cevir(satir("psychology"), BOLGELER)
        self.assertEqual(av["kind_tr"], "Psikolog")

    def test_degismeyen_ad_oldugu_gibi_kalir(self):
        av = overture._satiri_ave_cevir(satir("pilates_studio"), BOLGELER)
        self.assertEqual((av["kind"], av["kind_tr"]), ("pilates_studio", "Pilates stüdyosu"))

    def test_eslemenin_her_hedefi_katalogda(self):
        disarida = sorted(set(overture.TAKSONOMI_ESKI_AD.values()) - set(overture.KATEGORI_TR))
        self.assertEqual(disarida, [])

    def test_sorgu_listesi_hem_eski_hem_yeni_adi_icerir(self):
        liste = overture._kategori_listesi_sql()
        for ad in ("'spas'", "'spa'", "'lawyer'", "'attorney_or_law_firm'"):
            self.assertIn(ad, liste)


class SemaTespiti(unittest.TestCase):
    def test_taksonomi_varsa_onu_kullanir(self):
        self.assertEqual(overture._kategori_ifadesi({"taxonomy", "categories"}), "taxonomy.primary")

    def test_eski_surumde_categories_kullanir(self):
        self.assertEqual(overture._kategori_ifadesi({"categories", "id"}), "categories.primary")

    def test_ikisi_de_yoksa_anlasilir_hata(self):
        with self.assertRaisesRegex(RuntimeError, "kategori alanı"):
            overture._kategori_ifadesi({"id", "names"})


if __name__ == "__main__":
    unittest.main()
