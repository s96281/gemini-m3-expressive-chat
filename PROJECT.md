# Project: Material 3 Expressive AI Chat Web Application (Gemini & ChatGPT Converged UX)

## Architecture

The application is built as a modern, high-performance client-side Single Page Application (SPA) pairing the interaction best practices of **Google Gemini** (pill input dock, multimodal preview chips, reasoning accordion, fluid streaming) and **ChatGPT** (tree-structured conversation branching, persistent sidebar session management, code block tools, interactive artifact sandbox) within **Google Material 3 Expressive** design language.

```
+-----------------------------------------------------------------------------------+
| Top App Bar: Navigation Toggle | Model Selector | Active Persona | Theme & Settings |
+------------------------+----------------------------------------------------------+
| Expressive Navigation  | Main Conversation Canvas                                 |
| Drawer & Rail          | - Empty State: Greeting & Starter Prompt Chips           |
| - New Chat FAB         | - Message Stream: User Pill vs Assistant Bubbleless Card |
| - Search Bar           | - Reasoning Accordion: "Thinking... ({n}s)"              |
| - Pinned Chats         | - Rich Rendering: Markdown, KaTeX Math, Tables           |
| - Chronological Groups | - Syntax-Highlighted Code Blocks with Copy               |
|   (Today, Yesterday,   | - Interactive Artifact Sandbox (Split/Slide Preview)     |
|    7d, 30d, Older)     | - Branch Version Stepper (< m/n >) & Action Toolbar      |
| - Quick Actions:       | - Floating Scroll-to-Bottom FAB                          |
|   Rename, Delete,      +----------------------------------------------------------+
|   Multi-Format Export  | Floating M3 Expressive Pill Input Dock                   |
| - Persona & Settings   | - Attachment Chips | Auto-Expanding Textarea             |
|                        | - Voice / Mic | Model Menu | Morphing Send/Stop Button    |
+------------------------+----------------------------------------------------------+
```

### Core Technology Stack
- **Core Framework**: React 18+ with TypeScript & Vite 6 (instant HMR, strict type safety, zero server complexity).
- **Design System & Styling**: Tailwind CSS v3.4 configured with custom Material 3 Expressive tokens (`--md-sys-color-*`, `--md-sys-shape-*`, `--md-sys-elevation-*`, spring curves) + `@tailwindcss/typography` + Lucide React icons.
- **State Management & Persistence**: Zustand store with selector-based subscription to eliminate streaming re-render lag + LocalStorage / IndexedDB persistence.
- **AI Engine**: Dual-mode `AIEngineAdapter`:
  1. Built-in Intelligent Simulated Streaming Engine with realistic token pacing, jitter, reasoning traces ("Thinking..."), rich Markdown, and code outputs (100% out-of-the-box functional with zero external API keys).
  2. Optional Live API integration (Google Gemini SSE REST API, OpenAI API, and Ollama) configurable via M3 Expressive Settings dialog.
- **Testing Infrastructure**: Vitest for component/unit tests + Playwright headless E2E verification leveraging `/usr/bin/google-chrome`.

---

## Feature Inventory

Every feature cataloged from the Survey phase is mapped to its assigned milestone:

