"""Avcı boru hattı: Gmail/API bildirimleri → skor+çeviri → Telegram.

Akış (her POLL_MINUTES dakikada bir):
  1. gmail_alerts.fetch_alerts() — platformların gönderdiği yeni mailler
  2. SQLite tekrar kontrolü (aynı mail iki kez işlenmez)
  3. scorer (Haiku): ilan mı? skor? sınıf? + TAM Türkçe çeviri
  4. Telegram bildirimi (token yoksa konsola basılır)

"Anında" bildirimin sırrı: platformlar maili saniyeler içinde atar, biz de
kutuya 3 dakikada bir bakarız — pratik gecikme < 5 dk, maliyet sıfıra yakın.
"""

import os
import re
import time

from packages.shared import db
from packages.shared.config import (
    CHEAP_MARKETS,
    CHEAP_MARKET_MIN_FIXED_USD,
    CHEAP_MARKET_MIN_HOURLY_USD,
    SITE_DAILY_CAPS,
    settings,
)
from packages.shared.notify import hq_olay, send_desktop_popup, send_telegram
from services.hunter import prefilter
from services.hunter.adapters import gmail_alerts
from services.hunter.scorer.scorer import score_item

# Bu saatten eski kuyruk kayıtları silinir: freelance ilanlarında teklifler
# ilk saatlerde kapanır, bayat ilan hem işe yaramaz hem bütçeyi yer.
BAYAT_SAAT = 72

# Armut teklif vermek için kredi (ücret) istiyor — kullanıcı kararı: girilmeyecek.
# Mailleri okunmaya devam eder (istatistik) ama AI'a gitmez, bildirim çıkmaz.
ARMUT_KAPALI = os.getenv("ARMUT_BILDIR", "0") != "1"

BADGE = {"firsat": "💎 FIRSAT", "uygun": "✅ UYGUN", "suspicious": "🚩 ŞÜPHELİ"}

# Ücretsiz ön kapı (Katman 0): bu kalıplar AI'a hiç gitmeden elenir.
# Konu satırında pazarlama kokusu — gerçek ilan bildirimlerinde geçmezler.
PROMO_SUBJECT_HINTS = [
    "% off", "sale", "black friday", "cyber monday", "webinar", "promo",
    "discount", "newsletter", "indirim", "kupon", "kampanya",
]

# Yalnız konu satırında aranır. Gerçek ilan ifadeleri ("yeni talep",
# "iş fırsatı") bilerek bu dar bildirim kalıplarına dahil edilmez.
PLATFORM_NOTIFICATION_SUBJECT_RE = re.compile(
    r"(?:"
    r"\byeni mesaj(?:lar)?\b|\bnew messages?\b|"
    r"\bhesap aktivasyon(?:u)?\b|\baccount activation\b|"
    r"\bdoğrula\w*\b|\bverification\b|"
    r"\btopluluk standartları\b|\bcommunity standards\b|"
    r"\bportfolyo(?:n|nuz)?\s+beğen(?:i|ildi|isi)\b|\bportfolio (?:like|liked)\b|"
    r"\bşifre(?:niz)?\b|\bpassword\b|"
    r"\bgiriş (?:doğrulama|kodu|uyarısı|bildirimi)\b|^(?:yeni\s+)?giriş\b|"
    r"\blogin (?:verification|code|alert|notification)\b|^(?:new\s+)?login\b|"
    r"\bfatura\b|\breceipt\b"
    r")",
    flags=re.IGNORECASE,
)


