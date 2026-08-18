// Original hand-drawn SVG art for the casino stages - card suits and slot
// symbols - used in place of plain Unicode glyphs/emoji for a cleaner,
// scalable, properly shaded look. No external assets or licensed artwork.

export type SuitName = "spade" | "heart" | "diamond" | "club";

const SUIT_PATHS: Record<SuitName, string> = {
  heart:
    "M12 21s-7.5-4.6-10-9.2C.4 8.6 2 5 5.5 5 8 5 10 6.6 12 9c2-2.4 4-4 6.5-4C22 5 23.6 8.6 22 11.8 19.5 16.4 12 21 12 21z",
  spade:
    "M12 2c3 4 8 7 8 11.5A5 5 0 0112 17a5 5 0 01-8-3.5C4 9 9 6 12 2zM9 18.5c1-.3 2-1 3-2.2 1 1.2 2 1.9 3 2.2-.4 1.6-1.6 2.8-3 3.3-1.4-.5-2.6-1.7-3-3.3z",
  diamond: "M12 2l7 10-7 10-7-10 7-10z",
  club: "M12 3a3.2 3.2 0 013.2 3.2c0 .5-.1.9-.3 1.3A3.2 3.2 0 1117 13c-.7 0-1.3-.2-1.9-.5.6 1.8 2 3.2 2.9 4.5H6c.9-1.3 2.3-2.7 2.9-4.5-.6.3-1.2.5-1.9.5a3.2 3.2 0 11.1-6.5c-.2-.4-.3-.8-.3-1.3A3.2 3.2 0 0112 3z",
};

export function SuitIcon({ suit, className }: { suit: SuitName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d={SUIT_PATHS[suit]} />
    </svg>
  );
}

export type SlotSymbolName = "cherry" | "lemon" | "bell" | "star" | "gem" | "seven";

export function SlotSymbol({ name, className }: { name: SlotSymbolName; className?: string }) {
  switch (name) {
    case "cherry":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <path
            d="M16 4c0 6-1 8-1 8"
            stroke="hsl(120 40% 35%)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="10" cy="23" r="6" fill="hsl(0 75% 45%)" />
          <circle cx="10" cy="23" r="6" fill="url(#cherryShine)" />
          <circle cx="20" cy="21" r="6" fill="hsl(0 75% 45%)" />
          <circle cx="20" cy="21" r="6" fill="url(#cherryShine)" />
          <ellipse cx="8" cy="20.5" rx="1.6" ry="1" fill="white" opacity="0.5" />
          <ellipse cx="18" cy="18.5" rx="1.6" ry="1" fill="white" opacity="0.5" />
          <defs>
            <radialGradient id="cherryShine" cx="35%" cy="30%" r="60%">
              <stop offset="0%" stopColor="white" stopOpacity="0.35" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      );
    case "lemon":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <ellipse cx="16" cy="17" rx="11" ry="9" fill="hsl(50 90% 55%)" />
          <ellipse cx="16" cy="17" rx="11" ry="9" fill="url(#lemonShine)" />
          <path
            d="M6 17c0-1 1-1 2-1M26 17c0-1-1-1-2-1"
            stroke="hsl(50 60% 40%)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <path
            d="M14 8c1-2 3-2 4 0"
            stroke="hsl(50 80% 45%)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <defs>
            <radialGradient id="lemonShine" cx="35%" cy="30%" r="60%">
              <stop offset="0%" stopColor="white" stopOpacity="0.45" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <path d="M16 6c5 0 8 4 8 9v3l2 4H6l2-4v-3c0-5 3-9 8-9z" fill="hsl(45 90% 55%)" />
          <path d="M16 6c5 0 8 4 8 9v3l2 4H16z" fill="url(#bellShade)" />
          <circle cx="16" cy="25" r="2" fill="hsl(45 80% 45%)" />
          <rect x="14" y="3" width="4" height="3" rx="1.5" fill="hsl(45 70% 40%)" />
          <defs>
            <linearGradient id="bellShade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="0.3" />
              <stop offset="100%" stopColor="black" stopOpacity="0.15" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <path
            d="M16 3l3.6 8.2 8.9.8-6.7 6 2 8.8L16 22.5 8.2 26.8l2-8.8-6.7-6 8.9-.8L16 3z"
            fill="hsl(45 95% 58%)"
          />
          <path d="M16 3v19.5l-7.8 4.3 2-8.8-6.7-6 8.9-.8L16 3z" fill="white" opacity="0.15" />
        </svg>
      );
    case "gem":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <path d="M8 10h16l4 6-12 12L4 16l4-6z" fill="hsl(190 80% 50%)" />
          <path d="M8 10h16l-8 18-8-18z" fill="hsl(190 90% 65%)" />
          <path d="M8 10l4 6h8l4-6" fill="none" stroke="hsl(190 60% 35%)" strokeWidth="0.6" />
          <path d="M12 16l4 12 4-12" fill="none" stroke="hsl(190 60% 35%)" strokeWidth="0.6" />
        </svg>
      );
    case "seven":
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <text
            x="16"
            y="24"
            textAnchor="middle"
            fontSize="22"
            fontWeight="900"
            fontFamily="ui-sans-serif, system-ui"
            fill="hsl(0 75% 50%)"
            stroke="hsl(45 90% 60%)"
            strokeWidth="0.6"
          >
            7
          </text>
        </svg>
      );
  }
}
