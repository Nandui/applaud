/**
 * How an uploaded avatar-frame picture sits on the avatar.
 *
 * Uploaded frame art comes in all shapes: extra padding on one side, a
 * see-through hole that's bigger or smaller than expected, ornaments on top.
 * Rather than asking admins to draw to an exact template, each frame stores a
 * fit: how big to draw the picture and which point of it goes on the avatar's
 * centre. Admin > Store measures it automatically from the see-through hole
 * (`detectFrameFit`) and lets admins nudge it.
 *
 * The fit travels inside the frame's art string as a URL fragment
 * (`https://…/halo.png#fit=1.2,0.5,0.5`), so everything that passes frame art
 * around keeps passing one string, and the browser ignores the fragment when
 * it fetches the picture.
 *
 * Pure (no DOM) so the server, the client and the unit tests can share it.
 */

export type FrameFit = {
  /** Picture width as a multiple of the avatar's diameter (including its gap). */
  size: number;
  /** The point of the picture (0..1 of its width) drawn on the avatar's centre. */
  x: number;
  /** The point of the picture (0..1 of its height) drawn on the avatar's centre. */
  y: number;
};

/** A square picture drawn 20% bigger than the avatar, centred: how frames were always drawn. */
export const DEFAULT_FIT: FrameFit = { size: 1.2, x: 0.5, y: 0.5 };

export const FIT_LIMITS = {
  size: { min: 0.8, max: 3 },
  x: { min: 0, max: 1 },
  y: { min: 0, max: 1 },
} as const;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Keep a fit inside sensible bounds, rounded for storage. */
export function clampFit(fit: FrameFit): FrameFit {
  return {
    size: round(clamp(fit.size, FIT_LIMITS.size.min, FIT_LIMITS.size.max)),
    x: round(clamp(fit.x, FIT_LIMITS.x.min, FIT_LIMITS.x.max)),
    y: round(clamp(fit.y, FIT_LIMITS.y.min, FIT_LIMITS.y.max)),
  };
}

/** "1.2,0.5,0.5" -> a fit, or null if it isn't one. */
export function parseFit(raw: string | null | undefined): FrameFit | null {
  if (!raw) return null;
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [size, x, y] = parts;
  return clampFit({ size, x, y });
}

/** A fit as stored in `Cosmetic.frameFit`. */
export function formatFit(fit: FrameFit): string {
  const f = clampFit(fit);
  return `${f.size},${f.x},${f.y}`;
}

export function sameFit(a: FrameFit, b: FrameFit): boolean {
  return formatFit(a) === formatFit(b);
}

/** An uploaded frame's art string: its URL, with its fit when it has one. */
export function withFit(url: string, fit: string | null | undefined): string {
  const parsed = parseFit(fit);
  return parsed ? `${url.split("#")[0]}#fit=${formatFit(parsed)}` : url;
}

/** Split uploaded frame art back into the picture URL and how to fit it. */
export function splitFrameImage(art: string): { src: string; fit: FrameFit } {
  const hash = art.indexOf("#");
  if (hash < 0) return { src: art, fit: DEFAULT_FIT };
  const fragment = new URLSearchParams(art.slice(hash + 1));
  return { src: art.slice(0, hash), fit: parseFit(fragment.get("fit")) ?? DEFAULT_FIT };
}

/** Pixels at or below this alpha count as see-through. */
const CLEAR = 96;

/**
 * Work out a frame's fit from its pixels (RGBA, row by row, as a canvas gives
 * them): find the see-through hole the ring encloses, put the hole's centre on
 * the avatar's centre and size the picture so the hole is exactly the avatar.
 *
 * A ring with a break in it has no enclosed hole; then the visible artwork is
 * centred and drawn at the usual 120%. Returns null for a picture with nothing
 * see-through at all, which can't be a frame.
 */
export function detectFrameFit(rgba: ArrayLike<number>, width: number, height: number): FrameFit | null {
  const n = width * height;
  if (n === 0 || rgba.length < n * 4) return null;
  // 0 = opaque, 1 = see-through, 2 = see-through and reachable from the edge.
  const cell = new Uint8Array(n);
  let clear = 0;
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] <= CLEAR) {
      cell[i] = 1;
      clear++;
    }
  }
  if (clear === 0) return null;

  const stack: number[] = [];
  const flood = (start: number, from: number, to: number, visit?: (i: number) => void) => {
    stack.push(start);
    cell[start] = to;
    while (stack.length) {
      const i = stack.pop()!;
      visit?.(i);
      const x = i % width;
      const near = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width];
      for (const j of near) {
        if (j >= 0 && j < n && cell[j] === from) {
          cell[j] = to;
          stack.push(j);
        }
      }
    }
  };

  // Everything see-through that touches the edge is outside the ring.
  for (let x = 0; x < width; x++) {
    for (const i of [x, (height - 1) * width + x]) if (cell[i] === 1) flood(i, 1, 2);
  }
  for (let y = 0; y < height; y++) {
    for (const i of [y * width, y * width + width - 1]) if (cell[i] === 1) flood(i, 1, 2);
  }

  // What's left see-through is enclosed. The biggest enclosed patch is the hole.
  let best: { area: number; minX: number; maxX: number; minY: number; maxY: number } | null = null;
  for (let i = 0; i < n; i++) {
    if (cell[i] !== 1) continue;
    const box = { area: 0, minX: width, maxX: -1, minY: height, maxY: -1 };
    flood(i, 1, 3, (j) => {
      const x = j % width;
      const y = (j - x) / width;
      box.area++;
      if (x < box.minX) box.minX = x;
      if (x > box.maxX) box.maxX = x;
      if (y < box.minY) box.minY = y;
      if (y > box.maxY) box.maxY = y;
    });
    if (!best || box.area > best.area) best = box;
  }

  // Specks inside the artwork aren't the hole; it has to be a real part of the picture.
  if (best && best.area >= n * 0.03) {
    const holeW = best.maxX - best.minX + 1;
    const holeH = best.maxY - best.minY + 1;
    return clampFit({
      size: width / Math.min(holeW, holeH),
      x: (best.minX + holeW / 2) / width,
      y: (best.minY + holeH / 2) / height,
    });
  }

  // No enclosed hole: centre the visible artwork and draw it 20% bigger than the avatar.
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let i = 0; i < n; i++) {
    if (cell[i] !== 0) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < 0) return null;
  const artW = maxX - minX + 1;
  const artH = maxY - minY + 1;
  return clampFit({
    size: (DEFAULT_FIT.size * width) / Math.max(artW, artH),
    x: (minX + artW / 2) / width,
    y: (minY + artH / 2) / height,
  });
}
