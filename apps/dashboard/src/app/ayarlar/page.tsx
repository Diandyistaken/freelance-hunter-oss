"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldBan, Trash2 } from "lucide-react";
import BotStatus from "@/components/BotStatus";
import AvciAnahtari from "@/components/AvciAnahtari";
import TelefonErisimi from "@/components/TelefonErisimi";

interface Status {
  botAlive: boolean;
  aiUsage: number;
  aiCap: number;
  freelancerToken: boolean;
  cloudflareToken: boolean;
}

export default function AyarlarPage() {
  const [st, setSt] = useState<Status | null>(null);
  const [patterns, setPatterns] = useState<{ pattern: string }[]>([]);
  const [yeni, setYeni] = useState("");

  const yukle = useCallback(() => {
    fetch("/api/status").then((r) => r.json()).then(setSt).catch(() => {});
    fetch("/api/blacklist")
      .then((r) => r.json())
      .then((d) => setPatterns(d.patterns ?? []))
      .catch(() => {});
  }, []);

  useEffect(yukle, [yukle]);

  const ekle = async () => {
    if (!yeni.trim()) return;
    await fetch("/api/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern: yeni }),
    });
    setYeni("");
    yukle();
  };

  const sil = async (pattern: string) => {
    await fetch("/api/blacklist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern }),
    });
    yukle();
  };

  const TokenSatir = ({ ad, dolu, nasil }: { ad: string; dolu?: boolean; nasil: string }) => (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div>
        <p className="text-sm font-medium">{ad}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{nasil}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
          dolu ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"
        }`}
      >
        {dolu ? "✓ tanımlı" : "⬜ eksik"}
      </span>
    </div>
  );

  return (
    <>
      <header className="glass flex items-center justify-between rounded-2xl px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">⚙️ Ayarlar</h1>
          <p className="text-xs text-[var(--muted)]">
            Token durumları, kara liste ve sistem bilgileri
          </p>
        </div>
        <BotStatus />
      </header>

      <AvciAnahtari />

      <TelefonErisimi />

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide">
            <KeyRound className="size-4 text-cyan-300" /> API Anahtarları
          </h2>
          <div className="flex flex-col gap-2.5">
            <TokenSatir
              ad="Anthropic (Claude)"
              dolu
              nasil="Skorlama + teklif yazımı. Daily AI Researcher ile ortak bakiye."
            />
            <TokenSatir
              ad="Telegram Bot"
              dolu
              nasil="@SeninBotun_bot — bildirim + komutlar."
            />
            <TokenSatir
              ad="Freelancer.com API"
              dolu={st?.freelancerToken}
              nasil="ÜCRETSİZ. developers.freelancer.com → token oluştur → .env dosyasında FREELANCER_OAUTH_TOKEN= satırına yapıştır → botu yeniden başlat. Mail beklemeden dakikalar içinde ilan akışı."
            />
            <TokenSatir
              ad="Cloudflare Pages (demo yayınlama)"
              dolu={st?.cloudflareToken}
              nasil="ÜCRETSİZ, kart istemez. dash.cloudflare.com → My Profile → API Tokens → Create Token → Create Custom Token → Permissions: Account / Cloudflare Pages / Edit → .env dosyasında CLOUDFLARE_API_TOKEN= satırına yapıştır. Sonra Radar sayfasındaki Yayınla butonu çalışır."
            />
          </div>
          <p className="mt-3 text-[11px] text-[var(--muted)]">
            .env dosyası: Freelance Hunter klasörünün kökünde. Token değerleri
            güvenlik gereği burada gösterilmez, yalnızca dolu/boş durumu görünür.
          </p>
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide">
            <ShieldBan className="size-4 text-amber-300" /> Kara Liste (scam kalıpları)
          </h2>
          <p className="mb-3 text-[11px] text-[var(--muted)]">
            Buradaki kalıbı içeren mailler AI&apos;a bile gitmeden elenir ($0).
            Telegram&apos;daki /karaliste komutuyla aynı listeyi yönetir.
          </p>
          <div className="mb-3 flex gap-2">
            <input
              value={yeni}
              onChange={(e) => setYeni(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ekle()}
              placeholder="kelime, cümle veya gönderen adresi…"
              className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-emerald-400/40"
            />
            <button
              onClick={ekle}
              className="rounded-xl bg-emerald-400/15 px-4 py-2 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25"
            >
              Ekle
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {patterns.map(({ pattern }) => (
              <div
                key={pattern}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
              >
                <code className="truncate text-xs text-white/80">{pattern}</code>
                <button
                  onClick={() => sil(pattern)}
                  className="ml-2 shrink-0 text-[var(--muted)] transition-colors hover:text-red-300"
                  aria-label={`${pattern} kalıbını sil`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {patterns.length === 0 && (
              <p className="p-2 text-xs text-[var(--muted)]">
                Liste boş — ilk kalıbı ekle (ör. şüpheli bir gönderen adresi).
              </p>
            )}
          </div>
        </section>

        <section className="glass rounded-2xl p-5 xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold tracking-wide">ℹ️ Sistem Bilgileri</h2>
          <div className="grid gap-3 text-xs text-[var(--muted)] md:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] p-3">
              <p className="font-medium text-white/90">Günlük AI kullanımı</p>
              <p className="mt-1">
                {st ? `${st.aiUsage}/${st.aiCap} çağrı` : "…"} — tavan .env
                DAILY_CALL_CAP ile ayarlanır
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] p-3">
              <p className="font-medium text-white/90">Telegram komutları</p>
              <p className="mt-1">
                /durum /durdur /baslat /radar /site /yayinla /rapor /karaliste
                /taslak /teklifverdim /tekliflerim /kazandim /kaybettim
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] p-3">
              <p className="font-medium text-white/90">Gmail token ölürse</p>
              <p className="mt-1">
                Bot Telegram&apos;dan haber verir → terminalde{" "}
                <code className="text-white/80">python run.py --auth</code> çalıştır
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
