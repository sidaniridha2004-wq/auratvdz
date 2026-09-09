// Playback progress kept in localStorage so a title resumes where it was
// left. Nothing here leaves the device.

export interface Progress {
  /** Seconds watched. */
  t: number;
  /** Duration in seconds, when known. */
  d: number;
  /** Unix ms of the last save. */
  at: number;
  season?: number;
  episode?: number;
}

const PREFIX = "auratv:resume:";
const MIN_RESUME_SECONDS = 30;
const TAIL_SECONDS = 90;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function movieKey(id: number): string {
  return `movie:${id}`;
}

export function episodeKey(id: number, season: number, episode: number): string {
  return `tv:${id}:${season}:${episode}`;
}

/** Pointer to the most recently watched episode of a show. */
export function showKey(id: number): string {
  return `tv:${id}`;
}

export function readProgress(key: string): Progress | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(PREFIX + key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Progress;
    if (typeof p.t !== "number" || !Number.isFinite(p.t)) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveProgress(key: string, p: Progress): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(PREFIX + key, JSON.stringify(p));
  } catch {
    // Storage full or blocked; resume is best-effort.
  }
}

export function clearProgress(key: string): void {
  storage()?.removeItem(PREFIX + key);
}

/** Where playback should start: 0 if never watched or already finished. */
export function resumePoint(p: Progress | null): number {
  if (!p) return 0;
  if (p.t < MIN_RESUME_SECONDS) return 0;
  if (p.d > 0 && p.t > p.d - TAIL_SECONDS) return 0;
  return Math.floor(p.t);
}

export function isFinished(p: Progress | null): boolean {
  return Boolean(p && p.d > 0 && p.t > p.d - TAIL_SECONDS);
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}
