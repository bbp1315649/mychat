/**
 * Speech to Text (Voice to Written Text / تبدیل گفتار به متن)
 * Uses Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * with Persian (fa-IR) support and fallback simulations for schools.
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

export function startSpeechToText(options: SpeechRecognitionOptions): SpeechRecognitionController {
  const SpeechRec = (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;

  let recognition: any = null;
  let isCancelled = false;
  let accumulatedTranscript = '';

  if (SpeechRec) {
    try {
      recognition = new SpeechRec();
      recognition.lang = options.lang || 'fa-IR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        if (isCancelled) return;
        let interim = '';
        let finalSection = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalSection += text + ' ';
          } else {
            interim += text;
          }
        }

        if (finalSection) {
          accumulatedTranscript += finalSection;
        }

        const fullText = (accumulatedTranscript + interim).trim();
        if (fullText) {
          options.onResult(fullText, !!finalSection && !interim);
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
