import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from '../../src/theme/ThemeProvider';
import { ZeroState, getTimeOfDayGreeting } from '../../src/components/conversation/ZeroState';
import { TopAppBar } from '../../src/components/layout/TopAppBar';

const ThemeConsumer = () => {
  const { seedColor, setSeedColor, mode, toggleMode, resolvedMode } = useTheme();
  return (
    <div>
      <span data-testid="seed-val">{seedColor}</span>
      <span data-testid="mode-val">{mode}</span>
      <span data-testid="resolved-mode-val">{resolvedMode}</span>
      <button data-testid="set-purple" onClick={() => setSeedColor('purple')}>Purple</button>
      <button data-testid="toggle-mode" onClick={toggleMode}>Toggle</button>
    </div>
  );
};

describe('M1 Design System & Theme Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('initializes ThemeProvider with default ocean seed and system or default mode', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('seed-val').textContent).toBe('ocean');
    expect(['light', 'dark']).toContain(screen.getByTestId('resolved-mode-val').textContent);
  });

  it('switches seed color and updates DOM attribute and localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('set-purple'));
    expect(screen.getByTestId('seed-val').textContent).toBe('purple');
    expect(document.documentElement.getAttribute('data-seed')).toBe('purple');
    expect(localStorage.getItem('m3_seed_color')).toBe('purple');
  });

  it('toggles mode between light and dark', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    const initialResolved = screen.getByTestId('resolved-mode-val').textContent;
    fireEvent.click(screen.getByTestId('toggle-mode'));
    const nextResolved = screen.getByTestId('resolved-mode-val').textContent;
    expect(nextResolved).not.toBe(initialResolved);
  });
});

describe('ZeroState Component', () => {
  it('renders time of day greeting', () => {
    const greeting = getTimeOfDayGreeting();
    expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(greeting);

    render(<ZeroState onSelectPrompt={() => {}} />);
    expect(screen.getByTestId('zero-state-greeting').textContent).toContain(greeting);
  });

  it('renders all 4 categorized starter cards and triggers prompt selection on click', () => {
    let selectedPrompt = '';
    render(<ZeroState onSelectPrompt={(p) => { selectedPrompt = p; }} />);

    expect(screen.getByTestId('starter-card-code')).toBeInTheDocument();
    expect(screen.getByTestId('starter-card-brainstorm')).toBeInTheDocument();
    expect(screen.getByTestId('starter-card-write')).toBeInTheDocument();
    expect(screen.getByTestId('starter-card-analyze')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('starter-card-code'));
    expect(selectedPrompt).toContain('React hook');
  });
});

describe('TopAppBar Component', () => {
  it('renders title, model badge and accessible buttons', () => {
    render(
      <ThemeProvider>
        <TopAppBar
          title="Test Session"
          modelName="Gemini 1.5 Pro"
          isSidebarOpen={true}
          onToggleSidebar={() => {}}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Test Session')).toBeInTheDocument();
    expect(screen.getByTestId('model-badge')).toHaveTextContent('Gemini 1.5 Pro');
    expect(screen.getByTestId('sidebar-toggle-btn')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('theme-toggle-btn')).toBeInTheDocument();
  });
});
