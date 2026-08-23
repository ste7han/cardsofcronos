// Script to add a specific user as admin to the Firestore database
// This is a one-time operation to bootstrap the admin system

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = require('firebase/firestore');
const { getAuth, getUser } = require('firebase/auth');

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
const auth = getAuth(app);

// The admin user ID to add
const adminUserId = 'moUbpO7ou7ZTUtKuN7xpp2S9Xgl1';

// Function to add the admin
async function addAdmin() {
  try {
    // Get the user from Firebase Auth
    let userEmail = null;
    
    try {
      // Try to get the user's email from Firestore users collection
      const userRef = doc(db, 'users', adminUserId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists() && userDoc.data().email) {
        userEmail = userDoc.data().email;
        console.log(`Found user with email: ${userEmail}`);
      } else {
        // If we can't find the email, use the user ID as the admin ID
        userEmail = adminUserId;
        console.log(`Using user ID as admin ID: ${adminUserId}`);
      }
    } catch (error) {
      console.error('Error getting user:', error);
      // If we can't find the email, use the user ID as the admin ID
      userEmail = adminUserId;
    }
    
    // Add the user to the admins collection
    const adminRef = doc(db, 'admins', userEmail);
    await setDoc(adminRef, {
      userId: adminUserId,
      email: userEmail,
      addedBy: 'bootstrap-script',
      addedAt: serverTimestamp(),
    });
    
    console.log(`Successfully added user ${adminUserId} as an admin!`);
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
