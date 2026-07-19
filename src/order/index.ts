import { collectOrdersOnPage } from "./list/order-list";
import { saveOrders } from "./save/save-orders";
import { goToNextPage } from "./list/pagination";
import { isOrdersExpired } from "./domain/is-order-expired";
import { Order } from "@/domain/Order";

export type SyncOptions = {
  lookbackDays?: number;
  uploadToEverymarket?: boolean;
  shouldStop?: () => boolean;
  onProgress?: (phase: string, progress?: string, logLine?: string) => void;
};

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

    options.onProgress?.("Collecting orders", `page ${page}`, `Scraping orders page ${page}`);
    console.log("new page", page);

    const orders = await collectOrdersOnPage(context);
    const validOrders = orders.filter((o): o is Order => o !== null);

    options.onProgress?.(
      uploadToEverymarket ? "Saving orders" : "Extracting orders",
      `page ${page}, ${validOrders.length} order(s)`,
      `Found ${validOrders.length} orders on page ${page}` +
        (uploadToEverymarket ? "" : " (dry-run, not uploading)"),
    );

    await saveOrders(user, validOrders, context, { uploadToEverymarket });

    if (options.shouldStop?.()) {
      throw new Error("Stopped by user");
    }

    if (validOrders.length > 0 && !isOrdersExpired(validOrders, lookbackDays)) {
      await goToNextPage();
      page += 1;
    } else {
      options.onProgress?.(
        "Collecting orders",
        "done",
        validOrders.length === 0
          ? "No more orders"
          : `Reached lookback of ${lookbackDays} day(s)`,
      );
      return true;
    }
  }
}
