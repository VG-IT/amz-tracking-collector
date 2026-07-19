import { inferCurrencyFromContext } from "@/domain/currency/infer-currency";

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  $: "USD",
  "£": "GBP",
  "€": "EUR",
};

function parseAmount(raw: string): number {
  const cleaned = raw.trim();
  // European format: 1.234,56
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }
  // US / MX format: 1,234.56
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    return Number(cleaned.replace(/,/g, ""));
  }
  // Plain: 12,34 without thousands
  if (/^\d+,\d+$/.test(cleaned) && !cleaned.includes(".")) {
    return Number(cleaned.replace(",", "."));
  }
  return Number(cleaned.replace(/,/g, ""));
}

export function parseMoney(
  text: string,
  context: { domain?: string },
): {
  amount: number;
  currency: string | null;
} {
  if (!text) return { amount: NaN, currency: null };

  const clean = text.replace(/\s+/g, " ").trim();

  const iso = clean.match(/^([A-Z]{3})\s*([\d.,]+)/);
  if (iso) {
    return {
      currency: iso[1],
      amount: parseAmount(iso[2]),
    };
  }

  const symbol = clean.match(/^([$£€])\s*([\d.,]+)/);
  if (symbol) {
    return {
      currency: inferCurrencyFromContext(symbol[1], context),
      amount: parseAmount(symbol[2]),
    };
  }

  const negative = clean.match(/^-\s*([$£€])\s*([\d.,]+)/);
  if (negative) {
    return {
      currency:
        inferCurrencyFromContext(negative[1], context) ??
        SYMBOL_TO_CURRENCY[negative[1]] ??
        null,
      amount: -parseAmount(negative[2]),
    };
  }

  return { amount: NaN, currency: null };
}
