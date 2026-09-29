"""Demo-site üreticisi — Faz 4'ün kalbi: radar avı → işletmeye özel demo site.

Akış: radar "İdeal Fırın'ın sitesi yok" der → bu modül işletmenin adı/türü/
telefonuyla templates/business-landing/sablon.html şablonunu doldurur →
data/demo_sites/<slug>.html çıkar → kullanıcı işletmeyi arayıp
"siteniz hazır, bakmak ister misiniz?" der.

Maliyet: $0 — tamamen kural tabanlı (tür→içerik+palet sözlüğü, AI çağrısı yok).
İstenirse ileride Haiku ile tagline/hakkında zenginleştirme eklenebilir.

Kullanım:
  python run.py --site           son radar taramasının av listesi (numaralı)
  python run.py --site 3         3. avın demo sitesini üret
  Telegram: /site <numara>       aynı işi bottan yap
"""

import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import quote

from packages.shared.config import settings

_SABLON_DIR = settings.root / "templates" / "business-landing"
SABLONLAR = {
    "klasik": _SABLON_DIR / "sablon.html",
    "scroll": _SABLON_DIR / "sablon-scroll.html",
    "vitrin": _SABLON_DIR / "sablon-vitrin.html",
    "neon": _SABLON_DIR / "sablon-neon.html",
    "imza": _SABLON_DIR / "sablon-imza.html",
    "aydinlik": _SABLON_DIR / "sablon-aydinlik.html",
    "galeri": _SABLON_DIR / "sablon-galeri.html",
    "zarif": _SABLON_DIR / "sablon-zarif.html",
    "enerjik": _SABLON_DIR / "sablon-enerjik.html",
    "organik": _SABLON_DIR / "sablon-organik.html",
}
# "Yeniden Üret" her seferinde SIRADAKİ tasarımı verir (aynı yapı sıkıcı olmasın)
STIL_SIRASI = [
    "klasik", "scroll", "vitrin", "neon", "imza",
    "aydinlik", "galeri", "zarif", "enerjik", "organik",
]
# Esnafa "hazırladım bile, 5 farklı tasarım var" derken aynı anda gösterilecek
# 5 görsel açıdan en farklı stil (build_variants / /yayinla5 tarafından kullanılır).
VITRIN_5 = ["klasik", "vitrin", "neon", "aydinlik", "zarif"]
RADAR_JSON = settings.data_dir / "radar.json"
OUT_DIR = settings.data_dir / "demo_sites"
PHOTOS_JSON = _SABLON_DIR / "photos.json"

# Radar türleri, fotoğraf kütüphanesindeki daha geniş görsel dünyalara bağlanır.
# Her mekan türü kendi görsel dünyasına gitsin diye (kebapçıya kebap, pet
# shop'a hayvan fotoğrafı) — geniş "genel" kovasına düşen tür sayısı bilhassa
# azaltılmıştır; yeni eklenen 9 kategori (evcil-hayvan, hizli-lezzet, cicekci,
# kuyumcu-taki, giyim-moda, bar-eglence, kres-cocuk, surucu-kursu,
# veteriner-klinik) photos.json'da ayrı ayrı doğrulanmış görsellerle dolu.
PHOTO_CATEGORY_BY_KIND = {
    "kafe-restoran": "kafe-restoran",
    "berber-kuafor-guzellik": "berber-kuafor-guzellik",
    "atolye-tamir": "atolye-tamir", "klinik-saglik": "klinik-saglik",
    "market-perakende": "market-perakende", "spor-fitness": "spor-fitness",
    "evcil-hayvan": "evcil-hayvan", "hizli-lezzet": "hizli-lezzet",
    "cicekci": "cicekci", "kuyumcu-taki": "kuyumcu-taki",
    "giyim-moda": "giyim-moda", "bar-eglence": "bar-eglence",
    "kres-cocuk": "kres-cocuk", "surucu-kursu": "surucu-kursu",
    "veteriner-klinik": "veteriner-klinik",
    "genel": "genel",
    "bakery": "kafe-restoran", "cafe": "kafe-restoran",
    "restaurant": "kafe-restoran",
    "fast_food": "hizli-lezzet",  # kebapçı/dönerci/büfe — artık kafe/pastane fotoğrafı almıyor
    "hairdresser": "berber-kuafor-guzellik", "beauty": "berber-kuafor-guzellik",
    "barber": "berber-kuafor-guzellik", "beauty_salon": "berber-kuafor-guzellik",
    "car_repair": "atolye-tamir", "tailor": "atolye-tamir",
    "workshop": "atolye-tamir", "furniture": "atolye-tamir",
    "dentist": "klinik-saglik", "clinic": "klinik-saglik",
    "doctors": "klinik-saglik", "pharmacy": "klinik-saglik",
    "hospital": "klinik-saglik",
    "veterinary": "veteriner-klinik",  # insan kliniği değil, hayvan/vet fotoğrafı
    "supermarket": "market-perakende", "convenience": "market-perakende",
    "greengrocer": "market-perakende",
    "florist": "cicekci",  # market yerine çiçek/buket fotoğrafı
    "fitness_centre": "spor-fitness", "gym": "spor-fitness",
    "sports_centre": "spor-fitness", "yoga": "spor-fitness", "dance": "spor-fitness",
    "pet": "evcil-hayvan", "jewelry": "kuyumcu-taki", "clothes": "giyim-moda",
    "bar": "bar-eglence", "kindergarten": "kres-cocuk", "driving_school": "surucu-kursu",
    "travel_agency": "genel", "language_school": "genel",
}

# --- Renk paletleri: işletme türünün duygusuna göre seçilir ---
PALETTES = {
    "sicak": {  # fırın, restoran, kafe — sıcak/iştah açıcı
        "C_BG": "#171210", "C_PANEL": "#241c17", "C_ACCENT": "#f59e0b",
        "C_ACCENT2": "#ef4444", "C_TEXT": "#f7f1e8", "C_MUTED": "#b5a898",
    },
    "saglik": {  # klinik, diş, eczane, veteriner — güven/hijyen
        "C_BG": "#0d1520", "C_PANEL": "#152232", "C_ACCENT": "#2dd4bf",
        "C_ACCENT2": "#38bdf8", "C_TEXT": "#eef6fb", "C_MUTED": "#93a8bb",
    },
    "guzellik": {  # kuaför, güzellik salonu — şık/modern
        "C_BG": "#171019", "C_PANEL": "#251a29", "C_ACCENT": "#e879f9",
        "C_ACCENT2": "#a78bfa", "C_TEXT": "#faf2fc", "C_MUTED": "#b49cbd",
    },
    "enerji": {  # spor salonu, sürücü kursu — dinamik
        "C_BG": "#0f1710", "C_PANEL": "#18251b", "C_ACCENT": "#a3e635",
        "C_ACCENT2": "#34d399", "C_TEXT": "#f0f9f1", "C_MUTED": "#9db4a1",
    },
    "kurumsal": {  # avukat, emlak, ofis — ciddi/prestijli
        "C_BG": "#10131c", "C_PANEL": "#1a1f2e", "C_ACCENT": "#c9a24b",
        "C_ACCENT2": "#818cf8", "C_TEXT": "#f2f3f7", "C_MUTED": "#9aa1b5",
    },
    "teknik": {  # oto servis, terzi, mobilyacı — zanaat/işçilik
        "C_BG": "#14120f", "C_PANEL": "#201d18", "C_ACCENT": "#fb923c",
        "C_ACCENT2": "#94a3b8", "C_TEXT": "#f5f2ec", "C_MUTED": "#aca394",
    },
    "varsayilan": {
        "C_BG": "#0e1117", "C_PANEL": "#171c26", "C_ACCENT": "#22d3ee",
        "C_ACCENT2": "#a78bfa", "C_TEXT": "#f1f4f9", "C_MUTED": "#94a0b3",
    },
}

