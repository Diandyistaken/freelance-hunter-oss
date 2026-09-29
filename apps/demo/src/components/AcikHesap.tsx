"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";
import { borcYasi, gunOnce, kalanBorc, tarihOku } from "@/lib/islem";
import { whatsappLinki, type Deri } from "@/lib/deri";
import { tl } from "@/lib/fiyat";
import type { Uye } from "@/lib/veri";

// AÇIK HESAP SATIRI — üye defterinin içinde, üyenin açılan kartında.
//
// Şartname: _komite/01-urunler.md §4 (komiteden 3/3 geçen tek yeni fikir).
// Buradaki her karar oradaki bir maddeye karşılık geliyor:
//
//   · İKİ RAKAM + FARK. Anlaşılan ve alınan yan yana; kalan kendiliğinden.
//   · KISMİ ÖDEME. Masadaki kişi alınan tutarı yazar, kalan düşer. Fazlası
//     yazılırsa kalan eksiye inmez (islem.odemeAl kırpar).
//   · MESAJ VARSAYILAN KAPALI (madde 2). Değerin çoğu müşteriye HİÇ
//     dokunmadan geliyor: sahip kimin ne kadar beklettiğini görüyor. Metin
//     ancak istenirse açılır ve borç dili taşımaz (deri.mesaj.acikHesap).
//   · ZORUNLU SÜRTÜNME (madde 4). "Son ödeme X gün önce — bu arada nakit
//     alınmadı" işaretlenmeden gönder bağlantısı hiç çizilmez. Ürünün TEK
//     ölümcül hata modu ödemiş müşteriye borç mesajı: kasadaki kişi nakdi
//     aldı ama işaretlemedi.
//   · "BUNU KOVALAMA" (madde 6). Satır listede kalır (borç borçtur), mesaj
//     kurgusuna hiç girmez.
//
// DURUM SIFIRLAMA ÇAĞIRANDA: bileşen `key={id-odenen}` ile çizilir. Ödeme
// alınınca anahtar değişir, bileşen baştan kurulur — tutar kutusu YENİ kalanla
// dolar, açık metin ve işaretli onay kapanır. Onayın ödemeden sonra açık
// kalması tam da madde 4'ün önlediği şey olurdu.

interface OdemeAlProps {
  kalan: number;
  onOdeme: (tutar: number) => void;
}

/**
 * Tutar kutusu + "Ödeme al". Kutu kalanla dolu gelir: tamamı ödeniyorsa tek
 * dokunuş, taksitse rakam değiştirilir. Üye defterinde ve derste açılan üye
 * kartında AYNI parça — parayı nerede aldıysan orada işaretlersin.
 */
export function OdemeAl({ kalan, onOdeme }: OdemeAlProps) {
  const [rakam, setRakam] = useState(String(kalan));
  const girilen = Number(rakam) || 0;

  // KUTU ESNER, DÜĞME SABİT; kutu yine de rakamı kesecek kadar daralmaz.
  // Üye defterinin panelinde (375px'te ~263px) ikisi tek satıra sığıyor.
  // Derste açılan üye kartı daha dar (~215px): orada alt sınır olmadan kutu
  // 35px'e iniyor ve "2.500" "2.50" okunuyordu — para ekranında kesik rakam
  // yanlış rakamdır. Sığmayınca düğme alt satıra iner.
  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-wrap items-center gap-b2">
        <label className="flex h-eylem min-w-[7.5rem] flex-1 items-center gap-b2 rounded-kontrol border border-cizgi-koyu bg-yuzey px-b3">
          <span className="sr-only">Alınan tutar</span>
          <input
            value={girilen ? tl(girilen) : ""}
            onChange={(e) => setRakam(e.target.value.replace(/\D/g, "").slice(0, 7))}
            inputMode="numeric"
            placeholder="0"
            className="tnum w-full min-w-0 bg-transparent text-govde outline-none placeholder:text-ink-3"
          />
          <span className="text-govde text-ink-3">₺</span>
        </label>
        <button
          type="button"
          disabled={girilen === 0}
          onClick={() => onOdeme(girilen)}
          className="inline-flex h-eylem shrink-0 items-center gap-b2 rounded-kontrol bg-ink px-b4 text-govde font-medium text-uzeri disabled:opacity-35"
        >
          <Check className="size-4" /> Ödeme al
        </button>
      </div>
      {girilen > kalan && (
        <p className="mt-b2 text-kunye text-durum-dikkat">
          Kalan {tl(kalan)} ₺ — fazlası işlenmez, hesap kapanır.
        </p>
      )}
    </div>
  );
}

interface Props {
  uye: Uye;
  deri: Deri;
  /** Üyenin bir sonraki kayıtlı dersi — metin parayı ona bağlar. */
  sonraki: { gun: string; saat: string } | null;
  onOdeme: (tutar: number) => void;
  onKovalama: () => void;
}

