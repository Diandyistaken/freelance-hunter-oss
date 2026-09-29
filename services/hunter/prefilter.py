"""Sıfır maliyetli ön-eleme ve uygunluk puanı.

NEDEN VAR: Freelancer API günde ~200 ilan getiriyor, günlük AI tavanı ise 40.
Kuyruk eskiden yeniye işlendiği için bugünün ilanları sıraya hiç gelmiyor,
kullanıcıya 5-6 günlük (çoktan kapanmış) ilanlar bildiriliyordu.

ÇÖZÜM: her ilana AI'a gitmeden önce ücretsiz bir uygunluk puanı ver; günlük AI
bütçesi en uygun + en taze ilanlara harcansın. Puan yalnızca SIRALAMA ve bariz
alakasızları eleme içindir — nihai kararı yine Haiku skorlayıcı verir.

Anahtar kelimeler profile.yaml'daki hizmet envanterinden türetilmiştir.
"""

from __future__ import annotations

import re

# Çekirdek hizmetler (profile.yaml → hizmetler): en yüksek ağırlık
CEKIRDEK = {
    "web": [
        "next.js", "nextjs", "next js", "react", "tailwind", "framer",
        "landing page", "landing-page", "web sitesi", "web site", "website",
        "web design", "web tasarım", "frontend", "front-end", "web app",
        "web uygulama", "kurumsal site", "tanıtım sitesi", "single page",
    ],
    "ai": [
        "ai agent", "ai bot", "chatbot", "chat bot", "claude", "gpt", "openai",
        "llm", "yapay zeka", "prompt", "rag", "anthropic", "ai integration",
        "ai automation", "ai-powered", "machine learning api",
    ],
    "bot": [
        "telegram bot", "telegram", "discord bot", "whatsapp bot",
        "notification bot", "bildirim botu",
    ],
    "otomasyon": [
        "automation", "otomasyon", "automate", "workflow automation",
        "zapier", "make.com", "n8n", "script", "python script", "bot script",
        "web scraping", "scraper", "scraping", "veri kazıma", "data extraction",
        "crawler",
    ],
    "eposta": [
        "email automation", "gmail api", "e-posta otomasyon", "mail bot",
        "outlook api", "imap",
    ],
    "arac": [
        "chrome extension", "browser extension", "eklenti", "dashboard",
        "admin panel", "internal tool", "iç araç", "desktop app", "cli tool",
    ],
    "entegrasyon": [
        "api integration", "rest api", "webhook", "third-party api",
        "sap pi", "sap po", "idoc", "soap", "entegrasyon",
    ],
}

# İkincil sinyaller: teknik ama doğrudan hizmet başlığı değil
IKINCIL = [
    "python", "javascript", "typescript", "node.js", "nodejs", "html", "css",
    "api", "saas", "mvp", "database", "sqlite", "postgres", "supabase",
    "vercel", "netlify", "github", "docker", "seo", "responsive", "figma",
    "wordpress", "shopify", "webflow",
]

# Kanıtı olmayan / satılmayacak alanlar (PORTFOY-ANALIZ kararı): puan düşürür
ZAYIF = [
    "ios", "android", "flutter", "react native", "swift", "kotlin",
    "mobile app", "mobil uygulama", "unreal", "blender", "3d model",
    "blockchain", "solidity", "web3", "nft", "smart contract", "crypto",
    "salesforce", "sharepoint", "dynamics 365", "odoo", "magento",
    "kubernetes", "terraform", "devops", "aws architect",
    "iot", "akıllı ev", "arduino", "raspberry pi", "embedded",
    "penetration test", "sızma testi", "pentest",
]

# Yazılım işi OLMAYAN kalıplar: çekirdek kelime yoksa AI'a hiç gitmez
YAZILIM_DISI = [
    "data entry", "veri girişi", "logo design", "logo tasarım",
    "graphic design", "grafik tasarım", "video editing", "video düzenleme",
    "content writer", "content writing", "article writing", "makale yaz",
    "copywriting", "metin yaz", "translation", "çeviri yap", "translator",
    "virtual assistant", "sanal asistan", "voice over", "seslendirme",
    "transcription", "deşifre", "accounting", "muhasebe", "bookkeeping",
    "illustrator", "photoshop retouch", "banner design", "t-shirt design",
    "ghostwriter", "resume writing", "cv yaz", "social media manager",
    "instagram yönetimi", "veri toplama (manuel)", "typing job",
]

