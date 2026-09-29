import { NextResponse } from "next/server";
import { openDb } from "@/lib/hunter";
import { sonrakiDeneme, zamanYaz } from "@/lib/tekrarSaati";

export const dynamic = "force-dynamic";

// Radar avlarını "aradım / aramadım / düşünüyor" olarak işaretleyip
// hatırlamak için — harita ve av listesi ortak bu tabloyu okur/yazar, tarama
// yenilense bile (radar.json her tarama üzerine yazılır) işaretler kalıcı kalsın diye.
// "randevu" 4 Eyl 2026'da eklendi: arama listesinin tek ölçüsü "20 arama kaç
// yüz yüze randevuya döndü" — bunu "arandi" içinde saklarsak ölçemeyiz.
// "ulasilamadi" 11 Eyl 2026'da eklendi: açılmayan arama bir KARAR değil, bir
// DENEME. Hedef listeden düşmez; deneme sayacı artar ve farklı bir saat dilimine
// kayar (bkz. lib/tekrarSaati.ts). Motor tarafında TEKRAR_TAVANI'na kadar
// listede kalır (services/radar/hedefleme.py).
const DURUMLAR = new Set([
  "arandi", "gizli", "dusunuyor", "kapandi", "olmaz", "musteri", "randevu",
  "ulasilamadi",
]);

function tabloyuGarantiEt(db: ReturnType<typeof openDb>) {
  db.exec(`CREATE TABLE IF NOT EXISTS radar_durum (
    slug TEXT PRIMARY KEY,
    ad TEXT,
    tur TEXT,
    telefon TEXT,
    durum TEXT NOT NULL,
    guncelleme TEXT DEFAULT (datetime('now'))
  )`);
  // Eski tablolarda not_metni kolonu yok — sessizce ekle (zaten varsa hata
  // yutulur). "Kaçta arayacağım/ne dedi" gibi serbest notlar için.
  for (const kolon of [
    "not_metni TEXT",
    "deneme INTEGER DEFAULT 0",   // kaç kez arandı da açılmadı
    "tekrar_saat TEXT",           // bir sonraki denemenin hedef zamanı
  ]) {
    try {
      db.exec(`ALTER TABLE radar_durum ADD COLUMN ${kolon}`);
    } catch {
      // kolon zaten var
    }
  }
}

export async function GET() {
  try {
    // Yazma modunda açılıyor: eski kurulumlarda not_metni kolonu eksik
    // olabilir, tabloyuGarantiEt onu burada da (okumadan önce) tamamlar.
    const db = openDb(false);
    try {
      const exists = db
        .prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'radar_durum'")
        .get() as { found: number } | undefined;
      if (!exists) return NextResponse.json({ durumlar: {} });

      tabloyuGarantiEt(db);

      const rows = db
        .prepare(
          `SELECT slug, ad, tur, telefon, durum, not_metni,
                  COALESCE(deneme, 0) AS deneme, tekrar_saat, guncelleme
           FROM radar_durum`,
        )
        .all() as {
          slug: string;
          ad: string;
          tur: string | null;
          telefon: string | null;
          durum: string;
          not_metni: string | null;
          deneme: number;
          tekrar_saat: string | null;
          guncelleme: string;
        }[];

      const durumlar: Record<string, typeof rows[number]> = {};
      for (const row of rows) durumlar[row.slug] = row;
      return NextResponse.json({ durumlar });
    } finally {
      db.close();
    }
  } catch {
    return NextResponse.json({ durumlar: {} });
  }
}

export async function POST(req: Request) {
  const { slug, ad, tur, telefon, durum, not, yeniDeneme } = await req.json().catch(() => ({}));
  if (typeof slug !== "string" || !slug || typeof durum !== "string" || !DURUMLAR.has(durum))
    return NextResponse.json({ ok: false, error: "geçersiz istek" }, { status: 400 });

  // "not" gönderilmediyse (ör. sadece arandı/gizli/düşünüyor değiştirilirken)
  // mevcut notu SİLME — COALESCE eski değeri korur. Boş string "" gönderilirse
  // (kullanıcı notu bilerek temizlerse) bu geçerli bir değerdir, üzerine yazılır.
  const notMetni = typeof not === "string" ? not : null;

  const db = openDb(false);
  try {
    tabloyuGarantiEt(db);

    // Deneme sayacı YALNIZCA açılmayan gerçek bir arama bildirildiğinde artar.
    // Aynı kayda not yazmak ya da başka bir durumu işaretlemek sayacı bozmaz.
    const mevcut = db
      .prepare("SELECT COALESCE(deneme, 0) AS deneme FROM radar_durum WHERE slug = ?")
      .get(slug) as { deneme: number } | undefined;
    const sayacArtsin = yeniDeneme === true && durum === "ulasilamadi";
    const deneme = (mevcut?.deneme ?? 0) + (sayacArtsin ? 1 : 0);
    // Konuşma gerçekleştiyse tekrar kuyruğunda işi kalmaz.
    const tekrarSaat = durum === "ulasilamadi" ? zamanYaz(sonrakiDeneme()) : null;

    db.prepare(
      `INSERT INTO radar_durum
         (slug, ad, tur, telefon, durum, not_metni, deneme, tekrar_saat, guncelleme)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(slug) DO UPDATE SET
         ad = excluded.ad, tur = excluded.tur, telefon = excluded.telefon,
         durum = excluded.durum,
         not_metni = COALESCE(excluded.not_metni, radar_durum.not_metni),
         deneme = excluded.deneme,
         tekrar_saat = excluded.tekrar_saat,
         guncelleme = excluded.guncelleme`,
    ).run(slug, ad ?? "", tur ?? "", telefon ?? "", durum, notMetni, deneme, tekrarSaat);
    return NextResponse.json({ ok: true, deneme, tekrar_saat: tekrarSaat });
  } finally {
    db.close();
  }
}

export async function DELETE(req: Request) {
  const { slug } = await req.json().catch(() => ({}));
  if (typeof slug !== "string" || !slug)
    return NextResponse.json({ ok: false, error: "geçersiz istek" }, { status: 400 });

  const db = openDb(false);
  try {
    tabloyuGarantiEt(db);
    db.prepare("DELETE FROM radar_durum WHERE slug = ?").run(slug);
    return NextResponse.json({ ok: true });
  } finally {
    db.close();
  }
}
