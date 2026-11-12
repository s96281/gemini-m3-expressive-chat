import React from 'react';
import { Menu, Plus, MessageSquare, Sun, Moon, Laptop, Settings } from 'lucide-react';
import { useTheme } from '../../theme/ThemeProvider';

export interface NavigationRailProps {
  onExpand: () => void;
  onNewChat: () => void;
  onOpenSettings?: () => void;
  hasActiveChat?: boolean;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  onExpand,
  onNewChat,
  onOpenSettings,
  hasActiveChat = false,
}) => {
  const { mode, resolvedMode, toggleMode } = useTheme();

  return (
    <nav
      data-testid="navigation-rail"
      aria-label="Compact navigation rail"
      role="navigation"
      className="hidden md:flex flex-col items-center justify-between w-20 h-full py-3 bg-surface-container-low border-r border-outline-variant/30 shrink-0 z-10 transition-all duration-300"
    >
      {/* Top: Menu Toggle & Small FAB */}
      <div className="flex flex-col items-center gap-4 w-full">
        <button
          onClick={onExpand}
          aria-label="Expand sidebar"
          className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          title="Expand sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          data-testid="rail-new-chat-btn"
          onClick={onNewChat}
          aria-label="Start new chat"
          className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-elevation-1 hover:shadow-elevation-2 hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          title="New chat"
        >
          <Plus className="w-6 h-6 text-primary" />
        </button>

        {/* Destination: Chat Pill */}
        <div className="flex flex-col items-center mt-2">
          <div
            className={`w-14 h-8 rounded-full flex items-center justify-center transition-all ${
              hasActiveChat
                ? 'bg-secondary-container text-on-secondary-container shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-highest/60'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-medium text-on-surface mt-1">Chats</span>
        </div>
      </div>

      {/* Bottom: Theme & Settings */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={toggleMode}
          aria-label="Toggle theme mode"
          className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          title={`Theme mode: ${mode}`}
        >
          {mode === 'system' ? (
            <Laptop className="w-5 h-5" />
          ) : resolvedMode === 'dark' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </button>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>
    </nav>
  );
};
