import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseCookieOptions } from "@/lib/supabase/cookies";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function createServerSupabase() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("还没有配置 Supabase。");
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write cookies. The proxy refreshes the session.
        }
      },
    },
  });
}
