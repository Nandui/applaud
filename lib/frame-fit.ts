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
  /** Picture width as a multiple of the avatar photo's diameter (the see-through middle hugs the photo). */
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
 * For each pixel, roughly how far (in pixels) it is from the nearest bit of
 * artwork: 0 on the art, growing across see-through areas. Two-pass chamfer
 * distance, close enough to round for closing small gaps.
 */
function distanceToArt(rgba: ArrayLike<number>, width: number, height: number): Float32Array {
  const n = width * height;
  const far = width + height;
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = rgba[i * 4 + 3] <= CLEAR ? far : 0;
  const D = Math.SQRT2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - width] + 1);
        if (x > 0) v = Math.min(v, d[i - width - 1] + D);
        if (x < width - 1) v = Math.min(v, d[i - width + 1] + D);
      }
      d[i] = v;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x < width - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < height - 1) {
        v = Math.min(v, d[i + width] + 1);
        if (x < width - 1) v = Math.min(v, d[i + width + 1] + D);
        if (x > 0) v = Math.min(v, d[i + width - 1] + D);
      }
      d[i] = v;
    }
  }
  return d;
}

/**
 * The biggest see-through patch the artwork encloses once every see-through
 * pixel within `k` of the art counts as art (which closes gaps up to 2k wide),
 * as a circle (see holeCircle). Null when nothing big enough is enclosed:
 * specks inside the artwork aren't the hole.
 */
function enclosedHole(reach: Float32Array, k: number, width: number, height: number) {
  const n = width * height;
  // 0 = art, 1 = see-through, 2 = see-through and reachable from the edge, 3 = enclosed.
  const cell = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (reach[i] > k) cell[i] = 1;

  const stack: number[] = [];
  const flood = (start: number, to: number, visit?: (i: number) => void) => {
    stack.push(start);
    cell[start] = to;
    while (stack.length) {
      const i = stack.pop()!;
      visit?.(i);
      const x = i % width;
      const near = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width];
      for (const j of near) {
        if (j >= 0 && j < n && cell[j] === 1) {
          cell[j] = to;
          stack.push(j);
        }
      }
    }
  };

  // Everything see-through that touches the edge is outside the ring.
  for (let x = 0; x < width; x++) {
    for (const i of [x, (height - 1) * width + x]) if (cell[i] === 1) flood(i, 2);
  }
  for (let y = 0; y < height; y++) {
    for (const i of [y * width, y * width + width - 1]) if (cell[i] === 1) flood(i, 2);
  }

  // What's left see-through is enclosed. The biggest enclosed patch is the hole.
  const label = new Int32Array(n).fill(-1);
  let patch = 0;
  let best = -1;
  let bestArea = 0;
  for (let i = 0; i < n; i++) {
    if (cell[i] !== 1) continue;
    let area = 0;
    flood(i, 3, (j) => {
      label[j] = patch;
      area++;
    });
    if (area > bestArea) {
      bestArea = area;
      best = patch;
    }
    patch++;
  }
  if (best < 0 || bestArea < n * 0.03) return null;
  return holeCircle(label, best, width, height);
}

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
  let clear = 0;
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] <= CLEAR) clear++;
  if (clear === 0) return null;

  // Rings drawn from separate pieces (swooshes, snowflakes, a scarf) often
  // leave hairline gaps, so the middle leaks out to the edge and isn't a hole.
  // Close gaps of growing width by fattening the artwork, find the hole, then
  // grow it back by the same amount.
  const reach = distanceToArt(rgba, width, height);
  const side = Math.min(width, height);
  for (const k of [0, 0.01, 0.02, 0.035, 0.05].map((f) => Math.round(f * side))) {
    if (!enclosedHole(reach, k, width, height)) continue;
    // Just sealed, a gap still dents the hole's edge; seal it a bit more so
    // the dent doesn't widen the circle.
    const sealed = k === 0 ? 0 : Math.ceil(k * 1.5) + 1;
    const tighter = enclosedHole(reach, sealed, width, height);
    const used = tighter ? sealed : k;
    const hole = tighter ?? enclosedHole(reach, k, width, height)!;
    return clampFit({
      size: width / (hole.d + 2 * used),
      x: hole.cx / width,
      y: hole.cy / height,
    });
  }

  // Still no enclosed hole: centre the visible artwork and draw it 20% bigger
  // than the avatar.
  const cell = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] <= CLEAR) cell[i] = 1;

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
