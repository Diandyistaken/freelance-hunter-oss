import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { DATA, openDb } from "@/lib/hunter";

export const dynamic = "force-dynamic";

// Bot kontrolü — Telegram komutlarının web karşılığı.
// Duraklat/sürdür: data/control.json'a yazılır; state.json'ın tek yazarı bot
// olduğundan (yarış olmasın) bot her döngüde bu dosyayı okuyup uygular ve siler.
// Kara liste: doğrudan SQLite'a eklenir (bot her mailde tabloyu taze okur).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const botKomutu =
    body.action === "pause" || body.action === "resume" || body.action === "avci";

  if (botKomutu) {
    const dosya = path.join(DATA, "control.json");
    // Bot komutu uygulayınca dosyayı siliyor. Art arda iki komut verilirse
    // (ör. duraklat + avcıyı kapat) ikincisi birincisini ezmesin diye birleştir.
    let cmd: Record<string, unknown> = {};
    try {
      cmd = JSON.parse(fs.readFileSync(dosya, "utf-8"));
    } catch {
      cmd = {};
    }

    if (body.action === "avci") {
      if (typeof body.enabled !== "boolean") {
        return NextResponse.json(
          { ok: false, error: "enabled alanı boolean olmalı" },
          { status: 400 },
        );
      }
      cmd.avci_kapali = !body.enabled; // enabled=false → freelance avı kapalı
    } else {
      cmd.paused = body.action === "pause";
    }

    fs.writeFileSync(dosya, JSON.stringify(cmd), "utf-8");
    return NextResponse.json({ ok: true, applied: "en geç ~25 sn içinde" });
  }

  if (body.action === "blacklist" && typeof body.pattern === "string" && body.pattern.trim()) {
    try {
      const db = openDb(false);
      db.prepare("INSERT OR IGNORE INTO blacklist (pattern) VALUES (?)").run(
        body.pattern.trim().toLowerCase(),
      );
      db.close();
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: "geçersiz istek" }, { status: 400 });
}
