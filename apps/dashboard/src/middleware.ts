import { NextResponse, type NextRequest } from "next/server";
import {
  CEREZ_ADI,
  accessKimligi,
  cerezGecerliMi,
  korumaAcikMi,
  tailnetMi,
  yerelMi,
} from "@/lib/oturum";

// PANEL KAPISI — kimin nereden girdiğine göre (kullanıcı kararı, 10 Eyl 2026)
//
//   1. Ev: bilgisayarın kendisi ve aynı Wi-Fi'daki telefon → ŞİFRE YOK.
//      (localhost, 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
//   2. Dışarıdan (Cloudflare tüneli) → kimlik şart. İki yol:
//      a) Cloudflare Access kuruluysa kimliği Cloudflare doğrular (Google ile
//         giriş) ve `cf-access-authenticated-user-email` başlığını ekler.
//         İstenen model bu: "hesabımla giren kişi girebilsin."
//      b) Access henüz yoksa geçici şifre kapısı devreye girer — tünel
//         adresi tahmin edilemez ama GİZLİ DEĞİLDİR, bağlantı eline geçen
//         herkes panele girerdi.
//
// PANEL_SIFRE boş ve Access de yoksa dışarıdan erişim tamamen KAPATILIR
// (403) — paneli yanlışlıkla internete açık bırakmaktansa kapalı kalsın.
export async function middleware(istek: NextRequest) {
  const yol = istek.nextUrl.pathname;

  // Giriş ekranı, giriş API'si ve uygulama ikonları her zaman serbest.
  if (
    yol.startsWith("/giris") ||
    yol.startsWith("/api/giris") ||
    yol.startsWith("/maplibre/") ||
    yol === "/manifest.webmanifest" ||
    yol === "/favicon.ico" ||
    yol.startsWith("/ikon") ||
    yol === "/apple-touch-icon.png"
  ) {
    return NextResponse.next();
  }

  // 1. Ev ağı → serbest.
  const host = istek.headers.get("host");
  if (yerelMi(host)) return NextResponse.next();

  // 1b. Tailscale ağı → serbest. Kimliği Tailscale doğruladı (yalnız kendi
  // cihazların bağlanabiliyor), adres internete açık değil. Telefondan
  // şifresiz kullanımın yolu bu.
  if (tailnetMi(host)) return NextResponse.next();

  // 2a. Cloudflare Access kimliği.
  if (accessKimligi(istek.headers.get("cf-access-authenticated-user-email"))) {
    return NextResponse.next();
  }

  // 2b. Şifre kapısı (Access kurulana kadar).
  if (!korumaAcikMi()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Dışarıdan erişim kapalı. Cloudflare Access kur ya da .env.local'de PANEL_SIFRE tanımla.",
      },
      { status: 403 },
    );
  }
  if (await cerezGecerliMi(istek.cookies.get(CEREZ_ADI)?.value)) return NextResponse.next();

  if (yol.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "giris gerekli" }, { status: 401 });
  }
  const hedef = istek.nextUrl.clone();
  hedef.pathname = "/giris";
  hedef.searchParams.set("devam", yol);
  return NextResponse.redirect(hedef);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
