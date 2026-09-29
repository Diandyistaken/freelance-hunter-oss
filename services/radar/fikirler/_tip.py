"""Fikir kataloğunun veri tipleri. Katalog dosyaları (yeme_icme.py, guzellik.py …)
yalnız bu tipleri doldurur; mantık `__init__.py` ve `hedefleme.py`'de.

KANCA SORUSU SÖZLEŞMESİ (11 Eyl 2026'da değişti — kullanıcı kararı)
-------------------------------------------------------------------
Soru artık konuşmanın İKİNCİ adımı: açılıştan hemen sonra, ürün anlatılmadan
önce sorulur. Bu yüzden sorunun tek bir işi var: karşı tarafın ŞU ANKİ
yöntemini konuşturmak.

KURAL:
  * "Şu an bunu nasıl yapıyorsunuz?" biçiminde olmalı. Cevabı işletme sahibi
    düşünmeden bilir; yanlış cevap diye bir şey yoktur.
  * Sayı İSTEME. "Geçen hafta kaç kişi gelmedi?" gibi sorular karşı tarafı
    bilmediği bir rakamla köşeye sıkıştırır, savunmaya iter ve çoğu zaman
    "valla bilmiyorum" ile biter (11 Eyl'de kullanıcı bunu işaret etti).
  * Cevabı varsayma. Soru, sorunun VAR olduğunu ima etmemeli; yalnız mevcut
    süreci sormalı.
  * Kısa olmalı — telefonda tek nefeste söylenebilsin.

İyi:  "Son dakika iptal olduğunda boşalan yeri şu an nasıl dolduruyorsunuz?"
Kötü: "Geçen hafta kaç yer 'geliyorum' deyip gelmediği için boş kaldı?"

`soru2` isteğe bağlıdır: ilk soru havada kalırsa sorulacak, aynı konuyu başka
yerden tutan yedek soru.
"""

from __future__ import annotations

from typing import NamedTuple


class Fikir(NamedTuple):
    kod: str            # kısa kimlik — panel/işaretleme/ölçüm için
    ad: str             # ürünün telefonda söylenen adı (teknik terim yok)
    soru: str           # KANCA SORUSU — yukarıdaki sözleşmeye uymak zorunda
    aci: str            # işletmenin yaşadığı durum — abartısız, tek cümle
    yapar: str          # yazılım ne yapar — tek cümle, esnafın anlayacağı dil
    para: str           # neden işine yarar — iddiasız, rakamsız tek cümle
    kurulum: str        # tek seferlik ₺ bandı, "8-12k" (ÖNERİ; offer.md'ye işlenmedi)
    aylik: str          # aylık ₺ bandı, "500-900" (ÖNERİ)
    zorluk: int         # 1 = 1-2 gün · 2 = 3-5 gün · 3 = 1-2 hafta
    demo: bool = False  # bu türün 2 dakikalık telefon demosu bu ürün mü
    soru2: str = ""     # yedek kanca sorusu (ilk soru havada kalırsa)


class Tur(NamedTuple):
    """Bir işletme türünün satış profili. Katsayılar 1.0 = ortalama."""
    grup: str                   # katalog grubu (GRUPLAR anahtarı)
    bilet: float                # 0.6-1.6 — ödeme gücü / tek işin büyüklüğü
    hiz: float                  # 0.6-1.4 — kapanma hızı: patron tek başına
                                # karar verir mi, getiri anında anlaşılır mı
    muhatap: float              # 0.4-1.0 — telefonu açanın patron olma ihtimali
                                # (türe özgü: berberde 1.0, otelde 0.5)
    fikirler: tuple[Fikir, ...] # 3-5 fikir, en güçlüsü ilk sırada
    saha: float = 1.0           # SAHADAN GELEN KANIT. Varsayılan 1.0 = etkisiz.
                                # bilet/hız/muhatap MASA BAŞI tahmindir; bu alan
                                # telefonda yaşananı taşır. Ayrı tutulur ki bir
                                # türün "ödeme gücü düşük" diye yanlış
                                # etiketlenmesi gerekmesin — psikoloğun ödeme
                                # gücü düşük değil, SAHADA reddediyor. Birini
                                # ötekine yazmak, katalogdaki anlamı bozar.


class Grup(NamedTuple):
    ad: str             # panelde görünen grup adı
    sebep: str          # "Ben zaten tam bunun için aradım…" — soru CEVAPLANDIKTAN
                        # sonra söylenir. İddia değil, ne yaptığını anlatan
                        # dürüst tek cümle olmalı (uydurma istatistik yok).
    kapanis: str        # randevu isteme cümlesi — net, baskısız, gün/saatli
    demo_senaryo: str   # 2 dakikalık telefon demosunda ne gösterilir


def F(kod: str, ad: str, soru: str, aci: str, yapar: str, para: str,
      kurulum: str, aylik: str, zorluk: int, demo: bool = False,
      soru2: str = "") -> Fikir:
    """Katalog satırlarını kısa yazmak için."""
    return Fikir(kod, ad, soru, aci, yapar, para, kurulum, aylik, zorluk, demo, soru2)
