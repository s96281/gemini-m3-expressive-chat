import React from 'react';
import { X, FileText, Image as ImageIcon } from 'lucide-react';
import { Attachment } from '../../types/chat';

export interface AttachmentBarProps {
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const AttachmentBar: React.FC<AttachmentBarProps> = ({
  attachments,
  onRemoveAttachment,
}) => {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-2 pt-1 pb-2">
      {attachments.map((att) => {
        const isImg = att.type.startsWith('image/');
        return (
          <div
            key={att.id}
            data-testid="attachment-chip"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-xs text-on-surface border border-outline-variant/30 shadow-xs max-w-[200px]"
          >
            {isImg ? (
              <ImageIcon className="w-3.5 h-3.5 text-primary shrink-0" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
            )}
            <span className="truncate text-xs font-medium">{att.name}</span>
            <span className="text-[10px] text-outline tabular-nums shrink-0">
              ({formatBytes(att.size)})
            </span>
            <button
              type="button"
              data-testid="remove-attachment-btn"
              aria-label={`Remove ${att.name}`}
              onClick={() => onRemoveAttachment(att.id)}
              className="p-0.5 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface ml-0.5 shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
