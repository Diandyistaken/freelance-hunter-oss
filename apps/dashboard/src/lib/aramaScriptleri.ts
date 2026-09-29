// Arama Script'leri — telefonla küçük işletmelere site satışı için konuşma ağacı.
// Kaynak doküman: docs/arama-scriptleri.md (bu dosya panelin tek doğ­ruluk kaynağıdır).
// Amaç her aramada aynı: fiyat pazarlığı DEĞİL → 10 dk yüz yüze demo randevusu
// veya WhatsApp'a canlı link atma izni.

export interface AltinKural {
  no: number;
  metin: string;
}

export interface AgacDal {
  // Karşı tarafın tepkisi (dalın etiketi)
  durum: string;
  ton: "olumlu" | "notr" | "itiraz" | "yonlendirme";
  // Ne yapacağın / ne diyeceğin (adım adım)
  hamleler: string[];
}

export interface Itiraz {
  itiraz: string;
  cevap: string;
  // Hangi psikolojik ilkeye dayanıyor (araştırma tabanlı)
  ilke?: string;
}

export interface Kapanis {
  baslik: string;
  metin: string;
}

export interface SektorModulu {
  emoji: string;
  ad: string;
  kanca: string;
  deger: string;
  sektorItirazi?: { itiraz: string; cevap: string };
  upsell?: string;
  not?: string;
  onerilenSablon?: string;
}

export type IknaKategori =
  | "Açılış & Kalıp Kırma"
  | "İtiraz Karşılama"
  | "Cialdini İlkeleri"
  | "Kapanış"
  | "Ses & Tempo";

export interface IknaTaktigi {
  ad: string;
  kategori: IknaKategori;
  ozet: string;
  neden: string; // psikolojik temel
  ornek: string; // Türkçe somut cümle
}

// Etik sınırı aşan, KULLANILMAMASI gereken taktikler (bilinçli uyarı listesi).
export interface Kacinilacak {
  ad: string;
  neden: string;
}

// ─────────────────────────────────────────────────────────────
// 0. ALTIN KURALLAR
// ─────────────────────────────────────────────────────────────
export const ALTIN_KURALLAR: AltinKural[] = [
  { no: 1, metin: "İlk 10 saniye: kim olduğun + neden aradığın + tek cümlelik fayda. Uzatma." },
  { no: 2, metin: '"Satıcı" değil "komşu esnaf çözümcüsü" tonu: yerel isim ver ("Maltepe\'denim").' },
  { no: 3, metin: "En güçlü silahın: site ZATEN hazır. Sen satmıyorsun, göstermek istiyorsun." },
  { no: 4, metin: 'Karşı taraf meşgulse ASLA ısrar etme → "Ne zaman müsait olursunuz?" ile randevuya çevir.' },
  { no: 5, metin: "Patron değilse patrona ulaşmayı hedefle; çalışana kısa mesaj bırak + WhatsApp al." },
  { no: 6, metin: "Her arama sonunda kayıt: sonuç (randevu/ret/takip), tarih, not → takip 2 gün sonra." },
  { no: 7, metin: 'İki kez "hayır" dediyse teşekkür et, kapat. Üçüncü ısrar marka yakar.' },
];

// ─────────────────────────────────────────────────────────────
// 1. ORTAK OMURGA — KARAR AĞACI
// ─────────────────────────────────────────────────────────────
export const ACILIS_METNI =
  "Merhaba, ben Muhammed, Maltepe'den. [İşletme adı] ile mi görüşüyorum? " +
  "İşletmenizi Google Haritalar'da gördüm, web siteniz olmadığını fark ettim. " +
  "Sizin için ÖRNEK bir site hazırladım bile — telefonunuza link atsam 30 saniyede bakar mısınız?";

