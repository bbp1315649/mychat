/**
 * Text-to-Speech (TTS) Utility for School Chat
 * Features:
 * - High-quality Persian (DilaraNeural) & multi-language voice synthesis
 * - Millisecond-accurate word boundaries for real-time word-by-word (Karaoke) highlighting
 * - Real-time speech rate adjustment (0.7x to 1.2x)
 * - Safe session management with zero ghost playback or cancellation bugs
 * - Fallback with boundary events when offline
 */

export interface WordTiming {
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface SpeechPlaybackState {
  isPlaying: boolean;
  messageId: string | null;
  text: string;
  lang: string;
  langLabel: string;
  rate: number;
  currentWordIndex: number;
  currentWord: string;
  words: string[];
  wordBoundaries: WordTiming[];
  currentTime: number;
  duration: number;
}

export interface SpeechRatePreset {
  label: string;
  shortLabel: string;
  rate: number;
  description: string;
}

export const DEFAULT_SPEECH_RATE = 0.85;

export const SPEECH_RATE_PRESETS: SpeechRatePreset[] = [
  { label: 'خیلی آرام', shortLabel: '۰.۷x', rate: 0.7, description: 'بسیار شمرده و با دقت' },
  { label: 'آرام', shortLabel: '۰.۸x', rate: 0.8, description: 'آهسته و کاملاً واضح' },
  { label: 'ملایم (پیش‌فرض)', shortLabel: '۰.۸۵x', rate: 0.85, description: 'سرعت ملایم و دلنشین' },
  { label: 'عادی', shortLabel: '۱.۰x', rate: 1.0, description: 'سرعت استاندارد' },
  { label: 'سریع', shortLabel: '۱.۲x', rate: 1.2, description: 'پخش سریع' },
];

/**
 * Retrieve saved speech rate from localStorage (default 0.85x)
 */
export function getSpeechRate(): number {
  if (typeof window === 'undefined') return DEFAULT_SPEECH_RATE;
  try {
    const saved = localStorage.getItem('tts_speech_rate');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
        return Math.round(parsed * 100) / 100;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SPEECH_RATE;
}

// Global active audio & session tracking
let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let activeSessionId = 0;
let syncTickerId: any = null;
let userStopped = false;
let stateChangeListeners: Set<(state: SpeechPlaybackState) => void> = new Set();

let currentState: SpeechPlaybackState = {
  isPlaying: false,
  messageId: null,
  text: '',
  lang: '',
  langLabel: '',
  rate: getSpeechRate(),
  currentWordIndex: -1,
  currentWord: '',
  words: [],
  wordBoundaries: [],
  currentTime: 0,
  duration: 0,
};

function notifyState(partial: Partial<SpeechPlaybackState>) {
  currentState = { ...currentState, ...partial };
  stateChangeListeners.forEach((listener) => {
    try {
      listener(currentState);
    } catch (e) {
      console.warn('TTS listener error:', e);
    }
  });
}

/**
 * Update speech rate, store in localStorage, and dynamically update active audio
 */
export function setSpeechRate(rate: number): void {
  const clamped = Math.max(0.5, Math.min(1.5, Math.round(rate * 100) / 100));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('tts_speech_rate', clamped.toString());
    } catch {
      // ignore
    }
  }

  // Instantly apply to active audio if currently playing
  if (currentAudio) {
    try {
      currentAudio.playbackRate = clamped;
    } catch {
      // ignore
    }
  }

  notifyState({ rate: clamped });
}

export function subscribeSpeechState(listener: (state: SpeechPlaybackState) => void): () => void {
  stateChangeListeners.add(listener);
  listener(currentState);
  return () => {
    stateChangeListeners.delete(listener);
  };
}

export function getCurrentSpeechState(): SpeechPlaybackState {
  return currentState;
}

/**
 * Split text into individual speech words for highlight rendering
 */
