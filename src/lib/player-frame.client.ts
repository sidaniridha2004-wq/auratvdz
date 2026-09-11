// Some third-party video providers refuse to load when an iframe has any
// sandbox attribute. Install this before the player renders so current and
// newly switched provider frames are reloaded without that restriction.

const PROVIDER_HOSTS = ["vixsrc.to", "vaplayer.ru", "multiembed.cc", "vidfast.vc"];
let installed = false;

function isProviderFrame(frame: HTMLIFrameElement): boolean {
  const src = frame.getAttribute("src");
  if (!src) return false;
  try {
    const host = new URL(src, window.location.href).hostname;
    return PROVIDER_HOSTS.some((provider) => host === provider || host.endsWith(`.${provider}`));
  } catch {
    return false;
  }
}

function unlock(frame: HTMLIFrameElement): void {
  if (!frame.hasAttribute("sandbox") || !isProviderFrame(frame)) return;
  const src = frame.getAttribute("src");
  frame.removeAttribute("sandbox");
  // Reload because sandbox permissions are fixed when navigation begins.
  if (src) {
    frame.src = "about:blank";
    queueMicrotask(() => {
      if (frame.isConnected) frame.src = src;
    });
  }
}

export function ensureUnsandboxedPlayerFrames(): void {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  if (!document.body) {
    window.setTimeout(ensureUnsandboxedPlayerFrames, 0);
    return;
  }
  installed = true;
  document.querySelectorAll<HTMLIFrameElement>("iframe[sandbox]").forEach(unlock);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node instanceof HTMLIFrameElement) unlock(node);
        node.querySelectorAll<HTMLIFrameElement>("iframe[sandbox]").forEach(unlock);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
