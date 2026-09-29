"""Muhatap süzgeci — aradığında KARAR VERİCİYE ulaşabileceğin işletmeler.

NEDEN
-----
Telefonla satışta en pahalı dakika, çağrı merkezine/resepsiyona anlatılan
dakikadır: karar verici o değil, mesaj iletilmez, ikinci arama olmaz.
Bu modül işletmeyi aramadan ÖNCE "telefonu açan kişi patron olabilir mi"
sorusuna veriyle cevap verir. Ağa çıkmaz; yalnız Overture kaydına bakar.

ÖLÇÜLMÜŞ GERÇEKLER (7.542 kayıtlık 8 bölge havuzu, 24 Ağu 2026)
---------------------------------------------------------------
* 0850/444 numarası: 188 kayıt — kesin çağrı merkezi.
* Aynı telefonu paylaşan farklı isimler: 134 numara / 380 kayıt — neredeyse
  tamamı SEO spam ilanı ("Suadiye gümüş alanlar 0533 …" gibi), işletme değil.
* Aynı ad 3+ kez: 17 isim — zincir (Komşufırın 16, Köfteci Ramiz 5, …).
* Kurumsal ad anahtarı (group / a.ş / avm / şubesi / hastane …): ~80 kayıt.
* Cep numarası oranı türe göre %9 (Türk mutfağı) ile %83 (estetik cerrah)
  arasında değişiyor — cep numarasını çoğunlukla sahibi açar.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict

from services.radar.filtreler import bilinen_zincir_mi, kamu_kurumu_mu

# Bu öneklerle başlayan numaralar kurumsal santral / çağrı merkezidir.
CAGRI_MERKEZI_ONEKLERI = ("850", "444", "800", "888", "900")

# İsimde KELİME olarak geçince "karar merkezde, telefonu açan yetkili değil"
# sayılır (kelime sınırı şart: "grup" evet, "Grupo Latino" hayır). "ltd/şti"
# BİLEREK yok: mahalle esnafının çoğu Ltd. Şti.'dir, telefonu yine patron açar.
_KURUMSAL = re.compile(
    r"\b(a\.ş\.?|a\.s\.|aş\.|holding\w*|grup|group|inşaat\w*|insaat\w*|"
    r"sigorta\w*|tıp merkezi|hastane\w*|bayi\w*|franchise|şubesi|"
    r"genel müdürlü\w*|turkcell|vodafone|türk telekom|banka\w*|finans\w*|"
    r"gayrimenkul yatırım\w*|enerji\w*|lojistik\w*|yetkili servis\w*|"
    r"üniversite\w*|belediye\w*|vak(ıf|f\w+)|derne(k|ği)|kooperatif\w*|"
    r"kolej\w*|avm|rezidans\w*|plaza\w*|call center|çağrı merkezi)\b",
    re.IGNORECASE,
)
# Kurumsal anahtarın istisnası: bunlar tek hekimli/tek sahipli küçük yerler.
KURUMSAL_ISTISNA = ("hayvan hastanesi", "pet hastanesi")

# SEO spam ilanı kalıpları: "X alanlar", "alan yerler", "alım satım" + telefon.
_SPAM_KALIP = re.compile(
    r"\b(alanlar|alan yerler|alınır satılır|alım satım|alim satim|satanlar)\b",
    re.IGNORECASE,
)
_UZUN_RAKAM = re.compile(r"\d[\d\s]{6,}\d")
_AD_GURULTU = re.compile(r"\b(ltd|şti|sti|a\.?ş|ve|the|and|&)\b")


def telefon_turu(telefon: str | None) -> str:
    """'cep' | 'sabit' | 'cagri_merkezi' | 'yok'."""
    rakam = re.sub(r"\D", "", telefon or "")
    if rakam.startswith("90"):
        rakam = rakam[2:]
    if rakam.startswith("0"):
        rakam = rakam[1:]
    if len(rakam) < 10:
        return "yok"
    if rakam.startswith(CAGRI_MERKEZI_ONEKLERI):
        return "cagri_merkezi"
    if rakam.startswith("5"):
        return "cep"
    return "sabit"


def kurumsal_ad_mi(ad: str) -> bool:
    lower = (ad or "").casefold()
    if any(istisna in lower for istisna in KURUMSAL_ISTISNA):
        return False
    return bool(_KURUMSAL.search(lower))


def spam_ad_mi(ad: str) -> bool:
    """Ad bir işletme değil, arama motoru için yazılmış ilan mı."""
    metin = ad or ""
    return bool(_UZUN_RAKAM.search(metin)) or bool(_SPAM_KALIP.search(metin))


def ad_anahtari(ad: str) -> str:
    """Şube/zincir tespiti için sadeleştirilmiş ad."""
    metin = (ad or "").casefold()
    metin = re.sub(r"[^\w\s]", " ", metin)
    metin = _AD_GURULTU.sub(" ", metin)
    return re.sub(r"\s+", " ", metin).strip()


def _telefon_anahtari(telefon: str | None) -> str:
    return re.sub(r"\D", "", telefon or "")


def eleme_sebebi(av: dict, ad_sayisi: Counter, tel_isimleri: dict[str, set]) -> str:
    """Boş dönerse işletme aranabilir; doluysa neden elendiği."""
    ad = av.get("name", "")
    tur = telefon_turu(av.get("phone"))
    if tur == "yok":
        return "telefon_yok"
    if tur == "cagri_merkezi":
        return "cagri_merkezi"
    if spam_ad_mi(ad):
        return "spam_ilan"
    if kamu_kurumu_mu(ad):
        return "kamu"
    if av.get("marka") or bilinen_zincir_mi(ad):
        return "zincir"
    if kurumsal_ad_mi(ad):
        return "kurumsal_ad"
    if ad_sayisi[ad_anahtari(ad)] >= 3:
        return "coklu_sube"
    if len(tel_isimleri.get(_telefon_anahtari(av.get("phone")), ())) >= 2:
        return "ortak_telefon"
    return ""


def havuzu_suz(avlar: list[dict]) -> tuple[list[dict], Counter]:
    """Havuzdan aranamayacakları atar; kalanlara `telefon_turu` ve
    `muhatap_puani` yazar. İkinci dönüş: eleme sebebi sayaçları."""
    ad_sayisi: Counter = Counter(ad_anahtari(av.get("name", "")) for av in avlar)
    tel_isimleri: dict[str, set] = defaultdict(set)
    for av in avlar:
        anahtar = _telefon_anahtari(av.get("phone"))
        if anahtar:
            tel_isimleri[anahtar].add(ad_anahtari(av.get("name", "")))

    kalan: list[dict] = []
    sayac: Counter = Counter()
    for av in avlar:
        sebep = eleme_sebebi(av, ad_sayisi, tel_isimleri)
        if sebep:
            sayac[sebep] += 1
            continue
        kalan.append({
            **av,
            "telefon_turu": telefon_turu(av.get("phone")),
            "muhatap_puani": muhatap_puani(av, ad_sayisi),
        })
    return kalan, sayac


def muhatap_puani(av: dict, ad_sayisi: Counter | None = None) -> float:
    """0-1 arası: telefonu açan kişinin karar verici olma ihtimali (tür
    bağımsız kısım; tür katsayısı katalogdan gelir)."""
    tur = telefon_turu(av.get("phone"))
    puan = {"cep": 1.0, "sabit": 0.75}.get(tur, 0.0)
    if ad_sayisi is not None and ad_sayisi[ad_anahtari(av.get("name", ""))] == 2:
        puan *= 0.8   # iki şube: patron hâlâ başında olabilir, ama emin değiliz
    return round(puan, 2)
