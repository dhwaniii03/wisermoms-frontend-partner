"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
}

export function SearchableSelect({
  label,
  required,
  placeholder = "Select…",
  hint,
  error,
  options,
  value,
  onChange,
  disabled,
  autoComplete,
  className,
}: SearchableSelectProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return (
    <div className={cn("space-y-1.5", className)} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-text-dark">
          {label}
          {required && <span className="text-primary-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          onClick={() => {
            if (!disabled) {
              setOpen((current) => !current);
            }
          }}
          className={cn(
            "flex h-11 w-full items-center rounded-xl border-[1.5px] bg-primary-subtle px-3.5 text-left text-sm text-text-dark transition-all",
            "focus:border-primary-500 focus:bg-white focus:outline-none",
            error ? "border-status-error" : "border-surface-border",
            disabled && "cursor-not-allowed opacity-70"
          )}
        >
          {value ? selectedLabel : <span className="text-text-soft">{placeholder}</span>}
        </button>

        {open && !disabled && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-surface-border bg-white shadow-lg"
          >
            <div className="border-b border-surface-border p-2">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search…"
                autoComplete={autoComplete}
                className="flex h-10 w-full rounded-lg border border-surface-border px-3 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-text-soft">No matches found.</p>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "block w-full px-3 py-2 text-left text-sm hover:bg-primary-subtle",
                      option.value === value && "bg-primary-50 text-primary-700"
                    )}
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {hint && !error && <p className="text-xs text-text-soft">{hint}</p>}
      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  );
}
