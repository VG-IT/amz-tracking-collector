import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildOrderFromCurrentDocument } from "@/order/flow/build-order-from-number";
import { toOrderRecord } from "@/persistence/to-order-record";

function loadNoStatusFixture(): Document {
  const html = readFileSync(
    join(__dirname, "..", "..", "html-fixtures", "no-status.html"),
    "utf-8",
  );
  return new DOMParser().parseFromString(html, "text/html");
}

describe("order detail without shipment status", () => {
  it("extracts the order number and buy date", () => {
    const result = buildOrderFromCurrentDocument(
      "111-2711301-5210609",
      { domain: "amazon.com" },
      loadNoStatusFixture(),
    );

    expect(result).not.toBeNull();
    expect(result!.order).toMatchObject({
      orderNumber: "111-2711301-5210609",
      orderDate: "February 11, 2026",
    });
    expect(result!.order.status).toBeUndefined();
    expect(result!.trackingPages).toEqual([]);
  });

  it("creates an upload record when order and shipment statuses are absent", () => {
    const result = buildOrderFromCurrentDocument(
      "111-2711301-5210609",
      { domain: "amazon.com" },
      loadNoStatusFixture(),
    );

    const record = toOrderRecord(result!.order, { domain: "amazon.com" });
    expect(record).toMatchObject({
      order_number: "111-2711301-5210609",
      buy_order_date: "February 11, 2026",
      status: null,
    });
    expect(record.shipments).toEqual([
      expect.objectContaining({
        status: null,
      }),
    ]);
  });
});
