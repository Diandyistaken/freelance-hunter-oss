# Freelance Hunter

Freelance ilanlarını senin yerine takip eden, yapay zekâyla puanlayıp Türkçeye çeviren ve
Telegram'a düşüren bir asistan. Yanında bir de **işletme radarı** var: çevrendeki
işletmelerin web sitelerine dışarıdan bakıp düzeltilebilir sorunları bulur, telefonda
okuyabileceğin bir satış kartı ve demo site hazırlar.

**Teklifi, mesajı, aramayı her zaman sen yaparsın.** Sistem hiçbir platforma senin adına
bir şey göndermez. Otomatik teklif hesabı banlatır, bu yüzden kasten yok.

---

## Tek komutla kurulum (Windows)

**PowerShell**'i aç (Başlat → "PowerShell" yaz) ve şunu yapıştır:

```powershell
irm https://raw.githubusercontent.com/Diandyistaken/freelance-hunter-oss/main/install.ps1 | iex
```

Betik şunları yapar:

1. Git, Python ve Node.js eksikse `winget` ile kurar.
2. Kodu `C:\Users\<sen>\freelance-hunter` klasörüne indirir. Klasör zaten varsa günceller.
3. Python ve panel bağımlılıklarını kurar, ardından paneli derler. Bu adım 3-5 dakika sürer.
4. `.env` ayar dosyasını oluşturur ve Not Defteri'nde açar.

Betiği tekrar çalıştırmak güvenlidir. Var olan `.env` dosyana ve `data/` klasörüne dokunmaz.

> Farklı bir klasöre kurmak istersen önce `$env:HUNTER_DIR = "D:\hunter"` yaz, sonra kurulum komutunu çalıştır.

## Kurulumdan sonra (10 dakika)

