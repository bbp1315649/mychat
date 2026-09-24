/**
 * Speech to Text (Voice to Written Text / تبدیل گفتار به متن)
 * Uses Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * with Persian (fa-IR) support, anti-repetition deduplication, and fallback simulations.
 */

export interface SpeechRecognitionController {
  stop: () => void;
  cancel: () => void;
  isSupported: boolean;
}

export interface SpeechRecognitionOptions {
  lang?: 'fa-IR' | 'en-US';
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

// Preset school teacher phrases for quick simulation/fallback when mic is blocked
export const SCHOOL_VOICE_TEMPLATES = [
  'سلام همکار گرامی، لطفاً لیست نمرات مستمر را ارسال فرمایید.',
  'فردا ساعت ۱۰ صبح جلسه شورای دبیران در دفتر آموزشگاه تشکیل می‌شود.',
  'دانش‌آموزان پایه نهم فردا آزمون هماهنگ ریاضی دارند.',
  'لطفاً طرح درس ماهانه را تا پایان هفته در سامانه بارگذاری فرمایید.',
  'کلاس فوق‌العاده علوم تجربی روز دوشنبه در آزمایشگاه برگزار خواهد شد.',
  'سلام و خسته نباشید، گزارش حضور و غیاب امروز ثبت گردید.',
];

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/**
 * Remove immediate consecutive duplicate words, phrases, and repeated clauses
 * which can occur due to speech engine echoes or rapid browser callbacks.
 */
export function deduplicateSpokenText(text: string): string {
  if (!text) return '';
  let current = text.replace(/\s+/g, ' ').trim();
  let prev = '';
  let iterations = 0;

  while (current !== prev && iterations < 5) {
    prev = current;
    iterations++;

    // 1. Check if the entire string consists of 2 identical halves
    const half = Math.floor(current.length / 2);
    for (let len = half; len >= 3; len--) {
      const chunk = current.slice(0, len).trim();
      if (chunk.length >= 3 && current === `${chunk} ${chunk}`) {
        current = chunk;
        break;
      }
    }

    // 2. Remove consecutive repeated word sequences of length 1 to 10 words
    const words = current.split(' ').filter(Boolean);
    let i = 0;
    const result: string[] = [];

    while (i < words.length) {
      let matched = false;
      const maxPhraseLen = Math.min(10, Math.floor((words.length - i) / 2));

      for (let phraseLen = maxPhraseLen; phraseLen >= 1; phraseLen--) {
        const phrase1 = words.slice(i, i + phraseLen).join(' ');
        const phrase2 = words.slice(i + phraseLen, i + 2 * phraseLen).join(' ');

        if (phrase1.toLowerCase() === phrase2.toLowerCase()) {
          for (let k = 0; k < phraseLen; k++) {
            result.push(words[i + k]);
          }
          i += 2 * phraseLen;
          matched = true;
          break;
        }
      }

      if (!matched) {
        result.push(words[i]);
        i++;
      }
    }

    current = result.join(' ').trim();
  }

  return current;
}

export function startSpeechToText(options: SpeechRecognitionOptions): SpeechRecognitionController {
  const SpeechRec = (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;

  let recognition: any = null;
  let isCancelled = false;

  if (SpeechRec) {
    try {
      recognition = new SpeechRec();
      recognition.lang = options.lang || 'fa-IR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        if (isCancelled) return;

        let finalTranscript = '';
        let interimTranscript = '';

        // Web Speech API standard: calculate current state from all results in event.results
        // DO NOT additively append to an external accumulator on every event, as Chrome
        // re-sends or updates the results list and will cause sentences to repeat!
        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          const chunk = item[0]?.transcript || '';
          if (item.isFinal) {
            finalTranscript += chunk + ' ';
          } else {
            interimTranscript += chunk;
          }
        }

        const rawCombined = (finalTranscript + interimTranscript).trim();
        const cleaned = deduplicateSpokenText(rawCombined);

        if (cleaned) {
          options.onResult(cleaned, !interimTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (isCancelled) return;
        console.warn('Speech recognition status:', event.error);
        if (event.error === 'not-allowed') {
          options.onError?.('دسترسی به میکروفون برای تبدیل گفتار داده نشد.');
        } else if (event.error === 'no-speech') {
          // Normal silence, can ignore or continue
        } else {
          options.onError?.(event.error);
        }
      };

      recognition.onend = () => {
        if (!isCancelled) {
          options.onEnd?.();
        }
      };

      recognition.start();

      return {
        isSupported: true,
        stop: () => {
          isCancelled = true;
          try {
            recognition.stop();
          } catch (e) {
            // ignore
          }
        },
        cancel: () => {
          isCancelled = true;
          try {
            recognition.abort();
          } catch (e) {
            // ignore
          }
        }
      };
    } catch (err: any) {
      console.warn('Could not initialize SpeechRecognition:', err);
    }
  }

  // Fallback if SpeechRecognition is not supported or failed
  return {
    isSupported: false,
    stop: () => {
      isCancelled = true;
    },
    cancel: () => {
      isCancelled = true;
    }
  };
}
