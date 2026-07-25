import { isTaskRunning, preparePluginNavigation, requestStop, startTask, type TaskSettings } from "./task";
import { isLoginPage } from "./env";
import { runOnce } from "./run-once";
import { disableCloseGuard } from "./close-guard";

function getFullUrl(relativePath: string) {
  return new URL(relativePath, window.location.origin).href;
}

export function goToOrderHistoryPage() {
  const orderHistoryPage = "/your-orders/orders";
  const fullUrl = getFullUrl(orderHistoryPage);
  console.log("Go to order history:", fullUrl);
  preparePluginNavigation(fullUrl);
  window.location.href = fullUrl;
}

export function initMessageListener() {
  chrome.runtime.onMessage.addListener(
    (
      message: { type?: string; payload?: Partial<TaskSettings> },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (message?.type === "ping") {
        sendResponse({ ok: true });
        return false;
      }

      if (message?.type === "isLoginPage") {
        sendResponse({ ok: true, isLoginPage: isLoginPage() });
        return false;
      }

      if (message?.type === "stopCollect") {
        requestStop();
        sendResponse({ ok: true });
        return false;
      }

      // Background closes collector tabs; don't block with beforeunload.
      if (message?.type === "allowTabClose") {
        disableCloseGuard();
        preparePluginNavigation();
        sendResponse({ ok: true });
        return false;
      }

      if (message?.type === "startCollect" || message?.type === "fetchOrders") {
        if (isTaskRunning()) {
          sendResponse({ status: "already_running" });
          return false;
        }

        const payload = (message.payload || {}) as Partial<TaskSettings>;
        const settings: TaskSettings = {
          email: (payload.email || "").trim(),
          days: Number(payload.days) || 30,
          marketplace: payload.marketplace || "us",
          token: payload.token,
          uploadToEverymarket: payload.uploadToEverymarket !== false,
        };

        startTask(settings);

        const onOrdersPage = /\/your-orders\/orders|\/gp\/your-account\/order-history/i.test(
          location.pathname + location.hash,
        );

        sendResponse({ status: "started" });

        if (onOrdersPage) {
          void runOnce();
        } else {
          goToOrderHistoryPage();
        }
        return false;
      }

      return false;
    },
  );
}