| # | Feature ID | Feature Name | Description | Milestone | Source |
|---|:---|:---|:---|:---|:---|
| 1 | NAV-01 | New Chat Creation | Fresh chat view, resets URL/ID, input focus | M2 | Survey |
| 2 | NAV-02 | Chronological Session Grouping | Group sessions by Today, Yesterday, 7 Days, 30 Days, Older | M2 | Survey |
| 3 | NAV-03 | Real-Time Session Search & Filter | Client-side keyword search in titles and messages | M2 | Survey |
| 4 | NAV-04 | Pin / Star Chat Sessions | Dedicated Pinned section at top of navigation drawer | M2 | Survey |
| 5 | NAV-05 | Auto-Title & Inline Session Rename | Auto 3-6 word title generation + manual inline rename | M2 | Survey |
| 6 | NAV-06 | Session Deletion | Single chat deletion with confirmation and bulk history clean | M2 | Survey |
| 7 | NAV-07 | Multi-Format Session Export | Export active conversation as .md, .json, .txt, or HTML | M2 | Survey |
| 8 | NAV-08 | Expressive Navigation Drawer & Rail | M3 spring drawer, collapsible icon rail, responsive backdrop | M1 | Survey |
| 9 | CONV-01 | Zero-State Greeting & Starter Chips | Warm greeting + 4 categorized prompt cards with icons | M1 | Survey |
| 10 | CONV-02 | M3 Expressive Message Bubbles | Asymmetric user pill vs assistant bubbleless tonal card | M3 | Survey |
| 11 | CONV-03 | Token-by-Token Streaming Engine | Realistic token streaming with pulsating glowing indicator | M3 | Survey |
| 12 | CONV-04 | "Thinking..." Reasoning Accordion | Collapsible chain-of-thought trace with elapsed timer | M3 | Survey |
| 13 | CONV-05 | Stop Generation Control | Abort streaming, morph button, preserve partial response | M3 | Survey |
| 14 | CONV-06 | Regenerate Response | Generate alternative response, creates new branch version | M3 | Survey |
| 15 | CONV-07 | Conversation Branching & Stepper | Tree-structured edit history with `< m/n >` branch navigation | M3 | Survey |
| 16 | CONV-08 | Message Action Toolbar | Floating micro-toolbar: Copy, Thumbs Up/Down, TTS, Share | M3 | Survey |
| 17 | CONV-09 | Auto-Scroll & Scroll-to-Bottom FAB | Follow stream + floating unread FAB on upward scroll | M3 | Survey |
| 18 | DOCK-01 | Floating M3 Pill Input Dock | Centered floating pill dock with dynamic elevation | M3 | Survey |
| 19 | DOCK-02 | Auto-Expanding Textarea | Auto-grow from 1 to 6 lines, Enter to submit, Shift+Enter newline | M3 | Survey |
| 20 | DOCK-03 | Morphing Send / Stop Button | Spring animation morphing between Send and Stop icons | M3 | Survey |
| 21 | DOCK-04 | Model Selector Pill & Menu | Dropdown menu to pick active model per conversation | M3 | Survey |
| 22 | DOCK-05 | File & Image Attachment Chips | Drag-and-drop zone with preview chips and thumbnail cards | M3 | Survey |
| 23 | DOCK-06 | Voice Input / Speech-to-Text | Microphone trigger with browser speech recognition integration | M3 | Survey |
| 24 | DOCK-07 | Keyboard Shortcuts System | `Ctrl+N`, `Ctrl+K`, `Escape`, `Enter`, IME composition support | M3 | Survey |
| 25 | RICH-01 | Comprehensive Markdown Engine | Full GFM headings, bold, italic, lists, blockquotes | M4 | Survey |
| 26 | RICH-02 | Syntax-Highlighted Code Blocks | Multi-language code cards with language tag and copy button | M4 | Survey |
| 27 | RICH-03 | Interactive Code Artifact Sandbox | Split-screen or slide-over preview for HTML/SVG/interactive code | M4 | Survey |
| 28 | RICH-04 | KaTeX Mathematical Equations | Inline (`$...$`) and block (`$$...$$`) LaTeX equation rendering | M4 | Survey |
| 29 | RICH-05 | Interactive Data Tables | GFM tables with zebra striping, sticky headers, export CSV | M4 | Survey |
| 30 | SET-01 | M3 Expressive Settings Dialog | Tabbed modal (General, Model/Engine, Personas, Data) | M2 | Survey |
| 31 | SET-02 | AI Personas & System Prompt | Persona presets (Architect, Writer, Analyst) + custom prompt | M2 | Survey |
| 32 | SET-03 | Engine Mode & API Configuration | Switch between Simulated Engine and Live API (Gemini/OpenAI) | M3 | Survey |
| 33 | SET-04 | Generation Hyperparameters | Sliders for temperature, max tokens, and simulated speed | M2 | Survey |
| 34 | SET-05 | Data Backup, Import & Clear Storage | Full JSON export, import merge, and clean reset | M2 | Survey |
| 35 | THEME-01 | Dynamic M3 Theme Palette | Seed colors (Ocean, Purple, Emerald, Rose, Amber) Light/Dark | M1 | Survey |
| 36 | THEME-02 | Tonal Container Elevation System | Surface Container Lowest, Low, Default, High, Highest tokens | M1 | Survey |
| 37 | THEME-03 | Adaptive Multi-Device Breakpoints | Fluid layouts across Mobile (<768px), Tablet, and Desktop | M1 | Survey |
| 38 | THEME-04 | Accessibility & Focus Tokens | WCAG 2.1 AA contrast, visible focus rings, reduced motion | M1 | Survey |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|:---|:---|:---|:---|
| M1 | Project Foundation, M3 Design System & App Shell | Vite+React+TS scaffolding, Tailwind M3 Expressive tokens & themes, App Shell (Drawer, Rail, Top Bar), Zero-state greeting (NAV-08, CONV-01, THEME-01..04) | None | DONE |
| M2 | Session Store, History Management & Settings | Zustand chat store, IndexedDB/LocalStorage, Chronological groups, Search, Pin, Rename, Delete, Export, Settings Modal & Personas (NAV-01..07, SET-01, SET-02, SET-04, SET-05) | M1 | DONE |
| M3 | AI Streaming Engine, Conversation & Input Dock | Dual-mode AI Engine (Simulated + Live SSE), Message cards, Glowing stream indicator, Thinking accordion, Branching stepper, Floating Pill Dock, Auto-expanding textarea, Morphing Send/Stop, Attachments, Model selector (CONV-02..09, DOCK-01..07, SET-03) | M1, M2 | DONE |
| M4 | Rich Content Rendering & Artifact Sandbox | Markdown engine, Syntax-highlighted code blocks with Copy, Interactive HTML/SVG Artifact Sandbox, KaTeX LaTeX math formulas, Interactive Data Tables with CSV export (RICH-01..05) | M1, M2, M3 | DONE |
| M5 | Final Milestone: 100% E2E Pass & Adversarial Hardening | Phase 1: Pass 100% E2E test suite (Tiers 1-4, 251+ tests) from E2E Testing Track; Phase 2: Tier 5 Adversarial Coverage Hardening | M1, M2, M3, M4, TEST_READY.md | DONE |

