// src/persistence/to-order-record.ts
import { Order } from "@/domain/Order";
import { normalizeShipment } from "@/shipment/domain/normalize-shipment";

export function toOrderRecord(
  order: Order,
  context: { domain?: string }
) {
  const cost = order.cost;

  return {
    order_number: order.orderNumber,
    buy_order_date: order.orderDate ?? null,
    status: order.status ?? null,
    ship_to: order.shipTo ?? null,

    address: order.address ?? null,
    payment_method: order.paymentMethod ?? null,

		cost: {
			sub_total: cost.subTotal ?? 0,
			shipping: cost.shipping ?? 0,
			tax: cost.tax ?? 0,
			original_currency: cost.original_currency,
			original_cost: cost.original_cost,
			usd_cost: cost.usd_cost,
			final_paid_usd: cost.final_paid_usd ?? cost.usd_cost,
			exchange_rate: cost.exchange_rate,
			payment_currency: cost.payment_currency,
			payment_total: cost.payment_total,
		},

    shipments: Object.values(order.shipments ?? []).map( raw => normalizeShipment(raw, context))
  };
}

