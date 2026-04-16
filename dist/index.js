#!/usr/bin/env node

// src/index.ts
import { Command as Command3 } from "commander";

// src/lib/config.ts
import Conf from "conf";
import fs from "fs";
var store = new Conf({
  projectName: "paybridgenp",
  schema: {
    apiKey: { type: "string" },
    apiBase: { type: "string" }
  }
});
function getConfig() {
  const apiKey = store.get("apiKey");
  if (!apiKey) return null;
  return {
    apiKey,
    apiBase: store.get("apiBase") ?? "https://api.paybridgenp.com"
  };
}
function saveConfig(apiKey, apiBase) {
  store.set("apiKey", apiKey);
  if (apiBase) store.set("apiBase", apiBase);
  try {
    fs.chmodSync(store.path, 384);
  } catch {
  }
}
function getApiKey() {
  if (process.env.PAYBRIDGE_API_KEY) return process.env.PAYBRIDGE_API_KEY;
  return getConfig()?.apiKey ?? null;
}
function getApiBase() {
  if (process.env.PAYBRIDGE_API_BASE) return process.env.PAYBRIDGE_API_BASE;
  return getConfig()?.apiBase ?? "https://api.paybridgenp.com";
}
function maskKey(key) {
  return key.slice(0, 12) + "...";
}
function validateKeyFormat(key) {
  return /^sk_(live|test)_[a-zA-Z0-9]{32}$/.test(key);
}
function getKeyMode(key) {
  return key.startsWith("sk_test_") ? "sandbox" : "live";
}
function getKeySource() {
  if (process.env.PAYBRIDGE_API_KEY) return "PAYBRIDGE_API_KEY environment variable";
  return `config file (${store.path})`;
}

// src/lib/client.ts
import { PayBridge } from "@paybridge-np/sdk";

