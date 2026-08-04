import type { Order } from "../../domain/Order";

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  // Spanish
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
  // German
  januar: 0,
  februar: 1,
  märz: 2,
  maerz: 2,
  marz: 2,
  mai: 4,
  juni: 5,
  juli: 6,
  oktober: 9,
  dezember: 11,
  // French
  janvier: 0,
  février: 1,
  fevrier: 1,
  mars: 2,
  avril: 3,
  // mai shared with German
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11,
};

function normalizeDateText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/,/g, " ")
    .replace(/\./g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Parse Amazon order-list date strings across marketplaces.
 * Avoids `new Date("March 4")` → year 2001 false lookback stops.
 */
export function parseOrderDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const cleaned = normalizeDateText(dateStr);
  if (!cleaned) return null;

  // 11 de febrero de 2026 | 11 febrero 2026
  let match = cleaned.match(
    /^(\d{1,2})\s*(?:de\s+)?([a-zäöüßéèêàùç]+)\s*(?:de\s+)?(\d{4})$/i,
  );
  if (match) {
    const day = Number(match[1]);
    const month = MONTH_INDEX[match[2]];
    const year = Number(match[3]);
    if (month != null) return buildDate(year, month, day);
  }

  // March 4, 2026 | Mar 4 2026
  match = cleaned.match(/^([a-zäöüßéèêàùç]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/i);
  if (match) {
    const month = MONTH_INDEX[match[1]];
    const day = Number(match[2]);
    const year = Number(match[3]);
    if (month != null) return buildDate(year, month, day);
  }

  // 4 March 2026 | 16 December 2025
  match = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zäöüßéèêàùç]+)\s+(\d{4})$/i);
  if (match) {
    const day = Number(match[1]);
    const month = MONTH_INDEX[match[2]];
    const year = Number(match[3]);
    if (month != null) return buildDate(year, month, day);
  }

  // Yearless: March 4 / 4 March → assume current year (or previous if that would be future)
  match = cleaned.match(/^([a-zäöüßéèêàùç]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (match) {
    const month = MONTH_INDEX[match[1]];
    const day = Number(match[2]);
    if (month != null) return buildDateWithInferredYear(month, day);
  }
  match = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zäöüßéèêàùç]+)$/i);
  if (match) {
    const day = Number(match[1]);
    const month = MONTH_INDEX[match[2]];
    if (month != null) return buildDateWithInferredYear(month, day);
  }

  // Numeric: prefer DD/MM when day > 12, else locale-ambiguous — try ISO-like YYYY-MM-DD first
  match = cleaned.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    return buildDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const year = Number(match[3]);
    // If first part > 12, it's D/M/Y; if second > 12, it's M/D/Y; else assume M/D/Y (US).
    if (a > 12) return buildDate(year, b - 1, a);
    if (b > 12) return buildDate(year, a - 1, b);
    return buildDate(year, a - 1, b);
  }

  const native = new Date(dateStr);
  if (!isNaN(native.getTime())) {
    // Reject native yearless parse that lands in 2001 (Chrome quirk).
    if (native.getFullYear() === 2001 && !/\d{4}/.test(dateStr)) {
      return buildDateWithInferredYear(native.getMonth(), native.getDate());
    }
    return native;
  }

  return null;
}

function buildDate(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function buildDateWithInferredYear(month: number, day: number): Date | null {
  const now = new Date();
  let date = buildDate(now.getFullYear(), month, day);
  if (!date) return null;
  // If the date would be > ~2 days in the future, it was probably last year.
  const futureSlack = new Date();
  futureSlack.setDate(futureSlack.getDate() + 2);
  if (date > futureSlack) {
    date = buildDate(now.getFullYear() - 1, month, day);
  }
  return date;
}

function isExpiredDate(date: Date, lookbackDays: number): boolean {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - Math.max(1, lookbackDays));
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);
  return compare < cutoff;
}

/**
 * Stop paging only when every parseable order date on the page is older than
 * the lookback window. A single bad/old date must not abort collection.
 */
export function isOrdersExpired(orders: Order[], lookbackDays = 30): boolean {
  const dated = orders
    .map((order) => ({ order, date: parseOrderDate(order.orderDate) }))
    .filter((item): item is { order: Order; date: Date } => item.date != null);

  if (dated.length === 0) return false;
  return dated.every(({ date }) => isExpiredDate(date, lookbackDays));
}

export function describeLookbackStop(
  orders: Order[],
  lookbackDays: number,
): string {
  const dated = orders
    .map((order) => ({
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      parsed: parseOrderDate(order.orderDate),
    }))
    .filter((item) => item.parsed);

  const expired = dated.filter(
    (item) => item.parsed && isExpiredDate(item.parsed, lookbackDays),
  );
  const sample = expired
    .slice(0, 3)
    .map((item) => `${item.orderNumber || "?"} (${item.orderDate})`)
    .join(", ");

  return `Reached lookback of ${lookbackDays} day(s); all ${dated.length} dated order(s) on this page are outside the window${sample ? `: ${sample}` : ""}`;
}
