# Game design — working document

Everything here is either settled or explicitly open. Don't add anything as an
assumption; open questions stay open until the maker answers them.

---

## Settled

**Goal.** Reach the highest market cap by playing cards. MC is the core stat and
the win condition.

**Match length.** Ten turns. Highest MC then wins. A fixed length means a match
runs predictably short and you always know how many turns you have left to catch
up — which is what you want once a stake is attached.

**Drawing.** At the start of your turn you draw up to five cards in hand, from
the top of the deck.

**Playing.** Three actions a turn. No energy, no per-card cost. Balance therefore
has to come entirely from the card text, not from a price. Playing a card,
taking profit and throwing a card away all cost one of the three.

**Throwing a card away.** You may bin a card from your hand. It costs an action
like anything else, and there is no separate limit — spend the whole turn on it
if your hand is that bad, and a card that grants an extra action grants an extra
throw with it. That last part follows from the budget rather than being its own
rule, which is why it is a rule worth having.

The point is the draw, not the card. Since the top-up only refills to the hand
size, a card you hold is a card you do not draw: before this existed hands ended
on 2.71 cards, so the real draw rate was 2.3 a turn rather than 3, a fifth of all
cards sat in hand for three turns or more, and 0.89 actions a turn went unused
because there was nothing worth doing with them. Throwing a card away turns a
dead card into a fresh one and costs nothing on the turns you had a spare action
anyway — which was most of them.

Measured rather than assumed: a bot that throws weak cards away beats one that
never does, 57.5% to 42.5%. Unused actions went from 0.89 a turn to 0.00 and the
p90 age of a card in hand from four turns to three. It also flipped turn order —
see the seed round below, which had to be retuned from $80K to $118K.

Not built: a hand limit. Nothing caps the hand, so a draw effect can push you
past five, and that stays true. Throwing away is a choice you make, never
something the rules make you do.

**MC engine.** Launch plus pump. A card gives MC once when played (the launch)
and then adds its pump to your MC every turn. Playing early buys more pump turns;
playing late gets only the launch hit.

**Realised against unrealised.** Every position tracks what it has produced: its
launch plus every pump it has paid out. That amount is on the line.

- Close the position yourself and you keep it. That is taking profit.
- Let it get rugged and it comes straight off your market cap. You were not out
  in time.

**Taking profit.** You may close one of your own positions on purpose, and it
costs one of your three plays for the turn. That cost is the mechanic: late in a
match you have to choose between putting more on the table and securing what is
already there. Free banking would make the last turn a formality and a rug
harmless.

Market cap therefore means what its name says — the value of what you are
holding, not a running total of everything you ever earned. It also makes an
attack matter: wiping someone's board now moves the scoreboard instead of only
denying future income.

**Turn flow.** Draw → spend up to three actions → pump phase, where every project
on your board adds its pump → turn passes to the opponent.

**Opponent.** A bot ("the market") in the first version. PvP comes later on the
same UI. The previous project ran aground on matchmaking: no opponent, no game. A
mode that works solo is playable from day one.

**Portfolio size.** Six positions. A portfolio that is full does not block a
project — you close a position to open a new one. The MC that position already
made stays; you only give up its future pump.

Without a cap every project card is strictly good, so you always play your most
expensive one and nothing is ever a choice. The cap also gives attack cards
teeth: rugging one of fifteen positions is noise, one of six is a sixth of the
engine.

**Seed round.** The first player starts at $90K market cap.

Alternating turns hand the second player a structural edge: when they pick an
attack target they can already see the project the first player put down this
turn, while the first player is aiming at a board one turn out of date. They
wreck better targets. Measured at about 1% of pump rate a turn, which compounds
into a 45% win rate for the first player. Every alternating-turn card game
compensates for this; here the first player gets a seed round instead. The
figure is tuned with `npm run balance` and needs re-tuning whenever the rules or
the card numbers move: $45K for a 40-card set, $70K at 120 cards, $160K once a
rug started taking market cap back, $130K once taking profit gave you a defence
against that, $105K once decks were built rather than whole-set, and $90K at 149
:  # measurement removed for replay
one seed range and then re-measures the winner on a range the sweep never saw.

**Matchmaking by score.** Every player carries a score and is matched against
players near it. You may accept a challenge from someone far above you, and that
risk is yours to take.

This does more work than it looks like. It is the answer to a collection
advantage, and to something larger: the spread between drawn decks. Sixteen decks
drawn on generous pull rates, played against each other, run from 21% to 74% — the
luckiest pack beats the unluckiest better than three to one, and guaranteeing a
backbone of epics does not narrow it (measured at 53 to 64 points of spread for
backbones of zero to fourteen, which is one band).

That spread is inherent to opening packs, and it is the tension the format is
for. A ladder absorbs it: a bad draw loses, drops, and meets other bad draws; a
good one climbs until it meets its equals. What the pull rates decide is how long
that takes and where a player settles, not whether the game is fair.

**Everything has an answer.** Full contact means the row beside your portfolio
too. Until Cancelled, Mass Unfollow and The Purge there was nothing in the set
that could touch an influencer or a tool — you could wipe someone's entire
portfolio and their Murad would still be there, pumping the next six memes they
played. The type system could not even express an attack on one, because every
attack targets a project.

Cancelling takes the biggest aura first and needs no target chosen. That is both
the obvious play and the one that reads: "cancels their biggest name" needs no
pointing at anything. It is not a rug — the portfolio is untouched.

**A damaged position pays less.** A project pumps in proportion to the holders it
has left: at two of four it pays half, and healing back to four restores it.

Settled after measuring, because attacking did not work and the reason was not
what it looked like. An attack cost 26% more margin per dollar than building and
took seven cards to remove one position. The damage was landing — 5.84 net
holders a match — it just never finished anything: eleven of the eighteen cards
that strip holders hit the whole enemy board for one, and six positions chipped
by one each are six positions still paying in full. 63.6% of every position that
died was killed outright by a table-wide event rather than by damage adding up,
and Rug Pull, whose entire text is removing a project, accounted for 8.7%.

So damage counts on the way to a kill instead of only at the end of one. It adds
no number to any card and no field to the state: holders already meant "how much
this survives" and now also mean "how much of it is left". After it, an attack
returns $24.3K per $10K against $25.4K for everything else — near enough level,
which is where it belongs. An attack should not beat building; it should not be
a 26% tax either.

**Interaction.** Full contact. Attack tactics hit a chosen project on the
opponent's board: rug, snipe, FUD, whale dump. Drop a project's holders to zero
and it rugs — off the board, and its pump stops permanently.

**Card types.**

- **Project** — takes a position in your portfolio. Launch MC, pump MC, holders,
  and a sector.
- **Tactic** — one-off, discarded after playing. Something you did; it can be
  aimed at one side.
- **Event** — one-off, and it hits the whole table: every project on both boards,
  or both players. Something that happened to the market rather than something
  you did. Validation enforces the table-wide target, so the type means something
  instead of being flavour on a tactic.
- **Influencer** — stays on your board, gives an aura over a sector.

A percentage swing is not symmetric even when it lands on both players: a bull
run widens whoever is ahead, a crash narrows it. That is what makes an event a
decision rather than a wash. A flat amount on both players is rejected outright,
because it cannot change who wins.

**Cards.** Solana-related and recognisable. Two groups named:

- projects that made a name: PNUT, pump.fun, TRUMP and many others
- cards about trading in the trenches

**Rarity.** Five tiers: common, rare, epic, legendary, mythic.

**Deck.** 40 cards from the set, one copy of each, inside a budget of 95 points.
A card costs 1 at common, 2 rare, 3 epic, 5 legendary, 8 mythic.

Without a budget everyone plays the 46 cards of epic or better and three quarters
of the set never gets seen. Building the set's own mix at this size costs 101, so
95 bites.

