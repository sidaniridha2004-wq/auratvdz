// Reserved advertising area. Keeps a stable height so the page does not jump
// when an ad network fills it. Wire your network's script here.
export function AdSlot({ id, className = "" }: { id: string; className?: string }) {
  return (
    <aside id={id} role="complementary" aria-label="Advertisement" className={`rule min-h-[90px] rounded-md bg-card ${className}`} />
  );
}
