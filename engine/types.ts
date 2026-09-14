// The vocabulary of the game. This file imports nothing — not React, not the
// browser, not the rest of the engine. Everything below has to run just as well
// on a server as it does in a tab.

export const RARITIES = [
  "common",
  "rare",
  "epic",
  "legendary",
  "mythic",
] as const;
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
/**
 * The shipped ladder. The one number a rarity actually means.
 *
 * 20 / 40 / 80 / 200 / 280 is x2, x2, x2.5, x1.4 -- and the x2.5 at epic to
 * legendary is the only irregular step in it. scripts/support-price.ts found
 * every support type collapsing on exactly that step, which makes the shape of
 * this ladder a thing worth being able to test rather than only argue about.
 */
const SHIPPED_LADDER: Record<Rarity, number> = {
  common: 20_000,
  rare: 40_000,
  epic: 80_000,
  legendary: 200_000,
  mythic: 280_000,
};

/**
 * What each rarity costs to play.
 *
 * Overridable from the environment for measurement only, in thousands, cheapest
 * first. A build never sets it and SHIPPED_LADDER is what ships.
 *
 *   COST_LADDER=20,40,80,160,240 npx tsx scripts/support-scale.ts
 *
 * Validated hard rather than parsed hopefully: five values, all positive whole
 * thousands, strictly ascending. A ladder that is not ascending would price a
 * mythic under a legendary, and every instrument in this repo divides value by
 * cost -- it would not crash, it would quietly answer a different question.
 */
export const MARKETING_COST: Record<Rarity, number> = (() => {
  const raw =
    typeof process !== "undefined" && process.env ? process.env.COST_LADDER : undefined;
  if (raw === undefined || raw === "") return SHIPPED_LADDER;

  const parts = raw.split(",").map((n) => Number(n.trim()));
  if (parts.length !== RARITIES.length) {
    throw new Error(
      `COST_LADDER is "${raw}". It needs ${RARITIES.length} values, in thousands, cheapest first.`,
    );
  }
  for (const n of parts) {
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      throw new Error(`COST_LADDER has "${n}" in it. Every value is a positive whole number of thousands.`);
    }
  }
  for (let i = 1; i < parts.length; i++) {
    if (parts[i]! <= parts[i - 1]!) {
      throw new Error(
        `COST_LADDER is "${raw}", which does not ascend at ${RARITIES[i]}. A rarity that costs less than the one below it prices nothing.`,
      );
    }
  }
  return Object.fromEntries(
    RARITIES.map((rarity, i) => [rarity, parts[i]! * 1_000]),
  ) as Record<Rarity, number>;
})();

export const TURN_ACTION_COST = 50_000;

/**
 * What a support card pays, as a share of what a project of its rarity pays.
 *
 * One at every real build, so this changes nothing until somebody decides it
 * should. It exists because scripts/support-price.ts found that support is not
 * worth its price and the shortfall tracks the price rather than the card:
 * measured per slot, a support card loses 0.4 points at common and 4.6 at
 * legendary, and three unrelated card types agree on that last number to within
 * a rounding. A project pays $200K for a launch and a pump every remaining turn;
 * a support card pays the same for one effect. See docs/deferred-fixes.md.
 *
 * Set through the environment so a sweep is one process per value and there is
 * no mutable global in the engine. A build never sets it.
 *
 *   SUPPORT_PRICE_SCALE=0.6 npx tsx scripts/support-scale.ts
 *
 * Anything outside (0, 1] throws at load. A scale of zero is a free card wearing
 * a price, above one is a surcharge nobody asked for, and a typo that silently
 * became 1 would quietly measure nothing at all -- which is the failure this
 * repository keeps paying for.
 */
export const SUPPORT_PRICE_SCALE: number = (() => {
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.SUPPORT_PRICE_SCALE
      : undefined;
  if (raw === undefined || raw === "") return 1;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(
      `SUPPORT_PRICE_SCALE is "${raw}". It has to be a number in (0, 1]; 1 means no change.`,
    );
  }
  return value;
})();

/**
 * What a card costs before any rule moves it.
 *
 * priceFor takes it from here rather than from MARKETING_COST directly, so the
 * scale above reaches the tax, the discount and the half-price recovery in one
 * place instead of three. Rarity is untouched: the free-play cap and the draw
 * weights read the rarity and must not move when the price does.
 */
export function basePrice(card: Card): number {
  const printed = MARKETING_COST[card.rarity];
  return card.type === "project" ? printed : Math.ceil(printed * SUPPORT_PRICE_SCALE);
}


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
 *   meme    the joke is the product; you hold it for the chart and the chat
 *   nft     you hold a picture, and there is a floor under it
 *   defi    money goes in and something happens to it
 *   infra   where all of that happens — the venues and the rails
 *
 * Four, and it was five until dex was folded into infra. A dex is a venue: you
 * do not take a position in it, you pass through it, and that is equally true of
 * a marketplace, of a toll and of the chain itself. Splitting the venues across
 * two sectors is what made infra a grab bag — "marketplaces and the tools
 * everything else runs on" described no single thing. Together they describe one:
 * the other three sectors are things you hold, and this is where you hold them.
 *
 * VVS says it on its own card, which is how the merge was settled: "The front
 * door of the chain, whether or not it meant to be."
 *
 * This replaced meme/memetility/lunar/machine, which were the tags the first
 * version of this game put on its own factions. Two of those named exactly one
 * faction each — lunar was the Howlers and machine was the Reckless Robots — so
 * they were not sectors at all, and the moment projects arrived that were
 * neither, there was nowhere to put them.
 *
 * The old note here said five and not four, "because nineteen families over four
 * sectors leaves one of them holding seven and another holding three". That was
 * a nineteen-family problem. The set is heading for thirty-four, and four sectors
 * now hold nine, ten, seven and eight — the evenest this list has ever been.
 *
 * TCG's set runs on eight (it added ai, politics, depin and gaming, and has no
 * dex). Those are its projects, not this game's, so the list stays at five and
 * anything ported from there has to be read against these names.
 */
export const SECTORS = ["meme", "nft", "defi", "infra"] as const;
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

/**
 * Something extra, once for every holder an effect actually moved.
 *
 * "Actually" is the whole reason this is a rider rather than a number on the
 * card: a position already at full holders heals none, and a position with one
 * holder left loses one however many the card asks for. Paying on the printed
 * amount would have the card promise what the board cannot give.
 *
 * Held to the two effects that are pure addition — market cap and budget. They
 * scale by multiplying, so one log line comes out instead of eight, and nothing
 * that touches the board can ride along.
 */
export type PerHolder =
  /**
   * Market cap straight up or down.
   *
   * `per` makes the amount a rate, the same way stealMC's does: multiplied by
   * how many projects you hold, not counting the card being played. A scale
   * rather than a threshold — with two you get something and with five you get
   * five times it, and there is no line to be just under.
   *
   * A sector counts only that sector; `"any"` counts the whole board. The
   * difference is not cosmetic: a deck leaning on one sector still averages
   * fewer than two of it on the table, so a sector rate pays a third of what a
   * board rate does and pays nothing at all about a quarter of the time.
   *
   * `"table"` counts both boards. Only one thing in this game sits underneath
   * both players at once and it is the chain — every card in the set happened on
   * it, which is a claim no project can make about another project's positions.
   *
   * `"sectors"` counts how many DIFFERENT sectors you hold rather than how many
   * projects. It is the only rate in the game that asks what your board is made
   * of instead of how big it is: six positions of one sector count once, and six
   * of six count six. An ordinary board holds 3.70 of them and can be pushed to
   * six, which makes it a deckbuilding decision rather than a dice roll.
   *
   * `"theirs"` counts the other player's board and not yours. Everything else
   * here is paid for what you have built; this is paid for what they have, which
   * is what selling shovels means — you do not need to be mining, you need
   * somebody else to be.
   *
   * `"turn"` counts nothing on the table at all: it is the turn number. A card
   * that pays a rate per turn is worth almost nothing on turn one and ten times
   * that on turn ten, which is what accruing looks like — people who left a tab
   * open for a year were paid for the year, not for the tab.
   *
   * It is the only value here that a player cannot change. Everything else on
   * this list is a board you build or they build; this one just runs.
   *
   * `"holders"` counts holders across your positions rather than positions. A
   * board carries 18.7 of them on average, against 5.3 positions, so the rate is
   * a fraction of the others — and unlike every other value here it falls when
   * you are attacked. It is the one rate somebody else can take away from you a
   * point at a time.
   *
   * `"spent"` counts the cards in your discard pile — everything you have
   * finished with, played or closed. It reads like `"turn"` and is not: a turn
   * count pays a player who has done nothing all game, and this one does not.
   * A pile holds 0.6 cards after three turns, 2.9 after five, 6.7 after seven
   * and 11.8 after nine, which is the shape of work rather than the shape of
   * time.
   *
   * `"plays"` counts the cards you have already played this turn, the card
   * asking included. It is the only value that measures what you are doing
   * rather than what you have, and the only one that resets every turn: a turn
   * holds 2.29 cards on average and the card is worth exactly that many times
   * its rate. playedThisTurnAtLeast asks the same question as a threshold and
   * fires or does not; this scales, which is the difference between a step and
   * a slope.
   */
  | { kind: "directMC"; target: TargetPlayer; mc: number; per?: PerRate }
  | { kind: "extraBudget"; target: TargetPlayer; mc: number; per?: PerRate };

export type TargetProject =
  | "ownProject"
  | "enemyProject"
  | "allOwnProjects"
  | "allEnemyProjects"
  /** Every project on the table, both sides. What makes an event an event. */
  | "allProjects"
  /**
   * Whichever of the opponent's positions yields the most, right now.
   *
   * Aimed by the card rather than by the player, which is the point of it: a
   * family that says it goes after the biggest should go after the biggest, not
   * offer a choice and hope. It also means such a card cannot be misplayed, and
   * that it gets stronger the better the other player builds.
   *
   * By yield rather than by rarity — a chipped mythic can be worth less than a
   * whole rare, and it is the paying that matters.
   */
  | "enemyBest";

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
    case "enemyBest":
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

