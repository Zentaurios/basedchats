"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "../../../lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  loading = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-ring disabled:opacity-50 disabled:pointer-events-none";
  
  const variantClasses = {
    primary: "bg-base-blue text-white hover:bg-base-blue/90 border border-base-blue",
    secondary: "bg-secondary text-secondary-foreground hover:bg-muted border border-border",
    ghost: "text-foreground hover:bg-muted border border-transparent",
    destructive: "bg-red text-white hover:bg-red/90 border border-red"
  };
  
  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 py-2",
    lg: "h-12 px-6 text-lg"
  };
  
  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        loading && "cursor-wait",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="30 70"
            strokeDashoffset="100"
          />
        </svg>
      )}
      {children}
    </button>
  );
}