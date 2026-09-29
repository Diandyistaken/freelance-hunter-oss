"""python -m unittest tests.test_hedefleme"""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from services.radar import hedefleme
from services.radar.fikirler import tur_profili


def av(name, kind_tr, phone="+905321112233", bolge="Suadiye", **ek):
    tur = "cep" if phone.replace("+90", "").lstrip("0").startswith("5") else "sabit"
    return {"name": name, "kind_tr": kind_tr, "phone": phone, "bolge": bolge,
            "telefon_turu": tur, "muhatap_puani": 1.0 if tur == "cep" else 0.75, **ek}


class Skor(unittest.TestCase):
    def test_cep_sabitten_yuksek(self):
        tur = tur_profili("Kuaför")
        cep = hedefleme.arama_skoru(av("A", "Kuaför"), tur)
        sabit = hedefleme.arama_skoru(av("B", "Kuaför", phone="+902161112233"), tur)
        self.assertGreater(cep, sabit)

    def test_kalite_bonusu_ekler(self):
        tur = tur_profili("Kuaför")
        duz = hedefleme.arama_skoru(av("A", "Kuaför"), tur)
        kaliteli = hedefleme.arama_skoru(av("A", "Kuaför", kalite_puani=80), tur)
        self.assertGreater(kaliteli, duz)


class SahaKaniti(unittest.TestCase):
    """Sahadan gelen kanıt katsayısı (Tur.saha).

    22 Eyl 2026: dört psikolog reddetti; radar ise psikoloğu 122 tür içinde
    4. en çekici hedef sayıyordu (gerçek havuzda en iyi psikolog 10.916
    adayın 160.'sıydı). Kullanıcı kararı: "puanları düşsün" — listede
    kalırlar ama sıranın SONUNA giderler. Bu testin iddiası o cümlenin
    kendisi: cezalı türün EN İYİSİ, cezasız türlerin EN ZAYIFININ altında.
    """

    def test_cezali_turun_en_iyisi_her_adayin_altinda(self):
        from services.radar.fikirler import TURLER
        cezali = {ad for ad, t in TURLER.items() if t.saha < 1.0}
        self.assertIn("Psikolog", cezali)
        self.assertIn("Psikolojik danışmanlık", cezali)
        # En iyi hâl: cep telefonu (patron açar) + tam kalite bonusu.
        en_iyi_cezali = max(
            hedefleme.arama_skoru(av("P", ad, kalite_puani=100), TURLER[ad])
            for ad in cezali)
        # En zayıf hâl: sabit hat, bonus yok.
        en_zayif_diger = min(
            hedefleme.arama_skoru(av("O", ad, phone="+902161112233"), t)
            for ad, t in TURLER.items() if ad not in cezali)
        self.assertLess(en_iyi_cezali, en_zayif_diger)

    def test_cezasiz_tur_etkilenmez(self):
        from services.radar.fikirler import TURLER
        self.assertEqual(TURLER["Kuaför"].saha, 1.0)


