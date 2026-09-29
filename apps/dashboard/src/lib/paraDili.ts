// "Neden umursasın?" — kusuru PARA/RİSK diline çeviren cümleler.
//
// Kimse "web sitesi" satın almaz; müşteri, itibar ve dert azalması satın alır.
// Bu yüzden telefonda kusuru söyledikten sonra karşı tarafın KENDİ rakamıyla
// hesap yaptıran bir cümle gelmeli. Rakamı BİZ uydurmuyoruz — sektörün bilinen
// bilet aralığını söyleyip hesabı ona yaptırıyoruz (en ikna edici hesap,
// insanın kendi kafasında yaptığıdır).
//
// Tam gerekçe ve kullanılmayacak argümanlar: docs/neden-onemsesinler.md

import type { RadarHit } from "@/components/RadarPanel";

export interface ParaCercevesi {
  /** Tek müşterinin işletmeye kabaca değeri — telefonda söylenecek aralık. */
  biletAraligi: string;
  /** "Ayda tek müşteri" hesabını kurduran cümle. */
  kayipCumlesi: string;
  /** Bu sektöre özel ek risk/kaldıraç (KVKK, randevu, rezervasyon...). */
  ekKaldirac?: string;
}

const SEKTOR_BILETI: { esle: RegExp; bilet: string; kaldirac?: string }[] = [
  {
    esle: /diş|dis kliniği|implant|ortodonti/i,
    bilet: "25.000–40.000 ₺ (tek implant/tedavi)",
    kaldirac:
      "Randevu formunuz sağlık verisi topluyor — sitede KVKK aydınlatma metni " +
      "yoksa bunu hukukçunuza sormanızı öneririm; teknik tarafını ben hallederim.",
  },
  {
    esle: /estetik|güzellik|medikal|dermatolog|cerrah|lazer/i,
    bilet: "15.000–60.000 ₺ (tek işlem/paket)",
    kaldirac:
      "Bu işte müşteri önce sitenize bakıp fiyatınızı hak edip etmediğinize " +
      "karar veriyor. Vitrin, fiyatın savunmasıdır.",
  },
  {
    esle: /anaokul|kreş|okul|eğitim|kurs/i,
    bilet: "150.000–300.000 ₺ (bir yıllık kayıt)",
    kaldirac:
      "Veli okulu telefonda araştırıyor. Tek bir kayıt, bu işin bedelinin " +
      "on katı — bir veli bile tereddüt edip vazgeçtiyse hesap zaten kapanmış.",
  },
  {
    esle: /avukat|hukuk|mimar|müşavir|danışman|muhasebe/i,
    bilet: "20.000–100.000 ₺ (tek dosya/proje)",
    kaldirac:
      "Bu meslekte referans kadar ilk izlenim de belirleyici; site, ilk " +
      "görüşmeden önceki sessiz mülakattır.",
  },
  {
    esle: /otel|butik otel|konaklama|suit/i,
    bilet: "8.000–40.000 ₺ (tek rezervasyon)",
    kaldirac:
      "Doğrudan rezervasyon, platform komisyonu ödemediğiniz tek kanaldır — " +
      "site oradaki payı büyütür.",
  },
  {
    esle: /restoran|meyhane|balık|fine|kebap|steak|mutfak/i,
    bilet: "8.000–15.000 ₺ (bir yıllık müdavim)",
    kaldirac:
      "Rezervasyon için linkinizi WhatsApp'ta paylaşan müşteri, çıplak bir " +
      "adres görüyor — masa kararı orada kayboluyor.",
  },
  {
    esle: /kafe|kahve|pastane|fırın|tatlı/i,
    bilet: "5.000–10.000 ₺ (bir yıllık müdavim)",
  },
  {
    esle: /emlak|gayrimenkul/i,
    bilet: "40.000–150.000 ₺ (tek satış komisyonu)",
    kaldirac:
      "Portföy sahibi de alıcı da sizi internetten süzüyor; tek satış bu " +
      "işin bedelini kat kat karşılıyor.",
  },
  {
    esle: /veteriner|klinik|poliklinik|psikolog|diyetisyen|fizyoterapi/i,
    bilet: "5.000–25.000 ₺ (tedavi süreci)",
    kaldirac:
      "Randevu formu kişisel veri topluyor — aydınlatma metni ve güvenli " +
      "bağlantı bu yüzden yalnızca 'güzellik' değil, uyum meselesi.",
  },
  {
    esle: /spor|fitness|pilates|yoga|salon/i,
    bilet: "12.000–30.000 ₺ (yıllık üyelik)",
  },
  {
    esle: /kuaför|berber|güzellik salonu/i,
    bilet: "6.000–15.000 ₺ (bir yıllık müdavim)",
  },
  {
    esle: /mobilya|dekorasyon|iç mimari|kuyumcu|butik|gelinlik/i,
    bilet: "20.000–80.000 ₺ (tek sipariş)",
  },
];

const VARSAYILAN: ParaCercevesi = {
  biletAraligi: "birkaç bin lira",
  kayipCumlesi:
    "Ayda tek bir müşteri bile bu yüzden kaçıyorsa, işin bedeli zaten kendini " +
    "karşılıyor.",
};

export function paraCercevesi(hit: RadarHit): ParaCercevesi {
  const tur = hit.kind_tr || "";
  const bulunan = SEKTOR_BILETI.find((s) => s.esle.test(tur));
  if (!bulunan) return VARSAYILAN;
  return {
    biletAraligi: bulunan.bilet,
    kayipCumlesi:
      `Sizin işinizde tek bir müşteri ${bulunan.bilet} ediyor. Sitenizin ayda ` +
      "kaç kişi kaçırdığını bilmiyorum — ama ayda bir kişi bile olsa hesap " +
      "zaten kapanıyor.",
    ekKaldirac: bulunan.kaldirac,
  };
}

/** Reklam veren işletmeye özel: zaten harcanan para boşa gidiyor. */
export const REKLAM_KALDIRACI =
  "Reklam veriyorsanız şunu bilin: tıklayan kişinin parasını ödüyorsunuz ama " +
  "sayfa geç açıldığı için müşteri geri dönüyor. Önce kapıyı tamir edelim, " +
  "sonra kapıya insan çağıralım.";
