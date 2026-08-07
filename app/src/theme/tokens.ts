// Design tokens extracted verbatim from the validated prototype (repo root
// /index.html :root custom properties) — not redesigned, just relocated.
// The actual color/type CSS lives in src/theme/app.css as real stylesheet
// rules; this file holds the one bit of shared *logic* (the Beetle icon
// generator), since that's genuinely code, not styling.

export const BEETLE_PATH =
  'M2,33 C2,21 10,11 25,10 C32,9 34,5 45,5 C58,5 62,10 70,11 C85,12 98,19 98,31 C98,34 95,35 90,35 L10,35 C5,35 2,35 2,33 Z';

export function beetleIconSvg(fill: string, width = 22): string {
  const height = Math.round(width * 0.42);
  return `<svg viewBox="0 0 100 42" width="${width}" height="${height}" aria-hidden="true">
    <path d="${BEETLE_PATH}" fill="${fill}"/>
    <circle cx="23" cy="34" r="6" fill="rgba(0,0,0,.38)"/>
    <circle cx="78" cy="34" r="6" fill="rgba(0,0,0,.38)"/>
  </svg>`;
}
