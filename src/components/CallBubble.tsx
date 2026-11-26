import { ArrowDownLeft, ArrowUpRight, Phone, Video } from 'lucide-react';
import { TRANSLATIONS, type Lang } from '../i18n.ts';
import type { CallType, MessageRecord } from '../types.ts';
import { formatCallSubtitle, formatCallTitle } from '../utils/format.ts';

interface CallBubbleProps {
  message: MessageRecord;
  myUsername: string;
  lang: Lang;
  onCallBack: (callType: CallType) => void;
}

export function CallBubble({ message, myUsername, lang, onCallBack }: CallBubbleProps) {
  const t = TRANSLATIONS[lang];
  const isOutgoing = message.from === myUsername;
  const isCompleted = message.callStatus === 'completed';
  const isVideo = message.callType === 'video';

  const title = formatCallTitle(message, myUsername, lang);
  const subtitle = formatCallSubtitle(message, myUsername, lang);

  const ArrowIcon = isOutgoing ? ArrowUpRight : ArrowDownLeft;
  const ActionIcon = isVideo ? Video : Phone;

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`group flex items-center justify-between gap-5 min-w-[248px] max-w-[330px] px-4 py-3 rounded-2xl border border-white/[0.06] transition-colors ${
          isOutgoing ? 'bg-[#26496C] rounded-br-sm' : 'bg-[#1D2733] rounded-bl-sm'
        }`}
      >
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-[#F3F6FA] leading-snug truncate">
            {title}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] leading-none">
            <ArrowIcon
              className={`w-3.5 h-3.5 shrink-0 ${
                isCompleted ? 'text-[#6AB2F2]' : 'text-[#EF5B5B]'
              }`}
              strokeWidth={2.25}
            />
            <span
              className={`font-mono-nums truncate ${
                isOutgoing ? 'text-[#B5CBE0]' : 'text-[#8FA0B2]'
              }`}
            >
              {subtitle}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onCallBack(isVideo ? 'video' : 'audio')}
          title={isVideo ? t.callbackVideo : t.callbackAudio}
          aria-label={isVideo ? t.callbackVideo : t.callbackAudio}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[#6AB2F2] hover:bg-[#6AB2F2]/15 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6AB2F2]"
        >
          <ActionIcon className="w-[19px] h-[19px]" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
