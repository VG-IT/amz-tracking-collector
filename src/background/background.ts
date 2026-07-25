type Marketplace = "us" | "uk" | "de" | "mx" | "ca";

const DOMAIN_BY_MARKETPLACE: Record<Marketplace, string> = {
  us: "www.amazon.com",
  uk: "www.amazon.co.uk",
  de: "www.amazon.de",
  mx: "www.amazon.com.mx",
  ca: "www.amazon.ca",
};

function ordersUrl(marketplace: Marketplace): string {
  return `https://${DOMAIN_BY_MARKETPLACE[marketplace]}/your-orders/orders`;
}

function signInUrl(marketplace: Marketplace): string {
  return `https://${DOMAIN_BY_MARKETPLACE[marketplace]}/ap/signin`;
}

const LOG_ENDPOINT = "https://logging.everymarket.com/api/v1/logs";
const LOG_API_TOKEN =
  "7dfbd1c8a4e2453d9b2b569f37ce8b1c3c09e89157b7268cc60b6a4e35a68c51";

const MAX_RUN_LOGS = 3;
const AUTO_RUN_ALARM_PREFIX = "amazon-tracking-auto-run-";
const AUTO_RUN_HOURS = [0, 12] as const;

const AMAZON_TAB_URLS = [
  "*://*.amazon.com/*",
  "*://*.amazon.co.uk/*",
  "*://*.amazon.de/*",
  "*://*.amazon.com.mx/*",
  "*://*.amazon.ca/*",
];

type Session = {
  checked: boolean;
  loggedIn: boolean;
  checkedAt: number | null;
};

type RunLog = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  email: string;
  days: number;
  marketplace: Marketplace;
  status: string;
  lines: { at: string; text: string }[];
  result?: unknown;
};

type CollectionEnd = {
  status: string;
  error?: string;
};

const state = {
  running: false,
  stopRequested: false,
  phase: "",
  progress: "",
  tabId: null as number | null,
  openedTabIds: [] as number[],
  session: {
    checked: false,
    loggedIn: false,
    checkedAt: null,
  } as Session,
  currentRun: null as RunLog | null,
  collectionEnd: null as CollectionEnd | null,
};

function broadcast(type: string, payload: unknown) {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {});
  chrome.tabs.query({ url: AMAZON_TAB_URLS }, (tabs) => {
    for (const tab of tabs || []) {
      if (tab.id == null) continue;
      chrome.tabs.sendMessage(tab.id, { type, payload }).catch(() => {});
    }
  });
}

function log(message: string) {
  console.log("[Amazon Tracking Collector]", message);
  const line = { at: new Date().toISOString(), text: String(message) };
  if (state.currentRun) state.currentRun.lines.push(line);
  broadcast("LOG", message);
  broadcast("STATE", { ...state, lastLog: message });
}

function setPhase(phase: string, progress = "") {
  state.phase = phase;
  state.progress = progress;
  broadcast("STATE", { ...state });
}

async function persistSession() {
  await chrome.storage.local.set({ session: { ...state.session } });
}

async function loadCachedSession() {
  try {
    const data = await chrome.storage.local.get({ session: null });
    if (data.session && typeof data.session === "object") {
      state.session = {
        checked: !!data.session.checked,
        loggedIn: !!data.session.loggedIn,
        checkedAt: data.session.checkedAt || null,
      };
    }
  } catch {
    /* ignore */
  }
}

async function markSession(loggedIn: boolean) {
  state.session = {
    checked: true,
    loggedIn: !!loggedIn,
    checkedAt: Date.now(),
  };
  await persistSession();
  broadcast("SESSION", { ...state.session });
}

function startRunLog({
  email,
  days,
  marketplace,
}: {
  email: string;
  days: number;
  marketplace: Marketplace;
}) {
  state.currentRun = {
    id: `${Date.now()}`,
    startedAt: new Date().toISOString(),
    endedAt: null,
    email,
    days,
    marketplace,
    status: "running",
    lines: [],
  };
}

async function finishRunLog(status: string, result: unknown = null) {
  if (!state.currentRun) return;
  state.currentRun.endedAt = new Date().toISOString();
  state.currentRun.status = status;
  if (result != null) state.currentRun.result = result;

  const finished = { ...state.currentRun };
  state.currentRun = null;

  const data = await chrome.storage.local.get({ runLogs: [] });
  const runLogs = Array.isArray(data.runLogs) ? data.runLogs : [];
  runLogs.unshift(finished);
  await chrome.storage.local.set({ runLogs: runLogs.slice(0, MAX_RUN_LOGS) });
  broadcast("RUN_LOGS_UPDATED", { count: Math.min(runLogs.length, MAX_RUN_LOGS) });
}

