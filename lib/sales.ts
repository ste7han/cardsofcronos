// Cards sold on EbisusBay, announced in Discord.
//
// The fourth feed, and the only one that does not read the chain. Mints, buys
// and burns are events a contract emits; a sale on a marketplace is a sale in
// that marketplace's own contract, and finding it on chain means knowing which
// contract and decoding its event. Their API answers the same question directly
// and carries what the log does not — the card's name, and what it sold for in
// CRO rather than in whatever currency the listing was denominated in.
//
// ── WHAT THAT COSTS, SAID OUT LOUD ───────────────────────────────────────────
//
// A feed built on somebody else's API is a feed that stops when they change it.
// The three chain feeds cannot: a topic hash is a topic hash for ever. So this
// one is written to fail loudly and stay out of the way — if the shape it
// expects is not there, it reports and posts nothing, and the other three feeds
// are untouched because they run separately.
//
// ── ONCE, AND ONLY ONCE ──────────────────────────────────────────────────────
//
// Same discipline as the chain feeds. Every sale is remembered by its listing id
// before the cursor moves, and the cursor only moves after Discord has accepted
// the post. A crash between the two costs a repeated line somebody sees rather
// than a missing one nobody does — which is the right way round for a feed,
// where the only evidence of a missed sale is that nobody noticed.

import { post, type Embed } from "@/lib/discord";
import { alreadyPosted, remember } from "@/lib/feed";
import { CONTRACTS } from "@/lib/revenue";
import { EXPLORER } from "@/lib/units";
import { cursorOf, setCursor, type Database } from "@/lib/store";

/** Sold. Their `state` is 0 for open, 1 for sold, 2 for cancelled. */
const SOLD = 1;
const API = "https://api.ebisusbay.com/listings";
/** How many to ask for. More than a quiet hour needs, fewer than a busy one. */
const AT_A_TIME = 25;

const GOLD = 0xffd700;
const GREEN = 0x3fb950;

interface Listing {
  listingId?: string;
  nftId?: string;
  price?: string;
  currency?: string;
  saleTime?: string;
  seller?: string;
  purchaser?: string;
  transactionHash?: string;
  state?: number;
  nft?: { name?: string; image?: string };
}

