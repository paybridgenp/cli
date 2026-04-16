import { createRequire } from "module";
import pc from "picocolors";
import { blank, label } from "../lib/output.js";

const require = createRequire(import.meta.url);

function getCurrentVersion(): string {
  try {
    // dist/index.js → ../package.json = package root
    const pkg = require("../package.json");
    return pkg.version as string;
  } catch {
    return "0.0.0";
  }
}

async function getLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch("https://registry.npmjs.org/@paybridge-np%2Fcli/latest", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

function semverGt(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}

export async function updateCommand(): Promise<void> {
  const current = getCurrentVersion();

  blank();
  console.log("  " + pc.bold("Checking for updates..."));
  blank();

  label("Current", `v${current}`);

  const latest = await getLatestVersion();

  if (!latest) {
    console.log(pc.yellow("  ⚠ Could not fetch latest version from npm. The package may not be published yet, or check your internet connection."));
    blank();
    return;
  }

  label("Latest", `v${latest}`);
  blank();

  if (semverGt(latest, current)) {
    console.log(pc.green(`  ✓ Update available: v${current} → v${latest}`));
    blank();
    console.log("  Run one of:");
    blank();
    console.log(`  ${pc.dim("$")} npm install -g @paybridge-np/cli@latest`);
    console.log(`  ${pc.dim("$")} bun install -g @paybridge-np/cli@latest`);
    blank();
  } else {
    console.log(pc.green(`  ✓ You're up to date (v${current})`));
    blank();
  }
}