export default function AcikHesap({ uye, deri, sonraki, onOdeme, onKovalama }: Props) {
  const [metinAcik, setMetinAcik] = useState(false);
  const [emin, setEmin] = useState(false);

  const kalan = kalanBorc(uye);
  if (kalan === 0) return null;

  const bekleyis = borcYasi(uye) ?? 0;
  const sonOdemeSozu = uye.sonOdeme
    ? `Son ödeme ${tarihOku(uye.sonOdeme, false)} · ${gunOnce(bekleyis)}`
    : `Bu dönem hiç ödeme alınmadı · dönem ${gunOnce(bekleyis)} başladı`;
  const onaySozu = uye.sonOdeme
    ? `Son ödeme ${gunOnce(bekleyis)} kaydedildi. Bu arada nakit alınmadığından eminim.`
    : "Bu dönem hiç ödeme kaydı yok. Bu arada nakit alınmadığından eminim.";
  const metin = deri.mesaj.acikHesap({
    uye: uye.ad.split(" ")[0], seans: "", egitmen: "",
    gun: sonraki?.gun ?? "", saat: sonraki?.saat ?? "",
    kalanTutar: kalan,
  });

  return (
    <div className="mt-b4 border-t border-cizgi pt-b4">
      {/* "Bunu kovalama" bir EYLEM değil, hesabın bir hâli — bu yüzden
          düğme sırasında değil başlıkta, bir işaret kutusu. Üç düğme yan
          yana dizildiğinde telefonda üç satıra dağılıyordu ve "Ödeme al" ile
          aynı ağırlıkta duruyordu. */}
      <div className="flex items-center justify-between gap-b3">
        <p className="etiket">Açık hesap</p>
        <label className="hedef flex items-center gap-b2 text-kunye text-ink-2">
          <input
            type="checkbox"
            checked={uye.kovalama}
            onChange={onKovalama}
            className="size-4 accent-[var(--color-ink)]"
          />
          Bunu kovalama
        </label>
      </div>

      {/* MAKBUZ DİZİMİ: anlaşılan − alınan = kalan, alt alta. Yan yana üç
          sütunda telefonda etiketler birbirine giriyordu ("ANLAŞILAN ALINAN");
          çıkarma işlemi dikeyde zaten böyle okunur. */}
      <dl className="tnum mt-b3 max-w-sm text-govde">
        <div className="flex justify-between gap-b3 py-b1">
          <dt className="text-ink-2">Anlaşılan</dt>
          <dd>{tl(uye.aidat)} ₺</dd>
        </div>
        <div className="flex justify-between gap-b3 py-b1">
          <dt className="text-ink-2">Alınan</dt>
          <dd>− {tl(uye.odenen)} ₺</dd>
        </div>
        <div className="mt-b1 flex items-baseline justify-between gap-b3 border-t border-ink pt-b2">
          <dt className="font-medium">Kalan</dt>
          <dd className="text-one">{tl(kalan)} ₺</dd>
        </div>
      </dl>
      <p className="tnum mt-b2 text-kunye text-ink-3">{sonOdemeSozu}</p>

      <div className="mt-b3">
        <OdemeAl kalan={kalan} onOdeme={onOdeme} />
      </div>

      {/* HATIRLATMA METNİ — VARSAYILAN KAPALI. "Kovalama" işaretliyse bu
          bölüm hiç çizilmez: işaretin tek anlamı bu. */}
      {uye.kovalama ? (
        <p className="mt-b3 text-kunye text-ink-3">
          Listede kalır, hatırlatma metni hazırlanmaz.
        </p>
      ) : !metinAcik ? (
        <button
          type="button"
          onClick={() => setMetinAcik(true)}
          className="hedef mt-b3 text-govde text-ink-2 underline underline-offset-4"
        >
          Hatırlatma metnini hazırla
        </button>
      ) : (
        <div className="mt-b3 rounded-yuzey bg-yuzey p-b3">
          <p className="text-govde text-ink-2">{metin}</p>

          <label className="mt-b3 flex items-start gap-b2 text-govde">
            <input
              type="checkbox"
              checked={emin}
              onChange={(e) => setEmin(e.target.checked)}
              className="mt-1 size-5 shrink-0 accent-[var(--color-ink)]"
            />
            <span className={emin ? "text-ink" : "text-durum-dikkat"}>{onaySozu}</span>
          </label>

          {/* ONAY YOKSA BAĞLANTI YOK. `<a>`ya "disabled" yazılamaz; çizilirse
              dokunulur. Onaysızken yerinde yalnız ne yapılacağını söyleyen
              pasif bir kutu duruyor. Bağlantı dolgulu değil: tahsilat metni
              ekranın birincil eylemi değil, en son çare (madde 2). */}
          {emin ? (
            <a
              href={whatsappLinki(uye.telefon, metin)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-b3 inline-flex h-eylem items-center gap-b2 rounded-kontrol border border-ink px-b4 text-govde font-medium text-ink"
            >
              <Send className="size-4" /> WhatsApp&apos;ta aç
            </a>
          ) : (
            <span className="mt-b3 inline-flex h-eylem items-center gap-b2 rounded-kontrol border border-dashed border-cizgi-koyu px-b4 text-govde text-ink-3">
              <Send className="size-4" /> Önce üstteki kutuyu işaretleyin
            </span>
          )}
        </div>
      )}
    </div>
  );
}
