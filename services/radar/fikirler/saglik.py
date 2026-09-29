"""Gruplar: klinik (diş, estetik, dermatoloji, fizik tedavi, optik, işitme),
ruh_beslenme (psikolog, diyetisyen), veteriner (veteriner, pet).

Ortak gerçek: en yüksek bilet burada; gelmeyen hasta EN PAHALI boşluk.
Sağlık verisi özel niteliklidir (KVKK) — her ürün aydınlatma + rıza adımıyla
kurulur; hatırlatma serbest, kampanya izinlidir (docs/yazilim-fikirleri.md §1).
Fiyat bantları ÖNERİDİR (offer.md'ye işlenmedi).
"""

from services.radar.fikirler._tip import F, Tur

# ------------------------------------------------------------ ortak fikirler
RANDEVU_ONAY = F(
    "randevu_onay", "Randevu onay + hatırlatma",
    soru="Hastalara randevu hatırlatmasını şu an nasıl yapıyorsunuz?",
    soru2="Gelmeyen hasta olduğunda o saat nasıl değerlendiriliyor?",
    aci="Gelmeyen hasta koltuğu boş bırakıyor; sekreter arayıp doğrulamaya "
        "yetişemiyor.",
    yapar="Randevudan 24 saat ve 2 saat önce 'onaylıyorum / erteliyorum' "
          "mesajı; ertelenen saat bekleme listesine açılır.",
    para="Hatırlatma, randevunun teyit edilmesini kolaylaştırır.",
    kurulum="10-15k", aylik="600-1.000", zorluk=2, demo=True,
)
KONTROL_CAGRI = F(
    "kontrol_cagri", "Kontrol çağrısı",
    soru="Kontrol zamanı gelen hastaları nasıl takip edip hatırlatıyorsunuz?",
    aci="Hasta unutuyor, klinik hatırlatmıyor; kontrol için yolunun "
        "üstündeki kliniğe gidiyor.",
    yapar="Tedavi tipine göre doğru zamanda (temizlik 6 ay, dolgu kontrolü, "
          "implant kontrolü) hatırlatma + randevu linki.",
    para="Kontrolü hatırlatmak hastayla bağı sürdürür.",
    kurulum="8-12k", aylik="500-800", zorluk=2,
)
FIYAT_BOT = F(
    "fiyat_bot", "Fiyat sorusu asistanı",
    soru="Fiyat soranlara şu an kim, nasıl cevap veriyor?",
    soru2="Mesai dışında gelen sorulara ne oluyor?",
    aci="Aynı soru gün boyu; gece gelen soruya sabah cevap verilince hasta "
        "başka kliniğe yazmış oluyor.",
    yapar="WhatsApp'a gelen fiyat sorusuna bantlı ve dürüst cevap + muayene "
          "randevu linki; farklı sorular sekretere düşer.",
    para="Cevapsız kalan her fiyat sorusu, başka kliniğe giden hastadır.",
    kurulum="10-15k", aylik="600-900", zorluk=2,
)
COK_DILLI = F(
    "cok_dilli", "Çok dilli hasta formu",
    soru="Yurt dışından hasta geliyor mu, onlarla iletişimi nasıl "
         "yürütüyorsunuz?",
    aci="Sağlık turizmi talebi geliyor, dil duvarına takılıyor.",
    yapar="Arapça/İngilizce/Rusça form ve mesajlaşma, otomatik çeviriyle "
          "klinik Türkçe görür; onam metinleri de çevrilir.",
    para="Tek bir yurt dışı hastası, yıllık aboneliğin katıdır.",
    kurulum="20-35k", aylik="900-1.500", zorluk=3,
)
KACAN_CAGRI = F(
    "kacan_cagri", "Kaçan çağrı yakalayıcı",
    soru="Yoğun saatte açılamayan aramalar için bir düzeniniz var mı?",
    aci="Meşgul saatte telefon açılmıyor; arayan hasta ikinci kliniği arıyor.",
    yapar="Açılmayan aramaya 30 saniye içinde otomatik WhatsApp: 'şu an "
          "hastadayız, randevu için tıklayın'; sekretere geri arama listesi.",
    para="Açılamayan aramalar kayda geçer, geri dönülebilir.",
    kurulum="8-12k", aylik="500-900", zorluk=2,
)
ONCESI_SONRASI_KVKK = F(
    "oncesi_sonrasi_kvkk", "Onamlı öncesi/sonrası galerisi",
    soru="Öncesi/sonrası fotoğraflarında hastadan onamı nasıl alıyorsunuz?",
    aci="En güçlü satış aracı, izin riskiyle yayınlanıyor.",
    yapar="Çekim anında tek dokunuşla onam; galeri site ve WhatsApp'ta izinli "
          "yayınlanır, istenince tek tuşla kaldırılır.",
    para="İzinli galeri hem satış hem güvence; rakiplerin çoğunda yok.",
    kurulum="10-16k", aylik="400-700", zorluk=2,
)
SONRASI_TAKIP = F(
    "islem_sonrasi", "İşlem sonrası takip mesajları",
    soru="İşlem sonrası hastayla takibi nasıl yapıyorsunuz?",
    aci="Hasta endişeli, hekim ulaşılmaz; endişe kötü yoruma dönüşüyor.",
    yapar="Gün 1/3/7/14 otomatik 'şunlar normaldir, şunda arayın' mesajları; "
          "hastanın fotoğraf yükleme alanı hekime düşer.",
    para="Rahat hasta yorum yazar, endişeli hasta şikâyet yazar.",
    kurulum="8-12k", aylik="500-800", zorluk=2,
)
SEANS_HATIRLATMA = F(
    "seans_hatirlatma", "Seans hatırlatma + 24 saat iptal kuralı",
    soru="Son dakika iptal olduğunda o seans saatini nasıl değerlendiriyorsunuz?",
    soru2="Bekleyen danışanınız varsa ona nasıl haber veriyorsunuz?",
    aci="İptal edilen seans boş geçiyor; 24 saat kuralı elle uygulanamıyor.",
    yapar="48 saat önce hatırlatma; iptal olursa bekleme listesindeki "
          "danışana saat açılır; kural otomatik işler.",
    para="Boş geçen seans o haftanın kaybıdır; bekleme listesi onu doldurur.",
    kurulum="6-9k", aylik="400-600", zorluk=2, demo=True,
)
ILK_GORUSME = F(
    "ilk_gorusme", "İlk görüşme ön formu",
    soru="İlk görüşmeden önce danışandan bilgi alıyor musunuz?",
    aci="Ön bilgi seansta alınıyor; seans süresi ve ücreti erir.",
    yapar="Randevu alınınca KVKK aydınlatmalı kısa form gider; uzman seansa "
          "hazır girer.",
    para="Kazanılan 15 dakika, günde bir seans fazladır.",
    kurulum="4-6k", aylik="250-400", zorluk=1,
)
ASI_TAKVIMI = F(
    "asi_takvimi", "Aşı ve parazit takvimi",
    soru="Aşı ve parazit zamanı gelen hastaları nasıl takip edip sahibine "
         "hatırlatıyorsunuz?",
    soru2="Takvimi nerede tutuyorsunuz, kartta mı programda mı?",
    aci="Sahip unutuyor, klinik hatırlatmıyor; aşı için yolunun üstündeki "
        "veterinere gidiyor.",
    yapar="Her hastanın aşı/parazit takvimi; tarih gelince sahibine 'Pamuk'un "
          "aşısı bu hafta' mesajı + randevu.",
    para="Takvimli tekrar ziyaret, kliniğin en öngörülebilir cirosudur.",
    kurulum="8-12k", aylik="500-800", zorluk=2, demo=True,
)
MAMA_HATIRLATMA = F(
    "mama_hatirlatma", "Mama/ilaç bitiş hatırlatması",
    soru="Mama veya ilaç bitiminde sahibe hatırlatma yapıyor musunuz?",
    aci="Mama ve ilaç tekrar alımı internete kaçıyor.",
    yapar="Paket bitmeye 5 gün kala 'aynısını ayırayım mı?' mesajı; tek tuşla "
          "sipariş, klinikte teslim.",
    para="Her ay bir paket mama, her hastada; hatırlatan alır.",
    kurulum="5-8k", aylik="300-500", zorluk=1,
)

