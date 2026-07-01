import { useEffect, useState } from "react";
import { categoryColorForGroup } from "@/lib/channel-category";

interface Props {
  src?: string;
  name: string;
  /** Original channel group label; used to pick the fallback color. */
  group?: string;
  className?: string;
  size?: number;
}

function firstLetter(name: string): string {
  const clean = name.replace(/\b(HD|FHD|4K|SD)\b/gi, "").trim();
  return (clean[0] || name[0] || "?").toUpperCase();
}

export function ChannelLogo({ src, name, group, className = "", size = 48 }: Props) {
  const [broken, setBroken] = useState(!src);
  const color = categoryColorForGroup(group ?? "");
  const style = { width: size, height: size };

  if (broken || !src) {
    return (
      <div
        className={`flex items-center justify-center rounded-full font-bold text-white shadow-inner ${className}`}
        style={{ ...style, background: color, fontSize: Math.round(size * 0.42) }}
        aria-label={name}
      >
        {firstLetter(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={className}
      style={{
        ...style,
        objectFit: "contain",
        borderRadius: 8,
        background: "#fff",
        padding: 2,
      }}
    />
  );
}
