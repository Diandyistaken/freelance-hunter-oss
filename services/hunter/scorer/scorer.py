"""İlan skorlayıcı + çevirmen — ucuz model (Haiku 4.5) ile tek çağrı.

Girdi: platform bildirimi (herhangi bir dilde) + sıkıştırılmış kabiliyet envanteri
Çıktı (JSON):
  is_ilan     — e-posta gerçekten iş ilanı/talebi mi (pazarlama maili = eleme)
  score       — 0-100 uygunluk
  sinif       — firsat | uygun | suspicious | eleme
  lang        — ilanın orijinal dili (AR/EN/TR/...)
  title_tr    — başlığın Türkçe çevirisi
  ceviri_tr   — bildirilecek sınıflarda TAM Türkçe çeviri; eleme'de tek cümle
                (maliyet: bildirilmeyecek maile tam çeviri üretilmez)
  gerekce_tr  — skorun tek paragraflık gerekçesi
  red_flags   — şüpheli işaretler listesi

Scam savunması — dört katman:
  1. Kara liste (SQLite, ücretsiz) — kullanıcının /karaliste ile öğrettiği
     kalıplar pipeline'da AI'a gitmeden eler
  2. Kural tabanlı kalıplar (ücretsiz) — aşağıdaki çok dilli SUSPICIOUS_HINTS;
     model kaçırsa bile yakalanan ilan suspicious'a çekilir
  3. Model değerlendirmesi (Haiku) — kalıba uymayan yeni dolandırıcılık
     taktiklerini bağlamdan sezer; kararsızsa suspicious der
  4. İnsan kararı — suspicious ilan uyarıyla bildirilir

Maliyet ilkeleri (bkz. README):
  - Profil YAML'ı olduğu gibi değil, ~%60 küçültülmüş özet olarak gönderilir
  - Prompt caching bilinçli olarak KULLANILMIYOR: Haiku 4.5'te önbelleklenebilir
    minimum önek 4096 token, bizim önek ~1500 token — işaret koysak da sessizce
    önbelleklenmez; ayrıca çağrılar seyrek (5 dk TTL dolar), yazma primi boşa gider
"""

import json
import re

import anthropic
import yaml

from packages.shared.config import settings

# Katman 2 — kural tabanlı kalıplar (EN/TR/AR); /karaliste ile öğrenilenler DB'de
SUSPICIOUS_HINTS = [
    # EN
    "wallet recovery", "account recovery", "urgent payment", "telegram only",
    "whatsapp only", "pay outside", "payment outside", "database leak",
    "install this app first", "processing fee", "advance fee", "registration fee",
    "gift card", "cashapp", "anydesk", "teamviewer", "send your id",
    "verification fee", "crypto investment",
    # TR
    "ödemeyi iban", "whatsapptan yaz", "whatsapp'tan yaz", "telegramdan yaz",
    "önce ücret", "kayıt ücreti", "komisyon yatır", "aktivasyon ücreti",
    "kimlik fotoğrafı gönder",
    # AR
    "واتساب", "تليجرام", "خارج المنصة",
]

