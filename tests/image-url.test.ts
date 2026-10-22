import { test } from "node:test";
import assert from "node:assert/strict";
import { cssImageUrl, optimizedImage } from "../lib/image-url";

const BLOB = "https://abc.public.blob.vercel-storage.com/avatars/me photo.jpg";

test("Blob pictures are resized to a permitted width at twice the CSS size", () => {
  assert.equal(
    optimizedImage(BLOB, 96),
    `/_next/image?url=${encodeURIComponent(BLOB)}&w=256&q=75`,
  );
  assert.equal(
    optimizedImage(BLOB, 600),
    `/_next/image?url=${encodeURIComponent(BLOB)}&w=1200&q=75`,
  );
  // Never asks for more than the largest size.
  assert.match(optimizedImage(BLOB, 5000), /&w=3840&/);
});

test("other pictures are left alone", () => {
  for (const src of [
    "https://media.giphy.com/media/x/giphy.gif",
    "/brand/logo.png",
    "http://abc.public.blob.vercel-storage.com/a.png",
    "not a url",
  ]) {
    assert.equal(optimizedImage(src, 96), src);
  }
});

test("CSS urls are encoded exactly once", () => {
  assert.equal(cssImageUrl(BLOB, 96), optimizedImage(BLOB, 96));
  assert.equal(
    cssImageUrl("https://media.giphy.com/a b.gif", 96),
    "https://media.giphy.com/a%20b.gif",
  );
});
