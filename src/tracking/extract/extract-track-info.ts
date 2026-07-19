import {
  TRACK_NUMBER_SELECTOR,
  CARRIER_SELECTOR,
} from "../selectors";
import { extractTrackInfoFromText } from "./extract-track-text";
import { TrackingInfo } from "../../domain/Tracking";

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text || null;
}

/**
 * Extract tracking number + carrier from a tracking page Document.
 * Prefer the delivery-card fields; never treat random progress-tracker
 * footer/feedback links as the tracking source.
 */
export function extractTrackInfo(doc: Document): TrackingInfo {
  const trackNoStr = normalizeText(
    doc.querySelector(TRACK_NUMBER_SELECTOR)?.textContent,
  );

  const carrierStr = normalizeText(
    doc.querySelector(CARRIER_SELECTOR)?.textContent,
  );

  const carrierCandidate =
    carrierStr && /^delivery info$/i.test(carrierStr) ? null : carrierStr;

  // If the dedicated tracking card is present, use it exclusively.
  if (trackNoStr || carrierCandidate) {
    return extractTrackInfoFromText(trackNoStr, carrierCandidate);
  }

  // Fallback: some sparse pages only expose tracking in event headers.
  const eventCarrier = normalizeText(
    doc.querySelector(".tracking-event-carrier-header")?.textContent,
  );
  const eventTracking = normalizeText(
    doc.querySelector(".tracking-event-trackingId, .pt-delivery-card-trackingId")
      ?.textContent,
  );

  return extractTrackInfoFromText(eventTracking, eventCarrier);
}
