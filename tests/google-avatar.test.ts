import { test } from "node:test";
import assert from "node:assert/strict";
import {
  googleAvatarAction,
  googlePictureKey,
  isGooglePictureUrl,
  largerGooglePicture,
  pictureFromIdToken,
} from "../lib/google-avatar";

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

test("retries the copy when the avatar links straight to Google", () => {
  assert.equal(googleAvatarAction(largerGooglePicture(PIC), "u1", PIC), "copy");
});

test("recognises Google's own picture links", () => {
  assert.equal(isGooglePictureUrl(PIC), true);
  assert.equal(isGooglePictureUrl("https://lh5.googleusercontent.com/-abc/photo.jpg"), true);
  assert.equal(isGooglePictureUrl("http://lh3.googleusercontent.com/a/x"), false);
  assert.equal(isGooglePictureUrl("https://evil.com/lh3.googleusercontent.com"), false);
  assert.equal(isGooglePictureUrl(`${STORE}avatars/me.jpg`), false);
});

test("reads the picture out of a stored Google ID token", () => {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = `${part({ alg: "RS256" })}.${part({ email: "a@b.com", picture: PIC })}.sig`;
  assert.equal(pictureFromIdToken(token), PIC);
  assert.equal(pictureFromIdToken(`${part({})}.${part({ email: "a@b.com" })}.sig`), null);
  assert.equal(pictureFromIdToken(null), null);
  assert.equal(pictureFromIdToken("garbage"), null);
});
