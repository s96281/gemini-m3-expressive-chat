import React, { useState, useEffect, useRef } from 'react';
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  RotateCcw,
  Edit2,
} from 'lucide-react';
import { Role } from '../../types/chat';

export interface MessageActionToolbarProps {
  role: Role;
  content: string;
  isStreaming?: boolean;
  rating?: 'up' | 'down' | null;
  onRate?: (rating: 'up' | 'down' | null) => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  className?: string;
}

export const MessageActionToolbar: React.FC<MessageActionToolbarProps> = ({
  role,
  content,
  isStreaming = false,
  rating = null,
  onRate,
  onRegenerate,
  onEdit,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unmount cleanup: cancel any active speech synthesis and pending copy timeout
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(content);
      }
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  const handleToggleTTS = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsPlayingTTS((prev) => !prev);
      return;
    }

    if (isPlayingTTS) {
      window.speechSynthesis.cancel();
      setIsPlayingTTS(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.onend = () => setIsPlayingTTS(false);
      utterance.onerror = () => setIsPlayingTTS(false);
      window.speechSynthesis.speak(utterance);
      setIsPlayingTTS(true);
    }
  };

  const handleThumbsUp = () => {
    if (!onRate) return;
    onRate(rating === 'up' ? null : 'up');
  };

  const handleThumbsDown = () => {
    if (!onRate) return;
    onRate(rating === 'down' ? null : 'down');
  };

  const isUser = role === 'user';

  return (
    <div
      role="toolbar"
      aria-label="Message actions"
      className={`flex items-center gap-1 text-on-surface-variant ${className}`}
    >
      {/* Copy Button */}
      <button
        type="button"
        data-testid="copy-message-btn"
        aria-label={copied ? 'Copied to clipboard' : 'Copy message text'}
        onClick={handleCopy}
        className={`p-1.5 rounded-full hover:bg-surface-container-highest transition-colors ${
          copied ? 'copied text-primary' : 'hover:text-on-surface'
        }`}
        title={copied ? 'Copied!' : 'Copy'}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      {/* User-only Edit Button */}
      {isUser && onEdit && (
        <button
          type="button"
          data-testid="edit-message-btn"
          aria-label="Edit message"
          onClick={onEdit}
          className="p-1.5 rounded-full hover:text-on-surface hover:bg-surface-container-highest transition-colors"
          title="Edit"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Assistant-only Actions */}
      {!isUser && (
        <>
          {/* TTS Button */}
          <button
            type="button"
            data-testid="tts-read-btn"
            aria-label={isPlayingTTS ? 'Stop reading' : 'Read message aloud'}
            aria-pressed={isPlayingTTS}
            onClick={handleToggleTTS}
            className={`p-1.5 rounded-full hover:bg-surface-container-highest transition-colors ${
              isPlayingTTS ? 'active text-primary' : 'hover:text-on-surface'
            }`}
            title="Read aloud"
          >
            {isPlayingTTS ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Thumbs Up */}
          <button
            type="button"
            data-testid="thumbs-up-btn"
            aria-label="Thumbs up rating"
            aria-pressed={rating === 'up'}
            onClick={handleThumbsUp}
            className={`p-1.5 rounded-full hover:bg-surface-container-highest transition-colors ${
              rating === 'up'
                ? 'active text-primary bg-primary-container/20'
                : 'hover:text-on-surface'
            }`}
            title="Good response"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>

          {/* Thumbs Down */}
          <button
            type="button"
            data-testid="thumbs-down-btn"
            aria-label="Thumbs down rating"
            aria-pressed={rating === 'down'}
            onClick={handleThumbsDown}
            className={`p-1.5 rounded-full hover:bg-surface-container-highest transition-colors ${
              rating === 'down'
                ? 'active text-error bg-error-container/20'
                : 'hover:text-on-surface'
            }`}
            title="Poor response"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>

          {/* Regenerate Button */}
          {onRegenerate && (
            <button
              type="button"
              data-testid="regenerate-btn"
              aria-label="Regenerate response"
              disabled={isStreaming}
              onClick={onRegenerate}
              className="p-1.5 rounded-full hover:text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Regenerate"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
