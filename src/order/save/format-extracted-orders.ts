import { toOrderRecord } from "../../persistence/to-order-record";
import type { Order } from "@/domain/Order";

export const EXTRACTED_ORDERS_KEY = "amazon_order_extracted_orders";

export function clearExtractedOrders() {
  sessionStorage.removeItem(EXTRACTED_ORDERS_KEY);
}

export function appendExtractedOrders(records: unknown[]) {
  if (!records.length) return;
  const existing = readExtractedOrders();
  existing.push(...records);
  sessionStorage.setItem(EXTRACTED_ORDERS_KEY, JSON.stringify(existing));
}

export function readExtractedOrders(): unknown[] {
  try {
    const raw = sessionStorage.getItem(EXTRACTED_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function takeExtractedOrders(): unknown[] {
  const records = readExtractedOrders();
  clearExtractedOrders();
  return records;
}

export function ordersToRecords(
  orders: Order[],
  context: { domain?: string },
) {
  return orders.map((order) => toOrderRecord(order, context));
}

export function formatExtractedOrdersLog(records: unknown[]): string[] {
  const lines: string[] = [
    "========== Extracted orders (not uploaded) ==========",
  ];

  if (!records.length) {
    lines.push("(no orders extracted)");
    lines.push("=====================================================");
    return lines;
  }

  lines.push(`Total orders: ${records.length}`);

  for (const raw of records) {
    const order = raw as {
      order_number?: string;
      buy_order_date?: string | null;
      ship_to?: string | null;
      payment_method?: string | null;
      address?: string | null;
      cost?: {
        original_cost?: number;
        original_currency?: string;
        usd_cost?: number;
      };
      shipments?: Array<{
        shipment_id?: string | null;
        status?: string | null;
        tracking?: string | null;
        carrier?: string | null;
        items?: Array<{
          asin?: string;
          quantity?: number;
          price?: number;
          currency?: string | null;
        }>;
      }>;
    };

    const cost =
      order.cost?.original_cost != null
        ? `${order.cost.original_cost} ${order.cost.original_currency || ""}`.trim()
        : "—";

    lines.push(
      `Order ${order.order_number || "?"} | date=${order.buy_order_date || "—"} | shipTo=${order.ship_to || "—"} | pay=${order.payment_method || "—"} | cost=${cost}`,
    );

    if (order.address) {
      lines.push(`  address: ${order.address}`);
    }

    const shipments = order.shipments || [];
    if (!shipments.length) {
      lines.push("  (no shipments)");
      continue;
    }

    for (const shipment of shipments) {
      const tracking = shipment.tracking
        ? `${shipment.tracking}${shipment.carrier ? ` (${shipment.carrier})` : ""}`
        : "no tracking";
      lines.push(
        `  shipment ${shipment.shipment_id || "?"} | ${shipment.status || "—"} | ${tracking}`,
      );
      for (const item of shipment.items || []) {
        lines.push(
          `    - ${item.asin || "?"} x${item.quantity ?? 1}` +
            (item.price != null
              ? ` ${item.price}${item.currency ? ` ${item.currency}` : ""}`
              : ""),
        );
      }
    }
  }

  lines.push("=====================================================");
  return lines;
}