# ------------------------------------------------------------------ türler
_DIS = (RANDEVU_ONAY, KONTROL_CAGRI, FIYAT_BOT, KACAN_CAGRI, COK_DILLI)
_PSIKOLOG = (
    SEANS_HATIRLATMA,
    F("seans_arasi", "Seans arası günlük botu",
      soru="Seans aralarında danışanla iletişiminiz oluyor mu?",
      aci="Seans arası boşluk ilerlemeyi yavaşlatıyor; ilerlemeyen danışan "
          "bırakıyor.",
      yapar="Danışan WhatsApp'tan günlük ruh hali/ödev işareti bırakır; uzman "
            "seans öncesi özeti görür (KVKK onamlı).",
      para="İlerleyen danışan devam eder; devam eden danışan gelirdir.",
      kurulum="8-12k", aylik="500-800", zorluk=2),
    F("online_seans", "Online seans linki + ücret hatırlatma",
      soru="Online seansın linkini ve saat hatırlatmasını nasıl gönderiyorsunuz?",
      aci="Link, saat ve ücret hatırlatması elle yapılıyor; unutulan seans "
          "ücreti tahsil edilemiyor.",
      yapar="Seans saati gelince link otomatik gider; seans sonrası ücret "
            "hatırlatması işletmenin kendi ödeme linkiyle.",
      para="Tahsil edilmeyen bir seans, bir seans bedava çalışmaktır.",
      kurulum="5-8k", aylik="300-500", zorluk=1),
    ILK_GORUSME,
)
_VET = (
    ASI_TAKVIMI,
    SONRASI_TAKIP._replace(kod="ameliyat_sonrasi_vet", ad="Ameliyat sonrası 'bugün nasıl?' mesajı",
                           soru="Ameliyat sonrası sahipler sizi arıyor mu, bu "
                                "takibi nasıl yapıyorsunuz?", kurulum="5-8k", aylik="300-500", zorluk=1),
    MAMA_HATIRLATMA,
    F("nobet_bot", "Acil bilgi asistanı",
      soru="Mesai dışında gelen acil sorulara nasıl cevap veriliyor?",
      aci="Mesai dışı endişeli sahip cevap alamıyor; nöbetçi kliniğe gidiyor.",
      yapar="Mesai dışı gelen mesaja güvenli ilk bilgi + en yakın nöbetçi; "
            "sabah size kuyruk olarak düşer.",
      para="Gece cevap alan sahip sabah size gelir, başkasına değil.",
      kurulum="6-9k", aylik="400-600", zorluk=2),
    RANDEVU_ONAY._replace(demo=False),
)

