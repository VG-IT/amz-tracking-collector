/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://www.amazon.com/your-orders/orders" }
 */
import { describe, it, expect } from "vitest";
import { orderDetailUrlForNumber } from "@/order/flow/build-order-from-number";

describe("orderDetailUrlForNumber", () => {
  it("stays on the page origin when the marketplace domain matches", () => {
    expect(orderDetailUrlForNumber("111-1084728-2933044", "amazon.com")).toBe(
      "https://www.amazon.com/gp/your-account/order-details?orderID=111-1084728-2933044",
    );
  });

  it("falls back to the canonical www host for another marketplace", () => {
    expect(orderDetailUrlForNumber("202-9691085-8778754", "amazon.co.uk")).toBe(
      "https://www.amazon.co.uk/gp/your-account/order-details?orderID=202-9691085-8778754",
    );
  });

  it("uses the page origin when no domain is given", () => {
    expect(orderDetailUrlForNumber("111-1084728-2933044")).toBe(
      "https://www.amazon.com/gp/your-account/order-details?orderID=111-1084728-2933044",
    );
  });
});
