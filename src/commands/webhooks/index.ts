import { Command } from "commander";
import { webhooksListCommand } from "./list.js";
import { webhooksTestEventCommand } from "./test-event.js";
import { webhooksListenCommand } from "./listen.js";

export function makeWebhooksCommand(debug: () => boolean): Command {
  const webhooks = new Command("webhooks").description("Manage and test webhooks");

  webhooks
    .command("list")
    .description("List registered webhook endpoints")
    .action(() => webhooksListCommand({ debug: debug() }));

  webhooks
    .command("test <url>")
    .description("Send a test event to a webhook endpoint")
    .option("--secret <whsec>", "sign the payload with this secret")
    .option("--event <type>", "event type to send", "payment.succeeded")
    .option("--amount <paisa>", "amount in payload (paisa)", "10000")
    .action((url, opts) =>
      webhooksTestEventCommand(url, {
        secret: opts.secret,
        event: opts.event,
        amount: parseInt(opts.amount),
        debug: debug(),
      })
    );

  webhooks
    .command("listen")
    .description("Start a local webhook listener with a public tunnel URL")
    .option("--port <number>", "local port", "4242")
    .option("--secret <whsec>", "verify incoming signatures")
    .option("--forward <url>", "forward events to another local URL")
    .action((opts) =>
      webhooksListenCommand({
        port: parseInt(opts.port),
        secret: opts.secret,
        forward: opts.forward,
        debug: debug(),
      })
    );

  return webhooks;
}
