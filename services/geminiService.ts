
import { GoogleGenAI } from "@google/genai";
import { AnalysisOptions, AlbumSession, AlbumAnalysisOptions } from "../types";

const personaSystemInstructions: Record<string, string> = {
    producer: "You are a seasoned music producer with multiple platinum records. Your critique should focus on the song's arrangement, production quality, hook, and marketability. Be constructive but firm, like a mentor.",
    poet: "You are a celebrated poet and lyricist. Analyze the lyrics for their use of metaphor, imagery, emotional depth, and storytelling. Disregard commercial potential and focus solely on the artistic merit of the words.",
    theorist: "You are a university-level music theorist. Your critique must analyze the song's structure, chord progressions, melody, and rhythmic complexity. Use appropriate music theory terminology. Be academic and objective.",
    cynic: "You are a notoriously cynical music critic, famous for your harsh reviews. Your goal is to find every flaw in the song, from a clichéd lyric to a boring chord change. Be witty, sarcastic, and brutally honest.",
    fan: "You are the BIGGEST fan of this artist. Your feedback should be overwhelmingly positive and enthusiastic. Gush about your favorite parts, express excitement, and tell them why this is a masterpiece in the making.",
};

/**
 * Gets a fresh instance of GoogleGenAI using the current process.env.API_KEY
 */
export function getAI() {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("API Key not found in environment.");
    }
    return new GoogleGenAI({ apiKey: apiKey as string });
}


