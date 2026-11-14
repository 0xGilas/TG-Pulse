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
    <div className={`relative ${className}`}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        dir={dir}
        className={`w-full rounded-lg border border-white/10 bg-[#111923] ps-3.5 pe-10 py-2 text-sm text-[#f5f7fa] placeholder:text-[#5d6f82] focus:border-[#3390ec] focus:outline-none focus:ring-2 focus:ring-[#3390ec]/20 transition-colors ${inputClassName}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        title={visible ? hideLabel : showLabel}
        className="absolute inset-y-0 end-0 flex items-center justify-center px-3 text-[#7f91a4] hover:text-[#f5f7fa] transition-colors cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};
