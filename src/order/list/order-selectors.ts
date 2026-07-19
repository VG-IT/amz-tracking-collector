// src/order/list/order-selectors.ts
export const ORDER_SELECTOR =
  "div.order-card, div.order-card.js-order-card, div.js-order-card, div#orderCard";
export const NEXT_PAGE_SELECTOR =
  "ul.a-pagination > li.a-last > a, .a-pagination .a-last a";


const ORDER_URL_SELECTOR = `
  a[href*="/gp/css/order-details"],
  a[data-savepage-href*="/gp/css/order-details"],
  a[href*="/your-orders/order-details"],
  a[data-savepage-href*="/your-orders/order-details"],
  a[href*="order-details?orderID="],
  a[data-savepage-href*="order-details?orderID="],
  a[href*="order-details?orderId="],
  a[data-savepage-href*="order-details?orderId="],
  .yohtmlc-order-details-link,
  .yohtmlc-order-level-connections a
`;

export function getOrderDetailUrl(divOrder: Element): string {
  const link = divOrder.querySelector(ORDER_URL_SELECTOR);
  if (!link) {
    throw new Error("Order detail link not found");
  }

  const href =
    link.getAttribute("data-savepage-href") ||
    link.getAttribute("href");

  if (!href) {
    throw new Error("Order detail href missing");
  }

  return href.replace("/gp/css/", "/gp/your-account/");
}

export function extractOrderNumberFromUrl(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url);
    const fullUrl = new URL(
      decoded,
      typeof window !== "undefined" ? window.location.origin : "https://www.amazon.com",
    );

    const byParam =
      fullUrl.searchParams.get("orderID") ||
      fullUrl.searchParams.get("orderId");

    if (byParam) return byParam;

    const raw = fullUrl.toString();
    const byRegexParam = raw.match(/[?&]orderid=(\d{3}-\d{7}-\d{7})/i)?.[1];
    if (byRegexParam) return byRegexParam;

    return raw.match(/\b\d{3}-\d{7}-\d{7}\b/)?.[0] ?? null;
  } catch {
    return decodeURIComponent(url).match(/\b\d{3}-\d{7}-\d{7}\b/)?.[0] ?? null;
  }
}

export function extractOrderNumberFromDocument(doc: Document): string | null {
  return doc.body?.textContent?.match(/\b\d{3}-\d{7}-\d{7}\b/)?.[0] ?? null;
}

export function extractOrderNumberFromAnyUrlInCard(card: Element): string | null {
  for (const el of Array.from(card.querySelectorAll("*"))) {
    const attrs = ["href", "data-savepage-href", "data-a-modal", "data-a-popover"];
    for (const attr of attrs) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const orderNumber = extractOrderNumberFromUrl(value);
      if (orderNumber) return orderNumber;
    }
  }

  return null;
}

export function extractOrderNumberFromCard(card: Element): string | null {
  const links = card.querySelectorAll("a");

  for (const link of Array.from(links)) {
    const href =
      link.getAttribute("data-savepage-href") || link.getAttribute("href");
    if (!href) continue;

    const orderNumber = extractOrderNumberFromUrl(href);
    if (orderNumber) return orderNumber;
  }

  return extractOrderNumberFromAnyUrlInCard(card);
}
