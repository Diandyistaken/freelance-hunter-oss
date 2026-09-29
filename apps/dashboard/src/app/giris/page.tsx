"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Crosshair, Loader2 } from "lucide-react";

function GirisFormu() {
  const router = useRouter();
  const devam = useSearchParams().get("devam") || "/arama-listesi";
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [bekliyor, setBekliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setBekliyor(true);
    setHata("");
    try {
      const r = await fetch("/api/giris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sifre }),
      });
      const d = await r.json();
      if (!d.ok) {
        setHata(d.error ?? "olmadı");
        return;
      }
      router.replace(devam);
      router.refresh();
    } catch {
      setHata("bağlanamadım");
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <form onSubmit={gonder} className="glass w-full max-w-xs rounded-2xl p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
          <Crosshair className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-wide">HUNTER</p>
          <p className="text-[11px] text-[var(--muted)]">panel girişi</p>
        </div>
      </div>

      <input
        type="password"
        value={sifre}
        onChange={(e) => setSifre(e.target.value)}
        placeholder="şifre"
        autoFocus
        autoComplete="current-password"
        className="w-full rounded-xl bg-white/[0.06] px-3 py-3 text-base text-white outline-none placeholder:text-white/30 focus:bg-white/[0.1]"
      />

      {hata && <p className="mt-2 text-xs text-rose-300">{hata}</p>}

      <button
        type="submit"
        disabled={bekliyor || !sifre}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400/20 px-3 py-3 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-400/30 disabled:opacity-50"
      >
        {bekliyor && <Loader2 className="size-4 animate-spin" />}
        Gir
      </button>

      <p className="mt-4 text-[10px] leading-relaxed text-white/35">
        Şifre bu bilgisayardaki <code>.env.local</code> dosyasında durur. 30 gün
        açık kalır; telefonda &quot;Ana Ekrana Ekle&quot; dersen uygulama gibi açılır.
      </p>
    </form>
  );
}

export default function GirisSayfasi() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Suspense fallback={<Loader2 className="size-5 animate-spin text-white/40" />}>
        <GirisFormu />
      </Suspense>
    </div>
  );
}
