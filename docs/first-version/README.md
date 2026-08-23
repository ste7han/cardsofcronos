# What the first version measured

Three documents, in Dutch, generated from the engine that ran Cards of Cronos
between early 2025 and the rebuild. They are kept because they are the expensive
half of that project: twenty-five thousand simulated matches, and the only
record of which of the original 235 cards actually did anything.

The engine that produced them is gone from this branch — it lived in
`game-engine/`, it ran as a Firebase function, and it went when Firebase did.
Rerunning any of this would mean restoring that engine from
`git show fix/battle-system:game-engine/`. The numbers are worth more than the
code that made them.

They are the reason two of every faction's ten project cards were dropped rather
than picked when the set was rewritten.

| File | What is in it |
|---|---|
| `AUDIT.md` | The balance audit. Which cards influence the outcome and which provably do not, measured by playing the same match with and without each card. It closes at 145 cards that matter and **56 of 235 that never change a result**. |
| `VOORWAARDEN.md` | How often each card's condition is actually satisfied, over 18,800 matches, sorted from never upwards. Twelve cards fire in 0% of matches even with their own faction supporting them; another twenty are under 20%. |
| `DREMPELS.md` | The distributions behind the thresholds. 42% of matches destroy none of your own projects, 19% destroy nothing at all — which is what made "if three of your projects are destroyed" a condition that never happened. |

## Why this still matters to the rebuild

The lesson these three encode is in `CLAUDE.md` and in `test/set.test.ts`: a card
that does not change the outcome is a dead card, and the only way to know is to
play the match twice and compare. The old engine found 110 dead cards that way,
after the fact. The new one refuses to start with any.

`data/legacy-cards.json` holds the 235 cards these documents are about. It is
also what the existing 1894 NFTs depict — see `docs/the-first-collection.md`.
