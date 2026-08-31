import { next } from "@vercel/functions";

// Vercel Edge Functions expose a minimal process.env — declare just enough of
// it here rather than pulling in the full @types/node package for one usage.
declare const process: { env: Record<string, string | undefined> };

// Runs on every path — including asset URLs someone might guess or have
// cached — because the requirement is that nothing gets through unauthenticated,
// not just the page shell.
export const config = {
  matcher: "/(.*)",
};

const COOKIE_NAME = "il_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64(sig);
}

// Constant-time-ish compare for the session token's signature — matters more
// here than for the password itself, since this is what stops someone from
// forging a valid cookie without knowing the secret.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  const expected = await hmac(ts, secret);
  return timingSafeEqual(expected, sig);
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function loginPage(error?: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ImpactLedger — Sign in</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    background: #F7F8FA; color: #1A1D23;
  }
  .card {
    background: #FFFFFF; border: 1px solid #E2E5EA; border-radius: 14px;
    padding: 32px; width: 100%; max-width: 320px; box-shadow: 0 6px 20px -8px rgba(16,24,40,0.10);
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { font-size: 13px; color: #616B79; margin: 0 0 20px; }
  input {
    width: 100%; padding: 10px 12px; border: 1px solid #E2E5EA; border-radius: 8px;
    font-size: 16px; margin-bottom: 12px;
  }
  input:focus { outline: none; border-color: #0E7C66; box-shadow: 0 0 0 2px rgba(14,124,102,0.25); }
  button {
    width: 100%; padding: 10px 12px; border: none; border-radius: 8px;
    background: #0E7C66; color: #fff; font-size: 14px; font-weight: 500; cursor: pointer;
  }
  button:hover { background: #0A5C4C; }
  .error { color: #D33A3A; font-size: 13px; margin: -8px 0 12px; }
</style>
</head>
<body>
  <form class="card" method="POST" action="">
    <h1>ImpactLedger</h1>
    <p>Enter the password to continue.</p>
    ${error ? `<p class="error">${error}</p>` : ""}
    <input type="password" name="password" placeholder="Password" autofocus required />
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;
  return new Response(html, { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
}

export default async function middleware(request: Request) {
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.SITE_AUTH_SECRET;

  // Fail closed, not open — if the env vars aren't set, block everything
  // rather than silently letting every visitor straight through.
  if (!password || !secret) {
    return new Response(
      "Site is not configured: SITE_PASSWORD and SITE_AUTH_SECRET must be set in Vercel project environment variables.",
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  const existingToken = cookies[COOKIE_NAME];

  if (existingToken && (await verifyToken(existingToken, secret))) {
    return next();
  }

  if (request.method === "POST") {
    const form = await request.formData();
    const submitted = form.get("password");
    if (typeof submitted === "string" && submitted === password) {
      const ts = Date.now().toString();
      const token = `${ts}.${await hmac(ts, secret)}`;
      const response = new Response(null, {
        status: 303,
        headers: { Location: url.pathname + url.search },
      });
      response.headers.append(
        "Set-Cookie",
        `${COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`
      );
      return response;
    }
    return loginPage("Incorrect password.");
  }

  return loginPage();
}
