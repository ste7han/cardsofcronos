// Script to add the first admin wallet to the Firestore database
// This is a one-time operation to bootstrap the admin system

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

// Firebase configuration
// Using the same configuration as in firebase-init.js
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

// The wallet address to add as admin
const adminWalletAddress = '0xd3ebf04f76b67e47093bddd8b14f9090f1c80976';

// Function to add the admin
async function addAdmin() {
  try {
    // Normalize the address to lowercase for consistency
    const normalizedAddress = adminWalletAddress.toLowerCase();
    
    // Add the user to the admins collection
    const adminRef = doc(db, 'admins', normalizedAddress);
    await setDoc(adminRef, {
      address: normalizedAddress,
      addedBy: 'bootstrap-script',
      addedAt: serverTimestamp(),
    });
    
    console.log(`Successfully added ${adminWalletAddress} as an admin!`);
    return true;
  } catch (error) {
    console.error('Error adding admin:', error);
    throw error;
  }
}

// Run the function
addAdmin()
  .then(() => {
    console.log('Admin wallet setup completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Admin wallet setup failed:', error);
    process.exit(1);
  });
