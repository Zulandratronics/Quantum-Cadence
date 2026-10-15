import React, { useState, useEffect, useRef } from 'react';
import { AlbumSession, AlbumTrack, AlbumAnalysisOptions } from '../types';
import { processAndValidateFile } from '../utils/fileUtils';
import { analyzeSong, analyzeAlbumHolistic, generateAlbumArtwork } from '../services/geminiService';
import { parseAnalysisResponse, parseAlbumAnalysisResponse, AlbumArcPoint } from '../utils/visualizerParser';
import { AlbumArcVisualizer } from './AlbumArcVisualizer';
import { Visualizer } from './Visualizer';
import Loader from './Loader';
import { 
  DiscIcon, 
  SparkleIcon, 
  UploadIcon, 
  MusicNoteIcon, 
  DownloadIcon, 
  PlayIcon, 
  CheckCircleIcon, 
  AlertCircleIcon, 
  TrashIcon, 
  PlusIcon, 
  FileTextIcon, 
  LayersIcon 
} from './icons';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const LOCAL_STORAGE_KEY = 'quantum_cadence_album_session_v1';

// Markdown simple renderer with cyberpunk styling
const renderMarkdown = (text: string) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-4 text-gray-300 font-sans leading-relaxed text-sm">
      {lines.map((line, index) => {
        if (line.startsWith('### ')) {
          return <h4 key={index} className="text-md font-bold text-pink-400 mt-4 mb-2">{line.replace('### ', '')}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={index} className="text-lg font-black text-cyan-300 mt-6 mb-3 border-b border-gray-700/60 pb-1">{line.replace('## ', '')}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={index} className="text-xl font-black text-white mt-8 mb-4 border-b border-pink-500/40 pb-2">{line.replace('# ', '')}</h2>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li key={index} className="ml-4 list-disc text-gray-300">
              <span dangerouslySetInnerHTML={{ __html: line.replace(/^[-*]\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>') }} />
            </li>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <li key={index} className="ml-4 list-decimal text-gray-300">
              <span dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>') }} />
            </li>
          );
        }
        if (line.trim() === '') {
          return <div key={index} className="h-1.5" />;
        }
        return (
          <p key={index} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>') }} />
        );
      })}
    </div>
  );
};

const DEFAULT_RELEASED_DEMO_TRACKS: AlbumTrack[] = [
  {
    id: 'demo-1',
    trackNumber: 1,
    title: 'Neon Awakening',
    lyrics: `[Intro - Synthesizers pulsing]\nWake up to the chrome sunrise\nStatic in our blood, data in our eyes\n[Verse 1]\nWe walked the lower sectors when the grid went down\nEchoes of the monolith above the town\n[Chorus]\nRise through the frequency, break through the sound\nNothing can anchor us to solid ground`,
    concept: 'Explosive cyberpunk opener establishing the dystopian setting and sensory awakening.',
    file: null,
    status: 'idle',
  },
  {
    id: 'demo-2',
    trackNumber: 2,
    title: 'Sub-Level Velocity',
    lyrics: `[Fast BPM 140]\nPedal to the firewall, neon blur\nChasing the ghost of who we were\nUnderground rails, spark in the dark\nIgnite the revolution with a single spark\n[Chorus]\nFaster than the algorithm, louder than the rain\nRewriting all the codes inside the mainframe`,
    concept: 'High-octane synthwave chase scene with rapid lyrical cadence.',
    file: null,
    status: 'idle',
  },
  {
    id: 'demo-3',
    trackNumber: 3,
    title: 'Hologram Memories',
    lyrics: `[Slow, Atmospheric Reverb]\nFlickering projection on the bedroom wall\nI replay your laughter before the fall\nCyan light fading into dusty blue\nIs it really memory or simulated truth?\n[Chorus]\nYou were the only real thing in a world made of glass\nWatching the digital shadows pass`,
    concept: 'Melancholic mid-tempo ballad focusing on emotional loss and simulation nostalgia.',
    file: null,
    status: 'idle',
  },
  {
    id: 'demo-4',
    trackNumber: 4,
    title: 'Circuit Breaker',
    lyrics: `[Aggressive Industrial Bass]\nOverload! High voltage in the vein\nCutting through the signal, shedding the chain\n[Bridge]\nThree, two, one, blow the fuse\nWe have got nothing left to lose\n[Chorus]\nCircuit breaker, system shaker\nWe are the destroyers and the dream makers`,
    concept: 'Heavy climax anthem with industrial percussion and aggressive distortion.',
    file: null,
    status: 'idle',
  },
  {
    id: 'demo-5',
    trackNumber: 5,
    title: 'Silent Biosphere',
    lyrics: `[Ambient Outro - Rain & Gentle Piano]\nThe power cuts out, the screens go dim\nStanding on the edge of the rooftop rim\nGreen moss growing through the steel and stone\nFor the first time in forever, not alone.\n[Outro Fade]`,
    concept: 'Peaceful acoustic-electronic resolution as nature reclaims the metropolis.',
    file: null,
    status: 'idle',
  }
];

const DEFAULT_UNRELEASED_DEMO_TRACKS: AlbumTrack[] = [
  {
    id: 'unrel-1',
    trackNumber: 1,
    title: 'Solar Flare Protocol',
    lyrics: `[Pulsing Cosmic Arpeggios]\nCalculated risk on the launch platform\nLeaving behind the atmospheric storm\n[Verse 1]\nTelemetry locks onto the distant sun\nThe voyage has officially begun`,
    concept: 'Cinematic ignition track establishing the interstellar voyage.',
    file: null,
    status: 'idle',
  },
  {
    id: 'unrel-2',
    trackNumber: 2,
    title: 'Zero Gravity Mirage',
    lyrics: `[Deep Bass Grooves & Vocoder]\nDrifting weightless through the asteroid belt\nForgetting everything we ever felt\n[Chorus]\nIs this reality or zero-G illusion?\nDancing at the edge of cosmic confusion`,
    concept: 'Upbeat groove single candidate with catchy hook cadence.',
    file: null,
    status: 'idle',
  },
  {
    id: 'unrel-3',
    trackNumber: 3,
    title: 'Supernova Soliloquy',
    lyrics: `[Vocal Monologue & Orchestral Climax]\nStars collapse so that heavy elements may live\nHow much more do you want me to give?\n[Outro]\nLight bends across the event horizon`,
    concept: 'Dramatic philosophical center-piece.',
    file: null,
    status: 'idle',
  }
];

