import { ORDER_SELECTOR, NEXT_PAGE_SELECTOR } from "./order-selectors";
import { fetchInfo } from "@/services/api";

function getCurrentPageFromHref(href: string): number {
  const match = href.match(/#pagination\/(\d+)/);
  return match ? Number(match[1]) : 1;
}

/** Snapshot of list content for duplicate-page detection. */
export function getOrdersPageSignature(root: ParentNode = document): string {
  const cards = Array.from(root.querySelectorAll(ORDER_SELECTOR));
  const orderNumbers = cards
    .map(
      (card) =>
        card.textContent?.match(/\b\d{3}-\d{7}-\d{7}\b/)?.[0] ||
        card.querySelector("a[href*='order']")?.getAttribute("href") ||
        "",
    )
    .filter(Boolean)
    .slice(0, 8);
  const loc =
    root === document
      ? `${location.pathname}${location.search}${location.hash}`
      : "";
  return [loc, String(cards.length), orderNumbers.join(",")].join("|");
}

export function getNextPageUrl(
  root: ParentNode = document,
  currentHref = typeof location !== "undefined" ? location.href : "",
): string | null {
  const nextLink = root.querySelector<HTMLAnchorElement>(
    `${NEXT_PAGE_SELECTOR}, li.a-last a[href]`,
  );
  if (!nextLink) return null;

  const parent = nextLink.closest("li");
  if (parent?.classList.contains("a-disabled")) return null;

  const href = nextLink.getAttribute("href");
  if (!href || href === "#") return null;

  try {
    const url = new URL(href, currentHref || location.origin);
    if (url.searchParams.get("startIndex") !== null) {
      return url.toString();
    }
  } catch {
    /* fall through */
  }

  if (href.includes("#pagination/next")) {
    const current = getCurrentPageFromHref(currentHref || location.href);
    return new URL(
      `/gp/your-account/order-history#pagination/${current + 1}/`,
      location.origin,
    ).toString();
  }

  if (
    href.includes("order-history") ||
    href.includes("your-orders") ||
    href.includes("startIndex")
  ) {
    try {
      return new URL(href, currentHref || location.origin).toString();
    } catch {
      return href;
    }
  }

  return null;
}

/**
 * Load the next orders list via fetch (no tab navigation).
 * Keeps the content-script sync loop alive across pages.
 */
export async function fetchNextOrdersDocument(
  currentDoc: Document = document,
  currentPage = 1,
): Promise<Document | null> {
  let nextUrl = getNextPageUrl(currentDoc, location.href);
  if (!nextUrl) return null;

  const absolute = new URL(nextUrl, location.href);

  // Tab stays on page 1 while we fetch; always drive hash pagination from
  // the logical page counter (not location.hash / #pagination/next).
  if (
    absolute.hash.includes("pagination") &&
    absolute.searchParams.get("startIndex") === null
  ) {
    absolute.hash = `pagination/${currentPage + 1}/`;
  }

  const nextDoc = await fetchInfo(absolute.toString());
  const cards = nextDoc.querySelectorAll(ORDER_SELECTOR);

  // Hash SPA URLs often ignore the hash over HTTP and return the first page.
  if (cards.length === 0) return null;

  return nextDoc;
}
