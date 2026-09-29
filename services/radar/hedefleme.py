"""Arama listesi v2 — FİKİR kancalı, MUHATAP süzgeçli telefon hedefleri.

NE DEĞİŞTİ (9 Eyl 2026, kullanıcı kararı)
----------------------------------------
v1 site kusuru avlıyordu ("alan adınız 5 gün sonra doluyor"). Kullanıcı artık
site için aramak istemiyor: kanca, işletme türüne özel 3-5 yazılım fikri +
ABD soğuk arama iskeleti (docs/abd-soguk-arama-uyarlamasi.md). Havuz da
değişti: `data/havuz.json` (sitesizler dahil, kurumsal/çağrı merkezi/spam
elenmiş — bkz. havuz.py, muhatap.py).

    ARAMA SKORU = muhatap × bilet × hız × saha × (1 + kalite bonusu)

  * muhatap : telefon türü (cep 1.0 / sabit 0.75) × türün muhatap katsayısı
  * bilet   : türün ödeme gücü (fikirler kataloğu, Tur.bilet)
  * hız     : türün kapanma hızı (Tur.hiz) — "hızlı hızlı proje" isteği
  * saha    : sahadan gelen kanıt (Tur.saha), varsayılan 1.0 — ör. dört
              ret alan psikolog 0.15 ile sıranın sonuna iner
  * kalite  : radar.json'da denetlenmiş ve kalite puanı varsa küçük bonus

Çeşitlilik: aynı türden en fazla TUR_TAVANI, aynı gruptan en fazla
GRUP_TAVANI hedef — 20'lik liste 20 diş kliniği olmasın.

Dürüstlük (11 Eyl 2026'da sıkılaştırıldı): metin demo hazır değilse "yaptım"
DEMEZ, "geliştiriyorum" der. Kanca sorusu SAYI İSTEMEZ, "şu an nasıl
yapıyorsunuz" diye sorar. Cevap duyulmadan etiketleme yapılmaz. Kanıtsız kayıp
iddiası, korku ve yapay aciliyet yoktur. Ban-güvenliği: bu modül AĞA ÇIKMAZ.
"""

from __future__ import annotations

import json
import sqlite3
from collections import Counter
from datetime import datetime

from packages.shared.config import settings
from packages.shared.db import DB_PATH
from services.radar import havuz as havuz_modulu
from services.radar.fikirler import (
    Fikir, Tur, demo_hazir_mi, demo_urunu, grup_bilgisi, tur_profili,
)
from services.radar.overture import _mesafe_m
from services.radar.site_builder import _slugify

RADAR_JSON = settings.data_dir / "radar.json"
CIKTI_MD = settings.data_dir / "arama_listesi.md"
# Panel bu dosyayi okur (Python surecini her sayfa aciliste calistirmamak icin).
CIKTI_JSON = settings.data_dir / "arama_listesi.json"

TUR_TAVANI = 3
GRUP_TAVANI = 6
KALITE_BONUS = 0.3
# Panelde herhangi bir isaret alan isletme yeni listeye girmez (takibi
# /dusunenler ve radar sayfasinda). Kara liste ("olmaz") kalici.
ISARETLI_DURUMLAR = frozenset(
    {"arandi", "olmaz", "gizli", "kapandi", "dusunuyor", "randevu", "musteri"})
# "ulasilamadi" BİLEREK bu kümede değil: açılmayan numara ölü değildir, farklı
# bir saatte tekrar aranır (11 Eyl 2026 — ilk 5 aramanın 4'ü açılmamıştı ve
# hiçbiri kayda geçmemişti). Şu kadar denemeden sonra artık listeye girmez:
TEKRAR_TAVANI = 4
HAT = "Bağdat Caddesi hattı"


# ------------------------------------------------------------------ secim
def isaretli_sluglar() -> set[str]:
    """Yeni listeye GİRMEYECEK slug'lar.

    İki grup: (1) panelde bir karara bağlanmış olanlar (ISARETLI_DURUMLAR),
    (2) TEKRAR_TAVANI kadar aranıp hiç açılmayanlar. Bir-iki kez açılmayan
    numara listede kalır — farklı saatte tekrar denenecek.
    """
    if not DB_PATH.exists():
        return set()
    # `with sqlite3.connect(...)` yalnız commit eder, bağlantıyı KAPATMAZ.
    con = sqlite3.connect(DB_PATH)
    try:
        try:
            satirlar = con.execute(
                "SELECT slug, durum, COALESCE(deneme, 0) FROM radar_durum").fetchall()
        except sqlite3.OperationalError:   # tablo ya da deneme kolonu henüz yok
            try:
                satirlar = [(s, d, 0) for s, d in
                            con.execute("SELECT slug, durum FROM radar_durum")]
            except sqlite3.OperationalError:
                return set()
    finally:
        con.close()
    return {
        slug for slug, durum, deneme in satirlar
        if durum in ISARETLI_DURUMLAR
        or (durum == "ulasilamadi" and deneme >= TEKRAR_TAVANI)
    }


