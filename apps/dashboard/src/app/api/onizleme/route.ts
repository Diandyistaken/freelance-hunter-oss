import { NextResponse } from "next/server";
import { runPython } from "@/lib/python";

export const dynamic = "force-dynamic";

// Radar listesindeki n. av için TÜM şablonların önizlemesini üretir
// (yayınlamadan, sadece data/demo_sites/<slug>--<stil>.html olarak) — şablon
// seçici / çoklu yayınla modallarında hover önizlemesi için kullanılır.
export async function POST(req: Request) {
  const { n } = await req.json().catch(() => ({}));
  if (!Number.isInteger(n) || n < 1)
    return NextResponse.json({ ok: false, error: "geçersiz numara" }, { status: 400 });

  const r = await runPython(["run.py", "--onizlemeler", String(n)]);
  if (!r.ok)
    return NextResponse.json({ ok: false, error: r.out.slice(-300) }, { status: 500 });

  return NextResponse.json({ ok: true });
}
