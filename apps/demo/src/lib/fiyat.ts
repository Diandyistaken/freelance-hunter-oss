// FİYAT LİSTESİ — görüşmede söylenecek TEK rakamlar.
//
// KULLANICI KARARI: "aralık hiçbir şekilde uygulamada vermeyeceğiz.
// 12 bin kurulumsa 12 bin diyeceğiz." Bu yüzden burada bant yok, tek sayı
// var. Aylık bakım tabanı 1.000 ₺.
//
// Rakamlar services/radar/fikirler/ içindeki bantların üst ucundan seçildi.

import { VARSAYILAN_DERI } from "./deri";

export interface Urun {
  kod: string;
  ad: string;
  neYapar: string;
  /** Görüşmede gösterilecek somut an — "şunu yapıp gösterirsin". */
  demoAdimi: string;
  /** Demoda hangi ekrana gidilecek. */
  yol: string;
  kurulum: number;
  aylik: number;
  teslim: string;
}

export const PSIKOLOG_URUNLERI: Urun[] = [
  {
    kod: "ilk_gorusme",
    ad: "İlk görüşme ön formu",
    neYapar:
      "Randevu alan danışana KVKK aydınlatmalı kısa bir form gider. Cevaplar " +
      "seanstan önce ekranınıza düşer; ilk seansı bilgi toplamakla geçirmezsiniz.",
    demoAdimi: "Tableti danışana verirsin, formu doldurur; senin ekranında anında belirir.",
    yol: "/danisan",
    kurulum: 6000, aylik: 1000, teslim: "3 gün",
  },
  {
    kod: "online_seans",
    ad: "Online seans bağlantısı + ücret hatırlatma",
    neYapar:
      "Seansa 30 dakika kala bağlantı hazırlanır. Seans bitince ücret " +
      "hatırlatması sizin kendi ödeme linkinizle hazırlanır — para doğrudan " +
      "sizin hesabınıza gider.",
    demoAdimi: "Ayarlara ödeme linkini yazarsın, mesaj kuyruğunda hatırlatma belirir.",
    yol: "/program",
    kurulum: 8000, aylik: 1000, teslim: "3 gün",
  },
  {
    kod: "seans_hatirlatma",
    ad: "Seans hatırlatma + iptal kuralı",
    neYapar:
      "Seanstan 48 saat önce hatırlatma. Bir saat boşalırsa bekleyen danışana " +
      "açılır. İhtiyacınız yoksa bu kural kapalı kalır.",
    demoAdimi: "Programda bir seansı iptal edersin, saat bekleyene geçer.",
    yol: "/program",
    kurulum: 9000, aylik: 1200, teslim: "4 gün",
  },
  {
    kod: "seans_arasi",
    ad: "Seans arası günlük",
    neYapar:
      "Danışan gün içinde tek dokunuşla nasıl olduğunu işaretler, isterse tek " +
      "cümle ekler. Siz seanstan önce iki haftanın seyrini bir bakışta görürsünüz.",
    demoAdimi: "Tablette bir düğmeye basarsın, senin ekranında grafiğe düşer.",
    yol: "/danisan",
    kurulum: 12000, aylik: 1500, teslim: "1 hafta",
  },
];

