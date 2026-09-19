# Prompts for the last six families

Six projects have no NFT collection to cut card art from — VVS, Ferro, Tectonic,
Minted, Fortune Favours The Brave and Cronos Chimp Club. Their eight cards each
share one project image. This sheet holds the 48 prompts that turn that one image
into eight, so the maker can run them rather than have them driven through a
browser one at a time.

Every prompt keeps the project's own mark and changes only what is around it.
That is the whole trick: the brand stays put, the setting carries the rarity.

---

## How to run one

1. Open Gemini, start a **new chat** — one chat per image keeps them from
   drifting into each other.
2. Attach the base image named under the project heading. They are in
   `art-source/prompt-bases/`.
3. Paste the prompt exactly as written.
4. Download the result and save it as the **card id** given next to the prompt,
   e.g. `vvs-iii.jpeg`. Put them all in one folder and tell me where.

I take it from there: convert to webp, run `npm run art`, render, deploy.

### What was learned doing this the hard way

- **Keep the prompt in English.** Every one of the ~40 images that worked was
  prompted in English; the Dutch ones came out muddier.
- **Ask for "no text anywhere".** Left out, it invents wordmarks and they are
  always misspelled.
- **Never describe a real brand, film or person.** "Matrix" and one sunset
  cityscape were both refused outright as third-party content. The refusals are
  inconsistent — the same image was accepted on a reworded second try — so if one
  is refused, rewrite rather than retry.
- **If a result has visible seams or panels down the sides**, do not ask it to
  "fix the seams". Ask for *one continuous wide illustration* instead. That
  worked first time where two seam-fixing attempts had failed.
- The app is on **Flash-Lite**; it fell back there when the free limit filled up
  and stayed. The model picker is in the prompt box.

---

## VVS Finance — the stone gets cut

Base image: `art-source/prompt-bases/vvsfinance.png`

VVS is a diamond grade, and everything the project makes is named after jewels:
Bling Swap, Crystal Farms, Glitter Mine. So the emblem is the stone, and it goes
from rough rock to a cut brilliant throwing fire.

**I, II and III are already done** — they are in `lions-keuze/gemini-vvs/` as
`i.jpeg`, `ii.jpeg`, `iii.jpeg`. Their prompts are written out anyway, in case
you want to rerun them.

Every prompt in this section starts with the same sentence, written out each
time so each one can be pasted whole.

**vvs-i** (common)
> Keep this white diamond emblem exactly as it is: same shape, same white outline, same size, centred and untouched. Only change what is around it. Put it as a rough uncut stone half buried in dark grey rock, dim light, nothing sparkling yet. Wide 16:9, no text anywhere.

**vvs-ii** (common)
> Keep this white diamond emblem exactly as it is: same shape, same white outline, same size, centred and untouched. Only change what is around it. Put it on a jeweller's dark workbench with the rough rock cleaned away and the first facets just ground, one warm lamp from the side. Wide 16:9, no text anywhere.

**vvs-iii** (rare)
> Keep this white diamond emblem exactly as it is: same shape, same white outline, same size, centred and untouched. Only change what is around it. Put it held in a pair of jeweller's tweezers against black velvet, half its facets now polished and catching a first cold highlight. Wide 16:9, no text anywhere.

**vvs-iv** (rare)
> Keep this white diamond emblem exactly as it is: same shape, same white outline, same size, centred and untouched. Only change what is around it. Put it fully cut and polished on a black glass surface, its own reflection under it, lit cold and clean but not yet throwing colour. Wide 16:9, no text anywhere.

**vvs-v** (epic)
> Keep this white diamond emblem exactly as it is: same shape, same white outline, same size, centred and untouched. Only change what is around it. Put it under a bright spotlight so the first spectral colours break out of its edges onto the dark surface around it. Wide 16:9, no text anywhere.

**vvs-vi** (epic)
> Keep this white diamond emblem exactly as it is: same shape, same white outline, same size, centred and untouched. Only change what is around it. Put it on a dark pedestal with hard rainbow light fanning out across the whole frame from inside it. Wide 16:9, no text anywhere.

**vvs-vii** (legendary)
> Keep this white diamond emblem exactly as it is: same shape, same white outline, same size, centred and untouched. Only change what is around it. Put it in a dark vault behind glass, throwing bright spectral light over the walls and the floor, everything else in shadow. Wide 16:9, no text anywhere.

**vvs-viii** (mythic)
> Keep this white diamond emblem exactly as it is: same shape, same white outline, same size, centred and untouched. Only change what is around it. Make it the only source of light in a pitch black space, blazing with white and rainbow fire that lights nothing but itself. Wide 16:9, no text anywhere.

