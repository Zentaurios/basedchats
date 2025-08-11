"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ui/ThemeToggle";
import { NavigationProps } from "../../lib/types";
import { cn } from "../../lib/cn";

export function Navigation({ isAdmin }: NavigationProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/",
      label: "Feed",
      description: "Browse group chats",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      )
    },
    {
      href: "/how-to-submit",
      label: "Submit",
      description: "Get featured",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      )
    },
    ...(isAdmin ? [{
      href: "/admin",
      label: "Admin",
      description: "Manage casts",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
        </svg>
      )
    }] : [])
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-md mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-colors focus-ring min-w-0 flex-1",
                  isActive
                    ? "text-base-blue"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={item.description}
              >
                {item.icon}
                <span className="text-xs font-medium truncate">{item.label}</span>
              </Link>
            );
          })}
          
          {/* Theme Toggle as a nav item */}
          <div className="flex flex-col items-center space-y-1 px-3 py-2 min-w-0 flex-1">
            <ThemeToggle />
            <span className="text-xs font-medium text-muted-foreground">Theme</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

// Header component for individual pages
export function PageHeader({ 
  title, 
  description, 
  children 
}: { 
  title: string; 
  description?: string; 
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border bg-card/30">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {children && (
            <div className="flex items-center space-x-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
