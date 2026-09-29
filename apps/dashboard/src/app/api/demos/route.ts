import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { DATA } from "@/lib/hunter";

export const dynamic = "force-dynamic";

// Şimdiye kadar üretilmiş demo sitelerin listesi (yeniden eskiye).
export async function GET() {
  const dir = path.join(DATA, "demo_sites");
  try {
    const demos = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".html"))
      .map((f) => {
        const st = fs.statSync(path.join(dir, f));
        return { slug: f.replace(/\.html$/, ""), mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return NextResponse.json({ demos });
  } catch {
    return NextResponse.json({ demos: [] });
  }
}
