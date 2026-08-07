import type { Order } from "@/domain/Order";
import { saveOrders } from "../save/save-orders";
import {
  buildOrderFromCurrentDocument,
  orderDetailUrlForNumber,
  type PendingTrackingPage,
} from "./build-order-from-number";
import { extractTrackInfo } from "@/tracking/extract/extract-track-info";
import { CARRIER_SELECTOR, TRACK_NUMBER_SELECTOR } from "@/tracking/selectors";
import {
  preparePluginNavigation,
  refreshTaskTTL,
  TASK_PENDING_NAV_KEY,
} from "@/content/runtime/task";

type User = { email: string; source: string; name?: string };
type Context = { domain?: string };
type Progress = (phase: string, progress?: string, logLine?: string) => void;

type NavigationState = {
  remaining: string[];
  currentOrderNumber?: string;
  currentOrder?: Order;
  trackingPages: PendingTrackingPage[];
  currentTracking?: PendingTrackingPage;
  uploadToEverymarket: boolean;
};

function readState(): NavigationState | null {
  try {
    const raw = sessionStorage.getItem(TASK_PENDING_NAV_KEY);
    return raw ? (JSON.parse(raw) as NavigationState) : null;
  } catch {
    return null;
  }
}

function writeState(state: NavigationState) {
  sessionStorage.setItem(TASK_PENDING_NAV_KEY, JSON.stringify(state));
  refreshTaskTTL();
}

function navigate(url: string) {
  preparePluginNavigation(url);
  location.href = url;
}

async function waitForOpenedPage(state: NavigationState, timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const bodyText = document.body?.innerText || "";
    const trackingReady =
      state.currentTracking &&
      document.querySelector(`${TRACK_NUMBER_SELECTOR}, ${CARRIER_SELECTOR}`);
    const detailReady =
      !state.currentTracking &&
      !!state.currentOrderNumber &&
      bodyText.includes(state.currentOrderNumber) &&
      bodyText.length > 500;

    if (trackingReady || detailReady) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

function navigateToNextOrder(state: NavigationState, context: Context, onProgress: Progress) {
  const orderNumber = state.remaining.shift();
  if (!orderNumber) {
    sessionStorage.removeItem(TASK_PENDING_NAV_KEY);
    return false;
  }

  state.currentOrderNumber = orderNumber;
  state.currentOrder = undefined;
  state.trackingPages = [];
  state.currentTracking = undefined;
  writeState(state);

  const url = orderDetailUrlForNumber(orderNumber, context.domain);
  onProgress(
    "Collecting requested orders",
    orderNumber,
    `Opening ops-requested order detail page: ${orderNumber}`,
  );
  navigate(url);
  return true;
}

export function hasPendingNavigation(): boolean {
  return readState() !== null;
}

/** Starts browser-page navigation. Returns false when there is nothing to collect. */
export function startOrderNavigation(
  orderNumbers: Iterable<string>,
  context: Context,
  uploadToEverymarket: boolean,
  onProgress: Progress,
): boolean {
  const state: NavigationState = {
    remaining: Array.from(orderNumbers),
    trackingPages: [],
    uploadToEverymarket,
  };
  return navigateToNextOrder(state, context, onProgress);
}

async function finishCurrentOrder(
  state: NavigationState,
  user: User,
  context: Context,
  onProgress: Progress,
): Promise<boolean> {
  if (state.currentOrder) {
    const orderNumber = state.currentOrder.orderNumber;
    const result = await saveOrders(user, [state.currentOrder], context, {
      uploadToEverymarket: state.uploadToEverymarket,
    });

    let logLine: string;
    if (result.skippedZeroCost > 0 && result.uploaded === 0) {
      logLine = `Skipped upload for ${orderNumber}: buy cost is 0`;
    } else if (result.ok) {
      logLine = `Uploaded ops-requested order: ${orderNumber}`;
    } else {
      logLine = `Failed to upload ops-requested order: ${orderNumber}`;
    }

    onProgress("Collecting requested orders", orderNumber, logLine);
  }
  return navigateToNextOrder(state, context, onProgress);
}

/**
 * Resumes after a full browser navigation.
 * Returns true only when every requested order has been processed.
 */
export async function resumeOrderNavigation(
  user: User,
  context: Context,
  onProgress: Progress,
): Promise<boolean> {
  const state = readState();
  if (!state) return true;
  await waitForOpenedPage(state);

  if (state.currentTracking && state.currentOrder) {
    const tracking = extractTrackInfo(document);
    const shipment = state.currentOrder.shipments[state.currentTracking.shipmentId] as any;
    if (shipment) shipment.tracking = tracking;

    onProgress(
      "Collecting requested tracking",
      state.currentOrderNumber,
      `Read tracking page for ${state.currentOrderNumber}: ${tracking.tracking || "tracking number unavailable"}`,
    );

    state.currentTracking = state.trackingPages.shift();
    if (state.currentTracking) {
      writeState(state);
      navigate(state.currentTracking.url);
      return false;
    }
    return !(await finishCurrentOrder(state, user, context, onProgress));
  }

  const orderNumber = state.currentOrderNumber;
  if (!orderNumber) {
    return !navigateToNextOrder(state, context, onProgress);
  }

  const result = buildOrderFromCurrentDocument(orderNumber, context);
  if (!result) {
    onProgress(
      "Collecting requested orders",
      orderNumber,
      `Unable to read opened order detail page: ${orderNumber}`,
    );
    return !navigateToNextOrder(state, context, onProgress);
  }

  state.currentOrder = result.order;
  state.trackingPages = result.trackingPages;
  state.currentTracking = state.trackingPages.shift();

  onProgress(
    "Collecting requested orders",
    orderNumber,
    `Read opened order detail page: ${orderNumber}`,
  );

  if (state.currentTracking) {
    writeState(state);
    onProgress(
      "Collecting requested tracking",
      orderNumber,
      `Opening tracking page for ${orderNumber}`,
    );
    navigate(state.currentTracking.url);
    return false;
  }

  return !(await finishCurrentOrder(state, user, context, onProgress));
}
