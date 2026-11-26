import { useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Download,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { TRANSLATIONS, type Lang } from '../i18n.ts';
import type { PublicUser } from '../types.ts';
import { AVATAR_PALETTE, resizeAvatarImage } from '../utils/format.ts';
import { Avatar } from './Avatar.tsx';

interface AuthScreenProps {
  lang: Lang;
  onChangeLang: (lang: Lang) => void;
  onAuthenticated: (key: string, user: PublicUser) => void;
}

export function AuthScreen({ lang, onChangeLang, onAuthenticated }: AuthScreenProps) {
  const t = TRANSLATIONS[lang];
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_PALETTE[0]);
  const [loginKey, setLoginKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [createdSession, setCreatedSession] = useState<{ key: string; user: PublicUser } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, surname, username, bio, avatar, avatarColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.networkError);
        return;
      }
      setCreatedSession({ key: data.key, user: data.user });
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: loginKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.networkError);
        return;
      }
      onAuthenticated(data.key, data.user);
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = async () => {
    if (!createdSession) return;
    try {
      await navigator.clipboard.writeText(createdSession.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const handleDownloadBackup = () => {
    if (!createdSession) return;
    const content = [
      `${t.appName} — ${t.yourAccessKey}`,
      `${t.firstName}: ${createdSession.user.name} ${createdSession.user.surname}`.trim(),
      `@${createdSession.user.username}`,
      `${createdSession.key}`,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `efir-key-${createdSession.user.username}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const langSwitcher = (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0E141B] border border-white/[0.06]">
      {(['ru', 'en', 'uz'] as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChangeLang(code)}
          className={`px-2 py-1 rounded-md text-xs font-medium uppercase transition-colors cursor-pointer ${
            lang === code ? 'bg-[#1D2733] text-white' : 'text-[#8FA0B2] hover:text-white'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );

  if (createdSession) {
    return (
      <div className="min-h-screen w-full bg-[#0E141B] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#151E27] border border-white/[0.08] rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-5">
            <div className="w-11 h-11 rounded-xl bg-[#34C77B]/15 text-[#34C77B] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            {langSwitcher}
          </div>

          <h1 className="font-display text-xl font-semibold text-white tracking-tight">
            {t.accountCreatedTitle} · @{createdSession.user.username}
          </h1>
          <p className="mt-2 text-sm text-[#8FA0B2] leading-relaxed">{t.accountCreatedDesc}</p>

          <div className="mt-5 p-4 rounded-xl bg-[#0E141B] border border-white/[0.08]">
            <div className="text-xs text-[#8FA0B2] mb-1.5">{t.yourAccessKey}</div>
            <div className="font-mono-nums text-sm sm:text-base font-medium text-[#6AB2F2] break-all select-all tracking-wider">
              {createdSession.key}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyKey}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D2733] hover:bg-[#243140] text-sm font-medium text-[#EBF0F5] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-[#34C77B]" /> : <Copy className="w-4 h-4" />}
              <span className="whitespace-nowrap">{copied ? t.copied : t.copy}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D2733] hover:bg-[#243140] text-sm font-medium text-[#EBF0F5] transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="whitespace-nowrap">{t.downloadTxt}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onAuthenticated(createdSession.key, createdSession.user)}
            className="mt-5 w-full py-3 px-4 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            {t.goToChats}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0E141B] flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-[460px] bg-[#151E27] border border-white/[0.08] rounded-2xl p-6 sm:p-8 my-4">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-white tracking-tight">
              {t.appName}
            </h1>
            <p className="mt-1 text-sm text-[#8FA0B2]">{t.tagline}</p>
          </div>
          {langSwitcher}
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-[#0E141B] rounded-xl mb-6 border border-white/[0.05]">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'register'
                ? 'bg-[#1D2733] text-white'
                : 'text-[#8FA0B2] hover:text-[#EBF0F5]'
            }`}
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>{t.register}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'login'
                ? 'bg-[#1D2733] text-white'
                : 'text-[#8FA0B2] hover:text-[#EBF0F5]'
            }`}
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            <span>{t.loginByKey}</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#E55353]/12 border border-[#E55353]/30 text-sm text-[#FF8A8A]">
            {error}
          </div>
        )}

        {mode === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Optional Avatar Picker */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-[#0E141B]/70 border border-white/[0.06]">
              <div className="relative shrink-0">
                <Avatar
                  user={{
                    name: name || t.firstNamePlaceholder,
                    surname,
                    avatar,
                    avatarColor,
                    online: false,
                  }}
                  size="lg"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t.choosePhoto}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#5BA4E5] hover:bg-[#4B95D8] text-white flex items-center justify-center border-2 border-[#151E27] cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#8FA0B2]">{t.avatarOptional}</span>
                  {avatar ? (
                    <button
                      type="button"
                      onClick={() => setAvatar('')}
                      className="inline-flex items-center gap-1 text-xs text-[#FF8A8A] hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t.removePhoto}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-[#6AB2F2] hover:underline cursor-pointer"
                    >
                      {t.choosePhoto}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {AVATAR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarColor(color)}
                      aria-label={color}
                      style={{ backgroundColor: color }}
                      className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                        avatarColor === color
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#151E27] scale-110'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

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
                  placeholder={t.firstNamePlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
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
                  placeholder={t.lastNameInputPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8FA0B2] mb-1.5">
                {t.username}
              </label>
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
                  placeholder="alex_volkov"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
                />
              </div>
              <p className="mt-1 text-xs text-[#6B7C8E]">{t.usernameHint}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8FA0B2] mb-1.5">
                {t.bioOptional}
              </label>
              <input
                type="text"
                maxLength={160}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t.bioPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] disabled:opacity-50 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              {loading ? t.creating : t.createProfileBtn}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8FA0B2] mb-1.5">
                {t.accessKeyLabel}
              </label>
              <input
                type="text"
                required
                value={loginKey}
                onChange={(e) => setLoginKey(e.target.value.toUpperCase())}
                placeholder={t.accessKeyPlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] font-mono-nums text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
              />
              <p className="mt-1.5 text-xs text-[#6B7C8E]">{t.accessKeyHint}</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] disabled:opacity-50 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              {loading ? t.checking : t.signInBtn}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
