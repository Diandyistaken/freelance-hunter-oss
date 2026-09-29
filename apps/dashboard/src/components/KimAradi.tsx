"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Phone, PhoneIncoming, Search } from "lucide-react";
import { kaydaGit } from "@/hooks/useKayitOdagi";
import { durumEtiketi } from "@/lib/durumEtiketi";
import { gunEtiketi, kisaZaman } from "@/lib/zaman";

// KİM ARADI? — kenar çubuğunda duran numara sorgusu.
//
// YAŞANAN SORUN: numarayı arıyorsun, açmıyorlar; sonra onlar seni arıyor.
// Ekranda "...29 38" görüyorsun, karşı taraf "bizi aramışsınız" diyor ve
// sen o yerin kim olduğunu bulamıyorsun.
//
// İKİ YOL, İKİSİ BİRDEN (kullanıcı kararı):
//  1. ARAMA KUTUSU — ekranda ne görüyorsan onu yaz: son haneler ("9313")
//     da olur, numaranın tamamı ("0555 111 22 33", "+90 …") da.
//  2. SON ARADIKLARIN (7 gün, güne göre gruplu) — telefon çaldığında büyük
//     ihtimalle son günlerde aradığın biridir. Hiçbir şey yazmadan gözle
//     bulunabilsin. İlk sürüm yalnız BUGÜNÜ gösteriyordu: liste gece yarısı
//     boşalıyor, ertesi sabah gelen geri dönüşte kutu bomboş duruyordu.
//
// Sonuç satırı TIKLANIR: açılınca ne konuştuğunuz, kaç kez denendiği ve
// hangi ürünle arandığı çıkar. "Kartına git" o kayıt üzerinde iş
// yapılabilen sayfaya götürür (Düşünenler ya da arama listesi). Telefon
// numarası `tel:` bağlantısı — tek dokunuşla geri aranır.

interface Bulgu {
  ad: string;
  telefon: string;
  sektor: string;
  bolge: string;
  adres: string;
  durum: string | null;
  not: string | null;
  neZaman: string | null;
  deneme: number | null;
  slug: string | null;
  urun: string | null;
  kaynak: "arandi" | "liste" | "havuz";
  /** Numara tam olarak bu hanelerle bitiyor mu (API hesaplıyor). */
  tam: boolean;
  /** Tıklanınca gidilecek sayfa; havuzdaki (aranmamış) kayıtta null. */
  sayfa: "/dusunenler" | "/arama-listesi" | null;
}

const SAYFA_ADI: Record<NonNullable<Bulgu["sayfa"]>, string> = {
  "/dusunenler": "Düşünenler kartına git",
  "/arama-listesi": "Arama kartına git",
};

interface SonSatir {
  ad: string;
  telefon: string;
  durum: string;
  not: string | null;
  neZaman: string | null;
  slug: string;
}

/** Satırları sırayı bozmadan güne göre gruplar: [["Bugün", [...]], ["Dün", [...]]]. */
function gunlereAyir(satirlar: SonSatir[]): [string, SonSatir[]][] {
  const gruplar: [string, SonSatir[]][] = [];
  for (const s of satirlar) {
    const etiket = s.neZaman ? gunEtiketi(new Date(s.neZaman)) : "Tarihsiz";
    const son = gruplar[gruplar.length - 1];
    if (son && son[0] === etiket) son[1].push(s);
    else gruplar.push([etiket, [s]]);
  }
  return gruplar;
}

const KAYNAK_ETIKET: Record<Bulgu["kaynak"], string> = {
  arandi: "aradın",
  liste: "bugünkü listede",
  havuz: "havuzda, henüz aranmadı",
};

const KAYNAK_RENK: Record<Bulgu["kaynak"], string> = {
  arandi: "bg-emerald-400/15 text-emerald-300",
  liste: "bg-sky-400/15 text-sky-300",
  havuz: "bg-white/10 text-[var(--muted)]",
};

