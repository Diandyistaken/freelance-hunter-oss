// Arama Kartı'nın interaktif konuşma ağacı — açılıştan SONRAsı.
//
// /arama sayfasındaki Konuşma Ağacı sektöre göre geneldir; bu ağaç O LEAD'e
// bağlıdır: ölçülen kusuru, fiyat bandını ve varsa demo linkini içine alır.
// Karşı taraf ne derse ona tıklarsın, ne söyleyeceğin gelir — konuşurken
// listede kaybolmamak için her düğümde en fazla 4-5 seçenek var.

import type { RadarHit } from "@/components/RadarPanel";
import { fiyatPlani, musteridenIstenecekler, senaryoSec } from "@/lib/aramaSenaryosu";
import { sayiMetni, tamAnlatim } from "@/lib/kusurAnlatimi";
import { onarimPlani } from "@/lib/onarimPlani";

export type Ton = "olumlu" | "olumsuz" | "notr";

export interface AgacTepki {
  etiket: string;   // karşı tarafın söylediği (butona bu yazılır)
  ton: Ton;
  hedef: string;    // gidilecek düğüm
}

export interface AgacDugumu {
  id: string;
  baslik: string;        // ne durumdayız
  metin: string;         // SEN ne diyeceksin (kopyalanabilir)
  ipucu?: string;        // taktik notu (söylenmez, sana)
  tepkiler: AgacTepki[];
  sonuc?: "kazanildi" | "kaybedildi" | "beklemede";
}

const tl = (n: number) => n.toLocaleString("tr-TR");

