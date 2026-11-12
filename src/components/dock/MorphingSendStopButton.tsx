import React, { useRef } from 'react';
import { ArrowUp, Square } from 'lucide-react';

export interface MorphingSendStopButtonProps {
  isStreaming: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
  className?: string;
}

export const MorphingSendStopButton: React.FC<MorphingSendStopButtonProps> = ({
  isStreaming,
  canSend,
  onSend,
  onStop,
  className = '',
}) => {
  const lastClickRef = useRef<number>(0);

  const handleSendClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!canSend) return;

    const now = Date.now();
    // Debounce double-clicks within 350ms
    if (now - lastClickRef.current < 350) {
      return;
    }
    lastClickRef.current = now;
    onSend();
  };

  const handleStopClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onStop();
  };

  if (isStreaming) {
    return (
      <button
        type="button"
        data-testid="stop-generation-btn"
        aria-label="Stop generation"
        onClick={handleStopClick}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-error text-on-error shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error ${className}`}
        title="Stop generation"
      >
        <Square className="w-4 h-4 fill-current" />
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="send-message-btn"
      aria-label="Send message"
      disabled={!canSend}
      aria-disabled={!canSend}
      onClick={handleSendClick}
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        canSend
          ? 'bg-primary text-on-primary shadow-sm hover:scale-105 active:scale-95 cursor-pointer'
          : 'bg-surface-container text-outline opacity-50 cursor-not-allowed'
      } ${className}`}
      title="Send message"
    >
      <ArrowUp className="w-5 h-5 stroke-[2.5]" />
    </button>
  );
};
