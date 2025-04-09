# Cards of Cronos - TODO List

## Critical Fixes

- [x] Add "use client" directive to StarryBackground.tsx
- [x] Add "use client" directive to other components using React hooks:
  - [x] BurnCounter.tsx
  - [x] CardForm.tsx
  - [x] Header.tsx
- [x] Add flame-particle animation to globals.css:
  ```css
  @keyframes flame-particle {
    0% { transform: translateY(0) scale(1); opacity: 0.8; }
    100% { transform: translateY(-20px) scale(0); opacity: 0; }
  }
  ```

## Firebase Setup

- [x] Create a Firebase project (configuration files created)
- [x] Set up Firestore database
  - [x] Create 'requests' collection (initialization script created)
  - [x] Create 'stats' collection with 'burnStats' document (initialization script created)
- [x] Set up Firebase Storage for image uploads (configuration and rules created)
- [x] Set up Firebase security rules (firebase.rules created)
- [x] Create .env.local file with Firebase configuration

## EmailJS Setup

- [x] Create an EmailJS account (setup guide created)
- [x] Create an email service (setup guide created)
- [x] Create an email template for card requests (template provided in guide)
- [x] Add EmailJS configuration to .env.local

## Web3 Integration

- [ ] Test token contract interaction on Cronos testnet
- [x] Ensure wallet connection works properly (integrated with Reown AppKit)
- [ ] Test token burning functionality

## Reown Integration

- [x] Add Reown AppKit dependencies to package.json
- [x] Create AppKit initialization module
- [x] Set up AppKit provider component
- [x] Integrate with wallet connection
- [x] Add support for social logins
- [x] Configure for Cronos network

## UI Enhancements

- [ ] Create a card preview component
- [ ] Add loading states and transitions
- [ ] Add responsive design improvements for mobile
- [ ] Add error handling and user feedback messages

## Testing

- [ ] Test form submission flow
- [ ] Test image upload
- [ ] Test wallet connection
- [ ] Test token burning
- [ ] Test email notifications
- [ ] Test burn counter updates

## Deployment

- [ ] Set up Vercel project
- [ ] Configure environment variables in Vercel
- [ ] Deploy to production
- [ ] Test deployed application

## Future Enhancements

- [ ] Add user authentication
- [ ] Create admin dashboard for managing card requests
- [ ] Implement NFT minting functionality
- [ ] Add analytics tracking
- [ ] Create a gallery of created cards
