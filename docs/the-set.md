# The set, as it is being decided

A working list of which projects and which people are in Set 01, and why. Written
down because it is being decided in conversation and the conversation is not a
place things survive.

**This is the list, not the data.** `data/cards.ts` is the truth about what the
game plays; this says what the list is supposed to become and which parts of it
are still open. When the two disagree, the data is right and this is behind.

---

## The four sectors

A project's sector is **what it is best known for**, not everything it is. Several Cronos projects are a token and an NFT and a game at
once — CRO Army, Crazzzy Monsters, Crooks Finance — and a sixth `gaming` sector
was considered for exactly them and turned down. What a project also is belongs
in the flavour on its eight cards, where "ten thousand of them and every single
one is somebody's favourite" says more than a label would.

| sector | what it means |
|---|---|
| meme | the joke is the product; you hold it for the chart and the chat |
| nft | you hold a picture, and there is a floor under it |
| defi | money goes in and something happens to it |
| infra | where all of that happens — the venues and the rails |

**It was five and `dex` was folded into `infra`.** A dex is a venue: you do not
take a position in it, you pass through it, and that is equally true of a
marketplace, of a toll and of the chain itself. Having the venues split across
two sectors is what made infra a grab bag — "marketplaces and the tools
everything else runs on" described no single thing. Together they describe one:
the other three are things you hold, and this is where you hold them.

VVS settled it on its own card: "The front door of the chain, whether or not it
meant to be."

Removing infra altogether was decided first and reversed within the hour, which
is why the merge is the answer rather than the deletion. The old note argued for
five over four "because nineteen families over four sectors leaves one holding
seven and another holding three" — a nineteen-family problem, and the set is
heading for thirty-four.

---

## Projects

Eight cards each: two commons, two rares, two epics, a legendary and a mythic,
numbered I to VIII.

### In the set — 35 families, 280 cards

| sector | families |
|---|---|
| meme | Clove · FFS · CAW777 · DAK · CAW · Mistery · Capybara Nation · Loaf · Ballz of Steel · Corgi · Puush |
| nft | Reckless Robots · Howlers · Loaded Lions · Cronos Chimp Club · Cr00ts · Ryoshi · Bob's Adventures · Boomer Squad · CRO Army |
| defi | Crooks Finance · Wolfswap · Crazzzy Monsters · Tectonic · Ferro · Cronus · Fulcrom · Single Finance |
| infra | Nova · Obsidian Finance · VVS Finance · Mad Meerkat Finance · Minted · Ebisusbay · CRO |

The sixteen went in on 2026-09-08 with `scripts/new-families.ts`, which is also
where the list of them lives — fifteen in one go and CRO Army after it, which is
why that script writes only what is missing rather than refusing to run twice. Each carries a name, a ticker, a sector, a rarity
and the set's own median numbers for its rung — 15/9/3 at common through
110/56/6 at mythic, the same for every new family. A family's numbers should move
when its character is decided; a spread invented now would be precision that
later work has to unpick.

Three moved earlier the same day and their founders' auras moved with them:
Wolfswap from dex to defi because it is a swap aggregator and not a venue,
Obsidian Finance from defi to dex, Crazzzy Monsters from meme to defi. The dex
three then became infra with the merge.

Obsidian looked like an inconsistency in that and is not. Its own posts call it
"Cronos' first full hybrid DEX aggregator", aggregating liquidity from H2 Finance
and Ebisu's Bay — which is the exact description that moved Wolfswap out of dex.
Raised, and answered by the maker: Obsidian runs its own DEX now. A venue, so
infra. The rule did not bend; the project changed.

CAW777 had to give up its name to make room. It held both the project key `caw`
and the ticker `CAW`, and one of the new families is a project actually called
CAW; it is `caw777` with `CAW777` on it now, which is its own name either way.

CRO Army has the ticker `CA`, which is its own. `ARMY` was a guess made while the
skeleton was written and it lasted until somebody looked the project up.

### Three projects were filed under defi and none of them were defi

Corgi, Puush and CRO Army all went in as defi and all three moved once they were
looked up — Corgi and Puush to meme, CRO Army to nft. CorgiAI is a community token
with a dog on it, $PUUSH is Boomer Squad's meme token with a launchpad attached,
and CRO Army is a strategy game with AI soldiers in it.