export interface RanSales {
  feed: "sales";
  found: number;
  posted: number;
  /** The newest saleTime this run has accounted for, as unix seconds. */
  through: number | null;
  skipped?: string;
  wrong?: string;
}

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/** A price as CRO, trimmed. Their `price` is already a decimal string. */
function cro(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * One sale, as a message.
 *
 * The card's name is the headline, because that is what somebody in the channel
 * cares about — "Pampa sold" says more than "#412 sold" to anybody who has
 * played. The token number is still there, in the footer, for whoever wants to
 * look it up.
 */
function say(one: Listing, nft: string): Embed {
  const name = one.nft?.name ?? `Cards of Cronos #${one.nftId}`;
  const price = one.price ? `${cro(one.price)} CRO` : "an undisclosed amount";
  const when = one.saleTime ? new Date(Number(one.saleTime) * 1000).toISOString() : undefined;

  const lines: string[] = [];
  if (one.seller) lines.push(`**Sold by** [${short(one.seller)}](${EXPLORER}/address/${one.seller})`);
  if (one.purchaser) lines.push(`**Bought by** [${short(one.purchaser)}](${EXPLORER}/address/${one.purchaser})`);

  return {
    author: {
      name: "Cards of Cronos · EbisusBay",
      url: `https://app.ebisusbay.com/collection/cronos/cards-of-cronos-set-01`,
    },
    title: `🂡  ${name} sold for ${price}`,
    url: one.transactionHash ? `${EXPLORER}/tx/${one.transactionHash}` : undefined,
    description: lines.join("\n") || undefined,
    color: Number(one.price) >= 100 ? GOLD : GREEN,
    fields: one.nftId
      ? [{ name: "Token", value: `[#${one.nftId}](https://app.ebisusbay.com/collection/cronos/${nft}/${one.nftId})`, inline: true }]
      : undefined,
    footer: { text: "EbisusBay" },
    timestamp: when,
  };
}

/**
 * Reads the sales since the last one that was announced, and announces them.
 *
 * Keyed on saleTime rather than on a page number: a listing that sells while
 * this is paging would shift every page under it, and the sale that slid across
 * the boundary is the one nobody would ever see.
 */
export async function runSales(
  db: Database,
  webhook: string | undefined,
  now: number,
): Promise<RanSales> {
  const nothing: RanSales = { feed: "sales", found: 0, posted: 0, through: null };
  if (!webhook) return { ...nothing, skipped: "no webhook set" };

  const nft = CONTRACTS.nft;
  if (nft === null) return { ...nothing, skipped: "nothing deployed to watch" };

  // Seconds, not a block. cursorOf holds an integer and this is the one feed
  // whose clock is not the chain's.
  const seen = await cursorOf(db, "feed:sales");

  let listings: Listing[];
  try {
    const url =
      `${API}?collection=${nft}&state=${SOLD}&pageSize=${AT_A_TIME}` +
      `&sortBy=saleTime&direction=desc`;
    const answer = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!answer.ok) return { ...nothing, wrong: `EbisusBay answered ${answer.status}` };
    const body = (await answer.json()) as { listings?: Listing[] };
    if (!Array.isArray(body.listings)) {
      // The shape changed. Loudly, and without moving the cursor.
      return { ...nothing, wrong: "EbisusBay returned no listings array — has their API changed?" };
    }
    listings = body.listings;
  } catch (error) {
    return { ...nothing, wrong: error instanceof Error ? error.message : "EbisusBay could not be reached" };
  }

  const sold = listings
    .filter((one) => one.state === SOLD && one.saleTime !== undefined)
    .sort((a, b) => Number(a.saleTime) - Number(b.saleTime));
  const newest = sold.length === 0 ? seen : Number(sold[sold.length - 1]!.saleTime);

  // Never run: note where the present is and say nothing. The archive is not
  // news, and announcing a year of back catalogue the first time this deploys is
  // the kind of thing that gets a webhook deleted.
  //
  // WITH NO SALES AT ALL, that has to be the clock and not the newest sale —
  // there isn't one. Writing nothing would leave this on its first run for ever,
  // and the first sale that ever happened would be swallowed as "where we are"
  // instead of announced. Which is the one sale most worth announcing.
  if (seen === null) {
    const here = sold.length === 0 ? Math.floor(now / 1000) : newest!;
    await setCursor(db, "feed:sales", here, now);
    return { ...nothing, found: sold.length, through: here, skipped: "first run — noting where we are" };
  }

  // Newer than the cursor AND not already announced.
  //
  // Both, because saleTime is in whole seconds: two sales in the same second,
  // one posted and one not, would move the cursor past the pair and lose the
  // second one for good. The ledger is what actually decides; the cursor is
  // what keeps this from reading the same twenty-five rows out of the ledger
  // every minute for ever.
  const ids = new Map(sold.map((one) => [one, `sales:${one.listingId ?? `${one.nftId}@${one.saleTime}`}`]));
  const old = await alreadyPosted(db, [...ids.values()]);
  const fresh = sold.filter(
    (one) => Number(one.saleTime) >= seen && !old.has(ids.get(one)!),
  );
  if (fresh.length === 0) {
    if (newest !== null && newest > seen) await setCursor(db, "feed:sales", newest, now);
    return { ...nothing, found: sold.length, through: newest ?? seen };
  }

  const sent = await post(webhook, fresh.map((one) => say(one, nft)));
  if (!sent.ok) {
    // Ledger and cursor both untouched, so the next run tries these again.
    return { ...nothing, found: fresh.length, through: seen, wrong: sent.wrong ?? "the post failed" };
  }

  await remember(db, fresh.map((one) => ids.get(one)!), now);
  await setCursor(db, "feed:sales", newest!, now);
  return { feed: "sales", found: fresh.length, posted: fresh.length, through: newest };
}
