/// <reference lib="webworker" />

import { MemoryStorage, TelegramClient, WebSocketTransport, tl } from '@mtcute/web';
import type { WebSocketConstructor } from '@fuman/net';
import type {
  ApiCredentials,
  BroadcastOverviewStats,
  ChannelSummary,
  MediaKind,
  NetworkConfig,
  ParsedStatsGraph,
  PostDetailedStats,
  PublicForwardRecord,
  RawChannelMessage,
  ReactionCount,
  TelegramUserSummary,
} from '../types/analytics';
import {
  computeEvergreenRatio,
  extractDailyActivityFromGraph,
  parseTelegramStatsGraph,
} from '../utils/analyticsMath';

export interface AttributionScanCandidate {
  key: string;
  primaryId: number;
  date: number;
  forwards: number;
  views: number;
}

export interface AttributionScanItemResult {
  postKey: string;
  details: PostDetailedStats;
  evergreenRatio: number;
}

export type WorkerCommand =
  | {
      id: string;
      type: 'init';
      apiCreds: ApiCredentials;
      network: NetworkConfig;
      sessionString?: string;
    }
  | { id: string; type: 'start_qr' }
  | { id: string; type: 'abort_qr' }
  | { id: string; type: 'send_code'; phone: string }
  | { id: string; type: 'sign_in'; phone: string; phoneCodeHash: string; code: string }
  | { id: string; type: 'check_password'; password: string }
  | { id: string; type: 'export_session' }
  | { id: string; type: 'logout' }
  | { id: string; type: 'get_channels' }
  | { id: string; type: 'fetch_channel_analytics'; channelId: number; maxMessages?: number }
  | {
      id: string;
      type: 'fetch_post_details';
      channelId: number;
      postId: number;
      postKey?: string;
      statsDc?: number;
    }
  | {
      id: string;
      type: 'scan_date_attribution';
      channelId: number;
      posts: AttributionScanCandidate[];
      statsDc?: number;
      maxPosts?: number;
    }
  | { id: string; type: 'abort_attribution' };

export type WorkerEvent =
  | { type: 'rpc_ok'; id: string; payload: unknown }
  | { type: 'rpc_err'; id: string; error: string }
  | { type: 'qr_updated'; url: string; expiresAt: number }
  | { type: 'qr_scanned' }
  | { type: 'qr_password_needed' }
  | { type: 'authorized'; user: TelegramUserSummary }
  | { type: 'scan_progress'; channelId: number; scannedCount: number }
  | { type: 'attribution_progress'; channelId: number; completed: number; total: number }
  | { type: 'live_forwards_update'; channelId: number; msgId: number; forwards: number };

const AVATAR_PALETTE = ['#3390ec', '#4dcd5e', '#f5a623', '#9b6dff', '#e55353', '#27a6d1'];

function pickAvatarColor(id: number): string {
  return AVATAR_PALETTE[Math.abs(id) % AVATAR_PALETTE.length];
}

function postWorkerEvent(event: WorkerEvent) {
  self.postMessage(event);
}

/**
 * Creates a WebSocket constructor compatible with `@mtcute/web`'s WebSocketTransport({ ws })
 * supporting:
 * 1) Direct WSS to Telegram (`*.web.telegram.org`)
 * 2) Local SOCKS5 Bridge (`ws://127.0.0.1:8787`) with JSON handshake before emitting `open`
 * 3) Personal Cloudflare Worker Relay (`wss://...workers.dev?target=...`)
 */
