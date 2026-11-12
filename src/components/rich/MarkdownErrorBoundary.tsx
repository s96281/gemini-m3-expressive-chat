import { Component, ErrorInfo, ReactNode } from 'react';

export interface MarkdownErrorBoundaryProps {
  children: ReactNode;
  fallbackContent?: string;
}

interface MarkdownErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class MarkdownErrorBoundary extends Component<
  MarkdownErrorBoundaryProps,
  MarkdownErrorBoundaryState
> {
  public state: MarkdownErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): MarkdownErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('MarkdownErrorBoundary caught render error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="font-mono text-sm whitespace-pre-wrap p-3 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/30 my-2">
          {this.props.fallbackContent || 'Error rendering content.'}
        </div>
      );
    }

    return this.props.children;
  }
}
