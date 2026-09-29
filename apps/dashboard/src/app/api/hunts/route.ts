import { NextResponse } from "next/server";
import { ilanUrl, openDb } from "@/lib/hunter";

export const dynamic = "force-dynamic";

interface PlatformStatRow {
  source: string;
  today: number;
  notified: number;
}

interface PlatformStat {
  platform: string;
  today: number;
  notified: number;
}

function canonicalPlatform(source: string): string {
  return source.toLocaleLowerCase("en-US").startsWith("freelancer.com")
    ? "Freelancer.com"
    : source;
}

// Gerçek av listesi — motorun SQLite'a yazdığı işlenmiş ilanlar.
// Varsayılan: eleme dışındaki son 30 kayıt; ?all=1 ile eleme de dahil edilir.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const all = params.get("all") === "1";
  const sinif = params.get("sinif");
  const rawPlatform = params.get("platform")?.trim();
  const platform = rawPlatform && rawPlatform.length <= 100 ? rawPlatform : null;
  const requestedLimit = Number.parseInt(params.get("limit") ?? "", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 200)
    : 30;
  const requestedHours = Number.parseInt(params.get("saat") ?? "", 10);
  const hours = Number.isFinite(requestedHours)
    ? Math.min(Math.max(requestedHours, 1), 720)
    : null;
  try {
    const db = openDb();

    if (sinif && hours) {
      // kapali_neden kolonunu Python botu migrate eder; bot bu sürüme henüz
      // güncellenmemişse kolon yoktur — sorgu ona göre kurulur, sayfa kırılmaz.
      const hasKapaliNeden = (
        db.prepare("PRAGMA table_info(son_ilanlar)").all() as { name: string }[]
      ).some((col) => col.name === "kapali_neden");
      const rows = db
        .prepare(
          `SELECT external_id, platform AS source, title_tr AS title, lang,
                  score, sinif, created_at, url, body
           FROM son_ilanlar
           WHERE sinif = ?
             AND datetime(created_at) >= datetime('now', ?)
             ${hasKapaliNeden ? "AND kapali_neden IS NULL" : ""}
           ORDER BY datetime(created_at) DESC`,
        )
        .all(sinif, `-${hours} hours`) as Record<string, unknown>[];
      db.close();
      const hunts = rows.map(({ body, ...row }) => ({
        ...row,
        url: ilanUrl(row.url, body),
      }));
      return NextResponse.json({ hunts, elemeCount: 0 });
    }

    const platformRows = db
      .prepare(
        `SELECT source,
                SUM(CASE WHEN datetime(created_at, 'localtime') >= date('now', 'localtime') THEN 1 ELSE 0 END) AS today,
                SUM(CASE WHEN notified_at IS NOT NULL
                              AND datetime(notified_at, 'localtime') >= date('now', 'localtime')
                         THEN 1 ELSE 0 END) AS notified
         FROM items
         GROUP BY source
         ORDER BY source COLLATE NOCASE`,
      )
      .all() as unknown as PlatformStatRow[];
    const platformMap = new Map<string, PlatformStat>();
    for (const row of platformRows) {
      const name = canonicalPlatform(row.source);
      const current = platformMap.get(name) ?? {
        platform: name,
        today: 0,
        notified: 0,
      };
      current.today += Number(row.today) || 0;
      current.notified += Number(row.notified) || 0;
      platformMap.set(name, current);
    }
    const platforms = Array.from(platformMap.values());

    const canonicalSource =
      "CASE WHEN lower(i.source) LIKE 'freelancer.com%' THEN 'Freelancer.com' ELSE i.source END";
    const conditions: string[] = [];
    const queryArgs: (string | number)[] = [];
    if (!all) conditions.push("i.sinif NOT LIKE 'eleme%'");
    if (platform) {
      conditions.push(`${canonicalSource} = ? COLLATE NOCASE`);
      queryArgs.push(platform);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = db
      .prepare(
        `SELECT i.external_id, i.source, i.title, i.lang, i.score, i.sinif,
                i.created_at, s.url AS url, s.body AS body
         FROM items i
         LEFT JOIN son_ilanlar s ON s.external_id = i.external_id
         ${where}
         ORDER BY i.created_at DESC LIMIT ?`,
      )
      .all(...queryArgs, limit) as Record<string, unknown>[];
    const total = (
      db
        .prepare(`SELECT COUNT(*) AS n FROM items i ${where}`)
        .get(...queryArgs) as { n: number }
    ).n;
    const elemeConditions = platform
      ? `WHERE i.sinif LIKE 'eleme%' AND ${canonicalSource} = ? COLLATE NOCASE`
      : "WHERE i.sinif LIKE 'eleme%'";
    const eleme = (
      db
        .prepare(`SELECT COUNT(*) AS n FROM items i ${elemeConditions}`)
        .get(...(platform ? [platform] : [])) as { n: number }
    ).n;
    db.close();
    const hunts = rows.map(({ body, ...row }) => ({
      ...row,
      url: ilanUrl(row.url, body),
    }));
    return NextResponse.json({ hunts, elemeCount: eleme, platforms, total, limit });
  } catch {
    return NextResponse.json({
      hunts: [],
      elemeCount: 0,
      platforms: [],
      total: 0,
      limit,
    });
  }
}