// src/lib/output.ts
import pc from "picocolors";
function info(msg) {
  console.log(pc.dim("  " + msg));
}
function success(msg) {
  console.log(pc.green("  \u2713 ") + msg);
}
function warn(msg) {
  console.log(pc.yellow("  \u26A0 ") + msg);
}
function error(msg) {
  console.error(pc.red("  \u2717 ") + msg);
}
function fatal(msg) {
  error(msg);
  process.exit(1);
}
function label(key, value, indent = "  ") {
  console.log(indent + pc.dim(key.padEnd(14)) + value);
}
function blank() {
  console.log("");
}
function header(title) {
  blank();
  console.log("  " + pc.bold(title));
  blank();
}
function formatAmount(paisa) {
  return "NPR " + (paisa / 100).toFixed(2);
}
function formatDate(ts) {
  if (ts == null) return "-";
  const d = typeof ts === "number" ? new Date(ts * 1e3) : new Date(ts);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-NP", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}
function timeAgo(ts) {
  if (ts == null) return "-";
  const d = typeof ts === "number" ? new Date(ts * 1e3) : new Date(ts);
  if (isNaN(d.getTime())) return "-";
  const seconds = Math.floor((Date.now() - d.getTime()) / 1e3);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// src/lib/client.ts
function createClient() {
  const apiKey = getApiKey();
  if (!apiKey) {
    fatal("Not logged in. Run: paybridgenp login");
  }
  return new PayBridge({ apiKey, baseUrl: getApiBase() });
}

// src/commands/login.ts
import pc2 from "picocolors";
async function promptInteractive(existing) {
  const { confirm: confirm2, password, isCancel: isCancel3 } = await import("@clack/prompts");
  if (existing) {
    const overwrite = await confirm2({
      message: `Already logged in as ${pc2.cyan(maskKey(existing.apiKey))}. Overwrite?`,
      initialValue: false
    });
    if (isCancel3(overwrite) || !overwrite) process.exit(0);
  }
  const key = await password({
    message: "Paste your PayBridgeNP API key (sk_live_... or sk_test_...):",
    mask: "*"
  });
  if (isCancel3(key)) process.exit(0);
  return String(key).trim();
}
async function loginCommand(opts) {
  const existing = getConfig();
  let trimmed;
  if (opts.key) {
    trimmed = opts.key.trim();
  } else if (process.stdin.isTTY) {
    trimmed = await promptInteractive(existing);
  } else {
    fatal(
      "No TTY detected. Pass your API key directly:\n\n    paybridgenp login --key sk_test_...\n\nOr set the PAYBRIDGE_API_KEY environment variable to skip login entirely."
    );
  }
  if (trimmed.startsWith("pk_")) {
    fatal("That looks like a publishable key (pk_...). The CLI needs a secret key (sk_live_... or sk_test_...).");
  }
  if (!validateKeyFormat(trimmed)) {
    fatal("Invalid key format. Expected sk_live_<32chars> or sk_test_<32chars>.");
  }
  process.env.PAYBRIDGE_API_KEY = trimmed;
  const client = createClient();
  try {
    await client.payments.list({ limit: 1 });
  } catch (err) {
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
  label("Mode", mode === "sandbox" ? pc2.yellow("sandbox") : pc2.green("live"));
  blank();
}

// src/commands/status.ts
import pc3 from "picocolors";
async function statusCommand(opts) {
  const apiKey = getApiKey();
  if (!apiKey) {
    fatal("Not logged in. Run: paybridgenp login");
  }
  const client = createClient();
  try {
    await client.payments.list({ limit: 1 });
  } catch (err) {
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      fatal("API key is invalid or revoked. Run: paybridgenp login");
    }
    error("Could not reach API. Showing stored config.");
  }
  const mode = getKeyMode(apiKey);
  blank();
  console.log("  " + pc3.bold("PayBridgeNP CLI"));
  blank();
  label("Key", maskKey(apiKey));
  label("Mode", mode === "sandbox" ? pc3.yellow("sandbox") : pc3.green("live"));
  label("API", getApiBase());
  label("Source", pc3.dim(getKeySource()));
  blank();
}

// src/commands/test.ts
import { confirm, isCancel } from "@clack/prompts";
import pc4 from "picocolors";

// src/lib/errors.ts
function handleError(err, debug) {
  if (debug) {
    console.error(err);
  }
  if (err instanceof Error) {
    const name = err.constructor.name;
    const statusCode = err.statusCode;
    if (name === "PayBridgeAuthenticationError" || statusCode === 401 || statusCode === 403) {
      fatal("Invalid or revoked API key. Run: paybridgenp login");
    }
    if (name === "PayBridgeNotFoundError" || statusCode === 404) {
      fatal(`Not found: ${err.id ?? err.message}`);
    }
    if (name === "PayBridgeInvalidRequestError" || statusCode === 400) {
      fatal(`Bad request: ${err.message}`);
    }
    if (name === "PayBridgeRateLimitError" || statusCode === 429) {
      fatal("Rate limit hit. Wait a moment and try again.");
    }
    if (name === "PayBridgeError" && err.code === "connection_error") {
      fatal("Cannot reach api.paybridgenp.com. Check your internet connection.");
    }
    if (err.message.includes("fetch") || err.message.toLowerCase().includes("connection")) {
      fatal("Cannot reach api.paybridgenp.com. Check your internet connection.");
    }
    if (name === "PayBridgeSignatureVerificationError") {
      fatal("Webhook signature invalid. Check your --secret value.");
    }
    fatal(debug ? err.message : "Unexpected error. Run with --debug for details.");
  }
  fatal("Unexpected error. Run with --debug for details.");
}

// src/commands/test.ts
import { execFile } from "child_process";
function openBrowser(url) {
  if (process.platform === "darwin") {
    execFile("open", [url]);
  } else if (process.platform === "win32") {
    execFile("cmd", ["/c", "start", "", url]);
  } else {
    execFile("xdg-open", [url]);
  }
}
async function testCommand(opts) {
  const apiKey = getApiKey();
  if (!apiKey) fatal("Not logged in. Run: paybridgenp login");
  const mode = getKeyMode(apiKey);
  if (mode === "live") {
    warn("This will create a LIVE checkout and charge real money.");
    const proceed = await confirm({
      message: "Continue with live key?",
      initialValue: false
    });
    if (isCancel(proceed) || !proceed) process.exit(0);
  }
  const client = createClient();
  let session;
  try {
    session = await client.checkout.create({
      amount: opts.amount,
      currency: "NPR",
      returnUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
      metadata: { source: "paybridge-cli-test" }
    });
  } catch (err) {
    handleError(err, opts.debug);
  }
  blank();
  console.log("  " + pc4.bold("Checkout session created"));
  blank();
  label("Session ID", session.id);
  label("Amount", formatAmount(opts.amount));
  label("URL", pc4.cyan(session.checkout_url));
  blank();
  if (opts.open) {
    const shouldOpen = await confirm({
      message: "Open in browser?",
      initialValue: true
    });
    if (!isCancel(shouldOpen) && shouldOpen) {
      openBrowser(session.checkout_url);
    }
  } else {
    console.log("  " + pc4.dim("(--no-open: skipping browser)"));
  }
  blank();
  console.log("  " + pc4.bold("Sandbox test credentials"));
  blank();
  label("eSewa", "merchant code EPAYTEST");
  label("Khalti", "phone 9800000001 \xB7 PIN 1111 \xB7 OTP 987654");
  label("ConnectIPS", "username testmerchant \xB7 password Test@123");
  blank();
}

// src/commands/init.ts
import { intro, outro, text, select, isCancel as isCancel2, cancel } from "@clack/prompts";
import pc5 from "picocolors";
import fs2 from "fs";
import path from "path";

// src/templates/index.ts
var NEXTJS_CHECKOUT = `import PayBridge from "@paybridge-np/sdk";
import { NextResponse } from "next/server";

const pb = new PayBridge({ api_key: process.env.PAYBRIDGE_API_KEY! });

export async function POST(req: Request) {
  const { amount } = await req.json();
  const session = await pb.checkout.create({
    amount,
    currency: "NPR",
    returnUrl: \`\${process.env.NEXT_PUBLIC_APP_URL}/success\`,
    cancelUrl: \`\${process.env.NEXT_PUBLIC_APP_URL}/cancel\`,
  });
  return NextResponse.json({ url: session.checkout_url });
}
`;
var NEXTJS_WEBHOOK = `import PayBridge from "@paybridge-np/sdk";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("x-paybridge-signature") ?? "";
  try {
    const event = PayBridge.webhooks().constructEvent(
      body,
      sig,
      process.env.PAYBRIDGE_WEBHOOK_SECRET!
    );
    if (event.type === "payment.succeeded") {
      // TODO: fulfil order
      console.log("Payment succeeded:", event.data.id);
    }
    return new Response("OK");
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
}
`;
var NEXTJS_ENV_EXAMPLE = `PAYBRIDGE_API_KEY=sk_test_your_api_key_here
PAYBRIDGE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;
var NODE_INDEX = `import PayBridge from "@paybridge-np/sdk";
import http from "http";
import crypto from "crypto";

const pb = new PayBridge({ api_key: process.env.PAYBRIDGE_API_KEY! });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  // POST /checkout \u2014 create a checkout session
  if (req.method === "POST" && url.pathname === "/checkout") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { amount } = JSON.parse(body);

    const session = await pb.checkout.create({
      amount,
      currency: "NPR",
      returnUrl: "http://localhost:3000/success",
      cancelUrl: "http://localhost:3000/cancel",
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ url: session.checkout_url }));
    return;
  }

  // POST /webhook \u2014 receive payment events
  if (req.method === "POST" && url.pathname === "/webhook") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const sig = req.headers["x-paybridge-signature"] ?? "";

    try {
      const event = PayBridge.webhooks().constructEvent(
        body,
        sig as string,
        process.env.PAYBRIDGE_WEBHOOK_SECRET!
      );
      if (event.type === "payment.succeeded") {
        // TODO: fulfil order
        console.log("Payment succeeded:", event.data.id);
      }
      res.writeHead(200);
      res.end("OK");
    } catch {
      res.writeHead(400);
      res.end("Invalid signature");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
`;
var NODE_ENV_EXAMPLE = `PAYBRIDGE_API_KEY=sk_test_your_api_key_here
PAYBRIDGE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
`;
var BARE_INDEX = `import PayBridge from "@paybridge-np/sdk";

const pb = new PayBridge({ api_key: process.env.PAYBRIDGE_API_KEY! });

async function main() {
  // Create a checkout session
  const session = await pb.checkout.create({
    amount: 1000, // NPR 10.00
    currency: "NPR",
    returnUrl: "https://example.com/success",
    cancelUrl: "https://example.com/cancel",
    metadata: { order_id: "order_123" },
  });

  console.log("Checkout URL:", session.checkout_url);
  console.log("Session ID:", session.id);

  // List recent payments
  const payments = await pb.payments.list({ limit: 5 });
  console.log("Recent payments:", payments.data.length);
}

main().catch(console.error);
`;
var BARE_ENV_EXAMPLE = `PAYBRIDGE_API_KEY=sk_test_your_api_key_here
`;
function getTemplateFiles(framework, apiKey) {
  const keyPlaceholder = apiKey ?? "sk_test_your_api_key_here";
  if (framework === "nextjs") {
    return [
      { path: "app/api/checkout/route.ts", content: NEXTJS_CHECKOUT },
      { path: "app/api/webhook/route.ts", content: NEXTJS_WEBHOOK },
      { path: ".env", content: NEXTJS_ENV_EXAMPLE.replace("sk_test_your_api_key_here", keyPlaceholder) },
      { path: ".env.example", content: NEXTJS_ENV_EXAMPLE }
    ];
  }
  if (framework === "node") {
    return [
      { path: "index.ts", content: NODE_INDEX },
      { path: ".env", content: NODE_ENV_EXAMPLE.replace("sk_test_your_api_key_here", keyPlaceholder) },
      { path: ".env.example", content: NODE_ENV_EXAMPLE }
    ];
  }
  return [
    { path: "index.ts", content: BARE_INDEX },
    { path: ".env", content: BARE_ENV_EXAMPLE.replace("sk_test_your_api_key_here", keyPlaceholder) },
    { path: ".env.example", content: BARE_ENV_EXAMPLE }
  ];
}

// src/commands/init.ts
function ensureDir(dirPath) {
  fs2.mkdirSync(dirPath, { recursive: true });
}
function appendGitignore(dir) {
  const gitignorePath = path.join(dir, ".gitignore");
  const entry = ".env\n";
  if (!fs2.existsSync(gitignorePath)) {
    fs2.writeFileSync(gitignorePath, entry, "utf8");
    return;
  }
  const existing = fs2.readFileSync(gitignorePath, "utf8");
  if (!existing.split("\n").some((line) => line.trim() === ".env")) {
    fs2.appendFileSync(gitignorePath, existing.endsWith("\n") ? entry : "\n" + entry, "utf8");
  }
}
function packageJsonFor(name, framework) {
  if (framework === "nextjs") {
    return JSON.stringify(
      {
        name,
        version: "0.1.0",
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start"
        },
        dependencies: {
          "@paybridge-np/sdk": "^1.3.0",
          next: "^15.0.0",
          react: "^18.0.0",
          "react-dom": "^18.0.0"
        },
        devDependencies: {
          "@types/node": "^20.0.0",
          "@types/react": "^18.0.0",
          typescript: "^5.7.0"
        }
      },
      null,
      2
    ) + "\n";
  }
  if (framework === "node") {
    return JSON.stringify(
      {
        name,
        version: "0.1.0",
        type: "module",
        scripts: { start: "tsx index.ts", dev: "tsx --watch index.ts" },
        dependencies: { "@paybridge-np/sdk": "^1.3.0" },
        devDependencies: { "@types/node": "^20.0.0", tsx: "^4.0.0", typescript: "^5.7.0" }
      },
      null,
      2
    ) + "\n";
  }
  return JSON.stringify(
    {
      name,
      version: "0.1.0",
      type: "module",
      scripts: { start: "tsx index.ts" },
      dependencies: { "@paybridge-np/sdk": "^1.3.0" },
      devDependencies: { "@types/node": "^20.0.0", tsx: "^4.0.0", typescript: "^5.7.0" }
    },
    null,
    2
  ) + "\n";
}
async function initCommand(flags = {}) {
  intro(pc5.bold("PayBridgeNP \u2014 init"));
  const defaultName = path.basename(process.cwd());
  let projectName;
  if (flags.name) {
    projectName = flags.name.trim();
    console.log(`  ${pc5.dim("Project name")}  ${projectName}`);
  } else {
    const nameResult = await text({
      message: "Project name",
      placeholder: defaultName,
      defaultValue: defaultName,
      validate(v) {
        if (!v.trim()) return "Name cannot be empty";
      }
    });
    if (isCancel2(nameResult)) {
      cancel("Cancelled.");
      process.exit(0);
    }
    projectName = nameResult.trim();
  }
  const validFrameworks = ["nextjs", "node", "bare"];
  let framework;
  if (flags.framework) {
    if (!validFrameworks.includes(flags.framework)) {
      console.log(pc5.red(`  \u2717 Invalid framework "${flags.framework}". Choose: nextjs, node, bare`));
      process.exit(1);
    }
    framework = flags.framework;
    console.log(`  ${pc5.dim("Framework   ")}  ${framework}`);
  } else {
    const frameworkResult = await select({
      message: "Framework",
      options: [
        { value: "nextjs", label: "Next.js (App Router)" },
        { value: "node", label: "Node.js / Express" },
        { value: "bare", label: "Bare TypeScript" }
      ]
    });
    if (isCancel2(frameworkResult)) {
      cancel("Cancelled.");
      process.exit(0);
    }
    framework = frameworkResult;
  }
  const targetDir = path.resolve(process.cwd(), projectName);
  if (fs2.existsSync(targetDir)) {
    console.log(pc5.red(`  \u2717 Directory already exists: ${targetDir}`));
    process.exit(1);
  }
  ensureDir(targetDir);
  const apiKey = getApiKey();
  const files = getTemplateFiles(framework, apiKey);
  for (const file of files) {
    const fullPath = path.join(targetDir, file.path);
    ensureDir(path.dirname(fullPath));
    fs2.writeFileSync(fullPath, file.content, "utf8");
  }
  fs2.writeFileSync(
    path.join(targetDir, "package.json"),
    packageJsonFor(projectName, framework),
    "utf8"
  );
  appendGitignore(targetDir);
  blank();
  outro(pc5.green(`Project created in ./${projectName}`));
  blank();
  console.log("  " + pc5.bold("Next steps"));
  blank();
  console.log(`  ${pc5.dim("$")} cd ${projectName}`);
  console.log(`  ${pc5.dim("$")} npm install`);
  if (framework === "nextjs") {
    console.log(`  ${pc5.dim("$")} paybridgenp webhooks listen --port 4242`);
    console.log(`  ${pc5.dim("$")} npm run dev`);
  } else {
    console.log(`  ${pc5.dim("$")} paybridgenp webhooks listen --port 4242`);
    console.log(`  ${pc5.dim("$")} npm run dev`);
  }
  blank();
  if (!apiKey) {
    console.log(
      "  " + pc5.yellow("\u26A0") + pc5.dim(" No API key found. Edit .env and add your PAYBRIDGE_API_KEY, or run ") + pc5.bold("paybridgenp login")
    );
    blank();
  }
}

// src/commands/update.ts
import { createRequire } from "module";
import pc6 from "picocolors";
var require2 = createRequire(import.meta.url);
function getCurrentVersion() {
  try {
    const pkg = require2("../package.json");
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}
async function getLatestVersion() {
  try {
    const res = await fetch("https://registry.npmjs.org/@paybridge-np%2Fcli/latest", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5e3)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.version ?? null;
  } catch {
    return null;
  }
}
function semverGt(a, b) {
  const parse = (v) => v.replace(/^v/, "").split(".").map(Number);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}
async function updateCommand() {
  const current = getCurrentVersion();
  blank();
  console.log("  " + pc6.bold("Checking for updates..."));
  blank();
  label("Current", `v${current}`);
  const latest = await getLatestVersion();
  if (!latest) {
    console.log(pc6.yellow("  \u26A0 Could not fetch latest version from npm. The package may not be published yet, or check your internet connection."));
    blank();
    return;
  }
  label("Latest", `v${latest}`);
  blank();
  if (semverGt(latest, current)) {
    console.log(pc6.green(`  \u2713 Update available: v${current} \u2192 v${latest}`));
    blank();
    console.log("  Run one of:");
    blank();
    console.log(`  ${pc6.dim("$")} npm install -g @paybridge-np/cli@latest`);
    console.log(`  ${pc6.dim("$")} bun install -g @paybridge-np/cli@latest`);
    blank();
  } else {
    console.log(pc6.green(`  \u2713 You're up to date (v${current})`));
    blank();
  }
}

