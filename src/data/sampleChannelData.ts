import type {
  ChannelAnalyticsBundle,
  ChannelSummary,
  MessageDailyActivity,
  PostDetailedStats,
  PostRecord,
  PublicForwardRecord,
  RawChannelMessage,
} from '../types/analytics';
import {
  computeEvergreenRatio,
  computeFormatInsights,
  computeSnapshotDeltas,
  extractDailyActivityFromGraph,
  formatDateKey,
  groupAlbumPosts,
  parseTelegramStatsGraph,
} from '../utils/analyticsMath';

// Clean, general-purpose public demo window (10-day observation span)
const DATES_10D = Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 9, 15 + i));
const HOURS_24 = Array.from({ length: 24 }, (_, h) => Date.UTC(2026, 9, 24, h, 0));

const SAMPLE_CHANNELS: ChannelSummary[] = [
  {
    id: 1004821930,
    title: 'Vektor Tech Digest',
    username: 'vektortech',
    membersCount: 1840,
    isCreator: true,
    isAdmin: true,
    canViewStats: true,
    statsDc: 4,
    lastSyncedAt: Date.UTC(2026, 9, 24, 18, 0),
    avatarColor: '#2aabee',
  },
  {
    id: 1007392014,
    title: 'استودیو سیگنال · Studio Signal',
    username: 'studiosignal',
    membersCount: 620,
    isCreator: false,
    isAdmin: true,
    canViewStats: true,
    statsDc: 2,
    lastSyncedAt: Date.UTC(2026, 9, 24, 16, 45),
    avatarColor: '#45d168',
  },
];

function buildGraphJson(
  dates: number[],
  series: Array<{
    key: string;
    name: string;
    color: string;
    type: 'line' | 'bar' | 'area';
    values: number[];
  }>,
): string {
  const columns: Array<[string, ...number[]]> = [['x', ...dates]];
  const types: Record<string, string> = { x: 'x' };
  const names: Record<string, string> = {};
  const colors: Record<string, string> = {};

  for (const s of series) {
    columns.push([s.key, ...s.values]);
    types[s.key] = s.type;
    names[s.key] = s.name;
    colors[s.key] = `LIGHT${s.color}`;
  }

  return JSON.stringify({ columns, types, names, colors });
}

interface DailySeed {
  postKey: string;
  primaryId: number;
  dailyViews: number[]; // length 10 matching DATES_10D
  dailyShares: number[]; // length 10 matching DATES_10D
  publicForwards?: PublicForwardRecord[];
}

function buildPostStatsMap(
  posts: PostRecord[],
  seeds: DailySeed[],
  loadedAt: number,
): {
  postStatsByPost: Record<string, PostDetailedStats>;
  publicForwardsByPost: Record<string, PublicForwardRecord[]>;
  enrichedPosts: PostRecord[];
  channelDailyViews: number[];
  channelDailyShares: number[];
} {
  const postStatsByPost: Record<string, PostDetailedStats> = {};
  const publicForwardsByPost: Record<string, PublicForwardRecord[]> = {};
  const channelDailyViews = new Array<number>(DATES_10D.length).fill(0);
  const channelDailyShares = new Array<number>(DATES_10D.length).fill(0);

  const seedByKey = new Map(seeds.map((s) => [s.postKey, s]));

  const enrichedPosts = posts.map((post) => {
    const seed = seedByKey.get(post.key);
    if (!seed) return post;

    for (let i = 0; i < DATES_10D.length; i += 1) {
      channelDailyViews[i] += seed.dailyViews[i] ?? 0;
      channelDailyShares[i] += seed.dailyShares[i] ?? 0;
    }

    const viewsGraph = parseTelegramStatsGraph(
      `post-${post.primaryId}-views`,
      'Interactions',
      buildGraphJson(DATES_10D, [
        { key: 'y0', name: 'Views', color: '#45d168', type: 'line', values: seed.dailyViews },
        { key: 'y1', name: 'Shares', color: '#f5a623', type: 'line', values: seed.dailyShares },
      ]),
    );

    const dailyBreakdown: MessageDailyActivity[] = extractDailyActivityFromGraph(viewsGraph);
    const pubList = seed.publicForwards ?? [];
    if (pubList.length > 0) {
      publicForwardsByPost[post.key] = pubList;
    }

    const evergreenShareRatio = computeEvergreenRatio(post.date, dailyBreakdown);
    const publicSharesCount = Math.min(post.forwards, pubList.length);
    const privateSharesCount = Math.max(0, post.forwards - publicSharesCount);

    postStatsByPost[post.key] = {
      postKey: post.key,
      primaryId: post.primaryId,
      viewsGraph,
      dailyBreakdown,
      publicForwards: pubList,
      publicSharesTotal: publicSharesCount,
      loadedAt,
    };

    return {
      ...post,
      publicSharesCount,
      privateSharesCount,
      evergreenShareRatio,
    };
  });

  return {
    postStatsByPost,
    publicForwardsByPost,
    enrichedPosts,
    channelDailyViews,
    channelDailyShares,
  };
}

