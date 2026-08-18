import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  variant?: "sheet" | "dialog";
}

/**
 * A bottom sheet rather than a centered dialog — rendered via React Portals
 * directly under document.body so it breaks out of parent container transforms
 * (such as SwipeToDelete) and displays correctly on all viewports.
 */
export function Modal({ open, onClose, title, children, variant = "sheet" }: Props) {
  if (!open) return null;

  return createPortal(
    <div className={variant === "dialog"
      ? "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-16 sm:items-center sm:pt-4"
      : "fixed inset-0 z-50 flex items-end justify-center"}>
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-sm"
      />
      <div
        className={[
          variant === "dialog"
            ? "habit-modal-panel scroll-area relative z-10 flex max-h-[88vh] w-full max-w-[390px] animate-pop flex-col overflow-y-auto rounded-[24px] bg-surface pb-5 shadow-2xl"
            : "habit-modal-panel scroll-area relative z-10 flex max-h-[88vh] w-full max-w-app animate-sheet-in flex-col overflow-y-auto rounded-t-[28px] bg-surface pb-safe-bottom shadow-2xl"
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Grab handle — signals "this is a sheet" at a glance. */}
        {variant === "sheet" && (
          <div className="sticky top-0 z-10 flex justify-center bg-surface pt-2.5">
            <span className="h-1 w-9 rounded-full bg-border" aria-hidden="true" />
          </div>
        )}

        <div className={variant === "dialog"
          ? "flex items-center justify-between bg-surface px-5 pb-3 pt-4"
          : "sticky top-2.5 z-10 flex items-center justify-between bg-surface px-5 pb-3 pt-2"}>
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="tap-target -mr-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors active:bg-border active:text-ink"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        <div className="px-5 pb-6 pt-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
