import { forwardRef, type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-forest text-white shadow-[0_8px_24px_rgba(21,53,42,0.16)] hover:-translate-y-0.5 hover:bg-forest/92 focus-visible:ring-forest/30",
  secondary:
    "bg-white/75 text-ink border border-border-warm shadow-sm hover:-translate-y-0.5 hover:border-sage/30 hover:bg-white focus-visible:ring-ink/15",
  danger: "bg-brick text-white shadow-sm hover:-translate-y-0.5 hover:bg-brick/90 focus-visible:ring-brick/30",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", loading, disabled, className = "", children, ...props },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
