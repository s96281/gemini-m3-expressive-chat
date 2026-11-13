import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Gauge,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeProvider';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useChatStore } from '../../store/useChatStore';
import { exportSessionToFile } from '../../services/exportService';
import {
  buildGeminiContentsFromSession,
  computeThreadTokenStats,
  formatTokenCount,
} from '../../utils/tokenStats';
import {
  countGeminiTokens,
  getGeminiModelInfo,
  resolveGeminiModelId,
} from '../../services/liveEngine';

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
  const engineMode = useSettingsStore((s) => s.engineMode);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const apiEndpoint = useSettingsStore((s) => s.apiEndpoint);
  const fetchedGeminiModels = useSettingsStore((s) => s.fetchedGeminiModels);
  const upsertGeminiModelInfo = useSettingsStore((s) => s.upsertGeminiModelInfo);
  const activeSession = useChatStore((s) => s.getActiveSession());
  const isStreaming = useChatStore((s) => s.isStreaming);

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

  const [isTokenPopoverOpen, setIsTokenPopoverOpen] = useState(false);
  const tokenPopoverRef = useRef<HTMLDivElement>(null);

  const [apiCountTokens, setApiCountTokens] = useState<number | null>(null);
  const fetchedModelInfoKeysRef = useRef<Set<string>>(new Set());

  const tokenStats = useMemo(() => computeThreadTokenStats(activeSession), [activeSession]);

  const rawActiveModel = activeSession?.model || modelName;
  const resolvedActiveModelId = useMemo(
    () => resolveGeminiModelId(rawActiveModel),
    [rawActiveModel]
  );

  const inputTokenLimit = useMemo(() => {
    if (!fetchedGeminiModels || fetchedGeminiModels.length === 0) return undefined;
    const match = fetchedGeminiModels.find(
      (m) =>
        m.id === rawActiveModel ||
        m.id === resolvedActiveModelId ||
        m.name === rawActiveModel
    );
    return match?.inputTokenLimit;
  }, [fetchedGeminiModels, rawActiveModel, resolvedActiveModelId]);

  // Fetch exact model context window (inputTokenLimit) via Gemini `models.get`
  useEffect(() => {
    if (engineMode !== 'gemini' || !apiKey || !resolvedActiveModelId) return;
    if (typeof inputTokenLimit === 'number' && inputTokenLimit > 0) return;

    const cacheKey = `${apiEndpoint || 'default'}::${resolvedActiveModelId}`;
    if (fetchedModelInfoKeysRef.current.has(cacheKey)) return;
    fetchedModelInfoKeysRef.current.add(cacheKey);

    const controller = new AbortController();
    getGeminiModelInfo({
      model: resolvedActiveModelId,
      apiKey,
      apiEndpoint,
      signal: controller.signal,
    })
      .then((info) => {
        if (typeof info.inputTokenLimit === 'number' && info.inputTokenLimit > 0) {
          upsertGeminiModelInfo(info);
        }
      })
      .catch(() => {
        // Allow retry if request was aborted
        if (controller.signal.aborted) {
          fetchedModelInfoKeysRef.current.delete(cacheKey);
        }
      });

    return () => controller.abort();
  }, [engineMode, apiKey, apiEndpoint, resolvedActiveModelId, inputTokenLimit, upsertGeminiModelInfo]);

  // Count active thread tokens via Gemini `models.countTokens` (per https://aistudio.google.com/docs/tokens)
  useEffect(() => {
    if (
      !hasActiveSession ||
      !activeSession ||
      engineMode !== 'gemini' ||
      !apiKey ||
      isStreaming ||
      tokenStats.messageCount === 0
    ) {
      setApiCountTokens(null);
      return;
    }

    const contents = buildGeminiContentsFromSession(activeSession);
    if (contents.length === 0) {
      setApiCountTokens(null);
      return;
    }

    const controller = new AbortController();
    countGeminiTokens({
      model: resolvedActiveModelId,
      apiKey,
      apiEndpoint,
      contents,
      signal: controller.signal,
    })
      .then((res) => {
        if (!controller.signal.aborted && typeof res.totalTokens === 'number' && res.totalTokens > 0) {
          setApiCountTokens(res.totalTokens);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setApiCountTokens(null);
        }
      });

    return () => controller.abort();
  }, [
    hasActiveSession,
    activeSession?.id,
    activeSession?.activeLeafId,
    activeSession?.updatedAt,
    resolvedActiveModelId,
    engineMode,
    apiKey,
    apiEndpoint,
    isStreaming,
    tokenStats.messageCount,
  ]);

  const effectiveContextTokens =
    apiCountTokens !== null ? apiCountTokens : tokenStats.contextTokens;
  const effectiveTotalTokens =
    tokenStats.totalTokens > 0 ? tokenStats.totalTokens : (apiCountTokens ?? 0);
  const effectivePromptTokens =
    tokenStats.promptTokens > 0 ? tokenStats.promptTokens : (apiCountTokens ?? 0);
  const effectiveHasEstimated =
    apiCountTokens !== null ? false : tokenStats.hasEstimated;

  const contextUsagePct =
    inputTokenLimit && inputTokenLimit > 0
      ? Math.min(100, Math.round((effectiveContextTokens / inputTokenLimit) * 1000) / 10)
      : null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
      if (tokenPopoverRef.current && !tokenPopoverRef.current.contains(e.target as Node)) {
        setIsTokenPopoverOpen(false);
      }
    };
    if (isExportMenuOpen || isTokenPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen, isTokenPopoverOpen]);

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

      {/* Right: Token Stats, Export, Theme Toggle & Settings */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Thread Token Statistics Pill */}
        {hasActiveSession && tokenStats.messageCount > 0 && (
          <div className="relative" ref={tokenPopoverRef}>
            <button
              type="button"
              data-testid="conversation-token-stats"
              onClick={() => setIsTokenPopoverOpen((prev) => !prev)}
              aria-label="Conversation token statistics"
              aria-haspopup="true"
              aria-expanded={isTokenPopoverOpen}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface border border-outline-variant/40 text-xs font-medium tabular-nums transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Active thread token usage"
            >
              <Gauge className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                {effectiveHasEstimated ? '~' : ''}
                {formatTokenCount(effectiveTotalTokens)} tok
              </span>
            </button>

            {isTokenPopoverOpen && (
              <div
                data-testid="token-stats-popover"
                className="absolute right-0 mt-2 w-72 rounded-2xl bg-surface-container-high border border-outline-variant/40 shadow-elevation-3 p-4 z-30 animate-fade-in text-xs text-on-surface"
              >
                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-outline-variant/30">
                  <span className="font-semibold text-sm text-on-surface">
                    Thread Token Usage
                  </span>
                  {effectiveHasEstimated ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-tertiary-container text-on-tertiary-container text-[10px] font-medium">
                      Estimated
                    </span>
                  ) : apiCountTokens !== null ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-primary-container text-on-primary-container text-[10px] font-medium">
                      API Counted
                    </span>
                  ) : null}
                </div>

                <div className="space-y-2 tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Total Tokens</span>
                    <span className="font-semibold text-on-surface">
                      {effectiveHasEstimated ? '~' : ''}
                      {formatTokenCount(effectiveTotalTokens)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Input (Prompt)</span>
                    <span>{formatTokenCount(effectivePromptTokens)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Output (Completion)</span>
                    <span>{formatTokenCount(tokenStats.completionTokens)}</span>
                  </div>
                  {tokenStats.thoughtsTokens > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Thinking</span>
                      <span>{formatTokenCount(tokenStats.thoughtsTokens)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                    <span className="text-on-surface-variant">Current Context</span>
                    <span className="font-medium">
                      {formatTokenCount(effectiveContextTokens)}
                      {inputTokenLimit ? ` / ${formatTokenCount(inputTokenLimit)}` : ''}
                    </span>
                  </div>

                  {contextUsagePct !== null && (
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-1">
                        <span>Context Window</span>
                        <span>{contextUsagePct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            contextUsagePct >= 85
                              ? 'bg-error'
                              : contextUsagePct >= 60
                                ? 'bg-tertiary'
                                : 'bg-primary'
                          }`}
                          style={{ width: `${Math.max(2, contextUsagePct)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-on-surface-variant">
                    <span>Messages in Thread</span>
                    <span>{tokenStats.messageCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
