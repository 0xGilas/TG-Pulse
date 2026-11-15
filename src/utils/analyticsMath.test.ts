import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attributeDateFromMessageStats,
  buildSnapshotFromPosts,
  computeAxisTicks,
  computeChannelBenchmarks,
  computeEvergreenRatio,
  computeSnapshotDeltas,
  computeWeekdayHourMatrix,
  exportPostsToCsv,
  extractDailyActivityFromGraph,
  formatFileSize,
  formatMediaDuration,
  getPostDisplayTitle,
  groupAlbumPosts,
  parseTelegramStatsGraph,
  resolveDualAxisPlan,
  shouldUseDualAxis,
} from './analyticsMath';
import type { ParsedStatsGraph, PostDetailedStats, RawChannelMessage } from '../types/analytics';

test('extractDailyActivityFromGraph extracts both per-message views and shares per day', () => {
  const msgJson = JSON.stringify({
    columns: [
      ['x', Date.UTC(2026, 9, 30), Date.UTC(2026, 10, 4), Date.UTC(2026, 10, 9)],
      ['y0', 12, 1, 4],
      ['y1', 1, 0, 2],
    ],
    types: { x: 'x', y0: 'line', y1: 'line' },
    names: { y0: 'Views', y1: 'Shares' },
    colors: { y0: 'LIGHT#3390ec', y1: 'LIGHT#f5a623' },
  });

  const graph = parseTelegramStatsGraph('msg-1', 'Interactions', msgJson);
  const daily = extractDailyActivityFromGraph(graph);
  assert.equal(daily.length, 3);
  assert.deepEqual(daily[0], { dateKey: '2026-10-30', views: 12, shares: 1 });
  assert.deepEqual(daily[2], { dateKey: '2026-11-09', views: 4, shares: 2 });
});

test('attributeDateFromMessageStats attributes exact views & shares on any date back to individual older posts', () => {
  const posts = groupAlbumPosts(
    [
      {
        id: 210,
        date: Date.UTC(2026, 10, 9, 12, 0),
        text: 'Recent post',
        views: 15,
        forwards: 0,
        replies: 1,
        groupedId: null,
        mediaKind: 'text',
        reactions: [],
      },
      {
        id: 142,
        date: Date.UTC(2026, 9, 18, 12, 0),
        text: 'Older evergreen post',
        views: 310,
        forwards: 6,
        replies: 4,
        groupedId: null,
        mediaKind: 'audio',
        reactions: [{ emoji: '🔥', count: 9 }],
      },
    ],
    new Set([210]),
  );

  const interactionsGraph: ParsedStatsGraph = {
    id: 'interactions',
    title: 'Interactions',
    type: 'line',
    timestamps: [Date.UTC(2026, 10, 8), Date.UTC(2026, 10, 9)],
    series: [
      { key: 'y0', label: 'Views', color: '#45d168', values: [20, 39] },
      { key: 'y1', label: 'Shares', color: '#f5a623', values: [0, 4] },
    ],
  };

  const postStatsByPost: Record<string, PostDetailedStats> = {
    'msg:210': {
      postKey: 'msg:210',
      primaryId: 210,
      dailyBreakdown: [{ dateKey: '2026-11-09', views: 15, shares: 0 }],
      publicForwards: [],
      loadedAt: Date.now(),
    },
    'msg:142': {
      postKey: 'msg:142',
      primaryId: 142,
      dailyBreakdown: [{ dateKey: '2026-11-09', views: 24, shares: 4 }],
      publicForwards: [],
      loadedAt: Date.now(),
    },
  };

  const attribution = attributeDateFromMessageStats({
    dateKey: '2026-11-09',
    interactionsGraph,
    posts,
    postStatsByPost,
    dailyDeltas: [],
    publicForwardsByPost: {},
  });

  assert.equal(attribution.graphTotalViews, 39);
  assert.equal(attribution.graphTotalShares, 4);
  assert.equal(attribution.attributedViewsSum, 39);
  assert.equal(attribution.attributedSharesSum, 4);
  assert.equal(attribution.unattributedShares, 0);
  assert.equal(attribution.contributions[0].post.primaryId, 142);
  assert.equal(attribution.contributions[0].shareContributionPct, 100);
});

