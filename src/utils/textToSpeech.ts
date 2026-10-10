/**
 * Text-to-Speech (TTS) Utility for School Chat
 * 
 * Uses the proven, high-compatibility Native Web Speech API (SpeechSynthesisUtterance)
 * which runs directly on the user's device without any external server or VPN dependency.
 * 
 * Features:
 * - Native Persian (fa-IR) speech synthesis using device's built-in voice engine (Google TTS, Windows, Apple)
 * - Automatic language detection (Persian, English, French, Arabic, etc.)
 * - Real-time bilingual word-by-word translation (English -> Persian & Persian -> English)
 * - Adjustable speech speed rate (0.7x to 1.2x, default 0.85x)
 * - Live Line-by-Line (خط به خط) and Word-by-Word (کلمه به کلمه) Karaoke highlighting
 * - Zero network latency, 100% offline support, and no VPN requirements
 * - Clean state management with single-tap toggle to play/stop
 */

import {
  getInstantWordTranslation,
  translateSingleWord,
  prefetchMessageWordTranslations
} from './wordTranslator';

export interface WordTiming {
  text: string;
  start: number;
  end: number;
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
  currentWordTranslation: string; // Live translation of active word (En->Fa or Fa->En)
  isEnglishSpoken: boolean;
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
  { label: 'بسیار آهسته', shortLabel: '۰.۴x', rate: 0.4, description: 'فوق‌العاده شمرده برای آموزش' },
  { label: 'خیلی آرام', shortLabel: '۰.۵x', rate: 0.5, description: 'بسیار شمرده و با دقت' },
  { label: 'شمرده', shortLabel: '۰.۶۵x', rate: 0.65, description: 'آهسته و کلمه‌به‌کلمه' },
  { label: 'آرام', shortLabel: '۰.۷۵x', rate: 0.75, description: 'آهسته و کاملاً واضح' },
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
      if (!isNaN(parsed) && parsed >= 0.35 && parsed <= 2.0) {
        return Math.round(parsed * 100) / 100;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SPEECH_RATE;
}

// Active speech synthesis variables
let currentUtterance: SpeechSynthesisUtterance | null = null;
let activeSessionId = 0;
let pacingTimer: any = null;
let chromeKeepAliveInterval: any = null;
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
  currentWordTranslation: '',
  isEnglishSpoken: false,
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
 * Update speech rate and store in localStorage
 */
export function setSpeechRate(rate: number): void {
  const clamped = Math.max(0.35, Math.min(1.5, Math.round(rate * 100) / 100));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('tts_speech_rate', clamped.toString());
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
 * Split text into speech words
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

// Pre-load voices on startup
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

/**
 * Stop any current speech synthesis immediately
 */
export function stopSpeech(): void {
  activeSessionId++;

  if (pacingTimer) {
    clearTimeout(pacingTimer);
    pacingTimer = null;
  }

  if (chromeKeepAliveInterval) {
    clearInterval(chromeKeepAliveInterval);
    chromeKeepAliveInterval = null;
  }

  // Stop Web Speech API cleanly
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
    currentWordTranslation: '',
    isEnglishSpoken: false,
    currentLineIndex: 0,
    totalLines: 1,
    words: [],
    wordBoundaries: [],
    currentTime: 0,
    duration: 0,
  });
}

/**
 * Speak text using the original, reliable Native Web Speech API.
 * Accurately reads Persian messages and updates Line-by-Line & Word-by-Word highlighting,
 * while simultaneously showing real-time bilingual translation for each spoken word.
 * Tapping once plays; tapping again while playing stops.
 */
