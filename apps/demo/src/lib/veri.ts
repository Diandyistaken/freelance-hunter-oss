// DEMO VERİSİ — sunucu yok, veritabanı yok.
//
// Panel sürümünde bu veri SQLite'taydı. Demo panelden ayrılınca (13 Eyl 2026)
// veritabanı bağımlılığı da gitti: her şey tarayıcıda üretilir, tarayıcıda
// durur. Kazancı sadece sadelik değil — ev bilgisayarı kapalıyken de,
// internet gittiğinde de demo çalışıyor.
//
// Takvim HER AÇILIŞTA bugüne göre kurulur; demo ne zaman açılırsa açılsın
// canlı görünür.

import { deriAl, type Deri } from "./deri";

export interface Uye {
  id: number;
  ad: string;
  telefon: string;
  paketKalan: number;
  katildiSon: string | null;   // "YYYY-MM-DD"
  // --- üyelik defteri ---
  // Ders hakkı (`paketKalan`) ile üyelik SÜRESİ ayrı iki şey: biri "kaç ders
  // kaldı", diğeri "takvimde ne zaman doluyor". Stüdyo sahibinin elde takip
  // edemediği şey ikincisi.
  uyelikTipi: string;          // "Aylık" | "3 aylık" | "6 aylık" | "Yıllık"
  uyelikBaslangic: string;     // "YYYY-MM-DD"
  uyelikBitis: string;         // "YYYY-MM-DD"
  aidat: number;               // dönem bedeli, ₺ — "anlaşılan tutar"
  // --- açık hesap ---
  // Eskiden tek bir `odendi: boolean` vardı: ya hepsi alındı ya hiçbiri.
  // Gerçekte peşinat alınır, kalanı sonraya kalır; yıllık üyelik taksitle
  // ödenir. Boolean bu hâli tutamıyordu ve "tahsil edilmedi" toplamı kalan
  // yerine DÖNEM BEDELİNİN TAMAMINI sayıyordu (8.000 alınmış 20.000'lik
  // üyelik 20.000 borç görünüyordu).
  odenen: number;              // bu dönem için bugüne kadar alınan, ₺
  sonOdeme: string | null;     // "YYYY-MM-DD"; hiç ödeme yoksa null
  kovalama: boolean;           // sahibin "bunu kovalama" işareti: listede
                               // kalır, hatırlatma kurgusuna hiç girmez
}

export interface Ders {
  id: number;
  ad: string;
  egitmen: string;
  baslar: string;              // "YYYY-MM-DD HH:MM"
  kapasite: number;
}

export type KayitDurumu = "kayitli" | "bekleme" | "iptal" | "geldi";

export interface Kayit {
  id: number;
  dersId: number;
  uyeId: number;
  durum: KayitDurumu;
  sira: number;
}

export interface Deneme {
  id: number;
  ad: string;
  telefon: string;
  geldi: string;
  durum: "bekliyor" | "kaydoldu" | "ilgilenmiyor";
  sonMesaj: number;
}

export interface Form {
  id: number;
  uyeId: number;
  gonderildi: string | null;
  dolduruldu: string | null;
  yanit: string[] | null;
}

export interface Gunluk {
  uyeId: number;
  tarih: string;
  ruh: number;
  not: string;
}

export interface Ayar {
  deri: string;
  isletmeAdi: string;
  odemeLinki: string;
  onlineLink: string;
  iletisim: string;
}

export interface Durum {
  uyeler: Uye[];
  dersler: Ders[];
  kayitlar: Kayit[];
  denemeler: Deneme[];
  formlar: Form[];
  gunlukler: Gunluk[];
  ayar: Ayar;
}

export const FORM_SORULARI = [
  "Sizi başvurmaya getiren konu nedir?",
  "Ne zamandır sürüyor?",
  "Daha önce psikolojik destek aldınız mı?",
  "Şu an acil bir durum var mı?",
];

export const FORM_BASLIKLARI = ["Başvuru konusu", "Süresi", "Önceki destek", "Acil durum"];

export const RUH_HALI = ["Çok kötü", "Kötü", "Orta", "İyi", "Çok iyi"];

