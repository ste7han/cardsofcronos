'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseBattleLine, buildBattleScript, type Beat, type Perspective } from './battleLog';

// --- TYPES ---
export interface Card {
  card_id: string; card_type: string; rarity: string;
  base_mc: number; current_mc: number; destroyed: boolean;
  owner?: string;
}

// De server denkt altijd in "Player 1" (host) en "Player 2" (guest); de UI
// vertaalt dat naar "jij". Het type staat in battleLog.ts omdat het draaiboek
// het ook nodig heeft.
export type { Perspective };

// --- HELPERS ---
const getCardImage = (cardId: string) => `/NFTCARDS/${cardId.trim().replace(/\s+/g, '_')}.png`;

const sumProjects = (cards: any[] | undefined) =>
  (cards || [])
    .filter((c: any) => c.card_type === 'Project' && !c.destroyed)
    .reduce((acc: number, c: any) => acc + (c.current_mc ?? 0), 0);

const RollingNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => {
    if (displayValue === value) return;
    const timeout = setTimeout(() => {
      if (Math.abs(displayValue - value) < 0.1) setDisplayValue(value);
      else if (displayValue < value) setDisplayValue(prev => prev + Math.max(0.1, (value - prev) / 10));
      else setDisplayValue(prev => prev - Math.max(0.1, (prev - value) / 10));
    }, 25);
    return () => clearTimeout(timeout);
  }, [value, displayValue]);
  return <span>{displayValue.toFixed(0)}</span>;
};