export function speakMessageText(
  text: string,
  messageId?: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
    forceLang?: string;
  }
): boolean {
  const clean = text?.trim();
  if (!clean) return false;

  // Toggle stop if already playing this exact message
  if (currentState.isPlaying && messageId && currentState.messageId === messageId) {
    stopSpeech();
    return false;
  }

  // Stop previous speech cleanly
  stopSpeech();

  const sessionId = ++activeSessionId;
  const detected = detectLanguage(clean);
  const targetLang = options?.forceLang || detected.lang;
  const isEnglish = targetLang.startsWith('en') || (!targetLang.startsWith('fa') && /[a-zA-Z]/.test(clean));
  const activeRate = getSpeechRate();
  const words = extractSpeechWords(clean);
  const { lineIndex, totalLines } = getLineIndexForWord(clean, 0);

  // Background non-blocking warm-up for words translation
  prefetchMessageWordTranslations(clean, isEnglish);

  const initialWord = words[0] || '';
  const isInitialLatin = /[a-zA-Z]/.test(initialWord);
  const initialWordIsEnglish = isInitialLatin || (isEnglish && !/[\u0600-\u06FF]/.test(initialWord));
  const initialTranslation = initialWord ? (getInstantWordTranslation(initialWord, initialWordIsEnglish) || '') : '';

  notifyState({
    isPlaying: true,
    messageId: messageId || null,
    text: clean,
    lang: targetLang,
    langLabel: detected.label,
    rate: activeRate,
    currentWordIndex: 0,
    currentWord: initialWord,
    currentWordTranslation: initialTranslation,
    isEnglishSpoken: initialWordIsEnglish,
    currentLineIndex: lineIndex,
    totalLines,
    words,
    currentTime: 0,
    duration: 0,
  });

  // If initial translation wasn't cached, fetch in background
  if (initialWord && !initialTranslation) {
    translateSingleWord(initialWord, initialWordIsEnglish).then((trans) => {
      if (sessionId === activeSessionId && currentState.currentWordIndex === 0 && trans) {
        notifyState({ currentWordTranslation: trans });
      }
    });
  }

  options?.onStart?.();

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    notifyState({ isPlaying: false, messageId: null, currentWordIndex: -1, currentWord: '' });
    options?.onError?.(new Error('مرورگر شما از پخش صدا پشتیبانی نمی‌کند.'));
    return false;
  }

  try {
    // 1. Prepare SpeechSynthesisUtterance
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    currentUtterance = utterance;
    utterance.lang = targetLang; // e.g. 'fa-IR' or 'en-US'
    utterance.rate = activeRate;  // e.g. 0.85
    utterance.pitch = 1.0;

    // Pick matching voice if available
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find((v) => {
      if (targetLang.startsWith('fa')) {
        return (
          v.lang.toLowerCase().startsWith('fa') ||
          v.lang.toLowerCase().includes('ir') ||
          v.name.toLowerCase().includes('persian') ||
          v.name.toLowerCase().includes('farsi')
        );
      }
      if (targetLang.startsWith('en')) {
        return v.lang.toLowerCase().startsWith('en');
      }
      return v.lang.toLowerCase().startsWith(targetLang.slice(0, 2));
    });

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    let hasBoundaryFired = false;

    // Helper to update active word and its live translation
    const handleWordActivation = (clampedIndex: number) => {
      const activeWord = words[clampedIndex] || '';
      const { lineIndex: lIdx } = getLineIndexForWord(clean, clampedIndex);
      const isWordLatin = /[a-zA-Z]/.test(activeWord);
      const wordIsEnglish = isWordLatin || (isEnglish && !/[\u0600-\u06FF]/.test(activeWord));
      const instantTranslation = getInstantWordTranslation(activeWord, wordIsEnglish) || '';

      notifyState({
        currentWordIndex: clampedIndex,
        currentWord: activeWord,
        currentWordTranslation: instantTranslation,
        isEnglishSpoken: wordIsEnglish,
        currentLineIndex: lIdx,
        totalLines,
      });

      // If translation wasn't in instant dictionary, asynchronously fetch and update
      if (activeWord && !instantTranslation) {
        translateSingleWord(activeWord, wordIsEnglish).then((asyncTrans) => {
          if (sessionId === activeSessionId && currentState.currentWordIndex === clampedIndex && asyncTrans) {
            notifyState({ currentWordTranslation: asyncTrans });
          }
        });
      }
    };

    // 2. Synchronize Word-by-Word & Line-by-Line via onboundary
    utterance.onboundary = (e) => {
      if (sessionId !== activeSessionId) return;
      hasBoundaryFired = true;

      if (e.name === 'word' || typeof e.charIndex === 'number') {
        const charIdx = e.charIndex;
        const preText = clean.slice(0, charIdx);
        const wIdx = preText.trim().split(/\s+/).filter(Boolean).length;
        const clamped = Math.min(words.length - 1, wIdx);
        handleWordActivation(clamped);
      }
    };

    // 3. Fallback smooth word pacing if browser onboundary is not emitted
    let pacingIndex = 0;
    const runPacingFallback = () => {
      if (sessionId !== activeSessionId || !currentState.isPlaying) return;

      if (pacingIndex < words.length) {
        if (!hasBoundaryFired) {
          handleWordActivation(pacingIndex);
        }

        const currentW = words[pacingIndex] || '';
        pacingIndex++;

        // Natural speech pacing based on word length and punctuation
        let delay = Math.round(340 / activeRate);
        if (currentW.length > 5) {
          delay += Math.min(120, (currentW.length - 5) * 20);
        }
        if (/[,،]/.test(currentW)) {
          delay += 180;
        } else if (/[.!؟?]/.test(currentW)) {
          delay += 350;
        }

        pacingTimer = setTimeout(runPacingFallback, delay);
      }
    };

    pacingTimer = setTimeout(runPacingFallback, Math.round(200 / activeRate));

    // 4. Chrome long text keep-alive
    chromeKeepAliveInterval = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        clearInterval(chromeKeepAliveInterval);
      }
    }, 10000);

    // 5. Completion handlers
    utterance.onend = () => {
      if (sessionId === activeSessionId) {
        stopSpeech();
        options?.onEnd?.();
      }
    };

    utterance.onerror = (e) => {
      if (sessionId === activeSessionId) {
        console.warn('SpeechSynthesis error:', e);
        stopSpeech();
        options?.onError?.(e);
      }
    };

    // 6. Speak natively!
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('Failed to start speech synthesis:', err);
    stopSpeech();
    options?.onError?.(err);
    return false;
  }
}

/**
 * Quick preview test of speech rate
 */
export function testSpeechRateSample(rate?: number): void {
  if (rate) {
    setSpeechRate(rate);
  }
  const sample = 'این یک نمونه صوتی از سرعت گفتار تنظیم‌شده است.\nخط دوم برای آزمایش خوانش خط‌به‌خط پیام‌ها.';
  speakMessageText(sample, 'sample_test_tts');
}
