import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  AtSign,
  Calendar,
  Check,
  Copy,
  Info,
  Phone,
  Video,
  X,
} from 'lucide-react';
import { TRANSLATIONS, type Lang } from '../i18n.ts';
import type { CallType, MessageRecord, PublicUser } from '../types.ts';
import {
  formatCallDuration,
  formatCallSubtitle,
  formatCallTitle,
  formatDateLabel,
  formatLastSeen,
  formatMemberSince,
  fullName,
} from '../utils/format.ts';
import { Avatar } from './Avatar.tsx';

interface ContactProfileDrawerProps {
  contact: PublicUser;
  myUsername: string;
  messages: MessageRecord[];
  lang: Lang;
  onClose: () => void;
  onStartCall: (callType: CallType) => void;
}

export function ContactProfileDrawer({
  contact,
  myUsername,
  messages,
  lang,
  onClose,
  onStartCall,
}: ContactProfileDrawerProps) {
  const t = TRANSLATIONS[lang];
  const [copiedUsername, setCopiedUsername] = useState(false);

  const calls = messages.filter((m) => m.type === 'call').slice().reverse();
  const totalCallSeconds = calls.reduce(
    (sum, m) => sum + (m.callStatus === 'completed' ? m.durationSec || 0 : 0),
    0,
  );

  const handleCopyUsername = async () => {
    try {
      await navigator.clipboard.writeText(`@${contact.username}`);
      setCopiedUsername(true);
      setTimeout(() => setCopiedUsername(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <aside className="w-full lg:w-[320px] xl:w-[340px] shrink-0 h-full bg-[#151E27] border-l border-white/[0.07] flex flex-col">
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.07] shrink-0">
        <h2 className="font-display text-base font-semibold text-white">{t.profileTitle}</h2>
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
        <div className="flex flex-col items-center text-center">
          <Avatar user={contact} size="xl" showOnline />
          <h3 className="mt-3.5 font-display text-lg font-semibold text-white leading-tight">
            {fullName(contact)}
          </h3>
          <p
            className={`mt-1 text-xs font-medium ${
              contact.online ? 'text-[#34C77B]' : 'text-[#8FA0B2]'
            }`}
          >
            {formatLastSeen(contact.lastSeen, contact.online, lang)}
          </p>

          <div className="mt-4 w-full grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onStartCall('audio')}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#1D2733] hover:bg-[#253342] text-sm font-medium text-[#6AB2F2] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span>{t.callAudio}</span>
            </button>
            <button
              type="button"
              onClick={() => onStartCall('video')}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#1D2733] hover:bg-[#253342] text-sm font-medium text-[#6AB2F2] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Video className="w-4 h-4 shrink-0" />
              <span>{t.callVideo}</span>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-white/[0.06] space-y-4">
          <button
            type="button"
            onClick={handleCopyUsername}
            className="w-full flex items-start justify-between gap-3 text-left group cursor-pointer"
          >
            <div className="flex items-start gap-3 min-w-0">
              <AtSign className="w-4 h-4 text-[#6AB2F2] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-white font-medium truncate">@{contact.username}</div>
                <div className="text-xs text-[#8FA0B2]">{t.usernameNoNumber}</div>
              </div>
            </div>
            <span className="text-xs text-[#6B7C8E] group-hover:text-[#6AB2F2] shrink-0 pt-0.5">
              {copiedUsername ? (
                <Check className="w-4 h-4 text-[#34C77B]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </span>
          </button>

          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-[#8FA0B2] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm text-[#EBF0F5] leading-relaxed break-words">
                {contact.bio || t.bioEmpty}
              </div>
              <div className="text-xs text-[#8FA0B2] mt-0.5">{t.bioLabel}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-[#8FA0B2] mt-0.5 shrink-0" />
            <div>
              <div className="text-sm text-[#EBF0F5]">
                {formatMemberSince(contact.created, lang)}
              </div>
              <div className="text-xs text-[#8FA0B2] mt-0.5">{t.registeredAt}</div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">{t.callHistory}</h4>
            <span className="text-xs font-mono-nums text-[#8FA0B2]">
              {calls.length}
              {totalCallSeconds > 0 ? ` · ${formatCallDuration(totalCallSeconds, lang)}` : ''}
            </span>
          </div>

          {calls.length === 0 ? (
            <p className="text-xs text-[#6B7C8E] leading-relaxed">{t.noCallsYet}</p>
          ) : (
            <div className="space-y-1.5">
              {calls.slice(0, 15).map((call) => {
                const isOutgoing = call.from === myUsername;
                const isCompleted = call.callStatus === 'completed';
                const ArrowIcon = isOutgoing ? ArrowUpRight : ArrowDownLeft;

                return (
                  <button
                    key={call.id}
                    type="button"
                    onClick={() => onStartCall(call.callType === 'video' ? 'video' : 'audio')}
                    className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-[#0E141B]/70 hover:bg-[#1D2733] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ArrowIcon
                        className={`w-4 h-4 shrink-0 ${
                          isCompleted ? 'text-[#6AB2F2]' : 'text-[#EF5B5B]'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#EBF0F5] truncate">
                          {formatCallTitle(call, myUsername, lang)}
                        </div>
                        <div className="text-[11px] font-mono-nums text-[#8FA0B2] truncate">
                          {formatDateLabel(call.ts, lang)} ·{' '}
                          {formatCallSubtitle(call, myUsername, lang)}
                        </div>
                      </div>
                    </div>
                    {call.callType === 'video' ? (
                      <Video className="w-3.5 h-3.5 text-[#6AB2F2] shrink-0" />
                    ) : (
                      <Phone className="w-3.5 h-3.5 text-[#6AB2F2] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
