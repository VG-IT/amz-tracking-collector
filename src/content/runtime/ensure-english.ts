import {
  ENGLISH_LANGUAGE_BY_MARKETPLACE,
  type Marketplace,
} from "../../config";

export const LANG_ENSURED_KEY = "amazon_order_lang_ensured";

const NON_ENGLISH_ORDER_MARKERS =
  /\b(Pedido|Bestellungen|Meine Bestellungen|Bestellung aufgegeben|Pedido realizado|Commandes)\b/i;

const ENGLISH_ORDER_MARKERS =
  /\b(Your Orders|Order #|Order Placed|Buy Again|Track package)\b/i;

export function clearLanguageEnsureFlag() {
  sessionStorage.removeItem(LANG_ENSURED_KEY);
}

export function isPageEnglish(): boolean {
  const htmlLang = (document.documentElement.lang || "").toLowerCase();
  if (htmlLang.startsWith("en")) return true;

  if (/\/-\/en(\/|$)/i.test(location.pathname)) return true;

  const sample = document.body?.innerText?.slice(0, 8000) || "";
  if (ENGLISH_ORDER_MARKERS.test(sample)) return true;
  if (NON_ENGLISH_ORDER_MARKERS.test(sample)) return false;

  if (htmlLang && !htmlLang.startsWith("en")) return false;

  return false;
}

export function buildEnglishSwitchUrl(
  marketplace: Marketplace,
  returnPath = "/your-orders/orders",
): string | null {
  const language = ENGLISH_LANGUAGE_BY_MARKETPLACE[marketplace];
  if (!language) return null;

  const path = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  const url = new URL("/gp/customer-preferences/lang", location.origin);
  url.searchParams.set("ie", "UTF8");
  url.searchParams.set("language", language);
  url.searchParams.set("preferencesReturnToUrl", path);
  return url.toString();
}

/**
 * Returns a language-switch URL when this marketplace supports English and the
 * page is not English yet. Marks the attempt so it runs at most once per task.
 * Caller should navigate after reporting progress.
 */
export function prepareEnglishLocaleSwitch(marketplace: Marketplace): string | null {
  if (sessionStorage.getItem(LANG_ENSURED_KEY) === "1") {
    return null;
  }

  if (!ENGLISH_LANGUAGE_BY_MARKETPLACE[marketplace]) {
    sessionStorage.setItem(LANG_ENSURED_KEY, "1");
    return null;
  }

  if (isPageEnglish()) {
    sessionStorage.setItem(LANG_ENSURED_KEY, "1");
    return null;
  }

  const onOrdersPath = /\/your-orders\/orders|\/gp\/your-account\/order-history/i.test(
    location.pathname,
  );
  const returnPath = onOrdersPath
    ? `${location.pathname}${location.search}${location.hash}`
    : "/your-orders/orders";

  const switchUrl = buildEnglishSwitchUrl(marketplace, returnPath);
  sessionStorage.setItem(LANG_ENSURED_KEY, "1");
  return switchUrl;
}
