import { fatal, error as printError } from "./output.js";

export function handleError(err: unknown, debug: boolean): never {
  if (debug) {
    console.error(err);
  }

  if (err instanceof Error) {
    const name = err.constructor.name;
    const statusCode = (err as any).statusCode as number | undefined;

    if (name === "PayBridgeAuthenticationError" || statusCode === 401 || statusCode === 403) {
      fatal("Invalid or revoked API key. Run: paybridgenp login");
    }
    if (name === "PayBridgeNotFoundError" || statusCode === 404) {
      fatal(`Not found: ${(err as any).id ?? err.message}`);
    }
    if (name === "PayBridgeInvalidRequestError" || statusCode === 400) {
      fatal(`Bad request: ${err.message}`);
    }
    if (name === "PayBridgeRateLimitError" || statusCode === 429) {
      fatal("Rate limit hit. Wait a moment and try again.");
    }
    if (name === "PayBridgeError" && (err as any).code === "connection_error") {
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
