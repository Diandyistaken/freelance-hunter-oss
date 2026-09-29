"""Görüşme analizi — "sorun benim cümlemde mi, karşı tarafta mı?"

Analizi kurulu Claude Code CLI yapar ($0, Max aboneliği; API bakiyesine
dokunmaz). İsteme YALNIZ METİN gider, ses dosyası gitmez.

Ölçüt uydurmuyoruz: iskeletin kendi kuralları (docs/abd-soguk-arama-uyarlamasi.md
§3) neyse ona göre puanlanır — açılışta izin istendi mi, "çünkü" köprüsü kuruldu
mu, kanca sorusu soruldu mu, 30. saniyede SUSULDU mu, randevu net gün/saatle
istendi mi, fiyat telefonda verildi mi (verilmemeliydi).
"""

from __future__ import annotations

from packages.shared.claude_cli import CliYok, json_sor
from services.arama.konusan import konusma_metni

# Bu altı madde iskeletin kendisi; puan bunlardan çıkar, "hissiyat"tan değil.
OLCUTLER = [
    "acilis_izin: Açılışta kendini tanıtıp '30 saniye' izni istedi mi?",
    "sebep_cunku: 'Aramamın sebebi şu…' + 'çünkü' köprüsü kuruldu mu?",
    "kanca_sorusu: Sektöre özel, karşı tarafın kendi sayısını soran soru soruldu mu?",
    "sus: Sorudan sonra sustu mu, yoksa boşluğu kendisi mi doldurdu?",
    "randevu: Net gün/saatli randevu istendi mi, çıkış kapısı bırakıldı mı?",
    "fiyat_vermedi: Telefonda rakam vermekten kaçındı mı? (vermek HATA)",
]


def istem_kur(slug: str, parcalar: list[dict], sure_sn: float | None) -> str:
    dokum = konusma_metni(parcalar)
    ben_sure = sum(
        float(p["bitis"]) - float(p["baslangic"]) for p in parcalar if p.get("konusan") == "ben"
    )
    karsi_sure = sum(
        float(p["bitis"]) - float(p["baslangic"]) for p in parcalar if p.get("konusan") != "ben"
    )
    return f"""Bir soğuk arama görüşmesinin dökümünü değerlendir. BEN = satıcı
(yazılımcı Muhammed), KARŞI = aranan işletme sahibi/çalışanı.

Görüşme {sure_sn or '?'} saniye. Konuşma süresi: BEN {ben_sure:.0f} sn, KARŞI {karsi_sure:.0f} sn.

Değerlendirme ölçütleri (arama iskeleti):
{chr(10).join('- ' + o for o in OLCUTLER)}

DÖKÜM:
{dokum}

Kurallar:
- Yalnız dökümde GEÇEN şeye dayan. Duymadığın bir şeyi varsayma; emin
  olamadığın ölçüte "belirsiz" de.
- Döküm otomatik çıkarıldı; kelime hataları olabilir, anlamı yakala.
- "sorun kimde" derken dürüst ol: kötü giden her görüşme satıcının hatası
  değildir (yanlış kişi, kötü zaman, gerçekten ihtiyaç yok da olabilir).

SADECE şu JSON'u döndür:
{{
  "puan": 0-10 arası tam sayı (iskelete uyum),
  "ozet": "tek cümle: görüşme neden böyle bitti",
  "olcutler": {{"acilis_izin": "evet|hayir|belirsiz", "sebep_cunku": "...",
                "kanca_sorusu": "...", "sus": "...", "randevu": "...",
                "fiyat_vermedi": "..."}},
  "sorun_kimde": "ben|karsi|ikisi_de_degil",
  "sorun_gerekcesi": "tek cümle, dökümden alıntıya dayansın",
  "en_kritik_an": {{"saniye": sayı, "ne_oldu": "tek cümle"}},
  "itiraz": "karşı tarafın verdiği ana itiraz, yoksa null",
  "sonraki_sefer": ["somut 2-3 madde: bir dahaki aramada NE DEĞİŞSİN"],
  "iyi_giden": "bir şey iyi gittiyse tek cümle, yoksa null"
}}"""


def analiz_et(slug: str, parcalar: list[dict], sure_sn: float | None = None) -> dict:
    """Dökümü Claude CLI'a verir, JSON sonucu döndürür."""
    if not parcalar:
        raise ValueError("analiz için döküm yok")
    try:
        return json_sor(istem_kur(slug, parcalar, sure_sn), zaman_asimi=240)
    except CliYok as hata:
        raise RuntimeError(
            "Claude Code CLI bulunamadı — analiz atlandı, döküm yine de kayıtlı."
        ) from hata
