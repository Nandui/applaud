import { test } from "node:test";
import assert from "node:assert/strict";
import { emailOn } from "../lib/email/switches";

const all = { emailsEnabled: true, emailRecognitions: true, emailTeamAnnouncements: true, emailInvites: true, emailSuggestions: true };

test("every kind is sent when all switches are on", () => {
  for (const kind of ["recognition", "team", "invite", "suggestion"] as const) assert.equal(emailOn(all, kind), true);
});

test("the master switch stops every kind of email", () => {
  for (const kind of ["recognition", "team", "invite", "suggestion"] as const) {
    assert.equal(emailOn({ ...all, emailsEnabled: false }, kind), false);
  }
});

test("each kind has its own switch", () => {
  const noTeam = { ...all, emailTeamAnnouncements: false };
  assert.equal(emailOn(noTeam, "team"), false);
  assert.equal(emailOn(noTeam, "recognition"), true);
  assert.equal(emailOn({ ...all, emailInvites: false }, "invite"), false);
  assert.equal(emailOn({ ...all, emailRecognitions: false }, "recognition"), false);
  assert.equal(emailOn({ ...all, emailSuggestions: false }, "suggestion"), false);
  assert.equal(emailOn({ ...all, emailSuggestions: false }, "recognition"), true);
});
