import React, { useRef, useState } from 'react';
import { Delete, Eye, EyeOff } from 'lucide-react';

interface PinCodeInputProps {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
}

export function PinCodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  label = 'รหัส PIN 6 หลัก',
}: PinCodeInputProps) {
  const [showDigits, setShowDigits] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const focusIndex = (idx: number) => {
    const clamped = Math.max(0, Math.min(5, idx));
    inputRefs.current[clamped]?.focus();
  };

  const commitValue = (nextRaw: string) => {
    const cleaned = nextRaw.replace(/\D/g, '').slice(0, 6);
    onChange(cleaned);
    if (cleaned.length === 6 && onComplete) {
      setTimeout(() => onComplete(cleaned), 90);
    }
  };

  const handleBoxChange = (index: number, raw: string) => {
    if (disabled) return;
    const onlyDigits = raw.replace(/\D/g, '');
    if (!onlyDigits) {
      const next = value.slice(0, index) + value.slice(index + 1);
      onChange(next);
      return;
    }

    // Handle multi-digit paste or fast typing
    if (onlyDigits.length > 1) {
      const merged = (value.slice(0, index) + onlyDigits).slice(0, 6);
      commitValue(merged);
      focusIndex(Math.min(5, merged.length));
      return;
    }

    const chars = value.split('');
    chars[index] = onlyDigits[0];
    const next = chars.join('').slice(0, 6);
    commitValue(next);
    if (index < 5) {
      focusIndex(index + 1);
    }
  };

  const handleBoxKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        const next = value.slice(0, index) + value.slice(index + 1);
        onChange(next);
      } else if (index > 0) {
        const next = value.slice(0, index - 1) + value.slice(index);
        onChange(next);
        focusIndex(index - 1);
      }
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusIndex(index - 1);
      return;
    }
    if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      focusIndex(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    commitValue(pasted);
    focusIndex(Math.min(5, pasted.length));
  };

  const handleKeypadDigit = (digit: string) => {
    if (disabled || value.length >= 6) return;
    const next = (value + digit).slice(0, 6);
    commitValue(next);
    focusIndex(Math.min(5, next.length));
  };

  const handleKeypadBackspace = () => {
    if (disabled || value.length === 0) return;
    const next = value.slice(0, -1);
    onChange(next);
    focusIndex(Math.max(0, next.length));
  };

  const handleClear = () => {
    if (disabled) return;
    onChange('');
    focusIndex(0);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <button
          type="button"
          onClick={() => setShowDigits((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          {showDigits ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              <span>ซ่อนตัวเลข</span>
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              <span>แสดงตัวเลข</span>
            </>
          )}
        </button>
      </div>

      {/* 6 Digit Boxes */}
      <div className="grid grid-cols-6 gap-2" role="group" aria-label={label}>
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type={showDigits ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus={autoFocus && idx === 0}
            disabled={disabled}
            value={digit}
            onChange={(e) => handleBoxChange(idx, e.target.value)}
            onKeyDown={(e) => handleBoxKeyDown(idx, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            aria-label={`หลักที่ ${idx + 1}`}
            className="font-mono-num h-12 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center text-xl font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 transition-all"
          />
        ))}
      </div>

      {/* Tactile 3x4 Keypad */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => handleKeypadDigit(digit)}
            className="font-mono-num h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={handleClear}
          className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          ล้างค่า
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleKeypadDigit('0')}
          className="font-mono-num h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleKeypadBackspace}
          aria-label="ลบตัวเลข"
          className="h-11 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          <Delete className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