function createTransportWebSocket(network: NetworkConfig): WebSocketConstructor {
  if (network.mode === 'direct') {
    return WebSocket as unknown as WebSocketConstructor;
  }

  if (network.mode === 'cf-relay') {
    const relayBase = network.cfRelayUrl.trim().replace(/\/+$/, '');
    class RelayWebSocket extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const target = typeof url === 'string' ? url : url.toString();
        const sep = relayBase.includes('?') ? '&' : '?';
        const wrappedUrl = `${relayBase}${sep}target=${encodeURIComponent(target)}`;
        super(wrappedUrl, protocols);
      }
    }
    return RelayWebSocket as unknown as WebSocketConstructor;
  }

  // SOCKS5 via Local Bridge
  const bridgeUrl = network.socks5.bridgeUrl.trim() || 'ws://127.0.0.1:8787';
  const socksCfg = {
    host: network.socks5.host.trim(),
    port: Number(network.socks5.port) || 1080,
    username: network.socks5.username.trim() || undefined,
    password: network.socks5.password || undefined,
  };

  class SocksBridgeWebSocket extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;

    readonly url: string;
    readonly extensions = '';
    readonly protocol = 'binary';

    private _ws: WebSocket;
    private _readyState: number = 0;
    private _handshakeDone = false;
    private _pendingQueue: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];

    onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
    onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
    onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;
    onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;

    constructor(url: string | URL, protocols?: string | string[]) {
      super();
      const targetUrl = typeof url === 'string' ? url : url.toString();
      this.url = targetUrl;

      this._ws = new WebSocket(bridgeUrl, protocols);
      this._ws.binaryType = 'arraybuffer';

      this._ws.addEventListener('open', () => {
        const handshake = JSON.stringify({
          type: 'connect',
          targetUrl,
          socks5: socksCfg,
        });
        this._ws.send(handshake);
      });

      this._ws.addEventListener('message', (ev) => {
        if (!this._handshakeDone) {
          if (typeof ev.data === 'string') {
            try {
              const ctrl = JSON.parse(ev.data) as { type: string; error?: string };
              if (ctrl.type === 'ready') {
                this._handshakeDone = true;
                this._readyState = 1;
                while (this._pendingQueue.length > 0) {
                  const frame = this._pendingQueue.shift();
                  if (frame !== undefined) {
                    this._ws.send(frame as string | ArrayBuffer | Blob | ArrayBufferView<ArrayBuffer>);
                  }
                }
                const openEv = new Event('open');
                this.dispatchEvent(openEv);
                this.onopen?.call(this as unknown as WebSocket, openEv);
                return;
              }
              if (ctrl.type === 'error') {
                const errEv = new Event('error');
                this.dispatchEvent(errEv);
                this.onerror?.call(this as unknown as WebSocket, errEv);
                this._ws.close(1011, ctrl.error || 'SOCKS5 bridge error');
                return;
              }
            } catch {
              // ignore non-JSON control message before ready
            }
          }
          return;
        }

        const msgEv = new MessageEvent('message', { data: ev.data });
        this.dispatchEvent(msgEv);
        this.onmessage?.call(this as unknown as WebSocket, msgEv);
      });

      this._ws.addEventListener('error', () => {
        const errEv = new Event('error');
        this.dispatchEvent(errEv);
        this.onerror?.call(this as unknown as WebSocket, errEv);
      });

      this._ws.addEventListener('close', (ev) => {
        this._readyState = 3;
        const closeEv = new CloseEvent('close', {
          code: ev.code,
          reason: ev.reason,
          wasClean: ev.wasClean,
        });
        this.dispatchEvent(closeEv);
        this.onclose?.call(this as unknown as WebSocket, closeEv);
      });
    }

    get readyState(): number {
      return this._readyState;
    }

    get bufferedAmount(): number {
      return this._ws.bufferedAmount;
    }

    get binaryType(): BinaryType {
      return this._ws.binaryType;
    }

    set binaryType(val: BinaryType) {
      this._ws.binaryType = val;
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
      if (!this._handshakeDone) {
        this._pendingQueue.push(data);
        return;
      }
      this._ws.send(data as string | ArrayBuffer | Blob | ArrayBufferView<ArrayBuffer>);
    }

    close(code?: number, reason?: string): void {
      this._readyState = 2;
      this._ws.close(code, reason);
    }
  }

  return SocksBridgeWebSocket as unknown as WebSocketConstructor;
}

