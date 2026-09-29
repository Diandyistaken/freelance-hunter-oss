// KURALLAR — ürünün telefonda anlatılan iddialarının gerçek karşılığı.
//
// Panel sürümünde bunlar SQL sorgularıydı. Demo ayrılınca saf fonksiyonlara
// çevrildi: durum girer, YENİ durum çıkar. Hiçbiri girdisini değiştirmez —
// böylece "geri al" ve "sıfırla" tek satırla çalışıyor.

import { type Deri, whatsappLinki } from "./deri";
import {
  gunYaz, saatYaz, zamanYaz,
  type Durum, type Ders, type Kayit, type Uye,
} from "./veri";

export interface Mesaj {
  tur: "online" | "ucret" | "hatirlatma" | "bosalan-yer" | "erime" | "paket" | "deneme"
    | "uyelik";
  kimlik?: number;
  uye: string;
  telefon: string;
  metin: string;
  link: string;
  aciklama: string;
}

export interface DersSatiri extends Ders {
  kayitli: number;
  bekleyen: number;
}

export interface KayitSatiri extends Kayit {
  ad: string;
  telefon: string;
  paketKalan: number;
}

const GUN_ADI = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export function gunAdi(tarih: string): string {
  return GUN_ADI[new Date(`${tarih.slice(0, 10)}T00:00:00`).getDay()] ?? "";
}

/** Mesajın içindeki gün sözü: o gün cumartesiyse insan "bugün" der. */
export function gunSozu(baslar: string): string {
  const t = new Date(`${baslar.slice(0, 10)}T00:00:00`);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  const fark = Math.round((t.getTime() - b.getTime()) / 86400000);
  if (fark === 0) return "bugün";
  if (fark === 1) return "yarın";
  return gunAdi(baslar);
}

export function saatOku(baslar: string): string {
  return baslar.slice(11, 16);
}

function uyeAl(d: Durum, id: number): Uye | undefined {
  return d.uyeler.find((u) => u.id === id);
}

function dersAl(d: Durum, id: number): Ders | undefined {
  return d.dersler.find((x) => x.id === id);
}

// ------------------------------------------------------------------ okuma
export function takvim(d: Durum, ilkGun: string, gunSayisi = 9): DersSatiri[] {
  const son = new Date(`${ilkGun}T00:00:00`);
  son.setDate(son.getDate() + gunSayisi);
  const sonStr = gunYaz(son);
  return d.dersler
    .filter((x) => x.baslar >= `${ilkGun} 00:00` && x.baslar < `${sonStr} 00:00`)
    .map((x) => ({
      ...x,
      kayitli: d.kayitlar.filter((k) => k.dersId === x.id && k.durum === "kayitli").length,
      bekleyen: d.kayitlar.filter((k) => k.dersId === x.id && k.durum === "bekleme").length,
    }))
    .sort((a, b) => a.baslar.localeCompare(b.baslar));
}

export function dersKayitlari(d: Durum, dersId: number): KayitSatiri[] {
  return d.kayitlar
    .filter((k) => k.dersId === dersId && k.durum !== "iptal")
    .map((k) => {
      const u = uyeAl(d, k.uyeId);
      return { ...k, ad: u?.ad ?? "", telefon: u?.telefon ?? "", paketKalan: u?.paketKalan ?? 0 };
    })
    .sort((a, b) =>
      (a.durum === "bekleme" ? 1 : 0) - (b.durum === "bekleme" ? 1 : 0)
      || a.sira - b.sira
      || a.ad.localeCompare(b.ad, "tr"));
}

// ---------------------------------------------------------------- kurallar
function sonrakiKayitId(d: Durum): number {
  return d.kayitlar.reduce((t, k) => Math.max(t, k.id), 0) + 1;
}

