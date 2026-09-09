import { createFileRoute } from "@tanstack/react-router";
import { serverSupabase } from "@/lib/admin-auth.server";
import { signedProxyUrl, type ProxyTarget } from "@/lib/stream-sign.server";

// Redirects to a signed proxy URL for a channel from the admin-managed
// `channels` table. The row's stream_url may carry IPTV pipe headers
// (`url|User-Agent=..|Referer=..`); those are parsed here, server-side, so
// the browser never gets to choose upstream headers.

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

        const supabase = serverSupabase();
        const { data, error } = await supabase
          .from("channels")
          .select("stream_url,is_active")
          .eq("slug", slug)
          .maybeSingle();
        if (error) return new Response("upstream error", { status: 502 });
        if (!data || !data.is_active || !data.stream_url) return new Response("not found", { status: 404 });

        const target = parsePipeUrl(String(data.stream_url));
        if (!target) return new Response("invalid stream", { status: 404 });

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
