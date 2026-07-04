/**
 * Fixed list-colour swatches (open question 1 — a fixed set of --sv-* tokens
 * rather than arbitrary hex). Colour is the one sanctioned splash in the
 * otherwise-monochrome UI; it appears only as the small list dot.
 *
 * Colour is mandatory — every list has one of these swatches (black is the
 * default for new lists, not a "no colour" state), so the picker never needs
 * a clear option and the dot never has to represent an ambiguous fallback.
 *
 * Black and Grey are both stops on the existing --sv-grey-* primitive scale
 * (950 vs 500) — visually distinct from each other and from the four
 * saturated hues, without adding any new tokens to packages/ui.
 */
export interface ListSwatch {
  key: string;
  label: string;
  token: string;
}

const BLACK_SWATCH: ListSwatch = { key: 'black', label: 'Black', token: 'var(--sv-grey-950)' };

export const LIST_SWATCHES: ListSwatch[] = [
  BLACK_SWATCH,
  { key: 'grey', label: 'Grey', token: 'var(--sv-grey-500)' },
  { key: 'green', label: 'Green', token: 'var(--sv-green-800)' },
  { key: 'blue', label: 'Blue', token: 'var(--sv-blue-800)' },
  { key: 'amber', label: 'Amber', token: 'var(--sv-amber-800)' },
  { key: 'red', label: 'Red', token: 'var(--sv-red-800)' },
];

export const DEFAULT_LIST_COLOR = BLACK_SWATCH.key;

/** Falls back to the default swatch for pre-existing rows saved before colour
 *  became mandatory (color: null in the database). */
export function listDotColor(color: string | null | undefined): string {
  const swatch = LIST_SWATCHES.find((s) => s.key === color);
  return (swatch ?? BLACK_SWATCH).token;
}
