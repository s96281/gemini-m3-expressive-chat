import { ChatSession } from '../types/chat';
import { getActiveTimeline, sanitizeFilename } from '../utils/treeUtils';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function exportSessionToFile(
  session: ChatSession,
  format: 'md' | 'json' | 'txt' | 'html'
): void {
  const timeline = getActiveTimeline(session);
  const baseName = sanitizeFilename(session.title) || 'chat_export';
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${baseName}_${dateStr}.${format === 'html' ? 'html' : format}`;

  let content = '';
  let mimeType = 'text/plain;charset=utf-8';

  switch (format) {
    case 'json':
      mimeType = 'application/json;charset=utf-8';
      content = JSON.stringify(session, null, 2);
      break;

    case 'md':
      mimeType = 'text/markdown;charset=utf-8';
      content = `# ${session.title}\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
      for (const msg of timeline) {
        const author =
          msg.role === 'user' ? '### User' : msg.role === 'assistant' ? '### Assistant' : '### System';
        content += `${author}\n\n${msg.content}\n\n`;
      }
      break;

    case 'txt':
      mimeType = 'text/plain;charset=utf-8';
      content = `${session.title.toUpperCase()}\nExported: ${new Date().toLocaleString()}\n\n`;
      for (const msg of timeline) {
        content += `[${msg.role.toUpperCase()}]:\n${msg.content}\n\n------------------------\n\n`;
      }
      break;

    case 'html':
      mimeType = 'text/html;charset=utf-8';
      const body = timeline
        .map(
          (m) => `
        <div style="margin-bottom: 24px; padding: 16px; border-radius: 12px; background: ${
          m.role === 'user' ? '#f0f4f8' : '#ffffff'
        }; border: 1px solid #e0e0e0;">
          <strong style="color: ${
            m.role === 'user' ? '#1a73e8' : '#202124'
          }; text-transform: uppercase; font-size: 12px;">${escapeHtml(m.role)}</strong>
          <div style="margin-top: 8px; white-space: pre-wrap; font-family: sans-serif; line-height: 1.5;">${escapeHtml(
            m.content
          )}</div>
        </div>`
        )
        .join('');
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(
        session.title
      )}</title></head><body style="max-width: 800px; margin: 40px auto; font-family: system-ui, -apple-system, sans-serif; padding: 0 20px;"><h1>${escapeHtml(
        session.title
      )}</h1>${body}</body></html>`;
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { sanitizeFilename };
