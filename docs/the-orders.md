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

**Thirty-one of the thirty-seven are in.** They become 80 cards, taking the set
from 352 to 432.

| | | |
|---|---|---|
| 7 project families | 56 cards | eight each, like every other project |
| 22 people | 22 cards | Crofam, Founder, Influencer, Parody, and one Special |
| 1 tool | 1 card | CompoundR |
| 1 event | 1 card | the CRO roast |

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
