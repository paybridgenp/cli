import { saveConfig, getConfig, maskKey, validateKeyFormat, getKeyMode } from "../lib/config.js";
import { createClient } from "../lib/client.js";
import { success, error, fatal, blank, label } from "../lib/output.js";
import pc from "picocolors";

async function promptInteractive(existing: { apiKey: string } | null): Promise<string> {
  const { confirm, password, isCancel } = await import("@clack/prompts");

  if (existing) {
    const overwrite = await confirm({
      message: `Already logged in as ${pc.cyan(maskKey(existing.apiKey))}. Overwrite?`,
      initialValue: false,
    });
    if (isCancel(overwrite) || !overwrite) process.exit(0);
  }

  const key = await password({
    message: "Paste your PayBridgeNP API key (sk_live_... or sk_test_...):",
    mask: "*",
  });

  if (isCancel(key)) process.exit(0);
  return String(key).trim();
}

export async function loginCommand(opts: { key?: string }): Promise<void> {
  const existing = getConfig();
  let trimmed: string;

  if (opts.key) {
    // Non-interactive: key passed via --key flag
    trimmed = opts.key.trim();
  } else if (process.stdin.isTTY) {
    // Interactive: prompt via @clack/prompts
    trimmed = await promptInteractive(existing);
  } else {
    fatal(
      "No TTY detected. Pass your API key directly:\n\n" +
      "    paybridgenp login --key sk_test_...\n\n" +
      "Or set the PAYBRIDGE_API_KEY environment variable to skip login entirely."
    );
  }

  // Reject publishable keys explicitly
  if (trimmed.startsWith("pk_")) {
    fatal("That looks like a publishable key (pk_...). The CLI needs a secret key (sk_live_... or sk_test_...).");
  }

  if (!validateKeyFormat(trimmed)) {
    fatal("Invalid key format. Expected sk_live_<32chars> or sk_test_<32chars>.");
  }

  // Verify key works against the API
  process.env.PAYBRIDGE_API_KEY = trimmed;
  const client = createClient();

  try {
    await client.payments.list({ limit: 1 });
  } catch (err: any) {
    delete process.env.PAYBRIDGE_API_KEY;
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      fatal("Invalid or revoked API key. Check your key in the PayBridgeNP dashboard.");
    }
    error("Could not verify key (network error). Saving anyway.");
  }

  saveConfig(trimmed, process.env.PAYBRIDGE_API_BASE);
  delete process.env.PAYBRIDGE_API_KEY;

  const mode = getKeyMode(trimmed);
  blank();
  success("Logged in.");
  blank();
  label("Key", maskKey(trimmed));
  label("Mode", mode === "sandbox" ? pc.yellow("sandbox") : pc.green("live"));
  blank();
}
