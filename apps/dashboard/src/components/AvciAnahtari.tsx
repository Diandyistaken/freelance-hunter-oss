"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio, PowerOff } from "lucide-react";

// Freelance ilan avcısının ANA ANAHTARI (duraklatmadan farklıdır).
//
//   Duraklat (meşgul modu) → analiz durur ama mailler ücretsiz birikir.
//   Bu anahtar KAPALI      → internetten iş ilanı hiç aranmaz: Gmail'e
//                            bakılmaz, Freelancer API'sine gidilmez, kuyruk
//                            büyümez. Radar + demo site tarafı etkilenmez.
//
// Komut data/control.json'a yazılır; state.json'ın tek yazarı bot olduğu için
// bot dosyayı okuyup uygular (~25 sn) ve siler.
export default function AvciAnahtari() {
  const [acik, setAcik] = useState<boolean | null>(null);
  const [botAlive, setBotAlive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [not, setNot] = useState("");

  const yukle = useCallback(
    () =>
      fetch("/api/status")
        .then((r) => r.json())
        .then((s) => {
          setAcik(!s.avciKapali);
          setBotAlive(!!s.botAlive);
        })
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    yukle();
    const t = setInterval(yukle, 10000);
    return () => clearInterval(t);
  }, [yukle]);

  const cevir = async () => {
    if (acik === null) return;
    const hedef = !acik;
    setBusy(true);
    setNot("");
    try {
      const r = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "avci", enabled: hedef }),
      });
      if (!r.ok) throw new Error(await r.text());
      setAcik(hedef); // iyimser güncelleme; bot ~25 sn içinde uygular
      setNot(
        botAlive
          ? "bot'a iletildi (~25 sn içinde uygulanır)"
          : "kaydedildi — bot açılınca uygulanacak",
      );
      setTimeout(() => setNot(""), 6000);
    } catch {
      setNot("gönderilemedi, tekrar dene");
      yukle();
    } finally {
      setBusy(false);
    }
  };

  const yukleniyor = acik === null;

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide">
        {acik ? (
          <Radio className="size-4 text-emerald-300" />
        ) : (
          <PowerOff className="size-4 text-rose-300" />
        )}
        Freelance İş Avcısı
      </h2>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {yukleniyor ? "durum okunuyor…" : acik ? "🎯 AÇIK — ilan taranıyor" : "⛔ KAPALI — internetten iş aranmıyor"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            Kapatınca Gmail bildirimlerine bakılmaz, Freelancer API&apos;sine
            gidilmez, mail kuyruğu birikmez ve AI harcaması sıfırlanır.{" "}
            <b className="text-white/80">Radar, demo site ve teklif tarafı
            etkilenmez</b> — onlar çalışmaya devam eder.
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Telegram karşılığı: <code>/avkapat</code> · <code>/avac</code>
          </p>
          {not && <p className="mt-1.5 text-[11px] text-emerald-300">✓ {not}</p>}
        </div>

        <button
          onClick={cevir}
          disabled={busy || yukleniyor}
          aria-pressed={!!acik}
          aria-label="Freelance iş avcısını aç/kapat"
          className={`relative h-8 w-16 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            acik ? "bg-emerald-400/70" : "bg-white/15"
          }`}
        >
          <span
            className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${
              acik ? "left-9" : "left-1"
            }`}
          />
        </button>
      </div>

      {!botAlive && !yukleniyor && (
        <p className="mt-3 text-[11px] text-amber-200/80">
          Bot şu an kapalı. Anahtar yine de kaydedilir; bot açıldığında
          seçtiğin durumla başlar.
        </p>
      )}
    </section>
  );
}
