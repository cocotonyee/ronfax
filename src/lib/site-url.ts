/**
 * Canonical public origin (no trailing slash, always includes http/https).
 *
 * Priority: `NEXT_PUBLIC_APP_URL` → Vercel `VERCEL_URL` (https) → dev-only localhost.
 * Production example: `https://www.ronfax.com` (bare `ronfax.com` is normalized to `https://www.ronfax.com`).
 */
export function normalizePublicOrigin(input: string): string {
  const t = input.trim().replace(/\/+$/, "");
  if (!t) return "http://localhost:3000";
  if (/^https?:\/\//i.test(t)) return t;
  if (
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(t) ||
    /^localhost:/i.test(t)
  ) {
    return `http://${t}`;
  }
  if (/^ronfax\.com(:[0-9]+)?$/i.test(t)) {
    return "https://www.ronfax.com";
  }
  return `https://${t}`;
}

function resolveSiteUrlRaw(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv;

  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  console.error(
    "[RonFax] NEXT_PUBLIC_APP_URL is unset in production; metadata and callbacks may be wrong. Set it to your public https origin.",
  );
  return "http://localhost:3000";
}

export function getSiteUrl(): string {
  let base = normalizePublicOrigin(resolveSiteUrlRaw()).replace(/\/$/, "");
  try {
    const u = new URL(base.includes("://") ? base : `https://${base}`);
    if (u.hostname.toLowerCase() === "ronfax.com") {
      u.hostname = "www.ronfax.com";
      base = u.toString().replace(/\/$/, "");
    }
  } catch {
    /* keep base */
  }
  return base.replace(/\/$/, "");
}

/**
 * Safe `metadataBase` (origin only) — avoids throwing when building metadata
 * if the env value is missing a scheme or includes a path.
 */
export function getMetadataBaseUrl(): URL {
  try {
    return new URL(new URL(getSiteUrl()).origin);
  } catch {
    return new URL("http://localhost:3000");
  }
}

/** True when the origin is clearly not suitable for external webhooks (production guard). */
export function isLocalOrLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin.includes("://") ? origin : `https://${origin}`);
    const host = u.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".localhost")
    );
  } catch {
    return true;
  }
}
