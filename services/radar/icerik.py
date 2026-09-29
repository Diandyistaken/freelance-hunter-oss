"""Mevcut sitenin GERCEK icerigini toplar (nazik, yasal, insan tetiklemeli).

SINIR (audit.py ile ayni felsefe): yalnizca herkese acik sayfalar okunur.
Login yok, gizli yol denemesi yok, zafiyet taramasi yok. Fark: denetim TEK
ana sayfa okur (toplu tarama, saniyede onlarca site); burasi TEK isletme icin
insanin dugmeye bastigi anda calisir, o yuzden ana sayfa + menudeki en fazla
`MAKS_SAYFA` ic sayfayi, aralarinda bekleyerek okur. Bu bir ziyaretcinin
siteyi gezmesiyle ayni yuk; kazima degil.

Toplananlar demo uretiminde kullanilir: gercek metin + gercek fotograflar.
"""

import re
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
MAKS_SAYFA = 6           # ana sayfa dahil
SAYFA_ARASI_SN = 1.5     # nazik hiz
MAKS_FOTO = 15
MAKS_FOTO_BAYT = 3_000_000
ZAMAN_ASIMI = 15

# Ic sayfa secerken oncelik: bu kelimeleri iceren baglantilar once alinir.
ONCELIK = ("hakkimizda", "hakkinda", "about", "kurumsal", "biz-kimiz",
           "hizmet", "urun", "menu", "galeri", "foto", "iletisim", "contact",
           "sube", "fiyat", "tedavi", "hizmetlerimiz")
# Bunlar demoya girmez: blog arsivi, sepet, hesap, dil kopyalari.
ATLA = ("blog", "haber", "sepet", "cart", "login", "giris", "uye", "kvkk",
        "gizlilik", "policy", "sitemap", "?", "#", "javascript:", "mailto:",
        "tel:", ".pdf", ".doc", ".zip", "/en/", "/de/", "/ru/", "/ar/")


def _coz(ham: bytes) -> str:
    """2011 donemi TR siteleri cogunlukla windows-1254/iso-8859-9 kullanir."""
    eslesme = re.search(rb"charset=[\"']?([\w-]+)", ham[:4096], re.I)
    if eslesme:
        try:
            return ham.decode(eslesme.group(1).decode("ascii"), errors="replace")
        except (LookupError, UnicodeDecodeError):
            pass
    try:
        return ham.decode("utf-8")
    except UnicodeDecodeError:
        return ham.decode("cp1254", errors="replace")


def _getir(url: str) -> tuple[str, str] | None:
    """(html, son_url) - basarisizsa None."""
    try:
        istek = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(istek, timeout=ZAMAN_ASIMI) as yanit:  # noqa: S310
            if yanit.status >= 400:
                return None
            return _coz(yanit.read(2_000_000)), yanit.geturl()
    except Exception:
        return None


