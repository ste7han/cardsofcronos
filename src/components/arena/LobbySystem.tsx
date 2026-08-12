'use client';

import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

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

  // 1. Luister live naar open lobbies
  useEffect(() => {
    const q = query(collection(db, "lobbies"), where("status", "==", "waiting"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lobbyList: Lobby[] = [];
      snapshot.forEach((doc) => {
        lobbyList.push({ id: doc.id, ...doc.data() } as Lobby);
      });
      // Sorteer op nieuwste eerst
      setLobbies(lobbyList.sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => unsubscribe();
  }, []);

  // 2. Maak een nieuwe lobby aan
  const handleCreateLobby = async () => {
    if (!activeAddress) return;
    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(db, "lobbies"), {
        hostAddress: activeAddress,
        wager: newWager,
        status: 'waiting',
        createdAt: Date.now(),
        hostDeck: null,
        guestDeck: null
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
  const handleJoinLobby = async (lobbyId: string, wager: number) => {
    if (!activeAddress) return;
    try {
      const lobbyRef = doc(db, "lobbies", lobbyId);
      // Check eerst of hij nog vrij is
      const snap = await getDoc(lobbyRef);
      if (snap.data()?.status !== 'waiting') {
          alert("Lobby is already full or started.");
          return;
      }

      // Update de lobby: Gast is binnen!
      await updateDoc(lobbyRef, {
        guestAddress: activeAddress,
        status: 'selecting_decks'
      });
      
      onJoinGame(lobbyId, false, wager);
    } catch (e) {
      console.error("Error joining", e);
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
             <label className="text-[10px] text-gray-500 font-bold uppercase">Wager Amount</label>
             <div className="flex items-center bg-black/50 border border-white/10 rounded-xl px-4 py-3 mt-1">
                <input 
                  type="number" 
                  value={newWager} 
                  onChange={(e) => setNewWager(Number(e.target.value))}
                  className="bg-transparent text-white font-black w-full outline-none text-lg"
                />
                <span className="text-amber-500 text-xs font-bold">$CROCARD</span>
             </div>
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
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Stakes</p>
                     <p className="text-amber-500 font-black text-xl">{lobby.wager} $CRO</p>
                  </div>
                  {lobby.hostAddress === activeAddress ? (
                     <button className="px-6 py-2 rounded-full border border-white/20 text-gray-400 text-xs font-bold uppercase cursor-default opacity-50">Waiting...</button>
                  ) : (
                     <button 
                       onClick={() => handleJoinLobby(lobby.id, lobby.wager)}
                       className="px-8 py-3 bg-white text-black font-black uppercase text-xs rounded-full hover:bg-amber-400 hover:scale-105 transition-all shadow-lg"
                     >
                       FIGHT
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