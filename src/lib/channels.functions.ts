// Public read + admin-authenticated write for the channels table.
// Reads use the anon publishable key + a public SELECT policy so the homepage
// works during SSR with no session. Writes are gated by a shared admin
// password (server env ADMIN_PASSWORD) and executed with the service role
// client so RLS is bypassed for legitimate admin edits.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export interface ChannelRow {
  slug: string;
  name: string;
  category: string;
  logo_url: string;
  stream_url: string;
  match_alias: string | null;
  sort_order: number;
  is_active: boolean;
  is_custom: boolean;
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  logo_url: z.string().optional(),
  stream_url: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

function requirePassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("Server not configured (ADMIN_PASSWORD missing).");
  if (pw !== expected) throw new Error("Unauthorized");
}

/** Public list — used by the homepage and admin panel. */
export const listChannels = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase
    .from("channels")
    .select("slug,name,category,logo_url,stream_url,match_alias,sort_order,is_active,is_custom")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChannelRow[];
});

/** Update any subset of columns on a channel by slug. */
export const adminUpdateChannel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string(), slug: z.string(), patch: patchSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    requirePassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("channels")
      .update(data.patch)
      .eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Bulk set is_active for a list of slugs. */
export const adminSetActive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string(), slugs: z.array(z.string()), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    requirePassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("channels")
      .update({ is_active: data.is_active })
      .in("slug", data.slugs);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Insert a new channel (used by the admin "Add channel" modal). */
export const adminInsertChannel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        channel: z.object({
          slug: z.string().min(1),
          name: z.string().min(1),
          category: z.string().min(1),
          logo_url: z.string().default(""),
          stream_url: z.string().min(1),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    requirePassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("channels").insert({
      ...data.channel,
      is_custom: true,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a channel (custom rows only — built-in slugs are preserved). */
export const adminDeleteChannel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string(), slug: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    requirePassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("channels")
      .delete()
      .eq("slug", data.slug)
      .eq("is_custom", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
