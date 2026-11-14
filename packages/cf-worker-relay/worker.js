/**
 * TG Pulse — Personal Cloudflare Worker WebSocket Relay
 * Deploy to your own Cloudflare account (`wrangler deploy`) to relay encrypted MTProto
 * WebSocket traffic to official *.web.telegram.org endpoints without installing local software.
 */
export default {
  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('TG Pulse Relay Ready. Connect via WebSocket with ?target=wss://...', {
        status: 200,
      });
    }

    const url = new URL(request.url);
    const targetRaw = url.searchParams.get('target');
    if (!targetRaw) {
      return new Response('Missing target parameter', { status: 400 });
    }

    let targetUrl;
    try {
      targetUrl = new URL(targetRaw);
    } catch {
      return new Response('Invalid target URL', { status: 400 });
    }

    if (
      targetUrl.protocol !== 'wss:' ||
      !(targetUrl.hostname === 'web.telegram.org' || targetUrl.hostname.endsWith('.web.telegram.org'))
    ) {
      return new Response('Target hostname not allowed', { status: 403 });
    }

    const httpTarget = targetUrl.toString().replace(/^wss:/, 'https:');
    return fetch(httpTarget, {
      headers: request.headers,
    });
  },
};
