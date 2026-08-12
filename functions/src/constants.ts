export const TREASURY_ADDRESS = "0xe2421a2a5b26A8bDBACa1466e74Dd54c37E8248e";

export const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

export const RARITY_ORDER: Record<string, number> = {
    "Common": 1,
    "Rare": 2,
    "Epic": 3,
    "Legendary": 4,
    "Mythical": 5
};

export const RARITY_ICON: Record<string, string> = {
    "common": "◻️",
    "rare": "🟨",
    "epic": "🟪",
    "legendary": "🟧",
    "mythical": "⬛",
};