/**
 * What a rate counts.
 *
 * One name because it is one idea, carried by directMC, extraBudget and
 * pumpProject alike. It was three copies of the same nine-way union written out
 * by hand, which is survivable until somewhere has to switch on it — and then
 * the place that renders the card face knew five of the nine and printed the
 * raw key for the rest. A name gives that switch something to be exhaustive
 * about.
 *
 * What each value counts is documented on directMC, where the union was first
 * written and where the reasoning still lives.
 */
export type PerRate =
  | Sector
  | "any"
  | "table"
  | "sectors"
  | "theirs"
  | "turn"
  | "holders"
  | "plays"
  | "spent";

export type Effect =
  /** Market cap straight up or down. A negative mc is a hit. */
  /**
   * Market cap straight up or down.
   *
   * `per` makes the amount a rate, the same way stealMC's does: multiplied by
   * how many projects you hold, not counting the card being played. A scale
   * rather than a threshold — with two you get something and with five you get
   * five times it, and there is no line to be just under.
   *
   * A sector counts only that sector; `"any"` counts the whole board. The
   * difference is not cosmetic: a deck leaning on one sector still averages
   * fewer than two of it on the table, so a sector rate pays a third of what a
   * board rate does and pays nothing at all about a quarter of the time.
   *
   * `"table"` counts both boards. Only one thing in this game sits underneath
   * both players at once and it is the chain — every card in the set happened on
   * it, which is a claim no project can make about another project's positions.
   *
   * `"sectors"` counts how many DIFFERENT sectors you hold rather than how many
   * projects. It is the only rate in the game that asks what your board is made
   * of instead of how big it is: six positions of one sector count once, and six
   * of six count six. An ordinary board holds 3.70 of them and can be pushed to
   * six, which makes it a deckbuilding decision rather than a dice roll.
   *
   * `"theirs"` counts the other player's board and not yours. Everything else
   * here is paid for what you have built; this is paid for what they have, which
   * is what selling shovels means — you do not need to be mining, you need
   * somebody else to be.
   *
   * `"turn"` counts nothing on the table at all: it is the turn number. A card
   * that pays a rate per turn is worth almost nothing on turn one and ten times
   * that on turn ten, which is what accruing looks like — people who left a tab
   * open for a year were paid for the year, not for the tab.
   *
   * It is the only value here that a player cannot change. Everything else on
   * this list is a board you build or they build; this one just runs.
   *
   * `"holders"` counts holders across your positions rather than positions. A
   * board carries 18.7 of them on average, against 5.3 positions, so the rate is
   * a fraction of the others — and unlike every other value here it falls when
   * you are attacked. It is the one rate somebody else can take away from you a
   * point at a time.
   *
   * `"spent"` counts the cards in your discard pile — everything you have
   * finished with, played or closed. It reads like `"turn"` and is not: a turn
   * count pays a player who has done nothing all game, and this one does not.
   * A pile holds 0.6 cards after three turns, 2.9 after five, 6.7 after seven
   * and 11.8 after nine, which is the shape of work rather than the shape of
   * time.
   *
   * `"plays"` counts the cards you have already played this turn, the card
   * asking included. It is the only value that measures what you are doing
   * rather than what you have, and the only one that resets every turn: a turn
   * holds 2.29 cards on average and the card is worth exactly that many times
   * its rate. playedThisTurnAtLeast asks the same question as a threshold and
   * fires or does not; this scales, which is the difference between a step and
   * a slope.
   */
  | { kind: "directMC"; target: TargetPlayer; mc: number; per?: PerRate }
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
  /**
   * Permanently raises the pump of the targeted projects.
   *
   * `per` is the same field, with the same meaning, that directMC and
   * extraBudget already carry: the amount is multiplied by how many *other*
   * projects you hold, of that sector or of any. Not a new name for an old idea —
   * a third effect reading the one that exists, because "per project you hold"
   * meaning two different things in two places is exactly the trap this set was
   * built to avoid.
   *
   * With `per` it stops being a flat bonus and becomes a card about how wide your
   * board is: nothing on an empty table, and on a full one it is the amount times
   * five, on every position at once.
   *
   * "On every position at once" is the half that is easy to read past, and it
   * makes this the only rate in the set that multiplies twice. directMC and
   * extraBudget pay `mc × others` once. This computes `mc × others` and then adds
   * it to every target, so with `allOwnProjects` the turn's total is
   * `mc × n × (n - 1)` — quadratic in the board, not linear. A board averages
   * 5.89 positions, which makes the multiplier about 29, not about 5.
   *
   * Seven cards use that combination and all seven are Okay Bears, whose numbers
   * were set as though it were linear: the epic printed $12K and paid $345K a
   * turn. They were rescaled on 2026-08-31 and every one of them is commented
   * with what it actually pays.
   */
  | { kind: "pumpProject"; target: TargetProject; mc: number; per?: PerRate }
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
  | {
      kind: "damageHolders";
      /**
       * `"all"` takes every holder the position has, whatever it started with.
       * The mirror of healHolders' `"full"`, and the honest way to write a card
       * that empties something — the alternative was a number large enough to
       * cover any position, which then printed "loses 99 holders" on the face.
       */
      amount: number | "all";
      target: TargetProject;
      perHolder?: PerHolder;
    }
  /**
   * Gives holders back, never above the card's starting count.
   *
   * `"full"` tops every target up to what it was printed with, which is a
   * different card from a large number: it is worth most on a board that has
   * been taken apart and nothing at all on one that has not, and it says so.
   */
  | {
      kind: "healHolders";
      target: TargetProject;
      amount: number | "full";
      perHolder?: PerHolder;
    }
  /**
   * Pays for every holder that came off any position, either side, all match.
   *
   * The one card in the set that is worth what the match has cost so far. It
   * makes a wipe into fuel — strip the table with one card and cash the wreckage
   * with the next — and it counts both boards on purpose, because a family whose
   * story is surviving the bear should be paid for the bear rather than for
   * having caused it.
   */
  | { kind: "mcPerHolderLost"; mc: number }
  /**
   * Pays for every position that has left the table, either side, all match.
   *
   * mcPerHolderLost's bigger brother, and a different card rather than a larger
   * one: a holder is chip damage and a position is something that finished. An
   * ordinary match costs 25 positions by the end and only 3 by turn six, so this
   * is worth almost nothing early and a great deal late — which is the whole of
   * what a card about outliving everything should be.
   *
   * Counted in removePosition, the one door a position leaves through, so it is
   * paid the same whether the position was banked, replaced, rugged or burned.
   */
  | { kind: "mcPerPositionGone"; mc: number }
  /**
   * Turns marketing budget you did not spend into market cap.
   *
   * A buyback. Budget is normally use-it-or-lose-it and worse than that — what
   * you leave on the table costs you, which is the rule that stops a player from
   * simply hoarding. This is the one thing in the game that answers it, and only
   * as a standing effect on a position somebody can take off you.
   *
   * Resolves before the waste is charged, so the budget it converts is budget
   * that would otherwise have been a penalty rather than nothing.
   */
  | { kind: "budgetToMC"; percentage: number }
  /**
   * Turns the pump your board yields this turn into market cap, at once.
   *
   * MOMENTUM'S MISSING PAYOFF, and it is missing for a measurable reason. A pump
   * is worth its rate times the turns the position survives, and a position
   * survives 3.05 turns on average — so a pump played on turn eight is worth
   * almost nothing, and a momentum deck's whole income arrives late, slowly and
   * only through positions somebody else can damage. Measured over 120 matches a
   * side: momentum ends on $2.17M against money's $4.36M, while its positions
   * earn more each than anybody else's ($243K against $143K). The cards are not
   * small. The income is thin, and it is thin at the end.
   *
   * This is the one thing that converts the build into score on the turn you
   * choose. It pays nothing on an empty board, which is what makes it a momentum
   * card rather than another way to be paid: it is worth what you built.
   *
   * Reads the same pump the turn phase reads, auras and damage included, so a
   * board somebody has been hitting cashes out for less — the position damage was
   * always meant to be worth something and against momentum it now is.
   */
  | { kind: "pumpToMC"; times: number }
  /**
   * Pays a share of every dollar of marketing budget you have spent this match.
   *
   * budgetToMC's mirror, and a different card rather than a larger one: that
   * pays for money you did NOT spend, this pays for money you did. Years of
   * trading fees handed back to the people who paid them.
   *
   * It is also the one thing in the set that makes a budget card worth playing.
   * Budget measured as a fine everywhere it appeared — two thirds of every gift
   * is still unspent when the turn ends and unspent budget comes off market cap
   * one for one — and this is the other side of that coin: the more of it you
   * managed to get through, the more this is worth.
   */
  | { kind: "refundMC"; percentage: number }
  /**
   * Closes one of your own positions and hits them for what it was worth.
   *
   * The card that turns your own board into ammunition. A rug takes what a
   * position earned back off its owner; this takes it off the other player
   * instead and hands you the position's earnings as the price of doing it.
   *
   * `keep` is what comes back to you, as a percentage of what the burned
   * position was worth. Left out it is nothing and the card is a pure sacrifice.
   * Above 100 you come back holding more than you gave up, which is the whole
   * claim DeGods ever made about itself.
   *
   * One field rather than a second effect kind, deliberately. A `burnAndReturn`
   * beside a `burnForDamage` would be two names for one mechanism, and this set
   * has already paid for what happens when two cards mean the same thing and the
   * engine only knows one of them.
   *
   * There was an `into: "budget"` here, paying the return as money to spend
   * rather than as score, and it is gone because it measured backwards: the card
   * got *worse* as it got more generous ($93K at 130%, $3.2K at 200%). Unspent
   * budget is charged against market cap at WASTE_PENALTY, one for one, and a
   * burn hands over more than a turn can possibly spend. The card was paying the
   * player in a fine. Nothing else in the set would have shown that.
   *
   * `returns` sends the burned project back to your hand instead of the discard.
   * You lose the position and everything it had earned, and you keep the card, so
   * the decision stops being whether to give it up and becomes when to relaunch.
   *
   * `allOwnProjects` is the only non-choice target this takes: every position you
   * have, at once, for the sum of everything they earned. There is nothing to
   * point at because there is nothing left over.
   */
  | {
      kind: "burnForDamage";
      target: ChoiceTarget | "allOwnProjects";
      keep?: number;
      returns?: boolean;
    }
  /**
   * Hangs something on a position that happens every turn from now on.
   *
   * The lasting mark, next to `after`'s counting one. It is how a card makes a
   * position get worse every turn instead of taking a lump out of it once —
   * being left holding something that keeps sinking — and equally how a position
   * of your own compounds instead of growing by a flat amount.
   *
   * It lives on the position and dies with it, so the answer to a decay somebody
   * hung on you is to close the position and take what it has made. That is a
   * real decision rather than a shrug, which is the point.
   */
  | { kind: "attach"; target: TargetProject; every: Effect }
  /**
   * Changes what a position pumps by a percentage of what it pumps now.
   *
   * Compounding, where pumpProject is flat. On a tick it is the difference
   * between a position that loses a fixed amount every turn and one that keeps
   * losing a quarter of what is left — which is what being a bagholder is.
   */
  | { kind: "scalePump"; target: TargetProject; percentage: number }
  /**
   * Closes every other position you hold and puts what they were worth onto the
   * one this card just opened.
   *
   * A merge. Everything they earned stays yours — this is not a rug, you are
   * closing them yourself — and everything they pumped moves across, so one
   * position ends up doing the work of six.
   *
   * It is a real decision rather than a free upgrade: six positions each take
   * their own damage and one takes all of it, so a board this card has been
   * played on is a board with a single point of failure standing in it.
   */
  | { kind: "merge" }
  /**
   * Copies the opponent's strongest position onto your board.
   *
   * A fork. It takes nothing from them — they keep theirs — and what you get is
   * worth whatever they have built, so it is a card that is weak against a
   * player who has built nothing and enormous against one who has built well.
   *
   * The copy comes as the card was printed: their pump bonuses, their damage and
   * their marks stay with the original. You have forked the project, not the
   * position.
   */
  | { kind: "fork" }
  /**
   * Lifts one of your positions to what the opponent's strongest one yields.
   *
   * The benchmark. Everything else in the game measures against a number the
   * card printed; this measures against whatever they have built, so it is worth
   * exactly as much as their best board and nothing at all against an empty one.
   *
   * `plus` is added afterwards and is the only part that works regardless. A
   * card with no plus is a pure mirror: it never overtakes them, it draws level.
   *
   * Never downwards. A position already yielding more than their best keeps what
   * it has and takes the plus — a floor is a floor, not a ceiling.
   */
  | { kind: "benchmark"; target: ChoiceTarget; plus?: number }
  /**
   * Look at the top of their deck and take one of those cards out of the game.
   *
   * The only card that touches a deck rather than a board or a hand, and the
   * only one whose choice is not a position — you are picking from a list the
   * other player cannot see either.
   *
   * `look` is how far down you see; the card you take is chosen from those.
   * A destroyed card goes to the discard, so it is out of this match and not
   * out of the deck the player owns.
   */
  | { kind: "peekAndBurn"; look: number }
  /**
   * Nothing now. This, in a few turns.
   *
   * The first thing in the game that a card sets going rather than does. It
   * changes what a turn is: a threat on the table that both players can see
   * coming, that the other player has turns to answer, and that you have to
   * still be alive to collect. Everything else in the set resolves the moment it
   * is played.
   *
   * When the wrapped effect aims at a position, the position is remembered by
   * its project rather than by its slot — slots shift the moment anything closes
   * and a mark that followed a number would land on whatever moved into it.
   * `ifGone` is what happens when the marked position is not there any more,
   * which is the difference between a card that punishes you for leaving
   * something standing and one that pays you for taking it down.
   */
  | {
      kind: "after";
      turns: number;
      /**
       * Something that happens straight away, before the waiting starts.
       *
       * A timer with no `now` is a threat; a timer with one is a bargain — this
       * much, and the bill in a few turns. That is a different card and the set
       * could not write it: a card carries one effect and one payoff, and the
       * payoff needs a condition, so "always, and then later" had nowhere to go
       * except a condition that was never really a condition.
       */
      now?: Effect;
      effect: Effect;
      /**
       * A position to put a mark on, chosen when the card is played.
       *
       * Separate from what the effect does, because those are two different
       * things and the first version conflated them. Going short marks one of
       * their positions and then pays *you* — the mark says what the timer is
       * watching, the effect says what happens to whom. Inferring the mark from
       * the effect's target worked for a card that damages what it marked and
       * quietly could not express the other one at all.
       *
       * When the effect aims at a project too, it lands on the marked position:
       * one choice, one mark, one target.
       */
      marks?: ChoiceTarget;
      /** What happens instead when the marked position is gone. Needs `marks`. */
      ifGone?: Effect;
    }
  /** Removes a project from the board immediately, however many holders it has. */
  | { kind: "rug"; target: TargetProject }
  /**
   * Takes people and tools off the board, biggest name first.
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
  /**
   * Moves a percentage of the opponent's market cap to you.
   *
   * `per` makes the percentage a rate instead of an amount: it is multiplied by
   * how many projects of that sector you already hold, not counting the card
   * being played. "Ten percent for every other meme you have out" is one card
   * that reads differently on turn two and turn eight, and it asks the deck to
   * have been built a way — which a flat percentage never does.
   *
   * Optional, so the sixty-seven cards that already steal are untouched.
   */
  | { kind: "stealMC"; percentage: number; per?: Sector }
  /**
   * Market cap for being behind, in proportion to how far behind you are.
   *
   * A share of the gap, not a flat amount over a threshold. `behindBy` already
   * exists as a payoff condition and it is a gate: it opens at $450K and pays
   * the same at $450K as at two million, so the card is at its weakest exactly
   * when the match is at its worst. This is the other shape — it is worth
   * nothing when the scores are level and more the further under you are, which
   * is what a comeback card is supposed to feel like.
   *
   * Nothing is taken off the other player. A card that both hands you the gap
   * and takes it off them closes twice the distance it reads as, and two of
   * those in a hand turns a losing board into a winning one in a turn.
   *
   * Zero when level or ahead, so it can never widen a lead and never needs a
   * condition wrapped round it.
   */
  | { kind: "comebackMC"; percentage: number }
  /**
   * Scales market cap by a signed percentage. Unlike a flat amount this is not
   * symmetric when it hits both players: +20% widens whoever is ahead, -20%
   * narrows it. That is what makes a market-wide event a decision rather than a
   * wash.
   */
  | { kind: "scaleMC"; target: TargetPlayer; percentage: number }
  /**
   * A share of the highest market cap you have reached this match.
   *
   * Paid on what you got to rather than on what you are holding, so being
   * knocked back down does not take it away. The only thing in the set that
   * rewards a peak.
   */
  | { kind: "peakMC"; percentage: number }
  /**
   * A share of everything your board has produced and you have not banked.
   *
   * `earned` is on every position: its launch plus every pump it has paid out,
   * and it is the number the position has on the line. Take profit and you keep
   * it; let it rug and it comes straight back off your market cap. The type for
   * BoardProject says realised against unrealised is the whole subject of this
   * game, and until now nothing in the set was paid on it — the field was read
   * by a merge, a bank, a severance and a rug, and by no card.
   *
   * It is the one number that grows on its own without being a turn count. A
   * board holds a median of $40K unbanked on turn two, $391K on turn five and
   * $1264K on turn ten, so a percentage of it is a card that is small early and
   * large late without needing a threshold to say so.
   *
   * And it is honest about the risk, which is what MYRO is for: this pays you
   * for value you have chosen to leave where a rug can still reach it. Bank the
   * position and the money is safe and this stops counting it.
   */
  | { kind: "unbankedMC"; percentage: number }
  /** Draw extra cards. */
  /**
   * Cards off the top of the deck, into a hand.
   *
   * `target` is optional and defaults to you, so the cards that already draw are
   * untouched. "Both" is the one that needed adding: a card that hands the other
   * player something is a shape the set could not express, and it is the whole
   * idea behind a family built on the airdrop — the coin that became worth a
   * billion because it was given away.
   */
  | { kind: "drawCards"; amount: number; target?: TargetPlayer }
  /**
   * Cards out of a hand, chosen at random by the state's own PRNG.
   *
   * The mirror of drawCards and the thing the set had no way to say: 90 cards
   * fill your hand and, until this, two cards in the whole game could empty
   * anybody else's — and both of those were standing auras rather than something
   * you could play. A hand is the one place no tactic reached.
   *
   * Random because the player doing it cannot see the hand either. Through
   * nextInt and state.rngState like every other roll here, so a match still
   * replays exactly from its seed and its moves.
   */
  | { kind: "discardCards"; target: TargetPlayer; amount: number }
  /**
   * Brings the oldest card in your discard pile back to your hand.
   *
   * The one direction the set could not go. Cards leave a hand by being played,
   * thrown away or taken, and every one of those doors is one-way: 90 cards fill
   * a hand from the deck and nothing at all fills it from the pile of things you
   * have finished with. A discard was where cards went to stop existing.
   *
   * THE TOP OF THE PILE — what you finished with last. That is the whole card
   * rather than a detail, and it was the other way round first.
   *
   * Oldest-first was chosen on the reasoning that newest-first would be a
   * rewind: play the big one, take it back, play it again. That reasoning was
   * wrong about this game. A project you play does not go to the discard, it
   * goes to the board — the pile fills with positions you have CLOSED, tactics
   * that have resolved and cards you threw away. There is nothing on top to
   * rewind to. 92% of everything recovered is a project, which is to say a
   * position you took profit on and can now rebuild.
   *
   * It is also the better half of the pile, and that is why it changed. You
   * spend your cheap cards first, so the old end is systematically the common
   * end: recovering the oldest handed back the cheapest card in the player's
   * hand 50% of the time and their most expensive 19%, and half of it was
   * commons. From the top those read 38%, 35% and 23%, with epics up from 19%
   * to 42%. Same 4.6 points for the family, same monotone ladder, better card.
   *
   * No choosing. A chooser needs somewhere to choose and the only question this
   * game asks is "which position"; the pile is ordered, so the top is an answer
   * the engine can give on its own. Asked and settled: 81% of what comes back is
   * played again and only 4% is a duplicate of a project already standing, which
   * was the actual worry about handing back something useless.
   */
  | { kind: "recoverCard"; amount: number }
  /**
   * Takes a position off the opponent's board and puts it on yours, holders,
   * built-up pump and all.
   *
   * The community takeover, which is a real thing that happens down there and
   * which the set already had three cards about — all of them doing something
   * else, because there was no way to express it. A project changes hands; it
   * does not die.
   *
   * Refused when your portfolio is full rather than silently discarding
   * something, and it takes their strongest position, which needs no pointing
   * and is the same rule `cancel` already uses for the support row.
   */
  | { kind: "takeOver" }
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
  | { kind: "extraBudget"; target: TargetPlayer; mc: number; per?: PerRate };