const CHANNEL_1_MESSAGES: RawChannelMessage[] = [
  {
    id: 540,
    date: Date.UTC(2026, 9, 24, 15, 10),
    text: 'Benchmarking WebAssembly MTProto encryption inside a dedicated Worker thread vs main-thread execution.',
    views: 1420,
    forwards: 18,
    replies: 14,
    groupedId: null,
    mediaKind: 'text',
    reactions: [
      { emoji: '🔥', count: 42 },
      { emoji: '👍', count: 29 },
    ],
    permalink: 'https://t.me/vektortech/540',
  },
  {
    id: 538,
    date: Date.UTC(2026, 9, 23, 18, 25),
    text: 'Minimalist glassmorphism in desktop clients: balancing backdrop blur cost with 120Hz scroll budgets.',
    views: 1180,
    forwards: 11,
    replies: 8,
    groupedId: null,
    mediaKind: 'photo',
    reactions: [
      { emoji: '❤️', count: 38 },
      { emoji: '🔥', count: 21 },
    ],
    permalink: 'https://t.me/vektortech/538',
  },
  {
    id: 535,
    date: Date.UTC(2026, 9, 21, 13, 40),
    text: 'Weekly release digest: faster reconnection backoff and lower battery drain on mobile webviews.',
    views: 960,
    forwards: 3,
    replies: 5,
    groupedId: null,
    mediaKind: 'text',
    reactions: [{ emoji: '👍', count: 24 }],
    permalink: 'https://t.me/vektortech/535',
  },
  {
    id: 532,
    date: Date.UTC(2026, 9, 20, 17, 5),
    text: 'Quick poll: which transport mode do you rely on most for channel administration?',
    views: 1090,
    forwards: 0,
    replies: 19,
    groupedId: null,
    mediaKind: 'poll',
    reactions: [{ emoji: '🤔', count: 16 }],
    permalink: 'https://t.me/vektortech/532',
  },
  {
    id: 529,
    date: Date.UTC(2026, 9, 18, 11, 20),
    text: 'How per-message interaction graphs track private forwards and Saved Messages activity.',
    views: 1310,
    forwards: 16,
    replies: 12,
    groupedId: null,
    mediaKind: 'photo',
    reactions: [
      { emoji: '🔥', count: 36 },
      { emoji: '👏', count: 14 },
    ],
    permalink: 'https://t.me/vektortech/529',
  },
  // Older evergreen posts (outside 7-day Recent Posts window!)
  {
    id: 514,
    date: Date.UTC(2026, 9, 11, 16, 45),
    text: 'Complete Checklist: Zero-Backend Threat Model & WebCrypto AES-256-GCM Session Vaults (PDF Guide).',
    views: 3420,
    forwards: 84,
    replies: 31,
    groupedId: null,
    mediaKind: 'document',
    reactions: [
      { emoji: '🔥', count: 112 },
      { emoji: '❤️', count: 64 },
      { emoji: '👍', count: 48 },
    ],
    permalink: 'https://t.me/vektortech/514',
  },
  {
    id: 498,
    date: Date.UTC(2026, 9, 3, 19, 15),
    text: 'Systems Architecture Pack: Local SOCKS5 Bridge + Cloudflare Relay Diagrams (3-part album).',
    views: 2890,
    forwards: 58,
    replies: 22,
    groupedId: '771029384',
    mediaKind: 'photo',
    reactions: [
      { emoji: '❤️', count: 78 },
      { emoji: '🔥', count: 59 },
    ],
    permalink: 'https://t.me/vektortech/498',
  },
  {
    id: 499,
    date: Date.UTC(2026, 9, 3, 19, 15),
    text: '',
    views: 2840,
    forwards: 39,
    replies: 0,
    groupedId: '771029384',
    mediaKind: 'document',
    reactions: [],
    permalink: 'https://t.me/vektortech/499',
  },
  {
    id: 500,
    date: Date.UTC(2026, 9, 3, 19, 15),
    text: '',
    views: 2810,
    forwards: 27,
    replies: 0,
    groupedId: '771029384',
    mediaKind: 'photo',
    reactions: [],
    permalink: 'https://t.me/vektortech/500',
  },
  {
    id: 480,
    date: Date.UTC(2026, 8, 26, 14, 0),
    text: 'Screen recording: Sub-millisecond SVG timeline scrubbing with zero layout thrashing.',
    views: 2150,
    forwards: 34,
    replies: 15,
    groupedId: null,
    mediaKind: 'video',
    reactions: [
      { emoji: '🔥', count: 52 },
      { emoji: '👏', count: 19 },
    ],
    permalink: 'https://t.me/vektortech/480',
  },
];

