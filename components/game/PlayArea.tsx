"use client";

// The table, and the choice of who is sitting across it.
//
// A thin wrapper and deliberately so: Game owns the match and Opponents owns the
// choice, and the only thing that has to live between them is which board is
// picked. Putting the picker inside Game would have meant the component that
// runs a match also deciding which match to run.
//
// Changing the board remounts the table by key. The opponent's deck comes from
// the board, and a match that swapped decks halfway through is not a match — the
// server replays from the seed and the board, and would rightly refuse it.

import { useState } from "react";

import { BOARDS, boardOf } from "@/data/boards";
import { Game } from "@/components/game/Game";
import { Opponents } from "@/components/game/Opponents";

export function PlayArea() {
  const [chosen, setChosen] = useState(BOARDS[0]!.id);
  const board = boardOf(chosen) ?? BOARDS[0]!;

  return (
    <>
      <Opponents chosen={chosen} onChoose={setChosen} />
      <Game key={board.id} board={board} />
    </>
  );
}