# --- Tür → içerik sözlüğü ---
# {ad} ve {semt} alanları doldurulur. kartlar = 3 × (ikon, başlık, açıklama).
KIND_CONTENT = {
    "bakery": {
        "palet": "sicak",
        "tagline": "Her sabah taze: fırından yeni çıkmış ekmekler, pastalar ve "
                   "börekler. {semt_nin} mahalle fırını.",
        "hizmet_alt": "Günlük üretim, taze malzeme — çünkü fırın işi tazelik işidir.",
        "kartlar": [
            ("🥖", "Taze Ekmek & Unlu Mamuller", "Her gün taş fırından çıkan ekmek, simit ve börek çeşitleri."),
            ("🎂", "Pasta & Tatlı Siparişi", "Doğum günü ve özel gün pastaları — bir telefonla sipariş verin."),
            ("☕", "Kahvaltılık & Atıştırmalık", "Sabah kahvaltınız için poğaça, açma ve daha fazlası."),
        ],
        "hakkinda": "{ad}, {semt_de} taze ve kaliteli üretimiyle tanınan bir mahalle "
                    "fırınıdır. Ürünlerimiz her sabah erken saatlerde, günlük malzemeyle "
                    "hazırlanır. Bir telefon uzağınızdayız — özel gün siparişlerinizi "
                    "önceden verin, hazır olsun.",
    },
    "cafe": {
        "palet": "sicak",
        "tagline": "İyi kahve, tatlı eşlikçiler ve samimi bir ortam — {semt_de} "
                   "buluşmaların yeni adresi.",
        "hizmet_alt": "Kahveden tatlıya, kahvaltıdan atıştırmalığa günün her saati.",
        "kartlar": [
            ("☕", "Kahve & İçecekler", "Özenle hazırlanan sıcak ve soğuk içecek çeşitleri."),
            ("🍰", "Tatlı & Pasta", "Günlük hazırlanan tatlılarımızla kahvenize eşlik edin."),
            ("🥐", "Kahvaltı & Atıştırmalık", "Güne güzel başlamak için serpme kahvaltı ve ara sıcaklar."),
        ],
        "hakkinda": "{ad}, {semt_de} samimi atmosferi ve güler yüzlü ekibiyle hizmet "
                    "veren bir kafedir. Arkadaş buluşmaları, iş görüşmeleri veya sessiz "
                    "bir çalışma günü için sizi bekliyoruz.",
    },
    "restaurant": {
        "palet": "sicak",
        "tagline": "Özenle hazırlanan lezzetler, sıcak servis — {semt_de} sofranız "
                   "hazır.",
        "hizmet_alt": "Yerinde servis, paket sipariş ve özel gün organizasyonları.",
        "kartlar": [
            ("🍽️", "Zengin Menü", "Ustalarımızın elinden çıkan ana yemekler, ızgaralar ve mezeler."),
            ("🛵", "Paket Servis", "Siparişiniz sıcak sıcak kapınızda — telefonla sipariş verin."),
            ("🎉", "Özel Gün & Grup Rezervasyonu", "Kalabalık masalar ve kutlamalar için önceden yerinizi ayırtın."),
        ],
        "hakkinda": "{ad}, {semt_de} taze malzeme ve güler yüzlü servisiyle bilinen bir "
                    "restorandır. İster ailenizle yemeğe gelin, ister telefonla sipariş "
                    "verin — lezzet bizim işimiz.",
    },
    "fast_food": {
        "palet": "sicak",
        "tagline": "Acıktınız, biliyoruz — {semt_nin} en pratik lezzet durağı sıcacık bekliyor.",
        "hizmet_alt": "Tezgahtan kapınıza: hızlı servis, uygun fiyat.",
        "kartlar": [
            ("🍔", "Günlük Taze Menü", "Her gün taze hazırlanan döner, burger ve sandviç çeşitleri."),
            ("🛵", "Paket Servis", "Telefonla sipariş verin, kapınıza gelsin."),
            ("💳", "Uygun Fiyat", "Öğrenci ve esnaf dostu menüler, kampanyalı fiyatlar."),
        ],
        "hakkinda": "{ad}, {semt_de} hızlı ve lezzetli yemeğin adresidir. Taze malzeme, "
                    "hızlı servis ve uygun fiyat — yoğun gününüzde en pratik çözüm.",
    },
    "hairdresser": {
        "palet": "guzellik",
        "tagline": "Saçınıza hak ettiği özeni gösterin — {semt_de} randevunuz hazır.",
        "hizmet_alt": "Kesimden bakıma, renklendirmeden şekillendirmeye tam hizmet.",
        "kartlar": [
            ("✂️", "Kesim & Şekillendirme", "Yüz hatlarınıza uygun, modern kesim ve fön."),
            ("🎨", "Renklendirme & Bakım", "Boya, röfle ve keratin bakımı — saç sağlığı önceliğimiz."),
            ("📅", "Randevulu Hizmet", "Beklemeden hizmet için telefonla randevu alın."),
        ],
        "hakkinda": "{ad}, {semt_de} deneyimli ekibiyle hizmet veren bir kuaför "
                    "salonudur. Amacımız basit: içeri girdiğinizden daha iyi hissederek "
                    "çıkın. Randevu için bir telefon yeter.",
    },
    "beauty": {
        "palet": "guzellik",
        "tagline": "Kendinize bir iyilik yapın — {semt_de} güzellik ve bakımın adresi.",
        "hizmet_alt": "Cilt bakımından manikure, profesyonel ürünlerle kişiye özel hizmet.",
        "kartlar": [
            ("💆", "Cilt Bakımı", "Cilt tipinize özel profesyonel bakım uygulamaları."),
            ("💅", "El & Ayak Bakımı", "Manikür, pedikür ve kalıcı oje uygulamaları."),
            ("✨", "Özel Gün Hazırlığı", "Düğün, nişan ve özel günleriniz için komple bakım paketi."),
        ],
        "hakkinda": "{ad}, {semt_de} hijyenik ortamı ve deneyimli uzmanlarıyla hizmet "
                    "veren bir güzellik salonudur. Randevu alın, gerisini bize bırakın.",
    },
    "dentist": {
        "palet": "saglik",
        "tagline": "Gülüşünüzden asla ödün vermeyin — {semt_de} modern ve güvenilir "
                   "diş hekimliği hizmetinizdeyiz.",
        "hizmet_alt": "Muayeneden estetiğe, ağız ve diş sağlığında tam kapsamlı hizmet.",
        "kartlar": [
            ("🦷", "Genel Diş Tedavisi", "Muayene, dolgu, kanal tedavisi ve diş taşı temizliği."),
            ("😁", "Estetik Diş Hekimliği", "Beyazlatma, kaplama ve gülüş tasarımı uygulamaları."),
            ("📅", "Randevulu Sistem", "Beklemeden muayene için telefonla randevu alın."),
        ],
        "hakkinda": "{ad}, {semt_de} modern donanımı ve hasta odaklı yaklaşımıyla hizmet "
                    "veren bir diş kliniğidir. Ağız ve diş sağlığınız için düzenli "
                    "kontrolünüzü ihmal etmeyin — randevu bir telefon uzağınızda.",
    },
    "clinic": {
        "palet": "saglik",
        "tagline": "Sağlığınız için yakınınızda: güvenilir muayene ve takip — {semt}.",
        "hizmet_alt": "Muayene, tetkik ve düzenli sağlık takibi tek adreste.",
        "kartlar": [
            ("🩺", "Muayene & Teşhis", "Uzman kadroyla kapsamlı muayene ve doğru teşhis."),
            ("🧪", "Tetkik & Takip", "Gerekli tetkiklerin planlanması ve düzenli hasta takibi."),
            ("📅", "Randevulu Hizmet", "Yoğunluk yaşamamak için telefonla randevu alın."),
        ],
        "hakkinda": "{ad}, {semt_de} hasta memnuniyetini önceleyen bir sağlık "
                    "kuruluşudur. Sorularınız ve randevu için bize telefonla "
                    "ulaşabilirsiniz.",
    },
    "fitness_centre": {
        "palet": "enerji",
        "tagline": "Hedefine bir adım daha yaklaş — {semt_de} antrenman zamanı.",
        "hizmet_alt": "Modern ekipman, uzman eğitmen ve sana özel program.",
        "kartlar": [
            ("🏋️", "Serbest Antrenman", "Modern ekipmanlarla donatılmış geniş antrenman alanı."),
            ("🧑‍🏫", "Kişisel Antrenörlük", "Hedefine özel program ve birebir eğitmen desteği."),
            ("🥗", "Beslenme Desteği", "Antrenmanını destekleyen beslenme önerileri."),
        ],
        "hakkinda": "{ad}, {semt_de} her seviyeden sporcuya hitap eden bir spor "
                    "salonudur. İlk dersiniz için arayın — hedefinizi birlikte "
                    "planlayalım.",
    },
    "car_repair": {
        "palet": "teknik",
        "tagline": "Aracınız emin ellerde — {semt_de} hızlı ve dürüst servis.",
        "hizmet_alt": "Bakımdan arızaya, tek telefonla çözüm.",
        "kartlar": [
            ("🔧", "Periyodik Bakım", "Yağ, filtre ve genel kontrol — aracınız yolda kalmasın."),
            ("🚗", "Arıza Tespit & Onarım", "Mekanik ve elektronik arızalarda hızlı teşhis, net fiyat."),
            ("🛞", "Lastik & Fren Servisi", "Güvenliğiniz için lastik ve fren sistemleri kontrolü."),
        ],
        "hakkinda": "{ad}, {semt_de} dürüst işçiliği ve şeffaf fiyatlandırmasıyla "
                    "tanınan bir oto servistir. Aracınızı getirmeden önce arayın, "
                    "randevunuzu planlayalım.",
    },
    "estate_agent": {
        "palet": "kurumsal",
        "tagline": "{semt_de} ev almak, satmak veya kiralamak mı istiyorsunuz? "
                   "Doğru adrestesiniz.",
        "hizmet_alt": "Bölgeyi bilen ekip, güncel portföy, güvenli süreç.",
        "kartlar": [
            ("🏠", "Satılık & Kiralık Portföy", "Bölgedeki güncel satılık ve kiralık gayrimenkuller."),
            ("📈", "Doğru Değerleme", "Mülkünüzün gerçek piyasa değerini birlikte belirleyelim."),
            ("🤝", "Uçtan Uca Danışmanlık", "İlan, pazarlık, sözleşme — tüm süreçte yanınızdayız."),
        ],
        "hakkinda": "{ad}, {semt} bölgesini yakından tanıyan bir emlak ofisidir. "
                    "Gayrimenkul kararları büyüktür — güvenilir bir yol arkadaşıyla "
                    "ilerleyin. Telefonla ücretsiz ön görüşme alın.",
    },
    "lawyer": {
        "palet": "kurumsal",
        "tagline": "Haklarınızı bilen bir çözüm ortağı — {semt_de} hukuki danışmanlık.",
        "hizmet_alt": "Ön görüşmeden dava takibine, süreç boyunca yanınızda.",
        "kartlar": [
            ("⚖️", "Hukuki Danışmanlık", "Sorununuzu dinleyip izlenecek yolu net şekilde anlatırız."),
            ("📄", "Sözleşme & Belge", "Sözleşme hazırlama, inceleme ve ihtarname süreçleri."),
            ("🏛️", "Dava Takibi", "Dava sürecinizin özenli ve düzenli takibi."),
        ],
        "hakkinda": "{ad}, {semt_de} hizmet veren bir hukuk bürosudur. Hukuki "
                    "süreçler ertelendiğinde büyür — erken danışmak her zaman "
                    "kazandırır. Randevu için telefonla ulaşın.",
    },
    "veterinary": {
        "palet": "saglik",
        "tagline": "Can dostunuz bizim için de değerli — {semt_de} veteriner "
                   "kliniğiniz.",
        "hizmet_alt": "Aşıdan cerrahiye, dostlarınızın sağlığı tek adreste.",
        "kartlar": [
            ("🐾", "Muayene & Aşı", "Düzenli kontrol, aşı takvimi ve iç-dış parazit koruması."),
            ("💉", "Tedavi & Cerrahi", "Modern donanımla teşhis, tedavi ve operasyonlar."),
            ("🛁", "Bakım & Tıraş", "Hijyenik ortamda bakım, tıraş ve tırnak kesimi."),
        ],
        "hakkinda": "{ad}, {semt_de} evcil dostlarınızın sağlığı için hizmet veren bir "
                    "veteriner kliniğidir. Acil durumlar ve randevu için bize telefonla "
                    "ulaşabilirsiniz.",
    },
    "florist": {
        "palet": "guzellik",
        "tagline": "Her duyguya bir çiçek — {semt_de} taze çiçeğin adresi.",
        "hizmet_alt": "Buketten organizasyona, aynı gün teslimat.",
        "kartlar": [
            ("💐", "Buket & Aranjman", "Her bütçeye ve her duyguya uygun taze tasarımlar."),
            ("🚚", "Aynı Gün Teslimat", "Telefonla sipariş verin, sevdiklerinize bugün ulaşsın."),
            ("💍", "Özel Gün & Organizasyon", "Düğün, nişan ve açılış süslemeleri."),
        ],
        "hakkinda": "{ad}, {semt_de} taze çiçek ve özgün tasarımlarıyla hizmet veren "
                    "bir çiçekçidir. Siparişiniz bir telefon uzağınızda.",
    },
    "pharmacy": {
        "palet": "saglik",
        "tagline": "Sağlığınız için güvenilir danışmanınız — {semt} eczanesi.",
        "hizmet_alt": "İlaç temini, danışmanlık ve sağlık ürünleri.",
        "kartlar": [
            ("💊", "Reçeteli & Reçetesiz İlaç", "İlaçlarınız güvenle ve eksiksiz hazırlanır."),
            ("🩹", "Sağlık Ürünleri", "Dermokozmetik, vitamin ve medikal ürün çeşitleri."),
            ("☎️", "Telefonla Danışma", "Stok ve ürün sorularınız için arayın, hazır edelim."),
        ],
        "hakkinda": "{ad}, {semt_de} güler yüzlü hizmetiyle bilinen bir eczanedir. "
                    "Aradığınız ürünü gelmeden önce telefonla sorabilirsiniz.",
    },
    "pet": {
        "palet": "enerji",
        "tagline": "Evladınız kadar değerli — {semt_de} her ihtiyacı tek adreste.",
        "hizmet_alt": "Mamadan bakıma, can dostlarınız için her şey burada.",
        "kartlar": [
            ("🐾", "Mama & Aksesuar", "Her tür ve yaşa uygun kaliteli mama, oyuncak ve aksesuar."),
            ("✂️", "Tıraş & Bakım", "Hijyenik ortamda profesyonel tıraş, tırnak ve bakım hizmeti."),
            ("🐶", "Uzman Tavsiyesi", "Beslenme ve bakım konusunda deneyimli ekipten yönlendirme."),
        ],
        "hakkinda": "{ad}, {semt_de} evcil dostlarınızın mutluluğu için hizmet veren bir "
                    "pet shoptur. Mama, bakım ve aksesuar ihtiyaçlarınız için bir telefon "
                    "uzağınızdayız.",
    },
    "jewelry": {
        "palet": "kurumsal",
        "tagline": "Bir ömür taşınacak parçalar — {semt_de} kuyumcunuz.",
        "hizmet_alt": "Alımdan tamire, özel günlerin adresi.",
        "kartlar": [
            ("💍", "Altın & Gümüş Takı", "Güncel modeller ve günlük ayarında güvenilir alışveriş."),
            ("🔧", "Tamir & Ayar", "Kırık, eksik veya beden ayarı gereken takılarınız özenle onarılır."),
            ("🎁", "Özel Gün Hediyesi", "Nişan, düğün ve yıldönümü için özel tasarım seçenekleri."),
        ],
        "hakkinda": "{ad}, {semt_de} güvenilirliği ve şeffaf fiyatlandırmasıyla bilinen bir "
                    "kuyumcudur. Aradığınız parça için önce telefonla stok sorabilirsiniz.",
    },
    "clothes": {
        "palet": "guzellik",
        "tagline": "Tarzınızı yansıtan seçenekler — {semt_de} dolabınızın yeni adresi.",
        "hizmet_alt": "Günlükten özel güne, bütçenize uygun şıklık.",
        "kartlar": [
            ("👕", "Güncel Koleksiyon", "Sezonun trendlerini takip eden geniş ürün yelpazesi."),
            ("📏", "Beden & Uyum Desteği", "Doğru bedeni bulmanız için ekibimiz yardımcı olur."),
            ("🎀", "Kombin Önerisi", "İhtiyacınıza göre kombin ve stil önerileri alın."),
        ],
        "hakkinda": "{ad}, {semt_de} kaliteli ve uygun fiyatlı giyim seçenekleriyle hizmet "
                    "veren bir mağazadır. Yeni gelen ürünleri kaçırmamak için bizi arayın.",
    },
    "bar": {
        "palet": "sicak",
        "tagline": "Gecenin en iyi hali — {semt_de} buluşma noktanız.",
        "hizmet_alt": "Kokteylden canlı müziğe, keyifli bir akşamın adresi.",
        "kartlar": [
            ("🍸", "Kokteyl & İçecek", "Ustalıkla hazırlanan klasik ve imza kokteyller."),
            ("🎵", "Canlı Müzik & Etkinlik", "Hafta içi ve hafta sonu özel program ve etkinlikler."),
            ("🥂", "Grup & Kutlama", "Doğum günü ve özel kutlamalar için masa ayırtın."),
        ],
        "hakkinda": "{ad}, {semt_de} sıcak atmosferi ve özenli servisiyle bilinen bir "
                    "mekandır. Masa ayırtmak veya program bilgisi için bizi arayın.",
    },
    "kindergarten": {
        "palet": "enerji",
        "tagline": "Onlar için en güvenli başlangıç — {semt_de} anaokulunuz.",
        "hizmet_alt": "Oyunla öğrenen, güvenle büyüyen bir ortam.",
        "kartlar": [
            ("🧸", "Oyun Temelli Eğitim", "Yaşına uygun, gelişimi destekleyen eğlenceli programlar."),
            ("🛡️", "Güvenli & Hijyenik Ortam", "Deneyimli kadro ve düzenli sağlık/hijyen takibi."),
            ("👨‍👩‍👧", "Veli İletişimi", "Gün içi gelişim ve etkinlikler hakkında düzenli bilgilendirme."),
        ],
        "hakkinda": "{ad}, {semt_de} güvenli ve sevgi dolu ortamıyla hizmet veren bir "
                    "anaokuludur. Kayıt ve ziyaret için bizi telefonla arayabilirsiniz.",
    },
    "driving_school": {
        "palet": "kurumsal",
        "tagline": "Direksiyona güvenle geçin — {semt_de} sürücü kursunuz.",
        "hizmet_alt": "Teoriden direksiyon eğitimine, sınava hazır hale gelin.",
        "kartlar": [
            ("📘", "Teorik Ders", "Güncel müfredatla, sınav odaklı anlaşılır teorik eğitim."),
            ("🚗", "Direksiyon Eğitimi", "Deneyimli eğitmenlerle birebir pratik direksiyon dersleri."),
            ("📝", "Sınava Hazırlık", "Deneme sınavları ile sınav gününe hazır gelin."),
        ],
        "hakkinda": "{ad}, {semt_de} yüksek başarı oranıyla bilinen bir sürücü kursudur. "
                    "Kayıt ve kurs tarihleri için bizi arayın.",
    },
    "doctors": {
        "palet": "saglik",
        "tagline": "Sağlığınız emin ellerde — {semt_de} muayenehanenizde.",
        "hizmet_alt": "Muayeneden takibe, güvenilir sağlık hizmeti tek adreste.",
        "kartlar": [
            ("🩺", "Genel Muayene", "Şikayetinizi dinleyen, doğru yönlendiren uzman yaklaşım."),
            ("📋", "Kontrol & Takip", "Düzenli sağlık kontrolü ve tedavi takibi."),
            ("📅", "Randevulu Sistem", "Beklemeden muayene için telefonla randevu alın."),
        ],
        "hakkinda": "{ad}, {semt_de} hasta memnuniyetini önceleyen bir muayenehanedir. "
                    "Randevu ve bilgi için bizi telefonla arayabilirsiniz.",
    },
    "tailor": {
        "palet": "teknik",
        "tagline": "Tam üstünüze göre — {semt_de} usta terziniz.",
        "hizmet_alt": "Daralttan dikime, özenli işçilik tek adreste.",
        "kartlar": [
            ("✂️", "Tadilat & Daraltma", "Kıyafetleriniz üzerinize tam oturacak şekilde düzenlenir."),
            ("🧵", "Özel Dikim", "İsteğinize göre özel kesim ve dikim hizmeti."),
            ("⏱️", "Hızlı Teslimat", "Acil işleriniz için hızlı ve özenli çözüm."),
        ],
        "hakkinda": "{ad}, {semt_de} titiz işçiliği ve güler yüzüyle bilinen bir terzi "
                    "atölyesidir. İşinizi bırakmadan önce bizi arayıp süre sorabilirsiniz.",
    },
    "furniture": {
        "palet": "teknik",
        "tagline": "Eviniz size özel görünsün — {semt_de} mobilyacınız.",
        "hizmet_alt": "Üretimden tadilata, ahşabın ustası.",
        "kartlar": [
            ("🛋️", "Özel Üretim Mobilya", "İsteğinize göre ölçü ve tasarımla üretim."),
            ("🪚", "Tadilat & Onarım", "Eskiyen veya kırılan mobilyalarınız yeniden hayat bulur."),
            ("🚚", "Teslimat & Montaj", "Siparişiniz evinizde kurulu ve hazır teslim edilir."),
        ],
        "hakkinda": "{ad}, {semt_de} kaliteli işçiliği ve dayanıklı ürünleriyle bilinen bir "
                    "mobilyacıdır. Ölçü ve fiyat teklifi için bizi arayabilirsiniz.",
    },
}

