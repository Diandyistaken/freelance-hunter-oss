"""Grup: yeme — restoran, meyhane, bar, yemek aracı, catering.

Ortak gerçek: bu işletmelerde para MASADA kaybolur — gelmeyen rezervasyon,
cevapsız kalan DM, sessizce kaybolan müdavim. Fikirlerin hepsi bunu hedefler.
Fiyat bantları ÖNERİDİR (offer.md'ye işlenmedi — iş kararı kullanıcının).
"""

from services.radar.fikirler._tip import F, Tur

# ------------------------------------------------------------ ortak fikirler
REZ_NOBETCI = F(
    "rez_nobetci", "Rezervasyon nöbetçisi",
    soru="Instagram ya da WhatsApp'tan rezervasyon isteği geldiğinde bunlara kim "
         "bakıyor?",
    soru2="Akşam servisi sırasında gelen mesajlara da yetişebiliyor musunuz?",
    aci="Akşam servisinde kimse DM'e bakamıyor; sabah cevaplanan rezervasyon "
        "çoktan başka mekâna gitmiş oluyor.",
    yapar="WhatsApp ve Instagram'dan gelen 'yer var mı?' mesajını anında "
          "cevaplar, masa defterine yazar, bir gün önce hatırlatır.",
    para="Cevapsız kalan her rezervasyon isteği, karşı sokaktaki restorana "
         "giden bir masadır.",
    kurulum="10-15k", aylik="600-1.000", zorluk=2, demo=True,
)
NOSHOW = F(
    "noshow_kesici", "Gelmeyen masa alarmı",
    soru="Rezervasyonlu masaların geleceğini önceden teyit ediyor musunuz, "
         "nasıl?",
    soru2="Gelmeyen masa olduğunda o masayı nasıl değerlendiriyorsunuz?",
    aci="Rezervasyonlu masa boş bekliyor, kapıdaki müşteri geri çevriliyor.",
    yapar="Rezervasyondan 3 saat önce 'geliyor musunuz?' diye sorar; cevap "
          "gelmezse masayı bekleme listesindeki müşteriye açar.",
    para="Teyit edilen masa boş kalma ihtimalini azaltır.",
    kurulum="8-12k", aylik="500-800", zorluk=2,
)
YORUM = F(
    "yorum_yakala", "Google puanı yükseltici",
    soru="Müşteriden Google'a yorum bırakmasını şu an nasıl istiyorsunuz?",
    aci="Memnun müşteri sessiz gider, kızgın müşteri yorum yazar.",
    yapar="Hesabın yanındaki QR 'memnun kaldınız mı?' diye sorar; memnunsa "
          "Google'a yönlendirir, değilse patrona anında iletir.",
    para="'Yakınımda restoran' aramasında görünüp görünmemek, Google puanının "
         "ondalığına bağlı.",
    kurulum="6-10k", aylik="400-700", zorluk=1,
)
MUDAVIM = F(
    "mudavim_radar", "Kayıp müdavim mesajı",
    soru="Düzenli gelen müşterilerinizin kaydını tutuyor musunuz?",
    aci="Düzenli müşterinin uğramadığı fark edilmeyebiliyor.",
    yapar="Rezervasyon kayıtlarından 30 gündür gelmeyeni bulur, patronun "
          "adıyla kısa bir 'sizi özledik' mesajı atar.",
    para="Var olan müşteriyle iletişimi sürdürmek en kolay yol.",
    kurulum="6-10k", aylik="400-600", zorluk=2,
)
KENDI_HAT = F(
    "kendi_hat", "Komisyonsuz sipariş hattı",
    soru="Paket siparişler ağırlıklı platformdan mı geliyor, doğrudan arayan da "
         "var mı?",
    aci="Her paket siparişin bir payı platforma gidiyor; müdavim bile "
        "platformdan sipariş veriyor.",
    yapar="Müdavimler WhatsApp'tan ya da QR'dan doğrudan sipariş verir; "
          "sipariş mutfağa liste olarak düşer, komisyon sıfır.",
    para="Doğrudan gelen siparişte komisyon ödenmez.",
    kurulum="10-15k", aylik="600-900", zorluk=2, demo=True,
)
TEKRAR_SIPARIS = F(
    "tekrar_siparis", "Cuma akşamı hatırlatması",
    soru="Düzenli sipariş veren bir müşterinin uğramadığını nasıl fark "
         "ediyorsunuz?",
    aci="Düzenli sipariş veren müşterinin uğramadığı fark edilmeyebiliyor.",
    yapar="Sipariş geçmişinden düzeni bozulanı bulur, patron adına 'bu "
          "akşam?' mesajı gönderir.",
    para="Var olan müşteriyle iletişimi sürdürmek en kolay yol.",
    kurulum="6-9k", aylik="400-600", zorluk=2,
)
OZEL_GUN = F(
    "ozel_gun", "Özel gün hafızası",
    soru="Doğum günü, yıldönümü gibi özel gün rezervasyonlarını bir yere not "
         "ediyor musunuz?",
    aci="Özel gün müşterisi bir kez geliyor; hatırlanmadığı için tekrar "
        "gelmiyor.",
    yapar="Rezervasyon notundaki 'doğum günü / yıldönümü'nü hatırlar, bir yıl "
          "sonra bir hafta önceden nazik bir hatırlatma gönderir.",
    para="Yıldönümü masası yılın en yüksek hesaplarından biridir; hatırlatan "
         "restoran alır.",
    kurulum="6-9k", aylik="400-600", zorluk=1,
)
ETKINLIK = F(
    "etkinlik_liste", "Etkinlik gecesi duyurusu",
    soru="Haftalık programı müdavimlere şu an nasıl duyuruyorsunuz?",
    soru2="Duyuru yaptığınızda geri dönüş alabiliyor musunuz?",
    aci="Etkinlik duyurusu algoritmaya kalıyor; müdavim haberdar olmuyor.",
    yapar="İzin vermiş müdavim listesine haftalık program tek mesajla gider, "
          "masa/loca ayırtma linkiyle (İYS kaydı otomatik).",
    para="Boş perşembe ile dolu perşembe arasındaki fark bir duyurudur.",
    kurulum="6-9k", aylik="400-600", zorluk=1, demo=True,
)
LOCA = F(
    "loca_rez", "Masa/loca rezervasyonu + kapora",
    soru="Loca veya masa ayırtırken kapora alıyor musunuz, nasıl yürüyor?",
    aci="Loca 'ayırttım' diyenle dolu görünüyor, gelen olmuyor.",
    yapar="Loca rezervasyonu işletmenin kendi ödeme linkiyle kapora alarak "
          "kesinleşir; gelmeyen kapora yakar.",
    para="Kaporalı loca boş kalmaz; kalırsa bedeli ödenmiştir.",
    kurulum="8-12k", aylik="500-800", zorluk=2,
)

