'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getOrderById } from '@/firebase/firestore';

interface OrderDetailsProps {
  orderId: string;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ orderId }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) return;
      
      try {
        setLoading(true);
        const orderData = await getOrderById(orderId);
        setOrder(orderData);
      } catch (err) {
        console.error('Error fetching order details:', err);
        setError('Failed to load order details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrderDetails();
  }, [orderId]);
  
  if (loading) {
    return (
      <div className="card p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }
  
  if (error || !order) {
    return (
      <div className="card p-6 text-center">
        <h2 className="text-xl font-bold mb-4 text-red-400">Error</h2>
        <p>{error || 'Order not found'}</p>
      </div>
    );
  }
  
  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp.toDate()).toLocaleString();
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  return (
    <div className="card p-6">
      <h2 className="text-2xl font-bold mb-6 text-[var(--secondary)]">Order Details</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column - Image and basic info */}
        <div>
          {order.imageUrl ? (
            <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden">
              <Image 
                src={order.imageUrl} 
                alt={order.name} 
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-full aspect-square mb-4 rounded-lg bg-[var(--cosmic-black)]/50 flex items-center justify-center">
              <p className="text-white/50">No image available</p>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-white/70">Status:</span>
              <span className={`px-2 py-1 rounded-full text-xs ${
                order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                order.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                order.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Type:</span>
              <span>{order.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Rarity:</span>
              <span>{order.rarity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Burn Amount:</span>
              <span>{order.burnAmount?.toLocaleString()} 🔥</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Created:</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
          </div>
        </div>
        
        {/* Right column - Details */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--primary)]">{order.name}</h3>
            <p className="mt-2 text-white/80 whitespace-pre-wrap">{order.description}</p>
          </div>
          
          <div>
            <h4 className="font-bold text-white/70">Social Link</h4>
            <a 
              href={order.socialLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline break-all"
            >
              {order.socialLink}
            </a>
          </div>
          
          <div>
            <h4 className="font-bold text-white/70">Contact Email</h4>
            <p className="break-all">{order.email}</p>
          </div>
          
          {order.transactionHash && (
            <div>
              <h4 className="font-bold text-white/70">Transaction</h4>
              <a 
                href={`https://cronoscan.com/tx/${order.transactionHash}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:underline break-all"
              >
                {order.transactionHash}
              </a>
            </div>
          )}
          
          {order.adminNotes && (
            <div className="mt-6 p-4 bg-[var(--cosmic-black)]/30 rounded-lg">
              <h4 className="font-bold text-[var(--secondary)]">Admin Notes</h4>
              <p className="mt-2 text-white/80 whitespace-pre-wrap">{order.adminNotes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
