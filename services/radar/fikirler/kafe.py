"""Grup: kafe — kafe, kahveci, çay evi, fırın/pastane, tatlıcı, dondurmacı, smoothie.

Ortak gerçek: bilet küçük, para TEKRAR ZİYARETTE. Fikirlerin hepsi
müşteriyi bir kez daha getirmeye ya da sabah kuyruğunu kaçırmamaya yönelik.
Fiyat bantları ÖNERİDİR (offer.md'ye işlenmedi).
"""

from services.radar.fikirler._tip import F, Tur

# ------------------------------------------------------------ ortak fikirler
SADAKAT = F(
    "sadakat", "Telefon numaralı sadakat kartı",
    soru="Düzenli müşterileriniz için sadakat kartı gibi bir şey kullanıyor "
         "musunuz?",
    soru2="Kimin kaç kez geldiğini takip edebiliyor musunuz?",
    aci="Karton kart kayboluyor; kim düzenli geliyor kimse bilmiyor.",
    yapar="Kasada telefon numarası söylenir; 10. kahve bedava, 3 hafta "
          "gelmeyene 'kahveniz sizi bekliyor' mesajı gider.",
    para="Haftada bir gelen müşteri haftada iki gelirse ciro fiyat "
         "artırmadan artar.",
    kurulum="5-8k", aylik="300-500", zorluk=1, demo=True,
)
ON_SIPARIS = F(
    "on_siparis", "Sabah ön sipariş",
    soru="Sabah yoğunluğunda önceden sipariş vermek isteyen oluyor mu, nasıl "
         "hallediyorsunuz?",
    aci="Sabah kuyruğu müşteri kaçırıyor; barista yetişemiyor.",
    yapar="Müdavim WhatsApp'tan 'geliyorum, latte' der, kahvesi hazır bekler; "
          "ödeme kasada.",
    para="Kuyruğa girmeyen müşteri o sabah başka kahveciye gider, ertesi "
         "sabah da.",
    kurulum="8-12k", aylik="500-800", zorluk=2,
)
YORUM_KAFE = F(
    "yorum_yakala", "Google puanı yükseltici",
    soru="Müşteriden Google'a yorum bırakmasını şu an nasıl istiyorsunuz?",
    aci="Memnun müşteri sessiz gider, kızgın müşteri yorum yazar.",
    yapar="Masadaki QR 'memnun kaldınız mı?' diye sorar; memnunsa Google'a "
          "yönlendirir, değilse patrona anında iletir.",
    para="'Yakınımda kafe' aramasında ilk üçe girmek Google puanına bağlı.",
    kurulum="6-10k", aylik="400-700", zorluk=1,
)
ATOLYE = F(
    "atolye_kayit", "Atölye/etkinlik kaydı",
    soru="Atölye ya da etkinlik kaydını şu an nasıl alıyorsunuz?",
    aci="Etkinlik kontenjanı 'geliyorum'la doluyor, gün yarı boş geçiyor.",
    yapar="Etkinlik takvimi + kayıt formu; işletmenin kendi ödeme linkiyle "
          "kapora, hatırlatma otomatik.",
    para="Kaporalı sandalye boş kalmaz; kalırsa ödenmiştir.",
    kurulum="5-8k", aylik="300-500", zorluk=1,
)
ABONELIK = F(
    "abonelik", "Aylık kahve aboneliği",
    soru="Her gün gelen müşteriler için aylık paket gibi bir şeyiniz var mı?",
    aci="Günlük alışkanlık ödeme anına bağlı; tekrar ziyaret garantisi yok.",
    yapar="Aylık 20 kahve paketi, telefon numarasıyla sayaç; bitince "
          "yenileme mesajı.",
    para="Peşin alınan 20 kahve hem nakit akışı hem sadakat; müşteri 'hakkım "
         "var' diye gelir.",
    kurulum="6-9k", aylik="400-600", zorluk=2,
)
PASTA_SIPARIS = F(
    "pasta_siparis", "Özel pasta sipariş formu",
    soru="Özel pasta siparişlerinde boy, yazı, teslim saati gibi detayları nasıl "
         "alıyorsunuz?",
    soru2="Sipariş notlarını nerede tutuyorsunuz?",
    aci="Sipariş defterde, fotoğraf WhatsApp'ta, teslim saati kafada; hata "
        "pahalı, müşteri kırılıyor.",
    yapar="Müşteri WhatsApp'tan formu doldurur (fotoğraf, kişi sayısı, yazı, "
          "tarih), kapora linkiyle onaylar; sipariş listesi mutfağa düşer, "
          "teslim günü hatırlatma gider.",
    para="Yanlış yazılan bir pasta, o müşterinin ömür boyu siparişidir.",
    kurulum="8-12k", aylik="500-800", zorluk=2, demo=True,
)
BAYRAM = F(
    "bayram_onsiparis", "Bayram ön sipariş listesi",
    soru="Bayram gibi yoğun günlerde ne kadar üreteceğinize nasıl karar "
         "veriyorsunuz?",
    aci="Yoğun günde talep tahmin edilemiyor; ya ürün yetmiyor ya elde "
        "kalıyor.",
    yapar="Bayramdan 10 gün önce müdavimlere ön sipariş linki; üretim listesi "
          "otomatik oluşur.",
    para="Ön sipariş garanti satıştır; doğru üretim, fire yok.",
    kurulum="6-9k", aylik="400-600", zorluk=1,
)
SABAH_TAZE = F(
    "sabah_taze", "Sabah taze ürün listesi",
    soru="Sabah çıkan taze ürünleri müdavimlere duyuruyor musunuz?",
    aci="Taze ürün öğlene kadar bekliyor; müşteri 'ne var' diye aramıyor.",
    yapar="Sabah tek fotoğrafla günün ürünleri izinli listeye ve Google'a "
          "düşer; 'ayırır mısınız' cevabı otomatik.",
    para="Sabah ayırtılan ürün akşam fire olmaz.",
    kurulum="4-6k", aylik="300-400", zorluk=1,
)