Be clear about what it does and does not do, because it was measured with
`npm run archetypes`. **The budget is a power cap, not a trade-off.** A deck of the
most expensive cards beats a mid-tier one at every budget tested from 50 to 140 —
66% at the current 95, rising to 91% at 140 — and a deck of cheap cards loses
essentially always. The portfolio holds six positions, so a match is decided by
your best few cards and quantity is structurally worthless. Nobody is going to
choose breadth.

So the budget earns its place by stopping the runaway, not by creating a decision.
The number itself is picked rather than derived: 95 is simply under the set's own
mix. If the aim is for rarity to become a real choice, the budget is the wrong
lever — that would take changing the portfolio cap or the power curve of cheap
cards.

The choice that does exist is composition. Six projects in a deck wins 21% against
a ten-project deck, and eighteen wins 71%. That is a slope rather than a decision:
a deck wants as many projects as it can carry, because only a project can hold a
position and only a position pumps. Hence the floor of twelve, so nobody builds an
unplayable deck by accident.

**Holding TCG never changes the deck budget.** Everyone builds inside the same 95
points. Scaling the budget with someone's holdings was considered and measured
first: a deck on 110 points beats one on 80 in 86% of matches, and even 90 against
80 wins 64%. In a game people bet TCG or SOL on, that is not selling a stronger
deck, it is selling the result of the bet. Keeping it under 55% would need a band
about two points wide, which is not a feature.

Matchmaking by budget tier would fix the fairness on paper and split the player
pool, and a split pool is what the previous project actually died of.

So holding buys economics and access: a smaller burn cut on a staked match, entry
to higher tables and tournaments, new sets earlier. The tiers live in
`data/holder-tiers.ts`. The thresholds and percentages are placeholders until the
token exists and there is a real burn to divide.

40 is chosen against the draw: you take a median of 31 cards in a match and 40 at
the extreme, so you see nearly all of your deck. What you build is what you get,
which is the strongest lever there is against draw variance — the median gap
between the two players fell from 32% to 28% when decks came in. It has since
fallen further, to 19% median and 45% at the ninetieth percentile, against 83% at
the ninetieth when decks arrived. Throwing a card away and the aura repricing both
tightened it; neither was aimed at variance.

Still open, and separate from the token: whether owning a card as an NFT is
required to put it in a deck. That is the ordinary trading-card model and it is
its own pay-to-win question — one about the collection rather than the wallet
balance. It should be answered before the mint, not after.

**Set.** 174 cards: 91 projects, 12 tools, 32 tactics, 19 events, 20 influencers.
Spread across the tiers: 54 / 55 / 40 / 20 / 5.

**Four cards are moments rather than tokens.** Graduation is the bonding curve
filling and the token moving to Raydium; CEX Listing is the announcement everyone
front-ran; The Bottom is Solana at eight dollars in December 2022 and a dog token
nobody asked for; Nation State Meta is the week a president posted a contract
address and another one followed. They use effects the set already had — the
thirty tactics cover the mechanics fairly completely — so what these add is
occasion, not a new rule. Graduation did fill a real gap in the ladder, which had
no epic pump aimed at a single project.

Projects are the largest group on purpose. They are what the game is about — a
position you take and then have to defend — and the deck rules put a floor of
twelve of them under every deck, so the set has to offer enough of them to
choose between rather than enough to fill a quota.

Eight sectors: meme (41), nft (11), defi (11), ai (7), infra (6), politics (6),
DePIN (5), gaming (4).

**Every project used to be worth more the earlier you played it.** They all ran
between 1.2 and 2.6 times as much launch as pump, so the whole set rewarded
getting a position down and letting it run. That is only half of what happens
down there; the other half spikes and dies. HAWK and JENNER are that half —
around twenty times launch to pump, one holder, no second act.

Measured rather than assumed, that makes them a card worth roughly the same
whenever it is played, which nothing else in the set is. So the turn you play one
is decided by risk instead of tempo: one holder with the whole launch still
unrealised means an early HAWK is a rug waiting to happen, while a last-turn HAWK
cannot be touched. The bot does not model that and plays them on turn 5.5, about
when it plays any other epic.

**There is no dog sector.** There were four dog projects — BONK, WIF, MYRO,
SAMO — and three cards whose aura pointed at them, which is what forced Cented to
23K and BonkBot to 35K where a meme aura sat at 5K. Working CoinGecko's Solana
meme list settled whether a fifth existed: every other dog on it is between one
and ten million, against BONK at two hundred. There is no fifth. Dogs are memes
now, and the three auras follow them at 4K, 5K and 8K.

Two dogs on that list were left out on purpose. DOG (Bitcoin Runes) and Baby Doge
Coin (BNB Chain) appear in a category that means "has a Solana contract", not "is
a Solana project" — the same category error as a tool that produced market cap,
running the other way.

That cost Elon Posts its second tier: it pumped memes and dog memes harder, and
the distinction no longer exists. It pumps memes, which now includes BONK and
WIF, so the card still does what it was for. Every one of them has an influencer aura behind
it except gaming, and a test enforces both halves of that — a sector with
projects and no aura is legal to the validator and invisible to the eye, which is
how DePIN, gaming and politics all ended up without one in the first place.

**Gaming has no influencer, on purpose.** Every other influencer is named as the
person is actually known: Toly, Ansem, Mert, Alon. Solana gaming has no such
face, and a name invented to fill the slot would be the only card in that block
that did not belong. The sector keeps its four projects and no support. The test
carries that decision in writing, and still fails loudly for any other sector —
including gaming, if an aura for it ever turns up without the list being updated.

**A named influencer has to be verifiable, and four were not.** The rule now: if
a card carries a real person's name, that person must be findable — an account,
a role, a company. Anything else is an archetype with a definite article, the way
The Insider and The Floor Sweeper already are.

It went wrong because the instruction was "more people as influencers or known
Solana names" and the reply filled the list without marking which names were
looked up and which were invented. Checking all 25 afterwards: 17 verify — Toly,
Raj, Alon, Armani, Frank, Mert, Amir, Shaw, Meow, Ansem, Murad, Threadguy,
Cupsey, Orangie, Gake, Waddles, Euris. Four had no trace at all and became
archetypes:

  Absol            -> The Whitelist Hunter   nft, common
  Kadenox          -> The Rotation Caller    ai, epic
  Gorilla Capital  -> The Copy Target        meme, rare
  Cooker           -> The Caller             meme, rare

Auras, rarities and sectors are untouched, so the balance is exactly what it was
— only the claim about a person is gone. Four more are unresolved and left alone
until the maker rules on them: Cented, Pauly, Mitch and Bonk Guy circulate in
trader talk but did not confirm in a search.

Absol brought a second problem with it. The art filed under that name was the
Pokemon, which is where the invented name came from — and a Nintendo character on
a card intended to be minted is a different kind of risk from a wrong name. The
file is out of public/art and kept in the recovery folder rather than deleted.

**The politics aura is an archetype, not a person.** "The Insider" — *knew about
the launch the night before, and posted nothing at all*. The sector is TRUMP,
MELANIA, LIBRA, BODEN, TREMP and Jailstool, so the honest influencer for it would
be a living politician, and putting one on a card that pumps their own token is a
question about the project rather than about balance. Settled: it stays an
archetype.

**A tool is not a position.** DexScreener, Photon, Phantom, Birdeye, BullX,
Helius, Saga, BonkBot, Trojan, GMGN, Moonshot and Backpack were project cards,
which meant each produced market cap and took one of your six portfolio slots.
Neither is something they can do: DexScreener has no token, and you cannot hold a
position in a wallet. Twelve of the fourteen infra cards were in this state.

They are their own type now. A tool sits beside your portfolio, does something
the moment you play it, and some keep working after that — which is what a tool
is. DexScreener buys the DEX update investors wait for, the terminals let you act
faster, Birdeye and BullX show you more, Moonshot brings holders in, Helius keeps
everything talking. A rug cannot touch one, because there is nothing to rug.