/** Yer varsa kaydeder, yoksa bekleme listesinin sonuna ekler. */
export function rezerveEt(
  d: Durum, dersId: number, uyeId: number,
): { durum: Durum; sonuc: { durum: "kayitli" | "bekleme"; sira: number } } {
  const ders = dersAl(d, dersId);
  if (!ders) return { durum: d, sonuc: { durum: "bekleme", sira: 0 } };

  const kayitli = d.kayitlar.filter((k) => k.dersId === dersId && k.durum === "kayitli").length;
  const yeniId = sonrakiKayitId(d);

  if (kayitli < ders.kapasite) {
    return {
      durum: { ...d, kayitlar: [...d.kayitlar, { id: yeniId, dersId, uyeId, durum: "kayitli", sira: 0 }] },
      sonuc: { durum: "kayitli", sira: 0 },
    };
  }
  const sonSira = d.kayitlar
    .filter((k) => k.dersId === dersId && k.durum === "bekleme")
    .reduce((t, k) => Math.max(t, k.sira), 0);
  return {
    durum: { ...d, kayitlar: [...d.kayitlar, { id: yeniId, dersId, uyeId, durum: "bekleme", sira: sonSira + 1 }] },
    sonuc: { durum: "bekleme", sira: sonSira + 1 },
  };
}

/**
 * İptal + otomatik yükseltme. Ürünün can damarı bu: boşalan yer bekleme
 * listesindeki ilk kişiye geçer ve ona gidecek mesaj hazır gelir.
 */
export function iptalEt(
  d: Durum, kayitId: number, deri: Deri,
): { durum: Durum; iptal: string; yukselen: Mesaj | null } {
  const k = d.kayitlar.find((x) => x.id === kayitId);
  if (!k) return { durum: d, iptal: "", yukselen: null };

  const iptalEden = uyeAl(d, k.uyeId);
  let kayitlar = d.kayitlar.map((x) =>
    x.id === kayitId ? { ...x, durum: "iptal" as const } : x);

  const ilk = kayitlar
    .filter((x) => x.dersId === k.dersId && x.durum === "bekleme")
    .sort((a, b) => a.sira - b.sira)[0];
  if (!ilk) {
    return { durum: { ...d, kayitlar }, iptal: iptalEden?.ad ?? "", yukselen: null };
  }

  kayitlar = kayitlar.map((x) =>
    x.id === ilk.id ? { ...x, durum: "kayitli" as const, sira: 0 } : x);

  const ders = dersAl(d, k.dersId)!;
  const y = uyeAl(d, ilk.uyeId)!;
  const metin = deri.mesaj.bosalanYer({
    uye: y.ad.split(" ")[0], seans: ders.ad, saat: saatOku(ders.baslar),
    gun: gunSozu(ders.baslar), egitmen: ders.egitmen,
  });
  return {
    durum: { ...d, kayitlar },
    iptal: iptalEden?.ad ?? "",
    yukselen: {
      tur: "bosalan-yer", uye: y.ad, telefon: y.telefon, metin,
      link: whatsappLinki(y.telefon, metin),
      aciklama: "Bekleme listesinde 1. sıradaydı — yeri otomatik ayrıldı.",
    },
  };
}

export function geldiIsaretle(d: Durum, kayitId: number): Durum {
  const k = d.kayitlar.find((x) => x.id === kayitId);
  if (!k) return d;
  const ders = dersAl(d, k.dersId);
  return {
    ...d,
    kayitlar: d.kayitlar.map((x) => (x.id === kayitId ? { ...x, durum: "geldi" as const } : x)),
    uyeler: d.uyeler.map((u) =>
      u.id === k.uyeId
        ? { ...u, paketKalan: Math.max(0, u.paketKalan - 1), katildiSon: ders?.baslar.slice(0, 10) ?? u.katildiSon }
        : u),
  };
}

// ----------------------------------------------------------------- mesajlar
/** Hatırlatması gelen dersler: şu andan itibaren N saat içinde başlayanlar. */
export function hatirlatmalar(d: Durum, deri: Deri): Mesaj[] {
  const simdi = new Date();
  const son = new Date(simdi.getTime() + deri.hatirlatmaSaat * 3600_000);
  const a = zamanYaz(simdi);
  const b = zamanYaz(son);

  return d.kayitlar
    .filter((k) => k.durum === "kayitli")
    .map((k) => ({ k, ders: dersAl(d, k.dersId), uye: uyeAl(d, k.uyeId) }))
    .filter((x) => x.ders && x.uye && x.ders.baslar >= a && x.ders.baslar <= b)
    .sort((x, y) => x.ders!.baslar.localeCompare(y.ders!.baslar))
    .map(({ ders, uye }) => {
      const metin = deri.mesaj.hatirlatma({
        uye: uye!.ad.split(" ")[0], seans: ders!.ad, saat: saatOku(ders!.baslar),
        gun: gunSozu(ders!.baslar), egitmen: ders!.egitmen,
      });
      return {
        tur: "hatirlatma" as const, uye: uye!.ad, telefon: uye!.telefon, metin,
        link: whatsappLinki(uye!.telefon, metin),
        aciklama: `${gunSozu(ders!.baslar)} ${saatOku(ders!.baslar)} · ${ders!.ad} · ${ders!.egitmen}`,
      };
    });
}