SYSTEM = """Sen bir freelance iş ilanı değerlendirme uzmanısın. Sana bir platform
bildirimi (e-posta metni veya ilan) ve freelancer'ın yetenek özeti verilecek.

Görevin:
1. Bu bir iş ilanı/talebi mi yoksa pazarlama/bilgilendirme maili mi ayırt et.
2. İlanı yeteneklerle karşılaştırıp 0-100 skor ver. Genişleme alanları da eşleşme
   sayılır — birebir portföy eşleşmesi şart değil, "AI araçlarıyla teknik olarak
   yapılabilir mi?" diye düşün.
   Bütçesi harcanacak emeğe değmeyecek kadar düşük ilanlara düşük skor ver.
3. Dolandırıcılık kalıplarını tara: gerçekdışı bütçe + aciliyet, platform dışı
   ödeme/iletişim isteği (WhatsApp/Telegram/IBAN), "önce şunu indir / ücret yatır /
   şuraya kaydol", kripto cüzdan kurtarma, hesap geri alma, veri sızıntısı işleri,
   kimlik/kart bilgisi isteme, sahte "kazandınız - giriş yapın" oltalama mailleri.
   KARARSIZSAN suspicious de — asla uygun deme.
4. Sınıflandır: firsat (skor>=85 + yüksek bütçe + güvenilir işveren) | uygun
   (skor>=70, temiz) | suspicious | eleme (skor<40 veya ilan değil).
5. Çeviri: sinif firsat/uygun/suspicious ise ilan içeriğini TAM olarak Türkçeye
   çevir (özet değil — kullanıcı orijinal dili hiç bilmiyor). sinif eleme ise
   ceviri_tr alanına tek cümlelik özet yaz, tam çeviriye emek harcama.

Özel durumlar:
- Platform ÖZET/ÖNERİ mailleri ("projects might interest you" gibi) birden çok
  GERÇEK ilan içerir: is_ilan=true. En iyi eşleşen projeye göre skorla;
  title_tr = en iyi projenin adı; ceviri_tr'de en iyi 1-3 projeyi
  "başlık — bütçe — tek cümle özet" formatında listele.
- Platform MESAJ bildirimleri (Fiverr "You've got new messages" gibi) gelen
  müşteri temasıdır: is_ilan=true. Gerçek bir talep/soru içeriyorsa skorla.
  Ama şu bilinen SCAM kampanyası kalıbı = sinif eleme, red_flags'e "scam-kampanya"
  yaz: rastgele türetilmiş kullanıcı adı (isim+sayı) + "everything is ready on my
  side / review the document / I placed an order, please confirm and start" tarzı
  genel metin + dış doküman/link baskısı + gig'in gerçek içeriğine dair hiçbir
  spesifik detay olmaması. Gerçek alıcı olma ihtimali ciddiyse suspicious ver.
{"is_ilan": bool, "score": int, "sinif": "firsat|uygun|suspicious|eleme",
 "lang": "AR", "title_tr": "...", "ceviri_tr": "...", "gerekce_tr": "...",
 "red_flags": ["..."]}"""


def _condensed_profile() -> str:
    """profile.yaml'ın ~%60 küçültülmüş hali — her çağrıda token tasarrufu."""
    data = yaml.safe_load(settings.profile_path.read_text(encoding="utf-8"))
    lines = [f"Freelancer: {data['kimlik']['unvan']} ({data['kimlik']['konum']})"]
    lines.append("Hizmetler:")
    for h in data.get("hizmetler", []):
        tek = ", ".join(map(str, h.get("teknolojiler", [])[:4]))
        lines.append(f"- {h['ad']} [{tek}] — ref: {h.get('referans', '')}")
    genisleme = "; ".join(data.get("genisleme_alanlari", []))
    lines.append(f"Genişleme alanları (VİZYON modu ile üstlenilebilir): {genisleme}")
    return "\n".join(lines)


# Structured outputs şeması — API geçerli JSON'u garanti eder
# (uzun çevirilerde elle üretilen JSON bozuluyordu)
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "is_ilan": {"type": "boolean"},
        "score": {"type": "integer"},
        "sinif": {"type": "string", "enum": ["firsat", "uygun", "suspicious", "eleme"]},
        "lang": {"type": "string"},
        "title_tr": {"type": "string"},
        "ceviri_tr": {"type": "string"},
        "gerekce_tr": {"type": "string"},
        "red_flags": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["is_ilan", "score", "sinif", "lang", "title_tr",
                 "ceviri_tr", "gerekce_tr", "red_flags"],
    "additionalProperties": False,
}


def score_item(platform: str, subject: str, body: str) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    prompt = (
        f"YETENEK ÖZETİ:\n{_condensed_profile()}\n\n"
        f"PLATFORM: {platform}\n"
        f"KONU: {subject}\n\n"
        f"BİLDİRİM/İLAN METNİ:\n{body[:5000]}"
    )

    resp = client.messages.create(
        model=settings.model_cheap,
        # Uzun çok-projeli çeviriler 2000'i aşıp JSON'ı kesebiliyordu (ilan düşüyordu);
        # 4000 güvenli tavan — yalnızca ÜRETİLEN token'a ödenir, tipik çeviri ~800-1500.
        max_tokens=4000,
        temperature=0,
        system=SYSTEM,
        output_config={"format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    )
    raw = next(
        b.text for b in resp.content if getattr(b, "type", "") == "text"
    ).strip()
    result = json.loads(raw)

    # Katman 2 emniyet ağı: model kaçırsa bile kalıp yakalanırsa suspicious
    lowered = f"{subject} {body}".lower()
    caught = [h for h in SUSPICIOUS_HINTS if h in lowered]
    if caught and result.get("sinif") in ("firsat", "uygun"):
        result["sinif"] = "suspicious"
        result.setdefault("red_flags", []).extend(caught)

    return result