# Görüşmenin sonunda ÜCRETSİZ bir gözlem olarak söylenebilecek bulgular.
# Ölçüt (11 Eyl 2026, kullanıcı kararı): işletme sahibi 10 saniyede KENDİSİ
# doğrulayabilmeli, korku/hukuk iması taşımamalı, suçlayıcı olmamalı.
# Bilerek DIŞARIDA bırakılanlar ve nedenleri:
#   eposta_korumasiz / eposta_acik / mail_spam_riski → telefonda doğrulanamaz
#   kvkk_metni_yok                                   → hukuki iddia, korkutur
#   wp_kullanici_ifsa / guvenlik_basliklari_eksik    → güvenlik korkusu
#   domain_suresi_bitiyor / sertifika_bitiyor        → yapay aciliyet + veri bayatlayabilir
#   arsiv_degismemis / eski_icerik / eski_yazilim    → "yıllardır güncellememişsin" suçlaması
GUVENLI_GOZLEM: dict[str, str] = {
    "olu_domain": "siteniz şu an açılmıyor",
    "sayfa_hatasi": "sitenizde bir sayfa hata veriyor",
    "mobil_uyumsuz": "siteniz telefonda düzgün görünmüyor",
    "tls_gecersiz": "siteye girerken tarayıcı 'güvenli değil' uyarısı veriyor",
    "https_yok": "siteye girerken tarayıcı 'güvenli değil' uyarısı veriyor",
    "adres_calismiyor": "sitedeki adres/harita bağlantısı çalışmıyor",
    "sosyal_onizleme_yok": "sitenizin linkini WhatsApp'ta paylaşınca önizleme çıkmıyor",
    "gercek_kullanici_yavas": "siteniz telefonda yavaş açılıyor",
    "yavas_google": "siteniz telefonda yavaş açılıyor",
}
# Hangisi önce söylenir (en somut olan üstte).
GOZLEM_SIRASI = list(GUVENLI_GOZLEM)


def _gozlem(hit: dict) -> str:
    """Radar denetiminden yalnız güvenli bir gözlem seç; yoksa boş dön."""
    kodlar = {k.get("kod") for k in (hit.get("kusurlar") or []) if isinstance(k, dict)}
    for kod in GOZLEM_SIRASI:
        if kod in kodlar:
            return GUVENLI_GOZLEM[kod]
    return ""


def _radar_kalitesi() -> dict[str, dict]:
    """radar.json'daki denetim sonucu (kalite puanı + varsa güvenli gözlem) —
    slug'a göre. Dosya yoksa boş; havuz bundan bağımsız çalışır."""
    if not RADAR_JSON.exists():
        return {}
    try:
        hits = json.loads(RADAR_JSON.read_text(encoding="utf-8")).get("hits", [])
    except (OSError, ValueError):
        return {}
    return {
        _slugify(h.get("name", "")): {
            "kalite_puani": h.get("kalite_puani"),
            "gozlem": _gozlem(h),
        }
        for h in hits if h.get("name") and not h.get("elendi")
    }


def kalite_ekle(isletmeler: list[dict], kalite: dict[str, dict]) -> list[dict]:
    """Havuz kaydına (kopya) radar denetim bilgisini ekler."""
    return [
        {**av, **kalite.get(_slugify(av.get("name", "")), {})}
        for av in isletmeler
    ]


def _eve_uzaklik_m(av: dict) -> float:
    try:
        return _mesafe_m(float(av["lat"]), float(av["lon"]),
                         settings.radar_lat, settings.radar_lon)
    except (KeyError, TypeError, ValueError):
        return float("inf")


def arama_skoru(av: dict, tur: Tur) -> float:
    muhatap = float(av.get("muhatap_puani") or 0.75) * tur.muhatap
    kalite = av.get("kalite_puani")
    bonus = 1 + KALITE_BONUS * (kalite / 100) if kalite else 1.0
    # tur.saha: sahadan gelen kanıt (bkz. _tip.Tur.saha). Katsayılar masa başı
    # tahmin; bu çarpan telefonda yaşananı taşır.
    return round(100 * muhatap * tur.bilet * tur.hiz * tur.saha * bonus, 1)


