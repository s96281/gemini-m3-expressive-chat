import React, { useEffect, useId, useState } from 'react';
import { Check, Code2, Copy, Eye, GitBranch } from 'lucide-react';

export interface MermaidBlockProps {
  code: string;
  isStreaming?: boolean;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ code, isStreaming = false }) => {
  const reactId = useId().replace(/:/g, '_');
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      if (!code.trim()) return;
      try {
        const mermaidMod = await import('mermaid');
        const mermaid = mermaidMod.default;
        const isDark =
          typeof document !== 'undefined' &&
          (document.documentElement.classList.contains('dark') ||
            document.documentElement.getAttribute('data-theme') === 'dark');

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
        });

        const renderId = `mermaid_${reactId}_${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(renderId, code.trim());
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render Mermaid diagram');
        }
      }
    };

    void renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      data-testid="mermaid-block"
      className="my-3 rounded-2xl overflow-hidden border border-outline-variant/40 bg-surface-container-lowest shadow-sm"
    >
      {/* M3 Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-surface-container border-b border-outline-variant/30 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-on-surface">
          <GitBranch className="w-3.5 h-3.5 text-primary" />
          <span>Mermaid Diagram</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="mermaid-toggle-code-btn"
            onClick={() => setShowCode((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
          >
            {showCode ? (
              <>
                <Eye className="w-3 h-3" />
                <span>Diagram</span>
              </>
            ) : (
              <>
                <Code2 className="w-3 h-3" />
                <span>Code</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
            title="Copy Mermaid source"
          >
            {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Diagram or Source View */}
      {showCode || (!svg && (isStreaming || error)) ? (
        <div className="p-3.5 overflow-x-auto bg-surface-container-lowest">
          {error && !isStreaming && !showCode && (
            <p className="text-[11px] text-outline mb-2">
              {svg ? '' : 'Showing Mermaid source (diagram syntax incomplete or invalid).'}
            </p>
          )}
          <pre className="text-xs font-mono text-on-surface whitespace-pre-wrap break-words">
            <code>{code}</code>
          </pre>
        </div>
      ) : (
        <div
          data-testid="mermaid-svg-container"
          className="p-4 overflow-x-auto flex justify-center items-center bg-surface-container-lowest [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
};