None of that is a mistake in the list so much as what the list is for. A project
that stakes, or has a platform, or has a token reads like defi from outside and is
not. The rule holds: the sector is what a project is best known for, and finding
that out is what these passes are.

Corgi and Puush both went from defi to meme on 2026-09-08, once looking them up
said what they are. CorgiAI is a community token with a dog on it that happens to
stake and happens to have been the first thing on this chain to use AI; $PUUSH is
Boomer Squad's meme token with a launchpad attached. Staking does not make a
project defi, and neither does having a platform — under this set's own rule the
sector is what a project is best known for, and nobody knows either of them for
their yield.

Boomer Squad came in as an nft family at the same time. It is the collection
behind puush.fun, so those two cards know about each other the way Fulcrom's card
knows about VVS.

### VVS keeps turning up

Fulcrom, Cronus and CorgiAI all launched through VVS Finance, and that is not a
coincidence about three projects — it is what VVS was on this chain. Whatever a
project's own cards end up saying, the ones that started there say so, and it
makes VVS read like the front door its own card already calls it.

### The sixteen went in without flavour, and are getting it back one at a time

The line on a project card says something about a real project on this chain, and
nobody writing the file knew what Ballz or Puush or Loaf was known for. The same
rule as the people: sourced or it is not written.

`validateSet` still refuses a card with no flavour. The families still waiting are
listed by name in `AWAITING_FLAVOUR_FAMILIES` in `engine/validation.ts` — by family
rather than by card, because 120 ids would be a wall nobody reads and the point of
the list is that somebody reads it. A family not on the list still fails.

**Fifteen of the sixteen are done, and the sixteenth was removed.** One family
per pass, every claim looked up and read back to the maker before it was written.

Sloth Gang is the one that came back out. Finding it took reading the contract
rather than searching: three other sloth collections share the name or nearly do,
and the one on this chain has no website at all. On-chain it is real enough —
5,000 CRC-721 at `0x4817f242...2f87`, symbol `SLOTH`, six trait layers, five
one-of-ones at the end, art generated 9 July 2026 and the contract deployed on the
12th. That last fact is why it is gone: it is two months old, which makes it the
newest thing in the set by years, and eight cards of flavour would have had
nothing to describe but its own metadata. Removed rather than written thin.

Which is the first time this pass has taken a family out, and worth saying plainly:
the walk is not only for writing lines. It is for finding out whether a name on a
list has anything behind it.

The pass keeps finding things the list had wrong, which is the argument for doing
it this way rather than in one sweep. Three sectors moved. Two tickers were wrong
— CRO Army is `CA` and Capybara Nation is `BARA`. Two families had the wrong name:
Mistery on CRO was down as "Mery", which is its NFT collection, and Ballz of Steel
as "Ballz". Two searches returned the wrong project outright — CAW is Crow with
Knife on Cronos and not the Ethereum token of the same ticker, BALLZ is not
Solana's WolfWifBallz. And one family had nothing behind it worth eight cards.

Three of the sixteen turned out to be tap-to-earn games in Telegram: Capybara
Nation, Loaf's Toastoff and Ballz of Steel's Plinko. Their lines take different
angles on purpose, but the repetition is not a failure of the writing. It is what
this chain was doing in 2024.

Projects in this set keep turning out to know each other. Ballz of Steel seeded
liquidity against MERY and PUUSH as well as CRO; Boomer Squad is the collection
behind puush.fun; Fulcrom, Cronus and CorgiAI all launched through VVS. Nothing
was arranged for that — it is what a chain small enough to fit in one set looks
like.

Effects are the pass after this one. A project with a launch and a pump is not an
empty card: it opens a position and it pays every turn.

### The tickers were the one guess in there, and two of them were wrong

They went in as the name shortened rather than the project's real ticker looked
up. Everything else on those cards is structure; a ticker states a fact.

The flavour pass looked all of them up on the way past. Two of the sixteen were
wrong: CRO Army is `CA`, not the `ARMY` that was guessed, and Capybara Nation is
`BARA`, not `CAPY`. The rest were guesses that happened to be right.

Walking the nineteen older families is finding more of them, and for a different
reason — those tickers were not guesses, they were right once. Cr00ts is `CR00TS`
on-chain and the set had `CR00`. Wolfswap is `PACK` now, after two migrations, and
the set had `WOLF` — which still exists as something else, which is what made it
look correct.

### The sector spread

meme 11, nft 9, defi 8, infra 7 — thirty-five families and 280 project cards.

