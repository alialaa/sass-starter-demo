import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return amount.toFixed(2).padStart("6");
}

export function formatDiscount(amount: number, percent: number): string {
  const discountedPrice = amount * (1 - percent / 100);
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(discountedPrice);
}
