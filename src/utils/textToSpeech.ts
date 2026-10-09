/**
 * Text-to-Speech (TTS) Utility for School Chat
 * Features:
 * - Dual-layer architecture: High-fidelity Server Neural Speech (when reachable) +
 *   Zero-failure Client Speech & Visual Pacing (works 100% without VPN, in Iran, or offline).
 * - Simultaneous Line-by-Line (خط به خط) and Word-by-Word (کلمه به کلمه) Karaoke highlighting.
 * - Millisecond-accurate word boundaries from EdgeTTS (DilaraNeural) when online.
 * - Natural human pacing with punctuation pauses and speech rate scaling (0.7x to 1.2x).
 * - Standard audio/mpeg Blob URLs for instant playback across all mobile browsers.
 * - Clean user gesture handling and safe cancellation with zero ghost playback.
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
  currentLineIndex: number;
  totalLines: number;
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
let currentBlobUrl: string | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let activeSessionId = 0;
let syncTickerId: any = null;
let clientPacingTimer: any = null;
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
  currentLineIndex: 0,
  totalLines: 1,
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
 * Maps a word index to its line index within multi-line text
 */
export function getLineIndexForWord(text: string, wordIndex: number): { lineIndex: number; totalLines: number } {
  if (!text || wordIndex < 0) return { lineIndex: 0, totalLines: 1 };
  const lines = text.split('\n');
  let accumulated = 0;
  for (let i = 0; i < lines.length; i++) {
    const count = lines[i].trim().split(/\s+/).filter(Boolean).length;
    if (count > 0) {
      accumulated += count;
      if (wordIndex < accumulated) {
        return { lineIndex: i, totalLines: lines.length };
      }
    }
  }
  return { lineIndex: Math.max(0, lines.length - 1), totalLines: lines.length };
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
 * Converts a base64 audio data URI to an object URL Blob
 * which is 100% compatible across mobile Safari and Android WebViews
 */
function base64ToBlobUrl(base64Data: string, mimeType = 'audio/mpeg'): string {
  const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const binaryStr = atob(base64Clean);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Stop any current audio or speech synthesis immediately
 */
export function stopSpeech(): void {
  userStopped = true;
  activeSessionId++;

  if (syncTickerId) {
    cancelAnimationFrame(syncTickerId);
    syncTickerId = null;
  }

  if (clientPacingTimer) {
    clearTimeout(clientPacingTimer);
    clientPacingTimer = null;
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

  if (currentBlobUrl) {
    try {
      URL.revokeObjectURL(currentBlobUrl);
    } catch {
      // ignore
    }
    currentBlobUrl = null;
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
    currentLineIndex: 0,
    totalLines: 1,
    words: [],
    wordBoundaries: [],
    currentTime: 0,
    duration: 0,
  });
}

/**
 * Client Speech & Visual Pacing Engine (Guaranteed to work without VPN, in Iran, or offline)
 * Runs browser speech synthesis while advancing line-by-line and word-by-word highlight.
 */
function startClientSpeechAndPacing(
  cleanText: string,
  targetLang: string,
  shortLang: string,
  activeRate: number,
  words: string[],
  sessionId: number,
  options?: { onEnd?: () => void; onError?: (err: any) => void }
): void {
  if (sessionId !== activeSessionId || userStopped) return;

  const lines = cleanText.split('\n');
  const totalLines = lines.length;

  // 1. Start browser speech synthesis if available
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();

      const voices = window.speechSynthesis.getVoices?.() || [];
      // Look for Persian voice, Arabic voice (which reads Persian alphabet), or system default
      const persianVoice = voices.find((v) =>
        v.lang.toLowerCase().includes('fa') ||
        v.name.toLowerCase().includes('persian') ||
        v.name.toLowerCase().includes('farsi')
      );
      const arabicVoice = voices.find((v) =>
        v.lang.toLowerCase().startsWith('ar') ||
        v.name.toLowerCase().includes('arabic')
      );
      const matchingVoice = persianVoice || arabicVoice || voices.find((v) => v.lang.toLowerCase().startsWith(shortLang)) || voices[0];

      const utterance = new SpeechSynthesisUtterance(cleanText);
      currentUtterance = utterance;
      utterance.lang = persianVoice ? 'fa-IR' : arabicVoice ? 'ar-SA' : targetLang;
      utterance.rate = activeRate;
      utterance.pitch = 1.0;

      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onboundary = (e) => {
        if (sessionId !== activeSessionId || userStopped) return;
        if (e.name === 'word' || typeof e.charIndex === 'number') {
          const charIdx = e.charIndex;
          const preText = cleanText.slice(0, charIdx);
          const wIdx = preText.trim().split(/\s+/).filter(Boolean).length;
          const clamped = Math.min(words.length - 1, wIdx);
          const { lineIndex } = getLineIndexForWord(cleanText, clamped);
          notifyState({
            currentWordIndex: clamped,
            currentWord: words[clamped] || '',
            currentLineIndex: lineIndex,
          });
        }
      };

      utterance.onend = () => {
        if (sessionId === activeSessionId) {
          currentUtterance = null;
          stopSpeech();
          options?.onEnd?.();
        }
      };

      utterance.onerror = () => {
        // Continue visual pacing even if voice engine throws error
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Client speechSynthesis start:', e);
    }
  }

  // 2. High-precision visual pacing loop (runs reliably whether audio is synthesized or offline)
  let currentWordIdx = 0;
  const advancePacing = () => {
    if (sessionId !== activeSessionId || userStopped) return;

    if (currentWordIdx >= words.length) {
      // Completed reading all words
      if (sessionId === activeSessionId) {
        stopSpeech();
        options?.onEnd?.();
      }
      return;
    }

    const { lineIndex } = getLineIndexForWord(cleanText, currentWordIdx);
    notifyState({
      currentWordIndex: currentWordIdx,
      currentWord: words[currentWordIdx] || '',
      currentLineIndex: lineIndex,
      totalLines,
    });

    const activeWord = words[currentWordIdx] || '';
    currentWordIdx++;

    // Calculate natural delay for this word based on length & punctuation
    // Average speech pace: ~320ms per word at 1.0x rate
    let delay = Math.round(330 / activeRate);

    // Longer words take slightly longer
    if (activeWord.length > 5) {
      delay += Math.min(150, (activeWord.length - 5) * 25);
    }

    // Punctuation pauses
    if (/[,،]/.test(activeWord)) {
      delay += 200; // comma pause
    } else if (/[.!؟?]/.test(activeWord)) {
      delay += 380; // sentence end pause
    }

    clientPacingTimer = setTimeout(advancePacing, delay);
  };

  advancePacing();
}

/**
 * Speak text in its native language with real-time Line-by-Line & Word-by-Word tracking.
 * Works seamlessly both with VPN (server neural synthesis) and without VPN (client speech & pacing).
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
  const { lineIndex, totalLines } = getLineIndexForWord(clean, 0);

  notifyState({
    isPlaying: true,
    messageId: messageId || null,
    text: clean,
    lang: targetLang,
    langLabel: detected.label,
    rate: activeRate,
    currentWordIndex: 0,
    currentWord: words[0] || '',
    currentLineIndex: lineIndex,
    totalLines,
    words,
    wordBoundaries: [],
    currentTime: 0,
    duration: 0,
  });

  options?.onStart?.();

  // Try 1: High quality server audio endpoint (/api/tts)
  // Protected with a strict 2-second timeout so users without VPN never get stuck!
  try {
    const isStaticHost = typeof window !== 'undefined' && (
      window.location.hostname.endsWith('github.io') ||
      window.location.hostname.endsWith('pages.dev') ||
      window.location.protocol === 'file:'
    );

    if (!isStaticHost) {
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
        signal: AbortSignal.timeout(2000), // Fast 2s timeout for non-VPN resiliency
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

          // Convert base64 to standard audio/mpeg Blob URL
          const blobUrl = base64ToBlobUrl(data.audioUrl, 'audio/mpeg');
          currentBlobUrl = blobUrl;

          const audio = new Audio();
          audio.preload = 'auto';
          audio.src = blobUrl;
          currentAudio = audio;

          // Apply speech speed
          try {
            audio.playbackRate = activeRate;
          } catch {
            // ignore
          }

          let lastWordIndex = -1;

          // Word & Line synchronization tracker
          const updateWordHighlight = () => {
            if (sessionId !== activeSessionId || !currentAudio || currentAudio.paused) return;

            const t = currentAudio.currentTime;
            let activeIdx = -1;

            if (boundaries.length > 0) {
              // Find matching boundary based on current audio time
              activeIdx = boundaries.findIndex((b) => t >= b.start && t <= b.end);
              if (activeIdx === -1) {
                for (let i = boundaries.length - 1; i >= 0; i--) {
                  if (t >= boundaries[i].start) {
                    activeIdx = i;
                    break;
                  }
                }
              }
            } else if (words.length > 0) {
              const totalDur = currentAudio.duration || audioDuration || 1;
              activeIdx = Math.min(words.length - 1, Math.floor((t / totalDur) * words.length));
            }

            if (activeIdx !== -1 && activeIdx !== lastWordIndex && activeIdx < words.length) {
              lastWordIndex = activeIdx;
              const { lineIndex: lIdx } = getLineIndexForWord(clean, activeIdx);
              notifyState({
                currentWordIndex: activeIdx,
                currentWord: words[activeIdx] || '',
                currentLineIndex: lIdx,
                totalLines,
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
                  currentLineIndex: 0,
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

            audio.onerror = () => {
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
    console.warn('Server TTS unavailable or timed out; activating zero-failure client speech & pacing.');
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

  // Try 2: Guaranteed Client Speech & Visual Pacing (works without VPN in Iran / offline)
  startClientSpeechAndPacing(clean, targetLang, shortLang, activeRate, words, sessionId, options);
  return true;
}

/**
 * Quick preview test of current speech rate
 */
export function testSpeechRateSample(rate?: number): void {
  if (rate) {
    setSpeechRate(rate);
  }
  const sample = 'این یک نمونه صوتی از سرعت گفتار تنظیم‌شده است.\nخط دوم برای نمایش خوانش خط‌به‌خط پیام‌ها.';
  speakMessageText(sample, 'sample_test_tts');
}
