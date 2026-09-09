// Public read + admin-gated writes for the "Now on TV" strip.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, serverSupabase } from "@/lib/admin-auth.server";

export interface NowOnTvRow {
  id: string;
  channel_slug: string;
  title: string;
  subtitle: string;
  sort_order: number;
  is_active: boolean;
}

const itemSchema = z.object({
  channel_slug: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  subtitle: z.string().max(200).default(""),
  sort_order: z.number().int().min(-100000).max(100000).default(0),
  is_active: z.boolean().default(true),
});
const patchSchema = itemSchema.partial();

export const listNowOnTv = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from("now_on_tv")
    .select("id,channel_slug,title,subtitle,sort_order,is_active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as NowOnTvRow[];
});

export const adminInsertNowOnTv = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string(), item: itemSchema }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin(data.password);
    const supabase = serverSupabase({ admin: true });
    const { error } = await supabase.from("now_on_tv").insert(data.item);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateNowOnTv = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string(), id: z.string().uuid(), patch: patchSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.password);
    const supabase = serverSupabase({ admin: true });
    const { error } = await supabase.from("now_on_tv").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteNowOnTv = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string(), id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin(data.password);
    const supabase = serverSupabase({ admin: true });
    const { error } = await supabase.from("now_on_tv").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
