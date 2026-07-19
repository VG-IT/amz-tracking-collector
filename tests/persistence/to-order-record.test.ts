import { describe, it, expect } from "vitest";
import { toOrderRecord } from "@/persistence/to-order-record";

describe("toOrderRecord", () => {
  it("maps Order domain object to persistence record correctly", () => {
    const fakeOrder = {
      orderNumber: "111-6784099-6345037",
      orderDate: "June 12, 2025",
      shipTo: "Joy Z",
      cost: {
        subTotal: 4.48,
        shipping: 0,
        tax: 0.36,
        original_currency: "USD",
        original_cost: 4.84,
        usd_cost: 4.84,
        final_paid_usd: 4.84,
        payment_currency: undefined,
        payment_total: undefined,
        exchange_rate: 1,
      },
      address: "2101 E TERRA LN, O FALLON, MO",
      paymentMethod: "AMEX ending in 2044",
      shipments: {
        BW5XJjGqd: {
          shipmentId: "BW5XJjGqd",
          status: "Delivered",
          items: {
            B06XYNHFF2: {
              asin: "B06XYNHFF2",
              originalCost: 4.48,
              originalCurrency: "USD",
              originalPrice: 4.48,
              priceText: "$4.48",
              quantity: 1,
            },
          },
          tracking: {
            carrier: "Amazon",
            tracking: "TBA123",
          },
        },
      },
    };

    const record = toOrderRecord(fakeOrder as any, { domain: "www.amazon.com" });

    expect(record).toEqual({
      order_number: "111-6784099-6345037",
      buy_order_date: "June 12, 2025",
      ship_to: "Joy Z",
      address: "2101 E TERRA LN, O FALLON, MO",
      payment_method: "AMEX ending in 2044",
      cost: {
        sub_total: 4.48,
        shipping: 0,
        tax: 0.36,
        original_currency: "USD",
        original_cost: 4.84,
        usd_cost: 4.84,
        final_paid_usd: 4.84,
        exchange_rate: 1,
        payment_currency: undefined,
        payment_total: undefined,
      },
      shipments: [
        {
          shipment_id: "BW5XJjGqd",
          status: "Delivered",
          tracking: "TBA123",
          carrier: "Amazon",
          items: [
            {
              asin: "B06XYNHFF2",
              quantity: 1,
              price: 4.48,
              currency: "USD",
            },
          ],
        },
      ],
    });
  });
});
