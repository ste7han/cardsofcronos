'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  getMessages, 
  sendMessage, 
  subscribeToMessages,
  markMessagesAsRead,
  Message
} from '@/firebase/messaging';
import { isAdmin } from '@/firebase/auth';

interface ChatInterfaceProps {
  orderId: string;
  userAddress: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ orderId, userAddress }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userIsAdmin, setUserIsAdmin] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Check if current user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const adminStatus = await isAdmin(userAddress);
        setUserIsAdmin(adminStatus);
      } catch (err) {
        console.error('Error checking admin status:', err);
      }
    };
    
    if (userAddress) {
      checkAdminStatus();
    }
  }, [userAddress]);
  
  // Load initial messages and subscribe to updates
  useEffect(() => {
    if (!orderId) return;
    
    const loadMessages = async () => {
      try {
        setLoading(true);
        const initialMessages = await getMessages(orderId);
        setMessages(initialMessages);
      } catch (err) {
        console.error('Error loading messages:', err);
        setError('Failed to load messages. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadMessages();
    
    // Subscribe to new messages
    const unsubscribe = subscribeToMessages(orderId, (updatedMessages) => {
      setMessages(updatedMessages);
    });
    
    return () => {
      unsubscribe();
    };
  }, [orderId]);
  
  // Mark messages as read when they are displayed
  useEffect(() => {
    if (messages.length > 0 && orderId && userAddress) {
      const unreadMessages = messages.filter(
        msg => !msg.isRead && msg.senderId !== userAddress
      );
      
      if (unreadMessages.length > 0) {
        markMessagesAsRead(orderId, unreadMessages.map(msg => msg.id));
      }
    }
  }, [messages, orderId, userAddress]);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !orderId || !userAddress) return;
    
    try {
      await sendMessage(orderId, {
        text: newMessage.trim(),
        senderId: userAddress,
        senderName: userIsAdmin ? 'Admin' : 'You',
        isAdmin: userIsAdmin,
      });
      
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp.toDate()).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      return '';
    }
  };
  
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-bold mb-6 text-[var(--secondary)]">
        Chat with {userIsAdmin ? 'Customer' : 'Admin'}
      </h2>
      
      {/* Messages container */}
      <div className="bg-[var(--cosmic-black)]/30 rounded-lg p-4 h-80 overflow-y-auto mb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--primary)]"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/50">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isCurrentUser = message.senderId === userAddress;
              
              return (
                <div 
                  key={message.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-lg p-3 ${
                      isCurrentUser 
                        ? 'bg-[var(--primary)]/30 text-white' 
                        : message.isAdmin 
                          ? 'bg-[var(--secondary)]/20 text-white' 
                          : 'bg-[var(--cosmic-black)]/50 text-white/90'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-bold ${
                        message.isAdmin ? 'text-[var(--secondary)]' : 'text-[var(--primary-glow)]'
                      }`}>
                        {isCurrentUser ? 'You' : message.senderName}
                      </span>
                      <span className="text-xs text-white/50 ml-2">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Message input */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="input-field flex-grow"
        />
        <button 
          type="submit"
          disabled={!newMessage.trim()}
          className="btn-primary px-4 py-2 text-white font-bold shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
      
      {error && (
        <p className="mt-2 text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
};

export default ChatInterface;