/** Hakkı durduğu hâlde uzun süredir gelmeyenler. */
export function eriyenler(d: Durum, deri: Deri): Mesaj[] {
  const esik = new Date();
  esik.setDate(esik.getDate() - deri.erimeGun);
  const esikStr = gunYaz(esik);
  const bugun = new Date();

  return d.uyeler
    .filter((u) => u.paketKalan > 0 && u.katildiSon && u.katildiSon < esikStr)
    .sort((a, b) => (a.katildiSon ?? "").localeCompare(b.katildiSon ?? ""))
    .map((u) => {
      const gecen = Math.round(
        (bugun.getTime() - new Date(`${u.katildiSon}T00:00:00`).getTime()) / 86400000,
      );
      const metin = deri.mesaj.erime({
        uye: u.ad.split(" ")[0], seans: "", saat: "", gun: "", egitmen: "",
        kalan: u.paketKalan, gecenGun: gecen,
      });
      return {
        tur: "erime" as const, uye: u.ad, telefon: u.telefon, metin,
        link: whatsappLinki(u.telefon, metin),
        aciklama: `${gecen} gündür yok · ${u.paketKalan} ${deri.seans} hakkı duruyor`,
      };
    });
}

/** Paketi bitmek üzere olanlar. */
export function paketiBitenler(d: Durum, deri: Deri, esik = 2): Mesaj[] {
  return d.uyeler
    .filter((u) => u.paketKalan > 0 && u.paketKalan <= esik)
    .sort((a, b) => a.paketKalan - b.paketKalan)
    .map((u) => {
      const metin = deri.mesaj.paketBitiyor({
        uye: u.ad.split(" ")[0], seans: "", saat: "", gun: "", egitmen: "",
        kalan: u.paketKalan, odemeLinki: d.ayar.odemeLinki,
      });
      return {
        tur: "paket" as const, uye: u.ad, telefon: u.telefon, metin,
        link: whatsappLinki(u.telefon, metin),
        aciklama: `${u.paketKalan} ${deri.seans} kaldı`,
      };
    });
}

// ----------------------------------------------------------- üye defteri
//
// Stüdyo sahibinin telefonda elle tuttuğu defterin karşılığı. Buradaki tek
// iddia şu: "kimin ne zaman biteceğini sen hatırlamayacaksın". O yüzden bütün
// hesap TEK yerde ve sıralama kuralı tek: bitişe kalan gün.

const AY_ADI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** "2026-09-24" → "24 Eylül Perşembe". Tarih ekranda ASLA ISO durmaz. */
export function tarihOku(tarih: string, gunle = true): string {
  const t = new Date(`${tarih.slice(0, 10)}T00:00:00`);
  const govde = `${t.getDate()} ${AY_ADI[t.getMonth()]}`;
  return gunle ? `${govde} ${GUN_ADI[t.getDay()]}` : govde;
}

/** Bugünden hedefe kaç gün. Eksi = geçmiş. Saat farkı hesabı bozmasın diye
    iki taraf da gece yarısına sabitlenir. */
export function gunFarki(tarih: string): number {
  const t = new Date(`${tarih.slice(0, 10)}T00:00:00`);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - b.getTime()) / 86400000);
}

/** Geçmiş gün sayısını söze çevirir: 0 → "bugün", 3 → "3 gün önce". */
export function gunOnce(gun: number): string {
  return gun === 0 ? "bugün" : `${gun} gün önce`;
}

export type UyelikHali = "gecti" | "bu_hafta" | "bu_ay" | "surer";

