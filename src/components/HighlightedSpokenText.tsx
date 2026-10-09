import React from 'react';

interface HighlightedSpokenTextProps {
  text: string;
  isPlaying: boolean;
  activeWordIndex: number;
  className?: string;
  activeWordClassName?: string;
}

/**
 * Renders spoken text with karaoke-style word-by-word highlighting.
 * As the speech engine pronounces each word, that specific word is
 * dynamically highlighted in a bright, high-contrast badge (amber/gold),
 * previously read words are tinted soft emerald, and upcoming words remain normal.
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

  // Split text by whitespace tokens while retaining words and delimiters (spaces, newlines)
  const tokens = text.split(/(\s+)/);
  let wordCounter = 0;

  return (
    <span className={className}>
      {tokens.map((token, idx) => {
        // Retain whitespace and newline tokens exactly as in the original text
        if (/^\s+$/.test(token)) {
          return <span key={idx}>{token}</span>;
        }

        const isCurrent = wordCounter === activeWordIndex;
        const isPast = wordCounter < activeWordIndex;
        wordCounter++;

        if (isCurrent) {
          return (
            <mark
              key={idx}
              className={
                activeWordClassName ||
                'bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded-md shadow-md ring-2 ring-amber-300 scale-105 inline-block transition-all duration-100 mx-0.5'
              }
            >
              {token}
            </mark>
          );
        }

        if (isPast) {
          return (
            <span
              key={idx}
              className="text-emerald-300 font-semibold inline-block transition-colors"
            >
              {token}
            </span>
          );
        }

        return (
          <span key={idx} className="opacity-85 inline-block">
            {token}
          </span>
        );
      })}
    </span>
  );
};