// src/commands/payments/index.ts
import { Command } from "commander";

// src/commands/payments/list.ts
import Table from "cli-table3";
import pc7 from "picocolors";
function statusColor(status) {
  if (status === "succeeded" || status === "success") return pc7.green(status);
  if (status === "failed") return pc7.red(status);
  if (status === "pending" || status === "processing") return pc7.yellow(status);
  return pc7.dim(status);
}
async function fetchAndPrint(limit, debug) {
  const client = createClient();
  let result;
  try {
    result = await client.payments.list({ limit: Math.min(limit, 100) });
  } catch (err) {
    handleError(err, debug);
  }
  const payments = result.data ?? [];
  if (payments.length === 0) {
    blank();
    console.log(pc7.dim("  No payments found."));
    blank();
    return;
  }
  const table = new Table({
    head: ["ID", "Amount", "Provider", "Status", "Created"].map((h) => pc7.bold(h)),
    style: { head: [], border: [], compact: true },
    chars: { mid: "", "left-mid": "", "mid-mid": "", "right-mid": "" }
  });
  for (const p of payments) {
    table.push([
      pc7.dim(p.id),
      formatAmount(p.amount),
      p.provider ?? "-",
      statusColor(p.status),
      timeAgo(p.createdAt ?? p.created_at ?? p.created)
    ]);
  }
  process.stdout.write("\x1Bc");
  blank();
  console.log(table.toString());
  blank();
}
async function paymentsListCommand(opts) {
  await fetchAndPrint(opts.limit, opts.debug);
  if (opts.watch) {
    console.log(pc7.dim("  Refreshing every 5s... (Ctrl+C to stop)"));
    setInterval(() => fetchAndPrint(opts.limit, opts.debug), 5e3);
    process.stdin.resume();
  }
}

