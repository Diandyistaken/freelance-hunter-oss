"""Gruplar: konaklama (otel, butik otel, pansiyon, konukevi, hostel, tatil evi),
seyahat (seyahat acentesi, araç kiralama).

Ortak gerçek: para KOMİSYONDA ve TAKİPSİZ TEKLİFTE kaybolur. Büyük oteller
resepsiyonla açar (muhatap düşük); butik/pansiyon sahibi telefonu kendi açar.
Fiyat bantları ÖNERİDİR (offer.md'ye işlenmedi).
"""

from services.radar.fikirler._tip import F, Tur

# ------------------------------------------------------------ ortak fikirler
DOGRUDAN_REZ = F(
    "dogrudan_rez", "Komisyonsuz doğrudan rezervasyon",
    soru="Rezervasyonlar ağırlıklı platformlardan mı geliyor, doğrudan gelen de "
         "var mı?",
    soru2="Doğrudan rezervasyon isteyen misafire nasıl cevap veriyorsunuz?",
    aci="Aynı misafir ikinci gelişinde de platformdan rezervasyon yapıyor; "
        "komisyon her seferinde gidiyor.",
    yapar="WhatsApp ve siteden doğrudan rezervasyon; müsaitlik takvimi, "
          "işletmenin kendi ödeme linkiyle ön ödeme; eski misafire 'doğrudan "
          "rezervasyon' teklifi.",
    para="Doğrudan gelen rezervasyonda komisyon ödenmez.",
    kurulum="15-25k", aylik="700-1.200", zorluk=3, demo=True,
)
CHECKIN_ONCESI = F(
    "checkin_oncesi", "Giriş öncesi WhatsApp karşılaması",
    soru="Giriş öncesi misafire yol tarifi, saat gibi bilgileri gönderiyor "
         "musunuz?",
    aci="Aynı sorular her misafirde tekrar; resepsiyon meşgul.",
    yapar="Girişten bir gün önce otomatik mesaj: yol tarifi, giriş saati, "
          "Wi-Fi, ek hizmet menüsü; cevaplar resepsiyona düşer.",
    para="Hazır gelen misafir memnun gelir; memnun misafir yorum yazar.",
    kurulum="6-9k", aylik="400-600", zorluk=1,
)
YORUM_OTEL = F(
    "yorum_otel", "Çıkış sonrası yorum toplama",
    soru="Çıkış yapan misafirden yorum istiyor musunuz, nasıl?",
    aci="Memnun misafir sessiz gidiyor; puan tek şikâyetle düşüyor.",
    yapar="Çıkıştan 3 saat sonra 'memnun kaldınız mı?' mesajı; memnunsa "
          "Google/platforma yönlendirir, değilse patrona düşer.",
    para="Puan, bir sonraki misafirin fiyat duyarlılığını belirler.",
    kurulum="6-9k", aylik="400-600", zorluk=1,
)
FIYAT_SORU = F(
    "fiyat_soru_otel", "Fiyat ve müsaitlik asistanı",
    soru="Müsaitlik ve fiyat sorularına şu an kim, nasıl cevap veriyor?",
    soru2="Mesai dışında gelen mesajlara ne oluyor?",
    aci="Gece gelen soru sabah cevaplanınca misafir başka yere yazmış "
        "oluyor.",
    yapar="WhatsApp'a gelen tarih sorusuna müsaitlik + fiyat bandı + "
          "rezervasyon linki anında; özel istek resepsiyona düşer.",
    para="Cevapsız kalan her gece sorusu, başka otele giden misafirdir.",
    kurulum="10-15k", aylik="600-900", zorluk=2,
)
TEKLIF_TAKIP = F(
    "teklif_takip", "Teklif takipçisi",
    soru="Teklif gönderdikten sonra dönüş gelmezse takibini nasıl yapıyorsunuz?",
    soru2="Teklifi gördü mü, bunu bilebiliyor musunuz?",
    aci="Teklif gönderiliyor, sonrasının takibi zor olabiliyor.",
    yapar="Teklif açıldığında haber verir; 48 saat sessizlikte nazik "
          "hatırlatma; fiyat/kontenjan değişince 'hâlâ müsait' mesajı.",
    para="Takip edilen teklif cevapsız kalmaz.",
    kurulum="8-12k", aylik="500-800", zorluk=2, demo=True,
)
GERI_DONUS = F(
    "geri_donus", "Yıllık geri dönüş mesajı",
    soru="Geçen sezon sizden alan müşterilere tekrar dönüyor musunuz?",
    aci="Müşteri bir kez alıyor; ertesi yıl ilk hatırlatan acenteye gidiyor.",
    yapar="Geçen yılki tarihten 2 ay önce kişisel 'bu yıl nereye?' mesajı + "
          "teklif linki.",
    para="Eski müşteri yeni müşteriden ucuz; hatırlatan alır.",
    kurulum="5-8k", aylik="300-500", zorluk=1,
)

