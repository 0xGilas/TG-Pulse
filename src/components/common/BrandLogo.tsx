import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 34, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ts-bg-grad" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#2AABEE" />
          <stop offset="100%" stopColor="#1D6FE8" />
        </linearGradient>
        <linearGradient id="ts-lens-grad" x1="12" y1="10" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.88" />
        </linearGradient>
      </defs>

      {/* Rounded Liquid Glass Squircle */}
      <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#ts-bg-grad)" />
      <rect
        x="2.5"
        y="2.5"
        width="35"
        height="35"
        rx="10.5"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1"
      />

      {/* Optical Aperture Ring */}
      <circle
        cx="20"
        cy="20"
        r="10.5"
        stroke="url(#ts-lens-grad)"
        strokeWidth="1.75"
        strokeDasharray="48 18"
        strokeLinecap="round"
      />

      {/* Signal Vector / Prism Needle */}
      <path
        d="M14.5 23.5L18.2 17.8L21.3 20.6L25.8 15"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25.8" cy="15" r="2.1" fill="#FDE047" />
    </svg>
  );
};
