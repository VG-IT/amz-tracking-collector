import { parseMoney } from "@/money/parse-money";

const LABEL_MAP = {
  subtotal: [
    "subtotal",
    "items",
    "artículo",
    "articulos",
    "artículos",
    "zwischensumme",
    "sous-total",
  ],
  shipping: [
    "shipping",
    "envío",
    "envio",
    "costo de envío",
    "costo de envio",
    "shipping & handling",
    "versand",
    "lieferung",
    "expédition",
    "frais de livraison",
  ],
  tax: [
    "estimated tax",
    "impuesto",
    "impuestos",
    "vat",
    "estimated tax to be collected",
    "estimated pst/rst/qst",
    "estimated gst/hst",
    "mwst",
    "ust",
    "steuer",
    "tps/tvh",
    "tvq",
    "gst/hst",
    "pst/rst/qst",
  ],
  total_before_tax: [
    "before tax",
    "antes de impuestos",
    "total before vat",
    "gesamtbetrag ohne mwst",
    "total before tax",
    "total avant taxes",
  ],
  grand_total: [
    "grand total",
    "total del pedido",
    "order total",
    "gesamtbetrag",
    "summe",
    "total de la commande",
  ],
  payment_total: [
    "payment total",
    "total del pago",
    "payment grand total",
    "total charged",
    "importe cobrado",
    "zahlungsbetrag",
    "montant payé",
  ],
};

function matchLabel(label: string, keys: string[]) {
  return keys.some((k) => label.includes(k));
}

function isExactOrPrefixedTotal(label: string): boolean {
  // Avoid matching "total before tax" / "payment total" as bare "total"
  if (label.includes("before") || label.includes("payment") || label.includes("pago")) {
    return false;
  }
  return (
    label === "total" ||
    label === "total:" ||
    label.startsWith("total ") ||
    label.includes("grand total") ||
    label.includes("total del pedido") ||
    label.includes("order total") ||
    label.includes("gesamtbetrag") ||
    label.includes("total de la commande")
  );
}

export function extractOrderCost(doc: Document, context: { domain?: string }) {
  const container =
    doc.querySelector('[data-component="chargeSummary"]') ??
    doc.querySelector('[data-component="orderSubtotals"]') ??
    doc.querySelector('[data-component="chargeSummaryLineItems"]')?.parentElement ??
    doc.querySelector("#od-subtotals");

  if (!container) return {};

  const rows = Array.from(
    container.querySelectorAll(
      ".a-row.od-line-item-row, .od-line-item-row, .a-row",
    ),
  );

  const cost: Record<string, any> = {};
  let hasExchangeRateHint = false;

  if (container.textContent?.toLowerCase().includes("exchange rate")) {
    hasExchangeRateHint = true;
  }

  for (const row of rows) {
    const labelElem =
      row.querySelector(".od-line-item-row-label") ??
      row.querySelector(".a-column.a-span7") ??
      row.querySelector(".a-span7");

    const valueElem =
      row.querySelector(".od-line-item-row-content") ??
      row.querySelector(".a-column.a-span5") ??
      row.querySelector(".a-span5") ??
      row.querySelector(".a-color-price, .a-offscreen");

    if (!labelElem || !valueElem) continue;

    const label = labelElem.textContent?.replace(/\s+/g, " ").trim().toLowerCase();
    const valueText = valueElem.textContent?.replace(/\s+/g, " ").trim();
    if (!label || !valueText) continue;

    const parsed = parseMoney(valueText, context);
    if (!Number.isFinite(parsed.amount)) continue;

    const currency = parsed.currency;
    const isUSD = currency === "USD";
    const amount = parsed.amount;

    if (matchLabel(label, LABEL_MAP.payment_total)) {
      cost.payment_total = amount;
      cost.payment_currency = currency;
      continue;
    }

    if (matchLabel(label, LABEL_MAP.total_before_tax)) {
      cost.total_before_tax = amount;
      continue;
    }

    if (matchLabel(label, LABEL_MAP.tax)) {
      cost.tax = (cost.tax ?? 0) + amount;
      continue;
    }

    if (matchLabel(label, LABEL_MAP.shipping) && !label.includes("tax")) {
      cost.shipping = amount;
      continue;
    }

    if (matchLabel(label, LABEL_MAP.subtotal)) {
      cost.subTotal = amount;
      continue;
    }

    if (matchLabel(label, LABEL_MAP.grand_total) || isExactOrPrefixedTotal(label)) {
      cost.original_total = amount;
      cost.original_currency = currency;
      if (hasExchangeRateHint && isUSD) {
        cost.payment_total = amount;
        cost.payment_currency = currency;
      }
      continue;
    }
  }

  cost.original_cost = cost.original_total ?? cost.subTotal ?? 0;

  return cost;
}
