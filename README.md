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

## Release (GitHub Release zip)

Not published to the Chrome Web Store. Updates are zip files attached to [GitHub Releases](https://github.com/VG-IT/amz-tracking-collector/releases).

### Publish a new version (one-click)

Working tree must be clean. Requires [GitHub CLI](https://cli.github.com/) (`gh auth login`).

```bash
# bump patch (1.1.0 → 1.1.1), build, commit, tag, upload zip
npm run publish:release

# or: --minor / --major / --version 1.2.0 / --current / --dry-run
npm run publish:current
```

Windows: double-click `scripts/publish-release.cmd` (publishes **current** version).

### Auto deploy (CI)

Pushing to `main` with a new `src/manifest.json` version (no matching tag yet) triggers [`.github/workflows/auto-deploy.yml`](.github/workflows/auto-deploy.yml): build zip → create GitHub Release automatically.

You can still publish manually with `npm run publish:release`.

### Install / update for users

**Windows without Node/npm** (recommended for ops machines):

1. Copy `scripts/deploy-windows.cmd` + `scripts/deploy-windows.ps1` to the PC  
   (or clone/download the repo zip — only these two files are needed)
2. Double-click `deploy-windows.cmd`

Release zips are **public** (repo is public). No GitHub token required.

Installs to `%LOCALAPPDATA%\amz-tracking-collector`, then opens `chrome://extensions`.  
First time: **Load unpacked** → that folder. Later: run again → **Reload**.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-windows.ps1 -InstallDir "C:\extensions\amz-tracking-collector"
powershell -ExecutionPolicy Bypass -File scripts\deploy-windows.ps1 -DryRun
```

**Dev machine (Node + gh):**

```bash
npm run deploy
# or double-click scripts/deploy.cmd
```

Override install path:

```bash
npm run deploy -- --dir "C:\\extensions\\amz-tracking-collector"
# or set AMZ_TRACKING_COLLECTOR_HOME / write path into .deploy-dir
```

Manual download (no auth):

https://github.com/VG-IT/amz-tracking-collector/releases/latest

The popup checks GitHub Releases on open and prompts when a newer version exists.

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
