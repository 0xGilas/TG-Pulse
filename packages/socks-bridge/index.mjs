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

function isAllowedTelegramUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'wss:' &&
      (parsed.hostname === 'web.telegram.org' || parsed.hostname.endsWith('.web.telegram.org'))
    );
  } catch {
    return false;
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'tg-pulse-socks-bridge' }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (clientWs) => {
  let upstreamWs = null;
  let handshakeCompleted = false;

  clientWs.on('message', (data, isBinary) => {
    if (!handshakeCompleted) {
      let msg;
      try {
        msg = JSON.parse(data.toString('utf8'));
      } catch {
        clientWs.send(JSON.stringify({ type: 'error', error: 'Invalid handshake JSON' }));
        clientWs.close(1008);
        return;
      }

      if (msg.type === 'ping') {
        clientWs.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        return;
      }

      if (msg.type !== 'connect' || !isAllowedTelegramUrl(msg.targetUrl)) {
        clientWs.send(JSON.stringify({ type: 'error', error: 'Target URL not in *.web.telegram.org allowlist' }));
        clientWs.close(1008);
        return;
      }

      const s = msg.socks5 || {};
      if (!s.host || !s.port) {
        clientWs.send(JSON.stringify({ type: 'error', error: 'Missing SOCKS5 host or port' }));
        clientWs.close(1008);
        return;
      }

      const auth =
        s.username && s.password
          ? `${encodeURIComponent(s.username)}:${encodeURIComponent(s.password)}@`
          : '';
      const proxyUri = `socks5h://${auth}${s.host}:${Number(s.port)}`;
      const agent = new SocksProxyAgent(proxyUri);

      upstreamWs = new WebSocket(msg.targetUrl, 'binary', { agent });
      upstreamWs.binaryType = 'arraybuffer';

      upstreamWs.on('open', () => {
        handshakeCompleted = true;
        clientWs.send(JSON.stringify({ type: 'ready' }));
      });

      upstreamWs.on('message', (upData, upIsBinary) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(upData, { binary: upIsBinary });
        }
      });

      upstreamWs.on('error', (err) => {
        if (!handshakeCompleted && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', error: err.message }));
        }
        clientWs.close(1011, err.message);
      });

      upstreamWs.on('close', (code, reason) => {
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
    if (upstreamWs && upstreamWs.readyState <= WebSocket.OPEN) {
      upstreamWs.close();
    }
  });
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[tg-pulse-socks-bridge] Listening on ws://${LISTEN_HOST}:${LISTEN_PORT}`);
});
