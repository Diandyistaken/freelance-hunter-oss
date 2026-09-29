import { NextResponse } from "next/server";
import { ilanUrl, openDb } from "@/lib/hunter";

export const dynamic = "force-dynamic";

// Tek ilanın TAM detayı — dashboard'daki tek-tık detay penceresi buradan besleniyor.
// Motor bildirilen her ilanı son_ilanlar tablosuna kaydeder (çeviri, gerekçe,
// scam işaretleri). Telegram'daki ilan detaylarının web karşılığı.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const external_id = decodeURIComponent(id);
  try {
    const db = openDb();
    const row = db
      .prepare(
        `SELECT external_id, platform, lang, title_tr, ceviri_tr, body, url,
                score, sinif, gerekce_tr, red_flags, created_at
         FROM son_ilanlar WHERE external_id = ?`,
      )
      .get(external_id) as Record<string, unknown> | undefined;
    db.close();

    if (!row)
      return NextResponse.json({ ok: false, error: "detay yok" }, { status: 404 });

    // red_flags JSON metin olarak saklanır — diziye çevir.
    let red_flags: string[] = [];
    try {
      red_flags = JSON.parse((row.red_flags as string) || "[]");
    } catch {
      red_flags = [];
    }

    return NextResponse.json({
      ok: true,
      hunt: { ...row, url: ilanUrl(row.url, row.body), red_flags },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 },
    );
  }
}
