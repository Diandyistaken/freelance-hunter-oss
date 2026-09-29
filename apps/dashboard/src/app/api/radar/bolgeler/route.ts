import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { DATA } from "@/lib/hunter";
import { runPython } from "@/lib/python";

export const dynamic = "force-dynamic";

// Bölge kataloğu + kullanıcının seçimi.
//   GET  → kategorili semt listesi + şu an seçili olanlar
//   POST → { secilen: string[] } yeni seçimi kaydeder
// Katalog Python tarafında (packages/shared/bolgeler.py) tek kaynak; panel
// onu okur, koordinat kopyalamaz.

const SECIM_DOSYA = path.join(DATA, "radar_bolge_secim.json");

export async function GET() {
  const r = await runPython(
    [
      "-c",
      "import json;from packages.shared.bolgeler import kategoriler;" +
        "print('KATALOG:'+json.dumps(kategoriler(),ensure_ascii=False))",
    ],
    60000,
  );
  const m = r.out.match(/KATALOG:(\{[\s\S]*\})/);
  if (!r.ok || !m)
    return NextResponse.json({ ok: false, error: r.out.slice(-300) }, { status: 500 });

  let secilen: string[] = [];
  try {
    secilen = JSON.parse(fs.readFileSync(SECIM_DOSYA, "utf-8")).secilen ?? [];
  } catch {
    secilen = [];
  }
  return NextResponse.json({ ok: true, kategoriler: JSON.parse(m[1]), secilen });
}

export async function POST(req: Request) {
  const govde = await req.json().catch(() => ({}));
  const gelen = Array.isArray(govde?.secilen) ? govde.secilen : null;
  if (!gelen)
    return NextResponse.json({ ok: false, error: "secilen listesi gerekli" }, { status: 400 });

  // Yalnız güvenli metinler: dosyaya yazılacak, ayrıca Python tarafında
  // katalogda olmayan ad zaten atlanıyor (çift savunma).
  const temiz: string[] = gelen
    .filter((a: unknown): a is string => typeof a === "string")
    .map((a: string) => a.trim())
    .filter((a: string) => a.length > 0 && a.length < 60)
    .slice(0, 40);

  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(
    SECIM_DOSYA,
    JSON.stringify({ secilen: temiz, guncelleme: new Date().toISOString() }, null, 1),
    "utf-8",
  );
  return NextResponse.json({ ok: true, secilen: temiz });
}