export function aramaAgaciKur(
  hit: RadarHit,
  demoLinki: string,
  referansModu = false,
): Record<string, AgacDugumu> {
  const senaryo = senaryoSec(hit);
  const plan = fiyatPlani(hit, referansModu);
  const onarim = onarimPlani(hit, referansModu);
  const enAgir = hit.kusurlar?.[0];
  const demoCumlesi = demoLinki
    ? `Şu an elimde hazır: ${demoLinki}`
    : "Bugün içinde hazırlayıp göndereyim.";
  const onarimKalemleri = onarim.kalemler
    .map((k) => k.ad.split("(")[0].trim().toLocaleLowerCase("tr"))
    .join(", ");

  return {
    acilis: {
      id: "acilis",
      baslik: "Açılışı söyledin, sustun. Ne dedi?",
      metin: `“${senaryo.gozlem(hit)} Haberiniz var mıydı?”`,
      ipucu: "Soruyu sorduktan sonra konuşma. İlk konuşan o olsun.",
      tepkiler: [
        { etiket: "“Yok, ne olmuş?” / ilgilendi", ton: "olumlu", hedef: "ilgilendi" },
        { etiket: "“Bizim sitemiz var zaten”", ton: "notr", hedef: "sitemiz_var" },
        { etiket: "“Kaça yapıyorsun?”", ton: "notr", hedef: "fiyat" },
        { etiket: "“Şu an meşgulüm”", ton: "notr", hedef: "mesgul" },
        { etiket: "“İlgilenmiyorum”", ton: "olumsuz", hedef: "red" },
      ],
    },

    ilgilendi: {
      id: "ilgilendi",
      baslik: "Kapı aralandı — kusuru anlat, çözümü göster",
      metin: senaryo.devam,
      ipucu:
        "Teknik anlatma. Müşteri gözüyle ne kaybettiğini söyle, sonra hemen " +
        "somut bir şey öner (demo linki).",
      tepkiler: [
        { etiket: "“Göster bakalım” / demo istedi", ton: "olumlu", hedef: "demo" },
        { etiket: "“Başka sorun var mı?”", ton: "olumlu", hedef: "tum_kusurlar" },
        { etiket: "“Kaça yapıyorsun?”", ton: "olumlu", hedef: "fiyat" },
        { etiket: "“Bir düşüneyim”", ton: "notr", hedef: "dusunecek" },
        { etiket: "“Bizim yeğen/arkadaş bakıyor”", ton: "notr", hedef: "yegen" },
      ],
    },

    tum_kusurlar: {
      id: "tum_kusurlar",
      baslik: `Tam liste — ${sayiMetni(hit) || "ölçülen bulgular"}, kritikten küçüğe`,
      metin: tamAnlatim(hit) || "Kayıtlı kusur yok — açılış kusuruna dön.",
      ipucu:
        "Cümle aralarında DUR; tepki almadan sıradakine geçme. Bitince SUS — " +
        "kapanış sorusu iki yolu da (yenileme/onarım) masaya koyuyor, seçimi o " +
        "yapsın. Doğrulayamayacağı kusuru atlamakta özgürsün.",
      tepkiler: [
        { etiket: "“Bunları düzeltmek kaça?”", ton: "notr", hedef: "sadece_onarim" },
        { etiket: "“Yenisi kaça olur?”", ton: "olumlu", hedef: "fiyat" },
        { etiket: "“Önce göreyim”", ton: "olumlu", hedef: "demo" },
        { etiket: "Sıkıldı — çözüme dön", ton: "olumsuz", hedef: "ilgilendi" },
      ],
    },

    sadece_onarim: {
      id: "sadece_onarim",
      baslik: onarim.mumkun
        ? "“Site kalsın, düzeltin” — onarım paketi + dürüst kıyas"
        : "“Site kalsın, düzeltin” — bu lead'de onarım YOK",
      metin: onarim.mumkun
        ? `“Olur, onarım da yapıyorum: ${onarimKalemleri}. Toplam ` +
          `${tl(onarim.min)}–${tl(onarim.max)} ₺, ${onarim.gunMin}-${onarim.gunMax} ` +
          `günde; önce/sonra ölçüm raporuyla teslim ederim.` +
          (onarim.cozulmeyenler.length
            ? ` Yalnız dürüst olayım: ${onarim.cozulmeyenler[0].neden}`
            : "") +
          ` ${onarim.kiyas} İkisini de yaparım, karar sizin.”`
        : `“Açık konuşayım: bu sitede onarılacak sağlam bir gövde yok — ` +
          `${onarim.cozulmeyenler[0]?.neden ?? "site zaten ayakta değil."} O yola ` +
          `para vermenizi istemem; kalıcı çözüm yeniden kurulum, o da ` +
          `${tl(plan.min)} ₺'den başlıyor.”`,
      ipucu:
        `${onarim.erisimSarti} Şifre kalıcı sende DURMASIN — iş bitince ` +
        "değiştirtsin. Kapsamı ve 'bu pakette çözülmeyenler' listesini YAZILI " +
        "gönder ki teslimde tartışma çıkmasın. Onarım da satıştır, küçümseme.",
      tepkiler: onarim.mumkun
        ? [
            { etiket: "“Tamam, onarımı yapalım”", ton: "olumlu", hedef: "anlasildi_onarim" },
            { etiket: "“O zaman yenisini konuşalım”", ton: "olumlu", hedef: "fiyat" },
            { etiket: "“Düşüneyim”", ton: "notr", hedef: "dusunecek" },
            { etiket: "“Vazgeçtim”", ton: "olumsuz", hedef: "red" },
          ]
        : [
            { etiket: "“Yenisini konuşalım”", ton: "olumlu", hedef: "fiyat" },
            { etiket: "“Düşüneyim”", ton: "notr", hedef: "dusunecek" },
            { etiket: "“İlgilenmiyorum”", ton: "olumsuz", hedef: "red" },
          ],
    },

    anlasildi_onarim: {
      id: "anlasildi_onarim",
      baslik: "🎉 Onarımda anlaşıldı — erişim + kapora + yazılı kapsam",
      metin:
        "“Harika. %50 kapora ile başlıyorum, kalanı önce/sonra ölçüm raporuyla " +
        "teslimde. Sizden şunlar lazım: hosting/yönetim paneli erişimi ve alan " +
        "adı yönetimi erişimi. Şifreleri iş bitince değiştirin, bende kalmasın. " +
        "Kapsamı ve bu pakette çözülmeyenleri WhatsApp'tan yazılı atıyorum.”",
      ipucu:
        "Kaporasız iş = hobi (onarımda da). Yazılı kapsamda 'çözülmeyenler' " +
        "(ör. mobil görünüm) MUTLAKA dursun. Radar'da ✅ Arandı işaretle; " +
        "teslimden 1 hafta sonra yenileme teklifini hatırlat.",
      tepkiler: [],
      sonuc: "kazanildi",
    },

    sitemiz_var: {
      id: "sitemiz_var",
      baslik: "“Sitemiz var” — zaten bunu konuşuyoruz",
      metin:
        `“Var, ben de zaten sitenize baktığım için arıyorum. ${
          enAgir ? enAgir.baslik.toLocaleLowerCase("tr") : "birkaç aksayan yer var"
        }. Yani site duruyor ama müşteri tarafında istediğiniz gibi çalışmıyor.”`,
      ipucu:
        "Onaylayarak başla ('var'), sonra ölçtüğün şeyi söyle. Tartışma; " +
        "istersen doğrulama adımını da söyle, kendi gözüyle görsün.",
      tepkiler: [
        { etiket: "“Öyle mi, bakayım” / ikna oldu", ton: "olumlu", hedef: "ilgilendi" },
        { etiket: "“Neler bozukmuş, tam söyle”", ton: "olumlu", hedef: "tum_kusurlar" },
        { etiket: "“Bize normal görünüyor”", ton: "notr", hedef: "gorunmuyor" },
        { etiket: "“Yapan arkadaş baksın”", ton: "notr", hedef: "yegen" },
      ],
    },

    gorunmuyor: {
      id: "gorunmuyor",
      baslik: "“Bize normal görünüyor” — kendi gözüyle görsün",
      metin: enAgir?.dogrula
        ? `“Şöyle bakalım isterseniz: ${enAgir.dogrula.split("NOT:")[0].trim()} Ben bekliyorum.”`
        : "“İsterseniz şimdi kendi telefonunuzdan açın, birlikte bakalım. Ben bekliyorum.”",
      ipucu:
        "EN GÜÇLÜ HAMLE. Kendi cihazında görürse tartışma biter. Göremezse " +
        "ISRAR ETME — o kusuru bırak, teşekkür edip kapat.",
      tepkiler: [
        { etiket: "Gördü / “Haa evet”", ton: "olumlu", hedef: "ilgilendi" },
        { etiket: "Göremedi / bizde düzgün", ton: "olumsuz", hedef: "geri_cekil" },
      ],
    },

    geri_cekil: {
      id: "geri_cekil",
      baslik: "Göremedi — ısrar etme, itibarını koru",
      metin:
        "“O zaman sizde sorun yok, benim ölçümüm sizin cihazınızda farklı " +
        "çıkmış olabilir. Boşuna vaktinizi aldım, kusura bakmayın. İyi işler.”",
      ipucu:
        "Kanıtlayamadığın şeyi savunmak, kanıtlayabildiklerinin de değerini " +
        "düşürür. Temiz çık — bu numara ileride tekrar aranabilir.",
      tepkiler: [],
      sonuc: "kaybedildi",
    },

    fiyat: {
      id: "fiyat",
      baslik: "Fiyat soruldu — bandı ver, kapsamı çerçevele",
      metin:
        `“${plan.paket} için ${tl(plan.min)}–${tl(plan.max)} ₺ arası. ` +
        `${plan.gunMin}-${plan.gunMax} günde teslim. İsterseniz aylık ` +
        `${tl(plan.bakimAylik)} ₺'ye bakımını da ben üstlenirim ama zorunlu değil — ` +
        `kaynak kod sizin olur, abonelik yok.”`,
      ipucu:
        "Fiyatı SÖYLE, kaçamak yapma; kaçamak güveni bitirir. Aralık ver ki " +
        "kapsam konuşulabilsin. 'Aylık zorunlu abonelik yok' bu pazarda ayrıştırıcı.",
      tepkiler: [
        { etiket: "“Pahalıymış”", ton: "notr", hedef: "pahali" },
        { etiket: "“Olur, nasıl ilerliyoruz?”", ton: "olumlu", hedef: "anlasildi" },
        { etiket: "“Site kalsın, sadece düzeltin”", ton: "notr", hedef: "sadece_onarim" },
        { etiket: "“Önce göreyim”", ton: "olumlu", hedef: "demo" },
        { etiket: "“Düşüneyim”", ton: "notr", hedef: "dusunecek" },
      ],
    },

    pahali: {
      id: "pahali",
      baslik: "“Pahalı” — fiyatı DEĞİL kapsamı küçült",
      metin:
        `“Anlıyorum. Fiyatı kırmak yerine kapsamı küçültelim: tek sayfa, ` +
        `sizin verdiğiniz içerikle, ${tl(plan.min)} ₺. Sonra ihtiyaç oldukça ` +
        `ekleriz. Aylık bakımı da almasanız olur, siteniz yine sizin.”`,
      ipucu:
        "Fiyat indirimi 'demek ki fazla istemiş' dedirtir. Kapsam küçültmek " +
        "fiyatın gerçek olduğunu gösterir. İlk 5 işteysen Referans Fiyatı " +
        "düğmesini aç ve yorumu şart koş.",
      tepkiler: [
        { etiket: "“Tamam bu olur”", ton: "olumlu", hedef: "anlasildi" },
        { etiket: "“Yine de pahalı”", ton: "olumsuz", hedef: "referans_teklifi" },
        { etiket: "“Düşüneyim”", ton: "notr", hedef: "dusunecek" },
      ],
    },

    referans_teklifi: {
      id: "referans_teklifi",
      baslik: "Son kart: referans karşılığı (yalnız ilk işlerde)",
      metin:
        "“Şöyle yapalım: yeni başlıyorum ve buradan referans topluyorum. " +
        "Size uygun bir fiyata yapayım, karşılığında memnun kalırsanız Google'a " +
        "bir yorum bırakın ve isminizi örnek çalışma olarak kullanayım. " +
        "Beğenmezseniz para yok, siteyi silerim.”",
      ipucu:
        "BEDAVA İŞ YOK — en dip sınır yorum karşılığı sembolik ücret. " +
        "Bunu her müşteriye açma, sadece ilk 5 işte.",
      tepkiler: [
        { etiket: "“Olur, deneyelim”", ton: "olumlu", hedef: "anlasildi" },
        { etiket: "Yine hayır", ton: "olumsuz", hedef: "red" },
      ],
    },

    demo: {
      id: "demo",
      baslik: "Demo istedi — hemen gönder, peşinden koşma",
      metin:
        `“Hemen WhatsApp'tan atıyorum. ${demoCumlesi} ` +
        `Şunu da söyleyeyim: bu hazır bir tasarımdan sizin için hazırladığım ` +
        `örnek, birebir son hâli değil — beğenirseniz içeriğinizi koyup ` +
        `kendi adınıza yayına alırız. İlgilenmezseniz linki kaldırıyorum.”`,
      ipucu:
        "DÜRÜSTLÜK SINIRI: 'sıfırdan size özel yaptım' DEME. Linki at, " +
        "kapat. 2 gün sonra BİR kez hatırlat, o kadar.",
      tepkiler: [
        { etiket: "“Beğendim, devam edelim”", ton: "olumlu", hedef: "anlasildi" },
        { etiket: "“Bakarım” dedi", ton: "notr", hedef: "dusunecek" },
        { etiket: "“Beğenmedim”", ton: "notr", hedef: "begenmedi" },
      ],
    },

    begenmedi: {
      id: "begenmedi",
      baslik: "Beğenmedi — tasarım mı, fikir mi?",
      metin:
        "“Hangi kısmı? Renk/tarz meselesiyse elimde farklı tasarımlar var, " +
        "birkaç tane daha göndereyim; beğendiğinizi baz alırız.”",
      ipucu:
        "Beğenmeme genelde tasarım tercihidir, ret değil. Çoklu Yayınla ile " +
        "5 stili birden gönder, seçtirt.",
      tepkiler: [
        { etiket: "Başka tasarım istedi", ton: "olumlu", hedef: "demo" },
        { etiket: "“Gerek yok”", ton: "olumsuz", hedef: "red" },
      ],
    },

    yegen: {
      id: "yegen",
      baslik: "“Yeğenim/arkadaşım bakıyor” — rakip değil, ortak ol",
      metin:
        "“Çok iyi, o zaman teknik detayı ona iletebilirsiniz — ölçtüğüm şeyi " +
        "yazılı göndereyim, kendisi düzeltsin. Vakti olmazsa ben hallederim, " +
        "yine de siz bilirsiniz.”",
      ipucu:
        "Yeğene saldırma — o kişi karar vericinin yakını. Kanıtı gönder; " +
        "genelde yeğenin vakti olmaz ve dönüş sana gelir.",
      tepkiler: [
        { etiket: "“Sen bir bak o zaman”", ton: "olumlu", hedef: "ilgilendi" },
        { etiket: "“Ona söyleyeyim”", ton: "notr", hedef: "dusunecek" },
      ],
    },

    mesgul: {
      id: "mesgul",
      baslik: "Meşgul — 15 saniyede kapat, randevu al",
      metin:
        "“Tabii, sizi tutmayayım. Tek cümle: sitenizde müşteri tarafını " +
        "etkileyen bir sorun var, detayını WhatsApp'tan yazayım, müsait " +
        "olduğunuzda bakarsınız. Bu numara WhatsApp'a açık mı?”",
      ipucu:
        "Meşgul = ret değil. Yazılı kanala geçir; okuma oranı telefondan yüksek.",
      tepkiler: [
        { etiket: "“At bakalım”", ton: "olumlu", hedef: "dusunecek" },
        { etiket: "“Gerek yok”", ton: "olumsuz", hedef: "red" },
      ],
    },

    dusunecek: {
      id: "dusunecek",
      baslik: "Beklemede — takip kuralı",
      metin:
        "“Tabii, acelesi yok. Linki bırakıyorum, 2 gün sonra bir kez " +
        "hatırlatırım; ilgilenmezseniz rahatsız etmem.”",
      ipucu:
        "Radar'da 🤔 Düşünüyor işaretle, notuna 'kaçta arayacağım' yaz. " +
        "İŞLETME BAŞINA EN FAZLA 1 TAKİP — spam yok.",
      tepkiler: [],
      sonuc: "beklemede",
    },

    red: {
      id: "red",
      baslik: "Ret — temiz çık, kapıyı açık bırak",
      metin:
        "“Anladım, rahatsız ettiysem kusura bakmayın. Numaram sizde kalsın, " +
        "ileride lazım olursa ararsınız. İyi işler.”",
      ipucu:
        "Tartışma, ikinci kez deneme. Radar'da ❌ işaretle. Aynı işletmeye " +
        "aylarca tekrar dönme — mahalle küçük, itibar büyük.",
      tepkiler: [],
      sonuc: "kaybedildi",
    },

    anlasildi: {
      id: "anlasildi",
      baslik: "🎉 Anlaşıldı — kaporayı ve içerik listesini şimdi iste",
      metin:
        `“Harika. Şöyle ilerliyoruz: %50 kapora ile başlıyorum, kalanı ` +
        `teslimde. Kapsamı WhatsApp'tan yazılı gönderiyorum ki ikimiz de ` +
        `net görelim. Bir de şunlar lazım: ${musteridenIstenecekler(hit)
          .slice(0, 4)
          .map((m) => m.split("(")[0].trim().toLocaleLowerCase("tr"))
          .join(", ")}… Tam listeyi mesajla atıyorum.”`,
      ipucu:
        "Kaporasız iş = hobi. Kapsamı YAZILI gönder. Alan adı müşterinin " +
        "adına, müşterinin kartıyla — hiçbir şifre sende durmasın. " +
        "Radar'da ✅ Arandı işaretle.",
      tepkiler: [],
      sonuc: "kazanildi",
    },
  };
}
