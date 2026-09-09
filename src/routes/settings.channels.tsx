import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { PageShell, SideNote } from "@/components/PageShell";
import { useCustomChannels, type CustomSource } from "@/lib/custom-channels";
import { CATEGORY_META, type ChannelCategory } from "@/lib/channel-category";
import { useI18n } from "@/lib/i18n";
import { pageHead } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "My channels", path: "/settings/channels" },
];

export const Route = createFileRoute("/settings/channels")({
  component: SettingsChannels,
  head: () =>
    pageHead({
      title: "My channels",
      description: "Add your own HLS (.m3u8) streams to AuraTV. Custom channels are stored on your device only and never uploaded.",
      path: "/settings/channels",
      jsonLd: breadcrumbJsonLd(CRUMBS),
    }),
});

const CATS: ChannelCategory[] = ["sports", "movies", "kids", "news", "general"];
const isHttpUrl = (v: string) => /^https?:\/\/[^\s]+$/i.test(v.trim());

function SettingsChannels() {
  const { t } = useI18n();
  const { channels, add, remove } = useCustomChannels();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ChannelCategory>("sports");
  const [logo, setLogo] = useState("");
  const [sources, setSources] = useState<CustomSource[]>([{ quality: "Auto", url: "" }]);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = sources.map((s) => ({ quality: s.quality.trim().slice(0, 24), url: s.url.trim() })).filter((s) => s.url.length > 0);
    if (!name.trim()) return setError("Give the channel a name.");
    if (clean.length === 0) return setError("Add at least one stream URL.");
    if (clean.some((s) => !isHttpUrl(s.url))) return setError("Stream URLs must start with http:// or https://.");
    if (logo.trim() && !isHttpUrl(logo)) return setError("The logo URL must start with http:// or https://.");
    add({ name: name.trim().slice(0, 80), category, logo: logo.trim() || undefined, sources: clean });
    setName("");
    setLogo("");
    setSources([{ quality: "Auto", url: "" }]);
  };

  return (
    <PageShell
      crumbs={CRUMBS}
      kicker="Settings"
      title={t("settings.title")}
      lede={t("settings.subtitle")}
      aside={
        <>
          <SideNote title="Privacy">
            Channels you add here are saved in this browser only. They are never sent to AuraTV and play directly from the URL you enter.
          </SideNote>
          <SideNote title="Supported formats">HLS playlists ending in .m3u8. Direct MP4 links work in most browsers too.</SideNote>
        </>
      }
    >
      <form onSubmit={submit} className="tile space-y-5 p-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="kicker mb-1.5 block">{t("settings.name")}</span>
            <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="field" autoComplete="off" />
          </label>
          <label className="block">
            <span className="kicker mb-1.5 block">{t("settings.category")}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as ChannelCategory)} className="field">
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="kicker mb-1.5 block">{t("settings.logo")}</span>
          <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://" inputMode="url" className="field" />
        </label>

        <fieldset className="space-y-2">
          <legend className="kicker mb-1.5">Streams</legend>
          {sources.map((s, i) => (
            <div key={i} className="grid grid-cols-[100px_1fr_auto] gap-2">
              <input
                aria-label={t("settings.quality")}
                value={s.quality}
                onChange={(e) => setSources((arr) => arr.map((x, j) => (i === j ? { ...x, quality: e.target.value } : x)))}
                placeholder={t("settings.quality")}
                className="field"
              />
              <input
                aria-label={t("settings.stream_url")}
                value={s.url}
                onChange={(e) => setSources((arr) => arr.map((x, j) => (i === j ? { ...x, url: e.target.value } : x)))}
                placeholder={t("settings.stream_url")}
                inputMode="url"
                className="field"
              />
              <button
                type="button"
                onClick={() => setSources((arr) => arr.filter((_, j) => j !== i))}
                disabled={sources.length === 1}
                aria-label="Remove this stream"
                className="btn btn-ghost px-3 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setSources((arr) => [...arr, { quality: "", url: "" }])} className="kicker text-primary hover:underline">
            + {t("settings.add_source")}
          </button>
        </fieldset>

        {error && (
          <p role="alert" className="text-[13px] text-primary">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary">
          {t("settings.save")}
        </button>
      </form>

      <h2 className="rule-heavy mb-4 mt-10 pt-3 text-[1.4rem]">
        {channels.length} {channels.length === 1 ? "channel" : "channels"}
      </h2>
      {channels.length === 0 ? (
        <div className="tile p-8 text-center text-[14px] text-muted-foreground">{t("settings.empty")}</div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {channels.map((c) => (
            <li key={c.id} className="tile flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link to="/watch/tv/$key" params={{ key: c.id }} search={{ name: c.name }} className="font-semibold hover:underline" dir="auto">
                  {c.name}
                </Link>
                <div className="text-[12px] text-muted-foreground">
                  {CATEGORY_META[c.category].label} · {c.sources.length} source{c.sources.length === 1 ? "" : "s"}
                </div>
              </div>
              <button type="button" onClick={() => remove(c.id)} className="btn btn-ghost btn-sm text-primary">
                {t("settings.remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
