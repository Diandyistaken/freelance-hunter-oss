import { NextResponse } from "next/server";
import { CEREZ_ADI, cerezUret, esitMi, korumaAcikMi } from "@/lib/oturum";

export const dynamic = "force-dynamic";

// Panel girişi. Şifre .env.local'deki PANEL_SIFRE ile karşılaştırılır;
// doğruysa 30 günlük imzalı çerez verilir. Şifre çereze YAZILMAZ.
export async function POST(istek: Request) {
  if (!korumaAcikMi()) return NextResponse.json({ ok: true, koruma: false });

  const govde = await istek.json().catch(() => ({}));
  const sifre = String(govde?.sifre ?? "");
  const dogru = String(process.env.PANEL_SIFRE ?? "");

  // Kaba kuvvet denemesini yavaşlat (yerel panel için yeterli caydırıcılık).
  await new Promise((c) => setTimeout(c, 400));

  if (!sifre || !esitMi(sifre, dogru)) {
    return NextResponse.json({ ok: false, error: "şifre yanlış" }, { status: 401 });
  }

  const cevap = NextResponse.json({ ok: true });
  cevap.cookies.set(CEREZ_ADI, await cerezUret(), {
    httpOnly: true,
    sameSite: "lax",
    // Tünel HTTPS; ev ağında http olabilir — üretimde güvenli, yerelde esnek.
    secure: istek.url.startsWith("https://"),
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return cevap;
}

export async function DELETE() {
  const cevap = NextResponse.json({ ok: true });
  cevap.cookies.set(CEREZ_ADI, "", { path: "/", maxAge: 0 });
  return cevap;
}
