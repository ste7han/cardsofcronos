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

### In the set — 41 families, 328 cards

| sector | families |
|---|---|
| meme | Clove the Pig · For Fox Sake! · CAW777 · CAW · Mistery · Capybara Nation · Loaf · Ballz of Steel · Corgi · Puush · Pyro · Bored Catz Club · ELMO · Gang Gang |
| nft | Reckless Robots · Howlers · Loaded Lions · Cronos Chimp Club · Cr00ts · Crazzzy Monsters · DeFi Ape Kings · Ryoshi · Bob's Adventures · Boomer Squad · CRO Army · Imperium · Scrap Monsters |
| defi | Crooks Finance · Wolfswap · Tectonic · Ferro · Cronus · Fulcrom |
| infra | Nova Labs · Obsidian Finance · VVS Finance · Mad Meerkat Finance · Minted · Ebisusbay · CRO · CroDraw |

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

meme 14, nft 13, defi 6, infra 8 — forty-one families and 328 project cards.

It matters because a sector is something you build around in this game. The deck
presets are sector decks, the auras on the people cards pump a sector, and a
`pumpBySector` card is worth what your board holds of it. One person pumps two:
Pampa reads as somebody who lifts the working half of the chain rather than the
memes, and there was no shape that could say so until `pumpSectors` existed. Before the merge it
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

### The last two, and the walk is finished

DAK and Nova were the two nobody could identify. Both took one contract address from
the maker and came apart in a minute, like the three memes and the three people before
them.

**DAK is DeFi Ape Kings, and there are 249 of them.** Its cards said "Ten thousand of
them, and the first one still sets the floor", and all eight were about floor sweeps
and listings on a collection forty times bigger than the real one. It is the smallest
family in the set — smaller than Howlers at 638. It was filed as `meme` and it is `nft`,
which is the third sector corrected in this walk. Ticker `DAK` was right.

Its model is the reason it earns its cards: the collection holds a treasury, puts it to
work, and pays the interest out to holders in CRO every week, with raffles, Discord
roles and a streamer community around it. An ape with a balance sheet. Card VII reports
its "first of its kind" claim as a claim, the way Mad Meerkat's was — unconfirmable, and
nothing contradicts it.

**Nova is Nova Labs**: a cross-chain launchpad and GameFi ecosystem, CertiK audited,
December 2024, with a game called Clash of Galaxies. Its token is Nova Fox, which is
where `NFX` comes from — the eleventh and last ticker corrected, against the `NOVA` the
set carried. Sector `infra` was right: a launchpad is a venue.

One of Nova's eight survived — "Whatever you were building, there was a Nova thing that
plugged in" — which turns out to be a fair description of a launchpad. And one had to go
for being actively wrong rather than merely invented: "Nobody voted for it. Everybody
integrated it." Nova's own pitch is "launch, stake, govern".

Two foxes in this set now, arrived independently: Finchy of For Fox Sake, and Nova Fox.

**Every card in the set has a line, and every line has been checked.** 362 cards, 35
families, 20 people. Sectors finished at meme 10, nft 11, defi 7, infra 7.

### The last three memes had eight cards each that never named the subject

None of these three could be found by search. All three took one contract address and
one X handle from the maker, and then everything was there in a minute — the same
lesson as the three people, arriving again at the end of the walk. **Not found means
not looked in the right place.**

**Clove is a pig and For Fox Sake is a fox, and neither appeared on any of their
sixteen cards.** Clove is a KuneKune, a real New Zealand breed known for being placid,
and the bio says "she". FFS is a drunken fox called Finchy, and the name is a pun that
works three ways at once — the expletive, the animal, and sake the drink, which is why
its founder lists himself as a sake sommelier. Sixteen cards of atmosphere about
group chats and marketing wallets, and not one of them mentioned an animal.

**CAW777 is real, and it is a CAW derivative.** Its bio: "a @crow_with_knife
derivative, born from the ashes of burned $CAW. Forged to celebrate the LayerZero
Bridge & Burn Protocol." February 2025. So both readings were right — the maker's, that
it is a different project, and the doubt raised when CAW's own cards were written, that
the sevens were connected. The two families can now say so without repeating each
other: CAW's cards are about a bird and a knife, CAW777's about what was burned to make
it.

Its ticker is `777`, which is what the contract says, against the `CAW777` the set
carried. That is the tenth ticker corrected in nineteen families. `FFS` and `CLOVE`
were both already right.

All three have exactly one billion tokens, which is what a shared launch template looks
like from outside.

PACK turns up a third time — Wolfswap's token, paid out by Crooks, and here a
twenty-five million PACK vault behind FFS, which lives on Wolfswap rather than building
anywhere of its own.

