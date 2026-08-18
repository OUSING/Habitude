import React, { createContext, useContext, useState } from "react";
import { Trash2, AlertTriangle, Info, Bell } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info" | "notification";
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialogState({ options, resolve });
    });
  };

  const handleClose = (value: boolean) => {
    if (dialogState) {
      dialogState.resolve(value);
      setDialogState(null);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialogState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onTouchCancel={(e) => e.stopPropagation()}
        >
          {/* Backdrop with blur and fade animation */}
          <div
            className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[4px]"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) handleClose(false);
            }}
          />
          
          {/* Dialog Box with scale-in animation */}
          <div className="relative z-10 w-full max-w-sm animate-pop overflow-hidden rounded-3xl bg-surface p-6 shadow-2xl border border-border">
            <div className="flex flex-col items-center text-center">
              {/* Decorative Icon Wrapper */}
              <div
                className={[
                  "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner",
                  dialogState.options.type === "danger"
                    ? "bg-red-500/10 text-red-500"
                    : dialogState.options.type === "warning"
                    ? "bg-amber-500/10 text-amber-500"
                    : dialogState.options.type === "notification"
                    ? "bg-brand/10 text-brand animate-bounce"
                    : "bg-blue-500/10 text-blue-500"
                ].join(" ")}
              >
                {dialogState.options.type === "danger" && <Trash2 size={24} strokeWidth={2} />}
                {dialogState.options.type === "warning" && <AlertTriangle size={24} strokeWidth={2} />}
                {dialogState.options.type === "notification" && <Bell size={24} strokeWidth={2} />}
                {(dialogState.options.type === "info" || !dialogState.options.type) && <Info size={24} strokeWidth={2} />}
              </div>

              {/* Title & Message */}
              <h3 className="font-display text-lg font-semibold text-ink">
                {dialogState.options.title}
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {dialogState.options.message}
              </p>
            </div>

            {/* Buttons */}
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleClose(true); }}
                onPointerDown={(e) => e.stopPropagation()}
                className={[
                  "tap-target w-full rounded-xl py-3 text-[14px] font-semibold text-white transition-colors shadow-sm",
                  dialogState.options.type === "danger"
                    ? "bg-red-500 hover:bg-red-600 active:bg-red-700"
                    : dialogState.options.type === "notification"
                    ? "bg-brand hover:bg-brand/90 active:bg-brand/80"
                    : "bg-ink hover:bg-ink/90 active:bg-ink/80"
                ].join(" ")}
              >
                {dialogState.options.confirmText ?? "Confirm"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleClose(false); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="tap-target w-full rounded-xl bg-surface-2 py-3 text-[14px] font-semibold text-ink transition-colors hover:bg-border active:bg-border-dark"
              >
                {dialogState.options.cancelText ?? "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
