// The vocabulary of the game. This file imports nothing — not React, not the
// browser, not the rest of the engine. Everything below has to run just as well
// on a server as it does in a tab.

export const RARITIES = ["common", "rare", "epic", "legendary", "mythic"] as const;
export type Rarity = (typeof RARITIES)[number];

/**
 * What a card costs to play, out of RULES.budgetPerTurn.
 *
 * Deliberately not the same scale as the deck cost (1/2/3/5/8). That one prices
 * a card against a budget you spend once, so it can spread over eight points.
 * This one has to fit inside a single turn, so it compresses to five — an
 * eight-cost mythic would be unplayable.
 *
 * Taking profit and throwing a card away cost TURN_ACTION_COST, which is a
 * third of a turn, exactly what they cost when a turn was three cards.
 */
export const MARKETING_COST: Record<Rarity, number> = {
  common: 20_000,
  rare: 40_000,
  epic: 80_000,
  legendary: 200_000,
  mythic: 280_000,
};

export const TURN_ACTION_COST = 50_000;

/**
 * The share of unspent marketing budget that comes off your market cap.
 *
 * At 1 the whole of it goes. Without a charge, holding the budget back is free
 * and the ramp does nothing — with it, every turn you have to find something
 * worth doing with the money, and a hand that cannot absorb it hurts.
 */
export const WASTE_PENALTY = 1;

/**
 * What kind of project a card is a card of.
 *
 * These four are the maker's own words, taken from the tags the first version of
 * this game already carried, rather than a taxonomy invented on top of them. He
 * knows what these projects are and an outsider guessing would get it wrong:
 *
 *   meme        the joke is the product
 *   memetility  a meme that grew something you can use
 *   lunar       the pack — a collection with a community around it
 *   machine     built rather than drawn
 *
 * `meme` is much the largest and that is fine; the same is true of every card
 * game with a house style. `lunar` and `machine` have one project family each
 * today, which makes an aura on them narrow — they want company in set 02, and
 * the sector-presence script is the thing that will say when they have it.
 */
export const SECTORS = ["meme", "memetility", "lunar", "machine"] as const;
export type Sector = (typeof SECTORS)[number];

export const PLAYERS = ["you", "opponent"] as const;
export type Player = (typeof PLAYERS)[number];

// ---------------------------------------------------------------------------
// Targets
//
// Split into two types so the compiler can never let an effect that hits a
// player point at a project instead. In Cards of Cronos `target_type` was one
// string for everything; a typo or a wrong combination silently fell through to
// "do nothing".
// ---------------------------------------------------------------------------

export type TargetPlayer = "self" | "opponent" | "both";

export type TargetProject =
  | "ownProject"
  | "enemyProject"
  | "allOwnProjects"
  | "allEnemyProjects"
  /** Every project on the table, both sides. What makes an event an event. */
  | "allProjects";

/** The two targets that make the player point at one specific project. */
export type ChoiceTarget = "ownProject" | "enemyProject";

/**
 * Does this target require the player to point at one specific project?
 *
 * A type guard rather than a boolean, so everything downstream gets the narrowed
 * target for free and boardOf() can refuse the table-wide ones outright.
 */
export function needsChoice(target: TargetProject): target is ChoiceTarget {
  return target === "ownProject" || target === "enemyProject";
}

/** Whose board a chosen project sits on. Only meaningful for a single target. */
export function boardOf(target: ChoiceTarget, player: Player): Player {
  if (target === "ownProject") return player;
  return player === "you" ? "opponent" : "you";
}

/** Which boards a target covers. Table-wide targets cover both. */
export function ownersOf(target: TargetProject, player: Player): Player[] {
  const other: Player = player === "you" ? "opponent" : "you";
  switch (target) {
    case "ownProject":
    case "allOwnProjects":
      return [player];
    case "enemyProject":
    case "allEnemyProjects":
      return [other];
    case "allProjects":
      return [player, other];
  }
}

/** Which players a player-target covers. */
export function playersOf(target: TargetPlayer, player: Player): Player[] {
  const other: Player = player === "you" ? "opponent" : "you";
  switch (target) {
    case "self":
      return [player];
    case "opponent":
      return [other];
    case "both":
      return [player, other];
  }
}

// ---------------------------------------------------------------------------
// Effects
//
// Every variant carries its own parameters. There is no shared name that two
// cards with different intentions can reuse — that was the second expensive
// lesson from Cards of Cronos.
// ---------------------------------------------------------------------------