class Secim(unittest.TestCase):
    def test_tur_tavani_cesitlendirir(self):
        avlar = [av(f"Diş {i}", "Diş kliniği") for i in range(6)] + [av("Köşe Berber", "Berber")]
        secilen = hedefleme.hedefleri_sec(avlar, adet=10, tur_tavani=3)
        self.assertEqual(sum(1 for h in secilen if h["sektor"] == "Diş kliniği"), 3)
        self.assertIn("Köşe Berber", [h["ad"] for h in secilen])

    def test_isaretli_slug_atlanir(self):
        avlar = [av("Köşe Berber", "Berber"), av("Yan Berber", "Berber")]
        secilen = hedefleme.hedefleri_sec(avlar, atla={"kose-berber"})
        self.assertEqual([h["ad"] for h in secilen], ["Yan Berber"])

    def test_acilmayan_numara_listede_kalir_tavana_kadar(self):
        """Açılmayan arama bir karar değil, bir deneme: hedef listeden düşmez.
        TEKRAR_TAVANI kadar denendiyse artık gelmez."""
        with tempfile.TemporaryDirectory() as gecici:
            db = Path(gecici) / "t.sqlite"
            # sqlite3'te `with` yalnız commit eder, KAPATMAZ — Windows'ta
            # açık kalan dosya geçici dizin silinirken hata veriyor.
            con = sqlite3.connect(db)
            try:
                con.execute("""CREATE TABLE radar_durum (
                    slug TEXT PRIMARY KEY, durum TEXT, deneme INTEGER)""")
                con.executemany(
                    "INSERT INTO radar_durum VALUES (?, ?, ?)",
                    [("az-denenen", "ulasilamadi", 1),
                     ("cok-denenen", "ulasilamadi", hedefleme.TEKRAR_TAVANI),
                     ("karar-verilen", "olmaz", 0)])
                con.commit()
            finally:
                con.close()
            with mock.patch.object(hedefleme, "DB_PATH", db):
                atlanan = hedefleme.isaretli_sluglar()
        self.assertNotIn("az-denenen", atlanan)
        self.assertIn("cok-denenen", atlanan)
        self.assertIn("karar-verilen", atlanan)

    def test_bolge_suzer_ve_skora_gore_siralar(self):
        avlar = [av("Uzak", "Berber", bolge="Üsküdar"),
                 av("Sabit Berber", "Berber", phone="+902161112233"),
                 av("Cep Berber", "Berber")]
        secilen = hedefleme.hedefleri_sec(avlar, bolgeler=("Suadiye",))
        self.assertEqual([h["ad"] for h in secilen], ["Cep Berber", "Sabit Berber"])

    def test_hedef_alanlari(self):
        h = hedefleme.hedefleri_sec([av("Köşe Berber", "Berber")])[0]
        self.assertEqual(h["demo"], "sira_bildirim")
        self.assertTrue(3 <= len(h["fikirler"]) <= 5)
        for anahtar in ("urun", "arama_skoru", "domain", "lat", "lon", "yan_not"):
            self.assertIn(anahtar, h)


