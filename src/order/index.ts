import { collectOrdersOnPage } from "./list/order-list";
import { saveOrders } from "./save/save-orders";
import { goToNextPage } from "./list/pagination";
import { isOrdersExpired } from "./domain/is-order-expired";
import { Order } from "@/domain/Order";
import { ensureOrdersReady } from "@/content/runtime/run-once";

export type SyncOptions = {
  lookbackDays?: number;
  uploadToEverymarket?: boolean;
  shouldStop?: () => boolean;
  onProgress?: (phase: string, progress?: string, logLine?: string) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectOrdersWithRetry(
  context: { domain?: string },
  options: SyncOptions,
  page: number,
): Promise<Order[]> {
  let orders = (await collectOrdersOnPage(context)).filter(
    (o): o is Order => o !== null,
  );

  // Slow SPA pagination can briefly yield an empty DOM; wait and retry before
  // treating the page as the end of history.
  for (let attempt = 1; attempt <= 3 && orders.length === 0; attempt++) {
    if (options.shouldStop?.()) throw new Error("Stopped by user");
    options.onProgress?.(
      "Collecting orders",
      `page ${page}, waiting`,
      `Orders page ${page} still empty, waiting for load (retry ${attempt}/3)`,
    );
    await sleep(1000 * attempt);
    await ensureOrdersReady(60_000);
    orders = (await collectOrdersOnPage(context)).filter(
      (o): o is Order => o !== null,
    );
  }

  return orders;
}

export async function syncOrders(
  user: { email: string; source: string; name?: string },
  context: { domain?: string },
  options: SyncOptions = {},
) {
  const lookbackDays = options.lookbackDays ?? 30;
  const uploadToEverymarket = options.uploadToEverymarket !== false;
  let page = 1;

  while (true) {
    if (options.shouldStop?.()) {
      throw new Error("Stopped by user");
    }

    options.onProgress?.(
      "Collecting orders",
      `page ${page}`,
      `Scraping orders page ${page}`,
    );

    const validOrders = await collectOrdersWithRetry(context, options, page);

    options.onProgress?.(
      uploadToEverymarket ? "Saving orders" : "Extracting orders",
      `page ${page}, ${validOrders.length} order(s)`,
      `Found ${validOrders.length} orders on page ${page}` +
        (uploadToEverymarket ? "" : " (dry-run, not uploading)"),
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
        "No more orders after waiting for page load",
      );
      return true;
    }

    if (isOrdersExpired(validOrders, lookbackDays)) {
      options.onProgress?.(
        "Collecting orders",
        "done",
        `Reached lookback of ${lookbackDays} day(s)`,
      );
      return true;
    }

    options.onProgress?.(
      "Collecting orders",
      `page ${page} next`,
      `Opening orders page ${page + 1}`,
    );

    const moved = await goToNextPage();
    if (!moved) {
      options.onProgress?.(
        "Collecting orders",
        "done",
        "No next orders page",
      );
      return true;
    }

    page += 1;
  }
}
