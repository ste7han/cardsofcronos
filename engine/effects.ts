// Applying effects. This is the file Cards of Cronos broke on, so it is
// deliberately small and deliberately loud.
//
// Three rules hold here without exception:
//   1. Every variant of Effect has a branch below. The switch ends on
//      assertNever(), which throws. TypeScript catches a missing branch at
//      compile time; the throw catches data arriving from outside.
//   2. No branch may "do nothing" as a silent outcome. If an effect can't
//      achieve anything (no target on the board), that goes into the log.
//   3. An invalid move throws IllegalMove. Never ignored.

import { cardLabel, formatDelta, formatMC, plural, sectorName } from "./format";
import { cardById, draw, log, otherPlayer, projectById } from "./helpers";
import { pumpOf } from "./pump";
import { removePosition } from "./positions";
import { spendBudget, changeMC } from "./scoreboard";
import { portfolioSizeFor } from "./match";
import { nextInt } from "./rng";
import type {
  Card,
  CardIndex,
  Condition,
  ChoiceTarget,
  Effect,
  Pending,
  PerHolder,
  Player,
  Sector,
  State,
  TargetProject,
} from "./types";
import { RULES,
  IllegalMove,
  boardOf,
  needsChoice,
  ownersOf,
  playersOf,
  auraOf,
} from "./types";

/**
 * Reaches a branch the types say cannot exist. If this throws, an effect variant
 * was added without an implementation.
 */
export function assertNever(value: never, where: string): never {
  throw new Error(
    `Unknown case in ${where}: ${JSON.stringify(value)}. ` +
      `A variant was added without an implementation.`,
  );
}

/** A targeted project: whose board, and which slot in the row. */
interface Targeted {
  owner: Player;
  slot: number;
}

/**
 * Applies one effect. Mutates `state` — the caller in match.ts works on a copy,
 * so the reducer stays pure from the outside.
 */
/**
 * Does the table agree with this condition, for this player?
 *
 * One place that answers it, so a condition cannot mean one thing when a card is
 * played and another when the card face is written.
 */
export function holds(
  condition: Condition,
  state: State,
  player: Player,
  index: CardIndex,
  /**
   * Which position the card was aimed at, when it was aimed at one.
   *
   * Optional, because every other condition here is about a board or a score and
   * has no use for it. targetPumpsAtLeast is the exception and says so by
   * answering false when nothing was aimed.
   */
  targetIndex?: number,
): boolean {
  switch (condition.kind) {
    case "behindBy": {
      const them = player === "you" ? "opponent" : "you";
      return state.players[them].mc - state.players[player].mc >= condition.mc;
    }
    case "aheadBy": {
      const them = player === "you" ? "opponent" : "you";
      return state.players[player].mc - state.players[them].mc >= condition.mc;
    }
    case "theirHandAtMost": {
      const them = player === "you" ? "opponent" : "you";
      return state.players[them].hand.length <= condition.cards;
    }
    case "holdersLostAtLeast":
      return state.holdersLost >= condition.holders;
    case "bankedAtLeast":
      return state.players[player].banked >= condition.count;
    case "bankedAtMost":
      return state.players[player].banked <= condition.count;
    case "ownProjectsInSector": {
      let n = 0;
      for (const position of state.players[player].projects) {
        const card = index.get(position.cardId);
        if (card?.type === "project" && card.sector === condition.sector) n++;
      }
      return n >= condition.atLeast;
    }
    case "ownProjectCount":
      return state.players[player].projects.length >= condition.atLeast;
    case "targetPumpsAtLeast": {
      if (targetIndex === undefined) return false;
      const board = state.players[player].projects;
      if (targetIndex < 0 || targetIndex >= board.length) return false;
      // pumpOf rather than the card's printed pump: what the position actually
      // yields, auras and everything stacked on it included. That is the number
      // on the table and the number the player is looking at.
      return pumpOf(state, player, targetIndex, index) >= condition.mc;
    }
    case "turnAtLeast":
      return state.turn >= condition.turn;
    case "turnAtMost":
      return state.turn <= condition.turn;
    case "targetHeldFor": {
      if (targetIndex === undefined) return false;
      const at = state.players[player].projects[targetIndex];
      if (!at) return false;
      // The turn it landed counts as one, so "held for 3" is two whole turns
      // ago. Read after the card has resolved, which is why a position played
      // this very turn answers one rather than zero.
      return state.turn - at.playedOnTurn + 1 >= condition.turns;
    }
    case "yourHandAtLeast":
      return state.players[player].hand.length >= condition.cards;
    case "upgraded":
      return state.upgradedThisPlay;
    case "playedThisTurnAtLeast":
      return state.playsThisTurn >= condition.cards;
    case "playedThisTurnAtMost":
      return state.playsThisTurn <= condition.cards;
    case "discardAtLeast":
      return state.players[player].discard.length >= condition.count;
    default:
      return assertNever(condition, "holds");
  }
}

/**
 * The rider on a holder effect, once for every holder that actually moved.
 *
 * Scaled and applied once rather than applied `holders` times: eight identical
 * log lines is not a log, and both riders are pure addition so multiplying is
 * the same answer. That the two kinds both carry an `mc` field is what makes
 * this one line instead of a switch — and validation is what keeps a third kind
 * from arriving and silently not being scaled.
 */
function ride(
  state: State,
  perHolder: PerHolder | undefined,
  holders: number,
  player: Player,
  source: Card,
  index: CardIndex,
): void {
  if (!perHolder || holders <= 0) return;
  applyEffect(state, { ...perHolder, mc: perHolder.mc * holders }, player, source, undefined, index);
}

