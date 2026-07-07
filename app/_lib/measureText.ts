/**
 * Pixel-accurate text width measurement via a shared, off-DOM <canvas> — used
 * to size an inline-edit <input> to its own content instead of a fixed width
 * or a `ch`-unit approximation. `ch` is defined by the "0" glyph's width,
 * which for a bold, proportional font and a string with many short
 * single-character words (lots of narrower space glyphs relative to "0")
 * overestimates the true rendered width enough to be visibly wrong —
 * confirmed empirically against this plugin's title font.
 */
let sharedCanvas: HTMLCanvasElement | null = null;

function getContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  sharedCanvas ??= document.createElement('canvas');
  return sharedCanvas.getContext('2d');
}

/** Width in CSS px of `text` rendered with the exact computed `font` shorthand of `el`. */
export function measureTextWidth(text: string, el: HTMLElement): number | null {
  const ctx = getContext();
  if (!ctx) return null;
  ctx.font = getComputedStyle(el).font;
  return ctx.measureText(text).width;
}