---

## Ferro — steady on purpose

Base image: `art-source/prompt-bases/ferro.png`

Ferro is the stablecoin exchange: correlated assets, almost no slippage, "the
pool nobody watched, because it never did anything". Iron is in the name. So the
ladder is metal getting more refined — and the surface stays dead level the whole
way, because staying level *is* the product. It is the one family that escalates
by getting calmer, not louder.

**ferro-i** (common)
> Keep this chrome letter F emblem exactly as it is: same shape, same rings around it, same size, centred and untouched. Only change what is around it. Set it on a slab of dull unpolished grey iron under flat even light, no shine, nothing reflected. Wide 16:9, no text anywhere.

**ferro-ii** (common)
> Keep this chrome letter F emblem exactly as it is: same shape, same rings around it, same size, centred and untouched. Only change what is around it. Set it on brushed steel with fine parallel grain running the width of the frame, cool soft light. Wide 16:9, no text anywhere.

**ferro-iii** (rare)
> Keep this chrome letter F emblem exactly as it is: same shape, same rings around it, same size, centred and untouched. Only change what is around it. Set it on a perfectly flat sheet of dark liquid metal, dead still, holding one faint reflection. Wide 16:9, no text anywhere.

**ferro-iv** (rare)
> Keep this chrome letter F emblem exactly as it is: same shape, same rings around it, same size, centred and untouched. Only change what is around it. Set it on a still mirror of mercury reflecting it cleanly, with a spirit level bubble resting exactly centred nearby. Wide 16:9, no text anywhere.

**ferro-v** (epic)
> Keep this chrome letter F emblem exactly as it is: same shape, same rings around it, same size, centred and untouched. Only change what is around it. Set it on a vast polished steel floor that reaches the horizon without a ripple, cold blue light. Wide 16:9, no text anywhere.

**ferro-vi** (epic)
> Keep this chrome letter F emblem exactly as it is: same shape, same rings around it, same size, centred and untouched. Only change what is around it. Set it on mirror-polished chrome that reflects the whole room upside down, flawless, not one distortion. Wide 16:9, no text anywhere.

**ferro-vii** (legendary)
> Keep this chrome letter F emblem exactly as it is: same shape, same rings around it, same size, centred and untouched. Only change what is around it. Set it on a mirror surface so perfect that the reflection is indistinguishable from the thing itself, lit from two sides, absolutely symmetrical and absolutely still. Wide 16:9, no text anywhere.

**ferro-viii** (mythic)
> Keep this chrome letter F emblem exactly as it is: same shape, same rings around it, same size, centred and untouched. Only change what is around it. Set it on an endless black mirror under a single cold light, the horizon a perfectly straight line, nothing moving anywhere. Wide 16:9, no text anywhere.

---

## Tectonic — the ground gives way

Base image: `art-source/prompt-bases/tectonic.png`

Lending and borrowing, health factors, liquidation cascades, and the week the
chain rewound almost eleven thousand blocks to undo one transaction. The name is
the concept: it starts as a hairline crack and ends as a continent coming apart.

Note this base image is a landscape with a wordmark in it, so these prompts ask
for the landscape rather than an emblem — and they ask for the wordmark to go.

**tectonic-i** (common)
> Use this isometric mountain landscape as the style reference. Draw the same world in the same style, but remove all text and lettering. Show it whole and undamaged in low evening light, with one hairline crack running across the rock in the foreground. Wide 16:9, no text anywhere.

**tectonic-ii** (common)
> Use this isometric mountain landscape as the style reference. Draw the same world in the same style, no text or lettering anywhere. The crack in the foreground has widened into a visible split, a few loose stones around it. Wide 16:9.

**tectonic-iii** (rare)
> Use this isometric mountain landscape as the style reference. Draw the same world in the same style, no text or lettering anywhere. A fault line now runs the whole width of the frame, the ground on one side sitting slightly lower than the other. Wide 16:9.

**tectonic-iv** (rare)
> Use this isometric mountain landscape as the style reference. Draw the same world in the same style, no text or lettering anywhere. The fault has opened into a dark ravine cutting the landscape in two, dust rising from it. Wide 16:9.

**tectonic-v** (epic)
> Use this isometric mountain landscape as the style reference. Draw the same world in the same style, no text or lettering anywhere. Whole slabs of the terrain are tilting and sliding into the ravine, one after another. Wide 16:9.

