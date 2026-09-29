"""Grup: guzellik — kuaför, berber, güzellik salonu, spa, nail, epilasyon,
makyaj, dövme, solaryum.

Ortak gerçek: para KOLTUKTA kaybolur — boş geçen saat, gelmeyen randevu,
yarım bırakılan paket. Patron çoğunlukla salonda ve telefonu açar.
Fiyat bantları ÖNERİDİR (offer.md'ye işlenmedi).
"""

from services.radar.fikirler._tip import F, Tur

# ------------------------------------------------------------ ortak fikirler
BOS_SAAT = F(
    "bos_saat", "Boş saat doldurucu",
    soru="Son dakika iptal olduğunda o saati şu an nasıl değerlendiriyorsunuz?",
    soru2="Bekleyen müşteriniz varsa boşalan saati ona nasıl duyuruyorsunuz?",
    aci="İptal olan saat boş geçiyor; sırada bekleyen müşteri haberdar "
        "olmuyor.",
    yapar="İptal düşünce bekleme listesindeki müşteriye tek tuşla 'saat "
          "15:00 açıldı' mesajı; ilk onaylayan alır.",
    para="Boşalan saat bekleyene açılınca gün dolu geçer.",
    kurulum="8-12k", aylik="500-800", zorluk=2, demo=True,
)
RANDEVU = F(
    "randevu_hatirlatma", "Randevu hatırlatma + onay",
    soru="Randevuları müşteriye önceden hatırlatıyor musunuz, nasıl?",
    aci="Gelmeyen müşteri koltuğu boş bırakıyor; personel bekliyor.",
    yapar="Randevudan bir gün ve 2 saat önce 'onaylıyorum / erteliyorum' "
          "mesajı; ertelenen saat boş saat listesine düşer.",
    para="Hatırlatma, gelmeyen müşteriyi azaltmanın en ucuz yoludur.",
    kurulum="6-10k", aylik="400-700", zorluk=2,
)
PAKET_TAKIP = F(
    "paket_takip", "Paket seans takibi",
    soru="Paket alan müşterinin kalan seanslarını nerede takip ediyorsunuz?",
    soru2="Müşteri kaç seansı kaldığını size mi soruyor?",
    aci="10 seanslık paket alan müşteri 6'da bırakıyor; ne yenileme oluyor ne "
        "memnuniyet.",
    yapar="Her seans sonrası 'kalan 3 seans' mesajı; son seans yaklaşınca "
          "yenileme teklifi; boşta duran seans için 'randevu alın' "
          "hatırlatması.",
    para="Paketi bitiren müşteri yeniler; yarım bırakan başka salona gider.",
    kurulum="8-12k", aylik="500-800", zorluk=2,
)
KAMPANYA_IZIN = F(
    "kampanya_izin", "İzinli kampanya listesi",
    soru="Sakin günleri doldurmak için müşterilere duyuru yapıyor musunuz?",
    aci="Kampanya mesajı atmak istiyor ama izin kaydı yok; toplu mesaj "
        "riskli.",
    yapar="Rıza alınmış müşteri listesi + 'salı sabahı' kampanyası tek tuşla; "
          "İYS kaydı otomatik.",
    para="Boş sabahı dolduran tek mesaj, o günün cirosudur.",
    kurulum="6-9k", aylik="400-600", zorluk=2,
)
GALERI = F(
    "oncesi_sonrasi", "Onaylı öncesi/sonrası galerisi",
    soru="Öncesi/sonrası fotoğraflarını paylaşırken müşteriden izni nasıl "
         "alıyorsunuz?",
    aci="En güçlü satış aracı izinsiz yayınlanıyor; bir şikâyet hepsini "
        "kaldırtır.",
    yapar="Fotoğraf çekilirken tek dokunuşla onay alınır; galeri site ve "
          "WhatsApp'ta izinli olarak yayınlanır.",
    para="İzinli galeri hem satış hem güvence; rakiplerin çoğunda yok.",
    kurulum="6-9k", aylik="400-600", zorluk=2,
)
HEDIYE_KARTI = F(
    "hediye_karti", "Dijital hediye kartı",
    soru="Hediye kartı satıyor musunuz, uzaktan almak isteyene nasıl "
         "veriyorsunuz?",
    aci="Hediye kartı sadece salonda satılıyor; uzaktaki alıcı alamıyor.",
    yapar="WhatsApp'tan link, işletmenin kendi ödeme linkiyle alınır; kod "
          "alıcıya gider, kullanım takvimi otomatik.",
    para="Hediye kartı peşin cirodur; kullanılmayanı bile kârdır.",
    kurulum="6-9k", aylik="400-600", zorluk=2,
)
DONGU = F(
    "dongu_hatirlatma", "Bakım döngüsü hatırlatması",
    soru="Müşteri çıkarken bir sonraki randevusunu alıyor mu, almazsa ne oluyor?",
    aci="Müşteri bir sonraki randevuyu almadan çıkıyor; kim önce hatırlatırsa "
        "ona gidiyor.",
    yapar="Her işlem tipine göre doğru haftada 'zamanı geldi' mesajı + "
          "randevu linki.",
    para="Zamanı gelince hatırlatmak müşterinin işini kolaylaştırır.",
    kurulum="5-8k", aylik="300-500", zorluk=1,
)
KAPORA = F(
    "kapora_randevu", "Kaporalı randevu",
    soru="Uzun süren işlemlerde randevuyu garantiye almak için bir şey yapıyor "
         "musunuz?",
    aci="Uzun işlemlerde randevunun teyidi önem kazanıyor.",
    yapar="Randevu onayına işletmenin kendi ödeme linki eklenir; küçük kapora "
          "gelmeyeni ciddi düşürür.",
    para="Kaporalı randevu boş kalmaz; kalırsa bedeli ödenmiştir.",
    kurulum="6-10k", aylik="400-700", zorluk=1,
)

