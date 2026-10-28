/**
 * Paper-cut style illustrations: flat fills, ink outlines, brand accents (green, sky, coral, sun,
 * violet). Inline SVG so they cost no requests and scale crisply. Decorative only (aria-hidden).
 */
const INK = '#2c2e2a';
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export function HeroArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 360" className={className} aria-hidden="true" focusable="false">
      {/* ground strip */}
      <path d="M0 330 Q160 300 320 322 T640 312 V360 H0Z" fill="#e0dbce" />
      {/* sun */}
      <circle cx="560" cy="70" r="42" fill="#f5e211" {...S} />
      {/* house (rentals) */}
      <path d="M430 330 V210 L500 160 L570 210 V330 Z" fill="#2ba0ff" {...S} />
      <path d="M418 216 L500 152 L582 216" fill="none" {...S} />
      <rect x="482" y="262" width="36" height="68" rx="6" fill="#f5f1e4" {...S} />
      <rect x="448" y="222" width="26" height="26" rx="5" fill="#f5e211" {...S} />
      <rect x="526" y="222" width="26" height="26" rx="5" fill="#f5e211" {...S} />
      {/* grocery basket */}
      <path d="M40 252 H170 L156 326 H54 Z" fill="#8ed462" {...S} />
      <path d="M62 252 Q105 196 148 252" fill="none" {...S} />
      <circle cx="78" cy="242" r="16" fill="#ff705d" {...S} />
      <rect x="98" y="214" width="24" height="40" rx="6" fill="#f5f1e4" {...S} />
      <ellipse cx="138" cy="240" rx="14" ry="18" fill="#f5e211" {...S} />
      {/* biryani bowl */}
      <path d="M210 278 H330 Q326 330 270 330 Q214 330 210 278 Z" fill="#ff705d" {...S} />
      <path d="M216 278 Q232 246 252 262 Q266 236 286 258 Q306 242 324 278 Z" fill="#f5e211" {...S} />
      <path d="M248 232 q6 -12 0 -24 M272 228 q6 -12 0 -24 M296 232 q6 -12 0 -24" fill="none" {...S} />
      {/* person with shopping bag */}
      <circle cx="388" cy="118" r="26" fill="#f5c9a8" {...S} />
      <path d="M362 112 Q366 82 392 86 Q416 88 414 112 Q402 98 382 104 Z" fill={INK} />
      <path d="M352 160 Q388 140 424 160 L432 262 H344 Z" fill="#7c6bd6" {...S} />
      <path d="M352 170 Q326 214 340 246" fill="none" {...S} />
      <path d="M424 170 Q446 196 450 222" fill="none" {...S} />
      <path d="M366 262 L360 330 M410 262 L416 330" {...S} />
      <path d="M346 330 H372 M404 330 H430" {...S} />
      {/* bag */}
      <rect
        x="436"
        y="222"
        width="46"
        height="54"
        rx="8"
        fill="#8ed462"
        {...S}
        transform="rotate(-8 459 249)"
      />
      <path d="M448 226 q10 -22 22 -3" fill="none" {...S} transform="rotate(-8 459 249)" />
      {/* floating price tags */}
      <g transform="rotate(-10 190 120)">
        <path d="M150 100 H222 L238 120 L222 140 H150 Z" fill="#ffffff" {...S} />
        <circle cx="162" cy="120" r="5" fill={INK} />
        <text
          x="196"
          y="127"
          textAnchor="middle"
          fontSize="20"
          fontWeight="500"
          fill={INK}
          fontFamily="inherit"
        >
          ₹
        </text>
      </g>
      <g transform="rotate(12 300 70)">
        <rect x="266" y="52" width="70" height="36" rx="18" fill="#8ed462" {...S} />
        <path d="M284 70 l8 8 l16 -16" fill="none" {...S} />
      </g>
    </svg>
  );
}

export function VerticalIcon({
  vertical,
  className = 'h-10 w-10',
}: {
  vertical: 'shopping' | 'food' | 'grocery' | 'property';
  className?: string;
}) {
  const icon = {
    shopping: (
      <>
        <rect x="10" y="18" width="28" height="24" rx="5" fill="#2ba0ff" {...S} strokeWidth={2.5} />
        <path d="M17 18 q7 -14 14 0" fill="none" {...S} strokeWidth={2.5} />
      </>
    ),
    food: (
      <>
        <path d="M8 24 H40 Q38 40 24 40 Q10 40 8 24 Z" fill="#ff705d" {...S} strokeWidth={2.5} />
        <path d="M11 24 Q16 14 22 19 Q27 12 32 19 Q36 15 38 24 Z" fill="#f5e211" {...S} strokeWidth={2.5} />
      </>
    ),
    grocery: (
      <>
        <path d="M8 22 H40 L36 40 H12 Z" fill="#8ed462" {...S} strokeWidth={2.5} />
        <circle cx="19" cy="16" r="6" fill="#ff705d" {...S} strokeWidth={2.5} />
        <rect x="26" y="8" width="8" height="15" rx="3" fill="#ffffff" {...S} strokeWidth={2.5} />
      </>
    ),
    property: (
      <>
        <path d="M10 40 V22 L24 11 L38 22 V40 Z" fill="#7c6bd6" {...S} strokeWidth={2.5} />
        <rect x="20" y="28" width="8" height="12" rx="2" fill="#f5e211" {...S} strokeWidth={2.5} />
      </>
    ),
  }[vertical];
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      {icon}
    </svg>
  );
}

export function EmptyArt({ className = 'h-28 w-28' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <circle cx="60" cy="64" r="44" fill="#e0dbce" />
      <circle cx="54" cy="56" r="22" fill="#ffffff" {...S} />
      <path d="M70 72 L92 94" {...S} strokeWidth={6} />
      <path d="M46 52 q8 -8 16 0" fill="none" {...S} />
      <circle cx="96" cy="26" r="8" fill="#f5e211" {...S} />
    </svg>
  );
}
