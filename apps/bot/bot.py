"""Hunter Telegram botu — sistemin kontrol paneli + avcı döngüsü tek süreçte.

Ekstra kütüphane yok: Telegram Bot API'si doğrudan requests ile kullanılır
(getUpdates long-polling). Döngü: 20 sn komut dinle → süre geldiyse avlan → tekrar.

Komutlar:
  /start      — bağlantı testi; chat_id'ni gösterir (.env'e yazılacak)
  /durum      — bugünkü sınıf dağılımı + duraklatma durumu
  /durdur     — iş alımını duraklat (mailler ücretsiz birikmeye devam eder)
  /baslat     — iş alımını sürdür
  /avkapat    — freelance ilan avını TAMAMEN kapat (internetten iş aranmaz)
  /avac       — freelance ilan avını yeniden aç
  /karaliste <kalıp> — scam kalıbı/gönderen öğret (bir daha AI'a bile gitmez)
  /yardim     — komut listesi

Çalıştırma: python run.py --bot
"""

import json
import socket
import threading
import time
from pathlib import Path

import requests

from packages.shared import db
from packages.shared.config import settings
from packages.shared.notify import hq_olay

STATE_PATH = settings.data_dir / "state.json"
CONTROL_PATH = settings.data_dir / "control.json"  # dashboard'dan gelen komutlar
API = f"https://api.telegram.org/bot{settings.telegram_token}"
KILIT_PORT = 47651  # tek kopya koruması: bu portu tutan bir bot zaten çalışıyor demektir


