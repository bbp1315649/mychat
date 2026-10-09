import React from 'react';

interface HighlightedSpokenTextProps {
  text: string;
  isPlaying: boolean;
  activeWordIndex: number;
  className?: string;
  activeWordClassName?: string;
}

/**
 * Renders spoken text with both Line-by-Line (خط به خط) and Word-by-Word (کلمه به کلمه) highlighting.
 * As the speech engine reads:
 * 1. The ACTIVE LINE is highlighted with a soft emerald accent and right border.
 * 2. The ACTIVE WORD within that line is prominently highlighted in glowing amber/gold.
 * 3. Read words turn into a soft emerald shade, while future words stay clear.
 */
export const HighlightedSpokenText: React.FC<HighlightedSpokenTextProps> = ({
  text,
  isPlaying,
  activeWordIndex,
  className = '',
  activeWordClassName,
}) => {
  if (!text) return null;

  // When not playing or no word active, render standard text
  if (!isPlaying || activeWordIndex < 0) {
    return <span className={className}>{text}</span>;
  }

  const lines = text.split('\n');
  const isMultiLine = lines.length > 1;

  // Determine which line contains the activeWordIndex
  let activeLineIndex = 0;
  let wordAccumulator = 0;
  for (let l = 0; l < lines.length; l++) {
    const lineWordsCount = lines[l].trim().split(/\s+/).filter(Boolean).length;
    if (lineWordsCount > 0) {
      wordAccumulator += lineWordsCount;
      if (activeWordIndex < wordAccumulator) {
        activeLineIndex = l;
        break;
      }
    }
  }

  let globalWordCounter = 0;

  return (
    <span className={className}>
      {lines.map((line, lineIdx) => {
        const isCurrentLine = lineIdx === activeLineIndex;
        const tokens = line.split(/(\s+)/);

        return (
          <span
            key={lineIdx}
            className={`block transition-all duration-200 ${
              isMultiLine
                ? isCurrentLine
                  ? 'bg-emerald-500/20 border-r-2 border-emerald-400 pr-1.5 pl-1 py-0.5 my-1 rounded-md shadow-sm ring-1 ring-emerald-500/30'
                  : 'opacity-85 py-0.5'
                : 'inline'
            }`}
          >
            {tokens.map((token, tokenIdx) => {
              // Preserve spaces and whitespace
              if (/^\s+$/.test(token)) {
                return <span key={tokenIdx}>{token}</span>;
              }

              const isCurrentWord = globalWordCounter === activeWordIndex;
              const isPastWord = globalWordCounter < activeWordIndex;
              globalWordCounter++;

              if (isCurrentWord) {
                return (
                  <mark
                    key={tokenIdx}
                    className={
                      activeWordClassName ||
                      'bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded-md shadow-md ring-2 ring-amber-300 scale-105 inline-block transition-all duration-100 mx-0.5'
                    }
                  >
                    {token}
                  </mark>
                );
              }

              if (isPastWord) {
                return (
                  <span
                    key={tokenIdx}
                    className="text-emerald-300 font-semibold inline-block transition-colors"
                  >
                    {token}
                  </span>
                );
              }

              return (
                <span key={tokenIdx} className="opacity-90 inline-block">
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
