import { collectOrdersOnPage } from "./list/order-list";
import { saveOrders } from "./save/save-orders";
import {
  getOrdersPageSignature,
  goToNextOrdersPageViaUi,
} from "./list/pagination";
import {
  describeLookbackStop,
  isOrdersExpired,
  parseOrderDate,
} from "./domain/is-order-expired";
import { Order } from "@/domain/Order";
import { ensureOrdersReady } from "@/content/runtime/run-once";
import { getTaskPage, setTaskPage } from "@/content/runtime/task";

export type SyncOptions = {
  lookbackDays?: number;
  uploadToEverymarket?: boolean;
  shouldStop?: () => boolean;
  onProgress?: (phase: string, progress?: string, logLine?: string) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeNewestDates(orders: Order[], limit = 3): string {
  const dated = orders
    .map((order) => ({
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      parsed: parseOrderDate(order.orderDate),
    }))
    .filter((item): item is typeof item & { parsed: Date } => item.parsed != null)
    .sort((a, b) => b.parsed.getTime() - a.parsed.getTime())
    .slice(0, limit);

  if (dated.length === 0) return "no parseable dates";
  return dated
    .map(
      (item) =>
        `${item.orderNumber || "?"} (${item.orderDate} → ${item.parsed.toISOString().slice(0, 10)})`,
    )
    .join(", ");
}

async function collectOrdersWithRetry(
  context: { domain?: string },
  options: SyncOptions,
  page: number,
): Promise<Order[]> {
  let orders = (await collectOrdersOnPage(context, document)).filter(
    (o): o is Order => o !== null,
  );

  for (let attempt = 1; attempt <= 3 && orders.length === 0; attempt++) {
    if (options.shouldStop?.()) throw new Error("Stopped by user");
    options.onProgress?.(
      "Collecting orders",
      `page ${page}, waiting`,
      `Orders page ${page} still empty, waiting for load (retry ${attempt}/3)`,
    );
    await sleep(1000 * attempt);
    await ensureOrdersReady(60_000);
    orders = (await collectOrdersOnPage(context, document)).filter(
      (o): o is Order => o !== null,
    );
  }

  return orders;
}

/**
 * Scrape the live orders list, advancing only via on-page pagination controls.
 * Returns true when collection is finished; false when a full page navigation
 * is in progress and runOnce should resume on the next document.
 */
export async function syncOrders(
  user: { email: string; source: string; name?: string },
  context: { domain?: string },
  options: SyncOptions = {},
) {
  const lookbackDays = options.lookbackDays ?? 30;
  const uploadToEverymarket = options.uploadToEverymarket !== false;
  let page = getTaskPage();
  let previousSignature = "";

  while (true) {
    if (options.shouldStop?.()) {
      throw new Error("Stopped by user");
    }

    options.onProgress?.(
      "Collecting orders",
      `page ${page}`,
      `Scraping orders page ${page}`,
    );

    await ensureOrdersReady(90_000);

    const pageSignature = getOrdersPageSignature(document);
    if (page > 1 && pageSignature && pageSignature === previousSignature) {
      options.onProgress?.(
        "Collecting orders",
        "done",
        `Pagination did not advance past page ${page - 1}; stopping to avoid duplicates`,
      );
      return true;
    }
    previousSignature = pageSignature;

    const validOrders = await collectOrdersWithRetry(context, options, page);

    options.onProgress?.(
      uploadToEverymarket ? "Saving orders" : "Extracting orders",
      `page ${page}, ${validOrders.length} order(s)`,
      `Found ${validOrders.length} orders on page ${page}` +
        (uploadToEverymarket ? "" : " (dry-run, not uploading)") +
        `; dates: ${describeNewestDates(validOrders)}`,
    );

    if (validOrders.length > 0) {
      await saveOrders(user, validOrders, context, { uploadToEverymarket });
    }

    if (options.shouldStop?.()) {
      throw new Error("Stopped by user");
    }

    if (validOrders.length === 0) {
      options.onProgress?.(
        "Collecting orders",
        "done",
        page === 1
          ? "No orders found on page 1 after waiting for page load"
          : `No more orders on page ${page}`,
      );
      return true;
    }

    if (isOrdersExpired(validOrders, lookbackDays)) {
      options.onProgress?.(
        "Collecting orders",
        "done",
        describeLookbackStop(validOrders, lookbackDays),
      );
      return true;
    }

    const nextPage = page + 1;
    setTaskPage(nextPage);
    options.onProgress?.(
      "Collecting orders",
      `page ${page} next`,
      `Scrolling to pagination, then opening orders page ${nextPage}`,
    );

    const result = await goToNextOrdersPageViaUi();

    if (result === "navigating") {
      // Full navigation: content script reloads and runOnce continues.
      return false;
    }

    if (result === "done") {
      options.onProgress?.(
        "Collecting orders",
        "done",
        "No next pagination control",
      );
      return true;
    }

    if (result === "timeout") {
      options.onProgress?.(
        "Collecting orders",
        "done",
        `Pagination control did not load page ${nextPage} in time`,
      );
      return true;
    }

    // SPA advanced in-place.
    page = nextPage;
    setTaskPage(page);
  }
}
