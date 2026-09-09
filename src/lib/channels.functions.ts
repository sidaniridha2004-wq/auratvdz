// Public read + admin-gated writes for the channels table.
// Reads use the publishable key. Writes run only after `requireAdmin` accepts
// the caller's session token, then use the service-role key server-side.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  adminConfigured,
  issueAdminToken,
  passwordMatches,
  requireAdmin,
  serverSupabase,
} from "@/lib/admin-auth.server";

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

const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/);
const urlSchema = z.string().max(2048).refine((v) => v === "" || /^https?:\/\//i.test(v), "URL must start with http(s)://");

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(60).optional(),
  logo_url: urlSchema.optional(),
  stream_url: z.string().min(1).max(4096).optional(),
  is_active: z.boolean().optional(),
});

/**
 * Sign in. Accepts the raw password once and returns a session token that the
 * browser stores instead of the password.
 */
export const adminVerifyPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string().max(256) }).parse(input))
  .handler(async ({ data }) => {
    if (!adminConfigured()) return { ok: false as const, reason: "not_configured" as const };
    if (!passwordMatches(data.password)) return { ok: false as const, reason: "invalid" as const };
    return { ok: true as const, token: await issueAdminToken() };
  });

/** Validates an existing session token (used on page load). */
export const adminCheckSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().max(512) }).parse(input))
  .handler(async ({ data }) => {
    try {
      await requireAdmin(data.token);
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

/** Public list — legacy Supabase catalogue (hidden in the public UI). */
export const listChannels = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from("channels")
    .select("slug,name,category,logo_url,stream_url,match_alias,sort_order,is_active,is_custom")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChannelRow[];
});

export const adminUpdateChannel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string(), slug: slugSchema, patch: patchSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.password);
    const supabase = serverSupabase({ admin: true });
    const { error } = await supabase.from("channels").update(data.patch).eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetActive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ password: z.string(), slugs: z.array(slugSchema).max(500), is_active: z.boolean() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.password);
    const supabase = serverSupabase({ admin: true });
    const { error } = await supabase
      .from("channels")
      .update({ is_active: data.is_active })
      .in("slug", data.slugs);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminInsertChannel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        channel: z.object({
          slug: slugSchema,
          name: z.string().min(1).max(120),
          category: z.string().min(1).max(60),
          logo_url: urlSchema.default(""),
          stream_url: z.string().min(1).max(4096),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.password);
    const supabase = serverSupabase({ admin: true });
    const { error } = await supabase
      .from("channels")
      .insert({ ...data.channel, is_custom: true, is_active: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteChannel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string(), slug: slugSchema }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin(data.password);
    const supabase = serverSupabase({ admin: true });
    const { error } = await supabase.from("channels").delete().eq("slug", data.slug).eq("is_custom", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
