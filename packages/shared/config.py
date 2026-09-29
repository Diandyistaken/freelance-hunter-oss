"""Merkezi ayarlar — .env kökten okunur, tüm modüller buradan beslenir."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

# Ücretsiz pazar ön filtresi hem ISO-2 kodunu hem İngilizce ülke adını kabul eder.
CHEAP_MARKETS = frozenset({
    "india", "in",
    "pakistan", "pk",
    "bangladesh", "bd",
    "sri lanka", "lk",
    "nepal", "np",
})
CHEAP_MARKET_MIN_FIXED_USD = 200
CHEAP_MARKET_MIN_HOURLY_USD = 10

SITE_DAILY_CAPS = {
    "Freelancer.com (API)": 45,
    "Upwork": 20,
    "Fiverr": 10,
    "Bionluk": 10,
    # Herkese açık feed kaynakları (public_feeds adaptörü, 27 Tem 2026)
    "Braintrust": 15,
    "Arbeitnow": 10,
    "WeWorkRemotely": 10,
    "RemoteOK": 10,
    "Google Alerts": 20,
    # E-posta uyarısı kurulunca dolacak kanallar (docs/uyelikler/ilan-kanallari.md)
    "LinkedIn": 15,
    "PeoplePerHour": 15,
    "Guru": 10,
    "Contra": 10,
    # Armut: teklif vermek ücretli → kullanıcı kararıyla devre dışı
    # (ARMUT_BILDIR=1 ile yeniden açılabilir; bkz. pipeline.ARMUT_KAPALI)
    "Armut": 0,
}


@dataclass
class Settings:
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    telegram_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_chat_id: str = os.getenv("TELEGRAM_CHAT_ID", "")
    freelancer_token: str = os.getenv("FREELANCER_OAUTH_TOKEN", "")
    netlify_token: str = os.getenv("NETLIFY_TOKEN", "")  # eski /yayinla (Netlify kota doldu, Cloudflare'e geçildi)
    cloudflare_api_token: str = os.getenv("CLOUDFLARE_API_TOKEN", "")  # /yayinla için (ücretsiz, Cloudflare Pages)
    cloudflare_account_id: str = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")

    # Maliyet ilkesi: ön filtre/çeviri ucuz modelle yapılır
    model_cheap: str = os.getenv("MODEL_CHEAP", "claude-haiku-4-5-20251001")
    model_strong: str = os.getenv("MODEL_STRONG", "claude-sonnet-5")

    # ---- Kusura özel sıfırdan site tasarımı (services/radar/tasarimci.py) ----
    # PAHALI: Fable 5 $10/1M girdi, $50/1M çıktı → site başına ~$1,2-1,4.
    # Yarı fiyat: claude-opus-5 ($5/$25). Üçte bir: claude-sonnet-5 ($3/$15).
    # Model değiştirirsen ALTTAKİ FİYATLARI DA GÜNCELLE (rapor yanlış çıkar).
    model_tasarim: str = os.getenv("MODEL_TASARIM", "claude-fable-5")
    tasarim_effort: str = os.getenv("TASARIM_EFFORT", "high")
    tasarim_max_token: int = int(os.getenv("TASARIM_MAX_TOKEN", "32000"))
    tasarim_gunluk_tavan: int = int(os.getenv("TASARIM_GUNLUK_TAVAN", "3"))
    tasarim_usd_girdi: float = float(os.getenv("TASARIM_USD_GIRDI", "10"))
    tasarim_usd_cikti: float = float(os.getenv("TASARIM_USD_CIKTI", "50"))
    # Üretim motoru: "claude_cli" = kurulu Claude Code (Max aboneliği üzerinden,
    # API bakiyesine DOKUNMAZ, günlük tavan uygulanmaz) · "api" = Anthropic API
    # (para harcar; yukarıdaki tavan ve fiyatlar yalnız bu modda geçerli).
    tasarim_motor: str = os.getenv("TASARIM_MOTOR", "claude_cli")
    tasarim_cli_komut: str = os.getenv("TASARIM_CLI_KOMUT", "claude")
    tasarim_cli_model: str = os.getenv("TASARIM_CLI_MODEL", "")  # boş = CLI varsayılanı

    poll_minutes: int = int(os.getenv("POLL_MINUTES", "3"))

    # Günlük AI çağrı tavanı — aşılınca mailler
    # ücretsiz kuyruğa birikir, ertesi gün / tavan artınca işlenir
    daily_call_cap: int = int(os.getenv("DAILY_CALL_CAP", "100"))

    # Radar ana merkezi: Altıntepe Mah. Cihadiye Cad. (kullanıcının evi)
    radar_lat: float = float(os.getenv("RADAR_LAT", "40.9544"))
    radar_lon: float = float(os.getenv("RADAR_LON", "29.1029"))
    radar_radius_m: int = int(os.getenv("RADAR_RADIUS_M", "1500"))

    # Çoklu bölge taraması: "Ad:lat,lon,yarıçap_m" — noktalı virgülle ayrılır
    #
    # 16 Ağu 2026 — VARLIKLI BANT eklendi (kullanıcı kararı): Bağdat Caddesi
    # hattı ve Fenerbahçe/Kalamış çevresi. Gerekçe: yüksek bilet fiyatlı
    # işletmeler (diş/estetik klinik, özel okul, butik, fine-dining, emlak)
    # burada yoğun; vitrin kalitesine para ayırma ihtimali ve tek işin değeri
    # yüksek. Ev çevresi (Altıntepe) korunuyor — yürüme mesafesi avantajı
    # ilk müşteride hâlâ en güçlü koz.
    radar_bolgeler_raw: str = os.getenv(
        "RADAR_BOLGELER",
        "Altıntepe:40.9544,29.1029,1500;"
        "Suadiye:40.9617,29.0836,1600;"
        "Caddebostan:40.9689,29.0653,1600;"
        "Erenköy:40.9720,29.0790,1500;"
        "Fenerbahçe-Kalamış:40.9760,29.0400,1800;"
        "Kadıköy:40.9903,29.0290,2000;"
        "Ataşehir:40.9923,29.1244,2000;"
        "Üsküdar:41.0226,29.0150,2000",
    )

    # ---- RADAR v2: "iyi giden işletme + kötü/görünmez site" ----
    # Overture Maps açık veri seti (CC BY 4.0) — anahtarsız, kartsız, $0.
    # Boş bırakılırsa en yeni sürüm S3 listesinden otomatik bulunur.
    overture_release: str = os.getenv("OVERTURE_RELEASE", "")
    overture_min_confidence: float = float(os.getenv("OVERTURE_MIN_CONFIDENCE", "0.5"))

    # Site denetleyici — YALNIZ herkese açık sinyaller (bkz. audit.py yasak listesi)
    psi_api_key: str = os.getenv("PSI_API_KEY", "")   # PageSpeed Insights: ücretsiz, KART İSTEMEZ
    # PSI site başına ~23 sn sürüyor (ölçüldü); tur başına tavan olmazsa tarama
    # saatlere çıkar. Ağır kusuru zaten olan sitede de atlanır (audit._psi_calisabilir).
    psi_tur_tavani: int = int(os.getenv("PSI_TUR_TAVANI", "40"))
    audit_daily_cap: int = int(os.getenv("AUDIT_DAILY_CAP", "300"))
    audit_timeout_s: int = int(os.getenv("AUDIT_TIMEOUT_S", "20"))
    audit_cache_days: int = int(os.getenv("AUDIT_CACHE_DAYS", "30"))
    audit_paralel: int = int(os.getenv("AUDIT_PARALEL", "6"))

    # ---- Radar v2 derin denetim anahtarları (24 Ağu 2026, Katman 1-3) ----
    # Hepsi yalnızca HERKESE AÇIK / tek-nazik-istek sinyallerdir; port taraması,
    # exploit, gizli yol brute-force gibi yasaklı alana asla girmez (audit.py
    # başındaki yasak listesi aynen geçerli).
    #  · wp_ekstra: WordPress sitelerinde /wp-json/wp/v2/users (kullanıcı adı
    #    ifşası) + /wp-content/uploads/ (dizin listeleme) — standart, herkese
    #    açık kaynaklar; yalnız WP sinyali görülünce tek istek atılır.
    #  · arsiv: web.archive.org üzerinden "site ne kadar zamandır değişmemiş"
    #    kanıtı — hedefe istek yok, arşive 2 istek.
    #  · crt: sertifika şeffaflık kayıtları (crt.sh) — alt alan adı haritası.
    #    Sistemin kendi dokümanı (docs/denetim-sinirlari.md) bunu "niyetimizi
    #    kötü gösterir, satışa katkısı yok" diye REDDEDER; kullanıcı onayıyla
    #    kodlandı ama bu yüzden VARSAYILAN KAPALI tutuluyor.
    audit_wp_ekstra: bool = os.getenv("AUDIT_WP_EKSTRA", "1") == "1"
    audit_arsiv: bool = os.getenv("AUDIT_ARSIV", "1") == "1"
    audit_crt: bool = os.getenv("AUDIT_CRT", "0") == "1"

    # Google Places (gerçek puan/yorum) — VARSAYILAN KAPALI.
    # Google Cloud'da faturalandırma (kredi kartı) açmayı gerektirir; kullanıcı
    # kuralı: "ilk gelir gelmeden platforma para yok". Anahtar girilip
    # PLACES_ENABLED=1 yapılmadan tek bir çağrı bile atılmaz.
    places_api_key: str = os.getenv("GOOGLE_PLACES_API_KEY", "")
    places_enabled: bool = os.getenv("PLACES_ENABLED", "0") == "1"
    places_daily_cap: int = int(os.getenv("PLACES_DAILY_CAP", "30"))

    # Eski "sitesiz esnaf" katmanı (soğuk arama motoru) — 100 aramada 0 dönüş
    # verdiği için kullanıcı kararıyla KAPALI. 1 yaparsan ikincil katman olarak
    # listeye düşük öncelikle geri gelir.
    radar_sitesiz_katman: bool = os.getenv("RADAR_SITESIZ_KATMAN", "0") == "1"

    # Denetim sirasinda one alinacak bolgeler (varlikli bant). Yeni bolge
    # eklendiginde hicbir isletmesi denetlenmemis olur; bu liste olmadan eski
    # bolgelerin zaten denetlenmis adaylari her turda one gecip yeni bolgeyi
    # listeye hic sokmuyordu (16 Agu 2026'da olculdu).
    radar_oncelikli_bolgeler_raw: str = os.getenv(
        "RADAR_ONCELIKLI_BOLGELER",
        "Suadiye,Caddebostan,Erenköy,Fenerbahçe-Kalamış",
    )

    def radar_oncelikli_bolgeler(self) -> set[str]:
        # Katalog kategorilerinden gelen oncelik + elle eklenenler.
        from packages.shared.bolgeler import oncelikli_adlar  # noqa: PLC0415
        elle = {b.strip() for b in self.radar_oncelikli_bolgeler_raw.split(",") if b.strip()}
        return oncelikli_adlar() | elle

    @property
    def bolge_secim_dosyasi(self):
        return self.data_dir / "radar_bolge_secim.json"

    def secili_bolgeler(self) -> list[tuple[str, float, float, int]]:
        """Panelden secilen semtler; secim yoksa katalogun varsayilani.

        Bolge listesi artik .env ayari degil, kullanicinin panelden yaptigi
        secim (data/radar_bolge_secim.json). RADAR_BOLGELER hala calisiyor:
        elle tanimlanmissa o kazanir (geri uyumluluk).
        """
        import json  # noqa: PLC0415
        from packages.shared.bolgeler import bolge_getir  # noqa: PLC0415
        try:
            secim = json.loads(self.bolge_secim_dosyasi.read_text(encoding="utf-8"))
            adlar = [a for a in secim.get("secilen", []) if isinstance(a, str)]
            if adlar:
                return bolge_getir(adlar)
        except Exception:
            pass
        return bolge_getir([])

    def radar_bolgeler(self) -> list[tuple[str, float, float, int]]:
        bolgeler = []
        for parca in self.radar_bolgeler_raw.split(";"):
            ad, _, koord = parca.partition(":")
            lat, lon, r = koord.split(",")
            bolgeler.append((ad.strip(), float(lat), float(lon), int(r)))
        return bolgeler

    root: Path = ROOT
    data_dir: Path = ROOT / "data"
    profile_path: Path = ROOT / "packages" / "shared" / "profile.yaml"

    # Gmail OAuth istemcisi Kisisel Ajan projesinden yeniden kullanılır.
    # Varsayılan KARDEŞ klasör — iki proje aynı üst klasörde durduğu sürece
    # tüm portföy taşınsa bile yol kendiliğinden çözülür. Ayrılırlarsa
    # .env içine KISISEL_AJAN_DIR=<tam yol> yaz.
    kisisel_ajan_dir: Path = Path(
        os.getenv(
            "KISISEL_AJAN_DIR",
            str(ROOT.parent / "Kisisel Ajan"),
        )
    )


settings = Settings()
settings.data_dir.mkdir(exist_ok=True)
