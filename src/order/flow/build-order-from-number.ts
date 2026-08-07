// src/order/flow/build-order-from-number.ts
import { extractOrderCost } from "../extract/extract-order-cost";
import { extractShippingAddress } from "../extract/extract-shipping-address";
import { extractPaymentMethod } from "../extract/extract-payment-method";
import { extractOrderSummary } from "../extract/extract-order-summary";
import { fetchOrderDetail } from "./fetch-order-detail";
import { buildShipments } from "./build-shipments";
import { normalizeOrderCost } from "@/order/domain/normalize-order-cost";
import { Order } from "@/domain/Order";

export function orderDetailUrlForNumber(
  orderNumber: string,
  domain?: string,
): string {
  const origin =
    domain && domain.length > 0
      ? `https://${domain.replace(/^https?:\/\//, "")}`
      : typeof window !== "undefined"
        ? window.location.origin
        : "https://www.amazon.com";
  return `${origin}/gp/your-account/order-details?orderID=${encodeURIComponent(orderNumber)}`;
}

/** Build an order by opening Amazon order-detail HTML directly (ops-requested numbers). */
export async function buildOrderFromOrderNumber(
  orderNumber: string,
  context: { domain?: string },
): Promise<Order | null> {
  const url = orderDetailUrlForNumber(orderNumber, context.domain);
  const detailDoc = await fetchOrderDetail(url);
  const root = detailDoc.body || detailDoc.documentElement;
  if (!root) return null;

  const summary = extractOrderSummary(root);
  if (!summary.orderNumber) summary.orderNumber = orderNumber;

  const rawCost = extractOrderCost(detailDoc, context);
  const cost = normalizeOrderCost(rawCost);
  const address = extractShippingAddress(detailDoc);
  const paymentMethod = extractPaymentMethod(detailDoc);
  const shipments = await buildShipments(detailDoc);

  return {
    ...summary,
    cost,
    address,
    paymentMethod: paymentMethod ?? undefined,
    shipments,
  };
}
