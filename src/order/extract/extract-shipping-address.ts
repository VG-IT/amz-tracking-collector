export function extractShippingAddress(doc: Document): string {
  const containers = [
    doc.querySelector('[data-component="shippingAddress"]'),
    doc.querySelector('[data-component="deliveryAddress"]'),
    doc.querySelector("#shippingAddress"),
    doc.querySelector(".shipping-address"),
  ].filter(Boolean) as Element[];

  for (const container of containers) {
    // Preserve intra-line spacing from the fixture/page (only trim ends).
    const fromList = Array.from(container.querySelectorAll("ul li"))
      .map((li) => li.textContent?.trim())
      .filter((text): text is string => !!text && text.length > 1);

    if (fromList.length) {
      return fromList.join(", ");
    }

    const spans = Array.from(
      container.querySelectorAll(".displayAddressDiv .a-span12, .a-list-item"),
    )
      .map((el) => el.textContent?.trim())
      .filter(
        (text): text is string =>
          !!text && text.length > 1 && !/^ship to$/i.test(text),
      );

    if (spans.length) {
      return [...new Set(spans)].join(", ");
    }
  }

  return "";
}
