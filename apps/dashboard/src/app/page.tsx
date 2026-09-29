import StatCards from "@/components/StatCards";
import HuntTable from "@/components/HuntTable";
import RadarPanel from "@/components/RadarPanel";
import BotStatus from "@/components/BotStatus";
import DiamondTracking from "@/components/DiamondTracking";

export default function Home() {
  return (
    <>
      <header className="glass flex items-center justify-between rounded-2xl px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Genel Bakış</h1>
          <p className="text-xs text-[var(--muted)]">
            Ban-güvenli üç kanal: resmi API · e-posta ayrıştırma · insan onaylı teklif
          </p>
        </div>
        <BotStatus />
      </header>

      <StatCards />

      <DiamondTracking />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <HuntTable />
        <RadarPanel />
      </div>
    </>
  );
}
