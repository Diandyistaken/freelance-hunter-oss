"""Radar v2 - Adim 3: YASAL site denetleyici.

Bir isletmenin HERKESE ACIK web varligini okur ve kanitlanabilir kusurlarini
Turkce raporlar. Cikti: kusur listesi + siddet + tek cumlelik satis kancasi.

=============================  YASAL SINIR  =============================
Bu sinir bir kisit degil, SATIS ARGUMANI: musteriye "sisteminize hic
dokunmadim, herkesin gordugunu okudum" denebiliyor (offer.md S5).

IZIN VERILEN - hepsi herkese acik, normal bir tarayicinin/DNS'in ZATEN
gordugu, hedef basina tek istek:
  * DNS A/AAAA/TXT kaydi (Google'in resmi DNS-over-HTTPS ucu)
  * TLS sertifikasi (baglanti kurulurken sunucunun kendi sundugu sertifika)
  * ANA SAYFA HTML'i (tarayicinin actigi sayfanin aynisi, tek GET)
  * /robots.txt ve /sitemap.xml (varliklari zaten herkese acik ilan edilir)
  * Google PageSpeed Insights - Google'in RESMI, ucretsiz API'si
  * RDAP - alan adi tescil kaydi (IANA/tescilci resmi protokolu, public)

KESINLIKLE YASAK - bu modul bunlari YAPMAZ, sonradan da EKLENMEZ:
  * port taramasi, zafiyet tarayicisi (nmap/nikto/sqlmap/wpscan vb.)
  * herkese acik OLMAYAN yol denemesi (/wp-admin, /admin, dizin brute-force)
  * herhangi bir giris/login denemesi, herhangi bir exploit
  * hedef sitenin coklu-sayfa kazinmasi, Google arama SONUC sayfasi kazima
  * yonetim panelinin/CMS surumunun "zayifligini" arama

  KURAL: "Zayiflik ARAMA, sisteme GIRME; yalnizca herkese acik olani OKU."
  Ek olarak robots.txt'e uyulur: site otomatik erisime kapaliysa ana sayfa
  ISTENMEZ ve o site "denetlenemedi" olarak isaretlenir (kusur uydurulmaz).
=========================================================================

MALIYET: $0. PageSpeed anahtari (PSI_API_KEY) ucretsizdir ve KREDI KARTI
ISTEMEZ; girilmemisse hiz kendi olcumumuzle (yanit suresi + sayfa agirligi)
raporlanir.
"""

import ipaddress
import re
import socket
import ssl
import threading
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import requests

from packages.shared.config import settings
from services.radar.filtreler import alan_adi, platform_sitesi_mi, site_host

# Kimligi acik ama tarayici gibi davranan ajan: neyi olctugumuzu gizlemiyoruz,
# site sahibi loglarda kim oldugumuzu ve nasil ulasacagini goruyor.
UA = "Mozilla/5.0 (compatible; FreelanceHunterAudit/1.0; +mailto:you@example.com)"
DOH = "https://dns.google/resolve"
RDAP = "https://rdap.org/"  # yedek aracı; "domain/<host>" eklenerek kullanılır
PSI = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
MAX_HTML_BYTE = 3 * 1024 * 1024  # 3 MB'tan sonrasini okumayiz
# IANA'nin resmi RDAP yonlendirme tablosu: hangi uzanti hangi tescil
# kurulusunun sunucusunda. rdap.org bir ARACI ve toplu istekte 429 veriyordu;
# dogrudan tescil kurulusuna gitmek hem resmi yol hem cok daha yuksek limitli.
IANA_BOOTSTRAP = "https://data.iana.org/rdap/dns.json"
_RDAP_KAPI = threading.Semaphore(4)
_RDAP_DENEME = 3
# PSI tur sayaci - bkz. _psi_calisabilir()
_PSI_KILIT = threading.Lock()
_psi_sayac = {"adet": 0}
_rdap_harita: dict[str, str] | None = None
_rdap_harita_kilidi = threading.Lock()
# crt.sh tur başına tıkama: ilk başarısız denemede True olur, kalan siteler
# crt.sh'e istek atmaz (24 Ağu 2026'da ölçüldü: crt.sh çoğu ağdan engelli).
_CRT_BOZUK: list[bool] = [False]


def _rdap_sunucusu(host: str) -> str:
    """Alan adinin uzantisina gore resmi RDAP ucu; bulunamazsa rdap.org."""
    global _rdap_harita
    with _rdap_harita_kilidi:
        if _rdap_harita is None:
            _rdap_harita = {}
            try:
                veri = requests.get(IANA_BOOTSTRAP, timeout=20).json()
                for uzantilar, ucler in veri.get("services", []):
                    if not ucler:
                        continue
                    for uzanti in uzantilar:
                        _rdap_harita[uzanti.lower()] = ucler[0].rstrip("/") + "/"
            except Exception as exc:
                print(f"IANA RDAP tablosu alinamadi ({exc}) -> rdap.org")
    parcalar = host.lower().split(".")
    # Once "com.tr" gibi iki seviyeli uzantiyi, sonra "com"u dene
    for i in (2, 1):
        if len(parcalar) > i:
            uc = _rdap_harita.get(".".join(parcalar[-i:]))
            if uc:
                return uc
    return RDAP


@dataclass(frozen=True)
class Kusur:
    """Kanitlanabilir tek bir kusur."""

    kod: str
    baslik: str          # musteriye gosterilebilir Turkce cumle
    siddet: int          # 1-10; 10 = site fiilen calismiyor
    kanit: str           # somut olcum ("7,4 saniye", "sertifika 2023'te bitmis")
    kanca: str = ""      # bu kusur en agiri ise kullanilacak tek cumlelik acilis
    # "Bunu 10 saniyede kendin nasil dogrularsin" — telefonu acmadan ONCE bak.
    # Isletme sahibi de ayni adimi izleyip goremezse, o kusuru SOYLEME.
    dogrula: str = ""


@dataclass
class Denetim:
    """Bir isletmenin site denetim raporu."""

    url: str
    domain: str
    denetlendi: bool = True
    denetlenemedi_sebep: str = ""
    kusurlar: list[Kusur] = field(default_factory=list)
    olcumler: dict = field(default_factory=dict)
    tarih: str = ""

    @property
    def en_agir_siddet(self) -> int:
        return max((k.siddet for k in self.kusurlar), default=0)

    @property
    def kusur_puani(self) -> int:
        """0-100: kusur agirligi.

        Duz toplam DEGIL: bir siteyi satilabilir yapan sey "cok sayida kucuk
        eksik" degil, TEK bir ciddi kusurdur (olu alan adi, mobil uyumsuzluk,
        gecersiz sertifika). Bu yuzden en agir kusur baskin, geri kalanlar
        kucuk katki verir. Aksi halde 5 kozmetik SEO eksigi olan saglam bir
        site, sitesi fiilen calismayan bir isletmeyle ayni puani aliyordu.
        """
        if not self.denetlendi or not self.kusurlar:
            return 0
        en_agir = self.en_agir_siddet
        kalan = sum(k.siddet for k in self.kusurlar) - en_agir
        return min(100, en_agir * 8 + kalan * 2)

    @property
    def kanca(self) -> str:
        """En agir kusurdan uretilen tek cumlelik acilis."""
        if not self.kusurlar:
            return ""
        en_agir = max(self.kusurlar, key=lambda k: k.siddet)
        return en_agir.kanca or en_agir.baslik

    def sozluk(self) -> dict:
        d = asdict(self)
        d["kusur_puani"] = self.kusur_puani
        d["kanca"] = self.kanca
        return d

    @classmethod
    def sozlukten(cls, d: dict) -> "Denetim":
        """Onbellekten (SQLite) okunan raporu geri nesneye cevirir."""
        return cls(
            url=d.get("url", ""), domain=d.get("domain", ""),
            denetlendi=bool(d.get("denetlendi", True)),
            denetlenemedi_sebep=d.get("denetlenemedi_sebep", ""),
            kusurlar=[Kusur(**k) for k in d.get("kusurlar", [])],
            olcumler=d.get("olcumler", {}), tarih=d.get("tarih", ""),
        )


# --------------------------------------------------------------- yardimcilar

def _doh(ad: str, tur: str) -> dict:
    """Google'in resmi DNS-over-HTTPS ucu (anahtarsiz, ucretsiz)."""
    resp = requests.get(DOH, params={"name": ad, "type": tur},
                        timeout=settings.audit_timeout_s)
    resp.raise_for_status()
    return resp.json()


def _cozumleniyor_mu(host: str) -> bool:
    try:
        cevap = _doh(host, "A")
        if cevap.get("Status") == 0 and cevap.get("Answer"):
            return True
        cevap6 = _doh(host, "AAAA")
        return cevap6.get("Status") == 0 and bool(cevap6.get("Answer"))
    except Exception:
        return False


def _diger_varyant(host: str) -> str:
    return host[4:] if host.startswith("www.") else "www." + host


def _dis_hedef_mi(url: str, host: str) -> bool:
    """Hedef gercekten INTERNETTEKI bir isletme sitesi mi.

    Denetlenecek adresler DISARIDAN gelen bir veri setinden (Overture)
    okunuyor. Kayitlardan biri `http://localhost:3005/...` ya da bir ic ag
    adresi olsaydi, motor kendi makinesindeki/ic agdaki servise istek atardi
    (SSRF). Bu bir esnafin sitesini denetlemek degil - onune gecilir.
    """
    if not url.lower().startswith(("http://", "https://")):
        return False
    if not host or "." not in host or host.endswith(".local"):
        return False
    try:
        ip = ipaddress.ip_address(host)          # dogrudan IP verilmisse
    except ValueError:
        return host.casefold() not in ("localhost", "localhost.localdomain")
    return not (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified)


