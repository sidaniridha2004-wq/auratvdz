import { useEffect, useState } from "react";
import { categoryColorForGroup } from "@/lib/channel-category";

interface Props {
  src?: string;
  name: string;
  group?: string;
  className?: string;
  size?: number;
}

function initials(name: string): string {
  const clean = name.replace(/\b(HD|FHD|4K|SD|UHD)\b/gi, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? name[0] ?? "?";
  const b = parts.length > 1 ? parts[1][0] : "";
  return (a + b).toUpperCase();
}

/**
 * Channel logo with a lightweight text fallback. The fallback is drawn with
 * CSS instead of the old 2 MB placeholder PNG.
 */
export function ChannelLogo({ src, name, group, className = "", size = 48 }: Props) {
  const [broken, setBroken] = useState(!src);
  useEffect(() => setBroken(!src), [src]);
  const style = { width: size, height: size };

  if (broken || !src) {
    return (
      <div
        role="img"
        aria-label={`${name} logo`}
        className={`flex items-center justify-center rounded-sm font-display font-semibold text-white ${className}`}
        style={{ ...style, background: categoryColorForGroup(group ?? ""), fontSize: Math.max(11, size * 0.34) }}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} logo`}
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`rounded-sm bg-white object-contain p-0.5 ${className}`}
      style={style}
    />
  );
}
