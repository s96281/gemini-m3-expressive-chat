export type ArtifactType = 'html' | 'svg' | 'react' | 'mermaid' | 'code';
export type ArtifactTab = 'preview' | 'code';

export interface ArtifactData {
  id: string;
  type: ArtifactType;
  title: string;
  code: string;
  language?: string;
}
