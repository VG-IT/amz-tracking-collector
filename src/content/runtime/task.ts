// src/content/runtime/task.ts
import { clearLanguageEnsureFlag } from "./ensure-english";
import { clearExtractedOrders } from "../../order/save/format-extracted-orders";
import { allowPluginNavigation, disableCloseGuard, enableCloseGuard, clearPluginNavigationFlag } from "./close-guard";

const RUNNING = "running";

export const TASK_KEY = "amazon_order_task";
export const TASK_EXPIRES_KEY = "amazon_order_task_expires";
export const TASK_SETTINGS_KEY = "amazon_order_task_settings";
export const TASK_STOP_KEY = "amazon_order_task_stop";
export const TASK_PAGE_KEY = "amazon_order_task_page";
export const TASK_TTL = 10 * 60 * 1000;

export type TaskSettings = {
  email: string;
  days: number;
  marketplace: string;
  token?: string;
  /** When false, scrape only and log extracted orders (no EveryMarket upload). */
  uploadToEverymarket?: boolean;
};

export function isTaskRunning(): boolean {
  if (sessionStorage.getItem(TASK_STOP_KEY) === "1") {
    clearTask();
    return false;
  }
  const expiresAt = Number(sessionStorage.getItem(TASK_EXPIRES_KEY) || 0);
  if (Date.now() > expiresAt) {
    clearTask();
    return false;
  }
  return sessionStorage.getItem(TASK_KEY) === RUNNING;
}

export function isStopRequested(): boolean {
  return sessionStorage.getItem(TASK_STOP_KEY) === "1";
}

export function requestStop() {
  sessionStorage.setItem(TASK_STOP_KEY, "1");
  disableCloseGuard();
}

export function startTask(settings?: TaskSettings) {
  sessionStorage.removeItem(TASK_STOP_KEY);
  sessionStorage.setItem(TASK_PAGE_KEY, "1");
  clearPluginNavigationFlag();
  clearLanguageEnsureFlag();
  clearExtractedOrders();
  sessionStorage.setItem(TASK_KEY, RUNNING);
  if (settings) {
    sessionStorage.setItem(TASK_SETTINGS_KEY, JSON.stringify(settings));
  }
  refreshTaskTTL();
  enableCloseGuard();
}

/** Current orders list page (survives full pagination navigations). */
export function getTaskPage(): number {
  const page = Number(sessionStorage.getItem(TASK_PAGE_KEY) || "1");
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

export function setTaskPage(page: number) {
  sessionStorage.setItem(TASK_PAGE_KEY, String(Math.max(1, Math.floor(page))));
}

export function getTaskSettings(): TaskSettings | null {
  try {
    const raw = sessionStorage.getItem(TASK_SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TaskSettings;
  } catch {
    return null;
  }
}

export function refreshTaskTTL() {
  sessionStorage.setItem(TASK_EXPIRES_KEY, String(Date.now() + TASK_TTL));
}

export function clearTask() {
  sessionStorage.removeItem(TASK_KEY);
  sessionStorage.removeItem(TASK_EXPIRES_KEY);
  sessionStorage.removeItem(TASK_SETTINGS_KEY);
  sessionStorage.removeItem(TASK_STOP_KEY);
  sessionStorage.removeItem(TASK_PAGE_KEY);
  clearLanguageEnsureFlag();
  disableCloseGuard();
}

/** Bypass close confirmation for the next plugin-driven navigation. */
export function preparePluginNavigation(nextUrl?: string) {
  allowPluginNavigation(nextUrl);
}