def _tek_kopya_kilidi() -> socket.socket | None:
    """İki bot aynı anda çalışamaz (Telegram getUpdates çakışır, ilanlar bölünür).
    Portu bağlayabilen kilidi alır; bağlayamayan sessizce çekilmelidir."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", KILIT_PORT))
        s.listen(8)
        return s
    except OSError:
        s.close()
        return None


def _saglik_dinleyicisi_baslat(kilit: socket.socket) -> None:
    """Dashboard'ın canlılık kontrollerini AYRI iş parçacığında karşılar.

    Eskiden boşaltma ana döngünün başındaydı. Av turu (Gmail çekme + skorlama)
    dakikalarca sürdüğü için o sırada ne dinleme kuyruğu boşalıyor ne state.json
    yazılıyordu; ikisi de botAlive'ın sinyali olduğundan panel çalışan botu
    'KAPALI' gösteriyordu. Ölçülen vaka: 2 Ağu 00:4x, AI kullanımı 50/100
    (yani tam av turunda) iken rozet kırmızıydı.

    Bu dinleyici yalnız sağlık kontrolüne cevap verir; tek-kopya kilidi soketin
    bağlı kalmasından gelir, accept edilmesinden değil."""

    def dongu() -> None:
        while True:
            try:
                conn, _ = kilit.accept()
                conn.close()
            except OSError:
                break  # soket kapandı = süreç iniyor

    threading.Thread(target=dongu, daemon=True, name="hunter-saglik").start()

HELP = (
    "🎯 HUNTER — KOMUT REHBERİ\n"
    "Seni 7/24 dinliyorum: freelance ilanlarını yakalar, her dilden Türkçe'ye\n"
    "çevirir; ayrıca çevredeki sitesiz işletmeleri bulup onlara hazır demo\n"
    "site üretirim. Gönderim hep sende.\n"
    "\n"
    "📊 DURUM & KONTROL\n"
    "/durum — bugünkü 💎/✅/🚩/❌ dağılımı + kuyruk + AI kullanımı (x/60)\n"
    "/durdur — MEŞGUL MODU: analiz durur (para harcanmaz), mailler ÜCRETSİZ\n"
    "          arka planda birikir. İşin yoğunken bunu aç.\n"
    "/baslat — sürdür: kuyrukta biriken her mail kaldığı yerden analiz edilir\n"
    "/avkapat — FREELANCE AVI KAPALI: internetten iş ilanı hiç aranmaz\n"
    "           (Gmail'e bakılmaz, Freelancer API'ye gidilmez, mail birikmez).\n"
    "           Radar + demo site tarafı normal çalışır.\n"
    "/avac — freelance ilan avını yeniden aç\n"
    "/rapor — son 7 günün huni raporu (taranan→uygun→fırsat→AI maliyeti)\n"
    "/elmaslar — son 72 saatin 💎 ilanları\n"
    "\n"
    "✍️ TEKLİF TAKİBİ\n"
    "/teklifverdim <no> — o ilana teklif verdiğini kaydet (huni takibi başlar)\n"
    "/tekliflerim — açık/kazanılan/kaybedilen tekliflerinin listesi\n"
    "/kazandim <no|açıklama> — işi kazandın! Huniye + profile.yaml'a kanıt\n"
    "               olarak işlenir; sonraki teklifler daha keskin olur.\n"
    "/kaybettim <no> — teklif sonuçsuz kaldı (huni verisi yine değerli)\n"
    "/bitirdim <no|başlık> | <ne yaptık> | <sonuç> | <kazanç> | <link>\n"
    "           — tamamlanan işi bağımsız portföy vitrinine ekle (link opsiyonel)\n"
    "/portfoyum — tamamlanan portföy işlerini listele\n"
    "\n"
    "📡 RADAR & DEMO SİTE (yerel müşteri avı — hepsi ÜCRETSİZ)\n"
    "/radar — 4 bölgeyi tara (Altıntepe+Kadıköy+Ataşehir+Üsküdar), sitesiz\n"
    "         işletmeleri bul (2-4 dk)\n"
    "/site <numara> — o işletmeye özel hazır demo site üret (dosya olarak)\n"
    "/yayinla <numara> — demo siteyi CANLI internet linkine + QR koda çevir\n"
    "                    (esnafa telefondan gösterirsin — 'hazırladım bile')\n"
    "/yayinla5 <numara> — AYNI işletme için 5 FARKLI tasarımı aynı anda\n"
    "                    yayına alır + her biri için QR kod (site + QR menü)\n"
    "                    — 'zaten 5 tane hazırladım, hangisini beğendiniz?'\n"
    "\n"
    "🛡️ GÜVENLİK\n"
    "/karaliste <kalıp> — scam kalıbı/gönderen öğret; bir daha AI'a bile gitmez\n"
    "\n"
    "ℹ️ /help veya /yardim — bu rehber\n"
    "\n"
    "💻 Web paneli: aynısı http://localhost:3005 — av kartına tıkla, detay+fiyat\n"
    "   +teklif penceresi açılır. Bot ile panel aynı motoru paylaşır."
)


def _profile_kanit_ekle(metin: str) -> None:
    """Kazanılan işi profile.yaml'a kanıt olarak işler; skor zamanla keskinleşir."""
    from datetime import date
    p = settings.profile_path
    icerik = p.read_text(encoding="utf-8")
    if "kazanilan_isler:" not in icerik:
        icerik += "\n# Kazanılan gerçek işler — /kazandim ile eklenir\nkazanilan_isler:\n"
    temiz = metin.replace('"', "'").strip()
    icerik += f'  - "{date.today().isoformat()}: {temiz}"\n'
    p.write_text(icerik, encoding="utf-8")


def _portfoy_markdown_yaz() -> Path:
    """Veritabanındaki portföyü paylaşılabilir Markdown vitrinine dönüştürür."""
    path = Path(__file__).resolve().parents[2] / "docs" / "portfolyo.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    satirlar = ["# Portföy", ""]
    for kayit in db.list_portfoy():
        _, baslik, platform, ilan_ozeti, yaptigimiz, sonuc, kazanc, link, tarih = kayit
        satirlar.extend([
            f"## {baslik}",
            "",
            f"**Platform:** {platform or 'Diğer'} · **Tarih:** {tarih} · "
            f"**Kazanç:** {kazanc or '-'}",
            "",
            "### İş buydu",
            "",
            ilan_ozeti or baslik or "-",
            "",
            "### Bunu yaptık",
            "",
            yaptigimiz or "-",
            "",
            "### Sonuç",
            "",
            sonuc or "-",
        ])
        if link:
            satirlar.extend(["", f"[İşi görüntüle]({link})"])
        satirlar.extend(["", "---", ""])
    path.write_text("\n".join(satirlar), encoding="utf-8")
    return path


