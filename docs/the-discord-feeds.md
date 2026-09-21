# The Discord feeds

Three channels, fed by a cron that fires every minute: cards minted, $CROCARD
bought, $CROCARD burned. The code is `lib/feed.ts`; `app/api/cron/feed/route.ts`
is the door and `worker/index.js` maps the schedule to it.

**This page is how to check on them and what to do when one goes quiet.** The
argument for why they are shaped this way is in DESIGN.md.

---

## The three

| feed | what it watches | where |
|---|---|---|
| `mints` | `Bought` and `Claimed` | the collection in `lib/revenue.ts` |
| `buys` | `Swap`, keeping only the ones where $CROCARD leaves | the $CROCARD/WCRO pool |
| `burns` | `Transfer` with the dead address as the recipient | the $CROCARD token |

Each has its own webhook, its own cursor, and its own failure. One channel that
cannot be posted to does not stop the other two.

## The secrets

`DISCORD_MINTS`, `DISCORD_BUYS`, `DISCORD_BURNS`, set with `wrangler secret put`
and nowhere else. **A webhook URL is a password with no username**: anybody who
has one can post into that channel, as that webhook, until somebody deletes it.
A feed whose secret is not set does not run and says so in the job's answer,
rather than failing the whole tick.

To point a feed at a different channel, make a new webhook in Discord and
`wrangler secret put` it over the old one. Nothing else changes.

To check a webhook is alive without putting a message in somebody's channel, a
`GET` on the URL answers with its name and channel id. That is what
`whereItPoints` in `lib/discord.ts` is for.

## How to see what it is doing

There is no page for it. The state is two tables in D1:

```
npx wrangler d1 execute cards-of-cronos --remote \
  --command "SELECT name, block, at FROM cursors WHERE name LIKE 'feed:%'"
```

Three rows, one per feed, each holding the last block that feed has read. **No
row means that feed has never completed a run.** A row whose `at` is minutes old
and whose `block` is not moving means it is reading the chain and finding
nothing, which is the ordinary state for a quiet token.

```
npx wrangler d1 execute cards-of-cronos --remote \
  --command "SELECT count(*) FROM feed_posted"
```

How many individual logs have been announced, ever.

`wrangler tail` is worth trying and is not worth trusting: it has sat connected
through requests that demonstrably reached the Worker and reported nothing.

## When a channel goes quiet

Quiet is the normal state. $CROCARD went a week without a single trade while
this was being written, and nothing has been burned by this project at all — the
89 million at the dead address is from the first version. **An empty channel is
not evidence of a broken feed**, which is exactly why the cursor is the thing to
look at.

In order of what to rule out:

1. **The cursor is not moving.** The job is not running. Check the schedule is
   still in `wrangler.jsonc` and still in the table in `worker/index.js` —
   `test/cron.test.ts` checks those agree, so a failing test says which.
2. **The cursor moves and nothing is posted.** There is nothing to post. Confirm
   against the chain rather than against the channel: the explorer page for the
   pool, the collection, or the dead address.
3. **The cursor stops at one block and stays there.** A post is failing. The
   cursor is deliberately not moved past a batch that could not be announced, so
   the feed retries the same range every minute rather than skipping it. The
   likeliest cause is a deleted webhook; the job's answer says which feed and
   what Discord said.

## What it will not do

**It will not tell you about anything that happened before it was switched on.**
A feed with no cursor starts one block back. Turning one on is not a way to
import history, and a channel that filled with four years of it at the moment of
being created would be worth nothing.

**It will not post a line per mint when a sale opens.** Past a handful in one
minute they collapse into a single message with the total. The individual
transactions are on the explorer; the channel's job is to say something is
happening.

**It will not report a sell in the buys channel.** A Uniswap V2 `Swap` log
carries four amounts in one blob and nothing in it says which is which. This
pool puts WCRO first and $CROCARD second — read off the pair rather than
assumed, because a pair sorts its tokens by address and the other order was just
as likely. `test/feed.test.ts` holds a buy and a sell and checks only one of them
is reported.
