// Last-resort HTML returned when the SSR pipeline itself falls over. It has to
// be self-contained (no CSS bundle, no JS) and match the site's look.
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Something broke on our side &mdash; AuraTV</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <style>
      html { background: #0f0e0c; color: #f1ece2; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; font: 16px/1.55 Georgia, "Times New Roman", serif; }
      main { max-width: 34rem; width: 100%; border-top: 3px solid #d9272f; padding-top: 20px; }
      .k { font: 700 11px/1 Arial, Helvetica, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #f0b429; margin: 0 0 14px; }
      h1 { font: 800 clamp(28px, 5vw, 40px)/1.05 Arial, Helvetica, sans-serif; letter-spacing: -.02em; margin: 0 0 12px; }
      p { color: #b9b2a4; margin: 0 0 24px; }
      .a { display: flex; gap: 10px; flex-wrap: wrap; }
      a, button { font: 700 14px/1 Arial, Helvetica, sans-serif; padding: 12px 18px; border-radius: 4px; cursor: pointer; text-decoration: none; border: 1px solid #f1ece2; color: #f1ece2; background: transparent; }
      .p { background: #d9272f; border-color: #d9272f; color: #fff; }
      small { display: block; margin-top: 28px; color: #77716a; font: 12px/1.4 Arial, Helvetica, sans-serif; }
    </style>
  </head>
  <body>
    <main>
      <p class="k">Error 500</p>
      <h1>Something broke on our side.</h1>
      <p>The page could not be built. It is usually a passing fault; try again in a moment. If it keeps happening, tell us on Telegram and we will look at it straight away.</p>
      <div class="a">
        <button class="p" onclick="location.reload()">Try again</button>
        <a href="/">Back to today's fixtures</a>
        <a href="/status">Channel status</a>
      </div>
      <small>AuraTV &middot; Live sport and TV guide for Algeria</small>
    </main>
  </body>
</html>`;
}