const CHANNEL_1_SEEDS: DailySeed[] = [
  {
    postKey: 'msg:540',
    primaryId: 540,
    dailyViews: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1420],
    dailyShares: [0, 0, 0, 0, 0, 0, 0, 0, 0, 18],
    publicForwards: [
      {
        channelId: 1009021,
        channelTitle: 'Frontend Systems Weekly',
        channelUsername: 'fesystems',
        messageId: 2140,
        date: Date.UTC(2026, 9, 24, 19, 20),
        views: 6820,
      },
      {
        channelId: 1009044,
        channelTitle: 'WebAssembly Digest',
        channelUsername: 'wasmdigest',
        messageId: 891,
        date: Date.UTC(2026, 9, 24, 21, 5),
        views: 4190,
      },
    ],
  },
  {
    postKey: 'msg:538',
    primaryId: 538,
    dailyViews: [0, 0, 0, 0, 0, 0, 0, 0, 910, 270],
    dailyShares: [0, 0, 0, 0, 0, 0, 0, 0, 9, 2],
    publicForwards: [
      {
        channelId: 1009110,
        channelTitle: 'UI Craft & Motion',
        channelUsername: 'uicraft',
        messageId: 1403,
        date: Date.UTC(2026, 9, 23, 20, 40),
        views: 3400,
      },
    ],
  },
  {
    postKey: 'msg:535',
    primaryId: 535,
    dailyViews: [0, 0, 0, 0, 0, 0, 740, 150, 45, 25],
    dailyShares: [0, 0, 0, 0, 0, 0, 2, 1, 0, 0],
  },
  {
    postKey: 'msg:532',
    primaryId: 532,
    dailyViews: [0, 0, 0, 0, 0, 820, 180, 60, 20, 10],
    dailyShares: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    postKey: 'msg:529',
    primaryId: 529,
    dailyViews: [0, 0, 0, 890, 240, 80, 45, 25, 18, 12],
    dailyShares: [0, 0, 0, 11, 3, 1, 1, 0, 0, 0],
  },
  {
    postKey: 'msg:514',
    primaryId: 514,
    // Evergreen PDF guide: shared heavily on Oct 20 (day idx 5) and Oct 22 (day idx 7)!
    dailyViews: [64, 52, 48, 58, 70, 310, 95, 240, 88, 72],
    dailyShares: [2, 1, 1, 2, 3, 14, 3, 10, 2, 2],
    publicForwards: [
      {
        channelId: 1009288,
        channelTitle: 'Applied Cryptography Notes',
        channelUsername: 'cryptonotes',
        messageId: 612,
        date: Date.UTC(2026, 9, 20, 14, 15),
        views: 9240,
      },
      {
        channelId: 1009312,
        channelTitle: 'Open Source Security',
        channelUsername: 'oss_sec',
        messageId: 3340,
        date: Date.UTC(2026, 9, 22, 11, 30),
        views: 5180,
      },
    ],
  },
  {
    postKey: 'album:771029384',
    primaryId: 498,
    // Older album receiving steady organic forwards on Oct 20 & Oct 22
    dailyViews: [45, 38, 42, 40, 36, 185, 62, 145, 50, 44],
    dailyShares: [1, 1, 1, 0, 1, 7, 2, 6, 1, 1],
    publicForwards: [
      {
        channelId: 1009401,
        channelTitle: 'Self-Hosted Network Lab',
        channelUsername: 'netlab_selfhost',
        messageId: 1775,
        date: Date.UTC(2026, 9, 20, 18, 0),
        views: 4890,
      },
    ],
  },
  {
    postKey: 'msg:480',
    primaryId: 480,
    dailyViews: [28, 24, 19, 22, 18, 35, 21, 48, 25, 19],
    dailyShares: [0, 1, 0, 0, 0, 2, 0, 2, 1, 0],
  },
];

