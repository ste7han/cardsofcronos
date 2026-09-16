# Cards of Cronos — design

What the game is, what was decided, and what is still open.

**Where this disagrees with the code, the code is right.** That is not modesty:
the document this one replaced opened by saying a turn is three actions with no
per-card cost, which the engine has not done for a long time, and anybody
reading it would have designed against a game that no longer existed. Every
number below is quoted from `engine/types.ts`, `engine/deck.ts`, `engine/pack.ts`
or `data/cards.ts`, and every measurement names the script that produced it.

---

## The match

**Goal.** Highest market cap at the end. MC is the only score.

**10 turns**, alternating, two seats. A fixed length means you always know how
many turns you have left to catch up, which matters more once anything is
staked.

**5 cards in hand**, topped up at the start of your turn. There is no hand cap
beyond that — a card that draws can push you past five.

**6 positions.** A portfolio holds six projects. Reaching six does not block
you: playing a seventh closes one of the six first, and you keep what that
position had already earned.

### The marketing budget

Turn N gives you **N × $40K** to spend. Turn one is $40K, turn ten is $400K. It
does not carry over.

Playing a card costs by rarity:

| | |
|---|---|
| common | $20K |
| rare | $40K |
| epic | $80K |
| legendary | $200K |
| mythic | $280K |

Taking profit and throwing a card away each cost a flat **$50K**.

**Whatever is left at the end of your turn comes off your market cap, all of
it.** That rule is the single strongest lever in the design and everything else
leans on it. Without it, holding the budget back is free and the ramp does
nothing. With it, every turn you have to find something worth doing with the
money, and a hand that cannot absorb what you were given costs you.

It is also what makes the ramp reach deck-building. An expensive card is not
merely late, it is *unplayable* early — a mythic costs $280K and turn one hands
you $40K — so a deck of top-heavy cards is a deck that burns market cap for six
turns before it does anything.

### Positions, pumps and damage

A **project** pays its launch MC once when played, then pumps every turn in the
pump phase.

What a position pays is scaled by the holders it has left, in proportion to what
the card prints. A five-holder project down to four pays four fifths. So damage
that does not kill still costs the other player something every turn afterwards
— before this, damage that did not kill did nothing at all.

The floor is zero. A pump can be reduced to nothing and no further, because a
project that drained market cap every turn would be a rug paid in instalments
and no text on the card would say so.

### Realised and unrealised

Every position tracks what it has earned — the launch plus every pump it has
paid. **Take profit** closes it and you keep that. **A rug** takes back
`min(mc, earned)`.

So market cap means "what you are holding", not "everything you ever made", and
an attack moves the scoreboard now rather than in the abstract. Banking is how
you put something out of reach.

### Upgrading

A project is several cards, and only one card of a project may hold a position.
Playing a *dearer* card of a project you already hold takes over that position
rather than opening a second one: it inherits what the old one was pumping, adds
the new launch MC to what it has earned, and costs one action instead of two.

Sideways and downward are refused. Downward would let you play the mythic,
"upgrade" to the common and keep the pump for a fifth of the budget.

### Restrictions

A project can put a standing rule on the **opponent** while its position is
undamaged: they cannot play a card of some type, or cannot take profit.

It holds only while the position is untouched. One point of damage lifts it and
healing back to full restores it — so any attack at all is an answer, including
one that leaves the project standing. A lock that protects itself is a lock with
no key.

Projects only. A tool sits in support and has no holders, so a tool carrying one
could never be opened.

### Payoffs

A card may carry a second effect that fires when the table agrees:

```
behindBy · ownProjectsInSector · ownProjectCount · turnAtLeast
```

**Never a gate.** The card always does its base effect and does something more
when the condition holds. A card whose only effect is conditional is a card that
is dead in most hands, and dead cards are what this set is built to avoid.