def free_gate(alert: dict) -> str | None:
    """AI çağrısından ÖNCE çalışan sıfır maliyetli filtre.
    Elenme nedeni döndürür; None ise ilan skorlayıcıya gider."""
    from packages.shared import db as _db

    if ARMUT_KAPALI and alert["platform"].strip().casefold() == "armut":
        return "armut-ucretli-teklif"

    haystack = f"{alert['sender']} {alert['subject']} {alert['body'][:1000]}"
    pattern = _db.blacklist_hit(haystack)
    if pattern:
        return f"kara liste: {pattern}"

    subject = alert["subject"].casefold().replace("i\u0307", "i")
    # \u0130\u015f ilan\u0131 ta\u015f\u0131yan konular (Upwork saved-search vb. ba\u015fl\u0131\u011f\u0131 konuya yazar)
    # bildirim kal\u0131plar\u0131na kurban gitmesin \u2014 ilan ipucu varsa eleme atlan\u0131r.
    is_ilan_konusu = re.search(
        r"job alert|new (?:freelance )?jobs?\b|jobs? for\b|new project|"
        r"i\u015f f\u0131rsat|yeni talep|yeni proje|yeni ilan", subject)
    if (alert["platform"] != "Freelancer.com (API)"
            and not is_ilan_konusu
            and PLATFORM_NOTIFICATION_SUBJECT_RE.search(subject)):
        return "platform-bildirimi"
    if any(h in subject for h in PROMO_SUBJECT_HINTS):
        return "pazarlama maili (konu kalıbı)"

    country = str(alert.get("customer_country") or "").strip().casefold()
    budget = alert.get("budget_usd")
    budget_type = str(alert.get("budget_type") or "").strip().lower()
    if country in CHEAP_MARKETS and budget is not None and budget_type in ("fixed", "hourly"):
        try:
            threshold = (CHEAP_MARKET_MIN_HOURLY_USD if budget_type == "hourly"
                         else CHEAP_MARKET_MIN_FIXED_USD)
            if float(budget) < threshold:
                return "ucuz-pazar"
        except (TypeError, ValueError):
            pass

    # Yazılım işi olmayan ilanlar (veri girişi, logo tasarımı, seslendirme...)
    # AI bütçesini boşa harcamasın — teknik kelime geçmiyorsa elenir.
    return prefilter.yazilim_disi_mi(alert)


def format_message(platform: str, subject: str, s: dict,
                   url: str | None = None) -> str:
    """Telegram mesajı — kullanıcının istediği format:
    TR başlık + TAM TR çeviri + değerlendirme."""
    lines = [
        f"{BADGE.get(s['sinif'], s['sinif'])} · {platform} · Skor {s['score']} · Dil: {s.get('lang', '?')}",
        "━━━━━━━━━━━━━━━━━━━━",
        f"📌 {s.get('title_tr', subject)}",
        "",
        "📝 İlan (Türkçe çeviri):",
        s.get("ceviri_tr", "(çeviri yok)"),
        "",
        f"⚖️ Değerlendirme: {s.get('gerekce_tr', '')}",
    ]

    if s.get("red_flags"):
        lines += ["", "⚠️ Şüpheli işaretler: " + ", ".join(s["red_flags"])]

    if s["sinif"] == "suspicious":
        lines += [
            "",
            "🔒 Güvenlik: maildeki linklerden giriş yapma, platforma kendi tarayıcından gir. "
            "Platform dışı ödeme/iletişim isteyen herkes = dolandırıcı, istisnasız.",
        ]

    if url:
        lines += ["", f"🔗 İlan linki: {url}"]
    lines += ["", f"📧 Kaynak: {subject}"]
    return "\n".join(lines)


def process_alert(alert: dict, dry_run: bool = False) -> str | None:
    """Tek bildirimi işler; bildirim gönderildiyse mesajı döndürür."""
    if db.seen(alert["id"]):
        return None

    gate_reason = free_gate(alert)
    if gate_reason:
        db.record(alert["id"], alert["platform"], alert["subject"],
                  "?", 0, "eleme-ucretsiz", notified=False, eleme_nedeni=gate_reason)
        return None

    s = score_item(alert["platform"], alert["subject"], alert["body"])
    db.bump_usage()

    if not s.get("is_ilan", False) or s["sinif"] == "eleme":
        db.record(alert["id"], alert["platform"], s.get("title_tr", alert["subject"]),
                  s.get("lang", "?"), s.get("score", 0), "eleme", notified=False)
        return None

    # Armut'ta yalnızca elmas sınıfı bildirilir; diğer sonuçlar istatistik için arşivlenir.
    if alert["platform"].strip().casefold() == "armut" and s["sinif"] != "firsat":
        db.record(alert["id"], alert["platform"], s.get("title_tr", alert["subject"]),
                  s.get("lang", "?"), s.get("score", 0), "eleme", notified=False,
                  eleme_nedeni="armut-elmas-alti")
        return None

    # Freelancer API ilanı kuyrukta saatlerce beklemiş olabilir — bildirimden
    # hemen önce ilanın hâlâ herkese açık teklif aldığı tek GET ile doğrulanır.
    # Kapanmış / silinmiş / preferred-freelancer'a kilitli ilan hiç gösterilmez.
    if alert["id"].startswith("flapi:"):
        from services.hunter.adapters.freelancer_api import proje_durumu
        neden = proje_durumu(alert["id"].split(":", 1)[1])
        if neden:
            db.record(alert["id"], alert["platform"],
                      s.get("title_tr", alert["subject"]),
                      s.get("lang", "?"), s.get("score", 0), "eleme",
                      notified=False, eleme_nedeni=f"son-kontrol:{neden}")
            return None

    # Bildirilen ilanların ayrıntısı panel ve 72 saatlik elmas takibi için saklanır.
    takip_no = None
    if s["sinif"] in ("firsat", "uygun", "suspicious"):
        takip_no = db.save_recent(alert, s)

    msg = format_message(alert["platform"], alert["subject"], s,
                         url=alert.get("url"))
    if takip_no:
        msg += f"\n\n📌 Takip no: {takip_no} — teklif verirsen: /teklifverdim {takip_no}"

    sent = False
    if not dry_run:
        sent = send_telegram(msg)
        # Masaüstü pop-up: yalnızca elmas değerindekiler kesintiye değer
        if s["sinif"] == "firsat":
            send_desktop_popup(
                f"💎 FIRSAT · {alert['platform']} · Skor {s['score']}",
                s.get("title_tr", alert["subject"]),
            )
            # HQ ortak akışı: elması proje mühendisine bildir, o baş mühendise,
            # o CEO'ya taşısın. Tek satır JSONL — HUD okur, kotaya dokunmaz.
            hq_olay(
                "firsat",
                "onemli",
                f"Skor {s['score']} · {alert['platform']} · "
                f"{s.get('title_tr') or alert['subject']}"
                + (f" · takip no {takip_no}" if takip_no else ""),
            )
    if not sent:
        print(msg)
        print("\n" + "=" * 60 + "\n")

    db.record(alert["id"], alert["platform"], s.get("title_tr", alert["subject"]),
              s.get("lang", "?"), s.get("score", 0), s["sinif"], notified=sent)
    return msg


