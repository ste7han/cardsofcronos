// Het volledige gevechtslogboek omzetten naar een structuur die te lezen valt.
//
// Dit staat los van battleLog.ts. Dat bestand condenseert het logboek tot een
// voorstelling (214 regels → 66 beats) en laat bewust dingen weg; een logboek
// hoort juist compleet te zijn. Wat hier gebeurt is ordenen, niet weglaten.
//
// De engine logt proza met veel emoji en dubbele regels. Een actie verschijnt
// namelijk twee keer:
//
//   ↳ 📈 COC_CAW777_C2 buffed (+44.0)
//   ↳ 📈 COC_Nova_M1 boosts Player 1's COC_CAW777_C2 by +44.0 MC → 5.0 → 49.0
//
// De eerste is een samenvatting van de tweede. Een kaart die vijf Projects buft
// levert zo tien regels op. Die samenvattingen worden hier opgeruimd zodra de
// detailregel dezelfde kaart noemt.

export type Side = 'p1' | 'p2';
export type EffectKind = 'buff' | 'debuff' | 'destroy' | 'shield' | 'info';
export type EntryKind = 'action' | 'skipped' | 'shield' | 'note';

export interface LogEffect {
  kind: EffectKind;
  /** De kaart die het ondergaat, als de regel die noemt. */
  target: string | null;
  /** Verandering in MC, als de regel die noemt. */
  delta: number | null;
  from: number | null;
  to: number | null;
  /** De regel zelf, opgeschoond. */
  text: string;
}

export interface LogEntry {
  kind: EntryKind;
  /** De kaart die handelt. */
  actor: string | null;
  owner: Side | null;
  /** Waarom er niets gebeurde, bij kind 'skipped'. */
  reason: string | null;
  effects: LogEffect[];
  /** Opgeteld gewonnen en verloren MC binnen deze beurt. */
  gained: number;
  lost: number;
}

export interface LogPhase {
  name: string;
  entries: LogEntry[];
  scoreAfter: { p1: number | null; p2: number | null };
}

export interface LineupCard {
  id: string;
  slot: 'Project' | 'Support' | 'Founder';
  mc: number | null;
  description: string;
}

export interface LogModel {
  lineups: { p1: LineupCard[]; p2: LineupCard[] };
  opening: { p1: number | null; p2: number | null };
  phases: LogPhase[];
  result: { p1: number | null; p2: number | null; winner: Side | null } | null;
}

// Twee kaart-id's bevatten een teken buiten \w: COC_EVT_Pump_&_Dump en
// COC_EVT_Ding_Ding_Ding!. Zie battleLog.ts voor het hele verhaal.
const CARD = String.raw`COC_\w+(?:&_\w+)*!?`;
const CARD_RE = new RegExp(CARD, 'g');

const SEPARATOR = /^[-─━=]{3,}$/;
const PHASE_BANNER = /^(?:🔄\s*)?(.+?)\s+Phase(?:\s+Begins!?)?$/i;
const BASE_PHASE = /^Base Phase$/i;
const FINAL_RESULTS = /Final Results/i;

const OWNER = new RegExp(String.raw`Player\s+([12])['’]s\s+(${CARD})`);
const TRIGGERED = new RegExp(String.raw`Player\s+([12])['’]s\s+(${CARD})\s*—\s*triggered`, 'i');
const COULD_NOT = new RegExp(String.raw`Player\s+([12])['’]s\s+(${CARD})\s*—\s*(.+)$`, 'i');
const SHIELD_LINE = /First debuff detected|waiting for the first debuff|Armed/i;

const SCORE_AFTER = /Player\s+([12])\s+MC after\s+(\w+):\s*\*{0,2}(-?\d+(?:\.\d+)?)/i;
const SCORE_OPEN = /Player\s+([12])\s+(?:opens with|responds with)\s*\*{0,2}(-?\d+(?:\.\d+)?)/i;
const RESULT_MC = /^Player\s+([12]):\s*\*{0,2}(-?\d+(?:\.\d+)?)/i;
const WINNER = /Winner:\s*Player\s+([12])/i;