/**
 * How many projects of a sector this player holds, not counting the card played.
 *
 * The card being played is already on the board by the time an effect resolves,
 * so it is taken out again — "every other one you hold" is what the card says,
 * and counting itself would make a lone copy worth one of itself.
 */
function othersOfSector(
  state: State,
  player: Player,
  sector: Sector | "any" | "table" | "sectors" | "theirs" | "turn" | "holders" | "plays" | "spent",
  source: Card,
  index: CardIndex,
): number {
  // How many kinds rather than how many, and nothing is subtracted: "every
  // different sector you hold" already counts the source's own sector once, and
  // taking one off would make a card that names variety pay for uniformity.
  // Not a board at all: how far into the match we are. Nothing is subtracted
  // and nothing is counted, which is why it sits before every other case.
  if (sector === "turn") return state.turn;

  // What you have done this turn, not what you have. The only count here that
  // starts again every turn.
  if (sector === "plays") return state.playsThisTurn;

  // Everything you have finished with. Not the same as the turn number: a player
  // who has done nothing has an empty pile on turn nine.
  if (sector === "spent") return state.players[player].discard.length;

  // Holders, not positions. The only rate on this list that somebody else can
  // take off you a point at a time.
  if (sector === "holders") {
    let total = 0;
    for (const position of state.players[player].projects) total += position.holders;
    return total;
  }

  if (sector === "sectors") {
    const kinds = new Set<Sector>();
    for (const position of state.players[player].projects) {
      const card = cardById(index, position.cardId);
      if (card.type === "project") kinds.add(card.sector);
    }
    return kinds.size;
  }

  // "table" is both boards and "theirs" is the other one. Everything else counts
  // this player's own, which is what "every other project you hold" has always
  // meant.
  const other: Player = player === "you" ? "opponent" : "you";
  const sides: Player[] =
    sector === "table" ? ["you", "opponent"] : sector === "theirs" ? [other] : [player];
  const wide = sector === "any" || sector === "table" || sector === "theirs";
  let held = 0;
  for (const side of sides) {
    held += state.players[side].projects.filter((position) => {
      const card = cardById(index, position.cardId);
      return card.type === "project" && (wide || card.sector === sector);
    }).length;
  }
  // Nothing of yours is on their board, so nothing comes off the count for it.
  const own =
    sector !== "theirs" && source.type === "project" && (wide || source.sector === sector) ? 1 : 0;
  return Math.max(0, held - own);
}

