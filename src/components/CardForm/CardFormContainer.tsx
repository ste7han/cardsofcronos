'use client';

import React, { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { calculateTokenAmount, burnTokens } from '@/lib/web3';
import { uploadImage, generateImagePath } from '@/firebase/storage';
import { addCardRequest } from '@/firebase/firestore';
import { sendCardRequestEmail } from '@/lib/email';
import CardPreview from '../CardPreview';
import LoadingSpinner from '../LoadingSpinner';
import { CardFormProps, FormInputs } from './types';
import { CardTypeStep, RarityStep, AnimatedStep, CardInfoStep, ReviewStep, SuccessScreen } from './';

const CardFormContainer: React.FC<CardFormProps> = ({ isWalletConnected, onConnectWallet }) => {
  const [step, setStep] = useState<number>(1);
  const [burnAmount, setBurnAmount] = useState<number>(0);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormInputs>({
    defaultValues: {
      cardType: 'Project',
      rarity: 'Epic',
      animated: false,
    },
  });

  const watchCardType = watch('cardType');
  const watchRarity = watch('rarity');
  const watchAnimated = watch('animated');

  // Recalculate burn amount whenever type/rarity/animation changes
  useEffect(() => {
    const amount = calculateTokenAmount(watchCardType, watchRarity, watchAnimated);
    setBurnAmount(amount);
  }, [watchCardType, watchRarity, watchAnimated]);

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

  // Handle image removal
  const handleImageRemove = () => {
    setImage(null);
    setImagePreview(null);
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
        animated: data.animated,
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
    } catch (err) {
      console.error('Error submitting card request:', err);
      setError('An error occurred while submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setTransactionHash(null);
    reset();
    setImage(null);
    setImagePreview(null);
    setStep(1);
  };

  // Navigation handlers
  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  // Success screen
  if (success) {
    return <SuccessScreen transactionHash={transactionHash} onCreateAnother={handleCreateAnother} />;
  }

  // Render the form with the current step
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="arcane-border glass-card p-4 sm:p-6 max-w-3xl mx-auto hexagon-bg relative overflow-hidden my-8 max-h-[80vh] overflow-y-auto"
      style={{ 
        maxHeight: 'calc(100vh - 160px)', /* Adjust based on header/footer height */
        margin: '80px auto'
      }}
    >
      {/* Decorative arcane overlay */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {/* Arcane circles */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full border border-[#9D4EDD]/10 opacity-30"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] rounded-full border border-[#FFD700]/10 opacity-30"></div>

        {/* Arcane symbols at corners */}
        <div className="absolute top-4 left-4 text-[#FFD700] opacity-20 hidden sm:block">✧</div>
        <div className="absolute top-4 right-4 text-[#FFD700] opacity-20 hidden sm:block">⚝</div>
        <div className="absolute bottom-4 left-4 text-[#FFD700] opacity-20 hidden sm:block">⚜</div>
        <div className="absolute bottom-4 right-4 text-[#FFD700] opacity-20 hidden sm:block">✦</div>

        {/* Magical energy lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0,0 L100,100" stroke="rgba(157, 78, 221, 0.1)" strokeWidth="0.2" />
          <path d="M100,0 L0,100" stroke="rgba(157, 78, 221, 0.1)" strokeWidth="0.2" />
        </svg>
      </div>

      {/* Magical book binding */}
      <div className="absolute left-0 top-0 bottom-0 w-2 sm:w-4 bg-gradient-to-r from-[#3A0CA3] to-transparent opacity-50"></div>

      {/* Loading overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <LoadingSpinner size="lg" color="secondary" className="mb-4" />
            <p className="text-white/80 animate-pulse">Processing your request...</p>
          </div>
        </div>
      )}

      {/* Main form content */}
      <div className="relative z-10">
        <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
          {/* Card Preview */}
          <div className="md:order-2 flex items-center justify-center mb-4 md:mb-0">
            <div className="w-full max-w-[180px] sm:max-w-[200px] md:max-w-xs">
              <h3 className="text-center text-lg font-bold font-['Cinzel'] mb-3 text-[var(--secondary)]">
                Card Preview
              </h3>
              <div className="transition-all duration-500 transform">
                <CardPreview
                  name={watch('name') || 'Your Card Name'}
                  description={watch('description') || 'Card description will appear here...'}
                  cardType={watchCardType}
                  rarity={watchRarity}
                  animated={watchAnimated || false}
                  imagePreview={imagePreview}
                  isLoading={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="md:order-1">
            {step === 1 && (
              <CardTypeStep
                register={register}
                watch={watch}
                setValue={setValue}
                errors={errors}
                onNext={handleNext}
              />
            )}

            {step === 2 && (
              <RarityStep
                register={register}
                watch={watch}
                setValue={setValue}
                errors={errors}
                onNext={handleNext}
                onBack={handleBack}
                burnAmount={burnAmount}
              />
            )}

            {step === 3 && (
              <AnimatedStep
                register={register}
                watch={watch}
                setValue={setValue}
                errors={errors}
                onNext={handleNext}
                onBack={handleBack}
                burnAmount={burnAmount}
              />
            )}

            {step === 4 && (
              <CardInfoStep
                register={register}
                watch={watch}
                setValue={setValue}
                errors={errors}
                onNext={handleNext}
                onBack={handleBack}
                image={image}
                imagePreview={imagePreview}
                onImageChange={handleImageChange}
                onImageRemove={handleImageRemove}
              />
            )}

            {step === 5 && (
              <ReviewStep
                register={register}
                watch={watch}
                setValue={setValue}
                errors={errors}
                onBack={handleBack}
                imagePreview={imagePreview}
                burnAmount={burnAmount}
                isWalletConnected={isWalletConnected}
                onConnectWallet={onConnectWallet}
                isSubmitting={isSubmitting}
                error={error}
                onSubmit={handleSubmit(onSubmit)}
              />
            )}
          </div>
        </div>
      </div>
    </form>
  );
};

export default CardFormContainer;
