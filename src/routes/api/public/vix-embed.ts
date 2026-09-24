import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://vixsrc.to";

function plain(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

function launcher(target: string): Response {
  const encoded = JSON.stringify(target).replace(/</g, "\\u003c");
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Open Vix player</title>
<style>
html,body{height:100%;margin:0;background:#050505;color:#fff;font-family:system-ui,-apple-system,sans-serif}main{height:100%;display:grid;place-items:center;padding:24px;box-sizing:border-box;text-align:center}.box{max-width:430px}h1{font-size:22px;margin:0 0 10px}p{color:#b9b9b9;line-height:1.5;margin:0 0 22px}button{appearance:none;border:0;border-radius:999px;background:#d9272f;color:#fff;font:700 16px system-ui;padding:14px 24px;cursor:pointer}small{display:block;color:#777;margin-top:14px}
</style>
</head>
<body><main><div class="box"><h1>Open Server 2 · Vix</h1><p>Vix blocks playback inside other sites. Open its player directly, then use Back to return to AuraTV.</p><button id="open" type="button">Open Vix player</button><small>This avoids the provider's iframe restriction.</small></div></main>
<script>document.getElementById("open").addEventListener("click",function(){window.top.location.href=${encoded}});</script>
</body></html>`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "SAMEORIGIN",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'",
      "referrer-policy": "no-referrer",
    },
  });
}

export const Route = createFileRoute("/api/public/vix-embed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const kind = url.searchParams.get("kind");
        const id = Number(url.searchParams.get("id"));
        const season = Number(url.searchParams.get("season") ?? "1");
        const episode = Number(url.searchParams.get("episode") ?? "1");
        if ((kind !== "movie" && kind !== "tv") || !Number.isInteger(id) || id <= 0) {
          return plain(400, "invalid title");
        }
        if (kind === "tv" && (!Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 1)) {
          return plain(400, "invalid episode");
        }

        const path = kind === "movie" ? `/movie/${id}/` : `/tv/${id}/${season}/${episode}/`;
        const target = new URL(path, BASE);
        target.searchParams.set("autoplay", "false");
        target.searchParams.set("lang", "en");
        return launcher(target.toString());
      },
    },
  },
});