It matters because a sector is something you build around in this game. The deck
presets are sector decks, the auras on the people cards pump one sector each, and
a `pumpBySector` card is worth what your board holds of it. Before the merge it
was 9 / 7 / 10 / 4 / 3, so a player leaning infra picked from three families and
one leaning defi from ten. Now three of the four hold eight and meme holds eleven.

---

## The nineteen older families are being walked too

The sixteen that went in on 2026-09-08 went in empty and were written under the
rule. The nineteen that were here before them already had lines — some inherited
from the first version, some written before "sourced or it is not written" was
the rule — and none of it had ever been checked.

Reading all 152 lines at once found four things rather than one:

1. **Invented precision.** 53 of the 152 carry a number, a duration or a count.
   Some are right: Crazzzy Monsters really is ten thousand across twenty families,
   and VVS really does stand for Very Very Simple. Others are not: Reckless Robots
   is 2,100 and its card said four hundred.
2. **Lines describing the wrong kind of business.** Obsidian is a DEX and its cards
   gave it "nine figures locked" and a floor that never broke, which is lending and
   NFT language. Wolfswap is an aggregator and its cards gave it its own order book.
3. **A whole family in the wrong sector** — Cr00ts, below.
4. **One line that should not be on a card at all.** Minted VI said royalties were
   optional and it collected them anyway. That is an accusation against a real
   business with nothing under it.

And two families nobody can identify: **DAK** and **Nova**. Neither is findable by
search. Their cards are eight lines each about projects whose nature is unknown —
DAK's read like an NFT collection while it is filed as a meme.

### Loaded Lions is older than the chain this set is about

10,000 algorithmically generated lions, minted 23 November 2021 at 13:00 UTC at $200
a pack, five packs maximum. Every one is a membership called The Mane Net. It is the
flagship of Crypto.com's own NFT platform and it got a game, Loaded Lions: Mane City,
powered by Cronos Labs. Ticker `LION` was right.

**And it was minted on Crypto.org Chain, not Cronos EVM.** Crypto.org went live in
March 2021 and Cronos EVM in November. The collection predates the chain this whole
set is about, which is the sort of thing eight cards should say and none of them did.

Three lines kept, and the strongest promoted again: "Blue chip is a thing people call
you. Nobody applies for it" moves from legendary to mythic. That is the third family
in a row — after Minted and VVS — whose best card turned out to be an aphorism that
asserts nothing. The pattern is now firm enough to plan around.

Removed: "Two cycles in and the floor is still where the floor was." A floor moves,
and a cycle is not a unit anybody can check.

**One line was deliberately not written.** "A pride is what you call a group of lions"
is true, and it is the exact shape of the mob line written for Mad Meerkat Finance one
family earlier. Two families making the same collective-noun joke is one idea printed
twice, which is why Obsidian and Wolfswap were pulled apart as well. Checking the set
for what it already says is now part of writing a family, not just checking the world.

The Mane Net turns up on a person card too: JkcryptoXYZ's X bio gives his location as
"The Mane Net". Neither card mentions the other and both are true.

### Mad Meerkat Finance, and a claim the project makes about itself

Three of eight kept, ticker `MMF` right — the third correct one in a row, which is
what the defi and infra half of the list looks like once you get past the two
aggregators.

The facts that were missing are good ones. The MMF token was created on 7 December
2021 and the Mad Meerkat NFTs launched on the 5th — the pictures came out two days
before the token. A $1m ecosystem fund followed on 31 December. The fee is 0.17%,
and it was the first on Cronos to run Protocol Owned Liquidity, owning its liquidity
rather than renting it. The ecosystem is a DEX, a yield optimiser, an NFT line and an
algorithmic stablecoin.

Card IV is a correction rather than a replacement: it said "A DEX, a launchpad, an
NFT line and a burn". The launchpad could not be confirmed anywhere; the optimiser
and the algorithmic stablecoin could, and they are stranger.

**And one claim was caught coming from the project itself.** MM Finance's own
documentation calls it "the 1st AMM & DEX on Cronos Chain". VVS launched in November
2021; the MMF token is dated 7 December. A project's own marketing is a source like
any other and gets checked like any other — this walk has been correcting invented
claims, and this is the first one that arrived pre-written by the subject. What went
on the card is "first on this chain to own its liquidity instead of renting it",
because that one holds.

