import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { DATA } from "@/lib/hunter";
import { runPythonDetached } from "@/lib/python";

export const dynamic = "force-dynamic";

// Demo üretiminin iki aşaması + durum yoklaması tek uçta.
//   POST {asama:"analiz", n}                → içerik çeker, işletmeye özel sorular üretir
//   POST {asama:"uret",   n, slug, cevaplar, stil} → nihai siteyi üretir
//   GET  ?slug=...                          → iş dosyasının güncel hâli
// İkisi de ARKA PLANDA çalışır (dakikalar sürer); panel GET ile yoklar.

function isDosyasi(slug: string): string {
  return path.join(DATA, "demo_jobs", `${slug}.json`);
}

function slugGecerli(slug: unknown): slug is string {
  return typeof slug === "string" && /^[a-z0-9-]+$/.test(slug) && slug.length < 120;
}

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!slugGecerli(slug))
    return NextResponse.json({ ok: false, error: "geçersiz slug" }, { status: 400 });

  const dosya = isDosyasi(slug);
  if (!fs.existsSync(dosya)) return NextResponse.json({ ok: true, is: null });
  try {
    const is = JSON.parse(fs.readFileSync(dosya, "utf-8"));
    // içerik bloğu büyük (tüm sayfa metinleri) — panele göndermeye gerek yok.
    delete is.icerik;
    return NextResponse.json({ ok: true, is });
  } catch {
    return NextResponse.json({ ok: false, error: "iş dosyası okunamadı" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const govde = await req.json().catch(() => ({}));
  const n = Number(govde?.n);
  if (!Number.isInteger(n) || n < 1)
    return NextResponse.json({ ok: false, error: "geçersiz av numarası" }, { status: 400 });

  if (govde?.asama === "analiz") {
    runPythonDetached(["run.py", "--demo-analiz", String(n)]);
    return NextResponse.json({ ok: true, baslatildi: "analiz" });
  }

  if (govde?.asama === "uret") {
    const yuk = JSON.stringify({
      cevaplar: govde?.cevaplar ?? {},
      stil: typeof govde?.stil === "string" ? govde.stil : "sicak",
    });
    runPythonDetached(["run.py", "--demo-uret", String(n)], yuk);
    return NextResponse.json({ ok: true, baslatildi: "uret" });
  }

  return NextResponse.json({ ok: false, error: "bilinmeyen aşama" }, { status: 400 });
}