One line survived across all three families: Clove's old opening, "A ticker, a chart and
a group chat. That was the whole of it", promoted to its mythic. Twenty-three lines
replaced.

### Crooks Finance, and four families that turn out to hold each other

Around since 2022. `CRKS` is the token — the set had `CF`, the ninth ticker
corrected — and `CRKL` is a collection of 10,000 NFTs, with 5,555 Crooks Empire
weapons alongside. Its swap routes through the Obsidian aggregator rather than its
own, every swap burns CRKS, and the burn pool empties itself at 500 CRO.

**Every week the CRKL holders are paid in PACK.** PACK is Wolfswap's token, and
Wolfswap owns Ebisu's Bay. So Crooks routes through Obsidian and pays in Wolfswap's
currency, and none of the eight cards on any of them said so. That is four families in
this set holding each other up, which is what a chain small enough to fit in one set
looks like from the inside.

Sector `defi` was uncertain when it was set and is now settled: it is a yield protocol
with a swap, a vault and a treasury.

**Two things came from the maker, not from research.** That `CRKL` is the NFT
collection rather than a rank token — the site shows a CRKL balance beside a rank, and
reading that as a points token was wrong; the rank follows from how many NFTs you
hold. And that the Arena is switched off, so it is not on any card. A first draft had
it listed beside Legends and Empire.

**And one line was cut for not being any good.** "A vault, then a router, then a thing
nobody could explain quickly" had been kept because it was written as invention and
turned out accurate — the site now has exactly a vault, a router and more than one
sentence can cover. But accidental accuracy is a story about the walk, not a reason for
a card to exist, and the maker was right that it is vague and unfunny. What replaced it
is what the weapons are for. The mythic moved off raiding and onto building and
holding, so the family does not make the same point twice.

### Howlers is 638, not 1,312, and the artist describes his own method

On-chain: `The Howlers`, symbol `HOWLERS`, totalSupply 638, contract
`0x43c9ffaf...89fe`, verified on Ebisu's Bay at 8% creator royalty. Ticker `HOWL` to
`HOWLERS` is the eighth correction.

One listing gave the supply as 1,312. The contract and the marketplace both say 638,
so 638 it is — and that makes this by far the smallest collection in the set, against
10,000, 5,212, 2,525 and 2,100 elsewhere. Two sources disagreeing is now routine
enough that the contract simply settles it.

**Card VII was put to the maker as a choice rather than written.** The collection's
own About text reads "AngelusBoB. Master Ai and Digital artist" — so how the art was
made is the project's own description, not an allegation, and no other family in this
set says anything about its method at all. The safe version named only that one
artist made all 638. The chosen version says he calls himself a master of AI. It is
equally sourced and more interesting, and it was the maker's call to make because the
subject is a living artist with an account, and "AI artist" does not land neutrally in
this corner of the world however it was meant.

Two lines kept, both claiming nothing: "Nobody howls on the way up. That is not what
howling is for" and "The pack moves at the speed of its slowest, which is the whole
idea." The other six were invented — a mint at two in the morning, a floor that moved
monthly, eight months of silence.

### Crazzzy Monsters is not defi, and its ticker was neither of its symbols

It moved from meme to defi on 2026-09-08, with a note that the call was uncertain.
Looking it up settles it the other way: CM OG is 10,000 NFTs in twenty families,
Arcane Creatures is 10,000 more drawn from horror and sci-fi, there is an RPG, and
the DeFi layer is in testnet. Under this set's own rule — what it is best known for —
that is `nft`. The same call as CRO Army. Sectors are now meme 11, nft 10, defi 7,
infra 7.

**Ticker `CRZY` to `CRY`**, the seventh correction. On-chain the NFT's symbol is
`CMOG`; the ecosystem token is $CRY. Every other family with a token of its own
carries the token — PACK, MTD, TONIC, FER, OBS — so this one does too.

Three lines kept, all three claiming nothing: the three z's, ten thousand of them
each somebody's favourite, and it ate the thing that was eating everything else.
Removed: "The first holder to complain got a monster named after him", "Both floors
halved in a night", and "Traits nobody drew started showing up in the metadata" —
which does not merely invent, it implies the contract misbehaved.

**And something uncomfortable that is deliberately not on a card.** The project's own
site says it is transitioning from Cronos to ApeChain, with new collections and
products launching there. One of the twelve factions this game started with is
leaving the chain the game is about. It is not on a card because a move in progress
can change, and card VII says only that Spectral runs across three chains, which is
true either way. It is written here because the maker should know, and because if the
move completes, this family needs revisiting.

### Cronos Chimp Club stored its metadata somewhere that lasts

