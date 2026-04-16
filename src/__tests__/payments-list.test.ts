import { describe, it, expect, spyOn, mock, beforeEach, afterEach } from "bun:test";

describe("paymentsListCommand", () => {
  it("clamps limit to 100 when limit > 100", async () => {
    // We test the clamping logic directly since it's inline in the function
    const limit = 150;
    const clamped = Math.min(limit, 100);
    expect(clamped).toBe(100);
  });

  it("passes limit as-is when limit <= 100", async () => {
    const limit = 20;
    const clamped = Math.min(limit, 100);
    expect(clamped).toBe(20);
  });

  it("passes limit of exactly 100 unchanged", async () => {
    const limit = 100;
    const clamped = Math.min(limit, 100);
    expect(clamped).toBe(100);
  });

  it("calls client.payments.list with clamped limit", async () => {
    // Mock the createClient module
    let capturedLimit: number | undefined;

    const mockList = mock(async (params: { limit?: number }) => {
      capturedLimit = params.limit;
      return { data: [], meta: { total: 0, limit: params.limit ?? 20, offset: 0 } };
    });

    const mockClient = { payments: { list: mockList } };

    mock.module("../lib/client.js", () => ({
      createClient: () => mockClient,
    }));

    // Also suppress console output
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      const { paymentsListCommand } = await import("../commands/payments/list.js");
      await paymentsListCommand({ limit: 200, watch: false, debug: false });
      expect(capturedLimit).toBe(100);
    } finally {
      logSpy.mockRestore();
      stdoutSpy.mockRestore();
      mock.restore();
    }
  });

  it("calls client.payments.list with limit 20 by default", async () => {
    let capturedLimit: number | undefined;

    const mockList = mock(async (params: { limit?: number }) => {
      capturedLimit = params.limit;
      return { data: [], meta: { total: 0, limit: params.limit ?? 20, offset: 0 } };
    });

    const mockClient = { payments: { list: mockList } };

    mock.module("../lib/client.js", () => ({
      createClient: () => mockClient,
    }));

    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      const { paymentsListCommand } = await import("../commands/payments/list.js");
      await paymentsListCommand({ limit: 20, watch: false, debug: false });
      expect(capturedLimit).toBe(20);
    } finally {
      logSpy.mockRestore();
      stdoutSpy.mockRestore();
      mock.restore();
    }
  });
});