export type EffectKind = Effect["kind"];

/**
 * A standing bonus from a person. Deliberately not an Effect: an aura works
 * every turn during the pump phase, not once when played. Were it part of Effect,
 * `applyEffect` would need a branch for it that does nothing — and exactly that
 * kind of silent branch left 110 cards dead in Cards of Cronos.
 *
 * There was one variant here for a long time, and sixty influencers built on it
 * were sixty cards that differed only in a sector and a number. The maker put
 * the question plainly — is that boring? — and it is: an aura that can only add
 * to a sector makes every name in the game the same card at five sizes.
 *
 * A second variant is not the answer to that on its own. It is the shape the
 * answer takes: an Aura is a union now, so a new standing rule is a variant plus
 * whatever the compiler then insists on, rather than a special case bolted onto
 * the one that existed.
 */
export type Aura =
  /** Adds to every project of a sector, every turn. The original, and still 59 of 61. */
  | { kind: "pumpSector"; sector: Sector; bonus: number }
  /**
   * The same thing across more than one sector, for a person whose taste does
   * not sit in a single column.
   *
   * Every sector aura in the game named exactly one, which made every person who
   * carried one a specialist. Some of them are not. The maker's note about Pampa
   * was that he reads as somebody who lifts infra and defi rather than memes, and
   * there was no way to say that: the only shape available forced a choice
   * between the two and printed a card that was wrong either way.
   *
   * The bonus is per sector, and what it should be was measured rather than
   * assumed. The obvious rule — two sectors, so a smaller number than a
   * specialist gets — turns out to be wrong here, because sectors are not the
   * same size: meme holds 120 projects and nft 112, while infra holds 64 and
   * defi 48. Pampa reaching both of the small ones is 112 projects against the
   * 120 a meme specialist reaches, so he is buying no extra reach at all and his
   * bonus stays in the ordinary epic band. A pair that included meme or nft
   * would be buying reach and would have to pay for it. Measure the pair.
   *
   * A single-entry list is deliberately not allowed — that is `pumpSector`, and
   * two ways to write the same card is the "one name, two meanings" trap this
   * codebase is built to refuse. validateSet rejects it.
   */
  | { kind: "pumpSectors"; sectors: readonly Sector[]; bonus: number }
  /**
   * A sector aura with a favourite: it lifts the sector like any other, and it
   * multiplies the pump of your projects from these families on top.
   *
   * The multiplier is the point — a person identified with one thing does not
   * lift a sector evenly, they lift the thing that carries their name. The flat
   * part is why the card is playable at all, and it was measured rather than
   * assumed. A champion with no floor is dead in 63% of decks: a family is eight
   * cards in a set of 775, and a forty-card deck holds 0.43 of them on average.
   * Trump survives it only because he names four families and reaches eighteen
   * cards, and even he is blank in 36%.
   *
   * DESIGN.md already had the rule and this variant shipped ignoring it for a
   * day — "a card whose effect only fires under a condition is a card that is
   * dead in most hands, and dead cards are what this set is built to avoid. A
   * condition sits on a *bonus* instead." The condition sits on the bonus now.
   *
   * Families are named by ticker, not by project id, and that is the difference
   * between a card that reads right and one that nearly does. The id of the
   * pump.fun family is `pump-fun` and Jupiter's is `jupiter`; the cards say
   * PUMPFUN and JUP. Printing the id gave "Your PUMP-FUN cards pump twice as
   * hard" — a promise about a name no card in the game carries.
   *
   * Ticker to family is 1:1 across all 155 families, checked at load rather than
   * assumed, so the ticker is a real key and not a convenient label. Every one
   * is checked against the set too: a misspelt family would be an aura that
   * silently multiplies nothing, which is the exact failure this codebase is
   * arranged against — see validateAura.
   *
   * Naming a family on the card face is a deliberate exception and was put to the
   * maker as one. The rule for this set is that a card must not say which deck it
   * strengthens — synergy is something the player finds while building, not
   * something printed on the front — and these seven break it out loud: "Your
   * BONK cards pump twice as hard". Asked directly on 2026-09-01 whether to strip
   * the tickers, he kept them: they fit the people. Bonk Guy is the BONK guy and a
   * card that will not say so is a worse card than one that breaks the rule.
   *
   * So the rule stands everywhere else and this is the seven-card exception, with
   * the reason on the record. They measure at a median of $136K, the second
   * highest of the eleven aura kinds.
   *
   * The multiplier lands on the position's own pump before any sector bonus is
   * added, including this card's own. Otherwise a champion reaches through into
   * every other supporter on the table and two identical boards score
   * differently depending on play order. See pumpOf, the only place it is read.
   */
  /**
   * Marketing budget, every turn, whatever the board looks like.
   *
   * The first aura that pays in something other than market cap, and the reason
   * the union needed a third and fourth member rather than a third: 47 of the 60
   * influencers said "your X pumps $Y more per turn" and nothing else, because
   * an aura could only ever add to a pump. That is a shape problem, not a
   * writing problem.
   *
   * Double-edged on purpose and it needs no drawback written on it. Budget that
   * is not spent is charged against market cap at WASTE_PENALTY, and that charge
   * decides matches — so a card handing you money late, when your hand cannot
   * absorb it, is handing you a bill. See extraBudget, which is the one-off.
   */
  | { kind: "budgetEachTurn"; budget: number }
  /**
   * Extra cards drawn at the top of every turn, on top of the ordinary refill.
   *
   * This was a bigger *hand* first — raise the cap drawToFull fills to — and it
   * was measured and thrown away. A hand is only full on 38% of moves, so a
   * bigger cap did nothing on three moves in five, and the bot played Threadguy
   * on half his draws where other mythics go down nine times in ten. It was
   * right: the card was worth about 38% of what it looked like.
   *
   * Drawing lands whatever the hand holds, which is the difference. Whole cards
   * only — there is no half a card to deal.
   */
  | { kind: "drawEachTurn"; cards: number }
  /**
   * A sector aura that also mends your damaged positions every turn.
   *
   * The only aura that pays in survival rather than income — a position that
   * keeps its holders keeps paying, and holders are also what a position pays
   * *in proportion to*. Capped at each card's starting count, so it repairs and
   * never inflates.
   *
   * It carries a floor for the same reason the champion does, and it is the same
   * mistake caught a second time by measurement rather than by thought: healing
   * is worth nothing on an undamaged board, so on turn one this card does
   * literally nothing. Without the floor the bot played Mert on 33% of the draws
   * where he was legal, against 68 to 83% for every other legendary, and it was
   * right to. Budget and a bigger hand need no floor — you always have a budget
   * and always have a hand — which is the test for whether a floor is wanted.
   */
  | { kind: "healEachTurn"; sector: Sector; bonus: number; holders: number }
  /**
   * Taking profit pays, on top of what the position had already earned.
   *
   * Banking protects market cap rather than adding any — everything a position
   * earns is credited as it earns it, and closing only stops a rug taking it
   * back. So the move is a hedge you pay a third of a turn for, and a hedge is
   * not a strategy. This makes it one.
   *
   * It carries a sector floor for the same reason the champion and the healer
   * do, and by now the pattern needs no defending: a card that only pays when
   * you do a particular thing is dead in every deck that does not do it.
   */
  | { kind: "bankPays"; sector: Sector; bonus: number; mc: number }
  /**
   * One more portfolio position while this holds a place in support.
   *
   * The only aura that changes a rule of the game rather than a number in it.
   * Worth nothing until your portfolio is full, which is the shape of a
   * build-around: it pays exactly when you have already committed to filling the
   * table.
   */
  | { kind: "morePositions"; positions: number }
  /**
   * Marketing budget handed to your opponent, every turn.
   *
   * A gift and an attack in one, and it carries both halves of the trap on the
   * same card: it hands them money *and* multiplies what unspent budget costs
   * them. Split across two cards it was a combo, and a combo is a dead card
   * until the other half turns up — the bot played neither of the two gift cards
   * once across eight hundred matches, and it was right not to, because handing
   * somebody money with nothing to punish it is a present.
   *
   * The same lesson as the champion aura and the healer, for the third time: a
   * card that only works under a condition has to carry the condition itself.
   */
  | { kind: "giftBudget"; budget: number; times: number }
  /**
   * Your opponent pays more for the budget they fail to spend.
   *
   * Multiplies WASTE_PENALTY on their side only. The rule it leans on already
   * decides matches — in mirrored decks the thriftier player takes 74.7% of the
   * ones that are decided — so this does not add a new pressure, it turns up one
   * that is already there.
   */
  | { kind: "punishWaste"; times: number }
  /**
   * Holders off your opponent's board, every turn, on a position chosen at
   * random.
   *
   * Random through the state's own PRNG, so a match remains replayable from its
   * seed and its moves — there is no hidden randomness anywhere in this engine
   * and this does not introduce the first of it.
   *
   * Chip damage that never stops is a different thing from a tactic that hits
   * once, and the numbers here are small on purpose: a whole match of attacks
   * nets about 5.84 holders, so one a turn from one card is already the weight
   * of half the attacking in the game.
   */
  | { kind: "stripHolders"; holders: number }
  /**
   * Cards out of your opponent's hand, every turn, chosen at random.
   *
   * The only aura that touches a hand rather than a board. Random for the same
   * reason and by the same PRNG — and here it is also the honest model, since
   * the thing doing the destroying cannot see what it is destroying either.
   */
  | { kind: "burnHand"; cards: number }
  | {
      kind: "championProjects";
      sector: Sector;
      bonus: number;
      /** Project families, by the ticker printed on their cards. */
      tickers: readonly string[];
      times: number;
    };

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
  /**
   * The opponent cannot take profit, which is a narrower thing than it reads.
   *
   * There are two doors out of a position and this shuts the smaller one. A
   * match closes 18.5 positions to free a slot and takes profit deliberately 1.9
   * times, so this blocks 9% of the ways a player leaves a position on purpose —
   * banRoom below shuts the other 91%.
   *
   * Measured on a plain rare carrying nothing else, 300 seeds: **-$15K**. It is
   * the only standing rule in the game that is worth nothing, against $150K for
   * the next cheapest and $1696K for banRoom. Nine cards carried it and several
   * had been priced as though it did something; the bot priced every rule at a
   * flat $40K until the same afternoon, which is how that survived.
   *
   * It is not broken and it is not a lie — it does exactly what it says. It is
   * small. Print it as a rider on a card that already works, never as the
   * payload, and never write "nobody gets out" above it.
   */
  | { kind: "banTakeProfit" }
  /**
   * The opponent may not close a position to make room for another.
   *
   * The other half of "nobody sold", pointed across the table. Every other
   * standing rule here makes something cost more or forbids a card type; this
   * one aims at the thing the game actually runs out of. A side closes a
   * position to free a slot 82.5% of the times a position leaves at all, and a
   * player whose portfolio is full and who cannot clear it has stopped being
   * able to launch anything.
   *
   * Not a lock on the whole game: take profit is a separate door and stays open,
   * so there is always a way out — it costs a turn action and banks the position
   * instead of discarding it, which is exactly the deliberate, expensive version
   * of the move this forbids.
   */
  | { kind: "banRoom" }
  /**
   * Everything costs the opponent more to play.
   *
   * The third kind, and the first that is not a switch. Both of the others are
   * binary — a card is playable or it is not — which makes them swingy at the
   * top and pointless at the bottom, and is why there were two of them in seven
   * hundred and fifty cards. A tax bends a turn instead of ending it, so it can
   * sit on a common without either ruining a match or doing nothing.
   *
   * It is also in the currency that decides this game. Hands run at 3.94 against
   * a cap of five, so nobody is short of cards; everybody is short of budget, and
   * a measured 15% on every card they play is worth more than a ban on a type
   * they might not be holding.
   */
  | { kind: "taxPlays"; percent: number };

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
  /**
   * Your market cap is at least this far above the opponent's.
   *
   * The mirror, and it needs handling differently from its reflection. behindBy
   * is self-correcting — it pays the player who is losing, so it narrows a match
   * and lowers variance. This one widens. Paired with a percentage effect it
   * would double-dip, because a percentage of your own market cap is also worth
   * most exactly when you are ahead, so the two halves would be large at the
   * same moment rather than at opposite ones.
   *
   * So: flat amounts only, and modest. Pressing an advantage should be a real
   * choice and not a card that wins a match it was already winning.
   */
  | { kind: "aheadBy"; mc: number }
  /** You hold at least this many projects in one sector. */
  | { kind: "ownProjectsInSector"; sector: Sector; atLeast: number }
  /** You hold at least this many projects, whatever they are. */
  | { kind: "ownProjectCount"; atLeast: number }
  /**
   * The position this card was aimed at yields at least this much per turn.
   *
   * The only condition here about a single position rather than about a board or
   * a score, and the one a family built on stacking everything onto one project
   * actually needs. Read after the effect, so a card that pumps a position can
   * push it over its own line — which is the card doing what it says in the
   * order it says it.
   *
   * Only meaningful on a card whose effect aims somewhere. Validation refuses it
   * anywhere else, because a condition that can never be answered is a payoff
   * that never fires, and this project has just spent a morning finding one of
   * those.
   */
  | { kind: "targetPumpsAtLeast"; mc: number }
  /** It is this turn or later. */
  | { kind: "turnAtLeast"; turn: number }
  /**
   * It is this turn or earlier.
   *
   * The other end of the match, which nothing could ask about. Every condition
   * here was about having more of something, and a card that is worth most
   * before anybody has built anything had no way to say so.
   */
  | { kind: "turnAtMost"; turn: number }
  /**
   * The position this card was aimed at has stood for this many turns.
   *
   * Reads playedOnTurn off the position, so it counts the turn it landed as one.
   * A position played this turn has stood for one; a position from three turns
   * ago has stood for four.
   */
  | { kind: "targetHeldFor"; turns: number }
  /** You are holding at least this many cards. */
  | { kind: "yourHandAtLeast"; cards: number }
  /**
   * This is at least the Nth card you have played this turn.
   *
   * Counted after the card is down, so the card asking is itself the Nth. The
   * only condition in the game about the order you do things in rather than
   * about what is on the table — play the cheap one first and the expensive one
   * collects, or the other way round if you were rich enough already.
   */
  /**
   * This card took over one of your positions rather than opening a new one.
   *
   * The set has had upgrades since it was written — a bigger card of a project
   * takes the position and inherits what it had built — and nothing had ever
   * paid for doing it. deck.ts says why it needed paying for: a deck holding all
   * eight cards of one project wins 12.8% against 57.3% for a deck holding one,
   * because every extra copy sits dead in hand until the position is there.
   *
   * A card that pays for the upgrade is the one thing that makes bringing
   * several worth it, and it is worth exactly one family rather than a rule.
   */
  | { kind: "upgraded" }
  | { kind: "playedThisTurnAtLeast"; cards: number }
  /**
   * This is at most the Nth card you have played this turn.
   *
   * The other direction, and it buys the one kind of turn the set could not ask
   * about: a quiet one. Every condition here rewards doing something, and
   * playedThisTurnAtLeast rewards doing a lot of it — this rewards having done
   * almost nothing, which is only worth anything because a turn spent doing
   * nothing is a turn of budget going to waste.
   *
   * Counted after the card is down, so the card asking is itself the Nth: "at
   * most one" means this was the only thing you played.
   */
  | { kind: "playedThisTurnAtMost"; cards: number }
  /** Your discard pile holds at least this many cards. */
  | { kind: "discardAtLeast"; count: number }
  /**
   * You have closed at least this many positions on purpose.
   *
   * The condition that makes banking a plan rather than a hedge. Taking profit
   * costs a third of a turn and gives up every turn of pump the position had
   * left, so on its own it is almost never right — the move has existed since
   * the engine was written and nothing in seven hundred and fifty cards had a
   * reason to make anybody want it.
   *
   * Only deliberate closes count. A position that rugs is not banked, and
   * neither is one replaced to make room for another: the number means "you
   * chose this", which is what every card reading it is really asking.
   */
  /**
   * At least this many holders have come off any position, either side, all
   * match.
   *
   * The condition the set was missing. mcPerHolderLost has read `holdersLost`
   * since it was written and nothing could ask about it, so a card that wanted
   * to pay for wreckage had to be blank on a clean table — measured at 29% of
   * the times PNUT's epic was played, which is what stopped it reaching its
   * rarity. Counts both boards for the same reason the effect does: a match is
   * expensive whoever did the damage.
   */
  | { kind: "holdersLostAtLeast"; holders: number }
  | { kind: "bankedAtLeast"; count: number }
  /**
   * You have taken profit no more than this many times.
   *
   * The other direction, and it buys a kind of card the set had no way to write:
   * one that pays you for not having sold. Every condition here rewards doing
   * something; this rewards having refused to, which is only a reward because
   * taking profit is a good move — you bank what a position made before somebody
   * rugs it. A card that pays you to leave it on the table is asking for
   * something real.
   */
  | { kind: "bankedAtMost"; count: number }
  /**
   * Your opponent is holding this few cards or fewer.
   *
   * The condition a denial deck had no way to ask for, and without it denial was
   * not a strategy but a tax. The arithmetic is unforgiving: taking a card a turn
   * costs the other player about 15K of budget they cannot place, ten times over,
   * while a building effect on the same card is worth two to four hundred
   * thousand. Denial has to deny more than building builds, and on its own it
   * does not — BAD ACTOR built to 1.67M against a good deck's 2.29M and lost
   * every matchup that mattered.
   *
   * So the cards that empty a hand now pay for having emptied it. A plan needs a
   * payoff or it is only an inconvenience.
   */
  | { kind: "theirHandAtMost"; cards: number };

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
  /**
   * Which moment of this thing the card is: "The Pink Hat", "Korea Woke Up",
   * "A Dollar Fifty".
   *
   * The name stays in `name` and is the same across the whole ladder, so WIF is
   * the headline and the moment is the subtitle — the way a card game names a set
   * of cards about one thing. Without this a family was only visible if you
   * happened to know that "The Pink Hat" and "Top Dog" were both WIF, which is a
   * naming convention rather than a fact about the card, and naming conventions
   * drift.
   *
   * On CardBase since 2026-09-01. It lived on ProjectCard, because on the day it
   * was written a project was the only thing in the set that had more than one
   * card. Then eight influencers grew ladders and Ansem at common needed to say
   * which Ansem it was for exactly the same reason WIF did.
   *
   * Absent on anything that is a single card, where there is no moment to
   * distinguish.
   *
   * In Cards of Cronos the moments are numerals — "I" to "VIII" — and not
   * pieces of history. Writing eight true things about every project means
   * knowing all twelve of them that well, and inventing them instead puts words
   * in a real project's mouth. The field does the same work either way: it makes
   * every card of a family nameable on its own, which validation.ts requires
   * because two commons under one name would make a log line mean either.
   */
  moment?: string;
}