On-chain: `CronosChimp`, symbol `CHIMP`, 10,000. The ticker was right. Minted 9
November 2021, seven trait layers — background, body, clothes, headgear, eyes, mouth,
earrings — with values like silverback, geisha kimono, unicorn suit, cymbal chimp
stare, caveman bone and disco smirk.

**Its metadata is on Arweave, and eighty consecutive files came back.** Set that
against Sloth Gang, whose metadata lives on Ebisu's Bay's CDN, and Reckless Robots,
whose art no longer loads and whose website no longer resolves. Permanent storage is
a real, checkable, permanent difference between this collection and most of the set,
and it is exactly the kind of fact a card can carry forever.

Only one line survived, and it is the only one that claimed nothing: "A club is only
worth anything when there are people in the room" (moved from card V to VI). The
other seven were social history nobody can check — "Half the projects on this chain
started in somebody's chimp chat", "Everybody who is anybody here was in that room in
the first month", "The oldest group chat on the chain and it still moves markets".
Written down, that reads like a record. It is atmosphere.

**The mythic claimed a first, it was flagged as resting on secondary sources, and it
was wrong.** Several aggregators call Chimp Club the first NFT collection on Cronos.
CRO CROW is older: edition #1 was minted at block 946, one hour and twenty-seven
minutes after Cronos launched, a day before Chimp Club's mint on 9 November 2021.

Checking Chimp Club's own account settled it for good — **the project makes no claim
of primacy at all**. Its bio says only "Owning a Cronos Chimp grants commercial rights
and exclusive access to the Cronos Chimp Club." The first belonged to the aggregators,
not to the project, which is exactly what the flag was for.

The mythic is now that line: own one and you own the picture, commercial rights
included. It is what the project leads with, it is the heaviest utility an NFT can
carry, and it cannot go out of date. The other seven cards were untouched.

CRO CROW itself stays out of the set. It was offered as a thirty-sixth family — the
first NFT on this chain, the launcher of CAW, art by Alemf, staked in The Forest for
CAWCAW — and the maker declined. Worth recording that it was a real option and a
deliberate no, so nobody rediscovers it and assumes it was missed.

Card VII links two families on checkable dates: Minted opened in August 2022 and lists
a collection from November 2021.

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

## What CAW777 burns, and why the first answer was wrong by a factor of ten

Its cards said it was "born from the ashes of burned $CAW" because that is what its
bio says, and nobody had asked what was actually burning. The maker did, and the
answer is better than the phrase.

**CAW burns 7.77% of any amount bridged across chains.** It moved its bridge onto
LayerZero's OFT protocol on 21 February 2025, and every hop destroys that share
permanently. The reasoning is in its own announcement: a $3m LP tied to CRO had left
it so correlated that "CAW has mostly become a CRO stablecoin, with the CAW price only
moving when the CRO price moves". Making arbitrage cost 7.77% each way decouples the
other chains — and every arbitrage then burns supply.

**A search said 0.77%. The primary source says 7.77%**, ten times more, and the name
is built on it. One more entry for the pile: a summary is not a source.

On-chain, both halves check out. CAW's supply is 777,777,777,777,777 with
10,623,373,280,241 already at the dead address, about 1.4%. CAW777 has a billion, and
**77,700,000 of them are burned — exactly 7.77%**. It did not borrow the story, it
applied it to itself on the way in.

Three cards were sharpened on that: the billion now comes with the 77.7 million gone,
the bridge rate is stated, and the mythic-adjacent epic says the self-burn matches the
bridge rate exactly. What went was a joke that said nothing — "the one number here
without a seven".

Where the name comes from: in the same announcement CAW replaced its buggy Wormhole
token on Solana with a vanity address beginning `CAW777`, "7.77% more scarce from the
start". The Cronos CAW777 is a separate token named after that.

---

## Single Finance came out

Removed on 2026-09-11 at the maker's request — the second family to leave after Sloth
Gang, and the first to leave with its eight lines already written and checked. The set
goes to 34 families and 352 cards, `defi` down to six.

Its line is gone from `scripts/new-families.ts` as well, with the reason in its place.
That script only writes what is missing, so a family listed there is a family that
comes back the next time anybody runs it.

---

## Cronoscan is Cronos Explorer now

The tool card was named after Cronoscan, the Etherscan-style explorer this chain was
known by. The chain's own explorer took over; `explorer.cronos.org` redirects to
`explorer.cronos.com`. Card renamed, ticker `CRONOSCAN` to `EXPLORER`, and the id
left alone — an id is a key, not a label, and changing it would break nothing usefully.

**And it was not only a card.** `lib/units.ts` held `EXPLORER = "https://cronoscan.com"`,
which is the link under every transaction and address in the burn view. cronoscan.com
still resolves and still serves those paths, which is exactly why this stayed wrong
without anybody noticing: a link that works is not a link that is right. Now
`https://explorer.cronos.com`, where the `/tx/` and `/address/` paths are the same shape.

