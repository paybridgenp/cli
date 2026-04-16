import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { statusCommand } from "./commands/status.js";
import { testCommand } from "./commands/test.js";
import { initCommand } from "./commands/init.js";
import { updateCommand } from "./commands/update.js";
import { makePaymentsCommand } from "./commands/payments/index.js";
import { makeWebhooksCommand } from "./commands/webhooks/index.js";

const program = new Command();

let debugMode = false;

program
  .name("paybridgenp")
  .description("Official CLI for the PayBridgeNP payment gateway")
  .version("0.1.0")
  .option("--debug", "show full error details")
  .hook("preAction", (thisCommand) => {
    debugMode = !!thisCommand.opts().debug;
  });

program
  .command("login")
  .description("Authenticate with your PayBridgeNP API key")
  .option("--key <api-key>", "provide key non-interactively (for CI/scripts)")
  .action((opts) => loginCommand({ key: opts.key }));

program
  .command("status")
  .description("Show current authentication status")
  .action(() => statusCommand({ debug: debugMode }));

program
  .command("test")
  .description("Create a sandbox checkout session to test your integration")
  .option("--amount <paisa>", "amount in paisa (default: 1000 = NPR 10)", "1000")
  .option("--no-open", "print URL but don't open browser")
  .action((opts) => testCommand({
    amount: parseInt(opts.amount),
    open: opts.open !== false,
    debug: debugMode,
  }));

program.addCommand(makePaymentsCommand(() => debugMode));
program.addCommand(makeWebhooksCommand(() => debugMode));

program
  .command("init")
  .description("Scaffold a starter PayBridgeNP project")
  .option("--name <name>", "project name (skips prompt)")
  .option("--framework <framework>", "nextjs | node | bare (skips prompt)")
  .action((opts) => initCommand({ name: opts.name, framework: opts.framework }));

program
  .command("update")
  .description("Check for a newer version of the CLI")
  .action(() => updateCommand());

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
