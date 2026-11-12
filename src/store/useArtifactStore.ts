import { create } from 'zustand';
import { ArtifactData, ArtifactTab } from '../types/artifact';

export interface ArtifactState {
  isOpen: boolean;
  artifact: ArtifactData | null;
  activeTab: ArtifactTab;
  isFullscreen: boolean;
  openArtifact: (artifact: ArtifactData) => void;
  closeArtifact: () => void;
  setActiveTab: (tab: ArtifactTab) => void;
  toggleFullscreen: () => void;
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  isOpen: false,
  artifact: null,
  activeTab: 'preview',
  isFullscreen: false,
  openArtifact: (artifact: ArtifactData) =>
    set({
      isOpen: true,
      artifact,
      activeTab: 'preview',
    }),
  closeArtifact: () =>
    set({
      isOpen: false,
      artifact: null,
      isFullscreen: false,
    }),
  setActiveTab: (activeTab: ArtifactTab) => set({ activeTab }),
  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
}));