`behindBy` is the shape that made the idea worth having: a percentage of your own
market cap is worth least exactly when you are losing, so pairing it with a flat
amount for being behind is self-correcting. The two halves are large at opposite
moments and never both at once.

### Who moves first

The second player has a structural advantage: they pick their targets against a
board one turn newer.

The first player is compensated with **nothing**, and that is a decision rather
than an oversight.

A seed round of $400K used to sit here. It came over from TCG with the rest of
the engine and was one of eight shapes measured there; TCG has since switched off
every one of them, because rebuilding seventeen project families in two days made
building early worth more and lifted its first seat to 47.1% unaided. This game
runs the same rules rather than keeping a rule the game it is built on retired.

What that costs, measured on this set with `npx tsx scripts/turn-order.ts 2000`,
two ranges of two thousand matches on drawn decks:

| shape | first seat wins | what the other player sees |
|---|---|---|
| **nothing** | **42.9%** | **nothing, and it pays nothing** |
| one free card | 48.0% / 46.3% | one card, once |
| seed round of $400K | 52.1% / 51.6% | $400K on the scoreboard, from nowhere |

A fair game sits in 46.9–53.1%, so the first seat is **7.1 points light**. Both
compensations close that and neither is on. The bet is that the cards close it
here the way they closed it there — this set is 246 cards and has not been
through the rebuild TCG's 725 went through.

This is the first number to look at if the game ever feels lopsided, and the
cheapest thing in the engine to change: one line in `RULES`, and the table above
says what each line buys. Of the two, the free card is the one to reach for — a
seed is market cap before anybody has played a card, so it opens every `aheadBy`
gate at or below it on turn one for free, and those conditions now exist in the
set's vocabulary.

Re-measure with `turn-order.ts` whenever the set changes shape.

---

## The cards

**445 cards**: 344 projects, 40 people, 34 tactics, 20 events, 7 tools.
Rarity spread 111 / 120 / 108 / 61 / 45, guarded by a test.

### Five types, and why they are five

- **project** — holds a position and pumps. The only type that scores.
- **tool** — sits in support. Effect required, aura optional. A chart site has no
  token and you cannot hold a position in a wallet.
- **tactic** — one-off, may be aimed.
- **event** — one-off that must hit the *whole table*. Validation enforces it, so
  the type means something rather than being flavour on a tactic.
- **influencer** — sits in support, aura required, effect optional.

An **aura** is deliberately not an effect. An effect happens once when the card
is played; an aura works every pump phase. Folding them together would need a
branch in `applyEffect` that does nothing — and that silent branch is what left
110 cards dead in the first version of this game.

The same argument applies to restrictions.

### A project is eight cards

Forty-three families, eight cards each: **two commons, two rares, two epics, a
legendary and a mythic.**

They are numbered `I` to `VIII` and the tier does the talking. The field used to
hold a moment from the project's history — "The Pink Hat", "Korea Woke Up" — and
that works when somebody knows the history well enough to write eight true things
about every project. Inventing them instead puts words in a real project's
mouth.

The numbering is not decoration. A family has two commons, so the rarity alone
cannot name a card, and `engine/validation.ts` refuses two cards with one name on
the grounds that a log line could then mean either. The field is called `edition`
rather than `moment` because a field called `moment` holding "III" is one name
for two things, which is the trap `CLAUDE.md` opens with.

### Sectors

```
meme    the joke is the product
nft     you hold a picture, and there is a floor under it
defi    money goes in and something happens to it
infra   where all of that happens — the venues and the rails
```

Four, and it was five until `dex` was folded into `infra`. A dex is a venue: you
do not take a position in it, you pass through it, and the same is true of a
marketplace, of a toll and of the chain itself. Having the venues split across
two sectors is what made `infra` a grab bag — "marketplaces and the tools
everything else runs on" described no single thing. Together they describe one:
the other three are things you hold, and this is where you hold them. VVS says it
on its own card, which is how the merge was settled: "The front door of the
chain, whether or not it meant to be."