const CHANNEL_2_MESSAGES: RawChannelMessage[] = [
  {
    id: 218,
    date: Date.UTC(2026, 9, 24, 14, 30),
    text: 'طراحی سیستم رنگ لیکوید گلس و سلسله‌مراتب تایپوگرافی دوزبانه (فارسی/انگلیسی)',
    views: 510,
    forwards: 9,
    replies: 6,
    groupedId: null,
    mediaKind: 'photo',
    reactions: [
      { emoji: '❤️', count: 24 },
      { emoji: '🔥', count: 14 },
    ],
    permalink: 'https://t.me/studiosignal/218',
  },
  {
    id: 215,
    date: Date.UTC(2026, 9, 22, 18, 15),
    text: 'اتود صوتی مینیمال برای تیتراژ — نسخه مسترشده با فضای آنالوگ',
    views: 430,
    forwards: 4,
    replies: 3,
    groupedId: null,
    mediaKind: 'audio',
    reactions: [{ emoji: '🔥', count: 18 }],
    permalink: 'https://t.me/studiosignal/215',
  },
  {
    id: 211,
    date: Date.UTC(2026, 9, 20, 20, 0),
    text: 'نکات کلیدی میکس وکال در فضاهای آکوستیک خانگی بدون تجهیزات استودیویی گران‌قیمت',
    views: 390,
    forwards: 0,
    replies: 4,
    groupedId: null,
    mediaKind: 'text',
    reactions: [{ emoji: '👍', count: 15 }],
    permalink: 'https://t.me/studiosignal/211',
  },
  {
    id: 194,
    date: Date.UTC(2026, 9, 10, 17, 30),
    text: 'پکیج کامل پریست‌ها و فایل PDF راهنمای مسترینگ (آلبوم ۲ قسمتی)',
    views: 980,
    forwards: 26,
    replies: 11,
    groupedId: '662109445',
    mediaKind: 'photo',
    reactions: [
      { emoji: '🔥', count: 41 },
      { emoji: '❤️', count: 33 },
    ],
    permalink: 'https://t.me/studiosignal/194',
  },
  {
    id: 195,
    date: Date.UTC(2026, 9, 10, 17, 30),
    text: '',
    views: 955,
    forwards: 19,
    replies: 0,
    groupedId: '662109445',
    mediaKind: 'document',
    reactions: [],
    permalink: 'https://t.me/studiosignal/195',
  },
  {
    id: 182,
    date: Date.UTC(2026, 9, 2, 16, 10),
    text: 'ویدیوی پشت‌صحنه طراحی صدا و سینتی‌سایزر ماژولار',
    views: 840,
    forwards: 15,
    replies: 7,
    groupedId: null,
    mediaKind: 'video',
    reactions: [{ emoji: '👏', count: 29 }],
    permalink: 'https://t.me/studiosignal/182',
  },
];

