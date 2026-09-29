import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  // ÖNBELLEK KURALI — "panel eski sürümü gösteriyor" sorununun kökü buydu.
  //
  // Next, önceden derlenmiş (prerender) sayfaları varsayılan olarak
  // `Cache-Control: s-maxage=31536000` ile veriyordu. `max-age` olmadığı için
  // tarayıcı sezgisel önbelleğe düşüyor ve HTML kabuğunu günlerce saklıyor;
  // o kabuk ESKİ chunk adlarını işaret ettiği için yeni build yayına girse
  // bile ekranda eski panel kalıyordu (11 Ağu'da "tarayıcı önbelleği" diye
  // teşhis edilmiş ama kalıcı düzeltme yapılmamıştı; 15 Ağu'da tekrarladı).
  //
  // Çözüm: HTML belgeleri asla saklanmasın (her açılışta sunucuya sorulsun),
  // `/_next/static/*` ise içerik-hash'li olduğu için uzun süre saklanabilir —
  // dosya adı değişince tarayıcı zaten yenisini indirir. Panel yerelde
  // çalıştığı için no-store'un hız maliyeti pratikte sıfır.
  // NOT: iki kural da eşleşirse SONRAKİ kazanıyor (ölçüldü). Bu yüzden genel
  // kural `_next/static`i olumsuz ileri-bakışla DIŞARIDA bırakıyor; ayrıca
  // statik kural en sona konuldu — sıralamaya güvenmeden iki kez korunuyoruz.
  async headers() {
    return [
      {
        // Statik varlıklar hariç TÜM sayfalar ve API yanıtları.
        source: "/((?!_next/static|_next/image).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        // İçerik-hash'li dosyalar: adı değişmeden içeriği değişmez.
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
