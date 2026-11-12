import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface AutoExpandingTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const AutoExpandingTextarea = forwardRef<HTMLTextAreaElement, AutoExpandingTextareaProps>(
  ({ value, onChange, onSubmit, placeholder = 'Ask Gemini anything...', disabled = false, className = '' }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const isComposingRef = useRef(false);

    useImperativeHandle(ref, () => internalRef.current!);

    // Adjust height automatically based on scrollHeight
    useEffect(() => {
      const textarea = internalRef.current;
      if (!textarea) return;

      if (!value) {
        textarea.style.height = '48px';
        return;
      }

      textarea.style.height = 'auto';
      const nextHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${Math.max(48, nextHeight)}px`;
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        if (isComposingRef.current || (e.nativeEvent as any).isComposing) {
          // Do not submit while IME is active
          return;
        }

        if (!e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }
    };

    return (
      <textarea
        ref={internalRef}
        data-testid="chat-input-textarea"
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
        }}
        className={`w-full bg-transparent text-sm sm:text-base text-on-surface placeholder:text-outline resize-none focus:outline-none py-3 px-2 leading-relaxed max-h-[200px] overflow-y-auto transition-all ${className}`}
      />
    );
  }
);

AutoExpandingTextarea.displayName = 'AutoExpandingTextarea';
