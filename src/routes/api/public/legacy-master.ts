import { createFileRoute } from "@tanstack/react-router";
import { serverSupabase } from "@/lib/admin-auth.server";
import { signedProxyUrl, type ProxyTarget } from "@/lib/stream-sign.server";
import { findChannelBySlug } from "@/lib/m3u-channels";

// Redirects to a signed proxy URL. Database-managed channels are preferred;
// the bundled catalogue is used when the database has no row for a fallback
// channel, so the site still has playable entries during an API outage.

function parsePipeUrl(raw: string): ProxyTarget | null {
  const parts = raw.split("|");
  const url = parts[0]?.trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const t: ProxyTarget = { url };
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const eq = seg.indexOf("=");
    if (eq <= 0) continue;
    const k = seg.slice(0, eq).trim().toLowerCase();
    const v = seg.slice(eq + 1).trim();
    if (!v || v.length > 512) continue;
    if (k === "user-agent") t.ua = v;
    else if (k === "referer" || k === "origin") t.referer = t.referer ?? v;
  }
  return t;
}

export const Route = createFileRoute("/api/public/legacy-master")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = (url.searchParams.get("slug") ?? "").trim();
        if (!/^[a-z0-9-]{1,80}$/.test(slug)) return new Response("bad slug", { status: 400 });

        // Use a static entry as the immediate fallback, then prefer an active
        // admin-managed row when Supabase is configured and contains one.
        let streamUrl = findChannelBySlug(slug)?.url ?? "";
        try {
          const supabase = serverSupabase();
          const { data } = await supabase
            .from("channels")
            .select("stream_url,is_active")
            .eq("slug", slug)
            .maybeSingle();
          if (data?.is_active && data.stream_url) streamUrl = String(data.stream_url);
        } catch {
          // Static catalogue remains available when Supabase is not configured.
        }

        const target = parsePipeUrl(streamUrl);
        if (!target) return new Response("not found", { status: 404 });

        return new Response(null, {
          status: 302,
          headers: {
            location: await signedProxyUrl(target),
            "cache-control": "private, max-age=20",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
