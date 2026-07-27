const form = document.getElementById('test-form');
const urlInput = document.getElementById('url-input');
const userInput = document.getElementById('user-input');
const passInput = document.getElementById('pass-input');
const codeInput = document.getElementById('code-input');
const submitBtn = document.getElementById('submit-btn');
const clearBtn = document.getElementById('clear-btn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const testedPageEl = document.getElementById('tested-page');
const resultsLayout = document.getElementById('results-layout');
const urlPanel = document.getElementById('url-panel');
const codePanel = document.getElementById('code-panel');

let activeTab = 'url';
let lastResult = null;
let testedPageView = 'screenshot';

document.querySelectorAll('.tabs__btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tabs__btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    urlPanel.classList.toggle('is-hidden', activeTab !== 'url');
    codePanel.classList.toggle('is-hidden', activeTab !== 'code');
    submitBtn.textContent = activeTab === 'url' ? 'Test URL' : 'Test code';
  });
});

clearBtn.addEventListener('click', () => {
  form.reset();
  hide(statusEl);
  hide(resultsLayout);
  resultsEl.innerHTML = '';
  testedPageEl.innerHTML = '';
  lastResult = null;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const device =
    form.querySelector('input[name="device"]:checked')?.value || 'mobile';

  const payload =
    activeTab === 'code'
      ? {
          html: codeInput.value.trim(),
          url: urlInput.value.trim() || undefined,
          device,
        }
      : {
          url: urlInput.value.trim(),
          username: userInput.value.trim(),
          password: passInput.value,
          device,
        };

  if (activeTab === 'url' && !payload.url) {
    showStatus('error', 'Enter a URL to test.');
    return;
  }

  if (activeTab === 'code' && !payload.html) {
    showStatus('error', 'Paste HTML or JSON-LD to test.');
    return;
  }

  submitBtn.disabled = true;
  hide(resultsLayout);
  showStatus(
    'loading',
    activeTab === 'url'
      ? `Crawling as ${device === 'desktop' ? 'desktop' : 'smartphone'}…`
      : 'Analyzing code…'
  );

  try {
    const res = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }

    hide(statusEl);
    lastResult = data;
    testedPageView = data.testedPage?.screenshot ? 'screenshot' : 'html';
    renderResults(data);
    renderTestedPage(data);
    resultsLayout.classList.remove('is-hidden');
  } catch (err) {
    showStatus('error', err.message || 'Something went wrong.');
  } finally {
    submitBtn.disabled = false;
  }
});

function showStatus(kind, message) {
  statusEl.className = `status status--${kind}`;
  statusEl.textContent = message;
  statusEl.classList.remove('is-hidden');
}

