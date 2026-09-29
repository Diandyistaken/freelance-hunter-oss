"""Teklif taslağı üretici — yalnızca 💎/✅ ilanlar için güçlü modelle çalışır.

Çıktı (JSON):
  teklif          — MÜŞTERİNİN DİLİNDE, kopyala-yapıştır hazır teklif metni
                    (Arapça ilana Arapça, İngilizce ilana İngilizce; emin
                    olunamayan dilde İngilizce)
  teklif_ozeti_tr — "Ne teklif ettim?" Türkçe özeti (kullanıcı göndermeden
                    önce ne vaat ettiğini tam bilir)

İki mod (otomatik seçilir):
  REFERANS: envanterdeki gerçek projelerden en alakalısıyla "benzerini yaptım"
  VİZYON  : birebir referans yoksa "şu modern mimariyle çözerim" + teknik plan

Kurallar (ban kalkanı):
  - Her taslak ilana ÖZEL, şablon kopyası asla
  - Dış link yok (yeni hesapta spam sinyali)
  - Gönderim HER ZAMAN insanda
"""

import json
import re

import anthropic

from packages.shared.config import settings

SYSTEM = """Sen deneyimli bir freelance teklif yazarısın. Sana bir iş ilanı
(Türkçe çevirisiyle) ve freelancer'ın gerçek yetenek envanteri verilecek.

Teklif kuralları:
- İlanın ORİJİNAL DİLİNDE yaz (AR ilana AR, EN ilana EN; emin değilsen EN).
- 120-200 kelime, profesyonel ama insani; kalıp/şablon kokusu olmasın.
- İlanın SPESİFİK detaylarına atıf yap (müşteri okuduğunda "bunu gerçekten
  okumuş" demeli).
- Envanterde alakalı gerçek proje varsa kısaca referans ver (REFERANS modu);
  yoksa somut bir teknik yaklaşım öner (VİZYON modu). UYDURMA referans ASLA.
- Dış link, e-posta, telefon KOYMA. Platform dışı iletişim önerme.
- Küçük bir açılış sorusu veya net bir sonraki adımla bitir.

SADECE geçerli JSON döndür:
{"teklif": "...", "teklif_ozeti_tr": "..."}"""


OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "teklif": {"type": "string"},
        "teklif_ozeti_tr": {"type": "string"},
    },
    "required": ["teklif", "teklif_ozeti_tr"],
    "additionalProperties": False,
}


def draft_proposal(platform: str, lang: str, title_tr: str,
                   ceviri_tr: str, original_body: str) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    prompt = (
        f"FREELANCER ENVANTERİ:\n{settings.profile_path.read_text(encoding='utf-8')}\n\n"
        f"PLATFORM: {platform} · İLAN DİLİ: {lang}\n"
        f"BAŞLIK (TR): {title_tr}\n\n"
        f"İLAN (TR çevirisi):\n{ceviri_tr}\n\n"
        f"İLAN (orijinal):\n{original_body[:3000]}"
    )

    resp = client.messages.create(
        model=settings.model_strong,
        max_tokens=2000,
        system=SYSTEM,
        # Sonnet 5 varsayılan olarak adaptive thinking açar; thinking token'ları
        # max_tokens bütçesini yiyip JSON'ı yarıda kesiyordu. Teklif yazımı çok
        # adımlı akıl yürütme değil, düz yazım işi — thinking'i kapatmak hem
        # kesilmeyi önler hem daha ucuz/hızlı (maliyet-odaklı mimariye uygun).
        thinking={"type": "disabled"},
        output_config={"format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    )
    raw = next(
        b.text for b in resp.content if getattr(b, "type", "") == "text"
    ).strip()
    return json.loads(raw)