def collect_once() -> int:
    """MEŞGUL MODU: AI'sız, sıfır maliyetli toplama turu.
    Yeni mailler kuyruğa yazılır (Gmail API ücretsiz, AI çağrısı yok);
    /baslat denince veya tavan açılınca kaldığı yerden analiz edilir."""
    stored = 0
    for alert in gmail_alerts.fetch_alerts():
        if db.seen(alert["id"]):
            continue
        gate_reason = free_gate(alert)
        if gate_reason:
            db.record(alert["id"], alert["platform"], alert["subject"],
                      "?", 0, "eleme-ucretsiz", notified=False, eleme_nedeni=gate_reason)
            continue
        if db.queue_pending(alert):
            stored += 1
    return stored


def _cap_reached(dry_run: bool) -> bool:
    """Günlük AI tavanı dolduysa True; ilk aşımda bir kez Telegram'dan haber verir."""
    if db.usage_today() < settings.daily_call_cap:
        return False
    if not dry_run and not db.cap_notified_today():
        db.mark_cap_notified()
        send_telegram(
            f"⏸ Günlük AI tavanı doldu ({settings.daily_call_cap} çağrı). "
            f"Mailler ücretsiz kuyruğa birikiyor — yarın otomatik işlenir. "
            f"Tavanı artırmak için .env'de DAILY_CALL_CAP değerini yükselt."
        )
    return True


def _platform_usage_today(platform: str) -> int:
    """Bugün bu kaynaktan AI'ya giden items kayıtlarını sayar."""
    with db.connect() as con:
        return con.execute(
            """SELECT COUNT(*) FROM items
               WHERE source = ?
                 AND datetime(created_at, 'localtime') >= date('now', 'localtime')
                 AND sinif != 'eleme-ucretsiz'""",
            (platform,),
        ).fetchone()[0]


def _platform_cap_reached(platform: str) -> bool:
    cap = SITE_DAILY_CAPS.get(platform)
    return cap is not None and _platform_usage_today(platform) >= cap


def _gmail_hatasi_bildir(exc: Exception) -> None:
    """Gmail okunamıyorsa kullanıcı GÜNLERCE fark etmeyebilir — kalıcı yetki
    hatasında (ölen refresh token) günde bir kez Telegram'dan alarm verilir."""
    from datetime import date

    marker = settings.data_dir / "gmail_alarm.txt"
    bugun = date.today().isoformat()
    kalici = "invalid_grant" in str(exc) or "RefreshError" in type(exc).__name__
    if kalici and (not marker.exists() or marker.read_text() != bugun):
        send_telegram(
            "🚨 Gmail yetkisi ÖLDÜ — avcı mail okuyamıyor, ilanlar kaçıyor!\n\n"
            "Çözüm (2 dk): Freelance Hunter klasöründe terminal aç →\n"
            "python run.py --auth\n→ tarayıcıda Google iznini onayla.\n\n"
            "(Google test modu token'ı ~7 günde bir düşürüyor — bilinen durum.)"
        )
        marker.write_text(bugun)
    print(f"Gmail hatası: {exc}")