export function applyEffect(
  state: State,
  effect: Effect,
  player: Player,
  source: Card,
  targetIndex: number | undefined,
  index: CardIndex,
): void {
  switch (effect.kind) {
    case "directMC": {
      // A rate times the board when the card names a sector, the same as a
      // steal. Nothing held of that sector is nothing paid, and the card says so
      // rather than quietly resolving to zero.
      let amount = effect.mc;
      if (effect.per) {
        const others = othersOfSector(state, player, effect.per, source, index);
        if (others === 0) {
          log(
            state,
            player,
            `${cardLabel(source)}: nothing else of that sector on your board, so nothing paid.`,
            "neutral",
          );
          return;
        }
        amount = effect.mc * others;
      }

      for (const target of playersOf(effect.target, player)) {
        const actual = changeMC(state, target, amount, index);

        // Market cap can't go below zero. Without this branch a dump card played
        // on an empty position reports "+$0 MC" in green, as if something good
        // had happened.
        if (actual === 0) {
          log(
            state,
            player,
            `${cardLabel(source)}: ${nameOf(target)} was already at zero — nothing to take.`,
            "neutral",
          );
          continue;
        }

        log(
          state,
          player,
          `${cardLabel(source)}: ${nameOf(target)} ${formatDelta(actual)} MC.`,
          actual > 0 ? "pump" : "dump",
        );
      }
      return;
    }

    case "scaleMC": {
      for (const target of playersOf(effect.target, player)) {
        const before = state.players[target].mc;
        const wanted = Math.round((before * effect.percentage) / 100);
        const actual = changeMC(state, target, wanted, index);
        if (actual === 0) {
          log(
            state,
            player,
            `${cardLabel(source)}: ${nameOf(target)} had nothing to move.`,
            "neutral",
          );
          continue;
        }
        log(
          state,
          player,
          `${cardLabel(source)}: ${nameOf(target)} ${effect.percentage > 0 ? "+" : ""}${effect.percentage}% — ${formatDelta(actual)} MC.`,
          actual > 0 ? "pump" : "dump",
        );
      }
      return;
    }

    case "pumpProject": {
      const targets = findTargets(state, effect.target, player, targetIndex, source, index);
      if (reportEmpty(state, targets, player, source)) return;

      // The same rate-times-the-board that directMC and extraBudget already do,
      // read off the same helper so the three cannot drift apart. Nothing held
      // is nothing paid, and the card says so instead of quietly resolving to a
      // pump of zero on every position.
      let amount = effect.mc;
      if (effect.per) {
        const others = othersOfSector(state, player, effect.per, source, index);
        if (others === 0) {
          log(
            state,
            player,
            `${cardLabel(source)}: nothing else on your board, so nothing pumps.`,
            "neutral",
          );
          return;
        }
        amount = effect.mc * others;
      }

      for (const t of targets) {
        state.players[t.owner].projects[t.slot]!.extraPump += amount;
      }
      // One target gets a line with its name; several targets get one summary.
      // Otherwise a card that hits the whole board writes ten identical lines.
      const first = targets[0]!;
      const name = projectById(index, state.players[first.owner].projects[first.slot]!.cardId).name;
      log(
        state,
        player,
        targets.length === 1
          ? `${cardLabel(source)}: ${owned(first.owner, name)} pumps ${formatDelta(amount)} MC more per turn.`
          : `${cardLabel(source)}: ${plural(targets.length, "project", "projects")} ${scope(effect.target, targets)} pump ${formatDelta(amount)} MC more per turn.`,
        amount > 0 ? "pump" : "dump",
      );
      return;
    }

    case "pumpBySector": {
      const targets = findTargets(state, effect.target, player, targetIndex, source, index);
      if (reportEmpty(state, targets, player, source)) return;

      // Counted per sector so the log can say what actually moved. A card that
      // lifts memes while the table holds none should say so rather than report
      // a cheerful nothing — that silence is the Cards of Cronos failure.
      const moved = new Map<Sector, number>();
      for (const t of targets) {
        const onBoard = state.players[t.owner].projects[t.slot]!;
        const sector = projectById(index, onBoard.cardId).sector;
        const bonus = effect.bonuses[sector];
        if (bonus === undefined) continue;
        onBoard.extraPump += bonus;
        moved.set(sector, (moved.get(sector) ?? 0) + 1);
      }

      if (moved.size === 0) {
        log(
          state,
          player,
          `${cardLabel(source)}: nothing on the table is in a sector it touches.`,
          "neutral",
        );
        return;
      }

      const parts = [...moved.entries()].map(
        ([sector, count]) =>
          `${plural(count, `${sectorName(sector)} project`, `${sectorName(sector)} projects`)} ${formatDelta(effect.bonuses[sector]!)}`,
      );
      log(state, player, `${cardLabel(source)}: ${parts.join(", ")} MC more per turn.`, "pump");
      return;
    }

    case "damageHolders": {
      const targets = findTargets(state, effect.target, player, targetIndex, source, index);
      if (reportEmpty(state, targets, player, source)) return;

      const survivors: string[] = [];
      let moved = 0;

      // Back to front, so removing one doesn't shift the slots before it.
      // A rug always gets its own line — too important to summarise away.
      for (const t of [...targets].sort((a, b) => b.slot - a.slot)) {
        const project = state.players[t.owner].projects[t.slot]!;
        const name = projectById(index, project.cardId).name;
        // What actually comes off, not what was asked for: a position with one
        // holder left loses one however large the number on the card is.
        const take = effect.amount === "all" ? project.holders : effect.amount;
        moved += Math.min(take, project.holders);
        state.holdersLost += Math.min(take, project.holders);
        project.holders -= take;
        if (project.holders <= 0) {
          removeProject(state, t, index, source, player, "holders");
        } else if (targets.length === 1) {
          log(
            state,
            player,
            `${cardLabel(source)}: ${owned(t.owner, name)} loses ${plural(take, "holder", "holders")} (${plural(project.holders, "holder", "holders")} left).`,
            "dump",
          );
        } else {
          survivors.push(name);
        }
      }

      if (survivors.length > 0) {
        log(
          state,
          player,
          `${cardLabel(source)}: ${plural(survivors.length, "project", "projects")} ${scope(effect.target, targets)} lose holders.`,
          "dump",
        );
      }
      ride(state, effect.perHolder, moved, player, source, index);
      return;
    }

    case "healHolders": {
      const targets = findTargets(state, effect.target, player, targetIndex, source, index);
      if (reportEmpty(state, targets, player, source)) return;

      let healed = 0;
      let touched = 0;
      let last = "";

      for (const t of targets) {
        const project = state.players[t.owner].projects[t.slot]!;
        const card = projectById(index, project.cardId);
        const before = project.holders;
        const want = effect.amount === "full" ? card.holders : effect.amount;
        project.holders = Math.min(project.holders + want, card.holders);
        const gained = project.holders - before;
        last = owned(t.owner, cardLabel(card));
        if (gained > 0) {
          healed += gained;
          touched += 1;
        }
      }

      if (targets.length === 1) {
        log(
          state,
          player,
          healed > 0
            ? `${cardLabel(source)}: ${last} gets ${plural(healed, "holder", "holders")} back.`
            : `${cardLabel(source)}: ${last} was already at full holders.`,
          healed > 0 ? "pump" : "neutral",
        );
      } else {
        log(
          state,
          player,
          touched > 0
            ? // "gets" when it is one, and it can be one: this branch runs for
              // every multi-target heal, and a board with a single position left
              // takes it. Came over from TCG reading "1 project get 1 holder back
              // between them" — plural() picks the noun and the verb was written
              // beside it as though it always would be more than one.
              `${cardLabel(source)}: ${plural(touched, "project", "projects")} ${touched === 1 ? "gets" : "get"} ${plural(healed, "holder", "holders")} back${touched === 1 ? "" : " between them"}.`
            : `${cardLabel(source)}: everything was already at full holders.`,
          touched > 0 ? "pump" : "neutral",
        );
      }
      ride(state, effect.perHolder, healed, player, source, index);
      return;
    }

    case "rug": {
      const targets = findTargets(state, effect.target, player, targetIndex, source, index);
      if (reportEmpty(state, targets, player, source)) return;
      for (const t of [...targets].sort((a, b) => b.slot - a.slot)) {
        removeProject(state, t, index, source, player, "rug");
      }
      return;
    }

    case "stealMC": {
      const victim = otherPlayer(player);
      // A rate times the board, when the card names a sector.
      let rate = effect.percentage;
      if (effect.per) {
        const others = othersOfSector(state, player, effect.per, source, index);
        rate = effect.percentage * others;
        if (rate <= 0) {
          log(
            state,
            player,
            `${cardLabel(source)}: nothing of that sector on your board yet, so nothing taken.`,
            "neutral",
          );
          return;
        }
      }
      const amount = Math.round((state.players[victim].mc * rate) / 100);
      if (amount <= 0) {
        log(state, player, `${cardLabel(source)}: there was nothing to take.`, "neutral");
        return;
      }
      changeMC(state, victim, -amount, index);
      changeMC(state, player, amount, index);
      log(
        state,
        player,
        `${cardLabel(source)}: ${formatMC(amount)} MC siphoned off ${nameOf(victim)}.`,
        "pump",
      );
      return;
    }

    case "comebackMC": {
      const them = otherPlayer(player);
      const behind = state.players[them].mc - state.players[player].mc;
      if (behind <= 0) {
        log(
          state,
          player,
          `${cardLabel(source)}: nothing to come back from — you are not behind.`,
          "neutral",
        );
        return;
      }
      const gained = Math.round((behind * effect.percentage) / 100);
      if (gained <= 0) return;
      changeMC(state, player, gained, index);
      log(
        state,
        player,
        `${cardLabel(source)}: ${formatMC(behind)} behind, ${formatMC(gained)} MC back.`,
        "pump",
      );
      return;
    }

    case "drawCards": {
      for (const who of playersOf(effect.target ?? "self", player)) {
        const before = state.players[who].hand.length;
        draw(state, who, effect.amount);
        const gained = state.players[who].hand.length - before;
        log(
          state,
          who,
          `${cardLabel(source)}: drew ${plural(gained, "card", "cards")}.`,
          // Giving the other player cards is not a neutral event on their side
          // of the table, and the log is read by both.
          who === player ? "neutral" : "dump",
        );
      }
      return;
    }

    case "recoverCard": {
      const side = state.players[player];
      let back = 0;
      for (let i = 0; i < effect.amount; i++) {
        // pop, not shift: the top of the pile is what you finished with last.
        const id = side.discard.pop();
        if (id === undefined) break;
        side.hand.push(id);
        back++;
      }
      if (back === 0) {
        // Rule 2 of this file: an effect that achieved nothing says so.
        log(
          state,
          player,
          `${cardLabel(source)}: nothing in the discard to bring back.`,
          "system",
        );
        return;
      }
      const returned = side.hand.slice(side.hand.length - back);
      // Half price while they sit in hand. See PlayerState.recovered.
      for (const id of returned) side.recovered.push(id);
      const names = returned.map((id) => cardLabel(cardById(index, id))).join(", ");
      log(state, player, `${cardLabel(source)}: ${names} came back to hand.`, "pump");
      return;
    }

    case "discardCards": {
      // Random, through the state's own PRNG. The player doing it cannot see the
      // hand, and neither should the engine pretend to — but the roll is part of
      // the state, so the match still replays exactly.
      for (const target of playersOf(effect.target, player)) {
        let gone = 0;
        for (let i = 0; i < effect.amount; i++) {
          const hand = state.players[target].hand;
          if (hand.length === 0) break;
          const roll = nextInt(hand.length, state.rngState);
          state.rngState = roll.state;
          const [card] = hand.splice(roll.value, 1);
          if (card) {
            state.players[target].discard.push(card);
            gone += 1;
          }
        }
        log(
          state,
          target,
          gone === 0
            ? `${cardLabel(source)}: nothing left in hand to lose.`
            : `${cardLabel(source)}: ${plural(gone, "card", "cards")} out of hand.`,
          gone === 0 ? "neutral" : "dump",
        );
      }
      return;
    }

    case "takeOver": {
      // Their strongest position, by what it is paying — the same rule cancel
      // uses, and for the same reason: "takes their best" needs no pointing.
      const other = otherPlayer(player);
      const theirs = state.players[other].projects;
      if (theirs.length === 0) {
        log(state, player, `${cardLabel(source)}: nothing to take over.`, "neutral");
        return;
      }
      // portfolioSizeFor, not RULES.portfolioSize. Read straight from RULES this
      // refused a player holding ORCA's extra slots at six when their portfolio
      // held eight — the one card in the game whose whole identity is having more
      // room could not use the room it had.
      if (state.players[player].projects.length >= portfolioSizeFor(state, player, index)) {
        // Refused rather than discarding something of yours to make room. A card
        // that quietly closed one of your own positions would be doing two
        // things and printing one.
        log(
          state,
          player,
          `${cardLabel(source)}: your portfolio is full, so there is nowhere to put it.`,
          "neutral",
        );
        return;
      }
      let best = 0;
      for (let i = 1; i < theirs.length; i++) {
        const a = projectById(index, theirs[i]!.cardId);
        const b = projectById(index, theirs[best]!.cardId);
        if (a.pumpMC + theirs[i]!.extraPump > b.pumpMC + theirs[best]!.extraPump) best = i;
      }
      const [taken] = theirs.splice(best, 1);
      if (taken) {
        // Holders, built-up pump and what it has earned all move with it. It
        // changes hands; it does not restart.
        state.players[player].projects.push(taken);
        log(
          state,
          player,
          `${cardLabel(source)}: ${projectById(index, taken.cardId).name} changes hands.`,
          "pump",
        );
      }
      return;
    }

    case "cancel": {
      const targets = playersOf(effect.target, player);
      const gone: string[] = [];

      for (const owner of targets) {
        const row = state.players[owner].support;
        // Biggest aura first. A tool with no aura goes last, because taking one
        // of those off the board is worth less than taking a name off it.
        const order = row
          .map((entry, i) => ({ i, bonus: auraBonusOf(cardById(index, entry.cardId)) }))
          .sort((a, b) => b.bonus - a.bonus)
          .slice(0, effect.count)
          .map((x) => x.i)
          .sort((a, b) => b - a); // back to front, so the indices hold

        for (const i of order) {
          const [dropped] = row.splice(i, 1);
          if (!dropped) continue;
          state.players[owner].discard.push(dropped.cardId);
          gone.push(owned(owner, cardLabel(cardById(index, dropped.cardId))));
        }
      }

      if (gone.length === 0) {
        log(state, player, `${cardLabel(source)}: there was nobody to cancel.`, "neutral");
        return;
      }
      log(state, player, `CANCELLED ${gone.join(", ")}.`, "dump");
      return;
    }

    case "extraBudget": {
      // Two landing places, and which one is not a detail. Your own budget is set
      // for the turn you are in, so a grant to yourself is spendable now. Theirs
      // is set when their turn starts, which has not happened, so it waits in
      // pendingBudget until it does. Adding to state.budgetThisTurn for an
      // opponent would hand them money during your turn, where they cannot
      // spend it and it is charged against them as waste — the opposite of a
      // gift and not what any text on the card says.
      // A rate times the board, when the card names a sector.
      let budget = effect.mc;
      if (effect.per) {
        const others = othersOfSector(state, player, effect.per, source, index);
        if (others === 0) {
          log(
            state,
            player,
            `${cardLabel(source)}: nothing else of that sector on your board, so nothing paid.`,
            "neutral",
          );
          return;
        }
        budget = effect.mc * others;
      }

      for (const side of playersOf(effect.target, player)) {
        if (side === player) {
          state.budgetThisTurn += budget;
          log(
            state,
            player,
            `${cardLabel(source)}: ${formatMC(budget)} more marketing budget this turn.`,
            "pump",
          );
        } else {
          state.players[side].pendingBudget += budget;
          log(
            state,
            player,
            budget < 0
              ? // Negative is a real card and needs its own sentence. "More
                // marketing budget" printed over a number that takes it away is
                // the log lying about the thing it exists to record.
                `${cardLabel(source)}: ${formatMC(-budget)} comes off the opponent's marketing budget next turn.`
              : `${cardLabel(source)}: ${formatMC(budget)} of marketing budget lands on the opponent next turn, spent or not.`,
            "dump",
          );
        }
      }
      return;
    }

    case "refundMC": {
      const spent = state.budgetSpent[player];
      if (spent <= 0) {
        log(
          state,
          player,
          `${cardLabel(source)}: you have not spent anything yet, so there is nothing to hand back.`,
          "neutral",
        );
        return;
      }
      const back = Math.round((spent * effect.percentage) / 100);
      if (back <= 0) return;
      changeMC(state, player, back, index);
      log(
        state,
        player,
        `${cardLabel(source)}: ${formatMC(spent)} spent this match — ${formatMC(back)} MC of it back.`,
        "pump",
      );
      return;
    }

    case "mcPerPositionGone": {
      const gone = state.positionsGone;
      if (gone === 0) {
        log(
          state,
          player,
          `${cardLabel(source)}: nothing has left the table yet, so there is nothing to count.`,
          "neutral",
        );
        return;
      }
      const paid = effect.mc * gone;
      changeMC(state, player, paid, index);
      log(
        state,
        player,
        `${cardLabel(source)}: ${formatMC(paid)} MC for ${plural(gone, "position", "positions")} gone this match.`,
        "pump",
      );
      return;
    }

    case "mcPerHolderLost": {
      const holders = state.holdersLost;
      if (holders === 0) {
        log(
          state,
          player,
          `${cardLabel(source)}: nobody has lost a holder yet, so there is nothing to count.`,
          "neutral",
        );
        return;
      }
      const amount = effect.mc * holders;
      changeMC(state, player, amount, index);
      log(
        state,
        player,
        `${cardLabel(source)}: ${formatMC(amount)} MC for ${plural(holders, "holder", "holders")} shaken out this match.`,
        "pump",
      );
      return;
    }

    case "pumpToMC": {
      const board = state.players[player].projects;
      if (board.length === 0) {
        log(state, player, `${cardLabel(source)}: no positions to cash out.`, "neutral");
        return;
      }
      // pumpOf and not the printed pumpMC: this reads the same number the turn
      // phase reads, so built-up pump counts, auras count, and a board somebody
      // has been damaging cashes out for less.
      let perTurn = 0;
      for (let slot = 0; slot < board.length; slot++) perTurn += pumpOf(state, player, slot, index);
      const gained = Math.round(perTurn * effect.times);
      changeMC(state, player, gained, index);
      log(
        state,
        player,
        `${cardLabel(source)}: ${formatMC(perTurn)} of pump cashed at ${effect.times}x — ${formatMC(gained)} MC.`,
        "pump",
      );
      return;
    }

    case "budgetToMC": {
      const left = state.budgetThisTurn - state.budgetSpentThisTurn;
      if (left <= 0) {
        log(state, player, `${cardLabel(source)}: nothing left over to buy back with.`, "neutral");
        return;
      }
      const gained = Math.round((left * effect.percentage) / 100);
      // Taken as it is converted, so the waste charge that follows sees a budget
      // that really was spent. Otherwise the same money would pay twice: once
      // into market cap and once as a penalty for not being used.
      spendBudget(state, player, left, index);
      changeMC(state, player, gained, index);
      log(
        state,
        player,
        `${cardLabel(source)}: ${formatMC(left)} of unspent budget bought back — ${formatMC(gained)} MC.`,
        "pump",
      );
      return;
    }

    case "burnForDamage": {
      const whole = effect.target === "allOwnProjects";
      const board = state.players[player].projects;

      // Every position or exactly one, and the difference is decided here rather
      // than by two effect kinds. A whole-board burn has nothing to point at,
      // which is why it is the one target this effect takes that is not a choice.
      let burning: number[];
      if (whole) {
        if (board.length === 0) {
          log(state, player, `${cardLabel(source)}: nothing on your board to burn.`, "neutral");
          return;
        }
        burning = board.map((_, at) => at);
      } else {
        if (targetIndex === undefined || !board[targetIndex]) {
          throw new IllegalMove(`${cardLabel(source)} has to point at a project.`);
        }
        burning = [targetIndex];
      }

      let worth = 0;
      const names: string[] = [];
      // Highest index first, so removing one does not move the next one out from
      // under the loop.
      for (const at of [...burning].sort((a, b) => b - a)) {
        const position = board[at]!;
        worth += position.earned;
        names.push(projectById(index, position.cardId).name);

        // The position goes without the usual clawback: you chose this, so what
        // it made is yours to keep and to throw. Where the card itself lands is
        // the one thing `returns` changes — hand instead of discard, so you can
        // launch the same project again.
        removePosition(state, player, at, effect.returns ? "hand" : "discard", index);
      }
      const name = names.length === 1 ? names[0]! : `${names.length} positions`;

      const victim = otherPlayer(player);
      changeMC(state, victim, -worth, index);

      // What comes back, if this card is one of the ones that gives anything
      // back. Taken off the same `worth` as the damage, so the two halves of the
      // card can never disagree about what the position was.
      const back = effect.keep ? Math.round((worth * effect.keep) / 100) : 0;
      if (back > 0) changeMC(state, player, back, index);

      const gave = back <= 0 ? "" : `, ${formatMC(back)} back to you`;
      log(
        state,
        player,
        `${cardLabel(source)}: ${name} burned for ${formatMC(worth)} — straight off the opponent${gave}.`,
        "dump",
      );
      return;
    }

    case "attach": {
      const targets = findTargets(state, effect.target, player, targetIndex, source, index);
      if (reportEmpty(state, targets, player, source)) return;

      let last = "";
      for (const t of targets) {
        const position = state.players[t.owner].projects[t.slot]!;
        position.ticks = [...(position.ticks ?? []), {
          cardId: source.id,
          owner: player,
          effect: effect.every,
        }];
        last = owned(t.owner, projectById(index, position.cardId).name);
      }

      const mine = ownersOf(effect.target, player).every((o) => o === player);
      log(
        state,
        player,
        targets.length === 1
          ? `${cardLabel(source)}: attached to ${last} — it happens every turn now.`
          : `${cardLabel(source)}: attached to ${plural(targets.length, "position", "positions")} — every turn from now.`,
        mine ? "pump" : "dump",
      );
      return;
    }

    case "scalePump": {
      const targets = findTargets(state, effect.target, player, targetIndex, source, index);
      if (reportEmpty(state, targets, player, source)) return;

      let moved = 0;
      let last = "";
      for (const t of targets) {
        const position = state.players[t.owner].projects[t.slot]!;
        const card = projectById(index, position.cardId);
        const now = card.pumpMC + position.extraPump;
        // Rounded to whole thousands, because every other pump on every other
        // card is a whole number of thousands and a position quietly yielding
        // $7,313 would be the only one in the game that is not.
        const change = Math.round((now * effect.percentage) / 100 / 1_000) * 1_000;
        // Floored at cancelling the card's own pump: a position can be worth
        // nothing per turn and never worth less than nothing, which is the same
        // rule pumpOf enforces at payout.
        position.extraPump = Math.max(-card.pumpMC, position.extraPump + change);
        if (change !== 0) moved += 1;
        last = owned(t.owner, cardLabel(card));
      }

      const up = effect.percentage > 0;
      log(
        state,
        player,
        moved === 0
          ? `${cardLabel(source)}: nothing left to move.`
          : targets.length === 1
            ? `${cardLabel(source)}: ${last} pumps ${Math.abs(effect.percentage)}% ${up ? "more" : "less"} per turn.`
            : // Same as the heal above: one project pumps, several pump.
              `${cardLabel(source)}: ${plural(moved, "project", "projects")} ${moved === 1 ? "pumps" : "pump"} ${Math.abs(effect.percentage)}% ${up ? "more" : "less"} per turn.`,
        up ? "pump" : "dump",
      );
      return;
    }

    case "merge": {
      const board = state.players[player].projects;
      // The one this card opened is the last on the board. Everything before it
      // goes; if it is alone there is nothing to merge and the card says so.
      const into = board.length - 1;
      if (into <= 0) {
        log(state, player, `${cardLabel(source)}: nothing else on your board to fold in.`, "neutral");
        return;
      }
      const keeping = board[into]!;
      let pump = 0;
      let earned = 0;
      const names: string[] = [];
      for (let slot = into - 1; slot >= 0; slot--) {
        const position = board[slot]!;
        const card = projectById(index, position.cardId);
        // What it pays now, damage and all — merging a position that has been
        // chipped moves what is left of it rather than what it was printed with.
        pump += pumpOf(state, player, slot, index);
        earned += position.earned;
        names.push(card.name);
        state.players[player].discard.push(position.cardId);
        board.splice(slot, 1);
      }
      keeping.extraPump += pump;
      keeping.earned += earned;
      log(
        state,
        player,
        `${cardLabel(source)}: ${plural(names.length, "position", "positions")} folded in — ` +
          `${formatMC(pump)} more per turn on one card.`,
        "pump",
      );
      return;
    }

    case "fork": {
      const them = otherPlayer(player);
      const theirs = state.players[them].projects;
      if (theirs.length === 0) {
        log(state, player, `${cardLabel(source)}: they have nothing to fork.`, "neutral");
        return;
      }
      // Strongest by what it pays, not by what it cost: a chipped mythic can be
      // worth less than a whole rare, and it is the yield you are copying.
      let best = 0;
      for (let slot = 1; slot < theirs.length; slot++) {
        if (pumpOf(state, them, slot, index) > pumpOf(state, them, best, index)) best = slot;
      }
      const original = theirs[best]!;
      const card = projectById(index, original.cardId);

      // One position per project on a board, so forking something you already
      // hold has nowhere to go.
      const already = state.players[player].projects.some(
        (p) => projectById(index, p.cardId).project === card.project,
      );
      if (already) {
        log(state, player, `${cardLabel(source)}: you already hold ${card.name}.`, "neutral");
        return;
      }
      if (state.players[player].projects.length >= portfolioSizeFor(state, player, index)) {
        log(state, player, `${cardLabel(source)}: no room on your board for it.`, "neutral");
        return;
      }

      // As printed. Their pump bonuses, their damage and anything hung on them
      // stay with the original — you have forked the project, not the position.
      state.players[player].projects.push({
        cardId: card.id,
        holders: card.holders,
        extraPump: 0,
        earned: card.launchMC,
        playedOnTurn: state.turn,
      });
      changeMC(state, player, card.launchMC, index);
      log(
        state,
        player,
        `${cardLabel(source)}: forked ${card.name} — ${formatMC(card.launchMC)} MC and ` +
          `${formatMC(card.pumpMC)} a turn.`,
        "pump",
      );
      return;
    }

    case "peekAndBurn": {
      const them = otherPlayer(player);
      const deck = state.players[them].deck;
      if (deck.length === 0) {
        log(state, player, `${cardLabel(source)}: their deck is empty.`, "neutral");
        return;
      }
      // The top of a deck is the end of the array — that is where draw() takes
      // from — so the cards on offer are the last `look` of it, and the index
      // the player picked counts from the top down.
      const seen = Math.min(effect.look, deck.length);
      const pick = targetIndex ?? 0;
      if (!Number.isInteger(pick) || pick < 0 || pick >= seen) {
        throw new IllegalMove(
          `${cardLabel(source)} shows ${seen} cards; ${pick} is not one of them.`,
        );
      }
      const at = deck.length - 1 - pick;
      const [burned] = deck.splice(at, 1);
      if (!burned) return;
      state.players[them].discard.push(burned);
      const card = cardById(index, burned);
      log(
        state,
        player,
        `${cardLabel(source)}: ${cardLabel(card)} taken out of their deck before they ever saw it.`,
        "dump",
      );
      return;
    }

    case "benchmark": {
      const board = state.players[player].projects;
      if (targetIndex === undefined || !board[targetIndex]) {
        throw new IllegalMove(`${cardLabel(source)} has to point at a project.`);
      }
      const position = board[targetIndex]!;
      const card = projectById(index, position.cardId);

      const them = otherPlayer(player);
      let theirBest = 0;
      for (let slot = 0; slot < state.players[them].projects.length; slot++) {
        theirBest = Math.max(theirBest, pumpOf(state, them, slot, index));
      }

      const now = pumpOf(state, player, targetIndex, index);
      // The gap to their best, never negative — a floor rather than a ceiling —
      // and then whatever the card adds on top.
      const lift = Math.max(0, theirBest - now) + (effect.plus ?? 0);
      if (lift <= 0) {
        log(
          state,
          player,
          `${cardLabel(source)}: nothing on their board to measure against.`,
          "neutral",
        );
        return;
      }
      position.extraPump += lift;
      log(
        state,
        player,
        theirBest > now
          ? `${cardLabel(source)}: ${cardLabel(card)} up to ${formatMC(theirBest + (effect.plus ?? 0))} a turn — their best is ${formatMC(theirBest)}.`
          : `${cardLabel(source)}: ${cardLabel(card)} pumps ${formatMC(lift)} more — already above their best.`,
        "pump",
      );
      return;
    }

    case "unbankedMC": {
      const side = state.players[player];
      const unbanked = side.projects.reduce((sum, position) => sum + position.earned, 0);
      if (unbanked <= 0) {
        // Rule 2: an effect that achieved nothing says so.
        log(
          state,
          player,
          `${cardLabel(source)}: nothing on the board that has not been banked.`,
          "system",
        );
        return;
      }
      const paid = Math.round((unbanked * effect.percentage) / 100);
      changeMC(state, player, paid, index);
      log(
        state,
        player,
        `${cardLabel(source)}: ${formatMC(paid)} — ${effect.percentage}% of the ` +
          `${formatMC(unbanked)} still out there.`,
        "pump",
      );
      return;
    }

    case "peakMC": {
      const peak = state.peakMC[player];
      const gained = Math.round((peak * effect.percentage) / 100);
      if (gained <= 0) {
        log(state, player, `${cardLabel(source)}: the counter is still at zero.`, "neutral");
        return;
      }
      changeMC(state, player, gained, index);
      log(
        state,
        player,
        `${cardLabel(source)}: ${effect.percentage}% of ${formatMC(peak)} — the highest you have been.`,
        "pump",
      );
      return;
    }

    case "after": {
      // The aim is captured now and stored by project, because the player is
      // pointing at something now and will not be there to point again. A slot
      // number would rot: close a position and everything after it shifts one
      // along, so the mark would land on whatever moved into the place.
      let mark: Pending["mark"];
      const inner = effect.effect;
      if (effect.marks) {
        const owner = boardOf(effect.marks, player);
        const board = state.players[owner].projects;
        if (targetIndex === undefined || !board[targetIndex]) {
          throw new IllegalMove(`${cardLabel(source)} has to point at a project.`);
        }
        const at = cardById(index, board[targetIndex]!.cardId);
        if (at.type !== "project") throw new Error(`Position ${targetIndex} is not a project.`);
        mark = { player: owner, project: at.project };
      }

      // Before the waiting, and before the log line that announces the wait — the
      // order on the card is the order it happens in.
      if (effect.now) applyEffect(state, effect.now, player, source, targetIndex, index);

      state.pending.push({
        cardId: source.id,
        owner: player,
        onTurn: state.turn + effect.turns,
        effect: inner,
        ...(effect.ifGone ? { ifGone: effect.ifGone } : {}),
        ...(mark ? { mark } : {}),
      });
      log(
        state,
        player,
        // Deliberately not the same words as the line that fires it. Two log
        // entries reading "comes due" — one announcing, one collecting — is a
        // log you cannot search and a test that cannot tell them apart.
        mark
          ? `${cardLabel(source)}: marked. Due on turn ${state.turn + effect.turns}.`
          : `${cardLabel(source)}: set going. Due on turn ${state.turn + effect.turns}.`,
        "neutral",
      );
      return;
    }

    default:
      return assertNever(effect, "applyEffect");
  }
}

