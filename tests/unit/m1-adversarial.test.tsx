import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { ZeroState, getTimeOfDayGreeting } from '../../src/components/conversation/ZeroState';
import { TopAppBar } from '../../src/components/layout/TopAppBar';
import { AppShell } from '../../src/components/layout/AppShell';
import { NavigationDrawer } from '../../src/components/layout/NavigationDrawer';
import { NavigationRail } from '../../src/components/layout/NavigationRail';

describe('Adversarial Unit Tests: ZeroState Component', () => {
  it('handles mock callback invocations for all 4 starter cards without throwing', () => {
    const onSelectPrompt = vi.fn();
    render(<ZeroState onSelectPrompt={onSelectPrompt} userName="Tester" />);

    const cardIds = [
      'starter-card-code',
      'starter-card-brainstorm',
      'starter-card-write',
      'starter-card-analyze',
    ];

    for (const testId of cardIds) {
      const card = screen.getByTestId(testId);
      expect(card).toBeInTheDocument();
      fireEvent.click(card);
    }

    expect(onSelectPrompt).toHaveBeenCalledTimes(4);
    expect(onSelectPrompt).toHaveBeenNthCalledWith(
      1,
      'Create a custom React hook for debouncing input with TypeScript and clean cleanup.'
    );
    expect(onSelectPrompt).toHaveBeenNthCalledWith(
      2,
      'Brainstorm 5 innovative features for a modern AI chat application using Material 3 Expressive.'
    );
    expect(onSelectPrompt).toHaveBeenNthCalledWith(
      3,
      'Draft an engaging blog post explaining the principles of Material 3 Expressive design.'
    );
    expect(onSelectPrompt).toHaveBeenNthCalledWith(
      4,
      'Analyze architectural trade-offs between client-side simulated AI streaming versus server-side SSE.'
    );
  });

  it('renders custom user name in greeting', () => {
    render(<ZeroState onSelectPrompt={() => {}} userName="EmpiricalChallenger" />);
    expect(screen.getByTestId('zero-state-greeting').textContent).toContain('EmpiricalChallenger');
  });

  it('evaluates time of day greetings accurately across 24 hours', () => {
    const originalDate = global.Date;

    const testHours = [
      { hour: 6, expected: 'Good morning' },
      { hour: 11, expected: 'Good morning' },
      { hour: 12, expected: 'Good afternoon' },
      { hour: 17, expected: 'Good afternoon' },
      { hour: 18, expected: 'Good evening' },
      { hour: 23, expected: 'Good evening' },
      { hour: 3, expected: 'Good evening' },
    ];

    testHours.forEach(({ hour, expected }) => {
      vi.useFakeTimers();
      const mockDate = new Date(2026, 10, 12, hour, 0, 0);
      vi.setSystemTime(mockDate);
      expect(getTimeOfDayGreeting()).toBe(expected);
      vi.useRealTimers();
    });
  });
});

describe('Adversarial Unit Tests: AppShell Keyboard & Toggle Invariants', () => {
  beforeEach(() => {
    localStorage.clear();
    window.innerWidth = 1200;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toggles sidebar via Ctrl+[ and Cmd+[ keyboard event', () => {
    render(
      <ThemeProvider>
        <AppShell>
          <div>Canvas Content</div>
        </AppShell>
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId('sidebar-toggle-btn');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Trigger Ctrl+[
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '[', ctrlKey: true, bubbles: true })
      );
    });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Trigger Cmd+[ (metaKey)
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'BracketLeft', metaKey: true, bubbles: true })
      );
    });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Trigger normal '[' without Ctrl or Cmd: should NOT toggle
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '[', ctrlKey: false, metaKey: false, bubbles: true })
      );
    });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('dismisses sidebar via ESC key on mobile viewports (<768px)', () => {
    window.innerWidth = 375;
    render(
      <ThemeProvider>
        <AppShell>
          <div>Canvas Content</div>
        </AppShell>
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId('sidebar-toggle-btn');
    // Initially closed on mobile
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Open drawer
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Press Escape
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('tapping scrim backdrop dismisses drawer on mobile', () => {
    window.innerWidth = 375;
    render(
      <ThemeProvider>
        <AppShell>
          <div>Canvas Content</div>
        </AppShell>
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId('sidebar-toggle-btn');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    const scrim = screen.getByTestId('drawer-scrim');
    fireEvent.click(scrim);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('rapid-clicking toggle button 50 times produces consistent deterministic state', () => {
    render(
      <ThemeProvider>
        <AppShell>
          <div>Canvas Content</div>
        </AppShell>
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId('sidebar-toggle-btn');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // 50 clicks (even)
    for (let i = 0; i < 50; i++) {
      fireEvent.click(toggleBtn);
    }

    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // 1 click (odd)
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Adversarial Unit Tests: NavigationDrawer Sessions & Search Filter', () => {
  it('filters sessions accurately and triggers onSelectSession', () => {
    const onSelectSession = vi.fn();
    const sessions = [
      { id: '1', title: 'React Performance Tuning', updatedAt: 1000 },
      { id: '2', title: 'Material 3 Expressive Design', updatedAt: 2000 },
      { id: '3', title: 'Rust WebAssembly Pipeline', updatedAt: 3000 },
    ];

    render(
      <NavigationDrawer
        isOpen={true}
        onClose={() => {}}
        onNewChat={() => {}}
        sessions={sessions}
        onSelectSession={onSelectSession}
      />
    );

    expect(screen.getByText('React Performance Tuning')).toBeInTheDocument();
    expect(screen.getByText('Material 3 Expressive Design')).toBeInTheDocument();
    expect(screen.getByText('Rust WebAssembly Pipeline')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search chats...');
    fireEvent.change(searchInput, { target: { value: 'Material' } });

    expect(screen.queryByText('React Performance Tuning')).not.toBeInTheDocument();
    expect(screen.getByText('Material 3 Expressive Design')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Material 3 Expressive Design'));
    expect(onSelectSession).toHaveBeenCalledWith('2');
  });
});

describe('Adversarial Unit Tests: TopAppBar Accessibility & States', () => {
  it('properly alternates aria-label and aria-expanded', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ThemeProvider>
        <TopAppBar
          isSidebarOpen={true}
          onToggleSidebar={onToggle}
          title="Session Title"
          modelName="Gemini 1.5 Pro"
        />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId('sidebar-toggle-btn');
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Close sidebar');

    rerender(
      <ThemeProvider>
        <TopAppBar
          isSidebarOpen={false}
          onToggleSidebar={onToggle}
          title="Session Title"
          modelName="Gemini 1.5 Pro"
        />
      </ThemeProvider>
    );

    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Open sidebar');
  });
});