# Elmas takibi tazeliği: bildirildikten SONRA ilan silinebilir, teklife
# kapanabilir veya preferred-freelancer'a kilitlenebilir. Takip listesi bu
# aralıkla API'den yeniden doğrulanır; kapananlar listeden kendiliğinden düşer.
TAKIP_DOGRULAMA_DK = 15
TAKIP_FORCE_ARALIK_SN = 60   # /elmaslar spamı arka arkaya tam sweep tetiklemesin
TAKIP_SURE_BUTCESI_SN = 45   # sweep botu en fazla bu kadar bloklayabilir
TAKIP_ISTEK_TIMEOUT_SN = 6   # kötü ağda ilan başına 15 sn beklemek bot döngüsünü kilitler
_takip_son_kontrol = 0.0


def takip_dogrula(force: bool = False) -> list[tuple[str, str]]:
    """Fırsat takibindeki Freelancer ilanlarını yeniden doğrular; kapananları
    düşürür ve (başlık, neden) listesini döndürür. force=True 15 dk aralığı
    beklemez (bot /elmaslar listeyi göstermeden hemen önce çağırır); süre
    bütçesi dolarsa kalanlar sonraki tura bırakılır — bot tek iş parçacıklı,
    uzun sweep komutları ve sağlık kontrollerini bloklar."""
    global _takip_son_kontrol
    bekleme_sn = TAKIP_FORCE_ARALIK_SN if force else TAKIP_DOGRULAMA_DK * 60
    if time.time() - _takip_son_kontrol < bekleme_sn:
        return []
    _takip_son_kontrol = time.time()

    from services.hunter.adapters.freelancer_api import proje_durumu
    dusenler = []
    baslangic = time.time()
    for external_id in db.acik_flapi_elmaslar():
        if time.time() - baslangic > TAKIP_SURE_BUTCESI_SN:
            break
        neden = proje_durumu(external_id.split(":", 1)[1],
                             timeout=TAKIP_ISTEK_TIMEOUT_SN)
        if neden:
            db.takip_kapat(external_id, neden)
            kayit = db.get_recent_by_external(external_id) or {}
            dusenler.append((kayit.get("title_tr") or external_id, neden))
    return dusenler


def run_once(dry_run: bool = False) -> int:
    """Bir tarama turu: önce birikmiş kuyruk, sonra taze mailler + API ilanları.
    Tek mailin hatası turu düşürmez; tavan dolunca kalanlar kuyruğa yazılır."""
    try:
        fresh = gmail_alerts.fetch_alerts()
    except Exception as exc:
        _gmail_hatasi_bildir(exc)
        fresh = []

    # Ban-güvenli kanal #1: Freelancer resmi API (token .env'de doluysa)
    if settings.freelancer_token:
        try:
            from services.hunter.adapters.freelancer_api import fetch_projects
            fresh += fetch_projects()
        except Exception as exc:
            # Personal Access Token 30 gün geçerli — 401 = süresi doldu demek
            if "401" in str(exc):
                from datetime import date
                marker = settings.data_dir / "freelancer_alarm.txt"
                bugun = date.today().isoformat()
                if not marker.exists() or marker.read_text() != bugun:
                    send_telegram(
                        "🚨 Freelancer API token'ının süresi doldu (30 günlük)!\n"
                        "Yenile (2 dk): https://accounts.freelancer.com/settings/develop"
                        " → yeni token → .env'de FREELANCER_OAUTH_TOKEN'a yapıştır."
                    )
                    marker.write_text(bugun)
            print(f"Freelancer API hatası (tur mail'le devam ediyor): {exc}")

    # Ban-güvenli kanal #4: herkese açık feed'ler (hesap/token istemez)
    try:
        from services.hunter.adapters.public_feeds import fetch_all
        fresh += fetch_all()
    except Exception as exc:
        print(f"Açık feed hatası (tur devam ediyor): {exc}")

    # Bayat kuyruk temizliği: kapanmış ilanlar bütçeyi yemesin
    if (bayat := db.purge_stale_pending(BAYAT_SAAT)):
        print(f"{bayat} bayat ilan kuyruktan düşürüldü (>{BAYAT_SAAT} saat).")

    # Taze ilanlar önce; kuyruk zaten en yeniden eskiye geliyor.
    adaylar = fresh + db.pending_alerts()

    # 1) Ücretsiz kapı: elenenler AI'a hiç gitmez
    #    Aynı ilan hem taze listede hem kuyrukta olabilir; tur içi küme çift
    #    işlemeyi (ve çift Telegram bildirimini) engeller.
    gecenler = []
    tur_icinde_gorulen: set[str] = set()
    for alert in adaylar:
        if alert["id"] in tur_icinde_gorulen:
            continue
        tur_icinde_gorulen.add(alert["id"])
        if db.seen(alert["id"]):
            db.remove_pending(alert["id"])
            continue
        gate_reason = free_gate(alert)
        if gate_reason:
            db.record(alert["id"], alert["platform"], alert["subject"],
                      "?", 0, "eleme-ucretsiz", notified=False, eleme_nedeni=gate_reason)
            db.remove_pending(alert["id"])
            continue
        gecenler.append(alert)

    # 2) Günlük AI bütçesi VARIŞ SIRASINA göre değil, UYGUNLUĞA göre dağıtılır.
    #    Böylece tavan dolduğunda geriye kalanlar en alakasız ilanlar olur.
    gecenler.sort(key=prefilter.uygunluk_puani, reverse=True)

    count = 0
    for alert in gecenler:
        if _cap_reached(dry_run):
            db.queue_pending(alert)  # kaybolmasın, sıradaki turda değerlendirilsin
            continue
        if _platform_cap_reached(alert["platform"]):
            db.queue_pending(alert)  # bu platform bekler; diğerleri devam eder
            continue
        try:
            if process_alert(alert, dry_run=dry_run) is not None:
                count += 1
            db.remove_pending(alert["id"])
        except Exception as exc:
            print(f"Mail işlenemedi ({alert['subject'][:50]}): {exc}")

    # Takipteki elmasların ölü linke dönüşmesini önleyen periyodik doğrulama
    for baslik, neden in takip_dogrula():
        print(f"💎 takipten düştü ({neden}): {baslik[:60]}")
    return count


