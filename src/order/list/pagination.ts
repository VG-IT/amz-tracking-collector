import { ORDER_SELECTOR, NEXT_PAGE_SELECTOR } from "./order-selectors";
import { preparePluginNavigation } from "@/content/runtime/task";

const ORDER_NUMBER_RE = /\b\d{3}-\d{7}-\d{7}\b/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rootText(root: ParentNode): string {
  if (root === document) return document.body?.innerText || "";
  if (root instanceof Document) return root.body?.innerText || "";
  return (root as HTMLElement).innerText || root.textContent || "";
}

/** True when the list has hydrated order cards (not SPA skeletons). */
export function hasRealOrders(root: ParentNode = document): boolean {
  const cards = root.querySelectorAll(ORDER_SELECTOR);
  if (cards.length === 0) return false;
  if (ORDER_NUMBER_RE.test(rootText(root))) return true;
  return Array.from(cards).some((card) =>
    ORDER_NUMBER_RE.test(card.textContent || ""),
  );
}

/** Snapshot of list content for duplicate-page detection. */
export function getOrdersPageSignature(root: ParentNode = document): string {
  const cards = Array.from(root.querySelectorAll(ORDER_SELECTOR));
  const orderNumbers = cards
    .map(
      (card) =>
        card.textContent?.match(ORDER_NUMBER_RE)?.[0] ||
        card.querySelector("a[href*='order']")?.getAttribute("href") ||
        "",
    )
    .filter(Boolean)
    .slice(0, 8);
  return [
    `${location.pathname}${location.search}${location.hash}`,
    String(cards.length),
    orderNumbers.join(","),
  ].join("|");
}

function findNextPageControl(): HTMLAnchorElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLAnchorElement>(
      [
        NEXT_PAGE_SELECTOR,
        "ul.a-pagination li.a-last a",
        ".a-pagination li.a-last a",
        'a[aria-label="Go to next page"]',
        'a[aria-label*="Next page" i]',
        'a[aria-label="Next"]',
      ].join(", "),
    ),
  );

  for (const link of candidates) {
    const parent = link.closest("li");
    if (parent?.classList.contains("a-disabled")) continue;
    if (link.getAttribute("aria-disabled") === "true") continue;
    const href = link.getAttribute("href");
    if (!href || href === "#") continue;
    return link;
  }
  return null;
}

function willFullNavigate(href: string): boolean {
  try {
    const next = new URL(href, location.href);
    if (next.origin !== location.origin) return true;
    return (
      next.pathname !== location.pathname || next.search !== location.search
    );
  } catch {
    return false;
  }
}

function isElementInViewport(el: Element, padding = 8): boolean {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  return (
    rect.top >= -padding &&
    rect.left >= -padding &&
    rect.bottom <= vh + padding &&
    rect.right <= vw + padding &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function randomDelay(minMs: number, maxMs: number): number {
  return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

/**
 * Scroll pagination into view and pause briefly (human-like) before clicking.
 */
async function scrollPaginationIntoView(
  nextLink: HTMLElement,
  timeoutMs = 8_000,
): Promise<void> {
  const target =
    (nextLink.closest("ul.a-pagination, .a-pagination, nav") as HTMLElement) ||
    nextLink;

  target.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isElementInViewport(target) || isElementInViewport(nextLink)) {
      break;
    }
    await sleep(100);
  }

  // If smooth scroll was ignored (or still off-screen), force into view.
  if (!isElementInViewport(target) && !isElementInViewport(nextLink)) {
    target.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "nearest",
    });
    await sleep(150);
  }

  // Short settle + jitter so the click does not fire mid-scroll.
  await sleep(randomDelay(350, 900));
}

export type GoToNextPageResult =
  /** Same-document SPA update completed; keep scraping in this loop. */
  | "advanced"
  /** Full document navigation started; content script will restart. */
  | "navigating"
  /** No usable Next control (end of list). */
  | "done"
  /** Clicked but content did not change in time. */
  | "timeout";

/**
 * Advance using the on-page pagination control (no fetch).
 * Scrolls the pager into view first to mimic a real user.
 */
export async function goToNextOrdersPageViaUi(
  timeoutMs = 25_000,
): Promise<GoToNextPageResult> {
  const nextLink = findNextPageControl();
  if (!nextLink) return "done";

  const href = nextLink.getAttribute("href") || "";
  const before = getOrdersPageSignature(document);
  const fullNav = willFullNavigate(href);

  await scrollPaginationIntoView(nextLink);

  if (fullNav) {
    preparePluginNavigation(new URL(href, location.href).toString());
    nextLink.click();
    await sleep(timeoutMs);
    return "navigating";
  }

  nextLink.click();

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(300);
    const signature = getOrdersPageSignature(document);
    if (signature !== before && hasRealOrders(document)) {
      await sleep(500);
      return "advanced";
    }
  }

  return getOrdersPageSignature(document) !== before && hasRealOrders(document)
    ? "advanced"
    : "timeout";
}