export type Effect =
  /** Market cap straight up or down. A negative mc is a hit. */
  | { kind: "directMC"; target: TargetPlayer; mc: number }
  /**
   * Permanently changes a project's pump, up or down. A negative amount is the
   * only way in the game to make a position on the table worth less every turn
   * rather than removing it outright.
   *
   * The total is floored at zero where it is paid out, in pumpOf. Without that
   * floor a project could be pushed past zero and start draining market cap
   * every turn, which is a rug by instalments and reads as neither a rug nor a
   * pump — a card doing something no text on it describes.
   */
  | { kind: "pumpProject"; target: TargetProject; mc: number }
  /**
   * Permanently raises the pump of the targeted projects, by a different amount
   * per sector. A sector absent from `bonuses` gets nothing.
   *
   * Deliberately not called `pumpSector`: that name already belongs to an Aura,
   * and one name meaning two things is the trap that left cards dead in Cards of
   * Cronos. This is a one-off effect; the aura is a standing bonus.
   */
  | {
      kind: "pumpBySector";
      target: TargetProject;
      bonuses: Partial<Record<Sector, number>>;
    }
  /** Strips holders. At zero the project rugs. */
  | { kind: "damageHolders"; target: TargetProject; amount: number }
  /** Gives holders back, never above the card's starting count. */
  | { kind: "healHolders"; target: TargetProject; amount: number }
  /** Removes a project from the board immediately, however many holders it has. */
  | { kind: "rug"; target: TargetProject }
  /**
   * Takes influencers and tools off the board, biggest name first.
   *
   * Everything in this game had an answer except the row beside your portfolio.
   * You could wipe someone's entire portfolio and their Murad would still be
   * there pumping the next six memes they played — nothing in the set could
   * touch it, and the type system could not even express it, because every
   * attack targets a project.
   *
   * No target index: it takes the largest aura first, which is both the obvious
   * play and the one that reads. "Cancels their biggest name" needs no pointing.
   */
  | { kind: "cancel"; target: TargetPlayer; count: number }
  /** Moves a percentage of the opponent's market cap to you. */
  | { kind: "stealMC"; percentage: number }
  /**
   * Scales market cap by a signed percentage. Unlike a flat amount this is not
   * symmetric when it hits both players: +20% widens whoever is ahead, -20%
   * narrows it. That is what makes a market-wide event a decision rather than a
   * wash.
   */
  | { kind: "scaleMC"; target: TargetPlayer; percentage: number }
  /** Draw extra cards. */
  | { kind: "drawCards"; amount: number }
  /**
   * Hands marketing budget to somebody.
   *
   * It used to be "play one extra card", which was true when a turn was three
   * cards. Under a budget it was neither one card nor a fixed amount — it was
   * whatever a card happened to cost — and the printed text said something the
   * effect did not do. Now it grants the money and says so.
   *
   * A target, because giving it to the opponent is an attack rather than a
   * present. Budget that is not spent is charged against market cap at
   * WASTE_PENALTY, and that charge decides matches: in mirrored decks the
   * thriftier player takes 74.7% of the ones that are decided, and the rule
   * destroys about 18% of what a player would otherwise hold. Handing somebody
   * money late in a match, when their hand cannot absorb it, costs them.
   *
   * Where it lands differs by target, and the printed text says which: "self"
   * is this turn, because it is your turn. "opponent" is their next turn, since
   * budget is set at the start of a turn and theirs has not begun.
   */
  | { kind: "extraBudget"; target: TargetPlayer; mc: number };

export type EffectKind = Effect["kind"];

/**
 * A standing bonus from an influencer. Deliberately not an Effect: an aura works
 * every turn during the pump phase, not once when played. Were it part of Effect,
 * `applyEffect` would need a branch for it that does nothing — and exactly that
 * kind of silent branch left 110 cards dead in Cards of Cronos.
 */
export type Aura = { kind: "pumpSector"; sector: Sector; bonus: number };

export type AuraKind = Aura["kind"];

