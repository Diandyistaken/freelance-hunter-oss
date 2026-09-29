import { NextResponse } from "next/server";
import { runPython } from "@/lib/python";

export const dynamic = "force-dynamic";

// RADAR v2: iyi giden işletme + kötü/görünmez site → sıcak lead listesi.
// Overture (işletme keşfi, önbellekli) → yasal site denetimi → iki eksenli skor.
// `tavan` = bu turda kaç YENİ site denetlenecek; denetimler 30 gün
// önbelleklendiği için ardışık turlar havuzu kümülatif tarar.
const VARSAYILAN_TAVAN = 80;
const EN_FAZLA_TAVAN = 400;

export async function POST(req: Request) {
  const govde = await req.json().catch(() => ({}));
  const istenen = Number(govde?.tavan);
  const tavan = Number.isFinite(istenen)
    ? Math.min(Math.max(Math.trunc(istenen), 1), EN_FAZLA_TAVAN)
    : VARSAYILAN_TAVAN;

  const r = await runPython(
    [
      "-c",
      "import sys; from services.radar.engine import run_radar_v2; " +
        "d = run_radar_v2(denetim_tavani=int(sys.argv[1])); " +
        "print('LEAD:', len(d['hits']), 'DENETLENEN:', d['istatistik']['denetlenen'])",
      String(tavan),
    ],
    // Denetim ağ işi: 400 site × ~6 paralel worker en kötü senaryoda uzun sürer.
    900000,
  );
  const m = r.out.match(/LEAD:\s*(\d+)\s+DENETLENEN:\s*(\d+)/);
  if (!r.ok || !m)
    return NextResponse.json({ ok: false, error: r.out.slice(-400) }, { status: 500 });
  return NextResponse.json({
    ok: true,
    hits: parseInt(m[1], 10),
    denetlenen: parseInt(m[2], 10),
  });
}
