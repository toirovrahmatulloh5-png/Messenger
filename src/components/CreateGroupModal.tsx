import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Search, Trash2, Users, X } from 'lucide-react';
import { TRANSLATIONS, type Lang } from '../i18n.ts';
import type { MessageRecord, PublicGroup, PublicUser } from '../types.ts';
import {
  AVATAR_PALETTE,
  formatLastSeen,
  fullName,
  resizeAvatarImage,
} from '../utils/format.ts';
import { Avatar, GroupAvatar } from './Avatar.tsx';

interface CreateGroupModalProps {
  authKey: string;
  lang: Lang;
  initialUsers: PublicUser[];
  onClose: () => void;
  onCreated: (group: PublicGroup, last: MessageRecord) => void;
}

export function CreateGroupModal({
  authKey,
  lang,
  initialUsers,
  onClose,
  onCreated,
}: CreateGroupModalProps) {
  const t = TRANSLATIONS[lang];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_PALETTE[5]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<PublicUser[]>(initialUsers);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setUsers(initialUsers);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${authKey}` },
        });
        if (res.ok) {
          setUsers(await res.json());
        }
      } catch {
        // Ignore transient network errors
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [search, authKey, initialUsers]);

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

  const toggleMember = (username: string) => {
    setSelected((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.toastGroupEmptyTitle);
      return;
    }
    setError('');
    setCreating(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authKey}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          avatar,
          avatarColor,
          members: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.networkError);
        return;
      }
      onCreated(data.group, data.last);
    } catch {
      setError(t.networkError);
    } finally {
      setCreating(false);
    }
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
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#6AB2F2]" />
            <h2 className="font-display text-lg font-semibold text-white">{t.createGroup}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.cancel}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Group Avatar + Color */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-[#0E141B]/70 border border-white/[0.06]">
            <div className="relative shrink-0">
              <GroupAvatar
                group={{ name: name || 'GR', avatar, avatarColor }}
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

            <div className="flex-1 space-y-2 min-w-0">
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

          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#E55353]/12 border border-[#E55353]/30 text-sm text-[#FF8A8A]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#8FA0B2] mb-1.5">
              {t.groupName}
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.groupNamePlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8FA0B2] mb-1.5">
              {t.groupDescOptional}
            </label>
            <input
              type="text"
              maxLength={160}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.groupDescPlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
            />
          </div>

          {/* Member Picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#8FA0B2]">{t.addMembers}</label>
              <span className="text-xs font-mono-nums text-[#6AB2F2]">
                {t.selectedCount}: {selected.length}
              </span>
            </div>

            <div className="relative mb-2">
              <Search className="w-4 h-4 text-[#6B7C8E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0E141B] border border-white/[0.07] text-xs text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
              />
            </div>

            <div className="max-h-44 overflow-y-auto rounded-xl bg-[#0E141B] border border-white/[0.06] divide-y divide-white/[0.04]">
              {users.length === 0 ? (
                <div className="px-3 py-5 text-center text-xs text-[#6B7C8E]">
                  {t.noUsersFound}
                </div>
              ) : (
                users.map((u) => {
                  const isChecked = selected.includes(u.username);
                  return (
                    <button
                      key={u.username}
                      type="button"
                      onClick={() => toggleMember(u.username)}
                      className="w-full px-3 py-2 flex items-center justify-between gap-3 hover:bg-white/[0.04] text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar user={u} size="sm" showOnline />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate">
                            {fullName(u)}
                          </div>
                          <div className="text-[11px] text-[#8FA0B2] truncate">
                            @{u.username} · {formatLastSeen(u.lastSeen, u.online, lang)}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-[#5BA4E5] border-[#5BA4E5] text-white'
                            : 'border-white/20 bg-transparent'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#8FA0B2] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2.5 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] disabled:opacity-50 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              {creating ? t.creating : t.createGroupBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
