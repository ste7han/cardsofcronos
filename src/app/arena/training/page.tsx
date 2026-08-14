'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ethers } from 'ethers';

// Firebase
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db as firestoreDb, authReady } from '@/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

// Data & Hooks
import allCardsData from '@/lib/cards.json'; 
import { useAppKit } from '@/hooks/useAppKit';

// Components
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { DeckCard } from '@/components/arena/DeckCard';

// HIER IMPORTEREN WE DE ENGINE DIE WE NET GEMAAKT HEBBEN
import { BattleFlow, BattleResult, BattleLog } from '@/components/arena/GameEngine';

function TrainingArenaContent() {
  const { appKitAccount, openAppKit } = useAppKit();
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();

  // --- STATE ---
  const [view, setView] = useState<'deck-builder' | 'fighting' | 'result' | 'log'>('deck-builder');
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [stake, setStake] = useState(100); // Fictieve stake voor training
  const [battleResult, setBattleResult] = useState<any>(null);
  const [finalScores, setFinalScores] = useState({ s1: 0, s2: 0 });
  
  // Loading states
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeAddress, setActiveAddress] = useState<string | undefined>(undefined);

  useEffect(() => { setMounted(true); }, []);

  // --- 1. WALLET DETECTIE ---
  useEffect(() => {
    if (!mounted) return;
    const detectWallet = async () => {
      let addr = appKitAccount?.address;
      if (!addr && (window as any).ethereum) {
        try {
          const provider = new (ethers as any).providers.Web3Provider((window as any).ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) addr = accounts[0];
        } catch (e) {}
      }
      if (addr && addr !== activeAddress) setActiveAddress(addr);
    };
    detectWallet();
    const interval = setInterval(detectWallet, 2000);
    return () => clearInterval(interval);
  }, [mounted, appKitAccount, activeAddress]);

  // --- 2. REPLAY DETECTOR ---
  useEffect(() => {
    const matchId = searchParams.get('match');
    if (!mounted || !matchId) return;

    const loadReplay = async () => {
      setIsSimulating(true);
      try {
        const docRef = doc(firestoreDb, "matches", matchId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (!data.logs || !data.finalFields) {
            alert("This replay is from an older version and cannot be played.");
            return;
          }
          setBattleResult({ battleId: matchId, ...data });
          setView('fighting');
        } else {
          alert("Match not found.");
        }
      } catch (error: any) {
        console.error("Firestore Error:", error);
      } finally {
        setIsSimulating(false);
      }
    };
    loadReplay();
  }, [mounted, searchParams]);

  // --- 3. LOGICA: DECK BUILDER ---
  const getCount = (type: string) => selectedCards.filter(c => c.card_type === type || (type === 'Support' && c.card_type === 'Event')).length;
  const isDeckValid = getCount('Project') === 5 && getCount('Support') === 5 && getCount('Founder') === 1;

  const toggleCard = (card: any) => {
    const isSelected = selectedCards.find(c => c.card_id === card.card_id);
    if (isSelected) {
      setSelectedCards(selectedCards.filter(c => c.card_id !== card.card_id));
    } else {
      if (card.card_type === 'Project' && getCount('Project') >= 5) return;
      if ((card.card_type === 'Support' || card.card_type === 'Event') && getCount('Support') >= 5) return;
      if (card.card_type === 'Founder' && getCount('Founder') >= 1) return;
      setSelectedCards([...selectedCards, card]);
    }
  };

  // --- 4. LOGICA: START BATTLE (CLOUD FUNCTION) ---
  const handleStartSimulation = async () => {
    if (!isDeckValid || !activeAddress) return;
    setIsSimulating(true);
    try {
      // De callable weigert nu ongeauthenticeerde aanroepen.
      await authReady;
      const functions = getFunctions(app);
      const startBattleFunc = httpsCallable(functions, 'start_battle_python');
      
      // Voor training genereren we een willekeurig CPU deck
      const allCards = allCardsData as any[];
      const pPool = allCards.filter(c => c.card_type === 'Project');
      const sPool = allCards.filter(c => c.card_type === 'Support' || c.card_type === 'Event');
      const fPool = allCards.filter(c => c.card_type === 'Founder');
      
      // sort(() => 0.5 - Math.random()) is geen eerlijke shuffle: de uitkomst
      // hangt af van het sorteeralgoritme en bevoordeelt de oorspronkelijke
      // volgorde. Fisher-Yates trekt wel uniform.
      const pick = <T,>(pool: T[], n: number): T[] => {
        const a = [...pool];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a.slice(0, n);
      };

      const deckB_ids = [
        ...pick(pPool, 5),
        ...pick(sPool, 5),
        ...pick(fPool, 1)
      ].map(c => c.card_id);
      
      const result: any = await startBattleFunc({ 
        deckA_ids: selectedCards.map(c => c.card_id), 
        deckB_ids, 
        stake 
      });
      
      setBattleResult(result.data);
      setView('fighting');
    } catch (error: any) { 
      alert("Simulation Error: " + error.message); 
    } finally { 
      setIsSimulating(false); 
    }
  };

  const handleBattleFinish = (s1: number, s2: number) => {
    setFinalScores({ s1, s2 });
    setView('result');
  };

  if (!mounted) return <div className="min-h-screen bg-black" />;

  // --- VIEW: RESULTAAT (Volledig Scherm, Geen Header/Footer) ---
  if (view === 'result' && battleResult) {
    return (
      <BattleResult
        result={battleResult}
        score1={finalScores.s1}
        score2={finalScores.s2}
        perspective="p1"
        opponentLabel="CPU"
        onBack={() => { setView('deck-builder'); setBattleResult(null); setSelectedCards([]); }}
        onLog={() => setView('log')}
        onShare={() => { navigator.clipboard.writeText(`https://cardsofcronos.com/arena/training?match=${battleResult.battleId}`); alert("Replay link copied!"); }}
      />
    );
  }
  
  // --- NIEUW: LOG VIEW ---
  // Dit stukje ontbrak nog
  if (view === 'log' && battleResult) {
    return <BattleLog logs={battleResult.logs} onClose={() => setView('result')} perspective="p1" />;
  }

  // --- VIEW: NORMALE PAGINA (Deck Builder & Fighting) ---
  return (
    <div className="min-h-screen bg-[#050505] text-white font-['Spectral']">
      <Header isWalletConnected={!!activeAddress} walletAddress={activeAddress} onConnectWallet={openAppKit} />
      
      <main className="container mx-auto px-4 py-8">
        
        {/* --- DECK BUILDER VIEW --- */}
        {view === 'deck-builder' && (
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* Header van de builder */}
             <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                  <h2 className="text-3xl font-['Cinzel'] text-blue-400 uppercase tracking-tighter">Training Simulation</h2>
                  <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest">Select any cards freely • No real funds at risk</p>
                </div>
                
                {/* Teller Status */}
                <div className="flex gap-4 bg-gray-900/50 p-4 rounded-xl border border-white/5 font-bold uppercase text-xs">
                   <p className={getCount('Project') === 5 ? 'text-green-500' : 'text-gray-500'}>Projects: {getCount('Project')}/5</p>
                   <p className={getCount('Support') === 5 ? 'text-green-500' : 'text-gray-500'}>Supports: {getCount('Support')}/5</p>
                   <p className={getCount('Founder') === 1 ? 'text-green-500' : 'text-gray-500'}>Founder: {getCount('Founder')}/1</p>
                </div>
            </div>

            {/* Grid met kaarten */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 h-[500px] overflow-y-auto p-6 bg-white/5 rounded-3xl mb-8 border border-white/5 shadow-inner">
                {(allCardsData as any[]).map((card) => {
                    const isSelected = !!selectedCards.find(c => c.card_id === card.card_id);
                    return (
                    <DeckCard 
                        key={card.card_id} 
                        card={card} 
                        isSelected={isSelected} 
                        onToggle={toggleCard} 
                        colorTheme="blue" // Training is blauw
                    />
                    );
                })}
                </div>

            {/* Action Bar */}
            <div className="flex flex-col items-center bg-gray-900/30 p-8 rounded-[3rem] border border-white/5 shadow-2xl">
               <button 
                 disabled={!isDeckValid || isSimulating || !activeAddress} 
                 onClick={handleStartSimulation} 
                 className={`px-24 py-5 rounded-full font-black text-xl uppercase tracking-[0.2em] transition-all shadow-lg
                   ${isDeckValid && !isSimulating && activeAddress
                     ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20' 
                     : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
               >
                {isSimulating ? 'Initializing...' : (!activeAddress ? 'Connect Wallet First' : 'Start Simulation')}
              </button>
            </div>
          </div>
        )}

        {/* --- FIGHTING VIEW (Via GameEngine) --- */}
        {view === 'fighting' && battleResult && (
          <BattleFlow
            result={battleResult}
            onBack={() => setView('deck-builder')}
            onFinish={handleBattleFinish}
            perspective="p1"
            opponentLabel="CPU"
          />
        )}

      </main>
      <Footer />
    </div>
  );
}


export default function TrainingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-black uppercase tracking-[0.5em] animate-pulse">Loading Simulation...</div>}>
      <TrainingArenaContent />
    </Suspense>
  );
}