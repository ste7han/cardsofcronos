'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import AdminHeader from '@/components/AdminHeader';
import Footer from '@/components/Footer';
import AdminBottomNavigation from '@/components/AdminBottomNavigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { isAdmin, signIn, signOut, getCurrentUser, onAuthChange } from '@/firebase/auth';
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { uploadImage, generateImagePath } from '@/firebase/storage';
import { User } from 'firebase/auth';

interface LoginFormData {
  email: string;
  password: string;
}

interface CardFormData {
  name: string;
  type: string;
  rarity: string;
  description: string;
}

interface OrderStatusData {
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminNotes: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState<boolean>(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cards, setCards] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cards' | 'orders'>('cards');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [orderStatusData, setOrderStatusData] = useState<OrderStatusData>({
    status: 'pending',
    adminNotes: '',
  });
  
  // Form state
  const [formData, setFormData] = useState<CardFormData>({
    name: '',
    type: '',
    rarity: 'Epic',
    description: ''
  });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Refs
  const pageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Authentication state
  const [user, setUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user && user.email) {
        try {
          console.log('Checking admin status for email:', user.email);
          const adminStatus = await isAdmin(user.email);
          console.log('Admin status result:', adminStatus);
          setIsAdminUser(adminStatus);
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsAdminUser(false);
        }
      } else {
        setIsAdminUser(false);
      }
      setIsLoading(false);
    };
    
    if (isClient) {
      checkAdminStatus();
    }
  }, [isClient, user]);
  
  // Listen for auth state changes
  useEffect(() => {
    if (!isClient) return;
    
    // Check if user is already logged in
    const currentUser = getCurrentUser();
    setUser(currentUser);
    
    // Set up auth state listener
    const unsubscribe = onAuthChange((authUser) => {
      setUser(authUser);
    });
    
    return () => unsubscribe();
  }, [isClient]);

  // Fetch existing cards
  const fetchCards = async () => {
    try {
      setIsLoading(true);
      const cardsCollection = collection(db, 'cards');
      const cardsQuery = query(cardsCollection, orderBy('name', 'asc'));
      const querySnapshot = await getDocs(cardsQuery);
      
      const fetchedCards = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setCards(fetchedCards);
    } catch (error) {
      console.error('Error fetching cards:', error);
      setError('Failed to load cards. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch all orders
  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const requestsCollection = collection(db, 'requests');
      const q = query(requestsCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const fetchedOrders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setOrders(fetchedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
    if (isClient) {
      if (activeTab === 'cards') {
        fetchCards();
      } else if (activeTab === 'orders') {
        fetchOrders();
      }
    }
  }, [isClient, activeTab]);
  
  // Animation on page load
  useEffect(() => {
    if (!isClient) return;
    setPageLoaded(true);
  }, [isClient]);
  
  // Handle login form input changes
  const handleLoginInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle login form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsAuthLoading(true);
    
    try {
      if (!loginForm.email.trim() || !loginForm.password.trim()) {
        setLoginError('Email and password are required');
        return;
      }
      
      await signIn(loginForm.email, loginForm.password);
      // Auth state listener will update the user state
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Failed to login. Please check your credentials.');
    } finally {
      setIsAuthLoading(false);
    }
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut();
      // Auth state listener will update the user state
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      
      // Validate form
      if (!formData.name.trim()) {
        setError('Card name is required');
        return;
      }
      
      if (!formData.type.trim()) {
        setError('Card type is required');
        return;
      }
      
      if (!formData.description.trim()) {
        setError('Card description is required');
        return;
      }
      
      if (!image) {
        setError('Card image is required');
        return;
      }
      
      // Upload image to Firebase Storage
      const imagePath = generateImagePath(image.name);
      const imageUrl = await uploadImage(image, imagePath);
      
      // Save card to Firestore
      const cardsCollection = collection(db, 'cards');
      await addDoc(cardsCollection, {
        name: formData.name,
        type: formData.type,
        rarity: formData.rarity,
        description: formData.description,
        imageUrl: imageUrl,
        createdAt: new Date(),
        createdBy: user?.email || 'unknown'
      });
      
      // Reset form
      setFormData({
        name: '',
        type: '',
        rarity: 'Epic',
        description: ''
      });
      setImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Show success message
      setSuccess('Card added successfully!');
      
      // Refresh cards list
      fetchCards();
      
    } catch (error) {
      console.error('Error adding card:', error);
      setError('Failed to add card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle card deletion
  const handleDeleteCard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this card? This action cannot be undone.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Delete card from Firestore
      const cardRef = doc(db, 'cards', id);
      await deleteDoc(cardRef);
      
      // Show success message
      setSuccess('Card deleted successfully!');
      
      // Refresh cards list
      fetchCards();
      
    } catch (error) {
      console.error('Error deleting card:', error);
      setError('Failed to delete card. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle order status change
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOrderStatusData({
      ...orderStatusData,
      status: e.target.value as 'pending' | 'approved' | 'rejected' | 'completed'
    });
  };
  
  // Handle admin notes change
  const handleAdminNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setOrderStatusData({
      ...orderStatusData,
      adminNotes: e.target.value
    });
  };
  
  // Handle status update submission
  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOrder) return;
    
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      
      // Update order status in Firestore
      const orderRef = doc(db, 'requests', selectedOrder);
      await updateDoc(orderRef, {
        status: orderStatusData.status,
        adminNotes: orderStatusData.adminNotes,
      });
      
      // Show success message
      setSuccess('Order status updated successfully!');
      
      // Refresh orders list
      fetchOrders();
      
    } catch (error) {
      console.error('Error updating order status:', error);
      setError('Failed to update order status. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Render loading state
  if (isLoading && !isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // Render login form if not logged in or not admin
  if (!isLoading && (!user || !isAdminUser)) {
    return (
      <div className="min-h-screen" ref={pageRef}>
        <AdminHeader />
        
        <main className="relative pt-24 pb-32">
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--cosmic-black)] via-[var(--cosmic-purple)]/10 to-[var(--cosmic-black)] -z-10"></div>
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center py-12">
              <h1 className="text-3xl sm:text-4xl font-bold font-['Cinzel'] mb-6 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-glow)] to-[var(--secondary)]">
                Admin Panel
              </h1>
              
              <div className="modern-card p-8 max-w-md mx-auto">
                {!user ? (
                  <div>
                    <p className="text-white/80 mb-6">Please login to access the admin panel.</p>
                    
                    {loginError && (
                      <div className="bg-red-900/30 border border-red-600 rounded-md p-4 mb-6">
                        <p className="text-red-500">{loginError}</p>
                      </div>
                    )}
                    
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="block text-white/80 mb-2 text-sm">Email</label>
                        <input
                          type="email"
                          name="email"
                          value={loginForm.email}
                          onChange={handleLoginInputChange}
                          className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white"
                          placeholder="Enter your email"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-white/80 mb-2 text-sm">Password</label>
                        <input
                          type="password"
                          name="password"
                          value={loginForm.password}
                          onChange={handleLoginInputChange}
                          className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white"
                          placeholder="Enter your password"
                        />
                      </div>
                      
                      <button
                        type="submit"
                        disabled={isAuthLoading}
                        className={`w-full btn-primary py-3 ${isAuthLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {isAuthLoading ? (
                          <span className="flex items-center justify-center">
                            <LoadingSpinner size="sm" className="mr-2" />
                            Logging in...
                          </span>
                        ) : (
                          'Login'
                        )}
                      </button>
                    </form>
                  </div>
                ) : user?.email ? (
                  <div>
                    <p className="text-white/80 mb-6">You should now have admin access. If you're seeing this message, please refresh the page.</p>
                    <div className="flex flex-col space-y-4">
                      <button
                        onClick={() => window.location.reload()}
                        className="btn-primary py-3 px-6"
                      >
                        Refresh Page
                      </button>
                      <button
                        onClick={handleLogout}
                        className="btn-secondary py-3 px-6"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-white/80 mb-6">You need to be logged in with an email address to access the admin panel.</p>
                    <div className="flex flex-col space-y-4">
                      <button
                        onClick={handleLogout}
                        className="btn-secondary py-3 px-6"
                      >
                        Logout
                      </button>
                      <Link href="/" className="btn-primary py-3 px-6 inline-block">
                        Return to Home
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
        
        <AdminBottomNavigation onLogout={handleLogout} />
        
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen" ref={pageRef}>
      <AdminHeader />
      
      <main className="relative pt-24 pb-32">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--cosmic-black)] via-[var(--cosmic-purple)]/10 to-[var(--cosmic-black)] -z-10"></div>
        
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 transition-all duration-1000 ${isClient && pageLoaded ? 'opacity-100' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold font-['Cinzel'] mb-4 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-glow)] to-[var(--secondary)]">
              ADMIN PANEL
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] mx-auto mb-6"></div>
            <p className="text-lg text-white/80 font-['Spectral'] max-w-3xl mx-auto">
              Manage your cards and orders
            </p>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-md shadow-sm">
              <button
                onClick={() => setActiveTab('cards')}
                className={`px-6 py-3 text-sm font-medium rounded-l-lg focus:z-10 focus:outline-none ${
                  activeTab === 'cards'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--cosmic-black)] text-white/70 hover:bg-[var(--cosmic-black)]/70'
                }`}
              >
                Cards Management
              </button>
              <button
                onClick={() => {
                  setActiveTab('orders');
                  setSelectedOrder(null);
                }}
                className={`px-6 py-3 text-sm font-medium rounded-r-lg focus:z-10 focus:outline-none ${
                  activeTab === 'orders'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--cosmic-black)] text-white/70 hover:bg-[var(--cosmic-black)]/70'
                }`}
              >
                Orders Management
              </button>
            </div>
          </div>
          
          {/* Tab Content */}
          {activeTab === 'cards' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              {/* Add New Card Form */}
              <div className="modern-card p-6">
                <h2 className="text-xl font-bold font-['Cinzel'] mb-6 text-[var(--secondary)]">Add New Card</h2>
              
              {error && (
                <div className="bg-red-900/30 border border-red-600 rounded-md p-4 mb-6">
                  <p className="text-red-500">{error}</p>
                </div>
              )}
              
              {success && (
                <div className="bg-green-900/30 border border-green-600 rounded-md p-4 mb-6">
                  <p className="text-green-500">{success}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-white/80 mb-2 text-sm">Card Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white"
                      placeholder="Enter card name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white/80 mb-2 text-sm">Card Type</label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white"
                    >
                      <option value="">Select Card Type</option>
                      <option value="Project">Project</option>
                      <option value="Founder">Founder</option>
                      <option value="Crofam">Crofam</option>
                      <option value="Influencer">Influencer</option>
                      <option value="Event">Event</option>
                      <option value="Roast">Roast</option>
                      <option value="Special">Special</option>
                      <option value="Parody">Parody</option>
                      <option value="Fusion">Fusion</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-white/80 mb-2 text-sm">Rarity</label>
                    <select
                      name="rarity"
                      value={formData.rarity}
                      onChange={handleInputChange}
                      className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white"
                    >
                      <option value="Common">Common</option>
                      <option value="Rare">Rare</option>
                      <option value="Epic">Epic</option>
                      <option value="Legendary">Legendary</option>
                      <option value="Mythical">Mythical</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-white/80 mb-2 text-sm">Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white min-h-[100px]"
                      placeholder="Enter card description"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white/80 mb-2 text-sm">Card Image</label>
                    <div className="border-2 border-dashed border-[var(--primary)]/30 rounded-md p-4 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="image-upload"
                        ref={fileInputRef}
                      />
                      <label htmlFor="image-upload" className="cursor-pointer block">
                        {imagePreview ? (
                          <div className="relative mx-auto w-48 h-48">
                        {/* @ts-ignore */}
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover rounded-md"
                        />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setImage(null);
                                setImagePreview(null);
                                if (fileInputRef.current) {
                                  fileInputRef.current.value = '';
                                }
                              }}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="py-8">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-[var(--primary)]/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-[var(--primary)] font-medium">Click to upload image</p>
                            <p className="text-sm text-white/50 mt-1">PNG, JPG, GIF up to 5MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                  
                </div>
                
                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full btn-primary py-3 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <LoadingSpinner size="sm" className="mr-2" />
                        Processing...
                      </span>
                    ) : (
                      'Add Card'
                    )}
                  </button>
                </div>
              </form>
              </div>
              
              {/* Existing Cards */}
              <div>
                <div className="modern-card p-6">
                  <h2 className="text-xl font-bold font-['Cinzel'] mb-6 text-[var(--secondary)]">Existing Cards</h2>
                
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : cards.length === 0 ? (
                  <p className="text-center text-white/60 py-8">No cards found. Add your first card!</p>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {cards.map(card => (
                      <div key={card.id} className="flex items-center p-3 bg-[var(--cosmic-black)]/50 rounded-lg">
                        <div className="w-16 h-16 mr-4 rounded overflow-hidden flex-shrink-0">
                          <Image
                            src={card.imageUrl || '/sxfdO1IW9tFd2uK7oUg54HWLfM8.png'}
                            alt={card.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-grow min-w-0">
                          <h3 className="font-bold text-white truncate">{card.name}</h3>
                          <div className="flex items-center text-xs">
                            <span className="text-[var(--secondary)] mr-2">{card.rarity}</span>
                            <span className="text-white/70">{card.type}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          className="ml-2 p-2 text-red-400 hover:text-red-300 transition-colors"
                          title="Delete card"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                  <div className="mt-6 text-center">
                    <Link href="/collection" className="text-[var(--primary)] hover:text-[var(--primary-glow)] text-sm">
                      View Collection Page
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
              {/* Orders List */}
              <div className="modern-card p-6">
                <h2 className="text-xl font-bold font-['Cinzel'] mb-6 text-[var(--secondary)]">Card Orders</h2>
                
                {error && (
                  <div className="bg-red-900/30 border border-red-600 rounded-md p-4 mb-6">
                    <p className="text-red-500">{error}</p>
                  </div>
                )}
                
                {success && (
                  <div className="bg-green-900/30 border border-green-600 rounded-md p-4 mb-6">
                    <p className="text-green-500">{success}</p>
                  </div>
                )}
                
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : orders.length === 0 ? (
                  <p className="text-center text-white/60 py-8">No orders found.</p>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {orders.map(order => (
                      <div 
                        key={order.id} 
                        onClick={() => {
                          setSelectedOrder(order.id);
                          setOrderStatusData({
                            status: order.status || 'pending',
                            adminNotes: order.adminNotes || '',
                          });
                        }}
                        className={`flex flex-col p-4 rounded-lg cursor-pointer transition-all ${
                          selectedOrder === order.id 
                            ? 'bg-[var(--primary)]/20 border border-[var(--primary)]' 
                            : 'bg-[var(--cosmic-black)]/50 hover:bg-[var(--cosmic-black)]/70'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-bold text-white">{order.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                            order.status === 'approved' ? 'bg-blue-500/20 text-blue-300' :
                            order.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                            order.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                            'bg-gray-500/20 text-gray-300'
                          }`}>
                            {order.status === 'pending' ? 'Not Started' :
                             order.status === 'approved' ? 'In Progress' :
                             order.status === 'completed' ? 'Completed' :
                             order.status === 'rejected' ? 'Rejected' : 
                             'Unknown'}
                          </span>
                        </div>
                        <div className="text-sm text-white/70">
                          <p>Type: {order.type}</p>
                          <p>Rarity: {order.rarity}</p>
                        </div>
                        <p className="text-xs text-white/50 mt-2">
                          {order.createdAt && new Date(order.createdAt.toDate()).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Order Details */}
              <div className="lg:col-span-2">
                {selectedOrder ? (
                  <div className="modern-card p-6">
                    <h2 className="text-xl font-bold font-['Cinzel'] mb-6 text-[var(--secondary)]">Order Details</h2>
                    
                    {orders.find(order => order.id === selectedOrder) && (
                      <div className="space-y-6">
                        {/* Order Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Card Information</h3>
                            <div className="space-y-2">
                              <p><span className="text-white/60">Name:</span> {orders.find(o => o.id === selectedOrder)?.name}</p>
                              <p><span className="text-white/60">Type:</span> {orders.find(o => o.id === selectedOrder)?.type}</p>
                              <p><span className="text-white/60">Rarity:</span> {orders.find(o => o.id === selectedOrder)?.rarity}</p>
                              <p><span className="text-white/60">Description:</span> {orders.find(o => o.id === selectedOrder)?.description}</p>
                              <p><span className="text-white/60">Animated:</span> {orders.find(o => o.id === selectedOrder)?.animated ? 'Yes' : 'No'}</p>
                            </div>
                          </div>
                          
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
                            <div className="space-y-2">
                              <p><span className="text-white/60">Email:</span> {orders.find(o => o.id === selectedOrder)?.email}</p>
                              <p><span className="text-white/60">Wallet:</span> {orders.find(o => o.id === selectedOrder)?.userAddress}</p>
                              <p><span className="text-white/60">Burn Amount:</span> {orders.find(o => o.id === selectedOrder)?.burnAmount}</p>
                              <p><span className="text-white/60">Date:</span> {
                                orders.find(o => o.id === selectedOrder)?.createdAt 
                                  ? new Date(orders.find(o => o.id === selectedOrder)?.createdAt.toDate()).toLocaleString() 
                                  : 'Unknown'
                              }</p>
                              <p><span className="text-white/60">Social Link:</span> <a href={orders.find(o => o.id === selectedOrder)?.socialLink} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">{orders.find(o => o.id === selectedOrder)?.socialLink}</a></p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Card Image */}
                        {orders.find(o => o.id === selectedOrder)?.imageUrl && (
                          <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-4">Card Image</h3>
                            <div className="bg-[var(--cosmic-black)]/50 p-4 rounded-lg">
                              <div className="w-48 h-48 mx-auto">
                                <Image
                                  src={orders.find(o => o.id === selectedOrder)?.imageUrl}
                                  alt={orders.find(o => o.id === selectedOrder)?.name}
                                  width={192}
                                  height={192}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Status Update Form */}
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold mb-4">Update Order Status</h3>
                          <form onSubmit={handleUpdateOrderStatus}>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-white/80 mb-2 text-sm">Status</label>
                                <select
                                  value={orderStatusData.status}
                                  onChange={handleStatusChange}
                                  className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white"
                                >
                                  <option value="pending">Not Started</option>
                                  <option value="approved">In Progress</option>
                                  <option value="completed">Completed</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                              </div>
                              
                              <div>
                                <label className="block text-white/80 mb-2 text-sm">Admin Notes</label>
                                <textarea
                                  value={orderStatusData.adminNotes}
                                  onChange={handleAdminNotesChange}
                                  className="w-full bg-[var(--cosmic-black)] border border-[var(--primary)]/30 rounded-md p-2 text-white min-h-[100px]"
                                  placeholder="Add notes about this order"
                                />
                              </div>
                              
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full btn-primary py-3 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                              >
                                {isSubmitting ? (
                                  <span className="flex items-center justify-center">
                                    <LoadingSpinner size="sm" className="mr-2" />
                                    Updating...
                                  </span>
                                ) : (
                                  'Update Status'
                                )}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="modern-card p-6 flex items-center justify-center h-full">
                    <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-[var(--primary)]/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-white/70">Select an order from the list to view details</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      
      <AdminBottomNavigation onLogout={handleLogout} />
      
      <Footer />
    </div>
  );
}
