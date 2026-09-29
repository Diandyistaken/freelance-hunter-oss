import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import QRCode from "qrcode";
import { DATA } from "@/lib/hunter";

export const dynamic = "force-dynamic";

// Telefondan panele girmenin üç yolu, en iyisinden başlayarak:
//
//   1. TAILSCALE (önerilen, 11 Eyl 2026'da kuruldu): https adresi, her yerden
//      çalışır, yalnız kendi cihazların girebilir, internete açık DEĞİL.
//      Şifre sorulmaz (kimliği Tailscale doğruladı), GPS çalışır (https).
//   2. EV AĞI: http://192.168.x.x:3005 — aynı Wi-Fi'dayken. GPS yok (http).
//   3. GEÇİCİ TÜNEL: panel_tunel.bat açıkken. Herkese açık adres olduğu için
//      panel şifresi ister. Tailscale varken gerek kalmıyor.

const PORT = 3005;
const calistir = promisify(execFile);
const TAILSCALE = "C:\\Program Files\\Tailscale\\tailscale.exe";

let tailnetOnbellek: { adres: string | null; zaman: number } = { adres: null, zaman: 0 };

/** Makinenin tailnet adı (hunter-pc.tailXXXX.ts.net). 5 dakika önbelleklenir. */
async function tailnetAdresi(): Promise<string | null> {
  if (Date.now() - tailnetOnbellek.zaman < 5 * 60_000) return tailnetOnbellek.adres;
  let adres: string | null = null;
  try {
    const { stdout } = await calistir(TAILSCALE, ["status", "--json"], { timeout: 5000 });
    const durum = JSON.parse(stdout) as { Self?: { DNSName?: string; Online?: boolean } };
    const ad = (durum.Self?.DNSName ?? "").replace(/\.$/, "");
    if (ad.endsWith(".ts.net")) adres = `https://${ad}`;
  } catch {
    /* Tailscale kurulu değil ya da kapalı — diğer yollar çalışmaya devam eder */
  }
  tailnetOnbellek = { adres, zaman: Date.now() };
  return adres;
}

function yerelAdresler(): string[] {
  const cikti: string[] = [];
  for (const arayuzler of Object.values(os.networkInterfaces())) {
    for (const a of arayuzler ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      // Yalnız ev/ofis ağı aralıkları — sanal adaptörlerin adresleri değil.
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) {
        cikti.push(a.address);
      }
    }
  }
  return [...new Set(cikti)];
}

async function karekod(adres: string): Promise<string> {
  return QRCode.toDataURL(adres, {
    width: 320,
    margin: 1,
    color: { dark: "#e6ecf7", light: "#0b1220" },
  });
}

export async function GET() {
  const tailnet = await tailnetAdresi();
  const ev = yerelAdresler().map((ip) => `http://${ip}:${PORT}`);

  let adres = "";
  try {
    adres = fs.readFileSync(path.join(DATA, "tunel.txt"), "utf-8").trim();
  } catch {
    /* tünel kapalı */
  }
  const gecerliTunel = /^https:\/\/[\w.-]+\.trycloudflare\.com\/?$/.test(adres);

  return NextResponse.json({
    tailnet,
    tailnetKarekod: tailnet ? await karekod(tailnet) : null,
    ev,
    evKarekod: ev.length ? await karekod(ev[0]) : null,
    acik: gecerliTunel,
    adres: gecerliTunel ? adres : undefined,
    karekod: gecerliTunel ? await karekod(adres) : undefined,
  });
}
