// src/order/extract/extract-order-summary.ts
import { extractOrderNumberFromCard } from "../list/order-selectors";

const ORDER_NUMBER_LABELS = [
  "order #",
  "order no.",
  "order no",
  "pedido n.º",
  "pedido n°",
  "pedido no.",
  "bestellnr.",
  "bestellnr",
  "bestellung #",
  "nº de pedido",
  "numéro de commande",
];

const ORDER_DATE_LABELS = [
  "order placed",
  "pedido realizado",
  "bestellung aufgegeben",
  "bestelldatum",
  "date de commande",
  "commandé le",
];

const SHIP_TO_LABELS = [
  "ship to",
  "enviar a",
  "send to",
  "lieferadresse",
  "versand an",
  "livrer à",
  "expédier à",
];

function normalizeLabel(text: string | null | undefined): string {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/:$/, "");
}

function looksLikeDate(text: string): boolean {
  return (
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
      text,
    ) ||
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(
      text,
    ) ||
    /\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i.test(
      text,
    ) ||
    /\bde\s+\d{4}\b/i.test(text) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)
  );
}

/** Prefer leaf label spans so large containers don't false-match. */
function findLabeledValue(
  root: Element,
  labels: string[],
  valueSelector: string,
): string | null {
  const nodes = Array.from(
    root.querySelectorAll(
      "span.a-color-secondary.a-text-caps, span.a-color-secondary, .a-row.a-color-secondary",
    ),
  );

  for (const node of nodes) {
    const labelText = normalizeLabel(node.textContent);
    if (!labels.some((label) => labelText === label)) {
      continue;
    }

    const container =
      node.closest(".a-column") ||
      node.closest("li.order-header__header-list-item") ||
      node.closest("li") ||
      node.closest(".a-row") ||
      node.parentElement;
    if (!container) continue;

    const value = container.querySelector(valueSelector)?.textContent?.replace(/\s+/g, " ").trim();
    if (value && normalizeLabel(value) !== labelText) return value;

    const sibling = node.parentElement?.querySelector(
      "span.a-color-secondary.aok-break-word, .a-row.a-size-base, .a-text-bold",
    );
    const siblingText = sibling?.textContent?.replace(/\s+/g, " ").trim();
    if (siblingText && normalizeLabel(siblingText) !== labelText) {
      return siblingText;
    }
  }
  return null;
}

export function extractOrderSummary(root: Element) {
  let orderNumber: string | null = null;

  const labelOrder = Array.from(
    root.querySelectorAll("span.a-color-secondary.a-text-caps, span"),
  ).find((el) => {
    const text = normalizeLabel(el.textContent);
    return ORDER_NUMBER_LABELS.some(
      (label) => text === label || text.startsWith(`${label} `),
    );
  });

  const rowOrder =
    labelOrder?.closest(".a-row") ??
    labelOrder?.closest("li") ??
    labelOrder?.parentElement;
  orderNumber = rowOrder?.textContent?.match(/\b\d{3}-\d{7}-\d{7}\b/)?.[0] ?? null;

  if (!orderNumber) {
    orderNumber = extractOrderNumberFromCard(root);
  }
  if (!orderNumber) {
    orderNumber = root.textContent?.match(/\b\d{3}-\d{7}-\d{7}\b/)?.[0] ?? null;
  }

  let orderDate =
    findLabeledValue(
      root,
      ORDER_DATE_LABELS,
      ".a-row.a-size-base, span.a-color-secondary.aok-break-word, .value",
    ) ?? null;

  if (!orderDate) {
    const labelDate = Array.from(root.querySelectorAll(".a-column")).find((col) => {
      const label = normalizeLabel(
        col.querySelector(".a-row.a-color-secondary, span.a-color-secondary.a-text-caps")
          ?.textContent,
      );
      return ORDER_DATE_LABELS.some((l) => label === l);
    });
    orderDate =
      labelDate
        ?.querySelector(".a-row.a-size-base, span.aok-break-word")
        ?.textContent?.replace(/\s+/g, " ")
        .trim() ?? null;
  }

  let shipTo =
    root
      .querySelector(
        ".a-column .a-popover-preload .a-text-bold, .a-popover-trigger .a-text-bold",
      )
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? null;

  if (!shipTo) {
    shipTo =
      findLabeledValue(
        root,
        SHIP_TO_LABELS,
        ".a-popover-preload .a-text-bold, .a-popover-trigger .a-text-bold, .trigger-text",
      ) ?? null;
  }

  // Never accept a date string as ship-to recipient.
  if (shipTo && looksLikeDate(shipTo)) {
    shipTo = null;
  }

  const labelPlacedBy = root.querySelector(
    ".a-column:nth-child(4) .a-truncate-full, [data-component='placedBy']",
  );
  const placedBy = labelPlacedBy?.textContent?.replace(/\s+/g, " ").trim() ?? null;

  return {
    orderNumber: orderNumber ?? "",
    orderDate,
    shipTo,
    placedBy,
  };
}
