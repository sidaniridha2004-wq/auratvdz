import { useState } from "react";
import { CATEGORY_META, type ChannelCategory } from "@/lib/channel-category";

interface Props {
  src?: string;
  name: string;
  category?: ChannelCategory;
  className?: string;
}

function initials(name: string): string {
  const words = name
    .replace(/\bHD\b|\bFHD\b|\b4K\b|\bSD\b/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0]).join("");
  return (letters || name.slice(0, 2)).toUpperCase();
}

export function ChannelLogo({ src, name, category, className = "" }: Props) {
  const [broken, setBroken] = useState(!src);
  if (broken || !src) {
    const color = category ? CATEGORY_META[category].color : "hsl(260 60% 55%)";
    const letter = initials(name).charAt(0);
    return (
      <div
        className={`flex items-center justify-center rounded-full text-sm font-bold text-white shadow-inner ${className}`}
        style={{ background: `radial-gradient(circle at 30% 30%, color-mix(in oklab, ${color} 90%, white 10%), ${color})` }}
        aria-label={name}
      >
        {letter}
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
      className={`object-contain ${className}`}
    />
  );
}
