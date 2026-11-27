import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  SwitchCamera,
  Users,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { TRANSLATIONS, type Lang } from '../i18n.ts';
import type { CallType, PublicGroup, PublicUser } from '../types.ts';
import { formatTimerMMSS, fullName } from '../utils/format.ts';
import { Avatar, GroupAvatar } from './Avatar.tsx';

export interface GroupPeerMedia {
  user: PublicUser;
  stream: MediaStream | null;
}

export interface ActiveGroupCallSession {
  group: PublicGroup;
  callId: string;
  callType: CallType;
  startedAt: number;
}

interface GroupPeerTileProps {
  user: PublicUser;
  stream: MediaStream | null;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  hasVideo: boolean;
  youLabel: string;
  onAudioBlocked: () => void;
  unlockNonce: number;
}

function GroupPeerTile({
  user,
  stream,
  isLocal = false,
  isMuted = false,
  isCameraOff = false,
  hasVideo,
  youLabel,
  onAudioBlocked,
  unlockNonce,
}: GroupPeerTileProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasActiveRemoteVideo, setHasActiveRemoteVideo] = useState(false);

  useEffect(() => {
    if (isLocal) return;
    const audioEl = audioRef.current;
    if (!audioEl || !stream) return;
    audioEl.srcObject = stream;
    void audioEl
      .play()
      .then(() => {})
      .catch(() => onAudioBlocked());
  }, [isLocal, stream, onAudioBlocked, unlockNonce]);

  useEffect(() => {
    if (!stream) {
      setHasActiveRemoteVideo(false);
      return;
    }
    const updateVideoFlag = () => {
      const tracks = stream.getVideoTracks();
      setHasActiveRemoteVideo(tracks.some((tr) => tr.readyState === 'live' && tr.enabled));
    };
    updateVideoFlag();
    stream.addEventListener('addtrack', updateVideoFlag);
    stream.addEventListener('removetrack', updateVideoFlag);
    return () => {
      stream.removeEventListener('addtrack', updateVideoFlag);
      stream.removeEventListener('removetrack', updateVideoFlag);
    };
  }, [stream]);

  const showVideo = isLocal
    ? hasVideo && Boolean(stream) && !isCameraOff
    : hasVideo && Boolean(stream) && hasActiveRemoteVideo;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream || !showVideo) return;
    videoEl.srcObject = stream;
    void videoEl.play().catch(() => {});
  }, [stream, showVideo, unlockNonce]);

  return (
    <div className="relative rounded-2xl bg-[#0E141B] border border-white/[0.08] overflow-hidden aspect-[4/3] flex items-center justify-center">
      {!isLocal && <audio ref={audioRef} autoPlay playsInline className="sr-only" />}

      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-3">
          <Avatar user={user} size="lg" />
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 pointer-events-none">
        <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-xs font-medium text-white truncate">
          {fullName(user)}
          {isLocal ? ` (${youLabel})` : ''}
        </span>
        {isLocal && isMuted && (
          <span className="w-6 h-6 rounded-full bg-[#E55353] text-white flex items-center justify-center shrink-0">
            <MicOff className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

interface GroupCallOverlayProps {
  session: ActiveGroupCallSession;
  me: PublicUser;
  peers: GroupPeerMedia[];
  elapsedSec: number;
  isMuted: boolean;
  isCameraOff: boolean;
  localStream: MediaStream | null;
  lang: Lang;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera?: () => void;
}

export function GroupCallOverlay({
  session,
  me,
  peers,
  elapsedSec,
  isMuted,
  isCameraOff,
  localStream,
  lang,
  onLeave,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
}: GroupCallOverlayProps) {
  const t = TRANSLATIONS[lang];
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [unlockNonce, setUnlockNonce] = useState(0);
  const hasVideo = session.callType === 'video';
  const totalCount = 1 + peers.length;

  useEffect(() => {
    setAudioBlocked(false);
  }, [session.callId]);

  const gridColsClass =
    totalCount <= 1
      ? 'grid-cols-1 max-w-sm mx-auto'
      : totalCount === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : totalCount <= 4
          ? 'grid-cols-2'
          : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="my-auto w-full max-w-3xl bg-[#151E27] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94dvh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <GroupAvatar group={session.group} size="sm" />
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold text-white truncate">
                {session.group.name}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8FA0B2]">
                <span className="font-mono-nums text-[#34C77B]">
                  {formatTimerMMSS(elapsedSec)}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {totalCount} {t.participantsCount}
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs font-medium text-[#6AB2F2] shrink-0">
            {hasVideo ? t.groupVideoCallTitle : t.groupCallTitle}
          </span>
        </div>

        {/* Participant Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 overscroll-contain">
          <div className={`grid gap-3 ${gridColsClass}`}>
            <GroupPeerTile
              user={me}
              stream={localStream}
              isLocal
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              hasVideo={hasVideo}
              youLabel={t.youLabel}
              onAudioBlocked={() => {}}
              unlockNonce={unlockNonce}
            />
            {peers.map((p) => (
              <GroupPeerTile
                key={p.user.username}
                user={p.user}
                stream={p.stream}
                hasVideo={hasVideo}
                youLabel={t.youLabel}
                onAudioBlocked={() => setAudioBlocked(true)}
                unlockNonce={unlockNonce}
              />
            ))}
          </div>

          {peers.length === 0 && (
            <p className="mt-4 text-center text-xs text-[#8FA0B2]">{t.waitingForOthers}</p>
          )}
        </div>

        {audioBlocked && (
          <div className="px-5 pb-2 flex justify-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setAudioBlocked(false);
                setUnlockNonce((n) => n + 1);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#5BA4E5]/20 hover:bg-[#5BA4E5]/30 border border-[#5BA4E5]/40 text-xs font-medium text-[#6AB2F2] cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>{t.tapToEnableAudio}</span>
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="px-6 py-4 border-t border-white/[0.07] flex items-center justify-center gap-4 sm:gap-6 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={t.mic}
            className="flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <span
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isMuted
                  ? 'bg-white text-[#0E141B]'
                  : 'bg-[#1D2733] hover:bg-[#263342] text-white'
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </span>
            <span className="text-xs text-[#8FA0B2]">{isMuted ? t.muted : t.mic}</span>
          </button>

          {hasVideo && (
            <button
              type="button"
              onClick={onToggleCamera}
              aria-label={t.camera}
              className="flex flex-col items-center gap-1.5 cursor-pointer"
            >
              <span
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isCameraOff
                    ? 'bg-white text-[#0E141B]'
                    : 'bg-[#1D2733] hover:bg-[#263342] text-white'
                }`}
              >
                {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </span>
              <span className="text-xs text-[#8FA0B2]">{t.camera}</span>
            </button>
          )}

          {hasVideo && !isCameraOff && onSwitchCamera && (
            <button
              type="button"
              onClick={onSwitchCamera}
              aria-label={t.flipCamera}
              className="flex flex-col items-center gap-1.5 cursor-pointer"
            >
              <span className="w-12 h-12 rounded-full bg-[#1D2733] hover:bg-[#263342] text-white flex items-center justify-center transition-colors">
                <SwitchCamera className="w-5 h-5" />
              </span>
              <span className="text-xs text-[#8FA0B2]">{t.flipCamera}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLeave}
            aria-label={t.leaveCall}
            className="flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <span className="w-12 h-12 rounded-full bg-[#E55353] hover:bg-[#D64545] text-white flex items-center justify-center transition-colors">
              <PhoneOff className="w-5 h-5" />
            </span>
            <span className="text-xs text-[#8FA0B2]">{t.leaveCall}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