async function getRunLogs() {
  const data = await chrome.storage.local.get({ runLogs: [] });
  return Array.isArray(data.runLogs) ? data.runLogs.slice(0, MAX_RUN_LOGS) : [];
}

async function clearRunLogs() {
  await chrome.storage.local.set({ runLogs: [] });
  broadcast("RUN_LOGS_UPDATED", { count: 0 });
}

function trackOpenedTab(tabId: number | null | undefined) {
  if (tabId == null) return;
  if (!state.openedTabIds.includes(tabId)) state.openedTabIds.push(tabId);
}

function ensureNotStopped() {
  if (state.stopRequested) throw new Error("Stopped by user");
}

function nextLocalHour(hour: number): number {
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

async function syncAutoRunAlarms() {
  const { autoRunEnabled = false } = await chrome.storage.sync.get({
    autoRunEnabled: false,
  });

  await Promise.all(
    AUTO_RUN_HOURS.map(async (hour) => {
      const name = `${AUTO_RUN_ALARM_PREFIX}${hour}`;
      await chrome.alarms.clear(name);
      if (autoRunEnabled) {
        await chrome.alarms.create(name, {
          when: nextLocalHour(hour),
        });
      }
    }),
  );
}

async function sleep(ms: number, { ignoreStop = false } = {}) {
  if (!ignoreStop) ensureNotStopped();
  await new Promise((resolve) => setTimeout(resolve, ms));
  if (!ignoreStop) ensureNotStopped();
}

function waitForTabComplete(tabId: number, timeout = 60000) {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now();

    const finish = (ok: boolean, err?: Error) => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearInterval(poll);
      if (ok) resolve();
      else reject(err || new Error("Tab load timeout"));
    };

    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === "complete") finish(true);
    };
    chrome.tabs.onUpdated.addListener(listener);

    const poll = setInterval(async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === "complete") finish(true);
        else if (Date.now() - started > timeout) finish(false);
      } catch (err) {
        finish(false, err as Error);
      }
    }, 400);
  });
}

async function ensureContentScript(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ping" });
    return;
  } catch {
    /* inject */
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
  await sleep(300, { ignoreStop: true });
}

async function sendToTab(
  tabId: number,
  message: Record<string, unknown>,
  retries = 3,
  { ignoreStop = false } = {},
) {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    if (!ignoreStop) ensureNotStopped();
    try {
      await ensureContentScript(tabId);
      const response = await chrome.tabs.sendMessage(tabId, message);
      if (response?.ok === false) {
        throw new Error(response.error || "Content script error");
      }
      return response;
    } catch (err) {
      lastError = err;
      await sleep(700, { ignoreStop });
    }
  }
  throw lastError || new Error("Failed to message content script");
}

async function openOrReuseTab(url: string, { ignoreStop = false } = {}) {
  if (!ignoreStop) ensureNotStopped();
  if (state.tabId != null) {
    try {
      await chrome.tabs.update(state.tabId, { url, active: true });
      await waitForTabComplete(state.tabId);
      trackOpenedTab(state.tabId);
      return state.tabId;
    } catch {
      state.tabId = null;
    }
  }
  const tab = await chrome.tabs.create({ url, active: true });
  state.tabId = tab.id ?? null;
  trackOpenedTab(tab.id);
  if (tab.id == null) throw new Error("Failed to open tab");
  await waitForTabComplete(tab.id);
  return tab.id;
}

async function closeCollectorTabs() {
  const ids = [...new Set(state.openedTabIds.filter((id) => id != null))];
  if (state.tabId != null && !ids.includes(state.tabId)) ids.push(state.tabId);
  state.tabId = null;
  state.openedTabIds = [];

  if (!ids.length) return;

  // Let content scripts drop beforeunload so extension-owned closes are not blocked.
  await Promise.all(
    ids.map(async (tabId) => {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "allowTabClose" });
      } catch {
        /* tab may already be gone / no content script */
      }
    }),
  );

  try {
    await chrome.tabs.remove(ids);
    log(`Closed ${ids.length} opened tab(s)`);
  } catch {
    let closed = 0;
    for (const tabId of ids) {
      try {
        await chrome.tabs.remove(tabId);
        closed += 1;
      } catch {
        /* already closed */
      }
    }
    log(`Closed ${closed}/${ids.length} opened tab(s)`);
  }
}