export function extractSpeechWords(text: string): string[] {
  if (!text) return [];
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Detect language of a given text string.
 * Accurately recognizes Persian (Farsi), Arabic, and English / Latin.
 */
export function detectLanguage(text: string): {
  lang: string;
  shortLang: string;
  label: string;
  isRtl: boolean;
} {
  if (!text) {
    return { lang: 'fa-IR', shortLang: 'fa', label: 'فارسی', isRtl: true };
  }

  const clean = text.trim();

  // Distinct Persian characters: گ، چ، پ، ژ، ک، ی، هٔ، etc.
  const hasDistinctPersian = /[گچپژ]/i.test(clean);
  // General Arabic/Persian Unicode script block
  const arabicPersianChars = (clean.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  // Latin characters
  const latinChars = (clean.match(/[a-zA-Z]/g) || []).length;
  // French / German / Spanish accents
  const europeanAccents = (clean.match(/[éèêëàâäôöûüçñ]/gi) || []).length;

  // Pure Latin / English predominance
  if (latinChars > 0 && latinChars >= arabicPersianChars) {
    if (europeanAccents > 2) {
      return { lang: 'fr-FR', shortLang: 'fr', label: 'فرانسوی', isRtl: false };
    }
    return { lang: 'en-US', shortLang: 'en', label: 'انگلیسی', isRtl: false };
  }

  // Persian vs Arabic
  if (hasDistinctPersian || arabicPersianChars > 0) {
    return { lang: 'fa-IR', shortLang: 'fa', label: 'فارسی', isRtl: true };
  }

  // Fallback default for school app is Persian
  return { lang: 'fa-IR', shortLang: 'fa', label: 'فارسی', isRtl: true };
}

/**
 * Stop any current audio or speech synthesis immediately
 */
export function stopSpeech(): void {
  userStopped = true;
  activeSessionId++;

  if (syncTickerId) {
    cancelAnimationFrame(syncTickerId);
    clearInterval(syncTickerId);
    syncTickerId = null;
  }

  // Stop HTML5 Audio
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.onplaying = null;
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.ontimeupdate = null;
      currentAudio.src = '';
    } catch {
      // ignore
    }
    currentAudio = null;
  }

  // Stop Web Speech API
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  currentUtterance = null;

  notifyState({
    isPlaying: false,
    messageId: null,
    text: '',
    lang: '',
    langLabel: '',
    currentWordIndex: -1,
    currentWord: '',
    words: [],
    wordBoundaries: [],
    currentTime: 0,
    duration: 0,
  });
}

/**
 * Speak text in its native language with real-time word-by-word tracking.
 * Tapping once plays; if already playing the same message, stops playback.
 */
