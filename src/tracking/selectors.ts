export const TRACK_LINK_SELECTOR = [
  'div[data-component="shipmentConnections"] a',
  "span.track-package-button a",
].join(", ");

export const TRACK_NUMBER_SELECTOR = [
  "div.pt-delivery-card-trackingId",
  "span.pt-delivery-card-trackingId",
  ".tracking-event-trackingId",
  '[data-component="trackingId"]',
].join(", ");

export const CARRIER_SELECTOR = [
  "section.pt-card.delivery-card h3.a-spacing-small",
  "section.delivery-card h3.a-spacing-small",
  "h3.a-spacing-small",
  ".tracking-event-carrier-header",
  '[data-component="carrierName"]',
].join(", ");
