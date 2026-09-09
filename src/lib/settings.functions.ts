// Key/value app settings. Public read, admin-gated write.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, serverSupabase } from "@/lib/admin-auth.server";

const keySchema = z.string().min(1).max(64).regex(/^[a-z0-9_.-]+$/i);

export const getSetting = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => keySchema.parse(input))
  .handler(async ({ data: key }) => {
    const supabase = serverSupabase();
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
    if (error) return null;
    return (data?.value as string | undefined) ?? null;
  });

export const updateSetting = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string(), key: keySchema, value: z.string().max(4096) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.password);
    const supabase = serverSupabase({ admin: true });
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: data.key, value: data.value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