export const PILATES_URUNLERI: Urun[] = [
  {
    // LİSTENİN BAŞINDA DURMASI TESADÜF DEĞİL. İkinci stüdyo sahibinin
    // birinci derdi bu: üyeliklerin bitiş tarihini telefonundan kendi takip
    // ediyor ve yetiştiremiyor. Sunum ürünleri bu sırayla gösteriyor; karşı
    // tarafın kendi derdini ilk sayfada görmesi, kalan beş ürünü dinlemesini
    // sağlayan şey.
    kod: "uye_defteri",
    ad: "Üye defteri ve üyelik takibi",
    neYapar:
      "Her üyenin üyeliği ne zaman başladı, ne zaman bitiyor, ödemesi alındı " +
      "mı — hepsi tek ekranda, telefonunuzda. Liste kendiliğinden bitişi en " +
      "yakın olandan sıralanır; süresi dolmak üzere olan üye listenin başına " +
      "çıkar ve ona gidecek yenileme mesajı hazır bekler. Kimin ne zaman " +
      "biteceğini aklınızda tutmanız gerekmez.",
    demoAdimi:
      "Üyeler ekranını aç — liste bitişi en yakın olandan sıralı gelir. " +
      "'Bu hafta bitiyor' kutusuna dokun, sonra bir üyeye dokunup yenileme " +
      "mesajını hazır göster.",
    yol: "/uyeler",
    kurulum: 16000, aylik: 1200, teslim: "1 hafta",
  },
  {
    kod: "ders_rez",
    ad: "Ders rezervasyonu + bekleme listesi",
    neYapar:
      "Üye telefonundan haftanın derslerini görür, tek tuşla yer ayırtır. Ders " +
      "doluysa bekleme listesine girer. Biri gelemeyeceğini bildirince yer, " +
      "bekleyendeki ilk kişiye anında geçer ve ona gidecek mesaj hazır gelir — " +
      "siz hiçbir şey yapmazsınız.",
    demoAdimi:
      "Tabletten üye ekranını aç, dolu derse bekleme listesine gir. Sonra " +
      "bilgisayarda o dersten birini iptal et: yer kendiliğinden dolar.",
    yol: "/danisan",
    kurulum: 15000, aylik: 1000, teslim: "1 hafta",
  },
  {
    kod: "uye_erime",
    ad: "Üye erime alarmı",
    neYapar:
      "Hakkı durduğu hâlde üç haftadır uğramayan üyeler listelenir; eğitmen " +
      "adına kişisel bir mesaj hazırlanır. Kimse aramazsa sessizce düşen " +
      "üyeler bunlar.",
    demoAdimi: "Mesaj kuyruğunda '41 gündür yok, 6 ders hakkı duruyor' satırını göster.",
    yol: "/program",
    kurulum: 18000, aylik: 1200, teslim: "1 hafta",
  },
  {
    kod: "paket_bitis",
    ad: "Paket bitiş yenilemesi",
    neYapar:
      "Son dersler yaklaşınca haber verir; yenileme konuşması ders bitmeden " +
      "yapılır, üyenin saati başkasına gitmez. Kendi ödeme linkiniz mesaja eklenir.",
    demoAdimi: "Ayarlara ödeme linkini yaz, '2 ders kaldı' mesajında belirsin.",
    yol: "/program",
    kurulum: 14000, aylik: 1000, teslim: "4 gün",
  },
  {
    kod: "deneme_takip",
    ad: "Deneme dersi takibi",
    neYapar:
      "Deneme dersine gelen kişiye 1., 3. ve 7. gün mesajı sıraya girer. " +
      "Üye olan ya da ilgilenmeyen işaretlenince mesaj kesilir — kimse iki kez " +
      "aynı mesajı almaz.",
    demoAdimi: "Deneme bölümünde birini 'üye oldu' işaretle, mesajı kesildiğini göster.",
    yol: "/program",
    kurulum: 9000, aylik: 1000, teslim: "4 gün",
  },
  {
    kod: "aylik_ozet",
    ad: "Aylık doluluk özeti",
    neYapar:
      "Hangi saat doluyor, hangisi boş geçiyor; kaç üye aktif, kaçı eriyor, " +
      "kaç deneme üyeye dönüyor. Hepsi kendi kayıtlarınızdan hesaplanır — " +
      "elle tablo tutmazsınız.",
    demoAdimi: "Özet ekranını aç: saat saat doluluk çubukları ve dönüşüm oranı.",
    yol: "/ozet",
    kurulum: 12000, aylik: 1000, teslim: "1 hafta",
  },
];

interface Paket { ad: string; kurulum: number; aylik: number; teslim: string }

