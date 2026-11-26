import { useRef, useState } from 'react';
import {
  Camera,
  Edit3,
  Info,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  UserMinus,
  X,
} from 'lucide-react';
import { TRANSLATIONS, type Lang } from '../i18n.ts';
import type { PublicGroup, PublicUser } from '../types.ts';
import {
  AVATAR_PALETTE,
  formatLastSeen,
  formatMemberSince,
  fullName,
  resizeAvatarImage,
} from '../utils/format.ts';
import { Avatar, GroupAvatar } from './Avatar.tsx';

interface GroupInfoDrawerProps {
  group: PublicGroup;
  myUsername: string;
  authKey: string;
  lang: Lang;
  directoryUsers: PublicUser[];
  onClose: () => void;
  onUpdated: (group: PublicGroup) => void;
  onLeftGroup: (groupId: string) => void;
  onOpenDm: (user: PublicUser) => void;
}

export function GroupInfoDrawer({
  group,
  myUsername,
  authKey,
  lang,
  directoryUsers,
  onClose,
  onUpdated,
  onLeftGroup,
  onOpenDm,
}: GroupInfoDrawerProps) {
  const t = TRANSLATIONS[lang];
  const isOwner = group.owner === myUsername;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [avatar, setAvatar] = useState(group.avatar);
  const [avatarColor, setAvatarColor] = useState(group.avatarColor);

  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const membersInfo = group.membersInfo ?? [];
  const onlineCount = membersInfo.filter((m) => m.online).length;

  const candidates = directoryUsers.filter(
    (u) =>
      !group.members.includes(u.username) &&
      (!memberSearch.trim() ||
        u.username.includes(memberSearch.trim().toLowerCase()) ||
        fullName(u).toLowerCase().includes(memberSearch.trim().toLowerCase())),
  );

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

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authKey}`,
        },
        body: JSON.stringify({ name, description, avatar, avatarColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.networkError);
        return;
      }
      onUpdated(data);
      setEditing(false);
    } catch {
      setError(t.networkError);
    } finally {
      setBusy(false);
    }
  };

  const handleMemberMutation = async (payload: { addMember?: string; removeMember?: string }) => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authKey}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.networkError);
        return;
      }
      onUpdated(data);
      setShowAddMember(false);
      setMemberSearch('');
    } catch {
      setError(t.networkError);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.id)}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authKey}` },
      });
      if (res.ok) {
        onLeftGroup(group.id);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="w-full lg:w-[320px] xl:w-[340px] shrink-0 h-full bg-[#151E27] border-l border-white/[0.07] flex flex-col">
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.07] shrink-0">
        <h2 className="font-display text-base font-semibold text-white">{t.groupInfo}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.cancel}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {editing ? (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <GroupAvatar group={{ name, avatar, avatarColor }} size="xl" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t.choosePhoto}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#5BA4E5] text-white flex items-center justify-center border-2 border-[#151E27] cursor-pointer"
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

              <div className="flex items-center gap-2">
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar('')}
                    className="inline-flex items-center gap-1 text-xs text-[#FF8A8A] hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.removePhoto}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {AVATAR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-5 h-5 rounded-full cursor-pointer ${
                      avatarColor === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#151E27]'
                        : 'opacity-75'
                    }`}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-xl bg-[#E55353]/12 border border-[#E55353]/30 text-xs text-[#FF8A8A]">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs text-[#8FA0B2] mb-1">{t.groupName}</label>
              <input
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#5BA4E5]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8FA0B2] mb-1">{t.groupDescOptional}</label>
              <textarea
                rows={2}
                maxLength={160}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white resize-none focus:outline-none focus:border-[#5BA4E5]"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-2 rounded-xl text-xs text-[#8FA0B2] hover:text-white cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] text-xs font-semibold text-white cursor-pointer"
              >
                {busy ? t.saving : t.saveGroup}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-center text-center">
            <GroupAvatar group={group} size="xl" />
            <h3 className="mt-3.5 font-display text-lg font-semibold text-white leading-tight">
              {group.name}
            </h3>
            <p className="mt-1 text-xs text-[#8FA0B2] font-mono-nums">
              {group.memberCount} {t.membersCount}
              {onlineCount > 0 ? ` · ${onlineCount} ${t.onlineShort}` : ''}
            </p>
            <p className="mt-1 text-[11px] text-[#6B7C8E]">
              {formatMemberSince(group.created, lang)}
            </p>

            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setName(group.name);
                  setDescription(group.description);
                  setAvatar(group.avatar);
                  setAvatarColor(group.avatarColor);
                  setEditing(true);
                }}
                className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1D2733] hover:bg-[#253342] text-xs font-medium text-[#EBF0F5] transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#6AB2F2]" />
                <span>{t.editGroup}</span>
              </button>
            )}
          </div>
        )}

        {group.description && !editing && (
          <div className="pt-4 border-t border-white/[0.06] flex items-start gap-3">
            <Info className="w-4 h-4 text-[#8FA0B2] mt-0.5 shrink-0" />
            <div className="text-sm text-[#EBF0F5] leading-relaxed break-words">
              {group.description}
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="pt-4 border-t border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">
              {t.addMembers} ({group.memberCount})
            </h4>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowAddMember((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#6AB2F2] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addMemberBtn}</span>
              </button>
            )}
          </div>

          {showAddMember && isOwner && (
            <div className="mb-3 p-2.5 rounded-xl bg-[#0E141B] border border-white/[0.06] space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6B7C8E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[#151E27] border border-white/[0.06] text-xs text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
                />
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {candidates.length === 0 ? (
                  <div className="py-2 text-center text-[11px] text-[#6B7C8E]">
                    {t.noUsersFound}
                  </div>
                ) : (
                  candidates.map((u) => (
                    <button
                      key={u.username}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleMemberMutation({ addMember: u.username })}
                      className="w-full px-2 py-1.5 rounded-lg hover:bg-white/[0.05] flex items-center justify-between gap-2 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar user={u} size="xs" showOnline />
                        <span className="text-xs text-white truncate">{fullName(u)}</span>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-[#6AB2F2] shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {membersInfo.map((member) => {
              const isMe = member.username === myUsername;
              const isMemberOwner = member.username === group.owner;
              return (
                <div
                  key={member.username}
                  className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[#0E141B]/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar user={member} size="sm" showOnline />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-white truncate">
                          {fullName(member)}
                        </span>
                        {isMemberOwner && (
                          <span className="text-[10px] text-[#6AB2F2] shrink-0">
                            · {t.creatorBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8FA0B2] truncate">
                        @{member.username} · {formatLastSeen(member.lastSeen, member.online, lang)}
                      </div>
                    </div>
                  </div>

                  {!isMe && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenDm(member)}
                        title={t.writeDm}
                        aria-label={t.writeDm}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8FA0B2] hover:text-[#6AB2F2] hover:bg-white/[0.06] cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      {isOwner && !isMemberOwner && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleMemberMutation({ removeMember: member.username })
                          }
                          title={t.removeMember}
                          aria-label={t.removeMember}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8FA0B2] hover:text-[#FF8A8A] hover:bg-[#E55353]/15 cursor-pointer"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave Group */}
        <div className="pt-4 border-t border-white/[0.06]">
          {!confirmLeave ? (
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#E55353]/10 hover:bg-[#E55353]/20 text-sm font-medium text-[#FF8A8A] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.leaveGroup}</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="py-2.5 px-3 rounded-xl bg-[#1D2733] text-xs font-medium text-[#EBF0F5] cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleLeave}
                className="py-2.5 px-3 rounded-xl bg-[#E55353] text-xs font-semibold text-white cursor-pointer"
              >
                {t.confirmLeaveGroup}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
