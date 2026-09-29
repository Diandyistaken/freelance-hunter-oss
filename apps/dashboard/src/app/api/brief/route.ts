import { NextResponse } from "next/server";
import { runPython } from "@/lib/python";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { n, stil } = await req.json().catch(() => ({}));
  if (!Number.isInteger(n) || n < 1)
    return NextResponse.json({ ok: false, error: "geçersiz numara" }, { status: 400 });
  if (typeof stil !== "string" || !stil.trim())
    return NextResponse.json({ ok: false, error: "geçersiz stil" }, { status: 400 });

  const r = await runPython(
    ["-m", "services.radar.brief", String(n), stil.trim().toLowerCase()],
    60000,
  );
  const marker = "===BRIEF-BASLA===";
  const markerIndex = r.out.indexOf(marker);
  if (markerIndex !== -1) {
    const path = r.out.match(/^BRIEF-DOSYA:\s*(.+)$/m)?.[1]?.trim() ?? "";
    const brief = r.out.slice(markerIndex + marker.length).replace(/^\r?\n/, "");
    return NextResponse.json({ ok: true, brief, path });
  }

  return NextResponse.json(
    { ok: false, error: r.out.slice(-300) },
    { status: 500 },
  );
}
