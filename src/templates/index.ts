// Bundled starter templates — inlined as strings to avoid runtime path issues.

export type Framework = "nextjs" | "node" | "bare";

export interface TemplateFile {
  path: string;
  content: string;
}

const NEXTJS_CHECKOUT = `import PayBridge from "@paybridge-np/sdk";
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

const NEXTJS_WEBHOOK = `import PayBridge from "@paybridge-np/sdk";

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

const NEXTJS_ENV_EXAMPLE = `PAYBRIDGE_API_KEY=sk_test_your_api_key_here
PAYBRIDGE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;

const NODE_INDEX = `import PayBridge from "@paybridge-np/sdk";
import http from "http";
import crypto from "crypto";

const pb = new PayBridge({ api_key: process.env.PAYBRIDGE_API_KEY! });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  // POST /checkout — create a checkout session
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

  // POST /webhook — receive payment events
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

const NODE_ENV_EXAMPLE = `PAYBRIDGE_API_KEY=sk_test_your_api_key_here
PAYBRIDGE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
`;

const BARE_INDEX = `import PayBridge from "@paybridge-np/sdk";

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

const BARE_ENV_EXAMPLE = `PAYBRIDGE_API_KEY=sk_test_your_api_key_here
`;

export function getTemplateFiles(framework: Framework, apiKey: string | null): TemplateFile[] {
  const keyPlaceholder = apiKey ?? "sk_test_your_api_key_here";

  if (framework === "nextjs") {
    return [
      { path: "app/api/checkout/route.ts", content: NEXTJS_CHECKOUT },
      { path: "app/api/webhook/route.ts", content: NEXTJS_WEBHOOK },
      { path: ".env", content: NEXTJS_ENV_EXAMPLE.replace("sk_test_your_api_key_here", keyPlaceholder) },
      { path: ".env.example", content: NEXTJS_ENV_EXAMPLE },
    ];
  }

  if (framework === "node") {
    return [
      { path: "index.ts", content: NODE_INDEX },
      { path: ".env", content: NODE_ENV_EXAMPLE.replace("sk_test_your_api_key_here", keyPlaceholder) },
      { path: ".env.example", content: NODE_ENV_EXAMPLE },
    ];
  }

  // bare
  return [
    { path: "index.ts", content: BARE_INDEX },
    { path: ".env", content: BARE_ENV_EXAMPLE.replace("sk_test_your_api_key_here", keyPlaceholder) },
    { path: ".env.example", content: BARE_ENV_EXAMPLE },
  ];
}
