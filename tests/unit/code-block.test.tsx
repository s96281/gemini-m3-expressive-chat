import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeBlock } from '../../src/components/rich/CodeBlock';

describe('CodeBlock collapse/expand functionality', () => {
  it('renders expanded by default with line count and toggles collapsed state on click', () => {
    const sampleCode = 'const a = 1;\nconst b = 2;\nconsole.log(a + b);';
    render(<CodeBlock language="typescript" code={sampleCode} />);

    const block = screen.getByTestId('code-block');
    const toggleBtn = screen.getByTestId('toggle-code-collapse-btn');
    const lineCount = screen.getByTestId('code-line-count');

    expect(block).toHaveAttribute('data-collapsed', 'false');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(lineCount).toHaveTextContent('3 lines');
    expect(screen.getByTestId('code-block-body')).toBeInTheDocument();

    // Collapse
    fireEvent.click(toggleBtn);
    expect(block).toHaveAttribute('data-collapsed', 'true');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('code-block-body')).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(toggleBtn);
    expect(block).toHaveAttribute('data-collapsed', 'false');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('code-block-body')).toBeInTheDocument();
  });

  it('displays singular "1 line" for single-line code blocks', () => {
    render(<CodeBlock language="bash" code="echo hello" />);
    expect(screen.getByTestId('code-line-count')).toHaveTextContent('1 line');
  });
});
