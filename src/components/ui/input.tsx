import * as React from "react";
import { cn } from "@/lib/utils";
import { normalizeUsPhoneDigits } from "@/lib/phone";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  numericOnly?: boolean;
  prefix?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, numericOnly, prefix, onKeyDown, onPaste, onChange, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (numericOnly) {
        const isControlKey =
          ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"].includes(
            e.key
          ) ||
          e.ctrlKey ||
          e.metaKey;
        const isNumber = /^[0-9]$/.test(e.key);
        if (!isControlKey && !isNumber) {
          e.preventDefault();
        }
      }
      onKeyDown?.(e);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (numericOnly) {
        e.preventDefault();
        const cleanText = normalizeUsPhoneDigits(e.clipboardData.getData("text"));
        const input = e.currentTarget;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        const maxLen = props.maxLength ?? Infinity;
        const newValue = (input.value.slice(0, start) + cleanText + input.value.slice(end)).slice(0, maxLen);
        input.value = newValue;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      onPaste?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (numericOnly) {
        e.target.value = normalizeUsPhoneDigits(e.target.value);
      }
      onChange?.(e);
    };

    const inputClassName = cn(
      "flex h-11 w-full border-[1.5px] border-surface-border bg-primary-subtle px-3.5 py-2.5 text-sm text-text-dark placeholder:text-text-soft",
      "transition-all duration-200 outline-none",
      "focus:border-primary-500 focus:bg-white focus:shadow-focus",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      prefix ? "rounded-r-xl rounded-l-none" : "rounded-xl",
      error && "border-status-error focus:border-status-error focus:shadow-[0_0_0_3px_rgba(239,68,68,0.14)]",
      className
    );

    if (prefix) {
      return (
        <div className="flex">
          <span
            aria-hidden
            className={cn(
              "flex w-11 shrink-0 items-center justify-center rounded-l-xl border border-r-0 border-surface-border bg-primary-subtle px-2 text-sm font-medium text-text-soft",
              error && "border-status-error"
            )}
          >
            {prefix}
          </span>
          <input
            type={type}
            className={inputClassName}
            ref={ref}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onChange={handleChange}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        type={type}
        className={inputClassName}
        ref={ref}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
