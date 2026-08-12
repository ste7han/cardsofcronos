export const applyAction = (
    card: any,
    actionType: string,
    actionValue: any,
    playerName: string,
    logs: string[],
    context: any
) => {
    const targets = context.targets || [];
    const value = Number(actionValue) || 0;

    targets.forEach((t: any) => {
        if (actionType === "subtract_mc") {
            const old = t.current_mc;
            t.current_mc = Math.max(0, t.current_mc - value);
            t.was_debuffed = true;
            logs.push(`💥 ${card.card_id} reduced ${t.card_id}: ${old.toFixed(1)} -> ${t.current_mc.toFixed(1)}`);
        } else if (actionType === "add_mc") {
            const old = t.current_mc;
            t.current_mc += value;
            logs.push(`✨ ${card.card_id} buffed ${t.card_id}: ${old.toFixed(1)} -> ${t.current_mc.toFixed(1)}`);
        } else if (actionType === "destroy") {
            t.destroyed = true;
            logs.push(`💀 ${card.card_id} DESTROYED ${t.card_id}!`);
        }
    });
};