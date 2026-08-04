import { describe, expect, it } from "vitest";
import {
  isOrdersExpired,
  parseOrderDate,
} from "@/order/domain/is-order-expired";
import type { Order } from "@/domain/Order";

function order(orderDate: string | null, orderNumber = "111-1111111-1111111"): Order {
  return {
    orderNumber,
    orderDate,
    shipTo: null,
    cost: null,
    address: "",
    shipments: {},
  };
}

describe("parseOrderDate", () => {
  it("parses US and UK formats with year", () => {
    expect(parseOrderDate("March 4, 2026")?.toDateString()).toContain("2026");
    expect(parseOrderDate("16 December 2025")?.toDateString()).toContain("2025");
  });

  it("parses Spanish day-month-year", () => {
    const date = parseOrderDate("11 de febrero de 2026");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(1);
    expect(date?.getDate()).toBe(11);
  });

  it("does not treat yearless dates as year 2001", () => {
    const date = parseOrderDate("March 4");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBeGreaterThanOrEqual(2024);
  });
});

describe("isOrdersExpired", () => {
  it("does not stop when only one date is outside lookback", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 2);
    const old = new Date();
    old.setDate(old.getDate() - 90);

    const recentLabel = recent.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const oldLabel = old.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    expect(
      isOrdersExpired([order(recentLabel, "1"), order(oldLabel, "2")], 30),
    ).toBe(false);
  });

  it("stops when every dated order is outside lookback", () => {
    const old = new Date();
    old.setDate(old.getDate() - 90);
    const oldLabel = old.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    expect(isOrdersExpired([order(oldLabel, "1"), order(oldLabel, "2")], 30)).toBe(
      true,
    );
  });

  it("does not stop when dates cannot be parsed", () => {
    expect(isOrdersExpired([order("not a date"), order(null)], 30)).toBe(false);
  });
});