This note used to say five and not four, "because nineteen families over four
sectors leaves one holding seven and another holding three". That was a
nineteen-family problem. The set is heading for thirty-four and the four now hold
nine, ten, seven and eight — the evenest this list has been.

These replaced `meme / memetility / lunar / machine`, the tags the first version
of this game put on its own factions. Two of those named exactly one faction:
the first named exactly the Howlers and the second the Reckless Robots. Tags are
not sectors, and the moment a project arrived that was neither, there was nowhere
to put it.

### Effects

Eleven kinds, each carrying its own parameters. There is no shared name that two
cards with different intentions can reuse — that was the second expensive lesson
from the first version.

```
directMC · pumpProject · pumpBySector · damageHolders · healHolders
rug · cancel · stealMC · scaleMC · drawCards · extraBudget
```

Two separate target types, so the compiler cannot let a player-effect point at a
project:

```
TargetPlayer   self · opponent · both
TargetProject  ownProject · enemyProject · allOwnProjects · allEnemyProjects · allProjects
```

**A project card may not use a single-project target.** Playing a project into a
full portfolio already asks which position to close, and a card that also asks
which project to hit would be two choices wearing one click.

`cancel` exists because everything in the first version had an answer except the
row beside the portfolio. You could wipe somebody's entire board and their
biggest name would still be there pumping the next six things they played.

### The rules text is generated

Nothing on a card is written by hand except its flavour. `engine/rules-text.ts`
turns the effect the engine runs into the sentence the card shows, so what you
read is what happens and the two cannot drift.

The first version had card text and card behaviour as separate facts. 110 of 235
cards demonstrably did nothing while the log cheerfully said "triggered".

---

## Decks

**40 cards, one copy of each, at least 12 projects.**

**No deck budget.** What a card costs is paid at the table, out of the marketing
budget, not once when the deck is built. Two prices for one card is two things to
balance and one of them is invisible while you play.

**No cap on cards of one project.** Stacking is already limited by the rule that
only one card of a project holds a position at a time.

**Only cards you own**, once collections are real. That check is deliberately not
enforced in PvP yet, because collections are still browser-local.

### Presets

Three ready-made decks: **MEME LORD**, **FLOOR SWEEP**, **THE VAULT** (defi).
`infra` has none, and that is now a gap rather than a reason. It had three
families when this was written, which was not enough to build a deck out of; the
sixteen that went in on 2026-09-08 and the merge of `dex` into it left it holding
eight, the same as defi and nft. A fourth preset is owed.

Measured at 1200 matches per pairing, sides swapped
(`npx tsx scripts/preset-duel.ts`):

| | |
|---|---|
| MEME LORD | 62.4% |
| FLOOR SWEEP | 58.5% |
| THE VAULT | 52.3% |
| a generated deck | 26.8% |

All three ship on seed 8233, chosen by scoring twelve candidates against the
other presets. It came top for all three by twenty-five points, which means it is
landing on a deck *shape* rather than on lucky cards for any one sector. The same
seed does not build the same deck: the builder takes the theme's cards first.

**Support-leaning presets do not work, and this is settled by measurement.**
A deck is forty cards with a floor of twelve projects, and only a project pumps.
Any theme whose preferred pool is mostly not projects builds exactly twelve
projects and twenty-eight cards that do nothing on their own — however good those
twenty-eight are. Three themes died this way: one built from every tool and
influencer in the set (9%), one from tools (40%), and FULL CONTACT, which
preferred every tactic and event (37%). Narrowing FULL CONTACT to only the cards
that reach across the table moved it to 38.7% and it still built twelve projects.

A player can still build such a deck by hand. What cannot be done is handing
somebody one and calling it a starting point.

---

## Collecting

**A pack is 10 cards**, one slot guaranteed rare or better. The only other way
to buy is **one card**, at the printed odds with nothing promised.

