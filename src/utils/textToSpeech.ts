/**
 * Text-to-Speech (TTS) Utility for School Chat
 * Supports automatic language detection (Persian, English, Arabic, etc.),
 * multi-engine synthesis (Server-side natural audio + Web Speech API fallback),
 * and clean state management.
 */

export interface SpeechPlaybackState {
  isPlaying: boolean;
  messageId: string | null;
  text: string;
  lang: string;
  langLabel: string;
}

// Global active audio instance for HTML5 Audio playback
let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let stateChangeListeners: Set<(state: SpeechPlaybackState) => void> = new Set();

let currentState: SpeechPlaybackState = {
  isPlaying: false,
  messageId: null,
  text: '',
  lang: '',
  langLabel: '',
};

function notifyState(partial: Partial<SpeechPlaybackState>) {
  currentState = { ...currentState, ...partial };
  stateChangeListeners.forEach(listener => {
    try {
      listener(currentState);
    } catch (e) {
      console.warn('TTS listener error:', e);
    }
  });
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
    // Check if Persian
    return { lang: 'fa-IR', shortLang: 'fa', label: 'فارسی', isRtl: true };
  }

  // Fallback default for school app is Persian
  return { lang: 'fa-IR', shortLang: 'fa', label: 'فارسی', isRtl: true };
}

/**
 * Stop any current audio or speech synthesis immediately
 */
export function stopSpeech(): void {
  // Stop HTML5 Audio
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
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
  });
}

/**
 * Speak text in its native language.
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

  const detected = detectLanguage(clean);
  const targetLang = options?.forceLang || detected.lang;
  const shortLang = detected.shortLang;

  notifyState({
    isPlaying: true,
    messageId: messageId || null,
    text: clean,
    lang: targetLang,
    langLabel: detected.label,
  });

  options?.onStart?.();

  // Try 1: High quality server audio endpoint (/api/tts)
  // Provides natural human-like pronunciation for Persian and English
  try {
    const isStaticHost = typeof window !== 'undefined' && (
      window.location.hostname.endsWith('github.io') ||
      window.location.hostname.endsWith('pages.dev') ||
      window.location.protocol === 'file:'
    );

    if (!isStaticHost) {
      const audioUrl = `/api/tts?text=${encodeURIComponent(clean.slice(0, 400))}&lang=${encodeURIComponent(shortLang)}`;
      const audio = new Audio(audioUrl);
      currentAudio = audio;

      const playPromise = new Promise<boolean>((resolve, reject) => {
        let hasStarted = false;

        audio.onplaying = () => {
          hasStarted = true;
        };

        audio.onended = () => {
          if (currentAudio === audio) {
            currentAudio = null;
            notifyState({ isPlaying: false, messageId: null, text: '' });
            options?.onEnd?.();
          }
          resolve(true);
        };

        audio.onerror = () => {
          reject(new Error('Audio playback failed'));
        };

        // Safety timeout if audio cannot load within 4 seconds
        setTimeout(() => {
          if (!hasStarted && currentAudio === audio) {
            reject(new Error('Audio load timeout'));
          }
        }, 4000);
      });

      await audio.play();
      // Successfully started playing via server audio!
      await playPromise;
      return true;
    }
  } catch (audioErr) {
    // If server audio failed or timed out, gracefully continue to Web Speech API fallback
    if (currentAudio) {
      try {
        currentAudio.pause();
      } catch {}
      currentAudio = null;
    }
  }

  // Try 2: Browser native Web Speech API (speechSynthesis)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(clean);
      currentUtterance = utterance;
      utterance.lang = targetLang;
      utterance.rate = 0.95; // slightly relaxed natural pace
      utterance.pitch = 1.0;

      // Select matching voice if available
      const voices = window.speechSynthesis.getVoices?.() || [];
      const matchingVoice = voices.find(v => {
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

      return new Promise<boolean>((resolve) => {
        utterance.onend = () => {
          if (currentUtterance === utterance) {
            currentUtterance = null;
            notifyState({ isPlaying: false, messageId: null, text: '' });
            options?.onEnd?.();
          }
          resolve(true);
        };

        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis error:', e);
          if (currentUtterance === utterance) {
            currentUtterance = null;
            notifyState({ isPlaying: false, messageId: null, text: '' });
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

  notifyState({ isPlaying: false, messageId: null, text: '' });
  options?.onError?.(new Error('دستگاه از پخش صدا پشتیبانی نمی‌کند.'));
  return false;
}
