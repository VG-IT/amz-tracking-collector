import { describe, it, expect } from "vitest";
import { extractShipmentStatus } from "@/shipment/extract/extract-shipment-status";
import { loadHTML } from "../utils/load-html";

describe("extractShipmentStatus", () => {
  it("extracts shipment status from shipment DOM", () => {
    const doc = loadHTML("order/111-6784099-6345037.html");

    const shipmentElem = doc.querySelector(
      'div[data-component="shipments"] div.a-box',
    );

    expect(shipmentElem).not.toBeNull();

    const shipmentStatus = extractShipmentStatus(shipmentElem!);

    expect(shipmentStatus).toBeDefined();
    expect(typeof shipmentStatus).toBe("string");

    expect(shipmentStatus).toBe("Delivered June 14");
  });
});