class _Sayfa(HTMLParser):
    """Tek sayfadan baslik/aciklama/metin/gorsel/baglanti cikarir."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.baslik = ""
        self.aciklama = ""
        self.gorseller: list[str] = []
        self.baglantilar: list[str] = []
        self.metin: list[str] = []
        self._atla = 0
        self._title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style", "noscript", "template"):
            self._atla += 1
        elif tag == "title":
            self._title = True
        elif tag == "meta" and (a.get("name") or "").lower() == "description":
            self.aciklama = (a.get("content") or "").strip()
        elif tag == "img":
            src = a.get("src") or a.get("data-src") or a.get("data-original") or ""
            if src:
                self.gorseller.append(src)
        elif tag == "a" and a.get("href"):
            self.baglantilar.append(a["href"])

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "template") and self._atla:
            self._atla -= 1
        elif tag == "title":
            self._title = False

    def handle_data(self, data):
        if self._title:
            self.baslik += data
        elif not self._atla:
            parca = data.strip()
            if parca:
                self.metin.append(parca)


def _ayni_site(url: str, kok: str) -> bool:
    sunucu = (urlparse(url).netloc or "").lower().removeprefix("www.")
    return sunucu == kok or sunucu.endswith("." + kok)


def _ic_sayfa_sec(baglantilar: list[str], taban: str, kok: str,
                  gorulen: set[str]) -> list[str]:
    """Menuden okunacak ic sayfalar - oncelikli kelimeler once."""
    adaylar: list[tuple[int, str]] = []
    for ham in baglantilar:
        tam = urljoin(taban, ham.strip())
        if not tam.startswith(("http://", "https://")) or not _ayni_site(tam, kok):
            continue
        temiz = tam.split("#")[0].rstrip("/")
        kucuk = temiz.lower()
        if temiz in gorulen or any(x in kucuk for x in ATLA):
            continue
        oncelik = next((i for i, k in enumerate(ONCELIK) if k in kucuk), 99)
        if oncelik == 99 and kucuk.count("/") > 3:
            continue  # derin/parametreli sayfalar demo icin gereksiz
        adaylar.append((oncelik, temiz))
    adaylar.sort()
    secilen: list[str] = []
    for _, url in adaylar:
        if url not in secilen:
            secilen.append(url)
        if len(secilen) >= MAKS_SAYFA - 1:
            break
    return secilen


def _kucult(yol: Path) -> None:
    """Buyuk fotografi web olcusune indirir (en fazla 1600 px, JPEG kalite 82).

    Neden: esnaf sitelerindeki fotograflar cogu zaman 600 KB - 3 MB. Demoyu
    "hizli acilan site" diye satiyoruz; 20 tane 600 KB'lik foto bu iddiayi
    coker. Pillow yoksa dosya oldugu gibi kalir (surec kirilmaz).
    """
    try:
        from PIL import Image  # noqa: PLC0415 - opsiyonel bagimlilik
    except ImportError:
        return
    try:
        with Image.open(yol) as im:
            im.load()
            genislik, yukseklik = im.size
            if max(genislik, yukseklik) <= 1600 and yol.stat().st_size <= 300_000:
                return
            im.thumbnail((1600, 1600), Image.LANCZOS)
            if yol.suffix.lower() in (".jpg", ".jpeg"):
                im.convert("RGB").save(yol, "JPEG", quality=82, optimize=True,
                                       progressive=True)
            elif yol.suffix.lower() == ".png":
                im.save(yol, "PNG", optimize=True)
            else:
                im.save(yol)
    except Exception:
        return  # bozuk/desteklenmeyen dosya: oldugu gibi biraksin


def _foto_indir(urller: list[str], hedef: Path) -> list[dict]:
    """Fotograflari demo klasorune indirir + web olcusune kucultur.

    Neden indiriyoruz: demo Cloudflare'de yayinlaninca musterinin http'li
    sunucusundan gorsel cekmek karma-icerik hatasi verir ve onun sunucusuna
    yuk biner; ayrica site cokse demo yine calisir.
    """
    hedef.mkdir(parents=True, exist_ok=True)
    kayitlar: list[dict] = []
    for sira, url in enumerate(urller[:MAKS_FOTO * 2], 1):
        if len(kayitlar) >= MAKS_FOTO:
            break
        uzanti = Path(urlparse(url).path).suffix.lower()
        if uzanti not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        try:
            istek = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(istek, timeout=ZAMAN_ASIMI) as yanit:  # noqa: S310
                veri = yanit.read(MAKS_FOTO_BAYT + 1)
            if len(veri) > MAKS_FOTO_BAYT or len(veri) < 3000:
                continue  # devasa ya da ikon/piksel
        except Exception:
            continue
        ad = f"foto{sira:02d}{uzanti}"
        dosya = hedef / ad
        dosya.write_bytes(veri)
        _kucult(dosya)
        kayitlar.append({"dosya": ad, "kaynak": url,
                         "bayt": dosya.stat().st_size})
    return kayitlar


def site_icerigi(domain: str, foto_hedef: Path | None = None) -> dict | None:
    """Ana sayfa + en fazla 5 ic sayfa + fotograflar.

    doner: {"baslik", "aciklama", "sayfalar": [{url, baslik, metin}],
            "fotograflar": [{dosya, kaynak}], "metin_toplam"}
    """
    if not domain or "/" in domain or domain.startswith(("http:", "https:")):
        return None
    kok = domain.lower().removeprefix("www.")

    ilk = None
    for aday in (f"https://{kok}/", f"http://{kok}/", f"http://www.{kok}/",
                 f"https://www.{kok}/"):
        ilk = _getir(aday)
        if ilk:
            break
    if not ilk:
        return None

    html, son_url = ilk
    ana = _Sayfa()
    try:
        ana.feed(html)
    except Exception:
        return None

    gorulen = {son_url.split("#")[0].rstrip("/")}
    sayfalar = [{
        "url": son_url,
        "baslik": ana.baslik.strip()[:200],
        "metin": re.sub(r"\s+", " ", " ".join(ana.metin)).strip()[:4000],
    }]
    gorsel_ham = [urljoin(son_url, g) for g in ana.gorseller]

    for ic_url in _ic_sayfa_sec(ana.baglantilar, son_url, kok, gorulen):
        time.sleep(SAYFA_ARASI_SN)
        sonuc = _getir(ic_url)
        if not sonuc:
            continue
        ic_html, ic_son = sonuc
        ic = _Sayfa()
        try:
            ic.feed(ic_html)
        except Exception:
            continue
        metin = re.sub(r"\s+", " ", " ".join(ic.metin)).strip()[:3000]
        if len(metin) < 120:
            continue
        gorulen.add(ic_son.split("#")[0].rstrip("/"))
        sayfalar.append({"url": ic_son, "baslik": ic.baslik.strip()[:200],
                         "metin": metin})
        gorsel_ham += [urljoin(ic_son, g) for g in ic.gorseller]

    # Ayni gorsel birden fazla sayfada olabilir; sirasi korunarak tekillestir.
    benzersiz: list[str] = []
    for g in gorsel_ham:
        if g not in benzersiz and _ayni_site(g, kok):
            benzersiz.append(g)

    fotograflar = _foto_indir(benzersiz, foto_hedef) if foto_hedef else []
    toplam = sum(len(s["metin"]) for s in sayfalar)
    if not toplam and not fotograflar:
        return None
    return {
        "baslik": sayfalar[0]["baslik"],
        "aciklama": ana.aciklama[:300],
        "sayfalar": sayfalar,
        "fotograflar": fotograflar,
        "metin_toplam": toplam,
    }
