"""Herkese açık ilan kaynakları — ban-güvenli kanal #4.

NEDEN VAR: 27 Tem 2026 denetiminde Hunter'ın pratikte TEK kaynaklı olduğu görüldü
(296 ilanın 296'sı Freelancer). Upwork/Bionluk hiç ilan getirmemişti. Bu adaptör,
hesap gerektirmeyen ve platformların KENDİ yayınladığı açık uçlardan besleme yapar.

MUTLAK KURAL: scraping YOK. Buradaki her uç ya resmi JSON API'dir ya da sitenin
kendi yayınladığı RSS'tir; hiçbiri giriş/oturum istemez, hiçbiri HTML kazımaz.
Her kaynak 27 Tem 2026'da gerçek HTTP çağrısıyla doğrulanmıştır.

Kapalı/elenmiş kaynaklar ve sebepleri:
  · Fiverr      → herkese açık ilan panosu yok (Briefs yalnız push ile gelir)
  · Armut       → teklif vermek ücretli (kullanıcı kararı: girilmeyecek)
  · Upwork RSS  → HTTP 410 Gone, kalıcı kapalı (kanal: Saved Search e-postası)
  · PeoplePerHour/Guru/Contra → feed yok; kanal e-posta uyarısı (Gmail adaptörü)
"""

from __future__ import annotations

import html
import os
import re
from datetime import datetime, timedelta, timezone

import requests

UA = "FreelanceHunter/1.0 (kisisel is arama araci; +https://example.com)"
ZAMAN_ASIMI = 25

# Yalnız son bu kadar saat içinde yayımlanmış ilanlar alınır (bayat ilana teklif
# vermek anlamsız; pipeline'daki 72 saatlik kuyruk temizliğiyle uyumlu).
TAZE_SAAT = 48


def _get(url: str, params: dict | None = None) -> requests.Response:
    resp = requests.get(url, params=params, timeout=ZAMAN_ASIMI,
                        headers={"User-Agent": UA, "Accept": "application/json, application/xml, text/xml, */*"})
    resp.raise_for_status()
    return resp


def _temiz(metin: str | None, sinir: int = 4000) -> str:
    """HTML etiketlerini söker; scorer'a düz metin gider (token tasarrufu)."""
    if not metin:
        return ""
    duz = re.sub(r"<[^>]+>", " ", str(metin))
    duz = html.unescape(duz)
    return re.sub(r"\s+", " ", duz).strip()[:sinir]


def _taze_mi(zaman: datetime | None) -> bool:
    if zaman is None:
        return True  # tarih yoksa elemeyi kuyruk temizliğine bırak
    if zaman.tzinfo is None:
        zaman = zaman.replace(tzinfo=timezone.utc)
    return zaman >= datetime.now(timezone.utc) - timedelta(hours=TAZE_SAAT)


def _alert(kaynak_id: str, platform: str, gonderen: str, baslik: str, govde: str,
           url: str, ulke: str | None = None, butce_tur: str | None = None,
           butce_usd: float | None = None) -> dict:
    """pipeline'ın beklediği alert sözlüğü (gmail_alerts ile birebir aynı şekil)."""
    return {
        "id": kaynak_id,
        "platform": platform,
        "sender": gonderen,
        "subject": baslik or "(başlıksız ilan)",
        "body": f"{govde}\n\nİlan linki: {url}"[:6000],
        "url": url,
        "customer_country": ulke,
        "budget_type": butce_tur,
        "budget_usd": butce_usd,
    }


