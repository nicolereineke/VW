// Official 1973 Volkswagen factory paint names — the only valid exterior colors
// a call can name. Source: the color brochure referenced in SPEC.md §4.1.

export const OFFICIAL_COLORS: Record<string, string> = {
  'Texas Yellow': '#D2A227',
  'Kasan Red': '#A32C2E',
  'Marina Blue': '#6FA3B5',
  'Pastel White': '#EDE8DA',
  'Kansas Beige': '#C7BCA8',
  'Bright Orange': '#E2661E',
  'Biscay Blue': '#1D3E78',
  'Sumatra Green': '#205C3F',
  'Phoenix Red': '#D13A2A',
  'Ravenna Green': '#A9C93A',
  Amber: '#DE7A1E',
  'Bahia Red': '#8B1E33',
  'Saturn Yellow': '#E0C21C',
  'Olympic Blue': '#29A6D6',
};

export const OFFICIAL_COLOR_NAMES = Object.keys(OFFICIAL_COLORS);

export function isOfficialColor(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(OFFICIAL_COLORS, name);
}

export const BODY_STYLES_COLLECTIBLE = ['Beetle', 'Convertible', 'New Beetle', 'Thing'] as const;

export const BUG_DEX_SIZE = OFFICIAL_COLOR_NAMES.length * BODY_STYLES_COLLECTIBLE.length; // 56