/**
 * Converts a File object to a base64 encoded string.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string.
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // result is "data:mime/type;base64,the-real-base64-string"
      // we just want "the-real-base64-string"
      const encoded = (reader.result as string).split(',')[1];
      resolve(encoded);
    };
    reader.onerror = error => reject(error);
  });
}


export async function analyzeSong(title: string, artist: string, lyrics: string, concept: string, mediaFile: File | null, options: AnalysisOptions): Promise<string> {
  const prompt = `
    Perform a Hyper-Analysis of the following song. Focus on intricate details, stylistic nuance, and technical musicality.

    **Song Title:** "${title}"
    **Artist:** ${artist}
    ${concept ? `**Concept/Theme:** ${concept}\n` : ''}
    **Lyrics/Audio Context:**
    ---
    ${lyrics || (mediaFile?.type.startsWith('audio') ? '(No lyrics provided; analyze audio)' : '(No lyrics provided)')}
    ---

    **Required Analysis Sections:**
    1.  **Genre & Stylistic Nuance:** Identify precise genres, micro-genres, and stylistic influences.
    2.  **Rhythm & Tempo:** Estimate BPM, time signature, and describe the rhythmic groove/feel.
    3.  **Conceptual Integration & Mood:** How does the content align with the concept? Analyze tonal shifts and emotional depth.
    4.  **Lyrical/Musical Texture:** Analyze wordplay/rhyme schemes (if lyrics) or instrumentation/timbre (if audio).
    5.  **Hook & "Earworm" Mechanics:** Deconstruct what makes the hook catchy (melody, repetition, phrasing).

    ${options.analyzeVideo ? `
    6.  **Cinematic Universe & Screenplay Potential:** Describe a potential music video narrative or short film concept that fits this song. Discuss visual storytelling arcs. **Include a "Vocal Placement & Delivery" subsection:** Provide precise instructions on the vocal delivery style (tone, energy, phrasing) and analyze the timing/length of vocal presence throughout the song based on the lyrics and musical structure to identify where the voice should lead or recede for maximum cinematic impact.
    ` : ''}

    ${options.analyzeVideo && options.includeVideoPrompts ? `
    7.  **Generative Video Prompts (Structure & Pacing):** Provide specific, highly descriptive text prompts suitable for AI video generation models. Include camera angles, lighting, movement, and scene pacing corresponding to the song's energy.
    ` : ''}

    ${options.includeSuggestions ? `
    8.  **Constructive Expansion (Suggestions):** Provide 3-5 concrete, actionable suggestions to further develop this track.
    ` : ''}
    
    Format as Markdown. Use headings, bold text, and numbered lists.

    CRITICAL FINAL REQUIREMENT: At the very end of your response, you MUST append a JSON block containing composition timeline data for a D3 visualizer representing the peaks, valleys, and structure of the song over its duration (e.g., Intro, Verse, Chorus, Bridge, Outro).
    
    Structure this final block exactly as follows:
    [VISUALIZER_DATA]
    \`\`\`json
    [
      { "time": "0:00", "lyricalDensity": 10, "vocalIntensity": 15, "section": "Intro" },
      { "time": "0:30", "lyricalDensity": 55, "vocalIntensity": 60, "section": "Verse 1" },
      { "time": "1:15", "lyricalDensity": 80, "vocalIntensity": 85, "section": "Chorus" },
      { "time": "1:50", "lyricalDensity": 60, "vocalIntensity": 65, "section": "Verse 2" },
      { "time": "2:35", "lyricalDensity": 85, "vocalIntensity": 90, "section": "Chorus" },
      { "time": "3:10", "lyricalDensity": 30, "vocalIntensity": 40, "section": "Bridge" },
      { "time": "3:45", "lyricalDensity": 90, "vocalIntensity": 95, "section": "Chorus Peak" },
      { "time": "4:20", "lyricalDensity": 15, "vocalIntensity": 10, "section": "Outro" }
    ]
    \`\`\`
    Ensure there are between 6 and 12 logical time points matching the lyrical flow and song progression. The lyricalDensity and vocalIntensity fields MUST be integers between 0 and 100 representing the density/presence over time. DO NOT write anything after this JSON block.
  `;

  try {
     if (mediaFile) {
        const base64Data = await fileToBase64(mediaFile);
        let finalPrompt = prompt;
        let model: string = 'gemini-3.1-pro-preview';
        
        const mediaPart = {
            inlineData: { mimeType: mediaFile.type, data: base64Data },
        };

        if (mediaFile.type.startsWith('image/')) {
            finalPrompt += "\n\n**Contextual Image:** An image has been provided for additional creative inspiration. Please consider its mood, content, and style in your analysis.";
        } else if (mediaFile.type.startsWith('audio/')) {
            finalPrompt += "\n\n**Contextual Audio:** An audio track has been provided. LISTEN CLOSELY. Perform a deep sonic analysis. Describe the timbre, production techniques, mixing choices, spatial audio qualities, and the 'feel' of the groove. Treat this as a deep listening session.";
        }

        const textPart = { text: finalPrompt };
        const ai = getAI();
        
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [textPart, mediaPart] },
        });
        return response.text || '';
    } else {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: prompt,
        });
        return response.text || '';
    }
  } catch (error) {
    console.error("Error analyzing song:", error);
    return `An error occurred during analysis. Please check the console for details. \n\n${(error as Error).message}`;
  }
}

export async function generateConceptImages(title: string, artist: string, concept: string, analysisContext: string, refinement?: string): Promise<string[]> {
    const prompt = `
        Create a high-quality, abstract, artistic album cover art (1:1 aspect ratio) for the song "${title}" by ${artist}.
        
        Context/Theme: ${concept}
        Analysis Mood/Vibe: ${analysisContext.substring(0, 300)}...
        ${refinement ? `Refinement Correction: ${refinement}` : ''}
        
        Style: Abstract, evocative, nuanced, high-resolution.
    `;

    try {
        // Nano Banana 2 (gemini-3.1-flash-image-preview)
        const model = 'gemini-3.1-flash-image-preview';
        const ai = getAI();
        
        // We request two images by making two parallel requests
        const request1 = ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt + " Variation 1" }] },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K"
                }
            }
        });
        
        const request2 = ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt + " Variation 2" }] },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K"
                }
            }
        });

        const [response1, response2] = await Promise.all([request1, request2]);

        const images: string[] = [];

        [response1, response2].forEach(response => {
             response.candidates?.[0]?.content?.parts?.forEach(part => {
                if (part.inlineData && part.inlineData.data) {
                    images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                }
             });
        });

        return images;

    } catch (error) {
        console.error("Error generating images:", error);
        throw error; // Re-throw to handle in UI
    }
}

export async function getCritique(title: string, artist: string, lyrics: string, concept: string, mediaFile: File | null, persona: string): Promise<string> {
    const systemInstruction = personaSystemInstructions[persona] || "You are a helpful music assistant.";

    const prompt = `
        Critique the following song based on my input.

        **Song Title:** "${title}"
        **Artist:** ${artist}
        ${concept ? `**Concept/Theme:** ${concept}` : ''}
        **Lyrics:**
        ---
        ${lyrics || (mediaFile?.type.startsWith('audio') ? '(Audio provided)' : '(No lyrics provided)')}
        ---

        ${mediaFile?.type.startsWith('image/') ? '**Contextual Image:** An image has been provided for creative inspiration. Factor its mood and content into your critique.' : ''}
        ${mediaFile?.type.startsWith('audio/') ? '**Contextual Audio:** An audio file has been provided. Factor its musical qualities (mood, tempo, instrumentation, etc.) into your critique.' : ''}
        
        Provide your critique in Markdown format, staying true to your persona.
    `;

    try {
        const model = 'gemini-3.1-pro-preview';
        const ai = getAI();

        if (mediaFile) {
            const base64Data = await fileToBase64(mediaFile);
            const mediaPart = {
                inlineData: { mimeType: mediaFile.type, data: base64Data },
            };
            const textPart = { text: prompt };

            const response = await ai.models.generateContent({
                model: model,
                contents: { parts: [textPart, mediaPart] },
                config: { systemInstruction },
            });
            return response.text || '';
        } else {
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { systemInstruction },
            });
            return response.text || '';
        }
    } catch (error) {
        console.error("Error getting critique:", error);
        return `An error occurred during critique. Please check the console for details. \n\n${(error as Error).message}`;
    }
}


export async function transcribeAudioFile(file: File): Promise<string> {
  try {
    const base64Data = await fileToBase64(file);
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data,
            },
          },
          { text: "Transcribe this audio file accurately." },
        ],
      },
    });
    return response.text || '';
  } catch (error) {
    console.error("Error transcribing audio file:", error);
    return `An error occurred during transcription. Please check the console for details. \n\nThis model may have limitations on audio file size and format. Error: ${(error as Error).message}`;
  }
}

/**
 * Performs a comprehensive holistic album-level review synthesizing all tracks in a session.
 * Tailored for both released catalog works (retrospective / canon / impact) and unreleased works (sequencing / rollout / thematic polish).
 */
