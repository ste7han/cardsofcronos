// The one AudioContext, and the switch that silences it.
//
// NOTHING IS LOADED. Every sound on this site is generated in the browser from
// oscillators and noise, and there is not a single audio file. That is not a
// stunt: this ships from a Cloudflare Worker where every kilobyte is paid for on
// every visit, a set of decent sound effects is a megabyte or two, and a music
// loop is several more. The whole audio layer as written is a few kilobytes of
// JavaScript, which is smaller than one of the card images.
//
// It also means there is nothing to license, nothing to host, and nothing that
// can 404 in the middle of a match.
//
// A browser will not let a page make noise before somebody has interacted with
// it, and that rule is right. So the context is created on the first sound
// asked for after a real gesture, never at import, and resumed if it was
// suspended.

/** Where the volume sits when sound is on. Left low on purpose: this is a game
 *  people play with something else on in another tab. */
const MASTER = 0.35;

const MUTE_KEY = "coc.sound.muted.v1";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted: boolean | null = null;

/**
 * The context, or null when there cannot be one.
 *
 * Null on the server, and null in a browser that has no Web Audio at all. Every
 * caller treats that as "no sound" rather than as an error, because a game that
 * throws because it could not make a noise is a worse game than a quiet one.
 */
export function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (isMuted()) return null;

  if (ctx === null) {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(ctx.destination);
  }

  // Suspended is the normal state before the first gesture, and also what a
  // browser does when the tab goes to the background. Resuming is cheap and
  // returns a promise nobody needs to wait for.
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, master: master! };
}

/** Now, in the context's own clock. */
export function now(): number {
  return audio()?.ctx.currentTime ?? 0;
}

export function isMuted(): boolean {
  if (muted !== null) return muted;
  if (typeof window === "undefined") return true;
  try {
    // On by default. The sounds only fire on things the player themselves did,
    // and a card game that lands a card in silence feels broken rather than
    // polite. The music is a separate switch and is the one that starts off.
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    muted = false;
  }
  return muted;
}

export const SOUND_EVENT = "tcg:sound";

export function setMuted(value: boolean): void {
  muted = value;
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(MUTE_KEY, "1");
    else window.localStorage.removeItem(MUTE_KEY);
  } catch {
    // The switch will not survive a reload. It still works for this visit, and
    // the alternative is refusing to turn the sound off, which is worse.
  }
  // Muting mid-sound should be immediate, not "after this one finishes".
  if (value && master) master.gain.value = 0;
  else if (master) master.gain.value = MASTER;
  window.dispatchEvent(new Event(SOUND_EVENT));
}

// ---------------------------------------------------------------------------
// The small kit every sound is built from.
// ---------------------------------------------------------------------------

/** One pitched blip, with an envelope. Everything melodic is made of these. */
export function tone(opts: {
  /** Hz. */
  freq: number;
  /** Hz to slide to over the length of the note, if it should move. */
  to?: number;
  type?: OscillatorType;
  /** Seconds. */
  dur: number;
  /** Peak, before the master. Keep these well under 1. */
  gain: number;
  /** Seconds until peak. Short is a click, long is a swell. */
  attack?: number;
  /** Seconds from now to start. */
  delay?: number;
  /** A lowpass in front of it, in Hz. */
  cutoff?: number;
}): void {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + (opts.delay ?? 0);

  const osc = a.ctx.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t);
  if (opts.to !== undefined) osc.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);

  const env = a.ctx.createGain();
  const attack = opts.attack ?? 0.005;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(opts.gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);

  let tail: AudioNode = env;
  if (opts.cutoff !== undefined) {
    const filter = a.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(opts.cutoff, t);
    env.connect(filter);
    tail = filter;
  }

  osc.connect(env);
  tail.connect(a.master);
  osc.start(t);
  osc.stop(t + opts.dur + 0.02);
}

/** A burst of filtered noise. Everything percussive is made of these. */
export function noise(opts: {
  dur: number;
  gain: number;
  /** Hz. */
  cutoff: number;
  /** Hz to sweep the filter to, if it should move. */
  cutoffTo?: number;
  type?: BiquadFilterType;
  delay?: number;
}): void {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + (opts.delay ?? 0);

  // Built once per hit rather than cached. A buffer this short costs nothing to
  // fill, and a shared one would make every hit identical, which the ear picks
  // up faster than it picks up anything else here.
  const frames = Math.max(1, Math.floor(a.ctx.sampleRate * opts.dur));
  const buffer = a.ctx.createBuffer(1, frames, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const source = a.ctx.createBufferSource();
  source.buffer = buffer;

  const filter = a.ctx.createBiquadFilter();
  filter.type = opts.type ?? "lowpass";
  filter.frequency.setValueAtTime(opts.cutoff, t);
  if (opts.cutoffTo !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.cutoffTo), t + opts.dur);
  }

  const env = a.ctx.createGain();
  env.gain.setValueAtTime(opts.gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);

  source.connect(filter);
  filter.connect(env);
  env.connect(a.master);
  source.start(t);
  source.stop(t + opts.dur);
}
