// Inline SVG wordmark. Replaces the 1.6 MB PNG logo that used to be fetched
// from a third-party host on every page.

interface Props {
  className?: string;
  size?: number;
}

export function Mark({ size = 28, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="AuraTV"
      className={className}
    >
      <rect x="1" y="5" width="30" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 29h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 20l5-9 5 9M13.2 16.5h5.6" fill="none" stroke="#d9272f" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark />
      <span className="font-display text-[22px] font-semibold leading-none tracking-tight">
        Aura<span className="text-primary">TV</span>
      </span>
    </span>
  );
}
