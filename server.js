import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFetchTarget } from './lib/auth.js';
import { resolveDevice } from './lib/devices.js';
import { extractJsonLd, groupByRichResultType } from './lib/extract.js';
import { validateItem } from './lib/validate.js';
import { renderPage } from './lib/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3847;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function fetchPage({ url, username, password, device = 'mobile' }) {
  const profile = resolveDevice(device);
  const target = buildFetchTarget(url, username, password, profile.userAgent);
  const started = Date.now();

  let response;
  try {
    response = await fetch(target.href, {
      method: 'GET',
      headers: target.headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
  } catch (err) {
    return {
      ok: false,
      crawl: {
        success: false,
        crawledAt: new Date().toISOString(),
        crawlAllowed: null,
        pageFetch: 'Failed',
        indexingAllowed: null,
        finalUrl: target.href,
        status: null,
        statusText: err.message,
        contentType: null,
        durationMs: Date.now() - started,
        usedAuth: target.usedAuth,
        error: err.message,
        device: profile.id,
        deviceLabel: profile.label,
        userAgent: profile.userAgent,
        mode: 'fetch',
      },
      html: null,
      headers: {},
      screenshotBase64: null,
      moreInfo: null,
    };
  }

  const html = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const robots = response.headers.get('x-robots-tag') || '';
  const indexingAllowed = !/noindex/i.test(robots);
  const headers = Object.fromEntries(response.headers.entries());

  return {
    ok: response.ok,
    crawl: {
      success: response.ok,
      crawledAt: new Date().toISOString(),
      crawlAllowed: true,
      pageFetch: response.ok ? 'Successful' : `Failed (${response.status})`,
      indexingAllowed,
      finalUrl: response.url || target.href,
      status: response.status,
      statusText: response.statusText,
      contentType,
      durationMs: Date.now() - started,
      usedAuth: target.usedAuth,
      redirected: response.redirected,
      error: response.ok ? null : `HTTP ${response.status} ${response.statusText}`,
      device: profile.id,
      deviceLabel: profile.label,
      userAgent: profile.userAgent,
      mode: 'fetch',
    },
    html,
    headers,
    screenshotBase64: null,
    moreInfo: {
      contentType,
      httpStatus: response.status,
      renderedWith: `Fetch (${profile.label}) — screenshot unavailable`,
      viewport: `${profile.viewport.width}×${profile.viewport.height}`,
      pageResources: { failedCount: 0, loadedCount: 0, failed: [], loaded: [] },
      consoleMessages: [],
    },
  };
}

async function crawlPage(opts) {
  try {
    return await renderPage(opts);
  } catch (err) {
    console.warn('Browser render failed, falling back to fetch:', err.message);
    const fallback = await fetchPage(opts);
    if (fallback.moreInfo) {
      fallback.moreInfo.renderFallback = err.message;
    }
    return fallback;
  }
}

function buildResultPayload(crawl, html, headers, extras = {}) {
  const { screenshotBase64 = null, moreInfo = null } = extras;

  if (!html) {
    return {
      crawl,
      httpHeaders: headers,
      page: null,
      summary: {
        validCount: 0,
        invalidCount: 0,
        groupCount: 0,
        message: 'Page could not be fetched.',
      },
      groups: [],
      parseErrors: [],
      rawBlocks: [],
      testedPage: {
        html: null,
        screenshot: null,
        moreInfo,
      },
    };
  }

  const extracted = extractJsonLd(html);
  const grouped = groupByRichResultType(extracted.nodes);
  const groups = [];

  let validCount = 0;
  let invalidCount = 0;

  for (const [name, items] of grouped.entries()) {
    const validatedItems = items.map(({ type, node }) => {
      const validation = validateItem(name, node);
      if (validation.valid) validCount += 1;
      else invalidCount += 1;
      return {
        type,
        valid: validation.valid,
        critical: validation.critical,
        nonCritical: validation.nonCritical,
        data: node,
      };
    });

    const allValid = validatedItems.every((i) => i.valid);
    const hasNonCritical = validatedItems.some((i) => i.nonCritical.length > 0);

    groups.push({
      name,
      valid: allValid,
      itemCount: validatedItems.length,
      hasNonCriticalIssues: hasNonCritical,
      items: validatedItems,
    });
  }

  groups.sort((a, b) => a.name.localeCompare(b.name));

  return {
    crawl,
    httpHeaders: headers,
    page: {
      title: extracted.title,
      canonical: extracted.canonical,
      jsonLdBlockCount: extracted.blockCount,
      nodeCount: extracted.nodes.length,
    },
    summary: {
      validCount,
      invalidCount,
      groupCount: groups.length,
      message:
        validCount > 0
          ? `${validCount} valid item${validCount === 1 ? '' : 's'} detected`
          : extracted.blockCount === 0
            ? 'No structured data detected'
            : 'No eligible rich result items detected',
    },
    groups,
    parseErrors: extracted.parseErrors,
    rawBlocks: extracted.blocks.map((b) => b.raw),
    testedPage: {
      html,
      screenshot: screenshotBase64
        ? `data:image/jpeg;base64,${screenshotBase64}`
        : null,
      moreInfo: moreInfo || {
        contentType: crawl.contentType,
        httpStatus: crawl.status,
        renderedWith: crawl.deviceLabel || 'Unknown',
        viewport: null,
        pageResources: { failedCount: 0, loadedCount: 0, failed: [], loaded: [] },
        consoleMessages: [],
      },
    },
  };
}

app.post('/api/test', async (req, res) => {
  const {
    url,
    username = '',
    password = '',
    html: pastedHtml,
    device = 'mobile',
  } = req.body || {};

  const profile = resolveDevice(device);

  // Code paste mode — skip crawl
  if (pastedHtml && typeof pastedHtml === 'string') {
    const crawl = {
      success: true,
      crawledAt: new Date().toISOString(),
      crawlAllowed: true,
      pageFetch: 'Code input (not crawled)',
      indexingAllowed: null,
      finalUrl: url || '(pasted code)',
      status: 200,
      statusText: 'OK',
      contentType: 'text/html',
      durationMs: 0,
      usedAuth: false,
      redirected: false,
      error: null,
      mode: 'code',
      device: profile.id,
      deviceLabel: profile.label,
      userAgent: profile.userAgent,
    };
    return res.json(
      buildResultPayload(crawl, pastedHtml, {}, {
        screenshotBase64: null,
        moreInfo: {
          contentType: 'text/html',
          httpStatus: 200,
          renderedWith: 'Code input',
          viewport: `${profile.viewport.width}×${profile.viewport.height}`,
          pageResources: { failedCount: 0, loadedCount: 0, failed: [], loaded: [] },
          consoleMessages: [],
        },
      })
    );
  }

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A URL is required.' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Not a valid URL.' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'URL must start with http:// or https://' });
  }

  const result = await crawlPage({
    url,
    username,
    password,
    device: profile.id,
  });

  return res.json(
    buildResultPayload(result.crawl, result.html, result.headers, {
      screenshotBase64: result.screenshotBase64,
      moreInfo: result.moreInfo,
    })
  );
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Staging Rich Results Test → http://localhost:${PORT}`);
});
