// Cloudflare Access kimliğinin DOĞRULANMASI.
//
// NEDEN (6 Eki 2026 güvenlik düzeltmesi): eskiden `cf-access-authenticated-user-email`
// başlığı tek başına yeterliydi. Bu başlığı Cloudflare Access ekler AMA herkes de
// kendi isteğine yazabilir. Panel geçici tünelle (trycloudflare, panel_tunel.bat)
// açıldığında önünde Access yoktu; başlığı elle ekleyen biri şifre kapısını
// atlıyordu. Artık başlığa değil, Access'in İMZALI jetonuna
// (`cf-access-jwt-assertion`) bakılıyor: imza ekibin açık anahtarlarıyla, `aud`
// uygulamanın etiketiyle, süre ve yayıncı ayrıca doğrulanıyor.
//
// Ayar (.env.local): CF_ACCESS_TEAM=<ekip>  (→ <ekip>.cloudflareaccess.com)
//                    CF_ACCESS_AUD=<Access uygulamasının "Application Audience (AUD) Tag"i>
// İkisi de yoksa bu yol KAPALI: dışarıdan giriş yalnız şifreyle olur.

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
}

const ANAHTAR_OMRU_MS = 60 * 60 * 1000;
let onbellek: { zaman: number; anahtarlar: Jwk[] } | null = null;

function ayar(): { ekip: string; aud: string } | null {
  const ekip = (process.env.CF_ACCESS_TEAM ?? "").trim();
  const aud = (process.env.CF_ACCESS_AUD ?? "").trim();
  return ekip && aud ? { ekip, aud } : null;
}

function b64urlCoz(metin: string): Uint8Array<ArrayBuffer> {
  const b64 = metin.replace(/-/g, "+").replace(/_/g, "/");
  const ham = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(ham, (c) => c.charCodeAt(0));
}

function jsonCoz(parca: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlCoz(parca)));
  } catch {
    return null;
  }
}

async function anahtarlar(ekip: string): Promise<Jwk[]> {
  if (onbellek && Date.now() - onbellek.zaman < ANAHTAR_OMRU_MS) return onbellek.anahtarlar;
  const yanit = await fetch(`https://${ekip}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!yanit.ok) throw new Error(`Access anahtarları alınamadı: ${yanit.status}`);
  const govde = (await yanit.json()) as { keys?: Jwk[] };
  onbellek = { zaman: Date.now(), anahtarlar: govde.keys ?? [] };
  return onbellek.anahtarlar;
}

/** Jeton geçerliyse doğrulanmış e-postayı, değilse null döner. */
export async function accessEpostasi(jeton: string | null): Promise<string | null> {
  const a = ayar();
  if (!a || !jeton) return null;
  const parcalar = jeton.split(".");
  if (parcalar.length !== 3) return null;
  const [basB64, yukB64, imzaB64] = parcalar;
  const bas = jsonCoz(basB64);
  const yuk = jsonCoz(yukB64);
  if (!bas || !yuk || bas.alg !== "RS256" || typeof bas.kid !== "string") return null;

  try {
    const jwk = (await anahtarlar(a.ekip)).find((k) => k.kid === bas.kid);
    if (!jwk) return null;
    const anahtar = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const imzaGecerli = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      anahtar,
      b64urlCoz(imzaB64),
      new TextEncoder().encode(`${basB64}.${yukB64}`),
    );
    if (!imzaGecerli) return null;
  } catch {
    return null; // anahtar alınamadı / bozuk jeton → içeri alma
  }

  const simdi = Date.now() / 1000;
  const audlar = Array.isArray(yuk.aud) ? yuk.aud : [yuk.aud];
  if (!audlar.includes(a.aud)) return null;
  if (typeof yuk.exp !== "number" || yuk.exp < simdi) return null;
  if (typeof yuk.nbf === "number" && yuk.nbf > simdi + 60) return null;
  if (yuk.iss !== `https://${a.ekip}.cloudflareaccess.com`) return null;
  return typeof yuk.email === "string" ? yuk.email : null;
}