// src/commands/payments/get.ts
import pc8 from "picocolors";
async function paymentsGetCommand(id, opts) {
  const client = createClient();
  let payment;
  try {
    payment = await client.payments.retrieve(id);
  } catch (err) {
    if (err?.statusCode === 404) fatal(`Payment not found: ${id}`);
    handleError(err, opts.debug);
  }
  blank();
  console.log("  " + pc8.bold(`Payment ${payment.id}`));
  blank();
  label("Amount", formatAmount(payment.amount));
  label("Status", payment.status);
  label("Provider", payment.provider ?? "-");
  label("Provider ref", payment.provider_ref ?? "-");
  label("Session", payment.checkout_session_id ?? "-");
  label("Created", formatDate(payment.createdAt ?? payment.created_at ?? payment.created));
  if (payment.metadata && Object.keys(payment.metadata).length > 0) {
    label("Metadata", JSON.stringify(payment.metadata, null, 2).replace(/\n/g, "\n" + " ".repeat(16)));
  }
  blank();
}

// src/commands/payments/index.ts
function makePaymentsCommand(debug) {
  const payments = new Command("payments").description("Manage payments");
  payments.command("list").description("List recent payments").option("--limit <n>", "number of results (max 100)", "20").option("--watch", "refresh every 5 seconds").action((opts) => paymentsListCommand({ limit: parseInt(opts.limit), watch: !!opts.watch, debug: debug() }));
  payments.command("get <id>").description("Get a single payment by ID").action((id, _opts) => paymentsGetCommand(id, { debug: debug() }));
  return payments;
}