# ------------------------------------------------------------------ kontroller

def _dns_kusurlari(host: str, kusurlar: list[Kusur], olcumler: dict) -> str:
    """Alan adi cozumleniyor mu. CALISAN host'u dondurur; "" = site fiilen yok.

    Kayitli yazilis (or. www) cozumlenmiyor ama diger varyant (apex)
    cozumleniyorsa denetim CALISAN varyantla surer — eskiden burada siddet 8
    ile durup calisan siteyi hic denetlemiyorduk (3 Agu 2026, elitsomine.com.tr:
    www kaydi yok, apex sapasaglam; musteri Google'dan apex'e gidiyordu).
    """
    if _cozumleniyor_mu(host):
        return host
    varyant = _diger_varyant(host)
    if _cozumleniyor_mu(varyant):
        kusurlar.append(Kusur(
            "adres_calismiyor",
            f"Kayıtlı adres ({host}) açılmıyor; site yalnızca {varyant} ile açılıyor",
            5,
            f"DNS: {host} yanıt vermiyor, {varyant} veriyor",
            dogrula=(f"Tarayıcıya {host} yaz: açılmaz. {varyant} yaz: açılır."),
            kanca=(f"Kartvizitinizde/haritada yazan {host} adresi açılmıyor — "
                   f"o linki kullanan müşteri hata görüyor; {varyant} çalışıyor."),
        ))
        olcumler["dns"] = f"{host} yok, {varyant} var"
        return varyant
    kusurlar.append(Kusur(
        "olu_domain",
        "Sitenin alan adı artık çalışmıyor (alan adı düşmüş veya yayından kalkmış)",
        10,
        f"DNS: {host} için A/AAAA kaydı yok (NXDOMAIN)",
            dogrula=(f"Telefonun tarayıcısına {host} yaz — site açılmaz, "
                 f"'sunucu bulunamadı' hatası gelir."),
        kanca=("Sitenizin adresi artık açılmıyor — Google'da veya kartvizitinizde "
               "sizi bulan müşteri boş bir hata sayfasına düşüyor."),
    ))
    olcumler["dns"] = "cozumlenmiyor"
    return ""


