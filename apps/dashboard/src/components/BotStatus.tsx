"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

// Botun canlı durumu + web'den duraklat/sürdür.
// Sağlık kontrolü: bot tek-kopya kilit portunu (47651) tutuyorsa canlıdır.
// Komutlar data/control.json'a yazılır; bot ~25 sn içinde uygular.
export default function BotStatus() {
  const [alive, setAlive] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [avciKapali, setAvciKapali] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = () =>
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => {
        setAlive(s.botAlive);
        setPaused(s.paused);
        setAvciKapali(!!s.avciKapali);
      })
      .catch(() => setAlive(false));

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const toggle = async () => {
    setBusy(true);
    setNote("");
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: paused ? "resume" : "pause" }),
      });
      setPaused(!paused); // iyimser güncelleme; bot ~25 sn içinde uygular
      setNote("bot'a iletildi");
      setTimeout(() => setNote(""), 4000);
    } finally {
      setBusy(false);
    }
  };

  const [dot, text] =
    alive === null
      ? ["bg-white/40", "kontrol ediliyor…"]
      : !alive
        ? ["bg-red-400", "bot KAPALI — hunter_baslat.bat"]
        : avciKapali
          ? ["bg-rose-400", "⛔ freelance avı KAPALI · radar açık"]
          : paused
            ? ["bg-amber-400", "⏸ meşgul modu (mailler birikiyor)"]
            : ["bg-emerald-400", "🟢 bot canlı · avlanıyor"];

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-[var(--muted)]">
        <span className={`size-1.5 rounded-full ${dot}`} />
        {text}
        {note && <span className="text-emerald-300">✓ {note}</span>}
      </div>
      {alive && !avciKapali && (
        <button
          onClick={toggle}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-white/90 transition-colors hover:bg-white/[0.12] disabled:opacity-50"
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          {paused ? "Sürdür" : "Duraklat"}
        </button>
      )}
    </div>
  );
}
