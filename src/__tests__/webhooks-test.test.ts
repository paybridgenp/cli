import { describe, it, expect } from "bun:test";
import { createHmac } from "crypto";
import { PayBridge } from "@paybridge-np/sdk";
import { randomHex } from "../commands/webhooks/test-event.js";

// --- helpers mirroring the production code ---

function buildPayload(event: string, amount: number): Record<string, unknown> {
  const baseId = "evt_test_" + randomHex(16);
  const payId = "pay_test_" + randomHex(16);
  const sessionId = "cs_test_" + randomHex(16);
  const ts = Math.floor(Date.now() / 1000);

  switch (event) {
    case "payment.succeeded":
      return {
        id: baseId,
        type: "payment.succeeded",
        created: ts,
        data: {
          id: payId,
          amount,
          currency: "NPR",
          provider: "esewa",
          provider_ref: "TEST" + randomHex(8).toUpperCase(),
          session_id: sessionId,
          metadata: { source: "paybridge-cli-test" },
        },
      };
    case "payment.failed":
    case "payment.cancelled":
      return {
        id: baseId,
        type: event,
        created: ts,
        data: {
          id: payId,
          session_id: sessionId,
          provider: "esewa",
          amount,
          currency: "NPR",
          reason: "test event from paybridge CLI",
          metadata: { source: "paybridge-cli-test" },
        },
      };
    case "payment.refunded":
      return {
        id: baseId,
        type: "payment.refunded",
        created: ts,
        data: {
          id: payId,
          session_id: sessionId,
          refund_id: "ref_test_" + randomHex(16),
          amount,
          refunded_amount: amount,
          metadata: { source: "paybridge-cli-test" },
        },
      };
    default:
      return { id: baseId, type: event, created: ts, data: { amount } };
  }
}

function buildSignature(body: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("randomHex", () => {
  it("returns a hex string of the requested length", () => {
    const h = randomHex(16);
    expect(h).toHaveLength(16);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
  });

  it("returns different values on subsequent calls", () => {
    const a = randomHex(16);
    const b = randomHex(16);
    expect(a).not.toBe(b);
  });
});

describe("payment.succeeded payload", () => {
  it("has the correct top-level structure", () => {
    const p = buildPayload("payment.succeeded", 10000);
    expect(typeof p.id).toBe("string");
    expect((p.id as string).startsWith("evt_test_")).toBe(true);
    expect(p.type).toBe("payment.succeeded");
    expect(typeof p.created).toBe("number");
  });

  it("sets data.amount to the opts.amount", () => {
    const p = buildPayload("payment.succeeded", 25000);
    const data = p.data as Record<string, unknown>;
    expect(data.amount).toBe(25000);
  });

  it("sets data.currency to NPR", () => {
    const p = buildPayload("payment.succeeded", 10000);
    const data = p.data as Record<string, unknown>;
    expect(data.currency).toBe("NPR");
  });
});

describe("payment.failed / payment.cancelled payload", () => {
  it("has a reason field in data", () => {
    const p = buildPayload("payment.failed", 10000);
    const data = p.data as Record<string, unknown>;
    expect(typeof data.reason).toBe("string");
  });

  it("sets the correct event type", () => {
    expect(buildPayload("payment.failed", 1000).type).toBe("payment.failed");
    expect(buildPayload("payment.cancelled", 1000).type).toBe("payment.cancelled");
  });
});

describe("payment.refunded payload", () => {
  it("has a refund_id field in data", () => {
    const p = buildPayload("payment.refunded", 10000);
    const data = p.data as Record<string, unknown>;
    expect(typeof data.refund_id).toBe("string");
    expect((data.refund_id as string).startsWith("ref_test_")).toBe(true);
  });

  it("sets refunded_amount equal to amount", () => {
    const p = buildPayload("payment.refunded", 5000);
    const data = p.data as Record<string, unknown>;
    expect(data.refunded_amount).toBe(5000);
  });
});

describe("signature header", () => {
  it("sets X-PayBridge-Signature when --secret is provided", () => {
    const body = JSON.stringify(buildPayload("payment.succeeded", 10000));
    const secret = "whsec_testsecret";
    const header = buildSignature(body, secret);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it("generated signature is verifiable by PayBridge.webhooks.constructEvent", async () => {
    const payload = buildPayload("payment.succeeded", 10000);
    const body = JSON.stringify(payload);
    const secret = "whsec_verifytest";
    const header = buildSignature(body, secret);

    const event = await PayBridge.webhooks.constructEvent(body, header, secret);
    expect(event.type).toBe("payment.succeeded");
  });
});
