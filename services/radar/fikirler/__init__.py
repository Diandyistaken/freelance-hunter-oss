"""Fikir kataloğu — her işletme türü için 3-5 satılabilir yazılım fikri.

Kural: ürün değil KALIP. Bir çekirdek + sektör şablonu + otomatik
kişiselleştirme; "size özel" hissi kişiselleştirmeden gelir, sıfırdan
yazmaktan değil (docs/yazilim-fikirleri.md §0).

Katalog dosyaları (yeme.py, kafe.py, …) yalnız veri tutar. Bu dosya:
  * tüm türleri tek sözlükte birleştirir (çakışma = hata),
  * grup bilgisini (sebep köprüsü, kapanış cümlesi, demo senaryosu) verir,
  * demo hazır mı bilgisini `data/demo_durumu.json`'dan okur.

Fiyat bantları ÖNERİDİR — `_HQ/knowledge/offer.md`'ye işlenmedi.
"""

from __future__ import annotations

import json

from packages.shared.config import settings
from services.radar.fikirler import (
    etkinlik_medya, guzellik, hizmet, kafe, konaklama_seyahat, ofis_emlak,
    perakende, saglik, spor_egitim, yeme,
)
from services.radar.fikirler._tip import F, Fikir, Grup, Tur

__all__ = ["Fikir", "Grup", "Tur", "GRUPLAR", "TURLER", "tur_profili",
           "fikirler_icin", "demo_urunu", "demo_hazir_mi", "grup_bilgisi"]

