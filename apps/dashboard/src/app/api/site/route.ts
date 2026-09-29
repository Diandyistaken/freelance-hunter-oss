import { NextResponse } from "next/server";
import { runPython } from "@/lib/python";

export const dynamic = "force-dynamic";

const STIL_RE = /^[a-z0-9-]{1,20}$/;

// Radar listesindeki n. av için demo site üretir (python run.py --site n).
// Dönen slug ile /api/demo/<slug> üzerinden önizlenir.
export async function POST(req: Request) {
  const { n, stil } = await req.json().catch(() => ({}));
  if (!Number.isInteger(n) || n < 1)
    return NextResponse.json({ ok: false, error: "geçersiz numara" }, { status: 400 });
  if (stil !== undefined && (typeof stil !== "string" || !STIL_RE.test(stil)))
    return NextResponse.json({ ok: false, error: "geçersiz stil" }, { status: 400 });

  const args = ["run.py", "--site", String(n)];
  if (stil) args.push(stil);
  const r = await runPython(args);
  // Beklenen çıktı: "✅ İdeal Fırın (Fırın/Pastane) → C:\...\ideal-firin.html"
  const m = r.out.match(/→\s*(.+\.html)/);
  if (!r.ok || !m)
    return NextResponse.json({ ok: false, error: r.out.slice(-300) }, { status: 500 });

  const slug = m[1].replace(/\\/g, "/").split("/").pop()!.replace(/\.html$/, "");
  return NextResponse.json({ ok: true, slug, preview: `/api/demo/${slug}` });
}
