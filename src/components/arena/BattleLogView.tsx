'use client';

import React, { useMemo, useState } from 'react';
import { buildLogModel, LogEntry, LogEffect, Side } from './logModel';

// De oude weergave dumpte elke logregel als genummerde monospace-tekst met drie
// kleurregels. Alles woog even zwaar: een vernietigde kaart zag er hetzelfde uit
// als een regel die meldde dat er niets gebeurde.
//
// Hier is de ordening het punt. Per fase, per kaart, met het MC-verschil als
// getal in beeld en de overgeslagen kaarten opgevouwen, want dat is ruis zolang
// je niet expliciet vraagt waaróm iets niet afging.

const toon = (id: string) => id.replace(/^COC_/, '').replace(/_/g, ' ');

/**
 * Vrije tekst uit de engine leesbaar maken: kaart-id's krijgen dezelfde nette
 * schrijfwijze als elders, en "Player 1's" wordt "your" of "their" — welke
 * hangt af van wie er kijkt.
 */
const leesbaar = (tekst: string, mij: Side) =>
  tekst
    .replace(/Player\s+([12])['’]s/g, (_, n) => ((n === '1' ? 'p1' : 'p2') === mij ? 'your' : "their"))
    .replace(/Player\s+([12])/g, (_, n) => ((n === '1' ? 'p1' : 'p2') === mij ? 'you' : 'the opponent'))
    .replace(/COC_[\w&!]+/g, (m) => toon(m));

const KLEUR: Record<string, string> = {
  buff: 'text-emerald-400',
  debuff: 'text-rose-400',
  destroy: 'text-red-500',
  shield: 'text-sky-400',
  info: 'text-zinc-400',
};

const TEKEN: Record<string, string> = {
  buff: '↑', debuff: '↓', destroy: '✕', shield: '◈', info: '·',
};

function Delta({ effect }: { effect: LogEffect }) {
  if (effect.delta === null) return null;
  const op = effect.delta > 0;
  return (
    <span className={`inline-flex items-baseline gap-1.5 tabular-nums ${op ? 'text-emerald-400' : 'text-rose-400'}`}>
      <span className="text-sm font-bold">{op ? '+' : '−'}{Math.abs(effect.delta)}</span>
      {effect.from !== null && effect.to !== null && (
        <span className="text-[11px] text-zinc-600">{effect.from} → {effect.to}</span>
      )}
    </span>
  );
}

function Actie({ entry, mij }: { entry: LogEntry; mij: Side }) {
  const eigen = entry.owner === mij;
  const rand = eigen ? 'border-amber-500/40' : 'border-sky-500/30';
  const naam = eigen ? 'text-amber-300' : 'text-sky-300';

  return (
    <div className={`border-l-2 ${rand} pl-4 py-3`}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className={`font-['Cinzel'] font-bold tracking-wide ${naam}`}>{toon(entry.actor || '')}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          {eigen ? 'you' : 'opponent'}
        </span>
      </div>

      <ul className="mt-2 space-y-1.5">
        {entry.effects.map((ef, i) => (
          <li key={i} className="flex items-baseline gap-3 flex-wrap">
            <span className={`text-xs ${KLEUR[ef.kind]}`} aria-hidden>{TEKEN[ef.kind]}</span>
            {ef.target && ef.target !== entry.actor && (
              <span className="text-sm text-zinc-300">{toon(ef.target)}</span>
            )}
            <Delta effect={ef} />
            {ef.delta === null && (
              <span className="text-sm text-zinc-500 leading-snug">{leesbaar(ef.text, mij)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Overgeslagen({ entries, mij }: { entries: LogEntry[]; mij: Side }) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  return (
    <div className="pl-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] uppercase tracking-[0.2em] text-zinc-600 hover:text-zinc-400 transition-colors py-2"
      >
        {open ? '−' : '+'} {entries.length} {entries.length === 1 ? 'card held back' : 'cards held back'}
      </button>
      {open && (
        <ul className="space-y-1 pb-2">
          {entries.map((e, i) => (
            <li key={i} className="text-xs text-zinc-600 flex gap-2 flex-wrap">
              <span className={e.owner === mij ? 'text-amber-500/60' : 'text-sky-500/60'}>
                {toon(e.actor || '')}
              </span>
              <span className="text-zinc-700">— {leesbaar(e.reason || '', mij)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const BattleLogView = ({
  logs, onClose, perspective = 'p1',
}: { logs: string[]; onClose: () => void; perspective?: Side }) => {
  const model = useMemo(() => buildLogModel(logs), [logs]);
  const [toonOpstelling, setToonOpstelling] = useState(false);

  const mij = perspective;
  const ander: Side = mij === 'p1' ? 'p2' : 'p1';
  const mijnScore = model.result ? model.result[mij] : null;
  const anderScore = model.result ? model.result[ander] : null;
  const gewonnen = model.result?.winner === mij;
  const gelijk = model.result && model.result.winner === null;

  const fases = model.phases.filter((f) => f.entries.length > 0);
  const hoogste = Math.max(
    1,
    ...model.phases.flatMap((f) => [f.scoreAfter.p1 || 0, f.scoreAfter.p2 || 0]),
    model.opening.p1 || 0, model.opening.p2 || 0,
  );

  return (
    <div className="fixed inset-0 z-[99999] bg-[#050505] text-white flex flex-col font-['Spectral'] animate-in fade-in duration-300">
      {/* De sluitknop mag nooit wegvallen op een smal scherm. */}
      <header className="flex items-center justify-between gap-3 px-4 md:px-8 py-4 border-b border-white/10 bg-black/90 backdrop-blur-md">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-['Cinzel'] font-black uppercase tracking-tight text-amber-500 truncate">
            Combat Log
          </h2>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mt-0.5">
            {fases.length} phases · {fases.reduce((a, f) => a + f.entries.length, 0)} events
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 bg-white text-black px-5 md:px-7 py-2.5 rounded-full font-black uppercase text-[11px] tracking-widest hover:bg-zinc-200 transition-colors"
        >
          Close
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-10">

          {/* ---- uitslag ---- */}
          {model.result && (
            <section className="text-center">
              <p className={`font-['Cinzel'] text-3xl md:text-4xl font-black uppercase tracking-tight ${
                gelijk ? 'text-zinc-400' : gewonnen ? 'text-amber-400' : 'text-rose-500'
              }`}>
                {gelijk ? 'Draw' : gewonnen ? 'Victory' : 'Defeat'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-6 tabular-nums">
                <div>
                  <div className="text-3xl font-bold text-amber-300">{mijnScore ?? '—'}</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 mt-1">you</div>
                </div>
                <div className="text-zinc-700 text-xl">·</div>
                <div>
                  <div className="text-3xl font-bold text-sky-300">{anderScore ?? '—'}</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 mt-1">opponent</div>
                </div>
              </div>
            </section>
          )}

          {/* ---- verloop per fase ---- */}
          <section>
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-4">Momentum</h3>
            <div className="space-y-2">
              {model.phases.map((f, i) => {
                const mijnMc = f.scoreAfter[mij];
                const anderMc = f.scoreAfter[ander];
                if (mijnMc === null && anderMc === null) return null;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-zinc-500">{f.name}</span>
                    <div className="flex-1 space-y-1">
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500/70 rounded-full transition-all"
                             style={{ width: `${((mijnMc || 0) / hoogste) * 100}%` }} />
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500/60 rounded-full transition-all"
                             style={{ width: `${((anderMc || 0) / hoogste) * 100}%` }} />
                      </div>
                    </div>
                    <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">
                      <span className="text-amber-400/80">{mijnMc ?? '—'}</span>
                      <span className="text-zinc-700"> · </span>
                      <span className="text-sky-400/80">{anderMc ?? '—'}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---- opstelling ---- */}
          <section>
            <button
              onClick={() => setToonOpstelling((v) => !v)}
              className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {toonOpstelling ? '−' : '+'} Lineups
            </button>
            {toonOpstelling && (
              <div className="grid md:grid-cols-2 gap-8 mt-5">
                {([mij, ander] as Side[]).map((kant) => (
                  <div key={kant}>
                    <h4 className={`text-[10px] uppercase tracking-[0.25em] mb-3 ${
                      kant === mij ? 'text-amber-500/70' : 'text-sky-500/70'}`}>
                      {kant === mij ? 'your deck' : 'opponent'}
                    </h4>
                    <ul className="space-y-3">
                      {model.lineups[kant].map((c) => (
                        <li key={c.id}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm text-zinc-200">{toon(c.id)}</span>
                            {c.mc !== null && (
                              <span className="text-xs tabular-nums text-zinc-500">{c.mc} MC</span>
                            )}
                          </div>
                          {c.description && (
                            <p className="text-[11px] text-zinc-600 leading-snug mt-0.5">{c.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ---- fases ---- */}
          {fases.map((fase, i) => {
            const acties = fase.entries.filter((e) => e.kind === 'action' || e.kind === 'shield');
            const skips = fase.entries.filter((e) => e.kind === 'skipped');
            const notities = fase.entries.filter((e) => e.kind === 'note');
            return (
              <section key={i}>
                <div className="sticky top-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-[#050505]/95 backdrop-blur-sm border-b border-white/5 flex items-baseline justify-between gap-3">
                  <h3 className="font-['Cinzel'] text-lg font-bold uppercase tracking-wide text-zinc-200">
                    {fase.name}
                  </h3>
                  {(fase.scoreAfter[mij] !== null || fase.scoreAfter[ander] !== null) && (
                    <span className="text-[11px] tabular-nums text-zinc-600">
                      <span className="text-amber-400/70">{fase.scoreAfter[mij] ?? '—'}</span>
                      {' · '}
                      <span className="text-sky-400/70">{fase.scoreAfter[ander] ?? '—'}</span>
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-4">
                  {acties.map((e, j) =>
                    e.kind === 'shield' ? (
                      <div key={j} className="border-l-2 border-sky-500/30 pl-4 py-2">
                        <span className="text-sky-300 font-['Cinzel'] text-sm font-bold">{toon(e.actor || '')}</span>
                        <p className="text-xs text-zinc-500 mt-0.5">{leesbaar(e.reason || '', mij)}</p>
                      </div>
                    ) : (
                      <Actie key={j} entry={e} mij={mij} />
                    ),
                  )}
                  {notities.map((e, j) => (
                    <p key={`n${j}`} className="text-xs text-zinc-600 pl-4">{leesbaar(e.reason || '', mij)}</p>
                  ))}
                  <Overgeslagen entries={skips} mij={mij} />
                </div>
              </section>
            );
          })}

          <div className="pt-4 pb-12 text-center">
            <button
              onClick={onClose}
              className="text-[11px] uppercase tracking-[0.25em] text-zinc-600 hover:text-white transition-colors"
            >
              Close log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleLogView;