export const KARAR_AGACI: AgacDal[] = [
  {
    durum: '"Olur, at bakayım"',
    ton: "olumlu",
    hamleler: [
      "WhatsApp numarasını teyit et, HEMEN canlı linki + tek satır mesaj at.",
      '"Baktığınızda ne düşündüğünüzü çok merak ediyorum, yarın kısaca arayabilir miyim?" → TAKİP RANDEVUSU al, saat söylet.',
      "Yarın ara → beğendiyse → YÜZ YÜZE 10 dk randevu → kapanışa git.",
    ],
  },
  {
    durum: '"Kimsiniz, ne satıyorsunuz?"',
    ton: "notr",
    hamleler: [
      '"Satış için aramadım, hazır bir şey göstermek için aradım. Çevredeki işletmelere site yapıyorum; sizinkini de örnek olarak hazırladım. Beğenmezseniz siler geçerim, 30 saniyenizi alır."',
      "Tekrar link teklifi yap → EVET/HAYIR dallarına dön.",
    ],
  },
  {
    durum: '"Şu an meşgulüm"',
    ton: "yonlendirme",
    hamleler: [
      '"Tabii ki, ne zaman müsait olursunuz? Yarın öğlen mi, akşam üstü mü?" — İKİ SEÇENEK ver, boş "sonra ara" alma.',
      "Saati not et, tam o saatte ara.",
    ],
  },
  {
    durum: '"İhtiyacım yok"',
    ton: "itiraz",
    hamleler: [
      "İtiraz kütüphanesinden sektöre uyanı seç, TEK deneme yap.",
      'Hâlâ hayır → "Anlıyorum. Linki yine de atayım, belki bir gün lazım olur. Hayırlı işler!" → nazik kapat, 3 hafta sonrasına not düş.',
    ],
  },
  {
    durum: '"Patron yok / ben çalışanım"',
    ton: "yonlendirme",
    hamleler: [
      '"Sorun değil. Patronunuza iletmek için bir WhatsApp alabilir miyim, ya da ne zaman burada olur? Kendisine hazır örneği göstereceğim sadece."',
      "Saat/numara al → o saatte tekrar ara.",
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 2. İTİRAZ KÜTÜPHANESİ
// ─────────────────────────────────────────────────────────────
export const ITIRAZ_KUTUPHANESI: Itiraz[] = [
  {
    itiraz: '"Instagram\'ım var, yetiyor"',
    cevap:
      "Instagram çok iyi, devam edin. Ama Google'da 'Altıntepe [sektör]' arayan müşteri Instagram'ı görmüyor, rakibinizin sitesini görüyor. Site + Instagram birlikte çalışır — sitenize Instagram'ınızı da bağlıyorum.",
    ilke: "Yes-and (onayla, sonra genişlet)",
  },
  {
    itiraz: '"Pahalıdır bunlar"',
    cevap:
      "En pahalısını zaten yaptım ve bedavaydı: örnek siteniz hazır. Beğenirseniz rakam konuşuruz, çoğu müşterim 'bu kadar mıymış' diyor. Önce bir bakın isterseniz?",
    ilke: "Reciprocity (önce ver)",
  },
  {
    itiraz: '"Yeğenim/oğlum yapacaktı"',
    cevap:
      "Süper, başlamış mı? (genelde: hayır) Bakın ben hazırladım bile — yeğeniniz beğenirse üstüne devam etsin, ben sadece örneği göstereyim.",
    ilke: "Takeaway (baskıyı kaldır)",
  },
  {
    itiraz: '"Düşüneyim"',
    cevap:
      "Tabii. Düşünürken elinizde somut bir şey olsun — linki atıyorum, eşinize/ortağınıza da gösterin. Cuma günü kısaca arayıp fikrinizi sorayım mı? (tarih bağla)",
    ilke: "Commitment (küçük söz al)",
  },
  {
    itiraz: '"Daha önce yaptırdım, para tuzağıydı"',
    cevap:
      "Haklısınız, bu sektörde kötü deneyim çok. O yüzden ben tersinden gidiyorum: önce siteyi görüyorsunuz, beğenmezseniz hiç konuşmuyoruz. Riskin tamamı bende.",
    ilke: "Risk tersleme + empati",
  },
  {
    itiraz: '"Google\'da zaten çıkıyoruz"',
    cevap:
      "Evet, harita kaydınız var, oradan buldum zaten. Ama tıklayınca gidecek yer yok — müşteri fiyat, menü, saat arıyor; bulamayınca rakibi arıyor. Site o tıkı satışa çevirir.",
    ilke: "Loss aversion (kaçan müşteri)",
  },
  {
    itiraz: '"Müşterim zaten yeterli"',
    cevap:
      "Ne güzel, maşallah. O zaman bunu satış için değil, itibar için düşünün: müşterileriniz sizi başkasına tavsiye ederken 'sitesine bak' diyebilsin. Yoğun işletmeye fiyat da ona göre kolay gelir.",
    ilke: "Reframe (itibar çerçevesi)",
  },
  {
    itiraz: '"İnternetten anlamam"',
    cevap:
      "Anlamanıza gerek kalmıyor, o benim işim. Siz sadece WhatsApp'tan gelen müşteriye bakacaksınız. Her şeyi kurulu teslim ediyorum, ayda bir ben kontrol ediyorum.",
    ilke: "Sürtünmeyi kaldır",
  },
];

// ─────────────────────────────────────────────────────────────
// 3. KAPANIŞ KALIPLARI
// ─────────────────────────────────────────────────────────────
export const KAPANIS_KALIPLARI: Kapanis[] = [
  {
    baslik: "Randevu kapanışı",
    metin:
      "Yarın 14:00 civarı 10 dakikalığına uğrayayım, telefonda değil yerinde göstereyim — çayınızı da içmiş olurum. Uygun mu?",
  },
  {
    baslik: "Fiyat sorulursa (telefonda)",
    metin:
      "Şablona ve isteklerinize göre değişiyor; [X–Y ₺] arası. Ama önce beğenmeniz lazım — yüz yüze 10 dakikada hem gösteririm hem netleştiririm.",
  },
  {
    baslik: "Onay kapanışı (yüz yüze, beğendi)",
    metin:
      "O zaman şöyle yapalım: bugün %50 ile başlıyorum, [gün] teslim. Fotoğraflarınızı WhatsApp'tan atın, gerisi bende. Alan adını da beraber 5 dakikada sizin adınıza alalım.",
  },
  {
    baslik: "Takip mesajı (2 gün sonra, WhatsApp)",
    metin:
      "Merhaba [isim] Bey/Hanım, geçen gün konuşmuştuk. Siteye bakabildiniz mi? Kafanıza takılan bir şey varsa buradayım. 🙂",
  },
];

// ─────────────────────────────────────────────────────────────
// 4. SEKTÖR MODÜLLERİ
// ─────────────────────────────────────────────────────────────
export const SEKTOR_MODULLERI: SektorModulu[] = [
  {
    emoji: "🍞",
    ad: "Fırın / Pastane",
    kanca:
      "Sabah 6'da açıyorsunuz ama Google'da sizi arayan 'açık mı, sıcak ekmek var mı' bilemiyor. Sitenize saatler + günlük ürünler koydum bile.",
    deger:
      "Pasta siparişi WhatsApp'tan gelir → 'Doğum günü pastası arayan Instagram'da değil Google'da Altıntepe pastane yazıyor.'",
    sektorItirazi: {
      itiraz: '"Mahalle bizi zaten bilir"',
      cevap: "Mahalle bilir ama yeni taşınan bilmez; Altıntepe'ye her ay yüzlerce yeni aile taşınıyor.",
    },
    upsell: "Özel gün siparişi formu / WhatsApp katalog.",
  },
  {
    emoji: "☕",
    ad: "Kafe / Kıraathane",
    kanca:
      "Yanınızdan geçen öğrenci/çalışan 'oturacak yer' ararken Google'a bakıyor; fotoğraflı siteniz olmayınca zincir kafelere gidiyor.",
    deger: "Mekân fotoğrafları + menü + konum tek linkte.",
    sektorItirazi: {
      itiraz: '"Müşterim mahalleden"',
      cevap: "İtibar hamlesi: müşteriniz sizi tavsiye ederken paylaşacak bir linki olsun.",
    },
    upsell: "QR menü — 'Masaya karekod koyalım, menü değişince ben güncelliyorum, baskı masrafı biter.'",
  },
  {
    emoji: "🍺",
    ad: "Bar / Gastropub",
    kanca:
      "Cuma akşamı 'Kadıköy bar' arayan turist ve gençler sizi bulamıyor; rakip mekânın etkinlik sayfası çıkıyor.",
    deger: "Etkinlik/canlı müzik takvimi + gece fotoğrafları + Instagram entegre.",
    sektorItirazi: {
      itiraz: '"Bizim kitle Instagram\'da"',
      cevap:
        "Doğru, ama Google Haritalar'da 'yakınımdaki bar' araması her hafta binlerce; oradan gelen müşteri daha kararlı — kapıya kadar geliyor.",
    },
    upsell: "Etkinlik duyuru güncellemeleri = aylık bakım paketi.",
    onerilenSablon: "neon",
  },
  {
    emoji: "✂️",
    ad: "Berber / Kuaför / Güzellik",
    kanca:
      "Müşterileriniz saat sormak için sizi telefonla meşgul ediyor; sitede saatler + WhatsApp randevu olsa telefonunuz susar, koltuk dolar.",
    deger: "Önce/sonra galerisi güven verir; yeni taşınanlar 'yakınımdaki kuaför' arar.",
    sektorItirazi: {
      itiraz: '"Randevuyu telefonla alıyorum zaten"',
      cevap: "Aynen devam; site telefon çaldırmak için var. Gece 23:00'te bakan müşteri sabah ilk sizi arıyor.",
    },
    upsell: "WhatsApp randevu botu.",
  },
  {
    emoji: "🏥",
    ad: "Klinik / Tıp Merkezi / Diş",
    kanca:
      "Hastalarınız sizi Google'da arıyor; siteniz olmayınca güven soru işareti oluşuyor. Branşlar, hekim kadrosu ve randevu iletişimini içeren örnek hazırladım.",
    deger: "Güven + profesyonellik; 'vitrin' veya 'zarif' şablonla demo üret.",
    sektorItirazi: {
      itiraz: '"Kurumsal anlaşmalarımız var, hastamız hazır"',
      cevap: "O yüzden zaten itibar sitesi bu; hasta kliniği araştırmadan gelmiyor, emin olmak istiyor.",
    },
    not: "Ton: esnaf muhabbeti YOK — kurumsal ve kısa. Sağlıkta reklam mevzuatı hassas: iddialı tedavi vaadi YAZMA, bilgilendirme dilinde tut. Mesul müdür/işletme sahibiyle görüş.",
    onerilenSablon: "zarif",
  },
  {
    emoji: "🐾",
    ad: "Pet Shop",
    kanca:
      "'Yakınımda pet shop' araması her gün yapılıyor; mama markası stok soranlar telefonu meşgul ediyor — sitede marka listesi olsa direkt geliyorlar.",
    deger: "Ürün kategorileri + WhatsApp sipariş; sevimli galeri = kolay beğeni.",
    upsell: "WhatsApp katalog + aylık ürün güncelleme.",
  },
  {
    emoji: "💍",
    ad: "Kuyumcu",
    kanca:
      "Alyans ve yatırım altını arayan çift önce internete bakıyor; vitrininiz Google'da görünmüyor. Ürün vitrinli örnek bir site hazırladım.",
    deger: "Vitrin galerisi + konum + 'güven veren' kurumsal görünüm.",
    sektorItirazi: {
      itiraz: '"Fiyatlar anlık değişiyor, siteye yazılmaz"',
      cevap: "Fiyat yazmıyoruz zaten — vitrin ve iletişim var; 'fiyat için arayın' butonu telefonunuzu çaldırıyor.",
    },
    not: "Ton: güven her şey. Kısa, ciddi, saygılı.",
    onerilenSablon: "zarif",
  },
  {
    emoji: "✈️",
    ad: "Seyahat Acentesi",
    kanca:
      "Tur arayan müşteri 3 acente karşılaştırıyor; siteniz yoksa listeden ilk siz eleniyorsunuz. Turlarınızı ve TÜRSAB bilginizi koyduğum örnek hazır.",
    deger: "Tur/kampanya vitrini + güven (belge no) + WhatsApp rezervasyon.",
    upsell: "Kampanya güncellemeleri = bakım paketi (ayda 2 içerik değişimi).",
  },
  {
    emoji: "🔧",
    ad: "Atölye / Tamirci",
    kanca:
      "Arabası/telefonu bozulan ne yapıyor? 'Yakınımda tamirci' yazıyor. Orada çıkmıyorsanız o müşteri sanayiye gidiyor.",
    deger: "Hizmet listesi + 'hemen ara' butonu; acil müşteri için hız her şey.",
    sektorItirazi: {
      itiraz: '"Benim işim ağızdan ağıza"',
      cevap: "O müşteri de gelmeden önce ismini Google'a yazıyor — çıkmazsanız tavsiye yarım kalıyor.",
    },
  },
  {
    emoji: "🏋️",
    ad: "Spor Salonu / Stüdyo",
    kanca:
      "Ocak ve Eylül'de 'yakınımda spor salonu' aramaları patlıyor; fiyat ve ders programı sitede olmayınca DM'de kayboluyorsunuz.",
    deger: "Program + üyelik tipleri + salon fotoğrafları + deneme dersi CTA.",
    upsell: "Üyelik kampanya duyuruları (bakım paketi).",
  },
];

// ─────────────────────────────────────────────────────────────
// 5. İKNA TAKTİKLERİ (araştırma tabanlı) — arama sırasında sırt çantası
//    Kaynaklar: Cialdini (6 ikna ilkesi), Chris Voss / Never Split the
//    Difference (mirror, label, kalibre soru), Gong soğuk arama analizi,
//    HubSpot/Close.com kapanış teknikleri. Hepsi GERÇEK değere dayalı.
// ─────────────────────────────────────────────────────────────
export const IKNA_TAKTIKLERI: IknaTaktigi[] = [
  // ── Açılış & Kalıp Kırma ──
  {
    ad: '"Nasılsın?" açılışı',
    kategori: "Açılış & Kalıp Kırma",
    ozet: "Satış selamı yerine tanıdık biriymişsin gibi sıcak, gündelik bir soru sor.",
    neden:
      "Gong'un 90 bin+ arama analizinde bu açılış ortalamanın ~6,6 katı randevu yakalamış — kişi seni tanımaya çalışırken ret refleksi devreye girmiyor.",
    ornek: "Selam [isim] abi, nasılsın bakalım, işler nasıl gidiyor bu aralar?",
  },
  {
    ad: "Dürüst itiraf açılışı",
    kategori: "Açılış & Kalıp Kırma",
    ozet: "Soğuk arama olduğunu açıkça söyle, kapatma hakkını tanı, 20-30 saniye iste.",
    neden: "Bir satışçının 'bu soğuk bir arama' demesini kimse beklemez; bu dürüstlük savunmayı kırar, güven verir.",
    ornek:
      "[İsim] abi dürüst olayım, tanışmıyoruz, hiç beklemediğin bir arama bu — 20 saniye alabilir miyim, sonra sen karar ver?",
  },
  {
    ad: 'Sebep bildiren açılış ("çünkü")',
    kategori: "Açılış & Kalıp Kırma",
    ozet: "Neden aradığını hemen, net bir sebeple söyle.",
    neden: "Bir talebe gerekçe eklemek kabul oranını belirgin artırır (Langer'in 'çünkü' deneyi, Cialdini).",
    ornek:
      "Sizi aradım çünkü mahalledeki 3 kuyumcuyu Google'da aradım, ikisi ilk sayfada çıktı, sizinki çıkmadı — o yüzden 2 dakika konuşmak istedim.",
  },
  {
    ad: "İzin isteyen açılış",
    kategori: "Açılış & Kalıp Kırma",
    ozet: 'Konuşmadan önce izin sor ("2 dakikanı alabilir miyim?").',
    neden: "Küçük bir 'evet' kişiyi konuşmaya devam etme tutarlılığına sokar ve saygı hissettirir.",
    ornek: "Çok kısa tutacağım, 2 dakika ayırabilir misin, sonra istersen kapatırız.",
  },

  // ── İtiraz Karşılama ──
  {
    ad: "Feel-Felt-Found (Hisset-Hissetti-Buldu)",
    kategori: "İtiraz Karşılama",
    ozet: "Önce empati, sonra 'başkaları da böyle hissetti', sonra 'ama şunu buldular'.",
    neden: "Karşı çıkmadan önce doğrulama savunmayı düşürür; 'yalnız değilsin' hissi güven verir.",
    ornek:
      "Anlıyorum, fiyat ilk duyunca yüksek geliyor. Cadde'deki fırının sahibi de öyle düşünmüştü; 2 ay sonra internetten gelen siparişin masrafı kat kat çıkardığını gördü.",
  },
  {
    ad: 'Yes-And ("ama" değil "ve")',
    kategori: "İtiraz Karşılama",
    ozet: "İtirazı reddetme, kabul et, sonra 've' ile devam et.",
    neden: "'Ama' beyinde önceki cümleyi siler ve savunmaya iter; 've' akışı bozmaz, tartışma hissi yaratmaz.",
    ornek: "Haklısın, şu an vaktin çok kısıtlı — ve tam da bu yüzden 15 dakikalık hazır bir paket öneriyorum, sen uğraşmayacaksın.",
  },
  {
    ad: "Takeaway (geri çekme)",
    kategori: "İtiraz Karşılama",
    ozet: "Israr yerine teklifi nazikçe geri çek — 'belki şu an sırası değil.'",
    neden: "Kayıp kaçınması + reaktans: elinden alınan şeyin değeri artar, çoğu zaman 'dur biraz anlat' der.",
    ornek: "Anladım, sorun değil — belki şu an sırası değil, başka zaman ararım o zaman.",
  },
  {
    ad: "Kalibre soru (Chris Voss)",
    kategori: "İtiraz Karşılama",
    ozet: "'Neden' yerine 'ne / nasıl' ile açık uçlu soru sor.",
    neden: "'Neden' savunmaya iter; 'ne/nasıl' kişiyi kontrolde hissettirir ve gerçek engeli açığa çıkarır.",
    ornek: "Şu an seni bu işten alıkoyan en büyük şey ne — bütçe mi, zaman mı, yoksa daha önce kötü bir deneyim mi?",
  },
  {
    ad: "Etiketleme (Labeling)",
    kategori: "İtiraz Karşılama",
    ozet: "Karşı tarafın hissini adıyla söyle — 'sanki ... gibi görünüyor.'",
    neden: "Duygunun isimlendirilmesi kişiyi anlaşılmış hissettirir, savunma ihtiyacını azaltır.",
    ornek: "Sanki daha önce birine para verip pişman olmuşsun gibi bir ses tonun var — yanılıyor muyum?",
  },
  {
    ad: "Küçük evet (Foot-in-the-door)",
    kategori: "İtiraz Karşılama",
    ozet: "Büyük talep yerine kabul edilmesi kolay küçük bir adım iste.",
    neden: "Küçük taahhüde 'evet' diyen kişi, tutarlılık güdüsüyle büyük adıma da 'evet' der.",
    ornek:
      "Hemen bir şey satmıyorum; sadece dükkanının Google'da şu an nasıl göründüğünü 1 dakikalık ekran görüntüsüyle atsam, bakar mısın?",
  },

  // ── Cialdini İlkeleri ──
  {
    ad: "Karşılıklılık (Reciprocity)",
    kategori: "Cialdini İlkeleri",
    ozet: "Önce karşılıksız, somut bir değer ver — sonra iste.",
    neden: "İnsan bir şey aldığında karşılık verme borcu hisseder; evrensel sosyal norm.",
    ornek:
      "Aramadan önce Google Haritalar profiline baktım, üç ücretsiz düzeltilebilir hata buldum, hemen söyleyeyim — ister kullan ister kullanma, sana kalmış.",
  },
  {
    ad: "Sosyal kanıt (Social Proof)",
    kategori: "Cialdini İlkeleri",
    ozet: "Aynı semtteki / aynı sektördeki esnafın ne yaptığını somut örnekle anlat.",
    neden: "Belirsizlikte insanlar kendine benzeyenin davranışını referans alır; esnaf 'komşu ne yapıyor'a duyarlıdır.",
    ornek: "Geçen ay bu semtte iki berbere site yaptık, ikisi de randevu sistemine geçti, telefonla uğraşmaktan kurtuldular.",
  },
  {
    ad: "Otorite (Authority)",
    kategori: "Cialdini İlkeleri",
    ozet: "Uzmanlığı iddia etme, somut kanıtla göster (rakam, örnek iş).",
    neden: "İnsanlar uzman gördükleri kişinin sözünü daha az sorgular.",
    ornek: "Ben sadece esnaf siteleri yapıyorum, şu ana kadar 40'a yakın dükkana kurdum; size de aynı sistemi gösterebilirim.",
  },
  {
    ad: "Yakınlık (Liking)",
    kategori: "Cialdini İlkeleri",
    ozet: "Ortak nokta bul (aynı semt, ortak tanıdık) ve samimi konuş.",
    neden: "İnsanlar kendine benzeyen / sevdiği kişiye daha kolay 'evet' der.",
    ornek: "Ben de bu mahalleden büyüdüm, senin dükkanın önünden her gün geçerdim — o yüzden biraz da gönülden arıyorum.",
  },
  {
    ad: "Taahhüt & Tutarlılık",
    kategori: "Cialdini İlkeleri",
    ozet: "Küçük sözlü taahhüt al, sonra ona referansla ilerle.",
    neden: "İnsanlar verdikleri sözle tutarlı davranır; küçük 'evet'ler büyük 'evet'in kapısını açar.",
    ornek: "Demin 'internetten müşteri gelsin isterim' dedin — tam onun için arıyorum, o hedefe yönelik bir şey göstereyim mi?",
  },
  {
    ad: "Kıtlık (Scarcity) — dürüst",
    kategori: "Cialdini İlkeleri",
    ozet: "GERÇEK bir sınırı (kapasite, kampanya bitişi) açıkça söyle.",
    neden: "Kaybetme riski kazanma fırsatından psikolojik olarak daha güçlü hissedilir.",
    ornek: "Bu ay sadece 4 yeni müşteri alabiliyorum çünkü tasarımları tek başıma yapıyorum, 2 yer kaldı.",
  },

  // ── Kapanış ──
  {
    ad: "Varsayımsal kapanış",
    kategori: "Kapanış",
    ozet: "'İster misin?' yerine kabul edilmiş gibi sonraki adımı sor.",
    neden: "Beyni 'evet/hayır' eşiğinden 'nasıl' eşiğine taşır.",
    ornek: "Tasarımı bu hafta mı gönderelim, yoksa gelecek hafta mı senin için daha rahat?",
  },
  {
    ad: "Alternatif seçim kapanışı",
    kategori: "Kapanış",
    ozet: "İkisi de 'evet' anlamına gelen iki seçenek sun.",
    neden: "İki seçenek arasında seçmek 'evet/hayır'dan kolaydır; kişi kontrolde hisseder.",
    ornek: "Sana temel paketi mi göstereyim, yoksa randevu sistemi de olan paketi mi?",
  },
  {
    ad: "Deneme kapanışı (Trial Close)",
    kategori: "Kapanış",
    ozet: "Karar öncesi küçük onay sorusuyla nabız yokla.",
    neden: "Erken sinyal, itirazları büyümeden fark ettirir.",
    ornek: "Söylediklerim şu ana kadar mantıklı geliyor mu, yoksa bir şeyi mi atlıyorum?",
  },
  {
    ad: "Dürüst aciliyet kapanışı",
    kategori: "Kapanış",
    ozet: "GERÇEK bir zaman kısıtını netçe söyle (sezon, kampanya, kendi takvimin).",
    neden: "Ertelemenin somut bir bedeli görününce kararsızlık azalır.",
    ornek: "Ramazan öncesi sipariş almak istiyorsan tasarımın en geç önümüzdeki hafta başlaması lazım, yoksa bayrama yetişmez.",
  },
  {
    ad: "Özet kapanışı (Summary Close)",
    kategori: "Kapanış",
    ozet: "Konuşulanı kısaca özetle, sonra kararı sor.",
    neden: "Kişi kendi ihtiyacını kendi ağzından tekrar duyar, kendi mantığıyla ikna olur.",
    ornek:
      "Yani özetlersek: Google'da görünmüyorsun, komşun görünüyor, ve maliyeti ayda bir kahve parası kadar — bu şartlarda başlayalım mı?",
  },

  // ── Ses & Tempo ──
  {
    ad: "Stratejik sessizlik",
    kategori: "Ses & Tempo",
    ozet: "Fiyatı / güçlü cümleyi söyledikten sonra sus, boşluğu doldurma.",
    neden: "Sessizlik karşı tarafı doldurmaya iter; erken konuşan taraf avantajı kaybeder.",
    ornek: "Aylık 750 TL. … (sonra hiçbir şey söylemeden bekle)",
  },
  {
    ad: "Ayna tekniği (Mirroring)",
    kategori: "Ses & Tempo",
    ozet: "Karşı tarafın son 2-3 kelimesini soru tonuyla tekrar et.",
    neden: "Kişiyi cümlesini genişletmeye, gerçek düşüncesini açmaya iter; sen konuşmadan bilgi toplarsın.",
    ornek: "O: 'Şu an gerçekten uygun değil.' → Sen: '…uygun değil mi?' (sonra sus, beklemesini bekle)",
  },
  {
    ad: "Sıcak ama kararlı ton",
    kategori: "Ses & Tempo",
    ozet: "Ses tonunu düşük, sakin, kararlı tut; acele/yalvaran tonu bırak.",
    neden: "Düşük-yavaş tonlama güven ve kontrol algısı yaratır (Voss'un 'gece FM DJ sesi'); telaş çaresizlik sinyali verir.",
    ornek: "(yavaş, düşük tonda) Hiç acelemiz yok abi, sadece anlatayım, sen değerlendir.",
  },
  {
    ad: '"Hayır" davetli soru',
    kategori: "Ses & Tempo",
    ozet: "'Evet' zorlamak yerine güvenli bir 'hayır' seçeneği sun.",
    neden: "'Hayır' deme özgürlüğü kişiyi rahatlatır ve paradoksal olarak konuşmaya devam ettirir.",
    ornek: "Bu konuda hiç ilgin yoksa şimdi söyle, seni daha fazla tutmayayım.",
  },
];

// Etik sınırı aşan — bilinçli olarak KULLANMA (esnaf camiası birbirini tanır,
// yalanla kazanılan satış itibarı kalıcı yakar).
export const KACINILACAKLAR: Kacinilacak[] = [
  { ad: "Sahte kontenjan / stok", neden: '"Son 1 yer kaldı" yalanı — güven kaybı ve yasal risk.' },
  { ad: "Uydurma referans / rakip", neden: '"Komşu dükkan da bizden aldı" yalanı — doğrulanabilir olmalı.' },
  { ad: "Sahte aciliyet", neden: '"Bugün karar vermezsen fiyat 3 katına çıkar" — gerçek dayanağı yok.' },
  { ad: "Korku sömürüsü", neden: '"Site yapmazsan dükkanın batar" — abartılı, kanıtsız tehdit; güveni kalıcı zedeler.' },
];
