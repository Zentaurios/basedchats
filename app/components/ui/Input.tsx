"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "../../../lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "search";
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = "default", error, className, ...props }, ref) => {
    const baseClasses = "w-full rounded-md border bg-input px-3 py-2 text-xs sm:text-sm placeholder:text-muted-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50";
    
    const variantClasses = {
      default: "border-border",
      search: "border-border bg-background pl-10" // Extra padding for search icon
    };
    
    const errorClasses = error ? "border-red focus:border-red" : "";
    
    return (
      <div className="relative">
        {variant === "search" && (
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        )}
        <input
          ref={ref}
          className={cn(
            baseClasses,
            variantClasses[variant],
            errorClasses,
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs sm:text-sm text-red">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
