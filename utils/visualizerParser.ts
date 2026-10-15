import { VisualizerPoint } from '../types';

export interface ParsedAnalysis {
  cleanMarkdown: string;
  visualizerData: VisualizerPoint[];
}

export interface AlbumArcPoint {
  trackNumber: number;
  title: string;
  energy: number;
  density: number;
  intensity: number;
  flow?: string;
}

export interface ParsedAlbumAnalysis {
  cleanMarkdown: string;
  albumArcData: AlbumArcPoint[];
}

/**
 * Parses the analysis response from Gemini to extract the structured D3 visualizer data
 * and returns both the cleaned markdown and the parsed points.
 */
export function parseAnalysisResponse(rawText: string): ParsedAnalysis {
  const result: ParsedAnalysis = {
    cleanMarkdown: rawText,
    visualizerData: []
  };

  if (!rawText) return result;

  const tagIndex = rawText.indexOf('[VISUALIZER_DATA]');
  if (tagIndex === -1) {
    // If no tag found, let's look for standard ```json block at the end as a fallback
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
    let match;
    let lastMatch = null;
    
    while ((match = jsonBlockRegex.exec(rawText)) !== null) {
      lastMatch = match;
    }
    
    if (lastMatch) {
      try {
        const parsed = JSON.parse(lastMatch[1].trim());
        if (Array.isArray(parsed)) {
          result.visualizerData = parsed;
          result.cleanMarkdown = rawText.substring(0, lastMatch.index).trim();
          return result;
        }
      } catch (e) {
        console.warn('Failed to parse fallback JSON visualizer data', e);
      }
    }
    return result;
  }

  // Extract from [VISUALIZER_DATA] tag onwards
  const postTagText = rawText.substring(tagIndex + '[VISUALIZER_DATA]'.length).trim();
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = jsonBlockRegex.exec(postTagText);

  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        result.visualizerData = parsed;
        result.cleanMarkdown = rawText.substring(0, tagIndex).trim();
      }
    } catch (e) {
      console.warn('Failed to parse visualizer data JSON', e);
    }
  } else {
    // Attempt parsing directly without markdown block if we find brace-like arrays
    const rawJsonStart = postTagText.indexOf('[');
    const rawJsonEnd = postTagText.lastIndexOf(']');
    if (rawJsonStart !== -1 && rawJsonEnd !== -1 && rawJsonEnd > rawJsonStart) {
      try {
        const rawJson = postTagText.substring(rawJsonStart, rawJsonEnd + 1).trim();
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          result.visualizerData = parsed;
          result.cleanMarkdown = rawText.substring(0, tagIndex).trim();
        }
      } catch (e) {
        console.warn('Failed to parse raw visualizer JSON fallback', e);
      }
    }
  }

  return result;
}

/**
 * Parses the holistic album analysis response to extract the full album energy arc D3 dataset.
 */
export function parseAlbumAnalysisResponse(rawText: string): ParsedAlbumAnalysis {
  const result: ParsedAlbumAnalysis = {
    cleanMarkdown: rawText,
    albumArcData: []
  };

  if (!rawText) return result;

  const tagIndex = rawText.indexOf('[ALBUM_ENERGY_ARC]');
  if (tagIndex === -1) {
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
    let match;
    let lastMatch = null;
    while ((match = jsonBlockRegex.exec(rawText)) !== null) {
      lastMatch = match;
    }
    if (lastMatch) {
      try {
        const parsed = JSON.parse(lastMatch[1].trim());
        if (Array.isArray(parsed)) {
          result.albumArcData = parsed;
          result.cleanMarkdown = rawText.substring(0, lastMatch.index).trim();
          return result;
        }
      } catch (e) {
        console.warn('Failed to parse fallback JSON album arc data', e);
      }
    }
    return result;
  }

  const postTagText = rawText.substring(tagIndex + '[ALBUM_ENERGY_ARC]'.length).trim();
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = jsonBlockRegex.exec(postTagText);

  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        result.albumArcData = parsed;
        result.cleanMarkdown = rawText.substring(0, tagIndex).trim();
      }
    } catch (e) {
      console.warn('Failed to parse album arc JSON', e);
    }
  } else {
    const rawJsonStart = postTagText.indexOf('[');
    const rawJsonEnd = postTagText.lastIndexOf(']');
    if (rawJsonStart !== -1 && rawJsonEnd !== -1 && rawJsonEnd > rawJsonStart) {
      try {
        const rawJson = postTagText.substring(rawJsonStart, rawJsonEnd + 1).trim();
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          result.albumArcData = parsed;
          result.cleanMarkdown = rawText.substring(0, tagIndex).trim();
        }
      } catch (e) {
        console.warn('Failed to parse raw album arc JSON fallback', e);
      }
    }
  }

  return result;
}