// API zamanı artık `Z` ekli ISO veriyor. Eskiden burada SQLite dizesi
// dilimlenip doğrudan yazılıyordu — UTC olduğu bilinerek. Sonuç: 14:29'da
// yapılan arama "11:29" görünüyordu; geri arayan kişiyle "sizi öğleden sonra
// aramıştım" konuşması yanlış saatle başlıyordu.
function saatYaz(iso: string | null): string {
  return iso ? kisaZaman(new Date(iso)) : "";
}

export default function KimAradi() {
  const router = useRouter();
  const yol = usePathname();
  const [q, setQ] = useState("");
  const [bulgular, setBulgular] = useState<Bulgu[] | null>(null);
  const [son, setSon] = useState<SonSatir[] | null>(null);
  const [acik, setAcik] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const girdiRef = useRef<HTMLInputElement>(null);

  // Son aradıkların — 60 saniyede bir tazelenir. `null` = henüz yüklenmedi
  // (boş liste ile karıştırılmasın: boşken "kayıt yok" yazılıyor).
  useEffect(() => {
    const yukle = () =>
      fetch("/api/kim-aradi?son=1")
        .then((r) => r.json())
        .then((d) => setSon(d.son ?? []))
        .catch(() => setSon([]));
    yukle();
    const t = setInterval(yukle, 60000);
    return () => clearInterval(t);
  }, []);

  // Arama: 200 ms geciktirilir. Telefon çalarken tuşlanan her hane için
  // 11.000 kayıt taranmasın.
  useEffect(() => {
    const rakam = q.replace(/\D/g, "");
    if (rakam.length < 3) {
      setBulgular(null);
      return;
    }
    setYukleniyor(true);
    const t = setTimeout(() => {
      fetch(`/api/kim-aradi?q=${encodeURIComponent(rakam)}`)
        .then((r) => r.json())
        .then((d) => setBulgular(d.bulgular ?? []))
        .catch(() => setBulgular([]))
        .finally(() => setYukleniyor(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // Ctrl+K / Cmd+K ile kutuya atla: telefon çalarken fare aranmaz.
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        girdiRef.current?.focus();
        girdiRef.current?.select();
      }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, []);

  const satirlar: Bulgu[] | null = bulgular;

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="mb-2 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        <PhoneIncoming className="size-3.5" /> Kim aradı?
        {/* Kısayol vardı ama hiçbir yerde yazmıyordu. */}
        <kbd className="ml-auto rounded bg-white/10 px-1 py-0.5 font-sans text-[9px] font-normal normal-case tracking-normal">
          Ctrl K
        </kbd>
      </p>

      <label className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-2 focus-within:bg-white/10">
        <Search className="size-3.5 shrink-0 text-[var(--muted)]" />
        <input
          ref={girdiRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          inputMode="numeric"
          placeholder="numara ya da son haneler"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted)]"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="shrink-0 text-[11px] text-[var(--muted)] hover:text-white"
            aria-label="Temizle"
          >
            ×
          </button>
        )}
      </label>

      {/* --- sonuçlar --- */}
      {satirlar !== null && (
        <div className="mt-2 max-h-72 overflow-y-auto">
          {yukleniyor && satirlar.length === 0 && (
            <p className="px-2 py-1.5 text-[11px] text-[var(--muted)]">aranıyor…</p>
          )}
          {!yukleniyor && satirlar.length === 0 && (
            <p className="px-2 py-1.5 text-[11px] text-[var(--muted)]">
              Bu numara kayıtlarda yok. Tanımadığın biri olabilir.
            </p>
          )}
          {satirlar.map((b, i) => {
            const anahtar = b.slug ?? b.telefon;
            const acikMi = acik === anahtar;
            // AYIRAÇ: buradan sonrası "numaranın ortasında geçiyor".
            // Gerçek veriyle ölçüldü — "0044" araması 8 kayıt getiriyor ama
            // yalnız biri o hanelerle BİTİYOR. İkisi aynı listede karışırsa
            // telefon çalarken yanlış yere bakılır.
            const ilkZayif = !b.tam && (i === 0 || satirlar[i - 1].tam);
            return (
              <div key={anahtar} className="border-b border-white/5 last:border-b-0">
                {ilkZayif && (
                  <p className="px-2 pb-1 pt-2 text-[9px] uppercase tracking-wide text-[var(--muted)]">
                    numaranın ortasında geçenler
                  </p>
                )}
                <button
                  onClick={() => setAcik(acikMi ? null : anahtar)}
                  className="w-full px-2 py-1.5 text-left hover:bg-white/5"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {b.ad}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${KAYNAK_RENK[b.kaynak]}`}
                    >
                      {KAYNAK_ETIKET[b.kaynak]}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-[var(--muted)]">
                    {b.telefon}
                    {b.sektor ? ` · ${b.sektor}` : ""}
                  </span>
                </button>

                {acikMi && (
                  <div className="space-y-1 px-2 pb-2 text-[10px] text-[var(--muted)]">
                    {b.bolge && <p>Bölge: {b.bolge}</p>}
                    {b.adres && <p>Adres: {b.adres}</p>}
                    {b.urun && <p>Ürün: {b.urun}</p>}
                    {b.durum && (
                      <p>
                        <span className="text-white">{durumEtiketi(b.durum)}</span>
                        {b.deneme ? ` · ${b.deneme} kez açılmadı` : ""}
                        {b.neZaman ? ` · ${saatYaz(b.neZaman)}` : ""}
                      </p>
                    )}
                    {b.not && (
                      <p className="rounded bg-white/5 px-1.5 py-1 text-white/80">
                        “{b.not}”
                      </p>
                    )}
                    {!b.durum && b.kaynak === "havuz" && (
                      <p>Bu yeri henüz aramadın — havuzda duruyor.</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <a
                        href={`tel:${b.telefon.replace(/\s/g, "")}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-400/15 px-2 py-1 text-[10px] text-emerald-300"
                      >
                        <Phone className="size-3" /> Geri ara
                      </a>
                      {/* KULLANICININ AÇIK İSTEĞİ: "üzerine tıkladığımda beni
                          ilgili yere göndersin." İlk sürümde yoktu — satır
                          yalnız açılıyordu. Düşünen biri geri aradıysa notunu
                          güncelleyip "Arandı" diyebileceğin kart orada. */}
                      {b.sayfa && b.slug && (
                        <button
                          onClick={() =>
                            kaydaGit(b.sayfa!, b.slug!, yol, (href) => router.push(href))
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] text-white/85 hover:bg-white/15"
                        >
                          {SAYFA_ADI[b.sayfa]} <ArrowRight className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- son aradıkların (7 gün) ---
          Arama kutusuna hiç dokunmadan da bulunabilsin: telefon çaldığında
          en olası cevap bu listede. BOŞKEN DE KONUŞUR: eskiden liste boşsa
          hiçbir şey çizilmiyordu ve kutunun ne işe yaradığı anlaşılmıyordu. */}
      {satirlar === null && son !== null && son.length === 0 && (
        <p className="mt-2 px-2 text-[10px] leading-relaxed text-[var(--muted)]">
          Son 7 günde işaretlenmiş arama yok. Bir numara geri dönerse
          ekranda gördüğün haneleri yukarı yaz.
        </p>
      )}
      {satirlar === null && son !== null && son.length > 0 && (
        <div className="mt-2">
          <p className="px-2 pb-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
            Son aradıkların · {son.length}
          </p>
          <div className="max-h-72 overflow-y-auto">
            {gunlereAyir(son).map(([gun, grup]) => (
              <div key={gun}>
                <p className="px-2 pb-0.5 pt-1.5 text-[9px] font-semibold uppercase tracking-wide text-white/40">
                  {gun}
                </p>
                {grup.map((s) => (
                  <button
                    key={s.slug}
                    onClick={() => setQ(s.telefon.replace(/\D/g, "").slice(-4))}
                    className="block w-full px-2 py-1 text-left hover:bg-white/5"
                    title={s.not ?? ""}
                  >
                    <span className="block truncate text-[11px]">{s.ad}</span>
                    <span className="block truncate text-[10px] text-[var(--muted)]">
                      {s.telefon} · {durumEtiketi(s.durum)}
                      {s.neZaman ? ` · ${saatYaz(s.neZaman)}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
