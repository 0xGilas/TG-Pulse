#!/usr/bin/env node
/**
 * TG Pulse — Local SOCKS5 Bridge (~75 lines, zero telemetry, 127.0.0.1 only)
 * Relays encrypted MTProto WebSocket frames from the browser through a user's SOCKS5 proxy.
 * Restricts upstream targets strictly to official *.web.telegram.org WebSocket endpoints.
 */
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { SocksProxyAgent } from 'socks-proxy-agent';

const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = Number(process.env.PORT || 8787);
const BRIDGE_TOKEN = (process.env.BRIDGE_TOKEN || '').trim();
const EXTRA_ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const TELEGRAM_HOST_REGEX = /^(?:[a-zA-Z0-9-]+\.)?web\.telegram\.org$/;
const HANDSHAKE_TIMEOUT_MS = 10_000;

function isAllowedOrigin(origin) {
  if (!origin) return true; // Non-browser CLI clients do not send Origin
  if (EXTRA_ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
    if (parsed.protocol === 'https:' && (host === 'github.io' || host.endsWith('.github.io'))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isAuthorizedToken(reqUrl, msgToken) {
  if (!BRIDGE_TOKEN) return true;
  if (msgToken && msgToken === BRIDGE_TOKEN) return true;
  try {
    const parsed = new URL(reqUrl || '/', `http://${LISTEN_HOST}:${LISTEN_PORT}`);
    return parsed.searchParams.get('token') === BRIDGE_TOKEN;
  } catch {
    return false;
  }
}

function isAllowedTelegramUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'wss:' && TELEGRAM_HOST_REGEX.test(parsed.hostname);
  } catch {
    return false;
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'tg-pulse-socks-bridge', authRequired: Boolean(BRIDGE_TOKEN) }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({
  server,
  maxPayload: 1024 * 1024, // 1 MiB max frame size
  verifyClient: ({ origin, req }, cb) => {
    if (!isAllowedOrigin(origin)) {
      cb(false, 403, 'Origin not allowed');
      return;
    }
    if (BRIDGE_TOKEN) {
      const urlAuthorized = isAuthorizedToken(req.url);
      if (!urlAuthorized) {
        // Still allow handshake-level token check if not passed in query string
        cb(true);
        return;
      }
    }
    cb(true);
  },
});

wss.on('connection', (clientWs, req) => {
  let upstreamWs = null;
  let handshakeCompleted = false;

  const handshakeTimer = setTimeout(() => {
    if (!handshakeCompleted && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'error', error: 'Handshake timeout' }));
      clientWs.close(1008, 'Handshake timeout');
    }
  }, HANDSHAKE_TIMEOUT_MS);

  clientWs.on('message', (data, isBinary) => {
    if (!handshakeCompleted) {
      let msg;
      try {
        msg = JSON.parse(data.toString('utf8'));
      } catch {
        clearTimeout(handshakeTimer);
        clientWs.send(JSON.stringify({ type: 'error', error: 'Invalid handshake JSON' }));
        clientWs.close(1008);
        return;
      }

      if (!isAuthorizedToken(req.url, msg?.token)) {
        clearTimeout(handshakeTimer);
        clientWs.send(JSON.stringify({ type: 'error', error: 'Unauthorized bridge token' }));
        clientWs.close(1008, 'Unauthorized');
        return;
      }

      if (msg.type === 'ping') {
        clearTimeout(handshakeTimer);
        clientWs.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        return;
      }

      if (msg.type !== 'connect' || !isAllowedTelegramUrl(msg.targetUrl)) {
        clearTimeout(handshakeTimer);
        clientWs.send(JSON.stringify({ type: 'error', error: 'Target URL not in *.web.telegram.org allowlist' }));
        clientWs.close(1008);
        return;
      }

      const s = msg.socks5 || {};
      if (!s.host || !s.port) {
        clearTimeout(handshakeTimer);
        clientWs.send(JSON.stringify({ type: 'error', error: 'Missing SOCKS5 host or port' }));
        clientWs.close(1008);
        return;
      }

      const auth =
        s.username && s.password
          ? `${encodeURIComponent(s.username)}:${encodeURIComponent(s.password)}@`
          : '';
      const safeHost = String(s.host).trim().replace(/[^a-zA-Z0-9.:\[\]-]/g, '');
      const safePort = Math.min(65535, Math.max(1, Number(s.port) || 1080));
      if (!safeHost) {
        clearTimeout(handshakeTimer);
        clientWs.send(JSON.stringify({ type: 'error', error: 'Invalid SOCKS5 host' }));
        clientWs.close(1008);
        return;
      }
      const proxyUri = `socks5h://${auth}${safeHost}:${safePort}`;
      const agent = new SocksProxyAgent(proxyUri);

      upstreamWs = new WebSocket(msg.targetUrl, 'binary', { agent });
      upstreamWs.binaryType = 'arraybuffer';

      upstreamWs.on('open', () => {
        handshakeCompleted = true;
        clearTimeout(handshakeTimer);
        clientWs.send(JSON.stringify({ type: 'ready' }));
      });

      upstreamWs.on('message', (upData, upIsBinary) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(upData, { binary: upIsBinary });
        }
      });

      upstreamWs.on('error', (err) => {
        clearTimeout(handshakeTimer);
        if (!handshakeCompleted && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', error: err.message }));
        }
        clientWs.close(1011, err.message);
      });

      upstreamWs.on('close', (code, reason) => {
        clearTimeout(handshakeTimer);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(code === 1005 || code === 1006 ? 1000 : code, reason.toString());
        }
      });
      return;
    }

    if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.send(data, { binary: isBinary });
    }
  });

  clientWs.on('close', () => {
    clearTimeout(handshakeTimer);
    if (upstreamWs && upstreamWs.readyState <= WebSocket.OPEN) {
      upstreamWs.close();
    }
  });
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[tg-pulse-socks-bridge] Listening on ws://${LISTEN_HOST}:${LISTEN_PORT}`);
});