async function checkAmazonSession({
  marketplace = "us",
  openLogin = false,
}: {
  marketplace?: Marketplace;
  openLogin?: boolean;
} = {}) {
  let tabId: number | null = null;
  try {
    const tab = await chrome.tabs.create({
      url: ordersUrl(marketplace),
      active: false,
    });
    tabId = tab.id ?? null;
    if (tabId == null) throw new Error("Failed to open login check tab");
    await waitForTabComplete(tabId);
    await sleep(1500, { ignoreStop: true });

    const info = await sendToTab(tabId, { type: "isLoginPage" }, 3, {
      ignoreStop: true,
    });
    const loggedIn = !info?.isLoginPage;
    await markSession(loggedIn);

    if (!loggedIn && openLogin) {
      await chrome.tabs.create({ url: signInUrl(marketplace), active: true });
    }

    return { ...state.session };
  } finally {
    if (tabId != null) {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        /* ignore */
      }
    }
  }
}

async function runCollector({
  email,
  days,
  marketplace,
}: {
  email?: string;
  days?: number;
  marketplace?: Marketplace;
} = {}) {
  if (state.running) return { error: "Already running" };

  await loadCachedSession();

  const settings = await chrome.storage.sync.get({
    email: "",
    days: 30,
    marketplace: "us",
    uploadToEverymarket: true,
  });
  const localSettings = await chrome.storage.local.get({ token: "" });
  const buyerEmail = (email || settings.email || "").trim();
  const apiToken = (localSettings.token || "").trim();
  const lookbackDays = Number(days || settings.days) || 30;
  const market = (marketplace || settings.marketplace || "us") as Marketplace;
  const uploadToEverymarket = settings.uploadToEverymarket !== false;

  if (!buyerEmail) {
    return { error: "Please save a buyer email in extension settings first" };
  }
  if (uploadToEverymarket && !apiToken) {
    return { error: "Please save an Everymarket Token in extension settings first" };
  }
  if (!state.session.checked || !state.session.loggedIn) {
    return { error: "Please click Check Login and confirm you are logged in first" };
  }

  state.running = true;
  state.stopRequested = false;
  state.openedTabIds = [];
  setPhase("Starting");
  startRunLog({ email: buyerEmail, days: lookbackDays, marketplace: market });

  try {
    log(
      `Collector started for ${buyerEmail}, marketplace=${market}, lookbackDays=${lookbackDays}` +
        (uploadToEverymarket ? "" : ", upload=off"),
    );
    setPhase("Opening orders", market);

    const tabId = await openOrReuseTab(ordersUrl(market));
    await sleep(2000);

    const loginInfo = await sendToTab(tabId, { type: "isLoginPage" });
    if (loginInfo?.isLoginPage) {
      await markSession(false);
      throw new Error("LOGGED_OUT");
    }

    setPhase("Collecting orders", "waiting for page");
    state.collectionEnd = null;
    const startResult = await sendToTab(tabId, {
      type: "startCollect",
      payload: {
        email: buyerEmail,
        days: lookbackDays,
        marketplace: market,
        token: uploadToEverymarket ? apiToken : undefined,
        uploadToEverymarket,
      },
    });

    if (startResult?.error) throw new Error(startResult.error);

    // Content script owns the scrape loop; wait until it reports done/stop/error.
    const end = await waitForCollectionEnd();

    if (state.stopRequested || end.status === "stopped") {
      setPhase("Stopped");
      log("Collector stopped");
      await finishRunLog("stopped", { stopped: true });
      return { ok: false, stopped: true };
    }

    if (end.status === "logged_out" || !state.session.loggedIn) {
      await markSession(false);
      setPhase("Logged out");
      log("Logged out while collecting. Please Check Login again.");
      await finishRunLog("logged_out", { error: "logged_out" });
      return { error: "Logged out. Please check login again." };
    }

    if (end.status === "error") {
      throw new Error(end.error || "Collection failed");
    }

    setPhase("Done", "completed");
    log("Collector finished");
    await finishRunLog("completed", { ok: true });
    return { ok: true, email: buyerEmail };
  } catch (err) {
    const message = (err as Error).message || String(err);
    if (message === "LOGGED_OUT") {
      setPhase("Logged out");
      log("Logged out while collecting. Please Check Login again.");
      await finishRunLog("logged_out", { error: "logged_out" });
      return { error: "Logged out. Please check login again." };
    }
    if (message.includes("Stopped")) {
      setPhase("Stopped");
      log("Collector stopped");
      await finishRunLog("stopped", { stopped: true });
      return { ok: false, stopped: true };
    }
    setPhase("Error");
    log(`Fatal: ${message}`);
    await finishRunLog("error", { error: message });
    return { error: message };
  } finally {
    if (state.currentRun) await finishRunLog("interrupted");
    await closeCollectorTabs();
    state.running = false;
    state.stopRequested = false;
    broadcast("STATE", { ...state });
  }
}

