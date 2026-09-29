"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Globe, ShieldCheck, Smartphone, Wifi } from "lucide-react";

// Telefondan panele girmenin İKİ yolu (kullanıcı kararı 10 Eyl: evde ve
// telefonda şifre sorulmasın):
//   1. Ev Wi-Fi'ı → http://192.168…:3005 · şifre yok, internete çıkmaz.
//      Tek eksiği: http olduğu için iOS konum (GPS) vermez.
//   2. Tünel (https) → dışarıdayken. GPS burada çalışır. Adres herkese açık
//      olacağı için kimlik ister: Cloudflare Access (Google ile giriş) ya da
//      geçici panel şifresi.

interface Tunel {
  tailnet?: string | null;
  tailnetKarekod?: string | null;
  ev: string[];
  evKarekod?: string | null;
  acik: boolean;
  adres?: string;
  karekod?: string;
}

function Adres({ adres }: { adres: string }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-white/[0.05] px-2 py-1.5 text-[11px] text-white/80">
        {adres}
      </code>
      <button
        onClick={() =>
          navigator.clipboard?.writeText(adres).then(() => {
            setKopyalandi(true);
            setTimeout(() => setKopyalandi(false), 1500);
          })
        }
        className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-white/[0.08] hover:text-white"
      >
        {kopyalandi ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

export default function TelefonErisimi() {
  const [tunel, setTunel] = useState<Tunel | null>(null);

  const oku = useCallback(() => {
    fetch("/api/tunel")
      .then((r) => r.json())
      .then(setTunel)
      .catch(() => setTunel({ ev: [], acik: false }));
  }, []);

  useEffect(() => {
    oku();
    const t = setInterval(oku, 10000); // tünel açılınca kendiliğinden görünsün
    return () => clearInterval(t);
  }, [oku]);

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide">
        <Smartphone className="size-4 text-emerald-300" /> Telefondan kullan
      </h2>

      {/* --- 0. Tailscale: her yerden, şifresiz, internete kapalı */}
      {tunel?.tailnet && (
        <div className="mb-4 rounded-xl border border-violet-400/25 bg-violet-400/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-200">
            <ShieldCheck className="size-3.5" /> Her yerden — şifresiz, internete kapalı
          </p>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            {tunel.tailnetKarekod && (
              <Image
                src={tunel.tailnetKarekod}
                alt="tailnet adresi karekodu"
                width={132}
                height={132}
                unoptimized
                className="rounded-lg border border-white/10"
              />
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Adres adres={tunel.tailnet} />
              <ol className="list-inside list-decimal space-y-0.5 text-[11px] leading-relaxed text-[var(--muted)]">
                <li>
                  iPhone&apos;a <b>Tailscale</b> uygulamasını kur, aynı Google hesabıyla gir
                  (you@example.com).
                </li>
                <li>Karekodu okut → panel açılır, şifre sorulmaz.</li>
                <li>
                  Safari&apos;de Paylaş → <b>Ana Ekrana Ekle</b>. Haritada <b>📍 konumum</b> burada
                  çalışır (https).
                </li>
              </ol>
              <p className="text-[10px] text-white/40">
                Bu adrese yalnız senin Tailscale hesabına bağlı cihazlar ulaşır; internete açık
                değildir. Bilgisayar açık olmalı.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {/* --- 1. Ev ağı */}
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
            <Wifi className="size-3.5" /> Evde — şifre yok
          </p>
          {tunel?.ev?.length ? (
            <div className="mt-2 flex flex-wrap items-start gap-3">
              {tunel.evKarekod && (
                <Image
                  src={tunel.evKarekod}
                  alt="ev ağı adresi karekodu"
                  width={116}
                  height={116}
                  unoptimized
                  className="rounded-lg border border-white/10"
                />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                {tunel.ev.map((a) => (
                  <Adres key={a} adres={a} />
                ))}
                <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                  Telefon aynı Wi-Fi&apos;dayken karekodu okut. Safari&apos;de Paylaş →{" "}
                  <b>Ana Ekrana Ekle</b>.
                </p>
                <p className="text-[10px] text-amber-200/80">
                  Not: bu adres http olduğu için iPhone <b>konum (GPS)</b> vermez. Haritada
                  kendini görmek istiyorsan aşağıdaki https adresini kullan.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              Ev ağı adresi bulunamadı (bilgisayar kabloya/Wi-Fi&apos;a bağlı mı?).
            </p>
          )}
        </div>

        {/* --- 2. Dışarıdan */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white/85">
            <Globe className="size-3.5 text-sky-300" /> Dışarıdayken — kimlik ister
          </p>
          {tunel?.acik ? (
            <div className="mt-2 flex flex-wrap items-start gap-3">
              {tunel.karekod && (
                <Image
                  src={tunel.karekod}
                  alt="tünel adresi karekodu"
                  width={116}
                  height={116}
                  unoptimized
                  className="rounded-lg border border-white/10"
                />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <Adres adres={tunel.adres ?? ""} />
                <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                  https olduğu için haritada <b>GPS</b> çalışır. Siyah pencereyi kapatınca
                  erişim de kapanır.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
              Kapalı. <code className="text-white/70">panel_tunel.bat</code> dosyasına çift tıkla —
              geçici https adresi açılır, karekodu burada belirir. Kalıcı adres için:{" "}
              <code className="text-white/70">docs/telefon-erisimi.md</code>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