// Adlar ve saatler SABİT: demoyu her sıfırladığında aynı ekran gelsin,
// anlatırken verdiğin örnek değişmesin.
const ADLAR: [string, string][] = [
  ["Ayşe Demir", "0532 114 22 08"], ["Merve Kaya", "0535 207 41 63"],
  ["Zeynep Arslan", "0555 444 55 66"], ["Elif Şahin", "0542 330 15 90"],
  ["Deniz Yılmaz", "0536 442 60 31"], ["Ceren Aydın", "0538 076 84 25"],
  ["Buse Çelik", "0531 265 39 47"], ["Ece Korkmaz", "0537 581 20 74"],
  ["Selin Öztürk", "0534 703 58 16"], ["Nil Güneş", "0539 149 92 03"],
  ["Pelin Doğan", "0545 826 47 51"], ["İrem Kurt", "0530 318 65 29"],
  ["Damla Aksoy", "0541 690 13 88"], ["Sude Polat", "0543 274 50 67"],
  ["Gizem Erdem", "0546 831 26 94"], ["Melis Tunç", "0532 507 73 40"],
  ["Burcu Ateş", "0535 962 08 15"], ["Aslı Kılıç", "0533 415 87 62"],
  ["Yasemin Ak", "0538 720 34 09"], ["Cansu Bilgin", "0536 053 61 78"],
  ["Tuğçe Yavuz", "0542 187 49 26"], ["Esra Taş", "0531 604 95 33"],
  ["Simge Uçar", "0537 238 70 81"], ["Nehir Sarı", "0539 546 12 57"],
];

// ÜYELİK SÜRELERİ — ay ve dönem bedeli. Rakamlar örnek veridir ve ekranda
// "ÖRNEK VERİ" rozetiyle gösterilir; yine de makul tutuldu: ekranında kendi
// fiyatının üç katını gören stüdyo sahibi verinin tamamından şüphe eder.
const UYELIK_TIPLERI: [string, number, number][] = [
  ["Aylık", 1, 4000],
  ["3 aylık", 3, 11000],
  ["6 aylık", 6, 20000],
  ["Yıllık", 12, 36000],
];

// Üyelik bitişine kalan gün — ELLE YAZILI, rastgele değil.
// İlk ikisi DOLMUŞ (eksi), sonraki üçü bu hafta, sonraki dördü bu ay içinde.
// Ekranın anlattığı şey bu dağılım: "takip edemediğin şey tam olarak bu".
const KALAN_GUNLER = [
  -9, -2, 1, 3, 6, 11, 16, 19, 24, 27, 31, 36,
  41, 47, 52, 58, 63, 70, 78, 85, 96, 110, 133, 158,
];

// AÇIK HESAP — elle yazılı, her satır sahada gerçekten görülen bir hâl.
//   indeks: [alınan ₺, son ödeme kaç gün önce (null = hiç ödeme yok), kovalama]
// Son ödeme tarihi dönem başlangıcından ÖNCE olamaz; aşağıdaki günler
// KALAN_GUNLER ve üyelik süresiyle birlikte hesaplandı.
// Geri kalan herkes dönem başında tam ödemiş sayılır.
const ACIK_HESAP: Record<number, [number, number | null, boolean]> = {
  2: [8000, 97, false],    // 6 aylık 20.000 — peşinat alındı, 12.000 kaldı
  8: [0, null, false],     // aylık 4.000 — dönem başladı, hiç ödeme yok
  15: [24000, 128, false], // yıllık 36.000 — üç taksidin ikisi alındı
  5: [6000, 70, true],     // 3 aylık 11.000 — sahibin "kovalama" dediği satır
};

// Tam ödemiş ama son taksiti YAKIN zamanda gelmiş üye — gün önce.
// Olmasaydı tohumun en yeni ödemesi yaklaşık üç hafta önce çıkıyor (en yeni
// dönem başlangıcı; ay uzunluğuna göre 20-22 gün) ve ekran ilk açılışta
// "N gündür hiç ödeme işaretlenmedi" uyarısı veriyordu: doğru
// bir cümle ama gerçek bir stüdyoda haftada birkaç ödeme olur; demo, sahibin
// ilk bakışında yapay bir alarm göstermiş olurdu.
const SON_ODEME_OZEL: Record<number, number> = { 16: 2 };

