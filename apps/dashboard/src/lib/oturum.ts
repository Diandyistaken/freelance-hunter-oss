// Panel şifre koruması — imzalı çerez (HMAC-SHA256).
//
// NEDEN: panel telefondan kullanılabilsin diye tünelle internete açılıyor
// (bkz. panel_tunel.bat). Tünel adresi tahmin edilemez ama GİZLİ DEĞİL — bağlantı
// birine gidince panel de gider. O yüzden uygulama seviyesinde kapı gerekiyor.
//
// Web Crypto kullanılıyor: hem Edge çalışma zamanında (middleware) hem Node'da
// (giriş API'si) aynı kod çalışsın diye. Şifre .env.local'de durur, panelde
// hiçbir yerde gösterilmez, çerezde de yer almaz — çerezde yalnız imzalı bitiş
// zamanı vardır.
//
// KAPALI VARSAYILAN: PANEL_SIFRE tanımlı değilse koruma devre dışıdır; evdeki
// bilgisayarda panel eskisi gibi şifresiz açılır.

export const CEREZ_ADI = "hunter_oturum";
const SURE_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

// Ev ağı: bilgisayarın kendisi ve aynı Wi-Fi'daki telefon. Buradan gelen
// isteğe kapı açılmaz — kullanıcı kararı (10 Eyl): "evde ve mobilde şifresiz".
// Kapı YALNIZCA tünelden (internetten) gelen isteğe uygulanır.
const YEREL_KALIP =
  /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i;

export function yerelMi(host: string | null): boolean {
  return !!host && YEREL_KALIP.test(host.trim());
}

const GUVENLI_YONTEMLER = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Veri değiştiren istek başka bir siteden mi geliyor (CSRF)? Tarayıcılar her
 * istekte `Sec-Fetch-Site`, POST'ta `Origin` gönderir; ikisinden biri başka
 * kaynağı gösteriyorsa reddedilir. İkisi de yoksa istek tarayıcıdan değildir
 * (curl, Python) — bu tür istemciler CSRF'e açık değildir, geçer.
 */
export function capraziSiteIstegi(istek: {
  method: string;
  headers: { get(ad: string): string | null };
}): boolean {
  if (GUVENLI_YONTEMLER.has(istek.method.toUpperCase())) return false;
  // Modern tarayıcı: karar yalnız Sec-Fetch-Site'a göre. Origin↔Host kıyası
  // tünel/Tailscale Host'u yeniden yazarsa meşru isteği de reddederdi.
  const site = istek.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const koken = istek.headers.get("origin");
  if (!koken) return false;
  try {
    return new URL(koken).host.toLowerCase() !== (istek.headers.get("host") ?? "").toLowerCase();
  } catch {
    return true; // bozuk / "null" Origin
  }
}

/**
 * Tailscale ağı (tailnet) — kullanıcı kararı 11 Eyl 2026.
 *
 * `tailscale serve` panelin önüne geçer ve YALNIZCA kullanıcının kendi
 * cihazlarından (Google hesabıyla giriş yapmış telefon/bilgisayar) gelen
 * isteği geçirir. Yani kimlik denetimi zaten yapılmıştır ve adres internete
 * açık değildir. Bu yüzden burada ikinci bir şifre sormuyoruz.
 *
 * `*.ts.net` adı tailnet dışından çözülse bile o adrese erişim yalnız
 * tailnet üzerinden mümkündür; ayrıca serve, kullanıcı kimliğini
 * `tailscale-user-login` başlığında iletir.
 */
export function tailnetMi(host: string | null): boolean {
  const ad = (host ?? "").trim().toLowerCase().split(":")[0];
  return ad.endsWith(".ts.net");
}

/**
 * `eposta` YALNIZCA imzası doğrulanmış Access jetonundan gelmeli
 * (lib/cfAccess.ts → accessEpostasi). Düz başlık değeri buraya verilmez.
 * İzin verilen e-posta PANEL_EPOSTA'da yazılıysa yalnız o kişi girer;
 * yazılı değilse Access'in doğruladığı herkes girer (Access zaten kimin
 * gireceğini kendi kuralında belirler).
 */
export function accessKimligi(eposta: string | null): boolean {
  if (!eposta) return false;
  const izinli = (process.env.PANEL_EPOSTA ?? "").trim().toLowerCase();
  return !izinli || eposta.trim().toLowerCase() === izinli;
}

function b64url(veri: ArrayBuffer | Uint8Array): string {
  const bayt = veri instanceof Uint8Array ? veri : new Uint8Array(veri);
  let metin = "";
  for (const b of bayt) metin += String.fromCharCode(b);
  return btoa(metin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function imzala(mesaj: string, gizli: string): Promise<string> {
  const anahtar = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(gizli),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", anahtar, new TextEncoder().encode(mesaj)));
}

/** Sabit süreli karşılaştırma — şifreyi karakter karakter sızdırmamak için. */
export function esitMi(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i += 1) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

export function korumaAcikMi(): boolean {
  return !!process.env.PANEL_SIFRE;
}

function gizliAnahtar(): string {
  // PANEL_GIZLI yoksa şifreden türet: koruma yine çalışır, ama şifre
  // değişince tüm oturumlar düşer (istenen davranış).
  return process.env.PANEL_GIZLI || `hunter:${process.env.PANEL_SIFRE ?? ""}`;
}

export async function cerezUret(): Promise<string> {
  const bitis = String(Date.now() + SURE_MS);
  return `${bitis}.${await imzala(bitis, gizliAnahtar())}`;
}

export async function cerezGecerliMi(deger: string | undefined): Promise<boolean> {
  if (!deger) return false;
  const [bitis, imza] = deger.split(".");
  if (!bitis || !imza) return false;
  if (!/^\d+$/.test(bitis) || Number(bitis) < Date.now()) return false;
  return esitMi(imza, await imzala(bitis, gizliAnahtar()));
}
