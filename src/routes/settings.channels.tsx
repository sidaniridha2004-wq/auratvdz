import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { useCustomChannels, type CustomSource } from "@/lib/custom-channels";
import { CATEGORY_META, type ChannelCategory } from "@/lib/channel-category";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/settings/channels")({
  component: SettingsChannels,
  head: () => ({
    meta: [
      { title: "My Channels — AuraTV" },
      { name: "description", content: "Add your own live channels and streams." },
      { property: "og:title", content: "My Channels — AuraTV" },
      { property: "og:description", content: "Add your own live channels and streams." },
      { property: "og:url", content: "https://auratvdz.lovable.app/settings/channels" },
    ],
    links: [{ rel: "canonical", href: "https://auratvdz.lovable.app/settings/channels" }],
  }),
});

const CATS: ChannelCategory[] = ["sports", "movies", "kids", "news", "general"];

function SettingsChannels() {
  const { t } = useI18n();
  const { channels, add, remove } = useCustomChannels();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ChannelCategory>("sports");
  const [logo, setLogo] = useState("");
  const [sources, setSources] = useState<CustomSource[]>([{ quality: "Auto", url: "" }]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sources.filter((s) => s.url.trim().length > 0);
    if (!name.trim() || clean.length === 0) return;
    add({ name: name.trim(), category, logo: logo.trim() || undefined, sources: clean });
    setName("");
    setLogo("");
    setSources([{ quality: "Auto", url: "" }]);
  };

  return (
    <div className="min-h-screen bg-hero">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>

        <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-card/60 p-5 backdrop-blur">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("settings.name")}</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("settings.category")}</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as ChannelCategory)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none">
                {CATS.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("settings.logo")}</span>
            <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>

          <div className="space-y-2">
            {sources.map((s, i) => (
              <div key={i} className="grid grid-cols-[110px_1fr_auto] gap-2">
                <input
                  value={s.quality}
                  onChange={(e) => setSources((arr) => arr.map((x, j) => (i === j ? { ...x, quality: e.target.value } : x)))}
                  placeholder={t("settings.quality")}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                />
                <input
                  value={s.url}
                  onChange={(e) => setSources((arr) => arr.map((x, j) => (i === j ? { ...x, url: e.target.value } : x)))}
                  placeholder={t("settings.stream_url")}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setSources((arr) => arr.filter((_, j) => j !== i))}
                  disabled={sources.length === 1}
                  className="rounded-xl border border-white/10 px-3 text-muted-foreground disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSources((arr) => [...arr, { quality: "", url: "" }])}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {t("settings.add_source")}
            </button>
          </div>

          <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
            <Plus className="h-4 w-4" /> {t("settings.save")}
          </button>
        </form>

        <h2 className="mt-10 mb-4 font-display text-xl font-bold">
          {channels.length} {channels.length === 1 ? "channel" : "channels"}
        </h2>
        {channels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
            {t("settings.empty")}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card/60 p-4">
                <div className="min-w-0">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{CATEGORY_META[c.category].label} · {c.sources.length} source{c.sources.length === 1 ? "" : "s"}</div>
                </div>
                <button onClick={() => remove(c.id)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                  {t("settings.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Footer />
    </div>
  );
}
