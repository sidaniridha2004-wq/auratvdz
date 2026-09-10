/**
 * D-pad focus management for Android TV and the Capacitor shell.
 *
 * Arrow keys move focus spatially, Enter clicks, and the Back key is left to
 * the native handler. Nothing here runs on an ordinary desktop browser.
 */

interface OrientationLock {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
}

export function isAndroidTV(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android") && (ua.includes(" tv") || ua.includes("aft"))) return true;
  return window.matchMedia("(pointer: none)").matches && window.innerWidth >= 960;
}

export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & { Capacitor?: unknown }).Capacitor);
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
].join(", ");

function getFocusableElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden",
  );
}

type Direction = "up" | "down" | "left" | "right";

function findNextFocusable(current: HTMLElement, direction: Direction): HTMLElement | null {
  const currentRect = current.getBoundingClientRect();
  const cx = currentRect.left + currentRect.width / 2;
  const cy = currentRect.top + currentRect.height / 2;

  let best: HTMLElement | null = null;
  let bestDistance = Infinity;

  for (const el of getFocusableElements()) {
    if (el === current) continue;
    const rect = el.getBoundingClientRect();
    const ex = rect.left + rect.width / 2;
    const ey = rect.top + rect.height / 2;

    const inDirection =
      direction === "up" ? ey < cy - 5 : direction === "down" ? ey > cy + 5 : direction === "left" ? ex < cx - 5 : ex > cx + 5;
    if (!inDirection) continue;

    const dx = ex - cx;
    const dy = ey - cy;
    const distance =
      direction === "up" || direction === "down" ? Math.abs(dy) + Math.abs(dx) * 2.5 : Math.abs(dx) + Math.abs(dy) * 2.5;

    if (distance < bestDistance) {
      bestDistance = distance;
      best = el;
    }
  }
  return best;
}

function reveal(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function handleDpadNavigation(e: KeyboardEvent) {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (e.key === "Enter" || e.key === " ") {
    if (focused && focused !== document.body) {
      // Never steal keys from text entry — space must type a space.
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName) || focused.isContentEditable) return;
      e.preventDefault();
      focused.click();
    }
    return;
  }

  const direction = DIRECTIONS[e.key];
  if (!direction) return;

  if (!focused || focused === document.body) {
    const first = getFocusableElements()[0];
    if (first) {
      e.preventDefault();
      first.focus();
      reveal(first);
    }
    return;
  }

  const next = findNextFocusable(focused, direction);
  if (next) {
    e.preventDefault();
    next.focus();
    reveal(next);
  }
}

let initialized = false;
let observer: MutationObserver | null = null;

/** Safe to call more than once; only the first call does anything. */
export function initTvNavigation() {
  if (initialized || typeof window === "undefined") return;

  const tv = isAndroidTV();
  const capacitor = isCapacitor();
  if (!tv && !capacitor) return;

  initialized = true;
  if (tv) document.documentElement.classList.add("tv-mode");
  if (capacitor) document.documentElement.classList.add("capacitor");

  document.addEventListener("keydown", handleDpadNavigation, { passive: false });

  if (tv) {
    observer = new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>('.tile-hover, [role="button"]').forEach((el) => {
        if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

export function destroyTvNavigation() {
  if (!initialized) return;
  document.removeEventListener("keydown", handleDpadNavigation);
  observer?.disconnect();
  observer = null;
  initialized = false;
}

/**
 * Full-screen plus landscape lock for phones and TVs. Must be called from a
 * user gesture handler or the browser will refuse.
 */
export async function requestImmersiveMode() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.innerWidth >= 1024 && !isAndroidTV()) return;

  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
    const orientation = screen.orientation as unknown as OrientationLock | undefined;
    if (orientation?.lock) await orientation.lock("landscape").catch(() => undefined);
  } catch {
    // Not permitted (no gesture, iOS Safari, or unsupported). The player still
    // works inline, so there is nothing to report.
  }
}

export async function exitImmersiveMode() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    const orientation = screen.orientation as unknown as OrientationLock | undefined;
    orientation?.unlock?.();
  } catch {
    // Already exited or unsupported.
  }
}
