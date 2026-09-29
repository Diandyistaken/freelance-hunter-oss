import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { DATA, openDb, readJson } from "@/lib/hunter";
import { utcOku } from "@/lib/zaman";

export const dynamic = "force-dynamic";

// KİM ARADI? — geri dönen numarayı isme çevirir.
//
// YAŞANAN SORUN (kullanıcı, 22 Eyl 2026): "Arıyorum, açmıyorlar. Sonradan
// onlar beni arıyor. Ekranda '...29 38' diye bir numara görüyorum, adam
// 'bizi aramışsınız' diyor ve ben o yerin kim olduğunu, ne konuştuğumuzu
// bulmakta çok zorlanıyorum."
//
// Aranacak evren üç katman, ÖNEM SIRASIYLA:
//   1. radar_durum — GERÇEKTEN aradığın ve bir karara bağladığın yerler.
//      En zengin kayıt: ne konuştunuz, kaç kez denedin, ne zaman.
//   2. arama_listesi.json — bugünkü arama listesi (20 hedef).
//   3. havuz.json — bulunmuş ama henüz aranmamış ~11.000 işletme.
//      Numara buradaysa "aramışsınız" diyen kişi büyük ihtimalle senin
//      listeye aldığın ama sıranın gelmediği bir yerdir.
//
// ARAMA KURALI: hem PARÇA hem TAM numara. Ekranda bazen son haneler
// görünür ("…22 33"), bazen numaranın tamamı ("0555 111 22 33",
// "+90 555 111 22 33"). Kayıtlar 0/+90 ayıklanmış hâlde karşılaştırılıyor;
// SORGU DA AYNI ŞEKİLDE AYIKLANMAK ZORUNDA. Ayıklanmadığı bir sürüm vardı ve
// ölçüldü: "2233" kaydı buluyordu, "0555 111 22 33" bulmuyordu — üstelik
// ekran bu durumda "kayıtlarda yok, tanımadığın biri olabilir" diyordu, yani
// randevu verilmiş bir müşteriyi yabancı gibi gösteriyordu.

const EN_AZ_HANE = 3;

/** Sorguyu kayıtlarla AYNI biçime getirir. Yalnız TAM numarada (11+ hane)
 *  ön ek atılır: "0044" gibi kısa bir parçanın baştaki sıfırı ön ek değil,
 *  numaranın kendi hanesidir ve atılırsa arama sessizce genişler. */
function sorguyuAyikla(ham: string): string {
  const rakam = ham.replace(/\D/g, "");
  return rakam.length > 10 ? sadeNumara(rakam) : rakam;
}
const TAVAN = 25;

interface Isletme {
  name?: string;
  kind_tr?: string;
  phone?: string;
  bolge?: string;
  street?: string;
  website?: string;
}

interface Hedef {
  slug?: string;
  ad?: string;
  sektor?: string;
  telefon?: string;
  bolge?: string;
  adres?: string;
  urun?: string;
}

interface Havuz {
  olusturuldu?: string;
  isletmeler?: Isletme[];
}

interface Liste {
  hedefler?: Hedef[];
}

export interface Bulgu {
  ad: string;
  telefon: string;
  sektor: string;
  bolge: string;
  adres: string;
  /** "arandi" | "dusunuyor" | ... — yalnız radar_durum'da varsa dolu. */
  durum: string | null;
  not: string | null;
  neZaman: string | null;
  deneme: number | null;
  slug: string | null;
  urun: string | null;
  kaynak: "arandi" | "liste" | "havuz";
  /** Numara TAM OLARAK bu hanelerle bitiyor mu? Ekranda görünen şey
   *  numaranın sonu olduğu için bitenler listenin başına geçer. */
  tam: boolean;
  /** Tıklanınca gidilecek sayfa — kayıt üzerinde iş yapılabilen yer.
   *  Havuzdaki (hiç aranmamış) kaydın sayfası yok: null. */
  sayfa: "/dusunenler" | "/arama-listesi" | null;
}

/** Rakam dışındaki her şeyi at, baştaki 0 ve 90'ı kırp.
 *  "0555 444 55 66" · "+90 555 444 5566" · "555-444-5566" → "5554445566" */
function sadeNumara(ham: string): string {
  const rakam = (ham ?? "").replace(/\D/g, "");
  if (rakam.startsWith("90") && rakam.length > 10) return rakam.slice(2);
  if (rakam.startsWith("0") && rakam.length > 10) return rakam.slice(1);
  return rakam;
}

