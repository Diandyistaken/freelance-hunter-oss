import { NextResponse } from "next/server";
import { botAlive, dailyCallCap, openDb, readJson } from "@/lib/hunter";

export const dynamic = "force-dynamic";

// Sistemin canlı durumu: bot süreci, duraklatma, bugünkü sınıflar, AI kullanımı,
// kuyruk ve radar özeti — dashboard'daki kartlar ve durum rozeti buradan beslenir.
export async function GET() {
  let stats: Record<string, number> = {};
  let usage = 0;
  let pending = 0;
  let total = 0;
  try {
    const db = openDb();
    for (const row of db
      .prepare(
        "SELECT sinif, COUNT(*) AS n FROM items WHERE datetime(created_at, 'localtime') >= date('now', 'localtime') GROUP BY sinif",
      )
      .all() as { sinif: string; n: number }[]) {
      stats[row.sinif] = row.n;
    }
    usage =
      (
        db
          .prepare("SELECT calls FROM daily_usage WHERE day = date('now')")
          .get() as { calls: number } | undefined
      )?.calls ?? 0;
    pending = (
      db.prepare("SELECT COUNT(*) AS n FROM pending").get() as { n: number }
    ).n;
    total = (
      db.prepare("SELECT COUNT(*) AS n FROM items").get() as { n: number }
    ).n;
    db.close();
  } catch {
    // veritabanı henüz yoksa boş değerlerle devam
  }

  const state = readJson<{ paused?: boolean; avci_kapali?: boolean }>(
    "state.json",
    {},
  );
  // Panelden verilen komut bot uygulayana kadar control.json'da bekler.
  // Bekleyeni de yansıtmazsak arayüz 10 sn sonra eski değere geri döner.
  const bekleyen = readJson<{ paused?: boolean; avci_kapali?: boolean }>(
    "control.json",
    {},
  );
  const paused = bekleyen.paused ?? state.paused;
  const avciKapali = bekleyen.avci_kapali ?? state.avci_kapali;
  const radar = readJson<{ scanned_at?: string; hits?: unknown[] }>(
    "radar.json",
    {},
  );

  // Token durumları (yalnızca dolu/boş bilgisi — değerler asla gönderilmez)
  let freelancerToken = false;
  let cloudflareToken = false;
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { ROOT } = await import("@/lib/hunter");
    const env = fs.readFileSync(path.join(ROOT, ".env"), "utf-8");
    freelancerToken = /FREELANCER_OAUTH_TOKEN=.+/.test(env);
    cloudflareToken = /CLOUDFLARE_API_TOKEN=.+/.test(env);
  } catch {}

  return NextResponse.json({
    botAlive: await botAlive(),
    paused: !!paused,
    avciKapali: !!avciKapali,
    today: stats,
    totalItems: total,
    aiUsage: usage,
    aiCap: dailyCallCap(),
    pending,
    radarHits: radar.hits?.length ?? 0,
    radarScannedAt: radar.scanned_at ?? null,
    freelancerToken,
    cloudflareToken,
  });
}
