# The Discord feeds

Three channels: cards minted, $CROCARD bought, $CROCARD burned. The code is
`lib/feed.ts`; `app/api/cron/feed/route.ts` is the door and `worker/index.js`
reaches it two ways.

**Two drivers, not one.** A cron every minute, and ordinary page traffic — every
document request asks for a run after the page has been answered, and a run that
happened in the last forty-five seconds is declined. That is not caution for its
own sake. On the day this was built the cron stopped firing entirely: the daily
job had run twenty hours earlier, and then a per-minute schedule, four fixed
minutes, and a catch-all in the scheduled handler produced nothing at all, while
the job itself worked perfectly the moment the event was delivered by hand. A
channel people watch should not be one scheduler away from silence.

Traffic is a better driver than it sounds for the thing that matters most here.
A mint happens because somebody is on the mint page, so the busiest the site ever
is, is exactly when there is something to report.

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

1. **The cursor is not moving.** The job is not running at all, which now takes
   both drivers being down. Load a page on the site and look again: if the
   cursor moves, the cron is the half that is broken and the feed is still
   working. `test/cron.test.ts` checks the schedule in `wrangler.jsonc` and the
   table in `worker/index.js` agree, so a failing test says which.
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

## When the cron stops

It did, on 21 September 2026, and this is what ruling it out looked like — worth
writing down because every step of it looked like the step before.

The job was fine: firing the scheduled event by hand against the real bindings
(`wrangler dev --remote --test-scheduled`, then `GET /__scheduled?cron=...`) ran
all three feeds and wrote all three cursors. So the route, the secret, the D1
writes and the formatting were never in question.

What was ruled out, in order, and how:

- **A wrong path or a missing secret.** `POST /api/cron/feed` with no header
  answers 401, not 404 and not 503. So the route is deployed and `CRON_SECRET`
  is set.
- **The schedule not being registered.** `wrangler deploy` and
  `wrangler triggers deploy` both list all three schedules back.
- **The expression.** A cron on four fixed minutes a few minutes out fired none
  of them either, so it is not per-minute schedules specifically.
- **The lookup in `worker/index.js`.** An expression Cloudflare reports
  differently from how it is written would match no route and do nothing, which
  looks identical to a cron that never fired. A temporary catch-all that routed
  *any* expression to the feed changed nothing, so the handler was never reached.
- **`wrangler tail` seeing it.** The tail reported nothing at all for a while,
  including requests that demonstrably reached the Worker. After turning on
  `observability` in `wrangler.jsonc` it started showing traffic — and still no
  scheduled invocation. Note the trap: grepping a tail for "cron" matches
  **cards-of-cron**os, so every line looks like a hit.

The conclusion was that Cloudflare was not invoking the scheduled handler, with
no way from here to make it. The cron is still declared and still routed, so if
it comes back it simply works again; the traffic driver is what makes that not
matter.