// HAVUZ ÖNBELLEĞİ: dosya 5 MB ve 11.000 kayıt. Her tuş vuruşunda diskten
// okumak arama kutusunu kullanılamaz hâle getirir. Dosya değişmediyse
// (mtime aynı) bellekteki dizin kullanılır.
let havuzDizini: { mtime: number; kayitlar: (Isletme & { sade: string })[] } | null = null;

function havuzuAl(): (Isletme & { sade: string })[] {
  const yol = path.join(DATA, "havuz.json");
  let mtime = 0;
  try {
    mtime = fs.statSync(yol).mtimeMs;
  } catch {
    return [];
  }
  if (havuzDizini && havuzDizini.mtime === mtime) return havuzDizini.kayitlar;

  const havuz = readJson<Havuz>("havuz.json", {});
  const kayitlar = (havuz.isletmeler ?? [])
    .filter((i) => i.phone)
    .map((i) => ({ ...i, sade: sadeNumara(i.phone ?? "") }))
    .filter((i) => i.sade.length >= 7);
  havuzDizini = { mtime, kayitlar };
  return kayitlar;
}

interface DurumSatiri {
  slug: string;
  ad: string | null;
  tur: string | null;
  telefon: string | null;
  durum: string;
  not_metni: string | null;
  deneme: number | null;
  guncelleme: string | null;
}

function durumSatirlari(): DurumSatiri[] {
  try {
    const db = openDb(true);
    try {
      return db
        .prepare(
          `SELECT slug, ad, tur, telefon, durum, not_metni, deneme, guncelleme
             FROM radar_durum ORDER BY guncelleme DESC`,
        )
        .all() as DurumSatiri[];
    } finally {
      db.close();
    }
  } catch {
    // Tablo henüz yoksa arama yine çalışsın — havuz tek başına da iş görür.
    return [];
  }
}

