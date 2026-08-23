import { CARDS } from "@/data/cards";
import { setFingerprint } from "@/engine/fingerprint";

/**
 * What card set this server is actually serving.
 *
 * Exists for scripts/render-cards.ts. See engine/fingerprint.ts for why a render
 * against a stale server is worth refusing rather than discovering later.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ fingerprint: setFingerprint(CARDS), cards: CARDS.length });
}
