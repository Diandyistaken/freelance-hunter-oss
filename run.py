"""Freelance Hunter — komut satırı girişi.

Kullanım:
  python run.py --dry-run   Örnek Arapça ilanla tüm hattı test et (Gmail/Telegram'sız)
  python run.py --auth      Gmail'i tarayıcıda yeniden yetkilendir
  python run.py --once      Tek tarama turu (Gmail/API → skor → Telegram)
  python run.py --once --zorla   Ana anahtar kapalıyken bile bu turu çalıştır
  python run.py --loop      Sürekli avcı döngüsü (bot komutları OLMADAN)
  python run.py --bot       ÖNERİLEN: Telegram botu + avcı döngüsü tek süreçte
  python run.py --radar2    RADAR v2: iyi giden + sitesi kötü işletmeleri tara (sıcak lead)
  python run.py --radar2 50 Aynısı ama bu turda en fazla 50 yeni site denetlensin
  python run.py --denetle ornek.com   Tek bir sitenin yasal denetim raporu
  python run.py --kayit basla <slug>   ARAMA KAYDI: mikrofonu aç (telefon HOPARLÖRDE olsun)
  python run.py --kayit dur           Kaydı bitir → yazıya dök + konuşan ayrımı + analiz
  python run.py --kayit durum         Aktif kayıt ve son kayıtların özeti
  python run.py --havuz          ARAMA HAVUZU: Overture (sitesizler dahil) → muhatap süzgeci → data/havuz.json
  python run.py --havuz --taze   Aynısı, Overture önbelleğini atlayıp yeniden sorgular
  python run.py --hedefler       ARAMA LİSTESİ: havuzdan fikir kancalı 20 hedef (tür başına en fazla 3)
  python run.py --hedefler 30    Aynısı, 30 hedef
  python run.py --site      Son radar taramasının av listesi (numaralı)
  python run.py --site 3    3. avın demo sitesini üret (data/demo_sites/)
  python run.py --site 3 zarif   3. avın demo sitesini seçilen stille üret
  python run.py --onizlemeler 3  3. av için TÜM şablonların önizlemesini üretir (yayınlamadan)
  python run.py --yayinla5 3     3. av için 5 FARKLI tasarımı aynı anda yayına al
  python run.py --brief 3 neon   3. av için Fable 5 tasarım brief'i üret
  python run.py --kusursuz <dosya.txt>   Tam ilandan analiz + kusursuz teklif üretir
  python run.py --kusursuz --id <external_id>   İlanı veritabanından alır
  python run.py --kusursuz               İlan metnini Windows panosundan alır
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SAMPLE_ALERT = {
    "id": "test:sample-ar-001",
    "platform": "Freelancer.com",
    "sender": "noreply@freelancer.com",
    "subject": "New project posted: منصة حجز مواعيد",
    "body": """مطلوب مطور لبناء منصة حجز مواعيد لعيادة أسنان في الرياض.
