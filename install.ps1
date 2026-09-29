# Freelance Hunter — Windows tek komut kurulum
#   irm https://raw.githubusercontent.com/Diandyistaken/freelance-hunter-oss/main/install.ps1 | iex
#
# Yaptıkları: eksikse Git/Python/Node kurar (winget), repoyu klonlar (varsa günceller),
# Python ve panel bağımlılıklarını kurar, paneli derler, .env şablonunu açar.
# Tekrar çalıştırmak güvenlidir: mevcut .env ve data/ klasörüne dokunmaz.

$ErrorActionPreference = "Stop"
$Repo  = "https://github.com/Diandyistaken/freelance-hunter-oss.git"
$Hedef = if ($env:HUNTER_DIR) { $env:HUNTER_DIR } else { Join-Path $HOME "freelance-hunter" }

function Adim($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function PathYenile {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [Environment]::GetEnvironmentVariable("Path", "User")
}
function Kontrol($ne) {
    if ($LASTEXITCODE -ne 0) { throw "$ne başarısız oldu (çıkış kodu $LASTEXITCODE). Yukarıdaki hata mesajına bak." }
}
function Gerekli($komut, $wingetId, $ad) {
    if (Get-Command $komut -ErrorAction SilentlyContinue) { Write-Host "  $ad var"; return }
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "$ad yok ve winget bulunamadı. $ad'i elle kurup bu komutu tekrar çalıştır."
    }
    Write-Host "  $ad kuruluyor (winget $wingetId)..."
    winget install -e --id $wingetId --silent --accept-package-agreements --accept-source-agreements; Kontrol "$ad kurulumu"
    PathYenile
    if (-not (Get-Command $komut -ErrorAction SilentlyContinue)) {
        throw "$ad kuruldu ama PATH'te görünmüyor. PowerShell'i kapatıp açıp komutu tekrar çalıştır."
    }
}

Adim "Ön koşullar (Git, Python, Node.js)"
Gerekli git    "Git.Git"           "Git"
Gerekli python "Python.Python.3.13" "Python"
Gerekli node   "OpenJS.NodeJS.LTS" "Node.js"
$pyv = (python -c "import sys; print('%d.%d' % sys.version_info[:2])")
if ([version]$pyv -lt [version]"3.11") { throw "Python $pyv çok eski, 3.11+ gerekli." }

Adim "Kod indiriliyor → $Hedef"
if (Test-Path (Join-Path $Hedef ".git")) {
    git -C $Hedef pull --ff-only; Kontrol "git pull"
} else {
    git clone --depth 1 $Repo $Hedef; Kontrol "git clone"
}
Set-Location $Hedef

Adim "Python bağımlılıkları"
python -m pip install -r services\requirements.txt --quiet; Kontrol "Python bağımlılıkları"

Adim "Ayar dosyası (.env)"
New-Item -ItemType Directory -Force (Join-Path $Hedef "data\google") | Out-Null
if (-not (Test-Path ".env")) {
    $icerik = Get-Content ".env.example" -Raw
    $icerik = $icerik -replace "KISISEL_AJAN_DIR=\./data/google", ("KISISEL_AJAN_DIR=" + (Join-Path $Hedef "data\google"))
    Set-Content ".env" $icerik -Encoding utf8
    Write-Host "  .env oluşturuldu"
} else {
    Write-Host "  .env zaten var, dokunulmadı"
}

Adim "Panel (Next.js) — bağımlılıklar + derleme, birkaç dakika sürer"
Push-Location "apps\dashboard"
npm ci --no-audit --no-fund; Kontrol "npm ci"
npm run build; Kontrol "panel derlemesi"
Pop-Location

Adim "Bitti"
Write-Host @"

  Klasör: $Hedef

  1) Açılan .env dosyasına en az ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID yaz, kaydet.
  2) packages\shared\profile.yaml dosyasını kendi hizmetlerine göre düzenle.
  3) Deneme (Claude anahtarı yeter):    python run.py --dry-run
  4) Çalıştır (bot + panel):            klasördeki baslat.bat'a çift tıkla
     Panel: http://localhost:3005

  Ayrıntı: README.md  ·  Kendi yapay zekâna anlatmak için: GPT_ICIN.md
"@ -ForegroundColor Green

notepad (Join-Path $Hedef ".env")
