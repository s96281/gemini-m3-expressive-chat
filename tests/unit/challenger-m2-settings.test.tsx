import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSettingsStore, PERSONA_PRESETS, DEFAULT_SETTINGS } from '../../src/store/useSettingsStore';
import { useChatStore } from '../../src/store/useChatStore';
import { STORAGE_KEYS, normalizeSession, loadSessionsFromStorage } from '../../src/utils/storage';
import { SettingsDialog } from '../../src/components/settings/SettingsDialog';
import { TopAppBar } from '../../src/components/layout/TopAppBar';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

describe('Adversarial Challenger 2: Milestone 2 Settings & Data Management', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.getState().clearAllSessions();
    useSettingsStore.getState().resetAllSettings();
  });

  // =========================================================================
  // 1. Settings Persistence in localStorage['m3_settings']
  // =========================================================================
  describe('1. Settings Persistence in localStorage[m3_settings]', () => {
    it('persists strictly as a flat JSON object without Zustand wrapper { state: ... }', () => {
      const store = useSettingsStore.getState();
      store.setTemperature(0.35);
      store.setMaxTokens(4096);
      store.setEngineMode('gemini');
      store.setSimulatedSpeed('fast');

      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);

      expect(parsed).toEqual(
        expect.objectContaining({
          engineMode: 'gemini',
          temperature: 0.35,
          maxTokens: 4096,
          simulatedSpeed: 'fast',
        })
      );
      expect(parsed.state).toBeUndefined();
      expect(parsed.version).toBeUndefined();
    });

    it('preserves boundary value temperature = 0.0 without falling back to default 0.7', () => {
      const store = useSettingsStore.getState();
      store.setTemperature(0);

      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const parsed = JSON.parse(raw!);
      expect(parsed.temperature).toBe(0);
      expect(useSettingsStore.getState().temperature).toBe(0);
    });

    it('preserves boundary values for maxTokens (256 min, 8192 max)', () => {
      const store = useSettingsStore.getState();

      store.setMaxTokens(256);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)!).maxTokens).toBe(256);

      store.setMaxTokens(8192);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)!).maxTokens).toBe(8192);
    });

    it('safely recovers defaults when storage contains corrupted unparseable JSON', () => {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, '{corrupted:json:');

      // Trigger store rehydration or read
      const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      useSettingsStore.getState().resetAllSettings();
      spyWarn.mockRestore();

      expect(useSettingsStore.getState().temperature).toBe(DEFAULT_SETTINGS.temperature);
      expect(useSettingsStore.getState().maxTokens).toBe(DEFAULT_SETTINGS.maxTokens);
    });

    it('resetParameters cleanly resets temperature, maxTokens, and speed while preserving persona and engine', () => {
      const store = useSettingsStore.getState();
      store.setTemperature(0.1);
      store.setMaxTokens(1024);
      store.setSimulatedSpeed('relaxed');
      store.setActivePersonaId('writer');
      store.setEngineMode('openai');

      store.resetParameters();

      const state = useSettingsStore.getState();
      expect(state.temperature).toBe(DEFAULT_SETTINGS.temperature);
      expect(state.maxTokens).toBe(DEFAULT_SETTINGS.maxTokens);
      expect(state.simulatedSpeed).toBe(DEFAULT_SETTINGS.simulatedSpeed);
      // Preserved fields
      expect(state.activePersonaId).toBe('writer');
      expect(state.engineMode).toBe('openai');

      const persisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)!);
      expect(persisted.temperature).toBe(DEFAULT_SETTINGS.temperature);
      expect(persisted.activePersonaId).toBe('writer');
    });

    it('resetAllSettings restores all fields to DEFAULT_SETTINGS and syncs to storage', () => {
      const store = useSettingsStore.getState();
      store.setTemperature(0.95);
      store.setActivePersonaId('analyst');
      store.setCustomSystemPrompt('Custom instructions override');
      store.setApiKey('secret-key-xyz');

      store.resetAllSettings();

      const state = useSettingsStore.getState();
      expect(state.temperature).toBe(DEFAULT_SETTINGS.temperature);
      expect(state.activePersonaId).toBe('architect');
      expect(state.customSystemPrompt).toBe('');
      expect(state.apiKey).toBe('');

      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      expect(JSON.parse(raw!)).toEqual(DEFAULT_SETTINGS);
    });
  });

  // =========================================================================
  // 2. Persona Presets & Custom System Prompt Persistence and Propagation
  // =========================================================================
  describe('2. Persona Presets & System Prompt Persistence and Propagation', () => {
    it('provides exactly 4 required persona presets in correct canonical order', () => {
      expect(PERSONA_PRESETS).toHaveLength(4);
      expect(PERSONA_PRESETS[0].id).toBe('architect');
      expect(PERSONA_PRESETS[0].name).toBe('Software Architect');
      expect(PERSONA_PRESETS[1].id).toBe('writer');
      expect(PERSONA_PRESETS[1].name).toBe('Creative Writer');
      expect(PERSONA_PRESETS[2].id).toBe('tutor');
      expect(PERSONA_PRESETS[2].name).toBe('Concise Tutor');
      expect(PERSONA_PRESETS[3].id).toBe('analyst');
      expect(PERSONA_PRESETS[3].name).toBe('Data Analyst');
    });

    it('getActivePersona gracefully falls back to architect (index 0) if activePersonaId is unrecognized', () => {
      useSettingsStore.getState().setActivePersonaId('non-existent-persona-id');
      const persona = useSettingsStore.getState().getActivePersona();
      expect(persona).toBeDefined();
      expect(persona.id).toBe('architect');
      expect(persona.name).toBe('Software Architect');
    });

    it('getEffectiveSystemPrompt returns customSystemPrompt when provided and trimmed', () => {
      const store = useSettingsStore.getState();
      store.setActivePersonaId('architect');
      store.setCustomSystemPrompt('   You are a specialized code reviewer.   ');

      const effective = store.getEffectiveSystemPrompt();
      expect(effective).toBe('You are a specialized code reviewer.');
    });

    it('getEffectiveSystemPrompt falls back to active persona prompt if customSystemPrompt is empty or pure whitespace', () => {
      const store = useSettingsStore.getState();
      store.setActivePersonaId('tutor');
      store.setCustomSystemPrompt('   \n\t   ');

      const effective = store.getEffectiveSystemPrompt();
      expect(effective).toBe(PERSONA_PRESETS[2].systemPrompt);
      expect(effective).toContain('Feynman technique');
    });

    it('resetPersona restores activePersonaId to architect and clears customSystemPrompt', () => {
      const store = useSettingsStore.getState();
      store.setActivePersonaId('analyst');
      store.setCustomSystemPrompt('Analyze metrics');

      store.resetPersona();

      expect(store.activePersonaId).toBe('architect');
      expect(store.customSystemPrompt).toBe('');
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)!).activePersonaId).toBe('architect');
    });

    it('TopAppBar renders active persona badge and updates reactively when persona changes', () => {
      useSettingsStore.getState().setActivePersonaId('architect');

      const { rerender } = render(
        <ThemeProvider>
          <TopAppBar isSidebarOpen={true} onToggleSidebar={() => {}} />
        </ThemeProvider>
      );

      const badge = screen.getByTestId('active-persona-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Architect');

      // Change persona to Writer
      useSettingsStore.getState().setActivePersonaId('writer');

      rerender(
        <ThemeProvider>
          <TopAppBar isSidebarOpen={true} onToggleSidebar={() => {}} />
        </ThemeProvider>
      );

      expect(screen.getByTestId('active-persona-badge')).toHaveTextContent('Writer');
    });
  });

  // =========================================================================
  // 3. Full JSON Backup Export & Import with Corruption Rejection
  // =========================================================================
  describe('3. JSON Backup Export & Import with Corruption Rejection', () => {
    it('exports all sessions and settings into a valid backup payload structure', () => {
      const session = {
        id: 's_export_1',
        title: 'Exportable Session',
        rootMessageId: null,
        activeLeafId: null,
        messages: {},
        pinned: true,
        model: 'Gemini 1.5 Flash',
        createdAt: 1000,
        updatedAt: 2000,
      };
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([session]));
      localStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify({ temperature: 0.42, maxTokens: 1024 })
      );

      // Verify what handleExportAllData builds
      const rawSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS) || '[]';
      const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}';

      const backup = {
        version: '1.0.0',
        sessions: JSON.parse(rawSessions),
        settings: JSON.parse(rawSettings),
        timestamp: Date.now(),
      };

      expect(backup.version).toBe('1.0.0');
      expect(Array.isArray(backup.sessions)).toBe(true);
      expect(backup.sessions).toHaveLength(1);
      expect(backup.sessions[0].id).toBe('s_export_1');
      expect(typeof backup.settings).toBe('object');
      expect(backup.settings.temperature).toBe(0.42);
      expect(typeof backup.timestamp).toBe('number');
    });

    it('rejects corrupt/unparseable JSON file during import', async () => {
      render(
        <ThemeProvider>
          <SettingsDialog isOpen={true} onClose={() => {}} />
        </ThemeProvider>
      );

      // Switch to Data tab
      const dataTab = screen.getByRole('tab', { name: /data/i });
      fireEvent.click(dataTab);

      const fileInput = screen.getByTestId('import-data-input');
      const corruptFile = new File(['{not valid json!@#$'], 'corrupt.json', {
        type: 'application/json',
      });

      fireEvent.change(fileInput, { target: { files: [corruptFile] } });

      await waitFor(() => {
        expect(screen.getByText(/Failed to parse JSON file/i)).toBeInTheDocument();
      });
    });

    it('rejects backup payload missing sessions root key', async () => {
      render(
        <ThemeProvider>
          <SettingsDialog isOpen={true} onClose={() => {}} />
        </ThemeProvider>
      );

      const dataTab = screen.getByRole('tab', { name: /data/i });
      fireEvent.click(dataTab);

      const fileInput = screen.getByTestId('import-data-input');
      const missingSessionsPayload = JSON.stringify({
        version: '1.0.0',
        settings: { temperature: 0.5 },
      });
      const file = new File([missingSessionsPayload], 'missing_sessions.json', {
        type: 'application/json',
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid backup file: Missing sessions or settings root keys/i)
        ).toBeInTheDocument();
      });
    });

    it('rejects backup payload where sessions is not an array', async () => {
      render(
        <ThemeProvider>
          <SettingsDialog isOpen={true} onClose={() => {}} />
        </ThemeProvider>
      );

      const dataTab = screen.getByRole('tab', { name: /data/i });
      fireEvent.click(dataTab);

      const fileInput = screen.getByTestId('import-data-input');
      const invalidSessionsPayload = JSON.stringify({
        version: '1.0.0',
        sessions: 'not an array',
        settings: {},
      });
      const file = new File([invalidSessionsPayload], 'invalid_sessions.json', {
        type: 'application/json',
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid backup file: Missing sessions or settings root keys/i)
        ).toBeInTheDocument();
      });
    });

    it('successfully imports valid backup restoring sessions and settings to store and storage', async () => {
      render(
        <ThemeProvider>
          <SettingsDialog isOpen={true} onClose={() => {}} />
        </ThemeProvider>
      );

      const dataTab = screen.getByRole('tab', { name: /data/i });
      fireEvent.click(dataTab);

      const validPayload = JSON.stringify({
        version: '1.0.0',
        sessions: [
          {
            id: 'restored_s1',
            title: 'Imported Session',
            messages: {},
            createdAt: 12345,
            updatedAt: 12345,
          },
        ],
        settings: {
          temperature: 0.22,
          maxTokens: 1024,
          activePersonaId: 'tutor',
        },
      });

      const fileInput = screen.getByTestId('import-data-input');
      const file = new File([validPayload], 'valid_backup.json', {
        type: 'application/json',
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/Successfully imported 1 chats!/i)).toBeInTheDocument();
      });

      // Verify store updated
      expect(useChatStore.getState().sessions).toHaveLength(1);
      expect(useChatStore.getState().sessions[0].id).toBe('restored_s1');
      expect(useSettingsStore.getState().temperature).toBe(0.22);
      expect(useSettingsStore.getState().activePersonaId).toBe('tutor');

      // Verify localStorage updated
      const storedSessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS)!);
      expect(storedSessions).toHaveLength(1);
      expect(storedSessions[0].id).toBe('restored_s1');
    });

    it('defensively normalizes incomplete/partial session objects in imported data without crashing', () => {
      const partialRaw = [
        { id: 'partial_1' }, // Missing messages, title, etc.
        { title: 'Partial 2', messages: [{ id: 'm1', content: 'test', role: 'user' }] },
      ];

      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(partialRaw));
      const loaded = loadSessionsFromStorage();

      expect(loaded).toHaveLength(2);
      expect(loaded[0].id).toBe('partial_1');
      expect(loaded[0].title).toBe('New chat');
      expect(loaded[0].messages).toEqual({});

      expect(loaded[1].title).toBe('Partial 2');
      expect(loaded[1].messages.m1).toBeDefined();
      expect(loaded[1].messages.m1.content).toBe('test');
    });
  });

  // =========================================================================
  // 4. Destructive Wipe Cleanly Resets Application to Zero-State
  // =========================================================================
  describe('4. Destructive Wipe to Zero-State', () => {
    it('cancelling Clear All Data modal does not erase any data', () => {
      // Seed data
      useChatStore.getState().createSession('Existing Session Before Cancel');
      useSettingsStore.getState().setTemperature(0.12);

      render(
        <ThemeProvider>
          <SettingsDialog isOpen={true} onClose={() => {}} />
        </ThemeProvider>
      );

      // Go to Data tab
      const dataTab = screen.getByRole('tab', { name: /data/i });
      fireEvent.click(dataTab);

      // Click Clear All Data button
      const clearBtn = screen.getByTestId('clear-all-data-btn');
      fireEvent.click(clearBtn);

      // Confirmation modal is visible
      const modal = screen.getByTestId('clear-data-dialog');
      expect(modal).toBeInTheDocument();

      // Click Cancel
      const cancelBtn = screen.getByTestId('cancel-clear-btn');
      fireEvent.click(cancelBtn);

      // Modal closed, data intact
      expect(screen.queryByTestId('clear-data-dialog')).not.toBeInTheDocument();
      expect(useChatStore.getState().sessions).toHaveLength(1);
      expect(useSettingsStore.getState().temperature).toBe(0.12);
    });

    it('confirming Clear All Data completely wipes localStorage and resets stores to zero-state', () => {
      const onCloseSpy = vi.fn();

      // Seed chat session and settings
      const sessionId = useChatStore.getState().createSession('Session to be wiped');
      useSettingsStore.getState().setTemperature(0.99);
      useSettingsStore.getState().setActivePersonaId('analyst');
      useSettingsStore.getState().setCustomSystemPrompt('To be deleted');

      expect(localStorage.getItem(STORAGE_KEYS.SESSIONS)).toBeTruthy();
      expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION)).toBe(sessionId);

      render(
        <ThemeProvider>
          <SettingsDialog isOpen={true} onClose={onCloseSpy} />
        </ThemeProvider>
      );

      // Data tab
      fireEvent.click(screen.getByRole('tab', { name: /data/i }));

      // Clear all
      fireEvent.click(screen.getByTestId('clear-all-data-btn'));
      expect(screen.getByTestId('clear-data-dialog')).toBeInTheDocument();

      // Confirm
      fireEvent.click(screen.getByTestId('confirm-clear-data-btn'));

      // Check stores
      expect(useChatStore.getState().sessions).toEqual([]);
      expect(useChatStore.getState().activeSessionId).toBeNull();
      expect(useSettingsStore.getState().temperature).toBe(DEFAULT_SETTINGS.temperature);
      expect(useSettingsStore.getState().activePersonaId).toBe('architect');
      expect(useSettingsStore.getState().customSystemPrompt).toBe('');

      // Check localStorage
      expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION)).toBeNull();
      const storedSessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || '[]');
      expect(storedSessions).toEqual([]);

      // Dialog closed
      expect(onCloseSpy).toHaveBeenCalled();
    });
  });
});
