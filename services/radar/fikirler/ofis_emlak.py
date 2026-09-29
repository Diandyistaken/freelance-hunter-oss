"""Gruplar: ofis (avukat, noter/danışman, mali müşavir, mimar, iç mimari, peyzaj),
emlak (emlak danışmanı, emlak ofisi, site yönetimi).

Ortak gerçek: para "NE OLDU?" TELEFONLARINDA ve TAKİPSİZ TEKLİFTE kaybolur.
Emlak danışmanı çoğunlukla bireysel (cep %60) — hızlı, küçük bilet.
Fiyat bantları ÖNERİDİR (offer.md'ye işlenmedi).
"""

from services.radar.fikirler._tip import F, Tur

# ------------------------------------------------------------ ortak fikirler
DURUM_BILGI = F(
    "durum_bilgi", "Dosya/proje durum bilgilendirmesi",
    soru="Müvekkile dosyanın durumunu şu an nasıl bildiriyorsunuz?",
    soru2="Süreçte bir şey değişince haber vermek kime düşüyor?",
    aci="Müvekkil/müşteri süreci göremiyor, sürekli arıyor; her arama iş "
        "kesintisi.",
    yapar="Dosya aşaması değişince otomatik kısa mesaj; müşteri linkten "
          "durumu görür, aramaz.",
    para="Kesilmeyen bir çalışma saati, faturalanan saattir.",
    kurulum="12-20k", aylik="600-1.000", zorluk=2, demo=True,
)
ILK_RANDEVU = F(
    "ilk_randevu", "İlk görüşme randevusu + ön form",
    soru="İlk görüşmeden önce müşteriden konu hakkında bilgi alıyor musunuz?",
    aci="Görüşmenin yarısı 'anlatın bakalım'la geçiyor; uygun olmayan iş de "
        "randevu alıyor.",
    yapar="Randevu alınırken kısa ön form (konu, aciliyet, belgeler); uygun "
          "olmayan konu nazikçe yönlendirilir.",
    para="Hazır gelen görüşme kısa sürer; uygun olmayan iş vakit yemez.",
    kurulum="6-9k", aylik="400-600", zorluk=1,
)
TEKLIF_TAKIP = F(
    "teklif_takip", "Teklif takipçisi",
    soru="Teklif verdikten sonra takibini nasıl yapıyorsunuz?",
    aci="Teklif gönderiliyor, sonrasının takibi zor olabiliyor.",
    yapar="Teklif açıldığında haber verir; 48 saat sessizlikte nazik "
          "hatırlatma.",
    para="Takip edilen teklif cevapsız kalmaz.",
    kurulum="8-12k", aylik="500-800", zorluk=2,
)
PORTFOY_KATALOG = F(
    "portfoy_katalog", "WhatsApp portföy kataloğu",
    soru="Yeni portföy girdiğinizde uygun alıcılara nasıl ulaşıyorsunuz?",
    soru2="Alıcı tercihlerini bir yerde tutuyor musunuz?",
    aci="Yeni portföy Instagram'da kayboluyor; sıcak alıcı haberdar olmuyor.",
    yapar="Yeni ilan girilince bütçe/semt/oda tercihine uyan alıcılara "
          "otomatik mesaj (izinli); gösterim randevusu linkle.",
    para="İlk gören alıcı ilk teklifi verir.",
    kurulum="8-12k", aylik="500-800", zorluk=2, demo=True,
)
GOSTERIM_GERI = F(
    "gosterim_geri", "Gösterim sonrası geri bildirim",
    soru="Gösterimden sonra alıcıdan geri bildirim alıyor musunuz?",
    aci="Gösterim yapılıyor, alıcı kayboluyor; mal sahibi 'ne dediler?' diye "
        "arıyor.",
    yapar="Gösterimden 2 saat sonra alıcıya 3 soruluk mesaj; cevap mal "
          "sahibine özet olarak gider.",
    para="Geri bildirim alan mal sahibi fiyatı düşürür; ev satılır.",
    kurulum="5-8k", aylik="300-500", zorluk=1,
)
ILAN_TAZELEME = F(
    "ilan_tazeleme", "İlan tazeleme hatırlatması",
    soru="İlanların tazelenmesini nasıl takip ediyorsunuz?",
    aci="Eski ilan görünmüyor; mal sahibi 'niye aranmıyor?' diyor.",
    yapar="Her portföyün yaşını izler; tazeleme ve fotoğraf yenileme "
          "hatırlatması, mal sahibine 'ilanınız güncellendi' mesajı.",
    para="Görünen ilan aranır; aranan ilan satılır.",
    kurulum="4-6k", aylik="250-400", zorluk=1,
)

