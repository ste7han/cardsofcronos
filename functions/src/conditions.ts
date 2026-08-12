import { RARITY_ORDER } from './constants.js';

export const checkCondition = (
    card: any, 
    effect: any, 
    player: any, 
    opponent: any, 
    context: any
): boolean => {
    const conditionType = (effect.condition_type || "").trim();
    const conditionValue = effect.condition_value;

    // console.log(`[DEBUG] Checking: ${card.card_id} -> ${conditionType}`);

    if (!conditionType || conditionType === "none" || conditionType === "always" || conditionType === "immediate") {
        return true;
    }

    switch (conditionType) {
        case "has_tag":
            return (card.tags || []).includes(conditionValue);

        case "mc_less_than":
            return card.current_mc < Number(conditionValue);

        case "mc_less_than_equal":
            return card.current_mc <= Number(conditionValue);

        case "mc_gte":
            return card.current_mc >= Number(conditionValue);

        case "mc_greater_than":
            return card.current_mc > Number(conditionValue);

        case "enemy_has_projects":
            return opponent.field.some((c: any) => c.card_type === 'Project' && !c.destroyed);

        case "enemy_projects_count":
            const count = opponent.field.filter((c: any) => c.card_type === 'Project' && !c.destroyed).length;
            // Eenvoudige versie van je regex check:
            if (conditionValue.includes(">=")) return count >= parseInt(conditionValue.replace(">=", ""));
            if (conditionValue.includes("<=")) return count <= parseInt(conditionValue.replace("<=", ""));
            if (conditionValue.includes(">")) return count > parseInt(conditionValue.replace(">", ""));
            if (conditionValue.includes("<")) return count < parseInt(conditionValue.replace("<", ""));
            return count === parseInt(conditionValue);

        case "rarity":
            return player.field.some((c: any) => 
                c.card_type === 'Project' && 
                !c.destroyed && 
                c.rarity?.toLowerCase() === conditionValue.toLowerCase()
            );

        case "total_team_mc_lt_opponent":
            return player.total_mc() < opponent.total_mc();

        case "is_lowest":
            const projects = player.field.filter((c: any) => c.card_type === 'Project' && !c.destroyed);
            if (projects.length === 0) return false;
            const minMC = Math.min(...projects.map((p: any) => p.current_mc));
            return card.current_mc === minMC;

        case "survived":
            return !card.destroyed;

        case "on_destroyed":
            return card.destroyed === true;

        case "total_mc_ends_in":
            const total = Math.floor(player.total_mc()).toString();
            return total.endsWith(conditionValue.toString());

        case "any_mc_ends_in":
            const digit = conditionValue.toString();
            return [...player.field, ...opponent.field].some((c: any) => 
                c.card_type === 'Project' && 
                !c.destroyed && 
                Math.floor(c.current_mc).toString().endsWith(digit)
            );

        case "first_debuff_targeting_project":
            if (player.first_debuff_blocked) return false;
            return !!player.first_debuff_data;

        // Voeg hier gaandeweg de rest van je 50+ condities toe
        default:
            console.warn(`Condition type not yet implemented: ${conditionType}`);
            return true; // We laten hem voor nu door als we het niet weten
    }
};