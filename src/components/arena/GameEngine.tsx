'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- TYPES ---
export interface Card {
  card_id: string; card_type: string; rarity: string;
  base_mc: number; current_mc: number; destroyed: boolean;
}

// --- HELPERS ---
const getCardImage = (cardId: string) => `/NFTCARDS/${cardId.trim().replace(/\s+/g, '_')}.png`;

const RollingNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (Math.abs(displayValue - value) < 0.1) setDisplayValue(value);
      else if (displayValue < value) setDisplayValue(prev => prev + Math.max(0.1, (value - prev) / 10));
      else if (displayValue > value) setDisplayValue(prev => prev - Math.max(0.1, (prev - value) / 10));
    }, 25);
    return () => clearTimeout(timeout);
  }, [value, displayValue]);
  return <span>{displayValue.toFixed(0)}</span>;
};

// --- COMPONENT: BATTLE CARD ---
export const BattleCard = ({ card, activeType, lastChange }: { card: Card | undefined, activeType: string | null, lastChange: number | null }) => {
  const [imgError, setImgError] = useState(false);
  const cardStyle = { width: '120px', height: '210px' };

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
          <motion.div 
            initial={{ opacity: 0, y: 0, scale: 0.5 }} 
            animate={{ opacity: 1, y: -100, scale: 1.5 }} 
            exit={{ opacity: 0 }} 
            className={`absolute inset-x-0 -top-10 text-center text-4xl font-black z-[999] pointer-events-none drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${lastChange > 0 ? 'text-green-400' : 'text-red-500'}`}
          >
            {lastChange > 0 ? `+${lastChange.toFixed(0)}` : lastChange.toFixed(0)}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full h-full bg-black rounded-xl border border-white/10 overflow-hidden flex flex-col shadow-2xl relative">
        <div className="relative flex-1 bg-black overflow-hidden">
          {!imgError ? (<img src={getCardImage(card.card_id)} alt={card.card_id} className="w-full h-full object-cover" onError={() => setImgError(true)} />) : (<div className="w-full h-full flex items-center justify-center bg-gray-900 text-[8px] text-gray-600 text-center p-2 uppercase italic">{card.card_id.replace('COC_','')}</div>)}
          {!card.destroyed && card.card_type === 'Project' && <div className="absolute bottom-1 right-1 bg-blue-600 px-1.5 py-0.5 rounded text-[12px] font-black text-white border border-white/20 shadow-lg"><RollingNumber value={card.current_mc} /></div>}
        </div>
        <div className="bg-black py-1 text-center border-t border-white/10"><p className="text-[6px] md:text-[8px] font-black text-gray-500 truncate uppercase px-1">{card.card_id.replace('COC_', '').replace('_', ' ')}</p></div>
      </div>
      {card.destroyed && <div className="absolute inset-0 flex items-center justify-center z-50"><div className="bg-red-600 text-white font-black text-[10px] rotate-12 px-2 py-0.5 rounded shadow-2xl border-2 border-white uppercase">Rejected</div></div>}
    </div>
  );
};

