import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, FastForward } from 'lucide-react';
import { formatAudioTime, generateSyntheticVoiceWav } from '../utils/audioUtils';

interface VoiceMessagePlayerProps {
  audioUrl?: string;
  duration?: number;
  messageId: string;
  isMe: boolean;
  isActive: boolean;
  onPlay: (messageId: string) => void;
  onPause: () => void;
}

// Waveform heights pattern
const WAVEFORM_PATTERNS = [
  3, 6, 9, 5, 8, 12, 7, 10, 14, 8, 11, 6, 13, 9, 7, 11, 8, 5, 9, 4, 7, 3
];

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration = 3,
  messageId,
  isMe,
  isActive,
  onPlay,
  onPause,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 3);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fallback audible audio URL if message had no audio recorded
  const effectiveAudioUrl = useRef<string>('');

  useEffect(() => {
    if (audioUrl && audioUrl.startsWith('data:audio')) {
      effectiveAudioUrl.current = audioUrl;
    } else {
      // Generate real audible voice wave so it never plays silence
      effectiveAudioUrl.current = generateSyntheticVoiceWav(duration || 3);
    }
  }, [audioUrl, duration]);

  // Handle active status changes from parent controller
  useEffect(() => {
    let audio = audioRef.current;

    if (!audio) {
      audio = new Audio(effectiveAudioUrl.current);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        if (audio && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setTotalDuration(Math.round(audio.duration));
        }
      };

      audio.ontimeupdate = () => {
        if (audio) {
          setCurrentTime(audio.currentTime);
        }
      };

      audio.onended = () => {
        setCurrentTime(0);
        onPause();
      };

      audio.onerror = () => {
        // Fallback to synthetic WAV on decode error
        if (audio && effectiveAudioUrl.current !== audio.src) {
          audio.src = generateSyntheticVoiceWav(duration || 3);
          audio.load();
        }
      };
    }

    if (isActive) {
      audio.playbackRate = playbackRate;
      audio.play().catch((err) => {
        console.warn('Audio playback error:', err);
        onPause();
      });
    } else {
      audio.pause();
    }

    return () => {
      // Cleanup on unmount
      if (audio) {
        audio.pause();
      }
    };
  }, [isActive]);

  // Update playback speed
  const cyclePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rates = [1, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const togglePlay = () => {
    if (isActive) {
      onPause();
    } else {
      onPlay(messageId);
    }
  };

  const handleSeek = (index: number) => {
    const fraction = (index + 1) / WAVEFORM_PATTERNS.length;
    const newTime = fraction * totalDuration;
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const progressFraction = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;
  const activeBarsCount = Math.round(progressFraction * WAVEFORM_PATTERNS.length);

  return (
    <div className="flex items-center gap-2.5 py-1 select-none">
      {/* Play / Pause Circular Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-90 ${
          isMe
            ? 'bg-white text-blue-600 hover:bg-slate-100 shadow-blue-900/20'
            : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/30'
        }`}
        title={isActive ? 'توقف پخش صدا' : 'پخش پیام صوتی'}
      >
        {isActive ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current mr-0.5" />
        )}
      </button>

      {/* Waveform and Progress */}
      <div className="flex-1 min-w-[140px]">
        {/* Clickable Waveform Bars */}
        <div className="flex items-center gap-[2.5px] h-7 cursor-pointer py-1" title="پرش به بخش دلخواه صدا">
          {WAVEFORM_PATTERNS.map((h, i) => {
            const isPlayed = i <= activeBarsCount;
            return (
              <div
                key={i}
                onClick={() => handleSeek(i)}
                style={{ height: `${Math.max(4, h * 1.8)}px` }}
                className={`w-[3px] rounded-full transition-all duration-100 hover:opacity-100 ${
                  isPlayed
                    ? isMe 
                      ? 'bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.6)]' 
                      : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                    : isMe 
                      ? 'bg-white/40' 
                      : 'bg-blue-300/40'
                }`}
              />
            );
          })}
        </div>

        {/* Footer: Current Time / Total Duration + Speed Selector */}
        <div className="flex items-center justify-between text-[10px] opacity-85 mt-0.5 font-mono">
          <span className="flex items-center gap-1">
            <Volume2 className="w-3 h-3 opacity-70" />
            <span>
              {isActive 
                ? `${formatAudioTime(currentTime)} / ${formatAudioTime(totalDuration)}`
                : `${formatAudioTime(totalDuration)}`
              }
            </span>
          </span>

          {/* Speed badge */}
          <button
            type="button"
            onClick={cyclePlaybackRate}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
              isMe 
                ? 'bg-white/20 hover:bg-white/30 text-white' 
                : 'bg-blue-700/60 hover:bg-blue-700 text-blue-100'
            }`}
            title="تغییر سرعت پخش"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};
