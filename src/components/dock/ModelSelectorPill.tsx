import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Sparkles, Zap, Brain, Cpu, Bot } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';

export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: React.ElementType;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    badge: 'Fast & Lightweight',
    description: 'Sub-second latency with low memory footprint',
    icon: Zap,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    badge: 'Reasoning & Vision',
    description: 'Deep reasoning, multi-modal, and math logic',
    icon: Sparkles,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    badge: 'Omni Multimodal',
    description: 'Flagship versatility and code reasoning',
    icon: Brain,
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    badge: 'Elite Coding',
    description: 'Exceptional code generation and structured prose',
    icon: Cpu,
  },
  {
    id: 'llama-3',
    name: 'Llama 3 (Local)',
    badge: 'Self-Hosted',
    description: 'Offline open weights on local Ollama server',
    icon: Bot,
  },
];

export const ModelSelectorPill: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { activeSessionId, getActiveSession, setSessionModel } = useChatStore();
  const activeSession = getActiveSession();
  const currentModelName = activeSession?.model || 'Gemini 1.5 Flash';

  const selectedModel =
    AVAILABLE_MODELS.find(
      (m) => m.name.toLowerCase() === currentModelName.toLowerCase() || m.id === currentModelName
    ) || AVAILABLE_MODELS[0];

  const SelectedIcon = selectedModel.icon;

  // Escape key handler
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

  const handleSelectModel = (model: ModelOption) => {
    if (activeSessionId) {
      setSessionModel(activeSessionId, model.name);
    }
    setIsOpen(false);
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    textarea?.focus();
  };


  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        data-testid="model-selector-pill"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-xs font-medium text-on-surface hover:bg-surface-container-high border border-outline-variant/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
      >
        <SelectedIcon className="w-3.5 h-3.5 text-primary" />
        <span className="truncate max-w-[130px] font-semibold">{selectedModel.name}</span>
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
          data-testid="model-selector-menu"
          className="absolute bottom-full mb-2 left-0 w-72 rounded-2xl bg-surface-container-high border border-outline-variant/40 shadow-elevation-3 py-2 z-50 animate-scale-up"
        >
          <div className="px-3 py-1.5 text-[11px] font-medium text-outline uppercase tracking-wider border-b border-outline-variant/20 mb-1">
            Select Model
          </div>

          <div className="space-y-1 px-1">
            {AVAILABLE_MODELS.map((model) => {
              const isSelected = selectedModel.id === model.id;
              const ModelIcon = model.icon;

              return (
                <button
                  key={model.id}
                  type="button"
                  role="menuitem"
                  data-testid="model-option"
                  onClick={() => handleSelectModel(model)}
                  className={`w-full px-2.5 py-2 rounded-xl text-left flex items-start gap-2.5 transition-colors ${
                    isSelected
                      ? 'bg-primary-container/20 text-on-surface ring-1 ring-primary'
                      : 'hover:bg-surface-container-highest/60 text-on-surface'
                  }`}
                >
                  <ModelIcon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isSelected ? 'text-primary' : 'text-outline'
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-semibold truncate">{model.name}</span>
                      <span
                        data-testid="model-badge"
                        className="badge text-[10px] font-medium px-1.5 py-0.2 rounded bg-surface-container-highest text-primary shrink-0"
                      >
                        {model.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-outline leading-tight truncate">
                      {model.description}
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