// ---------------------------------------------------------------------------

function findTargets(
  state: State,
  target: TargetProject,
  player: Player,
  targetIndex: number | undefined,
  source: Card,
  index: CardIndex,
): Targeted[] {
  // Aimed by the card rather than by the player: whichever of theirs yields the
  // most right now. No target index is asked for and none is used.
  if (target === "enemyBest") {
    const them = otherPlayer(player);
    const board = state.players[them].projects;
    if (board.length === 0) return [];
    let best = 0;
    for (let slot = 1; slot < board.length; slot++) {
      if (pumpOf(state, them, slot, index) > pumpOf(state, them, best, index)) best = slot;
    }
    return [{ owner: them, slot: best }];
  }

  // Table-wide targets cover both boards, so this cannot assume a single owner.
  if (!needsChoice(target)) {
    const found: Targeted[] = [];
    for (const owner of ownersOf(target, player)) {
      state.players[owner].projects.forEach((_, slot) => found.push({ owner, slot }));
    }
    return found;
  }

  const owner = boardOf(target, player);
  const projects = state.players[owner].projects;

  if (targetIndex === undefined) {
    throw new IllegalMove(`${cardLabel(source)} has to point at a project, but no target was given.`);
  }
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= projects.length) {
    throw new IllegalMove(
      `${cardLabel(source)} points at project ${targetIndex}, but ${nameOf(owner)} has ${projects.length}.`,
    );
  }
  return [{ owner, slot: targetIndex }];
}

