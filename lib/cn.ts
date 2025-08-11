// Simple class name utility (cn) for combining Tailwind classes
 
 export function cn(...classes: (string | undefined | null | boolean)[]): string {
   return classes
     .filter(Boolean)
     .join(" ")
     .replace(/\s+/g, " ")
    .trim();
 }
