import { collectOrdersOnPage } from "./list/order-list";
import { saveOrders } from "./save/save-orders";
import {
  fetchNextOrdersDocument,
  getOrdersPageSignature,
} from "./list/pagination";
import {
  describeLookbackStop,
  isOrdersExpired,
} from "./domain/is-order-expired";
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
  root: ParentNode,
): Promise<Order[]> {
  let orders = (await collectOrdersOnPage(context, root)).filter(
    (o): o is Order => o !== null,
  );

  // Live document only: fetched HTML is already complete.
  if (root !== document) return orders;

  for (let attempt = 1; attempt <= 3 && orders.length === 0; attempt++) {
    if (options.shouldStop?.()) throw new Error("Stopped by user");
    options.onProgress?.(
      "Collecting orders",
      `page ${page}, waiting`,
      `Orders page ${page} still empty, waiting for load (retry ${attempt}/3)`,
    );
    await sleep(1000 * attempt);
    await ensureOrdersReady(60_000);
    orders = (await collectOrdersOnPage(context, root)).filter(
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
  let listRoot: Document | ParentNode = document;
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

    if (listRoot === document) {
      await ensureOrdersReady(90_000);
    }

    const pageSignature = getOrdersPageSignature(listRoot);
    if (page > 1 && pageSignature && pageSignature === previousSignature) {
      options.onProgress?.(
        "Collecting orders",
        "done",
        `Pagination did not advance past page ${page - 1}; stopping to avoid duplicates`,
      );
      return true;
    }
    previousSignature = pageSignature;

    const validOrders = await collectOrdersWithRetry(
      context,
      options,
      page,
      listRoot,
    );

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
        describeLookbackStop(validOrders, lookbackDays),
      );
      return true;
    }

    options.onProgress?.(
      "Collecting orders",
      `page ${page} next`,
      `Fetching orders page ${page + 1}`,
    );

    const nextDoc = await fetchNextOrdersDocument(
      listRoot instanceof Document ? listRoot : document,
      page,
    );
    if (!nextDoc) {
      options.onProgress?.(
        "Collecting orders",
        "done",
        "No next orders page",
      );
      return true;
    }

    listRoot = nextDoc;
    page += 1;
  }
}
