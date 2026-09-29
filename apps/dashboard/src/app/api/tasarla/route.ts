import { NextResponse } from "next/server";
import { runPython } from "@/lib/python";

export const dynamic = "force-dynamic";

// Kusura ÖZEL sıfırdan site tasarımı.
//
// Varsayılan motor Claude Code CLI (TASARIM_MOTOR=claude_cli): kullanıcının
// Max aboneliği üzerinden üretir, API bakiyesine DOKUNMAZ → maliyet $0,
// günlük tavan yok. TASARIM_MOTOR=api seçilirse eski ücretli yol (site
// başına ~$0,5-1,4; günlük tavan TASARIM_GUNLUK_TAVAN Python tarafında).
export async function POST(req: Request) {
  const govde = await req.json().catch(() => ({}));
  const n = Number(govde?.n);
  if (!Number.isInteger(n) || n < 1)
    return NextResponse.json({ ok: false, error: "geçersiz av numarası" }, { status: 400 });

  const r = await runPython(
    ["run.py", "--tasarla", String(n)],
    // Yüksek effort'ta üretim uzun sürebilir (ölçülen: ~2-5 dk).
    900000,
  );
  const slug = r.out.match(/api\/demo\/([\w-]+--fable)/)?.[1];
  const maliyet = r.out.match(/GERÇEK maliyet: \$([\d.]+)/)?.[1];
  const kalan = r.out.match(/Bugün kalan hak: (\d+)/)?.[1];
  const gercekIcerik = /Gerçek içerik: mevcut siteden alındı/.test(r.out);

  if (!r.ok || !slug)
    return NextResponse.json({ ok: false, error: r.out.slice(-400) }, { status: 500 });

  return NextResponse.json({
    ok: true,
    slug,
    url: `/api/demo/${slug}`,
    maliyetUsd: maliyet ? Number(maliyet) : null,
    kalanHak: kalan ? Number(kalan) : null,
    gercekIcerik,
  });
}
