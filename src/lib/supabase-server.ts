import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

/** Supabase JWT payload `role` must be `service_role` for server writes to bypass RLS. */
function jwtRole(supabaseKey: string): string | null {
  const parts = supabaseKey.split(".");
  if (parts.length < 2) return null;
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  try {
    const json = JSON.parse(
      Buffer.from(b64 + pad, "base64").toString("utf8"),
    ) as { role?: string };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

/** Server-only Supabase client (service role — bypasses RLS). Do not import from client components. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    cached = null;
    return null;
  }
  const role = jwtRole(key);
  if (role != null && role !== "service_role") {
    console.error(
      "[supabase-server] SUPABASE_SERVICE_ROLE_KEY 的 JWT role 为 \"%s\"，应为 \"service_role\"。请在 Supabase Dashboard → Project Settings → API 复制 **service_role** secret（勿用 anon public key），否则会出现 RLS 42501。",
      role,
    );
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseAdmin() !== null;
}
