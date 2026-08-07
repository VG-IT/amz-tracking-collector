import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  CANCELLED_STATUS,
  isOrderCancelled,
} from "@/order/extract/extract-order-cancelled";
import { buildOrderFromCurrentDocument } from "@/order/flow/build-order-from-number";
import { buildShipments } from "@/order/flow/build-shipments";
import { normalizeShipmentStatus } from "@/shipment/extract/extract-shipment-status";
import { toOrderRecord } from "@/persistence/to-order-record";
import { loadHTML } from "../../utils/load-html";

function loadHtmlFixture(filename: string): Document {
  const html = readFileSync(
    join(__dirname, "..", "..", "html-fixtures", filename),
    "utf-8",
  );
  return new DOMParser().parseFromString(html, "text/html");
}

describe("cancelled order recognition", () => {
  it("detects cancelledOrderBanner in canceled-order.html", () => {
    const doc = loadHtmlFixture("canceled-order.html");
    expect(isOrderCancelled(doc)).toBe(true);
  });

  it("does not treat empty cancelled slots on normal orders as cancelled", () => {
    const doc = loadHTML("order/111-6784099-6345037.html");
    expect(isOrderCancelled(doc)).toBe(false);
  });

  it("does not invent a shipment for a cancelled order", async () => {
    const doc = loadHtmlFixture("canceled-order.html");
    expect(await buildShipments(doc)).toEqual({});
  });

  it("leaves shipments empty for an old order that has no shipment blocks", async () => {
    const doc = new DOMParser().parseFromString(
      `<html><body>
         <div id="orderDetails">
           <span class="a-color-secondary">Order #</span>
           <span>111-2223334-5556667</span>
           <div class="" data-component="cancelled"></div>
           <div class="" data-component="shipments"></div>
         </div>
       </body></html>`,
      "text/html",
    );

    expect(isOrderCancelled(doc)).toBe(false);
    expect(await buildShipments(doc)).toEqual({});
  });

  it("ignores an empty cancelledOrderBanner slot", () => {
    const doc = new DOMParser().parseFromString(
      `<html><body>
         <div class="" data-component="cancelledOrderBanner"></div>
       </body></html>`,
      "text/html",
    );

    expect(isOrderCancelled(doc)).toBe(false);
  });

  it("marks ops-requested cancelled orders as cancelled without tracking pages", () => {
    const doc = loadHtmlFixture("canceled-order.html");
    const result = buildOrderFromCurrentDocument(
      "111-5965378-4991429",
      { domain: "amazon.com" },
      doc,
    );

    expect(result).not.toBeNull();
    expect(result!.trackingPages).toEqual([]);
    expect(result!.order).toMatchObject({
      orderNumber: "111-5965378-4991429",
      status: CANCELLED_STATUS,
      shipments: {},
    });
    expect(toOrderRecord(result!.order, { domain: "amazon.com" })).toMatchObject({
      order_number: "111-5965378-4991429",
      status: CANCELLED_STATUS,
      shipments: [],
    });
  });

  it.each([
    ["Cancelled", CANCELLED_STATUS],
    ["Canceled", CANCELLED_STATUS],
    ["This order has been cancelled.", CANCELLED_STATUS],
    ["Pedido cancelado", CANCELLED_STATUS],
    ["Delivered June 14", "Delivered June 14"],
  ])("normalizes status %j → %j", (raw, expected) => {
    expect(normalizeShipmentStatus(raw)).toBe(expected);
  });
});
