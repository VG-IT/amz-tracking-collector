const CANCELLED_TEXT_RE =
  /\b(cancel+ed|cancelad[oa]s?|storniert|annul[ée]e?)\b/i;

const CANCELLED_BANNER_SELECTOR = [
  '[data-component="cancelledOrderBanner"] .a-alert-heading',
  '[data-component="cancelledOrderBanner"] .a-alert-content',
  '[data-component="cancelled"] .a-alert-heading',
].join(", ");

/**
 * Requires explicit cancellation wording. Empty `cancelled` /
 * `cancelledOrderBanner` slots are rendered on non-cancelled orders, and an
 * order old enough to have no shipment blocks is not cancelled either.
 */
export function isOrderCancelled(doc: Document | Element): boolean {
  for (const node of Array.from(doc.querySelectorAll(CANCELLED_BANNER_SELECTOR))) {
    const text = node.textContent?.replace(/\s+/g, " ").trim() || "";
    if (CANCELLED_TEXT_RE.test(text)) return true;
  }

  return false;
}

/** Canonical status string uploaded for cancelled Amazon orders. */
export const CANCELLED_STATUS = "cancelled";