# Bionluk "Alıcı İstekleri"nin feed'i yok (scraping yasak) — satış disiplini
# bunun yerine günde 3 planlı kontrol turuyla yürür (docs/acil-para-plani.md §2).
# Kapatmak için .env'e BIONLUK_TUR=0 yaz.
BIONLUK_TUR_SAATLERI = ("09:00", "13:30", "19:30")
BIONLUK_TUR_PENCERE_DK = 45  # slotun üzerinden bu kadar geçtiyse bildirim kaçtı sayılır


def _bionluk_turu_hatirlat() -> None:
    """Günde 3 kez Bionluk alıcı-istekleri turunu Telegram'dan hatırlatır.
    Marker dosyası aynı slotun ikinci kez bildirilmesini engeller; gece kapalı
    kalan bot sabah açılınca kaçmış slotları sessizce atlar."""
    if os.getenv("BIONLUK_TUR", "1") != "1":
        return
    from datetime import datetime

    simdi = datetime.now()
    bugun = simdi.strftime("%Y-%m-%d")
    marker = settings.data_dir / "bionluk_tur.txt"
    icerik = marker.read_text(encoding="utf-8") if marker.exists() else ""
    gun, _, yapilanlar = icerik.partition(":")
    yapilan = set(filter(None, yapilanlar.split(","))) if gun == bugun else set()

    simdi_dk = simdi.hour * 60 + simdi.minute
    for slot in BIONLUK_TUR_SAATLERI:
        if slot in yapilan:
            continue
        slot_dk = int(slot[:2]) * 60 + int(slot[3:])
        if simdi_dk < slot_dk:
            continue
        if simdi_dk - slot_dk > BIONLUK_TUR_PENCERE_DK:
            yapilan.add(slot)  # pencere kaçtı — bir daha deneme, spam olmasın
            continue
        send_telegram(
            f"🛎 Bionluk turu ({slot}): 'Bana Uygun Alıcı İstekleri'ni aç — "
            "web sitesi / landing / QR menü isteklerine 5 kişiselleştirilmiş "
            "teklif gönder (şablon: docs/acil-para-plani.md → Şablon E). "
            "10 dakikada biter, günün tek sıcak talep kanalı burası."
        )
        yapilan.add(slot)
    marker.write_text(f"{bugun}:{','.join(sorted(yapilan))}", encoding="utf-8")


def run_loop() -> None:
    print(f"Avcı döngüsü başladı — her {settings.poll_minutes} dk'da bir tarama. Ctrl+C ile durdur.")
    while True:
        try:
            _bionluk_turu_hatirlat()
            n = run_once()
            if n:
                print(f"{n} yeni bildirim işlendi.")
        except Exception as exc:  # tek tur hatası döngüyü öldürmesin
            print(f"Tur hatası: {exc}")
        time.sleep(settings.poll_minutes * 60)
