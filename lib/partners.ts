// A project asking for a set of its own: the terms in CRO, and the form.
//
// The terms are data/partner-sets.ts times lib/revenue.ts, worked out here so
// the page and anything else that quotes a partner price get the same answer.
// The form is read here rather than in the route because it is a rule about
// what an application is, and a route should only decide who may send one.
//
// ── NOT SIGNED IN, ON PURPOSE ────────────────────────────────────────────────
//
// Every other form on this site wants a wallet proof, because what it writes is
// attached to a wallet. This one is somebody introducing a project, and the
// person filling it in is often a founder or a community manager whose wallet
// is not the point and may not even be on Cronos yet. What stops a flood is a
// cap per sender (see `APPLICATIONS_PER_DAY`), a field only a bot fills in, and
// the length limits below — not a signature that proves nothing about whether
// the project is real. That is decided by talking to them.

import { normalise } from "@/lib/address";
import { MINT_PRICE_CRO, STREAMS } from "@/lib/revenue";
import { PRICE_MULTIPLE, TO_PARTNER_PERCENT } from "@/data/partner-sets";

/** What one partner card costs at the list price, in CRO. */
export const PARTNER_PRICE_CRO = MINT_PRICE_CRO * PRICE_MULTIPLE;

/** What one partner card costs with this many percent off, in CRO. */
export function partnerPrice(off: number): number {
  return (PARTNER_PRICE_CRO * (100 - off)) / 100;
}

/** Of a card sold at this price, the part that goes to the project. */
export function toPartner(price: number): number {
  return (price * TO_PARTNER_PERCENT) / 100;
}

/**
 * Where the game's half goes: the split every CRO this game earns is divided
 * by, read off the mint stream rather than written out a second time.
 */
export const GAME_SHARES = STREAMS.find((stream) => stream.id === "mints")!.shares;

/** How many applications one sender may make in a day. */
export const APPLICATIONS_PER_DAY = 3;

/** The longest each field may be. Generous for a person, short for a dump. */
export const LIMITS = {
  project: 80,
  website: 200,
  token: 42,
  x: 100,
  telegram: 100,
  contact: 120,
  about: 2000,
} as const;

export type Field = keyof typeof LIMITS;

export interface Application {
  project: string;
  website: string;
  /** The project's token on Cronos, lowercase. Null when it has none (yet). */
  token: string | null;
  x: string | null;
  telegram: string | null;
  /** How to reach the person who sent it: a Telegram handle, an email, an X name. */
  contact: string;
  about: string;
}

export type Read =
  | { ok: true; application: Application }
  | { ok: false; field: Field | null; error: string };

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * An application out of a request body, or the first thing wrong with it.
 *
 * Names the field, so the form can put the message beside the box it is about
 * rather than at the bottom of a page somebody has to scroll back up.
 */
export function readApplication(body: unknown): Read {
  const raw = (body ?? {}) as Record<string, unknown>;

  for (const field of Object.keys(LIMITS) as Field[]) {
    if (text(raw[field]).length > LIMITS[field]) {
      return { ok: false, field, error: `Keep this under ${LIMITS[field]} characters.` };
    }
  }

  const project = text(raw.project);
  if (project === "") return { ok: false, field: "project", error: "What is the project called?" };

  // A link and not just a name: it is the first thing anybody checks, and
  // "https://" missing is the usual reason one does not open.
  let website = text(raw.website);
  if (website === "") return { ok: false, field: "website", error: "Where can we find it?" };
  if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
  try {
    const url = new URL(website);
    if (!url.hostname.includes(".")) throw new Error("no domain");
  } catch {
    return { ok: false, field: "website", error: "That does not look like a web address." };
  }

  // Checked, because it decides who gets a discount. A mistyped address is a
  // discount for holders of nothing, and normalise catches a bad checksum too.
  const typed = text(raw.token);
  let token: string | null = null;
  if (typed !== "") {
    try {
      token = normalise(typed);
    } catch {
      return { ok: false, field: "token", error: "That is not a Cronos token address." };
    }
  }

  const contact = text(raw.contact);
  if (contact === "") {
    return { ok: false, field: "contact", error: "How do we reach you? A Telegram handle is easiest." };
  }

  const about = text(raw.about);
  if (about.length < 20) {
    return { ok: false, field: "about", error: "Tell us a little more about the project." };
  }

  return {
    ok: true,
    application: {
      project,
      website,
      token,
      x: text(raw.x) || null,
      telegram: text(raw.telegram) || null,
      contact,
      about,
    },
  };
}

/**
 * The field a person never sees and a form-filling bot always fills in.
 *
 * Named like a real one, because a bot skips the fields it can tell are traps.
 * The route answers a filled one exactly as it answers a real application, so
 * there is nothing to learn from trying.
 */
export const TRAP = "company";