---

## Two live tokens on this chain are called FFTB

Only one of them is in the set, and the other one is why a person card had to be
corrected within the hour.

| | contract | supply |
|---|---|---|
| Fortune Favours The Brave | `0xd677944d...` | 100,000,000,000 |
| FFTheBozos | `0x8eBB8795...` | 420,000,000 |

**The family is Brave.** Named after Crypto.com's own advert, which is also why it
spells favours the British way. Bozos is a much smaller variant whose own bio reads
"Fortune Favors The Bozos, the real $FFTB" — a dig at the other one, and the reason
to write this down rather than trust a ticker.

DreamQc's bio lists "Founder: @Cr00tsNFT | @FFTBcro", and `@FFTBcro` is **Bozos**.
His card was written the same day the Brave family was, read that handle as the
family sitting two blocks above it, and credited him with the wrong project. Caught
by the maker, not by anything here.

That is the third time in this set a ticker has pointed at two projects: CAW and
CAW777 on Cronos and Ethereum, BALLZ on Cronos and Solana, and now FFTB twice on
Cronos alone. The rule that catches it is the one already written down — read the
contract, not the symbol — and it did not catch this one, because the ticker was
never in doubt. The handle was.

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

**7 archetypes**, nameless, ported from TCG: The Caller · The Copy Target · The
Floor Sweeper · The Whitelist Hunter · The Validator · The Airdrop Farmer · The
Node Runner.

The Mint Bot was an eighth, added here rather than ported — TCG has seventeen
archetypes and no mint bot. It came out on 2026-09-10 along with the tool card The
Gas Tracker, both at the maker's request. They were also the only two cards in the
set that existed in neither TCG's art folder nor anybody's plans to draw, which is
the sort of thing that shows up when you go looking for pictures.

### The people who bought a card

Twenty-one more people went in on 2026-09-12, from the orders — see
docs/the-orders.md. Nineteen became forty, and since every person card pumps a
sector that is the support layer of the game rebuilt at twice the size rather than
twenty-one cards arriving.

It was weighted to fix a skew rather than double it. nft had eleven families and
three aura cards worth 14K between them; infra had seven families and seven auras
worth 119K. The new ones go eight to nft, six to meme, four to defi, two to infra
and one that draws, and each follows what the person wrote about themselves on the
order form. The layer now reads meme 14 families to 11 auras, nft 13 to 11, defi 6
to 7, infra 8 to 9.

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

---

## Pampa pumps two sectors, and what that cost to price

Every sector aura in the set named exactly one sector, which made every person
carrying one a specialist. The maker's note was that Pampa is not: he reads as
somebody who lifts infra and defi rather than memes. There was no way to write
that down, so the aura became a union entry — `pumpSectors` — and the compiler
named the eight switches that had to answer for it.

Two of the places that read an aura are `if` chains rather than switches and the
compiler cannot flag them: `auraSectors` in helpers, which feeds the deck presets
and the sector-coverage test, and `auraBonusOf` in effects. Missing either is a
card that quietly stops counting, which is the failure this codebase exists to
refuse. Both were updated by hand. `render-cards.ts` was a third: its NFT trait
printed a sector only for `pumpSector`, so Pampa's card image would have lost its
aura line without a word.

**What the bonus should be was measured twice and the two answers disagreed.**
The obvious rule is that reach costs something, so two sectors should pay less
per sector than one. The still-life said otherwise: defi+infra at 11K measured
the same as meme at 11K. The reason is that sectors are not the same size — meme
holds 120 projects and nft 112, while infra holds 64 and defi 48 — so Pampa
reaching both small ones covers 112 projects against a meme specialist's 120. He
buys no extra reach and stays in the ordinary epic band, at 12K.

`aura-balance.ts` disagreed and proposed 5K, and it was wrong. It priced an aura
as bonus times presence, and for a pair it summed the two sectors' presence:
3.54 + 3.62 = 7.16 positions. That is a deck built around defi *and* a deck built
around infra at once. A real deck holding both still holds about the same number
of positions, because the portfolio cap is the limit and not the supply of
projects in a sector. Measured properly — one deck, both sectors, played out —
the number is 3.55, the table now proposes 11K, and it agrees with the still-life.

The lesson is the one already in CLAUDE.md: when an outcome cannot possibly be
right, suspect the measurement first. Both the sum and, later, a baseline check
reporting 167 regressions turned out to be the instrument rather than the change.
The baseline had not been re-recorded after the Puush mythic went in, so it was
measuring two changes and had been told about one.
