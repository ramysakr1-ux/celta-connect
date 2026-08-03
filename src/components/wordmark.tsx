// "Connect" in gold/brass (the ownable brand word) + "CELTA" in black
// uppercase (the formal, Cambridge-respecting word) -- the split itself
// signals which part is the owner's and which part is being served. See
// architecture-plan.md's BRAND section. Gold reads faint on white at small
// sizes, so `onDark` swaps "Connect" to a lighter gold tone for use on a
// teal/dark tile instead of raising opacity, which would look muddy.
export function Wordmark({
  size = "md",
  onDark = false,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
  className?: string;
}) {
  const sizeClass = { sm: "text-lg", md: "text-xl", lg: "text-2xl" }[size];

  return (
    <span className={`font-serif font-medium ${sizeClass} ${className}`}>
      <span className={onDark ? "text-gold" : "text-gold"}>Connect</span>{" "}
      <span className={onDark ? "text-card" : "text-ink"}>CELTA</span>
    </span>
  );
}
