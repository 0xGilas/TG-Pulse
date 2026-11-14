import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showLabel?: string;
  hideLabel?: string;
  inputClassName?: string;
}

/**
 * Composite bordered password input where the visibility toggle lives in its own
 * dedicated flex compartment separated by a crisp hairline border—preventing
 * typed text from ever sliding underneath the icon in RTL or LTR layouts.
 */
export const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  value,
  onChange,
  showLabel = 'Show value',
  hideLabel = 'Hide value',
  inputClassName = '',
  className = '',
  dir = 'ltr',
  ...rest
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      dir={dir}
      className={`flex items-stretch rounded-lg border border-white/12 bg-[#0B0F14] overflow-hidden focus-within:border-[#2AABEE] focus-within:ring-2 focus-within:ring-[#2AABEE]/25 transition-colors ${className}`}
    >
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        dir={dir}
        className={`flex-1 min-w-0 bg-transparent px-3.5 py-2 text-sm text-[#F0F4F8] placeholder:text-[#586778] border-0 focus:outline-none ${inputClassName}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : showLabel}
        className="shrink-0 flex items-center justify-center px-3 border-s border-white/10 bg-[#141A22] text-[#8B9BB0] hover:text-[#F0F4F8] hover:bg-[#1B232E] focus-visible:outline-none focus-visible:bg-[#1B232E] focus-visible:text-[#2AABEE] transition-colors cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};
