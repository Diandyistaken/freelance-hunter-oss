# Freelance Hunter — bot + paneli iki ayrı pencerede başlatır.
#   .\baslat.ps1          (proje klasöründe)
# Durdurmak için açılan iki pencereyi kapatman yeterli.

$Kok = $PSScriptRoot
if (-not (Test-Path (Join-Path $Kok ".env"))) {
    Write-Host ".env yok. Önce install.ps1'i çalıştır ya da .env.example'ı .env olarak kopyala." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $Kok "apps\dashboard\.next\BUILD_ID"))) {
    Write-Host "Panel derlenmemiş, derleniyor..." -ForegroundColor Yellow
    Push-Location (Join-Path $Kok "apps\dashboard"); npm run build; Pop-Location
}

Start-Process powershell -WorkingDirectory $Kok -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='Hunter bot'; python run.py --bot"
Start-Process powershell -WorkingDirectory (Join-Path $Kok "apps\dashboard") -ArgumentList "-NoExit", "-Command", "`$host.UI.RawUI.WindowTitle='Hunter panel'; npm run start"
Start-Sleep 6
Start-Process "http://localhost:3005"
