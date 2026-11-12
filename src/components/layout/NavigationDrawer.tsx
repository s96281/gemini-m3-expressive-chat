import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Sparkles,
  MessageSquare,
  X,
  Settings,
  Search,
  Pin,
  Edit2,
  Trash2,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { ChatSession } from '../../types/chat';
import { useChatStore } from '../../store/useChatStore';

export type ChatSessionPreview = ChatSession;

export interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  activeSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onRenameSession?: (id: string, newTitle: string) => void;
  onDeleteSession?: (id: string) => void;
  onPinSession?: (id: string) => void;
  onExportSession?: (session: ChatSession, format: 'md' | 'json' | 'txt' | 'html') => void;
  sessions?: ChatSession[];
}

interface TemporalGroup {
  id: string;
  label: string;
  sessions: ChatSession[];
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  onNewChat,
  onOpenSettings,
  activeSessionId: propActiveSessionId,
  onSelectSession: propOnSelectSession,
  onRenameSession: propOnRenameSession,
  onDeleteSession: propOnDeleteSession,
  onPinSession: propOnPinSession,
  sessions: propSessions,
}) => {
  const store = useChatStore();

  const sessions = propSessions !== undefined ? propSessions : store.sessions;
  const activeSessionId =
    propActiveSessionId !== undefined ? propActiveSessionId : store.activeSessionId;

  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleDraft, setEditTitleDraft] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);

  // Group accordion toggle states (default all expanded)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input on start editing
  useEffect(() => {
    if (editingSessionId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingSessionId]);

  // Handle ESC key for delete dialog
  useEffect(() => {
    if (!sessionToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSessionToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionToDelete]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Filter sessions in real time (titles + inner message contents)
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;

    return sessions.filter((s) => {
      // 1. Title match
      if (s.title && s.title.toLowerCase().includes(q)) return true;

      // 2. Message content match
      if (s.messages && typeof s.messages === 'object') {
        const msgs = Array.isArray(s.messages) ? s.messages : Object.values(s.messages);
        return msgs.some(
          (m: any) => typeof m?.content === 'string' && m.content.toLowerCase().includes(q)
        );
      }

      return false;
    });
  }, [sessions, searchQuery]);

  // Partition into Pinned and Chronological Groups
  const { pinned, chronologicalGroups } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOf7DaysAgo = startOfToday - 6 * 86400000;
    const startOf30DaysAgo = startOfToday - 29 * 86400000;

    const pinnedList: ChatSession[] = [];
    const todayList: ChatSession[] = [];
    const yesterdayList: ChatSession[] = [];
    const weekList: ChatSession[] = [];
    const monthList: ChatSession[] = [];
    const olderList: ChatSession[] = [];

    // Sort descending by recency (updatedAt)
    const sorted = [...filteredSessions].sort(
      (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
    );

    for (const s of sorted) {
      if (s.pinned) {
        pinnedList.push(s);
        continue;
      }
      const t = s.updatedAt || s.createdAt || 0;
      if (t >= startOfToday) {
        todayList.push(s);
      } else if (t >= startOfYesterday) {
        yesterdayList.push(s);
      } else if (t >= startOf7DaysAgo) {
        weekList.push(s);
      } else if (t >= startOf30DaysAgo) {
        monthList.push(s);
      } else {
        olderList.push(s);
      }
    }

    const groups: TemporalGroup[] = [];
    if (todayList.length > 0) groups.push({ id: 'today', label: 'Today', sessions: todayList });
    if (yesterdayList.length > 0)
      groups.push({ id: 'yesterday', label: 'Yesterday', sessions: yesterdayList });
    if (weekList.length > 0)
      groups.push({ id: 'week', label: 'Previous 7 Days', sessions: weekList });
    if (monthList.length > 0)
      groups.push({ id: 'month', label: 'Previous 30 Days', sessions: monthList });
    if (olderList.length > 0) groups.push({ id: 'older', label: 'Older', sessions: olderList });

    return {
      pinned: pinnedList,
      chronologicalGroups: groups,
    };
  }, [filteredSessions]);

  const handleSelect = (id: string) => {
    if (propOnSelectSession) {
      propOnSelectSession(id);
    } else {
      store.selectSession(id);
    }
    if (window.innerWidth < 768) onClose();
  };

  const handleStartRename = (e: React.MouseEvent, s: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditTitleDraft(s.title);
  };

  const handleCommitRename = (s: ChatSession) => {
    const trimmed = editTitleDraft.trim();
    if (trimmed && trimmed !== s.title) {
      if (propOnRenameSession) {
        propOnRenameSession(s.id, trimmed);
      } else {
        store.updateTitle(s.id, trimmed);
      }
    }
    setEditingSessionId(null);
  };

  const handleTogglePin = (e: React.MouseEvent, s: ChatSession) => {
    e.stopPropagation();
    if (propOnPinSession) {
      propOnPinSession(s.id);
    } else {
      store.pinSession(s.id, !s.pinned);
    }
  };

  const handleOpenDelete = (e: React.MouseEvent, s: ChatSession) => {
    e.stopPropagation();
    setSessionToDelete(s);
  };

  const handleConfirmDelete = () => {
    if (!sessionToDelete) return;
    if (propOnDeleteSession) {
      propOnDeleteSession(sessionToDelete.id);
    } else {
      store.deleteSession(sessionToDelete.id);
    }
    setSessionToDelete(null);
  };

  const renderSessionItem = (session: ChatSession) => {
    const isActive = session.id === activeSessionId;
    const isEditing = session.id === editingSessionId;

    return (
      <div
        key={session.id}
        data-testid="session-item"
        onClick={() => !isEditing && handleSelect(session.id)}
        className={`group relative w-full flex items-center justify-between px-3 py-2 rounded-full text-xs sm:text-sm text-left transition-all duration-200 cursor-pointer ${
          isActive
            ? 'bg-secondary-container text-on-secondary-container font-medium shadow-sm'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1">
          <MessageSquare
            className={`w-4 h-4 shrink-0 ${
              isActive ? 'text-secondary font-semibold' : 'text-outline group-hover:text-on-surface'
            }`}
          />

          {isEditing ? (
            <input
              ref={renameInputRef}
              data-testid="rename-input"
              className="rename-input w-full bg-surface-container-highest text-on-surface text-xs px-2 py-0.5 rounded border border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={editTitleDraft}
              onChange={(e) => setEditTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCommitRename(session);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingSessionId(null);
                }
              }}
              onBlur={() => handleCommitRename(session)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate flex-1" title={session.title}>
              {session.title}
            </span>
          )}
        </div>

        {/* Hover Action Buttons */}
        {!isEditing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {/* Pin / Unpin button */}
            <button
              data-testid={session.pinned ? 'unpin-session-btn' : 'pin-session-btn'}
              onClick={(e) => handleTogglePin(e, session)}
              aria-label={session.pinned ? 'Unpin chat' : 'Pin chat'}
              title={session.pinned ? 'Unpin chat' : 'Pin chat'}
              className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              <Pin
                className={`w-3.5 h-3.5 ${
                  session.pinned ? 'fill-primary text-primary' : 'text-outline'
                }`}
              />
            </button>

            {/* Rename button */}
            <button
              data-testid="rename-session-btn"
              onClick={(e) => handleStartRename(e, session)}
              aria-label="Rename chat"
              title="Rename chat"
              className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-outline" />
            </button>

            {/* Delete button */}
            <button
              data-testid="delete-session-btn"
              onClick={(e) => handleOpenDelete(e, session)}
              aria-label="Delete chat"
              title="Delete chat"
              className="p-1 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-outline hover:text-error" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <aside
        data-testid="navigation-drawer"
        aria-label="Chat navigation drawer"
        role="navigation"
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-10 w-[280px] shrink-0 h-full bg-surface-container-low border-r border-outline-variant/30 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-full md:hidden'
        }`}
      >
        {/* Drawer Header */}
        <div className="h-14 sm:h-16 px-4 flex items-center justify-between border-b border-outline-variant/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-container text-on-primary-container">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-base text-on-surface tracking-tight">
              Gemini Chat
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant">
              M3
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close navigation drawer"
            className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action CTA: New Chat Extended FAB */}
        <div className="p-3 shrink-0">
          <button
            data-testid="new-chat-btn"
            onClick={() => {
              if (onNewChat) {
                onNewChat();
              } else {
                store.startNewChat();
              }
              if (window.innerWidth < 768) onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-medium shadow-elevation-1 hover:shadow-elevation-2 active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="w-5 h-5 text-primary" />
            <span>New chat</span>
          </button>
        </div>

        {/* Real-Time Search Bar */}
        <div className="px-3 pb-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-highest/60 focus-within:ring-2 focus-within:ring-primary text-xs relative">
            <Search className="w-4 h-4 text-outline shrink-0" />
            <input
              data-testid="session-search-input"
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-on-surface placeholder:text-outline text-xs focus:outline-none pr-5"
            />
            {searchQuery.length > 0 && (
              <button
                data-testid="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Sessions Feed */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-3">
          {/* Empty search state */}
          {searchQuery.trim().length > 0 && filteredSessions.length === 0 && (
            <div
              data-testid="search-empty-state"
              className="text-center py-8 px-4 text-xs text-outline space-y-2"
            >
              <p>No matching chats found</p>
              <button
                data-testid="clear-search-btn"
                onClick={() => setSearchQuery('')}
                className="text-primary hover:underline text-xs font-medium"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Empty total state */}
          {searchQuery.trim().length === 0 && filteredSessions.length === 0 && (
            <div className="text-center py-8 text-xs text-outline">No recent chats</div>
          )}

          {/* Pinned Section */}
          {pinned.length > 0 && (
            <div data-testid="pinned-sessions-group" className="space-y-1 mb-2">
              <div className="px-3 py-1 text-[11px] font-semibold text-outline uppercase tracking-wider flex items-center gap-1.5">
                <Pin className="w-3 h-3 text-primary fill-primary" />
                <span>Pinned</span>
              </div>
              <div className="space-y-1">
                {pinned.map((session) => renderSessionItem(session))}
              </div>
            </div>
          )}

          {/* Chronological Accordion Groups */}
          {chronologicalGroups.map((group) => {
            const isExpanded = !collapsedGroups[group.id];
            return (
              <div key={group.id} className="space-y-1">
                <button
                  data-testid="session-group-header"
                  className="session-group-title w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-outline hover:text-on-surface-variant transition-colors"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="uppercase tracking-wider">{group.label}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isExpanded ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
                {isExpanded && (
                  <div className="space-y-1">
                    {group.sessions.map((session) => renderSessionItem(session))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drawer Footer */}
        {onOpenSettings && (
          <div className="p-3 border-t border-outline-variant/20 shrink-0">
            <button
              data-testid="drawer-settings-btn"
              onClick={() => {
                onOpenSettings();
                if (window.innerWidth < 768) onClose();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Settings className="w-4 h-4 text-outline" />
              <span>Settings</span>
            </button>
          </div>
        )}
      </aside>

      {/* Single Session Delete Confirmation Dialog */}
      {sessionToDelete &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="delete-confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            onClick={() => setSessionToDelete(null)}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-surface rounded-[24px] p-5 border border-outline-variant/40 shadow-elevation-3 space-y-4 text-on-surface"
            >
              <div className="flex items-center gap-3 text-error">
                <div className="p-2 rounded-full bg-error/10">
                  <AlertTriangle className="w-5 h-5 text-error" />
                </div>
                <h3 className="text-base font-semibold">Delete Chat?</h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Are you sure you want to delete &ldquo;{sessionToDelete.title}&rdquo;? This action
                cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  data-testid="cancel-delete-btn"
                  onClick={() => setSessionToDelete(null)}
                  className="px-4 py-2 rounded-full text-xs font-medium text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                >
                  Cancel
                </button>
                <button
                  data-testid="confirm-delete-btn"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-full text-xs font-medium bg-error text-on-error hover:bg-error/90 transition-colors shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
