/**
 * Fixed list-colour swatches (open question 1 — a fixed set of --sv-* tokens
 * rather than arbitrary hex). Colour is the one sanctioned splash in the
 * otherwise-monochrome UI; it appears only as the small list dot.
 *
 * Stored value is the swatch `key`; `null`/unknown falls back to a muted grey.
 */
export interface ListSwatch {
  key: string;
  label: string;
  token: string;
}

export const LIST_SWATCHES: ListSwatch[] = [
  { key: 'grey', label: 'Grey', token: 'var(--sv-grey-500)' },
  { key: 'green', label: 'Green', token: 'var(--sv-green-800)' },
  { key: 'blue', label: 'Blue', token: 'var(--sv-blue-800)' },
  { key: 'amber', label: 'Amber', token: 'var(--sv-amber-800)' },
  { key: 'red', label: 'Red', token: 'var(--sv-red-800)' },
];

export function listDotColor(color: string | null | undefined): string {
  const swatch = LIST_SWATCHES.find((s) => s.key === color);
  return swatch ? swatch.token : 'var(--sv-grey-400)';
}