One card needs no guarantee and a pack does. Ten cards with no floor is a wrapper
somebody opens and feels robbed by; one card at 50/35/9/5/1 is exactly what the
page says it is, with no bad slot hidden inside a good one. That floor is what
the pack sells, and it is why a pack is worth a third less per card.

**The 60-card deck mint is gone.** It handed over sixty in one go — twenty more
than a deck, so there was something left to build — and it was a third product on
a page that now has two. `scripts/collection-packs.ts` still models a player who
starts with sixty cards, spelled as six packs, so its rows stay comparable with
every run before this.

Pull weights, the same table for both:

```
common 50 · rare 35 · epic 9 · legendary 5 · mythic 1
```

Every draw is against the whole set, so a card you already have can come out
again. A second copy is something to trade, not something to deck, because a deck
still takes one of each.

---

## The NFTs

### What a card actually is

`scripts/render-cards.ts` screenshots `/card/<id>/image` at four times scale into
a 1072×1500 PNG, with ERC721 metadata beside it. There is exactly **one** renderer
for a card — the same `CardView` the game draws — so the picture on the NFT and
the card in the match cannot disagree.

**The stats go on the image.** That is a real cost: a rebalance orphans every
image carrying the old numbers, and printed art does not change when data does.
The first version has eight card images still showing thresholds the data no
longer has. The answer is that balance has to be finished before the mint, and
after the mint balance goes into the *next* set.

The renderer refuses to start unless the card set it imported matches the one the
dev server is serving. A changed card rendering quietly with its old numbers onto
somebody's NFT is not a mistake you can take back.

### The contract

`contracts/CardsOfCronosSetOne.sol`. ERC721, free mints against a merkle root,
paid mints with the $CROCARD discount carried over unchanged from the first
collection — one percent off per million held, capped at thirty. That is the one
mechanic that already rewards holding the token, and changing the deal on people
who bought in for it would be worse than any gas it saves.

**No `ERC721Enumerable`**, unlike the first collection. It costs gas on every
mint and transfer to keep an index this project reads exactly once, off-chain,
from a script that walks `ownerOf`.

Overpaying is refunded. The first collection kept the difference.

21 tests, `npm run contract`. Every proof in `data/allowlist.json` is fed to the
contract and accepted — all of them, not a sample, because a holder whose proof
does not verify is somebody who was promised a mint and cannot take it.

**Not audited.** Tests are not an audit and this holds money.

### The first collection, and the free mints

`0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902` on Cronos. Everything known about it
is in `docs/the-first-collection.md`; the two facts that matter here:

**It is 515 tokens, not 1894.** 1894 was the plan and it is written down in three
places. The mint stopped at 515.

**Fifty holders, and one of them is not a person.** Ten tokens sit at the old
dapp's burn address. `data/allowlist.json` leaves it out: 49 addresses, 505 free
mints.

One per token (505) or one per distinct card (478) is a flag on
`scripts/allowlist.ts`, not a property of the contract — but the root has to
match whichever is chosen.

---

## The weekly high score

Beat the bot, and your market cap goes on that week's board. The best score when
the week closes takes the prize pot, which is a quarter of every paid mint.

**Your best of the week counts, not your last.** A board where playing again can
cost you your place is a board that tells you to stop playing.

**Weeks run Monday 00:00 UTC to Sunday midnight.** UTC, because a week that ends
at a different instant depending on where you are is one somebody can argue
about, and a prize is exactly the thing somebody argues about. Written as
`2026-W38`, with the ISO rule that a week's Thursday decides its year — so
1 January 2027 belongs to `2026-W53`.

**Scores are replayed, not reported.** `lib/history.ts` is blunt that a solo
result is computed in the player's own browser and is worth exactly as much as
the player's honesty. True, and harmless on a profile; worthless the moment a
prize hangs on it. So `/api/tournament` takes the seed, the deck and every move,
rebuilds the bot's deck from the seed — which is all it is derived from — replays
the match through its own engine, and records what *that* produced. Nothing the
caller says about the outcome is read. It is the same machinery `/api/ref/demo`
uses to check somebody met the game.

