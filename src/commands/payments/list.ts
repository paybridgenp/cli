import Table from "cli-table3";
import pc from "picocolors";
import { createClient } from "../../lib/client.js";
import { fatal, blank, formatAmount, timeAgo } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";

function statusColor(status: string): string {
  if (status === "succeeded" || status === "success") return pc.green(status);
  if (status === "failed") return pc.red(status);
  if (status === "pending" || status === "processing") return pc.yellow(status);
  return pc.dim(status);
}

async function fetchAndPrint(limit: number, debug: boolean): Promise<void> {
  const client = createClient();
  let result: any;
  try {
    result = await client.payments.list({ limit: Math.min(limit, 100) });
  } catch (err) {
    handleError(err, debug);
  }

  const payments = result.data ?? [];

  if (payments.length === 0) {
    blank();
    console.log(pc.dim("  No payments found."));
    blank();
    return;
  }

  const table = new Table({
    head: ["ID", "Amount", "Provider", "Status", "Created"].map(h => pc.bold(h)),
    style: { head: [], border: [], compact: true },
    chars: { mid: "", "left-mid": "", "mid-mid": "", "right-mid": "" },
  });

  for (const p of payments) {
    table.push([
      pc.dim(p.id),
      formatAmount(p.amount),
      p.provider ?? "-",
      statusColor(p.status),
      timeAgo(p.createdAt ?? p.created_at ?? p.created),
    ]);
  }

  process.stdout.write("\x1Bc"); // clear terminal
  blank();
  console.log(table.toString());
  blank();
}

export async function paymentsListCommand(opts: { limit: number; watch: boolean; debug: boolean }): Promise<void> {
  await fetchAndPrint(opts.limit, opts.debug);
  if (opts.watch) {
    console.log(pc.dim("  Refreshing every 5s... (Ctrl+C to stop)"));
    setInterval(() => fetchAndPrint(opts.limit, opts.debug), 5000);
    // Keep process alive
    process.stdin.resume();
  }
}