/**
 * A standing rule a card puts on the table while it is there.
 *
 * Deliberately not an Effect, for the same reason an Aura is not: an effect
 * happens once, when the card is played, and this is a condition that holds for
 * as long as the card holds its position. Were it an Effect, applyEffect would
 * need a branch that does nothing, and that silent branch is what left 110 cards
 * dead in the last project.
 *
 * It always binds the opponent, never its owner. A card that restricted its own
 * side would be a drawback, and drawbacks belong in the numbers rather than in a
 * rule nobody can see coming. "While this holds a position, your opponent
 * cannot..." is one sentence and reads off the card.
 *
 * And it holds only while the position is undamaged. One point of damage lifts
 * it, healing back to full restores it. That is the whole answer to a lock that
 * protects itself: at five holders, Degenerate Ape Academy switched tactics off
 * and tactics are where most of the answers to a project live, so the only way
 * through was two specific cards in the same hand. Now any attack at all opens
 * it, even one that leaves the project standing — the opponent is never without
 * a move, and the card is still a mythic.
 *
 * Projects only, deliberately. A tool sits in support and has no holders, so a
 * tool carrying this would be a lock with no key at all.
 *
 * Enforced in whyNot() and in takeProfit(), which are the two places that decide
 * whether a move is legal. Nowhere else is allowed to know about it.
 */
export type Restriction =
  /** The opponent cannot play cards of this type at all. */
  | { kind: "banType"; cardType: CardType }
  /** The opponent cannot close a position on purpose, so a rug cannot be dodged. */
  | { kind: "banTakeProfit" };

export type RestrictionKind = Restriction["kind"];

/**
 * A test against the table, for a card that does more when the board says so.
 *
 * Not a gate. A card whose effect only fires under a condition is a card that is
 * dead in most hands, and dead cards are what this set is built to avoid. A
 * condition sits on a *bonus* instead: the card always does its base effect, and
 * does something else as well when the table agrees. It is escalation rather
 * than a lock, so it is never a blank.
 *
 * behindBy is the shape that made the idea worth building. A percentage of your
 * own market cap is worth least exactly when you are losing, so pairing it with
 * a flat amount for being behind is self-correcting: the two halves are large at
 * opposite moments and the card is never both at once.
 */
export type Condition =
  /** Your market cap is at least this far below the opponent's. */
  | { kind: "behindBy"; mc: number }
  /** You hold at least this many projects in one sector. */
  | { kind: "ownProjectsInSector"; sector: Sector; atLeast: number }
  /** You hold at least this many projects, whatever they are. */
  | { kind: "ownProjectCount"; atLeast: number }
  /** It is this turn or later. */
  | { kind: "turnAtLeast"; turn: number };

export type ConditionKind = Condition["kind"];

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

interface CardBase {
  /** Unique, kebab-case. Also the key for the procedural art. */
  id: string;
  name: string;
  /** Shown large on the card. */
  ticker: string;
  rarity: Rarity;
  /** Written copy. Promises nothing about the mechanics — that comes from rulesText(). */
  flavour: string;
  /**
   * URL of the real card artwork, if there is one. Leave it empty and the
   * frontend generates an image from the id instead.
   *
   * Deliberately a URL and not a file in the repo: the previous project's art was
   * 734 MB and sat untracked, which works right up until someone runs `git add .`.
   * Large art belongs in storage with a CDN in front of it.
   */
  art?: string;
  /**
   * A second effect that fires only when the table agrees, on top of the card's
   * ordinary one rather than instead of it.
   *
   * On CardBase rather than on each card type, because "does more when you are
   * behind" is not a property of being a project or a tactic.
   *
   * Called payoff and not bonus, which was the first name and lasted about an
   * hour. Aura already has a field called `bonus` — a number, meaning something
   * else entirely — and one word for two things is the trap that left cards
   * dead in the last project. It was caught by a guard matching the wrong field
   * on Murad, which is the cheap way to find it; the expensive way is a year
   * later.
   */
  payoff?: { when: Condition; effect: Effect };
}