function hide(el) {
  el.classList.add('is-hidden');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatMs(ms) {
  const sec = (ms / 1000).toFixed(3);
  return `${sec}s`;
}

function renderResults(data) {
  const { crawl, summary, groups, page, parseErrors } = data;
  const crawlOk = crawl?.success;
  const hasValid = summary.validCount > 0;
  const iconClass = !crawlOk ? 'bad' : hasValid ? 'ok' : 'warn';
  const icon = !crawlOk ? '!' : hasValid ? '✓' : '–';

  const crawlRows = [
    ['Crawled successfully on', formatDate(crawl.crawledAt)],
    ['Crawled as', crawl.deviceLabel || '—'],
    ['Crawl allowed?', crawl.crawlAllowed == null ? '—' : crawl.crawlAllowed ? 'Yes' : 'No'],
    ['Page fetch', crawl.pageFetch || '—'],
    ['Indexing allowed?', crawl.indexingAllowed == null ? '—' : crawl.indexingAllowed ? 'Yes' : 'No'],
    ['Final URL', crawl.finalUrl || '—'],
    ['HTTP status', crawl.status != null ? `${crawl.status} ${crawl.statusText || ''}`.trim() : '—'],
    ['Auth used', crawl.usedAuth ? 'Yes (Basic Auth)' : 'No'],
    ['Mode', crawl.mode || '—'],
    ['Duration', `${crawl.durationMs ?? 0} ms`],
    ['Page title', page?.title || '—'],
    ['JSON-LD blocks', String(page?.jsonLdBlockCount ?? 0)],
  ];

  resultsEl.innerHTML = `
    <div class="summary">
      <div class="summary__icon summary__icon--${iconClass}" aria-hidden="true">${icon}</div>
      <div>
        <h3>${escapeHtml(summary.message)}</h3>
        <p>
          ${
            hasValid
              ? 'Valid items are eligible for rich-result-style presentation (local approximation of Google’s test).'
              : crawlOk
                ? 'The page was fetched, but no valid rich-result items were found.'
                : 'Fix crawl/auth issues, then retest.'
          }
        </p>
      </div>
    </div>

    <div class="section">
      <h4>Crawl</h4>
      <div class="crawl-grid">
        ${crawlRows
          .map(
            ([label, value]) => `
          <div class="crawl-item">
            <span>${escapeHtml(label)}</span>
            <strong class="${label === 'Page fetch' ? (crawlOk ? 'ok' : 'bad') : ''}">${escapeHtml(value)}</strong>
          </div>`
          )
          .join('')}
      </div>
      ${
        crawl.error
          ? `<p class="bad" style="margin:0.85rem 0 0">${escapeHtml(crawl.error)}</p>`
          : ''
      }
    </div>

    <div class="section">
      <h4>Detected structured data</h4>
      ${
        groups.length
          ? groups.map((group, index) => renderGroup(group, index)).join('')
          : `<p class="hint" style="margin:0">No recognized rich-result types were detected in JSON-LD.</p>`
      }
      ${
        parseErrors?.length
          ? `<div style="margin-top:0.85rem">
              <p class="bad" style="margin:0 0 0.35rem">JSON-LD parse errors</p>
              <ul class="issue-list issue-list--critical">
                ${parseErrors.map((e) => `<li>${escapeHtml(e.message)}</li>`).join('')}
              </ul>
            </div>`
          : ''
      }
    </div>
  `;

  resultsEl.querySelectorAll('.group__head').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.group')?.classList.toggle('is-open');
    });
  });

  resultsEl.querySelector('.group')?.classList.add('is-open');
}

function renderGroup(group, index) {
  const statusClass = group.valid ? 'ok' : 'bad';
  const statusLabel = group.valid ? 'valid' : 'invalid';
  const nonCriticalNote = group.hasNonCriticalIssues
    ? ' · Non-critical issues detected'
    : '';

  return `
    <div class="group" data-index="${index}">
      <button class="group__head" type="button">
        <span class="${statusClass}" aria-hidden="true">${group.valid ? '✓' : '!'}</span>
        <span class="group__title">${escapeHtml(group.name)}</span>
        <span class="group__meta">
          ${group.itemCount} ${statusLabel} item${group.itemCount === 1 ? '' : 's'} detected${nonCriticalNote}
        </span>
      </button>
      <div class="group__body">
        ${group.items.map((item) => renderItem(item)).join('')}
      </div>
    </div>
  `;
}

