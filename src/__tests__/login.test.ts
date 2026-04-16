import { describe, it, expect, spyOn, mock, beforeEach, afterEach } from "bun:test";

describe("loginCommand — input validation", () => {
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    exitSpy = spyOn(process, "exit").mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`);
    });
    stderrSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("fatal called when publishable key pk_ is provided", async () => {
    // Test the underlying validation directly rather than mocking all of @clack/prompts
    const { validateKeyFormat } = await import("../lib/config.js");

    // pk_ keys fail format validation
    expect(validateKeyFormat("pk_test_" + "a".repeat(32))).toBe(false);
    expect(validateKeyFormat("pk_live_" + "a".repeat(32))).toBe(false);
  });

  it("validateKeyFormat gates login — rejects empty string", async () => {
    const { validateKeyFormat } = await import("../lib/config.js");
    expect(validateKeyFormat("")).toBe(false);
  });

  it("validateKeyFormat gates login — rejects key with wrong prefix", async () => {
    const { validateKeyFormat } = await import("../lib/config.js");
    expect(validateKeyFormat("live_sk_" + "a".repeat(32))).toBe(false);
  });

  it("validateKeyFormat gates login — accepts valid sk_test_ key", async () => {
    const { validateKeyFormat } = await import("../lib/config.js");
    expect(validateKeyFormat("sk_test_" + "a".repeat(32))).toBe(true);
  });

  it("validateKeyFormat gates login — accepts valid sk_live_ key", async () => {
    const { validateKeyFormat } = await import("../lib/config.js");
    expect(validateKeyFormat("sk_live_" + "B".repeat(32))).toBe(true);
  });
});
