#!/usr/bin/env bash
# Demoyu Vercel'de yayınlar.
#
# İki tuzağı kalıcı olarak atlatır:
#  1) Git deposunun içinden `vercel deploy` çalıştırılırsa Vercel commit yazarını
#     hesaba bağlayamıyor ve deploy'u BLOCKED'a düşürüyor ("couldn't find a Git
#     account for the commit author") — build hiç başlamıyor. Bu yüzden çıktıyı
#     git dışında geçici bir dizine kopyalayıp oradan gönderiyoruz.
#  2) `--prebuilt` gönderiminde kök yol eşlenmiyor: /index 200 verirken / 404
#     veriyor. config.json'a filesystem'den önce / -> /index rotasını ekliyoruz.
#
# HANGİ SİTEYE GİDER: `.vercel/project.json` neyi gösteriyorsa oraya.
#   demo    → demo-three-azure-17.vercel.app  (1. müşteri, 5 ürün — DONDURULDU)
#   demo-b  → demo-b-nu.vercel.app            (2. müşteri, 6 ürün)
# Proje değiştirmek için: npx vercel link --yes --project <ad>
set -euo pipefail

cd "$(dirname "$0")"
GECICI="$(mktemp -d)"
trap 'rm -rf "$GECICI"' EXIT

# Ayarlar yerelde yoksa `build` "project_settings_required" ile düşer.
npx --yes vercel@latest pull --yes --environment production
npx --yes vercel@latest build --prod

mkdir -p "$GECICI/.vercel"
cp -r .vercel/output "$GECICI/.vercel/output"
cp .vercel/project.json "$GECICI/.vercel/project.json"

python - "$GECICI/.vercel/output/config.json" <<'PY'
import json, sys

yol = sys.argv[1]
ayar = json.load(open(yol, encoding="utf-8"))
rotalar = ayar["routes"]
sinir = next(i for i, r in enumerate(rotalar) if r.get("handle") == "filesystem")
if not any(r.get("src") == "/" for r in rotalar[:sinir]):
    rotalar.insert(sinir, {"src": "/", "dest": "/index"})
    json.dump(ayar, open(yol, "w", encoding="utf-8"), ensure_ascii=False)
PY

cd "$GECICI"
npx --yes vercel@latest deploy --prebuilt --prod