def _portfoy_kaynagini_bul(kaynak: str) -> tuple[str, str, str]:
    """Teklif/ilan numarasını çözer; değilse metni doğrudan başlık kabul eder."""
    kaynak = kaynak.strip()
    if kaynak.isdigit():
        no = int(kaynak)
        teklif = db.get_teklif(no)
        if teklif:
            baslik = teklif["title"] or f"Teklif #{no}"
            return baslik, teklif["platform"] or "Diğer", baslik
        ilan = db.get_recent(no)
        if ilan:
            baslik = ilan["title_tr"] or f"İlan #{no}"
            ozet = ilan["ceviri_tr"] or ilan["body"] or baslik
            return baslik, ilan["platform"] or "Diğer", ozet
    return kaynak, "Diğer", kaynak


# Durumun varsayılanı tek yerde: eski state.json'da bulunmayan anahtarlar
# (ör. sonradan eklenen avci_kapali) okuma sırasında tamamlanır.
VARSAYILAN_STATE = {"paused": False, "offset": 0, "avci_kapali": False}


def _load_state() -> dict:
    state = dict(VARSAYILAN_STATE)
    if STATE_PATH.exists():
        state.update(json.loads(STATE_PATH.read_text(encoding="utf-8")))
    return state


def _save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state), encoding="utf-8")


def _apply_dashboard_control(state: dict) -> None:
    """Dashboard'ın data/control.json'a bıraktığı komutu uygula ve dosyayı sil.
    state.json'ın tek yazarı bot kalır — web ile bot arasında yazma yarışı olmaz."""
    if not CONTROL_PATH.exists():
        return
    try:
        cmd = json.loads(CONTROL_PATH.read_text(encoding="utf-8"))
        if "avci_kapali" in cmd and \
                bool(cmd["avci_kapali"]) != state.get("avci_kapali", False):
            state["avci_kapali"] = bool(cmd["avci_kapali"])
            durum = ("⛔ Freelance avı DASHBOARD'dan KAPATILDI — internetten\n"
                     "iş ilanı aranmayacak. Radar ve demo site tarafı açık."
                     if state["avci_kapali"]
                     else "🎯 Freelance avı DASHBOARD'dan AÇILDI — ilan taraması sürüyor.")
            print(durum)
            if settings.telegram_chat_id:
                _reply(int(settings.telegram_chat_id), durum)
        if "paused" in cmd and bool(cmd["paused"]) != state["paused"]:
            state["paused"] = bool(cmd["paused"])
            durum = ("⏸ Meşgul modu DASHBOARD'dan açıldı — mailler ücretsiz birikecek."
                     if state["paused"]
                     else "🟢 Avcı DASHBOARD'dan sürdürüldü.")
            print(durum)
            _reply(int(settings.telegram_chat_id), durum) if settings.telegram_chat_id else None
    except Exception as exc:
        print(f"Kontrol dosyası okunamadı: {exc}")
    finally:
        CONTROL_PATH.unlink(missing_ok=True)


def _api(method: str, **params) -> dict:
    resp = requests.post(f"{API}/{method}", json=params, timeout=35)
    return resp.json()


def _reply(chat_id: int, text: str) -> None:
    _api("sendMessage", chat_id=chat_id, text=text,
         disable_web_page_preview=True)