/** Kenar çubuğu listesi kaç günü kapsar (bugün dahil) ve en fazla kaç satır. */
const SON_GUN = 7;
const SON_TAVAN = 40;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sonMu = url.searchParams.get("son") === "1";
  const satirlar = durumSatirlari();

  // --- "son aradıkların": kenar çubuğundaki liste -------------------------
  // Arama kutusuna hiç dokunmadan gözle bulunabilsin diye ayrı uç.
  //
  // SON 7 GÜN, "BUGÜN" DEĞİL. İlk sürüm yalnız bugünü veriyordu ve liste gece
  // yarısı boşalıyordu — oysa geri dönüş çoğu zaman ertesi gün gelir (22 Eyl
  // şikâyeti de böyleydi). Kullanıcı 25 Eyl sabahı kenar çubuğunda boş bir
  // kutu gördü ve "aradıklarım nerede" diye sordu.
  if (sonMu) {
    // YEREL gün sınırı: UTC ile kesilince gece 00:00-03:00 arası yapılan
    // arama bir önceki güne yazılıyordu.
    const esik = new Date();
    esik.setHours(0, 0, 0, 0);
    esik.setDate(esik.getDate() - (SON_GUN - 1));
    const liste = satirlar
      .filter((s) => {
        const t = utcOku(s.guncelleme);
        return t !== null && t >= esik;
      })
      .slice(0, SON_TAVAN)
      .map((s) => ({
        ad: s.ad || "(ad yok)",
        telefon: s.telefon || "",
        durum: s.durum,
        not: s.not_metni,
        neZaman: utcOku(s.guncelleme)?.toISOString() ?? null,
        slug: s.slug,
      }));
    return NextResponse.json({ son: liste, gun: SON_GUN });
  }

  // --- numara araması -----------------------------------------------------
  const aranan = sorguyuAyikla(url.searchParams.get("q") ?? "");
  if (aranan.length < EN_AZ_HANE) {
    return NextResponse.json({ bulgular: [], not: `En az ${EN_AZ_HANE} hane yaz.` });
  }

  const bulgular: Bulgu[] = [];
  const numaradan = new Map<string, Bulgu>();

  const ekle = (b: Omit<Bulgu, "tam" | "sayfa">) => {
    const anahtar = sadeNumara(b.telefon);
    if (!anahtar) return;
    // Aynı numara birden fazla katmanda olabilir. Katmanlar önem sırasıyla
    // taranır, yani "aradın" kaydı KALIR — ama sonraki katmanın bildiği ve
    // onun bilmediği alanlar ATILMAZ, doldurulur. Eskiden atılıyordu:
    // radar_durum'da bölge ve ürün yok, bugünkü listede var; geri arayan
    // kişinin hangi ürünle arandığı tam da ihtiyaç anında kayboluyordu.
    const mevcut = numaradan.get(anahtar);
    if (mevcut) {
      mevcut.bolge ||= b.bolge;
      mevcut.adres ||= b.adres;
      mevcut.sektor ||= b.sektor;
      mevcut.urun ??= b.urun;
      mevcut.slug ??= b.slug;
      return;
    }
    const yeni: Bulgu = { ...b, tam: anahtar.endsWith(aranan), sayfa: null };
    numaradan.set(anahtar, yeni);
    bulgular.push(yeni);
  };

  // 1. Aradıkların
  for (const s of satirlar) {
    if (!sadeNumara(s.telefon ?? "").includes(aranan)) continue;
    ekle({
      ad: s.ad || "(ad yok)",
      telefon: s.telefon || "",
      sektor: s.tur || "",
      bolge: "",
      adres: "",
      durum: s.durum,
      not: s.not_metni,
      neZaman: utcOku(s.guncelleme)?.toISOString() ?? null,
      deneme: s.deneme ?? 0,
      slug: s.slug,
      urun: null,
      kaynak: "arandi",
    });
  }

  // 2. Bugünkü arama listesi
  const liste = readJson<Liste>("arama_listesi.json", {});
  const listeSluglari = new Set(
    (liste.hedefler ?? []).map((h) => h.slug).filter((s): s is string => !!s),
  );
  for (const h of liste.hedefler ?? []) {
    if (!sadeNumara(h.telefon ?? "").includes(aranan)) continue;
    ekle({
      ad: h.ad || "(ad yok)",
      telefon: h.telefon || "",
      sektor: h.sektor || "",
      bolge: h.bolge || "",
      adres: h.adres || "",
      durum: null,
      not: null,
      neZaman: null,
      deneme: null,
      slug: h.slug ?? null,
      urun: h.urun ?? null,
      kaynak: "liste",
    });
  }

  // 3. Havuz
  // TAVAN'a gore erken cikilmiyor: sonla biten kayit listenin sonunda
  // olabilir ve tam da aradigimiz o. Once hepsi toplanir, siralama
  // yapildiktan sonra kesilir.
  for (const i of havuzuAl()) {
    if (!i.sade.includes(aranan)) continue;
    ekle({
      ad: i.name || "(ad yok)",
      telefon: i.phone || "",
      sektor: i.kind_tr || "",
      bolge: i.bolge || "",
      adres: i.street || "",
      durum: null,
      not: null,
      neZaman: null,
      deneme: null,
      slug: null,
      urun: null,
      kaynak: "havuz",
    });
  }

  // NEREYE GİDİLİR — kullanıcının açık isteği: "üzerine tıkladığımda beni
  // ilgili yere göndersin." İlgili yer, o kayıt üzerinde İŞ YAPILABİLEN
  // sayfadır: düşünen biri geri aradıysa notunu güncelleyip "arandı"
  // diyebileceğin Düşünenler kartı; bugünkü listedeyse konuşma adımlarının
  // durduğu arama kartı. Havuzdaki (hiç aranmamış) kaydın kartı yok — yeri
  // uydurulmaz, satırın kendisi yeterli.
  for (const b of bulgular) {
    if (b.durum === "dusunuyor" && b.slug) b.sayfa = "/dusunenler";
    else if (b.slug && listeSluglari.has(b.slug)) b.sayfa = "/arama-listesi";
  }

  // SIRALAMA: once sonla bitenler, sonra kaynak onemine gore
  // (aradiklarin > bugunku liste > havuz). Ikisi de esitse sira korunur.
  const kaynakSirasi = { arandi: 0, liste: 1, havuz: 2 } as const;
  bulgular.sort((a, b) =>
    (b.tam ? 1 : 0) - (a.tam ? 1 : 0)
    || kaynakSirasi[a.kaynak] - kaynakSirasi[b.kaynak]);

  const tamSayisi = bulgular.filter((b) => b.tam).length;
  return NextResponse.json({
    bulgular: bulgular.slice(0, TAVAN),
    aranan,
    tamSayisi,
    toplam: bulgular.length,
  });
}