// --- COMPONENT: RESULT SCREEN ---
export const BattleResult = ({ result, score1, score2, onBack, onLog, onShare }: any) => {
  return (
    <div className="fixed inset-0 z-[99999] w-screen h-screen bg-black flex flex-col items-center justify-center font-sans">
       <div className="absolute inset-0 z-0"><div className="absolute inset-0 bg-[url('/table.jpeg')] bg-cover bg-center opacity-30 blur-sm grayscale"></div><div className="absolute inset-0 bg-black/80"></div></div>
       <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-6xl px-4 animate-in fade-in zoom-in duration-500">
        <div className="mb-12 text-center">
          <div className="inline-block px-8 py-2 mb-8 border border-white/20 bg-black/50 rounded-full backdrop-blur-md"><span className="text-white/50 text-xs font-bold uppercase tracking-[0.4em]">Simulation Terminated</span></div>
          <h1 className={`text-6xl md:text-9xl font-['Cinzel'] font-black uppercase tracking-tight italic drop-shadow-2xl ${result.winner === "Player 1" ? "text-amber-500" : "text-zinc-600"}`}>{result.winner === "Player 1" ? "VICTORY" : "DEFEAT"}</h1>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-12 mb-16">
          <div className={`relative flex-shrink-0 w-[320px] h-[220px] bg-black border-2 rounded-3xl flex flex-col items-center justify-center ${result.winner === "Player 1" ? "border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.2)]" : "border-blue-900"}`}><span className="text-blue-500 text-xs font-black uppercase tracking-[0.3em] mb-4">Commander</span><span className="text-8xl font-black text-white font-['Cinzel'] leading-none">{Math.floor(score1)}</span></div>
          <div className="text-zinc-700 font-['Cinzel'] text-6xl font-black italic select-none">VS</div>
          <div className={`relative flex-shrink-0 w-[320px] h-[220px] bg-black border-2 rounded-3xl flex flex-col items-center justify-center ${result.winner !== "Player 1" ? "border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.2)]" : "border-zinc-800"}`}><span className="text-red-500 text-xs font-black uppercase tracking-[0.3em] mb-4">Adversary</span><span className="text-8xl font-black text-zinc-500 font-['Cinzel'] leading-none">{Math.floor(score2)}</span></div>
        </div>
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          <button onClick={onBack} className="w-full h-16 bg-white text-black rounded-xl font-black text-lg uppercase tracking-[0.2em] hover:bg-amber-400 hover:scale-[1.02] transition-all shadow-xl">Return to Arena</button>
          <div className="flex w-full gap-4"><button onClick={onLog} className="flex-1 py-4 rounded-xl border border-zinc-700 bg-black text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:border-white hover:text-white transition-colors">View Log</button><button onClick={onShare} className="flex-1 py-4 rounded-xl border border-zinc-700 bg-black text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:border-blue-500 hover:text-blue-400 transition-colors">Share</button></div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: BATTLE FLOW (THE ENGINE) ---
// --- COMPONENT: BATTLE FLOW (THE ENGINE) ---
export const BattleFlow = ({ result, onBack, onFinish }: { result: any, onBack: () => void, onFinish: (s1: number, s2: number) => void }) => {
  const [p1Cards, setP1Cards] = useState<Card[]>([]);
  const [p2Cards, setP2Cards] = useState<Card[]>([]);
  const [activeActions, setActiveActions] = useState<Record<string, string | null>>({});
  const [lastChanges, setLastChanges] = useState<Record<string, number | null>>({});
  const [announcerText, setAnnouncerText] = useState("Initializing Combat Protocol...");
  const [isFinished, setIsFinished] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);

  // 1. VERBETERDE LOG PARSER
  const eventQueue = useMemo(() => {
    if (!result || !result.logs) return ["--- FINALIZE ---"];

    // Helper om tekst schoon te maken VOORDAT we filteren
    const clean = (t: string) => t.replace(/\*\*/g, '').replace(/[\n\r]+/g, ' ').trim();

    const logs = result.logs
        .flatMap((log: string) => log.split('\n')) // Splits eerst op enters
        .map(clean)                                // Maak schoon
        .filter((l: string) => l.length > 5);      // Filter lege regels weg
        
    // We laten nu ALLES door dat langer is dan 5 letters. 
    // Zo zie je tenminste "Start Phase Begins" etc.
    return [...logs, "--- FINALIZE ---"];
  }, [result.logs]);

  useEffect(() => {
    const init = (cards: any[]) => cards.map(c => ({ ...c, current_mc: c.card_type === 'Project' ? (c.base_mc || 0) : 0, destroyed: false }));
    setP1Cards(init(result.finalFields.p1));
    setP2Cards(init(result.finalFields.p2));
  }, [result]);

  useEffect(() => {
    if (isFinished) return;
    const timer = setTimeout(() => {
      if (currentStep < eventQueue.length) {
        const log = eventQueue[currentStep];
        
        if (log === "--- FINALIZE ---") { 
           setAnnouncerText("Match Concluded."); setActiveActions({}); 
           setTimeout(() => {
             // Gebruik ALTIJD server scores
             const s1 = result.finalScores?.p1 ?? p1Cards.filter(c => !c.destroyed).reduce((s, c) => s + c.current_mc, 0);
             const s2 = result.finalScores?.p2 ?? p2Cards.filter(c => !c.destroyed).reduce((s, c) => s + c.current_mc, 0);
             onFinish(s1, s2); 
             setIsFinished(true);
           }, 1000 / speedMultiplier); 
           return; 
        }
        
        setAnnouncerText(log); // Toon de schone tekst
        setActiveActions({}); setLastChanges({});
        
        // Check op kaart ID's voor animaties
        const cardMatches = log.match(/COC_\w+/g);
        if (cardMatches) {
          const l = log.toLowerCase();
          const actingId = cardMatches[0];
          const targetId = cardMatches[cardMatches.length - 1];
          
          let targetType = "acting";
          if (l.includes('hit') || l.includes('damage') || l.includes('reduc') || l.includes('stole') || l.includes('lost') || l.includes('burn') || l.includes('destroyed')) {
              targetType = "debuff";
          } else if (l.includes('buff') || l.includes('boost') || l.includes('gain') || l.includes('heal')) {
              targetType = "buff";
          } else if (l.includes('swapped')) {
              targetType = "swap";
          }
          
          const newActions: Record<string, string> = {};
          const newChanges: Record<string, number> = {};
          if (actingId !== targetId) newActions[actingId] = "acting";
          newActions[targetId] = targetType;
          
          cardMatches.forEach((id: string) => {
             const mcMatch = log.match(/[-+]\d+/); 
             if (mcMatch && id === targetId) {
                 newChanges[id] = parseFloat(mcMatch[0]);
             } else if (l.includes('destroyed') && id === targetId) {
                 newChanges[id] = -999;
             }
          });

          setTimeout(() => { setActiveActions(newActions); setLastChanges(newChanges); }, 50);
          
          const updateCards = (prev: Card[]) => prev.map(c => {
            if (newActions[c.card_id]) {
              if (log.toLowerCase().includes('destroyed') && c.card_id === targetId) return { ...c, destroyed: true, current_mc: 0 };
              
              const regex = new RegExp(`${c.card_id}.*?→\\s*(\\d+)`);
              const preciseMatch = log.match(regex);
              
              if (preciseMatch) {
                  return { ...c, current_mc: parseInt(preciseMatch[1]) };
              } else if (newChanges[c.card_id]) {
                  return { ...c, current_mc: Math.max(0, c.current_mc + (newChanges[c.card_id] || 0)) };
              }
            }
            return c;
          });
          setP1Cards(prev => updateCards(prev)); setP2Cards(prev => updateCards(prev));
        }
        setCurrentStep(currentStep + 1);
      }
    }, 2500 / speedMultiplier);
    return () => clearTimeout(timer);
  }, [currentStep, eventQueue, isFinished, p1Cards, p2Cards, onFinish, speedMultiplier]);

  const skipToEnd = () => {
    setIsFinished(true);
    
    // Gebruik ALTIJD server scores — nooit client-side herberekenen
    const s1 = result.finalScores?.p1 ?? result.finalFields.p1
      .filter((c: any) => c.card_type === 'Project' && !c.destroyed)
      .reduce((acc: number, c: any) => acc + (c.current_mc ?? 0), 0);
    const s2 = result.finalScores?.p2 ?? result.finalFields.p2
      .filter((c: any) => c.card_type === 'Project' && !c.destroyed)
      .reduce((acc: number, c: any) => acc + (c.current_mc ?? 0), 0);
    
    onFinish(s1, s2);
  };

  const score1 = p1Cards.filter(c => !c.destroyed).reduce((s, c) => s + c.current_mc, 0);
  const score2 = p2Cards.filter(c => !c.destroyed).reduce((s, c) => s + c.current_mc, 0);
  
  const GlobalStyles = () => ( <style jsx global>{` 
    @keyframes shake-hard { 0% { transform: translate(1px, 1px) rotate(0deg); } 25% { transform: translate(-3px, -2px) rotate(-1deg); } 50% { transform: translate(3px, 2px) rotate(1deg); } 75% { transform: translate(-1px, 1px) rotate(0deg); } 100% { transform: translate(0, 0) rotate(0); } } 
    .animate-shake-hard { animation: shake-hard 0.4s cubic-bezier(.36,.07,.19,.97) both; } 
  `}</style> );

  const Formation = ({ cards, isPlayer }: { cards: Card[], isPlayer: boolean }) => (
    <div className="flex flex-row items-center justify-center gap-12 w-full min-w-[1000px] px-10 relative z-10">
      <div className="flex flex-col items-center">
        <BattleCard card={cards.find(c => c.card_type === 'Founder')} activeType={activeActions[cards.find(c => c.card_type === 'Founder')?.card_id || ""]} lastChange={lastChanges[cards.find(c => c.card_type === 'Founder')?.card_id || ""] || null} />
        <p className={`text-[10px] font-black mt-3 uppercase tracking-widest ${isPlayer ? 'text-blue-500' : 'text-red-500'}`}>Leader</p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-row gap-4">{(isPlayer ? cards.filter(c => c.card_type === 'Project') : cards.filter(c => c.card_type !== 'Project' && c.card_type !== 'Founder')).map((c, i) => <BattleCard key={i} card={c} activeType={activeActions[c.card_id]} lastChange={lastChanges[c.card_id] || null} />)}</div>
        <div className="flex flex-row gap-4">{(isPlayer ? cards.filter(c => c.card_type !== 'Project' && c.card_type !== 'Founder') : cards.filter(c => c.card_type === 'Project')).map((c, i) => <BattleCard key={i} card={c} activeType={activeActions[c.card_id]} lastChange={lastChanges[c.card_id] || null} />)}</div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center w-full min-h-screen py-10 relative overflow-x-auto overflow-y-hidden bg-[#050505]">
      <GlobalStyles />
      <div className="absolute inset-0 z-0"><div className="absolute inset-0 bg-cover bg-center opacity-40 brightness-[0.2]" style={{ backgroundImage: "url('/table.jpeg')" }}></div><div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_20%,_black_95%)]"></div></div>
      <div className="relative z-10 w-full flex flex-col items-center">
        <div className="mb-4 animate-in fade-in duration-500"><Formation cards={p2Cards} isPlayer={false} /></div>
        <div className="w-full max-w-5xl relative z-50 my-6 flex flex-col items-center">
          <div className="w-full bg-black/90 backdrop-blur-2xl py-6 px-4 relative overflow-hidden rounded-[2.5rem] border border-amber-500/20 shadow-[0_0_40px_rgba(251,191,36,0.15)]">
            <div className="flex justify-between w-full px-12 md:px-24 mb-4 relative z-10">
              <div className="flex flex-col items-start"><span className="text-[10px] text-blue-500 font-black tracking-[0.3em] mb-1 uppercase">Player</span><div className="text-3xl md:text-5xl font-['Cinzel'] font-black text-white"><RollingNumber value={score1} /></div></div>
              <div className="flex flex-col items-center justify-center"><div className="px-4 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-[9px] font-black text-blue-400 tracking-[0.2em] mb-2 uppercase animate-pulse">Match Active</div><div className="text-gray-600 font-['Cinzel'] italic text-xl">VS</div></div>
              <div className="flex flex-col items-end"><span className="text-[10px] text-red-500 font-black tracking-[0.3em] mb-1 uppercase">CPU</span><div className="text-3xl md:text-5xl font-['Cinzel'] font-black text-white"><RollingNumber value={score2} /></div></div>
            </div>
            <div className="relative flex items-center justify-center min-h-[3rem] px-8"><AnimatePresence mode="wait"><motion.p key={announcerText} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-center text-lg md:text-xl font-['Spectral'] italic text-blue-100 leading-tight">{announcerText}</motion.p></AnimatePresence></div>
            <div className="flex gap-6 mt-4 justify-center">
              <button onClick={() => setSpeedMultiplier(speedMultiplier === 1 ? 5 : 1)} className={`px-5 py-1.5 rounded-full text-[9px] font-black border transition-all ${speedMultiplier > 1 ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-transparent border-white/20 text-gray-400'}`}>{speedMultiplier > 1 ? '⚡ WARP SPEED' : '🐢 NORMAL TIME'}</button>
              <button onClick={skipToEnd} className="px-5 py-1.5 rounded-full text-[9px] font-black border border-white/10 text-gray-500 hover:text-white transition-all">SKIP TO END</button>
            </div>
          </div>
        </div>
        <div className="mt-4 animate-in fade-in duration-500 relative z-[60]"><Formation cards={p1Cards} isPlayer={true} /></div>
      </div>
    </div>
  );
};

