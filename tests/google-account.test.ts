import { test } from "node:test";
import assert from "node:assert/strict";
import { nameFromGoogle, normaliseEmail } from "../lib/auth/google-account";

test("emails are matched in lower case", () => {
  assert.equal(normaliseEmail("  John.Smith@LeisureWorldCork.com "), "john.smith@leisureworldcork.com");
  assert.equal(normaliseEmail(undefined), "");
});

test("names come from Google", () => {
  const email = "aoife.murphy@leisureworldcork.com";
  assert.equal(nameFromGoogle({ name: "  Aoife   Murphy " }, email), "Aoife Murphy");
  assert.equal(nameFromGoogle({ given_name: "Aoife", family_name: "Murphy" }, email), "Aoife Murphy");
});

test("names fall back to the email", () => {
  assert.equal(nameFromGoogle({}, "aoife.murphy@leisureworldcork.com"), "Aoife Murphy");
  assert.equal(nameFromGoogle({ name: 42 }, "sean_obrien@leisureworldcork.com"), "Sean Obrien");
});
