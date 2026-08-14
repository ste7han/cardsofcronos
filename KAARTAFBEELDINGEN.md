# Kaartafbeeldingen die bijgewerkt moeten worden

Bij acht kaarten is de regeltekst in de kaartdata aangepast omdat de
voorwaarde in de praktijk (vrijwel) nooit haalbaar was. De **gedrukte
afbeelding in `public/NFTCARDS/` toont nog het oude getal**, dus data en
artwork lopen uiteen. De speler leest de afbeelding, dus die is leidend voor
wat hij verwacht.

De engine gebruikt uitsluitend `parsed_power`; de tekst hieronder is wat er
in het gevechtslog en op de kaart getoond wordt. Er hoeft dus **niets aan de
code** te gebeuren — alleen aan de afbeeldingen.

Beide kaartbestanden (`game-engine/COC_Cards_parsed.json` en
`src/lib/cards.json`) zijn identiek en al bijgewerkt.

---

## `COC_Wolfswap_Founder_M1`

**Wijziging:** drempel 4 -> 2 — sloeg in 0% van de matches aan; nu 10%

**Was:**

> If 4 of your cards are destroyed during the match,
→ destroy all enemy Projects

**Wordt:**

> If 2 of your cards are destroyed during the match,
→ destroy all enemy Projects

**Afbeelding:** `public/NFTCARDS/COC_Wolfswap_Founder_M1.png`

## `COC_Cr00ts_Founder_M1`

**Wijziging:** drempel 3 -> 2 — sloeg in 0% van de matches aan; nu 10%

**Was:**

> If 3 or more enemy Projects are destroyed during the match, immediately destroy one random surviving enemy Project and steal +10 MC.

**Wordt:**

> If 2 or more enemy Projects are destroyed during the match, immediately destroy one random surviving enemy Project and steal +10 MC.

**Afbeelding:** `public/NFTCARDS/COC_Cr00ts_Founder_M1.png`

## `COC_EVT_Chain_Reaction`

**Wijziging:** drempel 3 -> 2 — sloeg in 0% van de matches aan; nu 20%

**Was:**

> If 3 or more cards are destroyed this match, deal -3 MC to all cards

**Wordt:**

> If 2 or more cards are destroyed this match, deal -3 MC to all cards

**Afbeelding:** `public/NFTCARDS/COC_EVT_Chain_Reaction.png`

## `COC_CAW777_Founder_M1`

**Wijziging:** drempel 3 -> 2 — sloeg in 2% van de matches aan; nu 12%

**Was:**

> If 3 or more of your Projects' MC values end in 7, triple their MC.

**Wordt:**

> If 2 or more of your Projects' MC values end in 7, triple their MC.

**Afbeelding:** `public/NFTCARDS/COC_CAW777_Founder_M1.png`

## `COC_Cr00ts_Founder_L1`

**Wijziging:** drempel 2 -> 1 — sloeg in 5% van de matches aan; nu 52%

**Was:**

> If two or more Cr00ts Projects are destroyed during the match, all surviving Projects gain +6 MC.

**Wordt:**

> If a Cr00ts Project is destroyed during the match, all surviving Projects gain +6 MC.

**Afbeelding:** `public/NFTCARDS/COC_Cr00ts_Founder_L1.png`

## `COC_DAK_Founder_M1`

**Wijziging:** drempel 3 -> 2 — sloeg in 5% van de matches aan; nu 30%

**Was:**

> If 3 or more enemy Projects are destroyed, destroy another one and gain +20 MC.

**Wordt:**

> If 2 or more enemy Projects are destroyed, destroy another one and gain +20 MC.

**Afbeelding:** `public/NFTCARDS/COC_DAK_Founder_M1.png`

## `COC_CAW777_M1`

**Wijziging:** drempel 3 -> 2 — drie Projects met een 7 in hun MC komt in 1,3% van de matches voor; twee in 9,9%

**Was:**

> If 3 or more of your Projects have a 7 in their MC at Final Calculation, destroy 2 random enemy Projects.

**Wordt:**

> If 2 or more of your Projects have a 7 in their MC at Final Calculation, destroy 2 random enemy Projects.

**Afbeelding:** `public/NFTCARDS/COC_CAW777_M1.png`

## `COC_CAW777_C2`

**Wijziging:** 'precies 7' -> '7 of minder' — precies 7 MC kwam in 0,5% van de toetsingen voor; de kaart staat 47,7% van de tijd op zijn basiswaarde 5

**Was:**

> If this Project’s MC is exactly 7 after buffs, double it.

**Wordt:**

> If this Project’s MC is 7 or less after buffs, double it.

**Afbeelding:** `public/NFTCARDS/COC_CAW777_C2.png`

---

## Los hiervan: een hernoemde kaart

`COC_Howlers_FounderL1` heette als enige zonder underscore en is hernoemd naar
`COC_Howlers_Founder_L1`, zodat hij bij de vier andere Howlers-Founders past.
De afbeelding stond al onder de juiste naam, dus **hier hoeft niets aan het
artwork te gebeuren**. De regeltekst is ongewijzigd.

Wel omgezet: de drie tokens in `src/lib/token_mapping.json` die naar de oude
id wezen (215, 1250, 1814).

Let op als er ergens **on-chain metadata** aan de oude naam hangt — dat valt
buiten deze repo en is niet gecontroleerd.

---

## Klaar wanneer

Voor elk van de acht kaarten hierboven toont de PNG hetzelfde getal als de
`description` in de kaartdata.

De actuele teksten van precies die acht kaarten opvragen — draai dit vanuit de
hoofdmap van het project:

```sh
python3 - <<'EOF'
import json
KAARTEN = {
    "COC_Wolfswap_Founder_M1", "COC_Cr00ts_Founder_M1", "COC_EVT_Chain_Reaction",
    "COC_CAW777_Founder_M1", "COC_Cr00ts_Founder_L1", "COC_DAK_Founder_M1",
    "COC_CAW777_M1", "COC_CAW777_C2",
}
for c in json.load(open("game-engine/COC_Cards_parsed.json", encoding="utf-8")):
    if c["card_id"] in KAARTEN:
        print(c["card_id"], "|", c["description"].replace("\n", " "))
EOF
```
