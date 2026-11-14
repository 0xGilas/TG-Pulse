import React, { useEffect, useState } from 'react';
import { Check, Copy, Globe, Shield, Terminal, X } from 'lucide-react';
import type { LanguageCode, NetworkConfig, NetworkMode } from '../../types/analytics';
import { getTranslations } from '../../i18n/translations';
import { testBridgeReachability } from '../../services/telegramBridge';
import { PasswordField } from '../common/PasswordField';

interface NetworkModalProps {
  open: boolean;
  config: NetworkConfig;
  lang: LanguageCode;
  onClose: () => void;
  onSave: (next: NetworkConfig) => void;
}

export const NetworkModal: React.FC<NetworkModalProps> = ({
  open,
  config,
  lang,
  onClose,
  onSave,
}) => {
  const t = getTranslations(lang);
  const [draft, setDraft] = useState<NetworkConfig>(config);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(config);
      setTestResult(null);
    }
  }, [open, config]);

  if (!open) return null;

  const setMode = (mode: NetworkMode) => {
    setDraft((prev) => ({ ...prev, mode }));
    setTestResult(null);
  };

  const handleTestBridge = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testBridgeReachability(draft.socks5.bridgeUrl);
    setTestResult(res);
    setTesting(false);
  };

  const handleCopyCommand = async () => {
    const cmd = 'cd packages/socks-bridge && npm install && node index.mjs';
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="network-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-xl tg-sheet-glass rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-[#5eb5f7]" />
            <h2 id="network-modal-title" className="text-sm font-semibold text-[#f5f7fa]">
              {t.netModalTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeBtn}
            className="rounded-lg p-1.5 text-[#7f91a4] hover:bg-white/10 hover:text-[#f5f7fa] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <p className="text-xs leading-relaxed text-[#7f91a4]">{t.netModalDesc}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 rounded-lg bg-[#0e1621] p-1 border border-white/[0.06]">
            {(
              [
                { id: 'direct', label: t.modeDirect },
                { id: 'socks5-bridge', label: t.modeSocks5 },
                { id: 'cf-relay', label: t.modeCfRelay },
              ] as const
            ).map((opt) => {
              const active = draft.mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`rounded-md px-3 py-2 text-xs font-medium text-start transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#3390ec] text-white'
                      : 'text-[#7f91a4] hover:text-[#f5f7fa]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {draft.mode === 'socks5-bridge' && (
            <div className="space-y-3 pt-1 border-t border-white/[0.06]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="sm:col-span-2">
                  <label htmlFor="socks-host" className="block text-xs font-medium text-[#7f91a4] mb-1">
                    {t.socksHost}
                  </label>
                  <input
                    id="socks-host"
                    type="text"
                    value={draft.socks5.host}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, socks5: { ...p.socks5, host: e.target.value } }))
                    }
                    placeholder="127.0.0.1"
                    dir="ltr"
                    className="w-full rounded-lg border border-white/10 bg-[#111923] px-3 py-2 text-sm text-[#f5f7fa] font-mono-num focus:border-[#3390ec] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="socks-port" className="block text-xs font-medium text-[#7f91a4] mb-1">
                    {t.socksPort}
                  </label>
                  <input
                    id="socks-port"
                    type="number"
                    value={draft.socks5.port}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        socks5: { ...p.socks5, port: Number(e.target.value) || 1080 },
                      }))
                    }
                    placeholder="1080"
                    dir="ltr"
                    className="w-full rounded-lg border border-white/10 bg-[#111923] px-3 py-2 text-sm text-[#f5f7fa] font-mono-num focus:border-[#3390ec] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="socks-user" className="block text-xs font-medium text-[#7f91a4] mb-1">
                    {t.socksUser}
                  </label>
                  <input
                    id="socks-user"
                    type="text"
                    value={draft.socks5.username}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, socks5: { ...p.socks5, username: e.target.value } }))
                    }
                    autoComplete="off"
                    dir="ltr"
                    className="w-full rounded-lg border border-white/10 bg-[#111923] px-3 py-2 text-sm text-[#f5f7fa] focus:border-[#3390ec] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="socks-pass" className="block text-xs font-medium text-[#7f91a4] mb-1">
                    {t.socksPass}
                  </label>
                  <PasswordField
                    id="socks-pass"
                    value={draft.socks5.password}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, socks5: { ...p.socks5, password: e.target.value } }))
                    }
                    autoComplete="off"
                    showLabel={t.showPasswordLabel}
                    hideLabel={t.hidePasswordLabel}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bridge-url" className="block text-xs font-medium text-[#7f91a4] mb-1">
                  {t.bridgeUrl}
                </label>
                <input
                  id="bridge-url"
                  type="text"
                  value={draft.socks5.bridgeUrl}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, socks5: { ...p.socks5, bridgeUrl: e.target.value } }))
                  }
                  placeholder="ws://127.0.0.1:8787"
                  dir="ltr"
                  className="w-full rounded-lg border border-white/10 bg-[#111923] px-3 py-2 text-sm text-[#f5f7fa] font-mono-num focus:border-[#3390ec] focus:outline-none"
                />
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-[#111923] p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7f91a4]">
                    <Terminal className="w-3.5 h-3.5 text-[#5eb5f7]" />
                    {t.bridgeCommandTitle}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="inline-flex items-center gap-1 text-xs text-[#5eb5f7] hover:underline cursor-pointer"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCmd ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <code dir="ltr" className="block text-xs text-[#f5f7fa] font-mono-num break-all">
                  cd packages/socks-bridge && npm install && node index.mjs
                </code>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestBridge}
                  disabled={testing}
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs font-medium text-[#f5f7fa] hover:bg-white/[0.09] disabled:opacity-60 cursor-pointer"
                >
                  {testing ? '...' : t.testBridgeBtn}
                </button>
                {testResult && (
                  <span className={`text-xs ${testResult.ok ? 'text-[#4dcd5e]' : 'text-[#e55353]'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>
            </div>
          )}

          {draft.mode === 'cf-relay' && (
            <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
              <label htmlFor="cf-relay-url" className="block text-xs font-medium text-[#7f91a4]">
                {t.cfRelayUrl}
              </label>
              <input
                id="cf-relay-url"
                type="url"
                value={draft.cfRelayUrl}
                onChange={(e) => setDraft((p) => ({ ...p, cfRelayUrl: e.target.value }))}
                placeholder="wss://tg-relay.your-subdomain.workers.dev"
                dir="ltr"
                className="w-full rounded-lg border border-white/10 bg-[#111923] px-3 py-2 text-sm text-[#f5f7fa] font-mono-num focus:border-[#3390ec] focus:outline-none"
              />
              <p className="text-xs text-[#7f91a4]">
                Deploy <code className="font-mono-num text-[#5eb5f7]">packages/cf-worker-relay/worker.js</code> to your Cloudflare account.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2.5 pt-3 border-t border-white/[0.06] text-xs text-[#7f91a4]">
            <Shield className="w-4 h-4 text-[#4dcd5e] shrink-0 mt-0.5" />
            <span>
              {lang === 'fa'
                ? 'رمزنگاری MTProto به‌صورت سرتاسری داخل Web Worker مرورگر انجام می‌شود. پروکسی و رله فقط بسته‌های رمزنگاری‌شده را عبور می‌دهند.'
                : 'MTProto encryption happens end-to-end inside your browser Web Worker. Proxies and relays only forward encrypted packets.'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-3 bg-[#111923]/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs font-medium text-[#7f91a4] hover:text-[#f5f7fa] hover:bg-white/[0.05] cursor-pointer"
          >
            {t.closeBtn}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[#3390ec] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#2a80d6] transition-colors cursor-pointer"
          >
            {t.saveNetworkBtn}
          </button>
        </div>
      </form>
    </div>
  );
};
