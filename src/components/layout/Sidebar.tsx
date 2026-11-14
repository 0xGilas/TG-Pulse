import React from 'react';
import { Lock, LogOut, Radio, Shield, Sparkles, X } from 'lucide-react';
import type {
  ChannelSummary,
  LanguageCode,
  SessionPersistenceMode,
} from '../../types/analytics';
import { getTranslations } from '../../i18n/translations';
import { formatCompactNumber } from '../../utils/analyticsMath';
import { BrandLogo } from '../common/BrandLogo';

interface SidebarProps {
  lang: LanguageCode;
  channels: ChannelSummary[];
  activeChannelId: number | null;
  onSelectChannel: (channelId: number) => void;
  isSampleMode: boolean;
  persistenceMode: SessionPersistenceMode;
  reduceGlass: boolean;
  onToggleReduceGlass: () => void;
  onToggleLang: () => void;
  onOpenVaultModal?: () => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  lang,
  channels,
  activeChannelId,
  onSelectChannel,
  isSampleMode,
  persistenceMode,
  reduceGlass,
  onToggleReduceGlass,
  onToggleLang,
  onOpenVaultModal,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  const t = getTranslations(lang);

  const sidebarBody = (
    <div className="flex flex-col h-full bg-[#17212b] border-e border-white/[0.06] w-[264px] shrink-0">
      {/* Brand Row */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandLogo size={28} />
          <span className="font-semibold text-[15px] text-[#f5f7fa] truncate">{t.appName}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleLang}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-[#7f91a4] hover:text-[#f5f7fa] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            {t.switchLang}
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={t.closeBtn}
            className="lg:hidden rounded-lg p-1 text-[#7f91a4] hover:text-[#f5f7fa] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode & Vault Status Row */}
      <div className="px-4 py-2.5 border-b border-white/[0.06] bg-[#111923]/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-[#7f91a4] min-w-0">
          {isSampleMode ? (
            <>
              <Radio className="w-3.5 h-3.5 text-[#5eb5f7] shrink-0" />
              <span className="truncate">{t.sampleModeLabel}</span>
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5 text-[#4dcd5e] shrink-0" />
              <span className="truncate">
                {persistenceMode === 'vault' ? t.sessionVault : t.sessionEphemeral}
              </span>
            </>
          )}
        </div>
        {!isSampleMode && persistenceMode === 'ephemeral' && onOpenVaultModal && (
          <button
            type="button"
            onClick={onOpenVaultModal}
            title={t.saveVaultPostLoginBtn}
            className="inline-flex items-center gap-1 text-[11px] text-[#5eb5f7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Lock className="w-3 h-3" />
            <span>{lang === 'fa' ? 'ذخیره' : 'Save'}</span>
          </button>
        )}
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="px-2.5 py-1.5 text-[11px] font-medium text-[#5d6f82]">
          {t.channelsHeader}
        </div>

        {channels.length === 0 ? (
          <div className="px-2.5 py-4 text-xs text-[#7f91a4]">{t.noChannels}</div>
        ) : (
          channels.map((ch) => {
            const active = ch.id === activeChannelId;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  onSelectChannel(ch.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#2b5278]/55 text-[#f5f7fa]'
                    : 'text-[#7f91a4] hover:bg-white/[0.04] hover:text-[#f5f7fa]'
                }`}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: ch.avatarColor }}
                >
                  {ch.title.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold truncate text-[#f5f7fa]">
                    {ch.title}
                  </div>
                  <div className="text-[11px] text-[#7f91a4] flex items-center gap-1.5 font-mono-num truncate">
                    <span>
                      {formatCompactNumber(ch.membersCount)} {t.membersLabel}
                    </span>
                    {ch.username && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span dir="ltr" className="truncate inline-block">
                          @{ch.username}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-3 border-t border-white/[0.06] space-y-1.5">
        <button
          type="button"
          onClick={onToggleReduceGlass}
          aria-pressed={reduceGlass}
          className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
            reduceGlass
              ? 'bg-[#3390ec]/15 text-[#5eb5f7]'
              : 'text-[#7f91a4] hover:bg-white/[0.04] hover:text-[#f5f7fa]'
          }`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t.reduceGlassLabel}</span>
          </span>
          <span className="font-mono-num text-[10px] opacity-80">
            {reduceGlass ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-[#111923] px-3 py-2 text-xs font-medium text-[#e55353] hover:bg-[#e55353]/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t.logoutWipeBtn}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-screen sticky top-0">{sidebarBody}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full">{sidebarBody}</aside>
        </div>
      )}
    </>
  );
};
