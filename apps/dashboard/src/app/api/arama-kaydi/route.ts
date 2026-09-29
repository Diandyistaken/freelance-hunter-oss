import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { DATA } from "@/lib/hunter";
import { runPython, runPythonDetached } from "@/lib/python";

export const dynamic = "force-dynamic";

// Arama kaydı: mikrofondan kaydet → yazıya dök → konuşan ayrımı → analiz.
// Kayıt SÜREKLİ bir iş olduğu için arka planda başlatılır (runPythonDetached);
// "dur" yalnız bir işaret dosyası bırakır, kayıt süreci onu görüp kapanır ve
// işlemeyi kendi yapar. Panel durumu data/aramalar/<kimlik>.json'dan okur.
const KAYIT_DIR = path.join(DATA, "aramalar");

interface Kayit {
  kimlik?: string;
  slug?: string;
  asama?: string;
  [k: string]: unknown;
}

function jsonOku<T>(yol: string, varsayilan: T): T {
  try {
    return JSON.parse(fs.readFileSync(yol, "utf-8")) as T;
  } catch {
    return varsayilan;
  }
}

function kayitlar(slug: string | null): Kayit[] {
  if (!fs.existsSync(KAYIT_DIR)) return [];
  return fs
    .readdirSync(KAYIT_DIR)
    .filter((a) => a.endsWith(".json") && !a.startsWith("."))
    .sort()
    .reverse()
    .map((a) => jsonOku<Kayit>(path.join(KAYIT_DIR, a), {}))
    .filter((k) => k.kimlik && (!slug || k.slug === slug));
}

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  const aktif = jsonOku<Kayit | null>(path.join(KAYIT_DIR, ".aktif.json"), null);
  return NextResponse.json({ aktif, kayitlar: kayitlar(slug).slice(0, 20) });
}

export async function POST(req: Request) {
  const govde = await req.json().catch(() => ({}));
  const eylem = String(govde?.action ?? "");

  if (eylem === "basla") {
    const slug = String(govde?.slug ?? "").trim();
    if (!slug) return NextResponse.json({ ok: false, error: "slug gerekli" }, { status: 400 });
    const aktif = jsonOku<Kayit | null>(path.join(KAYIT_DIR, ".aktif.json"), null);
    if (aktif?.kimlik)
      return NextResponse.json({ ok: false, error: "zaten kayıt var", aktif }, { status: 409 });
    // Kayıt + işleme dakikalar sürebilir; arka planda çalışır, panel yoklar.
    runPythonDetached(["run.py", "--kayit", "basla", slug, String(govde?.ad ?? "")]);
    return NextResponse.json({ ok: true });
  }

  if (eylem === "dur") {
    const r = await runPython(["run.py", "--kayit", "dur"], 20000);
    return NextResponse.json({ ok: r.ok, out: r.out.slice(-200) });
  }

  if (eylem === "ters") {
    const kimlik = String(govde?.kimlik ?? "");
    if (!kimlik) return NextResponse.json({ ok: false, error: "kimlik gerekli" }, { status: 400 });
    const r = await runPython(
      ["-c", "import sys; from services.arama.kayit import etiketleri_ters_cevir as t; t(sys.argv[1])", kimlik],
      30000,
    );
    return NextResponse.json({ ok: r.ok, out: r.out.slice(-200) });
  }

  return NextResponse.json({ ok: false, error: "bilinmeyen eylem" }, { status: 400 });
}
