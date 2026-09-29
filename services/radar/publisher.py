"""Tek komutla yayına alma — demo siteyi müşteriye gösterilecek CANLI linke çevirir.

Cloudflare Pages ücretsiz planı kullanılır (kredi kartı İSTEMEZ). Netlify'dan
buraya geçildi çünkü Netlify hesabının aylık kredisi tükendi ("Account credit
usage exceeded" — yeni deploy'lar 403 ile reddediyordu).

Her işletme/stil kendi Cloudflare Pages PROJESİ olur (proje adı = dosya adının
slug'ı) — bu sayede "Yeniden Üret + Yayınla" tekrarlarında link DEĞİŞMEZ.
Netlify'da her yayında yepyeni rastgele bir adres üretiliyordu, esnafa her
düzeltmeden sonra yeni link göndermek gerekiyordu; artık aynı işletme hep aynı
`https://<slug>.pages.dev` adresinde kalıyor.

Gerçek yükleme işini `wrangler` CLI'ı (npx üzerinden) yapıyor — Cloudflare'in
"direct upload" protokolü (hash kontrolü + JWT'li parça parça yükleme) resmi
olarak tek bir düz REST çağrısı değil; Wrangler bunu güvenilir şekilde hallediyor.
Node.js/npm zaten kurulu olmalı (dashboard'un kendisi de Next.js kullanıyor).

Kurulum (bir kez, ~5 dk):
  1. dash.cloudflare.com → ücretsiz hesap aç (kart istemez)
  2. My Profile → API Tokens → Create Token → Create Custom Token
     Permissions: Account / Cloudflare Pages / Edit
  3. .env'e yaz: CLOUDFLARE_API_TOKEN=cfut_...
"""

import os
import re
import subprocess
import tempfile
import time
from pathlib import Path

import requests

from packages.shared.config import settings

API_BASE = "https://api.cloudflare.com/client/v4"
_MAX_PROJECT_NAME = 58
_PROJECT_CREATE_RETRIES = 3


def _project_name(html_path: Path) -> str:
    """Cloudflare Pages proje adı — DNS etiketi kurallarına uygun (küçük harf,
    rakam, tire; başta/sonda tire yok, azami 58 karakter)."""
    name = html_path.stem.lower()
    name = re.sub(r"[^a-z0-9-]+", "-", name)
    name = re.sub(r"-{2,}", "-", name).strip("-")
    name = name[:_MAX_PROJECT_NAME].strip("-")
    return name or "isletme"


def _auth_headers() -> dict:
    return {"Authorization": f"Bearer {settings.cloudflare_api_token}"}


def _project_exists(name: str) -> bool:
    r = requests.get(
        f"{API_BASE}/accounts/{settings.cloudflare_account_id}/pages/projects/{name}",
        headers=_auth_headers(), timeout=20,
    )
    return r.status_code == 200


def _ensure_project(name: str) -> None:
    """Proje yoksa oluşturur; varsa dokunmaz (link sabit kalsın diye).

    Cloudflare'in proje oluşturma uç noktası arada sırada geçici `8000000`
    ("unknown error") ile 500 dönüyor — aynı isteği hemen tekrarlamak genelde
    yetiyor (canlı doğrulandı). Bu yüzden 5xx'te kısa backoff'lu retry var;
    5xx dışı (400/403 gibi kalıcı) hatalarda hemen fırlatılır."""
    if _project_exists(name):
        return
    last_error = ""
    for attempt in range(1, _PROJECT_CREATE_RETRIES + 1):
        r = requests.post(
            f"{API_BASE}/accounts/{settings.cloudflare_account_id}/pages/projects",
            headers=_auth_headers(),
            json={"name": name, "production_branch": "production"},
            timeout=30,
        )
        if r.status_code in (200, 201):
            return
        last_error = f"{r.status_code} {r.text[:300]}"
        if r.status_code < 500 or attempt == _PROJECT_CREATE_RETRIES:
            break
        time.sleep(2 * attempt)
    raise RuntimeError(f"Cloudflare Pages proje oluşturma başarısız: {last_error}")