def hedefleri_sec(
    isletmeler: list[dict],
    adet: int = 20,
    bolgeler: tuple[str, ...] | None = None,
    atla: set[str] | None = None,
    tur_tavani: int = TUR_TAVANI,
    grup_tavani: int = GRUP_TAVANI,
) -> list[dict]:
    """Arama listesi: aranabilir, işaretlenmemiş işletmeler; skor sırasında,
    tür/grup tavanıyla çeşitlendirilmiş."""
    adaylar: list[tuple[float, float, dict, Tur, str]] = []
    for av in isletmeler:
        if bolgeler and av.get("bolge") not in bolgeler:
            continue
        if not av.get("phone"):
            continue
        slug = _slugify(av.get("name", ""))
        if atla and slug in atla:
            continue
        tur = tur_profili(av.get("kind_tr"))
        adaylar.append((arama_skoru(av, tur), _eve_uzaklik_m(av), av, tur, slug))
    # Eşit skorda eve yakın olan önce: yüz yüze randevu mesafesi (Altıntepe).
    adaylar.sort(key=lambda a: (-a[0], a[1]))

    secilen: list[dict] = []
    tur_sayac: Counter = Counter()
    grup_sayac: Counter = Counter()
    for skor, _uzaklik, av, tur, slug in adaylar:
        if tur_sayac[av.get("kind_tr")] >= tur_tavani or grup_sayac[tur.grup] >= grup_tavani:
            continue
        tur_sayac[av.get("kind_tr")] += 1
        grup_sayac[tur.grup] += 1
        secilen.append(_hedef(av, tur, skor, slug))
        if len(secilen) >= adet:
            break
    return secilen


def _hedef(av: dict, tur: Tur, skor: float, slug: str) -> dict:
    demo = demo_urunu(av.get("kind_tr"))
    return {
        "slug": slug,
        "ad": av.get("name", ""),
        "sektor": av.get("kind_tr"),
        "grup": tur.grup,
        "bolge": av.get("bolge"),
        "telefon": av.get("phone"),
        "telefon_turu": av.get("telefon_turu"),
        "eposta": av.get("eposta") or "",
        "adres": av.get("street") or "",
        # Panel arama listesindeki harita bu ikisiyle çiziyor (10 Eyl 2026).
        "lat": av.get("lat"),
        "lon": av.get("lon"),
        "site": av.get("website") or "",
        "domain": av.get("domain") or "",
        "muhatap_puani": av.get("muhatap_puani"),
        "kalite": av.get("kalite_puani"),
        "arama_skoru": skor,
        "fikirler": [f._asdict() for f in tur.fikirler],
        "demo": demo.kod,
        "demo_hazir": demo_hazir_mi(tur.grup),
        "yan_not": av.get("gozlem") or "",
        "urun": f"{demo.ad} — {demo.yapar}",
    }


# --------------------------------------------------------------- konusma
# İSKELET (11 Eyl 2026'da kullanıcı kararıyla değişti):
#   1 Açılış → 2 Kanca sorusu → 3 SUS/dinle/etiketle/derinleştir →
#   4 Sebep ("ben zaten tam bunun için aradım") → 5 Somut değer → 6 Randevu
#
# NEDEN SORU ÖNE ALINDI: eski sırada ürün ilk 20 saniyede anlatılıyordu ve
# karşı taraf daha soruya gelmeden "satıcı" moduna geçiyordu. Artık önce onun
# MEVCUT YÖNTEMİ konuşuluyor, ürün ancak cevabı duyduktan sonra ve o cevaba
# bağlanarak giriyor.
#
# NE ÇIKARILDI: "para sessizce gidiyor / en pahalı boşluk" gibi kanıtsız ve
# dramatik cümleler; "Anladım, yani elle takip ediyorsunuz" gibi cevabı
# duymadan yapılan varsayımlar; "ilk kurduğum yer siz olursanız fiyatı yüzünüze
# söylerim" gibi pazarlık kokan kalıplar; hesaplanmamış kayıp iddiaları.
ACILIS = (
    "Merhaba, ben Muhammed, Maltepe'den arıyorum, yazılım işi yapıyorum. "
    "Size kısa bir şey soracağım, sonra da neden aradığımı anlatayım — uygun mu?"
)

