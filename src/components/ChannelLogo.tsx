import { useState } from "react";

interface Props {
  src?: string;
  name: string;
  className?: string;
}

function initials(name: string): string {
  const words = name
    .replace(/\bHD\b|\bFHD\b|\b4K\b|\bSD\b/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (letters || name.slice(0, 2)).toUpperCase();
}

// Deterministic gradient based on name so channels look distinct.
function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 45%), hsl(${h2} 70% 35%))`;
}

/**
 * Renders a channel logo with a colored initials fallback whenever the
 * remote logo fails to load (broken Wikipedia URLs, cross-origin blocks…).
 */
export function ChannelLogo({ src, name, className = "" }: Props) {
  const [broken, setBroken] = useState(!src);
  if (broken || !src) {
    return (
      <div
        className={`flex items-center justify-center rounded-md text-[10px] font-bold text-white shadow-inner ${className}`}
        style={{ background: gradientFor(name) }}
        aria-label={name}
      >
        {initials(name)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`object-contain ${className}`}
    />
  );
}