# ------------------------------------------------------------------ türler
_EMLAK = (PORTFOY_KATALOG, GOSTERIM_GERI, ILAN_TAZELEME, TEKLIF_TAKIP._replace(
    ad="Alıcı takipçisi", soru="Fiyat sorup sessizleşen alıcılara tekrar dönüyor musunuz?"))
_TASARIM = (
    DURUM_BILGI._replace(ad="Proje aşama bilgilendirmesi"),
    F("kesif_randevu", "Keşif randevusu + ön form",
      soru="Keşfe gitmeden önce bütçe ve kapsamı konuşuyor musunuz?",
      aci="Bütçesi uymayan müşteriye keşfe gidiliyor; yarım gün yanıyor.",
      yapar="Randevu alınırken m², bütçe bandı, tarih; uygun olmayan iş "
            "nazikçe elenir, uygun olana teklif taslağı hazır gelir.",
      para="Kapsamı önceden konuşmak keşfi verimli kılar.",
      kurulum="6-9k", aylik="400-600", zorluk=1),
    TEKLIF_TAKIP,
    F("portfoy_sunum", "Proje portföyü kataloğu",
      soru="Geçmiş işlerinizi müşteriye nasıl gösteriyorsunuz?",
      aci="Portföy dağınık; müşteri 'benzer bir işiniz var mı?' diye "
          "soruyor.",
      yapar="Tek linkte süzülebilir portföy (tür, m², bütçe); teklif formuna "
            "geçer.",
      para="Benzer işi gören müşteri güvenir; güvenen imzalar.",
      kurulum="5-8k", aylik="300-500", zorluk=1),
)

