import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { DATA } from "@/lib/hunter";

export const dynamic = "force-dynamic";

// Üretilen demoyu servis eder. İki biçim:
//   · KLASÖR (yeni sıfırdan tasarım): /api/demo/<slug>--fable → index.html
//     ve /api/demo/<slug>--fable/img/foto01.jpg → indirilmiş fotoğraf
//   · TEK DOSYA (eski şablon çıktıları): /api/demo/<slug> → <slug>.html
const TIPLER: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  // Yol geçişi koruması: her parça yalnız güvenli karakterler, ".." yok.
  if (!slug?.length || slug.some((p) => !/^[a-zA-Z0-9._-]+$/.test(p) || p.startsWith(".")))
    return new NextResponse("geçersiz ad", { status: 400 });

  const kok = path.join(DATA, "demo_sites");
  const klasor = path.join(kok, slug[0]);
  const hedef =
    slug.length > 1
      ? path.join(klasor, ...slug.slice(1))
      : fs.existsSync(path.join(klasor, "index.html"))
        ? path.join(klasor, "index.html")
        : path.join(kok, `${slug[0]}.html`);

  // İkinci savunma: çözülen yol demo klasörünün dışına çıkamaz.
  if (!path.resolve(hedef).startsWith(path.resolve(kok)))
    return new NextResponse("geçersiz yol", { status: 400 });
  if (!fs.existsSync(hedef) || !fs.statSync(hedef).isFile())
    return new NextResponse("demo bulunamadı — önce üret", { status: 404 });

  const tip = TIPLER[path.extname(hedef).toLowerCase()] ?? "application/octet-stream";

  // Klasörlü demo /api/demo/<slug> adresinde (sonda eğik çizgi YOK) açılıyor;
  // bu yüzden HTML'deki göreli "img/foto01.jpg" tarayıcıda /api/demo/img/...
  // olarak çözülüyor ve fotoğraflar kırılıyordu. <base> etiketini SERVİS
  // SIRASINDA ekliyoruz — diskteki dosya göreli kalır (Cloudflare'e klasör
  // olarak yayınlanınca index.html + img/ yan yana çalışsın diye).
  if (slug.length === 1 && hedef.endsWith("index.html")) {
    const html = fs.readFileSync(hedef, "utf-8");
    const taban = `<base href="/api/demo/${slug[0]}/">`;
    const cikti = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${taban}`)
      : `${taban}\n${html}`;
    return new NextResponse(cikti, {
      headers: { "Content-Type": tip, "Cache-Control": "no-store" },
    });
  }

  return new NextResponse(new Uint8Array(fs.readFileSync(hedef)), {
    headers: { "Content-Type": tip, "Cache-Control": "no-store" },
  });
}
