"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Icon } from "./Icons";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className = "", type, ...props }, ref) => {
    const inputId = id ?? props.name;
    const isPassword = type === "password";
    // Local to this field only, so multiple password fields on the
    // same page (e.g. password + confirm password) toggle independently.
    const [revealed, setRevealed] = useState(false);

    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-[13px] font-semibold tracking-[0.01em] text-ink/72">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword ? (revealed ? "text" : "password") : type}
            className={`min-h-12 w-full rounded-xl border border-border-warm bg-white/85 px-3.5 py-2.5 text-base text-ink shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] placeholder:text-ink/32 outline-none transition focus:border-sage/55 focus:ring-4 focus:ring-sage/10 disabled:opacity-50 ${
              error ? "border-brick focus:border-brick focus:ring-brick/20" : ""
            } ${isPassword ? "pr-11" : ""} ${className}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink/45 transition hover:text-ink/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage/30"
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
            >
              <Icon name={revealed ? "eyeOff" : "eye"} className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
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