function renderItem(item) {
  return `
    <article class="item">
      <p class="item__type">
        <span class="${item.valid ? 'ok' : 'bad'}">${item.valid ? '✓' : '!'}</span>
        ${escapeHtml(item.type)}
      </p>
      ${
        item.critical.length
          ? `<ul class="issue-list issue-list--critical">
              ${item.critical.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
            </ul>`
          : ''
      }
      ${
        item.nonCritical.length
          ? `<ul class="issue-list issue-list--warn">
              ${item.nonCritical.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
            </ul>`
          : item.valid
            ? `<p class="hint" style="margin:0">No issues detected for this item.</p>`
            : ''
      }
      <pre class="json">${escapeHtml(JSON.stringify(item.data, null, 2))}</pre>
    </article>
  `;
}

function renderTestedPage(data) {
  const tested = data.testedPage || {};
  const hasScreenshot = Boolean(tested.screenshot);
  const hasHtml = Boolean(tested.html);

  if (!hasScreenshot && testedPageView === 'screenshot') {
    testedPageView = hasHtml ? 'html' : 'info';
  }

  const screenshotHint =
    !hasScreenshot && data.testedPage?.moreInfo?.renderFallback
      ? `<p class="hint tested-page__hint">Screenshot unavailable: ${escapeHtml(
          String(data.testedPage.moreInfo.renderFallback).split('\n')[0]
        )}</p>`
      : !hasScreenshot
        ? `<p class="hint tested-page__hint">Screenshot unavailable for this run.</p>`
        : '';

  testedPageEl.innerHTML = `
    <div class="tested-page__header">
      <h3>Tested page</h3>
      <div class="tested-page__tabs" role="tablist">
        <button type="button" class="tested-page__tab ${testedPageView === 'html' ? 'is-active' : ''}" data-view="html" ${hasHtml ? '' : 'disabled'}>HTML</button>
        <button type="button" class="tested-page__tab ${testedPageView === 'screenshot' ? 'is-active' : ''}" data-view="screenshot" ${hasScreenshot ? '' : 'disabled'}>Screenshot</button>
        <button type="button" class="tested-page__tab ${testedPageView === 'info' ? 'is-active' : ''}" data-view="info">More info</button>
      </div>
      ${screenshotHint}
    </div>
    <div class="tested-page__body">
      ${renderTestedPageBody(testedPageView, data)}
    </div>
  `;

  testedPageEl.querySelectorAll('.tested-page__tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      testedPageView = btn.dataset.view;
      renderTestedPage(lastResult);
    });
  });

  if (testedPageView === 'html' && hasHtml) {
    const source = testedPageEl.querySelector('#tested-source');
    if (source) source.textContent = tested.html || '';
    testedPageEl.querySelector('#copy-html-btn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(tested.html || '');
        const btn = testedPageEl.querySelector('#copy-html-btn');
        if (btn) {
          btn.textContent = 'Copied';
          setTimeout(() => {
            btn.textContent = 'Copy HTML';
          }, 1200);
        }
      } catch {
        /* ignore */
      }
    });
  }

  testedPageEl.querySelectorAll('[data-accordion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.info-block')?.classList.toggle('is-open');
    });
  });
}

