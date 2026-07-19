import {
  COOKIE_BY_MARKETPLACE,
  DOMAIN_BY_MARKETPLACE,
  marketplaceFromHost,
  type Marketplace,
} from "../../config";

export function getCurrentAmazonCountry(): Marketplace | null {
  return marketplaceFromHost(location.hostname);
}

export function isLogged(country: Marketplace): boolean {
  const cookieKey = COOKIE_BY_MARKETPLACE[country];
  return cookieKey ? document.cookie.includes(cookieKey) : false;
}

export function isLoginPage(): boolean {
  const href = location.href.toLowerCase();
  if (
    href.includes("/ap/signin") ||
    href.includes("/ap/mfa") ||
    href.includes("/ax/claim") ||
    (href.includes("signin") && href.includes("openid"))
  ) {
    return true;
  }

  const country = getCurrentAmazonCountry();
  if (!country) return true;
  return !isLogged(country);
}

export function buildContext(): { domain?: string; country?: string } {
  const country = getCurrentAmazonCountry() ?? undefined;
  const domain = country ? DOMAIN_BY_MARKETPLACE[country].replace(/^www\./, "") : undefined;
  return { domain, country };
}
