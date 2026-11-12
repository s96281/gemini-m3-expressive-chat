import React, { useState, useEffect } from 'react';
import { TopAppBar } from './TopAppBar';
import { NavigationDrawer, ChatSessionPreview } from './NavigationDrawer';
import { NavigationRail } from './NavigationRail';
import { ArtifactSandboxPane } from '../artifact/ArtifactSandboxPane';


export interface AppShellProps {
  children?: React.ReactNode;
  activeSessionId?: string | null;
  activeSessionTitle?: string;
  modelName?: string;
  sessions?: ChatSessionPreview[];
  onNewChat?: () => void;
  onSelectSession?: (id: string) => void;
  onOpenSettings?: () => void;
}

const STORAGE_KEY_SIDEBAR_OPEN = 'm3_sidebar_open';

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeSessionId = null,
  activeSessionTitle = 'New chat',
  modelName = 'Gemini 1.5 Flash',
  sessions = [],
  onNewChat = () => {},
  onSelectSession,
  onOpenSettings,
}) => {
  // Persistence for sidebar state (only persisted on desktop/tablet)
  const [isSidebarOpen, setIsSidebarOpenState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (window.innerWidth < 768) return false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SIDEBAR_OPEN);
      if (saved !== null) {
        return saved === 'true';
      }
      return window.innerWidth >= 1024;
    } catch {
      return window.innerWidth >= 1024;
    }
  });

  const setIsSidebarOpen = (valueOrFn: boolean | ((prev: boolean) => boolean)) => {
    setIsSidebarOpenState((prev) => {
      const next = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn;
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        try {
          localStorage.setItem(STORAGE_KEY_SIDEBAR_OPEN, String(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  // Handle window resize and layout modes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  // Keyboard shortcut Ctrl+[ / Cmd+[ to toggle sidebar, and Escape to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '[' || e.code === 'BracketLeft')) {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && window.innerWidth < 768 && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  return (
    <div
      data-testid="app-shell"
      className="h-[100dvh] w-full flex overflow-hidden bg-surface text-on-surface"
    >
      {/* Mobile Backdrop Scrim */}
      <div
        data-testid="drawer-scrim"
        onClick={() => setIsSidebarOpen(false)}
        className={`fixed inset-0 bg-black/60 z-40 backdrop-blur-sm md:hidden transition-all duration-300 ${
          isSidebarOpen
            ? 'opacity-100 pointer-events-auto visible'
            : 'opacity-0 pointer-events-none invisible'
        }`}
        aria-hidden="true"
      />

      {/* Navigation Drawer (Desktop persistent or Mobile overlay) */}
      <NavigationDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={onNewChat}
        onOpenSettings={onOpenSettings}
        activeSessionId={activeSessionId}
        onSelectSession={onSelectSession}
        sessions={sessions}
      />

      {/* Tablet / Collapsed Desktop Navigation Rail */}
      {!isSidebarOpen && (
        <NavigationRail
          onExpand={toggleSidebar}
          onNewChat={onNewChat}
          onOpenSettings={onOpenSettings}
          hasActiveChat={Boolean(activeSessionId)}
        />
      )}

      {/* Main Conversational Feed Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <TopAppBar
          title={activeSessionTitle}
          modelName={modelName}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          onNewChat={onNewChat}
          onOpenSettings={onOpenSettings}
        />

        <main className="flex-1 overflow-y-auto relative flex flex-col">
          {children}
        </main>
      </div>

      {/* Code / Visual Artifact Sandbox Pane */}
      <ArtifactSandboxPane />
    </div>
  );
};

