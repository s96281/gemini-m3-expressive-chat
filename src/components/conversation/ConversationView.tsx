import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { getActiveTimeline, getBranchInfo } from '../../utils/treeUtils';
import { MessageItem } from './MessageItem';
import { ZeroState } from './ZeroState';
import { ScrollToBottomFab } from './ScrollToBottomFab';

export interface ConversationViewProps {
  onSelectPrompt?: (prompt: string) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({ onSelectPrompt }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollPausedRef = useRef(false);
  const [showFab, setShowFab] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const {
    activeSessionId,
    isStreaming,
    getActiveSession,
    switchBranch,
    regenerateResponse,
    editUserMessage,
    setMessageRating,
  } = useChatStore();

  const activeSession = getActiveSession();
  const activeTimeline = useMemo(() => getActiveTimeline(activeSession), [activeSession]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (!containerRef.current) return;
    const { scrollHeight, clientHeight } = containerRef.current;
    if (typeof containerRef.current.scrollTo === 'function') {
      containerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    } else {
      containerRef.current.scrollTop = scrollHeight - clientHeight;
    }
    isAutoScrollPausedRef.current = false;
    setShowFab((prev) => (prev ? false : prev));
    setHasUnread((prev) => (prev ? false : prev));
  }, []);

  // Handle scroll events to detect upward scrolling
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom > 150) {
      isAutoScrollPausedRef.current = true;
      setShowFab((prev) => (prev ? prev : true));
    } else {
      isAutoScrollPausedRef.current = false;
      setShowFab((prev) => (prev ? false : prev));
      setHasUnread((prev) => (prev ? false : prev));
    }
  };

  // Follow streaming or new messages if auto-scroll is not paused
  useEffect(() => {
    if (!containerRef.current) return;

    if (!isAutoScrollPausedRef.current) {
      scrollToBottom(false);
    } else if (isStreaming) {
      setHasUnread((prev) => (prev ? prev : true));
    }
  }, [activeTimeline, isStreaming, scrollToBottom]);

  if (!activeSessionId || activeTimeline.length === 0) {
    return (
      <div
        data-testid="conversation-container"
        className="flex-1 overflow-y-auto flex flex-col p-4 sm:p-6"
      >
        <ZeroState onSelectPrompt={onSelectPrompt || (() => {})} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="conversation-container"
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto flex flex-col p-4 sm:p-6 relative select-text"
    >
      <div className="max-w-4xl mx-auto w-full space-y-4 pb-28 pt-2">
        {activeTimeline.map((msg) => {
          const branchInfo = activeSession ? getBranchInfo(activeSession, msg.id) : {
            currentIndex: 1,
            totalVersions: 1,
            hasPrev: false,
            hasNext: false,
            prevSiblingId: null,
            nextSiblingId: null,
          };

          return (
            <MessageItem
              key={msg.id}
              message={msg}
              branchInfo={branchInfo}
              isStreamingActive={isStreaming}
              onSwitchBranch={(siblingId) => {
                if (activeSessionId) {
                  switchBranch(activeSessionId, siblingId);
                }
              }}
              onRegenerate={() => regenerateResponse(msg.id)}
              onEditSave={(newContent) => editUserMessage(msg.id, newContent)}
              onRate={(rating) => {
                if (activeSessionId) {
                  setMessageRating(activeSessionId, msg.id, rating);
                }
              }}
            />
          );
        })}
      </div>

      <ScrollToBottomFab
        isVisible={showFab}
        hasUnread={hasUnread}
        onClick={() => scrollToBottom(true)}
      />
    </div>
  );
};
