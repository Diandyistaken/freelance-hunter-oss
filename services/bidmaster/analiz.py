"""Kaçırılmaması gereken ilanlar için derin analiz ve teklif üretimi."""

import json
import re
import unicodedata
from datetime import date
from pathlib import Path

from packages.shared.config import settings


SYSTEM = """Sen, 200'den fazla teklifin yarıştığı freelance ilanlarda işi ALAN kıdemli
bir freelance teklif stratejistisin. Görevin, ilanın tam metnini ve freelancer'ın gerçek
yetenek envanterini birlikte değerlendirerek tek seferde dürüst bir iş kararı, uygulanabilir
plan, ticari fiyatlandırma, maliyet hesabı, gerekiyorsa demo inşa spec'i ve doğrudan
kopyalanabilecek kusursuz teklif üretmektir. Sonucun tamamı verilen JSON şemasına uymalıdır.

GENEL KURALLAR
- İlanı yüzeysel özetleme; istenen ürünün çekirdeğini, teknik zorluklarını, teslimatları,
  kısıtları, müşteri beklentisini ve seçim sinyallerini çıkar.
- Yalnızca ilanda ve envanterde bulunan olgulara dayan. Referans, deneyim, teknoloji,
  süre veya sonuç uydurma. Envanterde olmayan bir kabiliyeti varmış gibi gösterme.
- İlanda bulunmayan başlık, platform, bütçe, süre veya rekabet alanına tam olarak
  "belirtilmemiş" yaz.
- Kullanıcıya dönük açıklama alanlarını açık, doğal Türkçe yaz. Teklif metni ise ilanın
  dilinde olmalı; dil güvenilir biçimde belirlenemiyorsa İngilizce yaz.

ANALİZ VE SÜRE
- Önce bu freelancer'ın işi mevcut envanterine göre gerçekten yapıp yapamayacağına karar
  ver. Kritik yetenek veya erişim eksikse yapilabilir=false de; nedeni açıkça yaz. Yalakalık,
  temelsiz iyimserlik ve sırf teklif üretmek için riski küçümsemek yasaktır.
- gun_tahmini gerçekçi tam iş günüdür; keşif, uygulama, entegrasyon, test, hata düzeltme,
  müşteri revizyonu ve teslim tamponunu içerir.
- gun_kirilimi kalem kalem olmalı; her kalem somut bir iş paketi anlatmalı ve günlerin
  toplamı gun_tahmini ile tutarlı olmalıdır. Kesirli gün kullanılabilir.
- riskler_tr dürüst, ilana özgü ve eyleme dönük olmalı. Belirsiz API erişimi, veri kalitesi,
  kapsam kayması, üçüncü taraf onayı, içerik veya müşteri geri dönüşü gibi gerçek riskleri
  belirt; genel geçer dolgu yazma.

FİYAT
- Fiyatı ilandaki bütçe aralığına demirle. Rekabet çoksa dip fiyata inme: aşırı ucuz fiyat
  çaresizlik ve kalite riski sinyali verir. Kapsam ve risk uygunsa orta-alt bantta, gerekçeli,
  güven veren bir fiyat seç.
- onerilen ve min_kabul alanlarında para birimini açıkça yaz. Bütçe belirtilmemişse kapsam,
  saat ve piyasa mantığıyla somut bir fiyat öner; "belirtilmemiş" deme.
- milestone_onerisi_tr ödeme ve onay riskini azaltan, teslimata bağlı aşamalar içersin;
  örneğin keşif/tasarım onayı milestone 1, çalışan çekirdek milestone 2, test ve teslim 3.

MALİYET (FREELANCER'A İÇ HESAP)
- emek_saat gerçek çalışma saatidir ve gün tahminiyle makul biçimde uyumlu olmalıdır.
- dis_maliyetler yalnızca freelancer'ın gerçekten üstleneceği API, hosting, domain, lisans
  gibi kalemlerdir. Çoğu yazılım işi için dış maliyet $0 olabilir; gereksiz kalem uydurma.
- ozet_tr mutlaka şu hesabı anlaşılır biçimde yapmalı: "bu iş sana ~X saat emek + $Y dış
  maliyete mâl olur, kazanç $Z → saatlik ~$W". Para birimleri farklı veya bütçe belirsizse
  dönüşüm uydurma; varsayımı açıkça belirt ve hesaplanabilen kısmı hesapla.

DEMO KARARI
- İlan örnek, demo, link veya portfolio istiyorsa YA DA işin ayırt edici çekirdeği 1-2 günde
  gösterilebilir türdense gerekli=true yap. Gösterilebilir bir çekirdeği olan rekabetçi işte
  demo, teklifin kanıtıdır; sırf tüm ürünü yapmak uzun sürüyor diye demodan vazgeçme.
- Demo gerekmiyorsa repo_adi_onerisi ve spec_md boş dize olabilir.
- Demo gerekiyorsa repo_adi_onerisi kısa, anlamlı kebab-case olmalı.
- Demo gerekiyorsa spec_md, başka bir AI kod ajanının ek bilgi sormadan uygulayabileceği,
  KENDİ KENDİNE YETERLİ bir Markdown inşa şartnamesi olmalı. Şunları mutlaka içer:
  amaç ve kapsam; seçilen teknoloji; tam dosya ağacı; özellik listesi; ilanın en zor veya
  en ayırt edici sorununun çözümünü merkeze alan teknik yaklaşım; veri/etkileşim akışı;
  İngilizce placeholder içerik; çalıştırma talimatı; kabul kriterleri. Kabul kriterlerinde
  konsolda hata olmaması, responsive görünüm ve W3C uyumu açıkça yer almalı. Demo küçük ama
  ikna edici olmalı; gerçek sır, ücretli servis veya müşteri verisi gerektirmemeli.

TEKLİF METNİ
- İlanın dilinde yaz; belirsizse İngilizce. teklif.dil alanında kullanılan dili açıkça belirt.
- İlk cümle selamlama veya genel tanıtım değil, ilanın EN SPESİFİK detayına ya da sorduğu en
  zor soruya doğrudan cevap veren güçlü bir hook olmalı.
- Hedef uzunluk 1500 karakter veya altı, mutlak tavan 4000 karakterdir. Kısa, yoğun ve doğal
  yaz; şablon kokusu verme.
- Önerilen fiyatı ve toplam gün sayısını metinde açıkça belirt.
- Teslimatları kolay taranan madde işaretleriyle ver.
- Tek, akıllı ve kapsamı netleştiren bir soruyla bitir.
- Demo gerekliyse metinde aynen [LIVE DEMO LINK] ve [REPO LINK] placeholder'larının ikisi de
  geçmeli. Demo gerekmiyorsa bu placeholder'ların hiçbiri geçmemeli.
- İletişim bilgisi, e-posta, telefon, platform dışına davet, uydurma referans, boş övgü,
  yapay aciliyet veya seri üretilmiş teklif dili kesinlikle kullanma.

KARAR
- karar_tr tek satırlık, net bir eylem kararıdır: teklif ver/verme, ana gerekçe ve gerekiyorsa
  şart. Diğer alanlarla çelişmemelidir.
"""


OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "ilan": {
            "type": "object",
            "properties": {
                "baslik_tr": {"type": "string"},
                "platform": {"type": "string"},
                "butce": {"type": "string"},
                "sure": {"type": "string"},
                "rekabet": {"type": "string"},
            },
            "required": ["baslik_tr", "platform", "butce", "sure", "rekabet"],
            "additionalProperties": False,
        },
        "analiz": {
            "type": "object",
            "properties": {
                "yapilabilir": {"type": "boolean"},
                "guven": {"type": "string", "enum": ["yüksek", "orta", "düşük"]},
                "gun_tahmini": {"type": "integer"},
                "gun_kirilimi": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {"is": {"type": "string"}, "gun": {"type": "number"}},
                        "required": ["is", "gun"],
                        "additionalProperties": False,
                    },
                },
                "neden_tr": {"type": "string"},
                "riskler_tr": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["yapilabilir", "guven", "gun_tahmini", "gun_kirilimi", "neden_tr", "riskler_tr"],
            "additionalProperties": False,
        },
        "fiyat": {
            "type": "object",
            "properties": {
                "onerilen": {"type": "string"}, "min_kabul": {"type": "string"},
                "gerekce_tr": {"type": "string"}, "milestone_onerisi_tr": {"type": "string"},
            },
            "required": ["onerilen", "min_kabul", "gerekce_tr", "milestone_onerisi_tr"],
            "additionalProperties": False,
        },
        "maliyet": {
            "type": "object",
            "properties": {
                "emek_saat": {"type": "number"},
                "dis_maliyetler": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {"kalem": {"type": "string"}, "tutar": {"type": "string"}},
                        "required": ["kalem", "tutar"], "additionalProperties": False,
                    },
                },
                "ozet_tr": {"type": "string"},
            },
            "required": ["emek_saat", "dis_maliyetler", "ozet_tr"],
            "additionalProperties": False,
        },
        "demo": {
            "type": "object",
            "properties": {
                "gerekli": {"type": "boolean"}, "neden_tr": {"type": "string"},
                "repo_adi_onerisi": {"type": "string"}, "spec_md": {"type": "string"},
            },
            "required": ["gerekli", "neden_tr", "repo_adi_onerisi", "spec_md"],
            "additionalProperties": False,
        },
        "teklif": {
            "type": "object",
            "properties": {
                "metin": {"type": "string"}, "dil": {"type": "string"},
                "ozet_tr": {"type": "string"},
            },
            "required": ["metin", "dil", "ozet_tr"], "additionalProperties": False,
        },
        "karar_tr": {"type": "string"},
    },
    "required": ["ilan", "analiz", "fiyat", "maliyet", "demo", "teklif", "karar_tr"],
    "additionalProperties": False,
}


