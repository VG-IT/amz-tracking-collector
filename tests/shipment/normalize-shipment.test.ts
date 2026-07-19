import { describe, it, expect } from "vitest";
import { normalizeShipment } from "@/shipment/domain/normalize-shipment";
import { EXPECTED_SHIPMENT_ITEMS } from "../fixtures/order/expected-shipment-items";
import { mapExtractedItemsToNormalized } from "../helpers/map-extracted-to-normalized";

describe("normalizeShipment – currency inference by domain", () => {
  const cases = [
    {
      name: "US marketplace infers USD from $",
      file: "order/111-6784099-6345037.html",
      domain: "www.amazon.com",
      expectedCurrency: "USD",
    },
    {
      name: "UK marketplace infers GBP from £",
      file: "order/205-1398827-7402717.html",
      domain: "www.amazon.co.uk",
      expectedCurrency: "GBP",
    },
    {
      name: "MX marketplace infers MXN from $",
      file: "order/mx/702-8792653-5071433.html",
      domain: "www.amazon.com.mx",
      expectedCurrency: "MXN",
    },
  ];

  it.each(cases)("$name", ({ file, domain, expectedCurrency }) => {
    const extractedItems = EXPECTED_SHIPMENT_ITEMS[file];

    const raw = mapExtractedItemsToNormalized(extractedItems, domain);

    const normalized = normalizeShipment(raw, { domain });

    const item = normalized.items[0];

    expect(item.currency).toBe(expectedCurrency);
  });
});

