"""Grup: etkinlik — organizasyon, düğün, fotoğrafçı, stüdyo, video, gelinlik.

Ortak gerçek: para TARİHTE kaybolur — "ayırdım" denip kapora alınmayan gün,
takip edilmeyen teklif, teslim edilmeyen galeri.
Fiyat bantları ÖNERİDİR (offer.md'ye işlenmedi).
"""

from services.radar.fikirler._tip import F, Tur

# ------------------------------------------------------------ ortak fikirler
TARIH_KAPORA = F(
    "tarih_kapora", "Müsaitlik takvimi + kapora",
    soru="Tarih tutarken kapora alıyor musunuz, nasıl yürüyor?",
    soru2="Tutulan tarihleri nerede takip ediyorsunuz?",
    aci="Tarih 'ayırdım'la kilitleniyor, kapora alınmıyor; sezon günü boş "
        "kalıyor ya da çift rezervasyon oluyor.",
    yapar="Müsait tarihler takvimde; işletmenin kendi ödeme linkiyle kapora, "
          "sözleşme özeti ve hatırlatma otomatik.",
    para="Kapora, tarihi iki taraf için de netleştirir.",
    kurulum="8-12k", aylik="500-800", zorluk=2, demo=True,
)
TEKLIF_TAKIP = F(
    "teklif_takip", "Teklif takipçisi",
    soru="Fiyat sorup sessizleşen çiftlere tekrar dönüyor musunuz?",
    aci="DM'de fiyat sorulur, cevap verilir, konuşma ölür.",
    yapar="Teklif açıldığında haber verir; 48 saat sessizlikte nazik "
          "hatırlatma; tarih yaklaşınca 'hâlâ müsait' mesajı.",
    para="Takip edilen teklif cevapsız kalmaz.",
    kurulum="6-9k", aylik="400-600", zorluk=1,
)
GALERI_TESLIM = F(
    "galeri_teslim", "Galeri teslim + seçim linki",
    soru="Çekim sonrası fotoğraf seçimi ve teslimi nasıl ilerliyor?",
    aci="Seçim ve teslim WeTransfer/WhatsApp'ta karışıyor; müşteri bekliyor, "
        "ek albüm satışı olmuyor.",
    yapar="Müşteri linkten fotoğraf seçer, beğenileri işaretler; albüm/baskı "
          "ek satışı aynı ekranda, kendi ödeme linkiyle.",
    para="Seçim ekranı, albüm satışının kendisidir.",
    kurulum="8-12k", aylik="500-800", zorluk=2,
)
YILDONUMU = F(
    "yildonumu_cekim", "Yıl dönümü çekim hatırlatması",
    soru="Daha önce çekim yaptığınız çiftlere sonradan dönüyor musunuz?",
    aci="Müşteri bir kez geliyor; bebek, yıl dönümü, aile çekimi başkasına "
        "gidiyor.",
    yapar="Çekim tarihinden 11 ay sonra kişisel mesaj + mini çekim teklifi.",
    para="Var olan müşteriyle iletişimi sürdürmek en kolay yol.",
    kurulum="4-6k", aylik="250-400", zorluk=1,
)
PROJE_DURUM = F(
    "proje_durum", "Plan ve tedarikçi durumu bilgilendirmesi",
    soru="Hazırlık sürecinde çifti nasıl bilgilendiriyorsunuz?",
    aci="Çift süreci göremiyor; her arama organizatörün gününü bölüyor.",
    yapar="Müşteri linkten planın aşamalarını görür; her adım tamamlanınca "
          "kısa mesaj.",
    para="Süreci gören müşteri rahat eder; rahat müşteri tavsiye eder.",
    kurulum="8-12k", aylik="500-800", zorluk=2,
)
YORUM_ETKINLIK = F(
    "yorum_etkinlik", "Etkinlik sonrası yorum toplama",
    soru="Etkinlik sonrası müşteriden yorum istiyor musunuz?",
    aci="Memnun çift teşekkür eder, yorum yazmaz.",
    yapar="Etkinlikten 3 gün sonra 'memnun kaldınız mı?' mesajı; memnunsa "
          "Google'a yönlendirir.",
    para="Yeni çift, önceki çiftin yorumuna bakar.",
    kurulum="4-6k", aylik="250-400", zorluk=1,
)