// ÜRÜN LİSTESİ VE PAKET AYNI ANAHTARLA, AYNI HARİTADA.
//
// Eskiden üç fonksiyon aynı deri kodunu ÜÇ AYRI kuralla çözüyordu:
// `deriAl()` bilinmeyen kodda pilatese, `urunler()` ve `paketAl()` ise
// PSİKOLOĞA düşüyordu — yani dört ret almış segmentin listesi sistemin
// varsayılanıydı. Yalnız `urunler()` düzeltilseydi daha kötüsü olurdu: altı
// pilates ürününün yanına psikoloğun dört ürünlük paketi gelir, fiyat slaytı
// "tek tek 84.000 · paket 24.000 · 60.000 ₺ daha az" yazardı. İkisi tek
// kayıtta durursa biri olmadan öteki eklenemez.
const SATIS: Record<string, { urunler: Urun[]; paket: Paket }> = {
  pilates: {
    urunler: PILATES_URUNLERI,
    // Altı ürün tek tek 84.000 ₺; paket 54.000. Oran beş ürünlü paketle aynı
    // tutuldu (45.000 / 68.000 = 0,66 — 54.000 / 84.000 = 0,64): indirim ürün
    // eklendikçe keyfîleşirse "bu rakam nereden çıktı" sorusunun cevabı olmaz.
    paket: { ad: "Altısı birden", kurulum: 54000, aylik: 3000, teslim: "2 hafta" },
  },
  psikolog: {
    urunler: PSIKOLOG_URUNLERI,
    paket: { ad: "Dördü birden", kurulum: 24000, aylik: 2000, teslim: "1 hafta" },
  },
};

/** Bilinmeyen kod `deriAl()` ile AYNI yere düşer: ekranın dili, ürün listesi
 *  ve paket fiyatı hiçbir koşulda birbirinden ayrı sektörü göstermez. */
function satisAl(deriKodu: string) {
  return SATIS[deriKodu] ?? SATIS[VARSAYILAN_DERI];
}

export function urunler(deriKodu: string): Urun[] {
  return satisAl(deriKodu).urunler;
}

export function paketAl(deriKodu: string): Paket {
  return satisAl(deriKodu).paket;
}

/**
 * Piyasa karşılaştırması — Eylül 2026 taraması.
 *
 * DÜRÜSTLÜK NOTU: bu tablo "biz daha ucuzuz" demek İÇİN DEĞİL. Hazır bir
 * programın 3 yıllık paketi 64.800 ₺; bizim 3 yıllık toplamımız daha yüksek.
 * Ucuzluk iddiası kurulursa karşı taraf hesabı yapar ve güven gider.
 * Fark fiyatta değil: hazır programda işletme yazılıma uyar, burada yazılım
 * işletmeye uyar. Tablo bunu göstermek için var.
 */
export const PIYASA = {
  kaynak: "Eylül 2026 · yayınlanmış fiyat sayfaları",
  satirlar: [
    { baslik: "Aylık ödeme", hazir: "700 – 2.700 ₺", bizde: "sabit, kapsamınıza göre" },
    { baslik: "Kurulum", hazir: "Yok — ama size göre de yapılmaz", bizde: "Bir kez" },
    {
      baslik: "Size özel mi",
      hazir: "Hayır, herkes aynı programı kullanır",
      bizde: "Evet, sizin çalışma şeklinize göre yazılır",
    },
    { baslik: "Kayıtlar nerede", hazir: "Sağlayıcının sunucusunda", bizde: "Sizin kurulumunuzda" },
    {
      baslik: "Ödeme nasıl alınır",
      hazir: "Genelde aracı sistem üzerinden",
      bizde: "Doğrudan sizin hesabınıza",
    },
    {
      baslik: "İstemediğiniz bölüm",
      hazir: "Pakette gelir, ödersiniz",
      bizde: "Kapalı kalır, ücreti yok",
    },
  ],
};

export function tl(n: number): string {
  return n.toLocaleString("tr-TR");
}
