/**
 * Public site origin (no trailing slash). Set `NEXT_PUBLIC_APP_URL` in production, e.g. https://ronfax.com
 */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