Removed: two invented buyback lines, "Somebody worked out the buyback was bigger than
the emissions" and "The buyback ran on a timer and the chart knew what time it was".
Both read like research and neither is anywhere.

Card VII is simply true — a group of meerkats is a mob. The old cards were already
using the word correctly, so somebody had looked that up back then.

### Ferro, and the first line that was not wrong but impossible

Four of eight survived, the most of any family so far, because Ferro's cards were
the only ones already describing the right kind of business. Ticker `FER` was right
too — the second in a row after VVS.

Two had to go, and the first is a new category of error. "It held its peg through
the week everything else did not" points at the week UST collapsed, May 2022. Ferro
launched in June 2022. It did not exist that week. Every other bad line in this walk
was inaccurate; this one was chronologically impossible.

The second was "Nothing dramatic ever happened to it, which is the achievement."
Searching found no exploit and no depeg, and that is still not the same as proving a
negative — a claim that nothing has ever happened can only ever be falsified. Nine
days after Tectonic, that sentence does not belong on any DeFi card on this chain.

What replaced it is a promotion rather than a rewrite. "The pool nobody watched,
because it never did anything" was on card III and says exactly what the old mythic
wanted to say, as a description of character instead of an unprovable claim about
history. For a stableswap, being invisible is the achievement.

The facts that were missing: $FER launched through an Initial Gem Offering on VVS
Finance in early June 2022, mainnet opened with the 3FER base pool of USDT, USDC and
DAI, and Crypto.com listed it on the main app and the exchange within a month. VVS
for the sixth time — and card III makes the joke out loud, that it is called a *Gem*
Offering because VVS names everything after jewellery, which is the layer uncovered
on VVS's own cards one family earlier.

### Tectonic carried the worst line in the set

Its mythic said "Solvent through every drawdown anybody on this chain remembers."
Nine days before it was read, Tectonic was drained of $120.4 million and Cronos
halted and rewound the chain to undo it.

30 August 2026. At 12:38:56 UTC an attacker began lifting the price of TONIC —
Tectonic's own governance token, with roughly $1.34m of liquidity and about $11,000
of daily volume — around 100x in twenty minutes. Tectonic accepted TONIC as
collateral at a 20% collateral factor. At 12:49:39 the attacker borrowed about
$120.4m across nine markets in a single transaction: USDC, USDT, wrapped BTC,
wrapped ETH. At 14:32:47 validators halted the network at block 90,907,150 and
restored it to 90,896,188, erasing 10,961 blocks and 1 hour 54 minutes. That
reversed roughly $111.2m; about $9.19m had already left the chain. Blocks resumed at
23:49:01.

Ticker `TONIC` and sector `defi` were both already right.

**Putting it on the cards was the maker's call and was put to them as one.** The
argument for: this set's whole discipline is sourced or it is not written, and
omitting the largest exploit in the chain's history from eight cards about a lending
protocol is the same failure as an invented number, arriving by omission. The
argument against: it is nine days old, it is still unfolding, and people hold TONIC.
The lines describe a mechanism and accuse nobody, and every figure on them — the
date, the 20%, the 10,961 blocks — is permanent.

Three of the eight survived, all three claiming nothing: what supplying and
borrowing feels like, what a health factor is, what a cascade does.

### And it changed CRO's mythic

A chain that erases 10,961 blocks to undo one transaction has said something
permanent about itself, so a line went to CRO as well. A family is eight cards, so
one had to go: "The chain itself. Everything on it moves together, up or down" — the
only one of CRO's eight with nothing specific behind it.

What replaced it closes an arc the family already had. Card V says the validators
who carried the vote to re-mint seventy billion CRO were the ones who called it.
Card VIII now says "The same validators once stopped the chain and erased two hours
of it." Two facts, four years apart, about the same power being used twice.

### VVS had the only ticker in nineteen that was already right

Six families walked, six tickers corrected, and then VVS. `VVS` is `VVS`.

Its old card had the name half right: "Very, very simple" is the pitch, and the
full one is "Very Very Simple DeFi for Everyone". Launched on Cronos in November
2021. Half the token went to the community by design — 30% to farms and mines,
2.5% to traders and referrers, 2.5% to market makers, 15% to a community wallet —
against 23% to the team.

**The second meaning of the name was nowhere on the cards.** VVS is a diamond
clarity grade: Very Very Slightly included, near-flawless, needing a loupe to see
anything in it. That is why the products are Bling Swap, Crystal Farms, Glitter
Mine and Gem Mining. The whole product line is one sustained jeweller's joke, and a
grading scale does not change.

