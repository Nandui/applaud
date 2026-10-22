import { test } from "node:test";
import assert from "node:assert/strict";
import { googleAvatarAction, googlePictureKey, largerGooglePicture } from "../lib/google-avatar";

const PIC = "https://lh3.googleusercontent.com/a/ACg8ocK123=s96-c";
const STORE = "https://abc.public.blob.vercel-storage.com/";

test("asks Google for a bigger picture", () => {
  assert.equal(largerGooglePicture(PIC), "https://lh3.googleusercontent.com/a/ACg8ocK123=s512-c");
  assert.equal(largerGooglePicture("https://x/y=s64"), "https://x/y=s512-c");
});

test("copies when there is no avatar yet", () => {
  assert.equal(googleAvatarAction(null, "u1", PIC), "copy");
});

test("never replaces a picture the person uploaded", () => {
  assert.equal(googleAvatarAction(`${STORE}avatars/me-x1y2.jpg`, "u1", PIC), "keep");
  // Someone else's Google copy is not this person's Google copy.
  assert.equal(googleAvatarAction(`${STORE}avatars/google/u2-${googlePictureKey(PIC)}.jpg`, "u1", PIC), "keep");
});

test("refreshes a Google copy only when the Google picture changed", () => {
  const current = `${STORE}avatars/google/u1-${googlePictureKey(PIC)}.jpg`;
  assert.equal(googleAvatarAction(current, "u1", PIC), "keep");
  assert.equal(googleAvatarAction(current, "u1", PIC.replace("123", "456")), "copy");
});