That emptied the infra sector down to SOL and pump.fun, and three influencer
auras point at it — Mert, Toly and Raj, two of them legendary. So Metaplex and
Wormhole were added, and Jito and Pyth moved across from DeFi: a block engine and
an oracle are infrastructure rather than applications. Infra now holds six
projects.

It is still a smaller sector than it was, and the two legendary auras lost value
with it: Toly at +25K over a sector held 2.66 times a turn in a focused deck is
worth about 66K a turn, less than Ansem at epic. That belongs with the aura
imbalance already recorded as open below, and it got worse here rather than
better.

**Elon is an event, not an influencer.** An aura buffs one sector every turn from
your own board; the point of this card is that it moves the market from outside
it. "Elon Posts" hits every project on the table — both boards — pumping memes
$20K and dog memes $35K. That it lifts the opponent's memes too is the decision:
you play it when you are meme-heavy and they are not, the same way the existing
percentage events reward whoever is already ahead.

It needed a new effect variant, `pumpBySector`, because nothing in the effect
system could read a project's sector — only the aura could, and an aura is a
standing bonus rather than a one-off. Deliberately not named `pumpSector`: that
name already belongs to the aura, and one name meaning two things is precisely
what left cards dead in Cards of Cronos.

It is also the only event named after a real person, so it sits outside the
influencer block that exists to keep such names in one place. Flagged in a
comment on the card rather than left to be discovered.

**Aura strength is set against sector size, not rarity.** An aura pays its bonus
once per project of its sector that you hold, and the sectors are not the same
size, so the same 10K on meme and on dog are not the same card.
:  # measurement removed for replay
at, measured in a deck built around that sector — because that is who an aura
card is for.

All twenty-two auras were repriced against that measurement. They had been set by
rarity alone, and within a single rarity they were worth between 4.5 and 9.7 times
each other: Cented (rare, dog) was worth a fifth of Waddles (rare, meme), and
BonkBot's dog aura was worth a tenth of Ansem's. After the pass each rarity holds
together within 1.0x to 1.5x.

A card that also carries a one-off effect has part of its rarity paid for by the
effect, so its aura is priced at three quarters — otherwise BonkBot, which already
grants an extra action, came out wanting a 47K aura.

The median has to be taken on that same scale, not on the raw values. Three of
the four legendary aura cards carry effects, so their smaller auras dragged the
legendary median down onto epic's and a five-point card would have bought the
same aura as a three-point one. Dividing the discount out before taking the
median fixes it without a rule being imposed: legendary comes out at 71.5K
against epic's 52.0K. It also fixed Murad, whose "correction" as the only mythic
had been a nerf derived from a group of one.

**Burn.** Every match played burns token.

**Feel.** The trenches should feel at home here. Visually: near-black, monospace,
green and red like a chart. No neon gradient — everyone does that.

**Card artwork.** Generated procedurally from the card id: a candle pattern in the
rarity's colour with the ticker large in frame. Zero files in the repo. Real art
replaces this later per card via a single field. In the previous project the art
was 734 MB and that became a problem.

---

## Open

### Attack phase
All aggression currently runs through tactic cards. There is deliberately no
separate phase in which projects attack each other, the way Yu-Gi-Oh or
Hearthstone do it. That saves a whole combat system and fits three cards a turn —
but it is a choice that can come back once the game has been played.

### Opponent
- Does it stay at bot and PvP, or does a tournament format arrive?
- What the score actually is: wins, market cap, something that decays.

**Matchmaking.** Settled by the maker.

A player creates a match on the site and makes three choices: friendly or
staked, live or correspondence, and — when staked — one of five fixed amounts,
0.1, 0.5, 1, 5 or 10 SOL. Both sides of a match have made the same three
choices, which is what makes matching tractable: three discrete dimensions
rather than a negotiation.

  live             one minute a turn
  correspondence   twenty-four hours a turn

The word is correspondence, as in correspondence chess. It is an existing term
and it reads next to "live" without either needing explaining.

**When the clock runs out the turn ends, not the match.** At one minute,
forfeiting would mean a bad connection costs a stake, and ending the turn is
punishment enough on its own — the whole budget for that turn is lost and the
waste rule charges for it. No anti-stalling rule is needed and one was proposed
and dropped: a player who never acts plays no cards, earns nothing and loses.
Stalling in this game costs the staller the match, so it defends itself.

**Limits: five correspondence matches at once, and one live.** Never more than
one live at a time. That is what makes it a game you can carry on a phone rather
than one you have to sit down for.

**A created match sits in a lobby**, showing its three choices, and expires after
an hour if nobody joins and the creator has not cancelled it. Players browsing
the lobby pick a match to join. With auto-matchmaking on, two players who made
the same three choices and whose scores are close are paired without either of
them browsing.

The lobby and the auto-match are both there on purpose. A lobby works at a
population of two; an auto-match scales. Building only the second is what makes
a game feel empty on the day it launches, which is the failure the previous
project did not come back from.

**You may reject a challenger far above your score. You may not reject an equal
one.** That is the answer to a lobby's one real weakness: an open list lets a
strong player wait for a weak one to post a stake and pick them off. Rejecting
upward stops the shark; not being able to reject sideways stops a player farming
only opponents they are sure of.

**The score.** Two numbers. `rank` is an Elo, and `record` — wins, losses,
streak — is cosmetic and comes from every match including friendly ones.

The attack on a score with money behind it runs downward, not upward. Nobody
inflates a rating, because a higher rating buys harder opponents. What pays is
**sandbagging**: lose on purpose until the rank is low, then take a 10 SOL match
against somebody who genuinely belongs there. The two players look equal, so the
reject rule does not protect the honest one. Everything below is arranged
against that.

- **Friendly matches never move the rank.** Dropping has to cost stakes rather
  than an afternoon.
- **The rank itself is a plain symmetric Elo.** Rising and falling move it
  equally. An earlier proposal matched on a player's *peak* rank, which killed
  sandbagging by making a fall impossible — and a player who is genuinely worse
  now than they were a year ago should meet people at the level they are at.
  That proposal was wrong: the thing to make expensive is dropping fast, not
  dropping.
- **Matchmaking uses a lagging rank: the mean over the last twenty staked
  matches.** Throw five and a quarter of the fall registers. Decline honestly
  over thirty and all of it does. Falling is free when it is real and slow when
  it is chosen, which is the whole distinction — a sandbagger wants to be down
  by tonight and a declining player has been sliding for a season.
- **The stake is the weight.** A 10 SOL match moves the rank more than a 0.1 SOL
  one, so falling far enough to matter has to be paid for at the size you are
  hoping to win at. Compressed rather than linear: at a hundred to one a single
  expensive match would overwrite a whole history.
- **The burn is a defence, which is luck rather than design but it works.** Every
  staked match burns, so an alt feeding a rating leaks value on every cycle.
  Washing a rating is not free even between two wallets you own.
- **A new account cannot enter the top tiers.** Ten staked matches first. An
  unproven rank does not belong in a 10 SOL seat.

Starting numbers, to be tuned against real matches rather than simulated ones:

      rank at first login    1000
      equal band             ±100 on the lagging rank
      lagging window         20 staked matches
      stake weight           0.1 SOL x0.4, 1 SOL x1, 5 SOL x1.6, 10 SOL x2
      top tiers open after   10 staked matches

That window of twenty is the only knob that really matters. Too short and
sandbagging is cheap again; too long and a player improving over months keeps
meeting the level they have left. It is a starting value and not a measurement,
and it is one of the few things here that cannot be settled by simulation —
it needs players.

**One thing to hold on to, because it undercuts the ladder as a ladder.** Decks
drawn from packs run from 21% to 74% against each other, measured. So a rank
here is *deck plus player* rather than player, which is exactly right for
matchmaking and a poor basis for anything that reads as merit. Somebody climbing
may have minted better rather than played better. Fine for pairing people, worth
remembering before prizes hang off it.

