import Table from "cli-table3";
import type { WebhookEndpoint } from "@paybridge-np/sdk";
import { createClient } from "../../lib/client.js";
import { handleError } from "../../lib/errors.js";
import { header, blank, info } from "../../lib/output.js";

export async function webhooksListCommand(opts: { debug: boolean }): Promise<void> {
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

    const table = new Table({
      head: ["ID", "URL", "Events", "Created"],
      style: { head: [], border: [] },
    });

    for (const wh of data as WebhookEndpoint[]) {
      const eventCount = wh.events?.length ?? 0;
      const eventLabel = eventCount === 1 ? "1 event" : `${eventCount} events`;
      const created = wh.created_at
        ? new Date(wh.created_at).toISOString().slice(0, 10)
        : "-";
      table.push([wh.id, wh.url, eventLabel, created]);
    }

    console.log(table.toString());
    blank();
  } catch (err) {
    handleError(err, opts.debug);
  }
}