What that still cannot stop is somebody writing a solver and submitting the
matches it played. The engine is public. What it costs them is a program that
beats the same bot everybody else is beating, which is the game rather than a way
past it.

**What it cannot check yet is that the deck is yours.** A collection lives in the
player's browser, so there is nothing on chain to read it against. That does not
matter while the mint is shut — with nothing to mint there is nothing to own, and
`DECK_FROM_COLLECTION` stands down with `MINT_OPEN` — and it is the check that has
to arrive the moment either changes.

**A won week that has not been paid shows as unpaid**, rather than not showing.
`pastWeeks` is a LEFT JOIN for that reason: hiding an unpaid week turns it into
an invisible one, which is the failure worth being loud about. `tournament_paid`
has the week as its primary key, so a week cannot be paid twice.

**Nothing is in the pot yet.** No mint has happened and the prize wallet has no
address, so the page says there is nothing to win and runs the board anyway —
the scores are the part that has to be real first.

---

## Records, ranks and clocks

**Two kinds of record, kept apart and labelled.**

Solo results against the bot are computed in the player's own browser, so they
are worth exactly as much as the player's honesty — fine for "how is this deck
doing" and worthless as a ladder. They stay local.

**Wins, losses and draws** come from every PvP match, friendly ones included.
Cosmetic.

**Rank is a different number.** It starts at 1000 with nothing behind it and
moves only on staked matches. It lives in the players table rather than being
recomputed, because Elo is path-dependent: it is the order results arrived in,
not the set of them, and a number you can only rebuild by replaying every match
in sequence is a number you should be storing.

**When a correspondence clock runs out, the turn ends and the match does not.**
Forfeiting would mean a bad connection costs a stake. Ending the turn is
punishment enough on its own: the whole budget for that turn is lost and the
waste rule charges for every bit of it.

The clock is lazy — an end-of-turn is appended for every window that closed while
nobody was looking — so it needs no cron and a match nobody opens for a week is
in the state it should be the moment somebody does.

---

## Holding the token

**Holding never changes what you may put in a deck.** Everyone builds inside the
same rules, so a match for money is decided by how you play and not by what you
own.

That was measured before it was decided, in the game this engine came from: a
deck built on 110 points of a deck budget beat one built on 80 in 86% of matches,
and even 90 against 80 won 64%. Selling deck power in a game people bet on is not
selling a stronger deck, it is selling the result of the bet.

So holding buys **economics** instead, and only economics — how much of what you
win you keep, and nothing else. The rungs used to carry perks as well (all
tables, tournament entry, new sets first); every one of them was a promise about
something that does not exist, printed beside a number that does, so they are
gone. `data/holder-tiers.ts` has four tiers,
and they are TCG's ladder carried over without a number changing:

| tier | from | taken when you win |
|---|---|---|
| RETAIL | any amount, including none | 25% |
| BAGHOLDER | 100,000 · 0.01% of supply | 15% |
| HOLDER | 1,000,000 · 0.1% | 10% |
| WHALE | 10,000,000 · 1% | 5% |

**The thresholds carry over because the supplies match, not because they were
copied.** TCG's ladder is built on fractions of a one-billion supply. $CROCARD's
supply was read off the chain — `totalSupply()` on
`0xECf3361441512c1e9F6A6e8734D86614D8e795BC`, 18 decimals — and it is one billion
exactly, so the same fractions give the same numbers. If that ever turns out to
be wrong, every threshold is wrong with it.

**The winner's tier is the one that counts.** Your stake is gone either way when
you lose, so a discount on a loss would only ever have been a discount for the
person who beat you. A balance nobody could read is retail: a discount that
cannot be verified is a discount nobody earned.

