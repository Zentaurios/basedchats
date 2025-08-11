"use client";

import { ReactNode } from "react";

import { cn } from "../../../lib/cn";

interface CardProps {
    
    children: ReactNode;
    
      className?: string;
    
      hover?: boolean;
    
      onClick?: () => void;


}

export function Card({ children, className, hover = false, onClick }: CardProps) {
    
    return (
    
        <div
    
        className={cn(
    
            "card p-3 sm:p-4",
    
            hover && "hover:shadow-md cursor-pointer",
    
            onClick && "cursor-pointer",
    
            className


      )}

      onClick={onClick}

>

      {children}

    </div>

);

}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
    
    return (
    
        <div className={cn("flex flex-col space-y-1 sm:space-y-1.5 pb-2 sm:pb-3", className)}>

            {children}

      </div>

);

}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
    
    return (
    
        <h3 className={cn("text-base sm:text-lg font-semibold leading-none tracking-tight", className)}>

            {children}

      </h3>

);

}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
    
    return (
    
        <p className={cn("text-xs sm:text-sm text-muted-foreground", className)}>

            {children}

      </p>

);

}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
    
    return (
    
        <div className={cn("pt-0", className)}>

            {children}

      </div>

);

}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
    
    return (
    
        <div className={cn("flex items-center pt-3", className)}>

            {children}

      </div>

);
}