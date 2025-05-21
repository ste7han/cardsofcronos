# NFT Minting Form Testing Checklist

## Overview
This document provides a structured testing plan for the NFTMintingForm component after the NFT minting implementation has been updated to work with the new contract.

## Setup
- Environment: Cronos mainnet or testnet
- Required: Wallet with CRO and some REOWN tokens (for discount testing)
- Contract: CardsOfCronos at address 0x2AcC3076Fc002C7B077bbEC8AC9B991C191BF5D3

## 1. Initial Form Rendering Tests

- [ ] Form loads without any errors in console
- [ ] "Mint Your NFT" title is displayed correctly
- [ ] Price section shows the correct price from contract (150 CRO)
- [ ] Supply section shows "Unlimited" for max supply
- [ ] Mint count selector shows "1" as default value
- [ ] Connect wallet message is displayed when no wallet is connected
- [ ] "Connect Wallet to Mint" button is displayed (and disabled) when no wallet is connected

## 2. Wallet Connection Tests

- [ ] Clicking "Connect Wallet" in header successfully opens AppKit connection dialog
- [ ] After connecting wallet, wallet address shows in header
- [ ] After connecting wallet, mint button changes to "Mint 1 NFT"
- [ ] If user owns REOWN tokens, discount information appears
- [ ] Discount percentage matches expected value based on token holdings (1M tokens = 1%, max 30%)

## 3. NFT Price and Supply Data Tests

- [ ] Base price displayed matches contract's mintPrice (150 CRO)
- [ ] Current token ID value matches next token ID from contract
- [ ] Total minted value matches total supply from contract
- [ ] When discount applies, both original and discounted prices are shown
- [ ] Progress bar shows supply is unlimited (full width)

## 4. Quantity Selection Tests

- [ ] Decrement button is disabled when quantity is 1
- [ ] Increment button increases quantity by 1
- [ ] Decrement button decreases quantity by 1
- [ ] Total price updates correctly when quantity changes
- [ ] Mint button text updates to show correct quantity (e.g., "Mint 3 NFTs")

## 5. Minting Functionality Tests

### 5.1 When Sale is Active
- [ ] Mint button is enabled when wallet is connected and sale is active
- [ ] Clicking mint button shows loading state with spinner
- [ ] Transaction is sent to blockchain with correct parameters
- [ ] Correct amount of CRO is included in transaction
- [ ] After successful mint, success message and confetti appear
- [ ] Transaction hash is displayed and links to explorer
- [ ] Supply count updates after successful mint

### 5.2 Error Cases
- [ ] If sale is paused, appropriate error message is shown
- [ ] If user has insufficient funds, appropriate error message is shown
- [ ] If transaction is rejected by user, appropriate error message is shown
- [ ] If transaction fails on chain, appropriate error message is shown

## 6. Discount Functionality Tests

- [ ] Test with wallet having 0 REOWN tokens (should have 0% discount)
- [ ] Test with wallet having 1M REOWN tokens (should have 1% discount)
- [ ] Test with wallet having 10M REOWN tokens (should have 10% discount)
- [ ] Test with wallet having 50M REOWN tokens (should have 30% discount, the maximum)
- [ ] Verify discounted price calculation: discountedPrice = basePrice * (100 - discount) / 100
- [ ] Verify total price calculation: totalPrice = discountedPrice * quantity

## 7. UI/UX Tests

- [ ] Form has proper visual appearance and styling
- [ ] Animation effects work correctly (hover states, fadeIn animations)
- [ ] Form is responsive and displays properly on mobile devices
- [ ] Loading states and error messages are clearly visible
- [ ] Success state with confetti is visually appealing

## 8. Edge Case Tests

- [ ] Test with very large mint quantities (e.g., 50, which is MAX_MINT_PER_TX)
- [ ] Test with network disconnection during transaction
- [ ] Test with switching networks during interaction

## Results

| Test Section | Pass/Fail | Notes |
|-------------|-----------|-------|
| 1. Initial Form Rendering | | |
| 2. Wallet Connection | | |
| 3. NFT Price and Supply Data | | |
| 4. Quantity Selection | | |
| 5. Minting Functionality | | |
| 6. Discount Functionality | | |
| 7. UI/UX | | |
| 8. Edge Cases | | |

## Issues Found

1. 
2. 
3. 

## Recommendations

1. 
2. 
3.