"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { stats as demoStats } from "@/lib/mock";

interface Status {
  botAlive: boolean;
  paused: boolean;
  today: Record<string, number>;
  totalItems: number;
  aiUsage: number;
  aiCap: number;
  pending: number;
  radarHits: number;
  radarScannedAt: string | null;
}

export default function StatCards() {
  const [st, setSt] = useState<Status | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/status")
        .then((r) => r.json())
        .then(setSt)
        .catch(() => setSt(null));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  // Motor verisi gelemezse (ör. veritabanı yok) demo kartlara düşülür
  const cards = st
    ? [
        {
          label: "Bugün İşlenen",
          value: String(Object.values(st.today).reduce((a, b) => a + b, 0)),
          hint: `toplam arşiv: ${st.totalItems} ilan`,
        },
        {
          label: "Uygun Eşleşme (bugün)",
          value: String((st.today.uygun ?? 0) + (st.today.firsat ?? 0)),
          hint: `💎 fırsat: ${st.today.firsat ?? 0} · 🚩 şüpheli: ${st.today.suspicious ?? 0}`,
        },
        {
          label: "AI Kullanımı",
          value: `${st.aiUsage}/${st.aiCap}`,
          hint: st.pending
            ? `📥 kuyrukta ${st.pending} mail`
            : "günlük çağrı tavanı",
        },
        {
          label: "Radar Avı",
          value: String(st.radarHits),
          hint: st.radarScannedAt
            ? `sitesiz işletme · ${new Date(st.radarScannedAt).toLocaleDateString("tr-TR")}`
            : "henüz tarama yok — /radar",
        },
      ]
    : demoStats;

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {cards.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.45, ease: "easeOut" }}
          className="glass rounded-2xl p-4"
        >
          <p className="text-xs text-[var(--muted)]">{s.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{s.value}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">{s.hint}</p>
        </motion.div>
      ))}
    </div>
  );
}
