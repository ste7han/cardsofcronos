# legacy

Things from the first version of Cards of Cronos that are not part of the
rebuild and are not rubbish either.

Nothing in here is imported, built, served or deployed. `tsconfig.json` excludes
the directory, and `public/` is the only directory the site serves — which is
why the art below had to move out of it.

## What is here

**`public/`** — the artwork of the first version. Rarity and type badges
(common, rare, epic, legendary, mythical, founder, influencer, parody, fusion,
roast, wrap, unburn and the rest), the `logo.svg` wordmark, the arena mat
`table.jpeg`, a video, and a handful of images that were uploaded under their
upload hashes and never renamed.

The new site draws rarity in CSS rather than from an image, so none of it is
used. It is somebody's work, so it is here rather than deleted.

**`scripts/`** — one-off admin scripts for the Firebase side: adding an admin,
initialising the project, configuring CORS, a lobby garbage collector and a
Firestore rules test. Several want `credentials/firebase-adminsdk.json`, which
is gitignored and not in this repo. They go when Firebase does.

## What is deliberately NOT here

The old Next app, the dead contract's test scripts, and the documents about a
contract that is no longer the live one. Those were deleted rather than moved:
they describe a product that does not exist, and a stale document is worse than
a missing one because somebody eventually reads it.

All of it is still on the `fix/battle-system` branch and in the history. Nothing
that was ever committed has been lost — `git show fix/battle-system:src/lib/web3.ts`
and so on.

## The two things that are still live

`functions/` and `game-engine/` are **not** in here, and that is on purpose: they
are still deployed and still running. See the root `README.md`.
