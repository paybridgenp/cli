import { createHmac, randomBytes } from "crypto";
import pc from "picocolors";
import { blank, error as printError, fatal, info, label } from "../../lib/output.js";

export type EventType = "payment.succeeded" | "payment.failed" | "payment.cancelled" | "payment.refunded";

export interface TestEventOpts {
  secret?: string;
  event: string;
  amount: number;
  debug: boolean;
}

export function randomHex(n: number): string {
  return randomBytes(n).toString("hex").slice(0, n);
}

function buildPayload(event: string, amount: number): object {
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
      return {
        id: baseId,
        type: event,
        created: ts,
        data: {
          amount,
          metadata: { source: "paybridge-cli-test" },
        },
      };
  }
}

export async function webhooksTestEventCommand(url: string, opts: TestEventOpts): Promise<void> {
  // Validate URL
  try {
    new URL(url);
  } catch {
    fatal(`Invalid URL: ${url}`);
  }

  const payload = buildPayload(opts.event, opts.amount);
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (opts.secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = createHmac("sha256", opts.secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    headers["X-PayBridge-Signature"] = `t=${timestamp},v1=${sig}`;
  }

  blank();
  console.log("  " + pc.bold(`POST ${url}`));
  blank();

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body });
  } catch (err) {
    fatal(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const resText = await res.text();
  const statusColor = res.ok ? pc.green : pc.red;

  label("Status", statusColor(`${res.status} ${res.statusText}`));
  label("Body", resText || "(empty)");
  blank();
  console.log("  " + pc.dim("Payload (copy to replay manually):"));
  console.log(JSON.stringify(payload, null, 2).split("\n").map((l) => "  " + l).join("\n"));
  blank();

  if (!res.ok) {
    printError(`Server responded with ${res.status}`);
    process.exit(1);
  }
}