# ------------------------------------------------------------------ türler
_ORG = (TARIH_KAPORA, TEKLIF_TAKIP, PROJE_DURUM, YORUM_ETKINLIK)
_FOTO = (TARIH_KAPORA._replace(ad="Çekim takvimi + kapora"), GALERI_TESLIM, YILDONUMU,
         TEKLIF_TAKIP)

TURLER: dict[str, Tur] = {
    "Organizasyon firması": Tur("etkinlik", bilet=1.3, hiz=0.9, muhatap=0.85, fikirler=_ORG),
    "Düğün organizasyonu": Tur("etkinlik", bilet=1.3, hiz=0.9, muhatap=0.85, fikirler=_ORG),
    "Fotoğrafçı": Tur("etkinlik", bilet=1.0, hiz=1.2, muhatap=1.0, fikirler=_FOTO),
    "Fotoğraf stüdyosu": Tur("etkinlik", bilet=0.9, hiz=1.2, muhatap=0.95, fikirler=(
        F("studyo_randevu", "Stüdyo randevusu + hazır bildirimi",
          soru="İş hazır olduğunda müşteriye nasıl haber veriyorsunuz?",
          aci="Randevu telefonla, teslim telefonla; hazır iş rafta bekliyor.",
          yapar="Randevu linkten; iş hazır olunca WhatsApp gider, müşteri "
                "teslim saatini seçer.",
          para="Hazır iş daha çabuk teslim edilir.",
          kurulum="5-8k", aylik="300-500", zorluk=1, demo=True),
        GALERI_TESLIM,
        YILDONUMU._replace(kod="bebek_paket", ad="Bebek büyüme paketi hatırlatması",
                           soru="Bebek çekimi yaptığınız ailelere sonraki "
                                "dönemler için dönüyor musunuz?"),
    )),
    "Video prodüksiyon": Tur("etkinlik", bilet=1.3, hiz=0.9, muhatap=0.9, fikirler=(
        TEKLIF_TAKIP._replace(demo=True, soru="Teklif verdikten sonra takibini nasıl yapıyorsunuz?"),
        PROJE_DURUM._replace(ad="Kurgu aşaması bilgilendirmesi",
                             soru="Kurgu sürecinde müşteriyi nasıl "
                                  "bilgilendiriyorsunuz?"),
        F("portfoy_video", "Sektöre göre portföy linki",
          soru="Geçmiş işlerinizi müşteriye nasıl gösteriyorsunuz?",
          aci="Portföy dağınık; benzer işi bulmak zaman alıyor.",
          yapar="Tek linkte sektöre/türe göre süzülebilir portföy; teklif "
                "formuna geçer.",
          para="Benzer işi gören müşteri güvenir; güvenen imzalar.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
    )),
    "Gelinlik evi": Tur("etkinlik", bilet=1.2, hiz=1.0, muhatap=0.85, fikirler=(
        F("prova_randevu", "Prova randevusu hatırlatması",
          soru="Prova randevularını müşteriye hatırlatıyor musunuz?",
          aci="Prova randevusu unutuluyor; terzi ve salon boş kalıyor.",
          yapar="Prova takvimi; bir gün önce hatırlatma, gelemeyene yeni saat "
                "seçenekleri.",
          para="Boş geçen prova saati, sezonun en dolu gününde bir müşteridir.",
          kurulum="6-9k", aylik="400-600", zorluk=1, demo=True),
        TARIH_KAPORA._replace(demo=False, ad="Gelinlik rezervasyonu + kapora",
                              soru="Gelinlik ayırtırken kapora alıyor musunuz?"),
        TEKLIF_TAKIP, GALERI_TESLIM._replace(ad="Koleksiyon galerisi + randevu",
                                             soru="Instagram'dan model soranlara "
                                                  "nasıl cevap veriyorsunuz?"),
    )),
}
