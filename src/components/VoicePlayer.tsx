import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { formatTimerMMSS } from '../utils/format.ts';

interface VoicePlayerProps {
  src: string;
  durationSec?: number;
  isOutgoing: boolean;
}

export function VoicePlayer({ src, durationSec = 0, isOutgoing }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(durationSec);

  useEffect(() => {
    setTotalDuration(durationSec);
  }, [durationSec]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => setCurrentTime(el.currentTime);
    const onLoaded = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setTotalDuration(Math.round(el.duration));
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    const onPause = () => setPlaying(false);

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('ended', onEnded);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('pause', onPause);
    };
  }, [src]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const progress =
    totalDuration > 0 ? Math.min(100, Math.round((currentTime / totalDuration) * 100)) : 0;

  return (
    <div className="flex items-center gap-2.5 min-w-[190px] sm:min-w-[220px] py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          isOutgoing
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-[#5BA4E5] hover:bg-[#4B95D8] text-white'
        }`}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className={`h-1.5 w-full rounded-full overflow-hidden ${
            isOutgoing ? 'bg-white/20' : 'bg-white/10'
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-150 ${
              isOutgoing ? 'bg-white' : 'bg-[#6AB2F2]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div
          className={`mt-1 text-[11px] font-mono-nums ${
            isOutgoing ? 'text-[#B5CBE0]' : 'text-[#8FA0B2]'
          }`}
        >
          {playing ? formatTimerMMSS(currentTime) : formatTimerMMSS(totalDuration)}
        </div>
      </div>
    </div>
  );
}
