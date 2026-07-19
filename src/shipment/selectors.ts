export const SHIPMENTS_SELECTOR = [
  'div[data-component="shipments"] div.a-box',
  'div[data-component="shipments"] .a-box-group .a-box',
].join(", ");

export const SHIPMENT_STATUS_SELECTOR = [
  ":scope div.js-shipment-info-container div.a-row:nth-of-type(1) span",
  ":scope div#shipment-top-row h4",
  ":scope .shipment-top-row h4",
  ':scope [data-component="shipmentStatus"] span',
  ":scope .yohtmlc-shipment-status-primaryText",
  ":scope .delivery-box__primary-text",
].join(", ");

export const SHIPMENT_LINK_SELECTOR = ":scope a";

export const ORDER_ITEM_SELECTOR = [
  ":scope div.a-fixed-left-grid",
  ':scope [data-component="item"]',
  ":scope .yohtmlc-item",
].join(", ");

export const ORDER_ITEM_URL_SELECTOR = [
  ":scope div.yohtmlc-item a",
  ':scope div[data-component="itemTitle"] a',
  ':scope a[href*="/dp/"]',
  ':scope a[href*="/gp/product/"]',
].join(", ");

export const ORDER_ITEM_PRICE_SELECTOR = [
  ":scope span.a-color-price",
  ':scope div[data-component="unitPrice"] > span > span.a-offscreen',
  ":scope span.a-offscreen",
  ":scope .a-price .a-offscreen",
].join(", ");

export const ORDER_ITEM_QUANTITY_SELECTOR = [
  ":scope div.od-item-view-qty",
  ':scope [data-component="itemQuantity"]',
  ":scope .item-view-qty",
].join(", ");

export const TRACK_LINK_SELECTOR = [
  ':scope div[data-component="shipmentConnections"] a',
  ":scope span.track-package-button a",
  ':scope a[href*="ship-track"]',
  ':scope a[href*="progress-tracker"]',
].join(", ");

// Back-compat aliases used by older helpers
export const URL_SELECTOR = ORDER_ITEM_URL_SELECTOR;
export const PRICE_SELECTOR = ORDER_ITEM_PRICE_SELECTOR;
export const QUANTITY_SELECTOR = ORDER_ITEM_QUANTITY_SELECTOR;
