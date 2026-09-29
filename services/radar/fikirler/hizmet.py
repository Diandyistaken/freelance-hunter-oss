"""Grup: hizmet — terzi, kuru temizleme, oto servis, oto yıkama, detailing, nakliyat.

Ortak gerçek: para "HAZIR MI?" TELEFONUNDA ve UNUTULAN BAKIMDA kaybolur.
Patron çoğunlukla işin başında, telefonu kendi açar.
Fiyat bantları ÖNERİDİR (offer.md'ye işlenmedi).
"""

from services.radar.fikirler._tip import F, Tur

# ------------------------------------------------------------ ortak fikirler
HAZIR_BILDIRIM = F(
    "hazir_bildirim", "'İşiniz hazır' bildirimi",
    soru="İş hazır olduğunda müşteriye nasıl haber veriyorsunuz?",
    soru2="Ulaşamadığınız müşteri olduğunda ne yapıyorsunuz?",
    aci="Hazır iş rafta bekliyor; müşteri aranıyor, ulaşılamıyor; yer "
        "doluyor.",
    yapar="'Hazır' işaretlenince fotoğraflı WhatsApp; müşteri teslim saatini "
          "seçer; 3 gün almazsa nazik hatırlatma.",
    para="Hazır iş daha çabuk teslim edilir, yer açılır.",
    kurulum="4-6k", aylik="250-400", zorluk=1, demo=True,
)
BAKIM_HATIRLATMA = F(
    "bakim_hatirlatma", "Periyodik bakım hatırlatması",
    soru="Periyodik bakım zamanı gelen müşterilere hatırlatma yapıyor musunuz?",
    soru2="Bakım takvimini nerede tutuyorsunuz?",
    aci="Bakım zamanı müşterinin aklında kalmıyor; yolunun üstündeki servise "
        "gidiyor.",
    yapar="Son işleme göre km/tarih takvimi; zamanı gelince 'bakım zamanı' "
          "mesajı + randevu linki.",
    para="Takvimli tekrar ziyaret, servisin en öngörülebilir cirosudur.",
    kurulum="8-12k", aylik="500-800", zorluk=2, demo=True,
)
IS_RAPORU = F(
    "is_raporu", "Fotoğraflı iş raporu",
    soru="Yapılan işi müşteriye nasıl anlatıyorsunuz, fotoğraf gönderiyor "
         "musunuz?",
    aci="Müşteri yapılan işi görmüyor; fiyata güvenmiyor, tavsiye etmiyor.",
    yapar="Servis sırasında değişen parçanın fotoğrafı ve tek satır not; "
          "teslimde müşteriye rapor mesajı.",
    para="İşi gören müşteri fiyatı sorgulamaz, tekrar gelir.",
    kurulum="5-8k", aylik="300-500", zorluk=1,
)
RANDEVU_HIZMET = F(
    "randevu_hizmet", "Randevu + hazır bildirimi",
    soru="Randevu alıyor musunuz, yoksa gelen sırayla mı giriyor?",
    aci="Randevusuz yığılma; bekleyen müşteri sıkılıp gidiyor.",
    yapar="Müşteri saat seçer; iş hazır olunca mesaj alır.",
    para="Beklemeyen müşteri, tekrar gelen müşteridir.",
    kurulum="6-9k", aylik="400-600", zorluk=1,
)
SEZON = F(
    "sezon_hatirlatma", "Sezon hatırlatması",
    soru="Sezon başında müşterilere hatırlatma yapıyor musunuz?",
    aci="Sezon işi hatırlatılmıyor; müşteri en yakındakine gidiyor.",
    yapar="Sezon dönümünde (mart/ekim) izinli listeye tek mesaj + teslim "
          "randevusu.",
    para="Sezon hatırlatması, yılın en yoğun iki haftasını garantiler.",
    kurulum="4-6k", aylik="250-400", zorluk=1,
)

