import React from 'react';
import {
  BarChart3,
  FileText,
  Film,
  Image as ImageIcon,
  Layers,
  Link2,
  Mic,
  Music,
  Play,
} from 'lucide-react';
import type {
  LanguageCode,
  PostMediaPreview,
  PostRecord,
} from '../../types/analytics';
import {
  formatFileSize,
  formatMediaDuration,
  getPostDisplayTitle,
} from '../../utils/analyticsMath';

interface PostPreviewCardProps {
  lang: LanguageCode;
  post: PostRecord;
  mediaPreview?: PostMediaPreview;
  loadingMediaPreview?: boolean;
}

export const PostPreviewCard: React.FC<PostPreviewCardProps> = ({
  lang,
  post,
  mediaPreview,
  loadingMediaPreview = false,
}) => {
  const primaryPreviewItem =
    mediaPreview?.items.find((i) => i.messageId === post.primaryId) ??
    mediaPreview?.items[0];
  const meta = primaryPreviewItem?.meta ?? post.mediaMeta;
  const previewSrc = primaryPreviewItem?.previewUrl ?? meta?.thumbUrl;
  const isBlurryThumbOnly = Boolean(!primaryPreviewItem?.previewUrl && meta?.thumbUrl && loadingMediaPreview);

  const labels = {
    previewHeader: lang === 'fa' ? 'پیش‌نمایش پست' : 'Post Preview',
    loadingPreview: lang === 'fa' ? 'در حال دریافت پیش‌نمایش باکیفیت...' : 'Loading media preview...',
    audioFallback: lang === 'fa' ? 'فایل صوتی بدون عنوان' : 'Untitled Audio Track',
    voiceMsg: lang === 'fa' ? 'پیام صوتی' : 'Voice Message',
    documentFallback: lang === 'fa' ? 'فایل پیوست' : 'Attachment File',
    votesLabel: lang === 'fa' ? 'رأی' : 'votes',
    quizTag: lang === 'fa' ? 'آزمون' : 'Quiz',
    pollTag: lang === 'fa' ? 'نظرسنجی' : 'Poll',
    closedTag: lang === 'fa' ? 'بسته‌شده' : 'Closed',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5EC2F6]">
          {labels.previewHeader}
        </span>
        {loadingMediaPreview && (
          <span className="text-[11px] text-[#8B9BB0] animate-pulse">
            {labels.loadingPreview}
          </span>
        )}
      </div>

      {/* PHOTO PREVIEW */}
      {post.mediaKind === 'photo' && (
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0B0F14]">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt={getPostDisplayTitle(post, lang)}
              className={`w-full max-h-72 object-contain bg-[#090C10] transition duration-300 ${
                isBlurryThumbOnly ? 'blur-sm scale-[1.02]' : ''
              }`}
            />
          ) : (
            <div className="h-36 flex flex-col items-center justify-center gap-2 text-[#586778]">
              <ImageIcon className="w-7 h-7" />
              <span className="text-xs">
                {loadingMediaPreview ? labels.loadingPreview : 'Photo'}
              </span>
            </div>
          )}
          {meta?.width && meta?.height && (
            <span
              dir="ltr"
              className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-mono-num text-[#F0F4F8] border border-white/10"
            >
              {meta.width}×{meta.height}
            </span>
          )}
        </div>
      )}

      {/* AUDIO / MUSIC / VOICE PREVIEW */}
      {post.mediaKind === 'audio' && (
        <div className="rounded-xl border border-white/10 bg-[#0B0F14] p-3.5 flex items-center gap-3.5">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-[#141A22] flex items-center justify-center">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt={meta?.title ?? labels.audioFallback}
                className={`w-full h-full object-cover ${isBlurryThumbOnly ? 'blur-xs' : ''}`}
              />
            ) : meta?.isVoice ? (
              <Mic className="w-6 h-6 text-[#2AABEE]" />
            ) : (
              <Music className="w-6 h-6 text-[#2AABEE]" />
            )}
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-[#2AABEE]/90 text-[#090C10] flex items-center justify-center shadow">
                <Play className="w-3.5 h-3.5 fill-current ms-0.5" />
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div dir="auto" className="text-[13px] font-semibold text-[#F0F4F8] truncate">
              {meta?.isVoice
                ? labels.voiceMsg
                : meta?.title || meta?.fileName || labels.audioFallback}
            </div>
            {meta?.performer && (
              <div dir="auto" className="text-xs text-[#8B9BB0] truncate">{meta.performer}</div>
            )}
            <div
              dir="ltr"
              className="flex flex-wrap items-center gap-2 text-[11px] font-mono-num text-[#5EC2F6] pt-0.5"
            >
              {meta?.durationSec ? <span>{formatMediaDuration(meta.durationSec)}</span> : null}
              {meta?.fileSizeBytes ? (
                <>
                  <span className="text-[#586778]">·</span>
                  <span className="text-[#8B9BB0]">{formatFileSize(meta.fileSizeBytes)}</span>
                </>
              ) : null}
              {meta?.mimeType ? (
                <>
                  <span className="text-[#586778]">·</span>
                  <span className="text-[#586778] uppercase">{meta.mimeType.split('/')[1] ?? meta.mimeType}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* VIDEO / GIF PREVIEW */}
      {post.mediaKind === 'video' && (
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0B0F14]">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt={getPostDisplayTitle(post, lang)}
              className={`w-full max-h-64 object-cover bg-[#090C10] ${
                isBlurryThumbOnly ? 'blur-sm scale-[1.02]' : ''
              }`}
            />
          ) : (
            <div className="h-36 flex flex-col items-center justify-center gap-2 text-[#586778]">
              <Film className="w-7 h-7" />
              <span className="text-xs">{meta?.fileName ?? 'Video'}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-11 h-11 rounded-full bg-black/65 border border-white/20 text-white flex items-center justify-center backdrop-blur-sm">
              <Play className="w-5 h-5 fill-current ms-0.5" />
            </div>
          </div>

          <div
            dir="ltr"
            className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-mono-num text-[#F0F4F8]"
          >
            <div className="flex items-center gap-1.5">
              {meta?.isAnimation ? (
                <span className="rounded bg-black/75 px-1.5 py-0.5 border border-white/15">GIF</span>
              ) : meta?.durationSec ? (
                <span className="rounded bg-black/75 px-1.5 py-0.5 border border-white/15">
                  {formatMediaDuration(meta.durationSec)}
                </span>
              ) : null}
              {meta?.width && meta?.height && (
                <span className="rounded bg-black/75 px-1.5 py-0.5 border border-white/15 text-[#8B9BB0]">
                  {meta.width}×{meta.height}
                </span>
              )}
            </div>
            {meta?.fileSizeBytes ? (
              <span className="rounded bg-black/75 px-1.5 py-0.5 border border-white/15 text-[#8B9BB0]">
                {formatFileSize(meta.fileSizeBytes)}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* DOCUMENT / FILE PREVIEW */}
      {post.mediaKind === 'document' && (
        <div className="rounded-xl border border-white/10 bg-[#0B0F14] p-3.5 flex items-center gap-3.5">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt={meta?.fileName ?? labels.documentFallback}
              className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#2AABEE]/12 border border-[#2AABEE]/25 flex items-center justify-center text-[#5EC2F6] shrink-0">
              <FileText className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[13px] font-semibold text-[#F0F4F8] truncate">
              {meta?.fileName || labels.documentFallback}
            </div>
            <div dir="ltr" className="flex items-center gap-2 text-[11px] font-mono-num text-[#8B9BB0]">
              {meta?.fileSizeBytes ? <span>{formatFileSize(meta.fileSizeBytes)}</span> : null}
              {meta?.mimeType ? (
                <>
                  {meta?.fileSizeBytes && <span>·</span>}
                  <span className="truncate">{meta.mimeType}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* POLL / QUIZ PREVIEW */}
      {post.mediaKind === 'poll' && meta?.pollQuestion && (
        <div className="rounded-xl border border-white/10 bg-[#0B0F14] p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <BarChart3 className="w-4 h-4 text-[#5EC2F6] shrink-0 mt-0.5" />
              <div className="text-[13px] font-semibold text-[#F0F4F8] leading-snug">
                {meta.pollQuestion}
              </div>
            </div>
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#8B9BB0] shrink-0">
              {meta.pollIsQuiz ? labels.quizTag : labels.pollTag}
              {meta.pollIsClosed ? ` · ${labels.closedTag}` : ''}
            </span>
          </div>

          {meta.pollOptions && meta.pollOptions.length > 0 && (
            <div className="space-y-2">
              {meta.pollOptions.map((opt, i) => {
                const total = Math.max(
                  1,
                  meta.pollVoters ?? meta.pollOptions!.reduce((s, o) => s + o.voters, 0),
                );
                const pct = Math.round((opt.voters / total) * 100);
                return (
                  <div key={`${i}-${opt.text}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#F0F4F8] truncate">{opt.text}</span>
                      <span dir="ltr" className="font-mono-num text-[#5EC2F6] shrink-0">
                        {pct}% ({opt.voters})
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden" dir="ltr">
                      <div
                        className="h-full rounded-full bg-[#2AABEE]"
                        style={{ width: `${Math.max(3, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {typeof meta.pollVoters === 'number' && (
            <div className="text-[11px] text-[#8B9BB0] font-mono-num">
              {meta.pollVoters.toLocaleString('en-US')} {labels.votesLabel}
            </div>
          )}
        </div>
      )}

      {/* ALBUM GALLERY PREVIEW */}
      {post.isAlbum && (
        <div className="rounded-xl border border-white/10 bg-[#0B0F14] p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[#8B9BB0]">
            <Layers className="w-3.5 h-3.5 text-[#5EC2F6]" />
            <span>
              {post.albumChildren.length} {lang === 'fa' ? 'آیتم در آلبوم' : 'items in album'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {post.albumChildren.map((child, idx) => {
              const fetchedItem = mediaPreview?.items.find((i) => i.messageId === child.id);
              const childThumb = fetchedItem?.previewUrl ?? child.mediaMeta?.thumbUrl;
              const childMeta = fetchedItem?.meta ?? child.mediaMeta;
              return (
                <div
                  key={child.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-[#11161D] flex flex-col items-center justify-center p-2 text-center"
                >
                  {childThumb ? (
                    <img
                      src={childThumb}
                      alt={childMeta?.title || childMeta?.fileName || `Item ${idx + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      {child.mediaKind === 'audio' ? (
                        <Music className="w-5 h-5 text-[#5EC2F6] mb-1" />
                      ) : child.mediaKind === 'video' ? (
                        <Film className="w-5 h-5 text-[#5EC2F6] mb-1" />
                      ) : child.mediaKind === 'document' ? (
                        <FileText className="w-5 h-5 text-[#5EC2F6] mb-1" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[#5EC2F6] mb-1" />
                      )}
                      <span className="text-[10px] text-[#8B9BB0] line-clamp-2 break-all">
                        {childMeta?.title || childMeta?.fileName || child.mediaKind}
                      </span>
                    </>
                  )}
                  <span
                    dir="ltr"
                    className="absolute top-1.5 left-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-mono-num text-[#F0F4F8] border border-white/10"
                  >
                    #{idx + 1} · {child.mediaKind}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEBPAGE PREVIEW CHIP (FOR TEXT POSTS WITH LINK PREVIEW) */}
      {post.mediaKind === 'text' && meta?.webPageUrl && (
        <div className="rounded-xl border border-white/10 bg-[#0B0F14] p-3 flex items-center gap-3">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt={meta.title ?? meta.webPageSite ?? 'Link preview'}
              className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#2AABEE]/12 border border-[#2AABEE]/25 flex items-center justify-center text-[#5EC2F6] shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {meta.webPageSite && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5EC2F6]">
                {meta.webPageSite}
              </div>
            )}
            <div className="text-xs font-medium text-[#F0F4F8] truncate">
              {meta.title || meta.webPageUrl}
            </div>
            <div dir="ltr" className="text-[11px] font-mono-num text-[#8B9BB0] truncate">
              {meta.webPageUrl}
            </div>
          </div>
        </div>
      )}

      {/* CAPTION TEXT (If present) */}
      {post.text.trim().length > 0 && (
        <p
          dir="auto"
          className="text-[13px] leading-relaxed text-[#F0F4F8] whitespace-pre-wrap break-words"
        >
          {post.text}
        </p>
      )}
    </div>
  );
};
