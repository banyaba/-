import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = error.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด';
    try {
      const parsed = JSON.parse(message) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        message = `Firestore (${parsed.operationType || 'operation'} ${parsed.path || ''}): ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, errorMessage: message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 p-6 text-center space-y-4 shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                เกิดข้อผิดพลาดในการเชื่อมต่อระบบ
              </h2>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 break-words">
                {this.state.errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <RotateCw className="h-4 w-4" />
              <span>โหลดหน้าใหม่</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
