import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// EMEKLİ UÇ (16 Ağu 2026). Eskiden v1 "sitesiz esnaf" taraması çalıştırıp
// sonucu radar.json'a yazıyordu; bu, paneldeki sıcak lead listesini eziyor ve
// arayüzü eski sürüme düşürüyordu ("eski versiyon açılıyor" şikâyetinin kökü).
// Kapalı tutuluyor — tek tarama yolu /api/radar/scan-v2.
// v1'e gerçekten ihtiyaç olursa: python run.py ile engine.run_radar_yakin()
// (artık radar_v1.json'a yazar, sıcak lead listesine dokunmaz).
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
