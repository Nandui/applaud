import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FIT,
  detectFrameFit,
  formatFit,
  frameOverhang,
  parseFit,
  splitFrameImage,
  withFit,
} from "../lib/frame-fit";
import { frameArt } from "../lib/cosmetics";

const URL_ = "https://abc.public.blob.vercel-storage.com/store/frame/halo.png";

/** A w×h RGBA picture: opaque where `ink(x, y)` is true, see-through elsewhere. */
function picture(w: number, h: number, ink: (x: number, y: number) => boolean) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (ink(x + 0.5, y + 0.5)) px[(y * w + x) * 4 + 3] = 255;
  }
  return px;
}

/** A ring centred at (cx, cy) with inner radius r and outer radius R. */
const ring = (cx: number, cy: number, r: number, R: number) => (x: number, y: number) => {
  const d = Math.hypot(x - cx, y - cy);
  return d >= r && d <= R;
};

const near = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b}`);

test("fits round-trip through storage and the art string", () => {
  assert.equal(formatFit({ size: 1.23456, x: 0.5, y: 0.25 }), "1.235,0.5,0.25");
  assert.deepEqual(parseFit("1.3, 0.4, 0.6"), { size: 1.3, x: 0.4, y: 0.6 });
  assert.equal(parseFit("nope"), null);
  assert.equal(parseFit("1,2"), null);
  assert.equal(parseFit(null), null);
  // Out-of-range values are clamped, not trusted.
  assert.deepEqual(parseFit("99,-1,4"), { size: 3, x: 0, y: 1 });

  const art = withFit(URL_, "1.3,0.4,0.6");
  assert.equal(art, `${URL_}#fit=1.3,0.4,0.6`);
  assert.deepEqual(splitFrameImage(art), { src: URL_, fit: { size: 1.3, x: 0.4, y: 0.6 } });
  // No fit stored: the picture draws the way frames always did.
  assert.equal(withFit(URL_, null), URL_);
  assert.deepEqual(splitFrameImage(URL_), { src: URL_, fit: DEFAULT_FIT });
});

test("frameArt carries an uploaded frame's fit, built-ins stay CSS classes", () => {
  assert.equal(frameArt({ style: null, imageUrl: URL_, frameFit: "1.5,0.5,0.55" }), `${URL_}#fit=1.5,0.5,0.55`);
  assert.equal(frameArt({ style: "frame-neon", imageUrl: null, frameFit: null }), "frame-neon");
});

test("a centred template frame keeps the default fit", () => {
  // 120×120 with a hole 100 across: the layout the old upload hint asked for.
  const fit = detectFrameFit(picture(120, 120, ring(60, 60, 50, 58)), 120, 120)!;
  near(fit.size, 1.2, 0.03, "size");
  near(fit.x, 0.5, 0.01, "x");
  near(fit.y, 0.5, 0.01, "y");
});

test("an off-centre ring is centred on its hole", () => {
  // Ring pushed to the left and down, with lots of empty canvas on the right.
  const fit = detectFrameFit(picture(200, 160, ring(70, 90, 40, 55)), 200, 160)!;
  near(fit.x, 70 / 200, 0.01, "x");
  near(fit.y, 90 / 160, 0.01, "y");
  // The hole (80 across) becomes the avatar, so the picture is 200/80 avatars wide.
  near(fit.size, 200 / 80, 0.05, "size");
});

test("ornaments outside the ring don't move the centre", () => {
  const crown = (x: number, y: number) => x > 40 && x < 80 && y > 2 && y < 14;
  const fit = detectFrameFit(
    picture(120, 140, (x, y) => ring(60, 80, 40, 52)(x, y) || crown(x, y)),
    120,
    140,
  )!;
  near(fit.x, 0.5, 0.01, "x");
  near(fit.y, 80 / 140, 0.01, "y");
});

test("a hairline break in the ring is bridged, so the hole is still found", () => {
  const broken = (x: number, y: number) => ring(50, 50, 30, 40)(x, y) && !(y > 47 && y < 53 && x > 80);
  const fit = detectFrameFit(picture(140, 100, broken), 140, 100)!;
  near(fit.x, 50 / 140, 0.02, "x");
  near(fit.y, 0.5, 0.02, "y");
  // The hole is 60 across.
  near(fit.size, 140 / 60, 0.1, "size");
});

test("a ring with a wide opening centres the artwork instead", () => {
  const open = (x: number, y: number) => ring(50, 50, 30, 40)(x, y) && !(y > 30 && y < 70 && x > 70);
  const fit = detectFrameFit(picture(140, 100, open), 140, 100)!;
  near(fit.y, 0.5, 0.02, "y");
  near(fit.size, (1.2 * 140) / 80, 0.15, "size");
});

test("a fully opaque picture isn't a frame", () => {
  assert.equal(detectFrameFit(picture(10, 10, () => true), 10, 10), null);
});

test("frameOverhang: how far a frame reaches past the avatar", () => {
  // The default 120% centred frame sticks out 10% of the diameter all round.
  assert.deepEqual(frameOverhang(DEFAULT_FIT), { left: 0.1, right: 0.1, top: 0.1, bottom: 0.1 });
  // A frame that fits the avatar exactly doesn't stick out.
  assert.deepEqual(frameOverhang({ size: 1, x: 0.5, y: 0.5 }), { left: 0, right: 0, top: 0, bottom: 0 });
  // A big frame with ornaments on top (hole low in the picture) reaches far up, less down.
  const o = frameOverhang({ size: 2, x: 0.5, y: 0.625 });
  assert.equal(o.top, 0.75);
  assert.equal(o.bottom, 0.25);
  assert.equal(o.left, 0.5);
});

test("a hat brim biting into the top of the hole doesn't move the centre", () => {
  // Hole of radius 40 at (60, 80); a brim covers its top 25px.
  const brim = (x: number, y: number) => y > 30 && y < 65 && x > 10 && x < 110;
  const fit = detectFrameFit(
    picture(120, 140, (x, y) => ring(60, 80, 40, 52)(x, y) || brim(x, y)),
    120,
    140,
  )!;
  near(fit.x, 0.5, 0.01, "x");
  near(fit.y, 80 / 140, 0.01, "y");
  near(fit.size, 120 / 80, 0.03, "size");
});
