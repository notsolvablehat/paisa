/**
 * A friendly face avatar generated locally from a seed (the user's email), so
 * everyone gets a stable picture without uploading one or calling a third-party
 * avatar service. Returns an SVG data URI usable as an <img> src.
 */

const PALETTE = [
  "#E8532F",
  "#F6B8A6",
  "#28A984",
  "#2B95DE",
  "#DE7139",
  "#9390A2",
  "#0E9384",
  "#DE6081",
  "#18181B",
];

/** FNV-1a + finalizer: small and stable. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // murmur3 finalizer: FNV's bits are poorly mixed, which made most faces the same colour.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Light colours need dark features. */
function ink(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#18181B" : "#FFFFFF";
}

export function avatarDataUri(seed: string): string {
  const h = hash(seed.trim().toLowerCase());
  const bit = (i: number) => (h >>> i) & 1;
  const pick = (shift: number) => (h >>> shift) % PALETTE.length;

  const bg = PALETTE[pick(0)];
  let fi = pick(5);
  if (PALETTE[fi] === bg) fi = (fi + 3) % PALETTE.length;
  const face = PALETTE[fi];
  const feat = ink(face);

  const rot = ((h >>> 9) % 30) - 15; // tilt of the head, degrees
  const dx = ((h >>> 13) % 7) - 3; // look left/right
  const dy = ((h >>> 17) % 3) - 1;
  const round = bit(20) ? 18 : 9; // round or squarish head
  const smile = bit(21);
  const wide = bit(22);

  const mouth = smile
    ? `<path d="M${15 + dx} 20c1.6 2.2 4.4 2.2 6 0" stroke="${feat}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
    : `<path d="M${(wide ? 15 : 16) + dx} 21h${wide ? 6 : 4}" stroke="${feat}" stroke-width="1.4" stroke-linecap="round"/>`;

  // Head and features share one transform so the face turns as a whole.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
<rect width="36" height="36" fill="${bg}"/>
<g transform="translate(${dx / 2} ${5 + dy}) rotate(${rot} 18 18)">
<rect x="4" y="4" width="28" height="30" rx="${round}" fill="${face}"/>
<circle cx="${14 + dx}" cy="15" r="1.6" fill="${feat}"/>
<circle cx="${22 + dx}" cy="15" r="1.6" fill="${feat}"/>
${mouth}
</g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