const LINEUP_OWNER = /Player\s+([12])['’]s\s+Lineup/i;
const LINEUP_SLOT = /^(Projects|Supports|Founder)$/i;
const LINEUP_CARD = new RegExp(String.raw`^•\s*\S*\s*\`?(${CARD})\`?\s*(?:—\s*💰?\s*(-?\d+(?:\.\d+)?))?`);

const BY_TARGET = new RegExp(
  String.raw`(${CARD})\s+by\s+([-+]?\d+(?:\.\d+)?)\s*MC`, 'i');
// Niet aan het regeleinde vastpinnen: bij een swap staan er twee paren midden
// in de regel ("… (5.0 → 49.0) with … (49.0 → 5.0)").
//
// Het eerste getal mag niet aan een letter of cijfer vastzitten, anders leest
// "COC_Lionel_M1 → 47.0" als "1 → 47": de 1 uit de kaartnaam. Geen lookbehind,
// want die wordt niet overal ondersteund; vandaar de losse voorloopgroep.
const FROM_TO = /(?:^|[^\w.])(-?\d+(?:\.\d+)?)\s*→\s*(-?\d+(?:\.\d+)?)/g;
const BASE_MC = new RegExp(
  String.raw`Player\s+([12])['’]s\s+(${CARD})\s+starts with base MC`, 'i');
const SUMMARY_ONLY = new RegExp(
  String.raw`^(${CARD})\s+(buffed|debuffed)\s*\(([-+]?\d+(?:\.\d+)?)\)\s*$`, 'i');

const DESTROY = new RegExp(
  String.raw`destroy(?:s|ed)\s+(?:enemy\s+|friendly\s+|the\s+|its\s+|his\s+)?(?:Player\s+[12]['’]s\s+)?[\`'"]?(${CARD})`, 'i');

/**
 * Emoji, sterretjes en dubbele spaties eraf; de tekst zelf blijft heel.
 *
 * De pijl → moet blijven staan: hij scheidt de oude van de nieuwe MC en is dus
 * geen versiering maar inhoud. Hem meestrippen als emoji kostte eerder alle
 * van/naar-waarden, en daarmee ook de ontdubbeling verderop.
 */
export function schoon(regel: string): string {
  return regel
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[\s↳•·]+/, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, ' ')
    .replace(/[\u{21A0}-\u{21FF}]/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getal(x: string | undefined | null): number | null {
  if (x === undefined || x === null || x === '') return null;
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : null;
}

function effectSoort(tekst: string, delta: number | null): EffectKind {
  if (DESTROY.test(tekst) || /\bdestroyed\b/i.test(tekst)) return 'destroy';
  if (/negat|reflect|shield|immune|protect|blocked/i.test(tekst)) return 'shield';
  if (delta !== null && delta > 0) return 'buff';
  if (delta !== null && delta < 0) return 'debuff';
  if (/boost|buff|gain|steal|double|triple|revive/i.test(tekst)) return 'buff';
  if (/reduc|debuff|lose|lost|damage|drain|burn/i.test(tekst)) return 'debuff';
  return 'info';
}

function leesEffect(rauw: string): LogEffect {
  const tekst = schoon(rauw);

  const kort = tekst.match(SUMMARY_ONLY);
  if (kort) {
    const d = getal(kort[3]);
    return {
      kind: kort[2].toLowerCase() === 'buffed' ? 'buff' : 'debuff',
      target: kort[1], delta: d, from: null, to: null, text: tekst,
    };
  }

  const doel = tekst.match(BY_TARGET);
  const paren = [...tekst.matchAll(FROM_TO)];
  const bereik = paren.length ? paren[paren.length - 1] : null;
  const kapot = tekst.match(DESTROY);

  let target: string | null = doel ? doel[1] : null;
  if (!target && kapot) target = kapot[1];
  if (!target) {
    // Laatste kaart op de regel is meestal degene die het ondergaat, maar niet
    // bij "destroys A → transfers to B": daar is B de ontvanger, niet het doel.
    const ids = tekst.match(CARD_RE);
    if (ids && ids.length) target = ids[ids.length - 1];
  }

  const delta = doel ? getal(doel[2]) : null;
  const from = bereik ? getal(bereik[1]) : null;
  const to = bereik ? getal(bereik[2]) : null;

  return {
    kind: effectSoort(tekst, delta ?? (from !== null && to !== null ? to - from : null)),
    target,
    delta: delta ?? (from !== null && to !== null ? Math.round((to - from) * 10) / 10 : null),
    from, to, text: tekst,
  };
}

/**
 * Gooit de samenvattingsregels weg zodra een detailregel dezelfde kaart noemt.
 * Blijft er geen detailregel over, dan houden we de samenvatting -- beter een
 * korte regel dan een verdwenen effect.
 */
function ontdubbel(effecten: LogEffect[]): LogEffect[] {
  const metBereik = new Set(
    effecten.filter((e) => e.from !== null && e.target).map((e) => e.target as string),
  );
  return effecten.filter((e) => {
    const isSamenvatting = e.from === null && e.to === null && SUMMARY_ONLY.test(e.text);
    return !(isSamenvatting && e.target && metBereik.has(e.target));
  });
}

function leegEntry(kind: EntryKind, actor: string | null, owner: Side | null): LogEntry {
  return { kind, actor, owner, reason: null, effects: [], gained: 0, lost: 0 };
}

function telOp(entry: LogEntry): LogEntry {
  for (const e of entry.effects) {
    if (e.delta === null) continue;
    if (e.delta > 0) entry.gained += e.delta;
    else entry.lost += Math.abs(e.delta);
  }
  entry.gained = Math.round(entry.gained * 10) / 10;
  entry.lost = Math.round(entry.lost * 10) / 10;
  return entry;
}

export function buildLogModel(logs: string[] | undefined): LogModel {
  const regels = (logs || [])
    .flatMap((blok) => String(blok).split('\n'))
    .map((l) => l.replace(/\r/g, ' ').trimEnd())
    .filter((l) => l.trim().length > 0);

  const model: LogModel = {
    lineups: { p1: [], p2: [] },
    opening: { p1: null, p2: null },
    phases: [],
    result: null,
  };

  let fase: LogPhase | null = null;
  let entry: LogEntry | null = null;
  let lineupKant: Side | null = null;
  let lineupSlot: LineupCard['slot'] = 'Project';
  let laatsteLineup: LineupCard | null = null;
  let beschrijvingOpen = false;
  let inResultaat = false;

  /** Alle opgestelde kaarten, om de basis-MC uit de Base-fase op te kunnen zoeken. */
  const zoekLineup = (id: string): LineupCard | undefined =>
    model.lineups.p1.find((c) => c.id === id) || model.lineups.p2.find((c) => c.id === id);

  // De hulpfuncties geven de fase terug in plaats van hem zelf te zetten:
  // TypeScript volgt toewijzingen binnen een closure niet, en versmalde `fase`
  // daardoor tot never zodra hij verderop op null getoetst werd.
  const nieuweFase = (naam: string): LogPhase => {
    const f: LogPhase = { name: naam, entries: [], scoreAfter: { p1: null, p2: null } };
    model.phases.push(f);
    return f;
  };

  const sluitEntry = (huidige: LogPhase | null): LogPhase | null => {
    let f = huidige;
    if (entry && (entry.effects.length || entry.reason || entry.kind !== 'action')) {
      if (!f) f = nieuweFase('Opening');
      // De engine logt sommige overgeslagen kaarten twee keer, een keer met en
      // een keer zonder "could not act". Dat leest als twee gebeurtenissen.
      const vorige = f.entries[f.entries.length - 1];
      if (vorige && entry.kind === 'skipped' && vorige.kind === 'skipped'
          && vorige.actor === entry.actor) {
        if ((entry.reason || '').length > (vorige.reason || '').length) vorige.reason = entry.reason;
        entry = null;
        return f;
      }
      f.entries.push(telOp(entry));
    }
    entry = null;
    return f;
  };

  const startFase = (naam: string): LogPhase => {
    sluitEntry(fase);
    return nieuweFase(naam);
  };

  for (const rauw of regels) {
    const kaal = rauw.replace(/\*\*/g, '').trim();
    const tekst = schoon(rauw);

    if (SEPARATOR.test(kaal.replace(/\s/g, '')) || /^-{3,}$/.test(kaal)) {
      fase = sluitEntry(fase);
      continue;
    }

    // ---- scores en eindresultaat -------------------------------------------
    const open = kaal.match(SCORE_OPEN);
    if (open) {
      model.opening[open[1] === '1' ? 'p1' : 'p2'] = getal(open[2]);
      continue;
    }
    const na = kaal.match(SCORE_AFTER);
    if (na) {
      fase = sluitEntry(fase);
      if (fase) fase.scoreAfter[na[1] === '1' ? 'p1' : 'p2'] = getal(na[3]);
      continue;
    }
    if (FINAL_RESULTS.test(tekst)) {
      fase = sluitEntry(fase);
      inResultaat = true;
      model.result = { p1: null, p2: null, winner: null };
      continue;
    }
    if (inResultaat) {
      const eind = tekst.match(RESULT_MC);
      if (eind && model.result) {
        model.result[eind[1] === '1' ? 'p1' : 'p2'] = getal(eind[2]);
        continue;
      }
      const win = tekst.match(WINNER);
      if (win && model.result) {
        model.result.winner = win[1] === '1' ? 'p1' : 'p2';
        continue;
      }
    }

    // ---- opstelling ---------------------------------------------------------
    const lo = kaal.match(LINEUP_OWNER);
    if (lo) { fase = sluitEntry(fase); lineupKant = lo[1] === '1' ? 'p1' : 'p2'; laatsteLineup = null; continue; }
    if (lineupKant) {
      const slot = tekst.match(LINEUP_SLOT);
      if (slot) {
        const s = slot[1].toLowerCase();
        lineupSlot = s.startsWith('project') ? 'Project' : s.startsWith('support') ? 'Support' : 'Founder';
        continue;
      }
      const kaart = kaal.match(LINEUP_CARD);
      if (kaart) {
        laatsteLineup = { id: kaart[1], slot: lineupSlot, mc: getal(kaart[2]), description: '' };
        model.lineups[lineupKant].push(laatsteLineup);
        continue;
      }
      if (laatsteLineup && /^\s*↳/.test(rauw)) {
        const stuk = tekst.replace(/^\*|\*$/g, '').trim();
        laatsteLineup.description = (laatsteLineup.description
          ? `${laatsteLineup.description} ${stuk}` : stuk).trim();
        // Een kaarttekst met een harde regelafbreking loopt door op de volgende
        // regel, zonder ↳ ervoor. Zolang het sterretje niet gesloten is hoort
        // wat volgt bij deze kaart.
        beschrijvingOpen = (rauw.match(/\*/g) || []).length % 2 === 1;
        continue;
      }
      if (laatsteLineup && beschrijvingOpen) {
        const stuk = tekst.replace(/^\*|\*$/g, '').trim();
        if (stuk) laatsteLineup.description = `${laatsteLineup.description} ${stuk}`.trim();
        beschrijvingOpen = (rauw.match(/\*/g) || []).length % 2 === 0;
        continue;
      }
    }

    // Base-fase: de startwaarde hoort bij de opstelling, niet als losse regel.
    const basis = kaal.match(BASE_MC);
    if (basis) {
      const paren = [...kaal.matchAll(FROM_TO)];
      const los = kaal.match(/→\s*(-?\d+(?:\.\d+)?)\s*$/);
      const waarde = paren.length ? getal(paren[paren.length - 1][2]) : (los ? getal(los[1]) : null);
      const kaart = zoekLineup(basis[2]);
      if (kaart && waarde !== null) kaart.mc = waarde;
      continue;
    }

    // ---- fasebanner ---------------------------------------------------------
    const letters = kaal.replace(/^[^\p{L}\p{N}]+/u, '').trim();
    if (BASE_PHASE.test(letters)) { lineupKant = null; fase = startFase('Base'); continue; }
    const banner = letters.match(PHASE_BANNER);
    if (banner && /Begins|^Base$/i.test(letters)) {
      lineupKant = null;
      fase = startFase(banner[1].trim());
      continue;
    }

    // ---- kaartblokken -------------------------------------------------------
    const trig = kaal.match(TRIGGERED);
    if (trig) {
      fase = sluitEntry(fase);
      entry = leegEntry('action', trig[2], trig[1] === '1' ? 'p1' : 'p2');
      continue;
    }

    if (SHIELD_LINE.test(kaal) && OWNER.test(kaal)) {
      fase = sluitEntry(fase);
      const m = kaal.match(OWNER)!;
      entry = leegEntry('shield', m[2], m[1] === '1' ? 'p1' : 'p2');
      entry.reason = tekst.replace(new RegExp(String.raw`^Player\s+[12]['’]s\s+${CARD}\s*—?\s*`), '');
      fase = sluitEntry(fase);
      continue;
    }

    if (/^⛔|could not act|is disabled/i.test(rauw.trim()) && OWNER.test(kaal)) {
      fase = sluitEntry(fase);
      const m = kaal.match(COULD_NOT);
      if (m) {
        entry = leegEntry('skipped', m[2], m[1] === '1' ? 'p1' : 'p2');
        entry.reason = schoon(m[3]).replace(/^could not act\s*—?\s*/i, '').trim() || 'kon niet handelen';
        fase = sluitEntry(fase);
        continue;
      }
    }

    // ---- detailregels binnen een blok --------------------------------------
    if (/^\s*↳/.test(rauw) && entry) {
      if (!tekst) continue;
      entry.effects.push(leesEffect(rauw));
      continue;
    }

    // Losse regel die geen van bovenstaande is: bewaren als notitie, zodat er
    // nooit stilzwijgend informatie verdwijnt.
    if (tekst.length > 3 && !/Battle Begins/i.test(tekst)) {
      fase = sluitEntry(fase);
      if (!fase) fase = nieuweFase('Opening');
      const notitie = leegEntry('note', null, null);
      notitie.reason = tekst;
      fase.entries.push(notitie);
    }
  }

  sluitEntry(fase);

  for (const f of model.phases) {
    for (const e of f.entries) e.effects = ontdubbel(e.effects);
    for (const e of f.entries) { e.gained = 0; e.lost = 0; telOp(e); }
  }

  return model;
}
