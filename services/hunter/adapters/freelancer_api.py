"""Freelancer.com resmi geliştirici API adaptörü — ban-güvenli kanal #1.

https://developers.freelancer.com · API kullanımı ÜCRETSİZDİR (kart istemez).
Token: freelancer.com hesabınla developers.freelancer.com'a gir →
"Create App / API token" → .env'e FREELANCER_OAUTH_TOKEN=... yaz. Hepsi bu;
bot bir sonraki turda API'den ilan çekmeye başlar (mail'den dakikalar önce).

Dil-bağımsız tarama: metin araması DEĞİL, skill ID filtresi (jobs[] parametresi)
kullanılır — Arapça/İspanyolca/her dilde ilan düşer, scorer orijinalinden okur.
Skill ID'leri elle sabitlenmez: /jobs/ ucundan bir kez isim→ID çözülür ve
data/freelancer_skills.json'a önbelleklenir (ID'ler değişirse kendini yeniler).
"""

import json
import os
import time

import requests

from packages.shared.config import settings

BASE = "https://www.freelancer.com/api/projects/0.1"
SKILL_CACHE = settings.data_dir / "freelancer_skills.json"

# Bundan yaşlı ilanlar hiç alınmaz: Freelancer'da teklif penceresi pratikte
# ilk saatlerde kapanır, bayat ilan "teklif verilemez" hatasıyla sonuçlanır.
MAX_YAS_SAAT = float(os.getenv("FLAPI_MAX_YAS_SAAT", "24"))

# Profil envanteriyle örtüşen varsayılan skill adları (Freelancer taksonomisi).
# İstenirse .env'de FREELANCER_SKILLS=Python,PHP,... ile ezilebilir.
DEFAULT_SKILLS = [
    "Python", "JavaScript", "Website Design", "Web Development", "HTML",
    "Chatbot", "Artificial Intelligence", "Web Scraping", "API Integration",
    "Automation", "Telegram API", "Chrome Extension",
]


def _headers() -> dict:
    return {"freelancer-oauth-v1": settings.freelancer_token}


def _skill_names() -> list[str]:
    raw = os.getenv("FREELANCER_SKILLS", "")
    return [s.strip() for s in raw.split(",") if s.strip()] or DEFAULT_SKILLS


# Freelancer kuralı: hesap "Verified by Freelancer" değilse 2500 USD üzeri
# ilanlara teklif verilemez ("Bu projeye teklif vermek sınırlıdır" — 29 Tem 2026
# canlıda görüldü). Doğrulama alınınca .env'e FREELANCER_VERIFIED=1 yazılır.
VERIFIED_MIN_USD = 2500.0


def _min_butce_usd(p: dict) -> float | None:
    """Bütçe alt sınırının USD karşılığı; veri eksikse None (filtre devre dışı)."""
    minimum = (p.get("budget") or {}).get("minimum")
    if minimum is None:
        return None
    currency = p.get("currency") or {}
    try:
        amount = float(minimum)
        if str(currency.get("code") or "").upper() == "USD":
            return amount
        rate = float(currency.get("exchange_rate") or 0)
        return amount * rate if rate > 0 else None
    except (TypeError, ValueError):
        return None


def teklif_verilemez(p: dict) -> str | None:
    """İlan bizim hesabın teklifine kapalıysa nedenini döndürür, açıksa None.

    29 Tem 2026'da canlı API'de doğrulanan bayraklar:
      upgrades.pf_only/recruiter → "tercih edilen freelancer olmalısınız" hatası
      hireme                     → doğrudan işe alım, teklif verilemez
      frontend_project_status    → "open" değilse teklif süresi bitmiş
    """
    up = p.get("upgrades") or {}
    if p.get("deleted") or p.get("status") != "active":
        return "kapali"
    front = p.get("frontend_project_status")
    if front is not None and front != "open":
        return "teklif-suresi-bitmis"
    if p.get("hireme"):
        return "dogrudan-ise-alim"
    if up.get("pf_only") or up.get("recruiter"):
        return "preferred-freelancer-sarti"
    if up.get("nonpublic"):
        return "kapali-davetli-ilan"
    if os.getenv("FREELANCER_VERIFIED", "0") != "1":
        min_usd = _min_butce_usd(p)
        if min_usd is not None and min_usd > VERIFIED_MIN_USD:
            return "dogrulama-sarti-2500usd"
    return None


