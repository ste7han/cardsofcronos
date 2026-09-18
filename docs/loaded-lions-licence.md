# The Loaded Lions art, and what lets us use it

Two cards carry art from somebody else's collection, and on 17 September 2026
that stopped being a question of goodwill.

Crypto.com published the **Loaded Lions Open License v1.0** at
`github.com/LoadedLions/OpenLicense`, with 220-odd assets and a promise of a
thousand. What it grants is a royalty-free, worldwide, non-exclusive licence to
use, reproduce, distribute, adapt and publicly display the Licensed Materials —
commercially included — and it leaves the copyright in whatever you make with
them yours.

## What is covered, and what is not

**Licensed Materials** are two things and only two:

- the *Loaded Lions*, *Dark Lions* and *Cyber Cubs* names and logos; and
- the visual assets designated Creator Materials in the GitHub manifest, which
  the licence describes as "generic, non-PFP, non-token-linked lion graphics and
  marketing visuals".

Excluded, in the licence's own words: trait and layer files, game code, 3D
models, audio, the individual token-linked PFP/Avatar files, and **"any other
assets not expressly uploaded to the Loaded Lions GitHub repository"**.

That last clause is the one that decided this. The art these two cards carried
before was not from the repository — it was a flat vector lion where the licensed
assets are 1024×1024 renders, a different medium entirely — so whatever its
provenance, it was outside the licence rather than inside it.

There is a route for work of our own: the licence encourages original characters
inspired by the universe, provided they are "not substantially similar to any
identifiable token-linked PFP/Avatar", do not claim to be official, and do not
interfere with a holder's rights in a specific NFT. We did not take it. With 21
licensed lions and 22 dark lions sitting in a public repository, using one is
free and puts the question beyond argument, and "probably fine" is not a position
worth holding about somebody else's intellectual property.

## What we use

Eight of the licensed lions, one per card, chosen against what the card does
rather than against its rarity.

| card | source | why that one |
|---|---|---|
| `lions-i` | `LoadedLion-15.png` | points you in with both hands — an arrival |
| `lions-ii` | `LoadedLion-5.png` | tongue out, paws forward; budget is wanting more |
| `lions-iii` | `LoadedLion-19.png` | straightens the glasses; multiplies without fuss |
| `lions-iv` | `LoadedLion-17.png` | fingertips together — the card pays for waiting |
| `lions-v` | `LoadedLion-16.png` | straight ahead, unmoved; something that stays |
| `lions-vi` | `LoadedLion-13.png` | lightning and fists; the family's biggest payoff |
| `lions-vii` | `LoadedLion-3.png` | grin and purple eyes; confident and dangerous |
| `lions-viii` | `LoadedLion-20.png` | steaming, clawing; it pays for the damage |
| `darklion` | `characters/dark-lions/DarkLion-7.png` | unchanged |

## Getting a square lion into a 16:9 window

The renders are 1024×1024 and every one of them fills its square top to bottom —
mane against the upper edge, shoulders against the lower. The card's art window
is `aspect-video`, so at full width it is 1024×576. **About 440 rows have to go
whatever you do**, and the only question is which.

This file used to say cropping "takes the mane off the top and the chin off the
bottom, which is most of what a lion is", and used a blurred enlargement of the
render as a backdrop instead. That was true of a crop taken from the middle and
not of a crop placed deliberately. Four ways were rendered side by side and
looked at:

- **blurred backdrop** — the lion at full height with wide soft bands beside it.
- **crop high** — the whole mane, no mouth. The expression is the mouth.
- **crop low, on the face** — the whole head and the hands, mane points clipped.
- **stretching the background outward** — works where the edge is flat and smears
  an arm into horizontal streaks where it is not, which is half of them.

The maker picked the third, at 40% down. It keeps what the pictures are for: the
faces look straight out, and the gestures that tell them apart — a hand on the
glasses, two fists, a pointing claw — survive.

Filling the frame *and* keeping the full mane is not possible from a square
source. It would need the sides painted in, which is a different tool and a
decision nobody has had to make yet.

## What we must not do

The licence can be terminated immediately, with no cure period, for derogatory or
offensive work, for hate speech or illegal or adult content, and for **false
endorsement or affiliation**. That last one is a live constraint on this site
rather than a formality: Cards of Cronos is not an official Loaded Lions product
and nothing here may suggest it is. Using the name on a card is nominative use of
a Licensed Mark, which the licence grants. Implying their blessing is not.

## Worth knowing

Applications for a $50,000 grants programme open on **25 September 2026** — up to
ten projects at $5,000 in CRO, aimed at work that creates new utility for $LION
and new ways to experience Loaded Lions.
