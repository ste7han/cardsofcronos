// Seeded randomness. Every function here is pure: you hand it a state and get a
// new state back. There is no Math.random anywhere in this project.
//
// This isn't a luxury. CLAUDE.md demands a check where you run the same match
// twice, once with an effect and once with an empty one: if the outcome never
// changes, the card does nothing. That check is only possible when a match is
// fully replayable from { seed, moves }. It cannot be retrofitted.

export interface Draw {
  value: number;
  state: number;
}

/** mulberry32. One 32-bit state, good enough for a card game. */
export function next(state: number): Draw {
  const a = (state + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: a };
}

/** Integer in [0, bound). */
export function nextInt(bound: number, state: number): Draw {
  if (bound <= 0) throw new Error(`nextInt got a bound of ${bound}`);
  const { value, state: updated } = next(state);
  return { value: Math.floor(value * bound), state: updated };
}

/** Fisher-Yates. Returns a new list, leaves the original alone. */
export function shuffle<T>(list: readonly T[], state: number): { list: T[]; state: number } {
  const out = [...list];
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const draw = nextInt(i + 1, s);
    s = draw.state;
    const j = draw.value;
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return { list: out, state: s };
}

/** A random element. Throws on an empty list — silently returning null hides bugs. */
export function pickFrom<T>(list: readonly T[], state: number): { pick: T; state: number } {
  if (list.length === 0) throw new Error("pickFrom got an empty list");
  const { value, state: updated } = nextInt(list.length, state);
  return { pick: list[value]!, state: updated };
}
