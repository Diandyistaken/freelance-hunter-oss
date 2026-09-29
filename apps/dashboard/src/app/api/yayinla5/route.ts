import { NextResponse } from "next/server";
import { runPython } from "@/lib/python";

export const dynamic = "force-dynamic";

const GECERLI_STILLER = [
  "klasik", "scroll", "vitrin", "neon", "imza",
  "aydinlik", "galeri", "zarif", "enerjik", "organik",
];

// n. av için seçilen (veya varsayılan 5) şablon stilini AYNI ANDA Cloudflare
// Pages'te canlı linke çevirir. Esnafa "zaten hazırladım, hangisini beğendiniz?" derken
// hepsi hazır olsun diye — hangi stillerin üretileceğini kullanıcı panelde tikle seçer.
export async function POST(req: Request) {
  const { n, styles } = await req.json().catch(() => ({}));
  if (!Number.isInteger(n) || n < 1)
    return NextResponse.json({ ok: false, error: "geçersiz numara" }, { status: 400 });

  let stilArg = "";
  if (styles !== undefined) {
    if (
      !Array.isArray(styles) ||
      styles.length === 0 ||
      styles.length > GECERLI_STILLER.length ||
      !styles.every((s) => typeof s === "string" && GECERLI_STILLER.includes(s))
    )
      return NextResponse.json({ ok: false, error: "geçersiz şablon seçimi" }, { status: 400 });
    stilArg = styles.join(",");
  }

  const args = ["-m", "services.radar.publisher", "5", String(n)];
  if (stilArg) args.push(stilArg);
  const r = await runPython(args, 300000);
  const eslesmeler = [...r.out.matchAll(/^(\w+): (https?:\/\/\S+)$/gm)];
  if (eslesmeler.length > 0)
    return NextResponse.json({
      ok: true,
      variants: eslesmeler.map(([, stil, url]) => ({
        stil,
        url,
        qr: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`,
        qrMenu: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url + "#menu")}`,
      })),
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