**tectonic-vi** (epic)
> Use this isometric mountain landscape as the style reference. Draw the same world in the same style, no text or lettering anywhere. The ground is breaking apart into floating islands, the pieces drifting away from each other over a dark void. Wide 16:9.

**tectonic-vii** (legendary)
> Use this isometric mountain landscape as the style reference. Draw the same world in the same style, no text or lettering anywhere. The landscape is shattered into scattered fragments hanging in mid air, lit red from below. Wide 16:9.

**tectonic-viii** (mythic)
> Use this isometric mountain landscape as the style reference. Draw the same world in the same style, no text or lettering anywhere. Show the shattered fragments flying backwards and reassembling into the whole undamaged landscape again, caught halfway, lit with a cold reversing glow. Wide 16:9.

The last one is the eleven thousand blocks: the break running backwards.

---

## Minted — the coin gets struck

Base image: `art-source/prompt-bases/minted.png`

A marketplace. "A list, a filter and a buy button. Somebody has to make one." And
the line that decides the ladder: *the venue outlasts everything it lists*. So
the emblem is struck like a coin, and the pile behind it grows.

**minted-i** (common)
> Keep this red and white M emblem exactly as it is: same shape, same red glow, same size, centred and untouched. Only change what is around it. Show it as a single blank metal disc on a dark press bed, unstruck, one dim overhead light. Wide 16:9, no text anywhere.

**minted-ii** (common)
> Keep this red and white M emblem exactly as it is: same shape, same red glow, same size, centred and untouched. Only change what is around it. Show it under the die of a heavy press at the moment of striking, sparks at the rim. Wide 16:9, no text anywhere.

**minted-iii** (rare)
> Keep this red and white M emblem exactly as it is: same shape, same red glow, same size, centred and untouched. Only change what is around it. Show it freshly struck and still hot on a dark steel tray, a faint red heat glow along its edge. Wide 16:9, no text anywhere.

**minted-iv** (rare)
> Keep this red and white M emblem exactly as it is: same shape, same red glow, same size, centred and untouched. Only change what is around it. Show it standing upright in front of a short row of identical blank discs receding into shadow. Wide 16:9, no text anywhere.

**minted-v** (epic)
> Keep this red and white M emblem exactly as it is: same shape, same red glow, same size, centred and untouched. Only change what is around it. Show it on top of a low stack of dark coins, more stacks around it, red rim light. Wide 16:9, no text anywhere.

**minted-vi** (epic)
> Keep this red and white M emblem exactly as it is: same shape, same red glow, same size, centred and untouched. Only change what is around it. Show it above a floor covered in scattered coins reaching into the dark, lit red from below. Wide 16:9, no text anywhere.

**minted-vii** (legendary)
> Keep this red and white M emblem exactly as it is: same shape, same red glow, same size, centred and untouched. Only change what is around it. Show it raised on a pedestal in a vast dark hall lined with towering columns of stacked coins. Wide 16:9, no text anywhere.

**minted-viii** (mythic)
> Keep this red and white M emblem exactly as it is: same shape, same red glow, same size, centred and untouched. Only change what is around it. Show it alone and intact on a bare pedestal while everything around it has crumbled to dust and empty shelves, one shaft of red light on it. Wide 16:9, no text anywhere.

The mythic is the flavour text exactly: the venue outlasts everything it listed.

---

## Fortune Favours The Brave — stepping into the dark

Base image: `art-source/prompt-bases/fftb.png`

Named after an advertisement, spelled the British way because the advert was. No
product, no roadmap — a slogan and a group of people. So the ladder is the
slogan acted out: a figure going further into the unknown each card.

**Keep this one anonymous.** No faces, no likenesses, no advert. The base image is
an illustrated astronaut and that is as specific as it should get — a suit with a
visor, nobody in particular. If a prompt is refused, make the figure smaller and
further away rather than describing it more.

**fftb-i** (common)
> Keep this illustrated astronaut exactly as drawn: same suit, same helmet, same colours, same style, centred and untouched. Only change what is around it. Put it standing in a lit doorway with darkness beyond, one foot not yet over the threshold. Wide 16:9, no text anywhere.

**fftb-ii** (common)
> Keep this illustrated astronaut exactly as drawn: same suit, same helmet, same colours, same style, centred and untouched. Only change what is around it. Put it a few steps into a dark tunnel, the lit entrance small behind it. Wide 16:9, no text anywhere.

