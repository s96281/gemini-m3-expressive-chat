import React, { useState, useRef } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

export interface ThinkingAccordionProps {
  reasoningContent: string;
  thinkingDuration?: number;
  isStreaming?: boolean;
}

export const ThinkingAccordion: React.FC<ThinkingAccordionProps> = ({
  reasoningContent,
  thinkingDuration = 0,
  isStreaming = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const userToggledRef = useRef(false);

  if (!reasoningContent) return null;

  const seconds = (thinkingDuration / 1000).toFixed(1);
  const durationLabel = isStreaming
    ? `Thinking (${seconds}s)...`
    : `Thought for ${seconds}s`;

  const handleToggle = () => {
    userToggledRef.current = true;
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      data-testid="thinking-accordion"
      className="my-2 rounded-2xl bg-surface-container-highest/60 border border-outline-variant/30 overflow-hidden text-xs font-mono transition-all duration-200"
    >
      <button
        type="button"
        data-testid="thinking-accordion-header"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/40 transition-colors text-left font-medium select-none"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span data-testid="thinking-duration" className="font-semibold text-primary">
            {durationLabel}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-outline transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        data-testid="thinking-accordion-content"
        style={{ display: isOpen ? 'block' : 'none' }}
        className="px-3.5 pb-3 pt-1 text-[11px] leading-relaxed text-on-surface-variant whitespace-pre-wrap border-t border-outline-variant/20 font-mono"
      >
        {reasoningContent}
      </div>
    </div>
  );
};