# ----------------------------------------------------------------- gruplar
# `sebep` 11 Eyl 2026'da yer değiştirdi: artık kanca sorusundan SONRA söyleniyor
# ve karşı tarafın verdiği cevaba bağlanıyor. İçeriği de değişti — "sizde şu
# sorun var" iddiası yerine, DOĞRU olan tek şey: ne geliştirdiğim ve neden
# gerçek işletmelerle konuşarak şekillendirdiğim. Uydurma istatistik, korku ve
# "para kaybediyorsunuz" cümleleri yok.
# `kapanis`: net, baskısız, gün/saat veren randevu isteği.
GRUPLAR: dict[str, Grup] = {
    "yeme": Grup(
        "Restoran & bar",
        sebep="Rezervasyon ve sipariş tarafının gerçekte nasıl yürüdüğünü görmeden "
              "işe yarar bir şey çıkmıyor, o yüzden tek tek arayıp soruyorum.",
        kapanis="Bunu telefonda anlatmak yerine ekranda göstermek daha kolay. "
                "Yarın servis başlamadan, 15 gibi 10 dakika uğrasam olur mu?",
        demo_senaryo="Telefonumdan örnek bir mesaj atarım; gelen isteğin nasıl kayda "
                     "düştüğünü ve hatırlatmanın nasıl gittiğini gösteririm.",
    ),
    "kafe": Grup(
        "Kafe & fırın",
        sebep="Bileti küçük olan yerlerde neyin işe yaradığını ancak sizin gibi "
              "yerlerle konuşarak anlıyorum.",
        kapanis="Sakin bir saatinizde 10 dakika uğrayıp ekranda göstereyim — "
                "yarın 15 gibi uygun olur mu?",
        demo_senaryo="Kasada telefon numarasıyla puan yazılması ve bir süredir "
                     "gelmeyen müşteriye giden kısa mesaj.",
    ),
    "guzellik": Grup(
        "Kuaför, güzellik & spa",
        sebep="Randevu takviminin salonlarda gerçekte nasıl döndüğünü görmeden "
              "doğru şeyi yapamıyorum, o yüzden arıyorum.",
        kapanis="Yarın sakin bir saatinizde 10 dakika uğrayıp ekranda göstereyim — "
                "salı sabahı gibi uygun olur mu?",
        demo_senaryo="Örnek takvimde bir randevuyu iptal ederim; bekleme listesindeki "
                     "müşteriye giden mesaj ve saatin yeniden dolması görünür.",
    ),
    "klinik": Grup(
        "Diş, estetik & klinik",
        sebep="Kliniklerde bu işin sekreterle mi, defterle mi, programla mı "
              "yürüdüğünü öğrenmek için arıyorum.",
        kapanis="Hocanın öğle arasına denk getirip 10 dakikada ekranda "
                "gösterebilirim. Yarın 13 gibi uygun olur mu?",
        demo_senaryo="Örnek hastaya giden onay mesajı ve 'erteliyorum' denince o "
                     "saatin nasıl yeniden değerlendirildiği.",
    ),
    "ruh_beslenme": Grup(
        "Psikolog & diyetisyen",
        sebep="Seansla çalışan uzmanların bu takibi nasıl çevirdiğini anlamadan "
              "doğru şeyi yapamıyorum.",
        kapanis="Seanslar arasında 10 dakikada ekranda gösterebilirim. Yarın "
                "12:30 gibi uygun olur mu?",
        demo_senaryo="Örnek danışana giden hatırlatma ve iptal olan saatin bekleyene "
                     "açılması.",
    ),
    "veteriner": Grup(
        "Veteriner & pet",
        sebep="Aşı ve parazit takibinin kliniklerde gerçekte nasıl tutulduğunu "
              "öğrenmek için arıyorum.",
        kapanis="Öğleden sonra sakin bir saatinizde 10 dakika uğrayıp göstereyim — "
                "yarın 15 gibi olur mu?",
        demo_senaryo="Örnek hasta kartındaki takvim ve tarihi gelince sahibine giden "
                     "kısa hatırlatma.",
    ),
    "uyelik": Grup(
        "Spor salonu & stüdyo",
        sebep="Üye takibinin stüdyolarda nasıl yürüdüğünü görmeden işe yarar bir "
              "şey çıkmıyor, o yüzden tek tek arıyorum.",
        kapanis="Ders saatleri dışında 10 dakika uğrayıp ekranda gösterebilirim. "
                "Yarın 14 gibi uygun olur mu?",
        demo_senaryo="Bir süredir gelmeyen üyelerin listesi, eğitmen adına giden kısa "
                     "mesaj ve ders yeri boşalınca bekleyene gitmesi.",
    ),
    "egitim": Grup(
        "Anaokulu & kurs",
        sebep="Veliyle iletişimin okullarda nasıl döndüğünü öğrenmek için arıyorum.",
        kapanis="Çıkış saatinden önce 10 dakika uğrayıp göstereyim — yarın 13:30 "
                "gibi uygun olur mu?",
        demo_senaryo="Öğretmen ekranında iki dokunuşla giren not ve veliye akşam "
                     "giden özet.",
    ),
    "konaklama": Grup(
        "Otel & pansiyon",
        sebep="Rezervasyonun doğrudan mı platformdan mı geldiğini ve bunun nasıl "
              "yönetildiğini öğrenmek için arıyorum.",
        kapanis="Çıkışlar bittikten sonra 10 dakika uğrayıp göstereyim — yarın 14 "
                "gibi olur mu?",
        demo_senaryo="WhatsApp'a tarih yazınca müsaitlik ve rezervasyon bağlantısının "
                     "gitmesi.",
    ),
    "seyahat": Grup(
        "Seyahat & araç kiralama",
        sebep="Teklif sonrası takibin acentelerde nasıl yürüdüğünü öğrenmek için "
              "arıyorum.",
        kapanis="Yarın 11 gibi 10 dakika uğrayıp ekranda gösterebilirim, uygun "
                "olur mu?",
        demo_senaryo="Örnek teklifin açıldığında haber vermesi ve birkaç gün "
                     "sessizlikte giden nazik hatırlatma.",
    ),
    "ofis": Grup(
        "Avukat, müşavir & mimar",
        sebep="Müvekkil ve müşteri bilgilendirmesinin ofislerde nasıl yapıldığını "
              "öğrenmek için arıyorum.",
        kapanis="Öğle arasında 10 dakika uğrayıp gösterebilirim. Yarın uygun "
                "olur mu?",
        demo_senaryo="Örnek dosyada aşama değişince karşı tarafa giden kısa "
                     "bilgilendirme.",
    ),
    "emlak": Grup(
        "Emlak",
        sebep="Yeni portföyün alıcıya nasıl ulaştırıldığını öğrenmek için arıyorum.",
        kapanis="Yarın 11 gibi ofisinize 10 dakika uğrayıp göstereyim, uygun "
                "olur mu?",
        demo_senaryo="Örnek ilan girilince tercihine uyan alıcıya giden mesaj ve "
                     "gösterim randevusu.",
    ),
    "etkinlik": Grup(
        "Organizasyon, fotoğraf & gelinlik",
        sebep="Tarih tutma ve teklif takibinin nasıl yürüdüğünü öğrenmek için "
              "arıyorum.",
        kapanis="Yarın 11 gibi 10 dakika uğrayıp gösterebilirim, uygun olur mu?",
        demo_senaryo="Müsait tarihlerin takvimden seçilmesi ve prova/çekim "
                     "hatırlatmasının kendiliğinden gitmesi.",
    ),
    "perakende": Grup(
        "Mağaza & butik",
        sebep="Telefonla gelen 'var mı, geldi mi' sorularının mağazalarda nasıl "
              "karşılandığını öğrenmek için arıyorum.",
        kapanis="Sakin bir saatinizde 10 dakika uğrayıp göstereyim — yarın uygun "
                "olur mu?",
        demo_senaryo="WhatsApp'a ürün yazınca gelen cevap ve 'geldiğinde haber ver' "
                     "listesi.",
    ),
    "hizmet": Grup(
        "Terzi, oto servis & nakliyat",
        sebep="İş hazır olduğunda müşteriye nasıl haber verildiğini öğrenmek için "
              "arıyorum.",
        kapanis="Yarın 11 gibi 10 dakika uğrayıp gösterebilirim, uygun olur mu?",
        demo_senaryo="'Hazır' işaretlenince müşteriye giden fotoğraflı mesaj ve "
                     "teslim saati seçimi.",
    ),
    "diger": Grup(
        "Diğer işletme",
        sebep="Yoğun saatte gelen telefonların nasıl karşılandığını öğrenmek için "
              "arıyorum.",
        kapanis="Yarın 11 gibi 10 dakika uğrayıp göstereyim, uygun olur mu?",
        demo_senaryo="Açılmayan aramaya giden otomatik mesaj ve geri arama listesi.",
    ),
}

