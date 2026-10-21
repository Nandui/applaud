import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PINNED,
  isLight,
  ownsItem,
  parseProfile,
  profileInputSchema,
  withEquipped,
  withPurchase,
} from "../lib/profile-custom";
import {
  COSMETICS,
  DEFAULT_BANNER,
  DEFAULT_THEME,
  bannerStyle,
  cosmeticById,
  themeColour,
} from "../lib/cosmetics";
import { daysLeft } from "../lib/periods";

test("catalogue ids are unique and prices are whole, non-negative points", () => {
  const ids = COSMETICS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of COSMETICS) {
    assert.ok(Number.isInteger(c.price) && c.price >= 0, c.id);
    assert.ok(c.id.startsWith(`${c.kind}-`), c.id);
    if (c.kind !== "frame") assert.ok(c.style, `${c.id} needs a style`);
  }
  // The defaults are free so everyone starts with a complete look.
  assert.equal(cosmeticById(DEFAULT_BANNER)?.price, 0);
  assert.equal(cosmeticById(DEFAULT_THEME)?.price, 0);
});

test("parseProfile tolerates empty and malformed JSON", () => {
  for (const raw of [null, undefined, "nope", 42, [], {}]) {
    const p = parseProfile(raw);
    assert.equal(p.bio, "");
    assert.deepEqual(p.owned, []);
    assert.equal(p.frame, null);
    assert.equal(p.banner, null);
    assert.equal(p.theme, null);
    assert.deepEqual(p.pinned, []);
  }
  const bad = parseProfile({
    bio: "x".repeat(500),
    owned: ["frame-neon", "not-an-item", "frame-neon"],
    pinned: ["a", "b", "c", "d", "e"],
  });
  assert.equal(bad.bio, "");
  assert.deepEqual(bad.owned, ["frame-neon"]);
  assert.equal(bad.pinned.length, MAX_PINNED);
});

test("you can only wear what you own, in the right slot", () => {
  const p = parseProfile({
    owned: ["frame-neon"],
    frame: "frame-gold", // not owned
    banner: "frame-neon", // wrong kind
    theme: "theme-violet", // free, always owned
  });
  assert.equal(p.frame, null);
  assert.equal(p.banner, null);
  assert.equal(p.theme, "theme-violet");
  assert.equal(parseProfile({ owned: ["frame-neon"], frame: "frame-neon" }).frame, "frame-neon");
});

test("buying adds the item and equips it", () => {
  const start = parseProfile({});
  assert.equal(ownsItem(start, "banner-lava"), false);
  assert.equal(ownsItem(start, DEFAULT_BANNER), true);
  const after = withPurchase(start, "banner-lava");
  assert.deepEqual(after.owned, ["banner-lava"]);
  assert.equal(after.banner, "banner-lava");
  // Buying twice doesn't duplicate, and survives a round trip through JSON.
  const again = parseProfile(JSON.parse(JSON.stringify(withPurchase(after, "banner-lava"))));
  assert.deepEqual(again.owned, ["banner-lava"]);
  assert.equal(again.banner, "banner-lava");
});

test("equipping checks ownership; null takes the item off", () => {
  const p = withPurchase(parseProfile({}), "frame-spark");
  assert.equal(withEquipped(p, "frame", "frame-prism").frame, "frame-spark");
  assert.equal(withEquipped(p, "frame", "banner-ocean").frame, "frame-spark");
  assert.equal(withEquipped(p, "frame", null).frame, null);
  assert.equal(withEquipped(p, "theme", "theme-violet").theme, "theme-violet");
});

test("styles fall back to the defaults", () => {
  assert.equal(bannerStyle(null), cosmeticById(DEFAULT_BANNER)!.style);
  assert.equal(themeColour("nope"), cosmeticById(DEFAULT_THEME)!.style);
  assert.equal(themeColour("theme-pink"), "#e8458b");
});

test("profile input trims and limits bio and pronouns", () => {
  assert.equal(profileInputSchema.parse({ bio: "  hi  " }).bio, "hi");
  assert.equal(profileInputSchema.safeParse({ bio: "x".repeat(151) }).success, false);
  assert.equal(profileInputSchema.safeParse({ pronouns: "x".repeat(25) }).success, false);
});

test("isLight picks readable text for accent colours", () => {
  assert.equal(isLight("#ffffff"), true);
  assert.equal(isLight("#6a4dff"), false);
  assert.equal(isLight("nope"), false);
});

test("daysLeft counts down to the end of the period", () => {
  const ref = new Date(2026, 9, 21, 12);
  assert.equal(daysLeft("month", ref), 11);
  assert.equal(daysLeft("all", ref), null);
});
