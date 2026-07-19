import type { Order } from "../../domain/Order";

export function isOrdersExpired(orders: Order[], lookbackDays = 30): boolean {
  return orders.some((order) => order.orderDate && isExpired(order.orderDate, lookbackDays));
}

function isExpired(dateStr: string, lookbackDays: number): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(1, lookbackDays));

  return date < cutoff;
}