**The field is called `cut`, not `burn`**, and it was `burn` for an afternoon.
That was true while a ranked match was entirely burn and stopped being true the
moment the stream split three ways — a quarter of this is burned and the rest
goes to holders and the pot. It had already reached the page as "BURNED WHEN YOU
WIN", which is the "one name, two meanings" failure this project has a section
about, arriving by the ordinary route: the name was right when it was written.

The file refuses at load a rung that is unreachable from the one below it, or a
burn that does not fall as you climb. Both are one digit wide and neither shows
on the page.

This replaced three tiers that said so themselves — "no bag", "a bag", "a serious
bag", burning 10/7/4 — and none of those numbers had been settled.

**A collection buys choice, not power.** A card is the same card however you got
it, and packs run 44.6% common and 31.7% rare against this set — measured over
four thousand packs — so a bigger collection is mostly a bigger pile of the cheap
tiers. What no pack fixes is that two collections drawn on these rules play
out a long way apart; that spread *is* what opening packs is, and the rewards
ladder is what absorbs it.

What that spread is worth in win rate has not been measured for this set.
`scripts/collection-packs.ts` is the script that would say.

---

## The economy

`lib/revenue.ts` is the single source of the splits and it throws at load on a
split that is not 100%, on a malformed address, on two wallets sharing one, and
on a stream marked live while a wallet it pays is still unknown.

| stream | split |
|---|---|
| paid mints | 50% $CROCARD holders · 25% burn · 25% prize pot |
| ranked matches | 50% $CROCARD holders · 25% burn · 25% prize pot |
| NFT royalties | 50% $CROCARD holders · 25% burn · 25% prize pot |

**One split, and it is the only one.** Three streams dividing three different
ways was three things to explain; one sentence now covers every way money enters
this game, and a rule somebody can repeat from memory is a rule they can check.

**Nothing pays the creator wallet.** It took a quarter of mints and a quarter of
royalties once, and both moved. That is the settled position and not an
oversight, so the wallet stays in the file saying so — deleting it would make
paying the maker a new decision rather than a visible one.

**A mint is one card or ten, and nothing else.** A card is 15 CRO and a pack of
ten is 100, so the pack is a third off — ten singles would be 150. The $CROCARD
discount carried over from the first collection comes off on top, one percent per
million held and capped at thirty, which puts the floor at 10.5 CRO for a card
and 70 for a pack. `lib/revenue.ts` refuses at load a pack that is not cheaper
per card than a single, because that is a button nobody has a reason to press and
the mistake is one digit wide.

**Half of a mint goes back to the people already holding the token.** That is a
different promise from burning and both are being made: a burn helps every holder
by making the supply smaller, and this pays them in CRO. The creator takes
nothing out of a mint.

**A quarter is the prize pot**, paid out weekly on high score, which is what TCG
does. Paid out, never spent — it is the one wallet whose balance is somebody
else's.

**How holders are paid is not decided.** A share-out needs a snapshot or a claim
and neither exists, so the stream is not live. It is written down as an open
question on the stream itself rather than nowhere, which is the only reason the
file can tell the difference between a decision and a gap.

**A ranked match divides its cut exactly like a mint.** It was 100% burn, on the
argument that "all of it goes into the token" is a shorter sentence than any
split. It is, and it was the wrong trade twice over: this is the stream players
pay most often, so two streams dividing differently is two things to learn and
two to get wrong — and the weekly pot has to be fed by the thing people do every
day, or the prize is only ever as big as last week's minting.

**How much is taken is the holder ladder**, 25% down to 5% by what the winner
holds. Nothing is staked yet, so nothing is taken.

**The burn is $CROCARD**, the token that already exists, sent to the burn address
the first version already used — so every burn this project has ever done lands
on one address anybody can watch in a single explorer page.

**The burn total is the sum of transaction hashes**, never a stored number. A
burn counter you cannot check is a number you should not believe, and this corner
of the internet is full of them.

