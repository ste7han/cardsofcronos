# Treasury wallet (DO NOT hardcode PK in code; store in .env)
TREASURY_ADDRESS = "0xe2421a2a5b26A8bDBACa1466e74Dd54c37E8248e"


# Add 'decimals' to the ERC20_ABI
ERC20_ABI = [
    {"constant": True, "inputs":[{"name":"account","type":"address"}],
     "name":"balanceOf","outputs":[{"name":"","type":"uint256"}],
     "stateMutability":"view","type":"function"},
    {"constant": True, "inputs":[], "name":"totalSupply",
     "outputs":[{"name":"","type":"uint256"}],
     "stateMutability":"view","type":"function"},
    {"constant": True, "inputs":[], "name":"decimals",
     "outputs":[{"name":"","type":"uint8"}],
     "stateMutability":"view","type":"function"},
]

RARITY_ORDER = {
    "Common": 1,
    "Rare": 2,
    "Epic": 3,
    "Legendary": 4,
    "Mythical": 5
}

RARITY_ICON = {
    "common": "◻️",
    "rare": "🟨",
    "epic": "🟪",
    "legendary": "🟧",  # closest to salmon/pink
    "mythical": "⬛",
}
