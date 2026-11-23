import { test } from "node:test";
import assert from "node:assert/strict";
import { isTestEmail, newTestIdentity, TEST_EMAIL_DOMAIN } from "../lib/test-accounts";

test("test accounts use the reserved test domain", () => {
  const { email, name } = newTestIdentity("Ab3_x9z");
  assert.equal(email, `newcomer-ab3x9z@${TEST_EMAIL_DOMAIN}`);
  assert.equal(name, "Newcomer Test AB3X9Z");
  assert.ok(isTestEmail(email));
});

test("real addresses are never test accounts", () => {
  assert.equal(isTestEmail("aoife.murphy@leisureworldcork.com"), false);
  assert.equal(isTestEmail("someone@yayup.test.example.com"), false);
  assert.equal(isTestEmail(null), false);
  assert.ok(isTestEmail(" Newcomer-1@YAYUP.TEST "));
});

test("fresh identities differ", () => {
  assert.notEqual(newTestIdentity().email, newTestIdentity().email);
});
