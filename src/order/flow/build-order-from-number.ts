// src/order/flow/build-order-from-number.ts
import { extractOrderCost } from "../extract/extract-order-cost";
import { extractShippingAddress } from "../extract/extract-shipping-address";
import { extractPaymentMethod } from "../extract/extract-payment-method";
import { extractOrderSummary } from "../extract/extract-order-summary";
import { normalizeOrderCost } from "@/order/domain/normalize-order-cost";
import { Order } from "@/domain/Order";
import { extractShipmentId } from "@/shipment/extract/extract-shipment-id";
import { extractShipmentStatus } from "@/shipment/extract/extract-shipment-status";
import { extractOrderItems } from "@/shipment/extract/extract-order-items";
import { getTrackingPageUrl } from "@/tracking/fetch/fetch-tracking-page";
import {
  CANCELLED_STATUS,
  isOrderCancelled,
} from "../extract/extract-order-cancelled";

function registrableHost(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

/**
 * MV3 content-script fetch is subject to page CORS, so the detail URL must stay
 * on the page's own origin. `context.domain` is the www-less marketplace domain
 * used for currency/record metadata and is not usable as a fetch origin.
 */
function orderDetailOrigin(domain?: string): string {
  const pageOrigin =
    typeof window !== "undefined" ? window.location.origin : "";
  const host = (domain || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (!host) return pageOrigin || "https://www.amazon.com";

  if (pageOrigin) {
    try {
      if (registrableHost(new URL(pageOrigin).hostname) === registrableHost(host)) {
        return pageOrigin;
      }
    } catch {
      // fall through to the canonical host below
    }
  }

  return `https://${/^www\./i.test(host) ? host : `www.${host}`}`;
}

export function orderDetailUrlForNumber(
  orderNumber: string,
  domain?: string,
): string {
  return `${orderDetailOrigin(domain)}/gp/your-account/order-details?orderID=${encodeURIComponent(orderNumber)}`;
}

export type PendingTrackingPage = {
  shipmentId: string;
  url: string;
};

/**
 * Extract an ops-requested order from the currently open detail page.
 * Tracking links are returned for browser navigation instead of being fetched.
 */
export function buildOrderFromCurrentDocument(
  orderNumber: string,
  context: { domain?: string },
  detailDoc: Document = document,
): { order: Order; trackingPages: PendingTrackingPage[] } | null {
  const root = detailDoc.body || detailDoc.documentElement;
  if (!root) return null;

  const summary = extractOrderSummary(root);
  // The opened page was requested by this exact number. Amazon chrome embeds
  // session IDs with the same shape, so page-wide regex matches are unsafe.
  summary.orderNumber = orderNumber;
  const cancelled = isOrderCancelled(detailDoc);

  const rawCost = extractOrderCost(detailDoc, context);
  const cost = normalizeOrderCost(rawCost);
  const address = extractShippingAddress(detailDoc);
  const paymentMethod = extractPaymentMethod(detailDoc);
  const shipments: Record<string, any> = {};
  const trackingPages: PendingTrackingPage[] = [];

  for (const elem of Array.from(
    detailDoc.querySelectorAll('div[data-component="shipments"] div.a-box'),
  )) {
    const shipmentId = extractShipmentId(elem);
    if (!shipmentId) continue;

    shipments[shipmentId] = {
      shipmentId,
      status: extractShipmentStatus(elem),
      items: extractOrderItems(elem),
      tracking: { tracking: null, carrier: null },
    };

    const trackingUrl = getTrackingPageUrl(elem);
    if (trackingUrl) trackingPages.push({ shipmentId, url: trackingUrl });
  }

  return {
    order: {
      ...summary,
      ...(cancelled ? { status: CANCELLED_STATUS } : {}),
      cost,
      address,
      paymentMethod: paymentMethod ?? undefined,
      shipments,
    },
    trackingPages,
  };
}
