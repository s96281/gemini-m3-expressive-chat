import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Bot, RotateCcw, User, X } from 'lucide-react';
import { MessageNode } from '../../types/chat';
import { BranchInfo } from '../../utils/treeUtils';
import { BranchStepper } from './BranchStepper';
import { ThinkingAccordion } from './ThinkingAccordion';
import { MessageActionToolbar } from './MessageActionToolbar';
import { MarkdownRenderer } from '../rich/MarkdownRenderer';
import { formatTokenCount } from '../../utils/tokenStats';


export interface MessageItemProps {
  message: MessageNode;
  branchInfo: BranchInfo;
  isStreamingActive?: boolean;
  onSwitchBranch: (siblingId: string) => void;
  onRegenerate?: () => void;
  onEditSave?: (newContent: string) => void;
  onRate?: (rating: 'up' | 'down' | null) => void;
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return 'Just now';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  branchInfo,
  isStreamingActive = false,
  onSwitchBranch,
  onRegenerate,
  onEditSave,
  onRate,
}) => {
  const isUser = message.role === 'user';
  const [hasOpenedEdit, setHasOpenedEdit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const handleStartEdit = () => {
    setHasOpenedEdit(true);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEditSave?.(editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const imageAttachments = (message.attachments || []).filter(
    (att) => att.type.startsWith('image/') && Boolean(att.url)
  );
  const fileAttachments = (message.attachments || []).filter(
    (att) => !att.type.startsWith('image/') || !att.url
  );

  return (
    <div
      data-testid="message-item"
      data-role={message.role}
      className={`group relative flex w-full gap-3 sm:gap-4 my-2 transition-all rounded-[24px] ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div
          data-testid="assistant-avatar"
          className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 shadow-sm mt-1 select-none"
        >
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}

      {/* Bubble Container Column */}
      <div
        className={`flex flex-col max-w-[85%] sm:max-w-[78%] min-w-0 ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Top Metadata Header: Stepper & Timestamp */}
        <div className="flex items-center gap-2 mb-1 px-1 text-xs text-outline select-none">
          {branchInfo.totalVersions > 1 && (
            <BranchStepper
              branchInfo={branchInfo}
              onPrev={() => branchInfo.prevSiblingId && onSwitchBranch(branchInfo.prevSiblingId)}
              onNext={() => branchInfo.nextSiblingId && onSwitchBranch(branchInfo.nextSiblingId)}
            />
          )}

          <time
            data-testid="message-timestamp"
            dateTime={new Date(message.createdAt).toISOString()}
            className="text-[11px] opacity-75 tabular-nums"
          >
            {formatTimestamp(message.createdAt)}
          </time>

          {!isUser && message.tokenUsage && (
            <span
              data-testid="message-token-badge"
              className="px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-medium tabular-nums"
              title={`Prompt: ${formatTokenCount(message.tokenUsage.promptTokens)} · Output: ${formatTokenCount(message.tokenUsage.completionTokens)}${
                message.tokenUsage.thoughtsTokens
                  ? ` · Thinking: ${formatTokenCount(message.tokenUsage.thoughtsTokens)}`
                  : ''
              }`}
            >
              {formatTokenCount(message.tokenUsage.totalTokens)} tok
            </span>
          )}
        </div>

        {/* Message Content Bubble / Card */}
        <div
          data-testid={isUser ? 'message-item-user' : 'message-item-assistant'}
          className={`message-bubble relative px-4 sm:px-5 py-3 text-sm sm:text-base leading-relaxed shadow-sm transition-all overflow-hidden break-words [overflow-wrap:anywhere] max-w-full rounded-[24px] ${
            isUser
              ? 'rounded-br-[6px] bg-primary text-on-primary font-normal'
              : 'rounded-tl-[6px] bg-surface-container-low text-on-surface border border-outline-variant/30'
          }`}
        >
          {/* Image Attachments Preview */}
          {imageAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2.5">
              {imageAttachments.map((att) => (
                <button
                  key={att.id}
                  type="button"
                  data-testid="message-image-preview"
                  onClick={() => setPreviewImage({ url: att.url, name: att.name })}
                  className="group/img relative overflow-hidden rounded-2xl border border-white/20 shadow-sm cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-primary"
                  title={`Preview ${att.name}`}
                >
                  <img
                    src={att.url}
                    alt={att.name}
                    className="max-w-[220px] max-h-[180px] object-cover block transition-transform duration-200 group-hover/img:scale-[1.02]"
                  />
                  <span className="absolute inset-x-0 bottom-0 px-2 py-0.5 bg-black/55 text-white text-[10px] truncate opacity-0 group-hover/img:opacity-100 transition-opacity">
                    {att.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Non-image File Attachments display */}
          {fileAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {fileAttachments.map((att) => (
                <div
                  key={att.id}
                  className="px-2.5 py-1 rounded-full bg-black/15 text-[11px] font-mono flex items-center gap-1"
                >
                  <span className="truncate max-w-[140px]">{att.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Thinking / Reasoning Accordion (Assistant only) */}
          {!isUser && message.reasoningContent && (
            <ThinkingAccordion
              reasoningContent={message.reasoningContent}
              thinkingDuration={message.thinkingDuration}
              isStreaming={message.isStreaming}
            />
          )}

          {/* Inline Edit Form for User Message (only mounted after user clicks edit) */}
          {isUser && hasOpenedEdit && (
            <div
              style={{ display: isEditing ? 'flex' : 'none' }}
              className="flex-col gap-2 min-w-[240px] sm:min-w-[320px]"
            >
              <textarea
                data-testid="edit-message-textarea"
                rows={3}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-container-highest text-on-surface text-sm border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-on-primary resize-y"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  data-testid="cancel-edit-btn"
                  onClick={handleCancelEdit}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-black/20 hover:bg-black/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="save-edit-btn"
                  onClick={handleSaveEdit}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-on-primary text-primary hover:opacity-90 transition-opacity font-semibold"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Waiting Animation before First Response Token */}
          {!isUser &&
            !message.error &&
            !message.content &&
            (isStreamingActive || message.isStreaming) && (
              <div
                data-testid="streaming-waiting-indicator"
                role="status"
                aria-label="Waiting for response"
                className="flex items-center gap-2.5 py-1 text-on-surface-variant"
              >
                <div className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="text-xs font-medium text-outline animate-pulse">
                  {message.reasoningContent ? 'Thinking...' : 'Generating response...'}
                </span>
              </div>
            )}

          {/* Normal Text Display */}
          {(!message.error || message.content || isUser) &&
            !(
              !isUser &&
              !message.content &&
              (isStreamingActive || message.isStreaming)
            ) && (
            <div
              style={{ display: isEditing ? 'none' : 'block' }}
              className="font-sans text-sm sm:text-base selection:bg-primary-container selection:text-on-primary-container"
            >
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <MarkdownRenderer
                  content={message.content}
                  isStreaming={message.isStreaming}
                />
              )}
            </div>
          )}

          {/* API Error Banner (Assistant only) */}
          {!isUser && message.error && (
            <div
              data-testid="message-error-banner"
              role="alert"
              className={`${
                message.content ? 'mt-3 ' : ''
              }flex items-start gap-2.5 p-3 rounded-2xl bg-error-container/30 border border-error/40 text-error text-sm`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs uppercase tracking-wider mb-0.5">
                  Request Failed
                </p>
                <p className="text-xs sm:text-sm text-on-error-container break-words">
                  {message.error}
                </p>
                {onRegenerate && (
                  <button
                    type="button"
                    data-testid="error-retry-btn"
                    onClick={onRegenerate}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-error text-on-error hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Message Action Toolbar on Hover */}
        {!isEditing && (
          <div className="mt-1 px-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <MessageActionToolbar
              role={message.role}
              content={message.content}
              isStreaming={isStreamingActive}
              rating={message.rating}
              onRate={onRate}
              onRegenerate={onRegenerate}
              onEdit={isUser ? handleStartEdit : undefined}
            />
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 shadow-sm mt-1 select-none">
          <User className="w-4 h-4 text-secondary" />
        </div>
      )}

      {/* Image Lightbox Modal */}
      {previewImage &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="image-lightbox-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Image preview: ${previewImage.name}`}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-2"
            >
              <button
                type="button"
                data-testid="close-image-lightbox-btn"
                aria-label="Close image preview"
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 p-2 rounded-full bg-surface-container-highest text-on-surface shadow-elevation-3 hover:bg-surface-container transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-w-[88vw] max-h-[82vh] object-contain rounded-2xl shadow-elevation-3 border border-white/15"
              />
              <span className="px-3 py-1 rounded-full bg-black/60 text-white text-xs font-medium">
                {previewImage.name}
              </span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