"The front door of the chain, whether or not it meant to be" moves from legendary
to mythic, as Minted's aphorism did. This walk has confirmed it five times over —
Fulcrom, Cronus, CorgiAI and Loaf traded there, Minted launched its token there —
so it has earned the family's most expensive card.

Left off: the $1.4 billion TVL peak reached within three months. Historical and
tempting, and still a record that can be broken, at which point the card is wrong.
The same call as Capybara Nation's all-time high. Removed outright: "The fees were
the moat. Nobody undercut it for two years", where the two years came from nowhere.

### Minted, and the one line that had to go

"Royalties were optional and it kept collecting them anyway" was an accusation
against a real business with nothing under it. It is gone, and nothing resembling
it replaced it. Nothing in this set accuses anybody of anything it cannot show.

Ticker `MINTED` to `MTD` — the sixth correction of the walk.

The real story was better and none of it was on the cards: accelerated by Cronos
Labs, launched August 2022 with a Crypto.com partnership from the start, multi-chain
across Ethereum and Cronos from day one. $MTD launched on VVS Finance on 2 August
2022 at 9AM UTC, a billion of them, distributed by the overflow method. It carries
Moonbirds and Otherdeeds beside Cronos collections, and it is where an NFT bought on
Crypto.com goes to be resold.

**Two lines survived, and both survived for the same reason as Obsidian's.** "A
list, a filter and a buy button. Somebody has to make one" describes what any
marketplace is. "The venue outlasts everything it lists. That is always true" is a
fact about venues rather than about this one — and it was promoted from legendary to
mythic, because it is the strongest of the eight and it cannot age.

That is now the rule the walk keeps finding: **a line survives when it claims
nothing.** Wordplay on a name, a description of a category, an aphorism about how
markets work. Every line replaced so far reached for a specific it did not have.

VVS appears here for the fifth time — Fulcrom, Cronus, CorgiAI and Loaf traded
there, Minted launched its token there. Five projects is not a coincidence about
five projects. It is what VVS was, and it makes its own card's "The front door of
the chain, whether or not it meant to be" read as understatement.

### Reckless Robots, and why the chain alone is not enough either

Its card said "One is a toy. Four hundred is an argument." It is 2,100, hand-drawn,
symbol `RECK` on-chain against the `RR` the set had — the fourth ticker corrected.

The mechanic is the reason this family is worth its cards. Staking runs a weekly
elimination: whoever stakes with the lowest bid loses their robot, and the
elimination wallet buys it off the floor and burns it. Fewer robots left means a
larger share for everyone still in. Reckless Robots Legends followed, 3,000 in
three classes — the Commander, the Void, the Beast.

**And here the on-chain read was not enough.** `totalSupply()` still returns 2,100.
Ebisu's Bay shows 1,811 items. The burned ones went to a burn address rather than
being destroyed, and this contract counts what was minted, not what is held. Read
only the chain, as Sloth Gang was read, and the whole elimination mechanic is
invisible. Read only the marketplace and the original 2,100 is.

Card VI says exactly that difference — "The number minted has not changed. The
number that exists has" — and stays true however many more are burned. The 1,811
itself is nowhere on a card, because it moves every week by design.

Left off although true: `recklessrobotsnft.com` no longer resolves, nor do the two
Cronos news sites that covered it, and the art no longer loads on Ebisu's Bay. That
tells a story, but a dead domain can come back and a card cannot.

### Wolfswap had the right sector and the wrong everything else

Its cards gave an aggregator its own order book — "Anything thinner than its own
book got quoted out of existence" — and a slippage figure of eleven percent that
came from nowhere. Wolfswap is a gamified DEX aggregator: swaps over $10 earn
points toward seasonal leaderboards, there are mystery boxes and trading contests,
and 50% of all revenue buys back its own token. Wolfies are 5,212 NFTs each backed
by an on-chain reserve in the PACK-CRO pair, and burning one claims its share —
the most distinctive mechanic anything in this set has.

**Third ticker corrected: `WOLF` to `PACK`.** The chain of migrations is FRTN to
MOON when Ebisu's Bay was acquired, then MOON to PACK one-for-one. `WOLF` still
exists as a separate ERC-404 leaderboard reward, which is exactly why the old
ticker looked right and was not the platform's token.