def _slug(metin: str) -> str:
    """Başlığı güvenli ve okunabilir bir dosya adına dönüştürür."""
    ceviri = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    sade = unicodedata.normalize("NFKD", metin.translate(ceviri))
    sade = sade.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", sade).strip("-")[:70] or "teklif"


def _is_dosyasi_yaz(sonuc: dict) -> Path:
    """Analiz sonucunu kullanıma hazır Markdown iş dosyasına yazar."""
    ilan = sonuc["ilan"]
    analiz = sonuc["analiz"]
    fiyat = sonuc["fiyat"]
    maliyet = sonuc["maliyet"]
    demo = sonuc["demo"]
    teklif = sonuc["teklif"]["metin"]
    karar_emoji = "✅" if analiz["yapilabilir"] else "⛔"
    kirilim = "\n".join(f"| {x['is']} | {x['gun']} |" for x in analiz["gun_kirilimi"])
    riskler = "\n".join(f"- {x}" for x in analiz["riskler_tr"]) or "- Belirtilen ek risk yok."
    dis_maliyet = "\n".join(
        f"- {x['kalem']}: {x['tutar']}" for x in maliyet["dis_maliyetler"]
    ) or "- $0"
    sonraki = (
        "- [ ] 1) Spec'i kod ajanına yaptır\n"
        f"- [ ] 2) `python tools/publish_demo.py <klasör> {demo['repo_adi_onerisi']}`\n"
        "- [ ] 3) Teklifteki [LIVE DEMO LINK] / [REPO LINK] alanlarını doldur\n"
        "- [ ] 4) Freelancer'a yapıştır"
        if demo["gerekli"] else "- [ ] Teklifi yapıştır, gönder"
    )
    demo_bolumu = f"\n## Demo spec\n\n{demo['spec_md']}\n" if demo["gerekli"] else ""
    icerik = f"""# {ilan['baslik_tr']}

## İlan özeti

- Platform: {ilan['platform']}
- Bütçe: {ilan['butce']}
- Süre: {ilan['sure']}
- Rekabet: {ilan['rekabet']}

## KARAR

{karar_emoji} {sonuc['karar_tr']}

## Analiz

- Yapılabilir: {'Evet' if analiz['yapilabilir'] else 'Hayır'}
- Güven: {analiz['guven']}
- Gün tahmini: {analiz['gun_tahmini']}
- Gerekçe: {analiz['neden_tr']}

| İş | Gün |
|---|---:|
{kirilim}

### Riskler

{riskler}

## Fiyat & Maliyet

- Önerilen fiyat: {fiyat['onerilen']}
- Minimum kabul: {fiyat['min_kabul']}
- Fiyat gerekçesi: {fiyat['gerekce_tr']}
- Milestone önerisi: {fiyat['milestone_onerisi_tr']}
- Emek: ~{maliyet['emek_saat']} saat
- Dış maliyetler:
{dis_maliyet}
- Özet: {maliyet['ozet_tr']}

## Teklif metni

````text
{teklif}
````

Karakter sayısı: **{len(teklif)}**
{demo_bolumu}
## Sonraki adımlar

{sonraki}
"""
    klasor = settings.data_dir / "teklifler"
    klasor.mkdir(parents=True, exist_ok=True)
    yol = klasor / f"{date.today().isoformat()}-{_slug(ilan['baslik_tr'])}.md"
    yol.write_text(icerik, encoding="utf-8")
    return yol


def analiz_et(ilan_metni: str, kaynak: str = "manuel") -> dict:
    """Tam ilan metnini tek Sonnet çağrısıyla analiz eder ve iş dosyasını yazar."""
    if not isinstance(ilan_metni, str) or len(ilan_metni.strip()) < 80:
        raise ValueError("İlan metni çok kısa; analiz için en az 80 karakterlik tam ilan metni gerekli.")

    import anthropic

    envanter = settings.profile_path.read_text(encoding="utf-8")
    prompt = (
        f"KAYNAK: {kaynak}\n\n"
        f"FREELANCER YETENEK ENVANTERİ:\n{envanter}\n\n"
        f"TAM İLAN METNİ:\n{ilan_metni.strip()}"
    )
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    resp = client.messages.create(
        model=settings.model_strong,
        max_tokens=8000,
        system=SYSTEM,
        thinking={"type": "disabled"},
        output_config={"format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    )
    raw = next(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()
    sonuc = json.loads(raw)
    yol = _is_dosyasi_yaz(sonuc)
    sonuc["teklif_karakter_sayisi"] = len(sonuc["teklif"]["metin"])
    sonuc["dosya_yolu"] = str(yol)

    print(f"{'✅' if sonuc['analiz']['yapilabilir'] else '⛔'} Karar: {sonuc['karar_tr']}")
    print(f"🗓️ Gün: {sonuc['analiz']['gun_tahmini']} · 💰 Fiyat: {sonuc['fiyat']['onerilen']}")
    print(f"🧾 Maliyet: {sonuc['maliyet']['ozet_tr']}")
    print(f"🧪 Demo: {'Evet' if sonuc['demo']['gerekli'] else 'Hayır'} · 📄 {yol}")
    return sonuc
