/**
 * MapLibre v6'nın worker'ını public/maplibre/ altına kopyalar.
 *
 * NEDEN: maplibre-gl v6 worker'ı ayrı bir ESM dosyası olarak yükler
 *   (new Worker(new URL("./maplibre-gl-worker.mjs", import.meta.url), {type:"module"}))
 * ve Next.js bu URL'i kendi chunk'ları arasında yayımlamıyor — istek 404 HTML
 * dönüyor, tarayıcı "non-JavaScript MIME type" diyor, harita kutucuk çekemeden
 * siyah kalıyor (9 Eyl 2026'da ölçüldü). Çözüm: worker'ı statik dosya olarak
 * biz servis ediyoruz, RadarMap açılışta setWorkerUrl ile onu gösteriyor.
 *
 * Worker `./maplibre-gl-shared.mjs`i göreli import ettiği için İKİSİ de aynı
 * klasöre kopyalanır. prebuild/predev ile çalışır → npm paketi güncellenince
 * kopyalar da kendiliğinden tazelenir (sürüm kayması olmaz).
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const kok = dirname(dirname(fileURLToPath(import.meta.url)));
const kaynak = join(kok, "node_modules", "maplibre-gl", "dist");
const hedef = join(kok, "public", "maplibre");

mkdirSync(hedef, { recursive: true });
for (const ad of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(kaynak, ad), join(hedef, ad));
}
console.log(`maplibre worker → public/maplibre/ (2 dosya)`);
