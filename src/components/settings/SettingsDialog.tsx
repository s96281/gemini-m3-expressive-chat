import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sliders,
  Cpu,
  UserCheck,
  Database,
  Eye,
  EyeOff,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Check,
  Sparkles,
  Sun,
  Moon,
  Laptop,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useSettingsStore, PERSONA_PRESETS } from '../../store/useSettingsStore';
import { useChatStore } from '../../store/useChatStore';
import { useTheme } from '../../theme/ThemeProvider';
import {
  EngineMode,
  SimulatedSpeed,
  ThinkingPreset,
  TitleEmbeddingModel,
} from '../../types/settings';
import { STORAGE_KEYS } from '../../utils/storage';
import { getAIEngine } from '../../services/aiEngine';
import { fetchGeminiModels } from '../../services/liveEngine';
import { ALL_THINKING_PRESETS, THINKING_PRESET_META } from '../../utils/thinkingConfig';

export interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'engine' | 'personas' | 'data';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testConnectionStatus, setTestConnectionStatus] = useState<string | null>(null);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsStatus, setFetchModelsStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const theme = useTheme();

  // Settings Store state & actions
  const {
    engineMode,
    apiKey,
    apiEndpoint,
    temperature,
    maxTokens,
    simulatedSpeed,
    thinkingPreset = 'auto',
    titleEmbeddingModel = 'gemini-embedding-2',
    activePersonaId,
    customSystemPrompt,
    fetchedGeminiModels = [],
    enabledGeminiModels = [],
    setEngineMode,
    setApiKey,
    setApiEndpoint,
    setTemperature,
    setMaxTokens,
    setSimulatedSpeed,
    setThinkingPreset,
    setTitleEmbeddingModel,
    setActivePersonaId,
    setCustomSystemPrompt,
    setFetchedGeminiModels,
    setEnabledGeminiModels,
    toggleGeminiModelEnabled,
    resetParameters,
    resetPersona,
    resetAllSettings,
    updateSettings,
  } = useSettingsStore();

  const [promptDraft, setPromptDraft] = useState(customSystemPrompt);

  // Sync draft when store changes or modal opens
  useEffect(() => {
    setPromptDraft(customSystemPrompt);
  }, [customSystemPrompt, isOpen]);

  // Handle ESC key for dialog dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isClearModalOpen) {
          setIsClearModalOpen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isClearModalOpen, onClose]);

  // Clear connection test status when switching engine
  useEffect(() => {
    setTestConnectionStatus(null);
    setFetchModelsStatus(null);
  }, [engineMode]);

  if (!isOpen) return null;

  const handleFetchGeminiModels = async () => {
    setIsFetchingModels(true);
    setFetchModelsStatus(null);
    try {
      const models = await fetchGeminiModels(apiKey || '', apiEndpoint);
      setFetchedGeminiModels(models);
      setFetchModelsStatus({
        type: 'success',
        message: `Fetched ${models.length} Gemini model${models.length === 1 ? '' : 's'} from /v1beta/models/`,
      });
    } catch (err: any) {
      setFetchModelsStatus({
        type: 'error',
        message: err?.message || 'Failed to fetch Gemini models',
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setTestConnectionStatus('Testing connection...');
    try {
      const engine = getAIEngine(engineMode);
      const res = await engine.testConnection({ apiKey, apiEndpoint });
      setTestConnectionStatus(res.message);
    } catch (err: any) {
      setTestConnectionStatus(err.message || 'Connection test failed');
    }
  };

  const handleExportAllData = () => {
    try {
      const rawSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS) || '[]';
      const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}';

      const backup = {
        version: '1.0.0',
        sessions: JSON.parse(rawSessions),
        settings: JSON.parse(rawSettings),
        timestamp: Date.now(),
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gemini_m3_chat_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export all data:', err);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (!data || !Array.isArray(data.sessions) || typeof data.settings !== 'object') {
          setImportStatus({
            success: false,
            message: 'Invalid backup file: Missing sessions or settings root keys.',
          });
          return;
        }

        // Write directly to localStorage and update stores
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));

        useChatStore.getState().reloadFromStorage();
        updateSettings(data.settings);

        setImportStatus({
          success: true,
          message: `Successfully imported ${data.sessions.length} chats!`,
        });
      } catch (err) {
        setImportStatus({
          success: false,
          message: 'Failed to parse JSON file.',
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmClearAll = () => {
    localStorage.clear();
    useChatStore.getState().clearAllSessions();
    resetAllSettings();
    setIsClearModalOpen(false);
    onClose();
  };

  return (
    <div
      data-testid="settings-dialog-backdrop"
      className="modal-backdrop fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        data-testid="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] bg-surface-container-high rounded-[28px] border border-outline-variant/50 shadow-elevation-3 flex flex-col overflow-hidden text-on-surface transition-all duration-300"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-container text-on-primary-container">
              <Sliders className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 id="settings-dialog-title" className="text-lg font-semibold tracking-tight">
                Settings
              </h2>
              <p className="text-xs text-outline">Configure chat parameters, personas, and engine</p>
            </div>
          </div>
          <button
            data-testid="close-settings-btn"
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 pb-1 border-b border-outline-variant/20 flex gap-1 sm:gap-2 overflow-x-auto shrink-0">
          <button
            role="tab"
            data-testid="settings-tab"
            id="tab-general"
            data-active={activeTab === 'general'}
            aria-selected={activeTab === 'general'}
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'general'
                ? 'bg-secondary-container text-on-secondary-container font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>General</span>
          </button>

          <button
            role="tab"
            data-testid="tab-engine"
            id="tab-engine"
            data-active={activeTab === 'engine'}
            aria-selected={activeTab === 'engine'}
            onClick={() => setActiveTab('engine')}
            className={`px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'engine'
                ? 'bg-secondary-container text-on-secondary-container font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Model & Engine</span>
          </button>

          <button
            role="tab"
            data-testid="settings-tab"
            id="tab-personas"
            data-active={activeTab === 'personas'}
            aria-selected={activeTab === 'personas'}
            onClick={() => setActiveTab('personas')}
            className={`px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'personas'
                ? 'bg-secondary-container text-on-secondary-container font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Personas</span>
          </button>

          <button
            role="tab"
            data-testid="settings-tab"
            id="tab-data"
            data-active={activeTab === 'data'}
            aria-selected={activeTab === 'data'}
            onClick={() => setActiveTab('data')}
            className={`px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'data'
                ? 'bg-secondary-container text-on-secondary-container font-semibold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Data</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-6">
          {/* TAB 1: GENERAL (Appearance & Generation Hyperparameters) */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Theme Appearance Controls */}
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Appearance & Theme
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Theme Mode Segmented */}
                  <div>
                    <label className="text-xs text-outline font-medium block mb-2">
                      Theme Mode
                    </label>
                    <div className="flex rounded-full bg-surface-container-highest p-1 gap-1">
                      {(['light', 'dark', 'system'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => theme.setMode(m)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-full transition-all capitalize ${
                            theme.mode === m
                              ? 'bg-surface text-primary shadow-sm font-semibold'
                              : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          {m === 'light' && <Sun className="w-3.5 h-3.5" />}
                          {m === 'dark' && <Moon className="w-3.5 h-3.5" />}
                          {m === 'system' && <Laptop className="w-3.5 h-3.5" />}
                          <span>{m}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Seed Colors */}
                  <div>
                    <label className="text-xs text-outline font-medium block mb-2">
                      Seed Palette
                    </label>
                    <div className="flex items-center gap-2 py-1">
                      {theme.availableSeeds.map((seed) => (
                        <button
                          key={seed.id}
                          onClick={() => theme.setSeedColor(seed.id)}
                          title={seed.name}
                          aria-label={`Select ${seed.name} theme`}
                          style={{ backgroundColor: seed.lightPrimary }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            theme.seedColor === seed.id
                              ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-110'
                              : 'opacity-80 hover:opacity-100 hover:scale-105'
                          }`}
                        >
                          {theme.seedColor === seed.id && (
                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Generation Hyperparameters (SET-04) */}
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    Generation Hyperparameters
                  </h3>
                  <button
                    data-testid="reset-parameters-btn"
                    onClick={resetParameters}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Defaults</span>
                  </button>
                </div>

                {/* Temperature Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label
                      htmlFor="temperature-slider"
                      className="font-medium text-on-surface flex items-center gap-1.5"
                    >
                      <span>Temperature</span>
                      <span className="text-outline text-[11px] font-normal">
                        (Randomness & Creativity)
                      </span>
                    </label>
                    <span
                      data-testid="temperature-value"
                      className="font-mono font-semibold px-2 py-0.5 rounded bg-surface-container-highest text-primary text-xs"
                    >
                      {temperature.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="temperature-slider"
                    data-testid="temperature-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-outline px-1">
                    <span>0.0 (Precise / Factual)</span>
                    <span>0.7 (Default)</span>
                    <span>1.0 (Creative)</span>
                  </div>
                </div>

                {/* Max Tokens Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label
                      htmlFor="max-tokens-slider"
                      className="font-medium text-on-surface flex items-center gap-1.5"
                    >
                      <span>Max Output Tokens</span>
                      <span className="text-outline text-[11px] font-normal">(Response Length)</span>
                    </label>
                    <span
                      data-testid="max-tokens-value"
                      className="font-mono font-semibold px-2 py-0.5 rounded bg-surface-container-highest text-primary text-xs"
                    >
                      {maxTokens}
                    </span>
                  </div>
                  <input
                    id="max-tokens-slider"
                    data-testid="max-tokens-slider"
                    type="range"
                    min="256"
                    max="65536"
                    step="256"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-outline px-1">
                    <span>256</span>
                    <span>2048 (Default)</span>
                    <span>65536</span>
                  </div>
                </div>

                {/* Simulated Stream Speed Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface block">
                    Simulated Stream Speed
                  </label>
                  <div
                    data-testid="stream-speed-select"
                    className="grid grid-cols-3 gap-2 rounded-xl bg-surface-container-highest p-1"
                  >
                    {(['fast', 'natural', 'relaxed'] as SimulatedSpeed[]).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        data-testid={`speed-option-${spd}`}
                        onClick={() => setSimulatedSpeed(spd)}
                        className={`py-2 text-xs font-medium rounded-lg capitalize transition-all ${
                          simulatedSpeed === spd
                            ? 'bg-surface text-primary shadow-sm font-semibold'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {spd}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Thinking Intensity Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-on-surface">
                      Thinking Intensity
                    </label>
                    <span className="text-[11px] text-outline">
                      Adapts to Gemini <code className="font-mono">thinkingBudget</code> /{' '}
                      <code className="font-mono">thinkingLevel</code>
                    </span>
                  </div>
                  <div
                    data-testid="thinking-preset-select"
                    className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 rounded-xl bg-surface-container-highest p-1"
                  >
                    {ALL_THINKING_PRESETS.map((preset: ThinkingPreset) => (
                      <button
                        key={preset}
                        type="button"
                        data-testid={`settings-thinking-option-${preset}`}
                        onClick={() => setThinkingPreset(preset)}
                        className={`py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                          thinkingPreset === preset
                            ? 'bg-surface text-primary shadow-sm font-semibold'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                        title={THINKING_PRESET_META[preset].description}
                      >
                        {THINKING_PRESET_META[preset].shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MODEL & ENGINE (SET-03) */}
          {activeTab === 'engine' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  Engine Selection
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'simulated',
                      name: 'Simulated Engine',
                      badge: 'Built-in',
                      desc: 'Zero-configuration offline mock with streaming tokens & thinking blocks',
                    },
                    {
                      id: 'gemini',
                      name: 'Google Gemini',
                      badge: 'API Key',
                      desc: 'Official Gemini 1.5 Pro & Flash via Google AI Studio API',
                    },
                    {
                      id: 'openai',
                      name: 'OpenAI API',
                      badge: 'API Key',
                      desc: 'GPT-4o and compatible chat completion endpoints',
                    },
                    {
                      id: 'ollama',
                      name: 'Local Ollama / Proxy',
                      badge: 'Self-hosted',
                      desc: 'Local open-source models via custom HTTP base URL',
                    },
                  ].map((engine) => (
                    <label
                      key={engine.id}
                      data-testid={`engine-option-${engine.id}`}
                      className={`relative flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                        engineMode === engine.id
                          ? 'border-primary bg-primary-container/20 ring-1 ring-primary'
                          : 'border-outline-variant/40 bg-surface hover:bg-surface-container-highest/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="engineMode"
                            value={engine.id}
                            checked={engineMode === engine.id}
                            onChange={() => setEngineMode(engine.id as EngineMode)}
                            className="text-primary accent-primary"
                          />
                          <span className="font-semibold text-xs text-on-surface">
                            {engine.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-container-highest text-outline">
                          {engine.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-outline pl-5">{engine.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* API Key Configuration */}
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
                <h3 className="text-sm font-semibold text-on-surface">
                  API Key & Endpoint Configuration
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-outline font-medium block mb-1.5">
                      API Key {engineMode === 'simulated' ? '(Optional in simulated mode)' : ''}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        data-testid="api-key-input"
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey || ''}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={
                          engineMode === 'gemini'
                            ? 'AIzaSy...'
                            : engineMode === 'openai'
                            ? 'sk-...'
                            : 'Enter API key (stored locally only)'
                        }
                        className="w-full px-3 py-2 rounded-xl bg-surface-container-highest text-on-surface placeholder:text-outline text-xs border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary pr-10 font-mono"
                      />
                      <button
                        type="button"
                        data-testid="toggle-api-key-mask"
                        onClick={() => setShowApiKey(!showApiKey)}
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                        className="absolute right-2 p-1.5 text-on-surface-variant hover:text-on-surface rounded-full transition-colors"
                      >
                        {showApiKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-outline font-medium block mb-1.5">
                      Custom Base URL / Proxy Endpoint
                    </label>
                    <input
                      data-testid="custom-endpoint-input"
                      type="url"
                      value={apiEndpoint || ''}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="w-full px-3 py-2 rounded-xl bg-surface-container-highest text-on-surface placeholder:text-outline text-xs border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      data-testid="test-connection-btn"
                      onClick={handleTestConnection}
                      className="px-4 py-2 rounded-full bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container text-xs font-medium transition-colors shadow-sm"
                    >
                      Test Connection
                    </button>
                    {testConnectionStatus && (
                      <span className="text-xs font-medium text-primary animate-fade-in">
                        {testConnectionStatus}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Google Gemini Available Models Selector (/v1beta/models/) */}
              {engineMode === 'gemini' && (
                <div
                  data-testid="gemini-models-section"
                  className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4 animate-fade-in"
                >
                  {/* Title Generation Embedding Model Selector */}
                  <div className="space-y-2 pb-3 border-b border-outline-variant/25">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold text-on-surface">
                          Chat Title Embedding Model
                        </h3>
                        <p className="text-[11px] text-outline">
                          Use Gemini Embedding 2 / 1 (<code className="font-mono">batchEmbedContents</code>) to semantically select conversation titles
                        </p>
                      </div>
                      <select
                        data-testid="title-embedding-model-select"
                        aria-label="Chat Title Embedding Model"
                        value={titleEmbeddingModel}
                        onChange={(e) =>
                          setTitleEmbeddingModel(e.target.value as TitleEmbeddingModel)
                        }
                        className="px-3 py-1.5 rounded-xl bg-surface-container-highest border border-outline-variant/40 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="gemini-embedding-2">Gemini Embedding 2</option>
                        <option value="gemini-embedding-001">Gemini Embedding 1 (001)</option>
                        <option value="off">Off (Local Heuristic)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>Google Gemini Available Models</span>
                      </h3>
                      <p className="text-[11px] text-outline mt-0.5">
                        Query <code className="font-mono text-primary">/v1beta/models/</code> and choose which models appear in the chat selector
                      </p>
                    </div>

                    <button
                      type="button"
                      data-testid="fetch-gemini-models-btn"
                      disabled={isFetchingModels}
                      onClick={handleFetchGeminiModels}
                      className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-medium shadow-sm hover:opacity-90 disabled:opacity-60 transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      <span>{isFetchingModels ? 'Fetching...' : 'Fetch Models'}</span>
                    </button>
                  </div>

                  {fetchModelsStatus && (
                    <div
                      data-testid="fetch-gemini-models-status"
                      className={`px-3 py-2 rounded-xl text-xs font-medium border ${
                        fetchModelsStatus.type === 'success'
                          ? 'bg-primary-container/25 border-primary/30 text-primary'
                          : 'bg-error-container/25 border-error/30 text-error'
                      }`}
                    >
                      {fetchModelsStatus.message}
                    </div>
                  )}

                  {fetchedGeminiModels.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="relative flex-1 min-w-[180px]">
                          <Search className="w-3.5 h-3.5 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            data-testid="gemini-model-search"
                            value={modelSearchQuery}
                            onChange={(e) => setModelSearchQuery(e.target.value)}
                            placeholder="Filter models (e.g. 2.5, flash, pro)..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-full bg-surface-container-highest text-on-surface placeholder:text-outline text-xs border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span
                            data-testid="gemini-selected-count"
                            className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-medium text-[11px]"
                          >
                            {enabledGeminiModels.length} / {fetchedGeminiModels.length} selected
                          </span>
                          <button
                            type="button"
                            data-testid="select-all-gemini-models"
                            onClick={() =>
                              setEnabledGeminiModels(fetchedGeminiModels.map((m) => m.id))
                            }
                            className="text-primary hover:underline font-medium text-[11px]"
                          >
                            Select All
                          </button>
                          <span className="text-outline-variant">·</span>
                          <button
                            type="button"
                            data-testid="deselect-all-gemini-models"
                            onClick={() => setEnabledGeminiModels([])}
                            className="text-outline hover:text-on-surface hover:underline font-medium text-[11px]"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div
                        data-testid="gemini-models-list"
                        className="max-h-60 overflow-y-auto overscroll-contain space-y-1.5 pr-1"
                      >
                        {fetchedGeminiModels
                          .filter((m) => {
                            const q = modelSearchQuery.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              m.name.toLowerCase().includes(q) ||
                              m.id.toLowerCase().includes(q) ||
                              m.description.toLowerCase().includes(q)
                            );
                          })
                          .map((model) => {
                            const isChecked = enabledGeminiModels.includes(model.id);
                            const ctxLabel = model.inputTokenLimit
                              ? model.inputTokenLimit >= 1000000
                                ? `${Math.round(model.inputTokenLimit / 1000000)}M ctx`
                                : `${Math.round(model.inputTokenLimit / 1000)}K ctx`
                              : null;

                            return (
                              <label
                                key={model.id}
                                data-testid={`gemini-model-item-${model.id}`}
                                className={`relative flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-primary-container/15 border-primary/50'
                                    : 'bg-surface border-outline-variant/30 hover:bg-surface-container-highest/40'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  data-testid="gemini-model-checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleGeminiModelEnabled(model.id)}
                                  className="sr-only"
                                />
                                <span className="mt-0.5 text-primary shrink-0">
                                  {isChecked ? (
                                    <CheckSquare className="w-4 h-4" />
                                  ) : (
                                    <Square className="w-4 h-4 text-outline" />
                                  )}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs font-semibold text-on-surface truncate">
                                      {model.name}
                                    </span>
                                    <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container-highest text-outline">
                                      {model.id}
                                    </code>
                                    {ctxLabel && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container">
                                        {ctxLabel}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-outline truncate mt-0.5">
                                    {model.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-surface border border-dashed border-outline-variant/50 text-center text-xs text-outline">
                      Enter your Google Gemini API key above and click <strong>Fetch Models</strong> to load available models from <code className="font-mono">/v1beta/models/</code>.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PERSONAS (SET-02) */}
          {activeTab === 'personas' && (
            <div className="space-y-6">
              {/* Presets Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-on-surface">Select Preset Persona</h3>
                  <button
                    data-testid="reset-persona-btn"
                    onClick={() => {
                      resetPersona();
                      setPromptDraft('');
                    }}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Default</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PERSONA_PRESETS.map((p) => {
                    const isSelected = activePersonaId === p.id;
                    return (
                      <div
                        key={p.id}
                        data-testid="persona-card"
                        aria-selected={isSelected}
                        onClick={() => setActivePersonaId(p.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'active border-primary bg-primary-container/20 ring-1 ring-primary shadow-sm'
                            : 'border-outline-variant/30 bg-surface hover:bg-surface-container-highest/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-xs text-on-surface">{p.name}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
                              {p.badgeLabel}
                            </span>
                          </div>
                          <p className="text-[11px] text-outline leading-relaxed">{p.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom System Prompt Editor */}
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="custom-prompt-textarea"
                    className="text-xs font-semibold text-on-surface"
                  >
                    Custom System Prompt Override
                  </label>
                  <span
                    data-testid="prompt-char-counter"
                    className="text-xs font-mono text-outline"
                  >
                    {promptDraft.length} / 4000
                  </span>
                </div>

                <textarea
                  id="custom-prompt-textarea"
                  data-testid="custom-prompt-textarea"
                  rows={4}
                  maxLength={4000}
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  placeholder="Enter custom instructions or personality directives to override the persona..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-highest text-on-surface placeholder:text-outline text-xs border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                />

                <div className="flex justify-end">
                  <button
                    data-testid="save-settings-btn"
                    onClick={() => setCustomSystemPrompt(promptDraft)}
                    className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-medium shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATA MANAGEMENT (SET-05) */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              {/* Backup & Export */}
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <Download className="w-4 h-4 text-primary" />
                  Backup & Export Archive
                </h3>
                <p className="text-xs text-outline leading-relaxed">
                  Export all chat sessions, message branching trees, and application settings as a
                  validated JSON backup file.
                </p>

                <button
                  data-testid="export-all-data-btn"
                  onClick={handleExportAllData}
                  className="px-4 py-2.5 rounded-full bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container text-xs font-medium flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export All Data</span>
                </button>
              </div>

              {/* Restore / Import */}
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  Restore from JSON Backup
                </h3>
                <p className="text-xs text-outline leading-relaxed">
                  Import a previously exported JSON backup file to restore chat histories and
                  configuration settings.
                </p>

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    data-testid="import-data-input"
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                    id="backup-file-input"
                  />
                  <label
                    htmlFor="backup-file-input"
                    className="px-4 py-2.5 rounded-full bg-surface-container-highest hover:bg-surface-container-highest/80 text-on-surface text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer border border-outline-variant/30"
                  >
                    <Upload className="w-4 h-4 text-outline" />
                    <span>Choose Backup File...</span>
                  </label>
                </div>

                {importStatus && (
                  <p
                    className={`text-xs font-medium ${
                      importStatus.success ? 'text-primary' : 'text-error'
                    }`}
                  >
                    {importStatus.message}
                  </p>
                )}
              </div>

              {/* Danger Zone: Clear Storage */}
              <div className="p-4 rounded-2xl bg-error-container/20 border border-error/30 space-y-4">
                <h3 className="text-sm font-semibold text-error flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-error" />
                  Danger Zone
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Permanently delete all stored chats, message trees, preferences, and return the
                  application to zero-state.
                </p>

                <button
                  data-testid="clear-all-data-btn"
                  onClick={() => setIsClearModalOpen(true)}
                  className="px-4 py-2.5 rounded-full bg-error text-on-error hover:bg-error/90 text-xs font-medium flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All Data</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-outline-variant/20 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-surface-container-highest hover:bg-surface-container-highest/80 text-on-surface text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Clear All Data */}
      {isClearModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="clear-data-dialog"
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          >
            <div className="w-full max-w-md bg-surface rounded-[28px] p-6 border border-outline-variant/40 shadow-elevation-4 space-y-4 text-on-surface">
              <div className="flex items-center gap-3 text-error">
                <div className="p-2.5 rounded-full bg-error/10">
                  <AlertTriangle className="w-6 h-6 text-error" />
                </div>
                <h3 className="text-base font-semibold">Delete All Data?</h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Are you sure you want to delete all chats and settings? This action is permanent and
                cannot be undone. All conversation histories and customized configurations will be
                erased.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  data-testid="cancel-clear-btn"
                  onClick={() => setIsClearModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-medium text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                >
                  Cancel
                </button>
                <button
                  data-testid="confirm-clear-data-btn"
                  onClick={handleConfirmClearAll}
                  className="px-4 py-2 rounded-full text-xs font-medium bg-error text-on-error hover:bg-error/90 transition-colors shadow-sm"
                >
                  Delete All Data
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