def proje_durumu(project_id: int | str, timeout: float = 15) -> str | None:
    """İlanın teklife kapanma nedenini döndürür; hâlâ açıksa None.

    HTTP 404 = ilan silinmiş ("Bu proje mevcut değil" sayfası) — kapalı sayılır;
    raise_for_status'a bırakılırsa ağ hatasıyla karışıp ilan açık sanılıyordu.
    upgrade_details=true ŞART: parametresiz uçta upgrades bayrakları her zaman
    False döner, pf_only ilanlar açık sanılır (29 Tem 2026 doğrulandı).
    Fail-open ilkesi: ağ hatasında VE 200 gelip result gövdesi boş/eksik olduğunda
    None (açık) döner — kapalı kararı yalnızca dolu proje verisiyle verilir,
    şüphede fırsat kaçırmak yanlış elemeden kötüdür.
    """
    try:
        headers = _headers() if settings.freelancer_token else {}
        resp = requests.get(f"{BASE}/projects/{project_id}/", headers=headers,
                            params={"upgrade_details": "true"}, timeout=timeout)
        if resp.status_code == 404:
            return "proje-silinmis"
        resp.raise_for_status()
        proje = (resp.json() or {}).get("result")
        if not proje:
            return None  # anormal 200 (boş envelope) — kapanma KANITI yok
        return teklif_verilemez(proje)
    except Exception:
        return None


def proje_hala_acik(project_id: int | str) -> bool:
    """Bildirimden hemen önce ilanın hâlâ teklife açık olduğunu doğrular."""
    return proje_durumu(project_id) is None


def resolve_skill_ids(names: list[str] | None = None) -> list[int]:
    """İsimden skill ID'ye çevirir; tam listeyi bir kez indirip önbellekler."""
    names = names or _skill_names()

    if SKILL_CACHE.exists():
        mapping = json.loads(SKILL_CACHE.read_text(encoding="utf-8"))
    else:
        resp = requests.get(f"{BASE}/jobs/", headers=_headers(), timeout=30)
        resp.raise_for_status()
        mapping = {
            j["name"].lower(): j["id"]
            for j in resp.json().get("result", [])
            if j.get("name") and j.get("id")
        }
        SKILL_CACHE.write_text(json.dumps(mapping, ensure_ascii=False),
                               encoding="utf-8")

    ids = [mapping[n.lower()] for n in names if n.lower() in mapping]
    if not ids:
        raise RuntimeError(
            "Hiçbir skill adı eşleşmedi — data/freelancer_skills.json'ı silip "
            "tekrar dene veya FREELANCER_SKILLS adlarını kontrol et."
        )
    return ids


def _budget_str(p: dict) -> str:
    b = p.get("budget") or {}
    cur = (p.get("currency") or {}).get("code", "USD")
    lo, hi = b.get("minimum"), b.get("maximum")
    if lo and hi:
        return f"{lo:g}-{hi:g} {cur}"
    return f"{lo:g}+ {cur}" if lo else "belirtilmemiş"


def _country_of(p: dict, users: dict) -> str | None:
    """API sürümleri arasındaki konum farklarını güvenli biçimde karşılar."""
    owner_id = p.get("owner_id")
    if isinstance(users, dict):
        owner = users.get(str(owner_id), {}) or users.get(owner_id, {})
    elif isinstance(users, list):
        owner = next((u for u in users if str(u.get("id")) == str(owner_id)), {})
    else:
        owner = {}
    for obj in (owner, p):
        location = obj.get("location") or {}
        country = location.get("country") or obj.get("country") or {}
        if isinstance(country, str):
            return country or None
        if isinstance(country, dict):
            return country.get("code") or country.get("name")
    return None


