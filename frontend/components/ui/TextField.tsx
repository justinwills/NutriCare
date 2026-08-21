import { forwardRef, type InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-[13px] font-semibold tracking-[0.01em] text-ink/72">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`min-h-12 rounded-xl border border-border-warm bg-white/85 px-3.5 py-2.5 text-base text-ink shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] placeholder:text-ink/32 outline-none transition focus:border-sage/55 focus:ring-4 focus:ring-sage/10 disabled:opacity-50 ${
            error ? "border-brick focus:border-brick focus:ring-brick/20" : ""
          } ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-brick">
            {error}
          </p>
        )}
      </div>
    );
  }
);
TextField.displayName = "TextField";
