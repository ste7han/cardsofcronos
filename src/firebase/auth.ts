import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { app, db } from './config';

// Initialize Firebase Auth
const auth = getAuth(app);

// Collection references
const adminsCollection = 'admins';

// Check if a user is an admin by email or user ID
export const isAdmin = async (emailOrId: string | null | undefined): Promise<boolean> => {
  if (!emailOrId) return false;
  
  try {
    // First try to check by email
    if (emailOrId.includes('@')) {
      // Normalize the email to lowercase for consistency
      const normalizedEmail = emailOrId.toLowerCase();
      
      // Check if the user is in the admins collection by email
      const adminRef = doc(db, adminsCollection, normalizedEmail);
      const adminDoc = await getDoc(adminRef);
      
      if (adminDoc.exists()) {
        return true;
      }
    }
    
    // If not found by email, check if any admin document has this userId
    const adminsQuery = query(collection(db, adminsCollection), where('userId', '==', emailOrId));
    const querySnapshot = await getDocs(adminsQuery);
    
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Add a new admin
export const addAdmin = async (email: string, addedBy: string): Promise<boolean> => {
  if (!email) return false;
  
  try {
    // First check if the caller is an admin
    const callerIsAdmin = await isAdmin(addedBy);
    if (!callerIsAdmin) {
      throw new Error('Only existing admins can add new admins');
    }
    
    // Normalize the email to lowercase for consistency
    const normalizedEmail = email.toLowerCase();
    
    // Add the user to the admins collection
    const adminRef = doc(db, adminsCollection, normalizedEmail);
    await setDoc(adminRef, {
      email: normalizedEmail,
      addedBy,
      addedAt: serverTimestamp(),
    });
    
    return true;
  } catch (error) {
    console.error('Error adding admin:', error);
    throw error;
  }
};

// Remove an admin
export const removeAdmin = async (email: string, removedBy: string): Promise<boolean> => {
  if (!email) return false;
  
  try {
    // First check if the caller is an admin
    const callerIsAdmin = await isAdmin(removedBy);
    if (!callerIsAdmin) {
      throw new Error('Only existing admins can remove admins');
    }
    
    // Normalize the email to lowercase for consistency
    const normalizedEmail = email.toLowerCase();
    
    // Remove the user from the admins collection
    const adminRef = doc(db, adminsCollection, normalizedEmail);
    await deleteDoc(adminRef);
    
    return true;
  } catch (error) {
    console.error('Error removing admin:', error);
    throw error;
  }
};

// Sign up with email and password
export const signUp = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

// Sign in with email and password
export const signIn = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

// Sign out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Listen to auth state changes
export const onAuthChange = (callback: (user: User | null) => void): () => void => {
  return onAuthStateChanged(auth, callback);
};
