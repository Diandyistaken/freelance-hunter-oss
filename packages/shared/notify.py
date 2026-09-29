"""Bildirim katmanı.

İki kanal:
  - Telegram: TÜM bildirilecek sınıflar (💎/✅/🚩) — mobil arşiv + komutlar
  - Windows pop-up (toast): YALNIZCA 💎 fırsat — masaüstü ana kullanım alanı,
    her ilan değil sadece elmas değerindekiler kesintiye değer
"""

import json
import time
from pathlib import Path

import requests

from packages.shared.config import settings

CHUNK = 3900


def send_telegram(text: str) -> bool:
    """Token/chat_id yoksa False döner (dry-run'da konsola basılır)."""
    if not settings.telegram_token or not settings.telegram_chat_id:
        return False

    url = f"https://api.telegram.org/bot{settings.telegram_token}/sendMessage"
    for i in range(0, len(text), CHUNK):
        resp = requests.post(
            url,
            json={
                "chat_id": settings.telegram_chat_id,
                "text": text[i : i + CHUNK],
                "disable_web_page_preview": True,
            },
            timeout=20,
        )
        resp.raise_for_status()
    return True


def send_desktop_popup(title: str, message: str) -> None:
    """Windows masaüstü bildirimi — yalnızca 💎 fırsat için çağrılır.
    İki katmanlı: önce winotify (modern toast), olmazsa PowerShell balon
    bildirimi (ek kütüphane yok, Windows 11'de daha güvenilir). Pop-up
    başarısız olsa bile boru hattını ASLA düşürmez."""
    if _winotify_popup(title, message):
        return
    _powershell_popup(title, message)


def _winotify_popup(title: str, message: str) -> bool:
    try:
        from winotify import Notification, audio

        toast = Notification(
            app_id="Hunter 🎯",
            title=title,
            msg=message[:200],
            duration="long",
        )
        toast.set_audio(audio.Default, loop=False)
        toast.add_actions(label="Dashboard'u Aç", launch="http://localhost:3005")
        toast.show()
        return True
    except Exception as exc:
        print(f"winotify pop-up gösterilemedi: {exc}")
        return False


def _powershell_popup(title: str, message: str) -> None:
    """winotify sessizce çalışmadığında yedek: klasik balloon tip (NotifyIcon).
    Kayıtlı AUMID gerektirmez; Odak Yardımı kapalıysa Windows 11'de görünür."""
    import subprocess

    def esc(s: str) -> str:  # tek tırnaklı PS dizesi için kaçış
        return s.replace("'", "''")[:200]

    ps = (
        "Add-Type -AssemblyName System.Windows.Forms;"
        "$n = New-Object System.Windows.Forms.NotifyIcon;"
        "$n.Icon = [System.Drawing.SystemIcons]::Information;"
        f"$n.BalloonTipTitle = '{esc(title)}';"
        f"$n.BalloonTipText = '{esc(message)}';"
        "$n.Visible = $true;"
        "$n.ShowBalloonTip(10000);"
        "Start-Sleep -Seconds 7;"
        "$n.Dispose()"
    )
    try:
        subprocess.Popen(
            ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps],
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except Exception as exc:
        print(f"PowerShell pop-up gösterilemedi: {exc}")


def hq_olay(tur: str, seviye: str, metin: str) -> None:
    """HQ ortak akışına tek satır bırak — `<proje kökü>/.hq/olay.jsonl`.

    HUD (portföy kontrol merkezi) bu dosyayı okuyup olayı ajan zincirine sokar:
    proje mühendisi → şirket baş mühendisi → CEO. Sözleşme satır başına bir JSON:
        {"ts": <unix>, "tur": "firsat", "seviye": "onemli", "metin": "..."}

    `seviye`: kritik|risk → risk · onemli|uyari → uyarı · gerisi bilgi.

    Pop-up gibi bu da **boru hattını asla düşürmez**: yazılamazsa sessizce geçer.
    """
    try:
        kok = Path(__file__).resolve().parents[2]      # packages/shared/ → proje kökü
        hq = kok / ".hq"
        hq.mkdir(exist_ok=True)
        kayit = {"ts": int(time.time()), "tur": tur, "seviye": seviye, "metin": metin}
        with (hq / "olay.jsonl").open("a", encoding="utf-8") as f:
            f.write(json.dumps(kayit, ensure_ascii=False) + "\n")
    except Exception as exc:
        print(f"HQ olayı yazılamadı: {exc}")