TR_IPUCU = ["türkiye", "turkish", "istanbul", "istanbul", "türkçe", "ankara", "izmir"]

# Herhangi biri geçiyorsa ilan yazılım işidir — YAZILIM_DISI elemesi UYGULANMAZ.
# Amaç: yanlış eleme yapıp gerçek iş kaçırmamak (eleme kararı pahalı, AI çağrısı ucuz).
DEV_SINYAL = [
    "developer", "geliştirici", "development", "programmer", "programcı",
    "software", "yazılım", "engineer", "mühendis", "coder", "kodla",
    "website", "web site", "web sitesi", "site", "app ", "application",
    "uygulama", "platform", "system", "sistem", "api", "database",
    "frontend", "backend", "full stack", "full-stack", "fullstack",
    "script", "bot", "automation", "otomasyon", "dashboard", "panel",
]


def _metin(alert: dict) -> str:
    return f"{alert.get('subject', '')} {str(alert.get('body', ''))[:1500]}".casefold()


def _sayac(metin: str, kelimeler: list[str]) -> int:
    return sum(1 for k in kelimeler if k in metin)


def yazilim_disi_mi(alert: dict) -> str | None:
    """Bariz yazılım-dışı iş mi? → eleme nedeni, değilse None.

    İki kat korumalı: (1) kalıp yalnızca BAŞLIKTA aranır — gövdede geçen
    "data entry" bir alt görev olabilir; (2) ilanda herhangi bir yazılım
    sinyali varsa eleme hiç uygulanmaz. Yanlış eleme = kaçan iş demek.
    """
    baslik = str(alert.get("subject", "")).casefold()
    tum_metin = _metin(alert)

    if any(_sayac(tum_metin, kelimeler) for kelimeler in CEKIRDEK.values()):
        return None
    if _sayac(tum_metin, DEV_SINYAL):
        return None

    vurus = [k for k in YAZILIM_DISI if k in baslik]
    if vurus:
        return f"yazılım-dışı iş: {vurus[0]}"
    return None


def uygunluk_puani(alert: dict) -> int:
    """0-100 arası ücretsiz uygunluk puanı. Yalnız sıralama içindir."""
    metin = _metin(alert)
    puan = 30

    # Çekirdek hizmet eşleşmeleri (kategori başına en fazla bir kez sayılır ki
    # aynı kelimeyi tekrarlayan uzun ilanlar haksız avantaj kazanmasın).
    eslesen_kategori = sum(1 for kelimeler in CEKIRDEK.values() if _sayac(metin, kelimeler))
    puan += min(eslesen_kategori * 14, 42)

    puan += min(_sayac(metin, IKINCIL) * 4, 16)
    puan -= min(_sayac(metin, ZAYIF) * 12, 36)

    # Bütçe sinyali: yüksek bütçeli işler önce değerlendirilsin
    butce = alert.get("budget_usd")
    tur = str(alert.get("budget_type") or "").lower()
    try:
        if butce is not None:
            butce = float(butce)
            if tur == "hourly":
                puan += 14 if butce >= 25 else (7 if butce >= 15 else -6)
            else:
                puan += 14 if butce >= 500 else (7 if butce >= 200 else -6)
    except (TypeError, ValueError):
        pass

    # Yerel pazar avantajı: TR müşterisiyle telefonla konuşulabilir, güven yüksek
    if any(k in metin for k in TR_IPUCU):
        puan += 8

    return max(0, min(100, puan))


_BOSLUK = re.compile(r"\s+")


def ozet(alert: dict) -> str:
    """Log/hata ayıklama için kısa özet."""
    baslik = _BOSLUK.sub(" ", str(alert.get("subject", "")))[:60]
    return f"[{uygunluk_puani(alert):3d}] {alert.get('platform', '?')} · {baslik}"
