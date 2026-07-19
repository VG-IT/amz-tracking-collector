const BASE_URL = "https://fulfill.everymarket.com/api/v3/amazon_orders";

type ApiResult<T> =
  | { ok: true; data: T | null }
  | { ok: false; status?: number; error: string };

export async function fetchInfo(url: string): Promise<Document> {
  const response = await fetch(url, { credentials: "include" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  const htmlText = await response.text();
  return new DOMParser().parseFromString(htmlText, "text/html");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const headers = new Headers({ "Content-Type": "application/json" });

async function getApiToken(): Promise<string> {
  try {
    const data = await chrome.storage.local.get({ token: "" });
    return (data.token || "").trim();
  } catch {
    return "";
  }
}

async function parseResponseData<T>(resp: Response): Promise<T | null> {
  if (resp.status === 204 || resp.status === 205) return null;

  const text = await resp.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function retryFetch<T>(
  url: string,
  options: RequestInit,
  retries = 3,
  baseDelay = 1000,
): Promise<ApiResult<T>> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, options);

      if (resp.ok) {
        return { ok: true, data: await parseResponseData<T>(resp) };
      }

      if (resp.status >= 400 && resp.status < 500) {
        return {
          ok: false,
          status: resp.status,
          error: `HTTP ${resp.status}`,
        };
      }
    } catch (err) {
      console.warn("Network error:", err);
    }

    if (attempt < retries) {
      await sleep(baseDelay * attempt);
    }
  }

  return { ok: false, error: "retry_exhausted" };
}

export async function sendLogFromContent(log: unknown) {
  chrome.runtime.sendMessage({
    type: "SEND_LOG",
    log,
  });
}

export async function post(payload: unknown) {
  try {
    const token = await getApiToken();
    if (!token) {
      console.error("Missing Everymarket token");
      return false;
    }

    const result = await retryFetch(
      `${BASE_URL}/batch_create?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
    );

    const orderCount =
      payload && typeof payload === "object" && "orders" in payload
        ? Array.isArray((payload as { orders: unknown[] }).orders)
          ? (payload as { orders: unknown[] }).orders.length
          : 0
        : 0;

    sendLogFromContent({
      source: "amazon-order",
      level: result.ok ? "info" : "error",
      message: result.ok ? "Synced orders" : "Sync failed",
      metadata: {
        order_count: orderCount,
        result,
      },
    });

    return result.ok;
  } catch (err) {
    console.error("Failed to post orders:", err);
    return false;
  }
}

export async function sendClickLog(email?: string) {
  if (!email) return;
  const token = await getApiToken();
  if (!token) return;

  await retryFetch(
    `${BASE_URL.replace("/amazon_orders", "").replace("v3", "v2")}/plugin_click_logs?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ email }),
    },
  );
}
