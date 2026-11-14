import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Globe,
  KeyRound,
  Lock,
  Play,
  QrCode,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type {
  ApiCredentials,
  AuthStep,
  LanguageCode,
  NetworkConfig,
  SessionPersistenceMode,
} from '../../types/analytics';
import { getTranslations } from '../../i18n/translations';
import { BrandLogo } from '../common/BrandLogo';
import { PasswordField } from '../common/PasswordField';

interface AuthScreenProps {
  lang: LanguageCode;
  onToggleLang: () => void;
  reduceGlass: boolean;
  network: NetworkConfig;
  onOpenNetworkModal: () => void;
  apiCreds: ApiCredentials;
  onChangeApiCreds: (creds: ApiCredentials) => void;
  persistenceMode: SessionPersistenceMode;
  vaultPin: string;
  onChangePersistence: (mode: SessionPersistenceMode, pin: string) => void;
  savedSessionMeta: { exists: boolean; hasPin: boolean };
  onUnlockSavedSession: (pin?: string) => Promise<void>;
  onDiscardSavedSession: () => Promise<void>;
  authStep: AuthStep;
  authError: string | null;
  forceShowApiBox?: boolean;
  qrUrl: string | null;
  onStartQr: () => Promise<void>;
  onSendCode: (phone: string) => Promise<void>;
  onVerifyCode: (code: string) => Promise<void>;
  onCheckPassword: (password: string) => Promise<void>;
  onResetAuth: () => void;
  onEnterSampleMode: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  lang,
  onToggleLang,
  reduceGlass,
  network,
  onOpenNetworkModal,
  apiCreds,
  onChangeApiCreds,
  persistenceMode,
  vaultPin,
  onChangePersistence,
  savedSessionMeta,
  onUnlockSavedSession,
  onDiscardSavedSession,
  authStep,
  authError,
  forceShowApiBox = false,
  qrUrl,
  onStartQr,
  onSendCode,
  onVerifyCode,
  onCheckPassword,
  onResetAuth,
  onEnterSampleMode,
}) => {
  const t = getTranslations(lang);
  const [loginMethod, setLoginMethod] = useState<'qr' | 'phone'>('qr');
  const [showApiBox, setShowApiBox] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [unlockPinInput, setUnlockPinInput] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const apiIdRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (forceShowApiBox) {
      setShowApiBox(true);
      setTimeout(() => apiIdRef.current?.focus(), 60);
    }
  }, [forceShowApiBox]);

  useEffect(() => {
    if (!qrUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qrUrl, {
      width: 212,
      margin: 2,
      color: { dark: '#0e1621', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  const networkLabel =
    network.mode === 'direct'
      ? t.modeDirect
      : network.mode === 'socks5-bridge'
        ? `${t.modeSocks5} (${network.socks5.host}:${network.socks5.port})`
        : t.modeCfRelay;

  const hasApiCreds = Boolean(apiCreds.apiId && apiCreds.apiHash && apiCreds.apiHash.length >= 16);

  const handleAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`min-h-screen bg-[#0e1621] text-[#f5f7fa] flex flex-col ${reduceGlass ? 'reduce-glass' : ''}`}>
      {/* Minimal Sticky Glass Header */}
      <header className="sticky top-0 z-30 tg-chrome-glass border-b">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={28} />
            <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap shrink-0">
              {t.appName}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenNetworkModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[#7f91a4] hover:text-[#f5f7fa] hover:border-white/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#5eb5f7]" />
              <span>{t.networkSettingsBtn}</span>
            </button>

            <button
              type="button"
              onClick={onToggleLang}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[#f5f7fa] hover:bg-white/[0.08] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.switchLang}
            </button>
          </div>
        </div>
      </header>

      {/* Focused Telegram-Style Centered Sign-In Workspace */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6">
        <div className="w-full max-w-[440px] space-y-3.5">
          {/* Concise Brand & Purpose Intro */}
          <div className="text-center space-y-1 px-2">
            <h1 className="text-xl font-bold tracking-tight text-[#f5f7fa] text-balance">
              {t.authHeadline}
            </h1>
            <p className="text-xs text-[#7f91a4] leading-relaxed">
              {t.zeroBackendBadge}
            </p>
          </div>

          {/* Primary Auth Surface */}
          <div className="tg-panel rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
            {/* Saved Encrypted Session Unlock Panel */}
            {savedSessionMeta.exists && authStep === 'idle' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAction(() => onUnlockSavedSession(unlockPinInput));
                }}
                className="p-4 bg-[#3390ec]/[0.08] space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#5eb5f7]">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.savedSessionFound}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAction(onDiscardSavedSession)}
                    aria-label={t.discardSavedBtn}
                    className="inline-flex items-center gap-1 text-[11px] text-[#e55353] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t.discardSavedBtn}</span>
                  </button>
                </div>

                {savedSessionMeta.hasPin && (
                  <PasswordField
                    id="unlock-vault-pin"
                    value={unlockPinInput}
                    onChange={(e) => setUnlockPinInput(e.target.value)}
                    placeholder={t.vaultPinPlaceholder}
                    aria-label={t.vaultPinLabel}
                    autoFocus
                    autoComplete="current-password"
                    showLabel={t.showPasswordLabel}
                    hideLabel={t.hidePasswordLabel}
                    inputClassName="text-xs font-mono-num"
                  />
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-[#3390ec] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a80d6] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {busy ? '...' : t.unlockSessionBtn}
                </button>
              </form>
            )}

            {/* Transport & API Settings Rows */}
            <div className="divide-y divide-white/[0.06]">
              <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="text-xs text-[#7f91a4] truncate">
                  <span>{t.networkModeLabel}: </span>
                  <span className="text-[#f5f7fa] font-medium">{networkLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenNetworkModal}
                  className="text-xs font-medium text-[#5eb5f7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {lang === 'fa' ? 'تغییر' : 'Configure'}
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowApiBox((v) => !v)}
                  aria-expanded={showApiBox}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[#7f91a4] hover:text-[#f5f7fa] hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <KeyRound className="w-3.5 h-3.5 text-[#5eb5f7] shrink-0" />
                    <span className="truncate">{t.apiCredsTitle}</span>
                    {hasApiCreds && (
                      <span className="text-[11px] text-[#4dcd5e] font-mono-num shrink-0">
                        · #{apiCreds.apiId}
                      </span>
                    )}
                  </span>
                  {showApiBox ? (
                    <ChevronUp className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  )}
                </button>

                {showApiBox && (
                  <div className="px-4 pb-3.5 pt-2 space-y-2.5 bg-[#111923]/60 border-t border-white/[0.06]">
                    <p className="text-[11px] leading-relaxed text-[#7f91a4]">{t.apiCredsHint}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label htmlFor="api-id-input" className="block text-[11px] text-[#7f91a4] mb-1">
                          {t.apiIdLabel}
                        </label>
                        <input
                          ref={apiIdRef}
                          id="api-id-input"
                          type="number"
                          value={apiCreds.apiId || ''}
                          onChange={(e) =>
                            onChangeApiCreds({ ...apiCreds, apiId: Number(e.target.value) || 0 })
                          }
                          placeholder="e.g. 12345678"
                          dir="ltr"
                          className="w-full rounded-lg border border-white/10 bg-[#111923] px-3 py-2 text-xs text-[#f5f7fa] font-mono-num focus:border-[#3390ec] focus:outline-none focus:ring-2 focus:ring-[#3390ec]/20"
                        />
                      </div>
                      <div>
                        <label htmlFor="api-hash-input" className="block text-[11px] text-[#7f91a4] mb-1">
                          {t.apiHashLabel}
                        </label>
                        <PasswordField
                          id="api-hash-input"
                          value={apiCreds.apiHash}
                          onChange={(e) =>
                            onChangeApiCreds({ ...apiCreds, apiHash: e.target.value.trim() })
                          }
                          placeholder="32-char hex api_hash"
                          autoComplete="off"
                          showLabel={t.showPasswordLabel}
                          hideLabel={t.hidePasswordLabel}
                          inputClassName="text-xs font-mono-num"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Login Method Body */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#0e1621] p-1 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('qr');
                    onResetAuth();
                  }}
                  className={`flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    loginMethod === 'qr'
                      ? 'bg-[#202b36] text-[#f5f7fa]'
                      : 'text-[#7f91a4] hover:text-[#f5f7fa]'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{t.tabQrLogin}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('phone');
                    onResetAuth();
                  }}
                  className={`flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    loginMethod === 'phone'
                      ? 'bg-[#202b36] text-[#f5f7fa]'
                      : 'text-[#7f91a4] hover:text-[#f5f7fa]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{t.tabPhoneLogin}</span>
                </button>
              </div>

              {loginMethod === 'qr' ? (
                <div className="space-y-3">
                  {authStep === 'password_needed' ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAction(() => onCheckPassword(passwordInput));
                      }}
                      className="space-y-3"
                    >
                      <label htmlFor="qr-2fa-pwd" className="block text-xs font-medium text-[#7f91a4]">
                        {t.twoFaLabel}
                      </label>
                      <PasswordField
                        id="qr-2fa-pwd"
                        required
                        autoFocus
                        autoComplete="current-password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder={t.twoFaPlaceholder}
                        showLabel={t.showPasswordLabel}
                        hideLabel={t.hidePasswordLabel}
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-lg bg-[#3390ec] py-2.5 text-xs font-semibold text-white hover:bg-[#2a80d6] disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {busy ? '...' : t.submit2FaBtn}
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-col items-center text-center space-y-2.5">
                      {qrDataUrl ? (
                        <div className="rounded-xl bg-white p-2">
                          <img
                            src={qrDataUrl}
                            alt="Telegram Login QR Code"
                            className="w-44 h-44 block"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div
                          className={`w-44 rounded-xl border border-dashed border-white/15 bg-[#111923] flex flex-col items-center justify-center p-4 gap-2.5 ${
                            savedSessionMeta.exists ? 'h-32' : 'h-44'
                          }`}
                        >
                          <QrCode className="w-8 h-8 text-[#5eb5f7]" />
                          <button
                            type="button"
                            disabled={busy || authStep === 'connecting'}
                            onClick={() => handleAction(onStartQr)}
                            className="rounded-lg bg-[#3390ec] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2a80d6] disabled:opacity-60 transition-colors cursor-pointer"
                          >
                            {busy || authStep === 'connecting' ? '...' : t.generateQrBtn}
                          </button>
                        </div>
                      )}

                      <p className="text-xs text-[#7f91a4] max-w-xs leading-relaxed">
                        {authStep === 'qr_scanned' ? t.qrScannedFinishing : t.qrWaitingScan}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {authStep === 'idle' || authStep === 'connecting' ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAction(() => onSendCode(phoneInput));
                      }}
                      className="space-y-3"
                    >
                      <label htmlFor="phone-input" className="block text-xs font-medium text-[#7f91a4]">
                        {t.phoneLabel}
                      </label>
                      <input
                        id="phone-input"
                        type="tel"
                        required
                        autoFocus
                        autoComplete="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder={t.phonePlaceholder}
                        dir="ltr"
                        className="w-full rounded-lg border border-white/10 bg-[#111923] px-3.5 py-2 text-sm text-[#f5f7fa] font-mono-num focus:border-[#3390ec] focus:outline-none focus:ring-2 focus:ring-[#3390ec]/20"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-lg bg-[#3390ec] py-2.5 text-xs font-semibold text-white hover:bg-[#2a80d6] disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {busy ? '...' : t.sendCodeBtn}
                      </button>
                    </form>
                  ) : authStep === 'code_sent' ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAction(() => onVerifyCode(codeInput));
                      }}
                      className="space-y-3"
                    >
                      <label htmlFor="otp-input" className="block text-xs font-medium text-[#7f91a4]">
                        {t.otpLabel}
                      </label>
                      <input
                        id="otp-input"
                        type="text"
                        inputMode="numeric"
                        required
                        autoFocus
                        autoComplete="one-time-code"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value)}
                        placeholder="12345"
                        dir="ltr"
                        className="w-full rounded-lg border border-white/10 bg-[#111923] px-3.5 py-2 text-sm text-[#f5f7fa] font-mono-num tracking-widest focus:border-[#3390ec] focus:outline-none focus:ring-2 focus:ring-[#3390ec]/20"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-lg bg-[#3390ec] py-2.5 text-xs font-semibold text-white hover:bg-[#2a80d6] disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {busy ? '...' : t.verifyCodeBtn}
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAction(() => onCheckPassword(passwordInput));
                      }}
                      className="space-y-3"
                    >
                      <label htmlFor="phone-2fa-pwd" className="block text-xs font-medium text-[#7f91a4]">
                        {t.twoFaLabel}
                      </label>
                      <PasswordField
                        id="phone-2fa-pwd"
                        required
                        autoFocus
                        autoComplete="current-password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder={t.twoFaPlaceholder}
                        showLabel={t.showPasswordLabel}
                        hideLabel={t.hidePasswordLabel}
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-lg bg-[#3390ec] py-2.5 text-xs font-semibold text-white hover:bg-[#2a80d6] disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {busy ? '...' : t.submit2FaBtn}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {authError && (
                <div
                  role="alert"
                  className="rounded-lg border border-[#e55353]/40 bg-[#e55353]/10 px-3 py-2 text-xs text-[#fca5a5] leading-relaxed"
                >
                  {authError}
                </div>
              )}
            </div>

            {/* Session Persistence Consent Footer Row */}
            <div className="px-4 sm:px-5 py-3.5 bg-[#111923]/40 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={persistenceMode === 'vault'}
                  onChange={(e) =>
                    onChangePersistence(e.target.checked ? 'vault' : 'ephemeral', vaultPin)
                  }
                  className="mt-0.5 rounded border-white/20 accent-[#3390ec] cursor-pointer"
                />
                <span>
                  <span className="block text-xs font-medium text-[#f5f7fa]">
                    {t.vaultConsentLabel}
                  </span>
                  <span className="block text-[11px] text-[#7f91a4] mt-0.5">
                    {t.vaultConsentSub}
                  </span>
                </span>
              </label>

              {persistenceMode === 'vault' && (
                <div>
                  <label htmlFor="vault-pin" className="block text-[11px] text-[#7f91a4] mb-1">
                    {t.vaultPinLabel}
                  </label>
                  <PasswordField
                    id="vault-pin"
                    value={vaultPin}
                    onChange={(e) => onChangePersistence('vault', e.target.value)}
                    placeholder={t.vaultPinPlaceholder}
                    autoComplete="new-password"
                    showLabel={t.showPasswordLabel}
                    hideLabel={t.hidePasswordLabel}
                    inputClassName="text-xs font-mono-num"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Quiet Demo Workspace Trigger */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={onEnterSampleMode}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#17212b] px-4 py-2 text-xs font-medium text-[#5eb5f7] hover:bg-[#1e2c3a] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{t.exploreSampleBtn}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
