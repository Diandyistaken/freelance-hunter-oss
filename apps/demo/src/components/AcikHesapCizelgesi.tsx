"use client";

import { borcYasi, kalanBorc, tarihOku } from "@/lib/islem";
import { gunYaz, type Uye } from "@/lib/veri";
import { tl } from "@/lib/fiyat";

// GÜN SONU ÇIKTISI — şartname §4, madde 5.
//
// Komitenin bu ürün için bulduğu en ağır risk "ikinci defter": para söz
// konusu olunca kâğıt defter bırakılmaz, yanına ekran açılır; iki kayıt altı
// haftada birbirini tutmaz, kâğıt kazanır, ekran ölür. Çare kâğıdı yasaklamak
// değil, kâğıdı SİSTEMDEN basmak: masadaki liste her sabah buradan çıkar, gün
// içinde alınan nakit "Bugün alınan" sütununa elle yazılır, akşam deftere
// işlenir, ertesi gün yenisi basılır. Kayıt tek; kâğıt onun günlük kopyası.
//
// Ekranda HİÇ görünmez (`hidden print:block`), yalnız yazdırınca var. Ölçüler
// bu yüzden pt: ekran kademeleri (15-17px) A4'te yedi sütunu sığdırmıyor.
//
// "Kovalanmıyor" işareti kâğıtta da yazılı: masadaki kişi sahibin bu kararını
// bilmezse o üyeden parayı yüz yüze ister — işaretin önlediği şeyin ta kendisi.

interface Props {
  uyeler: Uye[];
  isletmeAdi: string;
}

const TH = "py-[4pt] pr-[6pt] text-left text-[8pt] font-semibold uppercase tracking-[0.06em]";
const TD = "py-[9pt] pr-[6pt] align-top";

export default function AcikHesapCizelgesi({ uyeler, isletmeAdi }: Props) {
  const satirlar = uyeler
    .filter((u) => kalanBorc(u) > 0)
    .sort((a, b) => (borcYasi(b) ?? 0) - (borcYasi(a) ?? 0));
  const toplam = satirlar.reduce((t, u) => t + kalanBorc(u), 0);

  return (
    <section className="hidden text-[10pt] leading-[1.35] text-ink print:block">
      <p className="text-[8pt] font-semibold uppercase tracking-[0.08em] text-ink-2">
        {isletmeAdi ? `${isletmeAdi} · ` : ""}Açık hesap listesi
      </p>
      <h1 className="mt-[4pt] text-[18pt] font-bold leading-[1.15]">
        {tarihOku(gunYaz(new Date()))}
      </h1>
      <p className="tnum mt-[3pt]">
        {satirlar.length} kişi · {tl(toplam)} ₺ dışarıda · en uzun süredir ödemesiz bekleyen üstte
      </p>

      <table className="tnum mt-[12pt] w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className={TH}>Üye</th>
            <th className={TH}>Telefon</th>
            <th className={`${TH} text-right`}>Anlaşılan</th>
            <th className={`${TH} text-right`}>Alınan</th>
            <th className={`${TH} text-right`}>Kalan</th>
            <th className={TH}>Son ödeme</th>
            <th className={`${TH} w-[24%]`}>Bugün alınan</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((u) => (
            <tr key={u.id} className="border-b border-cizgi-koyu">
              <td className={TD}>
                {u.ad}
                {u.kovalama && (
                  <span className="block text-[8pt] text-ink-2">kovalanmıyor — istenmez</span>
                )}
              </td>
              <td className={`${TD} whitespace-nowrap`}>{u.telefon}</td>
              <td className={`${TD} text-right`}>{tl(u.aidat)}</td>
              <td className={`${TD} text-right`}>{tl(u.odenen)}</td>
              <td className={`${TD} text-right font-semibold`}>{tl(kalanBorc(u))}</td>
              <td className={`${TD} whitespace-nowrap`}>
                {u.sonOdeme ? tarihOku(u.sonOdeme, false) : "hiç yok"}
              </td>
              {/* Kalemle doldurulacak: boş, yalnız alt çizgisi var. */}
              <td className={TD} />
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-[12pt] text-[9pt] text-ink-2">
        Gün içinde alınan her ödeme &quot;Bugün alınan&quot; sütununa yazılır ve
        akşam üye defterine işlenir. Yarın liste yeniden basılır; bu kâğıt
        saklanmaz — kayıt defterde.
      </p>
    </section>
  );
}