// --- COMPONENT: BATTLE CARD ---
export const BattleCard = ({ card, activeType, lastChange, floatUp = true }: { card: Card | undefined, activeType: string | null, lastChange: number | null, floatUp?: boolean }) => {
  const [imgError, setImgError] = useState(false);
  // Afmeting via CSS-variabelen, zodat het bord op een telefoon in beeld past
  // zonder dat je horizontaal moet scrollen. Zie GlobalStyles.
  const cardStyle = { width: 'var(--coc-card-w)', height: 'var(--coc-card-h)' };

  if (!card) return <div style={cardStyle} className="bg-white/5 rounded-xl border border-dashed border-white/10" />;

  let glowStyle: React.CSSProperties = {};
  let animClass = "";

  // VISUELE FEEDBACK LOGICA
  if (activeType === "debuff") {
      // ROOD: Bij damage, reduction, steal, destroy
      glowStyle = { boxShadow: '0 0 60px rgba(220, 38, 38, 1)', border: '3px solid #ef4444', zIndex: 100 };
      animClass = "scale-110 z-50 animate-shake-hard";
  }
  else if (activeType === "buff") {
      // GROEN: Bij boost, heal
      glowStyle = { boxShadow: '0 0 60px rgba(34, 197, 94, 1)', border: '3px solid #22c55e', zIndex: 100 };
      animClass = "scale-110 z-50";
  }
  else if (activeType === "acting") {
      // WIT: De kaart die de actie uitvoert
      glowStyle = { boxShadow: '0 0 40px rgba(255, 255, 255, 0.7)', border: '2px solid #fff', zIndex: 50 };
      animClass = "scale-105";
  }

  return (
    <div style={{ ...cardStyle, ...glowStyle }} className={`relative flex-shrink-0 transition-all duration-300 rounded-xl ${animClass} ${card.destroyed ? 'opacity-20 grayscale blur-[1px]' : 'opacity-100'}`}>
      <AnimatePresence>
        {activeType && lastChange !== null && lastChange !== 0 && (
          // Het getal zweeft weg van het midden van het scherm: bij de bovenste
          // rij omhoog, bij de onderste omlaag. Anders landt het bovenop de
          // aankondigingstekst in de balk ertussen.
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: floatUp ? -52 : 52, scale: 1.4 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-x-0 ${floatUp ? '-top-4' : '-bottom-4'} text-center text-2xl md:text-4xl font-black z-[999] pointer-events-none drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${lastChange > 0 ? 'text-green-400' : 'text-red-500'}`}
          >
            {lastChange > 0 ? `+${lastChange.toFixed(0)}` : lastChange.toFixed(0)}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full h-full bg-black rounded-xl border border-white/10 overflow-hidden flex flex-col shadow-2xl relative">
        <div className="relative flex-1 bg-black overflow-hidden">
          {!imgError ? (<img src={getCardImage(card.card_id)} alt={card.card_id} className="w-full h-full object-cover" onError={() => setImgError(true)} />) : (<div className="w-full h-full flex items-center justify-center bg-gray-900 text-[8px] text-gray-600 text-center p-2 uppercase italic">{card.card_id.replace('COC_','')}</div>)}
          {!card.destroyed && card.card_type === 'Project' && <div className="absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 bg-blue-600 px-1 md:px-1.5 py-0.5 rounded text-[10px] md:text-[12px] font-black text-white border border-white/20 shadow-lg"><RollingNumber value={card.current_mc} /></div>}
        </div>
        <div className="bg-black py-1 text-center border-t border-white/10"><p className="text-[6px] md:text-[8px] font-black text-gray-500 truncate uppercase px-1">{card.card_id.replace('COC_', '').replace('_', ' ')}</p></div>
      </div>
      {card.destroyed && <div className="absolute inset-0 flex items-center justify-center z-50"><div className="bg-red-600 text-white font-black text-[10px] rotate-12 px-2 py-0.5 rounded shadow-2xl border-2 border-white uppercase">Rejected</div></div>}
    </div>
  );
};

// --- COMPONENT: RESULT SCREEN ---
// score1/score2 zijn ALTIJD de server-scores van Player 1 / Player 2.
// Het omdraaien naar het perspectief van de kijker gebeurt hier, één keer.
export const BattleResult = ({ result, score1, score2, onBack, onLog, onShare, perspective = 'p1', opponentLabel = 'Adversary' }: any) => {
  const me = perspective === 'p2' ? 'Player 2' : 'Player 1';
  const outcome: 'win' | 'loss' | 'draw' =
    result.winner === 'Draw' ? 'draw' : result.winner === me ? 'win' : 'loss';

  const myScore = perspective === 'p2' ? score2 : score1;
  const theirScore = perspective === 'p2' ? score1 : score2;

  const title = outcome === 'win' ? 'VICTORY' : outcome === 'loss' ? 'DEFEAT' : 'DRAW';
  const titleColor = outcome === 'win' ? 'text-amber-500' : outcome === 'loss' ? 'text-zinc-600' : 'text-blue-300';
  const myPanelBorder = outcome === 'win' ? 'border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.2)]' : 'border-blue-900';
  const theirPanelBorder = outcome === 'loss' ? 'border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.2)]' : 'border-zinc-800';

  return (
    // Dit scherm was `h-screen` met `justify-center` en zonder scroll. Op een
    // telefoon stapelen de twee scorepanelen verticaal (2x220px) bovenop de
    // titel; samen ruim 900px. Dat past niet, en gecentreerd zonder overflow
    // schoven de knoppen onderaan buiten beeld — je kwam er niet meer uit.
    // Nu: de laag scrollt, en de inhoud is op mobiel compacter.
    <div className="fixed inset-0 z-[99999] bg-black font-sans overflow-y-auto overscroll-contain">
       <div className="fixed inset-0 z-0"><div className="absolute inset-0 bg-[url('/table.jpeg')] bg-cover bg-center opacity-30 blur-sm grayscale"></div><div className="absolute inset-0 bg-black/80"></div></div>
       <div className="relative z-10 min-h-full flex flex-col items-center justify-center w-full max-w-6xl mx-auto px-4 py-8 animate-in fade-in zoom-in duration-500">
        <div className="mb-6 md:mb-12 text-center">
          <div className="inline-block px-5 md:px-8 py-2 mb-4 md:mb-8 border border-white/20 bg-black/50 rounded-full backdrop-blur-md"><span className="text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] md:tracking-[0.4em]">Simulation Terminated</span></div>
          <h1 className={`text-5xl md:text-9xl font-['Cinzel'] font-black uppercase tracking-tight italic drop-shadow-2xl ${titleColor}`}>{title}</h1>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-12 mb-8 md:mb-16 w-full">
          <div className={`relative w-full max-w-[320px] h-[130px] md:h-[220px] bg-black border-2 rounded-3xl flex flex-col items-center justify-center ${myPanelBorder}`}><span className="text-blue-500 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] mb-2 md:mb-4">You</span><span className="text-6xl md:text-8xl font-black text-white font-['Cinzel'] leading-none">{Math.floor(myScore)}</span></div>
          <div className="text-zinc-700 font-['Cinzel'] text-3xl md:text-6xl font-black italic select-none">VS</div>
          <div className={`relative w-full max-w-[320px] h-[130px] md:h-[220px] bg-black border-2 rounded-3xl flex flex-col items-center justify-center ${theirPanelBorder}`}><span className="text-red-500 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] mb-2 md:mb-4">{opponentLabel}</span><span className="text-6xl md:text-8xl font-black text-zinc-500 font-['Cinzel'] leading-none">{Math.floor(theirScore)}</span></div>
        </div>
        <div className="flex flex-col items-center gap-4 md:gap-6 w-full max-w-sm">
          <button onClick={onBack} className="w-full h-14 md:h-16 bg-white text-black rounded-xl font-black text-base md:text-lg uppercase tracking-[0.2em] hover:bg-amber-400 hover:scale-[1.02] transition-all shadow-xl">Return to Arena</button>
          <div className="flex w-full gap-4"><button onClick={onLog} className="flex-1 py-4 rounded-xl border border-zinc-700 bg-black text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:border-white hover:text-white transition-colors">View Log</button><button onClick={onShare} className="flex-1 py-4 rounded-xl border border-zinc-700 bg-black text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:border-blue-500 hover:text-blue-400 transition-colors">Share</button></div>
        </div>
      </div>
    </div>
  );
};

// --- STYLES (buiten de component, anders remount de <style> bij elke render) ---
const GlobalStyles = () => (
  <style jsx global>{`
    /* Kaartformaat centraal, zodat het hele bord op een telefoon past.
       Bij 64px breed is een rij van 5 plus tussenruimtes ~344px — dat past
       binnen een scherm van 390px, dus geen horizontaal geschuif meer. */
    :root { --coc-card-w: 64px; --coc-card-h: 112px; }
    @media (min-width: 768px) { :root { --coc-card-w: 120px; --coc-card-h: 210px; } }

    @keyframes shake-hard { 0% { transform: translate(1px, 1px) rotate(0deg); } 25% { transform: translate(-3px, -2px) rotate(-1deg); } 50% { transform: translate(3px, 2px) rotate(1deg); } 75% { transform: translate(-1px, 1px) rotate(0deg); } 100% { transform: translate(0, 0) rotate(0); } }
    .animate-shake-hard { animation: shake-hard 0.4s cubic-bezier(.36,.07,.19,.97) both; }
  `}</style>
);

// Buiten BattleFlow gedefinieerd: een component die in de render-body wordt
// aangemaakt krijgt elke render een nieuwe identiteit en remount al zijn kaarten.
const Formation = ({ cards, isPlayer, activeActions, lastChanges }: {
  cards: Card[]; isPlayer: boolean;
  activeActions: Record<string, string | null>; lastChanges: Record<string, number | null>;
}) => {
  const founder = cards.find(c => c.card_type === 'Founder');
  const projects = cards.filter(c => c.card_type === 'Project');
  const supports = cards.filter(c => c.card_type !== 'Project' && c.card_type !== 'Founder');
  // Eigen kant: projects vooraan. Overkant: gespiegeld, zodat de rijen elkaar aankijken.
  const frontRow = isPlayer ? projects : supports;
  const backRow = isPlayer ? supports : projects;

  return (
    // Op een telefoon staat de Founder bóven de rijen in plaats van ernaast:
    // naast elkaar past het niet en werd je gedwongen horizontaal te scrollen.
    <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-12 w-full md:min-w-[1000px] px-2 md:px-10 relative z-10">
      <div className="flex flex-col items-center">
        <BattleCard card={founder} activeType={activeActions[founder?.card_id || ""]} lastChange={lastChanges[founder?.card_id || ""] ?? null} floatUp={!isPlayer} />
        <p className={`text-[9px] md:text-[10px] font-black mt-1 md:mt-3 uppercase tracking-widest ${isPlayer ? 'text-blue-500' : 'text-red-500'}`}>Leader</p>
      </div>
      <div className="flex flex-col gap-2 md:gap-6">
        <div className="flex flex-row gap-1.5 md:gap-4">{frontRow.map(c => <BattleCard key={c.card_id} card={c} activeType={activeActions[c.card_id]} lastChange={lastChanges[c.card_id] ?? null} floatUp={!isPlayer} />)}</div>
        <div className="flex flex-row gap-1.5 md:gap-4">{backRow.map(c => <BattleCard key={c.card_id} card={c} activeType={activeActions[c.card_id]} lastChange={lastChanges[c.card_id] ?? null} floatUp={!isPlayer} />)}</div>
      </div>
    </div>
  );
};

// --- COMPONENT: BATTLE FLOW (THE ENGINE) ---
export const BattleFlow = ({ result, onBack, onFinish, perspective = 'p1', opponentLabel = 'Opponent' }: {
  result: any;
  onBack: () => void;
  onFinish: (s1: number, s2: number) => void;
  perspective?: Perspective;
  opponentLabel?: string;
}) => {
  const [p1Cards, setP1Cards] = useState<Card[]>([]);
  const [p2Cards, setP2Cards] = useState<Card[]>([]);
  const [activeActions, setActiveActions] = useState<Record<string, string | null>>({});
  const [lastChanges, setLastChanges] = useState<Record<string, number | null>>({});
  const [currentBeat, setCurrentBeat] = useState<Beat | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [liveScores, setLiveScores] = useState({ p1: 0, p2: 0 });

  // onFinish is bij alle aanroepers een inline arrow. Stond hij in de dependency
  // array van de step-timer, dan wiste elke re-render van de parent de lopende
  // 2500ms-tick en begon die opnieuw — waardoor het log nooit doorliep.
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  // Precies één keer afronden, ook als SKIP TO END en de finalize-timer elkaar kruisen.
  const finishedRef = useRef(false);
  const finish = useCallback((s1: number, s2: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsFinished(true);
    onFinishRef.current(s1, s2);
  }, []);

  // De gloed en de zwevende getallen worden gezet door een timer van 50ms, die
  // gepland wordt in dezelfde tick waarin ook currentStep opschuift. Ruim je die
  // timer op bij het wisselen van stap, dan wist de effect-cleanup hem voordat
  // hij ooit afgaat — en verdwijnen alle visuele effecten. Deze timers horen
  // dus bij de component, niet bij de stap: alleen opruimen bij unmount.
  const visualTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => {
    visualTimers.current.forEach(clearTimeout);
    visualTimers.current = [];
  }, []);

  // Een identiek Firestore-snapshot levert een nieuw object op. Zonder stabiele
  // sleutel herstart de init-effect het bord terwijl currentStep blijft staan.
  const resultKey = result?.battleId ?? result?.matchId ?? `${result?.finalScores?.p1}-${result?.finalScores?.p2}`;

  const serverScores = useMemo(() => ({
    p1: result?.finalScores?.p1 ?? sumProjects(result?.finalFields?.p1),
    p2: result?.finalScores?.p2 ?? sumProjects(result?.finalFields?.p2),
  }), [resultKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Het draaiboek: de ruwe log omgezet naar beats met eigen tempo. De volledige
  // log blijft ongefilterd beschikbaar onder VIEW LOG.
  const script = useMemo(
    () => buildBattleScript(result?.logs, perspective),
    [resultKey, perspective] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const init = (cards: any[] | undefined) => (cards || []).map(c => ({
      ...c,
      current_mc: c.card_type === 'Project' ? (c.base_mc || 0) : 0,
      destroyed: false,
    }));
    const next1 = init(result?.finalFields?.p1);
    const next2 = init(result?.finalFields?.p2);
    setP1Cards(next1);
    setP2Cards(next2);
    setLiveScores({ p1: sumProjects(next1), p2: sumProjects(next2) });
    setCurrentStep(0);
    setCurrentBeat(null);
    setActiveActions({});
    setLastChanges({});
    setIsFinished(false);
    finishedRef.current = false;
  }, [resultKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isFinished) return;

    const beat = script[currentStep];

    // Een score-beat heeft geen tekst en geen tijdsduur: alleen de stand bijwerken
    // en meteen door naar de volgende.
    if (beat && beat.kind === 'score') {
      if (beat.score) setLiveScores(prev => ({ ...prev, ...beat.score }));
      setCurrentStep(step => step + 1);
      return;
    }

    const stepTimer = setTimeout(() => {
      if (currentStep >= script.length) return;

      if (!beat || beat.kind === 'finale') {
        setCurrentBeat(beat ?? null);
        setActiveActions({});
        setLiveScores(serverScores);
        visualTimers.current.push(
          setTimeout(() => finish(serverScores.p1, serverScores.p2), 900 / speedMultiplier)
        );
        return;
      }

      const log = beat.raw;
      setCurrentBeat(beat);
      setActiveActions({});
      setLastChanges({});

      if (beat.score) setLiveScores(prev => ({ ...prev, ...beat.score }));

      // Kaartanimaties uit de originele regel lezen (zie battleLog.ts).
      const parsed = parseBattleLine(log);
      if (Object.keys(parsed.glow).length > 0) {
        // Even resetten en dan pas zetten, zodat AnimatePresence het schadegetal
        // opnieuw animeert ook als dezelfde kaart twee keer op rij geraakt wordt.
        visualTimers.current.push(setTimeout(() => {
          setActiveActions(parsed.glow);
          setLastChanges(parsed.deltas);
        }, 50));

        // Beide spelers mogen dezelfde kaart spelen. Noemt de regel expliciet een
        // eigenaar ("Player 2's COC_X"), dan raken we alleen die kant aan.
        const applyTo = (prev: Card[], side: string) => prev.map(c => {
          if (!parsed.glow[c.card_id]) return c;
          const stated = parsed.ownerOf[c.card_id];
          if (stated && stated !== side) return c;

          if (parsed.destroyedId === c.card_id) return { ...c, destroyed: true, current_mc: 0 };

          const exact = parsed.values[c.card_id];
          if (exact !== undefined) return { ...c, current_mc: exact };

          const delta = parsed.deltas[c.card_id];
          if (delta !== undefined) return { ...c, current_mc: Math.max(0, c.current_mc + delta) };

          return c;
        });

        setP1Cards(prev => applyTo(prev, 'Player 1'));
        setP2Cards(prev => applyTo(prev, 'Player 2'));
      }

      setCurrentStep(step => step + 1);
    }, (beat?.duration ?? 2300) / speedMultiplier);

    return () => clearTimeout(stepTimer);
  }, [currentStep, script, isFinished, speedMultiplier, serverScores, finish]);

  const skipToEnd = () => {
    // Toon het echte eindbord van de server in plaats van de half afgespeelde staat.
    setP1Cards(result?.finalFields?.p1 ?? []);
    setP2Cards(result?.finalFields?.p2 ?? []);
    setLiveScores(serverScores);
    setCurrentBeat(null);
    setActiveActions({});
    setLastChanges({});
    finish(serverScores.p1, serverScores.p2);
  };

  // Server denkt in p1/p2; de kijker ziet zichzelf onderaan.
  const myCards = perspective === 'p2' ? p2Cards : p1Cards;
  const theirCards = perspective === 'p2' ? p1Cards : p2Cards;
  const myScore = perspective === 'p2' ? liveScores.p2 : liveScores.p1;
  const theirScore = perspective === 'p2' ? liveScores.p1 : liveScores.p2;

  return (
    <div className="flex flex-col items-center w-full min-h-screen py-4 md:py-10 relative overflow-x-hidden bg-[#050505]">
      <GlobalStyles />
      <div className="absolute inset-0 z-0"><div className="absolute inset-0 bg-cover bg-center opacity-40 brightness-[0.2]" style={{ backgroundImage: "url('/table.jpeg')" }}></div><div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_20%,_black_95%)]"></div></div>
      <div className="relative z-10 w-full flex flex-col items-center">
        <div className="mb-4 animate-in fade-in duration-500"><Formation cards={theirCards} isPlayer={false} activeActions={activeActions} lastChanges={lastChanges} /></div>
        <div className="w-full max-w-5xl relative z-50 my-6 flex flex-col items-center">
          <div className="w-full bg-black/90 backdrop-blur-2xl py-6 px-4 relative overflow-hidden rounded-[2.5rem] border border-amber-500/20 shadow-[0_0_40px_rgba(251,191,36,0.15)]">
            <div className="flex justify-between w-full px-4 md:px-24 mb-4 relative z-10">
              <div className="flex flex-col items-start"><span className="text-[10px] text-blue-500 font-black tracking-[0.3em] mb-1 uppercase">You</span><div className="text-3xl md:text-5xl font-['Cinzel'] font-black text-white"><RollingNumber value={myScore} /></div></div>
              <div className="flex flex-col items-center justify-center"><div className="px-4 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-[9px] font-black text-blue-400 tracking-[0.2em] mb-2 uppercase animate-pulse">Match Active</div><div className="text-gray-600 font-['Cinzel'] italic text-xl">VS</div></div>
              <div className="flex flex-col items-end"><span className="text-[10px] text-red-500 font-black tracking-[0.3em] mb-1 uppercase">{opponentLabel}</span><div className="text-3xl md:text-5xl font-['Cinzel'] font-black text-white"><RollingNumber value={theirScore} /></div></div>
            </div>
            <div className="relative flex items-center justify-center min-h-[4rem] md:min-h-[4.5rem] px-3 md:px-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="text-center w-full"
                >
                  {currentBeat?.kind === 'phase' ? (
                    <span className="inline-block px-6 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 font-['Cinzel'] font-black uppercase text-sm md:text-lg tracking-[0.25em]">
                      {currentBeat.text}
                    </span>
                  ) : currentBeat?.kind === 'title' || currentBeat?.kind === 'finale' ? (
                    <span className="font-['Cinzel'] font-black uppercase text-lg md:text-3xl tracking-[0.2em] text-white">
                      {currentBeat.text}
                    </span>
                  ) : currentBeat?.kind === 'lineup' ? (
                    <>
                      <p className="font-['Cinzel'] font-black uppercase text-sm md:text-lg tracking-widest text-white">{currentBeat.card}</p>
                      <p className="text-[11px] md:text-sm text-blue-200/70 leading-snug mt-0.5 line-clamp-2">{currentBeat.text}</p>
                    </>
                  ) : (
                    <p className="text-sm md:text-xl font-['Spectral'] italic text-blue-100 leading-snug">
                      {currentBeat?.text ?? 'Preparing the field…'}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex gap-6 mt-4 justify-center">
              <button onClick={() => setSpeedMultiplier(speedMultiplier === 1 ? 5 : 1)} className={`px-5 py-1.5 rounded-full text-[9px] font-black border transition-all ${speedMultiplier > 1 ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-transparent border-white/20 text-gray-400'}`}>{speedMultiplier > 1 ? '⚡ WARP SPEED' : '🐢 NORMAL TIME'}</button>
              <button onClick={skipToEnd} className="px-5 py-1.5 rounded-full text-[9px] font-black border border-white/10 text-gray-500 hover:text-white transition-all">SKIP TO END</button>
            </div>
          </div>
        </div>
        <div className="mt-4 animate-in fade-in duration-500 relative z-[60]"><Formation cards={myCards} isPlayer={true} activeActions={activeActions} lastChanges={lastChanges} /></div>
      </div>
    </div>
  );
};

// De logweergave is verhuisd naar BattleLogView.tsx. Die dumpte hier elke
// regel als genummerde monospace-tekst; het ordenen zit nu in logModel.ts.
// De naam BattleLog blijft bestaan zodat bestaande imports blijven werken.
export { BattleLogView as BattleLog } from './BattleLogView';
