# The cards people ordered

Thirty-seven custom cards were bought through the first version's website and made
by hand. They were promised again, in this game. `orders/` holds the export —
`orders.json` for the work, `images/` for the artwork people uploaded, and a
README for where it came from. The folder is gitignored: it holds e-mail
addresses and 54 MB of pictures.

**This page is the decision, not the data.** What goes in, what does not, and
what each one becomes. When it disagrees with `data/cards.ts`, the data is right.

---

## What they cost the set

**Thirty-one of the thirty-seven are in, as 79 cards.** The set goes from 352 to
431: 328 project cards, 40 people, 34 tactics, 21 events, 8 tools.

| | | |
|---|---|---|
| 7 project families | 56 cards | eight each, like every other project |
| 21 people | 21 cards | twenty-two orders; Thaxt ordered twice from one account |
| 1 tool | 1 card | CompoundR |
| 1 event | 1 card | the CRO roast, as Manifesting CRO |

**Rarity does not carry over.** Fourteen of the thirty-seven were bought as
Mythical, which is what people buy when they are paying — and mythic is the
rarest tier here, one per family. Fourteen more would have been a 39% increase in
the scarcest thing in the game. The maker released that: the promise was a card in
the game, not a card at a price.

---

## The seven that became families

A project here is eight cards, so a project card only exists as a family. Each of
these was checked for whether it is still alive and still on this chain.

| | why |
|---|---|
| **$BORED Catz Club** | alive on Cronos, a puush.fun graduate |
| **$ELMO** | alive on Cronos, also a puush.fun graduate, same founder as $BORED |
| **GANG GANG** | alive on Cronos, ownership renounced and LP burned |
| **IMPERIUM** | a Roman MMORPG on Cronos with its own token |
| **CroDraw** | a lottery on Cronos run through Witnet, built by Trooprz |
| **Scrap Monster** | scrap metal recycling turned into staking rewards, still posting |
| **Pyro** | below — it is three names deep |

### Pyro was BurnIt, and is now $PYROSTR

The order was for "BurnIt — Play Burn Win". The maker said it is Pyro now. It is
further along than that: on 25 February 2026 the project's own account wrote "We
evolved $PYRO to $PYROSTR", so the lineage is **BurnIt → $PYRO → $PYROSTR**, and
the last step is two weeks old.

Its 7.5% tax splits seven ways, which is most of a family on its own: 1% burned on
every buy and sell, 2.5% into a jackpot pool that pays out on a $10+ trade plus
luck, 1.5% to hold up the value of the Crazy Critters NFTs, 0.5% to the Wolfies
Cache Vault, 1% to liquidity providers, 0.5% to trading contests, 0.5% to the team.

### Six orders are not in the set

| | why |
|---|---|
| Cro Hounds (twice, as Founder and as Project) | the maker's call |
| Trooprz, as a project | the person is ordered separately as a Founder card, and his bio now reads "Retired Crypto Degenerate". CroDraw is his and is in |
| $DUMB Ass | it left Cronos. It trades on Sonic now |
| Cronos Is King $CIK | it exists and that is nearly all: 17 posts |
| Lore | dead. 42 posts, 50 followers, nothing since April 2025, and its bio still says "The story hasn't started yet" |

---

## Three of them already touch the set

**Puush** is a family, and both $BORED and $ELMO graduated from puush.fun.
**Trooprz** is a person card and CroDraw is his project. And **PACK**, Wolfswap's
token, now runs through four families: Wolfswap itself, Crooks Finance paying its
NFT holders in it, For Fox Sake's vault, and Pyro's Wolfies Cache Vault.

None of that was arranged. It is what a chain small enough to fit in one set looks
like once you write down who pays whom.

---

## The people layer more than doubles

Nineteen people become forty-one. Every person card carries an aura that pumps a
sector, so this is not twenty-two cards arriving — it is the support layer of the
game being rebuilt at twice the size.

The intent matrix was measured the day before this started (`npm run intents`) and
it will not survive this unchanged. Measure again once they are in; do not tune
anything on the old numbers.

---

## What it did to the game, measured

Eighty cards is a fifth of the set, so nothing about the balance survived it
unchanged. `npm run intents` before and after, 1200 matches per pairing:

| | before | after |
|---|---|---|
| locks | 58.0% | 54.9% |
| community | 56.7% | 53.7% |
| money | 50.7% | 53.3% |
| momentum | 44.0% | 43.2% |
| takes | 44.7% | 42.1% |
| **spread** | **14.0 points** | **12.8 points** |

The spread closed and the top came down, which is the shape you want. It did not
go in a straight line: momentum fell to 36.4% first, and finding out why produced
the most useful thing in this whole pass.

### Momentum's cards are the biggest and its decks were the worst

A momentum card returns $50.7K of final margin per $10K spent, higher than any
other style. A momentum deck of forty cards held **thirty-three pumps**. Every
other style holds between nought and five of any one thing.

A pump is worth its rate times the turns a position survives, and positions
survive 3.05 turns. The thirty-third pump in a deck is competing with thirty-two
others for the same finite thing — positions times remaining turns. Money does not
have this problem: its deck is 100% one effect and `directMC` pays the same
however many you have played.

So adding three momentum families made momentum **worse**, because more families
meant a purer deck meant more pumps. The fix was not bigger pumps. Every momentum
family now carries three `pumpToMC` cards instead of one — cash out early and
small on card II, mid on IV, late and large on VI. That took a momentum deck from
33 pumps and 4 cash-outs to 25 and 8, and momentum from 36.4% back to 43.2%.

### The aura layer was rebuilt, not just doubled

Nineteen people became forty, and every person card pumps a sector. Before, the
layer sat badly against the families: nft had eleven families and three aura cards
worth 14K between them, while infra had seven families and seven auras worth 119K.

The twenty-one new auras are weighted the other way — eight to nft, six to meme,
four to defi, two to infra, one that draws — and each follows what the person wrote
about themselves. It lands at meme 14 families to 11 auras, nft 13 to 11, defi 6 to
7, infra 8 to 9. Infra is still the richest per family because the auras already
there are large, and those were not touched.

### What is left

**Takes is now the bottom of the table at 42.1%**, where it was 44.7% before. It
has six families and gained one. Nothing has been done about it, deliberately: the
spread is tighter than it was and tuning a second style in the same pass makes it
impossible to say afterwards which change did what.

---

## What is not in the export, and has a deadline

Eleven of the sixty-seven original orders carry `lastMessageAt`, so there were
conversations with those people about their cards. The messages live in a
subcollection that the export could not reach. If anything was agreed in them, it
is only in the old Firebase project, and only until that project is torn down.

## And one thing to close

`firebase.rules` on the old site ends with `allow read: if isSignedIn()`, and the
site signs every visitor in anonymously. So any visitor can read the whole
database, these sixty-seven orders and their e-mail addresses included. That is
how this export was made. It is open for as long as that site is up.
