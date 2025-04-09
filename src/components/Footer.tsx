'use client';

import React from 'react';
import Image from 'next/image';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  // Social media links
  const socialLinks = [
    {
      name: 'Twitter',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
        </svg>
      ),
      url: 'https://x.com/CardsCronos'
    }
  ];
  
  return (
    <footer className="py-8 border-t border-[var(--glass-border)] mb-20 md:mb-0 relative overflow-hidden w-full max-w-[100vw]">
      {/* Glowing top border */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"></div>
      
      <div className="container mx-auto px-4 w-full max-w-[100vw] overflow-x-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Left column: Copyright and Joey's credit */}
          <div className="flex flex-col space-y-3 text-white/60 text-sm">
            <div className="flex items-center">
              <p className="font-medium">© {currentYear} Cards of Cronos</p>
            </div>
            
            <div className="flex items-center">
              <p className="flex items-center">
                Designed and made with 
                <span className="text-red-500 mx-1">❤</span> 
                by <a 
                  href="https://kristoken.xyz" 
                  className="text-[var(--secondary)] hover:text-[var(--secondary)]/80 transition-colors font-medium ml-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Joey
                </a>
              </p>
            </div>
          </div>
          
          {/* Center column: Wolfswap grant information */}
          <div className="flex justify-center">
            <div className="modern-glass-card px-6 py-4 text-center relative overflow-hidden group">
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--secondary)]/5 to-[var(--primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Grant information */}
              <p className="text-white/70 mb-2 text-sm">Grant paid by</p>
              <a 
                href="https://wolfswap.app/" 
                className="block text-[var(--secondary)] text-xl font-semibold hover:text-[var(--secondary)]/80 transition-colors mb-2 modern-cosmic-glow"
                target="_blank"
                rel="noopener noreferrer"
              >
                Wolfswap
              </a>
              <p className="text-white/70 text-sm">The #1 Dex aggregrator on Cronos</p>
              
              {/* Decorative elements */}
              <div className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--secondary)]/30 to-transparent"></div>
            </div>
          </div>
          
          {/* Right column: Social links */}
          <div className="flex justify-center md:justify-end space-x-5">
            {socialLinks.map((link, index) => (
              <a 
                key={index}
                href={link.url} 
                className="text-white/60 hover:text-[var(--secondary)] transition-colors p-2 rounded-full hover:bg-white/5"
                aria-label={link.name}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
