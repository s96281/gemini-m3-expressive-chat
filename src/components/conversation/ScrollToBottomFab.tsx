import React from 'react';
import { ArrowDown } from 'lucide-react';

export interface ScrollToBottomFabProps {
  isVisible: boolean;
  hasUnread?: boolean;
  onClick: () => void;
  className?: string;
}

export const ScrollToBottomFab: React.FC<ScrollToBottomFabProps> = ({
  isVisible,
  hasUnread = false,
  onClick,
  className = '',
}) => {
  if (!isVisible) return null;

  return (
    <button
      type="button"
      data-testid="scroll-to-bottom-fab"
      aria-label="Scroll to bottom"
      onClick={onClick}
      className={`fixed bottom-24 right-6 z-30 p-2.5 rounded-full bg-surface-container-high text-on-surface border border-outline-variant/50 shadow-elevation-3 hover:bg-surface-container-highest hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      <ArrowDown className="w-4 h-4 text-primary icon" />
      {hasUnread && (
        <span
          data-testid="stream-pulse"
          className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-pulse ring-2 ring-surface"
        />
      )}
    </button>
  );
};
