"""Gmail bildirim adaptörü — ban-güvenli kanal #2.

Platformların KENDİ gönderdiği e-postaları okur (Upwork ilan uyarısı, Armut
talebi, Fiverr mesajı, Freelancer bildirimi). Hub kutu: you@example.com.

OAuth: Kisisel Ajan projesinin credentials.json + token.json'ı devralınır
(gmail.readonly kapsamı zaten onaylı). İlk çalışmada Python formatına
dönüştürülüp data/gmail_token.json'a yazılır. Refresh token ölmüşse
`python run.py --auth` tek tıklık yeniden yetkilendirme yapar.
"""

import base64
import html
import json
import re
from urllib.parse import urlsplit

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from packages.shared.config import settings

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
TOKEN_PATH = settings.data_dir / "gmail_token.json"

# Platform bildirim sorgusu — hepsi aynı hub kutuya (senin Gmail kutun) yazar.
# 27 Tem 2026'da 5 → 13 alan adına genişletildi: Hunter yalnız Freelancer'dan
# ilan alabiliyordu (296 kaydın 296'sı). Yeni alan adları için ilgili platformda
# "iş uyarısı / saved search e-postası" kurulmuş olması gerekir — kurulum
# adımları: docs/uyelikler/ilan-kanallari.md
#
# LinkedIn NOT: alan adının tamamı alınmaz. 28 Tem ölçümü — son 14 günde gelen 60
# LinkedIn mailinin yarısı iş DIŞI gürültüydü (profil ziyareti, bağlantı isteği,
# bülten, DM). Yalnızca iş ilanı gönderen iki adres alınır; gerisi AI bütçesi yer.
QUERY = (
    "from:("
    "upwork.com OR freelancer.com OR fiverr.com OR bionluk.com OR armut.com"
    " OR jobalerts-noreply@linkedin.com OR jobs-noreply@linkedin.com"
    " OR peopleperhour.com OR guru.com OR contra.com"
    " OR toptal.com OR workana.com OR truelancer.com OR googlealerts-noreply@google.com"
    ") newer_than:2d"
)


def _client_config() -> dict:
    with open(settings.kisisel_ajan_dir / "credentials.json", encoding="utf-8") as f:
        return json.load(f)["installed"]


def load_credentials() -> Credentials:
    """Önce kendi token'ımız; yoksa Kisisel Ajan token'ından dönüştür."""
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    else:
        client = _client_config()
        with open(settings.kisisel_ajan_dir / "token.json", encoding="utf-8") as f:
            node_token = json.load(f)
        creds = Credentials(
            token=None,
            refresh_token=node_token["refresh_token"],
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client["client_id"],
            client_secret=client["client_secret"],
            scopes=SCOPES,
        )

    if not creds.valid:
        creds.refresh(Request())  # ölü refresh token burada patlar → --auth
    TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
    return creds


def interactive_auth() -> None:
    """`python run.py --auth` — tarayıcıda Google izin ekranı açar (kullanıcı onaylar)."""
    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_config(
        {"installed": _client_config()}, SCOPES
    )
    creds = flow.run_local_server(port=0, prompt="consent")
    TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
    print("Gmail yetkilendirmesi tamamlandı → data/gmail_token.json")


def _decode_part(data: str) -> str:
    return base64.urlsafe_b64decode(data + "===").decode("utf-8", errors="replace")


