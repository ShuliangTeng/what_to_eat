import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createBrowserSupabase() {
  if (browserClient) return browserClient;
  const env = getSupabaseEnv();
  if (!env) throw new Error("还没有配置 Supabase。");
  browserClient = createBrowserClient(env.url, env.key);
  return browserClient;
}