export interface UyelikSatiri {
  uye: Uye;
  kalanGun: number;
  hal: UyelikHali;
  /** Dönemin ne kadarı geçti (0-1). Süresi dolmuşta 1. */
  ilerleme: number;
  bitisYazi: string;
  baslangicYazi: string;
}

function hal(kalanGun: number): UyelikHali {
  if (kalanGun < 0) return "gecti";
  if (kalanGun <= 7) return "bu_hafta";
  if (kalanGun <= 30) return "bu_ay";
  return "surer";
}

/**
 * Bütün üyeler, BİTİŞE EN YAKIN OLAN ÜSTTE.
 *
 * Sıralamayı ekran değil bu fonksiyon yapıyor: aynı liste üç yerde
 * (defter, özet kutuları, mesaj kuyruğu) kullanılıyor ve üçünde farklı
 * sıralanırsa aynı ürün kendi içinde çelişir.
 */
export function uyelikler(d: Durum): UyelikSatiri[] {
  return d.uyeler
    .map((uye) => {
      const kalanGun = gunFarki(uye.uyelikBitis);
      const toplam = Math.max(1, gunFarki(uye.uyelikBitis) - gunFarki(uye.uyelikBaslangic));
      const gecen = toplam - Math.max(0, kalanGun);
      return {
        uye,
        kalanGun,
        hal: hal(kalanGun),
        ilerleme: Math.min(1, Math.max(0, gecen / toplam)),
        bitisYazi: tarihOku(uye.uyelikBitis),
        baslangicYazi: tarihOku(uye.uyelikBaslangic, false),
      };
    })
    .sort((a, b) => a.kalanGun - b.kalanGun);
}

// ------------------------------------------------------------- açık hesap
//
// Komite şartnamesi (_komite/01-urunler.md §4): iki rakam — anlaşılan ve
// alınan — ve aradaki fark. Liste borcun YAŞINA göre sıralanır, tarihe göre
// değil. Mesaj varsayılan kapalı; açılırsa borç dili yok, göndermeden önce
// zorunlu sürtünme var. Ürün kendi eksikliğini itiraf eder.

/** Bu dönem için kalan. Negatif olamaz — fazla ödeme borç değildir. */
export function kalanBorc(u: Uye): number {
  return Math.max(0, u.aidat - u.odenen);
}

/**
 * Açık hesap kaç gündür ödemesiz bekliyor: SON ÖDEMEDEN beri, hiç ödeme
 * yoksa dönem başından beri. Kalan yoksa null.
 *
 * Dönem başından saymak taksitle ödeyeni cezalandırıyordu: yıllık üyeliğinin
 * iki taksidini ödemiş biri "307 gündür açık" görünüp listenin tepesine
 * çıkıyordu; oysa son taksiti 128 gün önce gelmişti. Sahibin sorusu "kim en
 * uzun süredir hiç ödemedi" — liste bu sayıya göre sıralanır.
 */
export function borcYasi(u: Uye): number | null {
  if (kalanBorc(u) === 0) return null;
  return Math.max(0, -gunFarki(u.sonOdeme ?? u.uyelikBaslangic));
}

export interface UyelikOzeti {
  gecti: number;
  buHafta: number;
  buAy: number;
  aktif: number;
  /** Kalanı olan kişi sayısı ("kovalama" işaretliler DAHİL — borç borçtur,
   *  işaret yalnız mesajı kapatır). */
  acikHesap: number;
  /** Kalanların toplamı: bugün dışarıda duran para. */
  disaridaTutar: number;
  /** En uzun süredir ödemesiz bekleyen açık hesap kaç gündür bekliyor. */
  enEskiBorcGun: number | null;
  /** Herhangi bir üyeden en son ödeme kaç gün önce kaydedildi. Uzunsa liste
   *  eksik olabilir — ürün bunu kendisi söyler. */
  sonOdemeGunOnce: number | null;
}

