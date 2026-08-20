import { forwardRef, type InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink/80">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`rounded-lg border border-border-warm bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-ink/35 outline-none transition focus:border-clay focus:ring-2 focus:ring-clay/20 disabled:opacity-50 ${
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
