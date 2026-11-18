import React, { useEffect, useState } from 'react';
import { ShieldCheck, X, Lock } from 'lucide-react';
import { PinCodeInput } from './PinCodeInput';
import { verifyAdminPin6, type PinHashes } from '../firebase/pinAuth';

interface AdminLoginModalProps {
  open: boolean;
  pinHashes: PinHashes | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminLoginModal({ open, pinHashes, onClose, onSuccess }: AdminLoginModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (open) {
      setPin('');
      setError('');
      setVerifying(false);
    }
  }, [open]);

  if (!open) return null;

  const verifyPin = async (candidate: string) => {
    if (verifying) return;
    setVerifying(true);
    try {
      const ok = await verifyAdminPin6(candidate, pinHashes);
      if (ok) {
        setError('');
        setPin('');
        onSuccess();
        return;
      }
      setError('รหัส PIN 6 หลักผู้ดูแลระบบไม่ถูกต้อง');
      setPin('');
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) {
      setError('กรุณากรอกรหัส PIN ให้ครบ 6 หลัก');
      return;
    }
    void verifyPin(pin);
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
                กรอกรหัส PIN 6 หลัก เพื่อปลดล็อกทุกฟีเจอร์
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              รหัส PIN ผู้ดูแลระบบ
            </span>
          </div>

          <PinCodeInput
            value={pin}
            onChange={(next) => {
              setPin(next);
              setError('');
            }}
            onComplete={(completed) => {
              void verifyPin(completed);
            }}
            disabled={verifying}
            autoFocus
            label="กรอกตัวเลข 6 หลัก"
          />

          {error && (
            <p role="alert" className="text-center text-xs font-medium text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={verifying || pin.length !== 6}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-55"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              {verifying ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
