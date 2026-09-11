// These video providers refuse to run with any iframe sandbox attribute.
// Install this before the player renders and prevent React hydration or later
// server switches from applying that attribute again.

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
  // A sandbox policy is fixed when navigation starts, so restart that
  // navigation after removing the attribute.
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

  // React can restore a mismatched SSR attribute while hydrating. Prevent that
  // write for our known player providers so the iframe is unsandboxed from the
  // beginning of every client-side navigation.
  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function setAttributeWithoutPlayerSandbox(name: string, value: string): void {
    if (name.toLowerCase() === "sandbox" && this instanceof HTMLIFrameElement && isProviderFrame(this)) return;
    nativeSetAttribute.call(this, name, value);
  };

  document.querySelectorAll<HTMLIFrameElement>("iframe[sandbox]").forEach(unlock);
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLIFrameElement) {
        unlock(record.target);
        continue;
      }
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node instanceof HTMLIFrameElement) unlock(node);
        node.querySelectorAll<HTMLIFrameElement>("iframe[sandbox]").forEach(unlock);
      }
    }
  }).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["sandbox"],
  });
}
