import { NextResponse } from "next/server";
import { readJson } from "@/lib/hunter";
import { runPython } from "@/lib/python";

export const dynamic = "force-dynamic";

// Telefonla aranacak hedefler. Listeyi Python üretir
// (services/radar/hedefleme.py → data/arama_listesi.json); panel yalnız okur.
// Sayfa her açılışta Python süreci başlatmasın diye dosya aradadır; yenileme
// kullanıcı istediğinde POST ile tetiklenir.
//
// İki işlem (9 Eyl 2026, arama listesi v2):
//   POST {action:"havuz"}  → services/radar/havuz.olustur(): Overture (sitesizler dahil)
//                            → muhatap süzgeci → data/havuz.json. Ağa çıkar; önbellek
//                            varsa saniyeler, yeni bölge varsa ~4 dk. Ayda bir / bölge değişince.
//   POST {adet}            → hedefleme.calistir(): havuz.json'dan taze liste. Ağa çıkmaz,
//                            panelde işaretlenenleri atlar. Her arama günü.
const EN_AZ = 5;
const EN_FAZLA = 60;
const HAVUZ_ZAMAN_ASIMI_MS = 8 * 60 * 1000;

interface Liste {
  uretildi?: string;
  tarama?: string;
  bolgeler?: string[];
  hedefler?: unknown[];
}

interface Havuz {
  olusturuldu?: string;
  bolgeler?: string[];
  istatistik?: Record<string, unknown>;
}

export async function GET() {
  const liste = readJson<Liste>("arama_listesi.json", {});
  const havuz = readJson<Havuz>("havuz.json", {});
  return NextResponse.json({
    uretildi: liste.uretildi ?? null,
    tarama: liste.tarama ?? null,
    bolgeler: liste.bolgeler ?? [],
    hedefler: liste.hedefler ?? [],
    havuz: havuz.olusturuldu
      ? { olusturuldu: havuz.olusturuldu, bolgeler: havuz.bolgeler ?? [], istatistik: havuz.istatistik ?? {} }
      : null,
  });
}

export async function POST(req: Request) {
  const govde = await req.json().catch(() => ({}));

  if (govde?.action === "havuz") {
    const r = await runPython(
      [
        "-c",
        "from services.radar.havuz import olustur; v = olustur(); " +
          "print('HAVUZ:', v['istatistik']['aranabilir'])",
      ],
      HAVUZ_ZAMAN_ASIMI_MS,
    );
    const m = r.out.match(/HAVUZ:\s*(\d+)/);
    if (!r.ok || !m)
      return NextResponse.json(
        { ok: false, error: r.out.slice(-400) || "havuz kurulamadı" },
        { status: 500 },
      );
    return NextResponse.json({ ok: true, aranabilir: parseInt(m[1], 10) });
  }

  const istenen = Number(govde?.adet);
  const adet = Number.isFinite(istenen)
    ? Math.min(Math.max(Math.trunc(istenen), EN_AZ), EN_FAZLA)
    : 20;

  const r = await runPython(
    [
      "-c",
      "import sys; from services.radar.hedefleme import calistir; " +
        "print('HEDEF:', len(calistir(adet=int(sys.argv[1]))))",
      String(adet),
    ],
    120000,
  );
  const m = r.out.match(/HEDEF:\s*(\d+)/);
  if (!r.ok || !m)
    return NextResponse.json(
      { ok: false, error: r.out.slice(-400) || "liste üretilemedi" },
      { status: 500 },
    );
  return NextResponse.json({ ok: true, adet: parseInt(m[1], 10) });
}
