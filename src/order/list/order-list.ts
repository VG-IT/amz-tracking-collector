// src/order/list/order-list.ts
import { buildOrder } from "../flow/build-order";
import { ORDER_SELECTOR } from "./order-selectors";

export async function collectOrdersOnPage(
  context: { domain?: string },
  root: ParentNode = document,
) {
  const cards = root.querySelectorAll(ORDER_SELECTOR);
  console.log("OrdersCount: ", cards.length);

  const orders = await Promise.all(
    Array.from(cards).map((card) =>
      buildOrder(card, context).catch(() => null),
    ),
  );

  return orders.filter(Boolean);
}
