import React, { useMemo } from 'react';
import {
  ArrowUpRight,
  ExternalLink,
  Layers,
  Radar,
  RefreshCw,
} from 'lucide-react';
import type {
  ChannelAnalyticsBundle,
  LanguageCode,
  PostRecord,
} from '../../types/analytics';
import { getTranslations } from '../../i18n/translations';
import {
  attributeDateFromMessageStats,
  computeChannelBenchmarks,
  formatCompactNumber,
} from '../../utils/analyticsMath';
import { TelegramTimeChart } from '../charts/TelegramTimeChart';

interface OverviewTabProps {
  lang: LanguageCode;
  bundle: ChannelAnalyticsBundle;
  isSampleMode: boolean;
  selectedDateKey: string | null;
  scanningAttribution: boolean;
  attributionProgress: { completed: number; total: number } | null;
  onScanAttribution: () => void;
  onSelectDate: (dateKey: string) => void;
  onOpenPost: (post: PostRecord) => void;
}

function calcDeltaPct(curr: number, prev: number): { text: string; positive: boolean } {
  if (!prev) return { text: '—', positive: true };
  const diff = ((curr - prev) / prev) * 100;
  const sign = diff >= 0 ? '+' : '';
  return {
    text: `${sign}${diff.toFixed(1)}%`,
    positive: diff >= 0,
  };
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  lang,
  bundle,
  isSampleMode,
  selectedDateKey,
  scanningAttribution,
  attributionProgress,
  onScanAttribution,
  onSelectDate,
  onOpenPost,
}) => {
  const t = getTranslations(lang);
  const { overview, posts, postStatsByPost, dailyDeltas, publicForwardsByPost } = bundle;

  const avgShareRate = useMemo(() => {
    if (overview.viewsPerPost.current <= 0) return 0;
    return Number(((overview.sharesPerPost.current / overview.viewsPerPost.current) * 100).toFixed(2));
  }, [overview]);

  const benchmarks = useMemo(() => computeChannelBenchmarks(posts), [posts]);

  const attribution = useMemo(() => {
    if (!selectedDateKey) return null;
    return attributeDateFromMessageStats({
      dateKey: selectedDateKey,
      interactionsGraph: overview.interactionsGraph,
      posts,
      postStatsByPost,
      dailyDeltas,
      publicForwardsByPost,
    });
  }, [
    selectedDateKey,
    overview.interactionsGraph,
    posts,
    postStatsByPost,
    dailyDeltas,
    publicForwardsByPost,
  ]);

  const kpis = [
    {
      label: t.kpiSubscribers,
      value: formatCompactNumber(overview.followers.current),
      delta: calcDeltaPct(overview.followers.current, overview.followers.previous),
    },
    {
      label: t.kpiAvgViews,
      value: formatCompactNumber(Math.round(overview.viewsPerPost.current)),
      delta: calcDeltaPct(overview.viewsPerPost.current, overview.viewsPerPost.previous),
    },
    {
      label: t.kpiAvgShares,
      value: overview.sharesPerPost.current.toFixed(1),
      delta: calcDeltaPct(overview.sharesPerPost.current, overview.sharesPerPost.previous),
    },
    {
      label: t.kpiShareRate,
      value: `${avgShareRate}%`,
      delta: {
        text:
          lang === 'fa'
            ? `${overview.reactionsPerPost.current.toFixed(1)} واکنش/پست`
            : `${overview.reactionsPerPost.current.toFixed(1)} react/post`,
        positive: true,
      },
    },
    {
      label: t.kpiNotifications,
      value: `${overview.enabledNotificationsPercent}%`,
      delta: {
        text: lang === 'fa' ? `${bundle.posts.length} پست` : `${bundle.posts.length} posts`,
        positive: true,
      },
    },
  ];

  const totalSharesSplit = Math.max(1, benchmarks.totalPublicShares + benchmarks.totalPrivateShares);
  const publicSharePct = Math.round((benchmarks.totalPublicShares / totalSharesSplit) * 100);

  return (
    <div className="space-y-4">
      {/* Unified Telegram-Native Overview Panel (Single surface, hairline dividers, zero card-in-card bubbles) */}
      <section className="tg-panel rounded-2xl overflow-hidden" aria-label={t.overviewSectionTitle}>
        <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-4">
          <h2 className="text-[13px] font-semibold text-[#5eb5f7]">{t.overviewSectionTitle}</h2>
          <div dir="ltr" className="text-[11px] font-mono-num text-[#7f91a4]">
            {new Date(overview.periodFrom).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}{' '}
            —{' '}
            {new Date(overview.periodTo).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}
          </div>
        </div>

        {/* Primary KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="px-5 py-3.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span dir="ltr" className="text-xl font-bold text-[#f5f7fa] font-mono-num">
                  {kpi.value}
                </span>
                <span
                  dir={lang === 'fa' && /[^\x00-\x7F]/.test(kpi.delta.text) ? 'rtl' : 'ltr'}
                  className={`inline-block whitespace-nowrap text-[11px] ${
                    /[^\x00-\x7F]/.test(kpi.delta.text) ? 'tabular-nums' : 'font-mono-num'
                  } ${kpi.delta.positive ? 'text-[#4dcd5e]' : 'text-[#e55353]'}`}
                >
                  {kpi.delta.text}
                </span>
              </div>
              <div className="mt-1 text-xs text-[#7f91a4] truncate">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Benchmarks & Public/Private Split Sub-Bar */}
        <div className="border-t border-white/[0.06] bg-[#111923]/45 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
          <div className="px-5 py-3 flex items-baseline justify-between gap-2">
            <span className="text-xs text-[#7f91a4]">{t.benchMedianViews}</span>
            <span dir="ltr" className="text-xs font-semibold font-mono-num text-[#f5f7fa]">
              {formatCompactNumber(benchmarks.medianViews)} ({benchmarks.medianShareRate}%)
            </span>
          </div>

          <div className="px-5 py-3 flex items-baseline justify-between gap-2">
            <span className="text-xs text-[#7f91a4]">{t.benchP90Views}</span>
            <span dir="ltr" className="text-xs font-semibold font-mono-num text-[#4dcd5e]">
              {formatCompactNumber(benchmarks.p90Views)}
            </span>
          </div>

          <div className="px-5 py-3 flex items-baseline justify-between gap-2">
            <span className="text-xs text-[#7f91a4]">{t.benchEvergreen}</span>
            <span dir="ltr" className="text-xs font-semibold font-mono-num text-[#f5a623]">
              {benchmarks.evergreenSharePercent}%
            </span>
          </div>

          <div className="px-5 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-[#7f91a4] truncate">{t.benchPublicPrivate}</span>
              <span dir="ltr" className="font-mono-num font-semibold text-[#f5f7fa] shrink-0">
                {benchmarks.totalPublicShares} / {benchmarks.totalPrivateShares}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-white/[0.08] overflow-hidden flex" dir="ltr">
              <div
                className="h-full bg-[#3390ec]"
                style={{ width: `${publicSharePct}%` }}
                title={`Public: ${benchmarks.totalPublicShares}`}
              />
              <div
                className="h-full bg-[#f5a623]"
                style={{ width: `${100 - publicSharePct}%` }}
                title={`Private / DMs / Saved: ${benchmarks.totalPrivateShares}`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Interactions Chart with Clickable Date Selection */}
      {overview.interactionsGraph && (
        <TelegramTimeChart
          graph={{ ...overview.interactionsGraph, title: t.interactionsTitle }}
          subtitle={t.interactionsHint}
          selectedDateKey={selectedDateKey}
          onSelectDate={onSelectDate}
          height={250}
        />
      )}

      {/* Exact Per-Date Views & Shares Attribution Ledger */}
      {attribution && (
        <section
          className="tg-panel rounded-2xl overflow-hidden"
          aria-label={t.attributionTitle}
        >
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-[13px] font-semibold text-[#5eb5f7]">
                {t.attributionTitle}{' '}
                <span dir="ltr" className="inline-block font-mono-num text-[#f5a623] ms-1">
                  {attribution.dateKey}
                </span>
              </h3>
              <p className="text-xs text-[#7f91a4] max-w-3xl leading-relaxed">
                {t.attributionHowBody}
              </p>
            </div>

            {!isSampleMode && (
              <button
                type="button"
                disabled={scanningAttribution}
                onClick={onScanAttribution}
                className="inline-flex items-center gap-2 rounded-lg bg-[#3390ec] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2a80d6] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {scanningAttribution ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Radar className="w-3.5 h-3.5" />
                )}
                <span>
                  {scanningAttribution && attributionProgress
                    ? `${t.scanningAttributionText} (${attributionProgress.completed}/${attributionProgress.total})`
                    : t.scanAttributionBtn}
                </span>
              </button>
            )}
          </div>

          {/* 3-Column Date Reconciliation Strip (Hairline-divided, zero nested cards) */}
          <div className="border-y border-white/[0.06] bg-[#111923]/40 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
            <div className="px-5 py-3">
              <div className="text-[11px] text-[#7f91a4]">{t.channelGraphLabel}</div>
              <div dir="ltr" className="mt-1 flex items-baseline gap-3 font-mono-num">
                <span className="text-base font-bold text-[#4dcd5e]">
                  {attribution.graphTotalViews.toLocaleString('en-US')} views
                </span>
                <span className="text-xs font-semibold text-[#f5a623]">
                  +{attribution.graphTotalShares} shares
                </span>
              </div>
            </div>

            <div className="px-5 py-3">
              <div className="text-[11px] text-[#7f91a4]">{t.attributedSumLabel}</div>
              <div dir="ltr" className="mt-1 flex items-baseline gap-3 font-mono-num">
                <span className="text-base font-bold text-[#f5f7fa]">
                  {attribution.attributedViewsSum.toLocaleString('en-US')} views
                </span>
                <span className="text-xs font-semibold text-[#5eb5f7]">
                  +{attribution.attributedSharesSum} shares
                </span>
              </div>
            </div>

            <div className="px-5 py-3">
              <div className="text-[11px] text-[#7f91a4]">{t.unattributedGapLabel}</div>
              <div dir="ltr" className="mt-1 flex items-baseline gap-3 font-mono-num">
                <span
                  className={`text-base font-bold ${
                    attribution.unattributedShares === 0 ? 'text-[#4dcd5e]' : 'text-[#f5a623]'
                  }`}
                >
                  {attribution.unattributedShares} shares
                </span>
                <span className="text-[11px] text-[#7f91a4]">
                  ({bundle.scanStatus.attributedPostsCount}/{posts.length} scanned)
                </span>
              </div>
            </div>
          </div>

          {/* Attributed Posts Rows */}
          {attribution.contributions.length > 0 ? (
            <div className="divide-y divide-white/[0.06]">
              {attribution.contributions.map((item) => {
                const sourceLabel =
                  item.source === 'message_stats'
                    ? t.sourceMessageStats
                    : item.source === 'snapshot_delta'
                      ? t.sourceSnapshotDelta
                      : t.sourcePublicForward;

                return (
                  <button
                    key={item.post.key}
                    type="button"
                    onClick={() => onOpenPost(item.post)}
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 text-start hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7f91a4] font-mono-num">
                        <span dir="ltr">#{item.post.primaryId}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {new Date(item.post.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            timeZone: 'UTC',
                          })}
                        </span>
                        {item.post.isAlbum && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[#5eb5f7]">
                              <Layers className="w-3 h-3" />
                              {t.albumLabel} ({item.post.albumChildren.length})
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="text-[#5eb5f7]">{sourceLabel}</span>
                      </div>

                      <div className="text-[13px] font-medium text-[#f5f7fa] truncate">
                        {item.post.text}
                      </div>

                      <div className="flex items-center gap-2.5 pt-0.5" dir="ltr">
                        <div className="h-1 flex-1 max-w-[160px] rounded-full bg-white/[0.08] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#f5a623]"
                            style={{
                              width: `${Math.max(4, item.sharesOnDate > 0 ? item.shareContributionPct : item.viewContributionPct)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-mono-num text-[#7f91a4]">
                          {item.sharesOnDate > 0
                            ? `${item.shareContributionPct}% of shares`
                            : `${item.viewContributionPct}% of views`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <div className="text-end font-mono-num" dir="ltr">
                        <div className="text-xs font-semibold text-[#f5a623]">
                          +{item.sharesOnDate} shares · {item.viewsOnDate.toLocaleString('en-US')} views
                        </div>
                        <div className="text-[11px] text-[#7f91a4]">
                          Pub {item.post.publicSharesCount} / Priv {item.post.privateSharesCount}
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-[#5d6f82]" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-5 text-xs text-[#7f91a4]">
              {lang === 'fa'
                ? 'برای این تاریخ هنوز آمار تک‌پیام اسکن نشده است. دکمه اسکن آمار روزانه پست‌ها را بزنید تا سهم هر پیام محاسبه شود.'
                : 'No per-message daily records scanned for this date yet. Run "Scan Post Timelines (MTProto)" to attribute this date across your post archive.'}
            </div>
          )}

          {/* Public Reposts on Selected Date */}
          {attribution.publicForwardsOnDate.length > 0 && (
            <div className="border-t border-white/[0.06]">
              <div className="px-5 py-2.5 text-[12px] font-semibold text-[#5eb5f7] bg-[#111923]/30">
                {t.publicRepostsOnDateTitle}
              </div>
              <div className="divide-y divide-white/[0.06]">
                {attribution.publicForwardsOnDate.map(({ post, forward }) => (
                  <button
                    key={`${post.key}-${forward.channelId}-${forward.messageId}`}
                    type="button"
                    onClick={() => onOpenPost(post)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 text-start hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#f5f7fa] truncate">
                        {forward.channelTitle}
                        {forward.channelUsername && (
                          <span dir="ltr" className="inline-block text-[#5eb5f7] font-mono-num ms-1.5">
                            @{forward.channelUsername}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#7f91a4] truncate mt-0.5 font-mono-num">
                        Post #{post.primaryId} · {forward.views.toLocaleString('en-US')} views
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#7f91a4] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Secondary Growth & Followers Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {overview.growthGraph && (
          <TelegramTimeChart
            graph={{ ...overview.growthGraph, title: t.growthTitle }}
            height={210}
            showRangeSlider={false}
          />
        )}
        {overview.followersGraph && (
          <TelegramTimeChart
            graph={{ ...overview.followersGraph, title: t.followersTitle }}
            height={210}
            showRangeSlider={false}
          />
        )}
      </div>
    </div>
  );
};
