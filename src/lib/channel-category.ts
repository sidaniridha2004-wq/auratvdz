// Client-safe channel categorization + color mapping.

export type ChannelCategory = "sports" | "movies" | "kids" | "news" | "general";

export function categoryFor(group: string, name = ""): ChannelCategory {
  const g = (group + " " + name).toLowerCase();
  if (/sport|bein|rmc|canal\+ sport|ontime|espn/.test(g)) return "sports";
  if (/kid|disney|nick|toon|baraem|jr\b|junior/.test(g)) return "kids";
  if (/news|nahar|barlamaniya|echorouk news/.test(g)) return "news";
  if (/movie|cinema|osn|action hd|frisson|ciné|film|premier/.test(g)) return "movies";
  return "general";
}

/**
 * Fallback letter-avatar color for a channel, keyed on its GROUP label so
 * regional groups (Algeria TV, French TV, Maghreb) get their own tone.
 */
export function categoryColorForGroup(group: string): string {
  const g = group.toLowerCase();
  if (/bein|sport|rmc/.test(g)) return "#c0392b";           // red
  if (/movie|cinema|ciné/.test(g)) return "#2980b9";         // blue
  if (/series|drama/.test(g)) return "#8e44ad";              // purple
  if (/kid|disney|nick|toon|baraem/.test(g)) return "#f39c12"; // yellow
  if (/news/.test(g)) return "#7f8c8d";                      // grey
  if (/lifestyle|doc|documentary|nat geo|history/.test(g)) return "#27ae60"; // green
  if (/french tv|canal|osn/.test(g)) return "#e67e22";       // orange
  if (/algeria|maghreb|tunis|maroc/.test(g)) return "#16a085"; // teal
  return "#2c3e50";                                          // dark navy
}


export const CATEGORY_META: Record<
  ChannelCategory,
  { label: string; color: string; ring: string; text: string; bg: string }
> = {
  sports: {
    label: "SPORTS",
    color: "hsl(0 84% 55%)",
    ring: "ring-red-500/40",
    text: "text-red-300",
    bg: "bg-red-500/15",
  },
  movies: {
    label: "MOVIES",
    color: "hsl(220 90% 60%)",
    ring: "ring-blue-500/40",
    text: "text-blue-300",
    bg: "bg-blue-500/15",
  },
  kids: {
    label: "KIDS",
    color: "hsl(45 95% 55%)",
    ring: "ring-yellow-500/40",
    text: "text-yellow-300",
    bg: "bg-yellow-500/15",
  },
  news: {
    label: "NEWS",
    color: "hsl(220 8% 60%)",
    ring: "ring-slate-400/40",
    text: "text-slate-300",
    bg: "bg-slate-500/15",
  },
  general: {
    label: "GENERAL",
    color: "hsl(175 70% 45%)",
    ring: "ring-teal-500/40",
    text: "text-teal-300",
    bg: "bg-teal-500/15",
  },
};
