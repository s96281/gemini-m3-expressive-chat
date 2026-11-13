import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CodeBlock } from './CodeBlock';
import { DataTable } from './DataTable';
import { MermaidBlock } from './MermaidBlock';
import { MarkdownErrorBoundary } from './MarkdownErrorBoundary';

export interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

const ListContext = React.createContext<{ inUl: boolean; inOl: boolean }>({
  inUl: false,
  inOl: false,
});

const StreamingContext = React.createContext<boolean>(false);

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS: React.ComponentProps<typeof ReactMarkdown>['rehypePlugins'] = [
  [rehypeKatex, { throwOnError: false, strict: false }],
];

const MARKDOWN_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1({ children }) {
    return (
      <h1 className="text-2xl font-bold tracking-tight text-on-surface mt-4 mb-2 first:mt-0">
        {children}
      </h1>
    );
  },
  h2({ children }) {
    return (
      <h2 className="text-xl font-semibold tracking-tight text-on-surface mt-3 mb-2 first:mt-0">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return (
      <h3 className="text-lg font-semibold text-on-surface mt-2 mb-1 first:mt-0">
        {children}
      </h3>
    );
  },
  p({ children }) {
    return <p className="mb-2 leading-relaxed last:mb-0">{children}</p>;
  },
  strong({ children }) {
    return <strong className="font-bold text-on-surface">{children}</strong>;
  },
  b({ children }) {
    return <b className="font-bold text-on-surface">{children}</b>;
  },
  em({ children }) {
    return <em className="italic">{children}</em>;
  },
  i({ children }) {
    return <i className="italic">{children}</i>;
  },
  del({ children }) {
    return <del className="line-through opacity-75">{children}</del>;
  },
  s({ children }) {
    return <s className="line-through opacity-75">{children}</s>;
  },
  ul({ children }) {
    return (
      <ListContext.Consumer>
        {({ inUl, inOl }) => {
          if (inUl) {
            return <div className="nested-ul pl-4 my-1 space-y-1">{children}</div>;
          }
          return (
            <ListContext.Provider value={{ inUl: true, inOl }}>
              <ul className="list-disc list-inside my-2 space-y-1 pl-2">{children}</ul>
            </ListContext.Provider>
          );
        }}
      </ListContext.Consumer>
    );
  },
  ol({ children }) {
    return (
      <ListContext.Consumer>
        {({ inUl, inOl }) => {
          if (inOl) {
            return <div className="nested-ol pl-4 my-1 space-y-1">{children}</div>;
          }
          return (
            <ListContext.Provider value={{ inUl, inOl: true }}>
              <ol className="list-decimal list-inside my-2 space-y-1 pl-2">{children}</ol>
            </ListContext.Provider>
          );
        }}
      </ListContext.Consumer>
    );
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-primary pl-4 py-1.5 my-3 italic text-on-surface-variant bg-surface-container-low/50 rounded-r-xl">
        {children}
      </blockquote>
    );
  },
  input({ node: _node, ...props }) {
    if (props.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          data-testid="task-checkbox"
          checked={props.checked}
          readOnly
          className="rounded text-primary focus:ring-0 mr-2 align-middle cursor-default"
        />
      );
    }
    return <input {...props} />;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  code({ node: _node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const codeContent = String(children).replace(/\n$/, '');
    const isMultiLine = codeContent.includes('\n');

    if (match || isMultiLine) {
      const lang = match ? match[1] : '';
      if (lang.toLowerCase() === 'mermaid') {
        return (
          <StreamingContext.Consumer>
            {(streaming) => <MermaidBlock code={codeContent} isStreaming={streaming} />}
          </StreamingContext.Consumer>
        );
      }
      return <CodeBlock language={lang} code={codeContent} />;
    }

    return (
      <code
        className="px-1.5 py-0.5 rounded-md bg-surface-container-highest font-mono text-[0.875em] text-primary font-semibold"
        {...props}
      >
        {children}
      </code>
    );
  },
  table({ children, ...props }) {
    return <DataTable {...props}>{children}</DataTable>;
  },
  th({ node: _node, style, className, children, ...props }) {
    const textAlign = style?.textAlign;
    const alignClass =
      textAlign === 'right'
        ? 'text-right'
        : textAlign === 'center'
        ? 'text-center'
        : 'text-left';
    return (
      <th
        style={style}
        className={`px-4 py-2.5 font-semibold text-on-surface bg-surface-container-high/60 border-b border-outline-variant/40 ${alignClass} ${className || ''}`}
        {...props}
      >
        {children}
      </th>
    );
  },
  td({ node: _node, style, className, children, ...props }) {
    const textAlign = style?.textAlign;
    const alignClass =
      textAlign === 'right'
        ? 'text-right'
        : textAlign === 'center'
        ? 'text-center'
        : 'text-left';
    return (
      <td
        style={style}
        className={`px-4 py-2 border-b border-outline-variant/20 even:bg-surface-container-lowest/40 ${alignClass} ${className || ''}`}
        {...props}
      >
        {children}
      </td>
    );
  },
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline font-medium break-all"
        {...props}
      >
        {children}
      </a>
    );
  },
  hr() {
    return <hr className="my-4 border-outline-variant/30" />;
  },
  img({ src, alt, ...props }) {
    return (
      <img
        src={src}
        alt={alt || 'Generated image'}
        className="max-w-full h-auto rounded-2xl border border-outline-variant/30 my-2 shadow-sm"
        loading="lazy"
        {...props}
      />
    );
  },
};

function allowDataImageUrlTransform(url: string): string {
  const trimmed = (url || '').trim();
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(trimmed)) {
    return trimmed;
  }
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(
  ({ content, isStreaming = false }) => {
    return (
      <MarkdownErrorBoundary fallbackContent={content}>
        <StreamingContext.Provider value={isStreaming}>
          <div className="markdown-content text-sm sm:text-base leading-relaxed text-on-surface select-text">
            <ReactMarkdown
              remarkPlugins={REMARK_PLUGINS}
              rehypePlugins={REHYPE_PLUGINS}
              components={MARKDOWN_COMPONENTS}
              urlTransform={allowDataImageUrlTransform}
            >
              {content}
            </ReactMarkdown>

            {/* Trailing Glowing Cursor during Streaming */}
            {isStreaming && (
              <span
                data-testid="streaming-cursor"
                className="streaming-cursor inline-block w-2 h-4 ml-1 bg-primary align-middle rounded-sm animate-pulse shadow-[0_0_8px_var(--md-sys-color-primary)]"
              />
            )}
          </div>
        </StreamingContext.Provider>
      </MarkdownErrorBoundary>
    );
  }
);

