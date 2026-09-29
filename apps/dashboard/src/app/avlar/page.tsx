"use client";

import { useState } from "react";
import HuntTable from "@/components/HuntTable";
import BotStatus from "@/components/BotStatus";

export default function AvlarPage() {
  const [hepsi, setHepsi] = useState(false);

  return (
    <>
      <header className="glass flex items-center justify-between rounded-2xl px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">🎯 Av Listesi</h1>
          <p className="text-xs text-[var(--muted)]">
            Motorun işlediği tüm bildirimler — bir karta tıkla: detay, fiyat ve teklif penceresi açılır
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={hepsi}
              onChange={(e) => setHepsi(e.target.checked)}
              className="accent-emerald-400"
            />
            elenenleri de göster
          </label>
          <BotStatus />
        </div>
      </header>

      <HuntTable all={hepsi} />
    </>
  );
}
