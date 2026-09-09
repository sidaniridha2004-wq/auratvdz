import { createServerFn } from "@tanstack/react-start";

import type {
  YacineDirectory,
  YacineEvent,
} from "./yacine-api.server";

export type {
  YacineCategory,
  YacineChannel,
  YacineDirectory,
  YacineEvent,
  YacineTeam,
} from "./yacine-api.server";

export const getYacineEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<YacineEvent[]> => {
    const { fetchYacineEvents } = await import("./yacine-api.server");
    return fetchYacineEvents();
  },
);

export const getYacineDirectory = createServerFn({ method: "GET" }).handler(
  async (): Promise<YacineDirectory> => {
    const { fetchYacineDirectory } = await import("./yacine-api.server");
    return fetchYacineDirectory();
  },
);