// src/commands/webhooks/index.ts
import { Command as Command2 } from "commander";

// src/commands/webhooks/list.ts
import Table2 from "cli-table3";
async function webhooksListCommand(opts) {
  try {
    const client = createClient();
    const { data } = await client.webhooks.list();
    if (data.length === 0) {
      blank();
      info("No webhook endpoints registered. Add one in your PayBridgeNP dashboard.");
      blank();
      return;
    }
    header("Webhook Endpoints");
    const table = new Table2({
      head: ["ID", "URL", "Events", "Created"],
      style: { head: [], border: [] }
    });
    for (const wh of data) {
      const eventCount = wh.events?.length ?? 0;
      const eventLabel = eventCount === 1 ? "1 event" : `${eventCount} events`;
      const created = wh.created_at ? new Date(wh.created_at).toISOString().slice(0, 10) : "-";
      table.push([wh.id, wh.url, eventLabel, created]);
    }
    console.log(table.toString());
    blank();
  } catch (err) {
    handleError(err, opts.debug);
  }
}

// src/commands/webhooks/test-event.ts
import { createHmac, randomBytes } from "crypto";
import pc9 from "picocolors";
function randomHex(n) {
  return randomBytes(n).toString("hex").slice(0, n);
}
function buildPayload(event, amount) {
  const baseId = "evt_test_" + randomHex(16);
  const payId = "pay_test_" + randomHex(16);
  const sessionId = "cs_test_" + randomHex(16);
  const ts = Math.floor(Date.now() / 1e3);
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
          metadata: { source: "paybridge-cli-test" }
        }
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
          metadata: { source: "paybridge-cli-test" }
        }
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
          metadata: { source: "paybridge-cli-test" }
        }
      };
    default:
      return {
        id: baseId,
        type: event,
        created: ts,
        data: {
          amount,
          metadata: { source: "paybridge-cli-test" }
        }
      };
  }
}
async function webhooksTestEventCommand(url, opts) {
  try {
    new URL(url);
  } catch {
    fatal(`Invalid URL: ${url}`);
  }
  const payload = buildPayload(opts.event, opts.amount);
  const body = JSON.stringify(payload);
  const headers = { "Content-Type": "application/json" };
  if (opts.secret) {
    const timestamp = Math.floor(Date.now() / 1e3).toString();
    const sig = createHmac("sha256", opts.secret).update(`${timestamp}.${body}`).digest("hex");
    headers["X-PayBridge-Signature"] = `t=${timestamp},v1=${sig}`;
  }
  blank();
  console.log("  " + pc9.bold(`POST ${url}`));
  blank();
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body });
  } catch (err) {
    fatal(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  const resText = await res.text();
  const statusColor2 = res.ok ? pc9.green : pc9.red;
  label("Status", statusColor2(`${res.status} ${res.statusText}`));
  label("Body", resText || "(empty)");
  blank();
  console.log("  " + pc9.dim("Payload (copy to replay manually):"));
  console.log(JSON.stringify(payload, null, 2).split("\n").map((l) => "  " + l).join("\n"));
  blank();
  if (!res.ok) {
    error(`Server responded with ${res.status}`);
    process.exit(1);
  }
}

// src/commands/webhooks/listen.ts
import * as http from "http";
import { PayBridge as PayBridge2 } from "@paybridge-np/sdk";

// src/lib/tunnel.ts
import { spawn } from "child_process";
async function openTunnel(port) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ngrok", ["http", port.toString(), "--log=stdout", "--log-format=json"], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill();
        reject(new Error("ngrok did not produce a tunnel URL within 10s. Is ngrok installed and authenticated?"));
      }
    }, 1e4);
    const onData = (chunk) => {
      for (const line of chunk.toString().split("\n")) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.url && typeof entry.url === "string" && entry.url.startsWith("https://")) {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve({
                url: entry.url,
                close: () => proc.kill()
              });
            }
          }
        } catch {
        }
      }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to start ngrok: ${err.message}. Is ngrok installed? (brew install ngrok)`));
      }
    });
    proc.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`ngrok exited with code ${code}. Run 'ngrok http ${port}' manually to diagnose.`));
      }
    });
  });
}

// src/commands/webhooks/listen.ts
import pc10 from "picocolors";
var requestCounts = /* @__PURE__ */ new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 6e4 });
    return false;
  }
  entry.count++;
  return entry.count > 100;
}
function formatTime() {
  return (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour12: false });
}
function printEventSummary(parsed) {
  const type = parsed.type;
  const data = parsed.data;
  console.log(`  ${pc10.bold(`[${formatTime()}]`)} ${pc10.cyan(type ?? "unknown")}`);
  if (!data) return;
  const indent = "             ";
  switch (type) {
    case "payment.succeeded": {
      if (data.id) console.log(`${indent}id:           ${data.id}`);
      if (data.amount !== void 0) console.log(`${indent}amount:       NPR ${(data.amount / 100).toFixed(2)}`);
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
      if (data.refunded_amount !== void 0) console.log(`${indent}refunded_amt: NPR ${(data.refunded_amount / 100).toFixed(2)}`);
      break;
    }
    default: {
      console.log(`${indent}type:         ${type ?? "unknown"}`);
      console.log(`${indent}data:         ${JSON.stringify(data)}`);
    }
  }
}
async function webhooksListenCommand(opts) {
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
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const sig = req.headers["x-paybridge-signature"] ?? null;
      if (opts.secret) {
        try {
          await PayBridge2.webhooks.constructEvent(body, sig, opts.secret);
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("OK");
        } catch {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Bad Request");
          error("[REJECTED] Invalid signature");
          return;
        }
      } else {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
      }
      let parsed = {};
      try {
        parsed = JSON.parse(body);
      } catch {
        console.log(`  ${pc10.bold(`[${formatTime()}]`)} ${pc10.dim("(non-JSON body)")}`);
      }
      blank();
      printEventSummary(parsed);
      blank();
      if (opts.forward) {
        try {
          const forwardHeaders = { "Content-Type": "application/json" };
          if (sig) forwardHeaders["X-PayBridge-Signature"] = sig;
          await fetch(opts.forward, {
            method: "POST",
            headers: forwardHeaders,
            body
          });
        } catch (err) {
          error(`Forward failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });
  });
  server.listen(opts.port, "localhost");
  let tunnel;
  try {
    tunnel = await openTunnel(opts.port);
  } catch (err) {
    error(`${err instanceof Error ? err.message : String(err)}`);
    server.close();
    process.exit(1);
  }
  blank();
  console.log("  " + pc10.bold("Webhook listener ready"));
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

