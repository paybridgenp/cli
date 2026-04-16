import Conf from "conf";
import fs from "fs";

interface Schema {
  apiKey: string;
  apiBase: string;
}

const store = new Conf<Schema>({
  projectName: "paybridgenp",
  schema: {
    apiKey: { type: "string" },
    apiBase: { type: "string" },
  },
});

export function getConfig(): { apiKey: string; apiBase: string } | null {
  const apiKey = store.get("apiKey");
  if (!apiKey) return null;
  return {
    apiKey,
    apiBase: store.get("apiBase") ?? "https://api.paybridgenp.com",
  };
}

export function saveConfig(apiKey: string, apiBase?: string): void {
  store.set("apiKey", apiKey);
  if (apiBase) store.set("apiBase", apiBase);
  // Ensure config file is only readable by owner (conf doesn't enforce this on macOS)
  try { fs.chmodSync(store.path, 0o600); } catch { /* best-effort */ }
}

export function clearConfig(): void {
  store.clear();
}

export function getApiKey(): string | null {
  // env var takes priority
  if (process.env.PAYBRIDGE_API_KEY) return process.env.PAYBRIDGE_API_KEY;
  return getConfig()?.apiKey ?? null;
}

export function getApiBase(): string {
  if (process.env.PAYBRIDGE_API_BASE) return process.env.PAYBRIDGE_API_BASE;
  return getConfig()?.apiBase ?? "https://api.paybridgenp.com";
}

export function maskKey(key: string): string {
  return key.slice(0, 12) + "...";
}

export function validateKeyFormat(key: string): boolean {
  return /^sk_(live|test)_[a-zA-Z0-9]{32}$/.test(key);
}

export function getKeyMode(key: string): "sandbox" | "live" {
  return key.startsWith("sk_test_") ? "sandbox" : "live";
}

export function getKeySource(): string {
  if (process.env.PAYBRIDGE_API_KEY) return "PAYBRIDGE_API_KEY environment variable";
  return `config file (${store.path})`;
}
