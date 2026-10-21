import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PINNED,
  levelFor,
  parseProfile,
  profileInputSchema,
  toStoredProfile,
  unlockedDecorations,
  xpFor,
  xpForLevel,
  isLight,
  DEFAULT_THEME,
} from "../lib/profile-custom";
import { daysLeft } from "../lib/periods";

const none = { received: 0, given: 0, awardsWon: 0, milestones: 0, level: 1 };

test("levels: thresholds grow by 50 XP per level", () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 50);
  assert.equal(xpForLevel(3), 150);
  assert.equal(xpForLevel(4), 300);
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(49).level, 1);
  assert.equal(levelFor(50).level, 2);
  const l = levelFor(160);
  assert.equal(l.level, 3);
  assert.equal(l.intoLevel, 10);
  assert.equal(l.levelSpan, 150);
  assert.ok(l.progress > 0 && l.progress < 1);
});

test("xp counts points plus shout-outs sent and received", () => {
  assert.equal(xpFor({ pointsEarned: 100, given: 2, received: 3 }), 100 + 30 + 30);
  assert.equal(xpFor({ pointsEarned: -40, given: 0, received: 0 }), 0);
});

test("decorations unlock from activity, never purchase", () => {
  assert.equal(unlockedDecorations(none).size, 0);
  const some = unlockedDecorations({ ...none, received: 10, given: 5 });
  assert.deepEqual([...some].sort(), ["neon", "spark", "wave"]);
  assert.ok(unlockedDecorations({ ...none, awardsWon: 1 }).has("gold"));
  assert.ok(unlockedDecorations({ ...none, milestones: 1 }).has("party"));
  assert.ok(unlockedDecorations({ ...none, level: 10 }).has("crown"));
  assert.ok(!unlockedDecorations({ ...none, level: 9 }).has("crown"));
});

test("parseProfile tolerates empty and malformed JSON", () => {
  for (const raw of [null, undefined, "nope", 42, [], {}]) {
    const p = parseProfile(raw);
    assert.equal(p.bio, "");
    assert.equal(p.status, null);
    assert.equal(p.decoration, null);
    assert.deepEqual(p.pinned, []);
    assert.equal(p.themed, false);
    assert.equal(p.theme.primary, DEFAULT_THEME.primary);
  }
  const bad = parseProfile({
    bio: "x".repeat(500),
    theme: { primary: "red", accent: "#000000" },
    decoration: "not-a-ring",
    pinned: ["a", "b", "c", "d", "e"],
    status: { emoji: "", text: "" },
  });
  assert.equal(bad.bio, "");
  assert.equal(bad.themed, false);
  assert.equal(bad.decoration, null);
  assert.equal(bad.status, null);
  assert.equal(bad.pinned.length, MAX_PINNED);
});

test("parseProfile reads a stored profile back", () => {
  const p = parseProfile({
    pronouns: "she/her",
    bio: "hi",
    status: { emoji: "🔥", text: "on shift" },
    theme: { primary: "#ff4f9a", accent: "#ff9f43" },
    decoration: "neon",
    pinned: ["r1"],
  });
  assert.equal(p.pronouns, "she/her");
  assert.deepEqual(p.status, { emoji: "🔥", text: "on shift" });
  assert.equal(p.themed, true);
  assert.equal(p.decoration, "neon");
  assert.deepEqual(p.pinned, ["r1"]);
});

test("toStoredProfile drops locked rings and pins you can't use", () => {
  const input = profileInputSchema.parse({
    bio: "  hello  ",
    statusEmoji: "☕",
    themePrimary: "#AABBCC",
    themeAccent: "#112233",
    decoration: "gold",
    pinned: ["r1", "r1", "someone-elses"],
  });
  const locked = toStoredProfile(input, {
    decorations: new Set(["spark"]),
    pinnable: new Set(["r1", "r2"]),
  });
  assert.equal(locked.bio, "hello");
  assert.equal(locked.decoration, null);
  assert.deepEqual(locked.pinned, ["r1"]);
  assert.deepEqual(locked.theme, { primary: "#aabbcc", accent: "#112233" });
  assert.deepEqual(locked.status, { emoji: "☕", text: "" });

  const unlocked = toStoredProfile(input, {
    decorations: new Set(["gold"]),
    pinnable: new Set(),
  });
  assert.equal(unlocked.decoration, "gold");
  assert.deepEqual(unlocked.pinned, []);
  // Round-trips through the reader.
  assert.equal(parseProfile(unlocked).decoration, "gold");
});

test("profile input rejects bad colours and too many pins", () => {
  assert.equal(profileInputSchema.safeParse({ themePrimary: "purple" }).success, false);
  assert.equal(profileInputSchema.safeParse({ pinned: ["a", "b", "c", "d"] }).success, false);
});

test("isLight picks readable text for theme colours", () => {
  assert.equal(isLight("#c6f432"), true);
  assert.equal(isLight("#ffffff"), true);
  assert.equal(isLight("#6a4dff"), false);
  assert.equal(isLight("#0b0b10"), false);
  assert.equal(isLight("nope"), false);
});

test("daysLeft counts down to the end of the period", () => {
  const ref = new Date(2026, 9, 21, 12);
  assert.equal(daysLeft("month", ref), 11);
  assert.equal(daysLeft("all", ref), null);
});
