"use client";

import { useState } from "react";
import { Copy, ExternalLink, Star } from "lucide-react";
import type { RadarHit } from "./RadarPanel";
import DemoSihirbazi from "./DemoSihirbazi";
import { alanAdiSupheli } from "@/lib/alanAdiUyumu";

// Radar v2 lead kartı: "ŞU AN" (kanıtlı kusurlar) ↔ "OLABİLECEK" (hazır demo).
// Kullanıcı bu kartla telefon açmak yerine KANITLI mesaj atıyor.

function siddetRengi(siddet: number) {
  if (siddet >= 9) return { arka: "bg-red-400/15", yazi: "text-red-200", etiket: "kritik" };
  if (siddet >= 6) return { arka: "bg-amber-400/15", yazi: "text-amber-200", etiket: "ciddi" };
  return { arka: "bg-slate-400/15", yazi: "text-slate-300", etiket: "küçük" };
}

// Müşteriye gidecek mesaj. offer.md §4/§6 kırmızı çizgileri:
//  · "sıfırdan size yaptım" DENMEZ → "hazır şablonumdan örnek/konsept"
//  · abartı vaat yok (sıralama garantisi vb.)
//  · demo geçicidir, ilgilenilmezse kaldırılır
//  · etik sınır satış argümanı: siteye dokunulmadı, veriler herkese açık
export function mesajUret(hit: RadarHit, demoLinki: string): string {
  const enAgir = hit.kusurlar?.[0];
  const satirlar = [
    `Merhaba, ${hit.name} için kısa bir not.`,
    "",
    hit.kanca || enAgir?.baslik || "",
  ];
  if (enAgir?.kanit) satirlar.push(`(Kontrol ettiğim şey: ${enAgir.kanit})`);
  satirlar.push("");
  if (demoLinki) {
    satirlar.push(
      "Nasıl görünebileceğini göstermek için hazır şablonumdan bir örnek sayfa hazırladım " +
        "(konsept — yazılar ve görseller temsilîdir):",
      demoLinki,
      "",
      "İlgilenmezseniz bu geçici linki kaldırıyorum, ikinci kez rahatsız etmem.",
    );
  } else {
    satirlar.push("İsterseniz nasıl görünebileceğine dair bir örnek hazırlayıp göndereyim.");
  }
  satirlar.push(
    "",
    "Not: Sitenize veya sisteminize hiçbir şekilde girmedim — yukarıdakiler " +
      "herkesin dışarıdan görebildiği bilgiler.",
  );
  return satirlar.filter((s, i, a) => !(s === "" && a[i - 1] === "")).join("\n");
}

// Kusura ÖZEL sıfırdan tasarım — şablon YOK (3 Ağu 2026 kararı). Buton
// sihirbazı açar: önce mevcut siteden gerçek içerik+fotoğraf çekilir, sonra
// işletmeye özel sorular sorulur, cevaplarla bol animasyonlu site üretilir.
// Motor Claude Code CLI (Max aboneliği) → API'ye para gitmez.
function DemoBaslat({ hit, n }: { hit: RadarHit; n: number }) {
  const [acik, setAcik] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        title="Şablondan değil: mevcut sitenizin gerçek içerik ve fotoğraflarıyla, ölçülen kusurları gideren, bol animasyonlu tek sayfa. Max aboneliğiyle üretilir — API'ye para gitmez."
        className="mb-2 w-full rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/[0.06] p-2 text-left text-[11px] text-fuchsia-100 transition-colors hover:bg-fuchsia-400/[0.12]"
      >
        🎨 Sıfırdan tasarım üret — sorulu sihirbaz, $0
      </button>
      {acik && <DemoSihirbazi hit={hit} n={n} onKapat={() => setAcik(false)} />}
    </>
  );
}

interface Props {
  hit: RadarHit;
  demoLinki: string;
  /** radar listesindeki sıra numarası — run.py --tasarla N ile aynı indeks */
  n: number;
}

