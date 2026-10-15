
export type Tab = 'analyze' | 'album' | 'critique' | 'chat' | 'transcribe';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface AnalysisOptions {
  includeSuggestions: boolean;
  analyzeVideo: boolean;
  includeVideoPrompts: boolean;
  generateArt: boolean;
}

export interface VisualizerPoint {
  time: string;
  lyricalDensity: number;
  vocalIntensity: number;
  section: string;
}

export interface AlbumTrack {
  id: string;
  trackNumber: number;
  title: string;
  artist?: string;
  lyrics: string;
  concept?: string;
  file: File | null;
  fileName?: string;
  fileType?: 'audio' | 'text' | 'image';
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'error';
  analysis?: string;
  visualizerPoints?: VisualizerPoint[];
  energyScore?: number; // 0-100 estimated energy
  error?: string;
}

export interface AlbumSession {
  id: string;
  title: string;
  artist: string;
  concept: string;
  genre: string;
  releaseStatus: 'released' | 'unreleased';
  releaseYear?: string;
  tracks: AlbumTrack[];
  holisticReview?: string;
  albumArtUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AlbumAnalysisOptions {
  analyzeIndividualTracks: boolean;
  focusStructure: boolean;
  focusCohesion: boolean;
  focusMessage: boolean;
  focusImportance: boolean;
  focusTrackSynergy: boolean;
  includeSequencingReview: boolean;
  includeCommercialPotential: boolean;
  generateAlbumArt: boolean;
}

