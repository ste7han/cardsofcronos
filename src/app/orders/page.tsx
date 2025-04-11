'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import OrderDetails from '../../components/OrderDetails';
import ChatInterface from '../../components/ChatInterface';
import TransactionLookup from '@/components/TransactionLookup';
import { useAppKitAccount } from '@/lib/appkit';
import { getOrdersByUser } from '@/firebase/firestore';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [transactionOrder, setTransactionOrder] = useState<any | null>(null);
  const router = useRouter();
  
  // Get wallet connection status from AppKit
  const { isConnected, address } = useAppKitAccount();
  
  // Fetch orders when wallet is connected
  useEffect(() => {
    const fetchOrders = async () => {
      if (!isConnected || !address) {
        setLoading(false);
        return;
      }
      
      try {
        const userOrders = await getOrdersByUser(address);
        setOrders(userOrders);
        
        // Select the first order by default if available
        if (userOrders.length > 0 && !selectedOrder) {
          setSelectedOrder(userOrders[0].id);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [isConnected, address, selectedOrder]);
  
  // Handle wallet connection
  const handleConnectWallet = () => {
    // Use the AppKit open function from the parent component
    if (window.appkit) {
      window.appkit.open();
    }
  };
  
  // We no longer redirect non-connected users since they can still use transaction lookup
  // This useEffect has been removed to allow transaction hash lookups without wallet connection
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header 
        onConnectWallet={handleConnectWallet}
        isWalletConnected={isConnected}
        walletAddress={address}
      />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-bold font-['Cinzel'] mb-6 md:mb-8 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-glow)] to-[var(--secondary)]">
          Your Orders
        </h1>
        
        {/* Transaction Hash Lookup Section - Always visible */}
        <TransactionLookup 
          onOrderFound={(order) => {
            setTransactionOrder(order);
            setSelectedOrder(order.id);
          }} 
        />

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
          </div>
        ) : !isConnected && !transactionOrder ? (
          <div className="card p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Wallet Not Connected</h2>
            <p className="mb-6">Please connect your wallet to view your orders or use the transaction hash lookup above.</p>
            <button 
              onClick={handleConnectWallet}
              className="btn-primary py-3 px-6 text-lg font-bold shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50"
            >
              Connect Wallet
            </button>
          </div>
        ) : orders.length === 0 && !transactionOrder ? (
          <div className="card p-6 text-center">
            <h2 className="text-xl font-bold mb-4">No Orders Found</h2>
            <p className="mb-6">You haven't created any cards yet.</p>
            <a 
              href="/#card-form" 
              className="btn-primary py-3 px-6 text-lg font-bold shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50 inline-block"
            >
              Create Your First Card
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Order List - Left Side */}
            <div className="lg:col-span-1 mb-4 lg:mb-0">
              <div className="card p-4">
                <h2 className="text-xl font-bold mb-4 text-[var(--secondary)]">Your Card Requests</h2>
                <div className="space-y-3">
                  {/* Transaction Lookup Result - show at the top if found */}
                  {transactionOrder && (
                    <div 
                      key={transactionOrder.id}
                      onClick={() => setSelectedOrder(transactionOrder.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedOrder === transactionOrder.id 
                          ? 'bg-[var(--primary)]/20 border border-[var(--primary)]' 
                          : 'bg-[#FFD700]/20 hover:bg-[#FFD700]/30 border border-[#FFD700]/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold">{transactionOrder.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          transactionOrder.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                          transactionOrder.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                          transactionOrder.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {transactionOrder.status.charAt(0).toUpperCase() + transactionOrder.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-white/70 mt-1">{transactionOrder.type} - {transactionOrder.rarity}</p>
                      <div className="flex items-center mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-[#FFD700]/20 text-[#FFD700] mr-2">
                          Transaction Lookup
                        </span>
                        <p className="text-xs text-white/50">
                          {new Date(transactionOrder.createdAt?.toDate()).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Connected wallet orders */}
                  {orders.map((order) => (
                    <div 
                      key={order.id}
                      onClick={() => setSelectedOrder(order.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedOrder === order.id 
                          ? 'bg-[var(--primary)]/20 border border-[var(--primary)]' 
                          : 'bg-[var(--cosmic-black)]/30 hover:bg-[var(--cosmic-black)]/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold">{order.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                          order.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                          order.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-white/70 mt-1">{order.type} - {order.rarity}</p>
                      <p className="text-xs text-white/50 mt-1">
                        {new Date(order.createdAt?.toDate()).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Order Details and Chat - Right Side */}
            <div className="lg:col-span-2">
              {selectedOrder && (
                <div className="space-y-6">
                  {/* Order Details */}
                  <OrderDetails orderId={selectedOrder} />
                  
                  {/* Chat Interface */}
                  <ChatInterface 
                    orderId={selectedOrder} 
                    userAddress={address || ''}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}
