import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

async function requirePassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (expected && expected.length > 0) {
    const a = new TextEncoder().encode(pw);
    const b = new TextEncoder().encode(expected);
    if (a.length !== b.length) throw new Error("Unauthorized");
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    if (diff !== 0) throw new Error("Unauthorized");
    return;
  }

  const supabase = await createPublicClient();
  const { data, error } = await (supabase as any).rpc("admin_password_matches", {
    _password: pw,
  });
  if (error || data !== true) throw new Error("Unauthorized");
}

async function createPublicClient(adminPassword?: string) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        headers: adminPassword ? { "x-auratv-admin-password": adminPassword } : {},
      },
    },
  );
}

export const adminSetMatchOverride = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ 
      password: z.string(), 
      matchId: z.string(), 
      channelSlug: z.string() // empty string to clear the override
    }).parse(input),
  )
  .handler(async ({ data }) => {
    await requirePassword(data.password);
    const supabase = await createPublicClient(data.password);
    
    // First, find any channel that currently has this matchId inside its match_alias
    const { data: channels, error: fetchError } = await supabase
      .from("channels")
      .select("slug, match_alias")
      .like("match_alias", `%${data.matchId}%`);
      
    if (fetchError) throw new Error(fetchError.message);
    
    // Remove the matchId from those channels
    for (const channel of channels || []) {
      if (!channel.match_alias) continue;
      
      const aliases = channel.match_alias.split(",").map(a => a.trim()).filter(a => a !== data.matchId && a !== "");
      const newAlias = aliases.join(", ");
      
      await supabase
        .from("channels")
        .update({ match_alias: newAlias })
        .eq("slug", channel.slug);
    }
    
    // If a new channel was selected, add the matchId to its match_alias
    if (data.channelSlug) {
      const { data: targetCh, error: targetError } = await supabase
        .from("channels")
        .select("slug, match_alias")
        .eq("slug", data.channelSlug)
        .single();
        
      if (targetError) throw new Error(targetError.message);
      
      const currentAliases = targetCh.match_alias 
        ? targetCh.match_alias.split(",").map(a => a.trim()).filter(a => a !== "")
        : [];
        
      if (!currentAliases.includes(data.matchId)) {
        currentAliases.push(data.matchId);
        
        await supabase
          .from("channels")
          .update({ match_alias: currentAliases.join(", ") })
          .eq("slug", data.channelSlug);
      }
    }
    
    return { ok: true };
  });
