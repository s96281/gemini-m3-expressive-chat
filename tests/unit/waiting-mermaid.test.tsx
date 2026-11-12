import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageItem } from '../../src/components/conversation/MessageItem';
import { MessageNode } from '../../src/types/chat';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, code: string) => ({
      svg: `<svg data-testid="mocked-mermaid-svg"><text>${code}</text></svg>`,
    })),
  },
}));

const baseBranchInfo = {
  currentIndex: 1,
  totalVersions: 1,
  hasPrev: false,
  hasNext: false,
  prevSiblingId: null,
  nextSiblingId: null,
};

describe('Waiting Animation & Mermaid Block', () => {
  it('shows waiting animation before first token arrives and hides it once content arrives', () => {
    const waitingMsg: MessageNode = {
      id: 'm_wait',
      parentId: 'm_user',
      childrenIds: [],
      role: 'assistant',
      content: '',
      isStreaming: true,
      createdAt: Date.now(),
    };

    const { rerender } = render(
      <MessageItem
        message={waitingMsg}
        branchInfo={baseBranchInfo}
        isStreamingActive={true}
        onSwitchBranch={vi.fn()}
      />
    );

    expect(screen.getByTestId('streaming-waiting-indicator')).toBeInTheDocument();

    const streamedMsg: MessageNode = {
      ...waitingMsg,
      content: 'Hello!',
    };

    rerender(
      <MessageItem
        message={streamedMsg}
        branchInfo={baseBranchInfo}
        isStreamingActive={true}
        onSwitchBranch={vi.fn()}
      />
    );

    expect(screen.queryByTestId('streaming-waiting-indicator')).not.toBeInTheDocument();
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  it('renders mermaid code blocks as MermaidBlock with SVG and Code toggle', async () => {
    const mermaidMsg: MessageNode = {
      id: 'm_mermaid',
      parentId: 'm_user',
      childrenIds: [],
      role: 'assistant',
      content: 'Here is a diagram:\n\n```mermaid\ngraph TD\n  A[Start] --> B[End]\n```',
      isStreaming: false,
      createdAt: Date.now(),
    };

    render(
      <MessageItem
        message={mermaidMsg}
        branchInfo={baseBranchInfo}
        isStreamingActive={false}
        onSwitchBranch={vi.fn()}
      />
    );

    expect(await screen.findByTestId('mermaid-block')).toBeInTheDocument();
    expect(await screen.findByTestId('mocked-mermaid-svg')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mermaid-toggle-code-btn'));
    expect(screen.getByText(/A\[Start\] --> B\[End\]/)).toBeInTheDocument();
  });
});
