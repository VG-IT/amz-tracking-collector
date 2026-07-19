# Amazon Tracking Collector (Chrome Extension)

Chrome MV3 extension that scrapes Amazon order history (list → detail → shipment → tracking) and uploads structured order data to EveryMarket.

Supports **US / UK / DE / MX / CA** marketplaces.

## Requirements

- Node.js 18+
- [pnpm](https://pnpm.io/) (preferred; `npm` also works)
- Chrome / Chromium

## Setup

```bash
pnpm install
pnpm build
```

Load the extension:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `build/` directory
4. Open the popup, enter **Buyer email** and **Everymarket Token**, choose marketplace, click **Save**

## Usage

1. Extension icon opens settings only (no auto collect)
2. Click **Check Login** to open the Amazon orders URL in the background:
   - Sign-in page / missing auth cookie → prompt to sign in
   - Otherwise → treated as logged in (result is cached)
3. On any Amazon page, click the bottom-right **Collect Orders** button to start (or use **Start** in the popup)
4. If logout is detected while collecting, run **Check Login** again
5. Opened collector tabs are closed when the run finishes

## Develop

```bash
pnpm dev
```

Vite serves the popup with HMR. Content/background scripts still need a full build to load in Chrome.

## Build

```bash
pnpm build
```

Output goes to `build/`.

## Tests

Tests use [Vitest](https://vitest.dev/) + jsdom against HTML fixtures under `tests/fixtures/`.

```bash
# all tests
npx vitest run

# focused suites (recommended while iterating on extractors)
npx vitest run tests/order/extract tests/tracking/extract-track-info.test.ts
```

## Notes

- Buyer email is stored in `chrome.storage.sync`
- Everymarket token is stored in `chrome.storage.local` and shown as a password field
- Collection stops when orders are older than the configured **Lookback days**
- Before extraction, the collector switches the Amazon UI to English when the marketplace supports it (DE / MX / CA / etc.)
- Build uses inline source maps and disables minify for easier debugging in Chrome