export function uyelikOzeti(d: Durum): UyelikOzeti {
  const satirlar = uyelikler(d);
  const gecti = satirlar.filter((s) => s.hal === "gecti");
  const acik = satirlar.filter((s) => kalanBorc(s.uye) > 0);
  const yaslar = acik.map((s) => borcYasi(s.uye) ?? 0);
  const odemeler = d.uyeler
    .map((u) => u.sonOdeme)
    .filter((t): t is string => !!t)
    .map((t) => -gunFarki(t));
  return {
    gecti: gecti.length,
    buHafta: satirlar.filter((s) => s.hal === "bu_hafta").length,
    // "Bu ay" bu haftayı da KAPSAR: stüdyo sahibi "önümüzdeki 30 günde kaç
    // yenileme konuşması var" diye bakıyor, takvim ayına göre değil.
    buAy: satirlar.filter((s) => s.hal === "bu_hafta" || s.hal === "bu_ay").length,
    aktif: satirlar.filter((s) => s.hal !== "gecti").length,
    acikHesap: acik.length,
    // KALAN toplanır, dönem bedeli değil. Eski sürüm `aidat` topluyordu:
    // 8.000'i alınmış 20.000'lik üyelik 20.000 borç görünüyordu.
    disaridaTutar: acik.reduce((t, s) => t + kalanBorc(s.uye), 0),
    enEskiBorcGun: yaslar.length ? Math.max(...yaslar) : null,
    sonOdemeGunOnce: odemeler.length ? Math.min(...odemeler) : null,
  };
}

/** Süresi bitmiş + bu hafta bitecek üyeler için hazır yenileme mesajları. */
export function uyeligiBitenler(d: Durum, deri: Deri): Mesaj[] {
  return uyelikler(d)
    .filter((s) => s.hal === "gecti" || s.hal === "bu_hafta")
    .map((s) => {
      const metin = deri.mesaj.uyelikBitiyor({
        uye: s.uye.ad.split(" ")[0], seans: "", saat: "", gun: "", egitmen: "",
        kalanGun: s.kalanGun, bitisTarihi: s.bitisYazi,
        odemeLinki: d.ayar.odemeLinki,
      });
      return {
        tur: "uyelik" as const, kimlik: s.uye.id, uye: s.uye.ad,
        telefon: s.uye.telefon, metin, link: whatsappLinki(s.uye.telefon, metin),
        aciklama: s.kalanGun < 0
          ? `${-s.kalanGun} gün önce doldu`
          : s.kalanGun === 0 ? "bugün bitiyor" : `${s.kalanGun} gün kaldı`,
      };
    });
}

/**
 * Ödeme alındı — KISMİ olabilir. Girdiyi değiştirmez, yeni durum döner.
 *
 * Tutar (0, kalan] aralığına kırpılır: masadaki kişi fazla yazarsa kalan
 * eksiye düşmez, sıfır ya da eksi yazarsa hiçbir şey olmaz.
 */
export function odemeAl(d: Durum, uyeId: number, tutar: number): Durum {
  return {
    ...d,
    uyeler: d.uyeler.map((u) => {
      if (u.id !== uyeId) return u;
      const alinan = Math.min(Math.max(0, Math.round(tutar)), kalanBorc(u));
      if (alinan === 0) return u;
      return { ...u, odenen: u.odenen + alinan, sonOdeme: gunYaz(new Date()) };
    }),
  };
}

/**
 * Üyenin bir sonraki kayıtlı dersi: { gun: "yarın" | "Perşembe", saat }.
 * Açık hesap metni parayı bu derse bağlar ("Perşembe 18:30 dersinizde
 * alabiliriz") — borç hatırlatması değil, gelişin bir parçası gibi okunur.
 */
export function sonrakiDersi(d: Durum, uyeId: number): { gun: string; saat: string } | null {
  const simdi = zamanYaz(new Date());
  const ilk = d.kayitlar
    .filter((k) => k.uyeId === uyeId && k.durum === "kayitli")
    .map((k) => dersAl(d, k.dersId))
    .filter((x): x is Ders => !!x && x.baslar > simdi)
    .sort((a, b) => a.baslar.localeCompare(b.baslar))[0];
  return ilk ? { gun: gunSozu(ilk.baslar), saat: saatOku(ilk.baslar) } : null;
}

/** "Bunu kovalama": satır listede kalır, hatırlatma kurgusuna hiç girmez. */
export function kovalamaDegistir(d: Durum, uyeId: number): Durum {
  return {
    ...d,
    uyeler: d.uyeler.map((u) => (u.id === uyeId ? { ...u, kovalama: !u.kovalama } : u)),
  };
}