# 3. adım artık tek bir cümle değil; cevaba göre dallanan bir yol haritası.
# Amaç robot cevap ezberletmek değil, konuşmanın mantığını hatırlatmak.
SUS_KURALI = (
    "Soruyu sorduktan sonra SUS. Cevabı bekle, boşluğu sen doldurma. "
    "Ne derse desin ONUN kelimesiyle tekrarla — kendi varsayımınla değil."
)


def _demo_fikri(h: dict) -> Fikir:
    return next((Fikir(**f) for f in h["fikirler"] if f["kod"] == h["demo"]),
                Fikir(**h["fikirler"][0]))


def dinleme_yolu(demo: Fikir) -> list[dict]:
    """Karşı taraf ne derse ne yapılacağı — varsayım değil, cevaba tepki."""
    yedek = demo.soru2 or "Peki yoğun olduğunuz saatlerde de aynı şekilde mi gidiyor?"
    return [
        {"cevap": "Bir yöntem anlatırsa (defter, program, ben bakıyorum…)",
         "ne_yap": "Onun kelimesiyle tekrarla: \"Anladım, yani ___ üzerinden "
                   "yürüyor.\" Sonra tek soruyla derinleştir: \"Yoğun olduğunuzda "
                   "da aynı şekilde mi gidiyor?\""},
        {"cevap": "\"Bizde öyle bir sorun yok\"",
         "ne_yap": "Tartışma, kabul et: \"İyi o zaman, zaten emin olmak için "
                   f"sordum.\" İstersen tek bir soru daha: \"{yedek}\""},
        {"cevap": "\"WhatsApp'tan hallediyoruz\"",
         "ne_yap": "Küçümseme — çoğu yerde iş görüyor: \"Mantıklı, çoğu yer öyle "
                   "yapıyor. Mesajlara siz mi bakıyorsunuz, yoğunken de yetişiyor "
                   "musunuz?\""},
        {"cevap": "\"Bilmiyorum / öyle bir takibimiz yok\"",
         "ne_yap": "Baskı yok: \"Normal, bunu sayıyla tutan az zaten. Ben de tam "
                   "onun için arıyorum.\""},
        {"cevap": "\"Daha önce denedik / böyle bir şeyimiz vardı, bıraktık\"",
         "ne_yap": "Bu duyabileceğin EN DEĞERLİ cevap — ihtiyaç varmış, "
                   "denenen şey tutmamış. Savunmaya geçme, satmaya çalışma; "
                   "tek soru sor ve not al: \"Ne denediniz, hangi tarafı "
                   "yürümedi?\" Sonra: \"Ben hâlâ geliştiriyorum, bunu "
                   "bilmek benim işime yarar.\""},
        {"cevap": "Kısa kesip \"ne satıyorsun\" derse",
         "ne_yap": "Dürüst ol, kaçma: \"Haklısınız, sonunda satmak isterim ama "
                   "önce sizde nasıl yürüdüğünü anlamadan teklif etmem doğru "
                   "olmaz.\""},
    ]


def konusma(h: dict) -> dict:
    """Bir hedefin telefon metni. Arama kâğıdı ve panel için TEK kaynak."""
    demo = _demo_fikri(h)
    grup = grup_bilgisi(h["grup"])
    sektor = (h.get("sektor") or "işletme").lower()

    # 4. adım: soru cevaplandıktan SONRA. İddia yok — yalnız ne yaptığım.
    sebep = (f"Ben zaten tam bunun için aradım: {sektor} gibi yerler için "
             f"'{demo.ad}' diye bir şey geliştiriyorum. {grup.sebep}")

    # 5. adım: ürünün tamamı değil, konuştuğunuz şeye karşılık gelen tek fayda.
    if h.get("demo_hazir"):
        somut = (f"Kısaca ne yapıyor: {demo.yapar} Bunu ekranda 10 dakikada "
                 f"göstermek en kolayı — {grup.demo_senaryo}")
    else:
        somut = (f"Şu an geliştiriyorum, çalışan bir taslağı var. Kısaca: "
                 f"{demo.yapar} Sizin anlattığınız tarafa denk düşüyor mu, onu "
                 "görmek isterim.")

    return {
        "acilis": ACILIS,
        "soru": demo.soru,
        "soru2": demo.soru2,
        "sus": SUS_KURALI,
        "dinle": dinleme_yolu(demo),
        "sebep": sebep,
        "somut": somut,
        "randevu": grup.kapanis,
        "itirazlar": itirazlar(demo),
        "yan_not": h.get("yan_not") or "",
    }


