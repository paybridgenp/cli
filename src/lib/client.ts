import { PayBridge } from "@paybridge-np/sdk";
import { getApiKey, getApiBase } from "./config.js";
import { fatal } from "./output.js";

export function createClient(): InstanceType<typeof PayBridge> {
  const apiKey = getApiKey();
  if (!apiKey) {
    fatal("Not logged in. Run: paybridgenp login");
  }
  return new PayBridge({ apiKey, baseUrl: getApiBase() });
}