**The rank is public, and it is the lagging one that is shown.** Not a trade-off
but a requirement of the reject rule: you cannot refuse a challenger for being
far above you if you cannot see how far above you they are. Visible rank, plus
no refusing an equal, plus refusing anyone above, means nobody can be pushed into
a match against somebody of a different size.

Which one is shown matters. Matchmaking and the reject band both run on the
lagging rank — the mean of the last twenty staked matches — so that is the number
on the profile. Showing the raw Elo instead would put a number on screen that
none of the rules use, and a player deciding whether a challenger is inside the
band would be reading the wrong one.

The sharking this makes possible is real and is bounded by the same rule: a
strong player can see exactly who is weak and at what stake, and can only act on
it inside a hundred points, where the two of them are equal anyway.
- **Liveness for live listings.** An hour of expiry handles abandonment slowly;
  a live listing needs it immediately. Nobody waits an hour in a lobby, so
  without a connected-or-not signal the live list fills with matches whose
  creator closed the tab forty minutes ago — and a lobby that looks busier than
  it is is worse than one that looks empty.
- **Whether a stake is escrowed when the match is created or when it is joined.**
  An hour with the money locked and no opponent is a different product from an
  hour with a promise on a list.
- **Correspondence has no floor on how long a match can take.** Twenty-four
  hours a turn over twenty turns is ten days, and a player who lets every clock
  run out drags it out that far while losing. Self-defeating, and still worth a
  rule eventually.

**PvP, what is built and what is not.** The engine half is done and it is the
half that cannot be retrofitted safely.

`viewFor(state, player)` is what a client is sent. Deliberately not a State and
not shaped like one: a redacted State that still typechecks is a thing somebody
eventually passes to applyMove, where an empty deck and a seed of zero are not
an error but a quiet wrong answer. It hides the opponent's hand, both decks, and
the seed — the seed most of all, because both shuffles are recomputable from it,
so one number is every card in the match in order.

`applyMoveAs(state, player, move, index)` refuses a move from the player whose
turn it is not. applyMove takes the mover from state.toMove and never asks who
sent the request, which is right for the bot, the tests and a replay, and wrong
for anything holding a socket.

Still open, and all of it a decision rather than code: transport, where the
server runs, how a match is stored, what identifies a player, and what happens
when somebody closes the tab mid-match. Matchmaking is the one to be careful
with — the last project ran aground on exactly that, and a mode that works solo
from day one is the hedge.

One thing found while building it that is worth keeping: the first redaction
hid the opponent's side and handed the player their own deck in draw order.
The obvious half of a redaction is the opponent. The half that ships broken is
your own.

### What a new player starts with

Settled by the maker: this is a trading card game, so you buy packs and hope.
Nobody hand-picks a starter deck — the rules say what it must contain (forty
cards, at least twelve projects) and the rest is drawn, with rare cards rare.
That is not the thing that was rejected earlier; buying a bigger deck budget with
a token balance is buying power directly, and collecting is not.

:  # measurement removed for replay
against the themed decks the bot builds:

  pull rates c/r/e/l/m            average card   win rate
  70 / 22 / 6 / 1.5 / 0.5              31K         10.7%
  55 / 30 / 12 / 2.5 / 0.5             37K         19.4%
  40 / 32 / 20 / 6 / 2                 52K         34.3%
  hand-built starter deck              61K         51.9%

**So the pull rates are a difficulty setting, not a mint setting.** A pack-like
distribution leaves a new player at 19%, and there is no cost rule that fixes it.

