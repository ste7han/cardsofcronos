'use client';

import React from 'react';
import { StepProps } from './types';

interface CardInfoStepProps extends StepProps {
  image: File | null;
  imagePreview: string | null;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: () => void;
}

const CardInfoStep: React.FC<CardInfoStepProps> = ({
  register,
  errors,
  onNext,
  onBack,
  image,
  imagePreview,
  onImageChange,
  onImageRemove
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Card Information</h2>

      <div className="space-y-4">
        {/* Name / Project Name */}
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

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            {...register('description', { required: 'Description is required' })}
            className="input-field min-h-[100px]"
            placeholder="Enter a description for your card"
          />
          {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
        </div>

        {/* Social Media Link */}
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

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
            className="input-field"
            placeholder="Enter your email address"
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium mb-1">Image</label>
          <div className="border-2 border-dashed border-[#9D4EDD] rounded-md p-4 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload" className="cursor-pointer block min-h-[120px] flex flex-col items-center justify-center">
              {imagePreview ? (
                <div className="relative mx-auto w-36 h-36 sm:w-40 sm:h-40">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onImageRemove();
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center touch-manipulation"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="py-6 px-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 mx-auto text-[#9D4EDD]/50 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
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
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary w-full sm:flex-1 py-4 text-lg font-bold shadow-lg shadow-[#FFD700]/20 hover:shadow-[#FFD700]/30"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="btn-primary w-full sm:flex-1 py-4 text-lg font-bold shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default CardInfoStep;
