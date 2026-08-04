import { runOnce } from "./runtime/run-once";
import { initMessageListener } from "./runtime/listener";
import { isTaskRunning } from "./runtime/task";
import { clearPluginNavigationFlag, enableCloseGuard } from "./runtime/close-guard";
import "./trigger-button";

export function initContentScript() {
  clearPluginNavigationFlag();
  // Re-attach close confirmation after SPA/full navigations while a task is active.
  if (isTaskRunning()) {
    enableCloseGuard();
  }
  runOnce();
  initMessageListener();
}