export interface ProjectCard extends CardBase {
  type: "project";
  /**
   * Which project this card is a card *of*.
   *
   * A project is a thing that exists on Cronos; a card is one moment of it. A
   * family is one project across eight cards — two commons, two rares, two
   * epics, a legendary and a mythic — and they are different cards with
   * different costs and different effects, not one card at eight power levels.
   *
   * This is what lets the rules know two cards are the same project, which is the
   * whole reason the field exists: a deck may hold only so many of one project,
   * and only one of them can hold a position at a time. Without it those rules
   * cannot be written, and eight of one family on one board is not a game.
   */
  project: string;
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
  /**
   * Optional effect that fires every turn, for as long as this holds an
   * undamaged position — the same "while untouched" test the restriction uses,
   * so both answer to the same thing and a card that pays every turn can be
   * taken off it the same way a lock can.
   *
   * This is where a project stops being a number that ticks up and becomes a
   * card with a clock on it. "While this stands, it takes five percent of their
   * market cap every round" is a threat the other player has a turn to answer,
   * which a one-off effect never is, and answering it is a play rather than a
   * shrug: knock a holder off and the tap closes.
   *
   * Deliberately narrower than a played effect. Validation holds it to effects
   * that need no choosing and cannot repeat themselves into nonsense — nothing
   * takes a position every turn, nothing rugs every turn.
   */
  standing?: Effect;
  /**
   * A cut of everything the other player gains, for as long as this stands.
   *
   * The only thing in the game that happens on somebody else's turn. Where a
   * standing effect fires once a turn on a schedule, a toll fires whenever they
   * gain — twice in a turn if they gain twice, and not at all if they gain
   * nothing. It punishes exactly the player who is doing well, which is a shape
   * the set had no way to write.
   *
   * Undamaged only, like every other standing rule, so it has an answer on the
   * table. And never charged on another toll's collection: two players each
   * holding one would otherwise pay each other forever.
   */
  toll?: { percentage: number };
  /**
   * Something that happens when the other player plays a card of this type.
   *
   * The second thing in the game that fires on somebody else's turn. A toll
   * watches what they gain; this watches what they do — and because it is paid
   * per card rather than per turn, it hits a player spending a big budget hard
   * and a careful one not at all.
   *
   * Undamaged only, like everything else that stands.
   */
  onTheirPlay?: { cardType: CardType; mc: number };
  /**
   * Something that happens when *you* play a card, any card.
   *
   * onTheirPlay the other way round, and a different card rather than a mirrored
   * one: that punishes the other player for being busy, this pays you for it. It
   * is the first thing in the set that rewards tempo instead of ownership —
   * everything else measures your board, your market cap or theirs, and this
   * measures how much you are doing.
   *
   * No cardType. A framework everything gets built on does not care what you
   * built, and a rate that only counted projects would be a second, quieter way
   * of saying "per position" — which the set already has three of.
   *
   * The card that carries it is paid for its own launch too. It is on the table
   * by the time the payment is collected, and a fund that did not take a fee on
   * its own deal would be a strange fund.
   *
   * Undamaged only, like everything else that stands, so there is an answer to
   * it on the table.
   */
  onYourPlay?: { mc: number };
  /**
   * A share of every dollar of marketing budget the OTHER player spends.
   *
   * Jupiter's toll takes a cut of what they gain; this takes a cut of what they
   * pay. A toll is charged on winning and a tip is charged on doing anything at
   * all, which is why the flavour is what it is: you have paid it on every trade
   * you ever made here.
   *
   * It is also Magic Eden's rebate pointed the other way. That one hands a
   * player back a share of their own spending; this one hands their spending to
   * somebody else. The two read off the same door, so a match with both on the
   * table pays out of one number twice and neither of them has to know about the
   * other.
   *
   * Collected in spendBudget, undamaged only, and never taxed.
   */
  tip?: number;
  /**
   * A share of every move the other player's market cap makes, either way.
   *
   * A toll is charged on what they gain. A tip is charged on what they spend.
   * This is charged on the number moving at all — up or down, their good turns
   * and their bad ones — because an oracle publishes the price and does not care
   * which way it went. When you got closed out, this is the number that closed
   * you.
   *
   * It is the only thing in the set paid for somebody else's losses, which makes
   * it the one rule that gets better the more the table is on fire. Read at
   * changeMC, the door every market cap move already goes through, and never
   * charged on another reaction's payment — two of these facing each other would
   * otherwise read each other forever.
   */
  oracle?: number;
  /**
   * Prints "Useless." where the rules would be.
   *
   * Twenty-five projects in the set already have an empty rules box, and they
   * are not making a point — they simply have no effect. This is the one that
   * is: a card whose whole pitch is having no utility, saying so in the place a
   * card says what it does.
   *
   * A word rather than a blank, because a blank reads as an oversight and this
   * is a decision. And a flag rather than free text, because free text is text
   * that can drift from the card — the thing this file exists to prevent.
   *
   * Validation refuses it on any card that actually does something, so the word
   * cannot become a lie.
   */
  useless?: true;
  /**
   * Room for more positions, for as long as this one stands undamaged.
   *
   * The portfolio is the binding constraint of the whole game and no project
   * card could touch it: measured, 20.83 positions a match are closed by their
   * own owner to make space, against 1.53 lost to damage and 0.54 to a rug. An
   * aura on a supporter could raise the cap; nothing on a board could.
   *
   * The price is built in and is the good part. The card that makes room takes a
   * slot itself, and one holder of damage puts you over your own limit — so the
   * other player does not have to destroy it, only touch it, and your next card
   * costs you a position.
   */
  morePositions?: number;
  /**
   * Every move of your own market cap, multiplied — up and down alike.
   *
   * The only thing in the set that makes the other player stronger. Your pump,
   * your launch and what you take off them all arrive larger; every steal, every
   * rug and every toll against you costs more by the same amount.
   *
   * Buildable at all only because market cap now moves in one place. A
   * multiplier applied in ten places would be a multiplier that missed one, and
   * the miss would be silent — which is the same reason the toll needed that
   * door first.
   *
   * A percentage, and it stops the moment the position is chipped. That leaves
   * the other player a real choice rather than a chore: take a holder off and
   * put them back to normal, or leave it standing and beat them to death with
   * it.
   */
  leverage?: number;
  /**
   * Market cap you lose, reduced — collateral that does not have to be sold.
   *
   * The first defence of a score rather than of a board. Everything else that
   * protects in this game protects a position: holders, healing, a standing
   * rule. Half a sector takes market cap directly — steals, rugs, tolls, the
   * charge for budget left on the table — and until now nothing answered any of
   * it.
   *
   * Applied after leverage, which is the order the two read in: the lever moves
   * the number further and the vault absorbs part of the fall. Losses only; a
   * gain is a gain.
   */
  shield?: number;
  /**
   * While this holds an undamaged position, no standing rule on the other side
   * of the table applies to you.
   *
   * The answer to a lock, and the set had none. Every restriction here is
   * lifted the same single way — take a holder off the position carrying it —
   * which is an answer aimed at the card rather than at the rule, and it fails
   * exactly when the rule is the reason you cannot act. A tax you cannot afford
   * to play through is a tax you cannot play through in order to remove.
   *
   * Live enough to matter and not so live it dominates: a player begins 31% of
   * turns under somebody's standing rule, 24% by turn four and 52% by turn ten.
   * Sixty percent of that is taxPlays, twenty is a banned card type and nineteen
   * is not being allowed to close a position.
   *
   * Undamaged only, like every other standing thing, so it is not a lock either.
   * The card that says nothing can stop you can itself be stopped, by exactly the
   * move that stops everything else here.
   */
  uptime?: true;
  /**
   * This card's standing rule binds you too.
   *
   * Every restriction in this game points across the table, and the type says so
   * on purpose: "a card that restricted its own side would be a drawback, and
   * drawbacks belong in the numbers rather than in a rule nobody can see
   * coming". That is right about a hidden drawback and wrong about a printed
   * one. "Neither player may take profit" is one sentence, it reads off the
   * card, and it is the only honest way to write the thing that actually
   * happened to Serum: the upgrade key sat in a multisig that stopped existing,
   * and nobody could rotate it. Not them. Not you either.
   *
   * It makes the card a decision rather than a cost. A lock both sides live
   * under is worth playing when their board needs the door more than yours
   * does — and the same card is a mistake on the turn that stops being true.
   *
   * Uptime does not save you from your own. Nothing on their table applies to a
   * player running Firedancer; the key you cannot rotate is on your table, and
   * the whole point is that there is no key.
   */
  mutual?: true;
  /**
   * Everything this player plays, cheaper — the mirror of `taxPlays`.
   *
   * A tax is charged by the other side of the table and a discount is not; that
   * is the only difference, and it is why both belong at the same door. Read in
   * `priceFor`, after the tax, so a discount also cuts what the other player is
   * charging you. That is what "everything costs less" says on the card, and a
   * price that resolved in the other order would be a second meaning for one
   * name.
   */
  discount?: number;
  /**
   * A cut of everything that leaves your table, as a percentage of what it
   * earned, for as long as this position stands undamaged.
   *
   * The thing itself was holding the bag. It does not take a cut of its own
   * earnings — it takes a cut of everything else you close.
   *
   * Written first as a payout on this position's own departure and that had a
   * ceiling built into it: one position per project means one GOAT on the board,
   * so it paid 0.86 times a match for an average of $63.9K, against final scores
   * around $3M. As a standing rule it is paid on all 20.2 positions a side
   * closes in a match instead of on one.
   *
   * Paid however a position goes — banked, replaced to make room, rugged or
   * burned — because it is collected in removePosition, the one door they all
   * use. 82.5% of the positions a match costs are closed by their own owner
   * needing the slot, and nothing else in the set is paid for that.
   *
   * Distinct from mcPerPositionGone, which counts corpses on both sides at a
   * flat rate: this takes a share of each estate, so it is worth what the
   * position had grown into rather than what it was.
   *
   * `from` is which table it collects on, and it is one field rather than two
   * mechanisms because two names for one thing is the trap this set exists to
   * avoid. "both" is the bag holder: it kept its own money and everybody
   * else's. "theirs" is the venue: it charges a fee on their sales and nothing
   * on yours, which happens about half as often and is priced accordingly.
   */
  severance?: { percentage: number; from: "both" | "theirs" };
  /**
   * Cards you may play for nothing at the start of each of your turns.
   *
   * The agent has the keys and signs the transaction itself, so it plays without
   * being asked and without being paid for. The set already knew what a free
   * play was — the opening player gets one — and nothing had ever granted
   * another.
   *
   * Held to the same rarity cap the opening free play uses. A free mythic every
   * turn is a different game; a free common every turn is a hand that empties
   * itself, which is what this family is about.
   *
   * Granted at the top of the turn from the board as it stands, undamaged only,
   * so knocking a holder off closes it the same turn. Unused ones do not carry:
   * an agent that did not trade today did not save it up.
   */
  freePlays?: number;
  /**
   * How much more this position pumps for every turn it has been standing.
   *
   * The floor nobody sold. Everything else in this game rewards turning a board
   * over — the portfolio holds six, 82.5% of the positions a match costs are
   * closed by their own owner needing the slot, and one family is now paid a cut
   * every time that happens. This is the only thing that rewards not doing it.
   *
   * Counted from the turn it was played and applied to its own pump, so it
   * compounds with nothing and simply grows: a position five turns old at 12%
   * pays sixty percent more than it did on the way in. Damage does not switch it
   * off — a holder short is already paid for in the pump itself — but closing it
   * resets everything, which is the whole decision.
   */
  loyalty?: number;
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

export interface PersonCard extends CardBase {
  type: "person";
  aura: Aura;
  /** Optional one-off effect when played, on top of the standing aura. */
  effect?: Effect;
}

export type Card =
  | ProjectCard
  | TacticCard
  | EventCard
  | PersonCard
  | ToolCard;

/**
 * Every card type, in the order they should be listed.
 *
 * A runtime list beside the union, the same way RARITIES sits beside Rarity. The
 * gallery and the deck builder each had their own hand-written copy of this, and
 * adding the tool type left both filters silently missing it — the type checker
 * cannot see that a `CardType[]` is incomplete.
 */
export const CARD_TYPES = [
  "project",
  "tool",
  "tactic",
  "event",
  "person",
] as const;

/**
 * The standing bonus a card carries, if it carries one.
 *
 * Two card types can now have an aura and only one of them must. Every place
 * that asked `card.type === "person"` was really asking "does this have an
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
  if (card.type === "person") return card.aura;
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
  person: true,
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
  /**
   * Things attached to this position that happen every turn.
   *
   * A mark that stays rather than one that counts down. `after` puts something
   * on a clock and takes it off again when it fires; this is the other shape —
   * a debuff somebody hung on your position, or a compounding bonus on your
   * own, which goes on happening for as long as the position is on the table
   * and dies with it.
   *
   * Fired at the end of the owner's turn, before the position pumps, so a
   * decaying position pays the decayed number rather than the old one.
   */
  ticks?: Tick[];
}

