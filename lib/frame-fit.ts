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

/**
 * The circle a frame's hole was drawn as. Ornaments often bite into the
 * hole (a hat brim over the top, a bow at the bottom), so its bounding box is
 * shorter than the circle and off-centre. A circle is widest across its
 * middle, though: the widest rows give the diameter and the centre's height,
 * the tallest columns the centre's left/right, as long as nothing covers
 * more than half of it.
 */
function holeCircle(label: Int32Array, id: number, width: number, height: number) {
  const rowMin = new Int32Array(height).fill(width);
  const rowMax = new Int32Array(height).fill(-1);
  const colMin = new Int32Array(width).fill(height);
  const colMax = new Int32Array(width).fill(-1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (label[y * width + x] !== id) continue;
      if (x < rowMin[y]) rowMin[y] = x;
      if (x > rowMax[y]) rowMax[y] = x;
      if (y < colMin[x]) colMin[x] = y;
      if (y > colMax[x]) colMax[x] = y;
    }
  }
  const spans = (min: Int32Array, max: Int32Array) => Array.from(max, (hi, k) => (hi < 0 ? 0 : hi - min[k] + 1));
  const rows = spans(rowMin, rowMax);
  const cols = spans(colMin, colMax);
  const widest = Math.max(...rows);
  const tallest = Math.max(...cols);
  // Middle of the run of near-widest rows (a circle's widest part is flat-ish
  // at pixel scale), and the same for columns.
  const middle = (spans: number[], top: number) => {
    let sum = 0;
    let count = 0;
    spans.forEach((v, k) => {
      if (v >= top - 1) {
        sum += k;
        count++;
      }
    });
    return sum / count + 0.5;
  };
  const cy = middle(rows, widest);
  const cx = middle(cols, tallest);
  return { d: Math.max(widest, tallest), cx, cy };
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
  const label = new Int32Array(n).fill(-1);
  let patch = 0;
  let best = -1;
  let bestArea = 0;
  for (let i = 0; i < n; i++) {
    if (cell[i] !== 1) continue;
    let area = 0;
    flood(i, 1, 3, (j) => {
      label[j] = patch;
      area++;
    });
    if (area > bestArea) {
      bestArea = area;
      best = patch;
    }
    patch++;
  }

  // Specks inside the artwork aren't the hole; it has to be a real part of the picture.
  if (best >= 0 && bestArea >= n * 0.03) {
    const hole = holeCircle(label, best, width, height);
    return clampFit({
      size: width / hole.d,
      x: hole.cx / width,
      y: hole.cy / height,
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

/**
 * How far a fitted frame picture reaches past the avatar on each side, as a
 * multiple of the avatar's diameter (0 where it stays inside). Pictures are
 * taken as square, which frame art nearly always is. The profile header uses
 * it to make room, so a big frame isn't cut off at the screen edge or drawn
 * over the name.
 */
export function frameOverhang(fit: FrameFit): { left: number; right: number; top: number; bottom: number } {
  const past = (n: number) => round(Math.max(0, n - 0.5));
  return {
    left: past(fit.x * fit.size),
    right: past((1 - fit.x) * fit.size),
    top: past(fit.y * fit.size),
    bottom: past((1 - fit.y) * fit.size),
  };
}
