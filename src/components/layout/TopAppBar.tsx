import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  PanelLeftClose,
  Sparkles,
  Sun,
  Moon,
  Laptop,
  Settings,
  Plus,
  Share2,
  FileText,
  Code,
  FileCode,
  File,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeProvider';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useChatStore } from '../../store/useChatStore';
import { exportSessionToFile } from '../../services/exportService';

export interface TopAppBarProps {
  title?: string;
  modelName?: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  hasActiveSession?: boolean;
  onExportSession?: (format: 'md' | 'json' | 'txt' | 'html') => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  title = 'New chat',
  modelName = 'Gemini 1.5 Flash',
  isSidebarOpen,
  onToggleSidebar,
  onNewChat,
  onOpenSettings,
  hasActiveSession: propHasActiveSession,
  onExportSession: propOnExportSession,
}) => {
  const { mode, resolvedMode, toggleMode } = useTheme();
  const activePersona = useSettingsStore((s) => s.getActivePersona());
  const activeSession = useChatStore((s) => s.getActiveSession());

  const hasActiveSession = propHasActiveSession !== undefined ? propHasActiveSession : Boolean(activeSession);
  const handleExportSession = (format: 'md' | 'json' | 'txt' | 'html') => {
    if (propOnExportSession) {
      propOnExportSession(format);
    } else if (activeSession) {
      exportSessionToFile(activeSession, format);
    }
  };

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen]);

  const renderThemeIcon = () => {
    if (mode === 'system') return <Laptop className="w-5 h-5 text-on-surface-variant" />;
    if (resolvedMode === 'dark') return <Moon className="w-5 h-5 text-on-surface-variant" />;
    return <Sun className="w-5 h-5 text-on-surface-variant" />;
  };

  return (
    <header
      data-testid="top-app-bar"
      className="h-14 sm:h-16 w-full px-3 sm:px-4 flex items-center justify-between border-b border-outline-variant/30 bg-surface/80 backdrop-blur-md sticky top-0 z-20 shrink-0 transition-colors"
      role="banner"
    >
      {/* Left: Hamburger / Toggle & Quick New Chat */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          data-testid="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={isSidebarOpen}
          className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          title="Toggle sidebar (Ctrl+[)"
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        {onNewChat && (
          <button
            data-testid="top-new-chat-btn"
            onClick={onNewChat}
            aria-label="Start new chat"
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95 sm:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            title="New chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Center: Title & Persona Badge & Model Badge */}
      <div className="flex items-center gap-2 max-w-[50%] sm:max-w-[65%]">
        <span className="text-sm sm:text-base font-medium text-on-surface truncate">
          {title}
        </span>

        {/* Active Persona Indicator Badge (SET-02) */}
        {activePersona && (
          <div
            data-testid="active-persona-badge"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-xs font-medium shadow-sm shrink-0 border border-primary/20"
            title={`Persona: ${activePersona.name} (${activePersona.roleTitle})`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="truncate max-w-[120px]">{activePersona.badgeLabel || activePersona.name}</span>
          </div>
        )}

        <div
          data-testid="model-badge"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-medium shadow-sm shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-secondary" />
          <span>{modelName}</span>
        </div>
      </div>

      {/* Right: Export, Theme Toggle & Settings */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Export dropdown button */}
        {hasActiveSession && (
          <div className="relative" ref={exportMenuRef}>
            <button
              data-testid="export-session-btn"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              aria-label="Export chat session"
              aria-haspopup="true"
              aria-expanded={isExportMenuOpen}
              className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              title="Export chat"
            >
              <Share2 className="w-5 h-5" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-surface-container-high border border-outline-variant/40 shadow-elevation-3 py-1.5 z-30 animate-fade-in text-xs font-medium">
                <button
                  data-testid="export-option-md"
                  onClick={() => {
                    handleExportSession('md');
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-surface-container-highest text-left text-on-surface transition-colors"
                >
                  <FileText className="w-4 h-4 text-primary" />
                  <span>Markdown (.md)</span>
                </button>

                <button
                  data-testid="export-option-json"
                  onClick={() => {
                    handleExportSession('json');
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-surface-container-highest text-left text-on-surface transition-colors"
                >
                  <Code className="w-4 h-4 text-secondary" />
                  <span>JSON (.json)</span>
                </button>

                <button
                  data-testid="export-option-txt"
                  onClick={() => {
                    handleExportSession('txt');
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-surface-container-highest text-left text-on-surface transition-colors"
                >
                  <File className="w-4 h-4 text-tertiary" />
                  <span>Plain Text (.txt)</span>
                </button>

                <button
                  data-testid="export-option-html"
                  onClick={() => {
                    handleExportSession('html');
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-surface-container-highest text-left text-on-surface transition-colors border-t border-outline-variant/20 mt-1 pt-1.5"
                >
                  <FileCode className="w-4 h-4 text-outline" />
                  <span>Print / HTML View</span>
                </button>
              </div>
            )}
          </div>
        )}

        <button
          data-testid="theme-toggle-btn"
          onClick={toggleMode}
          aria-label={`Toggle theme mode: current is ${mode}`}
          className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          title={`Theme mode: ${mode} (${resolvedMode})`}
        >
          {renderThemeIcon()}
        </button>

        {onOpenSettings && (
          <button
            data-testid="settings-btn"
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  );
};
