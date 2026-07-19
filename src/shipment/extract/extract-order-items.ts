// src/shipment/extract/extract-order-items.ts
import {
  ORDER_ITEM_SELECTOR,
  ORDER_ITEM_URL_SELECTOR,
  ORDER_ITEM_PRICE_SELECTOR,
  ORDER_ITEM_QUANTITY_SELECTOR,
} from "../selectors";

import { OrderItem } from "@/domain/OrderItem";

/**
 * 从一个 shipment DOM 节点中抽取所有订单商品
 */
export function extractOrderItems(
  shipmentElem: Element,
): Record<string, OrderItem> {
  const elems = shipmentElem.querySelectorAll(ORDER_ITEM_SELECTOR);
  const items: Record<string, OrderItem> = {};

  for (const elem of Array.from(elems)) {
    const item = extractOrderItem(elem);
    if (!item) continue;
    items[item.asin] = item;
  }

  return items;
}

/* ---------------- private helpers ---------------- */
const SYMBOL_TO_CURRENCY: Record<string, string> = {
  "$": "USD",
  "£": "GBP",
  "€": "EUR",
};


function extractAsin(url: string): string | null {
  return (
    url.match(/\/dp\/([A-Z0-9]{8,})/i)?.[1] ??
    url.match(/\/gp\/product\/([A-Z0-9]{8,})/i)?.[1] ??
    url.match(/[?&]asin=([A-Z0-9]{8,})/i)?.[1] ??
    null
  );
}

function extractOrderItem(
  elem: Element,
): OrderItem | null {
  const link = elem.querySelector(ORDER_ITEM_URL_SELECTOR);
  const href =
    link?.getAttribute("data-savepage-href") ||
    link?.getAttribute("href") ||
    null;
  if (!href) return null;

  const asin = extractAsin(href);
  if (!asin) return null;

  const priceEl = elem.querySelector(ORDER_ITEM_PRICE_SELECTOR);
  const priceText =
    priceEl?.textContent?.trim() ||
    priceEl?.getAttribute("aria-label")?.trim() ||
    "";

  const quantity = extractQuantity(elem);

  const originalPrice = extractOriginalAmount(priceText);
  const currencySymbol = extractCurrencySymbol(priceText);

  return {
    asin,
    quantity,
    originalPrice,
    currencySymbol,
    originalCost: Number((originalPrice * quantity).toFixed(2)),
    priceText,
  };
}

function extractCurrencySymbol(priceText: string): string | null {
  const match = priceText.match(/([£$€])/);
  return match ? match[1] : null;
}

function extractQuantity(elem: Element): number {
  const text =
    elem.querySelector(ORDER_ITEM_QUANTITY_SELECTOR)?.textContent?.trim() ||
    elem.textContent?.match(/(?:Qty|Quantity|Cantidad|Menge)\s*[:.]?\s*(\d+)/i)?.[1];
  const n = text ? Number(String(text).replace(/\D/g, "")) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function extractOriginalAmount(priceText: string): number {
  // Prefer last number-like token; support 1,131.00 and 1.131,00
  const european = priceText.match(/(\d{1,3}(?:\.\d{3})+,\d+)/);
  if (european) {
    return Number(european[1].replace(/\./g, "").replace(",", "."));
  }
  const us = priceText.match(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/);
  if (us) {
    return Number(us[1].replace(/,/g, ""));
  }
  const match = priceText.match(/([\d]+(?:[.,]\d+)?)/);
  if (!match) return 0;
  const raw = match[1];
  if (raw.includes(",") && !raw.includes(".")) {
    return Number(raw.replace(",", "."));
  }
  return Number(raw.replace(/,/g, ""));
}

function extractCurrency(priceText: string): string | null {
  if (!priceText) return null;

  // 1️⃣ ISO code：USD 12.34
  const isoMatch = priceText.match(/\b([A-Z]{3})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // 2️⃣ Symbol：$12.34 / £12.34 / €12.34
  const symbolMatch = priceText.match(/^([£$€])/);
  if (symbolMatch) {
    return SYMBOL_TO_CURRENCY[symbolMatch[1]] ?? null;
  }

  return null;
}