Parallel Track:
- **E2E Testing Track**: Autonomous test orchestrator implementing Playwright / Vitest test harness and executing 241+ test cases across Tiers 1-4, culminating in `TEST_READY.md`.

---

## Interface Contracts

### 1. Store & State Types (`src/types/chat.ts`)
```typescript
export type Role = 'user' | 'assistant' | 'system';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string; // base64 or object URL
}

export interface MessageNode {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  role: Role;
  content: string;
  reasoningContent?: string;
  thinkingDuration?: number;
  isStreaming?: boolean;
  model?: string;
  attachments?: Attachment[];
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  rootMessageId: string | null;
  activeLeafId: string | null;
  messages: Record<string, MessageNode>;
  pinned: boolean;
  model: string;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ThemeConfig {
  seedColor: 'ocean' | 'purple' | 'emerald' | 'rose' | 'amber';
  mode: 'light' | 'dark' | 'system';
}

export interface AppSettings {
  engineMode: 'simulated' | 'gemini' | 'openai' | 'ollama';
  apiKey?: string;
  apiEndpoint?: string;
  temperature: number;
  maxTokens: number;
  simulatedSpeed: 'fast' | 'natural' | 'relaxed';
  activePersonaId: string;
  customSystemPrompt: string;
}
```

### 2. AI Engine Interface (`src/services/aiEngine.ts`)
```typescript
export interface StreamChunk {
  type: 'token' | 'reasoning' | 'error' | 'done';
  text?: string;
  duration?: number;
}

export interface StreamOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  attachments?: Attachment[];
  signal?: AbortSignal;
}

export interface IAIEngine {
  streamResponse(
    messages: { role: Role; content: string }[],
    options: StreamOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;
}
```

### 3. Artifact Sandbox Contract (`src/types/artifact.ts`)
```typescript
export interface ArtifactData {
  id: string;
  type: 'html' | 'svg' | 'react' | 'mermaid';
  title: string;
  code: string;
}
```

---

## Code Layout

```
/home/antigravity/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── playwright.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types/
│   │   ├── chat.ts
│   │   ├── artifact.ts
│   │   └── settings.ts
│   ├── theme/
│   │   ├── tokens.ts
│   │   └── ThemeProvider.tsx
│   ├── store/
│   │   ├── useChatStore.ts
│   │   └── useSettingsStore.ts
│   ├── services/
│   │   ├── aiEngine.ts
│   │   ├── simulatedEngine.ts
│   │   ├── liveEngine.ts
│   │   └── exportService.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── TopAppBar.tsx
│   │   │   ├── NavigationDrawer.tsx
│   │   │   └── NavigationRail.tsx
│   │   ├── conversation/
│   │   │   ├── ConversationView.tsx
│   │   │   ├── ZeroState.tsx
│   │   │   ├── MessageItem.tsx
│   │   │   ├── ThinkingAccordion.tsx
│   │   │   ├── BranchStepper.tsx
│   │   │   └── MessageToolbar.tsx
│   │   ├── input/
│   │   │   ├── InputDock.tsx
│   │   │   ├── AttachmentBar.tsx
│   │   │   ├── ModelSelector.tsx
│   │   │   └── VoiceButton.tsx
│   │   ├── rich/
│   │   │   ├── MarkdownRenderer.tsx
│   │   │   ├── CodeBlock.tsx
│   │   │   ├── ArtifactSandbox.tsx
│   │   │   ├── KaTeXEquation.tsx
│   │   │   └── DataTable.tsx
│   │   └── settings/
│   │       ├── SettingsDialog.tsx
│   │       ├── PersonaSelector.tsx
│   │       └── DataManagement.tsx
│   └── utils/
│       ├── treeUtils.ts
│       └── storage.ts
└── tests/
    ├── unit/
    └── e2e/
        ├── tier1-features/
        ├── tier2-boundary/
        ├── tier3-combinations/
        └── tier4-scenarios/
```
