'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useForm, SubmitHandler } from 'react-hook-form';
import { calculateTokenAmount, burnTokens } from '@/lib/web3';
import { uploadImage, generateImagePath } from '@/firebase/storage';
import { addCardRequest } from '@/firebase/firestore';
import { sendCardRequestEmail } from '@/lib/email';

interface CardFormProps {
  isWalletConnected: boolean;
  onConnectWallet: () => void;
}

type CardType = 'Project' | 'Roast' | 'Influencer' | 'Special';
type Rarity = 'Epic' | 'Rare' | 'Mythical';

interface FormInputs {
  cardType: CardType;
  rarity: Rarity;
  name: string;
  description: string;
  socialLink: string;
  email: string;
}

const CardForm: React.FC<CardFormProps> = ({ isWalletConnected, onConnectWallet }) => {
  const [step, setStep] = useState<number>(1);
  const [burnAmount, setBurnAmount] = useState<number>(0);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<FormInputs>({
    defaultValues: {
      cardType: 'Project',
      rarity: 'Epic',
    }
  });
  
  const watchCardType = watch('cardType');
  const watchRarity = watch('rarity');
  
  // Calculate burn amount when card type or rarity changes
  useEffect(() => {
    const amount = calculateTokenAmount(
      watchCardType as CardType,
      watchRarity as Rarity
    );
    setBurnAmount(amount);
  }, [watchCardType, watchRarity]);
  
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
  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Check if wallet is connected
      if (!isWalletConnected) {
        setError('Please connect your wallet first');
        return;
      }
      
      // Check if image is uploaded
      if (!image) {
        setError('Please upload an image');
        return;
      }
      
      // 1. Burn tokens
      const burnResult = await burnTokens(burnAmount);
      
      if (!burnResult.success) {
        setError(`Transaction failed: ${burnResult.error}`);
        return;
      }
      
      setTransactionHash(burnResult.transactionHash);
      
      // 2. Upload image to Firebase Storage
      const imagePath = generateImagePath(image.name);
      const imageUrl = await uploadImage(image, imagePath);
      
      // 3. Save request to Firestore
      const requestId = await addCardRequest({
        type: data.cardType,
        rarity: data.rarity,
        name: data.name,
        description: data.description,
        imageUrl: imageUrl,
        socialLink: data.socialLink,
        transactionHash: burnResult.transactionHash,
        burnAmount: burnAmount,
        email: data.email,
        status: 'pending',
        userAddress: window.appkit?.account?.address || '',
      });
      
      // 4. Send email notification
      await sendCardRequestEmail(
        data.cardType,
        data.rarity,
        data.name,
        data.description,
        data.socialLink,
        imageUrl,
        burnResult.transactionHash,
        burnAmount,
        data.email
      );
      
      // Success!
      setSuccess(true);
      reset();
      setImage(null);
      setImagePreview(null);
      setStep(1);
      
    } catch (error) {
      console.error('Error submitting card request:', error);
      setError('An error occurred while submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Render different form steps
  const renderFormStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Select Card Type</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={`card p-4 cursor-pointer transition-all ${watchCardType === 'Project' ? 'border-[#FFD700] ring-2 ring-[#FFD700]' : 'border-[#9D4EDD]'}`}>
                <input
                  type="radio"
                  value="Project"
                  {...register('cardType')}
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <div className="w-full h-32 mb-3 overflow-hidden rounded-lg">
                    <Image 
                      src="/0sXAL430bJImcrBP10AovPMtQU8-1.jpeg" 
                      alt="Project Card" 
                      width={120} 
                      height={120} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold">Project</h3>
                  <p className="text-sm text-gray-300">100,000 🔥</p>
                </div>
              </label>
              
              <label className={`card p-4 cursor-pointer transition-all ${watchCardType === 'Roast' ? 'border-[#FFD700] ring-2 ring-[#FFD700]' : 'border-[#9D4EDD]'}`}>
                <input
                  type="radio"
                  value="Roast"
                  {...register('cardType')}
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <div className="w-full h-32 mb-3 overflow-hidden rounded-lg">
                    <Image 
                      src="/BGOS4PVp4nxOsRhrupybTvvXMw.jpeg" 
                      alt="Roast Card" 
                      width={120} 
                      height={120} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold">Roast</h3>
                  <p className="text-sm text-gray-300">250,000 🔥</p>
                </div>
              </label>
              
              <label className={`card p-4 cursor-pointer transition-all ${watchCardType === 'Influencer' ? 'border-[#FFD700] ring-2 ring-[#FFD700]' : 'border-[#9D4EDD]'}`}>
                <input
                  type="radio"
                  value="Influencer"
                  {...register('cardType')}
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <div className="w-full h-32 mb-3 overflow-hidden rounded-lg">
                    <Image 
                      src="/ixf80jUKzkQNqTo81qXYh7m4XE.jpeg" 
                      alt="Influencer Card" 
                      width={120} 
                      height={120} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold">Influencer</h3>
                  <p className="text-sm text-gray-300">100,000 🔥</p>
                </div>
              </label>
              
              <label className={`card p-4 cursor-pointer transition-all ${watchCardType === 'Special' ? 'border-[#FFD700] ring-2 ring-[#FFD700]' : 'border-[#9D4EDD]'}`}>
                <input
                  type="radio"
                  value="Special"
                  {...register('cardType')}
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <div className="w-full h-32 mb-3 overflow-hidden rounded-lg">
                    <Image 
                      src="/uCrEh7EWdfVpkejS6m0onxU0s0.png" 
                      alt="Special Card" 
                      width={120} 
                      height={120} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold">Special</h3>
                  <p className="text-sm text-gray-300">500,000 🔥</p>
                </div>
              </label>
            </div>
            
            <div className="mt-8">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-primary w-full py-4 text-lg font-bold shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50"
              >
                Next
              </button>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Select Rarity</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <label className={`card p-4 cursor-pointer transition-all ${watchRarity === 'Epic' ? 'border-[#FFD700] ring-2 ring-[#FFD700]' : 'border-[#9D4EDD]'}`}>
                <input
                  type="radio"
                  value="Epic"
                  {...register('rarity')}
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <div className="w-full h-32 mb-3 overflow-hidden rounded-lg">
                    <Image 
                      src="/E8okCphkavy5wOswGJQ1oyw07iI.png" 
                      alt="Epic Rarity" 
                      width={120} 
                      height={120} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold">Epic</h3>
                  <p className="text-sm text-gray-300">50,000 🔥</p>
                </div>
              </label>
              
              <label className={`card p-4 cursor-pointer transition-all ${watchRarity === 'Rare' ? 'border-[#FFD700] ring-2 ring-[#FFD700]' : 'border-[#9D4EDD]'}`}>
                <input
                  type="radio"
                  value="Rare"
                  {...register('rarity')}
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <div className="w-full h-32 mb-3 overflow-hidden rounded-lg">
                    <Image 
                      src="/sP5BVR81GV5Mhr5SODg8zLpC74.png" 
                      alt="Rare Rarity" 
                      width={120} 
                      height={120} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold">Rare</h3>
                  <p className="text-sm text-gray-300">20,000 🔥</p>
                </div>
              </label>
              
              <label className={`card p-4 cursor-pointer transition-all ${watchRarity === 'Mythical' ? 'border-[#FFD700] ring-2 ring-[#FFD700]' : 'border-[#9D4EDD]'}`}>
                <input
                  type="radio"
                  value="Mythical"
                  {...register('rarity')}
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <div className="w-full h-32 mb-3 overflow-hidden rounded-lg">
                    <Image 
                      src="/USrOQ3pjPgMuvG2eKO0VObUqw.png" 
                      alt="Mythical Rarity" 
                      width={120} 
                      height={120} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold">Mythical</h3>
                  <p className="text-sm text-gray-300">250,000 🔥</p>
                </div>
              </label>
            </div>
            
            <div className="card p-4 text-center">
              <h3 className="text-lg font-bold">Total Burn Amount</h3>
              <p className="text-2xl font-bold text-[#FFD700]">{burnAmount.toLocaleString()} 🔥</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary w-full sm:flex-1 py-4 text-lg font-bold order-2 sm:order-1 shadow-lg shadow-[#FFD700]/20 hover:shadow-[#FFD700]/30"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-primary w-full sm:flex-1 py-4 text-lg font-bold order-1 sm:order-2 shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50"
              >
                Next
              </button>
            </div>
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Card Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name / Project Name</label>
                <input
                  type="text"
                  {...register('name', { required: 'Name is required' })}
                  className="input-field"
                  placeholder="Enter name or project name"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  {...register('description', { required: 'Description is required' })}
                  className="input-field min-h-[100px]"
                  placeholder="Enter a description for your card"
                />
                {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Social Media Link</label>
                <input
                  type="text"
                  {...register('socialLink', { required: 'Social media link is required' })}
                  className="input-field"
                  placeholder="Enter your social media link"
                />
                {errors.socialLink && <p className="text-red-500 text-sm mt-1">{errors.socialLink.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  className="input-field"
                  placeholder="Enter your email address"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Image</label>
                <div className="border-2 border-dashed border-[#9D4EDD] rounded-md p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer block min-h-[120px] flex flex-col items-center justify-center">
                    {imagePreview ? (
                      <div className="relative mx-auto w-48 h-48 sm:w-40 sm:h-40">
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
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="py-8 px-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-[#9D4EDD]/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-[#9D4EDD] font-medium">Tap to upload image</p>
                        <p className="text-sm text-gray-400 mt-1">PNG, JPG, GIF up to 5MB</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-secondary w-full sm:flex-1 py-4 text-lg font-bold order-2 sm:order-1 shadow-lg shadow-[#FFD700]/20 hover:shadow-[#FFD700]/30"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="btn-primary w-full sm:flex-1 py-4 text-lg font-bold order-1 sm:order-2 shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50"
              >
                Next
              </button>
            </div>
          </div>
        );
        
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Review & Submit</h2>
            
            <div className="card p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
                  <h3 className="text-base font-bold text-[var(--secondary)]">Card Type</h3>
                  <p className="text-white/90">{watchCardType}</p>
                </div>
                <div className="p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
                  <h3 className="text-base font-bold text-[var(--secondary)]">Rarity</h3>
                  <p className="text-white/90">{watchRarity}</p>
                </div>
                <div className="p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
                  <h3 className="text-base font-bold text-[var(--secondary)]">Name</h3>
                  <p className="text-white/90">{watch('name')}</p>
                </div>
                <div className="p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
                  <h3 className="text-base font-bold text-[var(--secondary)]">Email</h3>
                  <p className="text-white/90 break-all">{watch('email')}</p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
                <h3 className="text-base font-bold text-[var(--secondary)]">Description</h3>
                <p className="text-white/90">{watch('description')}</p>
              </div>
              
              <div className="mt-4 p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
                <h3 className="text-base font-bold text-[var(--secondary)]">Social Link</h3>
                <p className="text-white/90 break-all">{watch('socialLink')}</p>
              </div>
              
              {imagePreview && (
                <div className="mt-4 p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
                  <h3 className="text-base font-bold text-[var(--secondary)]">Image</h3>
                  <div className="w-40 h-40 sm:w-32 sm:h-32 mt-2 mx-auto">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-md"
                    />
                  </div>
                </div>
              )}
              
              <div className="mt-6 p-4 bg-[#0A0A23] border border-[#9D4EDD] rounded-md">
                <h3 className="text-lg font-bold text-center">Total Burn Amount</h3>
                <p className="text-2xl font-bold text-[#FFD700] text-center">{burnAmount.toLocaleString()} 🔥</p>
              </div>
            </div>
            
            {!isWalletConnected && (
              <div className="bg-yellow-900/30 border border-yellow-600 rounded-md p-4 text-center">
                <p className="text-yellow-500 mb-2">You need to connect your wallet to proceed</p>
                <button
                  type="button"
                  onClick={onConnectWallet}
                  className="btn-primary py-3 px-6 text-lg font-bold shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50"
                >
                  Connect Wallet
                </button>
              </div>
            )}
            
            {error && (
              <div className="bg-red-900/30 border border-red-600 rounded-md p-4">
                <p className="text-red-500">{error}</p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-secondary w-full sm:flex-1 py-4 text-lg font-bold order-2 sm:order-1 shadow-lg shadow-[#FFD700]/20 hover:shadow-[#FFD700]/30"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isWalletConnected}
                className={`btn-primary w-full sm:flex-1 py-4 text-lg font-bold order-1 sm:order-2 shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50 ${(isSubmitting || !isWalletConnected) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? 'Processing...' : 'Burn Tokens & Submit'}
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  // Success message
  if (success) {
    return (
      <div className="card p-6 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-4">Request Submitted Successfully!</h2>
        <p className="mb-4">Your card request has been submitted and tokens have been burned.</p>
        
        {transactionHash && (
          <div className="mb-6">
            <p className="text-sm mb-2">Transaction Hash:</p>
            <a
              href={`https://cronoscan.com/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9D4EDD] break-all hover:underline"
            >
              {transactionHash}
            </a>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={() => {
              setSuccess(false);
              setTransactionHash(null);
            }}
            className="btn-primary py-4 px-8 text-lg font-bold shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50"
          >
            Create Another Card
          </button>
          
          <Link
            href="/orders"
            className="btn-secondary py-4 px-8 text-lg font-bold shadow-lg shadow-[#FFD700]/20 hover:shadow-[#FFD700]/30"
          >
            View Your Orders
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="arcane-border glass-card p-6 max-w-3xl mx-auto hexagon-bg relative">
      {/* Decorative arcane elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {/* Arcane circles */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full border border-[#9D4EDD]/10 opacity-30"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] rounded-full border border-[#FFD700]/10 opacity-30"></div>
        
        {/* Arcane symbols at corners */}
        <div className="absolute top-4 left-4 text-[#FFD700] opacity-20">✧</div>
        <div className="absolute top-4 right-4 text-[#FFD700] opacity-20">⚝</div>
        <div className="absolute bottom-4 left-4 text-[#FFD700] opacity-20">⚜</div>
        <div className="absolute bottom-4 right-4 text-[#FFD700] opacity-20">✦</div>
        
        {/* Magical energy lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path 
            d="M0,0 L100,100" 
            stroke="rgba(157, 78, 221, 0.1)" 
            strokeWidth="0.2"
          />
          <path 
            d="M100,0 L0,100" 
            stroke="rgba(157, 78, 221, 0.1)" 
            strokeWidth="0.2"
          />
        </svg>
      </div>
      
      {/* Magical book binding */}
      <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#3A0CA3] to-transparent opacity-50"></div>
      
      {/* Form content with magical styling */}
      <div className="relative z-10">
        {renderFormStep()}
      </div>
    </form>
  );
};

export default CardForm;