# ------------------------------------------------------------------ türler
_OTEL = (DOGRUDAN_REZ, FIYAT_SORU, CHECKIN_ONCESI, YORUM_OTEL)
_KUCUK = (FIYAT_SORU._replace(demo=True), DOGRUDAN_REZ._replace(demo=False),
          CHECKIN_ONCESI, YORUM_OTEL)

TURLER: dict[str, Tur] = {
    "Otel": Tur("konaklama", bilet=1.3, hiz=0.8, muhatap=0.5, fikirler=_OTEL),
    "Butik otel": Tur("konaklama", bilet=1.3, hiz=1.0, muhatap=0.8, fikirler=_OTEL),
    "Pansiyon": Tur("konaklama", bilet=0.9, hiz=1.1, muhatap=0.95, fikirler=_KUCUK),
    "Konukevi": Tur("konaklama", bilet=0.9, hiz=1.1, muhatap=0.95, fikirler=_KUCUK),
    "Hostel": Tur("konaklama", bilet=0.8, hiz=1.0, muhatap=0.8, fikirler=_KUCUK),
    "Kiralık tatil evi": Tur("konaklama", bilet=1.0, hiz=1.1, muhatap=1.0, fikirler=(
        DOGRUDAN_REZ._replace(soru="Daha önce kalan misafirler tekrar gelirken size doğrudan mı ulaşıyor?"),
        CHECKIN_ONCESI._replace(ad="Anahtar ve giriş talimatı mesajı",
                                soru="Anahtar ve giriş talimatını misafire nasıl "
                                     "iletiyorsunuz?"),
        YORUM_OTEL,
    )),
    "Seyahat acentesi": Tur("seyahat", bilet=1.1, hiz=0.9, muhatap=0.6, fikirler=(
        TEKLIF_TAKIP, GERI_DONUS,
        F("vize_evrak", "Vize evrak listesi asistanı",
          soru="Vize evrak listesini müşteriye nasıl gönderiyorsunuz?",
          aci="Evrak listesi her müşteriye elle gönderiliyor; eksik evrak "
              "randevuyu yaktırıyor.",
          yapar="Ülkeye göre evrak listesi otomatik; müşteri yükledikçe "
                "işaretlenir, eksikte hatırlatma.",
          para="Evrak tam olunca randevu sorunsuz geçer.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        F("tur_bekleme", "Tur bekleme listesi",
          soru="Dolan turlarda bekleme listesi tutuyor musunuz?",
          aci="İptal olan koltuk boş gidiyor; bekleyen aranmıyor.",
          yapar="Bekleme listesi; koltuk açılınca sıradakine mesaj, ilk "
                "onaylayan alır.",
          para="Boş giden koltuk, ödenmiş uçak biletidir.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
    )),
    "Araç kiralama": Tur("seyahat", bilet=1.1, hiz=1.0, muhatap=0.8, fikirler=(
        F("teslim_iade", "Teslim/iade hatırlatma + fotoğraf kaydı",
          soru="Teslim ve iade saatlerini müşteriyle nasıl takip ediyorsunuz?",
          soru2="Araç teslim/iade halini fotoğrafla kayıt altına alıyor musunuz?",
          aci="İade saati kaçıyor; hasar tartışması fotoğrafsız kalıyor.",
          yapar="Teslimde ve iadede fotoğraf yükleme; iade günü sabah "
                "hatırlatma; gecikmede otomatik mesaj.",
          para="Zamanında dönen araç bir sonraki kiralamadır; fotoğraf "
               "tartışmayı bitirir.",
          kurulum="8-12k", aylik="500-800", zorluk=2, demo=True),
        F("fiyat_teklif_arac", "Fiyat teklif asistanı",
          soru="Araç müsaitlik ve fiyat sorularına nasıl cevap veriyorsunuz?",
          aci="Fiyat sorusu gece geliyor, sabah cevaplanıyor.",
          yapar="Tarih ve araç sınıfına göre anında teklif + rezervasyon linki.",
          para="İlk cevap veren kiralar.",
          kurulum="8-12k", aylik="500-800", zorluk=2),
        GERI_DONUS._replace(soru="Daha önce kiralayan müşterilere tekrar dönüyor musunuz?"),
    )),
}
