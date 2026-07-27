import { buildFetchTarget } from './auth.js';
import { resolveDevice } from './devices.js';

let browserPromise = null;

async function launchBrowser() {
  const puppeteer = (await import('puppeteer')).default;
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath();

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
}

async function getBrowser() {
  if (browserPromise) {
    try {
      const existing = await browserPromise;
      if (existing?.connected) return existing;
    } catch {
      /* relaunch below */
    }
    browserPromise = null;
  }

  browserPromise = launchBrowser().catch((err) => {
    browserPromise = null;
    throw err;
  });

  const browser = await browserPromise;
  browser.on('disconnected', () => {
    browserPromise = null;
  });
  return browser;
}

async function withPage(fn) {
  let browser = await getBrowser();
  let page;

  try {
    page = await browser.newPage();
  } catch (err) {
    // Stale browser process — relaunch once
    browserPromise = null;
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
    browser = await getBrowser();
    page = await browser.newPage();
  }

  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

async function takeScreenshot(page) {
  try {
    return await page.screenshot({
      type: 'jpeg',
      quality: 72,
      fullPage: true,
      encoding: 'base64',
    });
  } catch {
    // Tall pages can crash full-page capture — fall back to viewport
    return page.screenshot({
      type: 'jpeg',
      quality: 72,
      fullPage: false,
      encoding: 'base64',
    });
  }
}

/**
 * Render page with device emulation, capture HTML + screenshot + console/resources.
 */
export async function renderPage({ url, username = '', password = '', device = 'mobile' }) {
  const profile = resolveDevice(device);
  const target = buildFetchTarget(url, username, password, profile.userAgent);
  const started = Date.now();
  const consoleMessages = [];
  const failedResources = [];
  const loadedResources = [];

  return withPage(async (page) => {
    await page.setViewport(profile.viewport);
    await page.setUserAgent(profile.userAgent);
    await page.setCacheEnabled(false);
    await page.setExtraHTTPHeaders({
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(target.headers.Authorization
        ? { Authorization: target.headers.Authorization }
        : {}),
    });

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now() - started,
      });
    });

    page.on('pageerror', (err) => {
      consoleMessages.push({
        type: 'error',
        text: err.message,
        timestamp: Date.now() - started,
      });
    });

    page.on('requestfailed', (req) => {
      const failure = req.failure();
      failedResources.push({
        url: req.url(),
        type: req.resourceType(),
        error: failure?.errorText || 'Failed',
      });
    });

    page.on('response', (res) => {
      const req = res.request();
      if (res.ok()) {
        loadedResources.push({
          url: req.url(),
          type: req.resourceType(),
          status: res.status(),
        });
      } else if (res.status() >= 400) {
        failedResources.push({
          url: req.url(),
          type: req.resourceType(),
          error: `HTTP ${res.status()}`,
        });
      }
    });

    const response = await page.goto(target.href, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Settle for late assets / JSON-LD without waiting forever on analytics
    await new Promise((r) => setTimeout(r, 1200));

    const html = await page.content();
    const screenshot = await takeScreenshot(page);

    const status = response?.status() ?? null;
    const headers = response ? response.headers() : {};
    const contentType = headers['content-type'] || 'text/html';
    const robots = headers['x-robots-tag'] || '';
    const indexingAllowed = !/noindex/i.test(robots);
    const finalUrl = page.url();

    const failed = dedupeResources(failedResources).slice(0, 80);
    const loaded = dedupeResources(loadedResources).slice(0, 120);
    const consoles = consoleMessages.slice(0, 100);
    const ok = Boolean(status && status >= 200 && status < 400);

    return {
      ok,
      html,
      screenshotBase64: screenshot,
      crawl: {
        success: ok,
        crawledAt: new Date().toISOString(),
        crawlAllowed: true,
        pageFetch: ok ? 'Successful' : `Failed (${status ?? 'unknown'})`,
        indexingAllowed,
        finalUrl,
        status,
        statusText: ok ? 'OK' : 'Error',
        contentType,
        durationMs: Date.now() - started,
        usedAuth: target.usedAuth,
        redirected: finalUrl !== target.href,
        error: ok ? null : `HTTP ${status ?? 'error'}`,
        device: profile.id,
        deviceLabel: profile.label,
        userAgent: profile.userAgent,
        mode: 'browser',
      },
      headers,
      moreInfo: {
        contentType,
        httpStatus: status,
        renderedWith: `Inspection Tool ${profile.label.toLowerCase()}`,
        viewport: `${profile.viewport.width}×${profile.viewport.height}`,
        pageResources: {
          failedCount: failed.length,
          loadedCount: loaded.length,
          failed,
          loaded,
        },
        consoleMessages: consoles,
      },
    };
  });
}

function dedupeResources(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = `${item.type}|${item.url}|${item.error || item.status || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