export interface ProjectCard extends CardBase {
  type: "project";
  /**
   * Which project this card is a card *of*.
   *
   * A project is a thing that happened on Solana; a card is one moment of it.
   * BONK is one project across eight cards — the airdrop, the burn, the Coinbase
   * listing, the billion — and they are different cards with different costs and
   * different effects, not one card at eight power levels.
   *
   * This is what lets the rules know two cards are the same project, which is the
   * whole reason the field exists: a deck may hold only so many of one project,
   * and only one of them can hold a position at a time. Without it those rules
   * cannot be written, and eight BONKs on one board is not a game.
   */
  project: string;
  /**
   * Which moment of the project this card is: "The Pink Hat", "Korea Woke Up".
   *
   * The project's own name stays in `name` and is the same on all eight cards, so
   * WIF is the headline and the moment is the subtitle — the way a card game
   * names a set of cards about one thing. Without this the family was only
   * visible if you happened to know that "The Pink Hat" and "Top Dog" were both
   * WIF, which is a naming convention rather than a fact about the card, and
   * naming conventions drift.
   *
   * Absent on a project that is a single card, where there is no moment to
   * distinguish.
   */
  moment?: string;
  sector: Sector;
  /** One-off, the moment it is played. */
  launchMC: number;
  /** Every turn after that. */
  pumpMC: number;
  /** How much damage it survives. At zero it rugs. */
  holders: number;
  /** Optional extra effect when played. */
  effect?: Effect;
  /**
   * Optional standing rule on the opponent, for as long as this holds an
   * undamaged position. Any damage lifts it; healing back to full restores it.
   */
  restriction?: Restriction;
}

export interface TacticCard extends CardBase {
  type: "tactic";
  effect: Effect;
}

/**
 * Something that happened to the market, rather than something you did.
 *
 * Mechanically a one-off like a tactic, but an event has to hit the whole table:
 * every project on both boards, or both players. Validation enforces that, so
 * the type means something instead of being flavour on a tactic.
 */
export interface EventCard extends CardBase {
  type: "event";
  effect: Effect;
}

/**
 * Something you use rather than something you hold.
 *
 * DexScreener, Photon, Phantom and the rest were project cards, which meant they
 * produced market cap and took a position in your portfolio. Neither is a thing
 * they can do: a chart site has no token and you cannot hold a position in a
 * wallet. They sit beside your portfolio instead and make it work better, which
 * is what a tool is.
 *
 * The effect is required and the aura is not: every tool does something the
 * moment you reach for it, and some keep working after that.
 */
export interface ToolCard extends CardBase {
  type: "tool";
  effect: Effect;
  aura?: Aura;
}

export interface InfluencerCard extends CardBase {
  type: "influencer";
  aura: Aura;
  /** Optional one-off effect when played, on top of the standing aura. */
  effect?: Effect;
}

export type Card = ProjectCard | TacticCard | EventCard | InfluencerCard | ToolCard;

/**
 * Every card type, in the order they should be listed.
 *
 * A runtime list beside the union, the same way RARITIES sits beside Rarity. The
 * gallery and the deck builder each had their own hand-written copy of this, and
 * adding the tool type left both filters silently missing it — the type checker
 * cannot see that a `CardType[]` is incomplete.
 */
export const CARD_TYPES = ["project", "tool", "tactic", "event", "influencer"] as const;

/**
 * The standing bonus a card carries, if it carries one.
 *
 * Two card types can now have an aura and only one of them must. Every place
 * that asked `card.type === "influencer"` was really asking "does this have an
 * aura", and each of those would have silently ignored a tool's aura — the card
 * text would not have mentioned it, the bot would not have valued it, and
 * validation would not have checked it. One function, so the question is
 * answered in one place.
 */
// Null rather than undefined, and deliberately: `auraOf(card) !== null` reads as
// the obvious way to ask "does this card carry an aura", and against `undefined`
// that expression is true for every card in the set without TypeScript objecting.
// It cost one measurement an entire column before it was noticed.
export function auraOf(card: Card): Aura | null {
  if (card.type === "influencer") return card.aura;
  if (card.type === "tool") return card.aura ?? null;
  return null;
}
export type CardType = Card["type"];

// Guards the list above against the union drifting away from it.
const _allTypesListed: Record<CardType, true> = {
  project: true,
  tool: true,
  tactic: true,
  event: true,
  influencer: true,
};
void _allTypesListed;

/**
 * Cards looked up by id. The engine receives this rather than importing
 * `data/cards`: that keeps the engine testable with a made-up set, which is
 * exactly what the test needs that checks an unknown effect throws.
 */
export type CardIndex = ReadonlyMap<string, Card>;

// ---------------------------------------------------------------------------
// State
//
// Fully serialisable: no functions, no classes, no Date, no Math.random. A match
// can therefore be saved, sent over the wire and replayed.
// ---------------------------------------------------------------------------

