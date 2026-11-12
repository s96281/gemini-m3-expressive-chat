import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, UploadCloud, AlertCircle } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { Attachment } from '../../types/chat';
import { AutoExpandingTextarea } from './AutoExpandingTextarea';
import { MorphingSendStopButton } from './MorphingSendStopButton';
import { ModelSelectorPill } from './ModelSelectorPill';
import { AttachmentBar } from './AttachmentBar';
import { VoiceInputButton } from './VoiceInputButton';

export interface InputDockProps {
  inputPrompt?: string;
  onInputPromptChange?: (val: string) => void;
  className?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const InputDock: React.FC<InputDockProps> = ({
  inputPrompt: controlledPrompt,
  onInputPromptChange,
  className = '',
}) => {
  const [internalPrompt, setInternalPrompt] = useState('');
  const prompt = controlledPrompt !== undefined ? controlledPrompt : internalPrompt;
  const setPrompt = (updater: string | ((prev: string) => string)) => {
    const nextVal = typeof updater === 'function' ? updater(prompt) : updater;
    if (onInputPromptChange) {
      onInputPromptChange(nextVal);
    } else {
      setInternalPrompt(nextVal);
    }
  };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isStreaming, sendChatMessage, stopStreaming } = useChatStore();

  // Full-window drag & drop listeners
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDragOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      if (e.dataTransfer?.files) {
        handleFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleFiles = (fileList: FileList) => {
    Array.from(fileList).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        showSnackbar(`"${file.name}" exceeds the 10MB size limit.`);
        return;
      }

      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const url = URL.createObjectURL(file);

      setAttachments((prev) => [
        ...prev,
        {
          id,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url,
        },
      ]);
    });
  };

  const showSnackbar = (msg: string) => {
    setSnackbarMessage(msg);
    setTimeout(() => {
      setSnackbarMessage(null);
    }, 4000);
  };

  const handleVoiceTranscript = (transcript: string) => {
    setPrompt((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${transcript}` : transcript;
    });
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed && attachments.length === 0) return;

    const currentAttachments = [...attachments];
    setPrompt('');
    setAttachments([]);

    await sendChatMessage(trimmed, currentAttachments);
  };

  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  const canSend = prompt.trim().length > 0 || attachments.length > 0;

  return (
    <>
      {/* Full-window Drag and Drop Overlay */}
      {isDragOver && (
        <div
          data-testid="drop-overlay"
          className="drop-zone fixed inset-0 z-50 bg-surface/80 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-primary p-6 animate-fade-in pointer-events-none"
        >
          <div className="p-4 rounded-full bg-primary-container text-on-primary-container mb-3 shadow-elevation-2 animate-bounce">
            <UploadCloud className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-on-surface">Drop files to attach</h3>
          <p className="text-sm text-outline mt-1">Supports images, code, text, documents (up to 10MB each)</p>
        </div>
      )}

      {/* Snackbar Warning */}
      {snackbarMessage && (
        <div
          role="alert"
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-error-container text-on-error-container text-xs font-medium shadow-elevation-3 flex items-center gap-2 border border-error/20 animate-fade-in"
        >
          <AlertCircle className="w-4 h-4 text-error shrink-0" />
          <span>{snackbarMessage}</span>
        </div>
      )}

      {/* Floating M3 Pill Dock Container */}
      <div className={`w-full max-w-3xl mx-auto px-3 sm:px-4 shrink-0 pb-3 sm:pb-4 ${className}`}>
        <div
          data-testid="input-dock"
          className="relative w-full rounded-[28px] bg-surface-container-high/90 backdrop-blur-xl border border-outline-variant/40 shadow-elevation-3 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all duration-200 flex flex-col p-2 sm:p-2.5"
        >
          {/* Top Chips Row: Attachments & Model Selector */}
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <ModelSelectorPill />
          </div>

          {/* Attachment Preview Chips */}
          <AttachmentBar
            attachments={attachments}
            onRemoveAttachment={(id) =>
              setAttachments((prev) => prev.filter((a) => a.id !== id))
            }
          />

          {/* Text Input Row */}
          <div className="flex items-end gap-1.5 sm:gap-2">
            {/* Attachment Button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              aria-label="Add attachment"
              onClick={handlePaperclipClick}
              className="p-2 sm:p-2.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Add attachment"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Auto-expanding textarea */}
            <div className="flex-1 min-w-0">
              <AutoExpandingTextarea
                ref={textareaRef}
                value={prompt}
                onChange={setPrompt}
                onSubmit={handleSubmit}
                placeholder="Ask Gemini anything, paste code, or type Shift+Enter for newline..."
              />
            </div>

            {/* Voice Input Button */}
            <VoiceInputButton onTranscript={handleVoiceTranscript} />

            {/* Morphing Send / Stop Button */}
            <MorphingSendStopButton
              isStreaming={isStreaming}
              canSend={canSend}
              onSend={handleSubmit}
              onStop={stopStreaming}
            />
          </div>
        </div>
      </div>
    </>
  );
};
