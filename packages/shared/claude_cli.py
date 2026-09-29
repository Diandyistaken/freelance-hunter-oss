"""Kurulu Claude Code CLI'a tek seferlik soru sorar ($0 — Max aboneliği).

NEDEN AYRI: `services/radar/tasarimci.py` içindeki CLI çağrısı tasarım
üretimine göre ayarlı (çok tur, araç izinleri, uzun zaman aşımı). Burada
ihtiyaç farklı: tek atış, araçsız, JSON isteyen kısa istem. İkisini tek
fonksiyona sıkıştırmak ikisini de bozardı; ortak olan tek şey CLI'ı bulmak.

API bakiyesine dokunmaz; CLI kurulu değilse anlaşılır hata verir.
"""

from __future__ import annotations

import json
import shutil
import subprocess

from packages.shared.config import settings


class CliYok(RuntimeError):
    """Claude Code CLI bulunamadı."""


def komut_yolu() -> str | None:
    return shutil.which(settings.tasarim_cli_komut)


def sor(istem: str, zaman_asimi: int = 300, model: str | None = None) -> str:
    """Tek atış soru — araçsız, tek tur. Yanıt metnini döndürür."""
    komut = komut_yolu()
    if not komut:
        raise CliYok(
            f"Claude Code CLI bulunamadı ('{settings.tasarim_cli_komut}'). "
            "TASARIM_CLI_KOMUT ile tam yolu ver."
        )
    args = [
        komut, "-p", "--output-format", "json", "--max-turns", "1",
        "--disallowedTools",
        "Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch,Task,Read,Glob,Grep",
    ]
    secilen = model or settings.tasarim_cli_model
    if secilen:
        args += ["--model", secilen]
    try:
        sonuc = subprocess.run(  # noqa: S603 — komut shutil.which ile çözüldü
            args, input=istem, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=zaman_asimi,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Claude CLI zaman aşımına uğradı") from exc
    if sonuc.returncode != 0:
        detay = (sonuc.stderr or sonuc.stdout or "").strip()[-400:]
        raise RuntimeError(f"Claude CLI hata (kod {sonuc.returncode}): {detay}")
    try:
        cevap = json.loads(sonuc.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Claude CLI JSON döndürmedi: {sonuc.stdout[:200]}") from exc
    if cevap.get("is_error") or cevap.get("subtype") != "success":
        raise RuntimeError(f"Claude CLI başarısız: {str(cevap)[:400]}")
    return cevap.get("result") or ""


def json_sor(istem: str, zaman_asimi: int = 300) -> dict:
    """Yanıtı JSON olarak ister; ```json çitini de temizler."""
    ham = sor(istem, zaman_asimi=zaman_asimi).strip()
    if ham.startswith("```"):
        ham = ham.split("\n", 1)[1] if "\n" in ham else ham
        ham = ham.rsplit("```", 1)[0]
    ham = ham.strip()
    basla, bit = ham.find("{"), ham.rfind("}")
    if basla == -1 or bit == -1:
        raise ValueError(f"JSON bulunamadı: {ham[:200]}")
    return json.loads(ham[basla : bit + 1])
