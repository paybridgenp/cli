import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getApiKey, validateKeyFormat, maskKey, getKeyMode } from "../lib/config.js";

describe("getApiKey", () => {
  const originalEnv = process.env.PAYBRIDGE_API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PAYBRIDGE_API_KEY;
    } else {
      process.env.PAYBRIDGE_API_KEY = originalEnv;
    }
  });

  it("returns env var when PAYBRIDGE_API_KEY is set, ignoring config file", () => {
    const testKey = "sk_test_" + "a".repeat(32);
    process.env.PAYBRIDGE_API_KEY = testKey;
    expect(getApiKey()).toBe(testKey);
  });
});

describe("validateKeyFormat", () => {
  it("returns true for a valid sk_test_ key", () => {
    expect(validateKeyFormat("sk_test_" + "a".repeat(32))).toBe(true);
  });

  it("returns true for a valid sk_live_ key", () => {
    expect(validateKeyFormat("sk_live_" + "A".repeat(32))).toBe(true);
  });

  it("returns true for alphanumeric 32-char suffix", () => {
    expect(validateKeyFormat("sk_live_" + "aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV")).toBe(true);
  });

  it("returns false for pk_test_ publishable key", () => {
    expect(validateKeyFormat("pk_test_" + "a".repeat(32))).toBe(false);
  });

  it("returns false for pk_live_ publishable key", () => {
    expect(validateKeyFormat("pk_live_" + "a".repeat(32))).toBe(false);
  });

  it("returns false for a short key", () => {
    expect(validateKeyFormat("sk_test_short")).toBe(false);
  });

  it("returns false for a random string", () => {
    expect(validateKeyFormat("not-a-valid-key")).toBe(false);
  });

  it("returns false for sk_test_ with 31 chars", () => {
    expect(validateKeyFormat("sk_test_" + "a".repeat(31))).toBe(false);
  });

  it("returns false for sk_test_ with 33 chars", () => {
    expect(validateKeyFormat("sk_test_" + "a".repeat(33))).toBe(false);
  });
});

describe("maskKey", () => {
  it("returns only the first 12 chars followed by ...", () => {
    const key = "sk_test_abcd1234xyz_extra_stuff";
    expect(maskKey(key)).toBe("sk_test_abcd...");
  });

  it("result always ends with ...", () => {
    const key = "sk_live_" + "x".repeat(32);
    const masked = maskKey(key);
    expect(masked.endsWith("...")).toBe(true);
    expect(masked.length).toBe(15); // 12 chars + "..."
  });
});

describe("getKeyMode", () => {
  it("returns sandbox for sk_test_ keys", () => {
    expect(getKeyMode("sk_test_" + "a".repeat(32))).toBe("sandbox");
  });

  it("returns live for sk_live_ keys", () => {
    expect(getKeyMode("sk_live_" + "a".repeat(32))).toBe("live");
  });
});
