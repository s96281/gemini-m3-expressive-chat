import React, { useEffect, useMemo } from 'react';
import {
  Code2,
  Download,
  Eye,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { useArtifactStore } from '../../store/useArtifactStore';
import { CodeBlock } from '../rich/CodeBlock';

export const ArtifactSandboxPane: React.FC = () => {
  const {
    isOpen,
    artifact,
    activeTab,
    isFullscreen,
    closeArtifact,
    setActiveTab,
    toggleFullscreen,
  } = useArtifactStore();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeArtifact();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeArtifact]);

  const srcDoc = useMemo(() => {
    if (!artifact) return '';
    if (artifact.type === 'svg') {
      return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        padding: 24px;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
      }
      svg {
        max-width: 100%;
        max-height: 80vh;
        height: auto;
      }
    </style>
  </head>
  <body>
    ${artifact.code}
  </body>
</html>`;
    }

    if (artifact.code.includes('<html') || artifact.code.includes('<!DOCTYPE')) {
      return artifact.code;
    }

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        padding: 24px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #1a1a1a;
        background: #ffffff;
      }
    </style>
  </head>
  <body>
    ${artifact.code}
  </body>
</html>`;
  }, [artifact]);

  if (!isOpen || !artifact) {
    return null;
  }

  const handleDownload = () => {
    if (!artifact) return;
    const ext =
      artifact.type === 'svg'
        ? 'svg'
        : artifact.type === 'react'
        ? 'tsx'
        : 'html';
    const cleanTitle = (artifact.title || 'artifact')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const filename = `${cleanTitle}.${ext}`;
    const mime = artifact.type === 'svg' ? 'image/svg+xml' : 'text/html';

    const blob = new Blob([artifact.code], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      data-testid="artifact-sandbox-pane"
      aria-label="Artifact Sandbox"
      className={`fixed top-0 right-0 bottom-0 z-50 bg-surface flex flex-col border-l border-outline-variant/40 shadow-2xl transition-all duration-300 ${
        isFullscreen
          ? 'w-full h-full inset-0'
          : 'w-full md:w-[500px] lg:w-[600px] max-w-full'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30 bg-surface-container-low select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center bg-surface-container-highest p-0.5 rounded-full border border-outline-variant/30">
            <button
              type="button"
              data-testid="artifact-preview-tab"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                activeTab === 'preview'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              data-testid="artifact-code-tab"
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                activeTab === 'code'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </div>

          <h2 className="text-xs font-medium text-outline truncate hidden sm:inline-block max-w-[160px]">
            {artifact.title}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          {/* Download Button */}
          <button
            type="button"
            data-testid="artifact-download-btn"
            aria-label="Download artifact"
            onClick={handleDownload}
            className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            data-testid="artifact-fullscreen-btn"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={toggleFullscreen}
            className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Close Button */}
          <button
            type="button"
            data-testid="close-artifact-btn"
            aria-label="Close artifact preview"
            onClick={closeArtifact}
            className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pane Content Area */}
      <div className="flex-1 overflow-hidden relative bg-surface">
        {activeTab === 'preview' ? (
          <iframe
            data-testid="artifact-iframe"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="w-full h-full border-0 bg-white"
            title={artifact.title || 'Artifact Preview'}
          />
        ) : (
          <div className="w-full h-full overflow-y-auto p-4 bg-surface-container-lowest">
            <CodeBlock
              language={artifact.language || artifact.type}
              code={artifact.code}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
