"""SQLite önbellek — aynı ilan/e-posta iki kez işlenmez (maliyet + tekrar koruması)."""

import sqlite3
from contextlib import contextmanager

from packages.shared.config import settings

DB_PATH = settings.data_dir / "hunter.sqlite"

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
    external_id TEXT PRIMARY KEY,
    source      TEXT NOT NULL,
    title       TEXT,
    lang        TEXT,
    score       INTEGER,
    sinif       TEXT,
    eleme_nedeni TEXT,
    notified_at TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS blacklist (
    pattern     TEXT PRIMARY KEY,
    created_at  TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pending (
    external_id TEXT PRIMARY KEY,
    platform    TEXT,
    sender      TEXT,
    subject     TEXT,
    body        TEXT,
    url         TEXT,
    customer_country TEXT,
    budget_type TEXT,
    budget_usd  REAL,
    created_at  TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS daily_usage (
    day      TEXT PRIMARY KEY,
    calls    INTEGER DEFAULT 0,
    notified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS teklifler (
    title       TEXT,
    platform    TEXT,
    durum       TEXT DEFAULT 'verildi',
    created_at  TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS son_ilanlar (
    external_id TEXT UNIQUE,
    platform    TEXT,
    lang        TEXT,
    title_tr    TEXT,
    ceviri_tr   TEXT,
    body        TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);
-- Radar v2: site denetim raporu önbelleği. Aynı siteyi her taramada yeniden
-- yormamak için (hem nezaket hem hız); TTL config'ten (AUDIT_CACHE_DAYS).
CREATE TABLE IF NOT EXISTS site_denetim (
    domain      TEXT PRIMARY KEY,
    url         TEXT,
    rapor_json  TEXT NOT NULL,
    kusur_puani INTEGER,
    created_at  TEXT DEFAULT (datetime('now'))
);
"""


def _migrate(con: sqlite3.Connection) -> None:
    """Var olan tabloya sonradan eklenen kolonlar (web detay penceresi için)."""
    con.execute(
        """CREATE TABLE IF NOT EXISTS portfoy (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            baslik TEXT,
            platform TEXT,
            ilan_ozeti TEXT,
            yaptigimiz TEXT,
            sonuc TEXT,
            kazanc TEXT,
            link TEXT,
            tarih TEXT DEFAULT (date('now'))
        )"""
    )

    cols = {r[1] for r in con.execute("PRAGMA table_info(son_ilanlar)")}
    for ad, tip in (("score", "INTEGER"), ("sinif", "TEXT"),
                    ("gerekce_tr", "TEXT"), ("red_flags", "TEXT"),
                    ("teklif", "TEXT"), ("teklif_ozeti_tr", "TEXT"),
                    ("url", "TEXT"), ("kapali_neden", "TEXT"),
                    ("kapali_at", "TEXT")):
        if ad not in cols:
            con.execute(f"ALTER TABLE son_ilanlar ADD COLUMN {ad} {tip}")

    item_cols = {r[1] for r in con.execute("PRAGMA table_info(items)")}
    if "eleme_nedeni" not in item_cols:
        con.execute("ALTER TABLE items ADD COLUMN eleme_nedeni TEXT")

    pending_cols = {r[1] for r in con.execute("PRAGMA table_info(pending)")}
    for ad, tip in (("url", "TEXT"), ("customer_country", "TEXT"),
                    ("budget_type", "TEXT"), ("budget_usd", "REAL")):
        if ad not in pending_cols:
            con.execute(f"ALTER TABLE pending ADD COLUMN {ad} {tip}")


@contextmanager
def connect():
    con = sqlite3.connect(DB_PATH)
    try:
        con.executescript(SCHEMA)
        _migrate(con)
        yield con
        con.commit()
    finally:
        con.close()


def seen(external_id: str) -> bool:
    with connect() as con:
        row = con.execute(
            "SELECT 1 FROM items WHERE external_id = ?", (external_id,)
        ).fetchone()
        return row is not None


def record(external_id: str, source: str, title: str, lang: str,
           score: int, sinif: str, notified: bool,
           eleme_nedeni: str | None = None) -> None:
    with connect() as con:
        con.execute(
            """INSERT OR REPLACE INTO items
               (external_id, source, title, lang, score, sinif, notified_at, eleme_nedeni)
               VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? THEN datetime('now') END, ?)""",
            (external_id, source, title, lang, score, sinif, notified, eleme_nedeni),
        )


def add_blacklist(pattern: str) -> None:
    """Kullanıcının işaretlediği scam kalıbı/gönderen — bir daha AI'a bile gitmez."""
    with connect() as con:
        con.execute("INSERT OR IGNORE INTO blacklist (pattern) VALUES (?)",
                    (pattern.strip().lower(),))


def blacklist_hit(text: str) -> str | None:
    """Metin kara listedeki bir kalıbı içeriyorsa kalıbı döndürür."""
    lowered = text.lower()
    with connect() as con:
        for (pattern,) in con.execute("SELECT pattern FROM blacklist"):
            if pattern in lowered:
                return pattern
    return None


def today_stats() -> dict:
    """Bugünün sınıf dağılımı — bot /durum komutu için.
    created_at UTC saklanır; 'bugün' Türkiye gününe göre hesaplanır."""
    with connect() as con:
        rows = con.execute(
            """SELECT sinif, COUNT(*) FROM items
               WHERE datetime(created_at, 'localtime') >= date('now', 'localtime')
               GROUP BY sinif"""
        ).fetchall()
    return dict(rows)


def weekly_stats() -> dict:
    """Son 7 günün huni özeti — bot /rapor komutu için."""
    with connect() as con:
        sinif = dict(con.execute(
            """SELECT sinif, COUNT(*) FROM items
               WHERE created_at >= datetime('now', '-7 day') GROUP BY sinif"""
        ).fetchall())
        platform = con.execute(
            """SELECT source, COUNT(*) FROM items
               WHERE created_at >= datetime('now', '-7 day') AND sinif != 'eleme'
               GROUP BY source ORDER BY 2 DESC"""
        ).fetchall()
        calls = con.execute(
            """SELECT COALESCE(SUM(calls), 0) FROM daily_usage
               WHERE day >= date('now', '-7 day')"""
        ).fetchone()[0]
    return {"sinif": sinif, "platform": platform, "calls": calls}


# --- Son ilanlar: panel ayrıntısı ve 72 saatlik elmas takibi ---

def save_recent(alert: dict, s: dict, d: dict | None = None) -> int:
    """Bildirilen ilanın tüm detayını saklar; rowid döndürür."""
    import json as _json
    with connect() as con:
        cur = con.execute(
            """INSERT OR REPLACE INTO son_ilanlar
               (external_id, platform, lang, title_tr, ceviri_tr, body,
                score, sinif, gerekce_tr, red_flags, teklif, teklif_ozeti_tr, url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (alert["id"], alert["platform"], s.get("lang", "EN"),
             s.get("title_tr", ""), s.get("ceviri_tr", ""), alert["body"][:6000],
             s.get("score", 0), s.get("sinif", ""), s.get("gerekce_tr", ""),
             _json.dumps(s.get("red_flags", []), ensure_ascii=False),
             (d or {}).get("teklif"), (d or {}).get("teklif_ozeti_tr"),
             alert.get("url")),
        )
        # Koruma kapali_neden'e bakmaz: kapatılan elmasın "neden düştü" izi ve
        # kullanıcıya verilmiş Takip no'su 72 saatlik pencere boyunca yaşamalı.
        con.execute(
            """DELETE FROM son_ilanlar
               WHERE rowid NOT IN
                     (SELECT rowid FROM son_ilanlar ORDER BY rowid DESC LIMIT 100)
                 AND NOT (sinif = 'firsat' AND created_at >= datetime('now', '-72 hours'))"""
        )
        return cur.lastrowid


def list_recent_diamonds(hours: int = 72) -> list[dict]:
    """Son N saatteki AÇIK elmasları, yerel gösterim saatiyle yeniden eskiye döndürür.
    Kapandığı tespit edilenler (kapali_neden dolu) listeye girmez."""
    with connect() as con:
        rows = con.execute(
            """SELECT title_tr, score, platform,
                      strftime('%d.%m %H:%M', datetime(created_at, 'localtime')), url
               FROM son_ilanlar
               WHERE sinif = 'firsat'
                 AND kapali_neden IS NULL
                 AND created_at >= datetime('now', ?)
               ORDER BY created_at DESC""",
            (f"-{int(hours)} hours",),
        ).fetchall()
    return [
        {"title_tr": r[0], "score": r[1], "platform": r[2], "saat": r[3], "url": r[4]}
        for r in rows
    ]


def acik_flapi_elmaslar(hours: int = 72) -> list[str]:
    """Takipte görünen, Freelancer API kaynaklı (yeniden doğrulanabilir) elmasların
    external_id listesi — takip_dogrula sweep'inin çalışma listesi."""
    with connect() as con:
        rows = con.execute(
            """SELECT external_id FROM son_ilanlar
               WHERE sinif = 'firsat'
                 AND kapali_neden IS NULL
                 AND external_id LIKE 'flapi:%'
                 AND created_at >= datetime('now', ?)""",
            (f"-{int(hours)} hours",),
        ).fetchall()
    return [r[0] for r in rows]


def takip_kapat(external_id: str, neden: str) -> None:
    """Kapanmış ilanı fırsat takibinden düşürür: kayıt silinmez, işaretlenir —
    'neden düştü' izi normal saklama süresi (72 saat / son 100 kayıt) boyunca kalır."""
    with connect() as con:
        con.execute(
            """UPDATE son_ilanlar
               SET kapali_neden = ?, kapali_at = datetime('now')
               WHERE external_id = ?""",
            (neden, external_id),
        )


def update_recent_teklif(external_id: str, d: dict) -> None:
    """Sonradan üretilen taslağı detay kaydına işler (web + Telegram ortak)."""
    with connect() as con:
        con.execute(
            "UPDATE son_ilanlar SET teklif = ?, teklif_ozeti_tr = ? WHERE external_id = ?",
            (d["teklif"], d["teklif_ozeti_tr"], external_id))


def get_recent_by_external(external_id: str) -> dict | None:
    with connect() as con:
        row = con.execute(
            """SELECT platform, lang, title_tr, ceviri_tr, body, external_id, url
               FROM son_ilanlar WHERE external_id = ?""", (external_id,)
        ).fetchone()
    if not row:
        return None
    return {"platform": row[0], "lang": row[1], "title_tr": row[2],
            "ceviri_tr": row[3], "body": row[4], "external_id": row[5],
            "url": row[6]}


def get_recent(rid: int) -> dict | None:
    with connect() as con:
        row = con.execute(
            """SELECT platform, lang, title_tr, ceviri_tr, body, url
               FROM son_ilanlar WHERE rowid = ?""", (rid,)
        ).fetchone()
    if not row:
        return None
    return {"platform": row[0], "lang": row[1], "title_tr": row[2],
            "ceviri_tr": row[3], "body": row[4], "url": row[5]}


# --- Teklif takibi (CRM-lite): verildi → kazanildi/kaybedildi hunisi ---

def add_teklif(title: str, platform: str) -> int:
    with connect() as con:
        cur = con.execute(
            "INSERT INTO teklifler (title, platform) VALUES (?, ?)",
            (title, platform))
        return cur.lastrowid


def list_teklifler(limit: int = 15) -> list[tuple]:
    """(rowid, title, platform, durum, created_at) — yeniden eskiye."""
    with connect() as con:
        return con.execute(
            """SELECT rowid, title, platform, durum, created_at FROM teklifler
               ORDER BY rowid DESC LIMIT ?""", (limit,)).fetchall()


def set_teklif_durum(rowid: int, durum: str) -> str | None:
    """Durumu günceller; teklif varsa başlığını döndürür."""
    with connect() as con:
        row = con.execute("SELECT title FROM teklifler WHERE rowid = ?",
                          (rowid,)).fetchone()
        if not row:
            return None
        con.execute("UPDATE teklifler SET durum = ? WHERE rowid = ?",
                    (durum, rowid))
        return row[0]


def get_teklif(rowid: int) -> dict | None:
    """Teklif numarasından portföyde kullanılacak başlık ve platformu döndürür."""
    with connect() as con:
        row = con.execute(
            "SELECT title, platform FROM teklifler WHERE rowid = ?", (rowid,)
        ).fetchone()
    if not row:
        return None
    return {"title": row[0], "platform": row[1]}


# --- Tamamlanan işler: teklif hunisinden bağımsız portföy vitrini ---

def add_portfoy(baslik: str, platform: str, ilan_ozeti: str,
                yaptigimiz: str, sonuc: str, kazanc: str,
                link: str = "") -> int:
    with connect() as con:
        cur = con.execute(
            """INSERT INTO portfoy
               (baslik, platform, ilan_ozeti, yaptigimiz, sonuc, kazanc, link)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (baslik, platform, ilan_ozeti, yaptigimiz, sonuc, kazanc, link),
        )
        return cur.lastrowid


def list_portfoy() -> list[tuple]:
    """Portföy kayıtlarını yeniden eskiye, şemadaki kolon sırasıyla döndürür."""
    with connect() as con:
        return con.execute(
            """SELECT id, baslik, platform, ilan_ozeti, yaptigimiz,
                      sonuc, kazanc, link, tarih
               FROM portfoy ORDER BY id DESC"""
        ).fetchall()


# --- Meşgul modu kuyruğu: mailler AI'sız (ücretsiz) birikir ---

def queue_pending(alert: dict) -> bool:
    with connect() as con:
        cur = con.execute(
            """INSERT OR IGNORE INTO pending
               (external_id, platform, sender, subject, body, url,
                customer_country, budget_type, budget_usd)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (alert["id"], alert["platform"], alert["sender"],
             alert["subject"], alert["body"], alert.get("url"),
             alert.get("customer_country"), alert.get("budget_type"),
             alert.get("budget_usd")),
        )
        return cur.rowcount > 0


def pending_alerts() -> list[dict]:
    """Kuyruktaki ilanlar — EN YENİDEN eskiye.

    Sıra kritik: freelance ilanlarında teklifler ilk saatlerde kapanır, bu yüzden
    kuyruk eskiden yeniye işlenirse taze ilanlar hiç sıraya gelmez (27 Tem 2026'da
    1406 ilanlık 6 günlük birikme bu yüzden oluştu). Nihai sıralamayı pipeline
    uygunluk puanıyla yapar; buradaki DESC onun taze-öncelikli tabanıdır.
    """
    with connect() as con:
        rows = con.execute(
            "SELECT external_id, platform, sender, subject, body, url, "
            "customer_country, budget_type, budget_usd, created_at FROM pending "
            "ORDER BY created_at DESC"
        ).fetchall()
    return [{"id": r[0], "platform": r[1], "sender": r[2],
             "subject": r[3], "body": r[4], "url": r[5],
             "customer_country": r[6], "budget_type": r[7],
             "budget_usd": r[8], "created_at": r[9]} for r in rows]


def purge_stale_pending(hours: int) -> int:
    """Belirtilen saatten eski kuyruk kayıtlarını siler; silinen sayısını döndürür.

    Bayat ilana teklif vermek anlamsız (çoğu 48 saatte kapanır) ve birikmiş kuyruk
    günlük AI bütçesini yiyerek taze ilanları görünmez yapıyor.
    """
    with connect() as con:
        cur = con.execute(
            "DELETE FROM pending WHERE created_at < datetime('now', ?)",
            (f"-{int(hours)} hours",),
        )
        return cur.rowcount


def remove_pending(external_id: str) -> None:
    with connect() as con:
        con.execute("DELETE FROM pending WHERE external_id = ?", (external_id,))


def pending_count() -> int:
    with connect() as con:
        return con.execute("SELECT COUNT(*) FROM pending").fetchone()[0]


# --- Günlük AI çağrı tavanı ---

def bump_usage(n: int = 1) -> None:
    with connect() as con:
        con.execute(
            """INSERT INTO daily_usage (day, calls) VALUES (date('now'), ?)
               ON CONFLICT(day) DO UPDATE SET calls = calls + ?""", (n, n))


def usage_today() -> int:
    with connect() as con:
        row = con.execute(
            "SELECT calls FROM daily_usage WHERE day = date('now')").fetchone()
    return row[0] if row else 0


def cap_notified_today() -> bool:
    with connect() as con:
        row = con.execute(
            "SELECT notified FROM daily_usage WHERE day = date('now')").fetchone()
    return bool(row and row[0])


def mark_cap_notified() -> None:
    with connect() as con:
        con.execute(
            """INSERT INTO daily_usage (day, calls, notified) VALUES (date('now'), 0, 1)
               ON CONFLICT(day) DO UPDATE SET notified = 1""")


# ----------------------------------------------------- Radar v2: site denetimi

def denetim_getir(domain: str, gecerlilik_gun: int = 30) -> dict | None:
    """Önbellekteki denetim raporu (süresi geçmişse None).

    Aynı siteyi her taramada yeniden yormamak için — hem hedef sunucuya
    nezaket hem tarama hızı.
    """
    import json  # noqa: PLC0415

    with connect() as con:
        row = con.execute(
            """SELECT rapor_json FROM site_denetim
               WHERE domain = ? AND created_at > datetime('now', ?)""",
            (domain, f"-{int(gecerlilik_gun)} days"),
        ).fetchone()
    if not row:
        return None
    try:
        return json.loads(row[0])
    except ValueError:
        return None


def denetim_kaydet(domain: str, url: str, rapor: dict, kusur_puani: int) -> None:
    import json  # noqa: PLC0415

    with connect() as con:
        con.execute(
            """INSERT INTO site_denetim (domain, url, rapor_json, kusur_puani, created_at)
               VALUES (?, ?, ?, ?, datetime('now'))
               ON CONFLICT(domain) DO UPDATE SET
                   url = excluded.url, rapor_json = excluded.rapor_json,
                   kusur_puani = excluded.kusur_puani, created_at = excluded.created_at""",
            (domain, url, json.dumps(rapor, ensure_ascii=False), int(kusur_puani)),
        )


def denetim_sayisi() -> int:
    with connect() as con:
        return con.execute("SELECT count(*) FROM site_denetim").fetchone()[0]
