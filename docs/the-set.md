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

### In the set — 36 families, 288 cards

| sector | families |
|---|---|
| meme | Clove · FFS · CAW777 · DAK · CAW · Mery · Capybara Nation · Loaf · Ballz · Corgi · Puush |
| nft | Reckless Robots · Howlers · Loaded Lions · Cronos Chimp Club · Ryoshi · Bob's Adventures · Sloth Gang · Boomer Squad |
| defi | Crooks Finance · Wolfswap · Crazzzy Monsters · Tectonic · Ferro · Cronus · Fulcrom · Single Finance · CRO Army |
| infra | Nova · Cr00ts · Obsidian Finance · VVS Finance · Mad Meerkat Finance · Minted · Ebisusbay · CRO |

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

CAW777 had to give up its name to make room. It held both the project key `caw`
and the ticker `CAW`, and one of the new families is a project actually called
CAW; it is `caw777` with `CAW777` on it now, which is its own name either way.

CRO Army has the ticker `ARMY` for the same reason: the chain itself took `CRO`,
and two projects on one ticker is the lesson `validateSet` was written for.

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

### None of the sixteen has flavour or an effect

The line on a project card says something about a real project on this chain, and
nobody writing the file knows what Ballz or Puush or Loaf is known for. The same
rule as the people: sourced or it is not written.

`validateSet` still refuses a card with no flavour. The sixteen are listed by
family name in `AWAITING_FLAVOUR_FAMILIES` in `engine/validation.ts` — by family
rather than by card, because 120 ids would be a wall nobody reads and the point of
the list is that somebody reads it. A sixteenth family still fails.

Effects are the pass after this one. A project with a launch and a pump is not an
empty card: it opens a position and it pays every turn.

### The tickers are the one guess in there

`CAPY`, `FUL`, `BOB`, `EBISUS`, `ARMY` and the rest are the name shortened, not the
project's real ticker looked up. Everything else on these cards is structure;
this states a fact. Worth a pass by somebody who knows.

### The sector spread

meme 11, nft 8, defi 9, infra 8 — thirty-six families and 288 project cards.

It matters because a sector is something you build around in this game. The deck
presets are sector decks, the auras on the people cards pump one sector each, and
a `pumpBySector` card is worth what your board holds of it. Before the merge it
was 9 / 7 / 10 / 4 / 3, so a player leaning infra picked from three families and
one leaning defi from ten. Now the thinnest sector has seven.

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
could never have held. He pumps defi — the thing he built rather than the thing
he bought, and the sector this set has least aura for. Artik has no project at
all and carries the first aura in the set that names no sector: he is here for
knowing what is going on, so he draws.

**5 from the first version**: Pampa · 21Million · Francis · Curry · Vinz. These
shipped under these names and people hold them.

**8 archetypes**, nameless, ported from TCG: The Caller · The Copy Target · The
Floor Sweeper · The Whitelist Hunter · The Validator · The Airdrop Farmer · The
Node Runner · The Mint Bot.

### None of the seven has a flavour line, on purpose

The cards they replace carried invented lines — "Three years of the same avatar
and the same two-line updates" — which was fine above a placeholder and is not
fine above a real name. `CLAUDE.md` has the rule: sourced or it is not written.

`validateSet` refuses a card with no flavour, and that guard is untouched. The
seven are listed by id in `AWAITING_FLAVOUR` in `engine/validation.ts`, so an
eighth card without a line still fails. The list is meant to shrink to nothing.

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