export const AlbumSessionReview: React.FC = () => {
  const [session, setSession] = useState<AlbumSession>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.tracks = parsed.tracks.map((t: AlbumTrack) => ({ ...t, file: null }));
        if (!parsed.releaseStatus) parsed.releaseStatus = 'released';
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load saved album session:', e);
    }
    return {
      id: `session-${Date.now()}`,
      title: 'Echoes of the Grid',
      artist: 'Kroma & The Synths',
      concept: 'A narrative cyberpunk concept album depicting humanity rediscovering organic connection amidst an automated metropolis.',
      genre: 'Cyberpunk Synthwave / Cinematic Industrial',
      releaseStatus: 'released',
      releaseYear: '2023',
      tracks: DEFAULT_RELEASED_DEMO_TRACKS,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  const [activeSubTab, setActiveSubTab] = useState<'tracklist' | 'review' | 'batch_upload' | 'settings'>('tracklist');
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(session.tracks[0]?.id || null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [isHolisticRunning, setIsHolisticRunning] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentTrackTitle: '' });
  const [bulkTextInput, setBulkTextInput] = useState('');
  const [albumArcData, setAlbumArcData] = useState<AlbumArcPoint[]>([]);
  const [options, setOptions] = useState<AlbumAnalysisOptions>({
    analyzeIndividualTracks: true,
    focusStructure: true,
    focusCohesion: true,
    focusMessage: true,
    focusImportance: true,
    focusTrackSynergy: true,
    includeSequencingReview: true,
    includeCommercialPotential: true,
    generateAlbumArt: false,
  });

  const isCancelledRef = useRef(false);
  const dossierRef = useRef<HTMLDivElement | null>(null);

  // Save session state to localStorage on modification
  useEffect(() => {
    try {
      const serializableSession = {
        ...session,
        tracks: session.tracks.map(t => ({
          ...t,
          file: null // cannot serialize File object
        })),
        updatedAt: Date.now()
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializableSession));
    } catch (e) {
      console.warn('Failed to save album session:', e);
    }
  }, [session]);

  // If holisticReview has album arc data, parse it on load
  useEffect(() => {
    if (session.holisticReview) {
      const parsed = parseAlbumAnalysisResponse(session.holisticReview);
      if (parsed.albumArcData && parsed.albumArcData.length > 0) {
        setAlbumArcData(parsed.albumArcData);
      }
    }
  }, [session.holisticReview]);

  // Track Management Handlers
  const handleAddTrack = () => {
    const newTrackNumber = session.tracks.length + 1;
    const newTrack: AlbumTrack = {
      id: `track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      trackNumber: newTrackNumber,
      title: `Track ${newTrackNumber}`,
      lyrics: '',
      concept: '',
      file: null,
      status: 'idle',
    };
    setSession(prev => ({
      ...prev,
      tracks: [...prev.tracks, newTrack]
    }));
    setExpandedTrackId(newTrack.id);
  };

  const handleUpdateTrack = (id: string, updates: Partial<AlbumTrack>) => {
    setSession(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => (t.id === id ? { ...t, ...updates } : t))
    }));
  };

  const handleDeleteTrack = (id: string) => {
    setSession(prev => {
      const remaining = prev.tracks.filter(t => t.id !== id);
      const renumbered = remaining.map((t, idx) => ({ ...t, trackNumber: idx + 1 }));
      return { ...prev, tracks: renumbered };
    });
  };

  const handleMoveTrack = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= session.tracks.length) return;

    setSession(prev => {
      const tracks = [...prev.tracks];
      const temp = tracks[index];
      tracks[index] = tracks[targetIndex];
      tracks[targetIndex] = temp;
      const renumbered = tracks.map((t, idx) => ({ ...t, trackNumber: idx + 1 }));
      return { ...prev, tracks: renumbered };
    });
  };

  // Bulk File Upload Handler (.mp3, .wav, .m4a, .txt, etc.)
  const handleBulkFilesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newTracks: AlbumTrack[] = [];
    let trackNum = session.tracks.length + 1;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const processed = await processAndValidateFile(file);
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/^[0-9]+[\s-_]*/, '');
        
        newTracks.push({
          id: `track-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          trackNumber: trackNum++,
          title: cleanName || `Track ${trackNum}`,
          lyrics: processed.type === 'text' ? processed.content : '',
          concept: `Imported from ${file.name}`,
          file: processed.type === 'audio' ? file : null,
          fileName: file.name,
          fileType: processed.type,
          status: 'idle',
        });
      } catch (err) {
        console.warn(`Could not parse ${file.name}:`, err);
      }
    }

    if (newTracks.length > 0) {
      setSession(prev => ({
        ...prev,
        tracks: [...prev.tracks, ...newTracks]
      }));
      setActiveSubTab('tracklist');
      setExpandedTrackId(newTracks[0].id);
    }
  };

  // Bulk Text Parser (splits single file by track headers)
  const handleImportBulkText = () => {
    if (!bulkTextInput.trim()) return;

    const sections = bulkTextInput.split(/(?:^|\n)(?=(?:Track\s*\d+|\[Track\s*\d+\]|---|\d+\.\s+))/i);
    const parsedTracks: AlbumTrack[] = [];
    let trackCount = session.tracks.length + 1;

    sections.forEach((sec) => {
      const trimmed = sec.trim();
      if (!trimmed) return;

      const lines = trimmed.split('\n');
      const firstLine = lines[0].replace(/^(?:Track\s*\d+[:\-.]?|\[Track\s*\d+\]|\d+\.\s+|---\s*)/i, '').trim();
      const title = firstLine || `Track ${trackCount}`;
      const lyrics = lines.slice(firstLine ? 1 : 0).join('\n').trim();

      parsedTracks.push({
        id: `track-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        trackNumber: trackCount++,
        title: title || `Track ${trackCount}`,
        lyrics: lyrics,
        concept: '',
        file: null,
        status: 'idle',
      });
    });

    if (parsedTracks.length > 0) {
      setSession(prev => ({
        ...prev,
        tracks: [...prev.tracks, ...parsedTracks]
      }));
      setBulkTextInput('');
      setActiveSubTab('tracklist');
    }
  };

  // Single Track Analysis Runner
  const handleAnalyzeSingleTrack = async (trackId: string) => {
    const track = session.tracks.find(t => t.id === trackId);
    if (!track) return;

    handleUpdateTrack(trackId, { status: 'processing', error: undefined });

    try {
      const rawAnalysis = await analyzeSong(
        track.title || `Track ${track.trackNumber}`,
        session.artist || 'Unknown Artist',
        track.lyrics,
        `${session.concept ? `[Album: "${session.title}" Concept: ${session.concept}] ` : ''}${track.concept || ''}`,
        track.file,
        {
          includeSuggestions: true,
          analyzeVideo: true,
          includeVideoPrompts: false,
          generateArt: false,
        }
      );

      const parsed = parseAnalysisResponse(rawAnalysis);
      handleUpdateTrack(trackId, {
        status: 'completed',
        analysis: parsed.cleanMarkdown,
        visualizerPoints: parsed.visualizerData
      });
    } catch (error) {
      handleUpdateTrack(trackId, {
        status: 'error',
        error: (error as Error).message || 'Analysis failed'
      });
    }
  };

  // Master Resource-Balanced Batch Workflow Runner
  const handleRunAlbumBatch = async () => {
    if (session.tracks.length === 0) return;
    setIsBatchRunning(true);
    isCancelledRef.current = false;

    setBatchProgress({
      current: 0,
      total: options.analyzeIndividualTracks ? session.tracks.length + 1 : 1,
      currentTrackTitle: 'Initializing Resource-Balanced Album Pipeline...'
    });

    const updatedTracks = [...session.tracks];

    // Step 1: Process Individual Tracks (if enabled)
    if (options.analyzeIndividualTracks) {
      for (let i = 0; i < updatedTracks.length; i++) {
        if (isCancelledRef.current) break;

        const currentTrack = updatedTracks[i];
        setBatchProgress({
          current: i + 1,
          total: updatedTracks.length + 1,
          currentTrackTitle: `Analyzing Track ${i + 1}/${updatedTracks.length}: "${currentTrack.title}"`
        });

        // Mark track as processing
        updatedTracks[i] = { ...currentTrack, status: 'processing' };
        setSession(prev => ({ ...prev, tracks: [...updatedTracks] }));

        try {
          const rawAnalysis = await analyzeSong(
            currentTrack.title || `Track ${i + 1}`,
            session.artist,
            currentTrack.lyrics,
            `${session.concept ? `[Album: "${session.title}" Theme: ${session.concept}] ` : ''}${currentTrack.concept || ''}`,
            currentTrack.file,
            {
              includeSuggestions: true,
              analyzeVideo: true,
              includeVideoPrompts: false,
              generateArt: false,
            }
          );

          const parsed = parseAnalysisResponse(rawAnalysis);
          updatedTracks[i] = {
            ...currentTrack,
            status: 'completed',
            analysis: parsed.cleanMarkdown,
            visualizerPoints: parsed.visualizerData
          };
          setSession(prev => ({ ...prev, tracks: [...updatedTracks] }));
        } catch (err) {
          updatedTracks[i] = {
            ...currentTrack,
            status: 'error',
            error: (err as Error).message
          };
          setSession(prev => ({ ...prev, tracks: [...updatedTracks] }));
        }

        // Small grace pause to maintain healthy rate balance
        await new Promise(r => setTimeout(r, 600));
      }
    }

    if (isCancelledRef.current) {
      setIsBatchRunning(false);
      return;
    }

    // Step 2: Run Holistic Album Synthesis
    setBatchProgress(prev => ({
      ...prev,
      current: prev.total,
      currentTrackTitle: 'Synthesizing Macro Album Dossier & Energy Arc...'
    }));

    try {
      const activeSession: AlbumSession = {
        ...session,
        tracks: updatedTracks
      };
      const rawHolistic = await analyzeAlbumHolistic(activeSession, options);
      const parsedHolistic = parseAlbumAnalysisResponse(rawHolistic);

      setSession(prev => ({
        ...prev,
        tracks: updatedTracks,
        holisticReview: parsedHolistic.cleanMarkdown
      }));

      if (parsedHolistic.albumArcData && parsedHolistic.albumArcData.length > 0) {
        setAlbumArcData(parsedHolistic.albumArcData);
      }

      // Generate Album Art if requested
      if (options.generateAlbumArt) {
        setIsGeneratingArt(true);
        try {
          const artUrl = await generateAlbumArtwork(session.title, session.artist, session.concept, session.genre);
          setSession(prev => ({ ...prev, albumArtUrl: artUrl }));
        } catch (artErr) {
          console.warn('Artwork generation failed:', artErr);
        } finally {
          setIsGeneratingArt(false);
        }
      }

      setActiveSubTab('review');
    } catch (holisticErr) {
      console.error('Holistic analysis error:', holisticErr);
    } finally {
      setIsBatchRunning(false);
    }
  };

  const handleStopBatch = () => {
    isCancelledRef.current = true;
    setIsBatchRunning(false);
  };

  // Run only Holistic Review directly (Lightweight Mode)
  const handleRunHolisticOnly = async () => {
    setIsHolisticRunning(true);
    try {
      const rawHolistic = await analyzeAlbumHolistic(session, options);
      const parsed = parseAlbumAnalysisResponse(rawHolistic);
      setSession(prev => ({
        ...prev,
        holisticReview: parsed.cleanMarkdown
      }));
      if (parsed.albumArcData && parsed.albumArcData.length > 0) {
        setAlbumArcData(parsed.albumArcData);
      }
      setActiveSubTab('review');
    } catch (e) {
      console.error(e);
    } finally {
      setIsHolisticRunning(false);
    }
  };

  // Generate Cover Art
  const handleGenerateCoverArt = async () => {
    if (isGeneratingArt) return;
    setIsGeneratingArt(true);
    try {
      const artUrl = await generateAlbumArtwork(session.title, session.artist, session.concept, session.genre);
      setSession(prev => ({ ...prev, albumArtUrl: artUrl }));
    } catch (e) {
      console.error('Cover art generation failed:', e);
    } finally {
      setIsGeneratingArt(false);
    }
  };

  // Export Full Album Dossier as TXT
  const handleExportAlbumTXT = () => {
    const isReleased = session.releaseStatus === 'released';
    let txt = `=======================================================\n`;
    txt += `       QUANTUM CADENCE: EXECUTIVE ALBUM DOSSIER        \n`;
    txt += `=======================================================\n\n`;
    txt += `ALBUM TITLE:    ${session.title || 'Untitled Album'}\n`;
    txt += `ARTIST:         ${session.artist || 'Unknown'}\n`;
    txt += `GENRE / DOMAIN: ${session.genre || 'Unspecified'}\n`;
    txt += `WORK STATUS:    ${isReleased ? `RELEASED CATALOG (${session.releaseYear || 'Catalog'})` : 'UNRELEASED / PRE-RELEASE MASTER'}\n`;
    txt += `TRACK COUNT:    ${session.tracks.length}\n`;
    txt += `ANALYSIS DATE:  ${new Date().toLocaleDateString()}\n\n`;
    txt += `ALBUM CONCEPT, THESIS & NARRATIVE VISION:\n${session.concept || 'N/A'}\n\n`;

    if (albumArcData.length > 0) {
      txt += `-------------------------------------------------------\n`;
      txt += `           ALBUM DYNAMIC ENERGY TRAJECTORY            \n`;
      txt += `-------------------------------------------------------\n`;
      txt += `Track | Title                    | Energy | Intens | Flow\n`;
      txt += `------|--------------------------|--------|--------|-------------------\n`;
      albumArcData.forEach(p => {
        const trStr = `T${p.trackNumber}`.padEnd(5, ' ');
        const tStr = p.title.padEnd(24, ' ').substring(0, 24);
        const eStr = `${p.energy}%`.padStart(6, ' ');
        const iStr = `${p.intensity}%`.padStart(6, ' ');
        const fStr = p.flow || '';
        txt += `${trStr} | ${tStr} | ${eStr} | ${iStr} | ${fStr}\n`;
      });
      txt += `\n`;
    }

    if (session.holisticReview) {
      txt += `=======================================================\n`;
      txt += `      ARCHITECTURAL REVIEW: STRUCTURE, COHESION & IMPACT \n`;
      txt += `=======================================================\n\n`;
      txt += session.holisticReview;
      txt += `\n\n`;
    }

    txt += `=======================================================\n`;
    txt += `              TRACKLIST & DEEP-DIVE REVIEWS            \n`;
    txt += `=======================================================\n\n`;

    session.tracks.forEach((track, i) => {
      txt += `-------------------------------------------------------\n`;
      txt += `TRACK ${track.trackNumber || i + 1}: ${track.title}\n`;
      txt += `-------------------------------------------------------\n`;
      if (track.concept) txt += `Concept/Context: ${track.concept}\n`;
      if (track.lyrics) {
        txt += `\nLYRICS:\n${track.lyrics}\n`;
      }
      if (track.analysis) {
        txt += `\nDETAILED TRACK ANALYSIS:\n${track.analysis}\n`;
      }
      txt += `\n\n`;
    });

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(session.title || 'Album').replace(/\s+/g, '_')}_Executive_Dossier.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Full Album Dossier as PDF
  const handleExportAlbumPDF = async () => {
    if (!dossierRef.current || isExportingPDF) return;
    setIsExportingPDF(true);

    try {
      const element = dossierRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#0f172a',
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${(session.title || 'Album').replace(/\s+/g, '_')}_Executive_Dossier.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Export Session JSON
  const handleExportSessionJSON = () => {
    const jsonStr = JSON.stringify(session, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(session.title || 'Session').replace(/\s+/g, '_')}_session.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import Session JSON
  const handleImportSessionJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.tracks && Array.isArray(parsed.tracks)) {
          setSession(parsed);
        }
      } catch (err) {
        alert('Invalid session JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const completedCount = session.tracks.filter(t => t.status === 'completed').length;
  const isAnyProcessing = isBatchRunning || isHolisticRunning;

  return (
    <div className="space-y-8" id="album-session-container">
      {/* Top Header & Metadata Card */}
      <div className="bg-gradient-to-r from-gray-900/90 via-purple-950/40 to-gray-900/90 border border-purple-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-6">
        {/* Top Meta Bar with Presets & Work Lifecycle Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-pink-500/10 border border-pink-500/30 rounded-xl text-pink-400">
              <DiscIcon className="w-6 h-6 animate-spin-slow" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                  session.releaseStatus === 'released'
                    ? 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                    : 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                }`}>
                  {session.releaseStatus === 'released' ? '📀 Released Catalog Work' : '🚀 Unreleased Master Candidate'}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {session.tracks.length} Tracks ({completedCount} Analyzed)
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                {session.title || 'Untitled Album Session'}
              </h1>
            </div>
          </div>

          {/* Quick Presets & Demo Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 font-mono mr-1">Demo Presets:</span>
            <button
              onClick={() => {
                setSession({
                  id: `session-released-${Date.now()}`,
                  title: 'Echoes of the Grid',
                  artist: 'Kroma & The Synths',
                  concept: 'A celebrated narrative cyberpunk concept album depicting humanity rediscovering organic connection amidst an automated metropolis.',
                  genre: 'Cyberpunk Synthwave / Cinematic Industrial',
                  releaseStatus: 'released',
                  releaseYear: '2023',
                  tracks: DEFAULT_RELEASED_DEMO_TRACKS,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                });
                setAlbumArcData([]);
              }}
              className="text-xs font-mono px-2.5 py-1 rounded bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-700/50 transition-colors"
              title="Load a released catalog concept LP with rich narrative lore"
            >
              📀 Released Classic (2023)
            </button>
            <button
              onClick={() => {
                setSession({
                  id: `session-unreleased-${Date.now()}`,
                  title: 'Quantum Horizons',
                  artist: 'Vektor Pulse',
                  concept: 'An upcoming progressive electronic odyssey exploring faster-than-light journeying and human isolation across deep space.',
                  genre: 'Progressive Electronic / Ambient Spacecore',
                  releaseStatus: 'unreleased',
                  tracks: DEFAULT_UNRELEASED_DEMO_TRACKS,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                });
                setAlbumArcData([]);
              }}
              className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 transition-colors"
              title="Load an unreleased album candidate for pre-release single selection and pacing"
            >
              🚀 Pre-Release Candidate (2026)
            </button>
            <button
              onClick={() => {
                setSession({
                  id: `session-custom-${Date.now()}`,
                  title: 'My New Album',
                  artist: '',
                  concept: '',
                  genre: '',
                  releaseStatus: 'unreleased',
                  tracks: [],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                });
                setAlbumArcData([]);
              }}
              className="text-xs font-mono px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
              title="Start a clean blank album session"
            >
              ＋ Blank Slate
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-4 flex-1">
            {/* Work Lifecycle Status Selector */}
            <div className="bg-gray-950/70 border border-gray-800 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400 font-bold uppercase tracking-wider">Work Status:</span>
                <div className="inline-flex rounded-lg p-0.5 bg-gray-900 border border-gray-700">
                  <button
                    onClick={() => setSession(prev => ({ ...prev, releaseStatus: 'released' }))}
                    className={`px-3 py-1 text-xs font-mono font-bold rounded-md transition-all ${
                      session.releaseStatus === 'released'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    📀 Released Catalog
                  </button>
                  <button
                    onClick={() => setSession(prev => ({ ...prev, releaseStatus: 'unreleased' }))}
                    className={`px-3 py-1 text-xs font-mono font-bold rounded-md transition-all ${
                      session.releaseStatus === 'unreleased'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    🚀 Unreleased / Candidate
                  </button>
                </div>
              </div>

              {session.releaseStatus === 'released' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-mono text-gray-400">Release Year / Era:</label>
                  <input
                    type="text"
                    value={session.releaseYear || ''}
                    onChange={e => setSession(prev => ({ ...prev, releaseYear: e.target.value }))}
                    placeholder="e.g. 2023"
                    className="w-24 bg-gray-900 border border-gray-700 focus:border-amber-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              )}
            </div>

            {/* Quick Session Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-1">Album Title</label>
                <input
                  type="text"
                  value={session.title}
                  onChange={e => setSession(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Echoes of the Grid"
                  className="w-full bg-gray-950/80 border border-gray-700 focus:border-pink-500 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-1">Artist / Band</label>
                <input
                  type="text"
                  value={session.artist}
                  onChange={e => setSession(prev => ({ ...prev, artist: e.target.value }))}
                  placeholder="e.g. Kroma & The Synths"
                  className="w-full bg-gray-950/80 border border-gray-700 focus:border-purple-500 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-1">Target Genre / Sonic Domain</label>
                <input
                  type="text"
                  value={session.genre}
                  onChange={e => setSession(prev => ({ ...prev, genre: e.target.value }))}
                  placeholder="e.g. Darkwave / Cyberpunk"
                  className="w-full bg-gray-950/80 border border-gray-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-1">
                Overarching Album Concept, Narrative Thesis & Universe
              </label>
              <textarea
                value={session.concept}
                onChange={e => setSession(prev => ({ ...prev, concept: e.target.value }))}
                placeholder="Describe the central storyline, philosophical questions, emotional transformation, and sonic worldbuilding..."
                rows={2}
                className="w-full bg-gray-950/80 border border-gray-700 focus:border-pink-500 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none transition-colors"
              />
            </div>

            {/* Architectural Analytical Pillars Configuration */}
            <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase font-bold text-gray-300 tracking-wider flex items-center gap-1.5">
                  <SparkleIcon className="w-3.5 h-3.5 text-pink-400" />
                  Macro Architectural Analysis Dimensions
                </span>
                <span className="text-[10px] font-mono text-gray-500">Tailors Gemini Review Engine</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <label className="flex items-center gap-1.5 text-xs font-mono bg-gray-900 hover:bg-gray-850 px-2.5 py-1 rounded border border-gray-700/80 cursor-pointer select-none text-gray-200">
                  <input
                    type="checkbox"
                    checked={options.focusStructure}
                    onChange={e => setOptions(prev => ({ ...prev, focusStructure: e.target.checked }))}
                    className="accent-pink-500"
                  />
                  🏛️ Album Structure & 3-Act Arc
                </label>
                <label className="flex items-center gap-1.5 text-xs font-mono bg-gray-900 hover:bg-gray-850 px-2.5 py-1 rounded border border-gray-700/80 cursor-pointer select-none text-gray-200">
                  <input
                    type="checkbox"
                    checked={options.focusCohesion}
                    onChange={e => setOptions(prev => ({ ...prev, focusCohesion: e.target.checked }))}
                    className="accent-purple-500"
                  />
                  🧬 Thematic & Sonic Cohesion
                </label>
                <label className="flex items-center gap-1.5 text-xs font-mono bg-gray-900 hover:bg-gray-850 px-2.5 py-1 rounded border border-gray-700/80 cursor-pointer select-none text-gray-200">
                  <input
                    type="checkbox"
                    checked={options.focusMessage}
                    onChange={e => setOptions(prev => ({ ...prev, focusMessage: e.target.checked }))}
                    className="accent-cyan-500"
                  />
                  💡 Core Message & Thesis
                </label>
                <label className="flex items-center gap-1.5 text-xs font-mono bg-gray-900 hover:bg-gray-850 px-2.5 py-1 rounded border border-gray-700/80 cursor-pointer select-none text-gray-200">
                  <input
                    type="checkbox"
                    checked={options.focusImportance}
                    onChange={e => setOptions(prev => ({ ...prev, focusImportance: e.target.checked }))}
                    className="accent-amber-500"
                  />
                  👑 {session.releaseStatus === 'released' ? 'Legacy & Historical Standing' : 'Cultural Importance & Horizon'}
                </label>
                <label className="flex items-center gap-1.5 text-xs font-mono bg-gray-900 hover:bg-gray-850 px-2.5 py-1 rounded border border-gray-700/80 cursor-pointer select-none text-gray-200">
                  <input
                    type="checkbox"
                    checked={options.focusTrackSynergy}
                    onChange={e => setOptions(prev => ({ ...prev, focusTrackSynergy: e.target.checked }))}
                    className="accent-pink-500"
                  />
                  🕸️ Track Synergy Matrix
                </label>
                <label className="flex items-center gap-1.5 text-xs font-mono bg-gray-900 hover:bg-gray-850 px-2.5 py-1 rounded border border-gray-700/80 cursor-pointer select-none text-gray-200">
                  <input
                    type="checkbox"
                    checked={options.includeSequencingReview}
                    onChange={e => setOptions(prev => ({ ...prev, includeSequencingReview: e.target.checked }))}
                    className="accent-blue-500"
                  />
                  ⚡ Pacing & Sequence Audit
                </label>
                <label className="flex items-center gap-1.5 text-xs font-mono bg-gray-900 hover:bg-gray-850 px-2.5 py-1 rounded border border-gray-700/80 cursor-pointer select-none text-gray-200">
                  <input
                    type="checkbox"
                    checked={options.includeCommercialPotential}
                    onChange={e => setOptions(prev => ({ ...prev, includeCommercialPotential: e.target.checked }))}
                    className="accent-emerald-500"
                  />
                  🎯 {session.releaseStatus === 'released' ? 'Standout Anthems & Cult Cuts' : 'Single Strategy & Target Fits'}
                </label>
              </div>
            </div>
          </div>

          {/* Album Cover & Session Persistence Controls */}
          <div className="flex flex-col items-center sm:items-end justify-between gap-4 border-t lg:border-t-0 lg:border-l border-gray-800 pt-4 lg:pt-0 lg:pl-6 min-w-[220px]">
            {session.albumArtUrl ? (
              <div className="relative group rounded-xl overflow-hidden border-2 border-pink-500/40 shadow-xl w-36 h-36">
                <img src={session.albumArtUrl} alt="Album Art" className="w-full h-full object-cover" />
                <button
                  onClick={handleGenerateCoverArt}
                  disabled={isGeneratingArt}
                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-mono font-bold text-white transition-opacity"
                >
                  {isGeneratingArt ? 'Generating...' : 'Regenerate'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateCoverArt}
                disabled={isGeneratingArt}
                className="w-36 h-36 rounded-xl border border-dashed border-gray-700 hover:border-pink-500/60 bg-gray-950/60 flex flex-col items-center justify-center text-center p-3 text-gray-400 hover:text-pink-300 transition-all cursor-pointer"
              >
                {isGeneratingArt ? (
                  <Loader />
                ) : (
                  <>
                    <SparkleIcon className="w-6 h-6 mb-1 text-pink-400" />
                    <span className="text-[11px] font-mono">Generate Concept Cover</span>
                  </>
                )}
              </button>
            )}

            {/* Session JSON Load/Save */}
            <div className="flex flex-wrap gap-2 w-full justify-end text-[11px] font-mono">
              <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1.5 rounded border border-gray-700 transition-colors">
                Import JSON
                <input type="file" accept=".json" onChange={handleImportSessionJSON} className="hidden" />
              </label>
              <button
                onClick={handleExportSessionJSON}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1.5 rounded border border-gray-700 transition-colors"
                title="Save this entire session state to your hard drive"
              >
                Save JSON
              </button>
            </div>
          </div>
        </div>

        {/* Live Batch Execution Banner */}
        {isBatchRunning && (
          <div className="mt-5 p-4 bg-pink-950/40 border border-pink-500/50 rounded-xl animate-pulse flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Loader />
              <div>
                <p className="text-sm font-bold text-pink-300 font-mono">
                  {batchProgress.currentTrackTitle}
                </p>
                <div className="w-48 sm:w-64 bg-gray-900 rounded-full h-1.5 mt-1 overflow-hidden border border-pink-500/30">
                  <div 
                    className="bg-gradient-to-r from-pink-500 to-purple-500 h-full transition-all duration-300"
                    style={{ width: `${Math.round((batchProgress.current / (batchProgress.total || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleStopBatch}
              className="px-3 py-1 bg-red-900/60 hover:bg-red-800 border border-red-500/40 text-red-200 text-xs font-mono font-bold rounded transition-colors"
            >
              Pause Pipeline
            </button>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('tracklist')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold transition-all ${
              activeSubTab === 'tracklist'
                ? 'bg-pink-600/20 text-pink-300 border border-pink-500/40 shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <LayersIcon className="w-4 h-4" />
            Tracklist Workflow ({session.tracks.length})
          </button>

          <button
            onClick={() => setActiveSubTab('review')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold transition-all ${
              activeSubTab === 'review'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <DiscIcon className="w-4 h-4" />
            Holistic Dossier {session.holisticReview ? '✓' : ''}
          </button>

          <button
            onClick={() => setActiveSubTab('batch_upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold transition-all ${
              activeSubTab === 'batch_upload'
                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <UploadIcon className="w-4 h-4" />
            Bulk Ingest
          </button>
        </div>

        {/* Global Action Workflow Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunHolisticOnly}
            disabled={isAnyProcessing || session.tracks.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-50 cursor-pointer"
            title="Fast mode: Synthesize the full album concept directly in 1 swift Gemini call"
          >
            {isHolisticRunning ? <Loader /> : <SparkleIcon className="w-3.5 h-3.5" />}
            Fast Macro Review
          </button>

          <button
            onClick={handleRunAlbumBatch}
            disabled={isAnyProcessing || session.tracks.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider shadow-lg hover:shadow-pink-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isBatchRunning ? <Loader /> : <PlayIcon className="w-3.5 h-3.5" />}
            Run Full Album Pipeline
          </button>
        </div>
      </div>

      {/* VIEW 1: Tracklist Management & Individual Workflows */}
      {activeSubTab === 'tracklist' && (
        <div className="space-y-6">
          {/* Tracklist Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-900/60 p-4 rounded-xl border border-gray-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                <LayersIcon className="w-4 h-4 text-pink-400" />
                Track Sequence Matrix
              </h3>
              <p className="text-xs text-gray-400">Reorder tracks, edit lyrics, upload individual audio files, or run per-track analyses.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddTrack}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
              >
                <PlusIcon className="w-4 h-4 text-pink-400" />
                Add Track
              </button>
            </div>
          </div>

          {/* Tracks List */}
          <div className="space-y-4">
            {session.tracks.map((track, index) => {
              const isExpanded = expandedTrackId === track.id;
              const hasAnalysis = Boolean(track.analysis);

              return (
                <div
                  key={track.id}
                  className={`border rounded-xl transition-all duration-200 ${
                    isExpanded 
                      ? 'border-pink-500/40 bg-gray-900/90 shadow-xl' 
                      : 'border-gray-800 bg-gray-900/40 hover:border-gray-700'
                  }`}
                >
                  {/* Collapsed Header */}
                  <div
                    onClick={() => setExpandedTrackId(isExpanded ? null : track.id)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center font-mono font-black text-xs text-pink-400">
                        {track.trackNumber || index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white truncate">
                            {track.title || `Track ${index + 1}`}
                          </h4>
                          {track.status === 'completed' && (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <CheckCircleIcon className="w-3 h-3" /> Ready
                            </span>
                          )}
                          {track.status === 'processing' && (
                            <span className="text-[10px] font-mono text-pink-400 bg-pink-950/60 border border-pink-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Loader /> Analyzing
                            </span>
                          )}
                          {track.status === 'error' && (
                            <span className="text-[10px] font-mono text-red-400 bg-red-950/60 border border-red-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <AlertCircleIcon className="w-3 h-3" /> Error
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 font-mono truncate">
                          {track.lyrics ? `${track.lyrics.length} chars lyrics` : track.file ? `Audio: ${track.file.name}` : 'No lyrics or audio attached yet'}
                        </p>
                      </div>
                    </div>

                    {/* Actions & Reordering */}
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleMoveTrack(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-20"
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveTrack(index, 'down')}
                        disabled={index === session.tracks.length - 1}
                        className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-20"
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => handleDeleteTrack(track.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors ml-2"
                        title="Delete Track"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Track Editor */}
                  {isExpanded && (
                    <div className="border-t border-gray-800 p-5 space-y-5 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-1">Track Title</label>
                          <input
                            type="text"
                            value={track.title}
                            onChange={e => handleUpdateTrack(track.id, { title: e.target.value })}
                            className="w-full bg-gray-950 border border-gray-700 focus:border-pink-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider block mb-1">Track Concept / Scene Goal</label>
                          <input
                            type="text"
                            value={track.concept || ''}
                            onChange={e => handleUpdateTrack(track.id, { concept: e.target.value })}
                            placeholder="e.g. Climax track where protagonist breaks free"
                            className="w-full bg-gray-950 border border-gray-700 focus:border-purple-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* File Uploader & Lyrics Input */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">Lyrics / Structural Notes</label>
                          
                          {/* File input */}
                          <label className="cursor-pointer text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                            <UploadIcon className="w-3.5 h-3.5" />
                            {track.file ? `Attached: ${track.file.name}` : 'Attach Audio or .txt'}
                            <input
                              type="file"
                              accept="audio/*,text/plain"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const processed = await processAndValidateFile(file);
                                    if (processed.type === 'text') {
                                      handleUpdateTrack(track.id, { lyrics: processed.content, fileName: file.name });
                                    } else if (processed.type === 'audio') {
                                      handleUpdateTrack(track.id, { file: file, fileName: file.name });
                                    }
                                  } catch (err) {
                                    alert((err as Error).message);
                                  }
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                        <textarea
                          value={track.lyrics}
                          onChange={e => handleUpdateTrack(track.id, { lyrics: e.target.value })}
                          placeholder="Paste verse, chorus, bridge, and vocal cues..."
                          rows={6}
                          className="w-full bg-gray-950 border border-gray-700 focus:border-pink-500 rounded-lg p-3 text-xs font-mono text-gray-200 focus:outline-none"
                        />
                      </div>

                      {/* Individual Track Action */}
                      <div className="flex items-center justify-between pt-2">
                        <button
                          onClick={() => handleAnalyzeSingleTrack(track.id)}
                          disabled={track.status === 'processing'}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-pink-400 border border-pink-500/30 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {track.status === 'processing' ? <Loader /> : <SparkleIcon className="w-4 h-4" />}
                          {hasAnalysis ? 'Re-Analyze This Track' : 'Analyze This Track'}
                        </button>

                        {hasAnalysis && (
                          <span className="text-xs font-mono text-gray-400">Analysis completed</span>
                        )}
                      </div>

                      {/* Track Visualizer (if generated) */}
                      {track.visualizerPoints && track.visualizerPoints.length > 0 && (
                        <div className="pt-2">
                          <Visualizer data={track.visualizerPoints} />
                        </div>
                      )}

                      {/* Track Markdown Analysis Output */}
                      {track.analysis && (
                        <div className="bg-gray-950/80 p-5 rounded-xl border border-gray-800 mt-4 space-y-3">
                          <h5 className="text-xs font-mono uppercase font-bold text-pink-400 tracking-wider">Track Analysis Output</h5>
                          {renderMarkdown(track.analysis)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: Executive Holistic Album Dossier */}
      {activeSubTab === 'review' && (
        <div className="space-y-6">
          {/* Dossier Top Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-900/80 p-4 rounded-xl border border-gray-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                <DiscIcon className="w-4 h-4 text-purple-400" />
                Executive Album Dossier
              </h3>
              <p className="text-xs text-gray-400">Comprehensive album-level critique, pacing arc, thematic synergy, and single breakdowns.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAlbumTXT}
                className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase bg-gray-800 hover:bg-gray-700 text-cyan-400 border border-cyan-500/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <DownloadIcon className="w-4 h-4" />
                Export TXT
              </button>
              <button
                onClick={handleExportAlbumPDF}
                disabled={isExportingPDF}
                className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase bg-gray-800 hover:bg-gray-700 text-pink-400 border border-pink-500/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isExportingPDF ? <Loader /> : <DownloadIcon className="w-4 h-4" />}
                {isExportingPDF ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>
          </div>

          {/* Printable / Rendered Dossier Content */}
          <div ref={dossierRef} className="space-y-6 bg-gray-900/90 p-6 sm:p-8 rounded-2xl border border-gray-800 shadow-2xl">
            {/* Album Header Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-800 pb-6 gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                    session.releaseStatus === 'released'
                      ? 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                      : 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                  }`}>
                    {session.releaseStatus === 'released' 
                      ? `📀 Released Catalog Review ${session.releaseYear ? `(${session.releaseYear})` : ''}`
                      : '🚀 Pre-Release Master Candidate'
                    }
                  </span>
                  <span className="text-xs font-mono text-purple-400">
                    {session.tracks.length} Master Tracks • {session.genre || 'Contemporary Album'}
                  </span>
                </div>
                <h2 className="text-3xl font-black text-white">{session.title || 'Untitled Project'}</h2>
                <p className="text-sm font-mono text-pink-400 font-bold">{session.artist || 'Unknown Artist'}</p>
                <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">{session.concept}</p>

                {/* Analytical Pillars Badges */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {options.focusStructure && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-pink-300 border border-gray-700">
                      🏛️ 3-Act Structure
                    </span>
                  )}
                  {options.focusCohesion && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-purple-300 border border-gray-700">
                      🧬 Sonic Cohesion
                    </span>
                  )}
                  {options.focusMessage && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-cyan-300 border border-gray-700">
                      💡 Philosophical Thesis
                    </span>
                  )}
                  {options.focusImportance && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-amber-300 border border-gray-700">
                      👑 {session.releaseStatus === 'released' ? 'Historical Canon' : 'Cultural Horizon'}
                    </span>
                  )}
                  {options.focusTrackSynergy && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-emerald-300 border border-gray-700">
                      🕸️ Track Synergy Ecosystem
                    </span>
                  )}
                </div>
              </div>

              {session.albumArtUrl && (
                <img
                  src={session.albumArtUrl}
                  alt="Album Art"
                  className="w-32 h-32 rounded-xl object-cover border-2 border-pink-500/30 shadow-2xl flex-shrink-0"
                />
              )}
            </div>

            {/* D3 Album Arc Visualizer */}
            {albumArcData.length > 0 && (
              <div className="pt-2">
                <AlbumArcVisualizer data={albumArcData} />
              </div>
            )}

            {/* Holistic Markdown Content */}
            {session.holisticReview ? (
              <div className="pt-4 space-y-4">
                {renderMarkdown(session.holisticReview)}
              </div>
            ) : (
              <div className="text-center py-16 space-y-4 border border-dashed border-gray-800 rounded-xl">
                <DiscIcon className="w-12 h-12 text-gray-600 mx-auto" />
                <div>
                  <h4 className="text-base font-bold text-gray-300">No Holistic Album Review Generated Yet</h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                    Click "Run Full Album Pipeline" or "Fast Macro Review" above to analyze all {session.tracks.length} tracks and generate the executive dossier.
                  </p>
                </div>
                <button
                  onClick={handleRunHolisticOnly}
                  disabled={isAnyProcessing || session.tracks.length === 0}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Generate Macro Review Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: Bulk Ingest Dropzone & Batch Text Parser */}
      {activeSubTab === 'batch_upload' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Multi-file drag & drop zone */}
            <div className="bg-gray-900/60 p-6 rounded-xl border border-gray-800 space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
                  <UploadIcon className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-white font-mono">Bulk Audio & Text File Ingest</h4>
                  <p className="text-xs text-gray-400">Upload multiple .mp3, .wav, .m4a, or .txt files at once.</p>
                </div>
              </div>

              <label className="border-2 border-dashed border-gray-700 hover:border-cyan-500/60 bg-gray-950/60 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                <MusicNoteIcon className="w-10 h-10 text-cyan-400 mb-2 animate-bounce" />
                <span className="text-sm font-bold text-gray-200">Drag & Drop Files Here</span>
                <span className="text-xs text-gray-500 mt-1">or click to browse your disk</span>
                <input
                  type="file"
                  multiple
                  accept="audio/*,text/plain"
                  onChange={e => handleBulkFilesUpload(e.target.files)}
                  className="hidden"
                />
              </label>

              <div className="text-[11px] text-gray-500 font-mono space-y-1">
                <p>✓ Automatically extracts track titles from file names.</p>
                <p>✓ Preserves high-resolution audio attachments for deep-listening critiques.</p>
              </div>
            </div>

            {/* Paste full multi-track lyrics document */}
            <div className="bg-gray-900/60 p-6 rounded-xl border border-gray-800 space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400">
                  <FileTextIcon className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-white font-mono">Paste Album Lyrics Sheet</h4>
                  <p className="text-xs text-gray-400">Paste an entire LP/EP document. Tracks will be auto-split.</p>
                </div>
              </div>

              <textarea
                value={bulkTextInput}
                onChange={e => setBulkTextInput(e.target.value)}
                placeholder="Track 1: Midnight Horizon
[Verse 1]
Static on the radio...

Track 2: Neon Pulse
[Chorus]
Faster than light..."
                rows={7}
                className="w-full bg-gray-950 border border-gray-700 focus:border-purple-500 rounded-lg p-3 text-xs font-mono text-gray-200 focus:outline-none"
              />

              <button
                onClick={handleImportBulkText}
                disabled={!bulkTextInput.trim()}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer"
              >
                Auto-Split & Append Tracks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumSessionReview;
