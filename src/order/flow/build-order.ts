// src/order/flow/build-order.ts
import { extractOrderSummary } from "../extract/extract-order-summary";
import { extractOrderCost } from "../extract/extract-order-cost";
import { extractShippingAddress } from "../extract/extract-shipping-address";
import { extractPaymentMethod } from "../extract/extract-payment-method";
import { fetchOrderDetail } from "./fetch-order-detail";
import { buildShipments } from "./build-shipments";
import { normalizeOrderCost } from "@/order/domain/normalize-order-cost";
import { Order } from "@/domain/Order";
import {
  CANCELLED_STATUS,
  isOrderCancelled,
} from "../extract/extract-order-cancelled";

export async function buildOrder(
  orderCard: Element,
  context: {domain?: string}
): Promise<Order> {
  const summary = extractOrderSummary(orderCard);
  const detailDoc = await fetchOrderDetail(orderCard);

	const rawCost = extractOrderCost(detailDoc, context);
	const cost = normalizeOrderCost(rawCost);
  const address = extractShippingAddress(detailDoc);
  const paymentMethod = extractPaymentMethod(detailDoc);

  const shipments = await buildShipments(detailDoc);
  const cancelled = isOrderCancelled(detailDoc);
  return {
    ...summary,
    ...(cancelled ? { status: CANCELLED_STATUS } : {}),
    cost,
    address,
    paymentMethod: paymentMethod ?? undefined,
    shipments,
  };
}

