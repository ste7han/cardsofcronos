# Voorstel voor de drempels, met cijfers

Gebaseerd op 2000 willekeurige matches voor de verdelingen en
40 matches per kandidaatwaarde met een deck van de eigen factie.

## Hoe een match er gemiddeld uitziet


**Hoeveel van je eigen Projects sneuvelen per match**

| waarde | aandeel van de matches | minstens zoveel |
|---|---|---|
| 0 | 44% | 100% |
| 1 | 36% | 56% |
| 2 | 14% | 20% |
| 3 | 5% | 7% |
| 4 | 1% | 2% |
| 5 | 1% | 1% |
| 6 | 0% | 0% |

**Hoeveel vijandelijke Projects sneuvelen per match**

| waarde | aandeel van de matches | minstens zoveel |
|---|---|---|
| 0 | 46% | 100% |
| 1 | 34% | 54% |
| 2 | 14% | 20% |
| 3 | 5% | 6% |
| 4 | 1% | 2% |
| 5 | 1% | 1% |
| 6 | 0% | 0% |

**Vernietigde Projects in totaal, beide kanten**

| waarde | aandeel van de matches | minstens zoveel |
|---|---|---|
| 0 | 20% | 100% |
| 1 | 32% | 80% |
| 2 | 24% | 48% |
| 3 | 14% | 24% |
| 4 | 6% | 10% |
| 5 | 3% | 4% |
| 6 | 1% | 2% |
| 7 | 0% | 1% |
| 8 | 0% | 0% |

**Hoeveel verschillende rarities je aan het eind bestuurt**

| waarde | aandeel van de matches | minstens zoveel |
|---|---|---|
| 0 | 1% | 100% |
| 1 | 4% | 99% |
| 2 | 30% | 95% |
| 3 | 46% | 65% |
| 4 | 18% | 19% |
| 5 | 1% | 1% |

**Hoeveel van je Projects onder de 10 MC eindigen**

| waarde | aandeel van de matches | minstens zoveel |
|---|---|---|
| 0 | 59% | 100% |
| 1 | 25% | 41% |
| 2 | 11% | 16% |
| 3 | 4% | 5% |
| 4 | 1% | 1% |
| 5 | 0% | 0% |
| 6 | 0% | 0% |

**Hoeveel van je Projects een MC hebben die op 7 eindigt**

| waarde | aandeel van de matches | minstens zoveel |
|---|---|---|
| 0 | 61% | 100% |
| 1 | 31% | 39% |
| 2 | 7% | 8% |
| 3 | 1% | 1% |
| 4 | 0% | 0% |
| 5 | 0% | 0% |
| 6 | 0% | 0% |

**Je totale MC eindigt op 7** in 11% van de matches (toeval zou 10% zijn).


## Per kaart: wat elke drempel oplevert


### `COC_Wolfswap_Founder_M1`

> If 4 of your cards are destroyed during the match,

| drempel | slaagt in |
|---|---|
| `≥1` | 32% |
| `≥2` | 8% |
| `≥3` | 5% |
| `≥4` | 0%  ← huidig |

### `COC_Wolfswap_Founder_E1`

> If 2 of your Projects have been destroyed, gain +4 MC on each surviving one

| drempel | slaagt in |
|---|---|
| `≥1` | 35% |
| `≥2` | 8%  ← huidig |

### `COC_Cr00ts_Founder_M1`

> If 3 or more enemy Projects are destroyed during the match, immediately destroy one random surviving

| drempel | slaagt in |
|---|---|
| `>=1` | 42% |
| `>=2` | 8% |
| `>=3` | 0%  ← huidig |

### `COC_DAK_Founder_M1`

> If 3 or more enemy Projects are destroyed, destroy another one and gain +20 MC.

| drempel | slaagt in |
|---|---|
| `>=1` | 65% |
| `>=2` | 25% |
| `>=3` | 5%  ← huidig |

### `COC_Cr00ts_Founder_L1`

> If two or more Cr00ts Projects are destroyed during the match, all surviving Projects gain +6 MC.

| drempel | slaagt in |
|---|---|
| `>=1` | 40% |
| `>=2` | 5%  ← huidig |

### `COC_EVT_Chain_Reaction`

> 	If 3 or more cards are destroyed this match, deal -3 MC to all cards

| drempel | slaagt in |
|---|---|
| `cards_destroyed >= 1` | 45% |
| `cards_destroyed >= 2` | 10% |
| `cards_destroyed >= 3` | 0%  ← huidig |

### `COC_CAW777_Founder_M1`

> If 3 or more of your Projects' MC values end in 7, triple their MC.

| drempel | slaagt in |
|---|---|
| `>=1` | 38% |
| `>=2` | 8% |
| `>=3` | 2%  ← huidig |

### `COC_Nova_Founder_R1`

> If any of your Projects are below 10 MC, each gains +2 MC.

| drempel | slaagt in |
|---|---|
| `10` | 82%  ← huidig |
| `15` | 82% |
| `20` | 100% |

### `COC_Nova_Founder_C1`

> If your deck contains 2 or more Common Nova cards, gain +2 MC on one random own Project.

| drempel | slaagt in |
|---|---|
| `common_nova_>=1` | 100% |
| `common_nova_>=2` | 90%  ← huidig |
