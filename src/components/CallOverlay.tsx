import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { TRANSLATIONS, type Lang } from '../i18n.ts';
import type { CallType, PublicUser } from '../types.ts';
import { formatTimerMMSS, fullName } from '../utils/format.ts';
import { Avatar } from './Avatar.tsx';

export interface ActiveCallSession {
  callId: string;
  peer: PublicUser;
  direction: 'incoming' | 'outgoing';
  callType: CallType;
  phase: 'ringing' | 'connecting' | 'connected';
  connectedAt: number | null;
}

interface CallOverlayProps {
  session: ActiveCallSession;
  elapsedSec: number;
  isMuted: boolean;
  isCameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  lang: Lang;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera?: () => void;
}

export function CallOverlay({
  session,
  elapsedSec,
  isMuted,
  isCameraOff,
  localStream,
  remoteStream,
  lang,
  onAccept,
  onDecline,
  onHangup,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
}: CallOverlayProps) {
  const t = TRANSLATIONS[lang];
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const hasVideo = session.callType === 'video';
  const isIncomingRinging = session.direction === 'incoming' && session.phase === 'ringing';

  useEffect(() => {
    setAudioBlocked(false);
  }, [session.callId]);

  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl || !remoteStream) return;
    audioEl.srcObject = remoteStream;
    void audioEl
      .play()
      .then(() => setAudioBlocked(false))
      .catch(() => setAudioBlocked(true));
  }, [remoteStream, session.callId]);

  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl || !remoteStream) return;
    videoEl.srcObject = remoteStream;
    void videoEl.play().catch(() => {});
  }, [remoteStream, session.phase, hasVideo]);

  useEffect(() => {
    const localEl = localVideoRef.current;
    if (!localEl || !localStream) return;
    localEl.srcObject = localStream;
    void localEl.play().catch(() => {});
  }, [localStream, session.phase, isCameraOff, hasVideo]);

  const handleUnlockAudio = () => {
    const audioEl = remoteAudioRef.current;
    if (audioEl) {
      void audioEl
        .play()
        .then(() => setAudioBlocked(false))
        .catch(() => {});
    }
    const videoEl = remoteVideoRef.current;
    if (videoEl) {
      void videoEl.play().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" />

      <div className="w-full max-w-md bg-[#151E27] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl">
        {hasVideo && session.phase === 'connected' && remoteStream ? (
          <div className="relative w-full aspect-[4/3] bg-[#0B1016]">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {localStream && !isCameraOff && (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-3 right-3 w-28 h-20 rounded-xl object-cover border border-white/20 bg-[#0E141B]"
              />
            )}
            <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/55 backdrop-blur-xs">
              <div className="text-sm font-medium text-white">{fullName(session.peer)}</div>
              <div className="text-xs font-mono-nums text-[#34C77B]">
                {formatTimerMMSS(elapsedSec)}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 pt-9 pb-6 flex flex-col items-center text-center">
            {hasVideo && localStream && !isCameraOff ? (
              <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-white/15 bg-[#0B1016]">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <Avatar user={session.peer} size="xl" />
            )}
            <h2 className="mt-4 font-display text-xl font-semibold text-white">
              {fullName(session.peer)}
            </h2>
            <p className="mt-0.5 text-sm text-[#8FA0B2]">@{session.peer.username}</p>

            <div className="mt-4 text-sm font-medium">
              {session.phase === 'ringing' && session.direction === 'incoming' && (
                <span className="text-[#6AB2F2]">
                  {hasVideo ? t.incomingVideoCall : t.incomingCall}
                </span>
              )}
              {session.phase === 'ringing' && session.direction === 'outgoing' && (
                <span className="text-[#8FA0B2]">{t.calling}</span>
              )}
              {session.phase === 'connecting' && (
                <span className="text-[#8FA0B2]">{t.connecting}</span>
              )}
              {session.phase === 'connected' && (
                <span className="font-mono-nums text-[#34C77B] text-base">
                  {formatTimerMMSS(elapsedSec)}
                </span>
              )}
            </div>
          </div>
        )}

        {audioBlocked && session.phase === 'connected' && (
          <div className="px-6 pb-3 flex justify-center">
            <button
              type="button"
              onClick={handleUnlockAudio}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#5BA4E5]/20 hover:bg-[#5BA4E5]/30 border border-[#5BA4E5]/40 text-xs font-medium text-[#6AB2F2] cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>{t.tapToEnableAudio}</span>
            </button>
          </div>
        )}

        <div className="px-6 pb-7 pt-2 flex items-center justify-center gap-4">
          {isIncomingRinging ? (
            <>
              <button
                type="button"
                onClick={onDecline}
                aria-label={t.decline}
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <span className="w-14 h-14 rounded-full bg-[#E55353] group-hover:bg-[#D64545] text-white flex items-center justify-center transition-colors">
                  <PhoneOff className="w-6 h-6" />
                </span>
                <span className="text-xs text-[#8FA0B2]">{t.decline}</span>
              </button>

              <button
                type="button"
                onClick={onAccept}
                aria-label={t.answer}
                className="flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <span className="w-14 h-14 rounded-full bg-[#34C77B] group-hover:bg-[#2BB36D] text-white flex items-center justify-center transition-colors">
                  {hasVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                </span>
                <span className="text-xs text-[#8FA0B2]">{t.answer}</span>
              </button>
            </>
          ) : (
            <>
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
                onClick={onHangup}
                aria-label={t.hangup}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <span className="w-12 h-12 rounded-full bg-[#E55353] hover:bg-[#D64545] text-white flex items-center justify-center transition-colors">
                  <PhoneOff className="w-5 h-5" />
                </span>
                <span className="text-xs text-[#8FA0B2]">{t.hangup}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
