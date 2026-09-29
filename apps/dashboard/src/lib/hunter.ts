// Sunucu tarafı yardımcılar — Python motorunun ürettiği gerçek verilere erişim.
// SQLite okuma Node 22.5+ yerleşik node:sqlite ile yapılır (ek paket yok).
import { DatabaseSync } from "node:sqlite";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";

// dashboard cwd = apps/dashboard → proje kökü iki üst klasör
export const ROOT = path.join(process.cwd(), "..", "..");
export const DATA = path.join(ROOT, "data");
const DB_PATH = path.join(DATA, "hunter.sqlite");

export function openDb(readOnly = true): DatabaseSync {
  const db = new DatabaseSync(DB_PATH, { readOnly });
  if (!readOnly) db.exec("PRAGMA busy_timeout = 3000"); // Python botla yazma çakışmasın
  return db;
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function ilanUrl(url: unknown, body: unknown): string | null {
  if (typeof url === "string" && url.trim()) return url.trim();
  if (typeof body !== "string") return null;

  const links = body.match(/https?:\/\/[^\s"'<>()\]]+/g) ?? [];
  const platforms = [
    "freelancer.com/projects",
    "upwork.com/jobs",
    "bionluk.com",
    "armut.com",
    "fiverr.com",
  ];
  const unwanted = ["unsubscribe", "preferences", "settings", "abonelik"];

  for (const link of links) {
    const normalized = link.replace(/[.,;)>]+$/, "");
    const lower = normalized.toLowerCase();
    if (
      platforms.some((platform) => lower.includes(platform)) &&
      !unwanted.some((word) => lower.includes(word))
    ) {
      return normalized;
    }
  }
  return null;
}

export function dailyCallCap(): number {
  try {
    const env = fs.readFileSync(path.join(ROOT, ".env"), "utf-8");
    const m = env.match(/DAILY_CALL_CAP=(\d+)/);
    return m ? parseInt(m[1], 10) : 60;
  } catch {
    return 60;
  }
}

// Bot canlı mı? Tek kopya kilidi (127.0.0.1:47651) aynı zamanda sağlık kontrolüdür:
// porta bağlanabiliyorsak botun kendisi dinliyor demektir.
export async function botAlive(): Promise<boolean> {
  const tcpOk = await new Promise<boolean>((resolve) => {
    const sock = net.connect({ port: 47651, host: "127.0.0.1" });
    const done = (v: boolean) => {
      sock.destroy();
      resolve(v);
    };
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
    setTimeout(() => done(false), 500);
  });
  if (tcpOk) return true;
  // Bot uzun bir av turundayken porta bakmak yanıltabilir — bot her döngüde
  // state.json'ı yazar; dosya son 3 dk içinde güncellendiyse bot canlıdır.
  try {
    const st = fs.statSync(path.join(DATA, "state.json"));
    return Date.now() - st.mtimeMs < 180_000;
  } catch {
    return false;
  }
}