المتطلبات:
- موقع ويب حديث وسريع مع تصميم جذاب يعمل على الجوال
- نظام حجز مواعيد إلكتروني مع تذكير تلقائي للمرضى عبر الرسائل
- لوحة تحكم للموظفين لإدارة المواعيد والمرضى
- دعم اللغتين العربية والإنجليزية
الميزانية: 3500 - 5000 دولار
المدة: 30 يوماً
صاحب المشروع: دفع موثق، تقييم 4.9""",
}


def _avci_kapali() -> bool:
    """Panelden (Ayarlar → Freelance İş Avcısı) ya da Telegram'dan (/avkapat)
    kapatılan ana anahtar. Elle başlatılan tarama da buna uyar; bilinçli tek
    seferlik tarama için --zorla vardır."""
    import json
    from packages.shared.config import settings
    try:
        durum = json.loads((settings.data_dir / "state.json").read_text(encoding="utf-8"))
        return bool(durum.get("avci_kapali"))
    except Exception:
        return False


KAPALI_UYARISI = """⛔ Freelance avı KAPALI — internetten iş ilanı aranmıyor.
Açmak için: panelde Ayarlar → Freelance İş Avcısı, ya da Telegram'da /avac.
Yalnız bu turu yine de çalıştırmak için: python run.py --once --zorla"""


def main() -> None:
    args = set(sys.argv[1:])

    if "--auth" in args:
        from services.hunter.adapters.gmail_alerts import interactive_auth
        interactive_auth()
    elif "--dry-run" in args:
        from packages.shared import db
        from services.hunter.pipeline import process_alert

        # Testi tekrar çalıştırabilmek için örnek kaydı temizle
        with db.connect() as con:
            con.execute("DELETE FROM items WHERE external_id LIKE 'test:%'")

        print("Örnek Arapça ilan hattan geçiriliyor (skor+çeviri → bildirim)...\n")
        process_alert(SAMPLE_ALERT, dry_run=True)
    elif "--once" in args:
        if _avci_kapali() and "--zorla" not in args:
            print(KAPALI_UYARISI)
            return
        from services.hunter.pipeline import run_once
        n = run_once()
        print(f"Tur bitti — {n} yeni bildirim işlendi.")
    elif "--loop" in args:
        if _avci_kapali() and "--zorla" not in args:
            print(KAPALI_UYARISI)
            return
        from services.hunter.pipeline import run_loop
        run_loop()
    elif "--bot" in args:
        from apps.bot.bot import main as bot_main
        bot_main()
    elif "--radar2" in args:
        # Radar v2: iyi giden işletme + kötü/görünmez site → sıcak lead listesi
        from services.radar.engine import run_radar_v2, summary_text_v2
        idx = sys.argv.index("--radar2")
        kuyruk = [a for a in sys.argv[idx + 1:] if not a.startswith("--")]
        tavan = int(kuyruk[0]) if kuyruk and kuyruk[0].isdigit() else None
        data = run_radar_v2(denetim_tavani=tavan)
        print(summary_text_v2(data, top=10))
    elif "--demo-analiz" in args:
        # 1. AŞAMA: mevcut siteden içerik+fotoğraf çek, işletmeye ÖZEL sorular üret
        import json as _json

        from packages.shared.config import settings as _s
        from services.radar.site_builder import _slugify
        from services.radar.tasarimci import analiz_yap, is_yaz
        idx = sys.argv.index("--demo-analiz")
        t_args = [a for a in sys.argv[idx + 1:] if not a.startswith("--")]
        if not t_args or not t_args[0].isdigit():
            raise SystemExit("Hata: kullanım: python run.py --demo-analiz 3")
        radar = _json.loads((_s.data_dir / "radar.json").read_text(encoding="utf-8"))
        av = radar["hits"][int(t_args[0]) - 1]
        slug = _slugify(av["name"])
        print(f"🔎 {av['name']} — içerik çekiliyor + sorular hazırlanıyor…")
        try:
            kayit = analiz_yap(av, slug)
        except Exception as exc:
            is_yaz(slug, asama="hata", hata=str(exc)[:400])
            raise
        print(f"✅ {len(kayit.get('sorular', []))} soru hazır · "
              f"{kayit.get('sayfa_sayisi', 0)} sayfa · "
              f"{kayit.get('foto_sayisi', 0)} fotoğraf")
        print(f"   İş dosyası: {slug}")
    elif "--demo-uret" in args:
        # 2. AŞAMA: cevaplarla nihai siteyi üret (cevaplar JSON olarak stdin'den)
        import json as _json

        from packages.shared.config import settings as _s
        from services.radar.site_builder import _slugify
        from services.radar.tasarimci import is_yaz, uret
        idx = sys.argv.index("--demo-uret")
        t_args = [a for a in sys.argv[idx + 1:] if not a.startswith("--")]
        if not t_args or not t_args[0].isdigit():
            raise SystemExit("Hata: kullanım: python run.py --demo-uret 3 (cevaplar stdin)")
        radar = _json.loads((_s.data_dir / "radar.json").read_text(encoding="utf-8"))
        av = radar["hits"][int(t_args[0]) - 1]
        slug = _slugify(av["name"])
        ham = sys.stdin.read().strip()
        girdi = _json.loads(ham) if ham else {}
        print(f"🎨 {av['name']} — tasarım üretiliyor (stil: {girdi.get('stil', 'sicak')})…")
        try:
            yol, maliyet = uret(av, slug, girdi.get("cevaplar") or {},
                                girdi.get("stil") or "sicak")
        except Exception as exc:
            is_yaz(slug, asama="hata", hata=str(exc)[:400])
            raise
        print(f"\n✅ {yol}")
        if maliyet.get("gercek_icerik"):
            print(f"   Gerçek içerik: mevcut siteden alındı "
                  f"({maliyet.get('gorsel_sayisi', 0)} fotoğraf)")
        print(f"   GERÇEK maliyet: ${maliyet['usd']} "
              f"({maliyet['girdi_token']} girdi / {maliyet['cikti_token']} çıktı token)")
        print(f"   Önizle: http://localhost:3005/api/demo/{slug}--fable")
    elif "--tasarla" in args:
        # Kusura ÖZEL sıfırdan site tasarımı (Fable 5) — PAHALI, günlük tavanlı
        import json as _json

        from packages.shared.config import settings as _s
        from services.radar.site_builder import _slugify
        from services.radar.tasarimci import bugun_kalan, tasarla
        idx = sys.argv.index("--tasarla")
        t_args = [a for a in sys.argv[idx + 1:] if not a.startswith("--")]
        if not t_args or not t_args[0].isdigit():
            raise SystemExit("Hata: kullanım: python run.py --tasarla 3")
        radar = _json.loads((_s.data_dir / "radar.json").read_text(encoding="utf-8"))
        av = radar["hits"][int(t_args[0]) - 1]
        slug = _slugify(av["name"])
        print(f"🎨 {av['name']} için SIFIRDAN tasarım üretiliyor…")
        if _s.tasarim_motor == "api":
            print(f"   Motor: Anthropic API · {_s.model_tasarim} · effort {_s.tasarim_effort}")
            print(f"   Tahmini maliyet ~$0,5-1,4 · bugün kalan hak: {bugun_kalan()}")
        else:
            print("   Motor: Claude Code CLI — Max aboneliği, API bakiyesine dokunmaz ($0)")
        kodlar = ", ".join(k["kod"] for k in av.get("kusurlar", [])) or "-"
        print(f"   Giderilecek kusurlar: {kodlar}")
        yol, maliyet = tasarla(av, slug)
        print(f"\n✅ {yol}")
        if maliyet.get("gercek_icerik"):
            print(f"   Gerçek içerik: mevcut siteden alındı "
                  f"({maliyet.get('gorsel_sayisi', 0)} fotoğraf)")
        print(f"   GERÇEK maliyet: ${maliyet['usd']} "
              f"({maliyet['girdi_token']} girdi / {maliyet['cikti_token']} çıktı token)")
        if maliyet.get("bugun_kalan") is not None:
            print(f"   Bugün kalan hak: {maliyet['bugun_kalan']}")
        print(f"   Önizle: http://localhost:3005/api/demo/{slug}--fable")
    elif "--denetle" in args:
        # Tek bir sitenin yasal denetim raporu (kanıt üretmek/kontrol için)
        from services.radar.audit import denetle
        idx = sys.argv.index("--denetle")
        hedef = next((a for a in sys.argv[idx + 1:] if not a.startswith("--")), "")
        if not hedef:
            raise SystemExit("Hata: kullanım: python run.py --denetle ornek.com")
        rapor = denetle(hedef)
        print(f"\n🔍 {rapor.domain} — kusur puanı {rapor.kusur_puani}/100")
        if not rapor.denetlendi:
            print(f"   Denetlenemedi: {rapor.denetlenemedi_sebep}")
        for k in sorted(rapor.kusurlar, key=lambda x: x.siddet, reverse=True):
            print(f"   [{k.siddet:2}] {k.baslik}\n        kanıt: {k.kanit}")
        if rapor.kanca:
            print(f"\n💬 Kanca: {rapor.kanca}")
        print(f"\nÖlçümler: {rapor.olcumler}")
    elif "--kayit" in args:
        # Arama kaydı: basla <slug> | dur | durum | isle <kimlik> | ters <kimlik>
        # DİKKAT: `args` bir KÜME (bkz. main başı) — sıra bilgisi sys.argv'de.
        from services.arama.kayit import komut as kayit_komut
        idx = sys.argv.index("--kayit")
        kayit_komut([a for a in sys.argv[idx + 1:] if a])
    elif "--havuz" in args:
        # Arama havuzu: Overture (sitesizler dahil) → muhatap süzgeci → data/havuz.json
        from services.radar.havuz import olustur, ozet as havuz_ozet
        print(havuz_ozet(olustur(onbellek_kullan="--taze" not in args)))
    elif "--hedefler" in args:
        # Telefonla aranacak hedefleri seç (ağa çıkmaz, havuz.json'u okur)
        from services.radar.hedefleme import calistir, ozet
        idx = sys.argv.index("--hedefler")
        kuyruk = [a for a in sys.argv[idx + 1:] if not a.startswith("--")]
        adet = int(kuyruk[0]) if kuyruk and kuyruk[0].isdigit() else 20
        print(ozet(calistir(adet=adet)))
    elif "--site" in args:
        from services.radar.site_builder import STIL_SIRASI, build_from_radar, list_hits
        site_idx = sys.argv.index("--site")
        site_args = sys.argv[site_idx + 1:]
        if site_args:
            if not site_args[0].isdigit():
                raise SystemExit(
                    "Hata: --site sonrasında av numarası gelmeli. "
                    "Örnek: python run.py --site 3 zarif"
                )
            if len(site_args) > 2:
                raise SystemExit("Hata: kullanım: python run.py --site N [stil]")
            stil = site_args[1].lower() if len(site_args) == 2 else None
            if stil is not None and stil not in STIL_SIRASI:
                raise SystemExit(
                    f"Hata: geçersiz stil '{stil}'. "
                    f"Geçerli stiller: {', '.join(STIL_SIRASI)}"
                )
            path, hit = build_from_radar(int(site_args[0]), stil=stil)
            print(f"✅ {hit['name']} ({hit['kind_tr']}) → {path}")
        else:
            print(list_hits())
    elif "--onizlemeler" in args:
        from services.radar.site_builder import STIL_SIRASI, build_variants_from_radar

        idx = sys.argv.index("--onizlemeler")
        onizleme_args = sys.argv[idx + 1:]
        if not onizleme_args or not onizleme_args[0].isdigit():
            raise SystemExit(
                "Hata: --onizlemeler sonrasında av numarası gelmeli. "
                "Örnek: python run.py --onizlemeler 3"
            )
        paths, hit = build_variants_from_radar(int(onizleme_args[0]), styles=STIL_SIRASI)
        print(f"✅ {hit['name']} — {len(paths)} şablonun önizlemesi hazır:")
        for stil, path in paths.items():
            print(f"  {stil}: {path}")
    elif "--yayinla5" in args:
        from services.radar.publisher import yayinla_radar_5

        idx = sys.argv.index("--yayinla5")
        y5_args = sys.argv[idx + 1:]
        if not y5_args or not y5_args[0].isdigit():
            raise SystemExit(
                "Hata: --yayinla5 sonrasında av numarası gelmeli. "
                "Örnek: python run.py --yayinla5 3"
            )
        urls, hit = yayinla_radar_5(int(y5_args[0]))
        print(f"🌍 {hit['name']} ({hit['kind_tr']}) — 5 varyant CANLI:")
        for stil, url in urls.items():
            print(f"  {stil}: {url}")
    elif "--brief" in args:
        from services.radar.brief import uret_brief
        from services.radar.site_builder import STIL_SIRASI

        brief_idx = sys.argv.index("--brief")
        brief_args = sys.argv[brief_idx + 1:]
        if not brief_args or not brief_args[0].isdigit():
            raise SystemExit(
                "Hata: --brief sonrasında av numarası gelmeli. "
                "Örnek: python run.py --brief 3 neon"
            )
        if len(brief_args) != 2:
            raise SystemExit("Hata: kullanım: python run.py --brief N <stil>")
        stil = brief_args[1].lower()
        if stil not in STIL_SIRASI:
            raise SystemExit(
                f"Hata: geçersiz stil '{stil}'. "
                f"Geçerli stiller: {', '.join(STIL_SIRASI)}"
            )
        path = uret_brief(int(brief_args[0]), stil)
        print(f"BRIEF-DOSYA: {path}")
        print("✅ Fable 5 tasarım brief'i hazır.")
    elif "--kusursuz" in args:
        import subprocess

        from services.bidmaster.analiz import analiz_et

        idx = sys.argv.index("--kusursuz")
        kusursuz_args = sys.argv[idx + 1:]
        kaynak = "manuel"

        if "--id" in kusursuz_args:
            id_idx = kusursuz_args.index("--id")
            external_id = kusursuz_args[id_idx + 1] if id_idx + 1 < len(kusursuz_args) else ""
            if not external_id:
                raise SystemExit("Hata: --id sonrasında bir external_id gerekli.")
            from packages.shared import db

            ilan = db.get_recent_by_external(external_id)
            if not ilan:
                raise SystemExit(f"Hata: '{external_id}' kimlikli ilan bulunamadı.")
            ilan_metni = "\n\n".join(
                str(ilan.get(alan) or "").strip()
                for alan in ("title_tr", "ceviri_tr", "body")
                if ilan.get(alan)
            )
            kaynak = f"{ilan.get('platform') or 'veritabanı'} / {external_id}"
        elif kusursuz_args:
            dosya = Path(kusursuz_args[0])
            if not dosya.is_file():
                raise SystemExit(f"Hata: ilan dosyası bulunamadı: {dosya}")
            ilan_metni = dosya.read_text(encoding="utf-8-sig")
            kaynak = str(dosya)
        else:
            pano = subprocess.run(
                ["powershell", "-command", "Get-Clipboard"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
            if pano.returncode != 0:
                raise SystemExit(f"Hata: pano okunamadı: {pano.stderr.strip()}")
            ilan_metni = pano.stdout
            kaynak = "pano"

        try:
            analiz_et(ilan_metni, kaynak=kaynak)
        except ValueError as exc:
            raise SystemExit(f"Hata: {exc}") from exc
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
