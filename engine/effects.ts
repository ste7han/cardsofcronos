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
import type {
  Card,
  CardIndex,
  Condition,
  Effect,
  Player,
  Sector,
  State,
  TargetProject,
} from "./types";
import {
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
): boolean {
  switch (condition.kind) {
    case "behindBy": {
      const them = player === "you" ? "opponent" : "you";
      return state.players[them].mc - state.players[player].mc >= condition.mc;
    }
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
    case "turnAtLeast":
      return state.turn >= condition.turn;
    default:
      return assertNever(condition, "holds");
  }
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
      for (const target of playersOf(effect.target, player)) {
        const actual = changeMC(state, target, effect.mc);

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
        const actual = changeMC(state, target, wanted);
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
      const targets = findTargets(state, effect.target, player, targetIndex, source);
      if (reportEmpty(state, targets, player, source)) return;

      for (const t of targets) {
        state.players[t.owner].projects[t.slot]!.extraPump += effect.mc;
      }
      // One target gets a line with its name; several targets get one summary.
      // Otherwise a card that hits the whole board writes ten identical lines.
      const first = targets[0]!;
      const name = projectById(index, state.players[first.owner].projects[first.slot]!.cardId).name;
      log(
        state,
        player,
        targets.length === 1
          ? `${cardLabel(source)}: ${owned(first.owner, name)} pumps ${formatDelta(effect.mc)} MC more per turn.`
          : `${cardLabel(source)}: ${plural(targets.length, "project", "projects")} ${scope(effect.target, targets)} pump ${formatDelta(effect.mc)} MC more per turn.`,
        effect.mc > 0 ? "pump" : "dump",
      );
      return;
    }

    case "pumpBySector": {
      const targets = findTargets(state, effect.target, player, targetIndex, source);
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
      const targets = findTargets(state, effect.target, player, targetIndex, source);
      if (reportEmpty(state, targets, player, source)) return;

      const survivors: string[] = [];

      // Back to front, so removing one doesn't shift the slots before it.
      // A rug always gets its own line — too important to summarise away.
      for (const t of [...targets].sort((a, b) => b.slot - a.slot)) {
        const project = state.players[t.owner].projects[t.slot]!;
        const name = projectById(index, project.cardId).name;
        project.holders -= effect.amount;
        if (project.holders <= 0) {
          removeProject(state, t, index, source, player, "holders");
        } else if (targets.length === 1) {
          log(
            state,
            player,
            `${cardLabel(source)}: ${owned(t.owner, name)} loses ${plural(effect.amount, "holder", "holders")} (${plural(project.holders, "holder", "holders")} left).`,
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
          `${cardLabel(source)}: ${plural(survivors.length, "project", "projects")} ${scope(effect.target, targets)} lose ${plural(effect.amount, "holder", "holders")}.`,
          "dump",
        );
      }
      return;
    }

    case "healHolders": {
      const targets = findTargets(state, effect.target, player, targetIndex, source);
      if (reportEmpty(state, targets, player, source)) return;

      let healed = 0;
      let touched = 0;
      let last = "";

      for (const t of targets) {
        const project = state.players[t.owner].projects[t.slot]!;
        const card = projectById(index, project.cardId);
        const before = project.holders;
        project.holders = Math.min(project.holders + effect.amount, card.holders);
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
            ? `${cardLabel(source)}: ${plural(touched, "project", "projects")} get ${plural(healed, "holder", "holders")} back between them.`
            : `${cardLabel(source)}: everything was already at full holders.`,
          touched > 0 ? "pump" : "neutral",
        );
      }
      return;
    }

    case "rug": {
      const targets = findTargets(state, effect.target, player, targetIndex, source);
      if (reportEmpty(state, targets, player, source)) return;
      for (const t of [...targets].sort((a, b) => b.slot - a.slot)) {
        removeProject(state, t, index, source, player, "rug");
      }
      return;
    }

    case "stealMC": {
      const victim = otherPlayer(player);
      const amount = Math.round((state.players[victim].mc * effect.percentage) / 100);
      if (amount <= 0) {
        log(state, player, `${cardLabel(source)}: there was nothing to take.`, "neutral");
        return;
      }
      changeMC(state, victim, -amount);
      changeMC(state, player, amount);
      log(
        state,
        player,
        `${cardLabel(source)}: ${formatMC(amount)} MC siphoned off ${nameOf(victim)}.`,
        "pump",
      );
      return;
    }

    case "drawCards": {
      const before = state.players[player].hand.length;
      draw(state, player, effect.amount);
      const gained = state.players[player].hand.length - before;
      log(state, player, `${cardLabel(source)}: drew ${plural(gained, "card", "cards")}.`, "neutral");
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
      for (const side of playersOf(effect.target, player)) {
        if (side === player) {
          state.budgetThisTurn += effect.mc;
          log(
            state,
            player,
            `${cardLabel(source)}: ${formatMC(effect.mc)} more marketing budget this turn.`,
            "pump",
          );
        } else {
          state.players[side].pendingBudget += effect.mc;
          log(
            state,
            player,
            `${cardLabel(source)}: ${formatMC(effect.mc)} of marketing budget lands on the opponent next turn, spent or not.`,
            "dump",
          );
        }
      }
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
): Targeted[] {
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
  side.projects.splice(targeted.slot, 1);
  side.discard.push(project.cardId);

  // A rug takes back everything the position produced. You were not out in time.
  // Closing it yourself would have banked exactly this amount.
  const lost = Math.min(side.mc, project.earned);
  side.mc -= lost;

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

/** Market cap can't go below zero. Returns the change that actually happened. */
function changeMC(state: State, player: Player, delta: number): number {
  const side = state.players[player];
  const before = side.mc;
  side.mc = Math.max(0, side.mc + delta);
  return side.mc - before;
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
  return aura.kind === "pumpSector" ? aura.bonus : 0;
}

function scope(target: TargetProject, targets: Targeted[]): string {
  if (target === "allProjects") return "across the table";
  const owner = targets[0]!.owner;
  return owner === "you" ? "on your board" : "on the opponent's board";
}
