(() => {
  if (window !== window.top) return;
  if ((window as unknown as { __amzTrackingTriggerLoaded?: boolean }).__amzTrackingTriggerLoaded) {
    return;
  }
  (window as unknown as { __amzTrackingTriggerLoaded?: boolean }).__amzTrackingTriggerLoaded = true;

  const ROOT_ID = "amz-tracking-collector-trigger-root";

  function ensureUi() {
    if (document.getElementById(ROOT_ID)) return;

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <style>
        #${ROOT_ID} {
          all: initial;
          position: fixed;
          right: 20px;
          bottom: 24px;
          z-index: 2147483646;
          font-family: "Segoe UI", system-ui, sans-serif;
        }
        #${ROOT_ID} .atc-panel {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }
        #${ROOT_ID} .atc-toast {
          display: none;
          max-width: 260px;
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(15, 28, 36, 0.95);
          color: #e8f1f5;
          font-size: 12px;
          line-height: 1.4;
          box-shadow: 0 8px 24px rgba(0,0,0,0.28);
        }
        #${ROOT_ID} .atc-toast.show { display: block; }
        #${ROOT_ID} .atc-toast.error { border: 1px solid #d64545; }
        #${ROOT_ID} .atc-toast.ok { border: 1px solid #2bbbad; }
        #${ROOT_ID} .atc-btn {
          border: none;
          border-radius: 999px;
          padding: 12px 18px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          color: #062a27;
          background: #2bbbad;
          box-shadow: 0 10px 28px rgba(0,0,0,0.28);
        }
        #${ROOT_ID} .atc-btn:hover { background: #24a598; }
        #${ROOT_ID} .atc-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        #${ROOT_ID} .atc-btn.stop {
          background: #d64545;
          color: #fff;
        }
        #${ROOT_ID} .atc-btn.stop:hover { background: #c03939; }
        #${ROOT_ID} .atc-sub {
          margin: 0;
          font-size: 11px;
          color: #8aa3b0;
          text-align: right;
          background: rgba(15, 28, 36, 0.85);
          padding: 4px 10px;
          border-radius: 999px;
        }
      </style>
      <div class="atc-panel">
        <div class="atc-toast" id="atc-toast"></div>
        <p class="atc-sub" id="atc-status">Click to start collection</p>
        <button type="button" class="atc-btn" id="atc-trigger-btn">Collect Orders</button>
      </div>
    `;
    document.documentElement.appendChild(root);

    const btn = root.querySelector("#atc-trigger-btn") as HTMLButtonElement;
    const toast = root.querySelector("#atc-toast") as HTMLDivElement;
    const status = root.querySelector("#atc-status") as HTMLParagraphElement;

    let toastTimer: number | undefined;
    function showToast(message: string, type: "ok" | "error" = "ok") {
      toast.textContent = message;
      toast.className = `atc-toast show ${type}`;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        toast.className = "atc-toast";
      }, 4000);
    }

    function setRunning(running: boolean, phase = "") {
      if (running) {
        btn.textContent = "Stop";
        btn.classList.add("stop");
        btn.disabled = false;
        status.textContent = phase ? `Running: ${phase}` : "Running…";
      } else {
        btn.textContent = "Collect Orders";
        btn.classList.remove("stop");
        btn.disabled = false;
        status.textContent = "Click to start collection";
      }
    }

    async function refreshState() {
      try {
        const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
        setRunning(!!state?.running, state?.phase || "");
      } catch {
        /* ignore */
      }
    }

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
        if (state?.running) {
          await chrome.runtime.sendMessage({ type: "STOP" });
          showToast("Stop requested", "ok");
          status.textContent = "Stopping…";
          return;
        }

        const settings = await chrome.storage.sync.get({
          email: "",
          days: 30,
          marketplace: "us",
          uploadToEverymarket: true,
        });
        const localSettings = await chrome.storage.local.get({ token: "" });
        const uploadToEverymarket = settings.uploadToEverymarket !== false;
        if (!settings.email) {
          showToast("Open the extension popup and save buyer email first", "error");
          btn.disabled = false;
          return;
        }
        if (uploadToEverymarket && !localSettings.token) {
          showToast("Open the extension popup and save Token first", "error");
          btn.disabled = false;
          return;
        }
        if (!state?.session?.loggedIn) {
          showToast("Please Check Login in the extension popup first", "error");
          btn.disabled = false;
          return;
        }

        showToast("Starting collection…", "ok");
        status.textContent = "Starting…";
        const response = await chrome.runtime.sendMessage({
          type: "START",
          payload: {
            email: settings.email,
            days: Number(settings.days) || 30,
            marketplace: settings.marketplace || "us",
            triggeredBy: "page-button",
          },
        });
        if (response?.error) {
          showToast(response.error, "error");
          setRunning(false);
          return;
        }
        setRunning(true, "Starting");
      } catch (err) {
        showToast((err as Error)?.message || String(err), "error");
        setRunning(false);
      } finally {
        await refreshState();
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === "STATE") {
        setRunning(!!message.payload?.running, message.payload?.phase || "");
      }
      if (message?.type === "SESSION" && message.payload && !message.payload.loggedIn) {
        status.textContent = "Logged out — Check Login again";
        showToast("Logged out. Please Check Login again.", "error");
      }
      if (message?.type === "LOG" && typeof message.payload === "string") {
        const text = message.payload;
        if (/logged out|check login|not logged|error|fatal|finished|stopped|failed/i.test(text)) {
          showToast(
            text,
            /logged out|check login|not logged|error|fatal|failed/i.test(text) ? "error" : "ok",
          );
        }
      }
    });

    refreshState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureUi, { once: true });
  } else {
    ensureUi();
  }
})();