TURLER: dict[str, Tur] = {
    "Diş kliniği": Tur("klinik", bilet=1.6, hiz=0.9, muhatap=0.6, fikirler=_DIS),
    "Ortodontist": Tur("klinik", bilet=1.5, hiz=0.9, muhatap=0.7, fikirler=(
        RANDEVU_ONAY,
        KONTROL_CAGRI._replace(kod="tel_kontrol", ad="Aylık tel kontrolü hatırlatması",
                               soru="Aylık kontrolleri hastaya kim hatırlatıyor?"),
        F("veli_bilgi", "Veliye tedavi süreci mesajları",
          soru="Uzun tedavilerde veliye süreç hakkında bilgi veriyor musunuz?",
          aci="Uzun tedavide veli süreci göremiyor, güven eriyor.",
          yapar="Her aşamada veliye kısa, resimli 'şu an buradayız' mesajı.",
          para="Süreci gören veli tedaviyi yarıda bırakmaz.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        FIYAT_BOT,
    )),
    "Estetik diş hekimi": Tur("klinik", bilet=1.6, hiz=0.9, muhatap=0.7, fikirler=(
        ONCESI_SONRASI_KVKK._replace(demo=True), RANDEVU_ONAY._replace(demo=False),
        FIYAT_BOT, COK_DILLI,
    )),
    "Estetik cerrah": Tur("klinik", bilet=1.6, hiz=0.8, muhatap=0.8, fikirler=(
        F("danismanlik_form", "Ön danışmanlık formu + eleme",
          soru="Instagram'dan gelen fiyat mesajlarını kim, nasıl cevaplıyor?",
          soru2="Ciddi hastayla meraklıyı ayırmak için bir yönteminiz var mı?",
          aci="Asistan gün boyu DM cevaplıyor; ciddi hasta kalabalıkta "
              "kayboluyor.",
          yapar="Form: bölge, beklenti, fotoğraf (KVKK onamlı), tarih; hekim "
                "yalnız uygun olanı görür; randevu linki otomatik.",
          para="Bir ameliyat hastası, bir yıl mesaj cevaplamanın maliyetinden "
               "değerlidir.",
          kurulum="12-18k", aylik="700-1.000", zorluk=2, demo=True),
        SONRASI_TAKIP, ONCESI_SONRASI_KVKK, COK_DILLI, RANDEVU_ONAY._replace(demo=False),
    )),
    "Dermatolog": Tur("klinik", bilet=1.5, hiz=0.9, muhatap=0.7, fikirler=(
        RANDEVU_ONAY,
        KONTROL_CAGRI._replace(kod="kur_hatirlatma", ad="Kür/seans hatırlatması",
                               soru="Kür seanslarının devamını nasıl takip "
                                    "ediyorsunuz?"),
        FIYAT_BOT,
        SONRASI_TAKIP._replace(kod="tedavi_takip", ad="Tedavi takip mesajı",
                               soru="Tedavi başladıktan sonra hastayla arada "
                                    "iletişim kuruyor musunuz?", kurulum="6-9k", aylik="400-600"),
    )),
    "Fizik tedavi": Tur("klinik", bilet=1.2, hiz=1.0, muhatap=0.7, fikirler=(
        RANDEVU_ONAY._replace(kod="seans_programi", ad="Seans programı + hatırlatma",
                              soru="Seans programının devamını nasıl takip "
                                   "ediyorsunuz?"),
        F("egzersiz_bot", "Ev egzersizi hatırlatması",
          soru="Ev egzersizlerini hastaya nasıl veriyorsunuz, takip ediyor "
               "musunuz?",
          aci="Ev egzersizi yapılmıyor; sonuç gecikiyor, hasta 'işe yaramadı' "
              "diyor.",
          yapar="Her akşam kısa video linkiyle hatırlatma; 'yaptım' işareti "
                "fizyoterapiste düşer.",
          para="Sonuç alan hasta programı bitirir ve tavsiye eder.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        KACAN_CAGRI, FIYAT_BOT,
    )),
    "Optisyen": Tur("klinik", bilet=0.9, hiz=1.1, muhatap=0.9, fikirler=(
        F("gozluk_hazir", "Gözlüğünüz hazır bildirimi",
          soru="Gözlük hazır olduğunda müşteriye nasıl haber veriyorsunuz?",
          aci="Hazır gözlük rafta bekliyor; müşteri aranıyor, ulaşılamıyor.",
          yapar="Sipariş 'hazır' işaretlenince WhatsApp gider; müşteri teslim "
                "saatini seçer.",
          para="Hazır gözlük daha çabuk teslim edilir.",
          kurulum="4-6k", aylik="250-400", zorluk=1, demo=True),
        MAMA_HATIRLATMA._replace(kod="lens_hatirlatma", ad="Lens kutusu bitiş hatırlatması",
                                 soru="Lens kullanan müşterilere kutu bitiminde "
                                      "hatırlatma yapıyor musunuz?",
                                 aci="Lens tekrar alımı internete kaçıyor.",
                                 para="Zamanında hatırlatma müşterinin işini "
                                      "kolaylaştırır."),
        KONTROL_CAGRI._replace(kod="goz_muayene", ad="Yıllık muayene hatırlatması",
                               soru="Yıllık göz kontrolü için müşterilere "
                                    "hatırlatma yapıyor musunuz?",
                               kurulum="5-8k", aylik="300-500", zorluk=1),
    )),
    "Gözlükçü": Tur("klinik", bilet=0.9, hiz=1.1, muhatap=0.9, fikirler=(
        F("gozluk_hazir", "Gözlüğünüz hazır bildirimi",
          soru="Gözlük hazır olduğunda müşteriye nasıl haber veriyorsunuz?",
          aci="Hazır gözlük rafta bekliyor; müşteri aranıyor, ulaşılamıyor.",
          yapar="Sipariş 'hazır' işaretlenince WhatsApp gider; müşteri teslim "
                "saatini seçer.",
          para="Hazır gözlük daha çabuk teslim edilir.",
          kurulum="4-6k", aylik="250-400", zorluk=1, demo=True),
        MAMA_HATIRLATMA._replace(kod="lens_hatirlatma", ad="Lens kutusu bitiş hatırlatması",
                                 soru="Lens kullanan müşterilere kutu bitiminde "
                                      "hatırlatma yapıyor musunuz?",
                                 aci="Lens tekrar alımı internete kaçıyor.",
                                 para="Zamanında hatırlatma müşterinin işini "
                                      "kolaylaştırır."),
        F("gunes_sezon", "Güneş gözlüğü sezon duyurusu",
          soru="Sezon ürünlerini müşterilere duyuruyor musunuz?",
          aci="Sezon ürünü bir kez satılıyor; ertesi yıl müşteri AVM'ye "
              "gidiyor.",
          yapar="Mayısta izinli listeye yeni sezon mesajı + 'ayırın' linki.",
          para="Sezonda ilk hatırlatan satar.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
    )),
    "İşitme merkezi": Tur("klinik", bilet=1.3, hiz=0.9, muhatap=0.8, fikirler=(
        MAMA_HATIRLATMA._replace(kod="pil_bakim", ad="Pil ve bakım hatırlatması",
                                 soru="Cihaz kullanıcılarına pil ve bakım "
                                      "zamanını hatırlatıyor musunuz?", demo=True),
        F("deneme_takip", "Deneme cihazı takibi",
          soru="Deneme cihazı verdiğiniz kişileri sonrasında takip ediyor "
               "musunuz?",
          aci="Deneme süresi bitince takip yapılmıyor; karar başka merkezde "
              "veriliyor.",
          yapar="Deneme günü 2/5/7 'nasıl gidiyor?' mesajı; bitişte randevu "
                "linki.",
          para="Deneme yapan kişi en sıcak müşteridir; takip edilmezse soğur.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        RANDEVU_ONAY._replace(demo=False),
    )),
    # SAHA 0.15 — dört ret (Eyl 2026). Radar psikoloğu 122 tür içinde 4. en
    # çekici hedef sayıyordu; gerçek havuzda en iyi psikolog 10.916 adayın
    # 160.'sıydı, yani her listeye aday. Gerekçe: "çalışma prensiplerimize
    # aykırı", "ben sekreterim, benim işim zaten o" — kapasite uzmanın kendi
    # saati, "daha çok müşteri" kazanç değil yük (bkz. _komite/01-urunler.md).
    # Kullanıcı kararı "puanları düşsün": listeden çıkmazlar, sıranın SONUNA
    # giderler. 0.15 havuzdan hesaplandı: en zayıf başka aday 35.6, psikoloğun
    # kuramsal en iyisi (cep + tam kalite) 185.9 → eşik 0.19. Geri açmak için
    # bu iki satırdan `saha`yı silmek yeter; 4+ uzmanlı merkez ürünü çıkarsa.
    "Psikolog": Tur("ruh_beslenme", bilet=1.3, hiz=1.1, muhatap=1.0, fikirler=_PSIKOLOG,
                    saha=0.15),
    "Psikolojik danışmanlık": Tur("ruh_beslenme", bilet=1.2, hiz=1.1, muhatap=0.9,
                                  fikirler=_PSIKOLOG, saha=0.15),
    "Diyetisyen": Tur("ruh_beslenme", bilet=1.2, hiz=1.2, muhatap=1.0, fikirler=(
        F("ogun_takip", "Öğün fotoğrafı takibi",
          soru="Kontroller arasında danışanın nasıl gittiğini takip ediyor "
               "musunuz?",
          soru2="Danışan size gün içinde ulaşıyor mu?",
          aci="Kontrol arası 7 gün karanlık; danışan disiplini kaybediyor, "
              "sonuç gelmeyince bırakıyor.",
          yapar="Danışan öğün fotoğrafını WhatsApp'a atar; sabah diyetisyene "
                "özet düşer, geri bildirim tek tuşla.",
          para="Sonuç alan danışan paketi yeniler ve arkadaşını getirir.",
          kurulum="8-12k", aylik="500-800", zorluk=2, demo=True),
        SEANS_HATIRLATMA._replace(kod="tarti_hatirlatma", ad="Kontrol ve tartı hatırlatması",
                                  soru="Kontrole gelmeyen danışanı nasıl fark "
                                       "ediyorsunuz?", demo=False),
        F("paket_yenileme", "Paket bitiş yenileme",
          soru="Paketi biten danışana devam için siz mi dönüyorsunuz?",
          aci="Paket bitiyor, yenileme teklifi zamanında yapılmıyor.",
          yapar="Son kontrolden önce 'devam paketi' mesajı, işletmenin kendi "
                "ödeme linkiyle.",
          para="Devam eden danışanla süreç kesintisiz ilerler.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
        ILK_GORUSME,
    )),
    "Veteriner": Tur("veteriner", bilet=1.4, hiz=1.1, muhatap=0.85, fikirler=_VET),
    "Hayvan hastanesi": Tur("veteriner", bilet=1.5, hiz=1.0, muhatap=0.7, fikirler=_VET),
    "Pet shop": Tur("veteriner", bilet=0.7, hiz=1.3, muhatap=0.9, fikirler=(
        MAMA_HATIRLATMA._replace(kod="mama_abonelik", ad="Mama aboneliği",
                                 soru="Düzenli mama alan müşterileri takip "
                                      "ediyor musunuz?",
                                 demo=True),
        F("geldi_bildirim", "'Geldi' bildirimi",
          soru="Beklenen ürün geldiğinde müşteriye haber veriyor musunuz?",
          aci="Beklenen ürün gelince kimse haber vermiyor; müşteri başka "
              "yerden alıyor.",
          yapar="Müşteri ürünü 'haber ver' listesine ekler; stok girince mesaj "
                "gider.",
          para="Bekleyen müşteri, haber alan ilk yerden alır.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
        F("pet_sadakat", "Telefon numaralı sadakat",
          soru="Düzenli müşterilerinizin ne sıklıkla geldiğini takip ediyor "
               "musunuz?",
          aci="Düzenli müşterinin bir süredir gelmediği fark edilmeyebiliyor.",
          yapar="Telefonla sayaç; 10. alışverişte hediye, 6 hafta gelmeyene "
                "hatırlatma.",
          para="Var olan müşteriyle iletişimi sürdürmek en kolay yol.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
    )),
    "Pet kuaförü": Tur("veteriner", bilet=0.8, hiz=1.3, muhatap=1.0, fikirler=(
        RANDEVU_ONAY._replace(kod="pet_randevu", ad="Randevu hatırlatma",
                              soru="Randevu hatırlatmasını şu an nasıl "
                                   "yapıyorsunuz?",
                              kurulum="6-9k", aylik="400-600"),
        KONTROL_CAGRI._replace(kod="tiras_dongusu", ad="6-8 hafta tıraş hatırlatması",
                               soru="Tıraş zamanı gelen müşterilere hatırlatma "
                                    "yapıyor musunuz?", kurulum="5-8k", aylik="300-500", zorluk=1),
        F("pet_hazir", "'Pamuk hazır' fotoğraflı bildirim",
          soru="İş bitince sahibine nasıl haber veriyorsunuz?",
          aci="Hazır olan hayvan bekliyor, sahibi ulaşılamıyor, kafes doluyor.",
          yapar="'Hazır' işaretlenince fotoğraflı WhatsApp gider; sahip teslim "
                "saatini seçer.",
          para="Boşalan kafes, bir sonraki müşteridir.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
    )),
}