def itirazlar(demo: Fikir) -> list[dict]:
    """Sık gelen 11 itiraz. Kural: tartışma, savunma ve baskı yok; karşı tarafın
    dediğini kabul edip bir adım ilerlet ya da nazikçe bırak."""
    return [
        {"itiraz": "Bizde öyle bir sorun yok",
         "cevap": "Olabilir, zaten emin olmak için sordum. O zaman size uygun "
                  "olmayabilir; yine de aklınızda olsun, rahatsız etmeyeyim."},
        {"itiraz": "Zaten WhatsApp'tan / elle yapıyoruz",
         "cevap": "Mantıklı, çoğu yer öyle yapıyor. Benim yaptığım onun yerine "
                  "geçmiyor; aynı işi siz uğraşmadan yapıyor. Farkı 10 dakikada "
                  "görürsünüz."},
        {"itiraz": "Zaten bir sistemimiz var",
         "cevap": f"İyi. Kullandığınız sistemde '{demo.ad}' tarafı da var mı? "
                  "Varsa zaten gerek yok; yoksa yanına takılabiliyor."},
        {"itiraz": "Fiyat ne?",
         "cevap": f"Kurulum {demo.kurulum} ₺, aylık {demo.aylik} ₺ bandında — "
                  "kapsama göre değişiyor. Görmeden kesin rakam vermek doğru "
                  "olmaz, 10 dakikada gösterip net söyleyeyim."},
        {"itiraz": "WhatsApp'tan gönderin",
         "cevap": "Gönderebilirim. Yalnız ekranda iki dakikada anlaşılan şey "
                  "yazışmada uzuyor; siz bir bakın, uygun bulursanız uğrarım."},
        {"itiraz": "Şu an müsait değilim",
         "cevap": "Tabii, ben aradım. Ne zaman uygun olur — yarın sabah mı, "
                  "öğleden sonra mı?"},
        {"itiraz": "Bizim yazılımcımız var",
         "cevap": f"İyi olmuş. Bu site işi değil, '{demo.ad}'; isterseniz ona da "
                  "göstereyim, o baksın."},
        {"itiraz": "Daha önce denedik, memnun kalmadık / manuel devam ediyoruz",
         "cevap": "Anlıyorum, iyi ki söylediniz. Tek şey merak ettim: ne "
                  "denediniz, hangi tarafı yürümedi? Ben hâlâ geliştirdiğim "
                  "için bunu bilmek benim işime yarar. Uymazsa üstelemem."},
        {"itiraz": "Şu anda ihtiyacımız yok",
         "cevap": "Anladım. Bu tarafta bir şey değişirse aklınızda olsun; "
                  "isterseniz numaramı bırakayım, siz ararsınız."},
        {"itiraz": "Paramız yok / bütçe yok",
         "cevap": "Anlıyorum, şu an uygun değilse zorlamayayım. Küçük bir "
                  "kapsamla da başlanabiliyor ama karar sizin."},
        {"itiraz": "Düşünüp döneriz",
         "cevap": "Tabii. Neye bakmak istersiniz, ona göre kısa bir özet "
                  "göndereyim. Bir hafta sonra bir kez arayayım mı?"},
    ]


