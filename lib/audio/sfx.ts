// What each cue actually sounds like.
//
// One switch, and it is exhaustive: the `never` at the bottom means a cue added
// to the union in cues.ts without a sound here does not compile. CLAUDE.md is
// blunt about why. In the last project an unknown name fell through to "do
// nothing" while the log reported that it had fired, and 110 of 235 cards
// demonstrably did nothing. This is a smaller stake and the same trap, so it
// gets the same rule: an unknown value fails hard.
//
// THE PALETTE. Nothing here is cartoon and nothing is arcade. The game is about
// a trading terminal at four in the morning, so the vocabulary is a terminal's:
// short filtered clicks, sub-bass thuds, a clean interval when money is made and
// a detuned one when it is lost. Everything is under half a second except a rug
// and the end of a match, because those are the two moments that deserve to be
// waited out.
//
// One scale throughout, A minor, so the effects and the music in music.ts agree
// with each other rather than fighting. A card landing and the bass note under
// it are the same root two octaves apart.

import type { Cue } from "@/lib/audio/cues";
import { audio, noise, tone } from "@/lib/audio/engine";

/** A minor, from the low root the music sits on. */
const A2 = 110;
const NOTE = {
  a2: A2,
  a3: A2 * 2,
  c4: A2 * 2 * 1.1892, // minor third
  e4: A2 * 3, // fifth
  a4: A2 * 4,
  c5: A2 * 4 * 1.1892,
  e5: A2 * 6,
  a5: A2 * 8,
};

/**
 * Plays one cue.
 *
 * Silent and cheap when sound is off: audio() returns null, every tone and
 * noise call returns immediately, and no context is ever created. A muted table
 * does not build an audio graph it will not use.
 */
