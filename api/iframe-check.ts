import type { VercelRequest, VercelResponse } from '@vercel/node'

/* ── SSRF protection ── */

function isPrivateIP(hostname: string): boolean {
  // Block common private/reserved ranges and localhost
  const blocked = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./, // link-local
    /^\[::1\]$/,   // IPv6 localhost
    /^\[fc/i,      // IPv6 private
    /^\[fd/i,      // IPv6 private
    /^\[fe80:/i,   // IPv6 link-local
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

/* ── handler ── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url, mode = 'proxy' } = req.query as { url?: string; mode?: string }

  if (!url) {
    return res.status(400).json({ error: 'Missing ?url= parameter' })
  }

  let target: URL
  try {
    target = validateUrl(url)
  } catch (e: any) {
    return res.status(400).json({ error: e.message })
  }

  /* ── check mode: HEAD request to see if iframe-friendly ── */

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

  /* ── proxy mode (default): fetch & serve HTML ── */

  try {
    const upstream = await fetch(target.href, {
      redirect: 'follow',
      headers: {
        'User-Agent': req.headers['user-agent'] || '',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      },
    })

    const contentType = upstream.headers.get('content-type') || 'text/html'

    // Only proxy HTML content
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return res.status(400).json({ error: 'Target URL did not return HTML' })
    }

    let html = await upstream.text()

    // Strip all script tags to prevent proxied JS from crashing the host app
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    html = html.replace(/<script\b[^>]*\/>/gi, '')

    // Inject <base> tag so relative URLs resolve against the original site
    const baseTag = `<base href="${target.origin}/">`
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
    } else {
      html = baseTag + html
    }

    // Set response headers — strip frame-blocking headers
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    // Explicitly do NOT set X-Frame-Options or CSP frame-ancestors

    return res.status(upstream.status).send(html)
  } catch (e: any) {
    return res.status(502).json({ error: 'Failed to fetch target URL', detail: e.message })
  }
}
