import React, { useEffect, useState } from 'react';
import { ShieldCheck, Delete, X, Lock } from 'lucide-react';

interface AdminLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminLoginModal({ open, onClose, onSuccess }: AdminLoginModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPin('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const verifyPin = (candidate: string) => {
    if (candidate === '1234') {
      setError('');
      setPin('');
      onSuccess();
      return;
    }
    setError('รหัส PIN ผู้ดูแลระบบไม่ถูกต้อง (PIN: 1234)');
    setPin('');
  };

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === 4) {
      setTimeout(() => verifyPin(next), 120);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setError('กรุณากรอกรหัส PIN 4 หลัก');
      return;
    }
    verifyPin(pin);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="admin-login-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                เข้าสู่ระบบผู้ดูแลระบบ (Admin)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                กรอกรหัส PIN 4 หลัก เพื่อปลดล็อกทุกฟีเจอร์
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              รหัส PIN ผู้ดูแลระบบ
            </span>
            <span className="font-mono-num">ค่าเริ่มต้น: 1234</span>
          </div>

          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={pin}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
              setPin(cleaned);
              setError('');
              if (cleaned.length === 4) {
                setTimeout(() => verifyPin(cleaned), 120);
              }
            }}
            aria-label="รหัส PIN ผู้ดูแลระบบ 4 หลัก"
            placeholder="••••"
            className="font-mono-num w-full text-center text-2xl tracking-[0.75em] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && (
            <p role="alert" className="mt-2.5 text-center text-xs font-medium text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="font-mono-num h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition-all"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError('');
              }}
              className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              ล้างค่า
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="font-mono-num h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition-all"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="ลบตัวเลข"
              className="h-11 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Delete className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
