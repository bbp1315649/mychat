import React, { useState, useEffect } from 'react';
import {
  X,
  Gauge,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Check,
  Sparkles
} from 'lucide-react';
import {
  getSpeechRate,
  setSpeechRate,
  SPEECH_RATE_PRESETS,
  DEFAULT_SPEECH_RATE,
  testSpeechRateSample,
  stopSpeech,
  subscribeSpeechState
} from '../utils/textToSpeech';
import { HighlightedSpokenText } from './HighlightedSpokenText';

interface SpeechSpeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_PHRASE = 'این یک نمونه صوتی از سرعت گفتار تنظیم‌شده است.\nخط دوم برای نمایش خوانش خط‌به‌خط پیام‌ها.';

export const SpeechSpeedModal: React.FC<SpeechSpeedModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentRate, setCurrentRateState] = useState<number>(getSpeechRate());
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);

  useEffect(() => {
    if (isOpen) {
      setCurrentRateState(getSpeechRate());
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = subscribeSpeechState((state) => {
      const isTest = state.isPlaying && state.messageId === 'sample_test_tts';
      setIsPlayingTest(isTest);
      setActiveWordIndex(isTest ? state.currentWordIndex : -1);
      setCurrentRateState(state.rate || getSpeechRate());
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleSelectPreset = (rate: number) => {
    setCurrentRateState(rate);
    setSpeechRate(rate);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentRateState(val);
    setSpeechRate(val);
  };

  const handleResetDefault = () => {
    setCurrentRateState(DEFAULT_SPEECH_RATE);
    setSpeechRate(DEFAULT_SPEECH_RATE);
  };

  const handleTestAudio = () => {
    if (isPlayingTest) {
      stopSpeech();
    } else {
      testSpeechRateSample(currentRate);
    }
  };

  const formatRateLabel = (rate: number): string => {
    if (rate <= 0.45) return 'بسیار آهسته و شمرده (آموزشی)';
    if (rate <= 0.55) return 'خیلی آرام و با دقت';
    if (rate <= 0.7) return 'شمرده و کلمه‌به‌کلمه';
    if (rate <= 0.8) return 'آرام و دقیق';
    if (rate <= 0.9) return 'ملایم و دلنشین (پیش‌نهادی)';
    if (rate <= 1.05) return 'عادی و استاندارد';
    return 'سریع';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in zoom-in-95 duration-150"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="px-4 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">تنظیم سرعت گفتار صوتی</h3>
              <p className="text-[10px] text-slate-400">تنظیم سرعت خواندن متن پیام‌ها</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopSpeech();
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 text-xs">
          {/* Current Rate Display Banner */}
          <div className="bg-gradient-to-r from-emerald-950/50 to-slate-800/60 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 mb-0.5">سرعت فعلی گفتار:</div>
              <div className="text-base font-black text-emerald-300 flex items-center gap-1.5 font-mono">
                <span>{currentRate.toFixed(2)}x</span>
                <span className="text-[11px] font-sans font-normal text-emerald-200/80">
                  ({formatRateLabel(currentRate)})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetDefault}
              className="text-[10px] text-slate-400 hover:text-emerald-300 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 flex items-center gap-1 transition-colors"
              title="بازنشانی به سرعت ملایم پیش‌فرض"
            >
              <RotateCcw className="w-3 h-3" />
              <span>پیش‌فرض</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-2">
              گزینه‌های سریع سرعت گفتار:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {SPEECH_RATE_PRESETS.map((preset) => {
                const isSelected = Math.abs(currentRate - preset.rate) < 0.03;
                return (
                  <button
                    key={preset.rate}
                    type="button"
                    onClick={() => handleSelectPreset(preset.rate)}
                    className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-md shadow-emerald-900/30 ring-1 ring-emerald-500/50'
                        : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-[10px] font-medium">{preset.label}</span>
                    <span className="text-[10px] opacity-75 font-mono font-bold">{preset.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slider for fine tuning */}
          <div className="space-y-1.5 bg-slate-800/40 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium">تنظیم دقیق سرعت:</span>
              <span className="font-mono text-emerald-400 font-bold">{currentRate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.35"
              max="1.3"
              step="0.05"
              value={currentRate}
              onChange={handleSliderChange}
              className="w-full accent-emerald-500 h-2 bg-slate-700 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
              <span>۰.۳۵x (فوق‌العاده آهسته)</span>
              <span>۰.۸۵x (ملایم)</span>
              <span>۱.۳x (سریع)</span>
            </div>
          </div>

          {/* Live Karaoke Preview Box in Modal */}
          <div className={`p-3 rounded-2xl border text-center transition-all ${
            isPlayingTest ? 'bg-black/50 border-amber-500/50 ring-1 ring-amber-500/30' : 'bg-slate-800/40 border-slate-800'
          }`}>
            <div className="text-[10px] text-slate-400 mb-1.5 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>پیش‌نمایش هایلایت کلمه‌به‌کلمه همزمان با خواندن:</span>
            </div>
            <p className="text-xs font-medium leading-relaxed select-none">
              <HighlightedSpokenText
                text={SAMPLE_PHRASE}
                isPlaying={isPlayingTest}
                activeWordIndex={activeWordIndex}
              />
            </p>
          </div>

          {/* Test Speech Button */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={handleTestAudio}
              className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                isPlayingTest
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200 hover:text-white'
              }`}
            >
              {isPlayingTest ? (
                <>
                  <VolumeX className="w-4 h-4 text-amber-400" />
                  <span>توقف تست صدا</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>تست سرعت گفتار (پخش نمونه با هایلایت)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-slate-850 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              stopSpeech();
              onClose();
            }}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>تأیید و بازگشت</span>
          </button>
        </div>
      </div>
    </div>
  );
};