**fftb-iii** (rare)
> Keep this illustrated astronaut exactly as drawn: same suit, same helmet, same colours, same style, centred and untouched. Only change what is around it. Put it at the mouth of a cave opening onto an unfamiliar landscape at dusk. Wide 16:9, no text anywhere.

**fftb-iv** (rare)
> Keep this illustrated astronaut exactly as drawn: same suit, same helmet, same colours, same style, centred and untouched. Only change what is around it. Put it on a narrow ridge with a long drop on both sides, wind in the dust. Wide 16:9, no text anywhere.

**fftb-v** (epic)
> Keep this illustrated astronaut exactly as drawn: same suit, same helmet, same colours, same style, centred and untouched. Only change what is around it. Put it on the lip of an enormous crater, the far side too distant to see. Wide 16:9, no text anywhere.

**fftb-vi** (epic)
> Keep this illustrated astronaut exactly as drawn: same suit, same helmet, same colours, same style, centred and untouched. Only change what is around it. Put it on a cliff edge under a sky full of unfamiliar planets, looking out. Wide 16:9, no text anywhere.

**fftb-vii** (legendary)
> Keep this illustrated astronaut exactly as drawn: same suit, same helmet, same colours, same style, centred and untouched. Only change what is around it. Put it small against a vast alien horizon at sunrise, the first footprints behind it. Wide 16:9, no text anywhere.

**fftb-viii** (mythic)
> Keep this illustrated astronaut exactly as drawn: same suit, same helmet, same colours, same style, centred and untouched. Only change what is around it. Put it stepping off the edge of the last solid ground into open starfield, nothing underneath. Wide 16:9, no text anywhere.

---

## Cronos Chimp Club — the room fills up

Base image: `art-source/prompt-bases/cronoschimpclub.png`

Ten thousand chimps, seven traits, and the line that gives it the concept:
*a club is only worth anything when there are people in the room*. So the ladder
is attendance. One chimp, then a few, then a full house.

The base is a white line-art chimp face on black. These prompts keep that mark as
the club's sign and build the room around it, so the logo stays the constant.

**chimps-i** (common)
> Keep this white line-art chimp face exactly as it is: same shape, same white lines, same size, centred and untouched. Only change what is around it. Put it as a sign above the door of a small dark empty club room, one chair, nobody there. Wide 16:9, no text anywhere.

**chimps-ii** (common)
> Keep this white line-art chimp face exactly as it is: same shape, same white lines, same size, centred and untouched. Only change what is around it. Put it as a sign above a dim club room with a single silhouette sitting alone at the bar. Wide 16:9, no text anywhere.

**chimps-iii** (rare)
> Keep this white line-art chimp face exactly as it is: same shape, same white lines, same size, centred and untouched. Only change what is around it. Put it as a sign above a club room with a handful of silhouettes standing around, low warm light. Wide 16:9, no text anywhere.

**chimps-iv** (rare)
> Keep this white line-art chimp face exactly as it is: same shape, same white lines, same size, centred and untouched. Only change what is around it. Put it as a sign above a club room half full of silhouettes talking in groups, the lights a little brighter. Wide 16:9, no text anywhere.

**chimps-v** (epic)
> Keep this white line-art chimp face exactly as it is: same shape, same white lines, same size, centred and untouched. Only change what is around it. Put it as a sign above a busy club room, silhouettes shoulder to shoulder, coloured lights starting up. Wide 16:9, no text anywhere.

**chimps-vi** (epic)
> Keep this white line-art chimp face exactly as it is: same shape, same white lines, same size, centred and untouched. Only change what is around it. Put it as a sign above a packed club, a crowd of silhouettes with hands up, beams of coloured light across them. Wide 16:9, no text anywhere.

**chimps-vii** (legendary)
> Keep this white line-art chimp face exactly as it is: same shape, same white lines, same size, centred and untouched. Only change what is around it. Put it glowing above a huge crowd filling a hall to the back wall, lasers and haze. Wide 16:9, no text anywhere.

**chimps-viii** (mythic)
> Keep this white line-art chimp face exactly as it is: same shape, same white lines, same size, centred and untouched. Only change what is around it. Put it enormous above a crowd that stretches past the horizon, every face turned up towards it, night sky over them. Wide 16:9, no text anywhere.

---

## When the images are in

Drop all 48 into one folder — `art-source/` is the right place, anywhere under
`public/` is not, because everything under `public/` is uploaded to the site
verbatim. Name each file after its card id. Then tell me the folder and I will
convert, wire them up and deploy.

If a prompt gives something you do not like, say which card and what was wrong
with it; rewriting one prompt is a minute's work and the sheet is meant to be
edited.