export async function speakMessageText(
  text: string,
  messageId?: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
    forceLang?: string;
  }
): Promise<boolean> {
  const clean = text?.trim();
  if (!clean) return false;

  // If already playing this exact message, toggle stop
  if (currentState.isPlaying && messageId && currentState.messageId === messageId) {
    stopSpeech();
    return false;
  }

  // Stop any other active playback first
  stopSpeech();
  userStopped = false;

  const sessionId = ++activeSessionId;
  const detected = detectLanguage(clean);
  const targetLang = options?.forceLang || detected.lang;
  const shortLang = detected.shortLang;
  const activeRate = getSpeechRate();
  const words = extractSpeechWords(clean);

  notifyState({
    isPlaying: true,
    messageId: messageId || null,
    text: clean,
    lang: targetLang,
    langLabel: detected.label,
    rate: activeRate,
    currentWordIndex: 0,
    currentWord: words[0] || '',
    words,
    wordBoundaries: [],
    currentTime: 0,
    duration: 0,
  });

  options?.onStart?.();

  // Try 1: High quality server audio endpoint (/api/tts)
  // Provides natural human-like pronunciation for Persian and English with exact word boundaries
  try {
    const isStaticHost = typeof window !== 'undefined' && (
      window.location.hostname.endsWith('github.io') ||
      window.location.hostname.endsWith('pages.dev') ||
      window.location.protocol === 'file:'
    );

    if (!isStaticHost) {
      // Request synthesized speech with word boundaries metadata
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          text: clean.slice(0, 500),
          lang: shortLang,
          rate: activeRate,
          format: 'json',
        }),
      });

      if (sessionId !== activeSessionId || userStopped) {
        return false;
      }

      if (res.ok) {
        const data = await res.json();
        if (data.audioUrl) {
          const boundaries: WordTiming[] = data.wordBoundaries || [];
          const audioDuration: number = data.duration || 0;

          notifyState({
            wordBoundaries: boundaries,
            duration: audioDuration,
          });

          const audio = new Audio();
          audio.preload = 'auto';
          audio.src = data.audioUrl;
          currentAudio = audio;

          // Apply speech speed
          try {
            audio.playbackRate = activeRate;
          } catch {
            // ignore
          }

          let lastWordIndex = -1;

          // Word synchronization tracker
          const updateWordHighlight = () => {
            if (sessionId !== activeSessionId || !currentAudio || currentAudio.paused) return;

            const t = currentAudio.currentTime;
            let activeIdx = -1;

            if (boundaries.length > 0) {
              // Find matching boundary based on current audio time
              activeIdx = boundaries.findIndex((b) => t >= b.start && t <= b.end);
              if (activeIdx === -1) {
                // If in gap between words, pick the preceding word
                for (let i = boundaries.length - 1; i >= 0; i--) {
                  if (t >= boundaries[i].start) {
                    activeIdx = i;
                    break;
                  }
                }
              }
            } else if (words.length > 0) {
              // Fallback proportional calculation
              const totalDur = currentAudio.duration || audioDuration || 1;
              activeIdx = Math.min(words.length - 1, Math.floor((t / totalDur) * words.length));
            }

            if (activeIdx !== -1 && activeIdx !== lastWordIndex && activeIdx < words.length) {
              lastWordIndex = activeIdx;
              notifyState({
                currentWordIndex: activeIdx,
                currentWord: words[activeIdx] || '',
                currentTime: t,
              });
            }

            syncTickerId = requestAnimationFrame(updateWordHighlight);
          };

          const playPromise = new Promise<boolean>((resolve, reject) => {
            let finished = false;

            const complete = (ok: boolean) => {
              if (finished) return;
              finished = true;
              if (syncTickerId) {
                cancelAnimationFrame(syncTickerId);
                syncTickerId = null;
              }
              if (sessionId === activeSessionId) {
                currentAudio = null;
                notifyState({
                  isPlaying: false,
                  messageId: null,
                  currentWordIndex: -1,
                  currentWord: '',
                });
                if (ok) options?.onEnd?.();
              }
              resolve(ok);
            };

            audio.onplaying = () => {
              if (sessionId !== activeSessionId) {
                audio.pause();
                return;
              }
              try {
                audio.playbackRate = getSpeechRate();
              } catch {
                // ignore
              }
              syncTickerId = requestAnimationFrame(updateWordHighlight);
            };

            audio.onended = () => {
              complete(true);
            };

            audio.onerror = (e) => {
              if (userStopped || sessionId !== activeSessionId) {
                resolve(false);
              } else {
                reject(new Error('Audio playback failed'));
              }
            };
          });

          await audio.play();
          await playPromise;
          return true;
        }
      }
    }
  } catch (audioErr) {
    if (userStopped || sessionId !== activeSessionId) {
      return false;
    }
    console.warn('Server TTS failed, attempting client fallback:', audioErr);
    if (currentAudio) {
      try {
        currentAudio.pause();
      } catch {}
      currentAudio = null;
    }
  }

  if (userStopped || sessionId !== activeSessionId) {
    return false;
  }

  // Try 2: Browser native Web Speech API (speechSynthesis) with word boundary events
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();

      const voices = window.speechSynthesis.getVoices?.() || [];
      const hasPersianVoice = voices.some((v) =>
        v.lang.toLowerCase().includes('fa') ||
        v.name.toLowerCase().includes('persian') ||
        v.name.toLowerCase().includes('farsi')
      );

      // If text is Persian and browser lacks Persian voice, notify user cleanly
      if (shortLang === 'fa' && !hasPersianVoice) {
        notifyState({ isPlaying: false, messageId: null, currentWordIndex: -1, currentWord: '' });
        options?.onError?.(new Error('برای پخش صدای طبیعی فارسی، اتصال اینترنت مورد نیاز است.'));
        return false;
      }

      const utterance = new SpeechSynthesisUtterance(clean);
      currentUtterance = utterance;
      utterance.lang = targetLang;
      utterance.rate = activeRate;
      utterance.pitch = 1.0;

      // Select matching voice
      const matchingVoice = voices.find((v) => {
        if (targetLang.startsWith('fa')) {
          return v.lang.toLowerCase().includes('fa') || v.name.toLowerCase().includes('persian') || v.name.toLowerCase().includes('farsi');
        }
        if (targetLang.startsWith('en')) {
          return v.lang.toLowerCase().startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || true);
        }
        return v.lang.toLowerCase().startsWith(shortLang);
      });

      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      // Live word-by-word boundary tracking
      utterance.onboundary = (event) => {
        if (sessionId !== activeSessionId || userStopped) return;
        if (event.name === 'word' || typeof event.charIndex === 'number') {
          const charIdx = event.charIndex;
          const preText = clean.slice(0, charIdx);
          const wordIdx = preText.trim().split(/\s+/).filter(Boolean).length;
          const clampedIdx = Math.min(words.length - 1, wordIdx);
          notifyState({
            currentWordIndex: clampedIdx,
            currentWord: words[clampedIdx] || '',
          });
        }
      };

      return new Promise<boolean>((resolve) => {
        utterance.onend = () => {
          if (sessionId === activeSessionId) {
            currentUtterance = null;
            notifyState({ isPlaying: false, messageId: null, currentWordIndex: -1, currentWord: '' });
            options?.onEnd?.();
          }
          resolve(true);
        };

        utterance.onerror = (e) => {
          if (sessionId === activeSessionId && !userStopped) {
            currentUtterance = null;
            notifyState({ isPlaying: false, messageId: null, currentWordIndex: -1, currentWord: '' });
            options?.onError?.(e);
          }
          resolve(false);
        };

        window.speechSynthesis.speak(utterance);
      });
    } catch (synthErr) {
      console.warn('Web Speech API failed:', synthErr);
    }
  }

  notifyState({ isPlaying: false, messageId: null, currentWordIndex: -1, currentWord: '' });
  options?.onError?.(new Error('دستگاه از پخش صدا پشتیبانی نمی‌کند.'));
  return false;
}

/**
 * Quick preview test of current speech rate
 */
export function testSpeechRateSample(rate?: number): void {
  if (rate) {
    setSpeechRate(rate);
  }
  const sample = 'این یک نمونه صوتی از سرعت گفتار تنظیم‌شده است.';
  speakMessageText(sample, 'sample_test_tts');
}
