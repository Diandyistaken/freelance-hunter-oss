import { NextResponse } from "next/server";
import { openDb } from "@/lib/hunter";

export const dynamic = "force-dynamic";

// Kara liste yönetimi — Telegram'daki /karaliste komutunun web karşılığı.
export async function GET() {
  try {
    const db = openDb();
    const patterns = (
      db.prepare("SELECT pattern, created_at FROM blacklist ORDER BY created_at DESC").all() as {
        pattern: string;
        created_at: string;
      }[]
    );
    db.close();
    return NextResponse.json({ patterns });
  } catch {
    return NextResponse.json({ patterns: [] });
  }
}

export async function POST(req: Request) {
  const { pattern } = await req.json().catch(() => ({}));
  if (typeof pattern !== "string" || !pattern.trim())
    return NextResponse.json({ ok: false, error: "kalıp boş" }, { status: 400 });
  const db = openDb(false);
  db.prepare("INSERT OR IGNORE INTO blacklist (pattern) VALUES (?)").run(
    pattern.trim().toLowerCase(),
  );
  db.close();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { pattern } = await req.json().catch(() => ({}));
  if (typeof pattern !== "string" || !pattern)
    return NextResponse.json({ ok: false, error: "kalıp boş" }, { status: 400 });
  const db = openDb(false);
  db.prepare("DELETE FROM blacklist WHERE pattern = ?").run(pattern);
  db.close();
  return NextResponse.json({ ok: true });
}