const TIP_AYI: Record<string, number> = {
  "Aylık": 1, "3 aylık": 3, "6 aylık": 6, "Yıllık": 12,
};

/**
 * Üyeliği kendi süresi kadar uzatır ve yeni dönemin ödemesini alınmış sayar.
 *
 * Uzatma BUGÜNDEN değil, ESKİ BİTİŞTEN başlar — süresi henüz dolmamış bir
 * üyeyi yenileyince kalan günleri yanmaz. Süresi geçmişse bugünden başlar,
 * yoksa "12 gün önce doldu" diyen bir üyelik uzatıldığında yeni bitiş de
 * geçmişte kalıyordu.
 *
 * AÇIK HESAP VARKEN UZATILMAZ. Yeni dönem "ödendi" sayıldığı için eski
 * kalan SESSİZCE silinirdi: 12.000 ₺ borcu olan biri yenilenince borç
 * sıfırlanırdı — açık hesap ürününün kendi kaydını yemesi. Ekran düğmeyi
 * zaten kapatıyor; bu kontrol ikinci kapı.
 */
export function uyeligiUzat(d: Durum, uyeId: number): Durum {
  return {
    ...d,
    uyeler: d.uyeler.map((u) => {
      if (u.id !== uyeId || kalanBorc(u) > 0) return u;
      const gecti = gunFarki(u.uyelikBitis) < 0;
      const baslangic = gecti ? new Date() : new Date(`${u.uyelikBitis}T00:00:00`);
      const bitis = new Date(baslangic);
      bitis.setMonth(bitis.getMonth() + (TIP_AYI[u.uyelikTipi] ?? 1));
      return {
        ...u,
        uyelikBaslangic: gunYaz(baslangic),
        uyelikBitis: gunYaz(bitis),
        odenen: u.aidat,
        sonOdeme: gunYaz(new Date()),
      };
    }),
  };
}

// ------------------------------------------------------------------ deneme
export const DENEME_GUNLERI = [1, 3, 7] as const;

export interface DenemeSatiri {
  id: number; ad: string; telefon: string; geldi: string;
  durum: string; sonMesaj: number; gecenGun: number; siradaki: number;
}

export function denemeler(d: Durum): DenemeSatiri[] {
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  return d.denemeler
    .map((x) => {
      const gecen = Math.round(
        (bugun.getTime() - new Date(`${x.geldi}T00:00:00`).getTime()) / 86400000,
      );
      const siradaki = x.durum !== "bekliyor"
        ? 0
        : DENEME_GUNLERI.filter((g) => g <= gecen && g > x.sonMesaj).pop() ?? 0;
      return { ...x, gecenGun: gecen, siradaki };
    })
    .sort((a, b) => b.geldi.localeCompare(a.geldi));
}

export function denemeMesajlari(d: Durum, deri: Deri): Mesaj[] {
  return denemeler(d)
    .filter((x) => x.siradaki > 0)
    .map((x) => {
      const metin = deri.mesaj.deneme({
        uye: x.ad.split(" ")[0], seans: deri.seans, saat: "", gun: "",
        egitmen: "", gunNo: x.siradaki,
      });
      const nereye = deri.kod === "psikolog" ? "ilk görüşmeye geldi" : "deneme dersine geldi";
      return {
        tur: "deneme" as const, kimlik: x.id, uye: x.ad, telefon: x.telefon, metin,
        link: whatsappLinki(x.telefon, metin),
        aciklama: `${x.gecenGun} gün önce ${nereye} · ${x.siradaki}. gün mesajı`,
      };
    });
}

export function denemeIsaretle(d: Durum, id: number, ne: string): Durum {
  if (ne === "gonderildi") {
    const x = denemeler(d).find((y) => y.id === id);
    if (!x || x.siradaki === 0) return d;
    return {
      ...d,
      denemeler: d.denemeler.map((y) => (y.id === id ? { ...y, sonMesaj: x.siradaki } : y)),
    };
  }
  if (ne === "kaydoldu" || ne === "ilgilenmiyor" || ne === "bekliyor") {
    return {
      ...d,
      denemeler: d.denemeler.map((y) =>
        (y.id === id ? { ...y, durum: ne as typeof y.durum } : y)),
    };
  }
  return d;
}

