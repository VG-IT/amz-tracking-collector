import { SOURCE_BY_MARKETPLACE, type Marketplace } from "../../config";
import { sendClickLog } from "../../services/api";
import { syncOrders } from "../../order";
import {
  formatExtractedOrdersLog,
  takeExtractedOrders,
} from "../../order/save/format-extracted-orders";
import {
  clearTask,
  getTaskSettings,
  isStopRequested,
  isTaskRunning,
  refreshTaskTTL,
} from "./task";
import { buildContext, getCurrentAmazonCountry, isLogged, isLoginPage } from "./env";
import { prepareEnglishLocaleSwitch } from "./ensure-english";
import { loadUser } from "./user";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureOrdersReady(timeout = 90000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let firstCardsSeenAt: number | null = null;

    const check = async () => {
      const hasOrderNumber = document.body.innerText.match(/\b\d{3}-\d{7}-\d{7}\b/);

      const orderDetailLinks =
        document.querySelectorAll('a[href*="order-details"], a[href*="your-account"]').length > 0;

      const productLinks =
        document.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]').length > 0;

      const cards = document.querySelectorAll("div.order-card, div#orderCard");
      const hasOrderCards = cards.length > 0;
      const hasSkeletonCards =
        hasOrderCards && Array.from(cards).some((card) => card.querySelector(".skeleton"));

      if (hasOrderCards && firstCardsSeenAt === null) {
        firstCardsSeenAt = Date.now();
      }

      const cardsStableForMs = firstCardsSeenAt === null ? 0 : Date.now() - firstCardsSeenAt;
      const fallbackReady = hasOrderCards && cardsStableForMs > 8000;

      if (
        hasOrderCards &&
        (hasOrderNumber || orderDetailLinks || productLinks || !hasSkeletonCards || fallbackReady)
      ) {
        await sleep(1000);
        resolve();
        return;
      }

      if (Date.now() - start > timeout) {
        reject(new Error("Amazon orders page did not hydrate order data in time"));
        return;
      }

      setTimeout(() => {
        void check();
      }, 400);
    };

    void check();
  });
}

function reportProgress(phase: string, progress = "", logLine?: string) {
  chrome.runtime
    .sendMessage({
      type: "COLLECTOR_PROGRESS",
      payload: { phase, progress, log: logLine },
    })
    .catch(() => {});
}

function reportDone(status: string, error?: string) {
  chrome.runtime
    .sendMessage({
      type: "COLLECTOR_DONE",
      payload: { status, error },
    })
    .catch(() => {});
}

function logExtractedOrdersIfNeeded(uploadToEverymarket: boolean) {
  if (uploadToEverymarket) {
    takeExtractedOrders();
    return;
  }
  const records = takeExtractedOrders();
  for (const line of formatExtractedOrdersLog(records)) {
    reportProgress("Dry-run summary", "", line);
  }
}

export async function runOnce() {
  if (!isTaskRunning()) return;

  if (isLoginPage()) {
    clearTask();
    reportDone("logged_out");
    return;
  }

  const settings = getTaskSettings();
  const country = getCurrentAmazonCountry();
  const marketplace = (settings?.marketplace || country || "us") as Marketplace;
  const uploadToEverymarket = settings?.uploadToEverymarket !== false;

  // Switch to English UI before scraping when the marketplace supports it.
  const englishSwitchUrl = prepareEnglishLocaleSwitch(marketplace);
  if (englishSwitchUrl) {
    reportProgress(
      "Switching language",
      marketplace,
      `Switching Amazon UI to English (${marketplace}) before extraction`,
    );
    location.href = englishSwitchUrl;
    return;
  }

  try {
    await ensureOrdersReady();
  } catch (err) {
    clearTask();
    reportDone("error", (err as Error).message);
    return;
  }

  refreshTaskTTL();

  if (isStopRequested()) {
    logExtractedOrdersIfNeeded(uploadToEverymarket);
    clearTask();
    reportDone("stopped");
    return;
  }

  if (!country || !isLogged(country)) {
    clearTask();
    reportDone("logged_out");
    return;
  }

  const pageUser = await loadUser();
  const email = (settings?.email || pageUser?.email || "").trim();
  if (!email) {
    clearTask();
    reportDone("error", "Missing buyer email");
    return;
  }

  const user = {
    name: pageUser?.name || email,
    email,
    source: SOURCE_BY_MARKETPLACE[marketplace] || "AMZ_US",
  };

  if (uploadToEverymarket && settings?.token) {
    await chrome.storage.local.set({ token: settings.token });
  }

  reportProgress(
    "Collecting orders",
    location.href,
    `Collecting as ${email}` + (uploadToEverymarket ? "" : " (upload disabled)"),
  );
  if (uploadToEverymarket) {
    sendClickLog(user.email);
  }

  const context = buildContext();
  const lookbackDays = Number(settings?.days) || 30;

  try {
    const isDone = await syncOrders(user, context, {
      lookbackDays,
      uploadToEverymarket,
      shouldStop: () => isStopRequested(),
      onProgress: (phase, progress, logLine) => reportProgress(phase, progress, logLine),
    });

    if (isStopRequested()) {
      logExtractedOrdersIfNeeded(uploadToEverymarket);
      clearTask();
      reportDone("stopped");
      return;
    }

    if (isDone) {
      logExtractedOrdersIfNeeded(uploadToEverymarket);
      clearTask();
      reportDone("completed");
    } else {
      refreshTaskTTL();
    }
  } catch (err) {
    console.error("Order fetch failed:", err);
    logExtractedOrdersIfNeeded(uploadToEverymarket);
    clearTask();
    const message = (err as Error).message || String(err);
    if (message === "LOGGED_OUT") reportDone("logged_out");
    else if (message.includes("Stopped")) reportDone("stopped");
    else reportDone("error", message);
  }
}
