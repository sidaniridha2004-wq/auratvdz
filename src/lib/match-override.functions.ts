// Admin: force a fixture onto a specific channel by writing its id into the
// channel's comma-separated `match_alias` column.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, serverSupabase } from "@/lib/admin-auth.server";

const matchIdSchema = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);

function splitAliases(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const adminSetMatchOverride = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        password: z.string(),
        matchId: matchIdSchema,
        channelSlug: z.string().max(80),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.password);
    const supabase = serverSupabase({ admin: true });

    // Load every channel's alias list once and compute the change in memory.
    // No LIKE / wildcard queries, so the match id can't alter the filter.
    const { data: rows, error } = await supabase.from("channels").select("slug,match_alias");
    if (error) throw new Error(error.message);

    const updates: Array<{ slug: string; match_alias: string | null }> = [];
    for (const row of rows ?? []) {
      const aliases = splitAliases(row.match_alias as string | null);
      const has = aliases.includes(data.matchId);
      const shouldHave = row.slug === data.channelSlug && data.channelSlug !== "";
      if (has === shouldHave) continue;
      const next = shouldHave ? [...aliases, data.matchId] : aliases.filter((a) => a !== data.matchId);
      updates.push({ slug: row.slug as string, match_alias: next.length ? next.join(",") : null });
    }

    for (const u of updates) {
      const { error: e2 } = await supabase
        .from("channels")
        .update({ match_alias: u.match_alias })
        .eq("slug", u.slug);
      if (e2) throw new Error(e2.message);
    }
    return { ok: true, changed: updates.length };
  });
