import { createServerFn } from "@tanstack/react-start";

// Server function that returns the current channel-status snapshot.
// Loads the server-only store lazily inside the handler (route/module
// graph is client-reachable; only handler bodies are stripped).

export const getChannelStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getSnapshot, triggerSweepIfStale, sweepAll } = await import("./probe-store.server");
  const snap = getSnapshot();
  if (snap.checked === 0) {
    await sweepAll(true);
  } else {
    triggerSweepIfStale();
  }
  const { getSnapshot: refresh } = await import("./probe-store.server");
  return refresh();
});
