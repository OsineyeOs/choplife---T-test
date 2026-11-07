import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  showIcon?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  error,
  showIcon = true,
  id,
  value,
  onChange,
  placeholder = 'Enter password',
  required = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || `password-input-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-titan text-[#4D080F] uppercase tracking-wider mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {showIcon && (
          <KeyRound
            className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none"
            aria-hidden="true"
          />
        )}
        <input
          id={inputId}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={props.autoComplete || 'current-password'}
          className={`w-full ${showIcon ? 'pl-10' : 'pl-3.5'} pr-11 py-2.5 bg-[#FAF7F2] border ${
            error ? 'border-red-500' : 'border-[#E5DEC9]'
          } rounded-xl text-xs sm:text-sm font-montserrat text-[#241311] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC700] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          className="absolute right-2.5 p-1.5 text-gray-500 hover:text-[#4D080F] focus:text-[#4D080F] focus:outline-none focus:ring-2 focus:ring-[#FFC700] rounded-lg transition-colors"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600 font-montserrat mt-1">{error}</p>}
    </div>
  );
};