test('computeEvergreenRatio, computeChannelBenchmarks, and computeWeekdayHourMatrix calculate actionable metrics', () => {
  const raw: RawChannelMessage[] = [
    {
      id: 1,
      date: Date.UTC(2026, 9, 1, 16, 0),
      text: 'Post A',
      views: 100,
      forwards: 2,
      replies: 0,
      groupedId: null,
      mediaKind: 'text',
      reactions: [],
    },
    {
      id: 2,
      date: Date.UTC(2026, 9, 2, 16, 0),
      text: 'Post B',
      views: 200,
      forwards: 8,
      replies: 1,
      groupedId: null,
      mediaKind: 'album',
      reactions: [],
    } as unknown as RawChannelMessage,
    {
      id: 3,
      date: Date.UTC(2026, 9, 18, 16, 0),
      text: 'Post C',
      views: 900,
      forwards: 10,
      replies: 5,
      groupedId: null,
      mediaKind: 'video',
      reactions: [],
    },
  ];

  const posts = groupAlbumPosts(raw);
  const benchmarks = computeChannelBenchmarks(posts);
  assert.equal(benchmarks.medianViews, 200);
  assert.equal(benchmarks.p90Views, 900);
  assert.equal(benchmarks.totalPrivateShares, 20);

  const evergreen = computeEvergreenRatio(Date.UTC(2026, 9, 1, 16, 0), [
    { dateKey: '2026-10-01', views: 50, shares: 0 },
    { dateKey: '2026-10-10', views: 50, shares: 2 },
  ]);
  assert.ok(evergreen > 50);

  const matrix = computeWeekdayHourMatrix(posts);
  assert.equal(matrix.length, 42); // 7 weekdays * 6 blocks
  assert.ok(exportPostsToCsv(posts).includes('public_shares,private_shares'));
});

test('computeSnapshotDeltas accurately calculates deltas from baseline snapshot', () => {
  const posts = groupAlbumPosts([
    {
      id: 50,
      date: Date.UTC(2026, 9, 10),
      text: 'Baseline test',
      views: 420,
      forwards: 9,
      replies: 1,
      groupedId: null,
      mediaKind: 'photo',
      reactions: [{ emoji: '🔥', count: 5 }],
    },
  ]);

  const snap = buildSnapshotFromPosts(1, 500, [
    { ...posts[0], views: 390, forwards: 6, reactionsCount: 3 },
  ]);

  const deltas = computeSnapshotDeltas(posts, snap);
  assert.equal(deltas[0].deltaViews, 30);
  assert.equal(deltas[0].deltaShares, 3);
  assert.equal(deltas[0].deltaReactions, 2);
});

test('dual-axis detection and integer tick computation prevent crushed Shares lines', () => {
  const ticksSmall = computeAxisTicks(0, 4);
  assert.deepEqual(ticksSmall, [0, 1, 2, 3, 4]);

  const ticksZeroToOne = computeAxisTicks(0, 1);
  assert.deepEqual(ticksZeroToOne, [0, 1]);

  const ticksLarge = computeAxisTicks(0, 785);
  assert.equal(ticksLarge.length, 5);
  assert.equal(ticksLarge[0], 0);
  assert.equal(ticksLarge[4], 785);

  const viewsAndShares = [
    { key: 'y0', label: 'Views', color: '#3390ec', values: [120, 785, 650] },
    { key: 'y1', label: 'Shares', color: '#f5a623', values: [0, 4, 3] },
  ];
  assert.equal(shouldUseDualAxis(viewsAndShares, 'line'), true);
  assert.equal(shouldUseDualAxis(viewsAndShares, 'step'), true);
  assert.equal(shouldUseDualAxis([viewsAndShares[0]], 'line'), false);
  assert.equal(shouldUseDualAxis(viewsAndShares, 'bar'), false);

  const reversedOrder = [
    { key: 'y0', label: 'Shares', color: '#f5a623', values: [0, 4, 3] },
    { key: 'y1', label: 'Views', color: '#3390ec', values: [120, 785, 650] },
  ];
  const reversedPlan = resolveDualAxisPlan(reversedOrder, 'line', undefined, true);
  assert.equal(reversedPlan.isDualAxis, true);
  assert.deepEqual(reversedPlan.leftSeriesIndices, [1]);
  assert.deepEqual(reversedPlan.rightSeriesIndices, [0]);

  const parsedYScaled = parseTelegramStatsGraph(
    'tg-1',
    'Interactions',
    JSON.stringify({
      columns: [
        ['x', Date.UTC(2026, 10, 15)],
        ['y0', 5],
        ['y1', 1],
      ],
      types: { x: 'x', y0: 'line', y1: 'line' },
      names: { y0: 'Views', y1: 'Shares' },
      colors: { y0: 'NIGHT#3390ec', y1: 'NIGHT#f5a623' },
      y_scaled: true,
    }),
  );
  assert.equal(parsedYScaled.yScaled, true);
});

test('media formatters and getPostDisplayTitle handle captionless audio and poll posts cleanly', () => {
  assert.equal(formatMediaDuration(205), '3:25');
  assert.equal(formatMediaDuration(3665), '1:01:05');
  assert.equal(formatFileSize(1536), '1.5 KB');
  assert.equal(formatFileSize(4 * 1024 * 1024), '4.0 MB');

  const posts = groupAlbumPosts([
    {
      id: 1406,
      date: Date.UTC(2026, 9, 30),
      text: '',
      views: 48,
      forwards: 1,
      replies: 0,
      groupedId: null,
      mediaKind: 'audio',
      mediaMeta: {
        title: 'Metamorphosis',
        performer: '0xAudio',
        durationSec: 184,
      },
      reactions: [],
    },
  ]);

  assert.equal(getPostDisplayTitle(posts[0], 'en'), '0xAudio — Metamorphosis');
  assert.equal(getPostDisplayTitle(posts[0], 'fa'), '0xAudio — Metamorphosis');
});

