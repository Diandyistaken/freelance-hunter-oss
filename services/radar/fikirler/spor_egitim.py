"""Gruplar: uyelik (spor salonu, pilates, yoga, dövüş, havuz, kulüp, dans),
egitim (anaokulu, kreş, kurslar).

Ortak gerçek: para ÜYELİKTE/KAYITTA kaybolur — gelmeyen üye yenilemez,
veli görmediği hizmeti ödemez. En net ROI hikâyesi bu gruptadır.
Fiyat bantları ÖNERİDİR (offer.md'ye işlenmedi).
"""

from services.radar.fikirler._tip import F, Tur

# ------------------------------------------------------------ ortak fikirler
UYE_ERIME = F(
    "uye_erime", "Üye erime alarmı",
    soru="Uzun süredir gelmeyen üyeleri şu an nasıl fark ediyorsunuz?",
    soru2="Gelmeyen bir üyeye dönüş yapıyor musunuz, kim yapıyor?",
    aci="Gelmeyen üyenin fark edilmesi zaman alabiliyor.",
    yapar="Giriş kayıtlarından 3 haftadır gelmeyeni bulur; eğitmen adına "
          "kişisel 'bu hafta seni bekliyoruz' mesajı, gerekirse ders önerisi.",
    para="Erken fark edilen üyeye dönüş yapmak mümkün olur.",
    kurulum="12-18k", aylik="700-1.200", zorluk=2, demo=True,
)
DERS_REZ = F(
    "ders_rez", "Ders rezervasyonu + bekleme listesi",
    soru="Derste son dakika iptal olduğunda boşalan yeri nasıl "
         "değerlendiriyorsunuz?",
    soru2="Bekleme listeniz varsa sıradakine nasıl haber veriyorsunuz?",
    aci="Sınırlı kontenjan 'geliyorum'la doluyor; boş yer bekleyene "
        "verilemiyor.",
    yapar="Üye dersi telefonundan ayırtır; iptal ederse yer bekleme "
          "listesindekine anında açılır; ders öncesi hatırlatma.",
    para="Boşalan yer bekleyene açılınca ders dolu geçer.",
    kurulum="10-15k", aylik="600-900", zorluk=2,
)
PAKET_BITIS = F(
    "paket_bitis", "Paket bitiş yenilemesi",
    soru="Paketi biten üyeye yenileme için siz mi dönüyorsunuz, o mu geliyor?",
    aci="Paket bitişini kimse takip etmiyor; üye 'sonra yenilerim' diyor.",
    yapar="'3 seansınız kaldı' mesajı; bitişten önce yenileme teklifi, "
          "işletmenin kendi ödeme linkiyle.",
    para="Yenileme hatırlatması doğrudan satıştır.",
    kurulum="8-14k", aylik="500-900", zorluk=2,
)
DENEME_TAKIP = F(
    "deneme_takip", "Deneme dersi takibi",
    soru="Deneme dersine gelenleri sonrasında takip ediyor musunuz?",
    aci="Deneme yapan sıcak aday takip edilmiyor; başka salona yazılıyor.",
    yapar="Deneme sonrası 1/3/7. gün mesajı, kayıt linki ve 'ilk ay' teklifi; "
          "yazan olursa eğitmene düşer.",
    para="Deneme yapan kişi en ucuz yeni üyedir; takip edilmezse soğur.",
    kurulum="6-9k", aylik="400-600", zorluk=2,
)
VELI_RAPOR = F(
    "veli_rapor", "Veli günlük raporu",
    soru="Velilere gün içinde bilgi veriyor musunuz, nasıl?",
    soru2="Veli merak edip aradığında kim cevap veriyor?",
    aci="Veli göremediği hizmete güvenmiyor; kayıt yenilemede tereddüt "
        "ediyor.",
    yapar="Öğretmen günde iki dokunuşla (fotoğraf + kısa not) rapor girer; "
          "veliye akşam tek mesaj (KVKK onamlı).",
    para="Velinin algıladığı değer yükselir; kayıt yenileme sorunsuz olur.",
    kurulum="15-25k", aylik="700-1.200", zorluk=3, demo=True,
)
KAYIT_YENILEME = F(
    "kayit_yenileme", "Kayıt dönemi ve bekleme listesi",
    soru="Kayıt döneminde ön kayıt ve bekleme listesini nasıl tutuyorsunuz?",
    aci="Kayıt dönemi telefonla yönetiliyor; bekleme listesi kafada.",
    yapar="Ön kayıt formu + bekleme listesi; kontenjan açılınca sıradakine "
          "mesaj; mevcut veliye yenileme hatırlatması.",
    para="Boş kalan bir kontenjan, bir yıllık ücrettir.",
    kurulum="8-12k", aylik="500-800", zorluk=2,
)
DERS_HATIRLATMA = F(
    "ders_hatirlatma", "Ders hatırlatma + telafi takvimi",
    soru="Ders hatırlatmasını ve telafi ayarlamasını şu an nasıl yapıyorsunuz?",
    soru2="Telafi saatini bulmak ne kadar uğraştırıyor?",
    aci="Gelmeyen öğrenci telafi istiyor; telafi telefonla saatler alıyor.",
    yapar="Ders öncesi hatırlatma; gelmeyene telafi saat seçenekleri "
          "otomatik; öğretmen takvimi çakışmaz.",
    para="Telafiyle uğraşan saat, yeni kayıt almayan saattir.",
    kurulum="8-12k", aylik="500-800", zorluk=2, demo=True,
)
SEVIYE_TAMAM = F(
    "seviye_tamam", "Seviye tamamlama ve devam",
    soru="Kur biten öğrenciye bir sonraki seviye için siz mi dönüyorsunuz?",
    aci="Seviye bitince öğrenci kayboluyor; devam teklifi yapılmıyor.",
    yapar="Son hafta 'sonraki seviye' mesajı + kayıt linki; erken kayıt "
          "avantajı işletmenin kararıyla.",
    para="Devam eden öğrenciyle program kesintisiz ilerler.",
    kurulum="6-9k", aylik="400-600", zorluk=1,
)

