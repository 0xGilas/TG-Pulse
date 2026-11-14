import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

/**
 * TeleScope Optical Reticle + Attribution Signal Emblem.
 * Geometric crosshair frame with Telegram cyan sweep and amber attribution focal point.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, className = '' }) => {
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
      {/* Precision Obsidian Housing */}
      <rect x="2" y="2" width="36" height="36" rx="10" fill="#0D1218" />
      <rect
        x="2.5"
        y="2.5"
        width="35"
        height="35"
        rx="9.5"
        stroke="rgba(42, 171, 238, 0.42)"
        strokeWidth="1.2"
      />

      {/* Reticle Calibration Ticks */}
      <path
        d="M20 5.5V8.5M20 31.5V34.5M5.5 20H8.5M31.5 20H34.5"
        stroke="rgba(240, 244, 248, 0.28)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {/* Optical Aperture Ring */}
      <circle
        cx="20"
        cy="20"
        r="9.5"
        stroke="#2AABEE"
        strokeWidth="1.7"
        strokeDasharray="44 16"
        strokeLinecap="round"
      />

      {/* Forward Attribution Signal Vector */}
      <path
        d="M13.5 23.5L18 18.2L21.5 21L26.5 14.5"
        stroke="#F0F4F8"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26.5" cy="14.5" r="2.3" fill="#F59E0B" />
    </svg>
  );
};
