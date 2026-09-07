"use client";

// The two switches, at the table.
//
// Two and not one, because they are different promises. The effects only answer
// something the player just did, so they are on by default and a card landing in
// silence would read as the click not registering. The music starts on its own
// and keeps going, which nobody asked for, so it is off until it is asked for.
//
// Both are remembered. Being made to turn the music off once per visit is worse
// than never having offered it.

import { useEffect, useState } from "react";

import { isMuted, setMuted, SOUND_EVENT } from "@/lib/audio/engine";
import { hasTrack, musicOn, MUSIC_EVENT, setMusicOn } from "@/lib/audio/music";
import { cx } from "@/lib/cx";

export function SoundToggle() {
  // Read after mount, like everything that touches storage: the server has no
  // localStorage, and rendering the wrong state for one frame makes the button
  // flicker into its opposite.
  const [muted, setMutedState] = useState(true);
  const [music, setMusicState] = useState(false);

  useEffect(() => {
    const read = () => {
      setMutedState(isMuted());
      setMusicState(musicOn());
    };
    read();
    window.addEventListener(SOUND_EVENT, read);
    window.addEventListener(MUSIC_EVENT, read);
    return () => {
      window.removeEventListener(SOUND_EVENT, read);
      window.removeEventListener(MUSIC_EVENT, read);
    };
  }, []);

  // Short on purpose. The words SOUND and MUSIC came to about 140px, which was
  // enough to push the turn bar past its width: the controls on the right —
  // take profit, the log, end turn — wrapped onto a second line and, under
  // justify-between, landed at the left of it. A mute button is not worth a
  // line of its own, let alone somebody else's.
  const button =
    "border px-1.5 py-2 text-[9px] leading-none tracking-[0.12em] transition-colors";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        title={muted ? "Sound is off. Turn it on." : "Sound is on. Mute it."}
        aria-label={muted ? "Turn the sound on" : "Mute"}
        aria-pressed={!muted}
        className={cx(
          button,
          muted
            ? "border-line text-faint line-through decoration-1 hover:border-line-strong hover:text-muted"
            : "border-pump/60 text-pump hover:bg-pump/10",
        )}
      >
        SFX
      </button>
      {/* No track, no button. A music switch that plays nothing reads as broken
          rather than as absent, and the player has no way to tell which. See
          TRACK in lib/audio/music.ts. */}
      {hasTrack() && (
      <button
        type="button"
        // Muting everything should not leave a music button claiming to play.
        // The master gain is at zero either way; saying so is cheaper than
        // letting somebody wonder why the switch does nothing.
        disabled={muted}
        onClick={() => setMusicOn(!music)}
        title={
          muted
            ? "Turn the sound on first."
            : music
              ? "Stop the music."
              : "Play the music. It is generated as you go, not a file."
        }
        aria-label={music ? "Stop the music" : "Play the music"}
        aria-pressed={music}
        className={cx(
          button,
          "text-[11px] disabled:cursor-not-allowed disabled:opacity-30",
          music
            ? "border-gold/60 text-gold hover:bg-gold/10"
            : "border-line text-faint hover:border-line-strong hover:text-muted",
        )}
      >
        ♪
      </button>
      )}
    </div>
  );
}