TURLER: dict[str, Tur] = {
    "Avukatlık bürosu": Tur("ofis", bilet=1.3, hiz=0.9, muhatap=0.7, fikirler=(
        DURUM_BILGI,
        F("durusma_hatirlatma", "Duruşma ve süre hatırlatması",
          soru="Duruşma ve süre hatırlatmasını müvekkile kim yapıyor?",
          aci="Duruşma, ödeme ve evrak süreleri telefonla takip ediliyor.",
          yapar="Müvekkile duruşma/ödeme/evrak hatırlatması otomatik; büroya "
                "süre takvimi.",
          para="Süreler tek yerde durunca gözden kaçma ihtimali azalır.",
          kurulum="8-12k", aylik="500-800", zorluk=2),
        ILK_RANDEVU,
    )),
    "Noter/danışman": Tur("ofis", bilet=1.0, hiz=0.9, muhatap=0.7, fikirler=(
        ILK_RANDEVU._replace(demo=True), DURUM_BILGI._replace(demo=False),
        TEKLIF_TAKIP,
    )),
    "Mali müşavir": Tur("ofis", bilet=1.1, hiz=0.9, muhatap=0.8, fikirler=(
        F("evrak_toplama", "Evrak toplama hatırlatması",
          soru="Mükelleften evrak toplamayı şu an nasıl yürütüyorsunuz?",
          soru2="Evrak geciktiğinde hatırlatmayı kim yapıyor?",
          aci="Evrak geç geliyor; beyanname son güne kalıyor, ceza riski.",
          yapar="Ayın belli günlerinde mükellefe otomatik hatırlatma; "
                "yükleme linki; eksikte ikinci mesaj.",
          para="Zamanında gelen evrak, gece yarısı beyannamesi olmayan ay "
               "demektir.",
          kurulum="8-12k", aylik="500-800", zorluk=2, demo=True),
        F("beyanname_takvim", "Beyanname dönemi bildirimleri",
          soru="Dönem sonu tutarlarını mükellefe nasıl bildiriyorsunuz?",
          aci="Vergi takvimi ve tutarlar telefonla anlatılıyor.",
          yapar="Dönem yaklaşınca mükellefe tarih + tutar + ödeme bilgisi "
                "mesajı.",
          para="Bilgilendirilen mükellef aramaz; ofis çalışır.",
          kurulum="6-9k", aylik="400-600", zorluk=1),
        F("yeni_mukellef", "Yeni mükellef karşılama",
          soru="Yeni mükellef kaydında evrak listesini nasıl iletiyorsunuz?",
          aci="Kuruluş evrakı parça parça geliyor.",
          yapar="Adım adım liste; yüklendikçe işaretlenir.",
          para="Hızlı kurulan mükellef, memnun mükelleftir.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
    )),
    "Mimar": Tur("ofis", bilet=1.2, hiz=0.9, muhatap=0.85, fikirler=_TASARIM),
    "İç mimari": Tur("ofis", bilet=1.2, hiz=1.0, muhatap=0.85, fikirler=_TASARIM),
    "Peyzaj": Tur("ofis", bilet=1.1, hiz=1.0, muhatap=0.9, fikirler=(
        *_TASARIM[:3],
        F("bakim_hatirlatma_peyzaj", "Mevsimlik bakım hatırlatması",
          soru="Uygulama sonrası bakım için müşterilere dönüyor musunuz?",
          aci="Uygulama bir kez yapılıyor; bakım geliri başkasına gidiyor.",
          yapar="Mevsim başında müşteriye 'bakım zamanı' mesajı + randevu.",
          para="Bakım, tekrarlayan gelirdir.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
    )),
    "Emlak danışmanı": Tur("emlak", bilet=0.9, hiz=1.2, muhatap=0.9, fikirler=_EMLAK),
    "Emlak ofisi": Tur("emlak", bilet=1.0, hiz=1.1, muhatap=0.8, fikirler=_EMLAK),
    "Site/emlak yönetimi": Tur("emlak", bilet=1.1, hiz=0.8, muhatap=0.6, fikirler=(
        F("aidat_duyuru", "Aidat ve duyuru mesajı",
          soru="Aidat ve duyuruları kat maliklerine nasıl iletiyorsunuz?",
          soru2="WhatsApp grubu mu kullanıyorsunuz, tek tek mi?",
          aci="Duyuru WhatsApp grubunda kayboluyor; aidat gecikiyor.",
          yapar="Kat malikine kişisel aidat hatırlatması ve duyuru; arıza "
                "bildirimi formu.",
          para="Zamanında toplanan aidat, yönetimin nakit akışıdır.",
          kurulum="8-12k", aylik="500-800", zorluk=2, demo=True),
        F("ariza_takip", "Arıza bildirimi ve takip",
          soru="Arıza bildirimleri size nereden geliyor, nasıl takip ediliyor?",
          aci="Arıza telefonla geliyor, takibi yapılmıyor.",
          yapar="Sakin formdan bildirir; durum değişince mesaj alır.",
          para="Takip edilen arıza, şikâyete dönmez.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        DURUM_BILGI._replace(demo=False, kod="yonetim_raporu", ad="Aylık yönetim raporu mesajı",
                             soru="Kat maliklerine aylık hesap bilgisini nasıl "
                                  "veriyorsunuz?", kurulum="6-9k", aylik="400-600"),
    )),
}
