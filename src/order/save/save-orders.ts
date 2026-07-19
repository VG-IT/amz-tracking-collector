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

export async function saveOrders(
  user: { email: string; source: string },
  orders: Order[],
  context: { domain?: string },
  options: SaveOrdersOptions = {},
) {
  if (!orders.length) return;

  const records = ordersToRecords(orders, context);
  const upload = options.uploadToEverymarket !== false;

  if (!upload) {
    appendExtractedOrders(records);
    return;
  }

  await post({ orders: records, user_email: user.email, source: user.source });
}