function waitForCollectionEnd(timeoutMs = 30 * 60 * 1000): Promise<CollectionEnd> {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const poll = setInterval(() => {
      if (state.collectionEnd) {
        clearInterval(poll);
        const end = state.collectionEnd;
        state.collectionEnd = null;
        resolve(end);
        return;
      }

      if (state.stopRequested) {
        clearInterval(poll);
        void chrome.tabs.query({ url: AMAZON_TAB_URLS }).then((tabs) => {
          for (const tab of tabs) {
            if (tab.id != null) {
              chrome.tabs.sendMessage(tab.id, { type: "stopCollect" }).catch(() => {});
            }
          }
        });
        resolve({ status: "stopped" });
        return;
      }

      if (Date.now() - started > timeoutMs) {
        clearInterval(poll);
        reject(new Error("Collection timed out"));
      }
    }, 400);
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START") {
    runCollector(message.payload || {}).then((result) => sendResponse(result || { ok: true }));
    return true;
  }
  if (message?.type === "STOP") {
    state.stopRequested = true;
    log("Stop requested…");
    chrome.tabs.query({ url: AMAZON_TAB_URLS }, (tabs) => {
      for (const tab of tabs || []) {
        if (tab.id != null) {
          chrome.tabs.sendMessage(tab.id, { type: "stopCollect" }).catch(() => {});
        }
      }
    });
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "GET_STATE") {
    loadCachedSession().then(() => sendResponse({ ...state }));
    return true;
  }
  if (message?.type === "CHECK_SESSION") {
    checkAmazonSession(message.payload || {})
      .then((session) => sendResponse({ ok: true, session }))
      .catch((err) => sendResponse({ ok: false, error: (err as Error).message }));
    return true;
  }
  if (message?.type === "GET_RUN_LOGS") {
    getRunLogs()
      .then((runLogs) => sendResponse({ ok: true, runLogs }))
      .catch((err) => sendResponse({ ok: false, error: (err as Error).message }));
    return true;
  }
  if (message?.type === "CLEAR_RUN_LOGS") {
    clearRunLogs()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: (err as Error).message }));
    return true;
  }
  if (message?.type === "OPEN_LOGIN") {
    const market = (message.payload?.marketplace || "us") as Marketplace;
    chrome.tabs
      .create({ url: signInUrl(market), active: true })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: (err as Error).message }));
    return true;
  }
  if (message?.type === "SEND_LOG") {
    fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Log-Source": "frontend",
        Authorization: `Bearer ${LOG_API_TOKEN}`,
      },
      body: JSON.stringify({
        ...message.log,
        logged_at: new Date().toISOString(),
      }),
    })
      .then((res) => sendResponse({ ok: res.ok }))
      .catch((err) => sendResponse({ ok: false, error: (err as Error).message }));
    return true;
  }
  if (message?.type === "COLLECTOR_PROGRESS") {
    const payload = message.payload || {};
    if (payload.phase) setPhase(payload.phase, payload.progress || "");
    if (payload.log) log(payload.log);
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "COLLECTOR_TAB_CLOSING") {
    log("Collector tab is being closed while a run is active");
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "COLLECTOR_DONE") {
    state.collectionEnd = {
      status: message.payload?.status || "completed",
      error: message.payload?.error,
    };
    sendResponse({ ok: true });
    return false;
  }
  // Legacy popup message
  if (message?.type === "getOrders") {
    runCollector().then((result) => sendResponse(result || { ok: true }));
    return true;
  }
  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(AUTO_RUN_ALARM_PREFIX)) return;

  void (async () => {
    const hour = Number(alarm.name.slice(AUTO_RUN_ALARM_PREFIX.length));
    const { autoRunEnabled = false } = await chrome.storage.sync.get({
      autoRunEnabled: false,
    });
    if (!autoRunEnabled || !AUTO_RUN_HOURS.includes(hour as 0 | 12)) return;

    // One-shot alarms are recreated so they stay at local 00:00/12:00 across DST.
    await chrome.alarms.create(alarm.name, { when: nextLocalHour(hour) });
    await runCollector();
  })();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.autoRunEnabled) {
    void syncAutoRunAlarms();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void syncAutoRunAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  void syncAutoRunAlarms();
});

void loadCachedSession();
void syncAutoRunAlarms();