That last part was tested rather than assumed. The obvious explanation was the
charge on unspent budget — a deck of commons cannot spend a late-game budget, so
it pays every turn for something it cannot avoid. Two softenings were built:
scaling the charge by how cheap the deck is (the maker's proposal) moved 19.1% to
21.6%, and charging only for budget the hand could have absorbed moved it to
17.2% while handing an all-expensive deck 31% against 23.6%. Removing the charge
altogether leaves it at 17.5%. The charge was never what was holding it back — a
deck of commons loses because commons are worse cards.

A guaranteed backbone was measured too — the same kind of rule as the
twelve-project floor, but "at least N cards of epic or better", on top of the
generous rates. `npx tsx scripts/starter-backbone.ts`:

  epic-or-better guaranteed   against a collection
   0                                  39.3%
   6                                  39.8%
  10                                  42.3%
  14                                  44.6%

Ten is what shipped: it puts a new player at 42% against a full collection, which
is a match you can win, without guaranteeing so much of the deck that the pack
stops mattering. Fourteen buys two more points and starts to be a deck somebody
else built for you.

`engine/pack.ts` is the rule. Forty cards, twelve projects, ten of epic or
better, drawn on 40/32/20/6/2 — and measured at 43.3% against a collection once
built, against the 42.3% the recommendation was based on. Packs come out with
about sixteen big cards rather than the ten guaranteed, because the project floor
and the fill are drawn on the same weights and pull their own epics in.

The rest is matchmaking, which is settled above. Two new players meeting each
other is 50/50 by construction; meeting a collection is a challenge you choose to
accept.

`scripts/collection-size.ts` measures the other half: what owning more is worth,
if owning becomes a requirement to deck a card.

### Ordinary packs

Built, and deliberately a different product from the starter. Eight cards on
62/25/10/2.5/0.5, with one slot guaranteed rare or better and nothing you already
own — a duplicate is not a card, it is a disappointment. A mythic works out at
roughly one pack in twenty-five, which is rare enough to be worth telling
somebody about, and the tests hold that floor rather than trusting the weights to
stay where they are.

Both kinds go through the same ceremony; the difference is the wording and the
odds, not the reveal.

Two things are deliberately missing and both are said out loud on /mint: a pack
costs nothing, because there is no token to charge in, and the collection lives
in this browser, because there is nothing on-chain to hang it on.

### May you only deck cards you own?

**Settled by the maker: yes**, and it stands whether or not the mint is running.
`DECK_FROM_COLLECTION` in `lib/collection.ts` is the whole decision. Without it a
pack is a screensaver and renting cards out later would be renting nothing.

**A wallet, not a browser.** Settled by the maker: only a wallet holding cards
can build a deck. A collection and a saved deck are both keyed by address, so the
same wallet on a laptop and a phone is one collection, two wallets on one machine
are two, and clearing a browser loses nothing that was ever really yours. Signed
out you hold nothing — not an empty collection, no collection.

The consequence is deliberate: with the mint shut, the public cannot build a deck
and therefore cannot play with cards of their own. Before launch there is nothing
for a stranger to own, and a deck builder that hands them the whole set is not
generosity — it is a rehearsal of a game that will not work that way.

**The demo match** is the answer to the other half of that. Settled by the maker:
a visitor with no wallet can borrow a deck and play a full match against the bot
— same engine, same ten turns — and keep nothing. `lib/demo.ts` hands over one of
the measured preset themes rather than a deck written out by hand, which would go
stale the moment the set changed and never say so.

Three things it must never become. It writes nothing, so no collection and no
deck exist at the end of it. It says what it is on the table itself and again on
the result, because a free deck that looks like cards you own is exactly the
confusion the mint page spends three paragraphs avoiding. And signing in ends it
rather than carrying it: a signed-in player on a borrowed deck would be playing
cards they do not hold, which is the thing the wallet exists to prevent.

It is not limited to one match. A hard limit is bypassed by clearing a browser,
so it would only ever be enforced against the honest.

**The lessons are questions asked of the state, not a script.** `lib/tutorial.ts`
holds one panel's worth of text per rule, each with a `when` that reads the board.
The first that is true and has not been waved away is the one showing. A scripted
tour has to assume what happens next — play a project, now attack — and this is a
real match against a real bot, so the moment the player does something else the
tour is explaining a board that is not on screen.

It also means a lesson cannot arrive before it means anything: nobody hears about
the six-position cap until they have six, or about upgrades until one is in their
hand. Situational lessons are ordered ahead of the basics so they can interrupt.
The tests check the timing rather than the wording, because a panel that fires
early teaches the player that it is noise.

It was briefly derived from `MINT_OPEN` for exactly the opposite reason. That is
recorded here because the argument was sound and lost anyway: keeping the site
playable pre-launch is worth less than never showing anyone a version of the
rules that is not the rules.

The rule lives in `deckProblems`, not in the deck builder. Dimming a card is a
hint; the rule is that `saveDeck` and `loadDeck` both refuse a deck holding cards
this player never opened, by name. In Cards of Cronos the card check was a UI
filter and a direct call could play anything, which is the whole reason it is
here and not on the screen.

`npx tsx scripts/collection-packs.ts`, against the bot's themed decks built from
the whole set. Each player picks their deck on 24 matches and is scored on 80
they never saw, so the number is the deck they settled on rather than the luckiest
one they tried:

  packs   owned   decks to choose from   avg card   win rate
      0      40                      1        67K      37.6%
      1      48                      9        63K      44.9%
      2      56                      9        60K      48.2%
      4      72                      9        57K      47.9%
      8     104                      9        53K      52.4%
     12     136                      9        54K      53.8%
     17     176                      9        56K      62.9%

**Two things in that table matter more than the rest.**

The first row is not a deck builder. Forty cards owned and forty cards in a deck
is exactly one legal deck, so a player who has opened nothing has no choice to
make — the deck page is a card viewer until the first ordinary pack. The jump to
row two is the biggest in the table and most of it is simply the arrival of
choice, not of better cards.

The last row is twenty-five points above the first. Those rows each measure a
collection against a third party, though, which answers "how good is this deck"
rather than the question anybody actually asks about a game with money in it. So
the two of them were put in front of each other, 40 pairs and 3199 decided
matches, band ±1.7%:

  a player with only their starter pack   26.9%
  a player who owns the set               73.1%

**That is the number this decision has to live with.** For comparison, the deck
points budget was thrown out when a deck built on 110 points beat one on 80 in
86% of matches. This is milder, and it is bought with packs rather than with a
token balance, and packs are the same packs for everybody — but 73/27 is the same
category of thing, and it cannot be described as a game decided by how you play.

What holds it is matchmaking by score, which is settled above: two new players
meet each other at 50/50, and the ladder is what keeps a starter pack away from a
full collection.

**Built and then taken out again.** A warning screen was put in front of a match
when the player's collection was far behind, quoting these odds. The maker's
answer: what a player needs to weigh before accepting a battle is **the other
player's score**, not their collection size. Nobody cares what is in somebody
else's binder.

That is right, and it is why the screen is gone rather than reworded — it was
answering a question nobody asked. The warning comes back when there is a score
to warn about, and the score is still open (see above). The numbers stay recorded
here because they are true about the game either way.

One correction went into that table. The measurement has 56 cards at 48.2% and 72
at 47.9%, and that fall cannot be real — 0.3% inside a ±1.7% band on a quantity
known not to decrease. The raw rows stay as measured and the read path takes a
running maximum, so what was seen and what is shown stay separately visible.

An honest open question sits underneath: whether the ladder is enough, or whether
staked matches need a format where the collection gap is bounded — a fixed pool,
a draft, or a cap on how far apart two collections may be. Nothing here answers
that, and it should be answered before there is money on a match rather than
after.

Getting that table took three attempts and the first two were both wrong in the
same way. One reported that owning 136 cards was nine points *worse* than owning
forty; the next lost three points between two packs and four. A collection only
grows, so a deck you could build before you can still build now, and a fall is
impossible — that is what made both of them findings about my candidate generator
rather than about the game. Packs are 62% common, so a bigger collection is mostly
a bigger pile of commons, and a builder that fills forty slots without caring what
it takes drifts down the curve as the pool grows (average card 67K to 52K). The
fix was to vary candidates along the curve as well as the theme, and to keep the
starter forty on the table always, which makes the series monotone by
construction rather than by hope.

`scripts/collection-size.ts` is the older, blunter version of this question: a
collection drawn uniformly out of the set, which is not what a collection is any
more. Kept because its opponent is identical, so the two read together.

### A project is several cards

Settled by the maker: BONK is not one card, it is eight — the airdrop, the burns,
the phone, the Coinbase listing, the billion. Each is a moment, with its own cost
and its own effect, from a $20K common to a $280K mythic.

This started as a way to grow the set without reaching for projects nobody has
heard of, which was a real failure: sixty cards went in built on FIDA, SRM, MNGO,
SBR, TULIP and COPE, and the maker did not recognise a single one. That is 2021
Solana DeFi, not the trenches, and "recognisable" was asserted rather than
checked.

What it turned out to fix is bigger. BONK was one legendary at $200K, so the
best-known token on the chain was unplayable before turn six. Rarity was deciding
which projects a new player was allowed to have. Now rarity says how big a card
is, and every project can reach across the whole budget curve.

`ProjectCard.project` is what makes it work: without it nothing can know two
cards are the same BONK.

**The project is the headline, the moment is the subtitle.** The first pass named
the cards outright — "The Pink Hat", "Korea Woke Up", "Top Dog" — and the maker
asked how a player is supposed to see at a glance that those are one project. He
was right: that was a naming convention, and conventions drift. So `name` is the
project and carries it on every card of the family (WIF, BONK, POPCAT, PNUT), and
`moment` is what this particular card is. The card shows one under the other, the
art already carries the ticker as a watermark, and eight cards read as eight
cards of one thing without anybody having to know the lore.

Validation holds it: every card of a project shares a name, a project either
names a moment on all its cards or on none, and no two cards end up with the same
name-and-moment. `cardLabel()` is the single place that writes a card out, so a
log line says which BONK was played.

**Each family plays differently, or eight cards is just eight prices.** BONK is a
community — draws, heals, the sector moving together. WIF is money and attention
arriving — extra budget, a listing pop, a percentage on the market cap. POPCAT is
momentum — most of its cards raise what the whole board pumps, so it wants to be
early and wants the game to run long. PNUT takes — damage to the other board and
market cap siphoned off, because that is what the story was.

Writing PNUT turned up a rule worth recording: a project card may not carry an
effect that points at a single project, because that choice is already spoken for
by which position you close when your portfolio is full. Validation refused the
targeted rug and said so.

**One position per project.** Six BONKs is not a portfolio, and every aura and
sector effect would point at the same token six times over. It lives in `whyNot`,
which `applyMove` calls itself, so the bot and the screen inherit it instead of
each keeping a copy.

**No cap on how many a deck holds — and there was one, briefly.** A limit of
three per project went in on an argument: that otherwise the best deck is every
BONK. The maker asked why anyone should be stopped, and the argument had two
holes. The precedent was backwards — Pokémon and Magic cap copies of the same
*card*, not of the same character, so a Pokémon deck may run as many different
Charizards as it likes. And the position rule already charges for stacking.

:  # measurement removed for replay

  bonk cards in deck   win rate
                   1      57.3%
                   2      52.5%
                   3      43.6%
                   5      30.9%
                   8      12.8%

Every card past the first sits dead in hand while another holds the position. The
cap would have forbidden decks at 30.9% and 12.8% while permitting one at 43.6%,
which is to say it forbade nothing worth forbidding and deleted a choice for
free. It is gone.

The deck *generator* still stops at two, which is a different thing: presets, bot
opponents and starter packs all come out of it, and a generator that hands
somebody a 12.8% deck is not offering a choice, it is making a mistake for them.

**A bigger card takes over the position — evolution.** The maker asked whether
sacrificing the weaker BONK for a bigger one should pay, and whether that was
overcomplicating things. It is the opposite of complicated: the rule went from
"you may not play a second BONK, close the first" to "play a bigger BONK and it
takes over", which is one sentence and forbids nothing. It is also Pokémon
evolution, the most familiar mechanic in the most familiar card game there is.

The new card inherits everything the old position was pumping — its own rate plus
anything added to it — and what the old one already earned stays in your market
cap. It costs one action rather than two. Closing the position and replaying is
still there and still costs two; that route *banks* the position, and a banked
position cannot be rugged, so the two are different plays rather than one being
strictly better.

Strictly upward, by what a card costs to play. Sideways is not an upgrade — two
commons of one project are alternatives, not a ladder — and downward would let
you play the mythic, "upgrade" to the common and keep the pump for a fifth of the
budget.

What it did to stacking, same script, same 4000 matches a row:

  bonk cards   before   after
           1    57.3%   56.4%
           2    52.5%   49.8%
           3    43.6%   45.0%
           5    30.9%   37.0%
           8    12.8%   41.5%

The deep end came up nearly thirty points and the curve still slopes down. That
is the shape to want: stacking a project went from unplayable to a real deck that
is still not the best one, which is what a choice looks like. Had the row gone
flat or turned upward, every deck would have become three projects deep and the
variety would have drained out the other side.

One oddity worth keeping an eye on: two BONKs got slightly *worse* (52.5% to
49.8%). Drawing the big one first leaves the small one with nowhere to go, and
with only two in the deck that happens half the time. Deep stacks draw in
ascending order often enough to profit; shallow ones do not.

### The starter pack is themed

A pack used to be forty cards drawn flat, and that stopped working as the set
grew. The gap between a drawn pack and a hand-built forty widens with every card
added, because synergy is what gets harder to hit by chance: forty out of 177
still lands two memes and a meme aura now and then, forty out of 535 is a pile
whose auras point at sectors it holds one project in.

So the pack picks a sector and leans on it — eight projects and up to three aura
carriers. It is still drawn and still yours; which sector, and which cards inside
it, are the seed's business. Every real starter deck in every card game is themed
for this reason: it is not a random handful, it is a deck that does one thing.

Measured like against like, same code, theme on and off:

  pull rates c/r/e/l/m        unthemed   themed
  70 / 22 / 6 / 1.5 / 0.5        19.4%    22.3%
  55 / 30 / 12 / 2.5 / 0.5       22.8%    26.6%
  40 / 32 / 20 / 6 / 2           32.3%    35.6%
  flat, no rarity at all         19.0%    22.4%

  the hand-built starter deck, for comparison:   52.1%

Worth about three points wherever it is applied, and it costs nothing.

**The alarming version of this finding was a broken measurement.** The first read
said a drawn pack had fallen to 27.5% against a hand-built 56.9%, a gap of
twenty-nine points. Two things were wrong with it. `scripts/starter-pulls.ts`
carried its own copy of the draw rather than calling `openStarterPack`, so it was
measuring a pack with no backbone and no theme — a pack nobody has ever opened —
and the script that decides the pull rates was therefore deciding them off a
different game. And the two halves of the comparison were run either side of the
aura repricing, so the fixed deck appeared to move on its own, which is the tell
that should have stopped me quoting it.

The real gap is sixteen points, not twenty-nine, and the script now calls the
same function the game does. `openStarterPack` takes its pull rates as an
argument so alternatives can be tried without reimplementing it.

### What an NFT of a card actually is

Settled by the maker: **the stats go on the image**, and the intention is that
effects and powers do not change after a mint.

The confusion worth writing down, because it is the thing nobody tells you:
`public/art/*.png` is only the picture inside the frame. The frame — the rarity
border, the name, the moment, the stats, the rules text — has never existed as a
file. `CardView.tsx` draws it live in the browser every time. An NFT needs an
actual image, because that is what a wallet and a marketplace display, so
something has to turn the component into a file.

`/card/<id>/image` renders one card alone on the page, and
`scripts/render-cards.ts` screenshots it. That route exists so there is exactly
one thing deciding what a card looks like. A separate drawing program for the
mint would be a second implementation, and the day the two disagree the picture
somebody owns stops matching the card they are playing — the card-text-that-lies
problem, on-chain and permanent.

**What the decision costs.** Baking the numbers means a rebalance orphans every
image that carries the old ones. That is a real constraint and it is accepted
deliberately: what you hold looks like what you play, which is the reason anybody
collects.

Two things follow, and they are schedule rather than code:

The balance has to be finished before the mint, not after. Not the game — the
numbers. Today they still move weekly; twenty-eight auras were repriced in one
afternoon.

After a mint, balance goes into the next set. New cards, new numbers, old cards
left alone. That is how every printed card game works: Magic does not change a
printed card, it prints a new one. It is also the motor for selling more packs.

**Errata is possible but slow.** Metaplex editions mean one master per card
design with N prints, so updating the master updates every copy — and
`render-cards.ts` is the tool that produces the replacement. But wallets and
marketplaces cache images hard, a correction can take days to show up, and some
caches never refresh. So errata is for a card that is broken, not for a card that
is strong.

**Keeping update authority is a promise that has to be stated.** As long as that
key exists, the project can change what somebody owns. That is defensible — a
card game publisher can do exactly this — but /mint has to say so rather than
letting a holder find out. That sentence is now load-bearing rather than
cautionary, because of the next decision.

**Settled by the maker: the metadata stays mutable and the update authority is
kept, so that art and name can be changed after a mint if a rights holder ever
objects.** Effects, powers and stats do not move — those are still fixed at the
mint, for the reasons above. This is the escape hatch for a card whose picture
turns out to be somebody's property.

Three things follow, and the first is the one that makes the rest work.

**The card id is the link, and the id never changes.** The engine reads
data/cards.ts by id and /card/<id>/image renders by id, so the NFT has to carry
the id too. With that, name and art can move on both sides and nothing comes
apart. Hang the NFT off the *name* instead and renaming a card orphans every copy
that was ever minted.

**There are two layers and only one of them needs the chain.** The metadata holds
a uri; the uri points at JSON; the JSON points at an image. Changing the file at
the end of that chain needs no transaction at all — it needs control of the
hosting. Changing where the uri points needs isMutable and the authority. Which
lever exists depends on where the images live: Arweave is permanent and therefore
unfixable in place, and a domain we own is fixable in seconds and dies the day
the domain lapses. The intended shape is images somewhere permanent with a
pointer we can still move.

**It is a mitigation, not a cure.** Marketplaces and wallets cache images hard
and some caches never refresh, which is already written down above for errata and
matters more here: a picture that has to come down for legal reasons can keep
showing up in places long after it is replaced. So the hatch is for what we did
not see coming. What is already known gets fixed before the mint, where it is
free.

Where that landed for set 01: PENGU and DEGODS were redrawn so they no longer
carry another collection's character. The remaining flagged cards ship as they
are, as the maker's call, with the hatch above as the answer if anybody ever
raises it. Recorded here so none of them later reads as an oversight:

- TROLL — Trollface, registered by Carlos Ramirez in 2010, licensed and enforced
  since, including a DMCA that pulled a Wii U game. The picture also carries
  Success Kid and Bad Luck Brian, who are photographs of real children.
- CHILL GUY — Phillip Banks registered the character and said publicly that he
  would issue takedowns for any for-profit use.
- GIGA — a drawn Ernest Khalimov, from Krista Sudmalis's Sleek'N'Tears photos.
  Two layers, her copyright and his likeness, and they sell those images as NFTs
  themselves.
- MAD LADS — the collection's own logo on its own brand red.
- Luce — Simone Legno's mascot for the Vatican, drawn faithfully.
- Wolf of Wall Street — a likeness of a living actor in a role, in a composition
  from the film. The most exposed of the set on both counts.

Practicalities: 4x renders at 1072x1500, about 370KB a card and roughly 200MB for
the set. `out/` is gitignored; the last project put 734MB of art into a
repository and could not get it out again. The metadata `image` fields are
filenames rather than URLs, to be rewritten at upload — guessing a permanent
address before anything is registered is how you bake in a dead link.

### The mint is shut, and one wallet gets through

**Settled by the maker.** `MINT_OPEN` in `lib/collection.ts` is off. Every pack
opened today is free and local, and a free rehearsal that looks like the real
mint teaches people to own something that is not there — they build a collection,
believe in it, and find out on launch day that it was a line in a browser they
have since cleared.

**Admin is a permission, not a login.** Any wallet may sign in — that is how the
site knows whose cards to show. `lib/session.ts` owns that and answers one
question: does whoever is here hold this address. `lib/admin.ts` sits on top and
answers a different one. Folded together, the only account that could exist would
be the maker's, and the day the mint opens there would be nothing for anyone else
to log in to.

Two wallets are the exception and the admins:

```
Dg93gmtVbL4vdqHbdoBVFRsUtnjk6XAQeXA5GD4GZ7kp   the deployer
8kYc6QfaFM7633An2VPK15Tx85Lf47NtfKvBXzn6cNpr   the maker's own wallet
```

**Two keys, one person, kept apart on purpose.** The deployer launches TCG on
pump.fun and signs as little else as it can; the other is the wallet that plays,
collects and has X and Telegram attached. A wallet holding token authority should
not be signing into websites, and admin here is a permission on this site rather
than a power on the chain — so there is no reason for them to be the same key,
and one good reason for them not to be.

Order carries no meaning and both have the same rights.

Those addresses are public — it is printed on every explorer the moment that wallet
does anything — so knowing it proves nothing and unlocks nothing. The site asks
the wallet to **sign** a challenge naming itself, and re-verifies that signature
on every check rather than trusting a stored "yes". Writing the session key by
hand gets you nowhere without the private key. Sessions last twelve hours.

Three things about this are worth keeping straight:

- **A permission is not a switch.** `mayMint()` is `MINT_OPEN || provenAdmin()`.
  `MINT_OPEN` stays a property of the game rather than something one visitor can
  flip, because deck rules that differ per browser would be unreadable.
- **The gate is in the data layer, not the button.** `buyPack` and `buyDeckMint`
  throw. Hiding a button only stops the people who use buttons, and a console
  call would write to the same collection a real mint does.
- **This is not security.** Verification happens in a browser the visitor owns,
  and a determined person can patch the running app. Today that buys them free
  local packs on a site where packs are free and local. **The moment anything is
  at stake it has to be repeated on the server** against the same signature, and
  the client's answer stops counting. Same rule as the burn section below.

### The profile, and the two kinds of record

Settled by the maker: a page per wallet with statistics, the win rate of each
deck, the rank, and X and Telegram linked to it — the last of those because a
referral system is coming where points buy mints and token.

**Two records, never one.** Solo matches against the bot are computed in the
player's own browser, so they are worth what that player's honesty is worth.
That is plenty for *how is this deck doing* and nothing at all as a ladder. They
live in `lib/history.ts`, in localStorage, keyed by wallet, and the page says on
the section itself that they are not a rank. Rank comes from staked PvP and lives
in D1 (`players`), starting at 1000 with nothing behind it until a lobby exists.
Putting solo results in a server table would dress a number up as verified when
the server has never seen a move of it.

**A deck's record survives a rename and not a swap.** `deckKey` is the sorted
card ids hashed: order is not a property of a deck, so two identical forties
built in a different order are one record. Change a card and it is a new record,
which is the honest answer — rolling them together hides exactly the change you
made the swap to measure. This also means per-deck win rates work today, before
saving more than one deck is possible.

**Linking has to be proved, not typed.** A referral system pays out, so an
account must belong to exactly one wallet, and the unique index in `links` is on
the account rather than the wallet. Without it points are farmed by making
wallets, and wallets are free. A typed handle is a claim; both networks can do
better:

- **X** — an app on the developer portal, OAuth 2.0 with PKCE. Client id public,
  secret a Worker secret, never in source.
- **Telegram** — a bot from BotFather. The login widget returns a payload signed
  with the bot token, checked server-side; no OAuth round trip.

Neither is live: both need something registered with the network first, which is
the maker's to create. The table exists and the page says it is off rather than
offering a button that cannot work.

### The lobby, as built

Correspondence and friendly. `lib/pvp.ts` holds the rules and the routes are
plumbing over it, so a second front end cannot invent different ones.

**Claiming is one statement.** `DELETE ... RETURNING`, so two players pressing
join at the same moment cannot both get the match — the normal case in a lobby,
not the rare one. A join refused after the claim puts the offer back: whoever
posted it did nothing wrong.

**The client is sent a `PlayerView` and never a `State`.** A State carries both
hands, both decks and the seed, and the seed alone gives away every card either
player is about to draw. The view also carries two things worked out on the
server: each position's pump, and what each card in your own hand can do. Both
are rules. A client that computed either would be a second implementation of the
rules, which is the failure Cards of Cronos was wrecked by — there the card check
was a UI filter and a direct call could play anything.

**A stranger asking for a match gets 404, not 403.** Telling them it exists but
is not theirs is telling them what to look for.

**Refused by name, not approximated.** Live mode needs a connection that stays
open and is refused as such, because quietly treating it as correspondence puts
somebody on a day-long clock they never asked for. A stake is refused for any
value that is not the number zero — `!stake` would pass `undefined` too, and a
match that thinks it is staked and is not is worse than one that refuses.

**Deliberately unchecked: whether a player owns the cards in their deck.**
Collections live in the player's browser and the server has never seen one. For a
friendly match with nothing at stake that is a fair trade. **The moment a match
is worth something, collections have to move server-side** — same rule as the
burn section below, and the same rule that moved the wallet check off the client
when linking arrived.

`npm run lobby` plays the whole thing against a running site with two wallets
that sign for themselves: twenty checks that all need a real request and a real
database.

### Points: five tasks, and what they buy

Settled by the maker. Five things to do, one point each; then a point for every
one of those five that somebody you brought in completes. So a referral is worth
up to five, and somebody who does three of five earns their referrer three.

      1  link X to your wallet          verified
      2  link Telegram to your wallet   verified
      3  join the Telegram group        verified
      4  follow us on X                 taken on trust — see below
      5  play a demo match through      verified

**Points are spent, not scored.** That is the design, not a detail: at 1500 you
are choosing between both token lots and ten starter packs, and 1500 is 299
people plus your own five. The page computes that sentence from the list rather
than printing a number somebody typed.

      5     one card
      25    a booster pack
      100   a starter pack
      500   100K $TCG
      1000  250K $TCG

Nothing can be claimed yet — there is no token, and a single-card mint is a
product that does not exist. The catalogue is published anyway, because somebody
deciding whether to bring three hundred people in is entitled to know what they
are working towards, and a claim that took the points and delivered nothing would
be far worse than a button that is honestly off.

**Task 4 cannot be checked, and this is a fact about X rather than a shortcut.**
There has been no general free X API tier since February 2026, and reading a
following list is priced per relationship fetched — a tenth of a cent each, so
checking one person who follows two thousand accounts costs twenty dollars. There
is no cheap "does A follow B" on v2; that existed in v1.1 and is gone. So it is
recorded as `declared` rather than `verified`, the page says on the task itself
that it is taken on trust and checked by hand, and the maker keeps the right to
take it back. The two are stored as different facts because the day somebody asks
how we know, the answer has to exist.

**Points are a ledger, not a balance.** A balance column is one number with no
account of how it got there, and the first time somebody disputes it there is
nothing to show them. Every entry says what happened: earned by a task, earned
because somebody you referred did one, spent on a reward, adjusted by hand. The
balance is the sum of everything not voided.

**Refusing what looks botted** is `voided_at`, on both the task and the points it
earned — the player's and their referrer's, since a referral point was earned by
a task that is no longer standing. Voided and never deleted: a voided row is
evidence, a deleted one is an argument nobody can settle, and the unique index
keeps a refused task from simply being done again for the same point.

Every payment is idempotent by index rather than by checking first. A read then a
write pays twice when two requests arrive together, and a point paid twice cannot
be corrected because nothing in the row says it happened twice.

**Still to build:** the single-card mint product, and claiming. Claiming also
needs the balance check to become a conditional write — it is a read-then-write
today, which is safe only because every reward is switched off.

### The record

`players.wins/losses/draws`, from every PvP match including friendly ones,
settled above. Written by `lib/finish.ts` under a `WHERE finished_at IS NULL`,
which is what makes it happen once: both the move that ends a match and the
opponent's next poll reach a finished match, and a record incremented twice
cannot be corrected — nothing in the row says it happened twice.

The rank is a different number and is not touched there. It moves only on staked
matches, and there is nowhere to hold a stake yet.

### The copycat banner

Settled by the maker, and it exists for a specific predictable thing rather than
a general worry: the moment a project has a Telegram group filling up and
referral links going around, somebody launches a token on pump.fun with this
site's address in its description. It works on the people who found the real
project first — they have every reason to believe the link, and nothing on the
site tells them otherwise.

Three decisions, all of which are the point rather than the styling:

**It cannot be dismissed.** Somebody who waves it away on the day they arrive is
exactly the person who gets caught three weeks later. A warning shown once is a
warning aimed at the wrong moment.

**It removes itself.** `lib/launch.ts` is the one place that answers "has the
token launched", read from `NEXT_PUBLIC_TCG_MINT`, and both the banner and the
contract-address panel ask it. A site still shouting "we are not live" after
launch is the thing that makes the real one look like the copy — so it is not a
thing anybody has to remember to take down. Absent means not launched, because a
missing variable must never read as "yes, this is live".

**It says what to check.** "Be careful" is not actionable. "There is no contract
address, and the real one appears here, in the Telegram and from @trenchescards
first — nowhere else" names the one thing a scam cannot produce, and names the
only three places a real announcement can come from.

The channels live in `lib/links.ts` and are imported rather than repeated. A
wrong handle in that sentence points people at somebody else's account while
telling them it is the safe one, which is worse than not naming one at all.

      site      trenches.cards
      telegram  t.me/trenchescards
      x         @trenchescards

### Solana
- Token and burn only, or cards as NFTs on-chain?
- Determines whether an Anchor program is needed or just an SPL token plus a
  payout path.

### Revenue and the burn

**Settled by the maker.** Four streams, and three of the four send most of what
they earn into the token. `lib/revenue.ts` is the only place these numbers live —
they end up on a page, in this file and eventually in whatever moves the funds,
and three copies of a split is two chances to pay the wrong wallet.

      pump.fun creator fee    50% creator · 20% marketing · 20% burn · 10% tournaments
      paid mints              75% burn · 25% creator
      NFT royalties           75% burn · 25% creator
      staked matches          100% burn

      creator     8kYc6QfaFM7633An2VPK15Tx85Lf47NtfKvBXzn6cNpr
      deployer    Dg93gmtVbL4vdqHbdoBVFRsUtnjk6XAQeXA5GD4GZ7kp   every buy-and-burn
      marketing   Cstb5W8HMheovQNDh5eazwtUkocub9D8kVRMUf9kd6U8
      tournament  9AbPyT6RkCtpRycN7dZ8dak4TQ9L3Xa1ictwP8M9bQLF   prizes, paid out

**Every buy-and-burn runs through the deployer**, so all of it lands in one place
anybody can watch. A second burning wallet would mean a total nobody can add up.

**Still open: what the rake on a staked match actually is.** The split is settled
— all of it burns — and the size is not. The page says so on the stream rather
than showing "100%" and letting somebody assume it means the whole stake.

**Three things are checked at load and refused rather than reported.** A split
that does not add up leaves a remainder sitting wherever it landed; a mistyped
address is a valid-looking string that money goes to and never comes back from;
and two wallets sharing an address is a split that quietly pays one party twice
while adding up to a hundred and looking entirely normal. None of the three shows
up as an error on its own.

**The burn total is the sum of transaction signatures**, not a stored number. A
stored total can disagree with the transactions behind it, and the only thing
that makes a burn counter worth reading is that it cannot. Every row on `/burn`
links to an explorer, the signature is the primary key so the same burn cannot be
counted twice, and with no burns it says zero rather than something rounder.

**Balances are read off the chain and shown on the page**, so nobody has to go
and look them up. Server-side, cached a minute at the edge: a browser could ask
an RPC directly, but then the endpoint is in the page — and the day this needs a
paid one, its key is in the page with it.

Not `api.mainnet-beta.solana.com`, which was the obvious choice and returns 403
to a Worker: it refuses datacenter traffic. It answers a laptop perfectly, which
is why that had to be found in the Worker's own logs rather than from a terminal.
`solana-rpc.publicnode.com` answers, needs no key, and `SOLANA_RPC` overrides it
as a **secret** rather than a var, because a paid endpoint's URL carries its key.

Empty and unknown are drawn differently. An account nobody has funded is a real
zero; an RPC that would not answer is not, and "0 SOL" because something timed
out is the one wrong answer that section can give.

**Still to build:** whatever writes to `burns`. Nothing does — there is no token
— and the table exists so the first burn has somewhere to go rather than being
reconstructed later from memory. Reading them off-chain from the deployer wallet
is the obvious way and needs an RPC key, which does not go in the source.

- The moment value flows through it, server-side validation is mandatory. In the
  previous project the card check was purely a UI filter; anyone calling the
  function directly could play any card. With a stake attached that cannot stand.

### Energy instead of three cards a turn — tried and rejected

Built on the `energy-experiment` branch and measured rather than argued. Six
energy a turn, cards costing 1/2/3/4/5 by rarity, derived so the pace would land
near the 3.00 cards a turn it replaced.

It was meant to do two things and did neither.

**Replace the deck budget.** A deck of the forty most expensive cards wins 97.2%
under the three-card rule and 80.0% under energy. Its portfolio fills on turn 6.0
instead of 3.1 — but four turns holding the six best positions in the set still
wins four matches in five. Energy limits the rate you play at, and the binding
constraint here is which six positions you hold. Half the gap closed is not a
game.

**Add decisions inside a turn.** The rarity mix of cards actually played barely
moved from the mix sitting in the deck: commons down 5%, mythics up 20%. Value
per energy came out at 57/50/53/66/83 thousand, so the table rewarded expensive
cards — it compresses the top of an eight-point deck scale into five while the
power behind it does not compress. Setting energy equal to the deck cost flattens
that again and makes a mythic unplayable in a six-energy turn; raising the turn's
energy to fit allows eight commons a turn.

Underneath both is one fact worth keeping: **the value curve is linear in cost**,
measured at 57/50/53/53/52 thousand per deck point. A second linear cost system
re-expresses that curve in different units rather than changing it. And the deck
budget has already charged for rarity once, so energy charges for it twice.

That also settles the question that started it — whether the same project could
exist in every rarity. It could, and it would add nothing: with six positions to
fill you want them as large as possible, and only the deck budget stops that.
A cosmetic scarcity axis, separate from the mechanical rarity, gets the
collectible half without touching any of this.

### Card set
- Influencer cards carry the names of real people. Who ends up on one is the
  maker's call; they therefore sit together in a single list.
- Aura value per deck point is uneven across the rarities, which the repricing
  pass exposed rather than fixed. Roughly: common 19K for one point, rare 23K for
  two, epic 47K for three, legendary 72K for five, mythic 187K for eight — so a
  point spent on commons or on the mythic buys about twice what a point spent on
  rares or legendaries does. Fixing it means deciding what the rarity ladder is
  supposed to be worth, which is a design decision rather than a measurement.

---

## The stack

Next.js (App Router), React, TypeScript, Tailwind, framer-motion, Vitest.

The engine is separate from the frontend: `engine/` imports nothing from React or
the browser and is a pure reducer, `applyMove(state, move) → state`. That same
function can later run unchanged on a server to validate PvP moves. The split is
there from the start, because retrofitting a UI filter into server-side
validation afterwards is exactly the mistake from the previous project.
