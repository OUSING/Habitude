import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "outline";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-ink text-bg active:bg-ink/80",
  ghost: "bg-surface-2 text-ink active:bg-border",
  outline: "bg-transparent text-ink border border-border active:bg-surface-2",
  danger: "bg-accent-light text-accent active:bg-accent/20"
};

/**
 * Deliberately has no `hover:` classes — this app targets touch first.
 * Feedback comes from `active:` (press) states plus a quick scale-down
 * so the tap always feels acknowledged, even on a fast native WebView.
 */
export function Button({ variant = "primary", fullWidth, className = "", children, ...rest }: Props) {
  return (
    <button
      className={[
        "tap-target inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3",
        "text-[15px] font-semibold transition-transform duration-100 active:scale-[0.97]",
        "disabled:opacity-40 disabled:active:scale-100",
        fullWidth ? "w-full" : "",
        VARIANT_CLASSES[variant],
        className
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
