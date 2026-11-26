import { TRANSLATIONS, type Lang } from '../i18n.ts';
import type { MessageRecord, PublicGroup, PublicUser } from '../types.ts';

export const AVATAR_PALETTE = [
  '#4E8FD9',
  '#34A87B',
  '#D97B4E',
  '#8B6CE3',
  '#D95B7A',
  '#3C9FB8',
  '#C4903A',
  '#5D7FE3',
];

const LOCALE_MAP: Record<Lang, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uz: 'uz-Latn-UZ',
};

export function fullName(user: Pick<PublicUser, 'name' | 'surname'>): string {
  return [user.name, user.surname].filter(Boolean).join(' ').trim();
}

export function getInitials(user: Pick<PublicUser, 'name' | 'surname'>): string {
  const first = (user.name || '').trim().charAt(0);
  const second = (user.surname || '').trim().charAt(0);
  return (first + second).toUpperCase() || '?';
}

export function getGroupInitials(group: Pick<PublicGroup, 'name'>): string {
  const words = group.name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return group.name.trim().slice(0, 2).toUpperCase() || 'G';
}

export function formatTime(ts: number, lang: Lang = 'ru'): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(LOCALE_MAP[lang], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateLabel(ts: number, lang: Lang = 'ru'): string {
  const t = TRANSLATIONS[lang];
  const d = new Date(ts);
  const now = new Date();
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return t.today;
  if (diffDays === 1) return t.yesterday;
  return d.toLocaleDateString(LOCALE_MAP[lang], {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatMemberSince(ts: number, lang: Lang = 'ru'): string {
  return new Date(ts).toLocaleDateString(LOCALE_MAP[lang], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatLastSeen(ts: number, online: boolean, lang: Lang = 'ru'): string {
  const t = TRANSLATIONS[lang];
  if (online) return t.online;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return t.lastSeenJustNow;
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return lang === 'ru'
      ? `был(а) ${mins} ${t.lastSeenMinsAgo}`
      : `${mins} ${t.lastSeenMinsAgo}`;
  }
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return `${t.lastSeenAt} ${formatTime(ts, lang)}`;
  }
  return `${t.lastSeenDate} ${d.toLocaleDateString(LOCALE_MAP[lang], {
    day: 'numeric',
    month: 'short',
  })}`;
}

export function formatCallDuration(totalSeconds: number, lang: Lang = 'ru'): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const units = {
    ru: { sec: 'сек.', min: 'мин.', hr: 'ч.' },
    en: { sec: 'sec', min: 'min', hr: 'hr' },
    uz: { sec: 'son.', min: 'daq.', hr: 'soat' },
  }[lang];

  if (sec < 60) {
    return `${sec} ${units.sec}`;
  }
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;
  if (hrs > 0) {
    return `${hrs} ${units.hr} ${mins} ${units.min}`;
  }
  return `${mins} ${units.min} ${remSec} ${units.sec}`;
}

export function formatTimerMMSS(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(rem)}`;
  return `${pad(mins)}:${pad(rem)}`;
}

export function formatCallTitle(
  msg: MessageRecord,
  myUsername: string,
  lang: Lang = 'ru',
): string {
  const t = TRANSLATIONS[lang];
  const isOutgoing = msg.from === myUsername;
  const isVideo = msg.callType === 'video';
  if (isOutgoing) {
    return isVideo ? t.outgoingVideoCall : t.outgoingCall;
  }
  if (msg.callStatus === 'missed' || msg.callStatus === 'cancelled') {
    return isVideo ? t.missedVideoCall : t.missedCall;
  }
  return isVideo ? t.incomingVideoCall : t.incomingCall;
}

export function formatCallSubtitle(
  msg: MessageRecord,
  myUsername: string,
  lang: Lang = 'ru',
): string {
  const t = TRANSLATIONS[lang];
  const time = formatTime(msg.ts, lang);
  const isOutgoing = msg.from === myUsername;

  switch (msg.callStatus) {
    case 'completed':
      return `${time}, ${formatCallDuration(msg.durationSec ?? 0, lang)}`;
    case 'declined':
      return `${time}, ${t.callDeclined}`;
    case 'busy':
      return `${time}, ${t.callBusy}`;
    case 'cancelled':
      return isOutgoing ? `${time}, ${t.callCancelled}` : `${time}, ${t.callMissed}`;
    case 'missed':
    default:
      return isOutgoing ? `${time}, ${t.callUnanswered}` : `${time}, ${t.callMissed}`;
  }
}

export function formatSystemMessage(msg: MessageRecord, lang: Lang = 'ru'): string {
  const t = TRANSLATIONS[lang];
  const actor = msg.sender ? fullName(msg.sender) : `@${msg.from}`;
  switch (msg.systemAction) {
    case 'created':
      return `${actor} ${t.groupCreatedSys}`;
    case 'left':
      return `${actor} ${t.groupLeftSys}`;
    case 'added':
      return `${actor} ${t.groupAddedSys} @${msg.systemTarget || ''}`;
    case 'removed':
      return `${actor} ${t.groupRemovedSys} @${msg.systemTarget || ''}`;
    default:
      return msg.text || '';
  }
}

export function formatLastMessagePreview(
  msg: MessageRecord | null,
  myUsername: string,
  lang: Lang = 'ru',
): string {
  if (!msg) return '';
  if (msg.type === 'call') {
    const title = formatCallTitle(msg, myUsername, lang);
    if (msg.callStatus === 'completed' && (msg.durationSec ?? 0) > 0) {
      return `${title} · ${formatCallDuration(msg.durationSec ?? 0, lang)}`;
    }
    return title;
  }
  if (msg.type === 'system') {
    return formatSystemMessage(msg, lang);
  }
  if (msg.chatKind === 'group' && msg.sender) {
    const senderPrefix = msg.from === myUsername ? (lang === 'en' ? 'You' : lang === 'uz' ? 'Siz' : 'Вы') : msg.sender.name;
    return `${senderPrefix}: ${msg.text || ''}`;
  }
  return msg.text || '';
}

export async function resizeAvatarImage(file: File, lang: Lang = 'ru'): Promise<string> {
  const t = TRANSLATIONS[lang];
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error(t.photoTypeError);
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error(t.photoSizeError);
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(t.photoReadError));
      el.src = bitmapUrl;
    });

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(t.photoReadError);

    const minSide = Math.min(img.width, img.height);
    const sx = (img.width - minSide) / 2;
    const sy = (img.height - minSide) / 2;
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

    const jpeg = canvas.toDataURL('image/jpeg', 0.84);
    if (jpeg.startsWith('data:image/jpeg') && jpeg.length < 320_000) {
      return jpeg;
    }
    return canvas.toDataURL('image/jpeg', 0.65);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export function startRingtone(kind: 'incoming' | 'outgoing'): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let ctx: AudioContext | null = null;

  const playTone = () => {
    if (stopped) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ctx) ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      if (kind === 'incoming') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.14);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.44);
      } else {
        osc.frequency.setValueAtTime(425, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.035, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.68);
      }
    } catch {
      // Ignore autoplay blocks gracefully
    }
  };

  playTone();
  timer = setInterval(playTone, kind === 'incoming' ? 1800 : 2600);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    if (ctx) {
      void ctx.close().catch(() => {});
      ctx = null;
    }
  };
}
