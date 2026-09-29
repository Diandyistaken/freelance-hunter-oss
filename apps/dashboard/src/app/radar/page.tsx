"use client";

import { useState } from "react";
import RadarHaritaBuyuk from "@/components/RadarHaritaBuyuk";
import RadarAvlari from "@/components/RadarAvlari";
import BotStatus from "@/components/BotStatus";
import { useRadarDurum } from "@/hooks/useRadarDurum";

export default function RadarPage() {
  const { durumlar, isaretle, geriAl } = useRadarDurum();
  const [secilenSlug, setSecilenSlug] = useState<string | null>(null);

  return (
    <>
      <header className="glass flex items-center justify-between rounded-2xl px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">🎯 Radar & Demolar</h1>
          <p className="text-xs text-[var(--muted)]">
            İşi iyi giden ama sitesi bozuk/görünmez işletmeyi bul → kusuru kanıtla →
            düzeltilmiş demoyu üret → kanıtlı mesajı gönder
          </p>
        </div>
        <BotStatus />
      </header>

      <RadarHaritaBuyuk
        durumlar={durumlar}
        isaretle={isaretle}
        secilenSlug={secilenSlug}
        onSecim={setSecilenSlug}
      />

      <RadarAvlari
        durumlar={durumlar}
        isaretle={isaretle}
        geriAl={geriAl}
        secilenSlug={secilenSlug}
        onSecim={setSecilenSlug}
      />
    </>
  );
}
