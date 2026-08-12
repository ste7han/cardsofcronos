import { RARITY_ORDER } from './constants.js';

// --- Helpers voor Randomness (omdat JS geen random.choice heeft) ---
const randomChoice = <T>(arr: T[]): T | null => {
    return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
};

const randomSample = <T>(arr: T[], n: number): T[] => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
};

export const getTargets = (
    targetType: string,
    player: any,
    opponent: any,
    sourceCard: any,
    effect: any = {},
    context: any = {}
): any[] => {
    if (!targetType) return [];

    const tt = targetType.toLowerCase().trim();
    const field = player.field || [];
    const opponentField = opponent.field || [];

    // --- Ondersteuning voor gecombineerde selectors (bijv: "self+random_enemy") ---
    if (tt.includes('+')) {
        let combined: any[] = [];
        tt.split('+').forEach(part => {
            combined = [...combined, ...getTargets(part.trim(), player, opponent, sourceCard, effect, context)];
        });
        return combined;
    }

    switch (tt) {
        // --- Basis Selectors ---
        case "self":
        case "source":
        case "this":
            return [sourceCard];

        case "ally_field":
        case "self_field":
        case "all_allies":
            return field;

        case "enemy_field":
        case "opponent_field":
        case "all_enemies":
            return opponentField;

        case "random_ally":
            const rAlly = randomChoice(field);
            return rAlly ? [rAlly] : [];

        case "random_enemy":
            const rEnemy = randomChoice(opponentField);
            return rEnemy ? [rEnemy] : [];

        // --- Project Selectors (De kern van de game) ---
        case "random_enemy_project":
            const enemyProjects = opponentField.filter((c: any) => c.card_type === 'Project' && !c.destroyed);
            const target = randomChoice(enemyProjects);
            return target ? [target] : [];

        case "all_enemy_projects":
            return opponentField.filter((c: any) => c.card_type === 'Project' && !c.destroyed);

        case "random_friendly_project":
            const friendlyProjects = field.filter((c: any) => c.card_type === 'Project' && !c.destroyed);
            const fTarget = randomChoice(friendlyProjects);
            return fTarget ? [fTarget] : [];

        case "all_friendly_projects":
        case "all_own_projects":
            return field.filter((c: any) => c.card_type === 'Project' && !c.destroyed);

        case "lowest_project":
        case "lowest":
        case "lowest_own":
            const ownProjects = field.filter((c: any) => c.card_type === 'Project' && !c.destroyed);
            if (ownProjects.length === 0) return [];
            const minMC = Math.min(...ownProjects.map((p: any) => p.current_mc));
            return [ownProjects.find((p: any) => p.current_mc === minMC)];

        case "highest_friendly_project":
            const hProjects = field.filter((c: any) => c.card_type === 'Project' && !c.destroyed);
            if (hProjects.length === 0) return [];
            const maxMC = Math.max(...hProjects.map((p: any) => p.current_mc));
            return [hProjects.find((p: any) => p.current_mc === maxMC)];

        case "enemy_two":
            const eValid = opponentField.filter((c: any) => c.card_type === 'Project' && !c.destroyed);
            return randomSample(eValid, 2);

        // --- Tag-based Selectors ---
        case "all_meme_tagged":
            return [...field, ...opponentField].filter((c: any) => 
                c.card_type === 'Project' && !c.destroyed && (c.tags || []).includes("Meme")
            );

        case "all_nova":
            return [...field, ...opponentField].filter((c: any) => 
                (c.tags || []).includes("Nova") && !c.destroyed
            );

        case "random_surviving_dak":
            const dakPool = [...field, ...opponentField].filter((c: any) => 
                c.card_type === 'Project' && (c.tags || []).includes("DAK") && !c.destroyed && c.card_id !== sourceCard.card_id
            );
            const dakTarget = randomChoice(dakPool);
            return dakTarget ? [dakTarget] : [];

        // --- Rarity based ---
        case "random_common_own":
            const ownCommons = field.filter((c: any) => c.card_type === 'Project' && !c.destroyed && c.rarity?.toLowerCase() === 'common');
            const rcTarget = randomChoice(ownCommons);
            return rcTarget ? [rcTarget] : [];

        case "matching_enemy_project":
            const desiredRarity = effect.condition_value;
            const matches = opponentField.filter((c: any) => 
                c.card_type === 'Project' && !c.destroyed && c.rarity === desiredRarity
            );
            const mTarget = randomChoice(matches);
            return mTarget ? [mTarget] : [];

        // --- Complex Mixes ---
        case "lowest_friendly_and_enemy":
            const fP = field.filter((c: any) => c.card_type === 'Project' && !c.destroyed);
            const eP = opponentField.filter((c: any) => c.card_type === 'Project' && !c.destroyed);
            const res = [];
            if (fP.length > 0) {
                const lowF = Math.min(...fP.map((p: any) => p.current_mc));
                res.push(fP.find((p: any) => p.current_mc === lowF));
            }
            if (eP.length > 0) {
                const lowE = Math.min(...eP.map((p: any) => p.current_mc));
                res.push(eP.find((p: any) => p.current_mc === lowE));
            }
            return res;

        case "own_lowest_and_highest":
            const pool = field.filter((c: any) => c.card_type === 'Project' && !c.destroyed);
            if (pool.length < 2) return [];
            const sorted = [...pool].sort((a, b) => a.current_mc - b.current_mc);
            return [sorted[0], sorted[sorted.length - 1]];

        default:
            // Als we een selector hebben als "random_common_tagged=Lunar"
            if (tt.startsWith("random_common_tagged=")) {
                const tag = tt.split('=')[1];
                const tagged = field.filter((c: any) => (c.tags || []).includes(tag) && c.rarity?.toLowerCase() === 'common' && !c.destroyed);
                const tTarget = randomChoice(tagged);
                return tTarget ? [tTarget] : [];
            }

            console.warn(`Target type not yet implemented: ${tt}`);
            return [];
    }
};