All four wallets are `null`. Not a placeholder: a stand-in reads exactly like a
real address on the page, and this is the file where money goes somewhere.

---

## Signing in

A signature and not an address. Every address is public the moment its wallet
does anything on-chain, so a typed address proves nothing.

On EVM the check runs by recovery: the address *is* a hash of the key, so the key
is recovered from the signature and hashed, and the result either is the address
claimed or it is not. Re-verified on every read, never swapped for a stored
"yes".

**This is not security.** Verification happens in a browser the visitor owns.
Today that gets somebody a deck builder full of cards nobody can play for money.
The moment there is a stake, the same proof has to be checked on the server and
the client's answer stops counting.

**One spelling per wallet.** An EVM address is the same address in any case, so
two spellings of one wallet would be two players, two referral rows and two point
balances — and nothing about it looks wrong until somebody counts. Lowercase
everywhere it is stored and compared, checksummed only where a person reads it.
Enforced at the door in `lib/api.ts` and by a `CHECK` on every wallet column.

---

## PvP, referrals and points

**Correspondence and friendly only.** Live and staked are refused by name.

The server is the referee. A match is a seed and a list of moves; no state is
ever stored, it is replayed. The client is sent a redacted view — never the state,
because the seed alone reveals both shuffles. A stranger asking about a match
gets 404 rather than 403.

The clock is lazy: an end-of-turn is appended for every window that closed while
nobody was looking, so nothing needs a cron.

**Referrals qualify on work, not on arrival.** Wallets are free, so a referral
that counted the moment a wallet appeared would be a wallet-generating machine.
It counts when the person referred has linked an X account *and* finished a
match. Neither is impossible to fake; together they cost more than the referral
can be worth, which is the only bar that matters.

**Points are a ledger, not a balance.** Every row says what happened and when.
Idempotency by unique index rather than read-then-write. Nothing is deleted;
a voided task takes its points with it and both keep their history.

Five tasks, a point each, and a referrer earns one for each of the five their
referee does — so a referral is worth up to five. `follow_x` is recorded as
*declared* rather than *verified*, because X has no free tier and checking one
follower costs about twenty dollars. The page says so, because a player who knows
it is checked by hand behaves differently from one who thinks nothing is.

---

## Open

Things that are genuinely undecided, as opposed to unbuilt.

- **The card content.** The projects, their categories and what each card is
  about are being reworked. What is in `data/cards.ts` today is a working set
  with the right shape, not the final one.
- **The rake.** What a staked match costs has not been decided.
- **maxSupply, name, symbol and baseURI** for the new collection. All four wait
  on the card set and on there being art to upload.
- **One free mint per token, or per distinct card.** 505 against 478.
- **Whether cards are NFTs you must own to deck.** The rule is written and the
  check is off.
- **The addresses.** Admin, the four revenue wallets, a domain, an X account, a
  Telegram channel and bot. All deliberately empty rather than guessed, and the
  tests fail the moment one is filled in — which is how whoever fills it gets
  sent back to the assertion that has to come with it.

---

## The stack

Next.js 16 with the App Router, React 19, Tailwind 4, TypeScript strict with
`noUncheckedIndexedAccess`. Deployed to Cloudflare Workers through OpenNext, with
D1 for storage — a match is a seed and a list of moves, a few hundred bytes, so a
separate database vendor would be a bill for nothing.

`engine/` imports nothing: not React, not the browser, not the rest of the app.
It is a pure reducer, and that is what lets a script play three thousand matches
in a terminal.

`lib/store.ts` is the only file that knows SQL. It takes a four-method interface,
so the tests run against a fake.

Solidity is built and tested with Foundry — the one thing here that is not npm,
because the contract needs a Solidity test runner and no amount of TypeScript can
verify what a contract hashes.

**Never a key in the source.** An RPC key ended up in this project's history once
and there is no getting it out again.
