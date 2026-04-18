import type { VercelRequest, VercelResponse } from '@vercel/node'

/* ── SSRF protection ── */

function isPrivateIP(hostname: string): boolean {
  const blocked = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
    /^\[::1\]$/,
    /^\[fc/i,
    /^\[fd/i,
    /^\[fe80:/i,
  ]
  return blocked.some((re) => re.test(hostname))
}

function validateUrl(raw: string): URL {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are allowed')
  }
  if (isPrivateIP(url.hostname)) {
    throw new Error('Private/reserved IPs are not allowed')
  }
  return url
}

/* ── navigation interception script ── */

const NAV_INTERCEPT_SCRIPT = `<script>
(function() {
  var realParent = window.parent;

  // Fake top/parent so page thinks it's not in an iframe
  try {
    Object.defineProperty(window, 'top', { get: function() { return window.self; } });
    Object.defineProperty(window, 'parent', { get: function() { return window.self; } });
    Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
  } catch(e) {}

  function sendNav(url, source) {
    try {
      var a = document.createElement('a');
      a.href = url;
      var absoluteUrl = a.href;
      realParent.postMessage({ type: 'iframeNavigation', url: absoluteUrl, source: source }, '*');
    } catch(e) {}
  }

  // Intercept link clicks
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el || !el.href) return;
    if (el.getAttribute('href').startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
    sendNav(el.href, 'click');
  }, true);

  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form.method && form.method.toLowerCase() === 'get' && form.action) {
      e.preventDefault();
      var url = new URL(form.action);
      var fd = new FormData(form);
      fd.forEach(function(v, k) { url.searchParams.set(k, v); });
      sendNav(url.href, 'form-get');
    }
  }, true);

  // Intercept location changes
  var realAssign = window.location.assign.bind(window.location);
  var realReplace = window.location.replace.bind(window.location);

  window.location.assign = function(url) { sendNav(url, 'location-assign'); };
  window.location.replace = function(url) { sendNav(url, 'location-replace'); };

  // Intercept window.open
  window.open = function(url) {
    if (url) sendNav(url, 'window-open');
    return null;
  };

  // Intercept pushState/replaceState
  var realPushState = history.pushState.bind(history);
  var realReplaceState = history.replaceState.bind(history);

  history.pushState = function(state, title, url) {
    if (url) sendNav(url, 'pushstate');
    return realPushState(state, title, url);
  };

  history.replaceState = function(state, title, url) {
    if (url) sendNav(url, 'replacestate');
    return realReplaceState(state, title, url);
  };

  // Block service workers and notifications
  if (navigator.serviceWorker) {
    try {
      Object.defineProperty(navigator, 'serviceWorker', {
        get: function() { return { register: function() { return Promise.resolve(); } }; }
      });
    } catch(e) {}
  }

  try {
    Notification.requestPermission = function() { return Promise.resolve('denied'); };
  } catch(e) {}
})();
</script>`

/* ── handler ── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let url: string | undefined
  let mode = 'proxy'

  if (req.method === 'POST') {
    url = req.body?.url
    mode = req.body?.mode ?? 'proxy'
  } else {
    url = req.query.url as string | undefined
    mode = (req.query.mode as string) ?? 'proxy'
  }

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  let target: URL
  try {
    target = validateUrl(url)
  } catch (e: any) {
    return res.status(400).json({ error: e.message })
  }

  /* ── check mode ── */

  if (mode === 'check') {
    try {
      const head = await fetch(target.href, { method: 'HEAD', redirect: 'follow' })
      const xfo = head.headers.get('x-frame-options')
      const csp = head.headers.get('content-security-policy')
      const blocked =
        !!xfo ||
        (csp && /frame-ancestors\s/.test(csp))

      return res.json({ url: target.href, embeddable: !blocked, xfo, csp })
    } catch {
      return res.json({ url: target.href, embeddable: false, error: 'fetch failed' })
    }
  }

  /* ── proxy mode (default): fetch & serve HTML with nav interception ── */

  try {
    const upstream = await fetch(target.href, {
      redirect: 'follow',
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      },
    })

    const contentType = upstream.headers.get('content-type') || 'text/html'

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return res.status(400).json({ error: 'Target URL did not return HTML' })
    }

    let html = await upstream.text()

    // Strip security-restricting meta tags
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi, '')
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?X-Frame-Options["']?[^>]*>/gi, '')
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '')

    // Remove existing base tags
    html = html.replace(/<base\s[^>]*>/gi, '')

    // Inject base tag + navigation interception script
    const baseTag = `<base href="${target.origin}/">`
    const injection = baseTag + NAV_INTERCEPT_SCRIPT

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${injection}`)
    } else {
      html = injection + html
    }

    // Set permissive response headers
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.setHeader('Content-Security-Policy', 'frame-ancestors *')
    res.setHeader('Access-Control-Allow-Origin', '*')
    // Explicitly do NOT set X-Frame-Options

    return res.status(upstream.status).send(html)
  } catch (e: any) {
    return res.status(502).json({ error: 'Failed to fetch target URL', detail: e.message })
  }
}
