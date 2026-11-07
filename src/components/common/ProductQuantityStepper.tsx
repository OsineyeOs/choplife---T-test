import React, { useState, useEffect } from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';

export interface ProductQuantityStepperProps {
  quantity: number;
  onQuantityChange: (newQuantity: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unitLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  allowDeleteAtZero?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  idPrefix?: string;
  className?: string;
}

export const ProductQuantityStepper: React.FC<ProductQuantityStepperProps> = ({
  quantity,
  onQuantityChange,
  min = 0,
  max = 500,
  step = 1,
  unitLabel,
  size = 'md',
  allowDeleteAtZero = true,
  disabled = false,
  ariaLabel = 'Product quantity',
  idPrefix = 'qty-stepper',
  className = '',
}) => {
  // Local string representation to allow typing backspaces before committing
  const [inputValue, setInputValue] = useState<string>(String(quantity));

  useEffect(() => {
    setInputValue(String(quantity));
  }, [quantity]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setInputValue(rawVal);

    if (rawVal === '') {
      // Allow user to clear input while typing; don't commit until blur or valid number
      return;
    }

    const parsed = parseInt(rawVal, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onQuantityChange(clamped);
    }
  };

  const handleBlur = () => {
    if (inputValue === '' || Number.isNaN(parseInt(inputValue, 10))) {
      // Reset back to current valid quantity or min
      const fallback = Math.max(min, quantity || (min > 0 ? min : 1));
      setInputValue(String(fallback));
      onQuantityChange(fallback);
    } else {
      const parsed = parseInt(inputValue, 10);
      const clamped = Math.max(min, Math.min(max, parsed));
      setInputValue(String(clamped));
      onQuantityChange(clamped);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const nextVal = Math.max(min, quantity - step);
    onQuantityChange(nextVal);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const nextVal = Math.min(max, quantity + step);
    onQuantityChange(nextVal);
  };

  const isAtMin = quantity <= min;
  const isAtMax = quantity >= max;

  // Size styling map
  const sizeClasses = {
    sm: {
      btn: 'w-5 h-5 rounded text-[11px]',
      input: 'w-7 text-[11px] py-0.5',
      container: 'p-0.5 gap-0.5',
      icon: 'w-2.5 h-2.5',
    },
    md: {
      btn: 'w-6 h-6 rounded-lg text-xs',
      input: 'w-9 text-xs py-0.5',
      container: 'px-1 py-0.5 gap-1',
      icon: 'w-3 h-3',
    },
    lg: {
      btn: 'w-8 h-8 rounded-xl text-sm',
      input: 'w-12 text-sm py-1',
      container: 'px-2 py-1 gap-1.5',
      icon: 'w-3.5 h-3.5',
    },
  }[size];

  return (
    <div
      className={`inline-flex items-center bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl shadow-2xs ${sizeClasses.container} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Minus or Trash Button */}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || (isAtMin && !allowDeleteAtZero)}
        className={`${sizeClasses.btn} bg-white hover:bg-[#E5DEC9] active:bg-[#D4CBB6] flex items-center justify-center font-bold text-[#4D080F] disabled:opacity-40 transition-colors shadow-2xs`}
        id={`${idPrefix}-dec`}
        aria-label={`Decrease ${ariaLabel}`}
        title={`Decrease ${ariaLabel}`}
      >
        {isAtMin && allowDeleteAtZero && min === 0 ? (
          <Trash2 className={`${sizeClasses.icon} text-rose-600`} />
        ) : (
          <Minus className={sizeClasses.icon} />
        )}
      </button>

      {/* Editable Numeric Input */}
      <div className="flex items-center">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          className={`${sizeClasses.input} text-center font-titan text-[#241311] bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-[#E62E00] rounded`}
          id={`${idPrefix}-input`}
          aria-label={ariaLabel}
        />
        {unitLabel && (
          <span className="text-[10px] font-montserrat text-[#7A6A65] font-semibold pr-1 whitespace-nowrap">
            {unitLabel}
          </span>
        )}
      </div>

      {/* Plus Button */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || isAtMax}
        className={`${sizeClasses.btn} bg-[#E62E00] hover:bg-[#C92200] active:bg-[#B01E00] flex items-center justify-center font-bold text-white disabled:opacity-40 transition-colors shadow-2xs`}
        id={`${idPrefix}-inc`}
        aria-label={`Increase ${ariaLabel}`}
        title={`Increase ${ariaLabel}`}
      >
        <Plus className={sizeClasses.icon} />
      </button>
    </div>
  );
};
