import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// EMEKLİ UÇ (16 Ağu 2026) — bkz. scan-yakin/route.ts. Çoklu bölge v1 taraması
// radar.json'u ezip paneli eski "Sitesiz İşletmeler" arayüzüne düşürüyordu.
// Tek tarama yolu: /api/radar/scan-v2.
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Bu tarama emekli edildi (v1 'sitesiz esnaf'). Sıcak Lead Tara'yı kullan.",
    },
    { status: 410 },
  );
}
