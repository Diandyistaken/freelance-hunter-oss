import { NextResponse } from "next/server";
import { runPython } from "@/lib/python";

export const dynamic = "force-dynamic";

// n. avın demo sitesini Cloudflare Pages'te canlı linke çevirir (CLOUDFLARE_API_TOKEN gerekir).
export async function POST(req: Request) {
  const { n } = await req.json().catch(() => ({}));
  if (!Number.isInteger(n) || n < 1)
    return NextResponse.json({ ok: false, error: "geçersiz numara" }, { status: 400 });

  const r = await runPython(["-m", "services.radar.publisher", String(n)], 150000);
  const m = r.out.match(/CANLI:\s*(https?:\/\/\S+)/);
  if (m)
    return NextResponse.json({
      ok: true,
      url: m[1],
      qr: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(m[1])}`,
      qrMenu: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(m[1] + "#menu")}`,
    });

  const tokenYok = r.out.includes("CLOUDFLARE_API_TOKEN");
  return NextResponse.json(
    {
      ok: false,
      error: tokenYok
        ? "CLOUDFLARE_API_TOKEN boş — dash.cloudflare.com'dan ücretsiz 'Cloudflare Pages: Edit' izinli token alıp .env'e yaz."
        : r.out.slice(-300),
    },
    { status: tokenYok ? 400 : 500 },
  );
}