# ------------------------------------------------------------------ türler
TURLER: dict[str, Tur] = {
    "Kafe": Tur("kafe", bilet=0.7, hiz=1.3, muhatap=0.85,
                fikirler=(SADAKAT, ON_SIPARIS, YORUM_KAFE, ATOLYE)),
    "Kahveci": Tur("kafe", bilet=0.7, hiz=1.3, muhatap=0.85, fikirler=(
        SADAKAT, ON_SIPARIS, ABONELIK,
        F("cekirdek_siparis", "Çekirdek tekrar siparişi",
          soru="Evine çekirdek alan müşteriler tekrar gelsin diye bir şey "
               "yapıyor musunuz?",
          aci="Çekirdek satışı bir kerelik kalıyor; tekrar alım internete "
              "kaçıyor.",
          yapar="Paket bitmeye yakın 'aynısından ayırayım mı?' mesajı; tek "
                "tuşla sipariş, kasada teslim.",
          para="Her ay bir paket çekirdek, her müşteride; hatırlatan alır.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
    )),
    "Çay evi": Tur("kafe", bilet=0.6, hiz=1.2, muhatap=0.9,
                   fikirler=(SADAKAT, ATOLYE._replace(ad="Oyun/kahvaltı etkinliği kaydı"),
                             YORUM_KAFE)),
    "Fırın/Pastane": Tur("kafe", bilet=0.8, hiz=1.2, muhatap=0.7,
                         fikirler=(PASTA_SIPARIS, BAYRAM, SABAH_TAZE,
                                   SADAKAT._replace(demo=False), YORUM_KAFE)),
    "Tatlıcı": Tur("kafe", bilet=0.7, hiz=1.2, muhatap=0.8, fikirler=(
        PASTA_SIPARIS._replace(kod="kutu_siparis", ad="Hediye kutusu sipariş formu",
                               soru="Hediye kutusu siparişlerinde adres ve "
                                    "teslim saatini nasıl alıyorsunuz?"),
        BAYRAM, SADAKAT._replace(demo=False), YORUM_KAFE,
    )),
    "Dondurmacı": Tur("kafe", bilet=0.6, hiz=1.3, muhatap=0.9, fikirler=(
        SADAKAT,
        F("mevsim_duyuru", "Sezon ve lezzet duyurusu",
          soru="Yeni ürün çıktığında müdavimlere nasıl haber veriyorsunuz?",
          aci="Yeni ürün Instagram'da kayboluyor; sezon açılışını kimse "
              "duymuyor.",
          yapar="İzinli listeye 'bu hafta yeni: …' tek mesaj; sezon açılış ve "
                "kapanış otomatik duyurulur.",
          para="Duyuruyu gören müdavim o hafta gelir.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
        YORUM_KAFE,
    )),
    "Smoothie & meyve suyu": Tur("kafe", bilet=0.6, hiz=1.3, muhatap=0.9, fikirler=(
        ABONELIK._replace(kod="detoks_paket", ad="Detoks/haftalık paket aboneliği",
                          soru="Haftalık paket alan müşterilerin devamını nasıl "
                               "takip ediyorsunuz?", demo=True),
        ON_SIPARIS, SADAKAT._replace(demo=False),
    )),
}
