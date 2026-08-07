// src/order/domain/normalize-order-cost.ts
import { inferCurrencyFromContext } from "@/domain/currency/infer-currency";

function normalizeShipmentItem(
  raw: Record<string, any>,
  context: { domain?: string }
) {
  let currency = raw.originalCurrency ?? null;

  if (!currency && raw.priceText) {
    const symbol = raw.priceText.trim()[0] ?? null;
    currency = inferCurrencyFromContext(symbol, context);
  }

  return {
    asin: raw.asin,
    quantity: raw.quantity ?? 1,
    price: raw.originalPrice ?? 0,
    currency,
  };
}

export function normalizeShipment(
  raw: Record<string, any>,
  context: { domain?: string }
) {
  return {
    shipment_id: raw.shipmentId ?? null,
    status: raw.status || null,

    tracking: raw.tracking?.tracking ?? null,
    carrier: raw.tracking?.carrier ?? null,

    items: Object.values(raw.items ?? {})
      .map(item =>
        normalizeShipmentItem(item as Record<string, any>, context)
      ),
  };
}
