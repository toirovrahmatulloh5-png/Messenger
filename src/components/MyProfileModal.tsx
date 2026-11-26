import { useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Globe,
  LogOut,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { LANG_LABELS, TRANSLATIONS, type Lang } from '../i18n.ts';
import type { PublicUser } from '../types.ts';
import { AVATAR_PALETTE, formatMemberSince, resizeAvatarImage } from '../utils/format.ts';
import { Avatar } from './Avatar.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface MyProfileModalProps {
  user: PublicUser;
  authKey: string;
  lang: Lang;
  onChangeLang: (lang: Lang) => void;
  onClose: () => void;
  onUpdated: (user: PublicUser, previousUsername: string) => void;
  onKeyRotated: (newKey: string) => void;
  onLogout: () => void;
}

export function MyProfileModal({
  user,
  authKey,
  lang,
  onChangeLang,
  onClose,
  onUpdated,
  onKeyRotated,
  onLogout,
}: MyProfileModalProps) {
  const t = TRANSLATIONS[lang];
  const [name, setName] = useState(user.name);
  const [surname, setSurname] = useState(user.surname);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [avatar, setAvatar] = useState(user.avatar);
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);

  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const maskedKey = authKey.replace(/^([A-Z0-9-]+)-([A-Z0-9]{4})$/, '••••-••••-••••-••••-••••-$2');

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const dataUrl = await resizeAvatarImage(file, lang);
      setAvatar(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.photoReadError);
    } finally {
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSavedMsg('');
    setSaving(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authKey}`,
        },
        body: JSON.stringify({
          name,
          surname,
          username,
          bio,
          avatar,
          avatarColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.networkError);
        return;
      }
      onUpdated(data.user, data.previousUsername);
      setSavedMsg(t.profileUpdated);
      setTimeout(() => setSavedMsg(''), 2500);
    } catch {
      setError(t.networkError);
    } finally {
      setSaving(false);
    }
  };

  const handleRotateKey = async () => {
    setError('');
    setRotating(true);
    try {
      const res = await fetch('/api/me/rotate-key', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authKey}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.networkError);
        return;
      }
      onKeyRotated(data.key);
      setConfirmRotate(false);
      setShowKey(true);
      setSavedMsg(t.newKeyCreated);
    } catch {
      setError(t.networkError);
    } finally {
      setRotating(false);
    }
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(authKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadKey = () => {
    const content = [
      `${t.appName} — ${t.yourAccessKey}`,
      `${t.firstName}: ${name} ${surname}`.trim(),
      `@${username}`,
      `${authKey}`,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freesim-key-${username}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-y-auto overscroll-contain bg-[#151E27] border border-white/[0.08] rounded-2xl p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">{t.myProfile}</h2>
            <p className="text-xs text-[#8FA0B2] mt-0.5">
              {t.memberSince} {formatMemberSince(user.created, lang)} · {t.noSimNote}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.cancel}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interface Language Switcher */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-3 rounded-xl bg-[#0E141B] border border-white/[0.06]">
          <div className="flex items-center gap-2 text-sm text-[#EBF0F5] shrink-0">
            <Globe className="w-4 h-4 text-[#6AB2F2]" />
            <span>{t.languageLabel}</span>
          </div>
          <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-0.5 rounded-lg bg-[#151E27] border border-white/[0.06] w-full sm:w-auto">
            {(['ru', 'en', 'uz'] as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onChangeLang(code)}
                className={`px-2 py-1.5 sm:py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap text-center ${
                  lang === code ? 'bg-[#5BA4E5] text-white' : 'text-[#8FA0B2] hover:text-white'
                }`}
              >
                {LANG_LABELS[code]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex justify-end empty:hidden">
          <PWAInstallButton lang={lang} alwaysShowGuideFallback />
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-5">
          {/* Avatar + color picker */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative self-start">
              <Avatar
                user={{ name, surname, avatar, avatarColor, online: true }}
                size="xl"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={t.choosePhoto}
                aria-label={t.choosePhoto}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#5BA4E5] hover:bg-[#4B95D8] text-white flex items-center justify-center border-2 border-[#151E27] transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <div className="flex-1 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-[#1D2733] hover:bg-[#243140] text-xs font-medium text-[#EBF0F5] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t.choosePhoto}
                </button>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar('')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D2733] hover:bg-[#E55353]/15 text-xs font-medium text-[#FF8A8A] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.removePhoto}</span>
                  </button>
                )}
              </div>

              <div>
                <div className="text-xs text-[#8FA0B2] mb-1.5">{t.avatarColor}</div>
                <div className="flex items-center gap-2">
                  {AVATAR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarColor(color)}
                      aria-label={color}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                        avatarColor === color
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#151E27] scale-110'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#E55353]/12 border border-[#E55353]/30 text-sm text-[#FF8A8A]">
              {error}
            </div>
          )}

          {savedMsg && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#34C77B]/12 border border-[#34C77B]/30 text-sm text-[#6FE3A3]">
              {savedMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#8FA0B2] mb-1.5">
                {t.firstName}
              </label>
              <input
                type="text"
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#5BA4E5]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8FA0B2] mb-1.5">
                {t.lastNameOptional}
              </label>
              <input
                type="text"
                maxLength={40}
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder={t.lastNamePlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8FA0B2] mb-1.5">{t.username}</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#6AB2F2]">
                @
              </span>
              <input
                type="text"
                required
                maxLength={20}
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  )
                }
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#5BA4E5]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#8FA0B2]">{t.bioLabel}</label>
              <span className="text-xs font-mono-nums text-[#6B7C8E]">{bio.length}/160</span>
            </div>
            <textarea
              rows={2}
              maxLength={160}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t.bioEditPlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white placeholder-[#5B6B7C] resize-none focus:outline-none focus:border-[#5BA4E5]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#8FA0B2] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] disabled:opacity-50 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              {saving ? t.saving : t.save}
            </button>
          </div>
        </form>

        {/* SIM-less Access Key management */}
        <div className="mt-6 pt-5 border-t border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">{t.accessKeySection}</span>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-[#6AB2F2] hover:underline cursor-pointer"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showKey ? t.hide : t.show}</span>
            </button>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.06] font-mono-nums text-xs sm:text-sm text-[#D1DCE6] break-all">
            {showKey ? authKey : maskedKey}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyKey}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1D2733] hover:bg-[#243140] text-xs font-medium text-[#EBF0F5] transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedKey ? (
                <Check className="w-3.5 h-3.5 text-[#34C77B]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey ? t.copied : t.copy}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadKey}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1D2733] hover:bg-[#243140] text-xs font-medium text-[#EBF0F5] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.downloadTxt}</span>
            </button>

            {!confirmRotate ? (
              <button
                type="button"
                onClick={() => setConfirmRotate(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1D2733] hover:bg-[#243140] text-xs font-medium text-[#EBF0F5] transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.rotateKey}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={rotating}
                onClick={handleRotateKey}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#D97706]/20 hover:bg-[#D97706]/30 text-xs font-medium text-[#FBBF24] transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{rotating ? t.rotating : t.confirmRotate}</span>
              </button>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#E55353]/10 hover:bg-[#E55353]/20 text-sm font-medium text-[#FF8A8A] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.logout}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
