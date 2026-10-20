import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSiteUrl } from "../src/lib/site-url.ts";

test("an unset or empty origin defaults to the production site", () => {
  assert.equal(resolveSiteUrl("", true), "https://klinikavcifrah.ru");
  assert.equal(resolveSiteUrl("  ", true), "https://klinikavcifrah.ru");
});

test("normalizes the apex host and permits an explicit HTTPS staging origin", () => {
  assert.equal(resolveSiteUrl(" https://www.klinikavcifrah.ru/ ", true), "https://klinikavcifrah.ru");
  assert.equal(resolveSiteUrl("https://staging.example.com/", true), "https://staging.example.com");
});

test("rejects localhost, HTTP and malformed production configuration", () => {
  for (const origin of ["http://localhost:3000", "https://localhost", "https://127.0.0.1", "https://[::1]", "http://klinikavcifrah.ru", "https://klinikavcifrah.ru/path", "https://klinikavcifrah.ru?secret=x", "https://user:pass@klinikavcifrah.ru", "not a URL"]) {
    assert.throws(() => resolveSiteUrl(origin, true), undefined, origin);
  }
});

test("allows a deliberate localhost origin in development", () => {
  assert.equal(resolveSiteUrl("http://localhost:3000", false), "http://localhost:3000");
});