Obsidian and Wolfswap are both aggregators, so their eight lines were deliberately
pointed away from each other. Obsidian's mythic is about routing, Wolfswap's about
buying. Two families that do the same thing need to say different things, or the
set has one idea printed twice at two prices — which is the trap `CLAUDE.md`
records as "one name, two meanings", arriving from the other direction.

### Obsidian kept one line out of eight

Its cards described a lending protocol: "Nine figures locked and the outflow chart
is a flat line", "Three years, four bear markets, and the floor never once broke".
Obsidian is a smart DEX aggregator with its own pools, on Cronos and Cronos zkEVM,
and its X account dates from July 2024 — so the three years were wrong as well as
the shape.

What it actually is: SmartRouter picks the best route across several liquidity
sources; a 0.5% aggregator fee splits evenly, half back to the partner project and
half into $OBS buybacks for rewards and burns; the Puush launchpad is integrated,
so a token can launch and trade without leaving. Ticker `OBS` was already right.

**The line that survived is the one that makes no claim.** "Volcanic, and it takes
an edge nothing else on the chain can hold" is wordplay on the name — obsidian is
volcanic glass and an obsidian blade does hold a finer edge than steel. Nothing in
it can go out of date. The seven that were replaced all made claims, and all seven
were about a different kind of business. That is the pattern worth keeping: the
lines that aged badly are the ones that reached for specifics they never had.

Two of the new lines carry the 0.5% fee, which is a protocol design rather than a
price — but a fee can be changed, and then a card is wrong. Raised, and the maker
chose to keep it. It is the one line in this family with a shelf life.

Puush turns up here as well as behind Boomer Squad. That is the fourth pair of
families in this set that know about each other.

### Cr00ts was in the wrong sector, with eight lines about the wrong business

It was `infra`, with cards about a venue skimming a spread: "Two percent nobody
notices", "four percent worse. For eleven months", "a third of the chain's float".
Cr00ts is an NFT collection. 2,525 of them, confirmed on-chain at
`0xca00aba7...87734`, symbol `CR00TS` — the set had the ticker as `CR00`.

The real story is better than the invented one. Cronos Y00ts was abandoned by its
founder. Dream QC, its largest holder, had been made a moderator; when two days
went by with no answer he and Atlas, Puffins and Kahuna went to the marketplaces
and had the royalties redirected to a new team wallet, "until the founder
reappeared, if he ever did". They put 100% of the Y00ts ROI back into staking and
gave every OG holder a Cr00ts one-for-one. Launched 15 February 2023 with seven
artists on it, sold out in three days, and half of every secondary royalty is paid
out to holders weekly.

Left off because it moves: the floor, the CRO distributed to date, the volume.

**Its effects now contradict its cards.** Four of the eight are `stealMC`, built on
the reading that this was a venue taking a percentage — and it is a collection that
pays half of every resale back. That is close to the opposite. Not touched here;
written down for the effects pass.

---

## The rule for a line on a card

**Nothing that moves.** A card is minted and then it is somebody's for good, so
whatever is printed on it has to stay true for as long as the card exists. A price,
a monthly figure, a volume, a holder count — all of those are true on the day they
are written and a lie afterwards, sitting in metadata nobody can edit.

Two ways round it, and both are allowed:

- **Say it in the past.** CRO's high was $0.9889 on 24 November 2021 and that never
  changes. Its price today does, so the card says "a dollar, once" and leaves the
  number off.
- **Say the durable thing.** Ebisu's Bay opened on the day the chain did, and that
  is permanent. How many wallets used it last month is not, so the card says "half
  the people logged in are not there to buy anything" instead.

**And everything is checked.** What goes on a card gets looked up, not assumed —
the maker asked for that and the first family proved why: the note that CRO was
"near its all-time low" was wrong by a factor of five, and the burn story turned
out to have a third act nobody had mentioned.

---

## People

`type: "person"` since 2026-09-07 — it was `influencer`, which stopped being true
the moment devs and community figures were going on cards. A dev is not an
influencer and The Floor Sweeper is neither. The type says what one card is; the
group as a whole is the Cronos community.

**The nineteen founder cards are gone.** They were named "The Clove Founder" and
"The Ferro Founder" because the first version never wrote the names down, and the
rule that made them — every project gets a founder — would have given thirty-four
of them against thirteen other people. Three quarters of the people in this game
would have been somebody's founder, which is not what a chain looks like from the
inside. Founding something is no longer what puts you on a card.