// src/commands/webhooks/index.ts
function makeWebhooksCommand(debug) {
  const webhooks = new Command2("webhooks").description("Manage and test webhooks");
  webhooks.command("list").description("List registered webhook endpoints").action(() => webhooksListCommand({ debug: debug() }));
  webhooks.command("test <url>").description("Send a test event to a webhook endpoint").option("--secret <whsec>", "sign the payload with this secret").option("--event <type>", "event type to send", "payment.succeeded").option("--amount <paisa>", "amount in payload (paisa)", "10000").action(
    (url, opts) => webhooksTestEventCommand(url, {
      secret: opts.secret,
      event: opts.event,
      amount: parseInt(opts.amount),
      debug: debug()
    })
  );
  webhooks.command("listen").description("Start a local webhook listener with a public tunnel URL").option("--port <number>", "local port", "4242").option("--secret <whsec>", "verify incoming signatures").option("--forward <url>", "forward events to another local URL").action(
    (opts) => webhooksListenCommand({
      port: parseInt(opts.port),
      secret: opts.secret,
      forward: opts.forward,
      debug: debug()
    })
  );
  return webhooks;
}

// src/index.ts
var program = new Command3();
var debugMode = false;
program.name("paybridgenp").description("Official CLI for the PayBridgeNP payment gateway").version("0.1.0").option("--debug", "show full error details").hook("preAction", (thisCommand) => {
  debugMode = !!thisCommand.opts().debug;
});
program.command("login").description("Authenticate with your PayBridgeNP API key").option("--key <api-key>", "provide key non-interactively (for CI/scripts)").action((opts) => loginCommand({ key: opts.key }));
program.command("status").description("Show current authentication status").action(() => statusCommand({ debug: debugMode }));
program.command("test").description("Create a sandbox checkout session to test your integration").option("--amount <paisa>", "amount in paisa (default: 1000 = NPR 10)", "1000").option("--no-open", "print URL but don't open browser").action((opts) => testCommand({
  amount: parseInt(opts.amount),
  open: opts.open !== false,
  debug: debugMode
}));
program.addCommand(makePaymentsCommand(() => debugMode));
program.addCommand(makeWebhooksCommand(() => debugMode));
program.command("init").description("Scaffold a starter PayBridgeNP project").option("--name <name>", "project name (skips prompt)").option("--framework <framework>", "nextjs | node | bare (skips prompt)").action((opts) => initCommand({ name: opts.name, framework: opts.framework }));
program.command("update").description("Check for a newer version of the CLI").action(() => updateCommand());
program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
