"""Grup: perakende — mobilya, tekstil, antika, galeri, kuyumcu, giyim, ayakkabı,
çiçek, kitap, kozmetik, oyuncak, bisiklet, müzik aleti, spor, halı, aydınlatma,
mutfak-banyo.

Ortak gerçek: para "VAR MI / GELDİ Mİ / HAZIR MI" TELEFONUNDA kaybolur;
cevap alamayan müşteri internetten alır. Patron çoğunlukla dükkânda.
Fiyat bantları ÖNERİDİR (offer.md'ye işlenmedi).
"""

from services.radar.fikirler._tip import F, Tur

# ------------------------------------------------------------ ortak fikirler
STOK_SORGU = F(
    "stok_sorgu", "'Var mı?' asistanı",
    soru="'Şu üründen var mı' diye soranlara şu an nasıl cevap veriyorsunuz?",
    soru2="Yoğun saatte telefona bakacak biri oluyor mu?",
    aci="Aynı soru gün boyu telefonda; cevap alamayan müşteri internetten "
        "alıyor.",
    yapar="WhatsApp'a ürün/beden yazan anında cevap alır; 'ayırın' derse "
          "kasaya not düşer.",
    para="Cevap alan müşteri dükkâna gelir; alamayan internete gider.",
    kurulum="8-12k", aylik="500-800", zorluk=2, demo=True,
)
GELDI_BILDIRIM = F(
    "geldi_bildirim", "'Geldi' bildirimi",
    soru="Beklenen ürün geldiğinde müşteriye haber veriyor musunuz?",
    aci="Beklenen ürün gelince kimse haber vermiyor; müşteri başka yerden "
        "alıyor.",
    yapar="Müşteri ürünü 'haber ver' listesine ekler; stok girince otomatik "
          "mesaj, 'ayırın' cevabı kasaya düşer.",
    para="Bekleyen müşteri, haber alan ilk yerden alır.",
    kurulum="4-6k", aylik="250-400", zorluk=1,
)
SIPARIS_DURUM = F(
    "siparis_durum", "Sipariş durum bildirimi",
    soru="Siparişin hangi aşamada olduğunu müşteriye nasıl bildiriyorsunuz?",
    soru2="Müşteri merak edip aradığında kim cevap veriyor?",
    aci="Üretim/tedarik süreci müşteriye görünmüyor; her arama iş kesintisi.",
    yapar="Sipariş aşaması değişince (üretimde / yolda / teslime hazır) "
          "otomatik mesaj; teslimat saati müşteri seçer.",
    para="Aramayan müşteri memnun müşteridir; kesilmeyen saat satış "
         "saatidir.",
    kurulum="8-12k", aylik="500-800", zorluk=2, demo=True,
)
OLCU_KESIF = F(
    "olcu_kesif", "Ölçü/keşif randevusu + ön form",
    soru="Ölçüye gitmeden önce bütçe ve kapsamı konuşuyor musunuz?",
    aci="Bütçesi uymayan müşteriye keşfe gidiliyor; yarım gün yanıyor.",
    yapar="Randevu alınırken m², bütçe bandı, fotoğraf; uygun olmayan iş "
          "nazikçe elenir.",
    para="Kapsamı önceden konuşmak keşfi verimli kılar.",
    kurulum="6-9k", aylik="400-600", zorluk=1,
)
KATALOG = F(
    "whatsapp_katalog", "WhatsApp kataloğu + fiyat sorgusu",
    soru="Ürün ve fiyat bilgisini soranlara nasıl gönderiyorsunuz?",
    aci="Katalog her seferinde elle atılıyor; fiyat sürümü karışıyor.",
    yapar="Güncel katalog tek linkte; 'fiyat' yazan otomatik alır, 'ayırın' "
          "kasaya düşer.",
    para="Hızlı cevap alan müşteri ilk cevap verenden alır.",
    kurulum="5-8k", aylik="300-500", zorluk=1,
)
YENI_KOLEKSIYON = F(
    "yeni_koleksiyon", "İzinli yeni ürün duyurusu",
    soru="Yeni ürün geldiğinde düzenli müşterilere haber veriyor musunuz?",
    aci="Yeni ürün Instagram'da kayboluyor; sadık müşteri geç öğreniyor.",
    yapar="Rıza alınmış müşteri listesine 'yeni geldi' tek mesaj (İYS kaydı "
          "otomatik); 'ayırın' cevabı kasaya düşer.",
    para="İlk hafta satılan koleksiyon, sezon sonu indirime kalmaz.",
    kurulum="6-9k", aylik="400-600", zorluk=2,
)
SADAKAT = F(
    "sadakat", "Telefon numaralı sadakat",
    soru="Düzenli müşterilerinizi takip ediyor musunuz?",
    aci="Düzenli müşterinin bir süredir gelmediği fark edilmeyebiliyor.",
    yapar="Telefonla puan sayacı; belli alışverişte hediye, uzun süre "
          "gelmeyene hatırlatma.",
    para="Var olan müşteriyle iletişimi sürdürmek en kolay yol.",
    kurulum="4-6k", aylik="250-400", zorluk=1,
)
TAMIR_HAZIR = F(
    "tamir_hazir", "'Tamiriniz hazır' bildirimi",
    soru="Tamir bitince müşteriye nasıl haber veriyorsunuz?",
    aci="Hazır ürün rafta bekliyor; müşteri aranıyor, ulaşılamıyor.",
    yapar="'Hazır' işaretlenince fotoğraflı WhatsApp; müşteri teslim "
          "saatini seçer.",
    para="Hazır iş daha çabuk teslim edilir, raf boşalır.",
    kurulum="4-6k", aylik="250-400", zorluk=1, demo=True,
)
OZEL_GUN = F(
    "ozel_gun", "Özel gün hatırlatması",
    soru="Özel gün alışverişi yapan müşterileri not ediyor musunuz?",
    aci="Özel gün müşterisi bir kez geliyor; ertesi yıl hatırlatan yer "
        "kazanıyor.",
    yapar="Alışveriş notundaki özel gün 11 ay sonra nazik bir hatırlatma "
          "olur, kendi kataloğunuzun linkiyle.",
    para="Yılda bir garanti satış, her özel gün müşterisinden.",
    kurulum="5-8k", aylik="300-500", zorluk=1, demo=True,
)
KOLEKSIYONER = F(
    "koleksiyoner_liste", "Yeni parça duyurusu (koleksiyoner listesi)",
    soru="Yeni parça geldiğinde ilgilenen müşterilere nasıl ulaşıyorsunuz?",
    soru2="Kimin neyi aradığını bir yerde tutuyor musunuz?",
    aci="Doğru parça doğru alıcıya geç ulaşıyor; parça bekliyor.",
    yapar="İlgi alanına göre izinli liste; yeni parça girince uyan "
          "alıcılara fotoğraflı mesaj.",
    para="İlk gören alıcı ilk teklifi verir.",
    kurulum="6-9k", aylik="400-600", zorluk=2, demo=True,
)

