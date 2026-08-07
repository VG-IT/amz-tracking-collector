import { SHIPMENT_STATUS_SELECTOR } from "../selectors";
import { CANCELLED_STATUS } from "@/order/extract/extract-order-cancelled";

const CANCELLED_STATUS_RE =
  /\b(cancel+ed|cancelad[oa]s?|storniert|annul[ée]e?)\b/i;

export function normalizeShipmentStatus(status: string): string {
  const text = status.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (CANCELLED_STATUS_RE.test(text)) return CANCELLED_STATUS;
  return text;
}

export function extractShipmentStatus(shipmentElem: Element): string {
  const raw =
    shipmentElem
      .querySelector(SHIPMENT_STATUS_SELECTOR)
      ?.textContent?.trim() ?? "";

  return normalizeShipmentStatus(raw);
}
