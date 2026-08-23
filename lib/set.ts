// The set as the app uses it.
//
// Validation runs here, when the module loads. Everything that imports the set —
// the gallery, the board, the landing page — therefore falls over the moment a
// broken card is in it. That's the point: a broken card should hit you in the
// face at startup, not turn up a year later.

import { CARDS } from "@/data/cards";
import { buildIndex } from "@/engine/match";
import { validateSet } from "@/engine/validation";

validateSet(CARDS);

export const SET = CARDS;
export const INDEX = buildIndex(CARDS);