# ---------------------------------------------------------- arama kagidi
def arama_kagidi(hedefler: list[dict], havuz_tarihi: str | None = None) -> str:
    bugun = datetime.now().strftime("%d.%m.%Y")
    sat = [
        f"# Arama Listesi — {bugun}",
        "",
        f"{len(hedefler)} hedef · {HAT} · kurumsal/çağrı merkezi/zincir elenmiş, "
        "cep numarası öncelikli, türe göre çeşitlendirilmiş.",
        "",
        "> **Amaç satış değil, 10 dakikalık yüz yüze görüşme.** Sıra: açılış → "
        "soru → SUS → sebep → somut → randevu.",
        "> Ürünü ilk 20 saniyede anlatma. Kanca sorusunu sorduktan sonra SUS; "
        "cevabı duymadan etiketleme yapma, onun kelimesiyle tekrarla.",
        "> Karşı tarafın söylemediği bir sorunu ona söyletme. Rakam iddiası, "
        "korku ve yapay aciliyet yok.",
        "> Adı biliyorsan \"Ali Bey'le mi görüşüyorum?\" ile başla; bilmiyorsan "
        "işletme adını OKUMA (harita verisindeki adlar bozuk olabilir).",
    ]
    if havuz_tarihi:
        sat.append(f"> Havuz: {havuz_tarihi[:10]} Overture taraması.")
    sat.append("")

    for i, h in enumerate(hedefler, 1):
        k = konusma(h)
        demo = _demo_fikri(h)
        hazir = ("demo hazır — \"gösterebilirim\""
                 if h.get("demo_hazir") else "demo YOK — \"geliştiriyorum\" de")
        sat += [
            f"## {i}. {h['ad']}",
            f"`{h['telefon']}` ({h.get('telefon_turu')}) · {h['sektor']} · {h['bolge']} · "
            f"skor {h['arama_skoru']} · {hazir}",
            "",
            "### 1. Açılış",
            k["acilis"],
            "",
            "### 2. Kanca sorusu",
            k["soru"],
        ]
        if k.get("soru2"):
            sat += ["", f"*Yedek soru (ilk soru havada kalırsa):* {k['soru2']}"]
        sat += ["", "### 3. SUS → dinle → etiketle → derinleştir", k["sus"], ""]
        for d in k["dinle"]:
            sat.append(f"- **{d['cevap']}** → {d['ne_yap']}")
        sat += [
            "",
            "### 4. Sebep — neden aradım",
            k["sebep"],
            "",
            "### 5. Somut değer",
            k["somut"],
            "",
            "### 6. Randevu",
            k["randevu"],
            "",
            f"**Ürün:** {demo.ad} · kurulum {demo.kurulum} ₺ · aylık {demo.aylik} ₺ "
            "(öneri; kapsama göre değişir)",
            "",
            "### Olası itirazlar",
        ]
        for it in k["itirazlar"]:
            sat.append(f"- **\"{it['itiraz']}\"** → {it['cevap']}")
        if k["yan_not"]:
            sat += [
                "",
                "### Görüşmenin sonunda — ücretsiz gözlem (satma, sadece söyle)",
                f"\"Bu arada bakarken gördüm: {k['yan_not']}. İsterseniz ekran "
                "görüntüsünü atayım, kendiniz de bakarsınız.\"",
                "",
                "> Aramadan önce KENDİN bir kez bak — ölçüm birkaç gün önce yapıldı, "
                "arada düzeltmiş olabilirler.",
            ]
        sat += ["", "### Bu türe satılabilecek diğer fikirler (ikinci görüşme)"]
        for f in h["fikirler"]:
            if f["kod"] == h["demo"]:
                continue
            sat.append(f"- **{f['ad']}** — {f['soru']} ({f['kurulum']} / {f['aylik']} ₺)")
        sat.append("")
    return "\n".join(sat)


# --------------------------------------------------------------- calistir
def calistir(adet: int = 20, bolgeler: tuple[str, ...] | None = None) -> list[dict]:
    """havuz.json (+ varsa radar.json kalitesi) → arama listesi (md + json). Ağa çıkmaz."""
    veri = havuz_modulu.yukle()
    isletmeler = kalite_ekle(veri.get("isletmeler", []), _radar_kalitesi())
    hedefler = hedefleri_sec(isletmeler, adet=adet, bolgeler=bolgeler, atla=isaretli_sluglar())
    CIKTI_MD.write_text(arama_kagidi(hedefler, veri.get("olusturuldu")), encoding="utf-8")
    CIKTI_JSON.write_text(json.dumps({
        "uretildi": datetime.now().isoformat(timespec="seconds"),
        "tarama": veri.get("olusturuldu"),
        "bolgeler": list(bolgeler) if bolgeler else veri.get("bolgeler", []),
        "kaynak": "havuz",
        "hedefler": [{**h, "konusma": konusma(h)} for h in hedefler],
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    return hedefler


def ozet(hedefler: list[dict]) -> str:
    if not hedefler:
        return "Ölçüte uyan hedef yok — havuzu yenile (--havuz) ya da işaretleri gözden geçir."
    sat = [f"📞 {len(hedefler)} hedef seçildi → {CIKTI_MD}", ""]
    for i, h in enumerate(hedefler, 1):
        sat.append(f"{i:>2}. {h['ad'][:32]:<32} {(h['sektor'] or '')[:18]:<18} "
                   f"{(h['bolge'] or '')[:12]:<12} {h['telefon_turu']:<6} "
                   f"{h['demo']:<20} {h['arama_skoru']}")
    return "\n".join(sat)
