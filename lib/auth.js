/**
 * Parse staging auth from URL (?auth=user:pass) or explicit fields.
 * WebFX-style: https://example.webpagefxstage.com/?auth=revenuegrowth:partner
 */

export function parseAuthFromUrl(rawUrl) {
  const url = new URL(rawUrl);
  const authParam = url.searchParams.get('auth');
  let username = '';
  let password = '';

  if (authParam && authParam.includes(':')) {
    const colon = authParam.indexOf(':');
    username = authParam.slice(0, colon);
    password = authParam.slice(colon + 1);
  }

  return { url, username, password, authParam };
}

export function buildFetchTarget(
  rawUrl,
  username = '',
  password = '',
  userAgent =
    'Mozilla/5.0 (compatible; StagingRichResultsTest/1.0; +local)'
) {
  const parsed = parseAuthFromUrl(rawUrl);
  const user = username || parsed.username;
  const pass = password || parsed.password;

  // Keep ?auth= on the request URL — some stage stacks read it server-side.
  // Also send Basic Auth when credentials are present.
  const headers = {
    'User-Agent': userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  if (user && pass) {
    const token = Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  return {
    href: parsed.url.href,
    username: user,
    password: pass,
    usedAuth: Boolean(user && pass),
    headers,
  };
}