const CHANNEL_2_SEEDS: DailySeed[] = [
  {
    postKey: 'msg:218',
    primaryId: 218,
    dailyViews: [0, 0, 0, 0, 0, 0, 0, 0, 0, 510],
    dailyShares: [0, 0, 0, 0, 0, 0, 0, 0, 0, 9],
    publicForwards: [
      {
        channelId: 1008812,
        channelTitle: 'گرافیک و دیزاین مدرن',
        channelUsername: 'moderndesign_fa',
        messageId: 4920,
        date: Date.UTC(2026, 9, 24, 18, 0),
        views: 2640,
      },
    ],
  },
  {
    postKey: 'msg:215',
    primaryId: 215,
    dailyViews: [0, 0, 0, 0, 0, 0, 0, 340, 60, 30],
    dailyShares: [0, 0, 0, 0, 0, 0, 0, 3, 1, 0],
  },
  {
    postKey: 'msg:211',
    primaryId: 211,
    dailyViews: [0, 0, 0, 0, 0, 310, 55, 15, 6, 4],
    dailyShares: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    postKey: 'album:662109445',
    primaryId: 194,
    // Older album driving shares on Oct 20 (idx 5) and Oct 22 (idx 7)
    dailyViews: [32, 28, 30, 26, 24, 140, 42, 95, 38, 31],
    dailyShares: [1, 0, 1, 0, 1, 6, 1, 4, 1, 1],
    publicForwards: [
      {
        channelId: 1008901,
        channelTitle: 'آکادمی صدابرداری و مسترینگ',
        channelUsername: 'audiomaster_fa',
        messageId: 1129,
        date: Date.UTC(2026, 9, 20, 21, 10),
        views: 3150,
      },
    ],
  },
  {
    postKey: 'msg:182',
    primaryId: 182,
    dailyViews: [18, 16, 14, 15, 12, 34, 19, 28, 15, 14],
    dailyShares: [0, 1, 0, 0, 0, 2, 0, 1, 0, 0],
  },
];

function createChannel1Bundle(): ChannelAnalyticsBundle {
  const recentIds = new Set([540, 538, 535, 532, 529]);
  const grouped = groupAlbumPosts(CHANNEL_1_MESSAGES, recentIds);

  const prevSnapshot = {
    channelId: SAMPLE_CHANNELS[0].id,
    capturedAt: Date.UTC(2026, 9, 23, 22, 0),
    membersCount: 1812,
    posts: {
      'msg:540': { views: 0, forwards: 0, reactions: 0, replies: 0 },
      'msg:538': { views: 910, forwards: 9, reactions: 50, replies: 6 },
      'msg:535': { views: 935, forwards: 3, reactions: 23, replies: 5 },
      'msg:532': { views: 1080, forwards: 0, reactions: 16, replies: 19 },
      'msg:529': { views: 1298, forwards: 16, reactions: 49, replies: 12 },
      'msg:514': { views: 3348, forwards: 82, reactions: 220, replies: 30 },
      'album:771029384': { views: 2846, forwards: 57, reactions: 135, replies: 22 },
      'msg:480': { views: 2131, forwards: 34, reactions: 70, replies: 15 },
    },
  };

  const withDeltas = computeSnapshotDeltas(grouped, prevSnapshot);
  const {
    postStatsByPost,
    publicForwardsByPost,
    enrichedPosts,
    channelDailyViews,
    channelDailyShares,
  } = buildPostStatsMap(withDeltas, CHANNEL_1_SEEDS, Date.UTC(2026, 9, 24, 18, 0));

  return {
    channel: SAMPLE_CHANNELS[0],
    overview: {
      periodFrom: DATES_10D[0],
      periodTo: DATES_10D[DATES_10D.length - 1],
      followers: { current: 1840, previous: 1715 },
      viewsPerPost: { current: 1380, previous: 1190 },
      sharesPerPost: { current: 24.5, previous: 18.2 },
      reactionsPerPost: { current: 54.0, previous: 42.5 },
      enabledNotificationsPercent: 58.4,
      recentPostIds: Array.from(recentIds),
      interactionsGraph: parseTelegramStatsGraph(
        'interactions-1',
        'Interactions',
        buildGraphJson(DATES_10D, [
          { key: 'y0', name: 'Views', color: '#45d168', type: 'line', values: channelDailyViews },
          { key: 'y1', name: 'Shares', color: '#f5a623', type: 'line', values: channelDailyShares },
        ]),
      ),
      growthGraph: parseTelegramStatsGraph(
        'growth-1',
        'Growth',
        buildGraphJson(DATES_10D, [
          {
            key: 'y0',
            name: 'Subscribers',
            color: '#2aabee',
            type: 'line',
            values: [1715, 1726, 1740, 1756, 1769, 1791, 1802, 1815, 1828, 1840],
          },
        ]),
      ),
      followersGraph: parseTelegramStatsGraph(
        'followers-1',
        'Followers',
        buildGraphJson(DATES_10D, [
          { key: 'y0', name: 'Joined', color: '#45d168', type: 'bar', values: [14, 15, 18, 21, 17, 29, 15, 19, 16, 18] },
          { key: 'y1', name: 'Left', color: '#ef5a5a', type: 'bar', values: [3, 4, 4, 5, 4, 7, 4, 6, 3, 6] },
        ]),
      ),
      topHoursGraph: parseTelegramStatsGraph(
        'topHours-1',
        'Top Hours',
        buildGraphJson(HOURS_24, [
          {
            key: 'y0',
            name: 'This week',
            color: '#2aabee',
            type: 'line',
            values: [95, 62, 41, 28, 24, 38, 84, 190, 320, 460, 510, 560, 590, 540, 620, 710, 790, 860, 820, 740, 610, 470, 290, 160],
          },
        ]),
      ),
      viewsBySourceGraph: parseTelegramStatsGraph(
        'viewsBySource-1',
        'Views by Source',
        buildGraphJson(DATES_10D, [
          { key: 'y0', name: 'Followers', color: '#2aabee', type: 'area', values: [90, 75, 68, 620, 210, 820, 650, 320, 680, 990] },
          { key: 'y1', name: 'Forwards & Channels', color: '#45d168', type: 'area', values: [27, 22, 21, 240, 86, 380, 260, 138, 290, 390] },
          { key: 'y2', name: 'Search & Links', color: '#f5a623', type: 'area', values: [20, 17, 20, 150, 68, 150, 173, 90, 151, 192] },
        ]),
      ),
      languagesGraph: parseTelegramStatsGraph(
        'languages-1',
        'Languages',
        buildGraphJson([DATES_10D[DATES_10D.length - 1]], [
          { key: 'y0', name: 'English (en)', color: '#2aabee', type: 'area', values: [72] },
          { key: 'y1', name: 'Persian (fa)', color: '#45d168', type: 'area', values: [21] },
          { key: 'y2', name: 'Other', color: '#f5a623', type: 'area', values: [7] },
        ]),
      ),
    },
    posts: enrichedPosts,
    dailyDeltas: [
      {
        dateKey: formatDateKey(DATES_10D[9]),
        postKey: 'msg:540',
        primaryId: 540,
        deltaShares: 18,
        deltaViews: 1420,
      },
      {
        dateKey: formatDateKey(DATES_10D[9]),
        postKey: 'msg:514',
        primaryId: 514,
        deltaShares: 2,
        deltaViews: 72,
      },
    ],
    publicForwardsByPost,
    postStatsByPost,
    lastSnapshotAt: prevSnapshot.capturedAt,
    scanStatus: {
      scannedCount: CHANNEL_1_MESSAGES.length,
      attributedPostsCount: Object.keys(postStatsByPost).length,
      isComplete: true,
    },
  };
}

