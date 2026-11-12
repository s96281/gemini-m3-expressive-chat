import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { useChatStore } from '../../src/store/useChatStore';
import { STORAGE_KEYS } from '../../src/utils/storage';
import { NavigationDrawer } from '../../src/components/layout/NavigationDrawer';
import { exportSessionToFile, sanitizeFilename } from '../../src/services/exportService';
import { ChatSession, MessageNode } from '../../src/types/chat';
import { getActiveTimeline } from '../../src/utils/treeUtils';

describe('Milestone 2 Empirical Challenger Adversarial Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.getState().clearAllSessions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. STRESS TEST: Rapid Chat Creation and Deletion (30+ iterations)
  // =========================================================================
  describe('1. Stress-test rapid chat creation and deletion (50 iterations)', () => {
    it('synchronously creates 50 sessions and guarantees 100% ID uniqueness and localStorage sync', () => {
      const store = useChatStore.getState();
      const createdIds: string[] = [];

      // Rapidly create 50 sessions in a tight synchronous loop
      for (let i = 0; i < 50; i++) {
        const id = store.createSession(`Stress Prompt iteration #${i} for unique session validation`);
        expect(id).toBeTruthy();
        createdIds.push(id);
      }

      // Verify all 50 IDs are strictly unique (no collisions even in the same millisecond)
      const uniqueIds = new Set(createdIds);
      expect(uniqueIds.size).toBe(50);

      const state = useChatStore.getState();
      expect(state.sessions).toHaveLength(50);

      // Active session should be the most recently created session (last in loop)
      const lastCreatedId = createdIds[createdIds.length - 1];
      expect(state.activeSessionId).toBe(lastCreatedId);

      // Verify persistent storage reflection
      const rawStored = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      expect(rawStored).toBeTruthy();
      const storedSessions = JSON.parse(rawStored!);
      expect(storedSessions).toHaveLength(50);
      expect(storedSessions[0].id).toBe(lastCreatedId);
      expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION)).toBe(lastCreatedId);
    });

    it('stress-tests rapid interleaved creation and deletion with active fallback across 60 operations', () => {
      const store = useChatStore.getState();
      const liveIds: string[] = [];

      // Interleaved: create 30, delete 15, create 15, delete 20
      for (let i = 0; i < 30; i++) {
        const id = store.createSession(`Interleaved batch 1 - prompt ${i}`);
        liveIds.push(id);
      }
      expect(useChatStore.getState().sessions).toHaveLength(30);

      // Delete active sessions and middle sessions
      for (let i = 0; i < 15; i++) {
        const targetId = liveIds.pop()!;
        store.deleteSession(targetId);
      }
      expect(useChatStore.getState().sessions).toHaveLength(15);
      // activeSessionId should still be valid and exist in live sessions
      expect(liveIds).toContain(useChatStore.getState().activeSessionId);

      // Add another 15
      for (let i = 0; i < 15; i++) {
        const id = store.createSession(`Interleaved batch 2 - prompt ${i}`);
        liveIds.push(id);
      }
      expect(useChatStore.getState().sessions).toHaveLength(30);

      // Delete 20 more
      for (let i = 0; i < 20; i++) {
        const targetId = liveIds.shift()!;
        store.deleteSession(targetId);
      }
      expect(useChatStore.getState().sessions).toHaveLength(10);
      expect(liveIds).toContain(useChatStore.getState().activeSessionId);

      // Delete all remaining 10 sessions down to 0
      while (liveIds.length > 0) {
        const targetId = liveIds.pop()!;
        store.deleteSession(targetId);
      }

      const finalState = useChatStore.getState();
      expect(finalState.sessions).toHaveLength(0);
      expect(finalState.activeSessionId).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.SESSIONS)).toBe('[]');
      expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION)).toBeNull();
    });

    it('robustly handles idempotent deletion of non-existent and malformed IDs without throwing', () => {
      const store = useChatStore.getState();
      store.createSession('Valid initial session');

      expect(() => {
        store.deleteSession('non-existent-id-999');
        store.deleteSession('');
        store.deleteSession('   ');
        store.deleteSession('../../../path/injection');
        store.deleteSession('null');
        store.deleteSession('undefined');
      }).not.toThrow();

      // Original session remains intact
      expect(useChatStore.getState().sessions).toHaveLength(1);
    });

    it('aborts active streaming when creating a new session or switching', () => {
      const store = useChatStore.getState();
      const abortCtrl = new AbortController();
      const abortSpy = vi.spyOn(abortCtrl, 'abort');

      store.setStreaming(true, abortCtrl);
      expect(useChatStore.getState().isStreaming).toBe(true);

      // Creating a new session must trigger abort on active streaming
      store.createSession('New prompt while streaming');

      expect(abortSpy).toHaveBeenCalled();
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('maintains message tree integrity and branch pointer across 35 multi-message sessions', () => {
      const store = useChatStore.getState();
      const sessionIds: string[] = [];

      for (let i = 0; i < 35; i++) {
        const sId = store.createSession(`Session ${i} Root`);
        sessionIds.push(sId);

        // Add assistant reply
        store.addMessageNode(sId, {
          role: 'assistant',
          content: `Assistant response for session ${i}`,
        });

        // Add second user prompt
        store.addMessageNode(sId, {
          role: 'user',
          content: `User follow up for session ${i}`,
        });
      }

      // Verify all 35 sessions have 3 messages with correct root and leaf
      const state = useChatStore.getState();
      expect(state.sessions).toHaveLength(35);

      for (const s of state.sessions) {
        const msgs = Object.values(s.messages);
        expect(msgs).toHaveLength(3);
        const timeline = getActiveTimeline(s);
        expect(timeline).toHaveLength(3);
        expect(timeline[0].role).toBe('user');
        expect(timeline[1].role).toBe('assistant');
        expect(timeline[2].role).toBe('user');
      }

      // Delete 15 sessions
      for (let i = 0; i < 15; i++) {
        store.deleteSession(sessionIds[i]);
      }

      // Reload store from localStorage
      store.reloadFromStorage();
      const reloadedState = useChatStore.getState();
      expect(reloadedState.sessions).toHaveLength(20);

      // Remaining sessions are fully healthy
      for (const s of reloadedState.sessions) {
        expect(Object.keys(s.messages)).toHaveLength(3);
        expect(s.activeLeafId).toBeTruthy();
        expect(s.rootMessageId).toBeTruthy();
      }
    });
  });

  // =========================================================================
  // 2. CHRONOLOGICAL GROUPING: Mock Dates Boundary Verification
  // =========================================================================
  describe('2. Chronological grouping accurately handles mock dates across boundaries', () => {
    it('correctly partitions sessions into Today, Yesterday, Previous 7 Days, Previous 30 Days, and Older', () => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfYesterday = startOfToday - 86400000;
      const startOf7DaysAgo = startOfToday - 6 * 86400000;
      const startOf30DaysAgo = startOfToday - 29 * 86400000;

      const mockSessions: ChatSession[] = [
        // TODAY
        {
          id: 's_today_1',
          title: 'Chat Today Recent',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: startOfToday + 3600000,
          updatedAt: startOfToday + 3600000,
        },
        {
          id: 's_today_boundary',
          title: 'Chat Today Midnight Exact',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: startOfToday,
          updatedAt: startOfToday,
        },
        // YESTERDAY
        {
          id: 's_yesterday_late',
          title: 'Chat Yesterday 23:59',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: startOfToday - 1,
          updatedAt: startOfToday - 1,
        },
        {
          id: 's_yesterday_boundary',
          title: 'Chat Yesterday Midnight Exact',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: startOfYesterday,
          updatedAt: startOfYesterday,
        },
        // PREVIOUS 7 DAYS
        {
          id: 's_7d_boundary_top',
          title: 'Chat 2 Days Ago',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: startOfYesterday - 1,
          updatedAt: startOfYesterday - 1,
        },
        {
          id: 's_7d_boundary_bottom',
          title: 'Chat 7 Days Ago Midnight Exact',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: startOf7DaysAgo,
          updatedAt: startOf7DaysAgo,
        },
        // PREVIOUS 30 DAYS
        {
          id: 's_30d_top',
          title: 'Chat 8 Days Ago',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: startOf7DaysAgo - 1,
          updatedAt: startOf7DaysAgo - 1,
        },
        {
          id: 's_30d_bottom',
          title: 'Chat 30 Days Ago Midnight Exact',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: startOf30DaysAgo,
          updatedAt: startOf30DaysAgo,
        },
        // OLDER
        {
          id: 's_older_top',
          title: 'Chat 31 Days Ago',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: startOf30DaysAgo - 1,
          updatedAt: startOf30DaysAgo - 1,
        },
        {
          id: 's_older_year',
          title: 'Chat 1 Year Ago',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: startOfToday - 365 * 86400000,
          updatedAt: startOfToday - 365 * 86400000,
        },
      ];

      render(
        <NavigationDrawer
          isOpen={true}
          onClose={() => {}}
          sessions={mockSessions}
          activeSessionId="s_today_1"
        />
      );

      // Verify all 5 chronological group headers appear
      const headers = screen.getAllByTestId('session-group-header');
      const headerLabels = headers.map((h) => h.textContent?.trim().toLowerCase());
      expect(headerLabels).toEqual([
        'today',
        'yesterday',
        'previous 7 days',
        'previous 30 days',
        'older',
      ]);

      // Verify all session items are rendered
      const items = screen.getAllByTestId('session-item');
      expect(items).toHaveLength(10);
    });

    it('strictly separates pinned sessions to Pinned group regardless of timestamp', () => {
      const now = Date.now();
      const mockSessions: ChatSession[] = [
        {
          id: 'p1',
          title: 'Pinned Today Chat',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: true,
          model: 'Gemini',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'p2',
          title: 'Pinned Ancient Chat',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: true,
          model: 'Gemini',
          createdAt: now - 365 * 86400000,
          updatedAt: now - 365 * 86400000,
        },
        {
          id: 'u1',
          title: 'Unpinned Today Chat',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: now,
          updatedAt: now,
        },
      ];

      render(
        <NavigationDrawer
          isOpen={true}
          onClose={() => {}}
          sessions={mockSessions}
        />
      );

      const pinnedGroup = screen.getByTestId('pinned-sessions-group');
      expect(pinnedGroup).toBeInTheDocument();
      expect(within(pinnedGroup).getByText('Pinned Today Chat')).toBeInTheDocument();
      expect(within(pinnedGroup).getByText('Pinned Ancient Chat')).toBeInTheDocument();

      // Ensure Pinned Ancient Chat is NOT duplicated in Older group
      const nonPinnedGroupItems = screen.getAllByTestId('session-item');
      expect(nonPinnedGroupItems).toHaveLength(3); // 2 in pinned + 1 in today
    });

    it('omits empty chronological groups when no sessions exist for those periods', () => {
      const now = Date.now();
      // Only today and older
      const mockSessions: ChatSession[] = [
        {
          id: 's_today',
          title: 'Only Today',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 's_older',
          title: 'Only Ancient',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: now - 90 * 86400000,
          updatedAt: now - 90 * 86400000,
        },
      ];

      render(
        <NavigationDrawer
          isOpen={true}
          onClose={() => {}}
          sessions={mockSessions}
        />
      );

      const headers = screen.getAllByTestId('session-group-header');
      expect(headers).toHaveLength(2);
      expect(headers[0].textContent?.toLowerCase()).toContain('today');
      expect(headers[1].textContent?.toLowerCase()).toContain('older');
      // Yesterday, 7 Days, 30 Days must NOT appear
      const allText = screen.getByTestId('navigation-drawer').textContent?.toLowerCase();
      expect(allText).not.toContain('yesterday');
      expect(allText).not.toContain('previous 7 days');
      expect(allText).not.toContain('previous 30 days');
    });

    it('defensively falls back to createdAt when updatedAt is missing or zero', () => {
      const now = Date.now();
      const mockSessions: ChatSession[] = [
        {
          id: 's_fallback',
          title: 'Fallback Timestamp Chat',
          rootMessageId: null,
          activeLeafId: null,
          messages: {},
          pinned: false,
          model: 'Gemini',
          createdAt: now,
          updatedAt: 0,
        },
      ];

      render(
        <NavigationDrawer
          isOpen={true}
          onClose={() => {}}
          sessions={mockSessions}
        />
      );

      const headers = screen.getAllByTestId('session-group-header');
      expect(headers).toHaveLength(1);
      expect(headers[0].textContent?.toLowerCase()).toContain('today');
    });
  });

  // =========================================================================
  // 3. REAL-TIME SEARCH: Case Variations & Deep Message Content Matching
  // =========================================================================
  describe('3. Real-time search with case variations and deep message content matching', () => {
    const searchMockSessions: ChatSession[] = [
      {
        id: 's_react',
        title: 'React Architecture and Best Practices',
        rootMessageId: 'm1',
        activeLeafId: 'm1',
        pinned: false,
        model: 'Gemini',
        createdAt: 1000,
        updatedAt: 1000,
        messages: {
          m1: { id: 'm1', parentId: null, childrenIds: [], role: 'user', content: 'Basic intro to hooks', createdAt: 1000 },
        },
      },
      {
        id: 's_python',
        title: 'Data Science with Python',
        rootMessageId: 'm2',
        activeLeafId: 'm2',
        pinned: false,
        model: 'Gemini',
        createdAt: 2000,
        updatedAt: 2000,
        messages: {
          m2: { id: 'm2', parentId: null, childrenIds: [], role: 'user', content: 'Explore numpy and pandas libraries', createdAt: 2000 },
        },
      },
      {
        id: 's_deep_content',
        title: 'General Discussion',
        rootMessageId: 'm3_root',
        activeLeafId: 'm3_leaf',
        pinned: false,
        model: 'Gemini',
        createdAt: 3000,
        updatedAt: 3000,
        messages: {
          m3_root: { id: 'm3_root', parentId: null, childrenIds: ['m3_branch_a', 'm3_leaf'], role: 'user', content: 'Hello', createdAt: 3000 },
          m3_branch_a: { id: 'm3_branch_a', parentId: 'm3_root', childrenIds: [], role: 'assistant', content: 'Hidden Deep Keyword: QuantumComputing', createdAt: 3100 },
          m3_leaf: { id: 'm3_leaf', parentId: 'm3_root', childrenIds: [], role: 'assistant', content: 'Normal reply here', createdAt: 3200 },
        },
      },
      {
        id: 's_unicode',
        title: 'AI聊天專案開發 🚀',
        rootMessageId: 'm4',
        activeLeafId: 'm4',
        pinned: false,
        model: 'Gemini',
        createdAt: 4000,
        updatedAt: 4000,
        messages: {
          m4: { id: 'm4', parentId: null, childrenIds: [], role: 'user', content: '繁體中文測試內容：機器學習演算法', createdAt: 4000 },
        },
      },
    ];

    it('matches session titles across uppercase, lowercase, and mixed-case queries', () => {
      render(
        <NavigationDrawer
          isOpen={true}
          onClose={() => {}}
          sessions={searchMockSessions}
        />
      );

      const searchInput = screen.getByTestId('session-search-input');

      // Test lowercase
      fireEvent.change(searchInput, { target: { value: 'react' } });
      expect(screen.getByText('React Architecture and Best Practices')).toBeInTheDocument();
      expect(screen.queryByText('Data Science with Python')).not.toBeInTheDocument();

      // Test UPPERCASE
      fireEvent.change(searchInput, { target: { value: 'REACT' } });
      expect(screen.getByText('React Architecture and Best Practices')).toBeInTheDocument();
      expect(screen.queryByText('Data Science with Python')).not.toBeInTheDocument();

      // Test mIxEd CaSe
      fireEvent.change(searchInput, { target: { value: 'rEaCt' } });
      expect(screen.getByText('React Architecture and Best Practices')).toBeInTheDocument();
    });

    it('matches deep message content even when title is generic', () => {
      render(
        <NavigationDrawer
          isOpen={true}
          onClose={() => {}}
          sessions={searchMockSessions}
        />
      );

      const searchInput = screen.getByTestId('session-search-input');

      // 'numpy' is only inside s_python message content, NOT in title
      fireEvent.change(searchInput, { target: { value: 'numpy' } });
      expect(screen.getByText('Data Science with Python')).toBeInTheDocument();
      expect(screen.queryByText('React Architecture and Best Practices')).not.toBeInTheDocument();
      expect(screen.queryByText('General Discussion')).not.toBeInTheDocument();
    });

    it('matches deep keywords inside non-active sibling branches in conversation tree', () => {
      render(
        <NavigationDrawer
          isOpen={true}
          onClose={() => {}}
          sessions={searchMockSessions}
        />
      );

      const searchInput = screen.getByTestId('session-search-input');

      // 'quantumcomputing' is inside m3_branch_a (not on active leaf!)
      fireEvent.change(searchInput, { target: { value: 'quantumcomputing' } });
      expect(screen.getByText('General Discussion')).toBeInTheDocument();
      expect(screen.queryByText('Data Science with Python')).not.toBeInTheDocument();
    });

    it('safely handles adversarial regex metacharacters without throwing SyntaxError', () => {
      render(
        <NavigationDrawer
          isOpen={true}
          onClose={() => {}}
          sessions={searchMockSessions}
        />
      );

      const searchInput = screen.getByTestId('session-search-input');

      const adversarialQueries = [
        '.*',
        '[a-z]+',
        '(foo|bar)',
        '\\d+\\w*',
        'c++',
        '{0,5}',
        '???',
        '^$',
        '[$100]',
      ];

      for (const q of adversarialQueries) {
        expect(() => {
          fireEvent.change(searchInput, { target: { value: q } });
        }).not.toThrow();
      }
    });

    it('matches multilingual, non-ASCII characters and emojis seamlessly', () => {
      render(
        <NavigationDrawer
          isOpen={true}
          onClose={() => {}}
          sessions={searchMockSessions}
        />
      );

      const searchInput = screen.getByTestId('session-search-input');

      // Title emoji match
      fireEvent.change(searchInput, { target: { value: '🚀' } });
      expect(screen.getByText('AI聊天專案開發 🚀')).toBeInTheDocument();

      // Chinese title match
      fireEvent.change(searchInput, { target: { value: 'AI聊天' } });
      expect(screen.getByText('AI聊天專案開發 🚀')).toBeInTheDocument();

      // Chinese message content match
      fireEvent.change(searchInput, { target: { value: '機器學習' } });
      expect(screen.getByText('AI聊天專案開發 🚀')).toBeInTheDocument();
    });

    it('displays search empty state when no match is found, and clear button restores list', () => {
      render(
        <NavigationDrawer
          isOpen={true}
          onClose={() => {}}
          sessions={searchMockSessions}
        />
      );

      const searchInput = screen.getByTestId('session-search-input');
      fireEvent.change(searchInput, { target: { value: 'non_existent_search_query_xyz' } });

      const emptyState = screen.getByTestId('search-empty-state');
      expect(emptyState).toBeInTheDocument();
      expect(screen.getByText(/no matching chats found/i)).toBeInTheDocument();

      // Click clear search button (first one in search bar)
      const clearButtons = screen.getAllByTestId('clear-search-btn');
      fireEvent.click(clearButtons[0]);

      // All 4 sessions restored
      expect(screen.getAllByTestId('session-item')).toHaveLength(4);
    });
  });

  // =========================================================================
  // 4. MULTI-FORMAT EXPORT: Sanitize Filenames, XSS Prevention & Format Validity
  // =========================================================================
  describe('4. Multi-format export (.md, .json, .txt, .html) produces valid sanitized files', () => {
    let capturedBlobContent: string = '';
    let capturedMimeType: string = '';
    let capturedDownload: string | null = null;
    let originalBlob: typeof Blob;

    beforeEach(() => {
      capturedBlobContent = '';
      capturedMimeType = '';
      capturedDownload = null;

      // Intercept Blob constructor to capture content string
      originalBlob = global.Blob;
      global.Blob = class MockBlob {
        constructor(contentParts: any[], options?: BlobPropertyBag) {
          capturedBlobContent = contentParts.join('');
          capturedMimeType = options?.type || '';
        }
      } as any;

      // Spy on HTMLAnchorElement click & download
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        capturedDownload = this.download;
      });

      // Spy on URL.createObjectURL and URL.revokeObjectURL
      if (typeof window.URL.createObjectURL !== 'function') {
        window.URL.createObjectURL = vi.fn();
      }
      if (typeof window.URL.revokeObjectURL !== 'function') {
        window.URL.revokeObjectURL = vi.fn();
      }

      vi.spyOn(window.URL, 'createObjectURL').mockImplementation(() => 'blob:mock-url');
      vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    afterEach(() => {
      global.Blob = originalBlob;
    });

    const adversarialSession: ChatSession = {
      id: 's_adversarial_export',
      title: '<script>alert("XSS")</script>../../etc/passwd: * " ? < > | \\ / test',
      rootMessageId: 'm1',
      activeLeafId: 'm2',
      pinned: false,
      model: 'Gemini 1.5 Flash',
      createdAt: 1700000000000,
      updatedAt: 1700000050000,
      messages: {
        m1: {
          id: 'm1',
          parentId: null,
          childrenIds: ['m2'],
          role: 'user',
          content: 'Hello <img src=x onerror="alert(\'pwned\')">&amp;<b>bold</b>',
          createdAt: 1700000000000,
        },
        m2: {
          id: 'm2',
          parentId: 'm1',
          childrenIds: [],
          role: 'assistant',
          content: 'Here is code: ```html\n<script>console.log("safe");</script>\n```',
          createdAt: 1700000050000,
        },
      },
    };

    it('sanitizes dangerous filenames against directory traversal and special chars', () => {
      const sanitized = sanitizeFilename(adversarialSession.title);

      // Must NOT contain path traversal or dangerous symbols
      expect(sanitized).not.toContain('../');
      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('\\');
      expect(sanitized).not.toContain(':');
      expect(sanitized).not.toContain('*');
      expect(sanitized).not.toContain('?');
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('|');

      // Only safe chars: a-z, 0-9, _, -
      expect(sanitized).toMatch(/^[a-z0-9_-]+$/);
    });

    it('falls back to chat_export when title is empty or composed exclusively of invalid characters', () => {
      const emptyTitleSession: ChatSession = {
        ...adversarialSession,
        title: ':::???///',
      };

      // Export HTML
      exportSessionToFile(emptyTitleSession, 'html');
      expect(capturedDownload).toMatch(/_[\d-]+\.html$/);
      // Ensure no undefined or empty string in download attribute
      expect(capturedDownload).toBeTruthy();
    });

    it('HTML export rigorously escapes XSS payloads in title, roles, and message content', () => {
      exportSessionToFile(adversarialSession, 'html');

      expect(capturedMimeType).toContain('text/html');
      expect(capturedBlobContent).toBeTruthy();

      // Must be valid HTML5
      expect(capturedBlobContent).toContain('<!DOCTYPE html>');
      expect(capturedBlobContent).toContain('<meta charset="utf-8">');

      // XSS payloads MUST BE ESCAPED
      expect(capturedBlobContent).not.toContain('<script>alert("XSS")</script>');
      expect(capturedBlobContent).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');

      expect(capturedBlobContent).not.toContain('<img src=x onerror=');
      expect(capturedBlobContent).toContain('&lt;img src=x onerror=&quot;alert(&#039;pwned&#039;)&quot;&gt;');

      // File extension must be .html
      expect(capturedDownload).toMatch(/\.html$/);
    });

    it('JSON export produces parseable, uncorrupted serialization of session structure', () => {
      exportSessionToFile(adversarialSession, 'json');

      expect(capturedMimeType).toContain('application/json');
      expect(capturedBlobContent).toBeTruthy();

      const parsed = JSON.parse(capturedBlobContent);

      expect(parsed.id).toBe(adversarialSession.id);
      expect(parsed.title).toBe(adversarialSession.title);
      expect(parsed.messages.m1.content).toBe(adversarialSession.messages.m1.content);
      expect(parsed.messages.m2.content).toBe(adversarialSession.messages.m2.content);
      expect(capturedDownload).toMatch(/\.json$/);
    });

    it('Markdown export conforms to Markdown heading specs and preserves code blocks intact', () => {
      exportSessionToFile(adversarialSession, 'md');

      expect(capturedMimeType).toContain('text/markdown');
      expect(capturedBlobContent).toBeTruthy();

      expect(capturedBlobContent).toContain(`# ${adversarialSession.title}`);
      expect(capturedBlobContent).toContain('---');
      expect(capturedBlobContent).toContain('### User');
      expect(capturedBlobContent).toContain('### Assistant');
      expect(capturedBlobContent).toContain('```html\n<script>console.log("safe");</script>\n```');
      expect(capturedDownload).toMatch(/\.md$/);
    });

    it('Plain text export formats with uppercase role tags and dividers', () => {
      exportSessionToFile(adversarialSession, 'txt');

      expect(capturedMimeType).toContain('text/plain');
      expect(capturedBlobContent).toBeTruthy();

      expect(capturedBlobContent).toContain('[USER]:');
      expect(capturedBlobContent).toContain('[ASSISTANT]:');
      expect(capturedBlobContent).toContain('------------------------');
      expect(capturedDownload).toMatch(/\.txt$/);
    });

    it('exports empty conversation session without throwing or producing corrupt outputs', () => {
      const emptySession: ChatSession = {
        id: 's_empty',
        title: 'Empty Conversation',
        rootMessageId: null,
        activeLeafId: null,
        messages: {},
        pinned: false,
        model: 'Gemini',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const formats: ('md' | 'json' | 'txt' | 'html')[] = ['md', 'json', 'txt', 'html'];
      for (const fmt of formats) {
        expect(() => {
          exportSessionToFile(emptySession, fmt);
        }).not.toThrow();
        expect(capturedBlobContent).toBeDefined();
      }
    });

    it('exports only active timeline messages in branched conversations and excludes abandoned siblings', () => {
      const branchedSession: ChatSession = {
        id: 's_branched',
        title: 'Branched Chat',
        rootMessageId: 'm1',
        activeLeafId: 'm2_b', // Active leaf is version B
        pinned: false,
        model: 'Gemini',
        createdAt: 1000,
        updatedAt: 2000,
        messages: {
          m1: { id: 'm1', parentId: null, childrenIds: ['m2_a', 'm2_b'], role: 'user', content: 'What is 2+2?', createdAt: 1000 },
          m2_a: { id: 'm2_a', parentId: 'm1', childrenIds: [], role: 'assistant', content: 'Old branch reply: Maybe 5', createdAt: 1100 },
          m2_b: { id: 'm2_b', parentId: 'm1', childrenIds: [], role: 'assistant', content: 'Active branch reply: Exactly 4', createdAt: 1200 },
        },
      };

      exportSessionToFile(branchedSession, 'txt');

      expect(capturedBlobContent).toContain('Active branch reply: Exactly 4');
      expect(capturedBlobContent).not.toContain('Old branch reply: Maybe 5');
    });
  });
});