let tgClient: TelegramClient | null = null;
let qrAbortController: AbortController | null = null;
let pendingQrPasswordResolve: ((pwd: string) => void) | null = null;
let attributionAborted = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSinglePostStats(
  client: TelegramClient,
  tlInputChannel: tl.RawInputChannel,
  postId: number,
  postKey: string,
  statsDc?: number,
): Promise<PostDetailedStats> {
  let viewsGraph: ParsedStatsGraph | undefined;
  let reactionsGraph: ParsedStatsGraph | undefined;

  try {
    const msgStats = await client.call(
      {
        _: 'stats.getMessageStats',
        dark: true,
        channel: tlInputChannel,
        msgId: postId,
      },
      statsDc ? { dcId: statsDc } : undefined,
    );
    viewsGraph = await resolveStatsGraph(
      client,
      `post-${postId}-views`,
      'Interactions',
      msgStats.viewsGraph,
      statsDc,
    );
    reactionsGraph = await resolveStatsGraph(
      client,
      `post-${postId}-reactions`,
      'Reactions',
      msgStats.reactionsByEmotionGraph,
      statsDc,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('FLOOD_WAIT')) {
      throw err;
    }
    // Post may not have detailed message graph (e.g. small channel)
  }

  const dailyBreakdown = extractDailyActivityFromGraph(viewsGraph);

  const publicForwards: PublicForwardRecord[] = [];
  let publicSharesTotal = 0;
  try {
    const pub = await client.call(
      {
        _: 'stats.getMessagePublicForwards',
        channel: tlInputChannel,
        msgId: postId,
        offset: '',
        limit: 50,
      },
      statsDc ? { dcId: statsDc } : undefined,
    );

    publicSharesTotal = typeof pub.count === 'number' ? pub.count : 0;

    const chatIndex = new Map<number, { title: string; username?: string }>();
    for (const c of pub.chats) {
      if ('title' in c) {
        chatIndex.set(c.id, {
          title: c.title,
          username: 'username' in c ? c.username : undefined,
        });
      }
    }

    for (const f of pub.forwards) {
      if (f._ === 'publicForwardMessage' && f.message._ === 'message') {
        const m = f.message;
        const peerId =
          m.peerId._ === 'peerChannel'
            ? m.peerId.channelId
            : m.peerId._ === 'peerChat'
              ? m.peerId.chatId
              : 0;
        const info = chatIndex.get(peerId);
        publicForwards.push({
          channelId: peerId,
          channelTitle: info?.title ?? `Channel #${peerId}`,
          channelUsername: info?.username,
          messageId: m.id,
          date: m.date * 1000,
          views: m.views ?? 0,
        });
      }
    }
    if (publicSharesTotal === 0 && publicForwards.length > 0) {
      publicSharesTotal = publicForwards.length;
    }
  } catch {
    // Ignore if public forwards unavailable
  }

  return {
    postKey,
    primaryId: postId,
    viewsGraph,
    reactionsGraph,
    dailyBreakdown,
    publicForwards,
    publicSharesTotal,
    loadedAt: Date.now(),
  };
}

function mapMediaKind(msg: { media: { type: string } | null }): Exclude<MediaKind, 'album'> {
  if (!msg.media) return 'text';
  switch (msg.media.type) {
    case 'photo':
      return 'photo';
    case 'video':
      return 'video';
    case 'audio':
    case 'voice':
      return 'audio';
    case 'poll':
      return 'poll';
    default:
      return 'document';
  }
}

function mapReactions(msg: {
  reactions: { reactions: ReadonlyArray<{ emoji: unknown; count: number }> } | null;
}): ReactionCount[] {
  if (!msg.reactions) return [];
  return msg.reactions.reactions.map((r) => ({
    emoji: typeof r.emoji === 'string' ? r.emoji : '✨',
    count: r.count,
  }));
}