export async function analyzeAlbumHolistic(
  session: AlbumSession,
  options: AlbumAnalysisOptions
): Promise<string> {
  const isReleased = session.releaseStatus === 'released';

  const trackSummaries = session.tracks.map((t, i) => {
    return `### Track ${t.trackNumber || i + 1}: "${t.title || `Track ${i + 1}`}"
${t.artist ? `Artist: ${t.artist}` : ''}
${t.concept ? `Concept/Context: ${t.concept}` : ''}
${t.analysis ? `Track Analysis Summary:\n${t.analysis.substring(0, 500)}...` : ''}
Lyrics/Notes:
${t.lyrics ? t.lyrics.substring(0, 600) + (t.lyrics.length > 600 ? '... [truncated]' : '') : '(Instrumental / Audio Track / No Lyrics Provided)'}
---`;
  }).join('\n\n');

  const prompt = `
You are an elite Chief Music Critic, Album Architecture Scholar, and Master A&R Director with encyclopedic knowledge of musical canon, narrative album construction, and cultural impact.

Perform a definitive, deeply analytical, and holistic "ALBUM ARCHITECTURAL DOSSIER & MACRO REVIEW" for this complete body of work.

=== ALBUM CONTEXT ===
**Album Title:** "${session.title || 'Untitled Body of Work'}"
**Artist:** ${session.artist || 'Various / Unknown'}
${session.genre ? `**Genre / Sonic Territory:** ${session.genre}\n` : ''}
**Work Status:** ${isReleased ? `Released Catalog Work ${session.releaseYear ? `(Released: ${session.releaseYear})` : ''} — Retrospective, Canon & Architectural Review` : 'Unreleased / Pre-Release Master Candidate — Structural Optimization & Rollout Evaluation'}
${session.concept ? `**Stated Overarching Concept / Narrative Vision:** ${session.concept}\n` : ''}
**Total Track Count:** ${session.tracks.length} Songs

--- TRACKLIST & COMPONENT DATA ---
${trackSummaries}
--- END TRACKLIST DATA ---

=== CRITICAL ANALYSIS DIRECTIVES ===
Conduct an authoritative evaluation organized into the following core architectural pillars:

${options.focusStructure ? `
### 1. Album Architecture & Narrative Acts
- **Structural Blueprint:** Deconstruct the macro structure (e.g. Traditional 3-Act Drama, Cyclical Journey, Concept Suite, Dual-Side Dichotomy, Symmetrical Inversion).
- **Pacing & Momentum:** How does tension build and release across the sequence? Evaluate the dramatic effectiveness of the opening statement (Track 1), the midpoint turning point, the climax, and the resolution/afterglow.
- **Transitional Bridges:** How smoothly or intentionally jarringly do songs hand off emotional energy to the next?
` : ''}

${options.focusCohesion ? `
### 2. Sonic & Thematic Cohesion
- **Sonic Universe & Palette Discipline:** Analyze the consistency of instrumentation, acoustic vs electronic balance, mixing textures, and sonic hallmarks that bind these songs into a singular world.
- **Recurring Motifs & Echoes:** Identify recurring lyrical metaphors, vocal cadences, melodic motifs, or emotional themes that resurface across multiple songs.
- **Cohesion vs. Dissonance / Outliers:** Identify any sonic anomalies or tracks that push beyond the album's boundary, evaluating whether they function as brilliant contrast or disruptive detours.
` : ''}

${options.focusMessage ? `
### 3. Core Message, Thesis & Philosophical Underpinnings
- **Central Thesis Statement:** What fundamental human truth, social critique, emotional journey, or philosophy is this album declaring to the listener?
- **Subtext & Metaphorical Depth:** Deconstruct the deeper subtext beneath the surface lyrics—what are the unspoken anxieties, aspirations, or narrative revelations?
- **Artistic Authenticity & Vulnerability:** How honestly does the artist communicate their perspective throughout the arc?
` : ''}

${options.focusImportance ? `
### 4. Artistic, Cultural & Historical Importance
- **Artistic Significance:** Where does this body of work sit within the artist's creative evolution and within its wider musical landscape?
- **Cultural & Generational Resonance:** What cultural conversations, subcultures, or generational moods does this album tap into or define?
- ${isReleased ? '**Canon & Legacy Standing:** How well does this work stand the test of time? What is its enduring influence or historical mark?' : '**Innovation & Horizon:** How does this record push beyond existing genre conventions or establish a fresh creative benchmark?'}
` : ''}

${options.focusTrackSynergy ? `
### 5. Track Synergy Matrix (The Component Ecosystem)
Provide a structured breakdown of each song's specific role within the album's macro organism:
- **The Keystone / Anchor:** The track that carries the core thematic weight.
- **The Catalyst / Ignition:** The track that accelerates the energy or plot.
- **The Emotional Climax:** The peak of vulnerability or sonic explosion.
- **The Atmospheric Breather / Pivot:** The contemplation before the descent or ascent.
- **The Resolution / Coda:** How the final chapter leaves the listener.
` : ''}

${options.includeCommercialPotential ? `
### 6. ${isReleased ? 'Standout Cuts & Cultural Anthems' : 'Single Strategy & Target Demographics'}
- Identify the **Flagship Single / Cultural Anthem** (hook potency, universal appeal).
- Identify the **Cult Favorite / Deep Cut** (artistic zenith, critic and superfan favorite).
- Identify the **Atmospheric / Playlist Anchor** (repeat listening value).
` : ''}

${options.includeSequencingReview ? `
### 7. Tracklist Sequencing & Pacing Audit
- Evaluate the current track order. ${isReleased ? 'Critique how the sequencing contributed to the album experience and suggest any alternative "Director’s Cut" orders.' : 'Suggest specific track swaps, transitions, or pacing adjustments to maximize emotional impact.'}
` : ''}

### 8. Executive Synthesis & Metascore
- **Key Masteries (Strengths):** The 3 most formidable achievements of this body of work.
- **Refinement Horizons / Vulnerabilities:** Nuanced critiques or opportunities for deeper resonance.
- **Macro Cohesion Score & Overall Metascore:** (Out of 100) with authoritative concluding remarks.

Format in pristine Markdown with clear typography, bold emphasis, structured callouts, and sharp analytical clarity.

CRITICAL FINAL REQUIREMENT: At the very end of your response, you MUST append a JSON block containing the album-level trajectory data for each track across the album (1 to ${session.tracks.length}).

Structure this final block exactly as follows:
[ALBUM_ENERGY_ARC]
\`\`\`json
[
  { "trackNumber": 1, "title": "Track Name", "energy": 75, "density": 60, "intensity": 70, "flow": "High-impact opener" },
  { "trackNumber": 2, "title": "Track Name", "energy": 85, "density": 80, "intensity": 90, "flow": "Energetic momentum" }
]
\`\`\`
Ensure there is exactly one entry for each of the ${session.tracks.length} tracks. The energy, density, and intensity fields MUST be integers between 0 and 100 representing the estimated energy curve. DO NOT write anything after this JSON block.
`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
    });
    return response.text || '';
  } catch (error) {
    console.error("Error analyzing album holistically:", error);
    return `An error occurred during holistic album analysis. Please check console.\n\n${(error as Error).message}`;
  }
}

/**
 * Generates an Album Cover Art concept for the entire album session.
 */
export async function generateAlbumArtwork(
  title: string,
  artist: string,
  concept: string,
  genre: string
): Promise<string> {
  const prompt = `
    Create high-end, iconic, award-winning album cover art for the complete LP/EP titled "${title}" by ${artist}.
    Genre: ${genre || 'Contemporary Music'}
    Album Concept & Universe: ${concept || 'A transcendent sonic journey'}
    Visual Style: Highly stylized, iconic typography placement space, atmospheric, cinematic, 1:1 vinyl sleeve format.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData && p.inlineData.data);
    if (part?.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    return '';
  } catch (error) {
    console.error("Error generating album artwork:", error);
    throw error;
  }
}
