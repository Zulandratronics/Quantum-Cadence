
export type Tab = 'analyze' | 'chat' | 'transcribe' | 'critique';

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