// ------------------------------------------------------- online seans/ücret
/**
 * Seans bağlantısı (seansa 30 dk kala) ve ücret hatırlatması (seans bitince,
 * işletmenin KENDİ ödeme linkiyle). Adres girilmemişse mesaj hiç üretilmez —
 * olmayan bir adres vaat edilmez.
 */
export function onlineSeansMesajlari(d: Durum, deri: Deri): Mesaj[] {
  const { onlineLink, odemeLinki } = d.ayar;
  if (!onlineLink && !odemeLinki) return [];

  const simdi = new Date();
  const mesajlar: Mesaj[] = [];

  if (onlineLink) {
    const son = zamanYaz(new Date(simdi.getTime() + 30 * 60000));
    const a = zamanYaz(simdi);
    for (const k of d.kayitlar.filter((x) => x.durum === "kayitli")) {
      const ders = dersAl(d, k.dersId);
      const uye = uyeAl(d, k.uyeId);
      if (!ders || !uye || ders.baslar < a || ders.baslar > son) continue;
      const metin = `Merhaba ${uye.ad.split(" ")[0]}, ${saatOku(ders.baslar)} ` +
        `seansımızın bağlantısı: ${onlineLink}`;
      mesajlar.push({
        tur: "online", uye: uye.ad, telefon: uye.telefon, metin,
        link: whatsappLinki(uye.telefon, metin),
        aciklama: "Seansa 30 dakika kaldı — bağlantı gönderilecek",
      });
    }
  }

  if (odemeLinki) {
    const gunBasi = `${gunYaz(simdi)} 00:00`;
    const simdiStr = zamanYaz(simdi);
    for (const k of d.kayitlar.filter((x) => x.durum === "geldi")) {
      const ders = dersAl(d, k.dersId);
      const uye = uyeAl(d, k.uyeId);
      if (!ders || !uye || ders.baslar < gunBasi || ders.baslar > simdiStr) continue;
      const metin = `Merhaba ${uye.ad.split(" ")[0]}, bugünkü ${deri.seans} için ` +
        `teşekkür ederim. Ücret için: ${odemeLinki}`;
      mesajlar.push({
        tur: "ucret", uye: uye.ad, telefon: uye.telefon, metin,
        link: whatsappLinki(uye.telefon, metin),
        aciklama: `Bugünkü ${deri.seans} tamamlandı — ücret hatırlatması`,
      });
    }
  }
  return mesajlar;
}

// -------------------------------------------------------------- ön form
export function formDoldur(d: Durum, formId: number, yanit: string[]): Durum {
  return {
    ...d,
    formlar: d.formlar.map((f) =>
      (f.id === formId ? { ...f, dolduruldu: gunYaz(new Date()), yanit } : f)),
  };
}

export function formGonder(d: Durum, uyeId: number): Durum {
  if (d.formlar.some((f) => f.uyeId === uyeId && !f.dolduruldu)) return d;
  const yeniId = d.formlar.reduce((t, f) => Math.max(t, f.id), 0) + 1;
  return {
    ...d,
    formlar: [
      ...d.formlar,
      { id: yeniId, uyeId, gonderildi: gunYaz(new Date()), dolduruldu: null, yanit: null },
    ],
  };
}

// ------------------------------------------------------- seans arası günlük
export function gunlukYaz(d: Durum, uyeId: number, ruh: number, notu: string): Durum {
  const bugun = gunYaz(new Date());
  return {
    ...d,
    gunlukler: [
      ...d.gunlukler.filter((g) => !(g.uyeId === uyeId && g.tarih === bugun)),
      { uyeId, tarih: bugun, ruh: Math.max(1, Math.min(5, ruh)), not: notu.slice(0, 200) },
    ].sort((a, b) => a.tarih.localeCompare(b.tarih)),
  };
}

export { saatYaz };

// ======================================================== aylık doluluk özeti
// 5. ürün. Uydurma rapor değil: hepsi elimizdeki kayıtlardan hesaplanıyor.
// Stüdyo sahibinin elle tablo tutarak öğrenebileceği ama pratikte hiç
// tutmadığı şeyler.

export interface SaatDoluluk {
  saat: string;
  ders: number;
  dolu: number;
  kapasite: number;
  oran: number;      // 0-1
}