export function play(cue: Cue, delay = 0): void {
  if (!audio()) return;
  const d = delay;

  switch (cue) {
    // --- things you do -----------------------------------------------------

    // A card meeting the table. A click with a little body under it, so it feels
    // like a physical thing landing rather than a UI event.
    case "card-played":
      noise({ dur: 0.055, gain: 0.28, cutoff: 3800, cutoffTo: 700, delay: d });
      tone({ freq: NOTE.a3, to: NOTE.a2, type: "triangle", dur: 0.11, gain: 0.16, delay: d });
      return;

    // Thrown away. The same click with the pitch going the other way and no
    // body: a card leaving without arriving anywhere.
    case "card-discarded":
      noise({ dur: 0.09, gain: 0.16, cutoff: 1600, cutoffTo: 320, delay: d });
      tone({ freq: NOTE.c4, to: NOTE.a2, type: "sine", dur: 0.14, gain: 0.07, delay: d });
      return;

    // Taking profit, which is the good moment in this game and gets the only
    // proper melody: root, fifth, octave, quickly, like a fill order.
    case "profit-taken":
      tone({ freq: NOTE.a4, type: "sine", dur: 0.1, gain: 0.13, delay: d });
      tone({ freq: NOTE.e5, type: "sine", dur: 0.1, gain: 0.12, delay: d + 0.055 });
      tone({ freq: NOTE.a5, type: "sine", dur: 0.24, gain: 0.11, delay: d + 0.11 });
      noise({ dur: 0.3, gain: 0.05, cutoff: 6000, cutoffTo: 12000, type: "highpass", delay: d });
      return;

    // The turn passing. Deliberately plain: it happens every turn and anything
    // with character would wear out by turn four.
    case "turn-ended":
      tone({ freq: NOTE.e4, to: NOTE.a3, type: "sine", dur: 0.16, gain: 0.08, delay: d });
      return;

    // A card arriving in hand. The quietest sound here, because it fires most.
    case "draw":
      noise({ dur: 0.04, gain: 0.1, cutoff: 5200, cutoffTo: 1800, type: "highpass", delay: d });
      return;

    // --- things that happen to a board -------------------------------------

    // The pump phase. A soft swell rather than a hit: it is the heartbeat of the
    // turn and it should feel like the board breathing.
    case "pump":
      tone({
        freq: NOTE.a3,
        to: NOTE.e4,
        type: "triangle",
        dur: 0.36,
        gain: 0.09,
        attack: 0.08,
        cutoff: 2400,
        delay: d,
      });
      return;

    // Damage. Low, dry, unpleasant, and short.
    case "damage":
      noise({ dur: 0.13, gain: 0.3, cutoff: 900, cutoffTo: 180, delay: d });
      tone({ freq: 150, to: 60, type: "square", dur: 0.14, gain: 0.11, cutoff: 700, delay: d });
      return;

    // Holders coming back. The mirror of damage: the same shape upward, soft.
    case "heal":
      tone({
        freq: NOTE.c4,
        to: NOTE.e4,
        type: "sine",
        dur: 0.26,
        gain: 0.09,
        attack: 0.05,
        delay: d,
      });
      return;

    // A rug. The longest thing on the table and the only dissonant one: a
    // tritone falling away under a long noise sweep. It should be slightly
    // horrible, because it is.
    case "rug":
      tone({ freq: NOTE.a3, to: 42, type: "sawtooth", dur: 0.85, gain: 0.13, cutoff: 900, delay: d });
      tone({ freq: NOTE.a3 * 1.414, to: 55, type: "sawtooth", dur: 0.8, gain: 0.09, cutoff: 700, delay: d + 0.02 });
      noise({ dur: 0.7, gain: 0.16, cutoff: 2400, cutoffTo: 120, delay: d });
      return;

    // The number moving because a card said so. Small, so it can sit under a
    // card landing without competing with it.
    case "mc-up":
      tone({ freq: NOTE.e4, to: NOTE.a4, type: "sine", dur: 0.15, gain: 0.08, delay: d });
      return;

    case "mc-down":
      tone({ freq: NOTE.e4, to: NOTE.a3, type: "sine", dur: 0.18, gain: 0.08, delay: d });
      return;

    // --- the table itself ---------------------------------------------------

    // Picking a card up. Almost nothing, because it fires on every hover-click
    // and anything with a tail would smear.
    case "select":
      tone({ freq: NOTE.a5, type: "sine", dur: 0.035, gain: 0.05, delay: d });
      return;

    // A refused move. One flat buzz, no pitch movement: nothing happened.
    case "deny":
      tone({ freq: 98, type: "square", dur: 0.12, gain: 0.09, cutoff: 500, delay: d });
      return;

    // --- the end ------------------------------------------------------------

    // Won. An A minor chord that opens rather than resolves, held.
    case "match-won":
      tone({ freq: NOTE.a3, type: "triangle", dur: 1.5, gain: 0.11, attack: 0.02, delay: d });
      tone({ freq: NOTE.c4, type: "triangle", dur: 1.4, gain: 0.08, attack: 0.03, delay: d + 0.08 });
      tone({ freq: NOTE.e4, type: "triangle", dur: 1.4, gain: 0.08, attack: 0.03, delay: d + 0.16 });
      tone({ freq: NOTE.a4, type: "sine", dur: 1.6, gain: 0.09, attack: 0.05, delay: d + 0.24 });
      return;

    // Lost. The same three notes, in the other order, sliding down and darker.
    case "match-lost":
      tone({ freq: NOTE.a4, to: NOTE.a3, type: "sawtooth", dur: 1.1, gain: 0.08, cutoff: 800, delay: d });
      tone({ freq: NOTE.c4, to: A2 * 1.1892, type: "sawtooth", dur: 1.2, gain: 0.07, cutoff: 600, delay: d + 0.12 });
      noise({ dur: 1.0, gain: 0.06, cutoff: 1400, cutoffTo: 120, delay: d });
      return;

    // Drawn. Two notes a fifth apart, held, going nowhere.
    case "match-drawn":
      tone({ freq: NOTE.a3, type: "sine", dur: 1.2, gain: 0.09, attack: 0.04, delay: d });
      tone({ freq: NOTE.e4, type: "sine", dur: 1.2, gain: 0.07, attack: 0.04, delay: d });
      return;

    default: {
      // A cue with no sound does not compile. See the note at the top.
      const never: never = cue;
      throw new Error(`No sound for cue "${String(never)}".`);
    }
  }
}

/**
 * A run of cues, spaced out.
 *
 * Stacked rather than fired together. A card that lands, hits two positions and
 * lifts the market cap is three things that happened in that order, and playing
 * them at the same instant turns them into one chord that says nothing. Sixty
 * milliseconds is enough to be heard as a sequence and short enough that the
 * whole run is over before the flash markers are.
 */
export function playAll(cues: readonly Cue[], gap = 0.06): void {
  cues.forEach((cue, i) => play(cue, i * gap));
}