def _tls_kusurlari(host: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """Sunucunun kendi sundugu sertifikayi okur (baglanti disinda islem yok)."""
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, 443), timeout=settings.audit_timeout_s) as sk:
            with ctx.wrap_socket(sk, server_hostname=host) as ssk:
                sertifika = ssk.getpeercert()
                # TLS protokol sürümü — eski (1.0/1.1) kurulumlar risklidir;
                # aynı el sıkışmasında gelir, ek istek yok. Python "TLSv1"/
                # "TLSv1.1" döndürür.
                protokol = getattr(ssk, "version", lambda: "")() or ""
                olcumler["tls_protokol"] = protokol
                if protokol in ("TLSv1", "TLSv1.1"):
                    kusurlar.append(Kusur(
                        "tls_eski_protokol",
                        "Sunucu eski ve güvenli olmayan bir şifreleme protokolü kullanıyor",
                        7,
                        f"TLS el sıkışması {protokol} ile kuruldu (güncel standart TLS 1.2/1.3)",
                        dogrula=("ssllabs.com/ssltest adresine sitenizi yazın — "
                                 "'Protocols' bölümünde TLS 1.0/1.1 açık yazar."),
                        kanca=("Sitenizin sunucusu eski bir şifreleme protokolüne izin veriyor "
                               "— bu, on yıllık bir açık kapısı; güncel kurulumda kendiliğinden kapanır."),
                    ))
    except ssl.SSLCertVerificationError as exc:
        # DURUST AYRIM: "eksik zincir" ile "gecersiz sertifika" ayni sey degil.
        # Chrome eksik ara sertifikayi cogu zaman kendisi tamamlar (kullaniciya
        # uyari CIKMAYABILIR) - "musteriniz uyari goruyor" demek yanlis olurdu.
        # Suresi dolmus / adi tutmayan / kendinden imzali sertifikada ise HER
        # tarayici uyari verir.
        zincir_sorunu = exc.verify_code in (2, 20, 21)
        olcumler["tls"] = "zincir_eksik" if zincir_sorunu else "gecersiz"
        if zincir_sorunu:
            kusurlar.append(Kusur(
                "tls_zincir_eksik",
                "Güvenlik sertifikası eksik kurulmuş — bazı tarayıcı ve telefonlarda uyarı çıkıyor",
                6,
                f"TLS: ara sertifika sunulmuyor ({exc.verify_message or exc})",
            dogrula=("Chrome'da görünmeyebilir; ssllabs.com/ssltest ile test et "
                       "('Chain issues: incomplete' yazar)."),
                kanca=("Sertifikanız eksik kurulmuş; Chrome çoğunlukla toparlıyor ama "
                       "bazı telefon ve tarayıcılarda müşteri güvenlik uyarısı görüyor."),
            ))
        else:
            kusurlar.append(Kusur(
                "tls_gecersiz",
                "Güvenlik sertifikası geçersiz — tarayıcı ziyaretçiye uyarı ekranı gösteriyor",
                9,
                f"TLS doğrulama hatası: {exc.verify_message or exc}",
            dogrula=(f"Tarayıcıya https://{host} yaz — kırmızı uyarı ekranı çıkar."),
                kanca=("Sitenize giren müşteri önce 'Bağlantınız gizli değil' uyarısı "
                       "görüyor; çoğu insan orada geri dönüyor."),
            ))
        return
    except Exception as exc:
        kusurlar.append(Kusur(
            "https_yok",
            "Site güvenli bağlantı (HTTPS) sunmuyor",
            8,
            f"443 portunda TLS kurulamadı: {type(exc).__name__}",
            kanca=("Siteniz HTTPS desteklemiyor; Chrome adres çubuğunda "
                   "'Güvenli Değil' yazıyor ve Google sıralamada geri atıyor."),
        ))
        olcumler["tls"] = "yok"
        return

    bitis_ham = sertifika.get("notAfter", "")
    olcumler["tls"] = "gecerli"
    # Sertifika bitisi (elde zaten var): bitmeden once uyarmak,
    # bittikten sonra "uyari cikiyor" demekten cok daha degerli.
    bitis_str = (sertifika or {}).get("notAfter")
    if bitis_str:
        try:
            bitis = datetime.strptime(bitis_str, "%b %d %H:%M:%S %Y %Z")
            kalan = (bitis - datetime.utcnow()).days
            olcumler["sertifika_kalan_gun"] = kalan
            if 0 < kalan <= 21:
                kusurlar.append(Kusur(
                    "sertifika_bitiyor",
                    f"Güvenlik sertifikanız {kalan} gün sonra doluyor",
                    6,
                    f"Sertifika son kullanma: {bitis.date().isoformat()}",
                    dogrula=("Adres çubuğundaki kilide tıklayıp "
                             "sertifika detayına bakın — aynı tarih yazar."),
                    kanca=(f"Güvenlik sertifikanız {kalan} gün sonra doluyor; "
                           f"yenilenmezse siteniz kırmızı uyarı ekranıyla açılır."),
                ))
        except Exception:
            pass
    try:
        bitis = datetime.strptime(bitis_ham, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    except ValueError:
        return
    kalan = (bitis - datetime.now(timezone.utc)).days
    olcumler["tls_kalan_gun"] = kalan
    if kalan < 0:
        kusurlar.append(Kusur(
            "tls_suresi_dolmus", "Güvenlik sertifikasının süresi dolmuş", 9,
            f"Sertifika {bitis:%d.%m.%Y} tarihinde bitmiş",
            dogrula=(f"Tarayıcıya https://{host} yaz — süresi dolmuş sertifika "
                     f"uyarısı çıkar."),
            kanca=("Sitenizin güvenlik sertifikası dolmuş — tarayıcı ziyaretçiyi "
                   "uyarı ekranıyla karşılıyor."),
        ))
    elif kalan < 15:
        kusurlar.append(Kusur(
            "tls_bitmek_uzere", "Güvenlik sertifikası bitmek üzere", 5,
            f"{kalan} gün sonra ({bitis:%d.%m.%Y}) doluyor",
        ))


def _robots(kok: str) -> tuple[RobotFileParser | None, bool, str]:
    """(robots ayristiricisi, robots.txt var mi, ham metin).

    robots.txt otomatik erisimi duzenleyen dosyadir; buna uymak yasal
    zorunluluk degil ama bizim ban-guvenligi kuralimizin geregi.
    Ham metin de dondurulur (icerik analizi icin, ek istek YOK).
    """
    try:
        resp = requests.get(urljoin(kok, "/robots.txt"), headers={"User-Agent": UA},
                            timeout=settings.audit_timeout_s)
        if resp.status_code != 200 or "text" not in resp.headers.get("Content-Type", "text"):
            return None, False, ""
        ayristirici = RobotFileParser()
        ayristirici.parse(resp.text.splitlines())
        return ayristirici, True, resp.text
    except Exception:
        return None, False, ""


def _cekilebilir(robots: RobotFileParser | None, url: str) -> bool:
    """robots.txt bu adrese izin veriyor mu (dosya yoksa evet)."""
    return robots.can_fetch(UA, url) if robots else True


def _sitemap_var_mi(kok: str, robots: RobotFileParser | None) -> bool:
    hedef = urljoin(kok, "/sitemap.xml")
    if not _cekilebilir(robots, hedef):
        return False
    try:
        resp = requests.get(hedef, headers={"User-Agent": UA},
                            timeout=settings.audit_timeout_s)
        return resp.status_code == 200 and "xml" in resp.headers.get("Content-Type", "")
    except Exception:
        return False


def _html_kusurlari(html: str, son_url: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """Ana sayfa HTML'inde mobil/SEO/guncellik sinyalleri."""
    kucuk = html.lower()

    if "name=\"viewport\"" not in kucuk and "name='viewport'" not in kucuk:
        kusurlar.append(Kusur(
            "mobil_uyumsuz",
            "Site mobil için tasarlanmamış (viewport tanımı yok)",
            9,
            "HTML'de <meta name=\"viewport\"> etiketi bulunamadı",
            dogrula=("Siteyi TELEFONDAN aç — yazılar minicik çıkıyor, okumak için "
                   "parmakla büyütmek gerekiyorsa doğru."),
            kanca=("Siteniz telefonda küçücük görünüyor — müşterilerinizin "
                   "büyük çoğunluğu size telefondan bakıyor."),
        ))
    olcumler["viewport"] = "viewport" in kucuk

    baslik = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    baslik_metni = (baslik.group(1).strip() if baslik else "")
    olcumler["title"] = baslik_metni[:120]
    if not baslik_metni:
        kusurlar.append(Kusur(
            "baslik_yok", "Sayfanın Google'da görünen başlığı boş", 7,
            "<title> etiketi yok veya boş",
            kanca="Google'da çıktığınızda başlık yerine boş/anlamsız bir yazı görünüyor.",
        ))

    if not re.search(r"<meta[^>]+name=[\"']description[\"']", html, re.I):
        kusurlar.append(Kusur(
            "aciklama_yok", "Google sonuçlarında çıkacak açıklama metni tanımlanmamış", 5,
            "meta description etiketi yok",
        ))
    if not re.search(r"<h1[\s>]", kucuk):
        kusurlar.append(Kusur(
            "h1_yok", "Sayfada ana başlık (H1) yok — Google konuyu anlayamıyor", 4,
            "HTML'de <h1> etiketi bulunamadı",
        ))
    if "application/ld+json" not in kucuk:
        kusurlar.append(Kusur(
            "yapisal_veri_yok",
            "İşletme bilgisi (adres/telefon/çalışma saati) Google'ın anlayacağı biçimde işaretlenmemiş",
            3,
            "JSON-LD (schema.org) işaretlemesi yok",
        ))

    if son_url.startswith("https://"):
        karisik = re.findall(r"(?:src|href)=[\"']http://[^\"']+", html, re.I)
        # http://schema.org gibi ad-alani adresleri gercek kaynak degildir
        karisik = [k for k in karisik if "schema.org" not in k and "w3.org" not in k]
        if karisik:
            # Modern Chrome pasif karisik icerigi (gorsel vb.) sessizce https'e
            # yukseltiyor ya da engelliyor; "kilit kiriliyor" iddiasi artik cogu
            # durumda ziyaretcinin gozune GORUNMUYOR. Gercek ama kucuk bir
            # bakim kusuru olarak raporlanir, telefonda ana koz yapilmaz.
            kusurlar.append(Kusur(
                "karisik_icerik",
                "Sayfada güvensiz (http) bağlantıyla yüklenen kaynaklar var",
                3,
                f"{len(karisik)} adet http:// kaynak (örnek: {karisik[0][:70]})",
                dogrula=("Sitede sağ tık → İncele → Console; karışık içerik "
                         "uyarısı görünür. Ziyaretçiye genelde GÖRÜNMEZ — "
                         "telefonda ana koz olarak kullanma."),
            ))

    yillar = [int(y) for y in re.findall(r"(?:©|&copy;|copyright)[^0-9]{0,20}(20\d{2})", kucuk)]
    if yillar:
        son_yil = max(yillar)
        olcumler["copyright_yili"] = son_yil
        yas = datetime.now().year - son_yil
        if yas >= 2:
            kusurlar.append(Kusur(
                "eski_icerik", f"Sitenin altında hâlâ {son_yil} yazıyor", min(3 + yas, 7),
                f"Copyright yılı {son_yil} ({yas} yıl önce)",
            dogrula=("Sitenin en altına in — yıl orada yazıyor."),
                kanca=(f"Sitenizin altında hâlâ {son_yil} yazıyor — siteye giren müşteri "
                       f"işletmenin hâlâ açık olup olmadığından emin olamıyor."),
            ))


def _psi_calisabilir(kusurlar: list[Kusur]) -> bool:
    """PSI cagrilsin mi.

    PSI site basina ~23 SANIYE suruyor (olculdu) - taramanin en pahali adimi.
    Iki yerde bilerek atlaniyor:
      1. Anahtar yoksa (kendi olcumumuze duseriz).
      2. Sitede zaten 9+ siddetinde bir kusur varsa (olu domain, 404, mobil
         uyumsuz...) - elde zaten kapanis gucu olan bir kanca var, 23 saniye
         daha harcamanin satisa katkisi yok.
      3. Tur basina tavan dolduysa (PSI_TUR_TAVANI).
    """
    if not settings.psi_api_key:
        return False
    if any(k.siddet >= 9 for k in kusurlar):
        return False
    with _PSI_KILIT:
        if _psi_sayac["adet"] >= settings.psi_tur_tavani:
            return False
        _psi_sayac["adet"] += 1
    return True


def psi_sayaci_sifirla() -> None:
    """Her tarama turunun basinda cagrilir (engine.run_radar_v2)."""
    with _PSI_KILIT:
        _psi_sayac["adet"] = 0
    _CRT_BOZUK[0] = False


def _hiz_kusurlari(url: str, sure_sn: float, boyut_kb: int,
                   kusurlar: list[Kusur], olcumler: dict) -> None:
    """Once Google'in resmi olcumu (anahtar varsa), yoksa kendi olcumumuz."""
    olcumler["yanit_sn"] = round(sure_sn, 2)
    olcumler["sayfa_kb"] = boyut_kb

    psi_skor = (_psi_skoru(url, olcumler, kusurlar)
                if _psi_calisabilir(kusurlar) else None)
    if psi_skor is not None:
        if psi_skor < 50:
            kusurlar.append(Kusur(
                "yavas_google", f"Google mobil hız notu: 100 üzerinden {psi_skor}",
                9 if psi_skor < 30 else 7,
                f"PageSpeed Insights mobil performans skoru {psi_skor}/100"
                + (f", en büyük içerik {olcumler['lcp']} sonra geliyor" if olcumler.get("lcp") else ""),
                kanca=(f"Google sitenize mobil hızda 100 üzerinden {psi_skor} veriyor; "
                       f"açılmasını bekleyen müşteri geri dönüyor."),
            ))
        return

    if sure_sn > 3:
        kusurlar.append(Kusur(
            "yavas", f"Site yavaş açılıyor ({sure_sn:.1f} saniye)",
            8 if sure_sn > 6 else 6,
            f"Ana sayfa {sure_sn:.1f} sn'de yanıt verdi ({boyut_kb} KB)",
            kanca=(f"Sitenizin açılması {sure_sn:.0f} saniye sürüyor — bekleyen "
                   f"ziyaretçilerin bir kısmı o arada sayfayı kapatıyor."),
        ))
    if boyut_kb > 3000:
        kusurlar.append(Kusur(
            "agir_sayfa", f"Ana sayfa çok ağır ({boyut_kb / 1024:.1f} MB)", 5,
            f"Tek sayfa {boyut_kb} KB — mobil veride pahalı",
        ))


def _psi_skoru(url: str, olcumler: dict,
               kusurlar: list[Kusur] | None = None) -> int | None:
    """Google PageSpeed Insights (resmi, ucretsiz, kart istemez).

    AYNI CAGRIDA dort kategori birden istenir: performance + accessibility +
    seo + best-practices. Hedef siteye EK ISTEK YOK, ek sure yok (Lighthouse
    zaten hepsini calistiriyor) ama elimize uc kat kanit geliyor - hepsi
    Google'in kendi olcumu, yani telefonda "benim yorumum degil" diyebildigimiz
    cinsten.

    Ayrica CrUX okunur: laboratuvar olcumu tartisilabilir ama "sizin gercek
    ziyaretcilerinizin %X'i yavas yukleme yasadi" tartisilamaz.
    """
    try:
        resp = requests.get(PSI, params=[
            ("url", url), ("strategy", "mobile"),
            ("category", "performance"), ("category", "accessibility"),
            ("category", "seo"), ("category", "best-practices"),
            ("key", settings.psi_api_key),
        ], timeout=120)
        if resp.status_code != 200:
            olcumler["psi_hata"] = f"HTTP {resp.status_code}"
            return None
        veri = resp.json()
        sonuc = veri["lighthouseResult"]
        lcp = sonuc["audits"].get("largest-contentful-paint", {}).get("displayValue")
        if lcp:
            # Google kirilmaz bosluklu "24,9 s" donuyor - panelde ve kopyalanan
            # mesajda garip gorunmesin diye normal bosluga cevrilir.
            olcumler["lcp"] = lcp.replace(" ", " ")

        def _yuzde(ad: str) -> int | None:
            kat = sonuc.get("categories", {}).get(ad)
            if not kat or kat.get("score") is None:
                return None
            return round(kat["score"] * 100)

        erisim = _yuzde("accessibility")
        seo = _yuzde("seo")
        iyi_uygulama = _yuzde("best-practices")
        for anahtar, deger in (("psi_erisilebilirlik", erisim), ("psi_seo", seo),
                               ("psi_iyi_uygulama", iyi_uygulama)):
            if deger is not None:
                olcumler[anahtar] = deger

        # CrUX: gercek Chrome kullanicilarinin son 28 gunu (yeterli trafik varsa)
        crux = (veri.get("loadingExperience") or {}).get("metrics") or {}
        lcp_dagilim = (crux.get("LARGEST_CONTENTFUL_PAINT_MS") or {}).get("distributions")
        if lcp_dagilim and len(lcp_dagilim) >= 2:
            kotu = round(sum(d.get("proportion", 0) for d in lcp_dagilim[1:]) * 100)
            olcumler["crux_yavas_yuzde"] = kotu
            if kusurlar is not None and kotu >= 40:
                kusurlar.append(Kusur(
                    "gercek_kullanici_yavas",
                    f"Gerçek ziyaretçilerin %{kotu}'i sayfayı yavaş yüklüyor",
                    7,
                    f"Google Chrome kullanıcı raporu (son 28 gün): ziyaretçilerin "
                    f"%{kotu}'inde ana içerik 2,5 saniyeden geç geliyor",
                    dogrula=("pagespeed.web.dev adresine sitenizi yazın — en üstteki "
                             "'Gerçek Kullanıcı Deneyimi' bölümü aynı oranı gösterir."),
                    kanca=(f"Google'ın gerçek ziyaretçi ölçümüne göre sitenize "
                           f"girenlerin %{kotu}'i yavaş açılma yaşıyor — bu tahmin "
                           f"değil, sizin ziyaretçilerinizin verisi."),
                ))

        if kusurlar is not None:
            if erisim is not None and erisim < 70:
                kusurlar.append(Kusur(
                    "erisilebilirlik_dusuk",
                    f"Google erişilebilirlik denetiminden 100 üzerinden {erisim} aldı",
                    4,
                    f"Lighthouse erişilebilirlik: {erisim}/100 (yazı kontrastı, "
                    f"buton etiketi, dokunma hedefi boyutu gibi maddeler)",
                    dogrula=("pagespeed.web.dev'de sitenizi tarayın — "
                             "'Erişilebilirlik' başlığındaki puan budur."),
                ))
            if seo is not None and seo < 80:
                kusurlar.append(Kusur(
                    "psi_seo_dusuk",
                    f"Google'ın kendi SEO denetimi 100 üzerinden {seo} veriyor",
                    5,
                    f"Lighthouse SEO: {seo}/100",
                    dogrula=("pagespeed.web.dev'de sitenizi tarayın — 'SEO' "
                             "başlığındaki puan budur."),
                ))
        return round(sonuc["categories"]["performance"]["score"] * 100)
    except Exception as exc:
        olcumler["psi_hata"] = type(exc).__name__
        return None



# ---- EK KANIT KATMANI (16 Agu 2026) --------------------------------------
# Hepsi ZATEN ALINMIS yanittan okunur: tek ana sayfa GET'inin basliklari/HTML'i,
# yapilmis TLS el sikismasi, cagrilmis RDAP. Hedef sunucuya TEK BIR EK ISTEK
# atilmaz. Yani "daha derin denetim" = daha cok tarama degil, elimizdekini
# daha dikkatli okumak. Yasak listesi (port taramasi, zafiyet tarayici, gizli
# yol, login denemesi, exploit) aynen gecerli.

def _guvenlik_basliklari(yanit, kusurlar: list[Kusur], olcumler: dict) -> None:
    """Yanit basliklarindan koruma eksikleri. Ek istek yok."""
    b = {k.lower(): v for k, v in yanit.headers.items()}
    eksik = []
    if "strict-transport-security" not in b:
        eksik.append("HSTS (tarayiciya 'hep guvenli baglan' talimati)")
    if "x-content-type-options" not in b:
        eksik.append("X-Content-Type-Options")
    if not ({"content-security-policy", "x-frame-options"} & b.keys()):
        eksik.append("cerceveleme korumasi (clickjacking)")
    olcumler["guvenlik_basliklari_eksik"] = len(eksik)
    if len(eksik) >= 2:
        kusurlar.append(Kusur(
            "guvenlik_basliklari_eksik",
            "Tarayıcı koruma ayarları tanımlı değil",
            4,
            "Yanıt başlıklarında eksik: " + ", ".join(eksik),
            dogrula=("securityheaders.com adresine sitenizi yazın — "
                     "aynı eksikleri harf notuyla gösterir."),
        ))

    # HSTS varsa max-age süresine bak (Katman 1): çok kısa süre korumayı
    # etkisiz bırakır. Aynı başlıktan okunur, ek istek yok.
    hsts = b.get("strict-transport-security", "")
    if hsts:
        import re as _re
        m = _re.search(r"max-age\s*=\s*(\d+)", hsts)
        if m and int(m.group(1)) < 86400:  # < 1 gün: neredeyse hiç koruma
            olcumler["hsts_max_age"] = int(m.group(1))
            kusurlar.append(Kusur(
                "hsts_cok_kisa",
                "Güvenli bağlantı talimatı çok kısa süreli tanımlanmış",
                3,
                f"HSTS max-age={m.group(1)} saniye (öneri: en az 15552000 = 180 gün)",
                dogrula=("securityheaders.com'da HSTS satırındaki süreye bakın."),
            ))

    # CSP zayıf içeriyorsa (unsafe-inline / unsafe-eval) koruma büyük ölçüde
    # etkisizdir; XSS'e karşı ana siper kaybolur. Aynı başlık, ek istek yok.
    csp = b.get("content-security-policy", "")
    if csp:
        zayif = []
        if "unsafe-inline" in csp.lower():
            zayif.append("inline kod çalıştırmaya izin var (unsafe-inline)")
        if "unsafe-eval" in csp.lower():
            zayif.append("dinamik kod çalıştırmaya izin var (unsafe-eval)")
        olcumler["csp_zayif"] = len(zayif)
        if zayif:
            kusurlar.append(Kusur(
                "csp_zayif",
                "Sitenin kod güvenliği kuralı gevşek tanımlanmış",
                4,
                "Content-Security-Policy içinde: " + ", ".join(zayif),
                dogrula=("securityheaders.com'da Content-Security-Policy "
                         "satırına bakın — aynı ifadeler yazar."),
            ))

    # Oturum cerezi bayraklari: giris/randevu formu olan sitelerde onemli.
    cerezler = yanit.headers.get("set-cookie", "")
    if cerezler:
        cerez_kucuk = cerezler.lower()
        k = {
            "httponly": "HttpOnly" in cerez_kucuk,
            "secure": "secure" in cerez_kucuk,
            "samesite": "samesite" in cerez_kucuk,
        }
        olcumler["cerez_secure"] = k["secure"]
        olcumler["cerez_samesite"] = k["samesite"]
        if "httponly" not in cerez_kucuk:
            kusurlar.append(Kusur(
                "cerez_korumasiz",
                "Site çerezleri tarayıcı korumasına kapalı işaretlenmiş",
                3,
                "Set-Cookie başlığında HttpOnly bayrağı yok",
            ))
        if not k["secure"]:
            kusurlar.append(Kusur(
                "cerez_secure_yok",
                "Oturum çerezleri yalnızca güvenli bağlantıda gönderilecek şekilde işaretlenmemiş",
                4,
                "Set-Cookie başlığında Secure bayrağı yok",
                dogrula=("Sitede giriş/randevu varsa tarayıcıda Çerezler'e bakın."),
            ))
        if not k["samesite"]:
            kusurlar.append(Kusur(
                "cerez_samesite_yok",
                "Oturum çerezleri çapraz site isteklerine karşı işaretlenmemiş",
                3,
                "Set-Cookie başlığında SameSite kuralı yok",
            ))


# Yazilim parmak izi: sayfanin KENDI yayinladigi bilgi (meta generator, dosya
# adindaki surum). Zafiyet TARAMASI degil - "surum X yayinlanmis" olgusu.
# Bilinen acik iddiasinda BULUNMUYORUZ; yalnizca "guncel degil" diyoruz.
_SURUM_DESENLERI = (
    (re.compile(r'name=["\']generator["\'][^>]*content=["\']([^"\']+)', re.I), "generator"),
    (re.compile(r"/wp-includes/js/jquery/jquery(?:\.min)?\.js\?ver=([\d.]+)", re.I), "jquery"),
)


def _yazilim_surumu(html: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    for desen, ad in _SURUM_DESENLERI:
        eslesme = desen.search(html)
        if not eslesme:
            continue
        deger = eslesme.group(1).strip()[:60]
        olcumler[f"surum_{ad}"] = deger
        if ad == "generator" and "wordpress" in deger.lower():
            ana = re.search(r"(\d+)\.(\d+)", deger)
            # WordPress 6.4 ve oncesi 2023'ten eski surumler.
            if ana and (int(ana.group(1)), int(ana.group(2))) < (6, 5):
                kusurlar.append(Kusur(
                    "eski_yazilim",
                    f"Site altyapısı eski sürümde kalmış ({deger})",
                    6,
                    f"Sayfa kendi kaynağında sürümünü yayınlıyor: {deger}",
                    dogrula=("Sitenizin kaynağında (sağ tık → Sayfa kaynağını "
                             "görüntüle) 'generator' satırında bu sürüm yazıyor."),
                    kanca=(f"Sitenizin altyapısı {deger} sürümünde kalmış ve bunu "
                           f"herkese açık şekilde yayınlıyor — güncellenmeyen "
                           f"kurulumlar zamanla riskli hale geliyor."),
                ))


def _sosyal_onizleme(html: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """WhatsApp/Instagram'da link paylasilinca gorsel cikiyor mu."""
    og_gorsel = re.search(r'property=["\']og:image["\']', html, re.I)
    olcumler["og_gorsel"] = bool(og_gorsel)
    if not og_gorsel:
        kusurlar.append(Kusur(
            "sosyal_onizleme_yok",
            "WhatsApp'ta link paylaşınca görsel/önizleme çıkmıyor",
            5,
            "HTML'de og:image etiketi bulunamadı",
            dogrula=("Sitenizin adresini kendinize WhatsApp'tan gönderin — "
                     "altında görselli kutu çıkmıyorsa doğru."),
            kanca=("Sitenizin linkini WhatsApp'ta paylaştığınızda çıplak bir "
                   "adres görünüyor; görselli önizleme çıkmıyor."),
        ))


def _kvkk_metni(html: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """KVKK aydinlatma / gizlilik metni linki var mi (TR'de yasal yukumluluk)."""
    var = re.search(r"kvkk|ayd[ıi]nlatma|gizlilik|privacy", html, re.I) is not None
    olcumler["kvkk_metni"] = var
    if not var:
        kusurlar.append(Kusur(
            "kvkk_metni_yok",
            "Sitede KVKK / gizlilik metni görünmüyor",
            4,
            "Ana sayfada 'KVKK', 'aydınlatma metni' veya 'gizlilik' bağlantısı yok",
            dogrula=("Sitenizin en altına bakın — 'Gizlilik' ya da 'KVKK "
                     "Aydınlatma Metni' bağlantısı var mı?"),
            kanca=("Sitenizde KVKK aydınlatma metni görünmüyor; iletişim/randevu "
                   "formuyla kişisel veri topluyorsanız bu yazılı olmak zorunda."),
        ))


def _olcum_araci(html: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """Ziyaretci olcumu kurulu mu (GA4 / GTM / benzeri)."""
    var = re.search(r"googletagmanager\.com|gtag\(|google-analytics\.com|"
                    r"plausible\.io|matomo", html, re.I) is not None
    olcumler["olcum_araci"] = var
    if not var:
        kusurlar.append(Kusur(
            "olcum_araci_yok",
            "Siteye kaç kişi geldiği hiç ölçülmüyor",
            3,
            "Sayfada ziyaretçi ölçüm kodu (Google Analytics vb.) yok",
            dogrula=("Sitenizi yapan kişiye sorun: 'Analytics kurulu mu, "
                     "aylık kaç ziyaretçi geliyor?' — cevap yoksa kurulu değildir."),
        ))

# ---- KATMAN 1-3 DERİN DENETİM (24 Ağu 2026) ------------------------------
# Katman 1: SIFIR ek istek — zaten alınan yanıtın içini daha dikkatli okuruz.
# Katman 2: TEK nazik istek — herkese açık, standart kaynaklar (müşteri gibi).
# Katman 3: Arşiv/sertifika kayıtları (web.archive.org / crt.sh) — hedefe istek
#           YOK; üçüncü taraf kamu kaydına nazik istek. Hepsi legal sınır içinde
#           (docs/denetim-sinirlari.md); port taraması/exploit/yol brute-force
#           değil, yasak listesi aynen geçerli.

# robots.txt İÇERİK analizi (Katman 1, ek istek yok): dosya, yönetim ve yedek
# dizinleri herkese ifşa ediyor olabilir. Bunlar "gizli yol" DEĞİL — site sahibi
# kendisi kamuya ilan ediyor; biz sadece okuyoruz.
_ROBOTS_IFSA_DESENLERI = (
    (r"/wp-admin", "WordPress yönetim paneli"),
    (r"/admin", "yönetim alanı"),
    (r"\.bak|\.old|\.sql|\.zip|\.tar", "yedek dosyası"),
    (r"/backup|/yedek", "yedek klasörü"),
    (r"/(?:\w+-)?config\.", "yapılandırma dosyası"),
)


def _robots_icerik(robots_metin: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """robots.txt'in içinde hassas yol ifşası var mı. Ek istek yok."""
    if not robots_metin:
        return
    kucuk = robots_metin.lower()
    bulunan = []
    for desen, etiket in _ROBOTS_IFSA_DESENLERI:
        if re.search(desen, kucuk):
            bulunan.append(etiket)
    olcumler["robots_ifsa"] = len(bulunan)
    if bulunan:
        # Şiddet düşük: çoğu robots.txt yönetim yolunu barındırır ve tek başına
        # bir zafiyet DEĞİLDİR; "bilgi ifşası" başlığıyla küçük bir not olur.
        kusurlar.append(Kusur(
            "robots_ifsa",
            "Site haritası dosyanız hassas bölümlerinizi herkese listeliyor",
            3,
            "robots.txt içinde görünür: " + ", ".join(dict.fromkeys(bulunan)),
            dogrula=("Tarayıcıya sitenizin adresi + /robots.txt yazın — "
                     "aynı yollar görünür."),
        ))


def _eposta_ifsa(html: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """Ana sayfada açık e-posta adresi var mı (Katman 1, ek istek yok).
    Açık adres = spam + oltalama hedefi; obfuscate edilmemişse kötü niyetli
    tarayıcıların otomatik topladığı ilk şeydir."""
    adresler = set(
        m.group(0).rstrip(".")
        for m in re.finditer(
            r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", html)
        if not m.group(0).lower().startswith(("src=", "href=", "id="))
    )
    adresler.discard("")
    olcumler["eposta_ifsa"] = sorted(adresler)[:5]
    if adresler:
        # Şiddet düşük-orta: çoğu esnaf sitesi e-postasını açık yazar; ama
        # giriş/randevu işi yapan için gerçek bir spam hedefidir.
        kusurlar.append(Kusur(
            "eposta_acik",
            "Sitede korumasız e-posta adresi açıkça yazıyor",
            3,
            "Ana sayfada: " + ", ".join(sorted(adresler)[:3]),
            dogrula=("Sitenizin en altına/iletişim bölümüne bakın — "
                     "adres düz metin olarak yazıyor."),
        ))


def _wp_tema_eklenti(html: str, olcumler: dict) -> None:
    """WordPress tema/eklenti varlığı (Katman 2'nin parmak izi kısmı).
    CVE iddiası YOK; yalnızca hangi bileşenlerin kurulu olduğunu sayarız.
    Sürüm kısmı _yazilim_surumu'ndaki eski-çekirdek mantığıyla genişler."""
    tema = re.search(r"/wp-content/themes/([^/\"']+)", html, re.I)
    eklentiler = set(re.findall(r"/wp-content/plugins/([^/\"'?]+)", html, re.I))
    if tema:
        olcumler["wp_tema"] = tema.group(1)[:60]
    if eklentiler:
        olcumler["wp_eklenti_sayisi"] = len(eklentiler)
        olcumler["wp_eklentiler"] = sorted(eklentiler)[:8]


def _wp_kullanici_ifsa(host: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """WordPress /wp-json/wp/v2/users — kullanıcı adı ifşası (Katman 2).
    Bu, WordPress'in HERKESE AÇIK REST API'sidir; "gizli yol" denemesi değil.
    Yalnız WP sinyali görülünce (tema/generator) tek nazik GET atılır.
    Kullanıcı adı + yönetici = kaba kuvvet saldırısının ilk adımı.
    """
    if not settings.audit_wp_ekstra:
        return
    if not (olcumler.get("wp_tema") or "wordpress" in olcumler.get("surum_generator", "")):
        return
    try:
        resp = requests.get(f"https://{host}/wp-json/wp/v2/users",
                            headers={"User-Agent": UA},
                            timeout=settings.audit_timeout_s)
    except Exception as exc:
        olcumler["wp_users_hata"] = type(exc).__name__
        return
    if resp.status_code != 200:
        olcumler["wp_users"] = f"HTTP {resp.status_code}"
        return
    try:
        kullanicilar = resp.json()
    except Exception:
        return
    if not isinstance(kullanicilar, list) or not kullanicilar:
        olcumler["wp_users"] = "bos"
        return
    adlar = [u.get("slug") or u.get("name") for u in kullanicilar
             if isinstance(u, dict)]
    olcumler["wp_kullanici_ifsa"] = adlar[:5]
    rol = "yönetici" if any("admin" in (str(a)).lower() for a in adlar) else "kullanıcı"
    kusurlar.append(Kusur(
        "wp_kullanici_ifsa",
        "Site yönetici kullanıcı adları herkese açık şekilde görünüyor",
        6,
        "WordPress API'si şu kullanıcıları listeliyor: " + ", ".join(
            f"@{a}" for a in adlar[:4]),
        dogrula=(f"Tarayıcıya {host}/wp-json/wp/v2/users yazın — "
                 f"aynı adlar JSON olarak gelir."),
        kanca=(f"Sitenizin yönetici kullanıcı adları ({rol}) herkese açık — "
               f"isteyen biri bununla otomatik şifre deneyebilir."),
    ))


def _wp_dizin_listeleme(host: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """WordPress /wp-content/uploads/ dizin listelemesi (Katman 2).
    Standart, herkese açık bir klasör; tek nazik GET. Listelemeye açıksa
    içindeki dosyalar (belki faturalar, müşteri görselleri) görünür."""
    if not settings.audit_wp_ekstra:
        return
    if not (olcumler.get("wp_tema") or "wordpress" in olcumler.get("surum_generator", "")):
        return
    hedef = f"https://{host}/wp-content/uploads/"
    try:
        resp = requests.get(hedef, headers={"User-Agent": UA},
                            timeout=settings.audit_timeout_s)
    except Exception as exc:
        olcumler["wp_uploads_hata"] = type(exc).__name__
        return
    if resp.status_code != 200:
        olcumler["wp_uploads"] = f"HTTP {resp.status_code}"
        return
    # Dizin listeleme = HTML'de "Index of" / "Parent Directory" ya da ilk
    # klasör tarihli yapı (uploads/2024/06). 200 dönmesi yetmez; içerik sayılır.
    metin = resp.text
    listede = ("index of" in metin.lower()) or ("parent directory" in metin.lower()) \
        or bool(re.search(r"/\d{4}/\d{2}/", metin))
    olcumler["wp_uploads_listeleme"] = listede
    if listede:
        kusurlar.append(Kusur(
            "wp_dizin_listeleme",
            "Site dosya klasörü herkese açık şekilde listeleniyor",
            5,
            f"{hedef} adresindeki dosyalar tarayıcıdan görülebiliyor",
            dogrula=(f"Tarayıcıya {hedef} yazın — klasörün içeriği listelenir."),
            kanca=(f"Sitenizin dosya klasörü herkese açık listeleniyor — "
                   f"yüklediğiniz belgeler ve görseller oradan görülebilir."),
        ))


def _arsiv_karsilastirma(domain: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """web.archive.org — site ne zamandır değişmemiş (Katman 3).
    HEDEFE istek YOK; kamu arşivine 2 nazik istek. "Siteniz 4 yıldır neredeyse
    hiç değişmemiş" kanıtı üretir — kapanış kozu, güçlü ve tartışılamaz.
    """
    if not settings.audit_arsiv:
        return
    # En eski ve en yeni arşiv anlık görüntüsünü tek çağrıda iste
    cdnx = f"https://archive.org/wayback/available?url={domain}"
    try:
        r1 = requests.get(cdnx, headers={"User-Agent": UA},
                          timeout=settings.audit_timeout_s).json()
    except Exception as exc:
        olcumler["arsiv_hata"] = type(exc).__name__
        return
    en_eski_ts = (r1.get("archived_snapshots") or {}).get("closest", {}).get("timestamp")
    if not en_eski_ts:
        olcumler["arsiv_yok"] = True
        return
    # İki zaman damgası karşılaştırması için CDX API: en eski ve en yeni kayıt
    cdx = ("https://web.archive.org/cdx/search/cdx?url="
           f"{domain}&output=json&fl=timestamp,statuscode&collapse=digest"
           "&limit=2&filter=statuscode:200")
    try:
        satirlar = requests.get(cdx, headers={"User-Agent": UA},
                                timeout=settings.audit_timeout_s).json()
    except Exception as exc:
        olcumler["arsiv_hata"] = type(exc).__name__
        return
    if not isinstance(satirlar, list) or len(satirlar) < 2:
        return
    en_eski = satirlar[1][0][:8]      # YYYYMMDD
    try:
        yil = int(en_eski[:4])
    except (ValueError, TypeError):
        return
    yas = max(0, datetime.now().year - yil)
    olcumler["arsiv_ilk_yil"] = yil
    if yas >= 2:
        kusurlar.append(Kusur(
            "arsiv_degismemis",
            f"Sitenizin görünümü {yas} yıldır neredeyse hiç değişmemiş",
            6 if yas >= 4 else 4,
            f"İlk arşiv kaydı {en_eski[:4]}-{en_eski[4:6]} — {yas} yıl önce",
            dogrula=("web.archive.org/web/" + domain + " adresine girin — "
                     "geçmişe gidince aynı sayfa çıkar."),
            kanca=(f"Sitenizin en son ne zaman ciddi biçimde yenilendiği arşivde "
                   f"{yas} yıl önce görünüyor — müşteri vitrini terk edilmiş "
                   f"sanıyor."),
        ))


def _crt_alt_alan(domain: str, olcumler: dict) -> None:
    """crt.sh — sertifika şeffaflık kayıtları (Katman 3, VARSAYILAN KAPALI).
    Tüm alt alan adlarını listeler = saldırı yüzeyi haritası. Sistem dokümanı
    bunu reddeder; yalnız AUDIT_CRT=1 ise çalışır. Satışa doğrudan katkısı
    yoktur, bilgi amaçlıdır; bu yüzden kusur üretmez, ölçüme yazar.

    crt.sh çoğu ağdan yavaş/engelli olduğu için (ölçüldü, 24 Ağu 2026)
    TIKAMA uygulanır: turda bir kez başarısız olursa `_CRT_BOZUK=True` olur ve
    kalan denetimler crt.sh'e hiç istek atmaz — tarama hızı bozulmaz.
    """
    if not settings.audit_crt:
        return
    if _CRT_BOZUK[0]:
        olcumler["crt"] = "atlandi (turluk tikanma)"
        return
    try:
        resp = requests.get(
            "https://crt.sh/?q=%25." + domain + "&output=json",
            headers={"User-Agent": UA}, timeout=8)
    except Exception as exc:
        _CRT_BOZUK[0] = True
        olcumler["crt_hata"] = type(exc).__name__
        olcumler["crt"] = "atlandi (turluk tikanma)"
        return
    if resp.status_code != 200:
        _CRT_BOZUK[0] = True
        olcumler["crt"] = f"HTTP {resp.status_code} — atlandi (turluk tikanma)"
        return
    try:
        kayitlar = resp.json()
    except Exception:
        _CRT_BOZUK[0] = True
        olcumler["crt_hata"] = "json_hatasi"
        olcumler["crt"] = "atlandi (turluk tikanma)"
        return
    if not isinstance(kayitlar, list):
        return
    altlar = set()
    for k in kayitlar:
        for ad in (k.get("name_value") or "").split("\n"):
            ad = ad.strip().lower()
            if ad.endswith("." + domain):
                altlar.add(ad)
    if altlar:
        olcumler["crt_alt_alan"] = sorted(altlar)[:12]
        olcumler["crt_alt_alan_sayisi"] = len(altlar)


def _eposta_kusurlari(host: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """SPF/DMARC - public DNS kaydi. Yoksa isletme adina sahte mail atilabilir."""
    try:
        txt = _doh(host, "TXT")
        spf = any("v=spf1" in c.get("data", "") for c in txt.get("Answer", []))
        dmarc_cevap = _doh("_dmarc." + host, "TXT")
        dmarc = any("v=DMARC1" in c.get("data", "") for c in dmarc_cevap.get("Answer", []))
    except Exception:
        return
    olcumler["spf"], olcumler["dmarc"] = spf, dmarc
    if not dmarc and not spf:
        # Hicbir koruma yok - sahtecilik iddiasi burada gercekten dogru.
        kusurlar.append(Kusur(
            "eposta_korumasiz",
            "Alan adınız adına sahte e-posta gönderilmesine karşı hiçbir koruma yok",
            7,
            f"DNS: {host} için ne SPF ne DMARC kaydı var",
            dogrula=(f"mxtoolbox.com/dmarc.aspx adresine {host} yaz — "
                   f"'no DMARC record found' der."),
            kanca=(f"Şu an isteyen herkes {host} adınıza görünen sahte e-posta "
                   f"atabilir — alan adınızda hiçbir koruma kaydı yok."),
        ))
    elif not dmarc:
        # SPF var ama DMARC yok: sahtecilik kismen zorlasir, tamamen engellenmez.
        # Abartmiyoruz (offer.md S6: korku satma, yardim et).
        kusurlar.append(Kusur(
            "dmarc_yok",
            "E-posta koruması yarım: gönderim izni tanımlı ama DMARC kuralı yok",
            4,
            f"DNS: {host} SPF var, _dmarc.{host} TXT kaydı yok",
        ))
    elif not spf:
        kusurlar.append(Kusur(
            "spf_yok", "E-posta gönderim izni tanımlı değil (SPF kaydı yok)", 4,
            f"DNS: {host} TXT kaydında v=spf1 yok",
        ))



def _saldiri_filtresi(yanit, kusurlar: list[Kusur], olcumler: dict) -> None:
    """Onunde CDN/WAF (saldiri filtresi) var mi — yanit basliklarindan okunur.

    "Yurtdisindan gelen saldirilari onleyen sistemleri var mi?" sorusunun
    YASAL ve kesin cevabi bu: Cloudflare/Sucuri/Akamai gibi katmanlar kendi
    imzalarini yanit basligina koyar. Saldiri TEST ETMIYORUZ (o suc olurdu);
    yalnizca "koruma katmani var mi yok mu" diye bakiyoruz.
    """
    b = {k.lower(): (v or "").lower() for k, v in yanit.headers.items()}
    imzalar = {
        "Cloudflare": "cf-ray" in b or "cloudflare" in b.get("server", ""),
        "Sucuri": "x-sucuri-id" in b,
        "Akamai": "akamai" in b.get("server", "") or "x-akamai-transformed" in b,
        "Imperva": "x-iinfo" in b,
        "Fastly": "fastly" in b.get("server", "") or "x-served-by" in b,
        "AWS CloudFront": "cloudfront" in b.get("via", "") or "x-amz-cf-id" in b,
    }
    bulunan = [ad for ad, var in imzalar.items() if var]
    olcumler["saldiri_filtresi"] = bulunan[0] if bulunan else ""
    if bulunan:
        return
    kusurlar.append(Kusur(
        "saldiri_filtresi_yok",
        "Sitenin önünde saldırı/bot filtresi görünmüyor",
        5,
        "Yanıt başlıklarında CDN/WAF imzası yok (Cloudflare, Sucuri, Akamai vb.)",
        dogrula=("Sitenizi yapan kişiye sorun: 'Cloudflare veya benzeri bir "
                 "koruma katmanımız var mı?' — yoksa cevabı 'hayır' olur."),
        kanca=("Sitenizin önünde yurt dışından gelen otomatik saldırıları ve "
               "bot trafiğini süzen bir filtre görünmüyor; istekler doğrudan "
               "sunucunuza geliyor."),
    ))


def _mail_ulasabilirligi(host: str, kusurlar: list[Kusur], olcumler: dict) -> None:
    """Gonderilen mail spam'e duser mi — DNS kayitlarindan risk okumasi.

    Kesin "spam'e dusuyor" DEMIYORUZ (bunu ancak alici tarafta olcebiliriz);
    "spam'e dusme riski yuksek" diyoruz ve gerekcesini gosteriyoruz. Uc kayit
    birlikte calisir: MX (posta kutusu var mi), SPF (kim gonderebilir),
    DMARC (uymayan mail'e ne yapilsin).
    """
    try:
        mx = _doh(host, "MX")
        mx_var = bool(mx.get("Answer"))
    except Exception:
        return
    olcumler["mx"] = mx_var
    if not mx_var:
        return  # alan adinda posta kutusu yok; mail konusu bu isletmede yok

    spf = olcumler.get("spf")
    dmarc = olcumler.get("dmarc")
    if spf is None or dmarc is None:
        return  # _eposta_kusurlari calismamis

    # DMARC politikasi: p=none "izliyorum ama engellemiyorum" demek.
    politika = ""
    try:
        cevap = _doh("_dmarc." + host, "TXT")
        for kayit in cevap.get("Answer", []):
            veri = kayit.get("data", "")
            if "v=DMARC1" in veri:
                for parca in veri.replace('"', "").split(";"):
                    if parca.strip().startswith("p="):
                        politika = parca.strip()[2:]
    except Exception:
        pass
    if politika:
        olcumler["dmarc_politika"] = politika

    if not spf:
        kusurlar.append(Kusur(
            "mail_spam_riski",
            "Gönderdiğiniz e-postalar karşı tarafta spam'e düşebilir",
            6,
            f"DNS: {host} için posta kutusu (MX) var ama SPF kaydı yok — "
            f"alıcı sunucular gönderimi doğrulayamıyor",
            dogrula=("mxtoolbox.com/spf.aspx adresine alan adınızı yazın — "
                     "'No SPF record found' derse doğrudur."),
            kanca=("Alan adınızdan gönderdiğiniz mailler alıcının spam "
                   "klasörüne düşmeye açık: hangi sunucunun sizin adınıza "
                   "mail atabileceği tanımlı değil."),
        ))
    elif politika == "none":
        kusurlar.append(Kusur(
            "dmarc_pasif",
            "E-posta koruma kuralınız 'sadece izle' modunda",
            3,
            f"DNS: _dmarc.{host} politikası p=none — sahte mail engellenmiyor",
            dogrula=("mxtoolbox.com/dmarc.aspx'e alan adınızı yazın; "
                     "kayıtta 'p=none' göreceksiniz."),
        ))

def _domain_yasi(host: str, olcumler: dict,
                 kusurlar: list[Kusur] | None = None) -> None:
    """RDAP: tescil tarihi - 'koklu isletme' sinyali (Eksen A'da kullanilir).

    RDAP tek tek cagrildiginda sorunsuz, toplu taramada hiz sinirina takiliyor
    (60 sitelik turda yalnizca 10 tanesi donuyordu) - bu da "20 yillik koklu
    isletme" sinyalini sessizce kaybettiriyordu. Cozum: es zamanli RDAP
    istegini 2 ile sinirla ve gecici hatalarda yeniden dene. Hem daha nazik
    hem daha isabetli.
    """
    uc = _rdap_sunucusu(host) + "domain/" + host
    for deneme in range(_RDAP_DENEME):
        with _RDAP_KAPI:
            try:
                resp = requests.get(uc, timeout=settings.audit_timeout_s,
                                    headers={"User-Agent": UA})
            except Exception as exc:
                olcumler["rdap_hata"] = type(exc).__name__
                resp = None
        if resp is None or resp.status_code in (429, 500, 502, 503, 504):
            if deneme + 1 < _RDAP_DENEME:
                time.sleep(1.5 * (deneme + 1))
                continue
            if resp is not None:
                olcumler["rdap_hata"] = f"HTTP {resp.status_code}"
            return
        if resp.status_code != 200:
            return  # 404 = alan adi tescilli degil (dusmus) - hata degil, bilgi
        try:
            olaylar = {o.get("eventAction"): o.get("eventDate")
                       for o in resp.json().get("events", [])}
            kayit = olaylar.get("registration")
            if not kayit:
                return
            tescil = datetime.fromisoformat(kayit.replace("Z", "+00:00"))
            olcumler.pop("rdap_hata", None)
            olcumler["domain_tescil"] = tescil.date().isoformat()
            olcumler["domain_yasi_yil"] = round(
                (datetime.now(timezone.utc) - tescil).days / 365.25, 1)
            # Ayni cevaptaki bitis tarihi (ek istek yok): alan adinin suresi
            # dolarsa site VE kurumsal e-posta bir anda kararir. Somut ve
            # tarihli oldugu icin telefonda en kolay anlatilan kusurdur.
            bitis_ham = olaylar.get("expiration")
            if bitis_ham:
                bitis = datetime.fromisoformat(bitis_ham.replace("Z", "+00:00"))
                kalan = (bitis - datetime.now(timezone.utc)).days
                olcumler["domain_bitis"] = bitis.date().isoformat()
                olcumler["domain_kalan_gun"] = kalan
                if kusurlar is not None and 0 < kalan <= 60:
                    kusurlar.append(Kusur(
                        "domain_suresi_bitiyor",
                        f"Alan adınızın süresi {kalan} gün sonra doluyor "
                        f"({bitis.date().isoformat()})",
                        8,
                        f"Tescil kaydı (RDAP): son kullanma {bitis.date().isoformat()}",
                        dogrula=("Alan adını aldığınız firmanın panelinde aynı "
                                 "tarih yazar."),
                        kanca=(f"Alan adınızın süresi {kalan} gün sonra doluyor — "
                               f"yenilenmezse hem siteniz hem o adresteki "
                               f"e-postalarınız bir anda kapanır."),
                    ))
        except Exception as exc:
            olcumler["rdap_hata"] = type(exc).__name__
        return


# ------------------------------------------------------------------ ana giris

def denetle(url: str) -> Denetim:
    """Tek bir isletmenin sitesini denetler. Hicbir zaman istisna firlatmaz."""
    domain = alan_adi(url)
    rapor = Denetim(url=url, domain=domain,
                    tarih=datetime.now().isoformat(timespec="seconds"))
    if not domain:
        rapor.denetlendi = False
        rapor.denetlenemedi_sebep = "Adres okunamadı"
        return rapor

    if platform_sitesi_mi(url):
        # Kendi sitesi yok; elindeki tek adres baskasinin platformu.
        rapor.kusurlar.append(Kusur(
            "kendi_sitesi_yok",
            f"İşletmenin kendi web sitesi yok — tek adresi {domain} üzerinde bir sayfa",
            9,
            f"Kayıtlı tek adres bir platform sayfası: {url[:90]}",
            kanca=(f"Sizi arayan müşteri {domain} sayfanıza düşüyor; orası sizin "
                   f"vitriniz değil, kurallarını başkasının koyduğu bir platform."),
        ))
        rapor.olcumler["platform_sayfasi"] = True
        return rapor

    # host = musterinin gittigi adres (www dahil); domain = apex (SPF/DMARC/RDAP
    # apex uzerinde tutulur). Sertifika ve HTTP testi HOST uzerinden yapilir.
    host = site_host(url) or domain
    if not _dis_hedef_mi(url if "://" in url else f"http://{url}", host):
        rapor.denetlendi = False
        rapor.denetlenemedi_sebep = "Adres bir internet sitesi değil (yerel/iç ağ adresi)"
        return rapor
    # Alan adi yasi DNS'ten ONCE alinir: sitesi dusmus ama alan adi 15 yillik
    # bir isletme "koklu ama vitrini kaybolmus" demektir - Eksen A'nin en
    # degerli sinyali tam da bu lead'lerde kaybolmasin.
    _domain_yasi(domain, rapor.olcumler, rapor.kusurlar)
    calisan_host = _dns_kusurlari(host, rapor.kusurlar, rapor.olcumler)
    if not calisan_host:
        return rapor  # site fiilen ayakta degil; devami anlamsiz
    if calisan_host != host:
        # Kayitli yazilis olu, varyant calisiyor — denetim varyantla surer;
        # orijinal URL kirik host'u isaret ettigi icin kullanilmaz.
        host = calisan_host
        url = ""
        rapor.olcumler["denetlenen_varyant"] = host

    kok = f"https://{host}/"
    robots, robots_var, robots_metin = _robots(kok)
    rapor.olcumler["robots"] = robots_var
    if not _cekilebilir(robots, kok):
        rapor.denetlendi = False
        rapor.denetlenemedi_sebep = "robots.txt otomatik erişime kapalı (saygı gösterildi)"
        return rapor

    _eposta_kusurlari(domain, rapor.kusurlar, rapor.olcumler)

    # --- TLS + ana sayfa: once kayitli host; o KIRIK gorunuyorsa diger varyant
    # (www <-> apex) denenir. Sebep (3 Agu 2026, endustriyelim.com): kayitli
    # www adresinde sertifika uyusmazligi + HTTP 409 vardi ama musteri
    # Google'dan apex'e gidip SAGLAM site goruyordu. "Siteniz acilmiyor" demek
    # bizi yalanci cikarir; dogru tespit "adresin bir yazilisi bozuk"tur ve
    # denetimin geri kalani CALISAN varyant uzerinden yapilir.
    tls_kusur: list[Kusur] = []
    tls_olcum: dict = {}
    _tls_kusurlari(host, tls_kusur, tls_olcum)
    yanit, hata = _anasayfa(url, host)

    bot_korumasi = yanit is not None and yanit.status_code in (401, 403, 429)
    tls_kirik = any(k.siddet >= 8 for k in tls_kusur)
    sayfa_kirik = yanit is None or (yanit.status_code >= 400 and not bot_korumasi)
    if tls_kirik or sayfa_kirik:
        varyant = _diger_varyant(host)
        if _cozumleniyor_mu(varyant):
            v_kusur: list[Kusur] = []
            v_olcum: dict = {}
            _tls_kusurlari(varyant, v_kusur, v_olcum)
            v_yanit, _v_hata = _anasayfa("", varyant)
            v_saglam = (not any(k.siddet >= 8 for k in v_kusur)
                        and v_yanit is not None and v_yanit.status_code < 400)
            if v_saglam:
                eski_sorun = (f"HTTP {yanit.status_code}" if yanit is not None
                              else (hata or "erişilemedi"))
                if tls_kirik:
                    eski_sorun += " + sertifika bu ada uymuyor"
                rapor.kusurlar.append(Kusur(
                    "adres_calismiyor",
                    f"Adresin {host} yazılışı düzgün çalışmıyor; "
                    f"site {varyant} ile açılıyor",
                    5,
                    f"{host}: {eski_sorun} · {varyant}: "
                    f"HTTP {v_yanit.status_code}, sertifika geçerli",
                    dogrula=(f"Tarayıcıya https://{host} yaz — açılmaz/uyarı "
                             f"verir; https://{varyant} yaz — sorunsuz açılır."),
                    kanca=(f"Adresinizin {host} yazılışı bozuk — o linke tıklayan "
                           f"müşteri siteye ulaşamıyor; {varyant} ise çalışıyor."),
                ))
                host = varyant
                tls_kusur, tls_olcum = v_kusur, v_olcum
                yanit, hata = v_yanit, ""
                kok = f"https://{host}/"
                rapor.olcumler["denetlenen_varyant"] = host
                robots, robots_var, robots_metin = _robots(kok)
                rapor.olcumler["robots"] = robots_var
                if not _cekilebilir(robots, kok):
                    rapor.denetlendi = bool(rapor.kusurlar)
                    rapor.denetlenemedi_sebep = (
                        "Çalışan varyantın robots.txt'i otomatik erişime kapalı")
                    return rapor

    rapor.kusurlar.extend(tls_kusur)
    rapor.olcumler.update(tls_olcum)

    if yanit is None:
        rapor.denetlendi = bool(rapor.kusurlar)
        rapor.denetlenemedi_sebep = f"Ana sayfa okunamadı: {hata}"
        return rapor

    son_url = yanit.url
    rapor.olcumler["son_url"] = son_url
    if son_url.startswith("http://"):
        # DURUST AYRIM (2 Ağu 2026'da sahada yakalandı):
        # "http'den https'e yonlendirme yok" ile "sitede HTTPS YOK" ayni sey
        # DEGIL. Modern Chrome adres cubuguna yazilan adresi kendisi https'e
        # yukseltiyor; sertifika saglamsa kullanici KILIDI GORUYOR. Boyle bir
        # siteye "Chrome sizi Guvenli Degil diye isaretliyor" demek yanlis olur
        # ve isletme sahibi kendi sitesine bakip bizi yalanci sanir.
        # Bu yuzden: sertifika saglamsa kusur KUCUK bir yapilandirma eksigi;
        # sertifika yok/gecersizse gercekten uyari cikar (o zaten _tls_kusurlari
        # tarafindan yuksek siddetle raporlaniyor).
        tls_saglam = rapor.olcumler.get("tls") == "gecerli"
        if tls_saglam:
            rapor.kusurlar.append(Kusur(
                "https_yonlendirme_eksik",
                "http:// adresi https'e yönlendirilmiyor (küçük yapılandırma eksiği)",
                3,
                f"İstek {son_url} olarak http:// kaldı; sertifika geçerli, "
                f"https ayrıca çalışıyor",
                dogrula=(f"Tarayıcıya http://{rapor.domain} yaz — adres çubuğu "
                         f"http'de kalıyorsa doğru. NOT: Chrome çoğu zaman "
                         f"kendisi https'e çeviriyor, o yüzden kilidi görürsün; "
                         f"bu kusur ziyaretçiye görünmez, telefonda ANA KOZ OLARAK "
                         f"KULLANMA."),
            ))
        else:
            rapor.kusurlar.append(Kusur(
                "https_yonlendirme_yok",
                "Site güvenli adrese (HTTPS) yönlendirmiyor",
                8,
                f"İstek {son_url} olarak http:// kaldı (sertifika da sağlam değil)",
                kanca=("Chrome sitenizi 'Güvenli Değil' diye işaretliyor — ziyaretçi "
                       "form doldurmaktan çekiniyor, Google da sıralamada geri atıyor."),
                dogrula=(f"Tarayıcıya {rapor.domain} yaz — adres çubuğunda "
                         f"'Güvenli Değil' yazısını görürsün."),
            ))
    if yanit.status_code in (401, 403, 429):
        # BOT KORUMASI, kusur DEGIL. Cloudflare/WAF gibi katmanlar tarayici
        # disi istemciye 403 doner ama gercek ziyaretci sayfayi sorunsuz gorur.
        # Buna "siteniz acilmiyor" demek yanlis olurdu -> denetlenemedi sayilir.
        rapor.denetlendi = bool(rapor.kusurlar)
        rapor.denetlenemedi_sebep = (
            f"Site otomatik erişime kapalı (HTTP {yanit.status_code}) — "
            "gerçek ziyaretçi için çalışıyor olabilir, elle bakılmalı"
        )
        return rapor
    if yanit.status_code >= 400:
        rapor.kusurlar.append(Kusur(
            "sayfa_hatasi", f"Ana sayfa hata döndürüyor (HTTP {yanit.status_code})", 9,
            f"GET {son_url} -> {yanit.status_code}",
            dogrula=(f"Tarayıcıya {son_url} yaz — hata sayfası gelir."),
            kanca=f"Sitenizin ana sayfası açılmıyor, sunucu {yanit.status_code} hatası döndürüyor.",
        ))
        return rapor

    html = yanit.text
    boyut_kb = round(len(yanit.content) / 1024)
    _html_kusurlari(html, son_url, rapor.kusurlar, rapor.olcumler)
    # EK KANIT KATMANI — hepsi ELDEKI yanittan okunur, ek istek yok.
    _guvenlik_basliklari(yanit, rapor.kusurlar, rapor.olcumler)
    _yazilim_surumu(html, rapor.kusurlar, rapor.olcumler)
    _wp_tema_eklenti(html, rapor.olcumler)
    _eposta_ifsa(html, rapor.kusurlar, rapor.olcumler)
    _robots_icerik(robots_metin, rapor.kusurlar, rapor.olcumler)
    _sosyal_onizleme(html, rapor.kusurlar, rapor.olcumler)
    _kvkk_metni(html, rapor.kusurlar, rapor.olcumler)
    _olcum_araci(html, rapor.kusurlar, rapor.olcumler)
    _saldiri_filtresi(yanit, rapor.kusurlar, rapor.olcumler)
    # KATMAN 2-3 — nazik tek istek / kamu kaydı; WP sinyaline bağlı + anahtarlı.
    _wp_kullanici_ifsa(host, rapor.kusurlar, rapor.olcumler)
    _wp_dizin_listeleme(host, rapor.kusurlar, rapor.olcumler)
    _arsiv_karsilastirma(domain, rapor.kusurlar, rapor.olcumler)
    _crt_alt_alan(domain, rapor.olcumler)
    _mail_ulasabilirligi(domain, rapor.kusurlar, rapor.olcumler)
    _hiz_kusurlari(son_url, yanit.elapsed.total_seconds(), boyut_kb,
                   rapor.kusurlar, rapor.olcumler)

    if not _sitemap_var_mi(kok, robots):
        rapor.kusurlar.append(Kusur(
            "sitemap_yok", "Google'a sayfa listesi sunulmuyor (sitemap.xml yok)", 3,
            "/sitemap.xml bulunamadı",
        ))
    rapor.olcumler["kusur_sayisi"] = len(rapor.kusurlar)
    return rapor


def _anasayfa(url: str, host: str) -> tuple[requests.Response | None, str]:
    """Ana sayfayi TEK GET ile ceker (tarayicinin yaptiginin aynisi)."""
    hedef = url if url.startswith(("http://", "https://")) else f"https://{host}/"
    try:
        yanit = requests.get(hedef, headers={"User-Agent": UA},
                             timeout=settings.audit_timeout_s, allow_redirects=True)
        if len(yanit.content) > MAX_HTML_BYTE:
            return None, "sayfa cok buyuk"
        return yanit, ""
    except requests.exceptions.SSLError:
        # Sertifika bozuk - kusur zaten TLS kontrolunde yakalandi; sayfayi
        # dogrulamayi kapatarak TEKRAR denemiyoruz (guvenlik kurali).
        return None, "TLS dogrulanamadi"
    except Exception as exc:
        return None, type(exc).__name__


def denetle_toplu(urller: list[str]) -> dict[str, Denetim]:
    """Birden fazla siteyi paralel denetler (her alan adina sirali istek)."""
    from concurrent.futures import ThreadPoolExecutor  # noqa: PLC0415

    benzersiz = list(dict.fromkeys(u for u in urller if u))
    with ThreadPoolExecutor(max_workers=max(1, settings.audit_paralel)) as havuz:
        sonuclar = list(havuz.map(denetle, benzersiz))
    return dict(zip(benzersiz, sonuclar, strict=True))