def _budget_metadata(p: dict) -> tuple[str | None, float | None]:
    """Bütçe türü ve ihtiyatlı USD üst sınırı; veri eksikse filtreyi devre dışı bırakır."""
    budget = p.get("budget") or {}
    maximum = budget.get("maximum")
    if maximum is None:
        return None, None

    project_type = str(p.get("type") or "").lower()
    if "hour" in project_type:
        budget_type = "hourly"
    elif "fixed" in project_type:
        budget_type = "fixed"
    else:
        return None, None
    currency = p.get("currency") or {}
    code = str(currency.get("code") or "").upper()
    try:
        amount = float(maximum)
        if code == "USD":
            return budget_type, amount
        # API'de exchange_rate = 1 birimin USD karşılığı (INR≈0.0104) → çarpılır
        exchange_rate = float(currency.get("exchange_rate") or 0)
        return (budget_type, amount * exchange_rate) if exchange_rate > 0 else (None, None)
    except (TypeError, ValueError, ZeroDivisionError):
        return None, None


def _cek(params: dict) -> dict:
    """Tek API çağrısı. Token varsa gönderilir ama ZORUNLU DEĞİL —
    28 Tem 2026'da doğrulandı: /projects/active/ ucu anahtarsız da 200 dönüyor,
    yani token süresi dolsa bile ilan akışı durmaz."""
    headers = _headers() if settings.freelancer_token else {}
    resp = requests.get(f"{BASE}/projects/active/", headers=headers,
                        params=params, timeout=30)
    resp.raise_for_status()
    return resp.json().get("result", {})


def fetch_projects(limit: int = 30) -> list[dict]:
    """Aktif ilanları çeker ve pipeline'ın beklediği alert sözlüğüne çevirir.

    Filtre YALNIZCA beceri ID'leriyle yapılır (jobs[]) — dil bağımsız çalışır.

    28 Tem 2026'da denenip ELENEN parametreler (sunucu bunları yok sayıyor,
    tekrar denemeye değmez):
      · countries[]=tr  → TR ilanı vermedi; Tayca/Malayca/Arapça kayıt işleri döndü
      · query=<kelime>  → gevşek eşleşme; "telegram bot" araması trading sitesi,
                          "web scraping python" logo tasarımı getirdi
    İlgililik sıralaması bunun yerine services/hunter/prefilter.py ile yapılır.

    Dönen yapı gmail_alerts ile birebir aynı: {id, platform, sender, subject, body}.
    """
    result = _cek({
        "jobs[]": resolve_skill_ids(),
        "limit": limit,
        "full_description": "true",
        "job_details": "true",
        "user_details": "true",
        "upgrade_details": "true",
        "sort_field": "time_submitted",
        "compact": "true",
    })

    users = result.get("users") or {}
    alerts = []
    simdi = time.time()
    for p in result.get("projects", []):
        # Teklif verilemeyecek ilan (preferred-only, kapalı, hireme...) hiç alınmaz
        if teklif_verilemez(p):
            continue
        submit = p.get("time_submitted") or p.get("submitdate")
        yas_saat = (simdi - float(submit)) / 3600 if submit else None
        if yas_saat is not None and yas_saat > MAX_YAS_SAAT:
            continue

        url = f"https://www.freelancer.com/projects/{p.get('seo_url', p['id'])}"
        budget_type, budget_usd = _budget_metadata(p)
        bid_count = (p.get("bid_stats") or {}).get("bid_count")
        yas_txt = (f"{yas_saat * 60:.0f} dk" if yas_saat is not None and yas_saat < 1
                   else f"{yas_saat:.1f} saat" if yas_saat is not None else "?")
        body = (
            f"{p.get('description') or p.get('preview_description', '')}\n\n"
            f"Bütçe: {_budget_str(p)}\n"
            f"İlan yaşı: {yas_txt} · Mevcut teklif sayısı: "
            f"{bid_count if bid_count is not None else '?'}\n"
            f"İlan linki: {url}"
        )
        alerts.append({
            "id": f"flapi:{p['id']}",
            "platform": "Freelancer.com (API)",
            "sender": "api@freelancer.com",
            "subject": p.get("title", "(başlıksız ilan)"),
            "body": body[:6000],
            "url": url,
            "customer_country": _country_of(p, users),
            "budget_type": budget_type,
            "budget_usd": budget_usd,
        })
    return alerts


if __name__ == "__main__":  # hızlı el testi: python -m services.hunter.adapters.freelancer_api
    if not settings.freelancer_token:
        print("FREELANCER_OAUTH_TOKEN boş — developers.freelancer.com'dan ücretsiz al.")
    else:
        for a in fetch_projects(limit=5):
            print(f"- {a['subject']}  [{a['id']}]")
