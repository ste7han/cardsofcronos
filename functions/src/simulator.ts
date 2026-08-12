// We gebruiken nu de allernieuwste manier om JSON te laden die NodeNext fijn vindt
import allCards from './cards.json' with { type: 'json' };

import { checkCondition } from './conditions.js';
import { getTargets } from './targeting.js';
import { applyAction } from './actions.js';

interface Card {
    card_id: string;
    card_type: string;
    rarity: string;
    base_mc: number;
    current_mc: number;
    tags: string[];
    owner: string;
    destroyed: boolean;
    was_debuffed: boolean;
    parsed_power?: any[];
}

class Player {
    name: string;
    field: Card[];
    constructor(name: string, deck: any[]) {
        this.name = name;
        this.field = deck.map(c => ({
            ...c,
            current_mc: c.card_type === 'Project' ? (c.base_mc || 0) : 0,
            destroyed: false,
            was_debuffed: false
        }));
    }
    total_mc() {
        return this.field
            .filter(c => c.card_type === 'Project' && !c.destroyed)
            .reduce((sum, c) => sum + c.current_mc, 0);
    }
}

export const runMatchSimulation = (deckA: any[], deckB: any[]) => {
    const p1 = new Player("Player 1", deckA);
    const p2 = new Player("Player 2", deckB);
    const logs: string[] = [];

    const phases = ["Start", "Buff", "Debuff", "Support", "Counter", "Final"];

    phases.forEach(phase => {
        logs.push(`--- ${phase} Phase ---`);
        [p1, p2].forEach(currentPlayer => {
            const opponent = currentPlayer === p1 ? p2 : p1;
            currentPlayer.field.forEach(card => {
                if (card.destroyed) return;
                const effects = (card.parsed_power || []).filter((e: any) => e.phase === phase);
                effects.forEach((eff: any) => {
                    const context = { player: currentPlayer, opponent, phase };
                    if (!checkCondition(card, eff, currentPlayer, opponent, context)) return;
                    const targets = getTargets(eff.target_type, currentPlayer, opponent, card, eff, context);
                    if (targets.length > 0) {
                        applyAction(card, eff.action_type, eff.action_value, currentPlayer.name, logs, { ...context, targets });
                    }
                });
            });
        });
    });

    return {
        winner: p1.total_mc() > p2.total_mc() ? p1.name : p2.name,
        finalScores: { p1: p1.total_mc(), p2: p2.total_mc() },
        finalFields: { p1: p1.field, p2: p2.field },
        logs
    };
};