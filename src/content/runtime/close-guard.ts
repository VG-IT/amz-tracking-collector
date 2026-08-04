const CLOSE_GUARD_MESSAGE =
  "Amazon Tracking Collector is still running. Leave this tab?";

const BANNER_ID = "amz-tracking-collector-close-guard";
export const NAVIGATING_KEY = "amazon_order_task_navigating";

let installed = false;
let allowNextUnload = false;
let allowToken = 0;

function isCollectionActive(): boolean {
  if (sessionStorage.getItem("amazon_order_task") !== "running") return false;
  if (sessionStorage.getItem("amazon_order_task_stop") === "1") return false;
  const expiresAt = Number(sessionStorage.getItem("amazon_order_task_expires") || 0);
  return !!expiresAt && Date.now() <= expiresAt;
}

function isPluginNavigating(): boolean {
  return sessionStorage.getItem(NAVIGATING_KEY) === "1" || allowNextUnload;
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (isPluginNavigating()) {
    allowNextUnload = false;
    return;
  }

  if (!isCollectionActive()) return;

  event.preventDefault();
  event.returnValue = CLOSE_GUARD_MESSAGE;
  return CLOSE_GUARD_MESSAGE;
}

function ensureBanner() {
  if (document.getElementById(BANNER_ID)) return;

  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.setAttribute("role", "status");
  Object.assign(banner.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    zIndex: "2147483647",
    padding: "10px 14px",
    background: "#8a1f1f",
    color: "#fff",
    font: "600 13px/1.4 Segoe UI, system-ui, sans-serif",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,.35)",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  });

  const text = document.createElement("span");
  text.textContent =
    "Amazon Tracking Collector is running — do not close this tab.";

  // Chrome only shows the native close confirm after a user gesture on this page.
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Enable close warning";
  Object.assign(button.style, {
    border: "1px solid #fff",
    background: "transparent",
    color: "#fff",
    font: "600 12px Segoe UI, system-ui, sans-serif",
    padding: "6px 10px",
    borderRadius: "6px",
    cursor: "pointer",
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.textContent = "Close warning enabled";
    button.disabled = true;
    button.style.opacity = "0.75";
    button.style.cursor = "default";
  });

  banner.appendChild(text);
  banner.appendChild(button);
  (document.body || document.documentElement).appendChild(banner);
}

function removeBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

/** Install close confirmation + on-page warning while a collection task is active. */
export function enableCloseGuard() {
  ensureBanner();

  if (!installed) {
    // Capture phase is more reliable with some Amazon SPA handlers.
    window.addEventListener("beforeunload", onBeforeUnload, true);
    window.addEventListener("pagehide", onPageHide, true);
    installed = true;
  }
}

function onPageHide(event: PageTransitionEvent) {
  if (event.persisted) return;
  // Full navigations for language switch / order-history entry must not look like a user close.
  if (isPluginNavigating()) return;
  if (!isCollectionActive()) return;
  try {
    chrome.runtime
      .sendMessage({
        type: "COLLECTOR_TAB_CLOSING",
        payload: { href: location.href },
      })
      .catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Remove the confirmation (task finished/stopped, or extension is closing the tab). */
export function disableCloseGuard() {
  allowNextUnload = false;
  allowToken += 1;
  removeBanner();
  if (!installed) return;
  window.removeEventListener("beforeunload", onBeforeUnload, true);
  window.removeEventListener("pagehide", onPageHide, true);
  installed = false;
}

/**
 * Allow the next full-document navigation/unload without prompting.
 * Uses sessionStorage so pagehide during unload still sees the flag.
 */
export function allowPluginNavigation(nextUrl?: string) {
  let sameDocument = false;
  try {
    if (nextUrl) {
      const next = new URL(nextUrl, location.href);
      sameDocument =
        next.origin === location.origin &&
        next.pathname === location.pathname &&
        next.search === location.search &&
        next.hash !== location.hash;
    }
  } catch {
    sameDocument = false;
  }

  if (sameDocument) return;

  allowNextUnload = true;
  sessionStorage.setItem(NAVIGATING_KEY, "1");
  const token = ++allowToken;
  window.setTimeout(() => {
    if (token === allowToken) allowNextUnload = false;
  }, 2000);
}

/** Clear navigation flag after the new document loads. */
export function clearPluginNavigationFlag() {
  sessionStorage.removeItem(NAVIGATING_KEY);
  allowNextUnload = false;
}