# ------------------------------------------------------------------ türler
_SALON = (PAKET_TAKIP._replace(demo=True), BOS_SAAT._replace(demo=False),
          RANDEVU, KAMPANYA_IZIN, GALERI)
_SPA = (RANDEVU._replace(demo=True), HEDIYE_KARTI, PAKET_TAKIP,
        BOS_SAAT._replace(demo=False))

TURLER: dict[str, Tur] = {
    "Kuaför": Tur("guzellik", bilet=0.9, hiz=1.3, muhatap=0.85, fikirler=(
        BOS_SAAT, RANDEVU,
        DONGU._replace(kod="kok_boya", ad="Kök/boya tazeleme hatırlatması",
                       soru="Boya yaptıran müşteriye tazeleme zamanı geldiğinde "
                            "haber veriyor musunuz?"),
        F("personel_takvim", "Kuaför bazlı randevu takvimi",
          soru="Personel bazlı randevuları nerede tutuyorsunuz, defterde mi?",
          aci="Defterde karışan saatler, çift yazılan randevu.",
          yapar="Her personelin takvimi telefonda; müşteri istediği "
                "kuaförden randevu alır, çakışma olmaz.",
          para="Tek takvim, aynı saate iki randevu yazılmasını önler.",
          kurulum="8-12k", aylik="500-800", zorluk=2),
        KAMPANYA_IZIN,
    )),
    "Berber": Tur("guzellik", bilet=0.7, hiz=1.4, muhatap=1.0, fikirler=(
        F("sira_bildirim", "Sıra bildirimi",
          soru="Sırayı soranlara şu an nasıl cevap veriyorsunuz?",
          soru2="Yoğun saatte bekleyenler için bir düzeniniz var mı?",
          aci="Müşteri sırayı bilmediği için ya bekleyip sıkılıyor ya "
              "gelmiyor.",
          yapar="WhatsApp'a 'sıra?' yazan otomatik cevap alır ve sıraya girer; "
                "sırası yaklaşınca mesaj gider, dükkânda beklemez.",
          para="Bekleyip giden müşteri, iki haftada bir gelmesi gereken "
               "müşteridir.",
          kurulum="6-9k", aylik="400-600", zorluk=2, demo=True),
        F("tiras_sadakat", "10 tıraş 1 bedava sayacı",
          soru="Düzenli müşterilerinizin ne sıklıkla geldiğini takip ediyor "
               "musunuz?",
          aci="Düzenli müşterinin bir süredir gelmediği fark edilmeyebiliyor.",
          yapar="Telefon numarasıyla sayaç; 10. tıraş bedava, 4 hafta "
                "gelmeyene 'zamanı geldi' mesajı.",
          para="Düzenli müşteriyi hatırlamak, yeniden kazanmaya çalışmaktan "
               "kolay.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
        RANDEVU._replace(ad="Berber bazlı randevu"),
    )),
    "Güzellik salonu": Tur("guzellik", bilet=1.1, hiz=1.2, muhatap=0.85, fikirler=_SALON),
    "Güzellik & spa": Tur("guzellik", bilet=1.1, hiz=1.2, muhatap=0.8, fikirler=_SALON),
    "Spa": Tur("guzellik", bilet=1.1, hiz=1.1, muhatap=0.8, fikirler=_SPA),
    "Spa merkezi": Tur("guzellik", bilet=1.1, hiz=1.1, muhatap=0.75, fikirler=_SPA),
    "Masaj salonu": Tur("guzellik", bilet=1.0, hiz=1.2, muhatap=0.85, fikirler=(
        RANDEVU._replace(demo=True), HEDIYE_KARTI,
        F("masaj_uyelik", "Aylık masaj üyeliği",
          soru="Düzenli gelen müşteriler için üyelik ya da paket gibi bir "
               "şeyiniz var mı?",
          aci="Masaj müşterisi düzensiz; boş saatler tahmin edilemiyor.",
          yapar="Aylık 2 seans üyelik, otomatik randevu önerisi ve hatırlatma.",
          para="Üyelik, boş saati önceden satmaktır.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        BOS_SAAT._replace(demo=False),
    )),
    "Nail studio": Tur("guzellik", bilet=0.8, hiz=1.3, muhatap=0.9, fikirler=(
        RANDEVU._replace(demo=True),
        DONGU._replace(kod="oje_bakim", ad="3 hafta bakım hatırlatması",
                       soru="Bakım zamanı gelen müşteriye hatırlatma yapıyor "
                            "musunuz?"),
        BOS_SAAT._replace(demo=False),
        F("tasarim_galeri", "Tasarım galerisi + randevuda seçim",
          soru="Müşteri istediği tasarımı size nasıl anlatıyor?",
          aci="Tasarım seçimi randevu sırasında dakikalar yiyor.",
          yapar="Galeriden randevu alırken tasarım seçilir; süre ve fiyat "
                "otomatik hesaplanır.",
          para="Randevuda kazanılan 10 dakika, günde bir müşteri fazladır.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
    )),
    "Epilasyon merkezi": Tur("guzellik", bilet=1.1, hiz=1.1, muhatap=0.8, fikirler=(
        DONGU._replace(kod="seans_aralik", ad="Seans aralığı hatırlatması",
                       soru="Seans aralıklarını takip edip müşteriye "
                            "hatırlatıyor musunuz?", demo=True),
        PAKET_TAKIP, RANDEVU, GALERI,
    )),
    "Makyaj sanatçısı": Tur("guzellik", bilet=1.0, hiz=1.2, muhatap=1.0, fikirler=(
        F("gelin_takvim", "Gelin/mezuniyet takvimi + kapora",
          soru="Gelin için tarih tutarken kapora alıyor musunuz, nasıl yürüyor?",
          soru2="Tutulan tarihleri nerede takip ediyorsunuz?",
          aci="Tarih 'ayırdım'la kilitleniyor, kapora alınmıyor, sezon günü "
              "boş kalıyor.",
          yapar="Müsait tarihler takvimde; işletmenin kendi ödeme linkiyle "
                "kapora, prova hatırlatması otomatik.",
          para="Kapora, tarihi iki taraf için de netleştirir.",
          kurulum="6-9k", aylik="400-600", zorluk=2, demo=True),
        F("teklif_takip_makyaj", "Teklif takipçisi",
          soru="Fiyat sorup sessizleşen adaylara tekrar dönüyor musunuz?",
          aci="DM'de fiyat sorulur, cevap verilir, konuşma ölür.",
          yapar="48 saat sessizlikte nazik hatırlatma; tarih yaklaşınca 'hâlâ "
                "müsait' mesajı.",
          para="Takip edilen teklif cevapsız kalmaz.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
        GALERI,
    )),
    "Dövme & piercing": Tur("guzellik", bilet=0.9, hiz=1.2, muhatap=1.0, fikirler=(
        F("tasarim_talep", "Tasarım talep formu + kapora",
          soru="Instagram'dan gelen fiyat sorularını şu an nasıl "
               "karşılıyorsunuz?",
          soru2="Ciddi olanla meraklıyı ayırmak için bir yönteminiz var mı?",
          aci="DM'de fiyat pazarlığı zaman yiyor; ciddi müşteri ayrılamıyor.",
          yapar="Form: bölge, boyut, referans görsel; sanatçı onaylar, kapora "
                "linkiyle tarih kilitlenir.",
          para="Kapora alınan tarih iki taraf için de kesinleşir.",
          kurulum="6-9k", aylik="400-600", zorluk=2, demo=True),
        F("iyilesme_takip", "İyileşme takibi mesajları",
          soru="İşlem sonrası bakım talimatını müşteriye nasıl veriyorsunuz?",
          aci="Bakım talimatı unutuluyor; endişeli müşteri kötü yorum yazıyor.",
          yapar="Gün 1/3/7/14 otomatik bakım mesajı, fotoğraf yükleme alanı; "
                "sorun varsa sanatçıya düşer.",
          para="Rahat müşteri fotoğraf paylaşır; endişeli müşteri şikâyet "
               "yazar.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
        RANDEVU, GALERI._replace(ad="Portföy galerisi + izin"),
    )),
    "Solaryum": Tur("guzellik", bilet=0.6, hiz=1.3, muhatap=0.9, fikirler=(
        PAKET_TAKIP._replace(demo=True), RANDEVU, KAMPANYA_IZIN,
    )),
}
