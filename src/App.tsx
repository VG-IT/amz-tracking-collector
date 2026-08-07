import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type { Marketplace } from "./config";
import {
  checkForUpdate,
  getInstalledVersion,
  type ExtensionUpdate,
} from "./services/update";

type Session = {
  checked: boolean;
  loggedIn: boolean;
};

type CollectorState = {
  running?: boolean;
  phase?: string;
  progress?: string;
  session?: Session;
  lastLog?: string;
};

type RunLogLine = { at?: string; text: string };

type RunLog = {
  id: string;
  startedAt?: string;
  endedAt?: string;
  status?: string;
  email?: string;
  days?: number;
  marketplace?: string;
  lines?: RunLogLine[];
};

const MARKETPLACES: { value: Marketplace; label: string }[] = [
  { value: "us", label: "US (amazon.com)" },
  { value: "uk", label: "UK (amazon.co.uk)" },
  { value: "de", label: "DE (amazon.de)" },
  { value: "mx", label: "MX (amazon.com.mx)" },
  { value: "ca", label: "CA (amazon.ca)" },
];

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    running: "Running",
    completed: "Completed",
    stopped: "Stopped",
    logged_out: "Logged out",
    error: "Failed",
    interrupted: "Interrupted",
  };
  return map[status || ""] || status || "Unknown";
}

function formatRunTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const App: React.FC = () => {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [days, setDays] = useState(30);
  const [marketplace, setMarketplace] = useState<Marketplace>("us");
  const [uploadToEverymarket, setUploadToEverymarket] = useState(true);
  const [autoRunEnabled, setAutoRunEnabled] = useState(false);
  const [pendingPollEnabled, setPendingPollEnabled] = useState(false);
  const [pendingPollHours, setPendingPollHours] = useState(2);
  const [session, setSession] = useState<Session>({ checked: false, loggedIn: false });
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("—");
  const [progress, setProgress] = useState("—");
  const [loginBusy, setLoginBusy] = useState(false);
  const [liveLog, setLiveLog] = useState("");
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<ExtensionUpdate | null>(null);
  const [installedVersion] = useState(() => getInstalledVersion());
  const logRef = useRef<HTMLPreElement>(null);
  const historyRef = useRef<HTMLPreElement>(null);

  const appendLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLiveLog((prev) => `${prev}[${stamp}] ${line}\n`);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [liveLog]);

  useEffect(() => {
    let cancelled = false;
    void checkForUpdate()
      .then((update) => {
        if (!cancelled) setUpdateInfo(update);
      })
      .catch(() => {
        /* private repo / network — ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback((next: Partial<Session> = {}) => {
    setSession((prev) => ({
      ...prev,
      ...next,
      checked: true,
      loggedIn: next.loggedIn ?? prev.loggedIn,
    }));
  }, []);

  const canStart = useMemo(
    () =>
      session.loggedIn &&
      !!email.trim() &&
      (!uploadToEverymarket || !!token.trim()) &&
      !running,
    [session.loggedIn, email, token, uploadToEverymarket, running],
  );

  const selectedRun = useMemo(() => {
    return runLogs.find((item) => item.id === selectedRunId) || runLogs[0] || null;
  }, [runLogs, selectedRunId]);

  const loadRunLogs = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_RUN_LOGS" });
      const logs: RunLog[] = response?.ok ? response.runLogs || [] : [];
      setRunLogs(logs);
      setSelectedRunId((prev) => {
        if (prev && logs.some((item) => item.id === prev)) return prev;
        return logs[0]?.id ?? null;
      });
    } catch (err) {
      appendLog(`Failed to load logs: ${(err as Error).message}`);
    }
  }, [appendLog]);

  const renderState = useCallback(
    (state: CollectorState = {}) => {
      setRunning(!!state.running);
      setPhase(state.phase || "—");
      setProgress(state.progress || "—");
      if (state.session?.checked) applySession(state.session);
    },
    [applySession],
  );

  const loadSettings = useCallback(async () => {
    const [syncData, localData] = await Promise.all([
      chrome.storage.sync.get({
        email: "",
        days: 30,
        marketplace: "us",
        uploadToEverymarket: true,
        autoRunEnabled: false,
        pendingPollEnabled: false,
        pendingPollHours: 2,
      }),
      chrome.storage.local.get({ token: "" }),
    ]);
    setEmail(syncData.email || "");
    setDays(Number(syncData.days) || 30);
    setMarketplace((syncData.marketplace as Marketplace) || "us");
    setUploadToEverymarket(syncData.uploadToEverymarket !== false);
    setAutoRunEnabled(syncData.autoRunEnabled === true);
    setPendingPollEnabled(syncData.pendingPollEnabled === true);
    setPendingPollHours(Math.max(1, Number(syncData.pendingPollHours) || 2));
    setToken(localData.token || "");
  }, []);

  const saveSettings = useCallback(async () => {
    const nextEmail = email.trim();
    const nextToken = token.trim();
    const nextDays = Number(days) || 30;
    if (!nextEmail) {
      appendLog("Please enter buyer email");
      return false;
    }
    if (uploadToEverymarket && !nextToken) {
      appendLog("Please enter Everymarket Token");
      return false;
    }
    await Promise.all([
      chrome.storage.sync.set({
        email: nextEmail,
        days: nextDays,
        marketplace,
        uploadToEverymarket,
        autoRunEnabled,
        pendingPollEnabled,
        pendingPollHours: Math.max(1, Number(pendingPollHours) || 2),
      }),
      chrome.storage.local.set({ token: nextToken }),
    ]);
    appendLog(
      `Settings saved: ${nextEmail} (${marketplace})` +
        (uploadToEverymarket ? "" : ", upload off") +
        (autoRunEnabled ? ", auto-run at 00:00/12:00" : "") +
        (pendingPollEnabled
          ? `, pending-poll every ${Math.max(1, Number(pendingPollHours) || 2)}h`
          : ""),
    );
    return true;
  }, [
    email,
    token,
    days,
    marketplace,
    uploadToEverymarket,
    autoRunEnabled,
    pendingPollEnabled,
    pendingPollHours,
    appendLog,
  ]);

  const refreshSession = useCallback(async () => {
    setLoginBusy(true);
    applySession({ loggedIn: false });
    appendLog("Opening Amazon orders page to check login…");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "CHECK_SESSION",
        payload: { marketplace },
      });
      if (!response?.ok) {
        appendLog(`Check login failed: ${response?.error || "unknown"}`);
        applySession({ loggedIn: false });
        return;
      }
      applySession(response.session || {});
      appendLog(response.session?.loggedIn ? "Logged in" : "Not logged in — please sign in");
    } catch (err) {
      appendLog(`Check login error: ${(err as Error).message}`);
      applySession({ loggedIn: false });
    } finally {
      setLoginBusy(false);
    }
  }, [marketplace, applySession, appendLog]);

  useEffect(() => {
    (async () => {
      await loadSettings();
      const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (state) renderState(state);
      await loadRunLogs();
    })();

    const onMessage = (message: { type?: string; payload?: unknown }) => {
      if (message?.type === "STATE") {
        renderState(message.payload as CollectorState);
        if (!(message.payload as CollectorState)?.running) {
          void loadRunLogs();
        }
      }
      if (message?.type === "SESSION") {
        applySession(message.payload as Session);
      }
      if (message?.type === "LOG") {
        appendLog(String(message.payload));
      }
      if (message?.type === "RUN_LOGS_UPDATED") {
        void loadRunLogs();
      }
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [loadSettings, renderState, loadRunLogs, applySession, appendLog]);

  const historyText = useMemo(() => {
    if (!selectedRun) return "No run logs yet";
    const header = [
      `Started: ${formatRunTime(selectedRun.startedAt)}`,
      `Ended: ${formatRunTime(selectedRun.endedAt)}`,
      `Status: ${statusLabel(selectedRun.status)}`,
      `Email: ${selectedRun.email || "—"}`,
      `Marketplace: ${selectedRun.marketplace || "—"}`,
      `Lookback days: ${selectedRun.days ?? "—"}`,
    ].join("\n");
    const body = (selectedRun.lines || [])
      .map((line) => {
        const time = line.at ? new Date(line.at).toLocaleTimeString() : "";
        return `[${time}] ${line.text}`;
      })
      .join("\n");
    return `${header}\n\n${body || "(no log lines)"}`;
  }, [selectedRun]);

  return (
    <div className="App">
      <header>
        <h1>Amazon Tracking Collector</h1>
        <p className="subtitle">
          Sync Amazon orders &amp; tracking to EveryMarket · v{installedVersion}
        </p>
      </header>

      {updateInfo ? (
        <section className="login-banner warn update-banner">
          <div>
            Update available: <strong>v{updateInfo.version}</strong> (installed
            v{installedVersion}). Download the zip, extract over your install
            folder, then Reload on chrome://extensions.
          </div>
          <div className="login-actions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                void chrome.tabs.create({
                  url: updateInfo.zipUrl || updateInfo.htmlUrl,
                });
              }}
            >
              Download zip
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                void chrome.tabs.create({ url: updateInfo.htmlUrl });
              }}
            >
              Release notes
            </button>
          </div>
        </section>
      ) : null}

      <section className={`login-banner ${session.loggedIn ? "ok" : "warn"}`}>
        <div>
          {session.loggedIn
            ? "Logged in (cached). You will be asked to Check Login again if logout is detected during collection."
            : session.checked
              ? "Not logged in or logged out. Sign in, then click Check Login before collecting."
              : "Click Check Login first. The result is cached; if logout is detected during collection you will be asked to check again."}
        </div>
        <div className="login-actions">
          <button
            type="button"
            className="secondary"
            disabled={loginBusy || running}
            onClick={() => void refreshSession()}
          >
            Check Login
          </button>
          <button
            type="button"
            className="primary"
            style={{ display: session.loggedIn ? "none" : undefined }}
            disabled={loginBusy || running}
            onClick={async () => {
              await chrome.runtime.sendMessage({
                type: "OPEN_LOGIN",
                payload: { marketplace },
              });
              appendLog("Opened sign-in page. After signing in, click Check Login.");
            }}
          >
            Sign In
          </button>
        </div>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label>
          Buyer email
          <input
            type="email"
            required
            placeholder="buyer@example.com"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Everymarket Token
          <input
            type="password"
            required={uploadToEverymarket}
            placeholder="API token"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={!uploadToEverymarket}
          />
        </label>
        <label>
          Marketplace
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value as Marketplace)}
          >
            {MARKETPLACES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lookback days
          <input
            type="number"
            min={1}
            max={180}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 30)}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={uploadToEverymarket}
            onChange={(e) => setUploadToEverymarket(e.target.checked)}
          />
          <span>Upload to EveryMarket</span>
        </label>
        {!uploadToEverymarket && (
          <p className="hint checkbox-hint">
            Dry-run: scrape only; order and tracking details appear in the final log.
          </p>
        )}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={autoRunEnabled}
            onChange={(e) => setAutoRunEnabled(e.target.checked)}
          />
          <span>Auto-run full collect daily at 00:00 and 12:00</span>
        </label>
        <p className="hint checkbox-hint">
          Full scrape + upload. Uses local time; Chrome must stay running.
        </p>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={pendingPollEnabled}
            onChange={(e) => setPendingPollEnabled(e.target.checked)}
          />
          <span>Auto-poll pending collection requests</span>
        </label>
        <label>
          Pending poll interval (hours)
          <input
            type="number"
            min={1}
            max={24}
            value={pendingPollHours}
            disabled={!pendingPollEnabled}
            onChange={(e) => setPendingPollHours(Math.max(1, Number(e.target.value) || 2))}
          />
        </label>
        <p className="hint checkbox-hint">
          Reads pending orders from EveryMarket, collects only those, then uploads. Skips when queue is empty.
        </p>

        <div className="actions">
          <button
            type="button"
            className="secondary"
            disabled={running}
            onClick={() => void saveSettings()}
          >
            Save
          </button>
          <button
            type="button"
            className="primary"
            disabled={!canStart}
            onClick={async () => {
              const saved = await saveSettings();
              if (!saved) return;
              if (!session.loggedIn) {
                appendLog("Please Check Login first");
                return;
              }
              setLiveLog("");
              appendLog("Starting full collector…");
              setRunning(true);
              const response = await chrome.runtime.sendMessage({
                type: "START",
                payload: { email: email.trim(), days, marketplace },
              });
              if (response?.error) appendLog(`Error: ${response.error}`);
              await loadRunLogs();
            }}
          >
            Start
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!canStart}
            onClick={async () => {
              const saved = await saveSettings();
              if (!saved) return;
              if (!session.loggedIn) {
                appendLog("Please Check Login first");
                return;
              }
              if (!uploadToEverymarket) {
                appendLog("Enable Upload to EveryMarket to collect pending requests");
                return;
              }
              setLiveLog("");
              appendLog("Starting pending-only collector…");
              setRunning(true);
              const response = await chrome.runtime.sendMessage({
                type: "START_PENDING",
                payload: { email: email.trim(), days, marketplace },
              });
              if (response?.error) appendLog(`Error: ${response.error}`);
              else if (response?.empty) appendLog("No pending orders to collect");
              await loadRunLogs();
            }}
          >
            Collect Pending
          </button>
          <button
            type="button"
            className="danger"
            disabled={!running}
            onClick={async () => {
              await chrome.runtime.sendMessage({ type: "STOP" });
              appendLog("Stop requested");
            }}
          >
            Stop
          </button>
        </div>
        <p className="hint">
          Start = full lookback scrape + pending. Collect Pending = only ops-requested orders, then upload.
          Page button also starts a full collect.
        </p>
      </form>

      <section className="status-panel">
        <div className="status-row">
          <span className="label">Login</span>
          <span>{session.checked ? (session.loggedIn ? "Logged in" : "Not logged in") : "Not checked"}</span>
        </div>
        <div className="status-row">
          <span className="label">Status</span>
          <span>{running ? "Running" : "Idle"}</span>
        </div>
        <div className="status-row">
          <span className="label">Phase</span>
          <span>{phase}</span>
        </div>
        <div className="status-row">
          <span className="label">Progress</span>
          <span>{progress}</span>
        </div>
        <pre ref={logRef} className="log" aria-live="polite">
          {liveLog}
        </pre>
      </section>

      <section className="history-panel">
        <div className="history-header">
          <span className="label">Recent run logs</span>
          <div className="history-actions">
            <button type="button" className="secondary" onClick={() => void loadRunLogs()}>
              Refresh
            </button>
            <button
              type="button"
              className="danger"
              onClick={async () => {
                const response = await chrome.runtime.sendMessage({ type: "CLEAR_RUN_LOGS" });
                if (response?.ok === false) {
                  appendLog(`Clear logs failed: ${response.error || "unknown"}`);
                  return;
                }
                setLiveLog("");
                setSelectedRunId(null);
                setRunLogs([]);
                appendLog("Run logs cleared");
              }}
            >
              Clear Logs
            </button>
          </div>
        </div>
        <div className="run-log-tabs">
          {runLogs.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`run-log-tab${selectedRun?.id === item.id ? " active" : ""}`}
              title={formatRunTime(item.startedAt)}
              onClick={() => setSelectedRunId(item.id)}
            >
              #{index + 1} {statusLabel(item.status)}
            </button>
          ))}
        </div>
        <pre ref={historyRef} className="log history-log">
          {historyText}
        </pre>
      </section>
    </div>
  );
};

export default App;
