import { Attachment } from '../types/chat';

const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/typescript',
  'application/x-typescript',
  'application/x-yaml',
  'application/yaml',
  'application/sql',
  'application/x-sh',
  'application/csv',
  'application/xhtml+xml',
  'image/svg+xml',
]);

const TEXT_EXTENSIONS =
  /\.(txt|md|markdown|json|csv|tsv|js|mjs|cjs|jsx|ts|tsx|py|rb|go|rs|java|c|cpp|cc|h|hpp|cs|php|html|htm|css|scss|less|xml|svg|yaml|yml|toml|ini|conf|cfg|sh|bash|zsh|sql|log|env|gitignore|dockerfile)$/i;

export function isTextFile(file: Pick<File, 'name' | 'type'>): boolean {
  if (file.type && (file.type.startsWith('text/') || TEXT_MIME_TYPES.has(file.type))) {
    return true;
  }
  return TEXT_EXTENSIONS.test(file.name);
}

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function readAttachmentFile(file: File): Promise<Attachment> {
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const mimeType = file.type || 'application/octet-stream';

  if (isTextFile(file)) {
    const textContent = await readFileAsText(file);
    const url = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
    return {
      id,
      name: file.name,
      size: file.size,
      type: mimeType,
      url,
      textContent,
    };
  }

  const dataUrl = await readFileAsDataUrl(file);
  const commaIdx = dataUrl.indexOf(',');
  const dataBase64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : '';
  return {
    id,
    name: file.name,
    size: file.size,
    type: mimeType,
    url: dataUrl,
    dataBase64,
  };
}
