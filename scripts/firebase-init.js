// Firebase initialization script
// This script sets up the required Firestore collections and documents

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc 
} = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDLMTb0x2yfmjh6MRAfRd6G-pLQ1I-fri8",
  authDomain: "cardsofcronos-8219c.firebaseapp.com",
  projectId: "cardsofcronos-8219c",
  storageBucket: "cardsofcronos-8219c.firebasestorage.app",
  messagingSenderId: "826047115111",
  appId: "1:826047115111:web:4313d139cab01d86b009c2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initializeFirestore() {
  console.log('Initializing Firestore...');

  try {
    // Check if burnStats document exists
    const statsDocRef = doc(db, 'stats', 'burnStats');
    const statsDoc = await getDoc(statsDocRef);

    if (!statsDoc.exists()) {
      // Create burnStats document if it doesn't exist
      console.log('Creating burnStats document...');
      await setDoc(statsDocRef, {
        totalBurned: 0,
        totalRequests: 0,
        lastUpdated: new Date()
      });
      console.log('burnStats document created successfully.');
    } else {
      console.log('burnStats document already exists.');
    }

    // Initialize collections and documents as needed

    console.log('Firestore initialization completed successfully.');
  } catch (error) {
    console.error('Error initializing Firestore:', error);
  }
}

// Run the initialization
initializeFirestore()
  .then(() => {
    console.log('Firebase initialization completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Firebase initialization failed:', error);
    process.exit(1);
  });
