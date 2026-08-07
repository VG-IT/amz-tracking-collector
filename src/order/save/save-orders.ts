// src/order/save/save-orders.ts
import { post } from "../../services/api";
import { Order } from "@/domain/Order";
import {
  appendExtractedOrders,
  ordersToRecords,
} from "./format-extracted-orders";

export type SaveOrdersOptions = {
  uploadToEverymarket?: boolean;
};

export type SaveOrdersResult = {
  ok: boolean;
  uploaded: number;
  skippedZeroCost: number;
};

/** Buy cost uses original marketplace amount (historical `buy_cost`). */
export function getOrderBuyCost(order: Order): number {
  const value = Number(
    order.cost?.original_cost ??
      order.cost?.usd_cost ??
      order.cost?.final_paid_usd ??
      0,
  );
  return Number.isFinite(value) ? value : 0;
}

export async function saveOrders(
  user: { email: string; source: string },
  orders: Order[],
  context: { domain?: string },
  options: SaveOrdersOptions = {},
): Promise<SaveOrdersResult> {
  if (!orders.length) {
    return { ok: true, uploaded: 0, skippedZeroCost: 0 };
  }

  const upload = options.uploadToEverymarket !== false;
  const uploadable = upload
    ? orders.filter((order) => getOrderBuyCost(order) > 0)
    : orders;
  const skippedZeroCost = upload ? orders.length - uploadable.length : 0;

  if (!uploadable.length) {
    return { ok: true, uploaded: 0, skippedZeroCost };
  }

  const records = ordersToRecords(uploadable, context);

  if (!upload) {
    appendExtractedOrders(records);
    return { ok: true, uploaded: records.length, skippedZeroCost: 0 };
  }

  const ok = await post({
    orders: records,
    user_email: user.email,
    source: user.source,
  });

  return {
    ok,
    uploaded: ok ? records.length : 0,
    skippedZeroCost,
  };
}