class Konusma(unittest.TestCase):
    def setUp(self):
        self.h = hedefleme.hedefleri_sec([av("Köşe Berber", "Berber")])[0]

    def test_demo_yokken_gelistiriyorum_der_yaptim_demez(self):
        k = hedefleme.konusma({**self.h, "demo_hazir": False})
        self.assertIn("geliştiriyorum", k["somut"])
        self.assertNotIn("yaptım", k["somut"])

    def test_demo_hazirsa_calisan_hali_anlatilir(self):
        k = hedefleme.konusma({**self.h, "demo_hazir": True})
        self.assertIn("10 dakika", k["somut"])

    def test_adimlar_yeni_sirada_ve_dolu(self):
        k = hedefleme.konusma(self.h)
        for anahtar in ("acilis", "soru", "sus", "sebep", "somut", "randevu"):
            self.assertTrue(k[anahtar], anahtar)
        self.assertTrue(k["soru"].rstrip().endswith("?"))
        # Sebep, sorudan SONRA söylenir ve "ben zaten bunun için aradım" der.
        self.assertIn("bunun için aradım", k["sebep"])

    def test_kanca_sorusu_sayi_istemez(self):
        """Yeni sözleşme: soru 'şu an nasıl yapıyorsunuz' der, rakam sormaz."""
        for hedef in hedefleme.hedefleri_sec(
            [av("Köşe Berber", "Berber"), av("Studio Pilates", "Pilates stüdyosu"),
             av("Diş Merkezi", "Diş kliniği")]
        ):
            soru = hedefleme.konusma(hedef)["soru"].lower()
            self.assertNotIn("kaç ", soru, soru)
            self.assertNotIn("kaçı", soru, soru)

    def test_dinleme_yolu_varsayim_yapmaz(self):
        """Cevap duyulmadan 'elle takip ediyorsunuz' gibi etiket yapıştırılmaz."""
        k = hedefleme.konusma(self.h)
        self.assertGreaterEqual(len(k["dinle"]), 4)
        for dal in k["dinle"]:
            self.assertTrue(dal["cevap"] and dal["ne_yap"])
        self.assertIn("SUS", k["sus"])

    def test_itirazlar_on_tane_ve_baskisiz(self):
        k = hedefleme.konusma(self.h)
        self.assertGreaterEqual(len(k["itirazlar"]), 10)
        metin = " ".join(i["cevap"] for i in k["itirazlar"]).lower()
        for yasak in ("demek ki ihtiyaç var", "en pahalı", "kaybedersiniz"):
            self.assertNotIn(yasak, metin)

    def test_denedik_memnun_kalmadik_dali_soru_sorar(self):
        """11 Eyl 2026: ilk gerçek itiraz 'daha önce denedik, memnun kalmadık'tı.
        Bu bir RED değil, ihtiyacın var olduğunun kanıtı — konuşma orada
        kapanmamalı, tek bir merak sorusuyla sebebi öğrenmeli."""
        k = hedefleme.konusma(self.h)
        dal = next(d for d in k["dinle"] if "denedik" in d["cevap"].lower())
        self.assertIn("hangi tarafı", dal["ne_yap"])
        itiraz = next(i for i in k["itirazlar"] if "denedik" in i["itiraz"].lower())
        self.assertIn("ne denediniz", itiraz["cevap"].lower())
        # Baskı yok: uymazsa bırakılıyor.
        self.assertIn("üstelemem", itiraz["cevap"])

    def test_yan_not_gozlem_olarak_tasinir(self):
        k = hedefleme.konusma({**self.h, "yan_not": "siteniz telefonda yavaş açılıyor"})
        self.assertEqual(k["yan_not"], "siteniz telefonda yavaş açılıyor")


class UctanUca(unittest.TestCase):
    def test_calistir_havuzdan_md_ve_json_yazar(self):
        with tempfile.TemporaryDirectory() as d:
            kok = Path(d)
            havuz = {"olusturuldu": "2026-09-09T10:00:00", "bolgeler": ["Suadiye"],
                     "isletmeler": [av("Köşe Berber", "Berber"), av("Studio Pilates", "Pilates stüdyosu")]}
            (kok / "havuz.json").write_text(json.dumps(havuz, ensure_ascii=False), encoding="utf-8")
            with mock.patch.object(hedefleme.havuz_modulu, "HAVUZ_JSON", kok / "havuz.json"), \
                 mock.patch.object(hedefleme, "CIKTI_MD", kok / "l.md"), \
                 mock.patch.object(hedefleme, "CIKTI_JSON", kok / "l.json"), \
                 mock.patch.object(hedefleme, "RADAR_JSON", kok / "yok.json"), \
                 mock.patch.object(hedefleme, "isaretli_sluglar", lambda: set()):
                hedefler = hedefleme.calistir(adet=5)
            self.assertEqual(len(hedefler), 2)
            md = (kok / "l.md").read_text(encoding="utf-8")
            self.assertIn("### 1. Açılış", md)
            self.assertIn("### 2. Kanca sorusu", md)
            self.assertIn("### 4. Sebep", md)
            self.assertIn("Olası itirazlar", md)
            veri = json.loads((kok / "l.json").read_text(encoding="utf-8"))
            self.assertEqual(veri["kaynak"], "havuz")
            self.assertIn("konusma", veri["hedefler"][0])

    def test_havuz_yoksa_anlasilir_hata(self):
        with mock.patch.object(hedefleme.havuz_modulu, "HAVUZ_JSON", Path("yok/havuz.json")):
            with self.assertRaises(FileNotFoundError):
                hedefleme.calistir()


if __name__ == "__main__":
    unittest.main()
