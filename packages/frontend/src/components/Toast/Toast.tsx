import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type ToastListener = (toast: ToastItem) => void;
const listeners = new Set<ToastListener>();

export const toast = {
  show: (message: string, type: ToastType = 'info') => {
    const item: ToastItem = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
    };
    listeners.forEach((listener) => listener(item));
  },
  success: (message: string) => toast.show(message, 'success'),
  error: (message: string) => toast.show(message, 'error'),
  info: (message: string) => toast.show(message, 'info'),
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleNewToast = (newItem: ToastItem) => {
      setToasts((prev) => [...prev.slice(-2), newItem]); // Max 3 visible
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newItem.id));
      }, 2800);
    };

    listeners.add(handleNewToast);
    return () => {
      listeners.delete(handleNewToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notification toasts"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-sm"
    >
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';

        return (
          <div
            key={t.id}
            data-testid="toast-notification"
            className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#182337]/95 border shadow-2xl backdrop-blur-xl text-xs font-sans font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              isSuccess
                ? 'border-emerald-500/40 text-[#FFF8EE]'
                : isError
                  ? 'border-rose-500/40 text-rose-200'
                  : 'border-white/15 text-[#FFF8EE]'
            }`}
          >
            {isSuccess && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
            {isError && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {!isSuccess && !isError && <Info className="w-4 h-4 text-[#F4A100] shrink-0" />}

            <span className="truncate flex-1">{t.message}</span>

            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              aria-label="Dismiss toast"
              className="p-1 rounded-lg text-white/50 hover:text-white transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