# Katalogda olmayan tür (Overture'da "İşletme" olarak gelen) için genel kalıp.
VARSAYILAN_TUR = Tur("diger", bilet=0.6, hiz=1.0, muhatap=0.8, fikirler=(
    F("kacan_cagri", "Kaçan çağrı yakalayıcı",
      soru="Dün meşgul saatte kaç arama açılmadı ve kaçı geri arandı?",
      aci="Meşgul saatte telefon açılmıyor; arayan müşteri ikinciyi arıyor.",
      yapar="Açılmayan aramaya 30 saniyede otomatik WhatsApp + geri arama listesi.",
      para="Açılmayan her çağrı, kaçan bir müşteridir.",
      kurulum="8-12k", aylik="500-900", zorluk=2, demo=True),
    F("yorum_yakala", "Google puanı yükseltici",
      soru="Son 30 günde Google'a kaç yorum düştü, kaçı olumsuzdu?",
      aci="Memnun müşteri sessiz gider, kızgın müşteri yorum yazar.",
      yapar="QR 'memnun kaldınız mı?' diye sorar; memnunsa Google'a yönlendirir.",
      para="Puan, aramada görünüp görünmemektir.",
      kurulum="6-10k", aylik="400-700", zorluk=1),
    F("whatsapp_katalog", "WhatsApp kataloğu + fiyat sorgusu",
      soru="Fiyat ve ürün bilgisini günde kaç müşteriye elle gönderiyorsunuz?",
      aci="Aynı bilgi her seferinde elle yazılıyor.",
      yapar="Güncel katalog tek linkte; 'fiyat' yazan otomatik alır.",
      para="İlk cevap veren satar.",
      kurulum="5-8k", aylik="300-500", zorluk=1),
))


def _birlestir() -> dict[str, Tur]:
    hepsi: dict[str, Tur] = {}
    for modul in (yeme, kafe, guzellik, saglik, spor_egitim, konaklama_seyahat,
                  ofis_emlak, etkinlik_medya, perakende, hizmet):
        for ad, tur in modul.TURLER.items():
            if ad in hepsi:
                raise ValueError(f"Katalogda çift tür: {ad} ({modul.__name__})")
            if tur.grup not in GRUPLAR:
                raise ValueError(f"{ad}: bilinmeyen grup {tur.grup!r}")
            hepsi[ad] = tur
    return hepsi


TURLER: dict[str, Tur] = _birlestir()

DEMO_DURUM_DOSYASI = settings.data_dir / "demo_durumu.json"


def tur_profili(kind_tr: str | None) -> Tur:
    return TURLER.get(kind_tr or "", VARSAYILAN_TUR)


def fikirler_icin(kind_tr: str | None) -> tuple[Fikir, ...]:
    return tur_profili(kind_tr).fikirler


def demo_urunu(kind_tr: str | None) -> Fikir:
    """Türün 2 dakikalık telefon demosu; işaretli yoksa ilk fikir."""
    fikirler = fikirler_icin(kind_tr)
    return next((f for f in fikirler if f.demo), fikirler[0])


def grup_bilgisi(grup: str) -> Grup:
    return GRUPLAR.get(grup, GRUPLAR["diger"])


def demo_hazir_mi(grup: str) -> bool:
    """`data/demo_durumu.json` → {"yeme": true, …}. Dosya yoksa hiçbiri hazır
    değildir — konuşma metni dürüst kalır ("yaptım" yerine "kuruyorum")."""
    try:
        durum = json.loads(DEMO_DURUM_DOSYASI.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return bool(durum.get(grup)) if isinstance(durum, dict) else False
