// Python motorunu dashboard'dan çalıştırma — demo üretimi, yayınlama, radar.
// Motorun tek gerçek sahibi Python tarafıdır; web yalnızca onu tetikler.
import { execFile, spawn } from "node:child_process";
import { ROOT } from "@/lib/hunter";

export function runPython(
  args: string[],
  timeoutMs = 60000,
): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(
      "python",
      ["-X", "utf8", ...args],
      {
        cwd: ROOT,
        timeout: timeoutMs,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      },
      (err, stdout, stderr) => {
        const out = `${stdout}\n${stderr}`.trim();
        resolve({ ok: !err, out });
      },
    );
  });
}

/**
 * Uzun süren işi ARKA PLANDA başlatır ve hemen döner (demo analizi/üretimi
 * dakikalar sürüyor; kullanıcı panelde gezinmeye devam edebilsin diye).
 * İlerleme Python tarafında iş dosyasına yazılır, panel onu yoklar.
 */
export function runPythonDetached(args: string[], stdinVerisi = ""): void {
  const surec = spawn("python", ["-X", "utf8", ...args], {
    cwd: ROOT,
    windowsHide: true,
    detached: false, // Windows'ta ayrı grup gerekmiyor; panel kapanırsa iş de dursun
    stdio: ["pipe", "ignore", "ignore"],
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  surec.stdin.end(stdinVerisi);
  surec.unref();
}
