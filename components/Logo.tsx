import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export const Logo: React.FC<LogoProps> = ({ size = 24, className = '', strokeWidth = 2 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={strokeWidth} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {/* Left Piece of the bill */}
      <path d="M2.5 7C2.5 5.89543 3.39543 5 4.5 5H12.5L8.5 19H4.5C3.39543 19 2.5 18.1046 2.5 17V7Z" />
      
      {/* Right Piece of the bill */}
      <path d="M14.5 5H19.5C20.6046 5 21.5 5.89543 21.5 7V17C21.5 18.1046 20.6046 19 19.5 19H11.5L15.5 5Z" />
      
      {/* Stylized Currency Symbols inside */}
      <path d="M7 10.5C7 10.5 7.5 9 9 9" />
      <path d="M7 13.5C7 13.5 7.5 15 9 15" />
      <path d="M6.5 12H9.5" />
      
      <path d="M16 10.5C16 10.5 16.5 9 18 9" />
      <path d="M16 13.5C16 13.5 16.5 15 18 15" />
      <path d="M15.5 12H18.5" />

      {/* Floating debris/particles to match the 'broken' aesthetic */}
      <rect x="18" y="2" width="2" height="2" rx="0.5" transform="rotate(15 19 3)" fill="currentColor" stroke="none" opacity="0.8" />
      <rect x="3" y="20" width="2" height="2" rx="0.5" transform="rotate(-15 4 21)" fill="currentColor" stroke="none" opacity="0.8" />
      <rect x="11" y="2" width="1.5" height="1.5" rx="0.5" transform="rotate(45 11.75 2.75)" fill="currentColor" stroke="none" opacity="0.6" />
    </svg>
  );
}