# --------------------------------------------------------------------------
# 1) Arbeitnow — job_types[] alanında açıkça "Freelance"/"Contract" var.
#    En yüksek isabet: iş tipini gerçekten filtreleyebildiğimiz tek büyük kaynak.
# --------------------------------------------------------------------------
def arbeitnow() -> list[dict]:
    veri = _get("https://www.arbeitnow.com/api/job-board-api", {"page": 1}).json()
    istenen = {"freelance", "contract", "contractor"}
    alerts = []
    for i in veri.get("data", []):
        tipler = {str(t).strip().casefold() for t in (i.get("job_types") or [])}
        if not (tipler & istenen):
            continue
        zaman = None
        if i.get("created_at"):
            try:
                zaman = datetime.fromtimestamp(int(i["created_at"]), tz=timezone.utc)
            except (TypeError, ValueError, OSError):
                zaman = None
        if not _taze_mi(zaman):
            continue
        url = i.get("url") or f"https://www.arbeitnow.com/view/{i.get('slug', '')}"
        alerts.append(_alert(
            f"arbeitnow:{i.get('slug') or i.get('url')}", "Arbeitnow", "feed@arbeitnow.com",
            f"{i.get('title', '')} — {i.get('company_name', '')}".strip(" —"),
            _temiz(i.get("description")), url,
        ))
    return alerts


# --------------------------------------------------------------------------
# 2) Braintrust — auth'suz resmi API, yüksek bütçeli AI/Python işleri.
# --------------------------------------------------------------------------
def braintrust(aramalar: tuple[str, ...] = ("python", "automation", "next.js", "ai")) -> list[dict]:
    alerts, gorulen = [], set()
    for arama in aramalar:
        try:
            veri = _get("https://app.usebraintrust.com/api/jobs/",
                        {"page": 1, "search": arama, "ordering": "-created"}).json()
        except requests.RequestException:
            continue
        for i in veri.get("results", []):
            kimlik = str(i.get("id"))
            if kimlik in gorulen:
                continue
            gorulen.add(kimlik)
            isveren = (i.get("employer") or {}).get("name", "")
            url = (i.get("employer") or {}).get("full_link") or f"https://app.usebraintrust.com/jobs/{kimlik}/"
            ust = i.get("budget_maximum_usd")
            try:
                ust = float(ust) if ust is not None else None
            except (TypeError, ValueError):
                ust = None
            alerts.append(_alert(
                f"braintrust:{kimlik}", "Braintrust", "jobs@usebraintrust.com",
                f"{i.get('title', '')} — {isveren}".strip(" —"),
                _temiz(i.get("description") or i.get("introduction")), url,
                butce_tur="fixed" if ust else None, butce_usd=ust,
            ))
    return alerts


# --------------------------------------------------------------------------
# 3) We Work Remotely — sitenin kendi yayınladığı kategori RSS'leri.
# --------------------------------------------------------------------------
WWR_KATEGORI = (
    "remote-programming-jobs",
    "remote-full-stack-programming-jobs",
    "remote-back-end-programming-jobs",
)


def weworkremotely() -> list[dict]:
    import feedparser

    alerts = []
    for kategori in WWR_KATEGORI:
        try:
            resp = _get(f"https://weworkremotely.com/categories/{kategori}.rss")
        except requests.RequestException:
            continue
        for e in feedparser.parse(resp.content).entries:
            zaman = None
            if getattr(e, "published_parsed", None):
                zaman = datetime(*e.published_parsed[:6], tzinfo=timezone.utc)
            if not _taze_mi(zaman):
                continue
            alerts.append(_alert(
                f"wwr:{getattr(e, 'id', e.link)}", "WeWorkRemotely", "feed@weworkremotely.com",
                _temiz(getattr(e, "title", ""), 200), _temiz(getattr(e, "summary", "")), e.link,
            ))
    return alerts


