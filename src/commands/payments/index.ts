import { Command } from "commander";
import { paymentsListCommand } from "./list.js";
import { paymentsGetCommand } from "./get.js";

export function makePaymentsCommand(debug: () => boolean): Command {
  const payments = new Command("payments").description("Manage payments");

  payments
    .command("list")
    .description("List recent payments")
    .option("--limit <n>", "number of results (max 100)", "20")
    .option("--watch", "refresh every 5 seconds")
    .action((opts) => paymentsListCommand({ limit: parseInt(opts.limit), watch: !!opts.watch, debug: debug() }));

  payments
    .command("get <id>")
    .description("Get a single payment by ID")
    .action((id, _opts) => paymentsGetCommand(id, { debug: debug() }));

  return payments;
}
