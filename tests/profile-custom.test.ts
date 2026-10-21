import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_PINNED,
  isLight,
  bundleFor,
  ownsItem,
  parseProfile,
  profileInputSchema,
  resolveLook,
  withEquipped,
  withOwned,
  withPurchase,
  wornItem,
} from "../lib/profile-custom";
import {
  BUILTIN_COSMETICS,
  DEFAULT_BANNER,
  DEFAULT_LOOK,
  DEFAULT_THEME,
  bannerCss,
  builtinCatalogue,
  isFrameImage,
  itemById,
  type Cosmetic,
} from "../lib/cosmetics";
import { daysLeft } from "../lib/periods";

const catalogue = builtinCatalogue();
const item = (id: string) => itemById(catalogue, id)!;
const UPLOAD = "https://abc.public.blob.vercel-storage.com/store/frame/halo.png";

test("built-in ids are unique and prices are whole, non-negative points", () => {
  const ids = BUILTIN_COSMETICS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of BUILTIN_COSMETICS) {
    assert.ok(Number.isInteger(c.price) && c.price >= 0, c.id);
    assert.ok(c.id.startsWith(`${c.kind}-`), c.id);
    assert.ok(c.style, `${c.id} needs a style`);
  }
  // The defaults are free so everyone starts with a complete look.
  assert.equal(item(DEFAULT_BANNER).price, 0);
  assert.equal(item(DEFAULT_THEME).price, 0);
});

test("the migration seeds exactly the built-in items", () => {
  const sql = readFileSync(
    new URL("../prisma/migrations/20261021230000_store_catalogue/migration.sql", import.meta.url),
    "utf8",
  );
  for (const c of BUILTIN_COSMETICS) {
    assert.ok(sql.includes(`('${c.id}', '${c.kind}', '${c.name}', ${c.price}, '${c.rarity}', '${c.style}'`), c.id);
  }
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
    owned: ["frame-neon", "frame-neon"],
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
  assert.equal(wornItem(p, "frame", catalogue), null);
  assert.equal(wornItem(p, "banner", catalogue), null);
  assert.equal(wornItem(p, "theme", catalogue)?.id, "theme-violet");
  const ok = parseProfile({ owned: ["frame-neon"], frame: "frame-neon" });
  assert.equal(wornItem(ok, "frame", catalogue)?.id, "frame-neon");
  // An item that left the catalogue is simply not worn any more.
  assert.equal(wornItem(ok, "frame", catalogue.filter((c) => c.id !== "frame-neon")), null);
});

test("buying adds the item and equips it", () => {
  const start = parseProfile({});
  assert.equal(ownsItem(start, item("banner-lava")), false);
  assert.equal(ownsItem(start, item(DEFAULT_BANNER)), true);
  const after = withPurchase(start, item("banner-lava"));
  assert.deepEqual(after.owned, ["banner-lava"]);
  assert.equal(after.banner, "banner-lava");
  // Buying twice doesn't duplicate, and survives a round trip through JSON.
  const again = parseProfile(JSON.parse(JSON.stringify(withPurchase(after, item("banner-lava")))));
  assert.deepEqual(again.owned, ["banner-lava"]);
  assert.equal(again.banner, "banner-lava");
});

test("equipping checks ownership; null takes the item off", () => {
  const p = withPurchase(parseProfile({}), item("frame-spark"));
  assert.equal(withEquipped(p, "frame", item("frame-prism")).frame, "frame-spark");
  assert.equal(withEquipped(p, "frame", item("banner-ocean")).frame, "frame-spark");
  assert.equal(withEquipped(p, "frame", null).frame, null);
  assert.equal(withEquipped(p, "theme", item("theme-violet")).theme, "theme-violet");
});

test("looks fall back to the defaults", () => {
  const look = resolveLook(parseProfile({ theme: "nope" }), catalogue);
  assert.equal(look.frame, null);
  assert.equal(look.banner, item(DEFAULT_BANNER).style);
  assert.equal(look.theme, item(DEFAULT_THEME).style);
  assert.equal(resolveLook(parseProfile({ owned: ["theme-pink"], theme: "theme-pink" }), catalogue).theme, "#e8458b");
  // Even an empty catalogue still draws something.
  assert.deepEqual(resolveLook(parseProfile({}), []), DEFAULT_LOOK);
});

test("uploaded frames and banners draw their picture", () => {
  const halo: Cosmetic = {
    id: "c1",
    kind: "frame",
    name: "Halo",
    price: 3,
    rarity: "rare",
    style: null,
    imageUrl: UPLOAD,
    active: false, // hidden from the shop, but owners keep wearing it
    categoryId: null,
  };
  const wide: Cosmetic = { ...halo, id: "c2", kind: "banner", name: "Beach" };
  const withUploads = [...catalogue, halo, wide];
  const p = parseProfile({ owned: ["c1", "c2"], frame: "c1", banner: "c2" });
  const look = resolveLook(p, withUploads);
  assert.equal(look.frame, UPLOAD);
  assert.ok(isFrameImage(look.frame!));
  assert.equal(look.banner, `center / cover no-repeat url("${UPLOAD}")`);
  // Built-in frames are CSS classes, not pictures.
  assert.equal(isFrameImage("frame-neon"), false);
  // A picture uploaded onto a built-in banner replaces its gradient.
  assert.equal(bannerCss({ style: "linear-gradient(red, blue)", imageUrl: UPLOAD }).includes("url("), true);
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

test("a category bundle is the plain sum of what you don't own yet", () => {
  const flags = (id: string, price: number, extra: Partial<Cosmetic> = {}): Cosmetic => ({
    ...item("banner-sunset"),
    id,
    price,
    categoryId: "flags",
    ...extra,
  });
  const withFlags = [
    ...catalogue,
    flags("f-ie", 2),
    flags("f-pride", 3, { kind: "frame" }),
    flags("f-trans", 4),
    flags("f-free", 0),
    flags("f-hidden", 5, { active: false }),
  ];
  const all = bundleFor(parseProfile({}), withFlags, "flags");
  // Free items are already everyone's; hidden ones aren't for sale.
  assert.deepEqual(all.items.map((i) => i.id), ["f-ie", "f-pride", "f-trans"]);
  assert.equal(all.price, 9);

  const some = bundleFor(parseProfile({ owned: ["f-pride"] }), withFlags, "flags");
  assert.equal(some.price, 6);
  assert.equal(bundleFor(parseProfile({}), withFlags, "nope").items.length, 0);

  const after = withOwned(parseProfile({ owned: ["f-pride"], banner: "banner-ocean" }), some.items);
  assert.deepEqual(after.owned, ["f-pride", "f-ie", "f-trans"]);
  assert.equal(after.banner, "banner-ocean"); // buying a bundle doesn't change what you wear
  assert.equal(bundleFor(after, withFlags, "flags").items.length, 0);
});