# --------------------------------------------------------------------------
# 4) RemoteOK — resmi public JSON API.
#    NOT: ToS geri link ister; portföy sitesine RemoteOK atfı eklenmeli.
# --------------------------------------------------------------------------
def remoteok() -> list[dict]:
    veri = _get("https://remoteok.com/api").json()
    ilgili = {"python", "javascript", "react", "next", "nextjs", "ai", "ml",
              "automation", "bot", "scraping", "api", "full stack", "fullstack",
              "frontend", "backend", "node", "typescript", "web dev"}
    alerts = []
    for i in veri:
        if not isinstance(i, dict) or not i.get("id") or not i.get("position"):
            continue  # dizinin ilk elemanı ilan değil, ToS/legal objesi
        etiketler = {str(t).casefold() for t in (i.get("tags") or [])}
        if not (etiketler & ilgili):
            continue
        zaman = None
        if i.get("epoch"):
            try:
                zaman = datetime.fromtimestamp(int(i["epoch"]), tz=timezone.utc)
            except (TypeError, ValueError, OSError):
                zaman = None
        if not _taze_mi(zaman):
            continue
        maas = i.get("salary_min")
        try:
            maas = float(maas) if maas else None
        except (TypeError, ValueError):
            maas = None
        alerts.append(_alert(
            f"remoteok:{i['id']}", "RemoteOK", "api@remoteok.com",
            f"{i.get('position', '')} — {i.get('company', '')}".strip(" —"),
            _temiz(i.get("description")), i.get("url") or f"https://remoteok.com/l/{i['id']}",
            butce_tur="fixed" if maas else None, butce_usd=maas,
        ))
    return alerts


# --------------------------------------------------------------------------
# 5) Google Alerts — kullanıcının kendi anahtar kelime feed'leri.
#    Ban riski sıfır, tam kontrol. .env'de GOOGLE_ALERT_FEEDS=url1,url2,...
#    Kurulum: google.com/alerts → sorgu → Deliver to: RSS feed → feed URL'sini kopyala.
# --------------------------------------------------------------------------
def google_alerts() -> list[dict]:
    import feedparser

    ham = os.getenv("GOOGLE_ALERT_FEEDS", "")
    feedler = [u.strip() for u in ham.split(",") if u.strip().startswith("http")]
    alerts = []
    for feed in feedler:
        try:
            resp = _get(feed)
        except requests.RequestException:
            continue
        for e in feedparser.parse(resp.content).entries:
            zaman = None
            if getattr(e, "published_parsed", None):
                zaman = datetime(*e.published_parsed[:6], tzinfo=timezone.utc)
            if not _taze_mi(zaman):
                continue
            # Google Alerts linkleri yönlendirme sarmalıdır: gerçek adresi çıkar
            link = getattr(e, "link", "")
            if "url=" in link:
                link = re.sub(r"^.*?[?&]url=([^&]+).*$", r"\1", link)
                link = requests.utils.unquote(link)
            alerts.append(_alert(
                f"galert:{getattr(e, 'id', link)}", "Google Alerts", "googlealerts-noreply@google.com",
                _temiz(getattr(e, "title", ""), 200), _temiz(getattr(e, "summary", "")), link,
            ))
    return alerts


KAYNAKLAR = {
    "arbeitnow": arbeitnow,
    "braintrust": braintrust,
    "weworkremotely": weworkremotely,
    "remoteok": remoteok,
    "google_alerts": google_alerts,
}

# .env'de PUBLIC_FEEDS=arbeitnow,braintrust,... ile daraltılabilir.
VARSAYILAN_ACIK = ("arbeitnow", "braintrust", "weworkremotely", "google_alerts")


def fetch_all() -> list[dict]:
    """Açık kaynakları sırayla dener; biri patlarsa diğerleri devam eder."""
    ham = os.getenv("PUBLIC_FEEDS", "")
    secili = [s.strip() for s in ham.split(",") if s.strip()] or list(VARSAYILAN_ACIK)

    alerts: list[dict] = []
    for ad in secili:
        fn = KAYNAKLAR.get(ad)
        if fn is None:
            continue
        try:
            bulunan = fn()
            alerts.extend(bulunan)
            print(f"  {ad}: {len(bulunan)} ilan")
        except Exception as exc:  # tek kaynağın hatası turu düşürmesin
            print(f"  {ad} hatası (atlandı): {exc}")
    return alerts


if __name__ == "__main__":  # el testi: python -m services.hunter.adapters.public_feeds
    for a in fetch_all():
        print(f"- [{a['platform']}] {a['subject'][:70]}")
