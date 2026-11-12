import React, { useState, useRef, useEffect } from 'react';
import { Wrench, Search, Terminal, Globe, ChevronDown } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { GeminiToolsConfig } from '../../types/settings';

interface ToolOption {
  key: keyof GeminiToolsConfig;
  label: string;
  apiName: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

const TOOL_OPTIONS: ToolOption[] = [
  {
    key: 'googleSearch',
    label: 'Google Search',
    apiName: 'google_search',
    description: 'Ground responses with live web search',
    icon: Search,
  },
  {
    key: 'codeExecution',
    label: 'Code Execution',
    apiName: 'code_execution',
    description: 'Run Python code in Gemini sandbox',
    icon: Terminal,
  },
  {
    key: 'urlContext',
    label: 'URL Context',
    apiName: 'url_context',
    description: 'Fetch and analyze web page URLs',
    icon: Globe,
  },
];

export const ToolsSelectorPill: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const engineMode = useSettingsStore((s) => s.engineMode);
  const geminiTools = useSettingsStore((s) => s.geminiTools) || {
    googleSearch: false,
    codeExecution: false,
    urlContext: false,
  };
  const toggleGeminiTool = useSettingsStore((s) => s.toggleGeminiTool);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (engineMode !== 'gemini') {
    return null;
  }

  const activeCount = TOOL_OPTIONS.filter((t) => geminiTools[t.key]).length;

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        type="button"
        data-testid="tools-selector-pill"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Gemini Built-in Tools"
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          activeCount > 0
            ? 'bg-secondary-container text-on-secondary-container border-secondary/40'
            : 'bg-surface-container text-on-surface border-outline-variant/40 hover:bg-surface-container-highest'
        }`}
      >
        <Wrench className="w-3.5 h-3.5 text-primary" />
        <span>Tools{activeCount > 0 ? ` (${activeCount})` : ''}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-on-surface-variant transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          data-testid="tools-selector-menu"
          className="absolute bottom-full left-0 mb-2 w-72 rounded-2xl bg-surface-container-high border border-outline-variant/50 shadow-elevation-3 p-1.5 z-50 animate-fade-in"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-outline flex items-center justify-between">
            <span>Gemini Built-in Tools</span>
            <span className="font-mono text-[9px] text-primary">v1beta</span>
          </div>
          {TOOL_OPTIONS.map((tool) => {
            const Icon = tool.icon;
            const enabled = Boolean(geminiTools[tool.key]);
            return (
              <button
                key={tool.key}
                type="button"
                role="switch"
                aria-checked={enabled}
                data-testid={`tool-toggle-${tool.key}`}
                onClick={() => toggleGeminiTool(tool.key)}
                className="w-full text-left px-2.5 py-2 rounded-xl transition-colors flex items-center justify-between gap-2.5 cursor-pointer hover:bg-surface-container-highest text-on-surface"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      enabled ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold">{tool.label}</span>
                      <span className="text-[10px] font-mono text-outline">{tool.apiName}</span>
                    </div>
                    <p className="text-[10px] text-outline leading-tight mt-0.5">
                      {tool.description}
                    </p>
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                    enabled ? 'bg-primary' : 'bg-outline-variant/60'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-on-primary shadow-sm transition duration-200 ${
                      enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