| Adım | Ne yapacaksın |
|---|---|
| 1 | **Claude API anahtarı** al: [console.anthropic.com](https://console.anthropic.com) → API Keys. Anahtarı `.env` dosyasındaki `ANTHROPIC_API_KEY=` satırına yaz. Aylık maliyet birkaç dolar civarında (ilanları ucuz model Haiku puanlıyor). |
| 2 | **Telegram botu** aç: Telegram'da `@BotFather` → `/newbot`. Verdiği token'ı `TELEGRAM_BOT_TOKEN=` satırına yaz. Sonra bota bir mesaj at, tarayıcıda `https://api.telegram.org/bot<TOKEN>/getUpdates` adresini aç ve `"chat":{"id":…}` içindeki sayıyı `TELEGRAM_CHAT_ID=` satırına yaz. |
| 3 | `packages\shared\profile.yaml` dosyasını **kendine göre düzenle**: ünvanın, sattığın hizmetler, kullandığın teknolojiler. İlanlar bu profile göre puanlanır. |
| 4 | Deneme: `python run.py --dry-run`. Örnek bir Arapça ilanı puanlayıp çevirir. |
| 5 | Çalıştır: klasördeki **`baslat.bat`** dosyasına çift tıkla. Bot ve panel ayrı pencerelerde açılır, panel [http://localhost:3005](http://localhost:3005) adresinde. |

### İlan kanallarını bağlamak (isteğe bağlı)

- **Gmail (önerilen):** Upwork, Fiverr, Bionluk, Armut, LinkedIn gibi platformlarda iş uyarısı
  aç. Bildirimler Gmail'ine gelir, sistem onları okur. Kurulum:
  1. [Google Cloud Console](https://console.cloud.google.com)'da bir proje oluştur ve Gmail API'yi aç.
  2. OAuth istemcisi oluştur, tip olarak "Desktop app" seç.
  3. İndirdiğin `credentials.json` dosyasını `data\google\` klasörüne koy.
  4. Bir kez `python run.py --auth` çalıştır. Tarayıcıda izin ver.
  Google'ın verdiği token yaklaşık 7 günde bir düşebilir. Düşünce aynı komutu tekrar çalıştır.
- **Freelancer.com:** [developers.freelancer.com](https://developers.freelancer.com)'dan aldığın token'ı `FREELANCER_OAUTH_TOKEN=` satırına yaz.

### İşletme radarı (isteğe bağlı)

`.env` dosyasındaki `RADAR_LAT`, `RADAR_LON` ve `RADAR_RADIUS_M` ile merkezi ve yarıçapı ayarla. Sonra:

```powershell
python run.py --havuz        # açık haritadan (Overture Maps) işletme havuzu kurar, 3-5 dk
python run.py --hedefler     # havuzdan aranacak 20 hedef çıkarır
python run.py --radar2 50    # siteleri dışarıdan denetler, sıcak lead listesi üretir
```

Sonuçlar paneldeki **Radar** ve **Arama listesi** sayfalarında görünür. Radar yalnızca
herkese açık bilgiye bakar: sayfa hızı, SSL, mobil uyum, eksik iletişim bilgisi gibi.
Hiçbir siteye giriş denemez.

## Komutlar

```text
python run.py --bot         Telegram botu + ilan avcısı (baslat.bat bunu çalıştırır)
python run.py --once        Tek tarama turu
python run.py --dry-run     Örnek ilanla uçtan uca test
python run.py --auth        Gmail'i yeniden yetkilendir
python run.py --denetle ornek.com   Tek bir sitenin dışarıdan denetim raporu
python run.py --site 3      Radar listesindeki 3. işletme için demo site üret (data/demo_sites/)
python run.py --kusursuz    Panodaki ilan metninden analiz + teklif taslağı üret
python run.py --help        Tüm komutlar
```

## Nasıl çalışır

```text
Gmail bildirimleri ─┐
Freelancer API ─────┼─► ön süzgeç (anahtar kelime) ─► Claude Haiku puan + çeviri ─► Telegram
Açık RSS kaynakları ┘                                  (profile.yaml'a göre)       + panel

Overture Maps (açık veri) ─► işletme havuzu ─► site denetimi ─► sıcak lead + arama kartı ─► panel
```

| Klasör | İçerik |
|---|---|
| `run.py` | Tüm komut satırı girişleri |
| `apps/bot/` | Telegram botu ve avcı döngüsü |
| `apps/dashboard/` | Next.js paneli (port 3005) |
| `apps/demo/` | Küçük işletmeler için örnek bir üye/randevu uygulaması demosu |
| `services/hunter/` | İlan hattı: kaynaklar → süzgeç → puanlayıcı |
| `services/radar/` | İşletme radarı: havuz → denetim → skor → demo site |
| `packages/shared/` | Ayarlar, SQLite veritabanı, bildirim, `profile.yaml` |
| `templates/business-landing/` | Demo site şablonları |
| `data/` | Veritabanı, token'lar, üretilen siteler. Git'e girmez. |

Teknolojiler: Python 3.11+ (SQLite, Anthropic SDK, DuckDB), Next.js 16, React 19, Tailwind 4, Framer Motion, MapLibre.

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| `irm … \| iex` "çalıştırma devre dışı" hatası veriyor | Önce `Set-ExecutionPolicy -Scope Process Bypass` yaz, sonra komutu tekrar çalıştır. |
| winget kurduktan sonra `python`/`node` bulunamıyor | PowerShell'i kapatıp aç, kurulum komutunu tekrar çalıştır. |
| `python` Microsoft Store'u açıyor | Ayarlar → Uygulamalar → Gelişmiş → Uygulama yürütme diğer adları → "python.exe" ve "python3.exe" seçeneklerini kapat. |
| Telegram'a hiçbir şey düşmüyor | `.env` dosyasındaki token ve chat id'yi kontrol et. Bota `/start` yazdığından emin ol. |
| Gmail kanalı sustu | `python run.py --auth` çalıştır. Token yaklaşık 7 günde bir yenilenmek isteyebilir. |
| Panelde değişiklik görünmüyor | `apps\dashboard` klasöründe `npm run build` çalıştır, ardından `baslat.bat`'ı tekrar aç. |

## Kurallar

- **Scraping yok.** Sistem yalnızca resmi API'leri, sana gelen bildirim maillerini ve açık veri setlerini kullanır.
- **Gönderimi insan yapar.** Teklifler ve mesajlar taslak olarak kalır.
- `.env`, `data/` ve `credentials.json` asla commit edilmez. `.gitignore` bunları dışarıda tutar.

## Lisans

MIT