function createChannel2Bundle(): ChannelAnalyticsBundle {
  const recentIds = new Set([218, 215, 211]);
  const grouped = groupAlbumPosts(CHANNEL_2_MESSAGES, recentIds);

  const prevSnapshot = {
    channelId: SAMPLE_CHANNELS[1].id,
    capturedAt: Date.UTC(2026, 9, 23, 21, 0),
    membersCount: 604,
    posts: {
      'msg:218': { views: 0, forwards: 0, reactions: 0, replies: 0 },
      'msg:215': { views: 400, forwards: 4, reactions: 18, replies: 3 },
      'msg:211': { views: 386, forwards: 0, reactions: 15, replies: 4 },
      'album:662109445': { views: 949, forwards: 25, reactions: 72, replies: 11 },
      'msg:182': { views: 826, forwards: 15, reactions: 29, replies: 7 },
    },
  };

  const withDeltas = computeSnapshotDeltas(grouped, prevSnapshot);
  const {
    postStatsByPost,
    publicForwardsByPost,
    enrichedPosts,
    channelDailyViews,
    channelDailyShares,
  } = buildPostStatsMap(withDeltas, CHANNEL_2_SEEDS, Date.UTC(2026, 9, 24, 16, 45));

  return {
    channel: SAMPLE_CHANNELS[1],
    overview: {
      periodFrom: DATES_10D[0],
      periodTo: DATES_10D[DATES_10D.length - 1],
      followers: { current: 620, previous: 576 },
      viewsPerPost: { current: 445, previous: 380 },
      sharesPerPost: { current: 6.2, previous: 4.4 },
      reactionsPerPost: { current: 21.5, previous: 16.0 },
      enabledNotificationsPercent: 67.5,
      recentPostIds: Array.from(recentIds),
      interactionsGraph: parseTelegramStatsGraph(
        'interactions-2',
        'Interactions',
        buildGraphJson(DATES_10D, [
          { key: 'y0', name: 'Views', color: '#45d168', type: 'line', values: channelDailyViews },
          { key: 'y1', name: 'Shares', color: '#f5a623', type: 'line', values: channelDailyShares },
        ]),
      ),
      growthGraph: parseTelegramStatsGraph(
        'growth-2',
        'Growth',
        buildGraphJson(DATES_10D, [
          {
            key: 'y0',
            name: 'Subscribers',
            color: '#2aabee',
            type: 'line',
            values: [576, 581, 585, 589, 593, 601, 605, 610, 614, 620],
          },
        ]),
      ),
      followersGraph: parseTelegramStatsGraph(
        'followers-2',
        'Followers',
        buildGraphJson(DATES_10D, [
          { key: 'y0', name: 'Joined', color: '#45d168', type: 'bar', values: [6, 6, 5, 5, 5, 10, 6, 7, 5, 8] },
          { key: 'y1', name: 'Left', color: '#ef5a5a', type: 'bar', values: [1, 1, 1, 1, 1, 2, 2, 2, 1, 2] },
        ]),
      ),
      topHoursGraph: parseTelegramStatsGraph(
        'topHours-2',
        'Top Hours',
        buildGraphJson(HOURS_24, [
          {
            key: 'y0',
            name: 'This week',
            color: '#2aabee',
            type: 'line',
            values: [32, 18, 10, 6, 5, 9, 24, 48, 86, 120, 145, 160, 175, 168, 192, 218, 250, 290, 315, 298, 245, 190, 118, 64],
          },
        ]),
      ),
      viewsBySourceGraph: parseTelegramStatsGraph(
        'viewsBySource-2',
        'Views by Source',
        buildGraphJson(DATES_10D, [
          { key: 'y0', name: 'Followers', color: '#2aabee', type: 'area', values: [35, 30, 29, 28, 24, 310, 74, 300, 78, 360] },
          { key: 'y1', name: 'Forwards & Channels', color: '#45d168', type: 'area', values: [10, 9, 10, 8, 8, 124, 26, 110, 22, 145] },
          { key: 'y2', name: 'Search & Links', color: '#f5a623', type: 'area', values: [5, 5, 5, 5, 4, 50, 16, 68, 13, 84] },
        ]),
      ),
      languagesGraph: parseTelegramStatsGraph(
        'languages-2',
        'Languages',
        buildGraphJson([DATES_10D[DATES_10D.length - 1]], [
          { key: 'y0', name: 'Persian (fa)', color: '#2aabee', type: 'area', values: [81] },
          { key: 'y1', name: 'English (en)', color: '#45d168', type: 'area', values: [15] },
          { key: 'y2', name: 'Other', color: '#f5a623', type: 'area', values: [4] },
        ]),
      ),
    },
    posts: enrichedPosts,
    dailyDeltas: [
      {
        dateKey: formatDateKey(DATES_10D[9]),
        postKey: 'msg:218',
        primaryId: 218,
        deltaShares: 9,
        deltaViews: 510,
      },
    ],
    publicForwardsByPost,
    postStatsByPost,
    lastSnapshotAt: prevSnapshot.capturedAt,
    scanStatus: {
      scannedCount: CHANNEL_2_MESSAGES.length,
      attributedPostsCount: Object.keys(postStatsByPost).length,
      isComplete: true,
    },
  };
}

export function getSampleDataset(): {
  channels: ChannelSummary[];
  bundles: Record<number, ChannelAnalyticsBundle>;
} {
  const b1 = createChannel1Bundle();
  const b2 = createChannel2Bundle();
  return {
    channels: SAMPLE_CHANNELS,
    bundles: {
      [b1.channel.id]: b1,
      [b2.channel.id]: b2,
    },
  };
}

export { computeFormatInsights };
