import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readAttachmentFile, isTextFile } from '../../src/utils/attachmentUtils';
import { buildGeminiParts, buildOpenAIMessageContent } from '../../src/services/liveEngine';
import { useChatStore } from '../../src/store/useChatStore';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { Attachment } from '../../src/types/chat';

describe('Attachment Reading & Model Payload Injection', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.setState({
      sessions: [],
      activeSessionId: null,
      isStreaming: false,
      abortController: null,
    });
    useSettingsStore.setState({
      engineMode: 'gemini',
      apiKey: 'AIzaTestKey123',
      apiEndpoint: '',
    });
  });

  it('identifies text/code files and reads their textContent', async () => {
    expect(isTextFile({ name: 'notes.md', type: '' })).toBe(true);
    expect(isTextFile({ name: 'app.ts', type: '' })).toBe(true);
    expect(isTextFile({ name: 'photo.png', type: 'image/png' })).toBe(false);

    const file = new File(['hello world\nline 2'], 'notes.txt', { type: 'text/plain' });
    const att = await readAttachmentFile(file);

    expect(att.name).toBe('notes.txt');
    expect(att.textContent).toBe('hello world\nline 2');
    expect(att.dataBase64).toBeUndefined();
  });

  it('reads binary/image files into dataBase64', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const file = new File([bytes], 'pixel.png', { type: 'image/png' });
    const att = await readAttachmentFile(file);

    expect(att.name).toBe('pixel.png');
    expect(att.type).toBe('image/png');
    expect(att.dataBase64).toBe('iVBORw==');
    expect(att.textContent).toBeUndefined();
  });

  it('builds Gemini parts with text attachment content and inlineData for images', () => {
    const attachments: Attachment[] = [
      {
        id: 'att_1',
        name: 'data.json',
        size: 16,
        type: 'application/json',
        url: '',
        textContent: '{"answer": 42}',
      },
      {
        id: 'att_2',
        name: 'chart.png',
        size: 4,
        type: 'image/png',
        url: '',
        dataBase64: 'iVBORw==',
      },
    ];

    const parts = buildGeminiParts('Summarize these', attachments);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({
      text: '[Attached File: data.json (application/json)]\n```\n{"answer": 42}\n```',
    });
    expect(parts[1]).toEqual({
      inlineData: {
        mimeType: 'image/png',
        data: 'iVBORw==',
      },
    });
    expect(parts[2]).toEqual({ text: 'Summarize these' });
  });

  it('builds OpenAI multimodal content when image attachments are present', () => {
    const attachments: Attachment[] = [
      {
        id: 'att_img',
        name: 'diagram.png',
        size: 4,
        type: 'image/png',
        url: '',
        dataBase64: 'iVBORw==',
      },
    ];

    const content = buildOpenAIMessageContent('What is in this image?', attachments);
    expect(content).toEqual([
      { type: 'text', text: 'What is in this image?' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw==' } },
    ]);
  });

  it('sends attachment content in Gemini API request body (including attachment-only messages)', async () => {
    let capturedBody: any = null;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).includes(':streamGenerateContent')) {
        capturedBody = JSON.parse(String(init?.body || '{}'));
      }
      const sse = `data: ${JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'I read the file!' }] } }],
      })}\n\n`;
      return new Response(sse, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    const att: Attachment = {
      id: 'att_txt',
      name: 'secret.txt',
      size: 18,
      type: 'text/plain',
      url: '',
      textContent: 'SECRET_TOKEN_9988',
    };

    await useChatStore.getState().sendChatMessage('', [att]);

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.contents).toEqual([
      {
        role: 'user',
        parts: [
          {
            text: '[Attached File: secret.txt (text/plain)]\n```\nSECRET_TOKEN_9988\n```',
          },
        ],
      },
    ]);

    fetchSpy.mockRestore();
  });
});