export interface BoardProject {
  cardId: string;
  /** Current holders. Starts at card.holders and drops with damage. */
  holders: number;
  /** Built up by pumpProject effects, on top of card.pumpMC. */
  extraPump: number;
  /**
   * Market cap this position has produced so far: its launch plus every pump it
   * has paid out. This is what is on the line.
   *
   * Close the position yourself and you keep it — that is taking profit. Let it
   * get rugged and it comes straight back off your market cap, because you were
   * not out in time. Realised against unrealised is the whole subject of this
   * game, so the scoreboard should say which one you are holding.
   */
  earned: number;
  /** Which turn it was played on. Purely for the log and the UI. */
  playedOnTurn: number;
}

/**
 * A card that sits beside your portfolio and keeps working: an influencer or a
 * tool. Not a position — it produces no market cap of its own and a rug cannot
 * take it.
 */
export interface BoardSupport {
  cardId: string;
}

export interface PlayerState {
  mc: number;
  hand: string[];
  deck: string[];
  discard: string[];
  projects: BoardProject[];
  support: BoardSupport[];
  /**
   * Budget granted by somebody else, waiting for this player's turn to start.
   *
   * Only the opponent half of extraBudget uses it. Budget is set at the start of
   * a turn, so a grant made during your turn has nowhere to land on theirs until
   * theirs begins — it has to wait somewhere, and it has to be in the state
   * rather than in a closure, or a replay from seed and moves stops matching.
   */
  pendingBudget: number;
}

export type LogTone = "neutral" | "pump" | "dump" | "system";

export interface LogEntry {
  turn: number;
  player: Player | null;
  text: string;
  tone: LogTone;
}

export interface State {
  /** What the match started from. Together with the moves, fully replayable. */
  seed: number;
  /** Current state of the PRNG. Part of the state, so there is no hidden randomness. */
  rngState: number;
  turn: number;
  toMove: Player;
  /** Marketing budget for this turn, and how much of it has gone. */
  budgetThisTurn: number;
  budgetSpentThisTurn: number;
  players: Record<Player, PlayerState>;
  log: LogEntry[];
  finished: boolean;
  /** Only filled once finished is true. null means a draw. */
  winner: Player | null;
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export type Move =
  | {
      kind: "playCard";
      handIndex: number;
      /** Index into the target board's project list. Required when the effect picks one project. */
      targetIndex?: number;
    }
  /**
   * Close one of your own positions on purpose and bank what it produced.
   *
   * It costs one of your plays for the turn, which is the whole point: late in a
   * match you have to choose between putting more on the table and securing what
   * is already there. Without that cost you would simply bank everything on the
   * last turn and a rug could never punish you.
   */
  | { kind: "takeProfit"; slot: number }
  /**
   * Throw a card out of your hand. It costs one of your actions for the turn,
   * exactly like playing or taking profit, and there is no limit beyond that
   * budget — a card that grants an extra action grants an extra discard with it.
   *
   * The point is not the card you lose, it is the card you draw. The top-up only
   * fills back to the hand size, so every card you hold is a card you do not
   * draw: measured over 40000 turns, hands end on 2.71 cards and a fifth of all
   * cards sit for three turns or more. Discarding turns a dead card into a fresh
   * one, and it costs nothing on the turns you had a spare action anyway — which
   * is most of them, at 0.89 unused actions a turn.
   */
  | { kind: "discard"; handIndex: number }
  | { kind: "endTurn" };

/**
 * A move that isn't allowed. Throwing rather than ignoring: once this runs server
 * side an invalid move has to be an error, not a silent nothing. In the previous
 * project the card check was a UI filter, so calling the function directly let you
 * play any card you liked.
 */
export class IllegalMove extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "IllegalMove";
  }
}

