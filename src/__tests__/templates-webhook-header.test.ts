// Guard: scaffolded webhook handlers must read the header PayBridgeNP actually
// sends — `X-PayBridgeNP-Signature` (lowercased `x-paybridgenp-signature` for
// header lookups). A stale `x-paybridge-signature` (missing the `np`) silently
// returns no signature, so constructEvent throws and every real webhook is
// rejected. Regression guard for that fix.
import { describe, it, expect } from "bun:test";
import { getTemplateFiles } from "../templates";

const WRONG = "x-paybridge-signature";
const RIGHT = "x-paybridgenp-signature";

describe("scaffold webhook templates use the correct signature header", () => {
  for (const framework of ["nextjs", "node"] as const) {
    it(`${framework} webhook handler reads ${RIGHT}, never ${WRONG}`, () => {
      const files = getTemplateFiles(framework, null);
      const webhook = files.find((f) => /webhook|index/.test(f.path) && f.content.includes("constructEvent"));
      expect(webhook).toBeTruthy();
      expect(webhook!.content).toContain(RIGHT);
      // The wrong header is a substring of the right one, so assert the wrong
      // token never appears immediately followed by a closing quote.
      expect(webhook!.content).not.toContain(`"${WRONG}"`);
    });
  }
});
