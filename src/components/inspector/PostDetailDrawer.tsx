import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Layers, RefreshCw, X } from 'lucide-react';
import type {
  LanguageCode,
  PostDetailedStats,
  PostMediaPreview,
  PostRecord,
  PublicForwardRecord,
} from '../../types/analytics';
import { getTranslations } from '../../i18n/translations';
import { TelegramTimeChart } from '../charts/TelegramTimeChart';
import { PostPreviewCard } from './PostPreviewCard';

const UTC_DATETIME_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

const UTC_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const DRAWER_ROW_LIMIT = 40;

interface PostDetailDrawerProps {
  lang: LanguageCode;
  post: PostRecord | null;
  details: PostDetailedStats | undefined;
  mediaPreview?: PostMediaPreview;
  loadingMediaPreview?: boolean;
  publicForwards: PublicForwardRecord[];
  isSampleMode: boolean;
  loadingDetails: boolean;
  onLoadLiveDetails: (post: PostRecord) => void;
  onClose: () => void;
}

export const PostDetailDrawer: React.FC<PostDetailDrawerProps> = React.memo(({
  lang,
  post,
  details,
  mediaPreview,
  loadingMediaPreview = false,
  publicForwards,
  isSampleMode,
  loadingDetails,
  onLoadLiveDetails,
  onClose,
}) => {
  const t = getTranslations(lang);
  const [showAllDaily, setShowAllDaily] = useState(false);
  const [showAllForwards, setShowAllForwards] = useState(false);

  useEffect(() => {
    setShowAllDaily(false);
    setShowAllForwards(false);
  }, [post?.key]);

  const forwardsList = details?.publicForwards ?? publicForwards;
  const activeDailyRows = useMemo(
    () => (details?.dailyBreakdown ?? []).filter((row) => row.views > 0 || row.shares > 0),
    [details?.dailyBreakdown],
  );

  if (!post) return null;

  const visibleDailyRows = showAllDaily ? activeDailyRows : activeDailyRows.slice(0, DRAWER_ROW_LIMIT);
  const visibleForwards = showAllForwards ? forwardsList : forwardsList.slice(0, DRAWER_ROW_LIMIT);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-drawer-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg tg-drawer-surface border-y-0 border-e-0 h-full flex flex-col">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-[#10151D]">
          <div>
            <h2 id="post-drawer-title" className="text-sm font-semibold text-[#f5f7fa]">
              {t.drawerTitle}
            </h2>
            <div dir="ltr" className="text-xs text-[#7f91a4] font-mono-num mt-0.5 text-start">
              #{post.primaryId} · {UTC_DATETIME_FMT.format(post.date)} UTC
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeBtn}
            className="rounded-lg p-1.5 text-[#7f91a4] hover:bg-white/10 hover:text-[#f5f7fa] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Native Telegram-Style Drawer Content (Isolated scroll layer, zero nested blur) */}
        <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-white/[0.06]">
          {/* Rich Post Media & Caption Preview */}
          <div className="p-5 space-y-2.5">
            <PostPreviewCard
              lang={lang}
              post={post}
              mediaPreview={mediaPreview}
              loadingMediaPreview={loadingMediaPreview}
            />
            {post.permalink && (
              <div dir="ltr" className="text-[11px] text-[#5eb5f7] font-mono-num truncate">
                {post.permalink}
              </div>
            )}
          </div>

          {/* Native Telegram Overview Section (Matches attached Message Statistic layout) */}
          <div className="p-5 space-y-3.5">
            <h3 className="text-[13px] font-semibold text-[#5eb5f7]">
              {t.overviewSectionTitle}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <div dir="ltr" className="text-base font-bold text-[#f5f7fa] font-mono-num text-start">
                  {post.views.toLocaleString('en-US')}
                </div>
                <div className="text-xs text-[#7f91a4] mt-0.5">{t.colViews.split(' (')[0]}</div>
              </div>

              <div>
                <div dir="ltr" className="text-base font-bold text-[#5eb5f7] font-mono-num text-start">
                  {post.publicSharesCount}
                </div>
                <div className="text-xs text-[#7f91a4] mt-0.5">{t.publicSharesLabel}</div>
              </div>

              <div>
                <div dir="ltr" className="text-base font-bold text-[#f5a623] font-mono-num text-start">
                  {post.privateSharesCount}
                </div>
                <div className="text-xs text-[#7f91a4] mt-0.5">{t.privateSharesLabel}</div>
              </div>

              <div>
                <div dir="ltr" className="text-base font-bold text-[#f5f7fa] font-mono-num text-start">
                  {post.reactionsCount}
                </div>
                <div className="text-xs text-[#7f91a4] mt-0.5">{t.colReactions.split(' /')[0]}</div>
              </div>

              <div>
                <div dir="ltr" className="text-base font-bold text-[#4dcd5e] font-mono-num text-start">
                  {post.evergreenShareRatio}%
                </div>
                <div className="text-xs text-[#7f91a4] mt-0.5">{t.colEvergreen}</div>
              </div>

              <div>
                <div dir="ltr" className="text-base font-bold text-[#5eb5f7] font-mono-num text-start">
                  {post.shareRatePercent.toFixed(2)}%
                </div>
                <div className="text-xs text-[#7f91a4] mt-0.5">{t.colRate}</div>
              </div>
            </div>

            {!isSampleMode && (
              <button
                type="button"
                disabled={loadingDetails}
                onClick={() => onLoadLiveDetails(post)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#3390ec] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a80d6] disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDetails ? 'animate-spin' : ''}`} />
                <span>{t.loadLivePostStatsBtn}</span>
              </button>
            )}
          </div>

          {/* Album Breakdown if grouped_id */}
          {post.isAlbum && (
            <div className="p-5 space-y-2.5">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#5eb5f7]">
                <Layers className="w-4 h-4" />
                <span>{t.albumBreakdownTitle}</span>
              </div>
              <p className="text-xs text-[#7f91a4] leading-relaxed">{t.albumBreakdownSub}</p>
              <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                {post.albumChildren.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 text-xs"
                  >
                    <div>
                      <span dir="ltr" className="font-mono-num text-[#7f91a4]">#{item.id}</span>
                      <span className="mx-2 text-[#5d6f82]">·</span>
                      <span className="text-[#f5f7fa] capitalize">
                        Item {idx + 1} ({item.mediaKind})
                      </span>
                    </div>
                    <div dir="ltr" className="font-mono-num text-[#7f91a4]">
                      <span className="text-[#f5f7fa]">{item.views}</span> views ·{' '}
                      <span className="text-[#f5a623] font-semibold">{item.forwards}</span> shares
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reactions Breakdown */}
          {post.reactions.length > 0 && (
            <div className="p-5 space-y-2.5">
              <div className="text-[13px] font-semibold text-[#5eb5f7]">
                {t.reactionsBreakdownTitle}
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-mono-num">
                {post.reactions.map((r) => (
                  <span key={r.emoji} className="inline-flex items-center gap-1.5 text-[#f5f7fa]">
                    <span>{r.emoji}</span>
                    <span className="font-semibold">{r.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Post Views & Shares Trajectory Chart */}
          {details?.viewsGraph && (
            <div className="p-4">
              <TelegramTimeChart
                graph={details.viewsGraph}
                titleOverride={t.postTrendTitle}
                dualAxisHint={lang === 'fa' ? 'محور چپ: ویو · محور راست: شیر' : 'Left: Views · Right: Shares'}
                height={196}
                compact
                showRangeSlider={false}
              />
            </div>
          )}

          {/* Daily Views & Shares Activity Log */}
          {activeDailyRows.length > 0 && (
            <div className="p-5 space-y-2.5">
              <div className="text-[13px] font-semibold text-[#5eb5f7]">
                {t.dailyBreakdownTableTitle}
              </div>
              <div className="divide-y divide-white/[0.06] max-h-48 overflow-y-auto overscroll-contain border-t border-white/[0.06]">
                {visibleDailyRows.map((row) => (
                  <div
                    key={row.dateKey}
                    dir="ltr"
                    className="flex items-center justify-between py-2 text-xs font-mono-num"
                  >
                    <span className="text-[#7f91a4]">{row.dateKey}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-[#4dcd5e]">{row.views.toLocaleString('en-US')} views</span>
                      <span className={row.shares > 0 ? 'text-[#f5a623] font-semibold' : 'text-[#5d6f82]'}>
                        +{row.shares} shares
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {!showAllDaily && activeDailyRows.length > DRAWER_ROW_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllDaily(true)}
                  className="text-[11px] font-medium text-[#5EC2F6] hover:underline cursor-pointer"
                >
                  {lang === 'fa'
                    ? `نمایش همه ${activeDailyRows.length} روز`
                    : `Show all ${activeDailyRows.length} days`}
                </button>
              )}
            </div>
          )}

          {/* Public Forwards List */}
          <div className="p-5 space-y-2.5">
            <div className="text-[13px] font-semibold text-[#5eb5f7]">{t.publicForwardsTitle}</div>
            {forwardsList.length === 0 ? (
              <p className="text-xs text-[#7f91a4] leading-relaxed">{t.noPublicForwards}</p>
            ) : (
              <>
                <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                  {visibleForwards.map((fwd) => (
                    <div
                      key={`${fwd.channelId}-${fwd.messageId}`}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#f5f7fa] truncate">
                          {fwd.channelTitle}
                          {fwd.channelUsername && (
                            <span dir="ltr" className="inline-block text-[#5eb5f7] font-mono-num ms-1.5">
                              @{fwd.channelUsername}
                            </span>
                          )}
                        </div>
                        <div dir="ltr" className="text-[11px] text-[#7f91a4] font-mono-num mt-0.5 text-start">
                          {UTC_DATE_FMT.format(fwd.date)} · msg #{fwd.messageId}
                        </div>
                      </div>
                      <div dir="ltr" className="flex items-center gap-2 shrink-0 text-xs font-mono-num text-[#4dcd5e]">
                        <span>{fwd.views.toLocaleString('en-US')} views</span>
                        <ExternalLink className="w-3.5 h-3.5 text-[#7f91a4]" />
                      </div>
                    </div>
                  ))}
                </div>
                {!showAllForwards && forwardsList.length > DRAWER_ROW_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setShowAllForwards(true)}
                    className="text-[11px] font-medium text-[#5EC2F6] hover:underline cursor-pointer"
                  >
                    {lang === 'fa'
                      ? `نمایش همه ${forwardsList.length} بازنشر عمومی`
                      : `Show all ${forwardsList.length} public forwards`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

PostDetailDrawer.displayName = 'PostDetailDrawer';
