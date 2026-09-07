// The music, when there is any.
//
// There was a generated piece here: a drone, a sub pulse and notes drawn out of
// A minor by a seeded PRNG, tightening as the turns ran out. It worked and the
// maker did not like it, which is the only verdict that counts on a question of
// taste. It is gone rather than tuned, because a synthesised pad is not going to
// become a track somebody loves by being adjusted.
//
// What is left is the part worth keeping: everything around a track. A file
// dropped in public/audio and named below is looped, faded in and out, routed
// through the same master gain the effects use — so one mute silences both — and
// given a switch at the table.
//
// UNTIL THERE IS A FILE, THERE IS NO BUTTON. A music toggle that plays nothing
// is worse than no music: it reads as broken rather than as absent, and the
// player has no way to tell which. hasTrack() is what the switch asks.

import { audio } from "@/lib/audio/engine";

/**
 * The track, or null while there is not one.
 *
 * To add music: put the file in public/audio/ and name it here. It should be
 * something that loops without a seam — a track that lands on a downbeat at both
 * ends — because it will run for the length of a match and a gap every two
 * minutes is heard far more than the music is.
 *
 * mp3 for reach. Every browser that can run this game plays it, and a format
 * that half the visitors cannot decode is a silence nobody can explain.
 */
export const TRACK: string | null = null;

/** Whether there is anything to play. See the note above the switch. */
export function hasTrack(): boolean {
  return TRACK !== null;
}

const MUSIC_KEY = "coc.music.on.v1";
/** Under the effects, always. It is a bed, not a part. */
const LEVEL = 0.4;
const FADE = 1.5;

let element: HTMLAudioElement | null = null;
let gain: GainNode | null = null;
let wired = false;

export const MUSIC_EVENT = "tcg:music";

export function musicOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // OFF by default, unlike the effects. The effects only answer something the
    // player did; music starts on its own, and a page that plays music at
    // somebody is a page they close.
    return window.localStorage.getItem(MUSIC_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMusicOn(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(MUSIC_KEY, "1");
    else window.localStorage.removeItem(MUSIC_KEY);
  } catch {
    // Will not survive a reload. Still works for this visit.
  }
  if (on) start();
  else stop();
  window.dispatchEvent(new Event(MUSIC_EVENT));
}

/**
 * Starts the track, if there is one and it is not already going.
 *
 * Idempotent: the table calls this from an effect that can run more than once,
 * and a second element playing over the first is the same track a half-second
 * out of phase with itself.
 *
 * Routed through the master gain rather than played on its own, so muting the
 * effects mutes this too. One switch that silences everything is what somebody
 * reaches for when a call starts.
 */
export function start(): void {
  if (TRACK === null) return;
  const a = audio();
  if (!a) return;

  if (element === null) {
    element = new Audio(TRACK);
    element.loop = true;
    element.preload = "auto";
    // Same origin, but say so: without it a browser can refuse to hand the
    // element to the audio graph and the music plays at full volume outside it,
    // deaf to the mute.
    element.crossOrigin = "anonymous";
  }

  if (!wired) {
    try {
      const source = a.ctx.createMediaElementSource(element);
      gain = a.ctx.createGain();
      gain.gain.value = 0.0001;
      source.connect(gain);
      gain.connect(a.master);
      wired = true;
    } catch {
      // Already wired to a context, or the browser refused. Either way the
      // element still plays; it simply will not obey the master gain, so it
      // carries its own level instead.
      element.volume = LEVEL;
    }
  }

  if (gain) {
    gain.gain.cancelScheduledValues(a.ctx.currentTime);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), a.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(LEVEL, a.ctx.currentTime + FADE);
  }
  // A play() that a browser refuses is a rejected promise and nothing else. The
  // switch stays where the player put it and the next gesture starts it.
  void element.play().catch(() => undefined);
}

export function stop(): void {
  if (element === null) return;
  const a = audio();
  if (gain && a) {
    // Faded, not cut. A track that stops dead is a click.
    gain.gain.cancelScheduledValues(a.ctx.currentTime);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), a.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, a.ctx.currentTime + FADE * 0.5);
    const el = element;
    window.setTimeout(() => el.pause(), FADE * 500);
  } else {
    element.pause();
  }
}

/** True while a track is playing. */
export function playing(): boolean {
  return element !== null && !element.paused;
}