export default function RadarKusurRaporu({ hit, demoLinki, n }: Props) {
  const [kopyalandi, setKopyalandi] = useState(false);
  const [kirilimAcik, setKirilimAcik] = useState(false);
  const kusurlar = hit.kusurlar ?? [];
  const olcum = hit.denetim_olcumler ?? {};
  const domainYasi = olcum.domain_yasi_yil;
  const googleAra = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${hit.name} ${hit.bolge ?? ""}`.trim(),
  )}`;

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(mesajUret(hit, demoLinki));
      setKopyalandi(true);
      window.setTimeout(() => setKopyalandi(false), 2000);
    } catch {
      setKopyalandi(false);
    }
  };

  return (
    <div className="mt-2 grid gap-2 rounded-xl border border-white/[0.07] bg-black/20 p-3 lg:grid-cols-2">
      {/* ŞU AN — kanıtlı kusurlar */}
      <div className="min-w-0">
        {alanAdiSupheli(hit.name, hit.domain) && (
          <p className="mb-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] p-2 text-[11px] leading-relaxed text-amber-200">
            ⚠ Tablodaki alan adı (<b>{hit.domain}</b>) işletme adıyla uyuşmuyor
            görünüyor — kayıt bayat/yanlış olabilir. Aramadan önce
            “Google&apos;da aç” ile gerçek sitesini doğrula; aşağıdaki kusurlar
            başka birinin sitesine ait olabilir.
          </p>
        )}
        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-red-300/90">
          Şu an
          <span className="rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-red-200">
            kusur {hit.kusur_puani ?? 0}/100
          </span>
        </p>
        {hit.kanca && (
          <p className="mb-2 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-2 text-xs leading-relaxed text-red-100">
            💬 {hit.kanca}
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {kusurlar.map((k) => {
            const renk = siddetRengi(k.siddet);
            return (
              <li key={k.kod} className="flex items-start gap-2 text-[11px]">
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${renk.arka} ${renk.yazi}`}
                >
                  {renk.etiket}
                </span>
                <span className="min-w-0">
                  <span className="block text-white/85">{k.baslik}</span>
                  <span className="block text-white/40">kanıt: {k.kanit}</span>
                  {k.dogrula && (
                    <span className="mt-0.5 block text-cyan-200/70">
                      🔍 kendin doğrula: {k.dogrula}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
          {kusurlar.length === 0 && (
            <li className="text-[11px] text-white/40">Kusur kaydı yok.</li>
          )}
        </ul>
      </div>

      {/* OLABİLECEK — hazır demo + işletme kalitesi */}
      <div className="min-w-0 lg:border-l lg:border-white/[0.07] lg:pl-3">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
          Olabilecek
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-emerald-200">
            kalite {hit.kalite_puani ?? 0}/100
          </span>
        </p>

        {demoLinki && (
          <a
            href={demoLinki}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] p-2 text-xs text-emerald-200 transition-colors hover:bg-emerald-400/[0.14]"
          >
            <ExternalLink className="size-3.5 shrink-0" />
            <span className="truncate">Yayındaki demo: {demoLinki}</span>
          </a>
        )}

        <DemoBaslat hit={hit} n={n} />

        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/60">
          {typeof domainYasi === "number" && (
            <span>
              🕰 alan adı <b className="text-white/85">{domainYasi} yıllık</b>
            </span>
          )}
          {hit.domain && <span className="truncate">🌐 {hit.domain}</span>}
          {hit.platform_sayfasi && (
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-200">
              kendi sitesi yok
            </span>
          )}
          <a
            href={googleAra}
            target="_blank"
            rel="noopener noreferrer"
            title="Google puanını ve yorum sayısını kendi gözünle gör (ücretsiz, Places API gerekmez)"
            className="flex items-center gap-1 text-cyan-300 underline"
          >
            <Star className="size-3" /> Google&apos;da aç
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void kopyala()}
            title="Kanıtlı mesajı panoya kopyala — WhatsApp/e-postaya yapıştır"
            className="flex items-center gap-1.5 rounded-lg bg-cyan-400/15 px-3 py-1.5 text-[11px] font-medium text-cyan-200 transition-colors hover:bg-cyan-400/25"
          >
            <Copy className="size-3.5" />
            {kopyalandi ? "Kopyalandı ✓" : "Kanıtlı mesajı kopyala"}
          </button>
          {hit.phone && (
            <a
              href={`https://wa.me/${hit.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-emerald-400/15 px-3 py-1.5 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25"
            >
              WhatsApp&apos;ta aç
            </a>
          )}
          {(hit.kalite_kirilim?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setKirilimAcik((v) => !v)}
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] text-white/70 transition-colors hover:bg-white/[0.12]"
            >
              {kirilimAcik ? "Skoru gizle" : "Skor neden böyle?"}
            </button>
          )}
        </div>

        {kirilimAcik && (
          <ul className="mt-2 flex flex-col gap-0.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2 text-[11px] text-white/60">
            {hit.kalite_kirilim?.map((k) => (
              <li key={k.etiket} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{k.etiket}</span>
                <b className={k.puan > 0 ? "text-emerald-300" : "text-red-300"}>
                  {k.puan > 0 ? "+" : ""}
                  {k.puan}
                </b>
              </li>
            ))}
            <li className="mt-1 flex justify-between gap-2 border-t border-white/[0.07] pt-1 text-white/80">
              <span>Hedef skoru = √(kalite × kusur)</span>
              <b className="text-cyan-300">{hit.score}</b>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