/** Rules that don't live in the card data. */
export const RULES = {
  turns: 10,
  /**
   * One share of marketing budget. Turn N gets N shares, so turn one gets $40K
   * and turn ten gets $400K.
   *
   * It does not carry. Whatever is not spent when the turn ends is gone, which
   * leaves the ramp as the only thing that grows.
   *
   * The ramp is the mechanic, not the money. A flat allowance was measured first
   * and failed: enough budget on turn one to market a mythic puts it on the
   * table immediately, which slows an expensive deck down without ever stopping
   * it. Ramping makes an expensive card *unplayable* early rather than merely
   * later, and that is the only way a per-turn limit reaches deck composition.
   */
  budgetPerTurn: 40_000,
  handSize: 5,
  /**
   * How many positions a portfolio holds at once.
   *
   * Without a cap every project card is strictly good: you play your most
   * expensive one and nothing is ever a choice. A cap makes board space scarce,
   * and it gives attack cards teeth — rugging one of fifteen positions is noise,
   * one of six is a sixth of their engine.
   *
   * Full does not mean blocked: you close a position to open a new one. The MC
   * that position already made stays; you only give up its future pump.
   */
  portfolioSize: 6,
  /**
   * Cards in a deck. You draw a median of 31 in a match and 40 at the extreme, so
   * at this size you see nearly all of it: what you build is what you get. That is
   * the strongest lever there is against draw variance, and it is why a match with
   * a stake on it wants a deck rather than the whole set shuffled.
   */
  deckSize: 40,
  /**
   * Points a deck may cost, at 1 / 2 / 3 / 5 / 8 per rarity tier.
   *
   * Building the set's own mix at this size comes to 101, so the budget bites: you
   * cannot simply have everything. Two mythics and four legendaries leave the rest
   * of the deck thin, and that is the trade the number exists to force.
   */
  /**
   * Projects a deck must hold at least.
   *
   * Measured with `npm run archetypes`: a deck with six projects wins 21% against
   * one with ten, and ten wins 50% against eighteen's 71%. Only a project can hold
   * a position and only a position pumps, so a deck short on them simply cannot
   * play. Twelve is the floor below which you are building something unplayable
   * without anything telling you so.
   */
  minProjects: 12,
  /**
   * Market cap the first player starts with, as compensation for moving first.
   *
   * Alternating turns give the second player a structural edge: when they choose
   * an attack target they can already see the project the first player put down
   * this turn, while the first player is aiming at a board one turn out of date.
   * They wreck better targets. It is worth about one percent of pump rate a turn,
   * and over ten turns that compounds into a real advantage — measured at a 45%
   * win rate for the first player before this existed.
   *
   * Every alternating-turn card game compensates for this; Hearthstone hands the
   * second player an extra card. Here it runs the other way, so the first player
   * gets a seed round.
   *
   * Tuned with `npm run balance` and re-tuned whenever the rules or the card
   * numbers move. It has walked a long way: 45K for a 40-card set, 70K once the
   * set grew to 120, 160K once a rug started taking back the market cap a
   * position had produced, then 106K, and now 62K.
   *
   * That last move was the biggest and it was the card set that caused it. Sixty
   * cheap projects went in to fill the thin sectors, the pool got cheaper, and
   * more of a hand became playable early — which is tempo, and tempo is what the
   * first player already had. It read 58.9% before this came down. Nothing about
   * the rules changed; the deck the rules are played with did, which is the whole
   * reason this constant carries a note saying to re-tune it.
   *
   * An extra card was tried instead and measured at barely a point, against seven
   * for the seed round, so this stayed the lever.
   *
   * Retuned at 535 cards and after every aura was repriced, in that order —
   * measuring turn order against card values that were about to change would have
   * been measuring nothing. Current reading: 50.03% on seeds 0-8000 and 50.80% on
   * seeds 100000-108000, which it never saw while tuning.
   */
  //
  // ── RETUNED FOR THIS SET, AND THE REASON IS AN OPEN QUESTION ──────────────
  // It was 68_000, measured against the maker's other card game. Against the
  // Cards of Cronos set that reads 39.1% over a thousand mirrored matches, well
  // outside the 46.9–53.1% band a fair game sits in, and 68K buys only 0.7 of a
  // point of it. 400_000 reads 50.7% on seeds 0-800 and 51.6% on 100000-100800,
  // a range it never saw while being tuned.
  //
  // Six times the old number is a large enough jump to want an explanation, and
  // two obvious ones were measured and are wrong:
  //
  //   The second player moving last. Playing eleven turns instead of ten, so the
  //   FIRST player has the last word, makes it worse rather than better —
  //   42.3% to 40.1% with no compensation at all.
  //
  //   Attack density. This set has far more cards that reach across the table
  //   than the one the number came from. Stripping every card that touches the
  //   opponent moves it by four tenths of a point: 43.7% to 43.3%.
  //
  // What is left is scale. This set's matches finish around $1.2M, so a fixed
  // 68K is a much smaller fraction of a match here than it was there — which
  // would make the old number right in proportion and wrong in absolute terms.
  // That is a hypothesis and it has not been measured. Until it has, this is a
  // constant that was fitted rather than understood, and it should be re-fitted
  // whenever the set changes shape.
  firstMoveSeedMC: 400_000,
} as const;
