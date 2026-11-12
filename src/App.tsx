import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './theme/ThemeProvider';
import { AppShell } from './components/layout/AppShell';
import { ConversationView } from './components/conversation/ConversationView';
import { InputDock } from './components/dock/InputDock';
import { SettingsDialog } from './components/settings/SettingsDialog';
import { useChatStore } from './store/useChatStore';

export const App: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputPrompt, setInputPrompt] = useState<string>('');

  const {
    sessions,
    activeSessionId,
    startNewChat,
    selectSession,
    stopStreaming,
    getActiveSession,
  } = useChatStore();

  const activeSession = getActiveSession();

  // Keyboard shortcut system:
  // - Ctrl+N / Cmd+N -> New Chat
  // - Ctrl+K / Cmd+K -> Focus Session Search
  // - Escape -> Stop streaming or close modals or blur dock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

      const isNewChat =
        (e.ctrlKey && (e.key === 'n' || e.key === 'N' || e.code === 'KeyN')) ||
        (isMac && e.metaKey && (e.key === 'n' || e.key === 'N' || e.code === 'KeyN'));

      const isSearch =
        (e.ctrlKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) ||
        (isMac && e.metaKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK'));

      if (isNewChat) {
        e.preventDefault();
        handleNewChat();
      } else if (isSearch) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          '[data-testid="session-search-input"]'
        );
        searchInput?.focus();
      } else if (e.key === 'Escape') {
        if (useChatStore.getState().isStreaming) {
          useChatStore.getState().stopStreaming();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNewChat = () => {
    stopStreaming();
    startNewChat();
    setInputPrompt('');
    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="chat-input-textarea"]'
      );
      textarea?.focus();
    }, 50);
  };

  const handleSelectPrompt = (prompt: string) => {
    setInputPrompt(prompt);
    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="chat-input-textarea"]'
      );
      textarea?.focus();
    }, 50);
  };

  return (
    <ThemeProvider>
      <AppShell
        activeSessionId={activeSessionId}
        activeSessionTitle={activeSession?.title || 'New chat'}
        modelName={activeSession?.model || 'Gemini 1.5 Flash'}
        sessions={sessions}
        onNewChat={handleNewChat}
        onSelectSession={(id) => selectSession(id)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      >
        <div className="flex-1 flex flex-col justify-between h-full relative overflow-hidden">
          {/* Conversation viewport */}
          <ConversationView onSelectPrompt={handleSelectPrompt} />

          {/* Floating Pill Input Dock */}
          <InputDock
            inputPrompt={inputPrompt}
            onInputPromptChange={setInputPrompt}
          />
        </div>

        {/* Settings Dialog */}
        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </AppShell>
    </ThemeProvider>
  );
};

export default App;