# ------------------------------------------------------------------ türler
_RESTORAN = (REZ_NOBETCI, NOSHOW, YORUM, MUDAVIM)
_PAKET = (KENDI_HAT, TEKRAR_SIPARIS, YORUM)
_FINE = (REZ_NOBETCI, OZEL_GUN, NOSHOW, YORUM)
_BAR = (ETKINLIK, LOCA, YORUM)

TURLER: dict[str, Tur] = {
    "Restoran": Tur("yeme", bilet=0.9, hiz=1.2, muhatap=0.8, fikirler=_RESTORAN),
    "Türk mutfağı restoran": Tur("yeme", bilet=0.8, hiz=1.1, muhatap=0.7, fikirler=(
        F("gunun_menusu", "Günün yemeği yayını",
          soru="Günün menüsünü soranlara şu an nasıl cevap veriyorsunuz?",
          soru2="Yoğun saatte telefona bakacak biri oluyor mu?",
          aci="Aynı soruya günde onlarca kez telefonda cevap veriliyor.",
          yapar="Sabah tek WhatsApp mesajıyla günün menüsü müdavim listesine, "
                "Google profiline ve siteye aynı anda düşer.",
          para="Menüyü görmek müşterinin karar vermesini kolaylaştırır.",
          kurulum="6-9k", aylik="400-600", zorluk=1, demo=True),
        F("ogle_paket", "Ofis öğle paketi hattı",
          soru="Ofislerden gelen öğle siparişlerini kim alıyor, nasıl not "
               "ediliyor?",
          aci="Telefonla alınan sipariş eksik yazılıyor; öğle yoğunluğunda "
              "hat meşgul.",
          yapar="Ofisler WhatsApp'tan menüden seçip saatini yazar; sipariş "
                "mutfağa listeli düşer, komisyonsuz.",
          para="Doğrudan gelen siparişte komisyon ödenmez.",
          kurulum="8-12k", aylik="500-800", zorluk=2),
        YORUM, MUDAVIM,
    )),
    "Balık restoranı": Tur("yeme", bilet=1.0, hiz=1.1, muhatap=0.7, fikirler=(
        F("gunun_baligi", "Günün balığı tahtası",
          soru="Bugün hangi balığın olduğunu soranlara nasıl cevap veriyorsunuz?",
          soru2="Tezgâh her gün değişiyor, bunu bir yerde duyuruyor musunuz?",
          aci="Balık her gün değişiyor; müşteri aramadan gelmiyor, hat "
              "meşgulken müşteri kaçıyor.",
          yapar="Sabah tezgâhın fotoğrafını atarsınız; balık listesi ve fiyat "
                "WhatsApp durumuna, Google'a ve siteye otomatik düşer.",
          para="Taze balığı görüp gelen müşteri, telefonu açılmadığı için "
               "gelmeyen müşteriden çoktur.",
          kurulum="6-9k", aylik="400-600", zorluk=1, demo=True),
        REZ_NOBETCI._replace(demo=False), NOSHOW, MUDAVIM,
    )),
    "Kahvaltı & brunch": Tur("yeme", bilet=0.8, hiz=1.3, muhatap=0.8, fikirler=(
        F("sanal_sira", "Sanal sıra",
          soru="Hafta sonu kapıda sıra oluştuğunda bekleyenleri nasıl "
               "yönetiyorsunuz?",
          soru2="Sırası gelenlere nasıl haber veriyorsunuz?",
          aci="Hafta sonu kuyruk uzuyor; bekleyen sıkılıp yandaki mekâna "
              "geçiyor.",
          yapar="Kapıdaki QR ile sıraya girer, masa açılınca WhatsApp gelir; "
                "müşteri sahilde yürür, sırasını kaybetmez.",
          para="Kuyruktan giden her grup, en yoğun gününüzün en dolu "
               "masasıdır.",
          kurulum="8-12k", aylik="500-800", zorluk=2, demo=True),
        REZ_NOBETCI._replace(demo=False), YORUM, MUDAVIM,
    )),
    "Pizzacı": Tur("yeme", bilet=0.7, hiz=1.3, muhatap=0.8, fikirler=_PAKET),
    "Burgerci": Tur("yeme", bilet=0.7, hiz=1.3, muhatap=0.8, fikirler=_PAKET),
    "Kebapçı": Tur("yeme", bilet=0.8, hiz=1.2, muhatap=0.7, fikirler=(
        KENDI_HAT,
        F("toplu_siparis", "Toplu/ofis sipariş formu",
          soru="Kalabalık ofis siparişlerinde kim ne istedi bilgisini nasıl "
               "topluyorsunuz?",
          aci="Toplu sipariş telefonda karışıyor; yanlış giden bir tepsi "
              "bütün ofisi kaçırıyor.",
          yapar="Ofis tek linkten herkesin seçimini toplar, sipariş mutfağa "
                "kişi kişi listeli düşer.",
          para="Düzenli ofis siparişi öngörülebilir bir iş akışı sağlar.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        TEKRAR_SIPARIS, YORUM,
    )),
    "İtalyan restoran": Tur("yeme", bilet=1.1, hiz=1.0, muhatap=0.7, fikirler=_FINE),
    "Steakhouse": Tur("yeme", bilet=1.2, hiz=1.0, muhatap=0.7, fikirler=_FINE),
    "Suşi restoranı": Tur("yeme", bilet=1.1, hiz=1.0, muhatap=0.7, fikirler=(
        REZ_NOBETCI, KENDI_HAT._replace(demo=False), OZEL_GUN, YORUM,
    )),
    "Meyhane": Tur("yeme", bilet=0.9, hiz=1.1, muhatap=0.8, fikirler=(
        REZ_NOBETCI, NOSHOW,
        F("fasil_takvim", "Haftalık program yayını",
          soru="Haftalık programı soranlara nasıl bildiriyorsunuz?",
          aci="Program Instagram'da kayboluyor; müdavim son dakika öğreniyor.",
          yapar="Haftalık program tek mesajla izinli listeye ve Google'a düşer, "
                "rezervasyon linkiyle.",
          para="Dolu bir fasıl gecesi, boş bir gecenin üç katı hesap keser.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
        MUDAVIM,
    )),
    "Bar": Tur("yeme", bilet=0.8, hiz=1.0, muhatap=0.7, fikirler=_BAR),
    "Kokteyl bar": Tur("yeme", bilet=0.9, hiz=1.0, muhatap=0.7, fikirler=_BAR),
    "Şarap evi": Tur("yeme", bilet=1.0, hiz=1.0, muhatap=0.8, fikirler=(
        F("tadim_rsvp", "Tadım gecesi kayıt + kapora",
          soru="Tadım gecesi için kayıt alırken yeri nasıl garantiye "
               "alıyorsunuz?",
          soru2="Kayıt olanlara hatırlatma yapıyor musunuz?",
          aci="Sınırlı kontenjan 'geliyorum'la doluyor, gece yarı boş geçiyor.",
          yapar="Tadım takvimi + kayıt formu; işletmenin kendi ödeme linkiyle "
                "kapora, hatırlatma otomatik.",
          para="Kaporalı koltuk boş kalmaz; kalırsa ödenmiştir.",
          kurulum="6-9k", aylik="400-600", zorluk=1, demo=True),
        ETKINLIK._replace(demo=False), LOCA, YORUM,
    )),
    "Bira evi": Tur("yeme", bilet=0.8, hiz=1.0, muhatap=0.8, fikirler=_BAR),
    "Yemek aracı": Tur("yeme", bilet=0.6, hiz=1.3, muhatap=1.0, fikirler=(
        F("neredeyim", "Bugün neredeyim yayını",
          soru="Her gün nerede olacağınızı müşterilere nasıl duyuruyorsunuz?",
          soru2="Sizi arayıp yerinizi soran oluyor mu?",
          aci="Konum her gün değişiyor; müşteri Instagram'ı kaçırınca "
              "bulamıyor.",
          yapar="Konumu tek mesajla izinli listeye ve Google profiline düşürür.",
          para="Sizi bulan müdavim, o gün yemeğini sizden alır.",
          kurulum="4-6k", aylik="250-400", zorluk=1, demo=True),
        F("on_siparis_arac", "Ön sipariş, kuyruksuz teslim",
          soru="Önceden sipariş verip hazır gelmek isteyen oluyor mu, nasıl "
               "hallediyorsunuz?",
          aci="Kuyruk uzayınca müşteri vazgeçiyor.",
          yapar="WhatsApp'tan sipariş + saat; hazır olunca mesaj, kuyruksuz "
                "teslim.",
          para="Kuyruğa girmeyen müşteri o gün başka yerde yer.",
          kurulum="5-8k", aylik="300-500", zorluk=2),
        YORUM,
    )),
    "Catering firması": Tur("yeme", bilet=1.2, hiz=0.9, muhatap=0.9, fikirler=(
        F("teklif_takip", "Teklif takipçisi",
          soru="Teklif gönderdikten sonra dönüş gelmezse takibini nasıl "
               "yapıyorsunuz?",
          soru2="Teklifi açtı mı, gördü mü — bunu bilebiliyor musunuz?",
          aci="Teklif gönderiliyor, sonrasının takibi zor olabiliyor.",
          yapar="Teklif açıldığında haber verir, 48 saat sessizlikte nazik "
                "hatırlatma atar, etkinlik tarihi yaklaşınca sizi uyarır.",
          para="Takip edilen teklif cevapsız kalmaz.",
          kurulum="8-12k", aylik="500-800", zorluk=2, demo=True),
        F("etkinlik_form", "Etkinlik talep formu",
          soru="Etkinlik talebi geldiğinde kişi sayısı, tarih, menü bilgisini "
               "nasıl topluyorsunuz?",
          aci="Kişi sayısı, menü, tarih, adres — hepsi parça parça geliyor.",
          yapar="Müşteri tek formda hepsini doldurur; teklif taslağı otomatik "
                "hazırlanır, siz sadece fiyatı yazarsınız.",
          para="Teklife giden saat, mutfağa gitmeyen saattir.",
          kurulum="6-9k", aylik="400-600", zorluk=2),
        F("menu_katalog", "WhatsApp menü kataloğu",
          soru="Menüyü soranlara şu an nasıl gönderiyorsunuz?",
          aci="Menü PDF'i her seferinde elle atılıyor, sürümü karışıyor.",
          yapar="Güncel menü ve fotoğraflar tek linkte; 'menü' yazan otomatik "
                "alır, teklif formuna geçer.",
          para="Hızlı cevap alan müşteri, ilk cevap verenle anlaşır.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
    )),
}