async function resolveStatsGraph(
  client: TelegramClient,
  id: string,
  title: string,
  graph: tl.TypeStatsGraph | undefined,
  dcId?: number,
): Promise<ParsedStatsGraph | undefined> {
  if (!graph) return undefined;
  try {
    if (graph._ === 'statsGraph') {
      return parseTelegramStatsGraph(id, title, graph.json.data);
    }
    if (graph._ === 'statsGraphAsync') {
      const loaded = await client.call(
        { _: 'stats.loadAsyncGraph', token: graph.token },
        dcId ? { dcId } : undefined,
      );
      if (loaded._ === 'statsGraph') {
        return parseTelegramStatsGraph(id, title, loaded.json.data);
      }
      if (loaded._ === 'statsGraphError') {
        return { id, title, type: 'line', timestamps: [], series: [], error: loaded.error };
      }
    }
    if (graph._ === 'statsGraphError') {
      return { id, title, type: 'line', timestamps: [], series: [], error: graph.error };
    }
  } catch (err) {
    return {
      id,
      title,
      type: 'line',
      timestamps: [],
      series: [],
      error: err instanceof Error ? err.message : 'Failed to load graph',
    };
  }
  return undefined;
}

async function ensureClientInitialized(
  apiCreds: ApiCredentials,
  network: NetworkConfig,
  sessionString?: string,
): Promise<{ authorized: boolean; user?: TelegramUserSummary; reason?: string }> {
  if (tgClient) {
    try {
      await tgClient.disconnect();
    } catch {
      // ignore disconnect errors
    }
    tgClient = null;
  }

  const wsCtor = createTransportWebSocket(network);
  const transport = new WebSocketTransport({ ws: wsCtor });

  tgClient = new TelegramClient({
    apiId: apiCreds.apiId,
    apiHash: apiCreds.apiHash,
    storage: new MemoryStorage(),
    transport,
  });

  tgClient.onRawUpdate.add(({ update }) => {
    if (update._ === 'updateChannelMessageForwards') {
      postWorkerEvent({
        type: 'live_forwards_update',
        channelId: update.channelId,
        msgId: update.id,
        forwards: update.forwards,
      });
    }
  });

  if (sessionString) {
    await tgClient.importSession(sessionString, true);
    await tgClient.connect();
    try {
      const me = await tgClient.getMe();
      await tgClient.notifyLoggedIn(me.raw);
      return {
        authorized: true,
        user: {
          id: me.id,
          firstName: me.firstName,
          lastName: me.lastName ?? undefined,
          username: me.username ?? undefined,
          phone: me.phoneNumber ?? undefined,
        },
      };
    } catch (err) {
      if (
        tl.RpcError.is(err, 'AUTH_KEY_UNREGISTERED') ||
        tl.RpcError.is(err, 'SESSION_REVOKED') ||
        tl.RpcError.is(err, 'USER_DEACTIVATED') ||
        tl.RpcError.is(err, 'USER_DEACTIVATED_BAN')
      ) {
        return { authorized: false, reason: err.text };
      }
      throw err;
    }
  }

  await tgClient.connect();
  return { authorized: false };
}

