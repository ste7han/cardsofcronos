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

## What is deliberately NOT here

The old Next app, the dead contract's test scripts, and the documents about a
contract that is no longer the live one. Those were deleted rather than moved:
they describe a product that does not exist, and a stale document is worse than
a missing one because somebody eventually reads it.

All of it is still on the `fix/battle-system` branch and in the history. Nothing
that was ever committed has been lost — `git show fix/battle-system:src/lib/web3.ts`
and so on.

## Firebase is gone

The Firebase functions, the Python engine and every rule and config file went
with the airdrop. What that engine measured was kept — see
`docs/first-version/`. The admin scripts that used to sit in this directory went
with the rest; they only ever talked to Firebase.