CICEK_SIPARIS = F(
    "cicek_siparis", "WhatsApp sipariş + teslimat takibi",
    soru="Siparişi ve teslimatı müşteriyle nasıl takip ediyorsunuz?",
    aci="Sipariş telefonla, kart notu yanlış, teslimat belirsiz.",
    yapar="Sipariş formu (adres, not, saat); yola çıkınca ve teslimde otomatik "
          "mesaj.",
    para="Doğru not ve zamanında teslim işin kalitesini belli eder.",
    kurulum="6-9k", aylik="400-600", zorluk=2,
)

# ------------------------------------------------------------------ türler
_GIYIM = (STOK_SORGU, YENI_KOLEKSIYON, GELDI_BILDIRIM, SADAKAT)
_MOBILYA = (SIPARIS_DURUM, OLCU_KESIF, KATALOG)
_HEDIYE = (OZEL_GUN, KATALOG,
           F("kurumsal_siparis", "Kurumsal/toplu sipariş formu",
             soru="Toplu/kurumsal siparişlerde adres listesini nasıl "
                  "alıyorsunuz?",
             aci="Toplu sipariş telefonla alınıyor; adres ve not karışıyor.",
             yapar="Tek formda adet, adres listesi, not; üretim ve teslim listesi "
                   "otomatik.",
             para="Bir kurumsal müşteri, yılda iki bayramdır.",
             kurulum="5-8k", aylik="300-500", zorluk=1))

