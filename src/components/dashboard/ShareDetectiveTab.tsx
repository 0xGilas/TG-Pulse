import React, { useMemo, useState } from 'react';
import { Layers, Search } from 'lucide-react';
import type {
  LanguageCode,
  PostFilterMode,
  PostRecord,
  PostSortBy,
} from '../../types/analytics';
import { getTranslations } from '../../i18n/translations';
import {
  computeChannelBenchmarks,
  filterAndSortPosts,
} from '../../utils/analyticsMath';

interface ShareDetectiveTabProps {
  lang: LanguageCode;
  posts: PostRecord[];
  onOpenPost: (post: PostRecord) => void;
}

export const ShareDetectiveTab: React.FC<ShareDetectiveTabProps> = ({
  lang,
  posts,
  onOpenPost,
}) => {
  const t = getTranslations(lang);
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<PostFilterMode>('has_shares');
  const [sortBy, setSortBy] = useState<PostSortBy>('shares_desc');

  const referenceNow = useMemo(() => {
    if (posts.length === 0) return Date.now();
    return Math.max(...posts.map((p) => p.date)) + 1000;
  }, [posts]);

  const benchmarks = useMemo(() => computeChannelBenchmarks(posts), [posts]);

  const visiblePosts = useMemo(
    () => filterAndSortPosts(posts, query, filterMode, sortBy, referenceNow),
    [posts, query, filterMode, sortBy, referenceNow],
  );

  const filterButtons: Array<{ id: PostFilterMode; label: string }> = [
    { id: 'all', label: t.filterAll },
    { id: 'has_shares', label: t.filterHasShares },
    { id: 'evergreen', label: t.filterEvergreen },
    { id: 'albums', label: t.filterAlbums },
    { id: 'older_than_7d', label: t.filterOlder7d },
  ];

  const getMedianMultiplier = (views: number): string => {
    if (benchmarks.medianViews <= 0) return '1.0×';
    return `${(views / benchmarks.medianViews).toFixed(1)}×`;
  };

  return (
    <section className="tg-panel rounded-2xl overflow-hidden">
      {/* Integrated Filter & Search Bar */}
      <div className="p-4 border-b border-white/[0.06] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#5d6f82] absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              className="w-full rounded-lg border border-white/10 bg-[#111923] ps-9 pe-3 py-2 text-xs text-[#f5f7fa] placeholder:text-[#5d6f82] focus:border-[#3390ec] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as PostSortBy)}
              aria-label="Sort posts"
              className="rounded-lg border border-white/10 bg-[#111923] px-3 py-2 text-xs text-[#f5f7fa] focus:border-[#3390ec] focus:outline-none cursor-pointer"
            >
              <option value="shares_desc">{t.sortShares}</option>
              <option value="share_rate_desc">{t.sortRate}</option>
              <option value="views_desc">{t.sortViews}</option>
              <option value="delta_desc">{t.sortDelta}</option>
              <option value="date_desc">{t.sortDate}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {filterButtons.map((btn) => {
            const active = filterMode === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setFilterMode(btn.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#3390ec] text-white'
                    : 'bg-[#111923] text-[#7f91a4] hover:text-[#f5f7fa] border border-white/[0.06]'
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Body */}
      {visiblePosts.length === 0 ? (
        <div className="p-8 text-center space-y-3">
          <p className="text-sm text-[#7f91a4]">{t.noMatchingPosts}</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilterMode('all');
            }}
            className="rounded-lg border border-white/10 bg-[#111923] px-4 py-2 text-xs font-medium text-[#f5f7fa] hover:bg-[#1e2c3a] cursor-pointer"
          >
            {t.resetFiltersBtn}
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Compact List (< md) */}
          <div className="md:hidden divide-y divide-white/[0.06]">
            {visiblePosts.map((post) => {
              const isOutlier = benchmarks.p90Views > 0 && post.views >= benchmarks.p90Views;
              return (
                <button
                  key={post.key}
                  type="button"
                  onClick={() => onOpenPost(post)}
                  className="w-full p-4 text-start hover:bg-white/[0.03] transition-colors space-y-1.5 cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#7f91a4] font-mono-num">
                    <span dir="ltr">#{post.primaryId}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{post.mediaKind}</span>
                    {post.isAlbum && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-[#5eb5f7]">
                          <Layers className="w-3 h-3" />
                          {post.albumChildren.length} {t.itemsLabel}
                        </span>
                      </>
                    )}
                    {!post.inRecentWindow && post.forwards > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#f5a623]">{t.oldPostTag}</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs font-medium text-[#f5f7fa] line-clamp-2 leading-relaxed">
                    {post.text}
                  </div>
                  <div
                    dir="ltr"
                    className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono-num"
                  >
                    <span className="text-[#7f91a4]">
                      {new Date(post.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <span className={isOutlier ? 'text-[#4dcd5e] font-semibold' : 'text-[#f5f7fa]'}>
                        {post.views} ({getMedianMultiplier(post.views)})
                      </span>
                      <span className="text-[#f5a623] font-semibold">
                        {post.forwards} sh ({post.publicSharesCount}/{post.privateSharesCount})
                      </span>
                      <span className="text-[#5eb5f7]">{post.shareRatePercent.toFixed(1)}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop High-Density Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#111923]/60 text-[11px] font-semibold text-[#7f91a4]">
                  <th className="py-2.5 px-4 text-start">{t.colPost}</th>
                  <th className="py-2.5 px-3 text-start whitespace-nowrap">{t.colDate}</th>
                  <th className="py-2.5 px-3 text-end whitespace-nowrap">{t.colViews}</th>
                  <th className="py-2.5 px-3 text-end whitespace-nowrap">{t.colShares}</th>
                  <th className="py-2.5 px-3 text-end whitespace-nowrap">{t.colEvergreen}</th>
                  <th className="py-2.5 px-3 text-end whitespace-nowrap">{t.colRate}</th>
                  <th className="py-2.5 px-4 text-end whitespace-nowrap">{t.colReactions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {visiblePosts.map((post) => {
                  const isOutlier = benchmarks.p90Views > 0 && post.views >= benchmarks.p90Views;
                  return (
                    <tr key={post.key} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-2.5 px-4 max-w-md">
                        <button
                          type="button"
                          onClick={() => onOpenPost(post)}
                          className="w-full text-start group cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] text-[#7f91a4] font-mono-num">
                            <span dir="ltr">#{post.primaryId}</span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{post.mediaKind}</span>
                            {post.isAlbum && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 text-[#5eb5f7]">
                                  <Layers className="w-3 h-3" />
                                  {post.albumChildren.length} {t.itemsLabel}
                                </span>
                              </>
                            )}
                            {!post.inRecentWindow && post.forwards > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#f5a623]">{t.oldPostTag}</span>
                              </>
                            )}
                          </div>
                          <div className="mt-0.5 text-[13px] font-medium text-[#f5f7fa] group-hover:text-[#5eb5f7] truncate">
                            {post.text}
                          </div>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[#7f91a4] font-mono-num whitespace-nowrap">
                        {new Date(post.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </td>
                      <td className="py-2.5 px-3 text-end text-xs font-mono-num whitespace-nowrap">
                        <span dir="ltr" className="inline-flex items-baseline gap-1.5">
                          <span className="text-[#f5f7fa]">{post.views.toLocaleString('en-US')}</span>
                          <span className={isOutlier ? 'text-[#4dcd5e] font-semibold' : 'text-[#5d6f82]'}>
                            ({getMedianMultiplier(post.views)})
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-end text-xs font-mono-num whitespace-nowrap">
                        <span dir="ltr" className="inline-flex items-baseline gap-1.5">
                          <span className="font-semibold text-[#f5a623]">
                            {post.forwards.toLocaleString('en-US')}
                          </span>
                          <span className="text-[11px] text-[#7f91a4]">
                            ({post.publicSharesCount}/{post.privateSharesCount})
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-end text-xs font-mono-num whitespace-nowrap">
                        <span className={post.evergreenShareRatio >= 25 ? 'text-[#4dcd5e]' : 'text-[#7f91a4]'}>
                          {post.evergreenShareRatio}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-end text-xs text-[#5eb5f7] font-mono-num whitespace-nowrap">
                        {post.shareRatePercent.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-4 text-end text-xs text-[#7f91a4] font-mono-num whitespace-nowrap">
                        <span dir="ltr" className="inline-block">
                          {post.reactionsCount} / {post.replies}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