// --- NIEUW: COMPONENT VOOR LOG WEERGAVE ---
export const BattleLog = ({ logs, onClose }: { logs: string[], onClose: () => void }) => {
  const cleanLine = (text: string) => text.replace(/\*.*?\*/g, '').replace(/\*\*/g, '').replace(/🧪|💥|✨|💀|🛡️|📊|👑|🔷|🔶|🧱|🛠️|📈|⚖️|🔄|↳/g, '').trim();

  return (
    <div className="fixed inset-0 z-[99999] bg-[#050505] flex flex-col font-mono animate-in fade-in duration-300">
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/90 backdrop-blur-md relative z-10">
        <div>
          <h3 className="text-2xl md:text-3xl font-['Cinzel'] font-black text-blue-400 uppercase tracking-tighter">Combat Log</h3>
          <p className="text-gray-600 text-[10px] uppercase tracking-[0.4em] mt-1 font-bold">Sequence Data</p>
        </div>
        <button onClick={onClose} className="bg-white text-black px-8 py-3 rounded-full font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all">
          Close Log
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-[url('/table.jpeg')] bg-fixed bg-cover relative">
        <div className="absolute inset-0 bg-black/90 z-0"></div>
        <div className="relative z-10 max-w-4xl mx-auto space-y-3">
          {logs.map((rawLog, i) => {
             const log = cleanLine(rawLog);
             if (log.length < 5) return null;
             let colorClass = "text-gray-400";
             if (rawLog.includes('hits') || rawLog.includes('damage') || rawLog.includes('reduced')) colorClass = "text-red-400";
             else if (rawLog.includes('buff') || rawLog.includes('boost') || rawLog.includes('gain')) colorClass = "text-green-400";
             else if (rawLog.includes('destroyed')) colorClass = "text-red-600 font-bold";

             return (
               <div key={i} className="flex gap-4 items-start border-l-2 border-white/5 pl-4 py-2 hover:bg-white/5 transition-colors rounded-r-lg">
                 <span className="text-gray-700 text-[10px] pt-1 font-bold tabular-nums w-8">{String(i + 1).padStart(3, '0')}</span>
                 <p className={`text-sm md:text-base leading-relaxed ${colorClass}`}>{log}</p>
               </div>
             );
          })}
          <div className="pt-10 text-center"><p className="text-gray-600 text-xs uppercase tracking-widest">--- END OF TRANSMISSION ---</p></div>
        </div>
      </div>
    </div>
  );
};