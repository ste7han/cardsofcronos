# The cards, as files

One `<id>.webp` per card, 1072x1676, and the same picture the NFT uses. They are
what the close-up on /cards offers to save: somebody promoting this game should
not have to screenshot their own card.

## Where they come from

`npm run dev` in one terminal, then:

```
npx tsx scripts/render-cards.ts out/upload 4 --stale
cp out/upload/*.webp public/render/
```

That script screenshots `/card/<id>/image`, which renders the same CardView the
game renders. There is one thing that decides what a card looks like, and this
is a copy of it rather than a second drawing of it.

## They can go stale, and nothing here will notice

`--stale` re-shoots a card whose ART changed. It does not know about a card whose
RULES changed — so a rebalance leaves the picture showing the old numbers, which
is exactly what happened to the first collection: eight images still show figures
the data no longer has. Re-render after touching `data/cards.ts` or
`components/CardView.tsx`.

## Out of the repo, like public/art

Sixty megabytes. They are served, not source, so they belong in `public/` — and
they are gitignored, because the previous project's art was 734 MB sitting
untracked and that works right up until somebody runs `git add .`.
