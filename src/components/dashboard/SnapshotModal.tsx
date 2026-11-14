import React, { useRef, useState } from 'react';
import { Camera, Download, FileSpreadsheet, Lock, Trash2, Upload, X } from 'lucide-react';
import type {
  ChannelAnalyticsBundle,
  ChannelSnapshot,
  LanguageCode,
} from '../../types/analytics';
import { getTranslations } from '../../i18n/translations';
import { buildSnapshotFromPosts, exportPostsToCsv } from '../../utils/analyticsMath';
import { PasswordField } from '../common/PasswordField';

interface SnapshotModalProps {
  open: boolean;
  lang: LanguageCode;
  bundle: ChannelAnalyticsBundle | null;
  isSampleMode: boolean;
  onClose: () => void;
  onCaptureSnapshot: () => Promise<void>;
  onImportSnapshot: (snapshot: ChannelSnapshot) => Promise<void>;
  onSaveSessionToVault?: (pin: string) => Promise<void>;
  onWipeVault: () => Promise<void>;
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const SnapshotModal: React.FC<SnapshotModalProps> = ({
  open,
  lang,
  bundle,
  isSampleMode,
  onClose,
  onCaptureSnapshot,
  onImportSnapshot,
  onSaveSessionToVault,
  onWipeVault,
}) => {
  const t = getTranslations(lang);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [vaultPinInput, setVaultPinInput] = useState('');
  const [savingVault, setSavingVault] = useState(false);

  if (!open || !bundle) return null;

  const handleDownloadJson = () => {
    const snap = buildSnapshotFromPosts(
      bundle.channel.id,
      bundle.channel.membersCount,
      bundle.posts,
    );
    triggerDownload(
      `telescope-snapshot-${bundle.channel.id}.json`,
      JSON.stringify(snap, null, 2),
      'application/json',
    );
    setErrorMsg(null);
    setStatusMsg(lang === 'fa' ? 'فایل اسنپ‌شات دانلود شد.' : 'Snapshot JSON downloaded.');
  };

  const handleExportCsv = () => {
    const csv = exportPostsToCsv(bundle.posts);
    triggerDownload(
      `telescope-posts-${bundle.channel.id}.csv`,
      csv,
      'text/csv;charset=utf-8',
    );
    setErrorMsg(null);
    setStatusMsg(lang === 'fa' ? 'خروجی CSV آماده و دانلود شد.' : 'CSV exported.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ChannelSnapshot;
      if (!parsed || typeof parsed.channelId !== 'number' || !parsed.posts) {
        throw new Error('Invalid snapshot JSON structure');
      }
      await onImportSnapshot(parsed);
      setErrorMsg(null);
      setStatusMsg(
        lang === 'fa'
          ? 'اسنپ‌شات با موفقیت مقایسه و اعمال شد.'
          : 'Snapshot imported and deltas recalculated.',
      );
    } catch (err) {
      setStatusMsg(null);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse snapshot JSON');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveSessionToVault) return;
    setSavingVault(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await onSaveSessionToVault(vaultPinInput);
      setVaultPinInput('');
      setStatusMsg(t.vaultSavedSuccess);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save encrypted session.');
    } finally {
      setSavingVault(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg tg-sheet-glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08]">
          <h2 id="snapshot-modal-title" className="text-sm font-semibold text-[#f5f7fa]">
            {t.snapshotModalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeBtn}
            className="rounded-lg p-1.5 text-[#7f91a4] hover:bg-white/10 hover:text-[#f5f7fa] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <p className="text-xs leading-relaxed text-[#7f91a4]">{t.snapshotModalDesc}</p>

          {bundle.lastSnapshotAt && (
            <div className="text-xs text-[#7f91a4] font-mono-num pb-2 border-b border-white/[0.06]">
              Last baseline:{' '}
              <span dir="ltr" className="text-[#f5f7fa]">
                {new Date(bundle.lastSnapshotAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={async () => {
                await onCaptureSnapshot();
                setErrorMsg(null);
                setStatusMsg(
                  lang === 'fa' ? 'اسنپ‌شات جدید در مرورگر ثبت شد.' : 'Snapshot saved locally.',
                );
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#3390ec] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2a80d6] cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{t.takeSnapshotBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#111923] px-3.5 py-2 text-xs font-medium text-[#f5f7fa] hover:bg-[#1e2c3a] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#5eb5f7]" />
              <span>{t.downloadSnapshotJson}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#111923] px-3.5 py-2 text-xs font-medium text-[#f5f7fa] hover:bg-[#1e2c3a] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#4dcd5e]" />
              <span>{t.importSnapshotJson}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#111923] px-3.5 py-2 text-xs font-medium text-[#f5f7fa] hover:bg-[#1e2c3a] cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#f5a623]" />
              <span>{t.exportCsvBtn}</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Post-Login Encrypted Session Save / PIN Update */}
          {!isSampleMode && onSaveSessionToVault && (
            <form
              onSubmit={handleSaveVault}
              className="pt-3.5 border-t border-white/[0.08] space-y-2.5"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-[#5eb5f7]">
                <Lock className="w-3.5 h-3.5" />
                <span>{t.saveVaultPostLoginBtn}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <PasswordField
                  id="post-login-vault-pin"
                  value={vaultPinInput}
                  onChange={(e) => setVaultPinInput(e.target.value)}
                  placeholder={t.vaultPinPlaceholder}
                  aria-label={t.vaultPinLabel}
                  autoComplete="new-password"
                  showLabel={t.showPasswordLabel}
                  hideLabel={t.hidePasswordLabel}
                  className="flex-1"
                  inputClassName="text-xs font-mono-num"
                />
                <button
                  type="submit"
                  disabled={savingVault}
                  className="rounded-lg bg-[#3390ec] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a80d6] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {savingVault ? '...' : lang === 'fa' ? 'ذخیره در گاوصندوق' : 'Lock & Save'}
                </button>
              </div>
            </form>
          )}

          {statusMsg && (
            <div className="rounded-lg border border-[#4dcd5e]/35 bg-[#4dcd5e]/10 px-3 py-2 text-xs text-[#4dcd5e]">
              {statusMsg}
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-[#e55353]/35 bg-[#e55353]/10 px-3 py-2 text-xs text-[#fca5a5]">
              {errorMsg}
            </div>
          )}

          <div className="pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={async () => {
                await onWipeVault();
                setErrorMsg(null);
                setStatusMsg(
                  lang === 'fa' ? 'کل داده‌های مرورگر پاکسازی شد.' : 'All browser vault data wiped.',
                );
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#e55353] hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.wipeVaultBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
