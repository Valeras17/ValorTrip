// Money utilities — integer cents only, NEVER float
export const SCHEMA_VERSION = 1;

/** Format cents to display string: 1234 → "$12.34" */
export function formatMoney(cents: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    RUB: '₽',
  };
  const symbol = symbols[currency] ?? currency;
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toFixed(2);
  return cents < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/** Parse a float string like "12.50" to integer cents: 1250 */
export function parseToCents(value: string): number {
  const n = parseFloat(value.replace(',', '.'));
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Calculate tip amount in cents based on mode */
export type TipMode = 'none' | '5' | '10' | '15' | 'custom';

export function calcTip(subtotal: number, mode: TipMode, customCents?: number): number {
  switch (mode) {
    case 'none': return 0;
    case '5': return Math.round(subtotal * 0.05);
    case '10': return Math.round(subtotal * 0.10);
    case '15': return Math.round(subtotal * 0.15);
    case 'custom': return customCents ?? 0;
    default: return 0;
  }
}

/**
 * Divide totalCents equally among `count` people.
 * Returns array of cents. Last person gets remainder.
 * Guaranteed: sum of result === totalCents.
 */
export function splitEqually(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  const shares = Array(count).fill(base) as number[];
  shares[count - 1] += remainder;
  return shares;
}

/** Validate payers sum === shares sum === total */
export function validateExpense(
  total: number,
  payersSum: number,
  sharesSum: number,
): { valid: boolean; error?: string } {
  if (payersSum !== total) {
    return {
      valid: false,
      error: `Payers sum (${formatMoney(payersSum)}) ≠ total (${formatMoney(total)})`,
    };
  }
  if (sharesSum !== total) {
    return {
      valid: false,
      error: `Shares sum (${formatMoney(sharesSum)}) ≠ total (${formatMoney(total)})`,
    };
  }
  return { valid: true };
}
