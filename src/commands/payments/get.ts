import pc from "picocolors";
import { createClient } from "../../lib/client.js";
import { fatal, blank, label, formatAmount, formatDate } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";

export async function paymentsGetCommand(id: string, opts: { debug: boolean }): Promise<void> {
  const client = createClient();
  let payment: any;
  try {
    payment = await client.payments.retrieve(id);
  } catch (err: any) {
    if (err?.statusCode === 404) fatal(`Payment not found: ${id}`);
    handleError(err, opts.debug);
  }

  blank();
  console.log("  " + pc.bold(`Payment ${payment.id}`));
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
