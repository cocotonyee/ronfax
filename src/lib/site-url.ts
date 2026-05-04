/**
 * Canonical public origin (no trailing slash).
 *
 * Priority: `NEXT_PUBLIC_APP_URL` → Vercel `VERCEL_URL` (https) → dev-only localhost.
 * Set `NEXT_PUBLIC_APP_URL` in production (e.g. https://ronfax.com).
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
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