def _strip_html(html: str) -> str:
    html = re.sub(r"<(style|script)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;|&#\d+;|&[a-z]+;", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_body(payload: dict) -> str:
    """text/plain tercih edilir; yoksa HTML soyulur. Parçalar özyinelemeli gezilir."""
    plain, html = [], []

    def walk(part: dict) -> None:
        mime = part.get("mimeType", "")
        data = part.get("body", {}).get("data")
        if data:
            if mime == "text/plain":
                plain.append(_decode_part(data))
            elif mime == "text/html":
                html.append(_decode_part(data))
        for sub in part.get("parts", []) or []:
            walk(sub)

    walk(payload)
    text = "\n".join(plain) if plain else _strip_html(" ".join(html))
    return text[:6000]


def _extract_url(payload: dict, platform: str) -> str | None:
    """MIME parçalarından ilk uygun ilan bağlantısını bulur."""
    links = []

    def walk(part: dict) -> None:
        mime = part.get("mimeType", "")
        data = part.get("body", {}).get("data")
        if data:
            text = _decode_part(data)
            if mime == "text/html":
                links.extend(re.findall(r'''href\s*=\s*["']([^"']+)["']''',
                                        text, flags=re.I))
            elif mime == "text/plain":
                links.extend(re.findall(r"https?://\S+", text, flags=re.I))
        for sub in part.get("parts", []) or []:
            walk(sub)

    walk(payload)
    unwanted = ("unsubscribe", "subscription", "preferences", "settings",
                "notification_settings", "email-settings", "abonelik",
                "privacy", "terms", "help.", "support.", "mailto:")
    cleaned = []
    for link in links:
        link = html.unescape(link).strip().rstrip(".,;)>\"'")
        if any(term in link.lower() for term in unwanted):
            continue
        try:
            parsed = urlsplit(link)
        except ValueError:
            continue
        if parsed.scheme in ("http", "https") and parsed.hostname:
            cleaned.append(link)

    domains = {
        "Upwork": "upwork.com",
        "Freelancer.com": "freelancer.com",
        "Freelancer.com (API)": "freelancer.com",
        "Bionluk": "bionluk.com",
        "Armut": "armut.com",
        "Fiverr": "fiverr.com",
    }
    domain = domains.get(platform)
    if not domain:
        return None

    # Host kontrolü, query içinde platform URL'si taşıyan takip linklerini reddeder.
    own_links = []
    for link in cleaned:
        parsed = urlsplit(link)
        host = (parsed.hostname or "").lower().rstrip(".")
        if host == domain or host.endswith("." + domain):
            own_links.append(link)

    preferred_paths = {
        "Upwork": ("/jobs/", "/details/", "/find-work/"),
        "Freelancer.com": ("/projects/",),
        "Freelancer.com (API)": ("/projects/",),
        "Armut": ("/talep", "/is-firsat", "/job", "/request", "/pro/"),
        "Bionluk": ("/ilan", "/is/", "/job", "/siparis"),
        "Fiverr": ("/inbox/", "/orders/", "/job", "/brief"),
    }.get(platform, ())
    for link in own_links:
        if any(marker in urlsplit(link).path.lower() for marker in preferred_paths):
            return link

    # E-posta buton yolları değişebildiğinden platformdaki ilk gerçek yol fallback'tir.
    for link in own_links:
        if urlsplit(link).path.strip("/"):
            return link
    return "https://armut.com/pro" if platform == "Armut" else None


def _platform_of(sender: str) -> str:
    for domain, name in (
        ("upwork", "Upwork"),
        ("freelancer", "Freelancer.com"),
        ("armut", "Armut"),
        ("fiverr", "Fiverr"),
        ("bionluk", "Bionluk"),
        # 27 Tem 2026 genişletmesi — bu alan adları önceden "Bilinmeyen"e düşüyordu
        ("linkedin", "LinkedIn"),
        ("peopleperhour", "PeoplePerHour"),
        ("guru.com", "Guru"),
        ("contra", "Contra"),
        ("toptal", "Toptal"),
        ("workana", "Workana"),
        ("truelancer", "Truelancer"),
        ("googlealerts", "Google Alerts"),
    ):
        if domain in sender.lower():
            return name
    return "Bilinmeyen"


def fetch_alerts(max_results: int = 15) -> list[dict]:
    """Son platform bildirimlerini döndürür: {id, platform, sender, subject, body}."""
    creds = load_credentials()
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    listing = (
        service.users()
        .messages()
        .list(userId="me", q=QUERY, maxResults=max_results)
        .execute()
    )

    alerts = []
    for ref in listing.get("messages", []):
        msg = (
            service.users()
            .messages()
            .get(userId="me", id=ref["id"], format="full")
            .execute()
        )
        headers = {
            h["name"].lower(): h["value"]
            for h in msg.get("payload", {}).get("headers", [])
        }
        sender = headers.get("from", "")
        platform = _platform_of(sender)
        alerts.append(
            {
                "id": f"gmail:{ref['id']}",
                "platform": platform,
                "sender": sender,
                "subject": headers.get("subject", "(konu yok)"),
                "body": _extract_body(msg.get("payload", {})),
                "url": _extract_url(msg.get("payload", {}), platform),
            }
        )
    return alerts