TURLER: dict[str, Tur] = {
    "Mobilyacı": Tur("perakende", bilet=1.1, hiz=1.0, muhatap=0.8, fikirler=(
        *_MOBILYA,
        F("teslimat_randevu", "Teslimat/montaj randevusu",
          soru="Teslimat gününü ve saatini müşteriyle nasıl ayarlıyorsunuz?",
          aci="Teslimat saati telefonla ayarlanıyor; evde kimse yokken "
              "gidiliyor.",
          yapar="Müşteri uygun günü seçer; montaj ekibi yola çıkınca mesaj.",
          para="Boş gidilen bir teslimat, aracın ve ekibin yarım günüdür.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
    )),
    "Ev tekstili/dekorasyon": Tur("perakende", bilet=0.8, hiz=1.1, muhatap=0.8,
                                  fikirler=(KATALOG._replace(demo=True), YENI_KOLEKSIYON, SADAKAT)),
    "Antikacı": Tur("perakende", bilet=1.0, hiz=1.0, muhatap=0.9, fikirler=(
        KOLEKSIYONER, KATALOG,
        F("eser_sorgu", "Fotoğrafla 'alır mısınız?' formu",
          soru="Satmak isteyenler size nasıl ulaşıyor, parçayı nasıl "
               "görüyorsunuz?",
          aci="Telefonla tarif edilen parça anlaşılmıyor; dükkâna getirilip "
              "geri götürülüyor.",
          yapar="Satıcı fotoğraf + ölçü yükler; siz 'ilgileniyorum / hayır' "
                "der, randevu linkle.",
          para="Görmeden 'gel' denen parça, boşa geçen saattir.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
    )),
    "Sanat galerisi": Tur("perakende", bilet=1.2, hiz=0.9, muhatap=0.9, fikirler=(
        KOLEKSIYONER._replace(ad="Yeni eser duyurusu"),
        F("sergi_rsvp", "Sergi açılışı davet + kayıt",
          soru="Sergi açılışını ilgilenenlere nasıl duyuruyorsunuz?",
          aci="Davet Instagram'da kayboluyor; açılış kalabalığı tahmin "
              "edilemiyor.",
          yapar="İzinli listeye davet; kayıt formu; bir gün önce hatırlatma.",
          para="Dolu açılış, satılan eserdir.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
        KATALOG._replace(ad="Eser kataloğu + fiyat sorgusu"),
    )),
    "El sanatları atölyesi": Tur("perakende", bilet=0.8, hiz=1.2, muhatap=0.95, fikirler=(
        F("atolye_kayit", "Atölye kaydı + kapora",
          soru="Atölye kaydını nasıl alıyorsunuz, yeri garantiliyor musunuz?",
          aci="Kontenjan 'geliyorum'la doluyor; malzeme alınıyor, koltuk boş "
              "kalıyor.",
          yapar="Etkinlik takvimi + kayıt; işletmenin kendi ödeme linkiyle "
                "kapora, hatırlatma otomatik.",
          para="Kaporalı koltuk boş kalmaz; malzeme fire olmaz.",
          kurulum="5-8k", aylik="300-500", zorluk=1, demo=True),
        KATALOG, SIPARIS_DURUM._replace(demo=False, ad="Özel sipariş formu + durum"),
    )),
    "Kuyumcu": Tur("perakende", bilet=1.2, hiz=1.0, muhatap=0.85, fikirler=(
        TAMIR_HAZIR, OZEL_GUN._replace(demo=False),
        F("altin_fiyat", "Günlük fiyat sorgusu",
          soru="Günlük fiyat soranlara nasıl cevap veriyorsunuz?",
          aci="Fiyat sorusu gün boyu telefonu meşgul ediyor.",
          yapar="Sabah girdiğiniz günlük fiyat; WhatsApp'a 'fiyat' yazan "
                "anında alır.",
          para="Meşgul olmayan telefon, dükkândaki müşteriye ayrılan "
               "dakikadır.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
        KATALOG,
    )),
    "Saatçi": Tur("perakende", bilet=0.9, hiz=1.1, muhatap=0.95, fikirler=(
        TAMIR_HAZIR,
        F("pil_hatirlatma", "Pil/bakım hatırlatması",
          soru="Pil ve bakım zamanı gelen müşterilere hatırlatma yapıyor "
               "musunuz?",
          aci="Pil ve bakım tekrarı takip edilmiyor.",
          yapar="Her işlemden sonra doğru zamanda 'zamanı geldi' mesajı.",
          para="Tekrar gelen müşteri, yeni saat alan müşteridir.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
        KATALOG,
    )),
    "Giyim mağazası": Tur("perakende", bilet=0.8, hiz=1.1, muhatap=0.8, fikirler=_GIYIM),
    "Kadın giyim": Tur("perakende", bilet=0.8, hiz=1.1, muhatap=0.85, fikirler=_GIYIM),
    "Erkek giyim": Tur("perakende", bilet=0.8, hiz=1.1, muhatap=0.85, fikirler=_GIYIM),
    "Çocuk giyim": Tur("perakende", bilet=0.7, hiz=1.1, muhatap=0.85, fikirler=(
        *_GIYIM[:3],
        F("beden_buyudu", "'Beden büyüdü' hatırlatması",
          soru="Çocuk büyüdükçe ailelere yeni beden için haber veriyor musunuz?",
          aci="Çocuk büyüyor, alışveriş internete kaçıyor.",
          yapar="Alışveriş notuna göre 6 ay sonra 'yeni beden geldi' mesajı.",
          para="Her 6 ayda bir garanti ziyaret.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
    )),
    "Ayakkabıcı": Tur("perakende", bilet=0.8, hiz=1.1, muhatap=0.85, fikirler=_GIYIM[:3]),
    "Deri ürünleri": Tur("perakende", bilet=0.9, hiz=1.1, muhatap=0.9,
                         fikirler=(KATALOG._replace(demo=True), TAMIR_HAZIR._replace(demo=False),
                                   YENI_KOLEKSIYON)),
    "Çiçekçi & hediyelik": Tur("perakende", bilet=0.8, hiz=1.3, muhatap=0.9, fikirler=(
        OZEL_GUN, CICEK_SIPARIS,
        F("ofis_abonelik", "Haftalık ofis çiçeği aboneliği",
          soru="Ofislere düzenli çiçek veriyor musunuz, nasıl yürüyor?",
          aci="Ofis çiçeği düzensiz; her hafta yeniden satılıyor.",
          yapar="Haftalık abonelik, otomatik hatırlatma ve fatura.",
          para="Abonelik, her hafta garanti sipariştir.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
        KATALOG,
    )),
    "Çiçekçi": Tur("perakende", bilet=0.8, hiz=1.3, muhatap=0.9, fikirler=(
        OZEL_GUN, CICEK_SIPARIS, KATALOG,
    )),
    "Hediyelik eşya": Tur("perakende", bilet=0.7, hiz=1.2, muhatap=0.9, fikirler=_HEDIYE),
    "Kitapçı": Tur("perakende", bilet=0.7, hiz=1.1, muhatap=0.9, fikirler=(
        GELDI_BILDIRIM._replace(demo=True, ad="Sipariş kitap 'geldi' bildirimi",
                                soru="Sipariş edilen kitap gelince okura nasıl "
                                     "haber veriyorsunuz?"),
        F("okur_kulubu", "Okur kulübü / imza günü kaydı",
          soru="Etkinlik ve imza günlerini okurlara nasıl duyuruyorsunuz?",
          aci="Etkinlik Instagram'da kayboluyor.",
          yapar="İzinli listeye etkinlik duyurusu + kayıt.",
          para="Etkinliğe gelen okur, o gün kitap alır.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
        STOK_SORGU._replace(demo=False),
    )),
    "Kozmetik mağazası": Tur("perakende", bilet=0.8, hiz=1.2, muhatap=0.85, fikirler=(
        SADAKAT._replace(demo=True), STOK_SORGU._replace(demo=False),
        F("urun_bitis", "Ürün bitiş hatırlatması",
          soru="Ürünü biten müşteriye hatırlatma yapıyor musunuz?",
          aci="Tekrar alım internete kaçıyor.",
          yapar="Ürün tipine göre bitiş zamanında 'yenisini ayırayım mı?' "
                "mesajı.",
          para="Her iki ayda bir garanti satış.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
        YENI_KOLEKSIYON._replace(ad="Yeni ürün duyurusu"),
    )),
    "Oyuncakçı": Tur("perakende", bilet=0.7, hiz=1.2, muhatap=0.9, fikirler=(
        OZEL_GUN._replace(ad="Çocuk doğum günü hatırlatması",
                          soru="Doğum günü alışverişi yapan aileleri not ediyor "
                               "musunuz?"),
        GELDI_BILDIRIM, KATALOG,
    )),
    "Bisikletçi": Tur("perakende", bilet=0.9, hiz=1.2, muhatap=0.95, fikirler=(
        TAMIR_HAZIR._replace(ad="'Bisikletiniz hazır' bildirimi"),
        F("bakim_hatirlatma_bisiklet", "Sezon bakımı hatırlatması",
          soru="Sezon bakımı için müşterilere hatırlatma yapıyor musunuz?",
          aci="Sezon bakımı hatırlatılmıyor.",
          yapar="Mart ve eylülde 'bakım zamanı' mesajı + randevu.",
          para="Bakım, tekrarlayan gelirdir.",
          kurulum="4-6k", aylik="250-400", zorluk=1),
        STOK_SORGU._replace(demo=False),
    )),
    "Müzik aletleri": Tur("perakende", bilet=0.9, hiz=1.1, muhatap=0.9, fikirler=(
        TAMIR_HAZIR._replace(ad="'Enstrümanınız hazır' bildirimi"),
        F("kiralama_takip", "Enstrüman kiralama takibi",
          soru="Kiralık enstrümanların süresini nasıl takip ediyorsunuz?",
          aci="Kiralama defterde; süre geçen enstrüman geri gelmiyor.",
          yapar="Kira bitişinden önce hatırlatma; uzat/satın al seçeneği.",
          para="Geri dönen enstrüman, bir sonraki kiralamadır.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
        STOK_SORGU._replace(demo=False),
    )),
    "Spor mağazası": Tur("perakende", bilet=0.8, hiz=1.1, muhatap=0.8, fikirler=(
        STOK_SORGU, YENI_KOLEKSIYON,
        F("takim_siparis", "Takım/toplu forma sipariş formu",
          soru="Toplu forma siparişlerinde beden ve isim listesini nasıl "
               "topluyorsunuz?",
          aci="Toplu sipariş telefonla; beden ve isim karışıyor.",
          yapar="Tek formda beden/isim listesi; üretim listesi otomatik.",
          para="Bir okul, her sezon bir sipariştir.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
    )),
    "Halıcı": Tur("perakende", bilet=0.9, hiz=1.1, muhatap=0.9, fikirler=(
        TAMIR_HAZIR._replace(kod="yikama_hazir", ad="'Halınız hazır' bildirimi",
                             soru="Yıkama bitince müşteriye nasıl haber "
                                  "veriyorsunuz?"),
        OLCU_KESIF._replace(ad="Ölçü randevusu + ön form"), KATALOG,
    )),
    "Aydınlatma mağazası": Tur("perakende", bilet=1.0, hiz=1.0, muhatap=0.85,
                               fikirler=(OLCU_KESIF._replace(demo=True), KATALOG,
                                         SIPARIS_DURUM._replace(demo=False))),
    "Mutfak & banyo": Tur("perakende", bilet=1.2, hiz=0.9, muhatap=0.8, fikirler=(
        OLCU_KESIF._replace(demo=True), SIPARIS_DURUM._replace(demo=False),
        F("montaj_takvim", "Montaj takvimi bilgilendirmesi",
          soru="Montaj gününü ve saatini müşteriyle nasıl ayarlıyorsunuz?",
          aci="Montaj saati telefonla; ekip beklerken müşteri evde yok.",
          yapar="Montaj günü seçimi; ekip yola çıkınca mesaj.",
          para="Boş gidilen montaj, ekibin yarım günüdür.",
          kurulum="5-8k", aylik="300-500", zorluk=1),
    )),
}
