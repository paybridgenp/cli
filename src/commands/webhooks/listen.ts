import * as http from "http";
import { PayBridge } from "@paybridge-np/sdk";
import { openTunnel } from "../../lib/tunnel.js";
import { blank, error as printError, warn, label, info } from "../../lib/output.js";
import pc from "picocolors";

export interface ListenOpts {
  port: number;
  secret?: string;
  forward?: string;
  debug: boolean;
}

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 100;
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function printEventSummary(parsed: Record<string, unknown>): void {
  const type = parsed.type as string | undefined;
  const data = parsed.data as Record<string, unknown> | undefined;

  console.log(`  ${pc.bold(`[${formatTime()}]`)} ${pc.cyan(type ?? "unknown")}`);

  if (!data) return;

  const indent = "             ";

  switch (type) {
    case "payment.succeeded": {
      if (data.id) console.log(`${indent}id:           ${data.id}`);
      if (data.amount !== undefined) console.log(`${indent}amount:       NPR ${((data.amount as number) / 100).toFixed(2)}`);
      if (data.provider) console.log(`${indent}provider:     ${data.provider}`);
      if (data.provider_ref) console.log(`${indent}provider_ref: ${data.provider_ref}`);
      break;
    }
    case "payment.failed":
    case "payment.cancelled": {
      if (data.id) console.log(`${indent}id:           ${data.id}`);
      if (data.reason) console.log(`${indent}reason:       ${data.reason}`);
      break;
    }
    case "payment.refunded": {
      if (data.id) console.log(`${indent}id:           ${data.id}`);
      if (data.refund_id) console.log(`${indent}refund_id:    ${data.refund_id}`);
      if (data.refunded_amount !== undefined) console.log(`${indent}refunded_amt: NPR ${((data.refunded_amount as number) / 100).toFixed(2)}`);
      break;
    }
    default: {
      console.log(`${indent}type:         ${type ?? "unknown"}`);
      console.log(`${indent}data:         ${JSON.stringify(data)}`);
    }
  }
}

export async function webhooksListenCommand(opts: ListenOpts): Promise<void> {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    const ip = req.socket.remoteAddress ?? "unknown";

    if (isRateLimited(ip)) {
      res.writeHead(429, { "Content-Type": "text/plain" });
      res.end("Too Many Requests");
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const sig = req.headers["x-paybridge-signature"] as string | undefined ?? null;

      if (opts.secret) {
        try {
          await PayBridge.webhooks.constructEvent(body, sig, opts.secret);
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("OK");
        } catch {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Bad Request");
          printError("[REJECTED] Invalid signature");
          return;
        }
      } else {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
      }

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(body) as Record<string, unknown>;
      } catch {
        // Not JSON — just print raw
        console.log(`  ${pc.bold(`[${formatTime()}]`)} ${pc.dim("(non-JSON body)")}`);
      }

      blank();
      printEventSummary(parsed);
      blank();

      if (opts.forward) {
        try {
          const forwardHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (sig) forwardHeaders["X-PayBridge-Signature"] = sig;
          await fetch(opts.forward, {
            method: "POST",
            headers: forwardHeaders,
            body,
          });
        } catch (err) {
          printError(`Forward failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });
  });

  server.listen(opts.port, "localhost");

  let tunnel: Awaited<ReturnType<typeof openTunnel>>;
  try {
    tunnel = await openTunnel(opts.port);
  } catch (err) {
    printError(`${err instanceof Error ? err.message : String(err)}`);
    server.close();
    process.exit(1);
  }

  blank();
  console.log("  " + pc.bold("Webhook listener ready"));
  blank();
  label("Local", `http://localhost:${opts.port}`);
  label("Public", tunnel.url);
  blank();

  if (!opts.secret) {
    warn("Signature verification disabled. Pass --secret whsec_... to verify events.");
    blank();
  }

  info("Add this URL to your PayBridgeNP dashboard -> Webhooks -> Add endpoint");
  info("Listening for events... (Ctrl+C to stop)");
  blank();

  const cleanup = () => {
    tunnel.close();
    server.close();
    blank();
    console.log("  Stopped.");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
}
