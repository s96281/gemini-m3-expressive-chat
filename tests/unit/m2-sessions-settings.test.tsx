import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getActiveTimeline,
  getBranchInfo,
  switchBranchToMessage,
  generateAutoTitle,
  sanitizeFilename,
} from '../../src/utils/treeUtils';
import {
  normalizeSession,
  loadSessionsFromStorage,
  saveSessionsToStorage,
  STORAGE_KEYS,
} from '../../src/utils/storage';
import { useSettingsStore, PERSONA_PRESETS } from '../../src/store/useSettingsStore';
import { useChatStore } from '../../src/store/useChatStore';
import { ChatSession } from '../../src/types/chat';

describe('Milestone 2 Unit Tests: Tree Utils, Storage & Stores', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.getState().clearAllSessions();
    useSettingsStore.getState().resetAllSettings();
  });

  describe('Tree Utilities (treeUtils.ts)', () => {
    it('getActiveTimeline correctly traverses upward from leaf to root', () => {
      const session: ChatSession = {
        id: 's1',
        title: 'Tree Test',
        rootMessageId: 'm1',
        activeLeafId: 'm3',
        pinned: false,
        model: 'Gemini',
        createdAt: 1000,
        updatedAt: 3000,
        messages: {
          m1: { id: 'm1', parentId: null, childrenIds: ['m2'], role: 'user', content: 'Root msg', createdAt: 1000 },
          m2: { id: 'm2', parentId: 'm1', childrenIds: ['m3'], role: 'assistant', content: 'Branch msg', createdAt: 2000 },
          m3: { id: 'm3', parentId: 'm2', childrenIds: [], role: 'user', content: 'Leaf msg', createdAt: 3000 },
        },
      };

      const timeline = getActiveTimeline(session);
      expect(timeline).toHaveLength(3);
      expect(timeline[0].id).toBe('m1');
      expect(timeline[1].id).toBe('m2');
      expect(timeline[2].id).toBe('m3');
    });

    it('getBranchInfo accurately calculates sibling versions and current index', () => {
      const session: ChatSession = {
        id: 's2',
        title: 'Branch Stepper Test',
        rootMessageId: 'm1',
        activeLeafId: 'm2b',
        pinned: false,
        model: 'Gemini',
        createdAt: 1000,
        updatedAt: 2500,
        messages: {
          m1: { id: 'm1', parentId: null, childrenIds: ['m2a', 'm2b'], role: 'user', content: 'Prompt', createdAt: 1000 },
          m2a: { id: 'm2a', parentId: 'm1', childrenIds: [], role: 'assistant', content: 'Version 1', createdAt: 2000 },
          m2b: { id: 'm2b', parentId: 'm1', childrenIds: [], role: 'assistant', content: 'Version 2', createdAt: 2500 },
        },
      };

      const infoA = getBranchInfo(session, 'm2a');
      expect(infoA.currentIndex).toBe(1);
      expect(infoA.totalVersions).toBe(2);
      expect(infoA.hasPrev).toBe(false);
      expect(infoA.hasNext).toBe(true);

      const infoB = getBranchInfo(session, 'm2b');
      expect(infoB.currentIndex).toBe(2);
      expect(infoB.totalVersions).toBe(2);
      expect(infoB.hasPrev).toBe(true);
      expect(infoB.hasNext).toBe(false);
    });

    it('switchBranchToMessage updates active leaf down to latest descendant', () => {
      const session: ChatSession = {
        id: 's3',
        title: 'Switch Branch Test',
        rootMessageId: 'm1',
        activeLeafId: 'm2b',
        pinned: false,
        model: 'Gemini',
        createdAt: 1000,
        updatedAt: 2500,
        messages: {
          m1: { id: 'm1', parentId: null, childrenIds: ['m2a', 'm2b'], role: 'user', content: 'Prompt', createdAt: 1000 },
          m2a: { id: 'm2a', parentId: 'm1', childrenIds: ['m3a'], role: 'assistant', content: 'Version 1', createdAt: 2000 },
          m3a: { id: 'm3a', parentId: 'm2a', childrenIds: [], role: 'user', content: 'Continuation A', createdAt: 2200 },
          m2b: { id: 'm2b', parentId: 'm1', childrenIds: [], role: 'assistant', content: 'Version 2', createdAt: 2500 },
        },
      };

      const switched = switchBranchToMessage(session, 'm2a');
      expect(switched.activeLeafId).toBe('m3a');
    });

    it('generateAutoTitle extracts 3-6 words, strips filler and tags, and applies Title Case', () => {
      const title1 = generateAutoTitle('Can you please explain how to calculate fibonacci numbers in Python?');
      expect(title1).not.toMatch(/^new chat$/i);
      expect(title1.length).toBeLessThanOrEqual(40);
      expect(title1).toContain('Fibonacci');

      const title2 = generateAutoTitle('<script>alert("test")</script> Build modern web application');
      expect(title2).not.toContain('<script>');
      expect(title2).toContain('Build Modern Web');
    });

    it('sanitizeFilename converts special characters into safe lowercase underscores', () => {
      const safe = sanitizeFilename('My Project: Design / Architecture * 2026?');
      expect(safe).toBe('my_project__design___architecture___2026_');
      expect(safe).not.toContain(':');
      expect(safe).not.toContain('/');
    });
  });

  describe('Storage Normalization & Quota Safety (storage.ts)', () => {
    it('normalizeSession recovers missing fields defensively', () => {
      const raw = {
        id: 'raw-1',
        messages: {
          msg1: { content: 'Standalone message', role: 'user' as const },
        },
      };

      const normalized = normalizeSession(raw);
      expect(normalized.id).toBe('raw-1');
      expect(normalized.pinned).toBe(false);
      expect(normalized.rootMessageId).toBe('msg1');
      expect(normalized.activeLeafId).toBe('msg1');
      expect(normalized.messages.msg1.childrenIds).toEqual([]);
    });

    it('saveSessionsToStorage safely handles QuotaExceededError dispatching custom event', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      });

      const success = saveSessionsToStorage([]);
      expect(success).toBe(false);
      expect(dispatchSpy).toHaveBeenCalled();

      setItemSpy.mockRestore();
      dispatchSpy.mockRestore();
    });
  });

  describe('Settings Store (useSettingsStore.ts)', () => {
    it('persists flat JSON into localStorage without wrapper object', () => {
      useSettingsStore.getState().setTemperature(0.25);
      useSettingsStore.getState().setMaxTokens(4096);

      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.temperature).toBe(0.25);
      expect(parsed.maxTokens).toBe(4096);
      expect(parsed.state).toBeUndefined(); // Guarantees no Zustand wrapper contamination
    });

    it('persona presets match required order and role definitions', () => {
      expect(PERSONA_PRESETS[0].name).toContain('Software Architect');
      expect(PERSONA_PRESETS[1].name).toContain('Creative Writer');
      expect(PERSONA_PRESETS[2].name).toContain('Concise Tutor');
      expect(PERSONA_PRESETS[3].name).toContain('Data Analyst');
    });

    it('restores default hyperparameter values upon reset', () => {
      useSettingsStore.getState().setTemperature(0.1);
      useSettingsStore.getState().setMaxTokens(1024);
      useSettingsStore.getState().resetParameters();

      expect(useSettingsStore.getState().temperature).toBe(0.7);
      expect(useSettingsStore.getState().maxTokens).toBe(2048);
    });
  });

  describe('Chat Store (useChatStore.ts)', () => {
    it('creates new session and updates activeSessionId and storage', () => {
      const store = useChatStore.getState();
      const newId = store.createSession('First prompt to start session');
      expect(newId).toBeTruthy();

      const state = useChatStore.getState();
      expect(state.activeSessionId).toBe(newId);
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].title).not.toMatch(/^new chat$/i);

      const storedRaw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      const stored = JSON.parse(storedRaw!);
      expect(Array.isArray(stored)).toBe(true);
      expect(stored[0].id).toBe(newId);
    });

    it('pins and unpins sessions with persisted flag', () => {
      const store = useChatStore.getState();
      const id = store.createSession('Pin test');
      expect(useChatStore.getState().sessions[0].pinned).toBe(false);

      store.pinSession(id, true);
      expect(useChatStore.getState().sessions[0].pinned).toBe(true);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS)!);
      expect(stored[0].pinned).toBe(true);
    });

    it('deletes session and resets active selection cleanly', () => {
      const store = useChatStore.getState();
      const id = store.createSession('Delete me');
      expect(useChatStore.getState().sessions).toHaveLength(1);

      store.deleteSession(id);
      expect(useChatStore.getState().sessions).toHaveLength(0);
      expect(useChatStore.getState().activeSessionId).toBeNull();
    });
  });
});
