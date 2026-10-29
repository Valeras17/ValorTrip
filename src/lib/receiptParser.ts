/**
 * Utility to parse on-device OCR text from receipts.
 * Extracts candidate merchant/title and candidate total amount.
 */

export interface ParsedReceipt {
  title?: string;
  amount?: string;
  rawText: string;
}

const TOTAL_KEYWORDS = [
  'grand total',
  'total amount',
  'total due',
  'total',
  'итого к оплате',
  'итог к оплате',
  'итого',
  'итог',
  'всего',
  'сумма к оплате',
  'сумма',
  'к оплате',
  'amount due',
  'amount',
  'balance due',
  'subtotal',
  'htoto',
  'utoto',
  'ntoro',
  'mtoro',
  'itogo',
  'itog',
  'cymma',
  'cyma',
  'summa',
  'sum',
  'k oplate',
];

const NON_TITLE_PATTERNS = [
  /^(receipt|order|check|чек|заказ|счет|квитанция)[\s#№]/i,
  /^(\d{1,4}[-./]\d{1,2}[-./]\d{1,4})/i, // date
  /^(\d{1,2}:\d{2})/i, // time
  /^(tel|phone|тел|сайт|www|http)/i, // phone/website
  /^[=\-*#_~]{3,}$/, // separator lines
  /^\d+$/, // pure digits
];

/**
 * Extracts numeric value from a string (e.g. "$ 1,234.50" or "450,00 руб")
 * Normalizes to standard decimal format like "1234.50"
 */
function extractPrice(str: string): number | null {
  // Remove currency signs and spaces between numbers
  // Matches e.g. 12.50, 12,50, 1 250.00, 1250
  const cleaned = str.replace(/[^0-9,.\s]/g, '').trim();
  if (!cleaned) return null;

  // Match pattern like 12.50 or 12,50 or 1234.56
  const match = cleaned.match(/(\d+(?:[.,\s]\d{3})*(?:[.,]\d{2}))(?!\d)/);
  if (match && match[1]) {
    // Normalize: replace comma with dot, remove spaces
    let numStr = match[1].replace(/\s/g, '');
    if (numStr.includes(',') && numStr.includes('.')) {
      // European vs US format (e.g. 1.250,50 or 1,250.50)
      if (numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.');
      } else {
        numStr = numStr.replace(/,/g, '');
      }
    } else {
      numStr = numStr.replace(',', '.');
    }
    const val = parseFloat(numStr);
    return isNaN(val) ? null : val;
  }

  return null;
}

export function parseReceipt(rawText: string): ParsedReceipt {
  if (!rawText || !rawText.trim()) {
    return { rawText: rawText ?? '' };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let title: string | undefined;
  let amount: string | undefined;

  // 1. Candidate title: check top 5 lines
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i]!;
    if (line.length < 3) continue;

    const isNonTitle = NON_TITLE_PATTERNS.some((pat) => pat.test(line));
    if (!isNonTitle) {
      // Clean up punctuation at ends
      const cleanTitle = line.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
      if (cleanTitle.length >= 3 && cleanTitle.length <= 40) {
        title = cleanTitle;
        break;
      }
    }
  }

  // 2. Candidate amount: Search for lines matching total keywords
  // Check lines in reverse or by keyword priority
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lower = line.toLowerCase();

    for (const kw of TOTAL_KEYWORDS) {
      if (lower.includes(kw)) {
        // Try extracting price from the same line
        let price = extractPrice(line);
        // If not on same line, try checking the next line
        if (price === null && i + 1 < lines.length) {
          price = extractPrice(lines[i + 1]!);
        }

        if (price !== null && price > 0) {
          amount = price.toFixed(2);
          break;
        }
      }
    }
    if (amount) break;
  }

  // 3. Fallback: if no keyword match found, look from bottom up for decimal numbers
  if (!amount) {
    const foundPrices: number[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const price = extractPrice(lines[i]!);
      if (price !== null && price > 0 && price < 1000000) {
        foundPrices.push(price);
      }
    }
    if (foundPrices.length > 0) {
      // Pick the max price among the candidates (often total is max)
      const maxPrice = Math.max(...foundPrices);
      amount = maxPrice.toFixed(2);
    }
  }

  return {
    title,
    amount,
    rawText,
  };
}