/** One thing attached to a position, happening every turn. See `attach`. */
export interface Tick {
  /** The card that hung it there, for the log. */
  cardId: string;
  /** Who hung it. The effect resolves as if they had played it. */
  owner: Player;
  effect: Effect;
}

/**
 * A card that sits beside your portfolio and keeps working: a person or a
 * tool. Not a position — it produces no market cap of its own and a rug cannot
 * take it.
 */
export interface BoardSupport {
  cardId: string;
}

export interface PlayerState {
  mc: number;
  hand: string[];
  /**
   * Cards in this hand that came back out of the discard, and cost half while
   * they sit there.
   *
   * You already paid for it once. Without this a recovered card is a card you
   * cannot afford: the measurement that prompted it found 78% of turns ending
   * with budget unspent because nothing in hand was cheap enough, so handing a
   * player a card and none of the money to play it is handing them a reminder.
   *
   * By id and not by hand slot, because a slot is a place in a list and the list
   * moves every time anything is played. A deck holds one of each card, so an id
   * names one card in one hand; if that ever stops being true this becomes the
   * first copy's price for the second, and the test below is what would catch it.
   *
   * The mark dies when the card leaves the hand, by either door — played or
   * thrown away. Recover it again and it is half price again, which is the same
   * rule and not a stacking one: half of the printed price, never half of half.
   */
  recovered: string[];
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
  /**
   * Positions this player has closed on purpose.
   *
   * Only takeProfit counts. A position that rugs is not banked and neither is one
   * replaced to make room — the whole point of the number is that you chose it.
   *
   * Safe to add because a match is stored as a seed and a list of moves and
   * replayed from scratch, so there is no persisted state to migrate. See
   * lib/store.ts, which keeps decks and moves and nothing else.
   */
  banked: number;
}