const SAATLER = ["09:30", "12:00", "18:30", "20:00"];
// ADIM, aktif üye sayısıyla aralarında asal olmalı; yoksa döngü aynı üyeye
// geri döner (5 ile 20'de olan buydu).
const ADIM = 7;

export function gunYaz(t: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

export function saatYaz(t: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getHours())}:${p(t.getMinutes())}`;
}

export function zamanYaz(t: Date): string {
  return `${gunYaz(t)} ${saatYaz(t)}`;
}

function gunEkle(t: Date, gun: number): Date {
  const y = new Date(t);
  y.setDate(y.getDate() + gun);
  return y;
}

function zaman(gun: Date, saat: string): string {
  return `${gunYaz(gun)} ${saat}`;
}

export const VARSAYILAN_AYAR: Ayar = {
  deri: "pilates",
  // Gerçek işletme adı BURADA DURMAZ. Demo dışarıda yayınlanıyor; adı
  // gösterimden önce kullanıcı yazar ve yalnız kendi tarayıcısında kalır.
  isletmeAdi: "",
  odemeLinki: "",
  onlineLink: "",
  iletisim: "",
};

/** Sıfırdan demo verisi. Takvim bugüne göre kurulur. */
export function tohumla(ayar: Ayar = VARSAYILAN_AYAR): Durum {
  const deri: Deri = deriAl(ayar.deri);
  const bugun = new Date();
  const kapasite = deri.kapasite;

  const uyeler: Uye[] = ADLAR.map(([ad, tel], i) => {
    // 4 üye bilerek eriyor (22-40 gündür yok), 3 üyenin paketi bitmek üzere.
    const eriyen = i >= 20;
    const gecen = eriyen ? 22 + (i - 20) * 6 : i % 7;
    const kalan = i >= 17 && i < 20 ? 2 : eriyen ? 4 + (i % 3) : 6 + (i % 8);
    // TİP, KALAN GÜNE SIĞMAK ZORUNDA. Eskiden tip yalnız sırayla (i % 4)
    // atanıyordu ve 41 günü kalmış bir "Aylık" üyelik çıkıyordu — başlangıcı
    // 10 gün SONRA. Dört üyede böyleydi; detay panelinde bugün 24 Eylül'ken
    // "Başlangıç: 4 Ekim" yazıyordu. Sıradaki tip kalan güne sığmıyorsa bir
    // uzununa geçilir.
    let tipNo = i % UYELIK_TIPLERI.length;
    while (tipNo < UYELIK_TIPLERI.length - 1 && UYELIK_TIPLERI[tipNo][1] * 30 <= KALAN_GUNLER[i]) {
      tipNo += 1;
    }
    const [tip, ay, aidat] = UYELIK_TIPLERI[tipNo];
    const bitis = gunEkle(bugun, KALAN_GUNLER[i]);
    const baslangic = new Date(bitis);
    baslangic.setMonth(baslangic.getMonth() - ay);
    const acik = ACIK_HESAP[i];
    return {
      id: i + 1, ad, telefon: tel, paketKalan: kalan,
      katildiSon: gunYaz(gunEkle(bugun, -gecen)),
      uyelikTipi: tip, uyelikBaslangic: gunYaz(baslangic), uyelikBitis: gunYaz(bitis),
      aidat,
      odenen: acik ? acik[0] : aidat,
      sonOdeme: acik
        ? (acik[1] === null ? null : gunYaz(gunEkle(bugun, -acik[1])))
        : SON_ODEME_OZEL[i] !== undefined
          ? gunYaz(gunEkle(bugun, -SON_ODEME_OZEL[i]))
          : gunYaz(baslangic),
      kovalama: acik ? acik[2] : false,
    };
  });

  // Eriyen üyeler hiçbir derse yazılmaz: "41 gündür yok" diyen alarmla,
  // aynı kişinin yarınki derste görünmesi çelişirdi.
  const aktif = uyeler.slice(0, uyeler.length - 4).map((u) => u.id);

  const dersler: Ders[] = [];
  const kayitlar: Kayit[] = [];
  let dersId = 0;
  let kayitId = 0;
  // Demonun can alıcı ekranı "dolu ders + bekleme listesi". Sabit bir güne
  // bağlamak kırılgan: bir keresinde yarın pazar çıktı, tohum pazarı atlayınca
  // dolu ders hiç oluşmadı. Artık gelecekteki ilk akşam dersi doluyor.
  let doluAtandi = false;
  const simdi = zamanYaz(bugun);

  for (let g = -7; g <= 6; g += 1) {
    const gun = gunEkle(bugun, g);
    if (gun.getDay() === 0) continue;            // pazar kapalı
    SAATLER.forEach((saat, s) => {
      dersId += 1;
      dersler.push({
        id: dersId, ad: deri.seansTurleri[s], egitmen: deri.uzmanlar[s],
        baslar: zaman(gun, saat), kapasite,
      });

      const doluDers = !doluAtandi && g >= 1 && saat === "18:30";
      if (doluDers) doluAtandi = true;

      // JS'te (-7 + 0) % 3 = -1 döner. Bu yüzden geçmiş günlerde katılımcı
      // sayısı eksiye kayıyor ve doluluk %25 gibi görünüyordu — bir stüdyoya
      // bu oranı göstermek ürünü ilk bakışta çürütür. Modulo'yu pozitife
      // sabitliyoruz.
      const d3 = ((g + s) % 3 + 3) % 3;

      // Kapasite 1 olan sektörde (psikolog) "yarısı dolu" diye bir şey yok:
      // saat ya doludur ya boştur.
      const kisi = doluDers
        ? kapasite
        : kapasite === 1
          ? (g < 0 || (g === 0 && s < 2) ? 1 : (d3 === 0 ? 0 : 1))
          // Sabah seansları seyrek, akşam dolu — gerçek bir stüdyonun eğrisi.
          : s >= 2 ? 6 + d3 : 4 + d3;

      const girenler = new Set<number>();
      for (let k = 0; k < kisi; k += 1) {
        const uyeId = aktif[(dersId * 3 + k * ADIM) % aktif.length];
        if (girenler.has(uyeId)) continue;
        girenler.add(uyeId);
        // Bugünün geçmiş saatleri de tamamlanmış sayılır: ücret hatırlatması
        // ve yoklama ekranları boş kalmasın.
        const gecmis = g < 0 || (g === 0 && zaman(gun, saat) < simdi);
        kayitId += 1;
        kayitlar.push({
          id: kayitId, dersId, uyeId,
          // İPTAL SEANS KİMLİĞİNE BAĞLI, SEANS İÇİ SIRAYA DEĞİL.
          // Eskiden `k % 6 === 0` yazıyordu; `k` seans İÇİ katılımcı indeksi
          // ve kapasite 1 olan deride (psikolog) döngü yalnız k=0 ile dönüyor
          // — yani geçmişteki HER seans "iptal" işaretleniyordu. Sonuç:
          // /ozet psikolog derisinde baştan sona sıfırdı (doluluk %0,
          // "0 / 24 seans yapıldı", 24 iptal) ve aynı sayfa üstte "Aktif
          // danışan 22" diyordu. Bu ekranın tek işi güven vermek; kendi
          // içinde çelişen bir rapor tam tersini yapar.
          // `dersId + k` her iki deride de 1/6 iptal oranını korur ve
          // dağılımı seanslar arasına yayar.
          durum: gecmis ? ((dersId + k) % 6 === 0 ? "iptal" : "geldi") : "kayitli",
          sira: 0,
        });
      }

      if (doluDers) {
        aktif.filter((id) => !girenler.has(id)).slice(0, 2).forEach((uyeId, i) => {
          kayitId += 1;
          kayitlar.push({ id: kayitId, dersId, uyeId, durum: "bekleme", sira: i + 1 });
        });
      }
    });
  }

  // YAKLAŞAN SEANS: şu andan 25 dakika sonrasına bir kayıt. Online bağlantı
  // kuralı "seansa 30 dk kala" olduğu için, demo mesai içinde açıldığında o
  // kuyrukta gerçek bir satır bulunsun.
  //
  // AMA mesai dışında EKLENMEZ: bir keresinde demo pazar gecesi açıldı ve
  // takvimde 22:43'e seans koydu — kapalı günde, gece yarısına yakın bir
  // seans ürünü ilk bakışta çürütür. Boş kuyruk, uydurma satırdan iyidir.
  const yaklasan = gunEkle(bugun, 0);
  // Dakika 5'in katına yuvarlanır. Yuvarlamadan duvar saatine +25 eklenince
  // takvimde "09:36 Reformer" gibi bir satır çıkıyordu; diğer bütün dersler
  // 09:30 / 12:00 / 18:30 / 20:00 düzgün slotlarında olduğu için araya giren
  // bu satır, hem de "ÖRNEK VERİ" rozetli bir ekranda, bozuk veri gibi
  // okunuyordu.
  yaklasan.setMinutes(Math.ceil((yaklasan.getMinutes() + 25) / 5) * 5, 0, 0);
  const mesaide = yaklasan.getDay() !== 0
    && yaklasan.getHours() >= 8 && yaklasan.getHours() < 21;
  if (mesaide) {
    dersId += 1;
    dersler.push({
      id: dersId, ad: deri.seansTurleri[0], egitmen: deri.uzmanlar[0],
      baslar: zamanYaz(yaklasan), kapasite,
    });
    kayitId += 1;
    kayitlar.push({ id: kayitId, dersId, uyeId: aktif[0], durum: "kayitli", sira: 0 });
  }

  const denemeler: Deneme[] = [
    ["Berna Yıldırım", "0532 448 91 07", 1, "bekliyor", 0],
    ["Özge Keskin", "0535 713 26 84", 3, "bekliyor", 1],
    ["Hande Çetin", "0542 069 35 71", 7, "bekliyor", 3],
    ["Seda Aydemir", "0537 826 54 19", 4, "kaydoldu", 3],
    ["Dilara Uysal", "0531 390 47 62", 9, "ilgilenmiyor", 7],
  ].map(([ad, tel, oncekiGun, durum, sonMesaj], i) => ({
    id: i + 1, ad: ad as string, telefon: tel as string,
    geldi: gunYaz(gunEkle(bugun, -(oncekiGun as number))),
    durum: durum as Deneme["durum"], sonMesaj: sonMesaj as number,
  }));

  // ÖN FORM ve GÜNLÜK yalnız psikologda var. Pilates demosunda çıkınca
  // ekranda "Daha önce psikolojik destek aldınız mı?" yazıyordu — bir spor
  // stüdyosuna gösterilecek en kötü cümle.
  const ruhsal = deri.kod === "psikolog";

  const formlar: Form[] = !ruhsal ? [] : [
    {
      id: 1, uyeId: 2,
      gonderildi: gunYaz(gunEkle(bugun, -2)),
      dolduruldu: gunYaz(gunEkle(bugun, -2)),
      yanit: [
        "İş yerinde sürekli gerginlik ve uyku sorunu",
        "Yaklaşık 4 aydır",
        "Hayır, ilk kez",
        "Hayır",
      ],
    },
    { id: 2, uyeId: 1, gonderildi: gunYaz(bugun), dolduruldu: null, yanit: null },
  ];

  // Bir danışanın son 10 günü — uzman seans öncesi eğriyi görsün.
  // Değerler elle yazıldı, rastgele değil.
  const seyir: [number, number, string][] = [
    [9, 2, "Uykusuz"], [8, 2, ""], [7, 3, "Biraz daha iyi"], [6, 3, ""],
    [5, 2, "Toplantı öncesi çok gergindim"], [4, 3, ""],
    [3, 4, "Nefes çalışması işe yaradı"], [2, 4, ""],
    [1, 3, "Dün gece yine geç uyudum"], [0, 4, "Bugün iyiyim"],
  ];
  const gunlukler: Gunluk[] = !ruhsal ? [] : seyir.map(([oncekiGun, ruh, notu]) => ({
    uyeId: 2, tarih: gunYaz(gunEkle(bugun, -oncekiGun)), ruh, not: notu,
  }));

  return { uyeler, dersler, kayitlar, denemeler, formlar, gunlukler, ayar };
}