def _handle(text: str, chat_id: int, state: dict) -> None:
    cmd, _, arg = text.partition(" ")
    cmd = cmd.lower().split("@")[0]

    if cmd == "/start":
        _reply(chat_id,
               f"🎯 Hunter bağlandı!\nchat_id: {chat_id}\n\n"
               f".env dosyasında TELEGRAM_CHAT_ID={chat_id} yazdığından emin ol.\n\n{HELP}")
    elif cmd == "/durum":
        stats = db.today_stats()
        toplam = sum(stats.values())
        durum = ("⛔ FREELANCE AVI KAPALI (internetten iş aranmıyor)"
                 if state.get("avci_kapali")
                 else "⏸ MEŞGUL MODU (mailler birikiyor)" if state["paused"]
                 else "🟢 AVLANIYOR")
        _reply(chat_id,
               f"{durum} · tarama aralığı {settings.poll_minutes} dk\n"
               f"Bugün: {toplam} bildirim işlendi · "
               f"AI kullanımı: {db.usage_today()}/{settings.daily_call_cap}\n"
               f"📥 Kuyrukta bekleyen: {db.pending_count()} mail\n"
               f"💎 fırsat: {stats.get('firsat', 0)} · ✅ uygun: {stats.get('uygun', 0)} · "
               f"🚩 şüpheli: {stats.get('suspicious', 0)} · ❌ eleme: {stats.get('eleme', 0)}")
    elif cmd == "/avkapat":
        state["avci_kapali"] = True
        _reply(chat_id,
               "⛔ Freelance avı KAPATILDI.\n"
               "Artık internetten iş ilanı aranmıyor: Gmail'e bakılmıyor, "
               "Freelancer API'ye gidilmiyor, mail de birikmiyor ($0).\n"
               "Radar, demo site ve teklif tarafı normal çalışmaya devam ediyor.\n"
               "Geri açmak için: /avac — ya da panelden Ayarlar → Freelance avcısı.")
    elif cmd == "/avac":
        state["avci_kapali"] = False
        _reply(chat_id,
               "🎯 Freelance avı yeniden AÇIK — ilan taraması "
               f"{settings.poll_minutes} dakikada bir sürüyor.")
    elif cmd == "/durdur":
        state["paused"] = True
        _reply(chat_id,
               "⏸ Meşgul modu açıldı: analiz durdu, para harcanmıyor.\n"
               "Mailler arka planda ÜCRETSİZ toplanmaya devam ediyor — "
               "işin bitince /baslat de, biriken her şey kaldığı yerden analiz edilir.")
    elif cmd == "/baslat":
        state["paused"] = False
        bekleyen = db.pending_count()
        _reply(chat_id,
               f"🟢 Avcı sürüyor. Kuyrukta {bekleyen} birikmiş mail var — "
               f"şimdi analiz ediliyor." if bekleyen else "🟢 Avcı yeniden çalışıyor.")
    elif cmd == "/radar":
        _reply(chat_id, "📡 4 bölge taranıyor: Altıntepe + Kadıköy + Ataşehir + "
                        "Üsküdar (2-4 dk sürebilir)...")
        try:
            from services.radar.engine import run_radar_all, summary_text
            data = run_radar_all()
            _reply(chat_id, summary_text(data))
        except Exception as exc:
            _reply(chat_id, f"Radar hatası: {exc}")
    elif cmd == "/site":
        try:
            from services.radar.site_builder import build_from_radar, list_hits
            if arg.strip().isdigit():
                path, hit = build_from_radar(int(arg.strip()))
                _reply(chat_id,
                       f"🏗 Demo site hazır: {hit['name']} ({hit['kind_tr']})\n"
                       f"📁 {path}\n\n"
                       f"Dosyaya çift tıkla, tarayıcıda açılır. Beğendiysen işletmeyi ara: "
                       f"{'☎ ' + hit['phone'] if hit.get('phone') else 'telefon kaydı yok — yerinde ziyaret'}")
            else:
                _reply(chat_id, list_hits())
        except Exception as exc:
            _reply(chat_id, f"Site üretilemedi: {exc}")
    elif cmd == "/taslak":
        _reply(chat_id, "Bu özellik kaldırıldı — teklifler artık harici uygulamada hazırlanıyor.")
    elif cmd == "/elmaslar":
        # Linkler tam kullanıcı açacakken doğrulanır — kapanmış/silinmiş/
        # preferred-only ilan listeye hiç girmez, ölü link tıklatmayız.
        # Import da try içinde: sweep/bağımlılık hatası listeyi asla engellemez.
        dusenler, dogrulandi = [], False
        try:
            from services.hunter.pipeline import takip_dogrula
            _reply(chat_id, "🔎 Takipteki Freelancer ilanları doğrulanıyor...")
            dusenler = takip_dogrula(force=True)
            dogrulandi = True
        except Exception:
            pass
        notlar = ""
        if dusenler:
            notlar += (f"\n\n🧹 {len(dusenler)} ilan kapandığı için takipten düşürüldü "
                       "(silinmiş / teklife kapalı / preferred-freelancer).")
        if dogrulandi:
            notlar += ("\n\n🔎 Freelancer.com (API) linkleri az önce doğrulandı; "
                       "e-posta kaynaklı ilanlar doğrulanamaz.")
        elmaslar = db.list_recent_diamonds(72)
        if not elmaslar:
            _reply(chat_id, "Son 72 saatte açık elmas yok." + notlar)
        else:
            satirlar = ["💎 SON 72 SAATİN ELMASLARI"]
            for ilan in elmaslar:
                satir = (f"\n• {ilan['title_tr'] or '(başlıksız)'}\n"
                         f"  Skor {ilan['score']} · {ilan['platform']} · {ilan['saat']}")
                if ilan.get("url"):
                    satir += f"\n  {ilan['url']}"
                satirlar.append(satir)
            _reply(chat_id, "\n".join(satirlar) + notlar)
    elif cmd == "/teklifverdim":
        ilan = db.get_recent(int(arg)) if arg.strip().isdigit() else None
        if not ilan:
            _reply(chat_id, "Kullanım: /teklifverdim <ilan numarası>.")
        else:
            tno = db.add_teklif(ilan["title_tr"], ilan["platform"])
            # HQ huni: "teklif" aşaması. Elması yakalamak yetmiyor, teklif
            # verilip verilmediği ölçülmezse huninin kırıldığı yer görünmüyor.
            hq_olay("teklif", "onemli",
                    f"{ilan['platform']} · {ilan['title_tr'][:70]} (teklif #{tno})")
            _reply(chat_id,
                   f"📤 Kaydedildi (teklif #{tno}): {ilan['title_tr'][:60]}\n"
                   f"Sonuç gelince: /kazandim {tno} veya /kaybettim {tno}")
    elif cmd == "/tekliflerim":
        rows = db.list_teklifler()
        if not rows:
            _reply(chat_id, "Henüz kayıtlı teklif yok — bildirimden sonra /teklifverdim <no> kullan.")
        else:
            ikon = {"verildi": "⏳", "kazanildi": "🏆", "kaybedildi": "✖️"}
            satirlar = ["📋 Tekliflerin (son 15):"] + [
                f"#{r[0]} {ikon.get(r[3], '?')} {r[1][:45]} · {r[2]} · {r[4][:10]}"
                for r in rows
            ]
            _reply(chat_id, "\n".join(satirlar))
    elif cmd == "/bitirdim":
        alanlar = [alan.strip() for alan in arg.split("|", 4)]
        if len(alanlar) not in (4, 5) or any(not alan for alan in alanlar[:4]):
            _reply(chat_id,
                   "Kullanım: /bitirdim <teklif no veya başlık> | <ne yaptık> | "
                   "<sonuç> | <kazanç> | <link (opsiyonel)>")
        else:
            kaynak, yaptigimiz, sonuc, kazanc = alanlar[:4]
            link = alanlar[4] if len(alanlar) == 5 else ""
            baslik, platform, ilan_ozeti = _portfoy_kaynagini_bul(kaynak)
            pno = db.add_portfoy(baslik, platform, ilan_ozeti, yaptigimiz,
                                 sonuc, kazanc, link)
            _portfoy_markdown_yaz()
            toplam = len(db.list_portfoy())
            _reply(chat_id,
                   f"✅ Portföye eklendi (#{pno}): {baslik[:60]}\n"
                   f"Vitrinde toplam {toplam} iş var.")
    elif cmd == "/portfoyum":
        rows = db.list_portfoy()
        if not rows:
            _reply(chat_id, "Portföy henüz boş — tamamlanan işi /bitirdim ile ekleyebilirsin.")
        else:
            satirlar = ["🗂 PORTFÖYÜM"] + [
                f"#{r[0]} {r[1]} · {r[2] or 'Diğer'} · {r[8]} · {r[6] or '-'}"
                for r in rows
            ]
            mesaj = satirlar[0]
            for satir in satirlar[1:]:
                if len(mesaj) + len(satir) + 1 > 3500:
                    _reply(chat_id, mesaj)
                    mesaj = satir
                else:
                    mesaj += "\n" + satir
            _reply(chat_id, mesaj)
    elif cmd == "/kazandim":
        if not arg.strip():
            _reply(chat_id, "Kullanım: /kazandim <teklif no> veya /kazandim <işin kısa açıklaması>")
        elif arg.strip().isdigit() and (baslik := db.set_teklif_durum(int(arg), "kazanildi")):
            _profile_kanit_ekle(baslik)
            hq_olay("kapora", "onemli", f"İş kazanıldı: {baslik[:70]}")
            _reply(chat_id, f"🏆 TEBRİKLER! '{baslik[:50]}' kazanıldı olarak işlendi "
                            f"ve profile.yaml'a kanıt eklendi — skorlayıcı artık daha keskin.")
        else:
            _profile_kanit_ekle(arg)
            _reply(chat_id, f"🏆 Kanıt eklendi: '{arg.strip()[:60]}' → profile.yaml. "
                            f"Her kazanılan iş sonraki teklifleri güçlendirir.")
    elif cmd == "/kaybettim":
        if arg.strip().isdigit() and (baslik := db.set_teklif_durum(int(arg), "kaybedildi")):
            _reply(chat_id, f"Kaydedildi: '{baslik[:50]}' sonuçsuz. Üzülme — huni verisi de değerli.")
        else:
            _reply(chat_id, "Kullanım: /kaybettim <teklif no>")
    elif cmd == "/rapor":
        _reply(chat_id, _rapor_metni())
    elif cmd == "/yayinla":
        try:
            if arg.strip().isdigit():
                _reply(chat_id, "🚀 Site üretilip yayına alınıyor (10-30 sn)...")
                from services.radar.publisher import yayinla_radar
                url, hit = yayinla_radar(int(arg.strip()))
                _reply(chat_id,
                       f"🌍 CANLI: {hit['name']}\n{url}\n\n"
                       f"İşletmeye bu linki telefondan göster veya gönder. "
                       f"Beğenirse alan adı + kalıcı yayın işini konuşursun.")
                _api("sendPhoto", chat_id=chat_id,
                     photo=f"https://api.qrserver.com/v1/create-qr-code/?size=500x500&data={url}",
                     caption=f"📱 {hit['name']} — QR'ı esnafa göster/yazdır, telefonla okutunca site açılır")
                _api("sendPhoto", chat_id=chat_id,
                     photo=f"https://api.qrserver.com/v1/create-qr-code/?size=500x500&data={url}%23menu",
                     caption="📋 QR MENÜ — bu QR direkt menü/fiyat listesi bölümüne açılır "
                             "(masaya/tezgaha bas, bakım paketiyle güncellersin)")
            else:
                _reply(chat_id, "Kullanım: /yayinla <numara> — numarayı /site listesinden seç.")
        except Exception as exc:
            _reply(chat_id, f"Yayınlanamadı: {exc}")
    elif cmd == "/yayinla5":
        try:
            if arg.strip().isdigit():
                _reply(chat_id, "🚀 5 farklı tasarım üretilip aynı anda yayına alınıyor "
                                "(1-2 dk sürebilir)...")
                from services.radar.publisher import yayinla_radar_5
                urls, hit = yayinla_radar_5(int(arg.strip()))
                AD_TR = {"klasik": "Klasik", "vitrin": "Vitrin", "neon": "Neon",
                         "aydinlik": "Aydınlık", "zarif": "Zarif"}
                satirlar = [f"🌍 {hit['name']} — 5 FARKLI TASARIM CANLI:\n"]
                for stil, url in urls.items():
                    satirlar.append(f"• {AD_TR.get(stil, stil)}: {url}")
                satirlar.append("\nHepsini esnafa gönder, hangisini beğenirse onunla "
                                 "devam edersin (her birinde QR + QR menü de var).")
                _reply(chat_id, "\n".join(satirlar))
                for stil, url in urls.items():
                    _api("sendPhoto", chat_id=chat_id,
                         photo=f"https://api.qrserver.com/v1/create-qr-code/?size=500x500&data={url}",
                         caption=f"📱 {AD_TR.get(stil, stil)} — QR")
            else:
                _reply(chat_id, "Kullanım: /yayinla5 <numara> — numarayı /site listesinden seç.")
        except Exception as exc:
            _reply(chat_id, f"Yayınlanamadı: {exc}")
    elif cmd == "/karaliste":
        if arg.strip():
            db.add_blacklist(arg)
            _reply(chat_id, f"🚫 Kara listeye eklendi: “{arg.strip()}”\n"
                            f"Bu kalıbı içeren mailler artık AI'a bile gitmeden elenecek.")
        else:
            _reply(chat_id, "Kullanım: /karaliste <kelime, cümle veya gönderen adresi>")
    elif cmd in ("/yardim", "/help", "/komutlar"):
        _reply(chat_id, HELP)
    else:
        _reply(chat_id, HELP)


