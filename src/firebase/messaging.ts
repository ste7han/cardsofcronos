import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';

// Collection references
const messagesCollection = (orderId: string) => 
  collection(db, 'requests', orderId, 'messages');

// Types
interface MessageInput {
  text: string;
  senderId: string;
  senderName: string;
  isAdmin: boolean;
}

// Get all messages for an order
export const getMessages = async (orderId: string): Promise<Message[]> => {
  try {
    const q = query(
      messagesCollection(orderId),
      orderBy('timestamp', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Message[];
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
};

// Send a new message
export const sendMessage = async (orderId: string, message: MessageInput) => {
  try {
    const docRef = await addDoc(messagesCollection(orderId), {
      ...message,
      timestamp: serverTimestamp(),
      isRead: false,
    });
    
    // Update the order's lastMessageAt field
    const orderRef = doc(db, 'requests', orderId);
    await updateDoc(orderRef, {
      lastMessageAt: serverTimestamp(),
      hasUnreadMessages: true,
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Message type definition
export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
  isAdmin: boolean;
  isRead: boolean;
}

// Subscribe to messages for an order
export const subscribeToMessages = (orderId: string, callback: (messages: Message[]) => void) => {
  const q = query(
    messagesCollection(orderId),
    orderBy('timestamp', 'asc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const messages = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Message[];
    callback(messages);
  });
};

// Mark messages as read
export const markMessagesAsRead = async (orderId: string, messageIds: string[]) => {
  try {
    const batch = writeBatch(db);
    
    messageIds.forEach(messageId => {
      const messageRef = doc(db, 'requests', orderId, 'messages', messageId);
      batch.update(messageRef, { isRead: true });
    });
    
    // Update the order's hasUnreadMessages field
    const orderRef = doc(db, 'requests', orderId);
    batch.update(orderRef, { hasUnreadMessages: false });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Get unread message count for a user
export const getUnreadMessageCount = async (userAddress: string) => {
  try {
    // Get all orders for the user
    const ordersQuery = query(
      collection(db, 'requests'),
      where('userAddress', '==', userAddress),
      where('hasUnreadMessages', '==', true)
    );
    
    const ordersSnapshot = await getDocs(ordersQuery);
    
    let totalUnread = 0;
    
    // For each order with unread messages, count them
    for (const orderDoc of ordersSnapshot.docs) {
      const messagesQuery = query(
        collection(db, 'requests', orderDoc.id, 'messages'),
        where('senderId', '!=', userAddress),
        where('isRead', '==', false)
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      totalUnread += messagesSnapshot.size;
    }
    
    return totalUnread;
  } catch (error) {
    console.error('Error getting unread message count:', error);
    throw error;
  }
};

// Get unread message count for admin
export const getAdminUnreadMessageCount = async () => {
  try {
    // Get all orders with unread messages
    const ordersQuery = query(
      collection(db, 'requests'),
      where('hasUnreadMessages', '==', true)
    );
    
    const ordersSnapshot = await getDocs(ordersQuery);
    
    let totalUnread = 0;
    
    // For each order with unread messages, count them if they're from users (not admin)
    for (const orderDoc of ordersSnapshot.docs) {
      const messagesQuery = query(
        collection(db, 'requests', orderDoc.id, 'messages'),
        where('isAdmin', '==', false),
        where('isRead', '==', false)
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      totalUnread += messagesSnapshot.size;
    }
    
    return totalUnread;
  } catch (error) {
    console.error('Error getting admin unread message count:', error);
    throw error;
  }
};