DEFAULT_CONTENT = {
    "palet": "varsayilan",
    "tagline": "{semt_de} güvenilir ve güler yüzlü hizmet — {ad} olarak "
               "yanınızdayız.",
    "hizmet_alt": "İhtiyacınıza özel çözümler için bize ulaşın.",
    "kartlar": [
        ("⭐", "Kaliteli Hizmet", "İşimizi özenle ve zamanında yaparız — referansımız müşterilerimizdir."),
        ("🤝", "Güler Yüzlü İletişim", "Sorularınıza net ve dürüst yanıt alırsınız."),
        ("📍", "Yerinde Hizmet", "{semt_de}yiz — bize kolayca ulaşabilirsiniz."),
    ],
    "hakkinda": "{ad}, {semt_de} müşteri memnuniyetini önceleyen bir işletmedir. "
                "Sorularınız için bize telefonla ulaşabilir veya adresimize "
                "uğrayabilirsiniz.",
}

# Yorum, saat ve fiyat sinyalleri içerik türünün gerçek çalışma biçimine göre
# ayrı tutulur; aşağıda KIND_CONTENT'e katılarak tek içerik kontratı oluşturur.
_KIND_DETAILS = {
    "bakery": {
        "yorumlar": [
            ("Ekmekler sabah gerçekten taze oluyor, börekleri de oldukça lezzetli.", "Merve A."),
            ("Özel gün pastamızı zamanında ve istediğimiz gibi hazırladılar.", "Burak T."),
            ("Mahallede günlük unlu mamul almak için güvenle uğradığımız yer.", "Selin K."),
        ],
        "saatler": ("Pzt–Cmt · 07:00–21:00", "Pazar · 07:00–20:00"),
        "fiyatlar": ["₺20'den başlayan", "₺450'den başlayan", "₺35'ten başlayan"],
    },
    "cafe": {
        "yorumlar": [
            ("Kahvesi dengeli, servis hızlı ve çalışanlar ilgiliydi.", "Ece D."),
            ("Kahvaltı ürünleri tazeydi; sakin bir buluşma için güzel bir ortam.", "Kerem Y."),
            ("Tatlı seçenekleri ve sunumları özenliydi, yine geleceğiz.", "Derya S."),
        ],
        "saatler": ("Pzt–Cmt · 08:00–22:00", "Pazar · 09:00–22:00"),
        "fiyatlar": ["₺90'dan başlayan", "₺120'den başlayan", "₺220'den başlayan"],
    },
    "restaurant": {
        "yorumlar": [
            ("Yemekler sıcak ve lezzetliydi, servis de beklediğimizden hızlıydı.", "Ayşe K."),
            ("Ailece geldik; porsiyonlar doyurucu, ekip güler yüzlüydü.", "Mehmet D."),
            ("Rezervasyonumuz hazırdı ve akşam boyunca servis gayet düzenliydi.", "Elif T."),
        ],
        "saatler": ("Pzt–Cmt · 11:00–23:00", "Pazar · 11:00–23:00"),
        "fiyatlar": ["₺250'den başlayan", "₺300'den başlayan", "Kişi başı ₺600'den başlayan"],
    },
    "fast_food": {
        "yorumlar": [
            ("Sipariş hızlı geldi, ürünler sıcak ve porsiyon yeterliydi.", "Can E."),
            ("Yoğun saatte bile bekletmeden ilgilendiler.", "İrem B."),
            ("Fiyatına göre doyurucu ve malzemeler tazeydi.", "Emre A."),
        ],
        "saatler": ("Pzt–Cmt · 10:00–23:00", "Pazar · 11:00–23:00"),
        "fiyatlar": ["₺180'den başlayan", "₺200'den başlayan", "₺160'tan başlayan"],
    },
    "hairdresser": {
        "yorumlar": [
            ("Kesim öncesi ne istediğimi dikkatle dinledi, sonuç çok içime sindi.", "Zeynep K."),
            ("Randevu saatinde aldılar; temiz ve özenli çalışıyorlar.", "Onur A."),
            ("Saç rengini doğal bir tonla eşleştirdi, ustalığı gerçekten belli.", "Ceren D."),
        ],
        "saatler": ("Sal–Cmt · 09:00–21:00", "Pazar · 10:00–19:00"),
        "fiyatlar": ["₺350'den başlayan", "₺900'den başlayan", "Randevu ile"],
    },
    "beauty": {
        "yorumlar": [
            ("Uygulama öncesi her aşamayı anlattılar, hijyen konusunda çok özenliler.", "Seda M."),
            ("Cilt bakımından sonra daha canlı bir görünüm elde ettim.", "Gizem E."),
            ("Randevu düzeni iyi, çalışanlar nazik ve dikkatli.", "Aslı T."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–20:00", "Pazar · Randevu ile"),
        "fiyatlar": ["₺650'den başlayan", "₺300'den başlayan", "₺1.200'den başlayan"],
    },
    "dentist": {
        "yorumlar": [
            ("Tedavi sürecini sakin ve anlaşılır biçimde anlattılar, kendimi güvende hissettim.", "Deniz K."),
            ("Randevu saatine sadık kaldılar ve işlem beklediğimden rahat geçti.", "Hakan Y."),
            ("Klinik temiz, ekip ilgili ve sorularıma sabırla yanıt verdi.", "Pınar A."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–19:00", "Pazar · Kapalı"),
        "fiyatlar": ["Muayene ₺750'den", "₺2.500'den başlayan", "Randevu ile"],
    },
    "clinic": {
        "yorumlar": [
            ("Doktorumuz şikâyetimi dikkatle dinledi ve süreci açıkça anlattı.", "Nihan S."),
            ("Randevu ve takip konusunda düzenli bilgilendirme yapıldı.", "Murat E."),
            ("Temiz, sakin ve güven veren bir ortamda hizmet aldım.", "Aylin C."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–19:00", "Pazar · Kapalı"),
        "fiyatlar": ["Muayene ₺1.000'den", "Tetkike göre fiyat", "Randevu ile"],
    },
    "fitness_centre": {
        "yorumlar": [
            ("Ekipmanlar bakımlı, salon temiz ve yoğunluk iyi yönetiliyor.", "Berk K."),
            ("Eğitmen hedefime uygun, uygulanabilir bir program hazırladı.", "İlayda A."),
            ("Yeni başlayan biri olarak hareketleri güvenle öğrenebildim.", "Ozan D."),
        ],
        "saatler": ("Pzt–Cmt · 07:00–23:00", "Pazar · 09:00–20:00"),
        "fiyatlar": ["Aylık ₺1.200'den", "Ders ₺600'den", "Paketlere dahil"],
    },
    "car_repair": {
        "yorumlar": [
            ("Arızayı net anlattılar ve onayım olmadan ek işlem yapmadılar.", "Serkan T."),
            ("Bakım söz verilen saatte tamamlandı, fiyat baştan konuştuğumuz gibiydi.", "Gökhan A."),
            ("İşçilik temiz ve iletişim dürüst; aracımı güvenle teslim ettim.", "Ebru K."),
        ],
        "saatler": ("Pzt–Cmt · 08:30–19:00", "Pazar · Kapalı"),
        "fiyatlar": ["₺2.000'den başlayan", "Tespit sonrası fiyat", "₺1.500'den başlayan"],
    },
    "estate_agent": {
        "yorumlar": [
            ("Bütçemize uymayan seçeneklerle zaman kaybettirmeden doğru portföyü sundular.", "Buse K."),
            ("Sözleşme sürecindeki her adımı açıkça anlattılar.", "Ali R."),
            ("Bölge bilgileri güçlü, sorularımıza hızlı ve net dönüş yaptılar.", "Sinem D."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–19:00", "Pazar · Randevu ile"),
        "fiyatlar": ["Ücretsiz ön görüşme", "Ücretsiz değerleme", "Portföye göre fiyat"],
    },
    "lawyer": {
        "yorumlar": [
            ("Dosyamla ilgili olası yolları açık ve anlaşılır şekilde anlattı.", "Cem K."),
            ("Süreç boyunca düzenli bilgi aldım ve sorularıma zamanında dönüş yapıldı.", "Esra M."),
            ("İlk görüşmede gerçekçi bir yol haritası sunuldu.", "Tolga D."),
        ],
        "saatler": ("Pzt–Cum · 09:00–18:00", "Hafta sonu · Randevu ile"),
        "fiyatlar": ["Görüşme ₺1.500'den", "Belgeye göre fiyat", "Dosyaya göre fiyat"],
    },
    "veterinary": {
        "yorumlar": [
            ("Kedimize sakin ve özenli yaklaştılar, tedaviyi ayrıntılı anlattılar.", "Melis A."),
            ("Aşı takibini düzenli yapıyor, sorularımıza hızlı yanıt veriyorlar.", "Umut K."),
            ("Kliniğin temizliği ve ekibin hayvanlara yaklaşımı güven verdi.", "Dilan S."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–21:00", "Pazar · 10:00–18:00"),
        "fiyatlar": ["Muayene ₺700'den", "Tedaviye göre fiyat", "₺500'den başlayan"],
    },
    "florist": {
        "yorumlar": [
            ("Buket fotoğraftaki gibi özenliydi ve zamanında teslim edildi.", "Neslihan K."),
            ("Bütçeme uygun, sade ve taze bir aranjman hazırladılar.", "Arda T."),
            ("Son dakika siparişimizle hızlıca ilgilendiler.", "Eylül A."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–20:00", "Pazar · 10:00–18:00"),
        "fiyatlar": ["₺500'den başlayan", "₺650'den başlayan", "Teklif alın"],
    },
    "pharmacy": {
        "yorumlar": [
            ("İlaç kullanımıyla ilgili sorularımı dikkatle yanıtladılar.", "Fatma E."),
            ("Aradığım ürünü ayırıp gelmeden önce bilgi verdiler.", "Levent K."),
            ("Her ziyaretimde güler yüzlü ve açıklayıcı hizmet alıyorum.", "Sibel T."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–19:00", "Pazar · Nöbet durumuna göre"),
        "fiyatlar": ["Reçeteye göre", "₺150'den başlayan", "Ücretsiz danışma"],
    },
    "pet": {
        "yorumlar": [
            ("Kedimin mamasını her seferinde stoklarına bakıp ayırıyorlar.", "Naz K."),
            ("Tıraş sonrası köpeğim çok rahat etti, ekip sabırlıydı.", "Barış T."),
            ("Ürün çeşitliliği geniş, fiyatlar da makul.", "Gül S."),
        ],
        "saatler": ("Pzt–Cmt · 09:30–20:00", "Pazar · 11:00–18:00"),
        "fiyatlar": ["₺150'den başlayan", "₺250'den başlayan", "Ücretsiz danışma"],
    },
    "jewelry": {
        "yorumlar": [
            ("Ayar ve fiyat konusunda tamamen şeffaflardı, güven verdiler.", "Tuğçe A."),
            ("Yüzüğümün tamiri hızlı ve özenli yapıldı.", "Emre K."),
            ("Nişan takılarımızı bütçemize uygun şekilde bulmamıza yardımcı oldular.", "Selin M."),
        ],
        "saatler": ("Pzt–Cmt · 10:00–19:30", "Pazar · Kapalı"),
        "fiyatlar": ["Gram üzerinden güncel fiyat", "Tamirde ücret değişir", "Ücretsiz danışma"],
    },
    "clothes": {
        "yorumlar": [
            ("Beden bulmakta zorlanırım ama burada ekip gerçekten yardımcı oldu.", "İpek D."),
            ("Kaliteli kumaşlar ve uygun fiyat, sık uğradığım bir yer oldu.", "Cem A."),
            ("Yeni sezon ürünleri hızlı geliyor, takip etmesi keyifli.", "Yasemin T."),
        ],
        "saatler": ("Pzt–Cmt · 10:00–21:00", "Pazar · 12:00–20:00"),
        "fiyatlar": ["₺300'den başlayan", "₺500'den başlayan", "Sezon sonu indirimli"],
    },
    "bar": {
        "yorumlar": [
            ("Kokteyller gerçekten dengeliydi, servis de hızlıydı.", "Onur B."),
            ("Doğum günümüz için ayrılan masa tam istediğimiz gibiydi.", "Aslı K."),
            ("Atmosfer çok iyi, canlı müzik geceyi tamamladı.", "Kaan E."),
        ],
        "saatler": ("Her gün · 17:00–02:00", "Cuma–Cmt · 17:00–03:00"),
        "fiyatlar": ["₺250'den başlayan", "₺180'den başlayan", "Masa için arayın"],
    },
    "kindergarten": {
        "yorumlar": [
            ("Çocuğum her sabah severek gidiyor, bu bizim için en büyük gösterge.", "Merve Y."),
            ("Öğretmenler gün sonunda gelişimini ayrıntılı anlatıyor.", "Fatih D."),
            ("Hijyen ve güvenlik konusunda gerçekten titizler.", "Burcu A."),
        ],
        "saatler": ("Pzt–Cum · 07:30–18:30", "Hafta sonu · Kapalı"),
        "fiyatlar": ["Aylık ücret için arayın", "Kayıt ücretsiz görüşme", "Kardeş indirimi var"],
    },
    "driving_school": {
        "yorumlar": [
            ("Eğitmenim çok sabırlıydı, ilk sınavda geçtim.", "Deniz K."),
            ("Teorik dersler sınav sorularıyla birebir örtüşüyordu.", "Alper S."),
            ("Direksiyon saatlerini müsaitliğime göre kolayca ayarladılar.", "Zeynep C."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–20:00", "Pazar · Randevu ile"),
        "fiyatlar": ["Paket fiyatı için arayın", "Ek ders ₺400'den", "Sınav ücreti hariç"],
    },
    "doctors": {
        "yorumlar": [
            ("Şikayetimi dikkatle dinledi, gereksiz tetkik istemedi.", "Serap N."),
            ("Randevu saatine sadık kaldılar, beklemedim.", "Kadir T."),
            ("Açıklamaları anlaşılırdı, kendimi güvende hissettim.", "Gamze Ö."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–18:00", "Pazar · Kapalı"),
        "fiyatlar": ["Muayene ₺600'den", "Kontrol ücreti değişir", "Randevu ile"],
    },
    "tailor": {
        "yorumlar": [
            ("Pantolonumu aynı gün içinde tam istediğim gibi daralttı.", "Volkan E."),
            ("Dikiş kalitesi gerçekten iyi, fiyatı da makul.", "Hande K."),
            ("Son dakika işimi yetiştirdiler, çok teşekkürler.", "Murat İ."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–19:00", "Pazar · Kapalı"),
        "fiyatlar": ["₺100'den başlayan", "₺250'den başlayan", "İşe göre fiyat"],
    },
    "furniture": {
        "yorumlar": [
            ("Ölçüye özel yaptırdığımız dolap tam istediğimiz gibi oldu.", "Sema A."),
            ("Eski koltuğumuzu onarıp yeni gibi teslim ettiler.", "Yusuf B."),
            ("Teslimat ve montaj sözlenen günde sorunsuz tamamlandı.", "Nurcan D."),
        ],
        "saatler": ("Pzt–Cmt · 09:00–19:00", "Pazar · Kapalı"),
        "fiyatlar": ["Ölçüye göre teklif", "Tadilat için arayın", "Ücretsiz keşif"],
    },
}

for _kind, _details in _KIND_DETAILS.items():
    KIND_CONTENT[_kind].update(_details)

DEFAULT_CONTENT.update({
    "yorumlar": [
        ("İhtiyacımızı dikkatle dinleyip çözümü zamanında teslim ettiler.", "Ayşe K."),
        ("İletişimleri açık, hizmetleri düzenli ve özenliydi.", "Mehmet A."),
        ("Sorularımıza hızlı dönüş yaptılar; aldığımız hizmetten memnun kaldık.", "Elif D."),
    ],
    "saatler": ("Pzt–Cmt · 09:00–19:00", "Pazar · Kapalı"),
    "fiyatlar": ["₺250'den başlayan", "Teklif alın", "Ücretsiz ön görüşme"],
})


_VOWELS = "aeıioöuü"


def _son_unlu(word: str) -> str:
    return next((c for c in reversed(word.lower()) if c in _VOWELS), "e")


def _semt_de(semt: str) -> str:
    """Bulunma eki, ünlü uyumlu: Maltepe'de, Kadıköy'de, Bağdat'ta."""
    ek = "de" if _son_unlu(semt) in "eiöü" else "da"
    if semt[-1].lower() in "fstkçşhp":
        ek = "t" + ek[1:]
    return f"{semt}'{ek}"


def _semt_nin(semt: str) -> str:
    """İlgi eki, ünlü uyumlu: Maltepe'nin, Kadıköy'ün, Ataşehir'in."""
    unlu = {"e": "i", "i": "i", "ö": "ü", "ü": "ü",
            "a": "ı", "ı": "ı", "o": "u", "u": "u"}[_son_unlu(semt)]
    kaynastirma = "n" if semt[-1].lower() in _VOWELS else ""
    return f"{semt}'{kaynastirma}{unlu}n"


def _slugify(name: str) -> str:
    text = unicodedata.normalize("NFKD", name.lower())
    text = text.replace("ı", "i").replace("ş", "s").replace("ğ", "g") \
               .replace("ç", "c").replace("ö", "o").replace("ü", "u")
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "isletme"


def _site_photos(kind: str, name: str, count: int = 11) -> list[str]:
    """Kategori havuzundan aynı sitede tekrarlanmayan, kararlı bir fotoğraf dizisi."""
    library = json.loads(PHOTOS_JSON.read_text(encoding="utf-8"))
    category = PHOTO_CATEGORY_BY_KIND.get(kind, "genel")
    pool = list(dict.fromkeys(library.get(category, library["genel"])))
    if len(pool) < count:
        # Kütüphane yanlışlıkla küçültülürse sessiz fotoğraf tekrarı üretme.
        raise ValueError(
            f"{category!r} fotoğraf kategorisinde en az {count} benzersiz URL gerekli"
        )
    offset = sum(ord(character) for character in _slugify(name)) % len(pool)
    return (pool[offset:] + pool[:offset])[:count]


def _phone_parts(phone: str) -> tuple[str, str, str]:
    """(görünür, tel: linki, wa.me rakamları) — telefon yoksa boş stringler."""
    digits = re.sub(r"\D", "", phone or "")
    if not digits:
        return "", "", ""
    if digits.startswith("0"):
        digits = "90" + digits[1:]
    elif not digits.startswith("90"):
        digits = "90" + digits
    gorunur = f"+{digits[:2]} {digits[2:5]} {digits[5:8]} {digits[8:10]} {digits[10:]}".strip()
    return gorunur, f"tel:+{digits}", digits


def _ad_kisa(name: str) -> str:
    """Nav markası için kısa ad: ilk anlamlı kelime (çok kısaysa ilk iki)."""
    words = name.split()
    if not words:
        return name
    if len(words[0]) >= 4 or len(words) == 1:
        return words[0]
    return " ".join(words[:2])


def _menu_section_html(fills: dict, n_items: int, is_food: bool) -> str:
    """Her demo sitenin sonuna eklenen QR'la okutulacak menü/fiyat listesi
    bölümü — hizmet kartlarıyla AYNI veriyi (ikon/başlık/fiyat) yeniden
    kullanır, tek şablona bağlı olmadan (tüm stillere otomatik eklenir)."""
    baslik = "📋 Menü" if is_food else "📋 Hizmet & Fiyat Listesi"
    alt = ("Güncel menümüz — telefonunuzdan QR'ı okutup fiyatlara göz atın."
           if is_food else
           "Güncel hizmet ve fiyat listemiz — QR'ı okutup göz atın.")
    satirlar = "".join(
        f'<li class="fh-menu-item"><span class="fh-menu-ikon">{fills[f"H{i}_IKON"]}</span>'
        f'<span class="fh-menu-ad">{fills[f"H{i}_BASLIK"]}</span>'
        f'<span class="fh-menu-fiyat">{fills.get(f"HIZMET_{i}_FIYAT", "")}</span></li>'
        for i in range(1, n_items + 1)
    )
    return (
        '<a class="fh-menu-fab" href="#menu">📋 Menü</a>'
        '<section class="fh-menu" id="menu">'
        "<style>"
        ".fh-menu-fab{position:fixed;z-index:500;top:18px;right:5vw;display:inline-flex;"
        "align-items:center;gap:6px;padding:10px 16px;border-radius:999px;text-decoration:none;"
        "font-weight:800;font-size:13px;background:var(--accent);color:var(--bg,#111);"
        "box-shadow:0 10px 30px rgba(0,0,0,.25)}"
        "@media(max-width:768px){.fh-menu-fab{top:auto;bottom:82px;right:16px;padding:9px 14px;font-size:12px}}"
        ".fh-menu{padding:80px 5vw;max-width:900px;margin:auto}"
        ".fh-menu h2{font-size:clamp(30px,5vw,48px);letter-spacing:-.04em;color:var(--text)}"
        ".fh-menu>p{color:var(--muted);margin:10px 0 30px}"
        ".fh-menu-list{list-style:none;padding:0;margin:0;border:1px solid var(--line);border-radius:20px;overflow:hidden;background:var(--panel)}"
        ".fh-menu-item{display:flex;align-items:center;gap:14px;padding:16px 22px;border-bottom:1px solid var(--line)}"
        ".fh-menu-item:last-child{border-bottom:none}"
        ".fh-menu-ikon{font-size:20px}"
        ".fh-menu-ad{flex:1;font-weight:700;color:var(--text)}"
        ".fh-menu-fiyat{font-weight:900;color:var(--accent)}"
        ".fh-menu-not{margin-top:18px;color:var(--muted);font-size:13px}"
        "</style>"
        f"<h2>{baslik}</h2><p>{alt}</p>"
        f'<ul class="fh-menu-list">{satirlar}</ul>'
        '<p class="fh-menu-not">Fiyatlar bilgilendirme amaçlıdır — güncel liste için bizi arayabilirsiniz.</p>'
        "</section>"
    )


def build_site(hit: dict, semt: str = "Maltepe", stil: str | None = None,
                *, distinct_file: bool = False) -> Path:
    """Bir radar avını şablona doldurur, çıktı dosyasının yolunu döndürür.
    stil None ise DÖNÜŞÜMLÜ seçilir: mevcut demo hangi stildeyse sıradakine
    geçer; on tasarımın tamamı sırayla dolaşılır.
    distinct_file=True ise çıktı `{slug}--{stil}.html` olarak yazılır — aynı
    işletmenin birden çok stili aynı anda (birbirini ezmeden) üretilebilsin
    diye (bkz. build_variants)."""
    content = KIND_CONTENT.get(hit.get("kind", ""), DEFAULT_CONTENT)
    palette = PALETTES[content["palet"]]
    photo_kind = hit.get("category") or hit.get("kind", "")
    photos = _site_photos(photo_kind, hit["name"])
    is_food = PHOTO_CATEGORY_BY_KIND.get(photo_kind, "genel") == "kafe-restoran"

    slug = _slugify(hit["name"])
    default_out_path = OUT_DIR / f"{slug}.html"
    if stil is None:
        stil = STIL_SIRASI[0]
        if default_out_path.exists():
            m = re.search(r"<!--stil:(\w+)-->", default_out_path.read_text(encoding="utf-8")[:200])
            if m and m.group(1) in STIL_SIRASI:
                stil = STIL_SIRASI[(STIL_SIRASI.index(m.group(1)) + 1) % len(STIL_SIRASI)]
    elif stil not in SABLONLAR:
        raise ValueError(
            f"Geçersiz stil: {stil!r}. Geçerli stiller: {', '.join(STIL_SIRASI)}"
        )
    out_path = OUT_DIR / f"{slug}--{stil}.html" if distinct_file else default_out_path

    ad = hit["name"]
    gorunur, tel_link, wa_digits = _phone_parts(hit.get("phone", ""))
    tur = hit.get("kind_tr", "İşletme")
    wa_mesaj = quote(
        f"Merhaba {ad}, {tur.lower()} hizmetlerinizle ilgili bilgi/rezervasyon için yazıyorum.",
        safe="",
    )

    if tel_link:
        tel_btn, wa_btn = "📞 Hemen Ara", (
            f'<a class="btn btn-cizgi" href="https://wa.me/{wa_digits}?text=[[WA_MESAJ]]">💬 WhatsApp</a>'
        )
    else:
        # Telefon kaydı yoksa butonlar iletişim bölümüne yönlenir
        tel_link, tel_btn, wa_btn = "#iletisim", "✉️ Bize Ulaşın", ""
        gorunur = "Telefon numaranızı ekleyelim"

    adres = f"{hit['street']} · {semt}, İstanbul" if hit.get("street") else f"{semt}, İstanbul"
    maps_url = f"https://www.google.com/maps/search/?api=1&query={hit['lat']},{hit['lon']}"

    # İçerik metinlerindeki alanlar — semt ekleri ünlü uyumuyla üretilir
    alanlar = {"ad": ad, "semt": semt,
               "semt_de": _semt_de(semt), "semt_nin": _semt_nin(semt)}

    fills = {
        "AD": ad,
        "AD_KISA": _ad_kisa(ad),
        "TUR": tur,
        "SEMT": semt,
        "TEL_LINK": tel_link,
        "TEL_GORUNUR": gorunur,
        "TEL_BTN": tel_btn,
        "WA_BTN": wa_btn,
        "WA_DIGITS": wa_digits,
        "WA_MESAJ": wa_mesaj,
        "SAAT_HAFTAICI": content["saatler"][0],
        "SAAT_PAZAR": content["saatler"][1],
        "TAGLINE": content["tagline"].format(**alanlar),
        "HIZMET_ALT": content["hizmet_alt"].format(**alanlar),
        "HAKKINDA": content["hakkinda"].format(**alanlar),
        "ADRES": adres,
        "MAPS_URL": maps_url,
        "FOTO_HERO": photos[0],
        "FOTO_HAKKINDA": photos[1],
        "ALT_HAKKINDA": f"{ad} ekibi ve işletme atmosferi",
        **palette,
    }
    for i, (yorum, yorumcu) in enumerate(content["yorumlar"], 1):
        fills[f"YORUM_{i}"] = yorum
        fills[f"YORUM_{i}_AD"] = yorumcu
    for i in range(1, 7):
        fills[f"HIZMET_{i}_FIYAT"] = (
            content["fiyatlar"][i - 1]
            if i <= min(len(content["kartlar"]), len(content["fiyatlar"]))
            else ""
        )
    for i, (ikon, baslik, aciklama) in enumerate(content["kartlar"], 1):
        fills[f"H{i}_IKON"] = ikon
        fills[f"H{i}_BASLIK"] = baslik.format(**alanlar)
        fills[f"H{i}_ACIKLAMA"] = aciklama.format(**alanlar)
        fills[f"H{i}_FOTO"] = photos[i + 1]
        fills[f"H{i}_ALT"] = f"{ad} — {baslik.format(**alanlar)}"
    for i, photo in enumerate(photos[5:], 1):
        service_title = fills[f"H{((i - 1) % 3) + 1}_BASLIK"]
        fills[f"FOTO_GALERI_{i}"] = photo
        fills[f"ALT_GALERI_{i}"] = f"{ad} — {service_title} deneyiminden bir kare"

    html = SABLONLAR[stil].read_text(encoding="utf-8")
    html = html.replace("<!DOCTYPE html>", f"<!DOCTYPE html>\n<!--stil:{stil}-->", 1)
    for key, value in fills.items():
        html = html.replace(f"[[{key}]]", value)

    kalan = re.findall(r"\[\[([A-Z0-9_]+)\]\]", html)
    if kalan:  # şablona yeni yer tutucu eklenirse sessizce bozuk site çıkmasın
        raise ValueError(f"Doldurulmamış yer tutucular ({stil}): {kalan}")

    # <footer'in HEMEN ÖNÜNE enjekte edilir — önceden </body>'den önce (yani
    # footer'IN DE ALTINA) ekleniyordu, normal kaydırmayla asla görünmüyordu;
    # kullanıcı "sitede menü yok" diye fark etti çünkü fiilen görünmüyordu.
    menu_html = _menu_section_html(fills, len(content["kartlar"]), is_food)
    html = html.replace("<footer", menu_html + "<footer", 1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    return out_path


def _load_hits() -> list[dict]:
    if not RADAR_JSON.exists():
        raise FileNotFoundError("Radar verisi yok — önce /radar komutuyla tarama yap.")
    return json.loads(RADAR_JSON.read_text(encoding="utf-8"))["hits"]


def build_from_radar(n: int, semt: str = "Maltepe",
                     stil: str | None = None) -> tuple[Path, dict]:
    """Son radar taramasındaki n. avın (1'den başlar) demo sitesini üretir."""
    hits = _load_hits()
    if not 1 <= n <= len(hits):
        raise IndexError(f"Geçersiz numara: {n} (listede {len(hits)} av var)")
    hit = hits[n - 1]
    # Çoklu bölge taramasında semt, avın bulunduğu bölgeden gelir
    return build_site(hit, semt=hit.get("bolge", semt), stil=stil), hit


def build_variants(hit: dict, semt: str = "Maltepe",
                    styles: list[str] | None = None) -> dict[str, Path]:
    """Aynı işletme için birden çok stili AYNI ANDA üretir — esnafa telefonda
    "hazırladım bile, 5 farklı tasarım var" derken hepsinin dosyası hazır olsun
    diye. Varsayılan: VITRIN_5 (görsel çeşitliliği yüksek 5 stil)."""
    styles = styles or VITRIN_5
    return {stil: build_site(hit, semt=semt, stil=stil, distinct_file=True) for stil in styles}


def build_variants_from_radar(n: int, semt: str = "Maltepe",
                               styles: list[str] | None = None) -> tuple[dict[str, Path], dict]:
    """Son radar taramasındaki n. avın 5 farklı şablon varyantını üretir."""
    hits = _load_hits()
    if not 1 <= n <= len(hits):
        raise IndexError(f"Geçersiz numara: {n} (listede {len(hits)} av var)")
    hit = hits[n - 1]
    return build_variants(hit, semt=hit.get("bolge", semt), styles=styles), hit


def list_hits(top: int = 10) -> str:
    """Numaralı av listesi — /site komutuna numara seçtirmek için."""
    hits = _load_hits()
    lines = [f"📡 Son taramadan {len(hits)} av — demo site için /site <numara>:", ""]
    for i, h in enumerate(hits[:top], 1):
        tel = " · ☎" if h.get("phone") else ""
        lines.append(f"{i}. {h['name']} — {h['kind_tr']} · puan {h['score']}{tel}")
    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        path, hit = build_from_radar(int(sys.argv[1]))
        print(f"✅ {hit['name']} ({hit['kind_tr']}) → {path}")
    else:
        print(list_hits())
