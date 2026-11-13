import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, Play } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import { useArtifactStore } from '../../store/useArtifactStore';
import { ArtifactType } from '../../types/artifact';

export interface CodeBlockProps {
  language?: string;
  code: string;
}

function getGrammarAndName(lang?: string) {
  const raw = (lang || '').toLowerCase().trim();
  if (!raw) return { grammar: Prism.languages.javascript, display: 'code', key: 'javascript' };
  if (raw === 'ts' || raw === 'typescript') {
    return { grammar: Prism.languages.typescript || Prism.languages.javascript, display: 'typescript', key: 'typescript' };
  }
  if (raw === 'js' || raw === 'javascript') {
    return { grammar: Prism.languages.javascript, display: 'javascript', key: 'javascript' };
  }
  if (raw === 'py' || raw === 'python') {
    return { grammar: Prism.languages.python, display: 'python', key: 'python' };
  }
  if (raw === 'bash' || raw === 'sh' || raw === 'shell') {
    return { grammar: Prism.languages.bash, display: 'bash', key: 'bash' };
  }
  if (raw === 'json') {
    return { grammar: Prism.languages.json, display: 'json', key: 'json' };
  }
  if (raw === 'css') {
    return { grammar: Prism.languages.css, display: 'css', key: 'css' };
  }
  if (raw === 'sql') {
    return { grammar: Prism.languages.sql, display: 'sql', key: 'sql' };
  }
  if (raw === 'yaml' || raw === 'yml') {
    return { grammar: Prism.languages.yaml, display: 'yaml', key: 'yaml' };
  }
  if (raw === 'html' || raw === 'xml' || raw === 'svg') {
    return { grammar: Prism.languages.markup, display: raw, key: 'markup' };
  }
  if (raw === 'markdown' || raw === 'md') {
    return { grammar: Prism.languages.markdown, display: 'markdown', key: 'markdown' };
  }
  return { grammar: Prism.languages[raw] || Prism.languages.javascript, display: raw, key: raw };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const openArtifact = useArtifactStore((state) => state.openArtifact);

  const { grammar, display, key } = getGrammarAndName(language);
  const lineCount = React.useMemo(() => code.split('\n').length, [code]);

  const highlighted = React.useMemo(() => {
    try {
      if (grammar) {
        return Prism.highlight(code, grammar, key);
      }
    } catch (e) {
      console.warn('Prism highlighting error:', e);
    }
    return escapeHtml(code);
  }, [code, grammar, key]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const isPreviewable = ['html', 'svg', 'xml'].includes(display.toLowerCase());

  const handleOpenArtifact = () => {
    const artifactType: ArtifactType = display.toLowerCase() === 'svg' ? 'svg' : 'html';
    openArtifact({
      id: `art-${Date.now()}`,
      type: artifactType,
      title: `${display.toUpperCase()} Artifact`,
      code,
      language: display,
    });
  };

  return (
    <div
      data-testid="code-block"
      data-collapsed={isCollapsed ? 'true' : 'false'}
      className="code-block my-4 rounded-2xl bg-[#1e1e2e] text-[#cdd6f4] border border-outline-variant/30 overflow-hidden shadow-md"
    >
      {/* Code Block Header */}
      <div
        className={`code-header flex items-center justify-between px-4 py-2 bg-[#181825]/90 text-xs text-[#a6adc8] font-mono select-none ${
          isCollapsed ? '' : 'border-b border-white/10'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            data-testid="toggle-code-collapse-btn"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand code block' : 'Collapse code block'}
            title={isCollapsed ? 'Expand code' : 'Collapse code'}
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1 -ml-1 rounded-md hover:bg-white/10 text-[#a6adc8] hover:text-white transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <span
            data-testid="code-lang-badge"
            className="font-medium tracking-wide text-primary-container uppercase text-[11px]"
          >
            {display}
          </span>

          <span
            data-testid="code-line-count"
            className="text-[11px] text-[#7f849c] tabular-nums"
          >
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isPreviewable && (
            <button
              type="button"
              data-testid="open-artifact-btn"
              onClick={handleOpenArtifact}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary text-on-primary hover:opacity-90 transition-opacity shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview</span>
            </button>
          )}

          <button
            type="button"
            data-testid="copy-code-btn"
            aria-label={copied ? 'Copied code' : 'Copy code'}
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-white/90 hover:text-white transition-all font-sans"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 opacity-80" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Body */}
      {!isCollapsed && (
        <pre
          data-testid="code-block-body"
          className="overflow-x-auto p-4 text-sm font-mono leading-relaxed"
          style={{ overflowX: 'auto' }}
        >
          <code
            className={`language-${key}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      )}
    </div>
  );
};
