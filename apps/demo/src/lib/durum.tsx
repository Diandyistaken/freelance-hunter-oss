"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { deriAl, vurguDegiskenleri, type Deri } from "./deri";
import { tohumla, VARSAYILAN_AYAR, type Ayar, type Durum } from "./veri";

// DURUM — tek kaynak, tarayıcıda.
//
// Sunucu yok: demo açıldığında veri üretilir, localStorage'a yazılır, sonraki
// açılışlarda oradan okunur. "Sıfırla" tohumu yeniden üretir.
//
// Kayıt yalnız BU tarayıcıda kalır; işletme adı dahil hiçbir şey dışarı
// gitmez. Demo yayında olduğu için bu bir detay değil, tasarımın kendisi.

// SÜRÜM NUMARASI VERİ ŞEKLİNE BAĞLI. Üyelik alanları (tarih, aidat, ödeme)
// eklendiğinde v1 kaydı olan bir tarayıcı bu alanları OLMAYAN bir üye listesi
// okuyup üye defterini boş/bozuk çiziyordu. Şekil değişince anahtar değişir:
// eski kayıt okunmaz, tohum yeniden üretilir.
// v3: `odendi: boolean` → `odenen / sonOdeme / kovalama` (açık hesap).
// v2 kaydı olan bir tarayıcı `odenen` alanı OLMAYAN üyeler okur, kalan
// NaN çıkar ve açık hesap satırı "NaN ₺" yazardı.
const ANAHTAR = "hunter-demo-v3";

interface Kutu {
  durum: Durum;
  deri: Deri;
  yukleniyor: boolean;
  guncelle: (f: (d: Durum) => Durum) => void;
  ayarla: (alan: keyof Ayar, deger: string) => void;
  sifirla: (deriKodu?: string) => void;
}

const Baglam = createContext<Kutu | null>(null);

function oku(): Durum | null {
  try {
    const ham = localStorage.getItem(ANAHTAR);
    if (!ham) return null;
    const d = JSON.parse(ham) as Durum & { uretildi?: string };
    // Takvim bugüne göre kurulur; gün değişmişse baştan üret ki demo
    // "dün"de kalmasın.
    if (d.uretildi !== new Date().toDateString()) return null;
    return d;
  } catch {
    return null;
  }
}

function yaz(d: Durum): void {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify({ ...d, uretildi: new Date().toDateString() }));
  } catch {
    // Gizli sekmede localStorage kapalı olabilir; demo yine çalışır,
    // yalnız sayfa yenilenince sıfırlanır.
  }
}

export function DurumSaglayici({ children }: { children: React.ReactNode }) {
  const [durum, setDurum] = useState<Durum | null>(null);

  useEffect(() => {
    const kayitli = oku();
    setDurum(kayitli ?? tohumla(VARSAYILAN_AYAR));
  }, []);

  const guncelle = useCallback((f: (d: Durum) => Durum) => {
    setDurum((eski) => {
      if (!eski) return eski;
      const yeni = f(eski);
      yaz(yeni);
      return yeni;
    });
  }, []);

  const ayarla = useCallback((alan: keyof Ayar, deger: string) => {
    guncelle((d) => ({ ...d, ayar: { ...d.ayar, [alan]: deger } }));
  }, [guncelle]);

  const sifirla = useCallback((deriKodu?: string) => {
    setDurum((eski) => {
      const ayar: Ayar = {
        ...(eski?.ayar ?? VARSAYILAN_AYAR),
        deri: deriKodu ?? eski?.ayar.deri ?? VARSAYILAN_AYAR.deri,
      };
      const yeni = tohumla(ayar);
      yaz(yeni);
      return yeni;
    });
  }, []);

  const deri = deriAl(durum?.ayar.deri);

  // VURGU TEK YERDEN: değişkenler belge köküne yazılıyor.
  //
  // Daha önce her ekran kendi kök `div`ine, üst şerit de kendi `header`ına
  // basıyordu; `body` hiç almıyordu. `::selection` ve `:focus-visible` kök
  // seviyede tanımlı olduğu için psikolog derisinde mavi arayüzün ortasında
  // kiremit odak halkası çıkıyordu. Kökten yazılınca miras zinciri tek.
  useEffect(() => {
    const kok = document.documentElement;
    for (const [ad, deger] of Object.entries(vurguDegiskenleri(deri))) {
      kok.style.setProperty(ad, deger);
    }
  }, [deri]);

  const deger = useMemo<Kutu>(() => ({
    durum: durum ?? tohumla(VARSAYILAN_AYAR),
    deri,
    yukleniyor: durum === null,
    guncelle, ayarla, sifirla,
  }), [durum, deri, guncelle, ayarla, sifirla]);

  return <Baglam.Provider value={deger}>{children}</Baglam.Provider>;
}

export function useDemo(): Kutu {
  const k = useContext(Baglam);
  if (!k) throw new Error("DurumSaglayici dışında kullanıldı");
  return k;
}
