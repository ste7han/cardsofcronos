'use client';

import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, authReady } from '@/firebase/config';

interface Lobby {
  id: string;
  hostAddress: string;
  wager: number;
  status: 'waiting' | 'selecting_decks' | 'battling' | 'finished';
  guestAddress?: string;
  createdAt: any;
}

export const LobbySystem = ({ activeAddress, onJoinGame }: { activeAddress: string, onJoinGame: (lobbyId: string, isHost: boolean, stake: number) => void }) => {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [newWager, setNewWager] = useState(100);
  const [isCreating, setIsCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // 1. Luister live naar open lobbies
  useEffect(() => {
    const q = query(collection(db, "lobbies"), where("status", "==", "waiting"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lobbyList: Lobby[] = [];
      snapshot.forEach((doc) => {
        lobbyList.push({ id: doc.id, ...doc.data() } as Lobby);
      });
      // Sorteer op nieuwste eerst. createdAt is een Firestore Timestamp; vlak na
      // het aanmaken is hij nog null tot de server hem invult.
      const ms = (v: any) => (v && typeof v.toMillis === 'function' ? v.toMillis() : Number(v) || 0);
      setLobbies(lobbyList.sort((a, b) => ms(b.createdAt) - ms(a.createdAt)));
    });
    return () => unsubscribe();
  }, []);

  // 2. Maak een nieuwe lobby aan
  const handleCreateLobby = async () => {
    if (!activeAddress) return;
    setIsCreating(true);
    try {
      const uid = await authReady;
      if (!uid) throw new Error("Could not sign in. Please reload the page.");

      const docRef = await addDoc(collection(db, "lobbies"), {
        hostAddress: activeAddress,
        // De regels binden op uid, niet op adres: een adresveld is maar een
        // string die iedereen kan invullen.
        hostUid: uid,
        wager: newWager,
        status: 'waiting',
        // serverTimestamp i.p.v. Date.now(): een clientklok is forgeerbaar en
        // laat een lobby permanent bovenaan de lijst plakken.
        createdAt: serverTimestamp(),
        hostDeck: null,
        guestDeck: null,
        guestAddress: null,
        guestUid: null
      });
      // Direct doorsturen als host
      onJoinGame(docRef.id, true, newWager);
    } catch (e) {
      console.error("Error creating lobby", e);
      alert("Could not create lobby.");
    } finally {
      setIsCreating(false);
    }
  };

  // 3. Join een bestaande lobby
  // In één transactie, anders halen twee gasten die tegelijk klikken allebei
  // de 'waiting'-check en overschrijft de tweede de eerste.
  const handleJoinLobby = async (lobbyId: string, wager: number) => {
    if (!activeAddress) return;
    setJoiningId(lobbyId);
    try {
      const uid = await authReady;
      if (!uid) throw new Error("Could not sign in. Please reload the page.");
      const lobbyRef = doc(db, "lobbies", lobbyId);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(lobbyRef);
        if (!snap.exists()) throw new Error("This lobby no longer exists.");
        const data = snap.data();
        if (data.status !== 'waiting') throw new Error("Someone else just took this seat.");
        if (data.hostUid === uid) throw new Error("You cannot join your own lobby.");
        tx.update(lobbyRef, { guestAddress: activeAddress, guestUid: uid, status: 'selecting_decks' });
      });

      onJoinGame(lobbyId, false, wager);
    } catch (e: any) {
      console.error("Error joining", e);
      alert(e?.message || "Could not join this lobby.");
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-4xl font-['Cinzel'] text-center text-amber-500 mb-10 font-black uppercase drop-shadow-lg">Active Battle Zones</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* CREATE PANEL */}
        <div className="bg-gray-900/80 border border-amber-500/30 p-6 rounded-3xl h-fit">
           <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-widest">Create Lobby</h3>
           <div className="mb-6">
             <label className="text-[10px] text-gray-500 font-bold uppercase">Match Points</label>
             <div className="flex items-center bg-black/50 border border-white/10 rounded-xl px-4 py-3 mt-1">
                <input
                  type="number"
                  value={newWager}
                  onChange={(e) => setNewWager(Number(e.target.value))}
                  className="bg-transparent text-white font-black w-full outline-none text-lg"
                />
                <span className="text-amber-500 text-xs font-bold">PTS</span>
             </div>
             <p className="text-[10px] text-gray-600 mt-2 leading-snug">
               Friendly match — no tokens are transferred or at risk.
             </p>
           </div>
           <button 
             onClick={handleCreateLobby} 
             disabled={isCreating}
             className="w-full py-4 bg-amber-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all shadow-lg active:scale-95"
           >
             {isCreating ? 'Creating...' : 'Create & Wait'}
           </button>
        </div>

        {/* LOBBY LIST */}
        <div className="md:col-span-2 space-y-4">
           {lobbies.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-[300px] border-2 border-dashed border-white/10 rounded-3xl">
                <p className="text-gray-500 font-bold uppercase tracking-widest">No active lobbies found</p>
                <p className="text-xs text-gray-600 mt-2">Be the first to start a battle!</p>
             </div>
           ) : (
             lobbies.map((lobby) => (
               <div key={lobby.id} className="flex items-center justify-between bg-black/40 border border-white/10 p-6 rounded-2xl hover:border-amber-500/50 transition-colors group">
                  <div>
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Challenger</p>
                     <p className="text-white font-mono text-sm truncate w-32 md:w-auto">{lobby.hostAddress}</p>
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Match Points</p>
                     <p className="text-amber-500 font-black text-xl">{lobby.wager} PTS</p>
                  </div>
                  {lobby.hostAddress === activeAddress ? (
                     <button className="px-6 py-2 rounded-full border border-white/20 text-gray-400 text-xs font-bold uppercase cursor-default opacity-50">Waiting...</button>
                  ) : (
                     <button
                       onClick={() => handleJoinLobby(lobby.id, lobby.wager)}
                       disabled={joiningId !== null}
                       className="px-8 py-3 bg-white text-black font-black uppercase text-xs rounded-full hover:bg-amber-400 hover:scale-105 transition-all shadow-lg disabled:opacity-40 disabled:hover:scale-100"
                     >
                       {joiningId === lobby.id ? 'JOINING…' : 'FIGHT'}
                     </button>
                  )}
               </div>
             ))
           )}
        </div>

      </div>
    </div>
  );
};