export type LogTone = "neutral" | "pump" | "dump" | "system";

export interface LogEntry {
  turn: number;
  player: Player | null;
  text: string;
  tone: LogTone;
}

/**
 * The two boards, and nothing else.
 *
 * A surprising number of rules need only this: how many positions fit, whether
 * a project would upgrade one, which slot a card would land on. They all took a
 * State, which is the largest type in the engine and the one holding both
 * hands, both decks and the seed — so anything built on them could only ever
 * run somewhere a State exists, which is the server and the solo table.
 *
 * That is why the PvP table had no hover preview: not a decision, just a
 * signature. Asking for the boards says what these rules actually read, and a
 * State still satisfies it, so nothing that already worked has to change.
 */
export interface Boards {
  players: Record<
    Player,
    {
      mc: number;
      projects: readonly BoardProject[];
      support: readonly BoardSupport[];
    }
  >;
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
  /**
   * Cards played so far this turn, by whoever is moving.
   *
   * The game counted the money a turn had spent and not the moves it had made,
   * which is enough while nothing asks — and a family paid for what it has done
   * rather than for what it is holding asks. Reset where the budget is, at the
   * one moment a turn begins.
   */
  playsThisTurn: number;
  /**
   * Did the card resolving right now take over a position instead of opening
   * one?
   *
   * Set by playCard and read by the condition that asks about it, which is the
   * only way a payoff can know: by the time a payoff is checked the old card is
   * already in the discard and the new one is standing where it was, so there is
   * nothing left on the board to tell the two cases apart.
   *
   * Transient. It means nothing between plays and is set fresh on every one.
   */
  upgradedThisPlay: boolean;
  players: Record<Player, PlayerState>;
  log: LogEntry[];
  finished: boolean;
  /** Only filled once finished is true. null means a draw. */
  winner: Player | null;
  /**
   * Cards each player may still play without paying for them.
   *
   * One for the seat that moves first and none for the other, which is how
   * moving first is paid for — see RULES.firstMoveFreeCard. A count rather than
   * a flag because nothing about the rule is specific to the first move, and a
   * card that hands somebody a free play would want the same field.
   *
   * Part of the state and not derived, because "have they played a card yet" is
   * not answerable from a board: a tactic leaves no trace on it and a thrown-away
   * card leaves the same trace a played one does. Nothing stores a State — a
   * match is its seed and its moves, replayed on demand — so this costs nothing
   * to add.
   */
  freePlays: Record<Player, number>;
  /**
   * Every holder that has come off any position this match, both sides.
   *
   * Counted rather than derived, because it cannot be derived: a position that
   * lost its last holder leaves the board and takes its history with it. Two
   * places take holders off — damageHolders and the standing strip — and both
   * add here. A third would have to as well, and the test that pins this down
   * says so out loud.
   */
  holdersLost: number;
  /**
   * Positions that have left the table this match, either side, however they
   * went — taken profit on, replaced to make room, rugged or burned.
   *
   * Counted in removePosition, which is the one door they all go through.
   */
  positionsGone: number;
  /**
   * Every dollar of marketing budget each player has actually spent, all match.
   *
   * budgetSpentThisTurn is reset at the top of every turn and answers "can this
   * player still afford anything". This answers "what has this match cost them",
   * which nothing could ask before — and it is the one number in the game that
   * only ever goes up while the thing it measures is a cost.
   */
  budgetSpent: Record<Player, number>;
  /**
   * The highest market cap each player has reached this match.
   *
   * A number that only goes up. Market cap itself falls — a rug takes back what
   * a position produced, and budget you could not place is charged against you —
   * so "what you have" and "what you got to" are different questions, and until
   * now the game could only ask the first.
   *
   * Kept beside the scoreboard rather than derived, because it cannot be
   * derived: once market cap has come down there is nothing left to say how high
   * it was.
   */
  peakMC: Record<Player, number>;
  /**
   * Effects a card set going, waiting for their turn to come round.
   *
   * In the state and not in a closure, for the same reason pendingBudget is: a
   * match is its seed and its moves, replayed on demand, and anything held
   * outside the state stops that from coming out the same way twice.
   */
  pending: Pending[];
}

