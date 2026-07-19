export type Marketplace = "us" | "uk" | "de" | "mx" | "ca";

export const DOMAIN_BY_MARKETPLACE: Record<Marketplace, string> = {
  us: "www.amazon.com",
  uk: "www.amazon.co.uk",
  de: "www.amazon.de",
  mx: "www.amazon.com.mx",
  ca: "www.amazon.ca",
};

export const SOURCE_BY_MARKETPLACE: Record<Marketplace, string> = {
  us: "AMZ_US",
  uk: "AMZ_UK",
  de: "AMZ_DE",
  mx: "AMZ_MX",
  ca: "AMZ_CA",
};

export const COOKIE_BY_MARKETPLACE: Record<Marketplace, string> = {
  us: "x-main=",
  uk: "x-acbuk=",
  de: "x-acbde=",
  mx: "x-acbmx=",
  ca: "x-acbca=",
};

/** English locale code when the marketplace offers an English UI; null = skip switch. */
export const ENGLISH_LANGUAGE_BY_MARKETPLACE: Record<Marketplace, string | null> = {
  us: "en_US",
  uk: "en_GB",
  de: "en_GB",
  mx: "en_US",
  ca: "en_CA",
};

export function ordersUrl(marketplace: Marketplace): string {
  const host = DOMAIN_BY_MARKETPLACE[marketplace];
  return `https://${host}/your-orders/orders`;
}

export function signInUrl(marketplace: Marketplace): string {
  const host = DOMAIN_BY_MARKETPLACE[marketplace];
  return `https://${host}/ap/signin`;
}

export function isAmazonHost(hostname: string): boolean {
  return /(^|\.)amazon\.(com|co\.uk|de|ca|com\.mx)$/i.test(hostname);
}

export function marketplaceFromHost(hostname: string): Marketplace | null {
  const host = hostname.replace(/^www\./, "");
  if (host === "amazon.com") return "us";
  if (host === "amazon.co.uk") return "uk";
  if (host === "amazon.de") return "de";
  if (host === "amazon.com.mx") return "mx";
  if (host === "amazon.ca") return "ca";
  return null;
}
