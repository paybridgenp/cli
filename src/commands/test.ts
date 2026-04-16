import { confirm, isCancel } from "@clack/prompts";
import pc from "picocolors";
import { getApiKey, getKeyMode } from "../lib/config.js";
import { createClient } from "../lib/client.js";
import { fatal, blank, label, warn, formatAmount } from "../lib/output.js";
import { handleError } from "../lib/errors.js";
import { execFile } from "child_process";

function openBrowser(url: string): void {
  if (process.platform === "darwin") {
    execFile("open", [url]);
  } else if (process.platform === "win32") {
    execFile("cmd", ["/c", "start", "", url]);
  } else {
    execFile("xdg-open", [url]);
  }
}

export async function testCommand(opts: { amount: number; open: boolean; debug: boolean }): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) fatal("Not logged in. Run: paybridgenp login");

  const mode = getKeyMode(apiKey!);

  // Warn if live key
  if (mode === "live") {
    warn("This will create a LIVE checkout and charge real money.");
    const proceed = await confirm({
      message: "Continue with live key?",
      initialValue: false,
    });
    if (isCancel(proceed) || !proceed) process.exit(0);
  }

  const client = createClient();

  let session: any;
  try {
    session = await client.checkout.create({
      amount: opts.amount,
      currency: "NPR",
      returnUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
      metadata: { source: "paybridge-cli-test" },
    });
  } catch (err) {
    handleError(err, opts.debug);
  }

  blank();
  console.log("  " + pc.bold("Checkout session created"));
  blank();
  label("Session ID", session.id);
  label("Amount", formatAmount(opts.amount));
  label("URL", pc.cyan(session.checkout_url));
  blank();

  if (opts.open) {
    const shouldOpen = await confirm({
      message: "Open in browser?",
      initialValue: true,
    });
    if (!isCancel(shouldOpen) && shouldOpen) {
      openBrowser(session.checkout_url);
    }
  } else {
    console.log("  " + pc.dim("(--no-open: skipping browser)"));
  }

  blank();
  console.log("  " + pc.bold("Sandbox test credentials"));
  blank();
  label("eSewa", "merchant code EPAYTEST");
  label("Khalti", "phone 9800000001 · PIN 1111 · OTP 987654");
  label("ConnectIPS", "username testmerchant · password Test@123");
  blank();
}
