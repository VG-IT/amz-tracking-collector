const BRAND_MAP: Record<string, string> = {
  "American Express": "AMEX",
  AmericanExpress: "AMEX",
  Amex: "AMEX",
  AMEX: "AMEX",
  Visa: "Visa",
  MasterCard: "MasterCard",
  Mastercard: "MasterCard",
  "Master Card": "MasterCard",
};

function normalizeBrand(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  return BRAND_MAP[cleaned] ?? cleaned;
}

function formatCard(brand: string | null, last4: string | null, localeHint?: string | null) {
  if (!brand && !last4) return null;
  if (!last4) return brand;
  const ending =
    localeHint && /termina/i.test(localeHint)
      ? `que termina en ${last4}`
      : `ending in ${last4}`;
  return brand ? `${brand} ${ending}` : ending;
}

function extractLast4(text: string | null | undefined): string | null {
  if (!text) return null;
  const match =
    text.match(/(?:ending in|que termina en|endigt auf|se terminant par)\s*(\d{4})/i) ||
    text.match(/[•*]{2,}\s*(\d{4})/) ||
    text.match(/\b(\d{4})\b/);
  return match?.[1] ?? null;
}

export function extractPaymentMethod(doc: Document): string | null {
  const item = doc.querySelector(
    '[data-component="viewPaymentPlanSummaryWidget"] li.pmts-payments-instrument-detail-box-paystationpaymentmethod, \
     li.pmts-payments-instrument-detail-box-paystationpaymentmethod',
  );

  if (item) {
    const rawBrand = item.querySelector("img")?.getAttribute("alt")?.trim();
    const brand = normalizeBrand(rawBrand);

    const tail =
      item.querySelector(".a-color-base, .pmts-account-number")?.textContent?.trim() ??
      null;
    const last4 = extractLast4(tail) || extractLast4(item.textContent);
    const localeHint = item.textContent || "";

    const formatted = formatCard(brand, last4, localeHint);
    if (formatted) return formatted;

    const text = item.textContent?.replace(/\s+/g, " ").trim();
    if (text) return text;
  }

  /* CA / React payment widget */
  const caBrand = doc
    .querySelector('[data-testid="method-details-name"]')
    ?.textContent
    ?.trim();

  const caLast4 = doc
    .querySelector('[data-testid="method-details-number"]')
    ?.textContent
    ?.trim();

  if (caBrand || caLast4) {
    const brand = normalizeBrand(caBrand);
    const last4 = extractLast4(caLast4) || caLast4?.replace(/\D/g, "").slice(-4) || null;
    return formatCard(brand, last4);
  }

  /* Next.js (__NEXT_DATA__) */
  const next = doc.querySelector("#__NEXT_DATA__");
  if (next?.textContent) {
    try {
      const data = JSON.parse(next.textContent);
      const list =
        data?.props?.pageProps?.applicationData
          ?.getSelectedPaymentMethodsResponse
          ?.displayResponse
          ?.paymentMethodInstrumentDisplayList
          ?.paymentMethodInstrumentDisplayDatumList;

      if (Array.isArray(list) && list.length > 0) {
        const core = list[0].paymentMethodDisplayDatumCore;
        const brand = normalizeBrand(core?.paymentMethodHeader);
        const last4 = core?.paymentMethodNumber?.lastDigits ?? null;
        const formatted = formatCard(brand, last4);
        if (formatted) return formatted;
      }
    } catch {
      // ignore
    }
  }

  const paymentWidgetText = doc
    .querySelector('[data-component="viewPaymentPlanSummaryWidget"]')
    ?.textContent
    ?.replace(/\s+/g, " ")
    .trim();

  if (paymentWidgetText) {
    const cardMatch = paymentWidgetText.match(
      /(American\s*Express|AmericanExpress|Amex|Visa|Master\s*Card|Mastercard)\s*(?:[•*]{2,}\s*|ending in\s*|que termina en\s*)(\d{4})/i,
    );

    if (cardMatch) {
      const brand = normalizeBrand(cardMatch[1]);
      return formatCard(brand, cardMatch[2], paymentWidgetText);
    }
  }

  return null;
}