def publish_file(html_path: Path) -> str:
    """Tek HTML dosyasını Cloudflare Pages'e yayınlar, sabit URL döndürür."""
    if not settings.cloudflare_api_token:
        raise RuntimeError(
            "CLOUDFLARE_API_TOKEN boş. dash.cloudflare.com'dan ücretsiz hesap + "
            "'Cloudflare Pages: Edit' izinli token al, .env'e yaz."
        )
    if not html_path.exists():
        raise RuntimeError(f"HTML dosyası bulunamadı: {html_path}")

    name = _project_name(html_path)
    _ensure_project(name)

    env = {
        **os.environ,
        "CLOUDFLARE_API_TOKEN": settings.cloudflare_api_token,
        "CLOUDFLARE_ACCOUNT_ID": settings.cloudflare_account_id,
    }
    with tempfile.TemporaryDirectory(prefix="fh-deploy-") as tmp:
        (Path(tmp) / "index.html").write_bytes(html_path.read_bytes())
        cmd = (
            f'npx --yes wrangler pages deploy "{tmp}" '
            f'--project-name={name} --branch=production --commit-dirty=true'
        )
        result = subprocess.run(
            cmd, shell=True, cwd=tmp, env=env,
            capture_output=True, text=True, timeout=120,
            encoding="utf-8", errors="replace",
        )
    if result.returncode != 0:
        raise RuntimeError(
            f"Cloudflare Pages deploy başarısız: {(result.stderr or result.stdout)[-500:]}"
        )

    return f"https://{name}.pages.dev"


def yayinla_radar(n: int) -> tuple[str, dict]:
    """Radar listesindeki n. avın önizlenen sitesini yayına alır → (url, hit).
    "Önizlenen" = build_site'ın gerçek varsayılan çıktı yolu (`{slug}.html`) —
    bu yol yanlışsa (eski bir dizin yapısına bakarsa) her "Yayınla" tıklaması
    sessizce YENİ bir stile rotasyon yapıp onu yayınlar; kullanıcının az önce
    üretip önizlediği site değil, rastgele bir sonraki stil yayına çıkar."""
    from services.radar.site_builder import OUT_DIR, _load_hits, _slugify, build_from_radar

    hits = _load_hits()
    if not 1 <= n <= len(hits):
        raise IndexError(f"Geçersiz numara: {n} (listede {len(hits)} av var)")
    hit = hits[n - 1]
    slug = _slugify(hit["name"])
    path = OUT_DIR / f"{slug}.html"
    if not path.exists():
        path, hit = build_from_radar(n)
    return publish_file(path), hit


def publish_many(paths: dict[str, Path]) -> dict[str, str]:
    """Birden çok stil dosyasını sırayla yayına alır → {stil: url}."""
    return {stil: publish_file(path) for stil, path in paths.items()}


def yayinla_radar_5(n: int, styles: list[str] | None = None) -> tuple[dict[str, str], dict]:
    """Radar listesindeki n. av için BİRDEN ÇOK stili aynı anda üretip yayına
    alır → ({stil: url}, hit). Esnafa "hazırladım bile, hangisini beğendiniz?"
    derken hepsinin linki elde hazır olsun diye. `styles` verilmezse varsayılan
    VITRIN_5 kullanılır (bkz. site_builder.VITRIN_5); panelde kullanıcı tik
    işaretiyle kendi seçimini de gönderebilir."""
    from services.radar.site_builder import build_variants_from_radar

    paths, hit = build_variants_from_radar(n, styles=styles)
    return publish_many(paths), hit


if __name__ == "__main__":
    import sys
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Windows konsolunda emoji/Türkçe için
    if len(sys.argv) > 2 and sys.argv[1] == "5" and sys.argv[2].isdigit():
        secilen_stiller = sys.argv[3].split(",") if len(sys.argv) > 3 and sys.argv[3] else None
        urls, hit = yayinla_radar_5(int(sys.argv[2]), styles=secilen_stiller)
        print(f"🌍 {hit['name']} — {len(urls)} varyant CANLI:")
        for stil, url in urls.items():
            print(f"{stil}: {url}")
    elif len(sys.argv) > 1 and sys.argv[1].isdigit():
        url, hit = yayinla_radar(int(sys.argv[1]))
        print(f"🌍 {hit['name']} CANLI: {url}")
    else:
        print(__doc__)