def _rapor_metni() -> str:
    """Haftalık huni raporu — /rapor komutu + pazar akşamı otomatiği kullanır."""
    s = db.weekly_stats()
    toplam = sum(s["sinif"].values())
    bildirilen = toplam - s["sinif"].get("eleme", 0)
    satirlar = [
        "📊 HAFTALIK RAPOR (son 7 gün)",
        f"Taranan: {toplam} · Bildirilen: {bildirilen}",
        f"💎 {s['sinif'].get('firsat', 0)} · ✅ {s['sinif'].get('uygun', 0)} · "
        f"🚩 {s['sinif'].get('suspicious', 0)} · ❌ {s['sinif'].get('eleme', 0)}",
        f"🤖 AI çağrısı: {s['calls']} (≈ ${s['calls'] * 0.003:.2f})",
    ]
    if s["platform"]:
        satirlar += ["", "Bildirilenlerin platform dağılımı:"]
        satirlar += [f"  • {src}: {n}" for src, n in s["platform"][:6]]
    satirlar += ["", "✍️ Teklif verdiklerini bana yaz — kazanılanları "
                     "profile.yaml'a işleyip skoru keskinleştirelim."]
    return "\n".join(satirlar)


def _otomasyonlar(state: dict) -> None:
    """Kendi kendine çalışan görevler — kullanıcı hiçbir şey yapmasa da:
    1) Her akşam 21:00'den sonra günün özeti Telegram'a düşer
    2) 7 günde bir radar kendiliğinden tarar, YENİ sitesiz işletmeleri raporlar"""
    import datetime as _dt

    if not settings.telegram_chat_id:
        return
    chat_id = int(settings.telegram_chat_id)
    simdi = _dt.datetime.now()
    bugun = simdi.date().isoformat()

    if simdi.hour >= 21 and state.get("aksam_raporu") != bugun \
            and not state.get("avci_kapali"):
        state["aksam_raporu"] = bugun
        stats = db.today_stats()
        bildirilen = sum(v for k, v in stats.items() if k != "eleme")
        _reply(chat_id,
               f"🌆 Akşam özeti — bugün {sum(stats.values())} mail işlendi, "
               f"{bildirilen} bildirim (💎{stats.get('firsat', 0)} "
               f"✅{stats.get('uygun', 0)} 🚩{stats.get('suspicious', 0)}). "
               f"AI: {db.usage_today()}/{settings.daily_call_cap}. "
               f"Haftalık döküm: /rapor")
        if simdi.weekday() == 6:  # pazar akşamı haftalık rapor kendiliğinden gelir
            _reply(chat_id, _rapor_metni())

    if time.time() - state.get("son_oto_radar", 0) > 7 * 86400:
        state["son_oto_radar"] = time.time()  # hata olursa haftaya yine dener
        try:
            from services.radar.engine import RADAR_JSON, run_radar_all, summary_text
            eski = set()
            if RADAR_JSON.exists():
                eski = {h["name"] for h in
                        json.loads(RADAR_JSON.read_text(encoding="utf-8"))["hits"]}
            data = run_radar_all()
            mesaj = "📡 Haftalık OTOMATİK radar taraması:\n" + summary_text(data)
            if eski:
                yeni = [h["name"] for h in data["hits"] if h["name"] not in eski]
                mesaj += ("\n\n🆕 Bu hafta yeni tespit: " + ", ".join(yeni[:5])
                          if yeni else "\n\n(Geçen haftaya göre yeni işletme yok)")
            _reply(chat_id, mesaj)
        except Exception as exc:
            print(f"Otomatik radar hatası: {exc}")


