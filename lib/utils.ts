import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return amount.toFixed(2).padStart(6);
}

const discountFormatter = new Intl.NumberFormat('en-US', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

/**
 * Calculates the discounted price and returns it formatted to 2 decimal places.
 *
 * @param amount  - The original price (non-negative number).
 * @param percent - The discount percentage to apply (0–100).
 * @returns       A plain decimal string with exactly 2 fractional digits,
 *                e.g. `formatDiscount(100, 10)` → `'90.00'`.
 *
 * @remarks
 * Inputs are assumed to be valid: `amount` should be non-negative and
 * `percent` should be in the range 0–100. No runtime validation is performed.
 * The returned string does not include a currency symbol.
 */
export function formatDiscount(amount: number, percent: number): string {
  return discountFormatter.format(amount * (1 - percent / 100));
}
