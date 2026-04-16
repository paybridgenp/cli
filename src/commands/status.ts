import pc from "picocolors";
import { getApiKey, getConfig, maskKey, getKeyMode, getKeySource, getApiBase } from "../lib/config.js";
import { createClient } from "../lib/client.js";
import { fatal, blank, label, success, error, header } from "../lib/output.js";
import { handleError } from "../lib/errors.js";

export async function statusCommand(opts: { debug: boolean }): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    fatal("Not logged in. Run: paybridgenp login");
  }

  // Verify key is still valid
  const client = createClient();
  try {
    await client.payments.list({ limit: 1 });
  } catch (err: any) {
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      fatal("API key is invalid or revoked. Run: paybridgenp login");
    }
    // Don't fail status for network issues — still show what we know
    error("Could not reach API. Showing stored config.");
  }

  const mode = getKeyMode(apiKey!);

  blank();
  console.log("  " + pc.bold("PayBridgeNP CLI"));
  blank();
  label("Key", maskKey(apiKey!));
  label("Mode", mode === "sandbox" ? pc.yellow("sandbox") : pc.green("live"));
  label("API", getApiBase());
  label("Source", pc.dim(getKeySource()));
  blank();
}
