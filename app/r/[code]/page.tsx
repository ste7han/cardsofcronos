import { redirect } from "next/navigation";

/**
 * The query parameter, spelled out rather than imported.
 *
 * lib/ref.ts is a "use client" module, and this is a server component. Reading a
 * plain constant across that boundary is the kind of thing that looks harmless
 * and returns a 500 at request time — which is exactly what it did, on the valid
 * codes only, because the invalid ones redirect somewhere with no parameter in
 * it and never touch this.
 */
const PENDING_REF = "ref";

/**
 * A referral link with no punctuation in it.
 *
 * the site/r/ABCD1234 rather than the site/profile?ref=ABCD1234.
 * The second one is correct and fragile: chat clients and in-app browsers
 * linkify a bare URL by guessing where it ends, and a `?` is one of the places
 * they guess wrong — the link arrives cut short, or as a search term, and what
 * the person sees is "failed to load". A path has none of those characters, and
 * it survives being read out loud and typed by hand.
 *
 * It redirects to the page that already knows what to do with a code, so there
 * is one implementation of claiming rather than two. Links already shared with
 * ?ref= keep working, because that is still what this hands over.
 *
 * A server redirect and not a script, so it does not need JavaScript to have run
 * — which is the one thing you cannot count on in somebody else's browser.
 */
export const dynamic = "force-dynamic";

export default async function ReferralLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Anything that is not a code goes to the profile without one rather than
  // being passed along. A code is eight characters from a fixed alphabet; a
  // string that is not is somebody's typo or somebody's probe.
  const clean = code.trim().toUpperCase();
  const usable = /^[2-9A-HJ-NP-Z]{8}$/.test(clean);

  redirect(usable ? `/profile?${PENDING_REF}=${clean}` : "/profile");
}