AIDAT = F(
    "aidat_hatirlatma", "Aidat hatırlatması",
    soru="Aidat hatırlatmasını kim, nasıl yapıyor?",
    aci="Aidat takibi elle; hatırlatmak sekretere düşüyor, ilişki geriliyor.",
    yapar="Vade öncesi nazik hatırlatma; işletmenin kendi ödeme linkiyle.",
    para="Zamanında gelen aidat, nakit akışıdır.",
    kurulum="5-8k", aylik="300-500", zorluk=1,
)

# ------------------------------------------------------------------ türler
_GYM = (UYE_ERIME, PAKET_BITIS, DENEME_TAKIP, DERS_REZ._replace(ad="Grup dersi rezervasyonu"))
_STUDYO = (DERS_REZ._replace(demo=True), UYE_ERIME._replace(demo=False), PAKET_BITIS, DENEME_TAKIP)
_KURS = (DERS_HATIRLATMA, SEVIYE_TAMAM, DENEME_TAKIP._replace(ad="Deneme dersi takibi"))

TURLER: dict[str, Tur] = {
    "Spor salonu": Tur("uyelik", bilet=1.4, hiz=1.2, muhatap=0.8, fikirler=_GYM),
    "Fitness merkezi": Tur("uyelik", bilet=1.4, hiz=1.1, muhatap=0.7, fikirler=_GYM),
    "Pilates stüdyosu": Tur("uyelik", bilet=1.4, hiz=1.3, muhatap=0.9, fikirler=_STUDYO),
    "Yoga stüdyosu": Tur("uyelik", bilet=1.3, hiz=1.3, muhatap=0.9, fikirler=_STUDYO),
    "Dövüş sporları kulübü": Tur("uyelik", bilet=1.0, hiz=1.2, muhatap=0.9, fikirler=(
        UYE_ERIME, PAKET_BITIS,
        F("kusak_takip", "Kuşak/sınav takibi + veli mesajı",
          soru="Sınav ve aidat bilgisini velilere nasıl duyuruyorsunuz?",
          aci="Sınav ve aidat bilgisi WhatsApp grubunda kayboluyor.",
          yapar="Öğrenci bazlı ilerleme; sınav ve aidat hatırlatması veliye "
                "kişisel mesajla.",
          para="Bilgilendirilen veli aidatı zamanında öder, çocuğu bırakmaz.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        DENEME_TAKIP,
    )),
    "Yüzme havuzu": Tur("uyelik", bilet=1.1, hiz=1.0, muhatap=0.6, fikirler=(
        DERS_REZ._replace(kod="kulvar_rez", ad="Kulvar/ders rezervasyonu", demo=True),
        UYE_ERIME._replace(demo=False), PAKET_BITIS,
    )),
    "Spor kulübü": Tur("uyelik", bilet=1.0, hiz=1.0, muhatap=0.7, fikirler=(
        UYE_ERIME, PAKET_BITIS._replace(ad="Aidat hatırlatması"), DENEME_TAKIP,
    )),
    "Dans kursu": Tur("uyelik", bilet=0.9, hiz=1.3, muhatap=0.95, fikirler=(
        DERS_REZ._replace(demo=True), UYE_ERIME._replace(demo=False),
        F("partner_esles", "Partner/seviye eşleştirme",
          soru="Partnersiz gelen adaylar için ne yapıyorsunuz?",
          aci="Partnersiz aday kayboluyor; seviye karışıklığı ders kalitesini "
              "düşürüyor.",
          yapar="Kayıt formunda seviye + partner tercihi; eşleşme önerisi ve "
                "'partner bulundu' mesajı.",
          para="Partner bulan aday üye olur; olmayan gider.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        DENEME_TAKIP,
    )),
    "Anaokulu": Tur("egitim", bilet=1.4, hiz=0.9, muhatap=0.7, fikirler=(
        VELI_RAPOR, KAYIT_YENILEME,
        F("servis_bildirim", "Servis 'yaklaşıyor' bildirimi",
          soru="Servisin nerede olduğunu velilere nasıl bildiriyorsunuz?",
          aci="Servis saati belirsiz; veli kapıda bekliyor ya da kaçırıyor.",
          yapar="Şoför tek dokunuşla 'yola çıktım'; veliye 5 dakika kala mesaj.",
          para="Sabah telefon trafiği biter; veli memnuniyeti kayıt "
               "yenilemeye döner.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        AIDAT,
    )),
    "Kreş": Tur("egitim", bilet=1.3, hiz=0.9, muhatap=0.75, fikirler=(
        VELI_RAPOR, KAYIT_YENILEME, AIDAT,
    )),
    "Dil kursu": Tur("egitim", bilet=1.2, hiz=1.0, muhatap=0.7, fikirler=(
        *_KURS,
        F("seviye_testi", "Online seviye testi + kayıt",
          soru="Seviye tespitini şu an nasıl yapıyorsunuz, kursa gelmek "
               "gerekiyor mu?",
          aci="Seviye tespiti için kursa gelmesi gerekiyor; çoğu gelmiyor.",
          yapar="WhatsApp'tan 10 dakikalık test; sonuç ve uygun sınıf otomatik, "
                "kayıt linkiyle.",
          para="Testi evde yapan aday sınıfa yazılır.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
    )),
    "Sürücü kursu": Tur("egitim", bilet=1.0, hiz=1.0, muhatap=0.7, fikirler=(
        F("direksiyon_takvim", "Direksiyon dersi takvimi",
          soru="Direksiyon saatlerini eğitmen ve araçla nasıl eşleştiriyorsunuz?",
          soru2="Ders kaçtığında yeni saati bulmak ne kadar sürüyor?",
          aci="Eğitmen–öğrenci–araç saati defterde; kaçırılan ders kaosa "
              "dönüyor.",
          yapar="Öğrenci uygun saati telefonundan seçer; eğitmen takvimi "
                "çakışmaz; ders öncesi hatırlatma.",
          para="Boş geçen bir direksiyon saati, aracın ve eğitmenin boşa "
               "geçen saatidir.",
          kurulum="8-12k", aylik="500-800", zorluk=2, demo=True),
        F("sinav_hatirlatma", "Sınav ve evrak hatırlatması",
          soru="Sınav tarihi ve eksik evrak hatırlatmasını nasıl yapıyorsunuz?",
          aci="Sınav tarihi, evrak, sağlık raporu — hepsi telefonla "
              "hatırlatılıyor.",
          yapar="Her aşamada otomatik mesaj; eksik evrak listesi kişiye özel.",
          para="Sınavı kaçıran öğrenci, tekrar ücret ödemeyen öğrencidir.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
        DENEME_TAKIP._replace(ad="Ön kayıt takibi",
                              soru="Fiyat sorup kaydolmayan adaylara tekrar "
                                   "dönüyor musunuz?"),
    )),
    "Müzik kursu": Tur("egitim", bilet=1.0, hiz=1.2, muhatap=0.9, fikirler=_KURS),
    "Sanat atölyesi": Tur("egitim", bilet=0.9, hiz=1.2, muhatap=0.95, fikirler=(
        *_KURS,
        F("atolye_etkinlik", "Hafta sonu atölyesi kaydı + kapora",
          soru="Hafta sonu atölyesine kaydı nasıl alıyorsunuz, yeri garantiliyor "
               "musunuz?",
          aci="Kontenjan 'geliyorum'la doluyor; malzeme alınıyor, koltuk boş "
              "kalıyor.",
          yapar="Etkinlik takvimi + kayıt; işletmenin kendi ödeme linkiyle "
                "kapora, hatırlatma otomatik.",
          para="Kaporalı koltuk boş kalmaz; malzeme fire olmaz.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
    )),
    "Etüt merkezi": Tur("egitim", bilet=1.1, hiz=1.0, muhatap=0.8, fikirler=(
        F("veli_ilerleme", "Veliye haftalık ilerleme mesajı",
          soru="Veliye çocuğun ilerlemesini düzenli olarak iletiyor musunuz?",
          aci="Veli hizmeti görmüyor; ay sonu 'faydası oldu mu?' diye "
              "sorguluyor.",
          yapar="Öğretmen 30 saniyede haftalık not girer; veliye cuma akşamı "
                "tek mesaj.",
          para="İlerlemeyi gören veli devam eder.",
          kurulum="8-12k", aylik="500-800", zorluk=2, demo=True),
        DERS_HATIRLATMA._replace(demo=False), KAYIT_YENILEME,
    )),
    "Özel kurs": Tur("egitim", bilet=1.0, hiz=1.1, muhatap=0.85, fikirler=_KURS),
}
