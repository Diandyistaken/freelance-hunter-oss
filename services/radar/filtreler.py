"""Radar eleme filtreleri — hem OSM/Overpass hem Overture tarafı buradan beslenir.

Tek doğruluk kaynağı: "bu işletme butik/bağımsız bir esnaf mı, yoksa zincir
şubesi / kamu kurumu mu" ve "elindeki link gerçek bir web sitesi mi, yoksa
Yemeksepeti/Instagram gibi bir platform sayfası mı".

Bu ayrımlar iki motorda da AYNI olmak zorunda — eskiden `overpass.py` içinde
gömülüydü, radar v2 (Overture) gelince ikinci bir kopya çıkmasın diye buraya
alındı.
"""

from urllib.parse import urlsplit

# ---------------------------------------------------------------- kamu kurumu

# "clinic"/"dentist" etiketi bazen DEVLET kurumuna da takılıyor (ör. Aile
# Sağlığı Merkezi OSM'de amenity=clinic olarak girilmiş) — bunlar kamu
# kurumu, pazarlama sitesi satın almaz; isimden yakalanır.
KAMU_ANAHTAR = (
    "aile sağlığı merkezi", "toplum sağlığı merkezi", "devlet hastanesi",
    "sağlık ocağı", "halk sağlığı", "belediyesi", "kaymakamlığı",
    "müdürlüğü", "verem savaş",
)


def kamu_kurumu_mu(ad: str) -> bool:
    """Devlet/kamu kurumu mu (isimden)."""
    lower = (ad or "").casefold()
    return any(anahtar in lower for anahtar in KAMU_ANAHTAR)


# --------------------------------------------------------------- zincir/şube

# OSM'de "brand" etiketi genelde eksik girilir (özellikle TR şubelerinde) —
# bu yüzden tag'e ek olarak, tanınırlığı yüksek (yanlışlıkla başka bir isme
# denk gelme riski neredeyse sıfır olan) büyük zincirleri isimden de yakalar.
# Kapsamlı bir liste DEĞİL — büyüdükçe elle eklenir.
ZINCIR_ANAHTAR = (
    "beymen", "lc waikiki", "lcw ", "koton", "defacto", "mavi jeans",
    "boyner", "vakko", "colin's", "ipekyol", "kigili", "us polo", "mango",
    "zara", "h&m", "pull&bear", "bershka", "stradivarius", "starbucks",
    "kahve dünyası", "espressolab", "caffè nero", "caffe nero",
    "gloria jean's", "simit sarayı", "mado", "baydöner", "burger king",
    "mcdonald", "kfc", "domino's", "pizza hut", "popeyes", "özsüt",
    "saray muhallebicisi", "divan pastanesi", "petzone", "happy pet",
    # Overture verisinde markası boş gelen ama zincir olan ekler
    "tchibo", "le pain quotidien", "intimissimi", "pandora", "macfit",
    "damat tween", "watsons", "gratis", "flo ", "deichmann", "english home",
    "madame coco", "koçtaş", "teknosa", "vatan bilgisayar", "d&r",
)


def bilinen_zincir_mi(ad: str) -> bool:
    """Marka etiketi eksik girilmiş büyük zincir şubesi mi (isimden)."""
    lower = (ad or "").casefold()
    return any(anahtar in lower for anahtar in ZINCIR_ANAHTAR)


# ------------------------------------------------- platform / vitrin olmayan

# İşletmenin "web sitesi" diye kayıtlı olan adres aslında BAŞKASININ
# platformundaki bir sayfaysa, o işletmenin kendi vitrini YOK demektir.
# Bu bir eleme sebebi değil — TERSİNE, en sıcak lead'lerden biri:
# "Sizi arayan müşteri Yemeksepeti sayfanıza düşüyor, kendi siteniz yok."
PLATFORM_ALAN_ADLARI = (
    "yemeksepeti.com", "getir.com", "trendyol.com", "zomato.com",
    "restaurantguru.com", "tripadvisor.com", "foursquare.com",
    "instagram.com", "facebook.com", "fb.com", "twitter.com", "x.com",
    "youtube.com", "tiktok.com", "linkedin.com", "pinterest.com",
    "linktr.ee", "linkfly.to", "bio.link", "beacons.ai",
    "sahibinden.com", "hepsiemlak.com", "emlakjet.com", "zingat.com",
    "wixsite.com", "blogspot.com", "wordpress.com", "weebly.com",
    "business.site", "sites.google.com", "google.com",
    "dijital.menu", "menulux.com", "qrmenu", "adisyo.com",
    "wa.me", "api.whatsapp.com", "n11.com", "gittigidiyor.com",
    "shopier.com", "ikas.shop", "dokuzsoft", "hesapkurumsal",
    "doktortakvimi.com", "eniyihekim.com", "vetle.com",
    "armut.com", "bionluk.com", "sahibinden",
)


def alan_adi(url: str) -> str:
    """URL'den sade alan adı (şema/www/port/yol atılır). Boşsa "" döner."""
    ham = (url or "").strip()
    if not ham:
        return ""
    if "://" not in ham:
        ham = "http://" + ham
    host = urlsplit(ham).netloc.casefold()
    host = host.split("@")[-1].split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    return host


def site_host(url: str) -> str:
    """URL'nin GERÇEK sunucu adı — `www.` KORUNUR.

    `alan_adi()` kimlik/tekilleştirme için www'yi atar; ama TLS sertifikası ve
    HTTP isteği müşterinin gerçekten gittiği adrese yapılmalı. Sertifika
    yalnız `www.x.com` için geçerliyken `x.com`'a bağlanıp "sertifika geçersiz"
    demek yanlış olurdu.
    """
    ham = (url or "").strip()
    if not ham:
        return ""
    if "://" not in ham:
        ham = "http://" + ham
    host = urlsplit(ham).netloc.casefold()
    return host.split("@")[-1].split(":")[0]


def platform_sitesi_mi(url: str) -> bool:
    """Adres işletmenin kendi sitesi değil, bir platform/sosyal medya sayfası mı."""
    host = alan_adi(url)
    if not host:
        return False
    return any(
        host == p or host.endswith("." + p) or p in host
        for p in PLATFORM_ALAN_ADLARI
    )
