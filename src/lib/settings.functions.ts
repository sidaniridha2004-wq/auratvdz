import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Helper to create a Supabase client using public key
function createPublicClient(adminPassword?: string) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: adminPassword ? { headers: { "x-auratv-admin-password": adminPassword } } : undefined,
    }
  );
}

// Helper to verify admin password on server-side functions
async function requirePassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (expected && expected.length > 0) {
    const a = new TextEncoder().encode(pw);
    const b = new TextEncoder().encode(expected);
    if (a.length !== b.length) throw new Error("Unauthorized");
    let match = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) match = false;
    }
    if (!match) throw new Error("Unauthorized");
  } else {
    // If no password configured, fall back to checking via Supabase RPC just like channels.functions does
    const sb = createPublicClient(pw);
    const { data } = await sb.rpc("admin_password_matches", { _password: pw });
    if (!data) throw new Error("Unauthorized");
  }
}

/**
 * Gets a setting by key. 
 * Can be called publicly without a password.
 */
export const getSetting = createServerFn({ method: "GET" })
  .validator((key: string) => key)
  .handler(async ({ data: key }) => {
    const sb = createPublicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .single();

    if (error || !data) return null;
    return data.value;
  });

/**
 * Updates a setting. Requires admin password.
 */
export const updateSetting = createServerFn({ method: "POST" })
  .validator(
    z.object({
      password: z.string(),
      key: z.string(),
      value: z.string(),
    })
  )
  .handler(async ({ data: { password, key, value } }) => {
    await requirePassword(password);
    
    const sb = createPublicClient(password);
    
    // Upsert the setting
    const { error } = await sb
      .from("app_settings")
      .upsert({ 
        key, 
        value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.error("Failed to update setting:", error);
      throw new Error("Failed to update setting");
    }

    return { success: true };
  });