function renderTestedPageBody(view, data) {
  const tested = data.testedPage || {};
  const crawl = data.crawl || {};
  const more = tested.moreInfo || {};
  const headers = data.httpHeaders || {};

  if (view === 'html') {
    return `
      <div class="tested-html">
        <div class="tested-html__toolbar">
          <span>HTML source</span>
          <button type="button" class="btn btn--ghost btn--small" id="copy-html-btn">Copy HTML</button>
        </div>
        <pre class="tested-source" id="tested-source"></pre>
      </div>
    `;
  }

  if (view === 'screenshot') {
    if (!tested.screenshot) {
      return `<p class="hint">No screenshot available for this run.</p>`;
    }
    return `
      <div class="tested-shot ${crawl.device === 'mobile' ? 'tested-shot--mobile' : 'tested-shot--desktop'}">
        <p class="tested-shot__meta">
          Rendered with Inspection Tool ${escapeHtml((crawl.deviceLabel || '').toLowerCase())}
          ${more.viewport ? ` · ${escapeHtml(more.viewport)}` : ''}
        </p>
        <img src="${tested.screenshot}" alt="Screenshot of tested page" />
      </div>
    `;
  }

  // More info
  const failed = more.pageResources?.failed || [];
  const loaded = more.pageResources?.loaded || [];
  const consoles = more.consoleMessages || [];
  const headerText = formatHttpResponse(crawl, headers);

  return `
    <div class="more-info">
      <div class="crawl-grid more-info__grid">
        <div class="crawl-item">
          <span>Rendered with</span>
          <strong>${escapeHtml(more.renderedWith || crawl.deviceLabel || '—')}</strong>
        </div>
        <div class="crawl-item">
          <span>Content type</span>
          <strong>${escapeHtml(more.contentType || crawl.contentType || '—')}</strong>
        </div>
        <div class="crawl-item">
          <span>Viewport</span>
          <strong>${escapeHtml(more.viewport || '—')}</strong>
        </div>
        <div class="crawl-item">
          <span>User-Agent</span>
          <strong class="ua">${escapeHtml(crawl.userAgent || '—')}</strong>
        </div>
      </div>

      <div class="info-block is-open">
        <button type="button" class="info-block__head" data-accordion>
          <span>HTTP Response</span>
          <strong class="${crawl.success ? 'ok' : 'bad'}">${escapeHtml(
            crawl.status != null ? `${crawl.status} ${crawl.statusText || ''}`.trim() : '—'
          )}</strong>
        </button>
        <div class="info-block__body">
          <pre class="json">${escapeHtml(headerText)}</pre>
        </div>
      </div>

      <div class="info-block">
        <button type="button" class="info-block__head" data-accordion>
          <span>Page resources</span>
          <strong>${failed.length}/${Math.max(failed.length + loaded.length, failed.length)} couldn’t be loaded</strong>
        </button>
        <div class="info-block__body">
          <h5>Resources that didn’t load</h5>
          ${
            failed.length
              ? `<ul class="resource-list">
                  ${failed
                    .map(
                      (r) => `<li>
                        <span class="bad">${escapeHtml(r.error || 'Error')}</span>
                        <span class="resource-type">${escapeHtml(r.type || 'other')}</span>
                        <code>${escapeHtml(r.url)}</code>
                      </li>`
                    )
                    .join('')}
                </ul>`
              : `<p class="hint">None</p>`
          }
          <h5>Resources that loaded</h5>
          ${
            loaded.length
              ? `<ul class="resource-list resource-list--ok">
                  ${loaded
                    .slice(0, 40)
                    .map(
                      (r) => `<li>
                        <span class="ok">${escapeHtml(String(r.status || 200))}</span>
                        <span class="resource-type">${escapeHtml(r.type || 'other')}</span>
                        <code>${escapeHtml(r.url)}</code>
                      </li>`
                    )
                    .join('')}
                </ul>`
              : `<p class="hint">None recorded (fetch-only mode)</p>`
          }
        </div>
      </div>

      <div class="info-block">
        <button type="button" class="info-block__head" data-accordion>
          <span>JavaScript console messages</span>
          <strong>${consoles.length} message${consoles.length === 1 ? '' : 's'}</strong>
        </button>
        <div class="info-block__body">
          ${
            consoles.length
              ? `<ul class="console-list">
                  ${consoles
                    .map(
                      (m) => `<li class="console-list__item console-list__item--${escapeHtml(m.type)}">
                        <span class="console-type">${escapeHtml(m.type)}</span>
                        <span class="console-time">${escapeHtml(formatMs(m.timestamp || 0))}</span>
                        <p>${escapeHtml(m.text)}</p>
                      </li>`
                    )
                    .join('')}
                </ul>`
              : `<p class="hint">No console messages${crawl.mode === 'fetch' ? ' (screenshot/browser mode unavailable)' : ''}.</p>`
          }
          ${
            more.renderFallback
              ? `<p class="hint">Browser render fallback: ${escapeHtml(more.renderFallback)}</p>`
              : ''
          }
        </div>
      </div>
    </div>
  `;
}

function formatHttpResponse(crawl, headers) {
  const statusLine = `HTTP/1.1 ${crawl.status ?? '—'} ${crawl.statusText || ''}`.trim();
  const headerLines = Object.entries(headers || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `${statusLine}\n${headerLines}`.trim();
}

// Prefill from query string: ?url=...&device=desktop
const params = new URLSearchParams(window.location.search);
const prefillUrl = params.get('url');
if (prefillUrl) {
  urlInput.value = prefillUrl;
}
const prefillDevice = params.get('device');
if (prefillDevice === 'desktop' || prefillDevice === 'mobile') {
  const radio = form.querySelector(`input[name="device"][value="${prefillDevice}"]`);
  if (radio) radio.checked = true;
}