/** One effect waiting for its turn. See the `after` effect. */
export interface Pending {
  /** The card that set it going — for the log, and so it can be named. */
  cardId: string;
  /** Whose it is. The effect resolves as if that player had just played it. */
  owner: Player;
  /** The turn it fires on. */
  onTurn: number;
  effect: Effect;
  /** What happens instead when the marked position is gone. */
  ifGone?: Effect;
  /**
   * The position it was aimed at, by project rather than by slot.
   *
   * A slot is a place in a list and the list changes; a project is on a board at
   * most once, so it names the same position for as long as that position
   * exists — and says clearly that it does not once it is gone.
   */
  mark?: { player: Player; project: string };
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
      /**
       * Which of your own positions to close, when the portfolio is full.
       *
       * Its own field rather than a second meaning for targetIndex. That is what
       * it used to be, and it made a project card carrying a "pick one project"
       * effect impossible to express: one number cannot be both the position you
       * are closing and the position you are aiming at. The set rejected such a
       * card outright, so five hundred and twenty project cards could not do a
       * thing the game's own vocabulary already had a word for.
       *
       * Two fields, two questions, and a card may ask both.
       */
      closeIndex?: number;
      /**
       * Which of the cards revealed off the top of their deck to take out.
       *
       * A third index, and it needs to be its own field for the same reason
       * closeIndex does: it is counted against a different list. targetIndex is a
       * position on a board and this is a place in a handful of cards nobody has
       * seen yet, so one number could not be both.
       */
      burnIndex?: number;
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
   * Market cap the first player holds before anyone has played a card.
   *
   * Zero, and it was 360K until the maker asked why a player starts a card game
   * with money on the scoreboard and no way to explain it. The compensation is
   * real — see firstMoveBudget below, which replaced it — but it is paid in
   * budget now, a turn at a time.
   *
   * The constant stays because validateEffect leans on it, and what it guards is
   * not obvious. "Ahead" is one market cap minus the other, so anything handed to
   * the first player before the match starts opens every aheadBy gate at or below
   * it, on turn one, for free. Birdeye sat on a 350K gate, the seed moved from
   * 335K to 360K, and a tool started paying 30K a match for nothing; what caught
   * it was a test about something else, failing with "expected 390000 to be
   * 360000" and not one word of the cause.
   *
   * At zero the rule is dormant rather than gone, and it is written that way on
   * purpose: put a seed back and the floor under every aheadBy gate comes back
   * with it, without anybody having to remember that it should.
   *
   * The other thing zero buys is card design. While this was 360K, no card in
   * the set could ask "when you are ahead by" anything under 360K — a whole band
   * of gates was unusable, and the band grew every time the seed was retuned.
   */
  firstMoveSeedMC: 0,
  /**
   * Extra marketing budget the first player gets, every turn, for moving first.
   *
   * ZERO. This was the rule for a while and firstMoveFreeCard replaced it. The
   * measurements below are kept because they are what the next person needs if
   * they ever reach for this lever again, and because two of them are facts
   * about the budget rather than about this rule.
   *
   * Moving first is a disadvantage here, which is the opposite of most card
   * games and worth stating plainly: alternating turns mean the second player
   * always decides last, seeing what was just committed while the first player
   * aims at a board one half-turn out of date. Without any compensation the
   * first player wins 38% of matches.
   *
   * WHERE THE DEBT ACTUALLY COMES FROM, because the old note had it wrong.
   *
   * The story used to be exposure: you commit first, and a set that has learned
   * to attack punishes it. scripts/night-when-attacks.ts does not support that.
   * On turn one, 0.01 holders come off the table per match and 0.00 cards leave
   * a hand — nobody attacks early. scripts/night-where-the-gap-opens.ts shows
   * where it does come from: after turn three the first player is behind by
   * $268, which is nothing, and better than four fifths of the gap arrives in
   * turns seven to ten. The disadvantage accrues a little every turn from about
   * turn four and compounds.
   *
   * That is why this is paid per turn rather than in one lump at the start. A
   * seed round pays the whole debt in turn one, before any of it is owed, which
   * is exactly why it could never be explained on screen.
   *
   * WHY IT MUST BE A WHOLE MULTIPLE OF budgetPerTurn.
   *
   * Budget is only worth what it can be spent on, and unspent budget is charged
   * against market cap. A grant that does not reach a card price is therefore
   * worse than no grant at all — it cannot be placed and it is billed for. The
   * measurement is blunt about it:
   *
   *     +$20K -> 39.5%      +$30K -> 37.4%      +$35K -> 37.4%
   *     +$40K -> 51.1%      +$45K -> 49.2%      +$50K -> 49.9%
   *
   * with no compensation at all reading 38.0%. Handing the first player $30K a
   * turn makes them worse off than handing them nothing. Only whole turns of
   * budget behave, so this moves in steps of budgetPerTurn and never between.
   *
   * HOW TO RETUNE IT. The measurement is noisy — five blocks of 1500 matches at
   * one value came back 49.8, 46.9, 48.9, 50.0 and 46.4 — so 7500 matches is the
   * floor for a reading, and it wants a second seed range the value has not seen.
   * `npx tsx scripts/night-first-move.ts 7500 0` and again from 100000. Current
   * reading: 51.1% on seeds 0-7500 and 50.7% on 100000-107500.
   *
   * IT DOES NOT APPLY ON THE LAST TURN, and that is not a rounding decision.
   *
   * Turn ten grants the first player $440K where the second gets $400K, and
   * $440K reaches combinations $400K cannot: a mythic and two epics is exactly
   * $440K, two legendaries and a rare is exactly $440K, and neither fits inside
   * $400K. On the turn that decides the match one seat could build something the
   * other could not afford at all — and did, in 27.3% of matches. Capped, that
   * is 6.5%, and what is left is budget handed over by cards, which both seats
   * can do.
   *
   * It costs nothing: 51.6% capped against 51.1% uncapped, which is one number
   * at this sample size, and the waste the first player is charged for drops
   * from $348K to $331K a match. So the run of the match is paid for and the
   * final turn is the same for both, which is the turn a player counts.
   *
   * The cap is written as the top of the ladder rather than as a special case
   * for turn ten, so raising this to two turns ahead would still level out at
   * the end rather than running off it.
   *
   * Like the seed it replaced, this moves whenever the balance between building
   * and taking moves. Unlike the seed, it can only move a whole turn at a time.
   */
  firstMoveBudget: 0,
  /**
   * Do the seats take turns opening, instead of the same one opening every turn?
   *
   * Off, and here to be measured rather than because it is wanted. Everything
   * above pays the first player for a disadvantage; this would remove the
   * disadvantage instead. Moving first costs 12 to 14 points of win rate because
   * the other seat always decides last, seeing what was just committed — so if
   * the seats alternate, neither of them always decides last and there is
   * nothing left to compensate.
   *
   * It is the only shape with nothing on the screen to explain. The maker has
   * turned down market cap on the scoreboard, extra budget in the bar, and a
   * card already on the board, and he is right that all three need a paragraph.
   * "The other player opens the next turn" needs a sentence.
   *
   * Which seat opens a turn is worked out from the turn number and not stored,
   * so a match still replays from its seed and its moves alone.
   *
   * Measure it with `npx tsx scripts/night-alternating.ts`. Turning it on wants
   * firstMoveBudget set to zero in the same breath: the two are answers to the
   * same question and running both pays a debt that is no longer owed.
   */
  alternateOpener: false,
  /**
   * May the player who moves first play one card for nothing?
   *
   * This is how moving first is paid for. Without any compensation that seat
   * wins 38% of matches; with this it wins 49.0% and 47.9% on two ranges of
   * seven and a half thousand.
   *
   * It is the maker's proposal and it was chosen over four fairer-on-paper ones
   * for a reason no measurement produces: it is a moment rather than a standing
   * difference. Both seats hold the same number of cards all match, get the same
   * budget every turn, start on nothing and play in the same order. What the
   * other player sees is one card arriving early, once — and a thing that
   * happened is easier to accept than a thing that is.
   *
   * FREE MEANS FREE, INCLUDING A MYTHIC ON TURN ONE, and that is the rule rather
   * than a hole in it. Capped at epic the seat wins 40.7% and capped at
   * legendary 44.6%, against 49.0% uncapped: the whole of the payment is in the
   * cards a turn could not otherwise reach. Take the big cards out and there is
   * no compensation left.
   *
   * What it costs is evenness. Split by what the free card turned out to be, the
   * first seat wins 39, 44, 43, 49 and 54 percent from common to mythic, against
   * a no-compensation control of 41, 41, 38 and 36 — so the rule pays about two
   * points when the deal is cheap and eighteen when it is not. The budget rule
   * it replaced paid 11 to 15 whatever the deal. That is the trade, it was made
   * on purpose, and it is the thing to look at first if this ever feels wrong.
   *
   * Saving it for later was measured and makes no difference (48.9%): a hand of
   * five nearly always holds something the turn cannot pay for, so there is
   * never a reason to wait. It is spent on the first card played, and the bot
   * spends it on the best card rather than the best value for money, because
   * value for money is not a question when the price is nothing.
   *
   * OFF, and the comment above says why better than a new one could: "that is
   * the thing to look at first if this ever feels wrong". It felt wrong. The
   * turn-order fairness test failed at a 9.03% gap and the first seat was
   * winning 56.5% of 2000 matches.
   *
   * The rule was not miscalibrated when it was written; the game moved out from
   * under it. It was set against a first seat winning 38 to 41 percent with no
   * compensation at all, and that seat now wins 47.1% with none — seventeen
   * families were rebuilt in two days and almost every one of them made building
   * early worth more. A compensation sized for a nine point hole was being paid
   * into a three point one.
   *
   *   free card on,  budget 0      gap 7.04%   first seat 56.7%
   *   free card off, budget 0      gap 3.03%   first seat 47.1%
   *   free card off, budget 10000  gap 1.81%   first seat 47.1%
   *
   * The third row has the smallest gap and it is not the answer. firstMoveBudget
   * stays at zero because a test one file over states the rule it would break —
   * both seats get the same budget on every turn — and the win rate is identical
   * either way. Twelve tenths of a point of gap is not worth spending a rule the
   * game states out loud.
   *
   * ---
   *
   * IN CARDS OF CRONOS IT IS ALSO OFF, and unlike over there the debt has not
   * been paid off — it is being carried on purpose, by the maker, knowingly.
   *
   * Everything above is TCG's reasoning about TCG's set, where the rule could be
   * switched off because the set stopped needing it: 725 cards rebuilt over two
   * days made building early worth more and the first seat climbed to 47.1% on
   * its own. This set is 246 cards and has not been through that. Measured with
   * `npx tsx scripts/turn-order.ts 2000`, two ranges of two thousand:
   *
   *   nothing at all            42.9%          <- what is built
   *   one free card             48.0% / 46.3%
   *   a seed round of $400K     52.1% / 51.6%
   *
   * So the first seat is 7.1 points light, against a band of 46.9 to 53.1. Both
   * compensations close it and neither is switched on: the game runs the same
   * rules as TCG rather than carrying a rule TCG has retired, and the cards are
   * expected to close the gap the way they closed it there.
   *
   * This is the first number to look at if the game ever feels lopsided, and the
   * cheapest thing in the engine to change — one line here, and the measurements
   * above say what it buys. Re-measure with turn-order.ts whenever the set moves.
   */
  firstMoveFreeCard: false,
  /**
   * The dearest card the free play may be spent on.
   *
   * Uncapped when this was written, because capping it cost more than the debt
   * could spare: with the first seat at 38% a free card was worth eleven points
   * and a cap at legendary only 6.6 of them.
   *
   * The debt then shrank. Re-pointing every family cut the hostile half of the
   * set hard — stealMC from 5-18% down to 2-7%, a holder off every position
   * moved off the commons entirely — and the first move is only a disadvantage
   * because the other seat gets to attack what was just committed. Weaker
   * attacks, smaller debt: 38.0% became 42.2%, so 12 points became 7.8, and a
   * free card worth 14 was suddenly paying six too many.
   *
   * A cap at legendary is worth about what is now owed. It also answers the
   * maker's own objection to this rule, which was that a mythic on turn one is
   * too big a move to hand anybody — a thing that was true when it was the only
   * affordable answer and is not any more.
   *
   * AND THEN IT WENT BACK TO NULL THE SAME NIGHT, which is worth keeping rather
   * than tidying away. Re-sizing the comeback ladder — the first version was
   * worth about a third of what it should have been — grew the debt straight
   * back to 12 points, from 37.9% uncompensated. The reason is not obvious and
   * is the useful part: a card that is only worth something when you are behind
   * is worth more to the seat that decides last, because that seat knows whether
   * it is behind. Conditional cards make the information advantage bigger, and
   * the information advantage is what moving first costs you.
   *
   * On this set: no compensation 37.9%, capped at epic 40.6%, capped at
   * legendary 44.7%, uncapped 49.8%. So the cap is off again. The turn-one
   * mythic the maker objected to is also a smaller thing than it was — stealMC
   * on a mythic went from 18% to 7% when the families were re-pointed.
   *
   * Set to a rarity to cap it. Whatever it is set to, the number to watch is
   * `npx tsx scripts/turn-order.ts 7500` on two seed ranges.
   */
  firstMoveFreeCardUpTo: null as Rarity | null,
} as const;
