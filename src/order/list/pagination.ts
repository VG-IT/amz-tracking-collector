import { ORDER_SELECTOR, NEXT_PAGE_SELECTOR } from "./order-selectors";
import { ensureOrdersReady } from "@/content/runtime/run-once";
import { preparePluginNavigation } from "@/content/runtime/task";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCurrentPage(): number {
  const match = location.hash.match(/pagination\/(\d+)/);
  return match ? Number(match[1]) : 1;
}

/** Snapshot of current list content so we can detect post-navigation refresh. */
export function getOrdersPageSignature(): string {
  const cards = Array.from(document.querySelectorAll(ORDER_SELECTOR));
  const orderNumbers = cards
    .map(
      (card) =>
        card.textContent?.match(/\b\d{3}-\d{7}-\d{7}\b/)?.[0] ||
        card.querySelector("a[href*='order']")?.getAttribute("href") ||
        "",
    )
    .filter(Boolean)
    .slice(0, 8);
  return [
    location.pathname,
    location.search,
    location.hash,
    String(cards.length),
    orderNumbers.join(","),
  ].join("|");
}

function getNextPageUrl(): string | null {
  const nextLink = document.querySelector<HTMLAnchorElement>(
    `${NEXT_PAGE_SELECTOR}, li.a-last a[href]`,
  );
  if (!nextLink) return null;

  // Disabled "next" control (last page)
  const parent = nextLink.closest("li");
  if (parent?.classList.contains("a-disabled")) return null;

  const href = nextLink.getAttribute("href");
  if (!href || href === "#") return null;

  try {
    const url = new URL(href, location.origin);
    if (url.searchParams.get("startIndex") !== null) {
      return href;
    }
  } catch {
    /* fall through */
  }

  if (href.includes("#pagination/next")) {
    const current = getCurrentPage();
    return `/gp/your-account/order-history#pagination/${current + 1}/`;
  }

  // Absolute / relative next links Amazon uses on newer layouts
  if (href.includes("order-history") || href.includes("your-orders") || href.includes("startIndex")) {
    return href;
  }

  return null;
}

async function waitForOrdersPageChange(
  previousSignature: string,
  previousHref: string,
  timeoutMs: number,
): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const hrefChanged = location.href !== previousHref;
    const signature = getOrdersPageSignature();
    const signatureChanged = signature !== previousSignature;
    const cards = document.querySelectorAll(ORDER_SELECTOR);
    const hasSkeleton = Array.from(cards).some((card) =>
      card.querySelector(".skeleton, .a-spinner, .loading"),
    );

    // Hash/SPA transition: old cards cleared, or content replaced.
    if (hrefChanged && (signatureChanged || cards.length === 0 || hasSkeleton)) {
      return;
    }

    // Full soft refresh without href change is rare; still accept signature change.
    if (signatureChanged && !hasSkeleton) {
      return;
    }

    await sleep(300);
  }
}

/**
 * Navigate to the next orders page and wait until the new list has hydrated.
 * @returns false when there is no next page.
 */
export async function goToNextPage(timeoutMs = 90000): Promise<boolean> {
  const nextUrl = getNextPageUrl();
  if (!nextUrl) return false;

  const previousSignature = getOrdersPageSignature();
  const previousHref = location.href;
  const absoluteNext = new URL(nextUrl, location.origin).href;

  // Already on target (should not happen); avoid false "empty page" completion.
  if (absoluteNext === location.href) return false;

  preparePluginNavigation();
  location.href = nextUrl;

  const remaining = () => Math.max(5_000, timeoutMs - 500);

  // Give the navigation a moment to apply (hash change or document unload).
  await sleep(400);

  // If this was a full document navigation, this context is going away.
  // For same-document / SPA pagination, wait for content to change then hydrate.
  try {
    await waitForOrdersPageChange(previousSignature, previousHref, remaining());
    await ensureOrdersReady(remaining());

    // Extra guard: signature must not still equal the previous page after ready.
    const started = Date.now();
    while (
      getOrdersPageSignature() === previousSignature &&
      Date.now() - started < 15_000
    ) {
      await sleep(400);
    }
  } catch (err) {
    // Propagate timeout/hydration failures to caller instead of returning empty page.
    throw err;
  }

  return true;
}
