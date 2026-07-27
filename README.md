# staging-rich-results-tester

Local Rich Results tester for password-protected staging sites — crawl mobile/desktop, validate JSON-LD, and review HTML/screenshots without Googlebot access.

Google’s [Rich Results Test](https://search.google.com/test/rich-results) can’t reach auth-walled staging. This tool fetches the page yourself (with Basic Auth or `?auth=user:pass`), then validates structured data in a similar UI.

> Not affiliated with Google. Results approximate Google’s Rich Results Test for staging QA.

## Features

- **URL or Code** — crawl a URL, or paste HTML / JSON-LD
- **Auth-friendly staging** — supports WebFX-style `?auth=username:password` and optional username/password fields (sends Basic Auth)
- **Smartphone / Desktop** — device UA + viewport (desktop starts at **1025×768**)
- **Tested page panel**
  - **HTML** — page source
  - **Screenshot** — headless Chromium capture
  - **More info** — HTTP response, resources, console messages
- **Structured data checks** — JSON-LD extraction and validation for common rich-result types (Organization, LocalBusiness, Breadcrumbs, Reviews, FAQ, Product, and more)

## Requirements

- **Node.js 20+** (22 recommended; see `.nvmrc`)
- Chromium for Puppeteer (installed via `postinstall`)

## Setup

```bash
git clone git@github.com:mwpanerio/staging-rich-results-tester.git
cd staging-rich-results-tester
nvm use   # or: nvm use 22
npm install
npm start
```

Open **http://localhost:3847**

`npm start` uses `scripts/start.sh`, which switches to the Node version in `.nvmrc` when nvm is available.

If screenshots are disabled / missing Chrome:

```bash
export PUPPETEER_CACHE_DIR="$HOME/.cache/puppeteer"
npx puppeteer browsers install chrome
```

## Usage

### Staging URL with auth

```
https://client.webpagefxstage.com/?auth=revenuegrowth:partner
```

Or open **Advanced auth** and enter username / password separately.

### Device

- **Smartphone** — mobile UA + viewport
- **Desktop** — desktop UA + **1025px** wide viewport

### API

```bash
curl -s -X POST http://localhost:3847/api/test \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://client.webpagefxstage.com/?auth=user:pass",
    "device": "mobile"
  }'
```

| Field | Description |
| --- | --- |
| `url` | Page to test |
| `username` / `password` | Optional Basic Auth (overrides/in addition to `?auth=`) |
| `device` | `mobile` (default) or `desktop` |
| `html` | Paste mode — skip crawl and analyze this markup |

Useful for Jenkins or other CI: call `/api/test`, then archive the JSON (and screenshot data URL if present).

## Project layout

```
lib/          auth, devices, extract, validate, Puppeteer render
public/       UI (HTML / CSS / JS)
scripts/      start.sh, smoke test
server.js     Express API + static host
```

## Notes

- Prefer this for **staging** behind auth. Re-check on production with Google’s Rich Results Test before launch.
- Screenshot mode needs a working Puppeteer Chrome install; if Chromium fails, the tool falls back to fetch-only (HTML + schema, no screenshot).
