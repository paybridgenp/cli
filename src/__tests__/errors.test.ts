import { describe, it, expect, spyOn, mock, beforeEach, afterEach } from "bun:test";

// We test handleError by checking process.exit is called with 1
// and that console.error prints the expected message.

describe("handleError", () => {
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Prevent actual process exit
    exitSpy = spyOn(process, "exit").mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`);
    });
    stderrSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  async function callHandleError(err: unknown, debug = false): Promise<string> {
    const { handleError } = await import("../lib/errors.js");
    try {
      handleError(err, debug);
    } catch (e: any) {
      // Caught the thrown process.exit simulation
    }
    // Return what was printed to stderr
    const calls = stderrSpy.mock.calls;
    if (calls.length === 0) return "";
    return String(calls[calls.length - 1][0]);
  }

  it("calls process.exit(1) for authentication error", async () => {
    const err = Object.assign(new Error("Unauthorized"), { constructor: { name: "PayBridgeAuthenticationError" }, statusCode: 401 });
    Object.defineProperty(err, "constructor", { value: { name: "PayBridgeAuthenticationError" } });
    await callHandleError(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("calls process.exit(1) for 401 statusCode", async () => {
    const err = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    await callHandleError(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("calls process.exit(1) for 404 not found", async () => {
    const err = Object.assign(new Error("Not found"), { statusCode: 404 });
    await callHandleError(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("calls process.exit(1) for 400 bad request", async () => {
    const err = Object.assign(new Error("Bad request"), { statusCode: 400 });
    await callHandleError(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("calls process.exit(1) for 429 rate limit", async () => {
    const err = Object.assign(new Error("Too Many Requests"), { statusCode: 429 });
    await callHandleError(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("calls process.exit(1) for generic error", async () => {
    const err = new Error("Something went wrong");
    await callHandleError(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("calls process.exit(1) for non-Error unknown value", async () => {
    await callHandleError("a string error");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("prints full message in debug mode for generic error", async () => {
    const err = new Error("Full internal details");
    const output = await callHandleError(err, true);
    expect(output).toContain("Full internal details");
  });
});
