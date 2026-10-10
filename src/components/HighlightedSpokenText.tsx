import React from 'react';

interface HighlightedSpokenTextProps {
  text: string;
  isPlaying: boolean;
  activeWordIndex: number;
  selectedWordIndex?: number | null;
  onWordClick?: (wordIndex: number, wordText: string) => void;
  className?: string;
  activeWordClassName?: string;
}

/**
 * Renders spoken text with both Line-by-Line (خط به خط) and Word-by-Word (کلمه به کلمه) highlighting.
 * Supports interactive mobile tap on any word to highlight it in bold yellow and show its translation beneath!
 */
export const HighlightedSpokenText: React.FC<HighlightedSpokenTextProps> = ({
  text,
  isPlaying,
  activeWordIndex,
  selectedWordIndex = null,
  onWordClick,
  className = '',
  activeWordClassName,
}) => {
  if (!text) return null;

  const lines = text.split('\n');
  const isMultiLine = lines.length > 1;

  // If a word is manually selected, that line is also active
  const targetHighlightWordIndex =
    selectedWordIndex !== null && selectedWordIndex !== undefined && selectedWordIndex >= 0
      ? selectedWordIndex
      : isPlaying && activeWordIndex >= 0
      ? activeWordIndex
      : -1;

  // Determine which line contains the active or selected word
  let activeLineIndex = 0;
  if (targetHighlightWordIndex >= 0) {
    let wordAccumulator = 0;
    for (let l = 0; l < lines.length; l++) {
      const lineWordsCount = lines[l].trim().split(/\s+/).filter(Boolean).length;
      if (lineWordsCount > 0) {
        wordAccumulator += lineWordsCount;
        if (targetHighlightWordIndex < wordAccumulator) {
          activeLineIndex = l;
          break;
        }
      }
    }
  }

  let globalWordCounter = 0;

  return (
    <span className={className}>
      {lines.map((line, lineIdx) => {
        const isCurrentLine = targetHighlightWordIndex >= 0 && lineIdx === activeLineIndex;
        const tokens = line.split(/(\s+)/);

        return (
          <span
            key={lineIdx}
            className={`block transition-all duration-200 ${
              isMultiLine
                ? isCurrentLine
                  ? 'bg-emerald-500/20 border-r-2 border-emerald-400 pr-1.5 pl-1 py-0.5 my-1 rounded-md shadow-sm ring-1 ring-emerald-500/30'
                  : 'opacity-90 py-0.5'
                : 'inline'
            }`}
          >
            {tokens.map((token, tokenIdx) => {
              // Preserve spaces and whitespace
              if (/^\s+$/.test(token)) {
                return <span key={tokenIdx}>{token}</span>;
              }

              const currentWordIdx = globalWordCounter;
              const isSelectedWord = selectedWordIndex === currentWordIdx;
              const isSpokenActiveWord = isPlaying && activeWordIndex === currentWordIdx;
              const isHighlighted = isSelectedWord || isSpokenActiveWord;
              const isPastSpokenWord = isPlaying && activeWordIndex >= 0 && currentWordIdx < activeWordIndex;

              globalWordCounter++;

              if (isHighlighted) {
                return (
                  <mark
                    key={tokenIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onWordClick?.(currentWordIdx, token);
                    }}
                    className={
                      activeWordClassName ||
                      'bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded-md shadow-md ring-2 ring-amber-300 scale-105 inline-block transition-all duration-100 mx-0.5 cursor-pointer select-none'
                    }
                    title="کلمه انتخاب‌شده - ضربه برای ترجمه مجدد"
                  >
                    {token}
                  </mark>
                );
              }

              if (isPastSpokenWord) {
                return (
                  <span
                    key={tokenIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onWordClick?.(currentWordIdx, token);
                    }}
                    className="text-emerald-300 font-semibold inline-block transition-colors cursor-pointer hover:bg-emerald-500/20 active:scale-95 px-0.5 rounded"
                    title="ضربه برای مشاهده ترجمه با فونت مشکی"
                  >
                    {token}
                  </span>
                );
              }

              return (
                <span
                  key={tokenIdx}
                  onClick={(e) => {
                    e.stopPropagation();
                    onWordClick?.(currentWordIdx, token);
                  }}
                  className="opacity-95 inline-block cursor-pointer hover:bg-white/15 active:bg-amber-300/30 active:scale-95 rounded px-0.5 transition-all select-none"
                  title="ضربه با انگشت برای هایلایت زرد و نمایش ترجمه در پایین"
                >
                  {token}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
};
