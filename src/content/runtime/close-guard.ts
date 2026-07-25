const CLOSE_GUARD_MESSAGE =
  "Amazon Tracking Collector is still running. Leave this tab?";

let installed = false;
let allowNextUnload = false;

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (allowNextUnload) {
    allowNextUnload = false;
    return;
  }

  // Lazy import avoided: task state lives in sessionStorage.
  if (sessionStorage.getItem("amazon_order_task") !== "running") return;
  if (sessionStorage.getItem("amazon_order_task_stop") === "1") return;

  const expiresAt = Number(sessionStorage.getItem("amazon_order_task_expires") || 0);
  if (!expiresAt || Date.now() > expiresAt) return;

  event.preventDefault();
  event.returnValue = CLOSE_GUARD_MESSAGE;
  return CLOSE_GUARD_MESSAGE;
}

/** Install the tab close/refresh confirmation while a collection task is active. */
export function enableCloseGuard() {
  if (installed) return;
  window.addEventListener("beforeunload", onBeforeUnload);
  installed = true;
}

/** Remove the confirmation (task finished/stopped, or extension is closing the tab). */
export function disableCloseGuard() {
  allowNextUnload = false;
  if (!installed) return;
  window.removeEventListener("beforeunload", onBeforeUnload);
  installed = false;
}

/**
 * Allow the next navigation/unload without prompting.
 * Call immediately before plugin-driven location.href changes.
 */
export function allowPluginNavigation() {
  allowNextUnload = true;
}