# ------------------------------------------------------------------ türler
TURLER: dict[str, Tur] = {
    "Terzi": Tur("hizmet", bilet=0.7, hiz=1.3, muhatap=1.0, fikirler=(
        HAZIR_BILDIRIM,
        RANDEVU_HIZMET._replace(ad="Prova randevusu hatırlatması",
                                soru="Prova randevularını müşteriye hatırlatıyor "
                                     "musunuz?"),
        SEZON._replace(soru="Sezon başında eski müşterilere dönüyor musunuz?"),
    )),
    "Kuru temizleme": Tur("hizmet", bilet=0.7, hiz=1.3, muhatap=0.9, fikirler=(
        HAZIR_BILDIRIM, SEZON,
        F("teslim_fisi", "Dijital teslim fişi",
          soru="Teslim aldığınız parçaları nasıl kayıt altına alıyorsunuz?",
          aci="Kâğıt fiş kayboluyor; 'ben 3 parça vermiştim' tartışması.",
          yapar="Teslim alırken parça listesi fotoğraflı WhatsApp'a gider; "
                "teslimde aynı liste onaylanır.",
          para="Tartışmasız teslim, tekrar gelen müşteridir.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
    )),
    "Oto servis": Tur("hizmet", bilet=1.1, hiz=1.1, muhatap=0.85, fikirler=(
        BAKIM_HATIRLATMA,
        HAZIR_BILDIRIM._replace(demo=False, ad="'Aracınız hazır' bildirimi"),
        IS_RAPORU,
        F("muayene_hatirlatma", "Muayene tarihi hatırlatması",
          soru="Muayene tarihi yaklaşan müşterilere hatırlatma yapıyor musunuz?",
          aci="Muayene tarihi unutuluyor; ceza yiyen müşteri son gün "
              "panikliyor.",
          yapar="Ruhsattaki tarihe göre bir ay önce hatırlatma + muayene "
                "öncesi kontrol randevusu.",
          para="Her muayene öncesi kontrol, bir servis işidir.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
        RANDEVU_HIZMET,
    )),
    "Oto yıkama": Tur("hizmet", bilet=0.7, hiz=1.3, muhatap=0.9, fikirler=(
        RANDEVU_HIZMET._replace(demo=True),
        F("yikama_sadakat", "5 yıkama 1 bedava sayacı",
          soru="Düzenli gelen müşterilerinizi takip ediyor musunuz?",
          aci="Düzenli müşterinin bir süredir gelmediği fark edilmeyebiliyor.",
          yapar="Plaka ile sayaç; belli yıkamada bedava, uzun süre gelmeyene "
                "hatırlatma.",
          para="Düzenli müşteriyi hatırlamak, yeniden kazanmaya çalışmaktan "
               "kolay.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
        HAZIR_BILDIRIM._replace(demo=False),
    )),
    "Oto detailing": Tur("hizmet", bilet=1.0, hiz=1.1, muhatap=0.95, fikirler=(
        RANDEVU_HIZMET._replace(demo=True, ad="Randevu + kapora",
                                soru="Uzun süren işlerde randevuyu garantiye "
                                     "almak için bir şey yapıyor musunuz?"),
        HAZIR_BILDIRIM._replace(demo=False, ad="Fotoğraflı 'hazır' bildirimi"),
        BAKIM_HATIRLATMA._replace(demo=False, ad="Kaplama bakım hatırlatması",
                                  soru="Kaplama sonrası bakım için müşterilere "
                                       "dönüyor musunuz?"),
    )),
    "Nakliyat firması": Tur("hizmet", bilet=1.0, hiz=1.0, muhatap=0.9, fikirler=(
        F("teklif_form_nakliyat", "Teklif formu + takip",
          soru="Fiyat sorup sessizleşen müşterilere tekrar dönüyor musunuz?",
          soru2="Teklifi nasıl gönderiyorsunuz, telefonda mı?",
          aci="Teklif telefonda veriliyor, takip edilmiyor; müşteri en ucuza "
              "gidiyor.",
          yapar="Form: kat, asansör, eşya listesi, tarih; teklif otomatik "
                "taslak; 48 saat sessizlikte hatırlatma.",
          para="Takip edilen teklif, kapanan iştir.",
          kurulum="8-12k", aylik="500-800", zorluk=2, demo=True),
        F("tasinma_gunu", "Taşınma günü bilgilendirmesi",
          soru="Taşınma günü müşteriyi ekibin durumu hakkında bilgilendiriyor "
               "musunuz?",
          aci="Ekip saati belirsiz; müşteri sabah panikliyor.",
          yapar="Bir gün önce hatırlatma; ekip yola çıkınca konum mesajı.",
          para="Sakin müşteri yorum yazar, panik müşteri şikâyet.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
        F("yorum_nakliyat", "Taşınma sonrası yorum toplama",
          soru="İş bittikten sonra müşteriden yorum istiyor musunuz?",
          aci="Memnun müşteri teşekkür eder, yorum yazmaz.",
          yapar="Taşınmadan 2 gün sonra 'memnun kaldınız mı?' mesajı; "
                "memnunsa Google'a.",
          para="Nakliyatta müşteri yoruma bakarak arar.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
    )),
}