/** No targets is legitimate, but it must not happen silently. True means there was nothing to do. */
function reportEmpty(state: State, targets: Targeted[], player: Player, source: Card): boolean {
  if (targets.length > 0) return false;
  log(state, player, `${cardLabel(source)}: no project to hit.`, "neutral");
  return true;
}

/**
 * Takes a project off the board. The log line goes under the player who caused it,
 * not the victim — otherwise a rug shows up in the log under whoever took it and
 * the order stops making sense.
 */
function removeProject(
  state: State,
  targeted: Targeted,
  index: CardIndex,
  source: Card,
  culprit: Player,
  cause: "rug" | "holders",
): void {
  const side = state.players[targeted.owner];
  const project = side.projects[targeted.slot];
  if (!project) return;
  const card = projectById(index, project.cardId);
  removePosition(state, targeted.owner, targeted.slot, "discard", index);

  // A rug takes back everything the position produced. You were not out in time.
  // Closing it yourself would have banked exactly this amount.
  const lost = Math.min(side.mc, project.earned);
  // A loss, so no toll rides on it — a toll takes a cut of gains.
  changeMC(state, targeted.owner, -lost, index);

  // The cause goes first, and it names the card rather than the mechanism.
  // This read "RUG: your GOAT is gone — PNUT", which puts the word RUG where the
  // card name belongs: the maker watched three positions go and reported that
  // the opponent's Rug Pull had taken all three. It was PNUT · Binance in a Week
  // stripping two holders off every project, and three of them had two left.
  // cardLabel rather than name, because inside a family all eight share one.
  const who = owned(targeted.owner, cardLabel(card));
  log(
    state,
    culprit,
    cause === "rug"
      ? `${cardLabel(source)} rugs ${who} — ${formatDelta(-lost)} MC and the pump stops.`
      : `${cardLabel(source)} takes the last holders off ${who} — it rugs. ` +
        `${formatDelta(-lost)} MC and the pump stops.`,
    "dump",
  );
}

function nameOf(player: Player): string {
  return player === "you" ? "you" : "the opponent";
}

/** "your Popcat" or "Solana on the opponent's board". Always absolute, never relative. */
function owned(owner: Player, name: string): string {
  return owner === "you" ? `your ${name}` : `the opponent's ${name}`;
}

/**
 * Where a multi-target effect landed, for summary lines. A table-wide effect hits
 * both boards, so "on your board" would be a lie.
 */
/** The size of a card's aura, or zero if it carries none. */
function auraBonusOf(card: Card): number {
  const aura = auraOf(card);
  if (!aura) return 0;
  if (aura.kind === "pumpSector" || aura.kind === "pumpSectors") return aura.bonus;
  return 0;
}

function scope(target: TargetProject, targets: Targeted[]): string {
  if (target === "allProjects") return "across the table";
  const owner = targets[0]!.owner;
  return owner === "you" ? "on your board" : "on the opponent's board";
}
