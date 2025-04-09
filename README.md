# Cards of Cronos

The ultimate card collection for the Cronos blockchain.

## Overview

Cards of Cronos is a web application that allows users to create custom cards by burning tokens on the Cronos blockchain. Users can select different card types and rarities, provide information and images, and submit their requests.

## Features

- Connect wallet using Reown AppKit (supports multiple wallet providers)
- Burn tokens to create custom cards
- Upload images for card designs
- Track total tokens burned
- Email notifications for card requests

## Technologies Used

- Next.js
- React
- TypeScript
- Tailwind CSS
- Firebase (Firestore and Storage)
- EmailJS
- Ethers.js
- Reown AppKit

## Setup Instructions

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/cardsofcronos.git
   cd cardsofcronos
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env.local` file with the following variables:
   ```
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id

   # EmailJS Configuration
   NEXT_PUBLIC_EMAILJS_USER_ID=your-emailjs-user-id
   NEXT_PUBLIC_EMAILJS_SERVICE_ID=your-emailjs-service-id
   NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your-emailjs-template-id

   # Reown AppKit Configuration
   NEXT_PUBLIC_REOWN_PROJECT_ID=your-reown-project-id
   ```

4. Set up Firebase:
   - Create a Firebase project at https://console.firebase.google.com/
   - Set up Firestore database with 'requests' and 'stats' collections
   - Set up Firebase Storage for image uploads
   - Configure Firebase security rules
   - Add your Firebase configuration to the `.env.local` file

5. Set up EmailJS:
   - Create an EmailJS account at https://www.emailjs.com/
   - Create an email service
   - Create an email template for card requests
   - Add your EmailJS configuration to the `.env.local` file

6. Set up Reown AppKit:
   - Create a project on Reown Cloud at https://cloud.reown.com/
   - Obtain a project ID
   - Add your Reown project ID to the `.env.local` file

7. Run the development server:
   ```
   npm run dev
   ```

8. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Deployment

1. Build the application:
   ```
   npm run build
   ```

2. Deploy to your preferred hosting platform (Vercel, Netlify, etc.)

## License

[MIT](LICENSE)