def main() -> None:
    if not settings.telegram_token:
        print("TELEGRAM_BOT_TOKEN boş — @BotFather'dan token alıp .env'e yaz.")
        return

    kilit = _tek_kopya_kilidi()  # döngü boyunca açık kalmalı, kapatma
    if kilit is None:
        print("Hunter zaten çalışıyor — ikinci kopya açılmadı.")
        return
    _saglik_dinleyicisi_baslat(kilit)

    state = _load_state()
    last_hunt = 0.0
    print("Hunter botu çalışıyor — Telegram'dan /start yaz. Ctrl+C ile durdur.")

    while True:
        try:
            # 0) Web komutlarını uygula (sağlık kontrolleri ayrı iş parçacığında)
            _apply_dashboard_control(state)

            # 1) Komutları dinle (20 sn long-poll = döngünün bekleme süresi)
            updates = _api("getUpdates", offset=state["offset"] + 1, timeout=20)
            for u in updates.get("result", []):
                state["offset"] = u["update_id"]
                msg = u.get("message") or {}
                text = msg.get("text", "")
                chat = msg.get("chat", {})
                if text.startswith("/") and chat.get("id"):
                    # Yalnızca sahibin komutları (chat_id .env'de tanımlıysa)
                    if settings.telegram_chat_id and \
                            str(chat["id"]) != str(settings.telegram_chat_id) and \
                            text.split("@")[0] != "/start":
                        continue
                    _handle(text, chat["id"], state)
            _save_state(state)

            # 2) Süre geldiyse: normal av VEYA meşgul modunda ücretsiz toplama.
            #    Ana anahtar kapalıysa (avci_kapali) hiçbirine girilmez —
            #    Gmail'e de Freelancer API'sine de gidilmez, kuyruk büyümez.
            if time.time() - last_hunt > settings.poll_minutes * 60:
                if state.get("avci_kapali"):
                    pass  # freelance avı kapalı: yalnız radar/otomasyonlar sürer
                elif state["paused"]:
                    from services.hunter.pipeline import collect_once
                    n = collect_once()
                    if n:
                        print(f"{n} mail kuyruğa alındı (meşgul modu, $0).")
                else:
                    from services.hunter.pipeline import run_once
                    n = run_once()
                    if n:
                        print(f"{n} yeni bildirim işlendi.")
                last_hunt = time.time()

                # 3) Otomasyonlar: akşam özeti + haftalık otomatik radar
                _otomasyonlar(state)
                # Av turu uzun sürdü: canlılık sinyalini ve otomasyon
                # işaretlerini bir sonraki tura bırakma
                _save_state(state)
        except KeyboardInterrupt:
            _save_state(state)
            print("Bot durduruldu.")
            return
        except Exception as exc:  # tek hata döngüyü öldürmesin
            print(f"Döngü hatası: {exc}")
            time.sleep(10)


if __name__ == "__main__":
    main()