export interface Ozet {
  gunSayisi: number;
  toplamDers: number;
  yapilanDers: number;
  iptal: number;
  doluluk: number;           // 0-1, geçmiş derslerin ortalaması
  bosKoltuk: number;         // geçmişte boş giden yer sayısı
  saatler: SaatDoluluk[];
  gunler: { gun: string; oran: number; ders: number }[];
  aktifUye: number;
  eriyenUye: number;
  paketiBiten: number;
  denemeToplam: number;
  denemeDonusen: number;
  denemeOrani: number;       // 0-1
}

const GUN_SIRA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function aylikOzet(d: Durum, deri: Deri, gunSayisi = 7): Ozet {
  const bugun = new Date();
  const baslangic = new Date(bugun);
  baslangic.setDate(baslangic.getDate() - gunSayisi);
  const a = `${gunYaz(baslangic)} 00:00`;
  const b = zamanYaz(bugun);

  const gecmis = d.dersler.filter((x) => x.baslar >= a && x.baslar <= b);
  const kayitOf = (dersId: number) => d.kayitlar.filter((k) => k.dersId === dersId);

  let dolu = 0;
  let yer = 0;
  let iptal = 0;
  let yapilan = 0;

  const saatHavuz = new Map<string, { ders: number; dolu: number; kapasite: number }>();
  const gunHavuz = new Map<string, { ders: number; dolu: number; kapasite: number }>();

  for (const ders of gecmis) {
    const kayitlar = kayitOf(ders.id);
    const geldi = kayitlar.filter((k) => k.durum === "geldi").length;
    const iptalSayi = kayitlar.filter((k) => k.durum === "iptal").length;
    if (geldi > 0) yapilan += 1;
    dolu += geldi;
    yer += ders.kapasite;
    iptal += iptalSayi;

    const saat = ders.baslar.slice(11, 16);
    const s = saatHavuz.get(saat) ?? { ders: 0, dolu: 0, kapasite: 0 };
    saatHavuz.set(saat, { ders: s.ders + 1, dolu: s.dolu + geldi, kapasite: s.kapasite + ders.kapasite });

    const g = GUN_SIRA[(new Date(`${ders.baslar.slice(0, 10)}T00:00:00`).getDay() + 6) % 7];
    const gv = gunHavuz.get(g) ?? { ders: 0, dolu: 0, kapasite: 0 };
    gunHavuz.set(g, { ders: gv.ders + 1, dolu: gv.dolu + geldi, kapasite: gv.kapasite + ders.kapasite });
  }

  const saatler: SaatDoluluk[] = [...saatHavuz.entries()]
    .map(([saat, v]) => ({
      saat, ders: v.ders, dolu: v.dolu, kapasite: v.kapasite,
      oran: v.kapasite ? v.dolu / v.kapasite : 0,
    }))
    .sort((x, y) => x.saat.localeCompare(y.saat));

  const gunler = GUN_SIRA
    .filter((g) => gunHavuz.has(g))
    .map((g) => {
      const v = gunHavuz.get(g)!;
      return { gun: g, ders: v.ders, oran: v.kapasite ? v.dolu / v.kapasite : 0 };
    });

  const esik = new Date();
  esik.setDate(esik.getDate() - deri.erimeGun);
  const esikStr = gunYaz(esik);
  const eriyen = d.uyeler.filter(
    (u) => u.paketKalan > 0 && u.katildiSon && u.katildiSon < esikStr).length;

  const donusen = d.denemeler.filter((x) => x.durum === "kaydoldu").length;

  return {
    gunSayisi,
    toplamDers: gecmis.length,
    yapilanDers: yapilan,
    iptal,
    doluluk: yer ? dolu / yer : 0,
    bosKoltuk: Math.max(0, yer - dolu),
    saatler,
    gunler,
    aktifUye: d.uyeler.length - eriyen,
    eriyenUye: eriyen,
    paketiBiten: d.uyeler.filter((u) => u.paketKalan > 0 && u.paketKalan <= 2).length,
    denemeToplam: d.denemeler.length,
    denemeDonusen: donusen,
    denemeOrani: d.denemeler.length ? donusen / d.denemeler.length : 0,
  };
}