### In the set — 20 cards

**7 named**, added 2026-09-08. Kris (mythic, infra) · Ryan Wyatt (legendary,
infra) · Alex (legendary, defi) · Haten (legendary, infra) · Schwiz (epic, infra)
· JkcryptoXYZ (rare, defi) · Artik (epic, draws a card every turn).

Alex founded Wolfswap and now owns Ebisusbay, so he is the case the old rule
could never have held. That claim was checked and nearly did not survive: the
acquisition was announced on 1 April 2025, in a post that read like a joke —
"NFTs should bark back", #Web3PowerMoves. It is real. Wolfswap's own 2026 recap
says "We acquired Ebisu's Bay", the FRTN-to-MOON conversion happened, and the
marketplace was rebuilt from scratch and relaunched on 26 June.

Which means two families in this set are not independent of each other: Wolfswap
owns Ebisusbay. That is nothing yet, and it is something once effects are being
written. He pumps defi — the thing he built rather than the thing
he bought, and the sector this set has least aura for. Artik has no project at
all and carries the first aura in the set that names no sector: he is here for
knowing what is going on, so he draws.

**5 from the first version**: Pampa · 21Million · Francis · Curry · Vinz. These
shipped under these names and people hold them.

**8 archetypes**, nameless, ported from TCG: The Caller · The Copy Target · The
Floor Sweeper · The Whitelist Hunter · The Validator · The Airdrop Farmer · The
Node Runner · The Mint Bot.

### All seven have their line

The cards they replace carried invented lines — "Three years of the same avatar
and the same two-line updates" — which was fine above a placeholder and is not
fine above a real name. `CLAUDE.md` has the rule: sourced or it is not written.
A project card that overreaches is wrong about a project. A person card that
overreaches is wrong about somebody who can read it, so the bar is higher here
and the line is one sentence of at most 85 characters.

Kris, Ryan Wyatt, Alex and Schwiz were on the public record and went first.

Haten, JkcryptoXYZ and Artik were not findable at all. Every search came back
with the project and never the person. What settled all three was their own X
bios, read in a browser — search engines do not index those pages and the
scrapers that mirror them answer 403. **Not found meant not looked in the right
place**, which is worth remembering the next time a name here comes back empty.

Reading them corrected one thing the list had wrong. Haten is not the founder of
Obsidian Finance; his bio says "Main Stakeholder of @ObsidianSwap", and he is an
ambassador for Cronos itself. JkcryptoXYZ's claim held exactly as given —
"Founder of @CrazzzyMonsters" — and he is an ambassador too. Artik turned out to
have built `cronosdash`, a dashboard for the whole chain, which is the best
possible reason for the one aura in this set that draws a card instead of pumping
a sector.

Nothing was taken from those pages except what the person wrote about themselves
in their own bio. No follower counts, no locations, no real names.

Two things were left off on purpose. Kris's card does not mention the 70% burn or
its reversal: that story is already on the CRO card, where it belongs as a fact
about a token, and on a person's card it reads as an accusation — with the vote
manipulation part being an allegation rather than a finding. And no card carries a
follower count or a net worth, for the same reason no project card carries a price.

`validateSet` refuses a card with no flavour, and that guard is untouched.
`AWAITING_FLAVOUR` is now empty, which is what it was built to become. It stays
rather than being deleted, for the same reason as the family list: an empty set
still fails every card without a line.

### What the removal cost, and what gave it back

Auras per sector went to meme 5, nft 4, defi 3, infra 8, from 9 / 8 / 6 / 10 with
the founders in. Two tests in `test/deck.test.ts` went off for a few hours
because of it: MEME LORD reached 13 of 40 on theme against a floor of 15, and
FLOOR SWEEP and THE VAULT shared 33 of 40 against a limit of 31.

Neither was a bad seed. A generated deck takes at most two cards of one project,
and meme had four families and five meme auras — two times four plus five is
thirteen. The fifteen new families put meme on nine, and both tests pass again
without either threshold moving.

### Still open

The list is "voor nu" — more devs, influencers and community are expected. With
the projects in, twenty people carry the aura layer for thirty-four families, and
defi is the thinnest: three aura cards for ten families.

## What comes after the list

Effects. Nothing on this page is about what a card does — that is settled once it
is settled who is on the cards.