async function handleCommand(cmd: WorkerCommand): Promise<unknown> {
  switch (cmd.type) {
    case 'init': {
      return ensureClientInitialized(cmd.apiCreds, cmd.network, cmd.sessionString);
    }

    case 'abort_qr': {
      qrAbortController?.abort();
      qrAbortController = null;
      pendingQrPasswordResolve = null;
      return { aborted: true };
    }

    case 'start_qr': {
      if (!tgClient) throw new Error('Client not initialized');
      qrAbortController?.abort();
      qrAbortController = new AbortController();
      const signal = qrAbortController.signal;

      const user = await tgClient.signInQr({
        abortSignal: signal,
        onUrlUpdated: (url, expires) => {
          postWorkerEvent({
            type: 'qr_updated',
            url,
            expiresAt: expires.getTime(),
          });
        },
        onQrScanned: () => {
          postWorkerEvent({ type: 'qr_scanned' });
        },
        password: async () => {
          postWorkerEvent({ type: 'qr_password_needed' });
          return new Promise<string>((resolve) => {
            pendingQrPasswordResolve = resolve;
          });
        },
      });

      const summary: TelegramUserSummary = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName ?? undefined,
        username: user.username ?? undefined,
        phone: user.phoneNumber ?? undefined,
      };
      postWorkerEvent({ type: 'authorized', user: summary });
      return summary;
    }

    case 'send_code': {
      if (!tgClient) throw new Error('Client not initialized');
      const sent = await tgClient.sendCode({ phone: cmd.phone });
      if ('id' in sent) {
        const summary: TelegramUserSummary = {
          id: sent.id,
          firstName: sent.firstName,
          lastName: sent.lastName ?? undefined,
          username: sent.username ?? undefined,
          phone: sent.phoneNumber ?? undefined,
        };
        postWorkerEvent({ type: 'authorized', user: summary });
        return { alreadyAuthorized: true, user: summary };
      }
      return {
        alreadyAuthorized: false,
        phoneCodeHash: sent.phoneCodeHash,
        timeout: sent.timeout,
      };
    }

    case 'sign_in': {
      if (!tgClient) throw new Error('Client not initialized');
      try {
        const user = await tgClient.signIn({
          phone: cmd.phone,
          phoneCodeHash: cmd.phoneCodeHash,
          phoneCode: cmd.code,
        });
        const summary: TelegramUserSummary = {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName ?? undefined,
          username: user.username ?? undefined,
          phone: user.phoneNumber ?? undefined,
        };
        postWorkerEvent({ type: 'authorized', user: summary });
        return { status: 'authorized', user: summary };
      } catch (err) {
        if (tl.RpcError.is(err, 'SESSION_PASSWORD_NEEDED')) {
          return { status: 'password_needed' };
        }
        throw err;
      }
    }

    case 'check_password': {
      if (!tgClient) throw new Error('Client not initialized');
      if (pendingQrPasswordResolve) {
        const resolve = pendingQrPasswordResolve;
        pendingQrPasswordResolve = null;
        resolve(cmd.password);
        return { status: 'submitted_to_qr' };
      }
      const user = await tgClient.checkPassword(cmd.password);
      const summary: TelegramUserSummary = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName ?? undefined,
        username: user.username ?? undefined,
        phone: user.phoneNumber ?? undefined,
      };
      postWorkerEvent({ type: 'authorized', user: summary });
      return { status: 'authorized', user: summary };
    }

    case 'export_session': {
      if (!tgClient) throw new Error('Client not initialized');
      return { sessionString: await tgClient.exportSession() };
    }

    case 'logout': {
      if (tgClient) {
        try {
          await tgClient.logOut();
        } catch {
          try {
            await tgClient.disconnect();
          } catch {
            // ignore
          }
        }
        tgClient = null;
      }
      return { loggedOut: true };
    }

    case 'get_channels': {
      if (!tgClient) throw new Error('Client not initialized');
      const channels: ChannelSummary[] = [];
      for await (const dialog of tgClient.iterDialogs({ limit: 100 })) {
        const peer = dialog.peer;
        if (peer.type === 'chat' && peer.chatType === 'channel' && (peer.isCreator || peer.isAdmin)) {
          channels.push({
            id: peer.id,
            title: peer.title,
            username: peer.username ?? undefined,
            membersCount: peer.membersCount ?? 0,
            isCreator: peer.isCreator,
            isAdmin: peer.isAdmin,
            canViewStats: true,
            avatarColor: pickAvatarColor(peer.id),
          });
        }
      }
      return channels;
    }

    case 'fetch_channel_analytics': {
      if (!tgClient) throw new Error('Client not initialized');
      const fullChat = await tgClient.getFullChat(cmd.channelId);
      const chat = await tgClient.getChat(cmd.channelId);
      const rawFull = fullChat.full;
      const statsDc = rawFull._ === 'channelFull' ? rawFull.statsDc : undefined;
      const canViewStats = fullChat.canViewStats;

      let overview: BroadcastOverviewStats = {
        periodFrom: Date.now() - 7 * 86400_000,
        periodTo: Date.now(),
        followers: { current: fullChat.membersCount ?? 0, previous: fullChat.membersCount ?? 0 },
        viewsPerPost: { current: 0, previous: 0 },
        sharesPerPost: { current: 0, previous: 0 },
        reactionsPerPost: { current: 0, previous: 0 },
        enabledNotificationsPercent: 0,
        recentPostIds: [],
      };

      const inputChannel = chat.inputPeer;
      if (canViewStats && inputChannel._ === 'inputPeerChannel') {
        try {
          const tlInputChannel: tl.RawInputChannel = {
            _: 'inputChannel',
            channelId: inputChannel.channelId,
            accessHash: inputChannel.accessHash,
          };

          const bStats = await tgClient.call(
            {
              _: 'stats.getBroadcastStats',
              dark: true,
              channel: tlInputChannel,
            },
            statsDc ? { dcId: statsDc } : undefined,
          );

          const recentPostIds: number[] = [];
          for (const item of bStats.recentPostsInteractions) {
            if (item._ === 'postInteractionCountersMessage') {
              recentPostIds.push(item.msgId);
            }
          }

          const [
            interactionsGraph,
            growthGraph,
            followersGraph,
            topHoursGraph,
            viewsBySourceGraph,
            languagesGraph,
          ] = await Promise.all([
            resolveStatsGraph(tgClient, 'interactions', 'Interactions', bStats.interactionsGraph, statsDc),
            resolveStatsGraph(tgClient, 'growth', 'Growth', bStats.growthGraph, statsDc),
            resolveStatsGraph(tgClient, 'followers', 'Followers', bStats.followersGraph, statsDc),
            resolveStatsGraph(tgClient, 'topHours', 'Top Hours', bStats.topHoursGraph, statsDc),
            resolveStatsGraph(tgClient, 'viewsBySource', 'Views by Source', bStats.viewsBySourceGraph, statsDc),
            resolveStatsGraph(tgClient, 'languages', 'Languages', bStats.languagesGraph, statsDc),
          ]);

          const notif = bStats.enabledNotifications;
          const notifPct =
            notif.total > 0 ? Number(((notif.part / notif.total) * 100).toFixed(1)) : 0;

          overview = {
            periodFrom: bStats.period.minDate * 1000,
            periodTo: bStats.period.maxDate * 1000,
            followers: { current: bStats.followers.current, previous: bStats.followers.previous },
            viewsPerPost: { current: bStats.viewsPerPost.current, previous: bStats.viewsPerPost.previous },
            sharesPerPost: { current: bStats.sharesPerPost.current, previous: bStats.sharesPerPost.previous },
            reactionsPerPost: {
              current: bStats.reactionsPerPost.current,
              previous: bStats.reactionsPerPost.previous,
            },
            enabledNotificationsPercent: notifPct,
            recentPostIds,
            interactionsGraph,
            growthGraph,
            followersGraph,
            topHoursGraph,
            viewsBySourceGraph,
            languagesGraph,
          };
        } catch {
          // Channel may have <50 subscribers or stats disabled; fallback to history-derived overview
        }
      }

      const rawMessages: RawChannelMessage[] = [];
      const limit = cmd.maxMessages ?? 400;
      let count = 0;

      for await (const msg of tgClient.iterHistory(cmd.channelId, { limit })) {
        if (msg.isService) continue;
        count += 1;
        let permalink: string | undefined;
        try {
          permalink = msg.link;
        } catch {
          permalink = undefined;
        }

        rawMessages.push({
          id: msg.id,
          date: msg.date.getTime(),
          text: msg.text,
          views: msg.views ?? 0,
          forwards: msg.forwards ?? 0,
          replies: msg.replies?.count ?? 0,
          groupedId: msg.groupedId ? msg.groupedId.toString() : null,
          mediaKind: mapMediaKind(msg),
          reactions: mapReactions(msg),
          permalink,
        });

        if (count % 50 === 0) {
          postWorkerEvent({ type: 'scan_progress', channelId: cmd.channelId, scannedCount: count });
        }
      }

      const channelSummary: ChannelSummary = {
        id: chat.id,
        title: chat.title,
        username: chat.username ?? undefined,
        membersCount: fullChat.membersCount ?? chat.membersCount ?? 0,
        isCreator: chat.isCreator,
        isAdmin: chat.isAdmin,
        canViewStats,
        statsDc,
        lastSyncedAt: Date.now(),
        avatarColor: pickAvatarColor(chat.id),
      };

      return {
        channel: channelSummary,
        overview,
        rawMessages,
      };
    }

    case 'fetch_post_details': {
      if (!tgClient) throw new Error('Client not initialized');
      const chat = await tgClient.getChat(cmd.channelId);
      const inputPeer = chat.inputPeer;
      if (inputPeer._ !== 'inputPeerChannel') {
        throw new Error('Selected peer is not a broadcast channel');
      }

      const tlInputChannel: tl.RawInputChannel = {
        _: 'inputChannel',
        channelId: inputPeer.channelId,
        accessHash: inputPeer.accessHash,
      };

      return fetchSinglePostStats(
        tgClient,
        tlInputChannel,
        cmd.postId,
        cmd.postKey ?? `msg:${cmd.postId}`,
        cmd.statsDc,
      );
    }

    case 'abort_attribution': {
      attributionAborted = true;
      return { aborted: true };
    }

    case 'scan_date_attribution': {
      if (!tgClient) throw new Error('Client not initialized');
      attributionAborted = false;
      const chat = await tgClient.getChat(cmd.channelId);
      const inputPeer = chat.inputPeer;
      if (inputPeer._ !== 'inputPeerChannel') {
        throw new Error('Selected peer is not a broadcast channel');
      }

      const tlInputChannel: tl.RawInputChannel = {
        _: 'inputChannel',
        channelId: inputPeer.channelId,
        accessHash: inputPeer.accessHash,
      };

      const maxPosts = Math.min(60, cmd.maxPosts ?? 40);
      const candidates = [...cmd.posts]
        .filter((p) => p.forwards > 0 || p.views > 0)
        .sort((a, b) => b.forwards - a.forwards || b.date - a.date)
        .slice(0, maxPosts);

      const results: AttributionScanItemResult[] = [];
      for (let i = 0; i < candidates.length; i += 1) {
        if (attributionAborted) break;
        const candidate = candidates[i];
        try {
          const details = await fetchSinglePostStats(
            tgClient,
            tlInputChannel,
            candidate.primaryId,
            candidate.key,
            cmd.statsDc,
          );
          const evergreenRatio = computeEvergreenRatio(candidate.date, details.dailyBreakdown);
          results.push({ postKey: candidate.key, details, evergreenRatio });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const match = msg.match(/FLOOD_WAIT_(\d+)/);
          if (match) {
            const waitSec = Number(match[1]);
            if (waitSec <= 5) {
              await sleep(waitSec * 1000 + 250);
              i -= 1;
              continue;
            }
            break;
          }
        }

        postWorkerEvent({
          type: 'attribution_progress',
          channelId: cmd.channelId,
          completed: i + 1,
          total: candidates.length,
        });

        if (i < candidates.length - 1) {
          await sleep(140);
        }
      }

      return results;
    }

    default:
      throw new Error('Unknown worker command');
  }
}

self.onmessage = async (event: MessageEvent<WorkerCommand>) => {
  const cmd = event.data;
  try {
    const payload = await handleCommand(cmd);
    postWorkerEvent({ type: 'rpc_ok', id: cmd.id, payload });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    postWorkerEvent({ type: 'rpc_err', id: cmd.id, error: msg });
  }
};
