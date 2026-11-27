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

const GIPHY =
  "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjEx/3o7abKhOpu0NwenH3O/200.gif?cid=790b7611&ep=v1_gifs_search&rid=200.gif&ct=g";

test("GIPHY GIFs are drawn from the full-colour original WebP when shown big", () => {
  assert.equal(
    optimizedImage(GIPHY, 600),
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjEx/3o7abKhOpu0NwenH3O/giphy.webp?cid=790b7611&ep=v1_gifs_search&rid=giphy.webp&ct=g",
  );
  // Old short form, no query string.
  assert.equal(
    optimizedImage("https://media.giphy.com/media/abc123/200.gif", 192),
    "https://media.giphy.com/media/abc123/giphy.webp",
  );
});

test("small GIPHY thumbnails use the 200px-wide WebP", () => {
  assert.equal(
    optimizedImage("https://media.giphy.com/media/abc123/giphy.gif", 96),
    "https://media.giphy.com/media/abc123/200w.webp",
  );
});

test("odd GIPHY URLs are left alone", () => {
  for (const url of ["https://giphy.com/gifs/funny-abc123", "https://i.giphy.com/abc123.gif"]) {
    assert.equal(optimizedImage(url, 600), url);
  }
});
