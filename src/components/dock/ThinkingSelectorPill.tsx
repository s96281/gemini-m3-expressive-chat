import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Brain, ChevronDown, Check } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ThinkingPreset } from '../../types/settings';
import { resolveGeminiModelId } from '../../services/liveEngine';
import {
  getGeminiThinkingCapability,
  THINKING_PRESET_META,
} from '../../utils/thinkingConfig';

const SIMULATED_PRESETS: ThinkingPreset[] = ['auto', 'off', 'low', 'medium', 'high'];

export const ThinkingSelectorPill: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeSession = useChatStore((s) => s.getActiveSession());
  const {
    engineMode,
    defaultModel,
    fetchedGeminiModels = [],
    thinkingPreset = 'auto',
    setThinkingPreset,
  } = useSettingsStore();

  const currentModelName = activeSession?.model || defaultModel || 'Gemini 1.5 Flash';

  const { supportedPresets, paramModeLabel } = useMemo(() => {
    if (engineMode === 'gemini') {
      const resolvedId = resolveGeminiModelId(currentModelName, fetchedGeminiModels);
      const cap = getGeminiThinkingCapability(resolvedId);
      if (cap.mode === 'none') {
        return { supportedPresets: [] as ThinkingPreset[], paramModeLabel: null };
      }
      return {
        supportedPresets: cap.supportedPresets,
        paramModeLabel: cap.mode === 'level' ? 'thinkingLevel' : 'thinkingBudget',
      };
    }

    if (engineMode === 'simulated') {
      return { supportedPresets: SIMULATED_PRESETS, paramModeLabel: 'Simulated' };
    }

    return { supportedPresets: [] as ThinkingPreset[], paramModeLabel: null };
  }, [engineMode, currentModelName, fetchedGeminiModels]);

  // Resolve effective displayed preset if current preset isn't in supportedPresets
  const effectivePreset: ThinkingPreset = useMemo(() => {
    if (supportedPresets.length === 0) return thinkingPreset;
    if (supportedPresets.includes(thinkingPreset)) return thinkingPreset;
    return supportedPresets[0];
  }, [supportedPresets, thinkingPreset]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (supportedPresets.length === 0) {
    return null;
  }

  const activeMeta = THINKING_PRESET_META[effectivePreset] || THINKING_PRESET_META.auto;

  const handleSelect = (preset: ThinkingPreset) => {
    setThinkingPreset(preset);
    setIsOpen(false);
    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[data-testid="chat-input-textarea"]'
    );
    textarea?.focus();
  };

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        data-testid="thinking-selector-pill"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs ${
          effectivePreset === 'off'
            ? 'bg-surface-container text-outline border-outline-variant/30 hover:bg-surface-container-high'
            : 'bg-surface-container text-on-surface border-outline-variant/30 hover:bg-surface-container-high'
        }`}
        title={`Thinking intensity: ${activeMeta.label}`}
      >
        <Brain
          className={`w-3.5 h-3.5 ${effectivePreset === 'off' ? 'text-outline' : 'text-primary'}`}
        />
        <span className="font-semibold">{activeMeta.shortLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-outline transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          data-testid="thinking-selector-menu"
          className="absolute bottom-full mb-2 left-0 w-64 rounded-2xl bg-surface-container-high border border-outline-variant/40 shadow-elevation-3 py-2 z-50 animate-scale-up"
        >
          <div className="px-3 py-1.5 text-[11px] font-medium text-outline uppercase tracking-wider border-b border-outline-variant/20 mb-1 flex items-center justify-between">
            <span>Thinking</span>
            {paramModeLabel && (
              <code className="text-[10px] normal-case font-mono text-primary">
                {paramModeLabel}
              </code>
            )}
          </div>

          <div className="space-y-1 px-1">
            {supportedPresets.map((preset) => {
              const meta = THINKING_PRESET_META[preset];
              const isSelected = effectivePreset === preset;

              return (
                <button
                  key={preset}
                  type="button"
                  role="menuitem"
                  data-testid={`thinking-option-${preset}`}
                  onClick={() => handleSelect(preset)}
                  className={`w-full px-2.5 py-2 rounded-xl text-left flex items-start gap-2.5 transition-colors ${
                    isSelected
                      ? 'bg-primary-container/20 text-on-surface ring-1 ring-primary'
                      : 'hover:bg-surface-container-highest/60 text-on-surface'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold">{meta.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-outline leading-tight mt-0.5">
                      {meta.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
