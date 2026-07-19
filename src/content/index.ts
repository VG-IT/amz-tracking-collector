import { runOnce } from "./runtime/run-once";
import { initMessageListener } from "./runtime/listener";
import "./trigger-button";

export function initContentScript() {
  runOnce();
  initMessageListener();
}
