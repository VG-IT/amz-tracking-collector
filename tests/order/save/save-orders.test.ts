import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Order } from "@/domain/Order";

vi.mock("@/services/api", () => ({
  post: vi.fn(async () => true),
}));

import { post } from "@/services/api";
import { getOrderBuyCost, saveOrders } from "@/order/save/save-orders";

function orderWithCost(originalCost: number, orderNumber = "111-0000000-0000001"): Order {
  return {
    orderNumber,
    orderDate: "February 11, 2026",
    shipTo: null,
    address: "",
    cost: {
      subTotal: originalCost,
      shipping: 0,
      tax: 0,
      original_currency: "USD",
      original_cost: originalCost,
      usd_cost: originalCost,
      final_paid_usd: originalCost,
      exchange_rate: 1,
      payment_currency: null,
      payment_total: null,
    },
    shipments: {},
  };
}

describe("saveOrders buy-cost filter", () => {
  beforeEach(() => {
    vi.mocked(post).mockClear();
    vi.mocked(post).mockResolvedValue(true);
  });

  it("treats missing/zero original_cost as buy cost 0", () => {
    expect(getOrderBuyCost(orderWithCost(0))).toBe(0);
    expect(
      getOrderBuyCost({
        ...orderWithCost(0),
        cost: { ...orderWithCost(0).cost, original_cost: undefined },
      } as Order),
    ).toBe(0);
  });

  it("does not upload orders whose buy cost is 0", async () => {
    const result = await saveOrders(
      { email: "buyer@example.com", source: "AMZ_US" },
      [orderWithCost(0), orderWithCost(18.99, "111-0000000-0000002")],
      { domain: "amazon.com" },
    );

    expect(result).toEqual({
      ok: true,
      uploaded: 1,
      skippedZeroCost: 1,
    });
    expect(post).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(post).mock.calls[0][0] as {
      orders: Array<{ order_number: string; cost: { original_cost: number } }>;
    };
    expect(payload.orders).toHaveLength(1);
    expect(payload.orders[0].order_number).toBe("111-0000000-0000002");
    expect(payload.orders[0].cost.original_cost).toBe(18.99);
  });

  it("skips the API call entirely when every order has buy cost 0", async () => {
    const result = await saveOrders(
      { email: "buyer@example.com", source: "AMZ_US" },
      [orderWithCost(0)],
      { domain: "amazon.com" },
    );

    expect(result).toEqual({
      ok: true,
      uploaded: 0,
      skippedZeroCost: 1,
    });
    expect(post).not.toHaveBeenCalled();
  });
});
